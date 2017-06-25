var Bundle = require('magic-string').Bundle
var transformAst = require('transform-ast')
var through = require('through2')
var umd = require('umd')
var json = require('JSONStream')

var dedupedRx = /^arguments\[4\]\[(\d+)\]/

function parseModule (row, index, rows) {
  var moduleExportsName = row.exportsName = '__module_' + row.id
  if (dedupedRx.test(row.source)) {
    var n = row.source.match(dedupedRx)[1]
    var dedup = rows.filter(function (other) {
      return String(other.id) === n
    })[0]
    row.source = dedup.source
  }

  // variable references
  var moduleList = []
  var moduleExportsList = []
  var exportsList = []
  var globals = {}
  var identifiers = {}

  var shouldWrap = false
  var ast
  var source = transformAst(row.source, function (node) {
    if (node.type === 'Program') ast = node
    registerScopeBindings(node)

    // Bit awkward, `transform-ast` traverses children before parents
    // so we don't have the scope information of parent nodes here just yet.
    // So we collect everything that we may have to replace, and then filter
    // it down to only actually-module-global bindings below.
    if (isModuleExports(node)) {
      moduleExportsList.push(node)
    } else if (isExports(node)) {
      exportsList.push(node)
    } else if (isRequire(node)) {
      var required = node.arguments[0].value
      if (row.deps[required] && moduleExists(row.deps[required])) {
        var other = rows.find(function (other) { return other.id === row.deps[required] })
        if (other && other.isCycle) {
          node.update('__cycle(' + row.deps[required] + ')')
        } else if (other && other.exportsName) {
          node.update(other.exportsName)
        } else {
          node.update('__module_' + row.deps[required])
        }
      }
    } else if (isModule(node)) {
      moduleList.push(node)
    } else {
      if (isFreeIdentifier(node)) {
        pushIdentifier(node)
      } else if (isShorthandProperty(node)) {
        pushIdentifier(node)
      }
      if (isTopLevelDefinition(node)) {
        globals[node.name] = true
      }
    }
  })
  function pushIdentifier (node) {
    var name = node.name
    if (!Array.isArray(identifiers[name])) {
      identifiers[name] = [node]
    } else {
      identifiers[name].push(node)
    }
  }
  function moduleExists (id) {
    return rows.some(function (row) {
      return String(row.id) === String(id)
    })
  }

  // We only care about module-global variables
  moduleExportsList = moduleExportsList.filter(function (node) { return isModuleGlobal(node.object) })
  exportsList = exportsList.filter(isModuleGlobal)
  moduleList = moduleList.filter(isModuleGlobal)

  shouldWrap = moduleExportsList.length > 0 && exportsList.length > 0
  if (!shouldWrap && !row.isCycle) { // cycles are always wrapped
    moduleExportsList.concat(exportsList).forEach(function (node) {
      node.update(moduleExportsName)
    })
    moduleList.forEach(function (node) {
      if (node.parent.type === 'UnaryExpression' && node.parent.operator === 'typeof') {
        node.parent.update('"object"')
      } else {
        node.update('({exports:' + moduleExportsName + '})')
      }
    })
    Object.keys(globals).forEach(function (name) {
      identifiers[name].forEach(function (node) {
        if (isModuleGlobal(node)) {
          if (isShorthandProperty(node)) {
            node.update(node.name + ': __' + node.name + '_' + row.id)
          } else {
            node.update('__' + node.name + '_' + row.id)
          }
        }
      })
    })
  }

  row.hasExports = (moduleExportsList.length + exportsList.length) > 0

  if (row.isCycle) {
    source.prepend('__cycle[' + JSON.stringify(row.id) + '] = (function (module, exports) {\n')
    source.append('});')
  } else if (shouldWrap) {
    source
      .prepend('var ' + moduleExportsName + '_module = { exports: {} }; (function(module,exports){\n')
      .append('})(' + moduleExportsName + '_module,' + moduleExportsName + '_module.exports);\n' +
              'var ' + moduleExportsName + ' = ' + moduleExportsName + '_module.exports;')
  } else {
    source.prepend('var ' + moduleExportsName + ' = {};\n')
  }

  row.flatSource = source

  return row

  // Get the scope that a declaration will be declared in
  function getScope (node, blockScope) {
    var parent = node
    while ((parent = parent.parent)) {
      if (isFunction(parent)) {
        return parent
      }
      if (blockScope && parent.type === 'BlockStatement') {
        return parent
      }
      if (parent.type === 'Program') {
        return parent
      }
    }
    return ast
  }
  // Get the scope that this identifier has been declared in
  function getDeclaredScope (id) {
    var parent = id
    // Jump over one parent if this is a function's name--the variables
    // and parameters _inside_ the function are attached to the FunctionDeclaration
    // so if a variable inside the function has the same name as the function,
    // they will conflict.
    // Here we jump out of the FunctionDeclaration so we can start by looking at the
    // surrounding scope
    if (isFunction(id.parent) && id.parent.id === id) {
      parent = id.parent
    }
    while ((parent = parent.parent)) {
      if (parent.bindings && parent.bindings.indexOf(id.name) !== -1) {
        return parent
      }
    }
    return ast
  }
  function isModuleGlobal (id) {
    return getDeclaredScope(id) === ast
  }
  function registerScopeBindings (node) {
    if (node.type === 'VariableDeclaration') {
      var scope = getScope(node, node.kind !== 'var')
      if (!scope.bindings) scope.bindings = []
      node.declarations.forEach(function (decl) {
        scope.bindings.push(decl.id.name)
      })
    }
    if (isFunction(node)) {
      var scope = getScope(node, false)
      if (!scope.bindings) scope.bindings = []
      if (node.id && node.id.type === 'Identifier') scope.bindings.push(node.id.name)

      if (!node.bindings) node.bindings = []
      node.params.forEach(function (param) {
        node.bindings.push(param.name)
      })
    }
  }
}

/**
 * Helper used in the output bundle in case of dependency cycles.
 * Properties defined on the `factories` function are module factories, taking a
 * `module` and an `exports` argument.
 * The `.r` property of this function will contain the module cache.
 */
var resolveCycleRuntime = function factories (id) {
  var resolved = factories.r
  if (resolved[id]) return resolved[id].exports
  if (factories.hasOwnProperty(id)) {
    resolved[id] = { exports: {} }
    factories[id](resolved[id], resolved[id].exports)
    return resolved[id].exports
  }
  throw new Error('Cannot find module #' + id)
}

function flatten (rows, opts) {
  rows = sortModules(rows)
  var containsCycles = detectCycles(rows)

  var bundle = new Bundle()
  var includeMap = false

  // Add the circular dependency runtime if necessary.
  if (containsCycles) {
    bundle.prepend('var __cycle = ' + resolveCycleRuntime + '; __cycle.r = {};\n')
  }

  rows.map(parseModule).forEach(function (row) {
    if (row.sourceFile && !row.nomap) {
      includeMap = true
    }
    bundle.addSource({
      filename: row.sourceFile,
      content: row.flatSource
    })
  })

  for (var i = 0; i < rows.length; i++) {
    if (rows[i].entry && rows[i].hasExports) {
      if (opts.standalone) {
        bundle.append('\nreturn ' + rows[i].exportsName + ';\n')
      } else {
        bundle.append('\nmodule.exports = ' + rows[i].exportsName + ';\n')
      }
    }
  }

  if (opts.standalone) {
    bundle.prepend(umd.prelude(opts.standalone))
    bundle.append(umd.postlude(opts.standalone))
  } else {
    bundle.prepend('(function(){\n')
    bundle.append('}());')
  }

  var result = bundle.toString()
  if (includeMap) {
    var map = bundle.generateMap({
      includeContent: true
    })
    result += '\n//# sourceMappingURL=' + map.toUrl()
  }
  return result
}

module.exports = function browserPackFlat(opts) {
  opts = opts || {}

  var rows = []

  var packer = through.obj(onwrite, onend)
  if (!opts.raw) {
    packer = json.parse([ true ]).pipe(packer)
  }

  var stream = through.obj(function (chunk, enc, cb) {
    packer.write(chunk)
    cb()
  }, function (cb) {
    packer.end()
    cb()
  })

  return stream

  function onwrite (row, enc, cb) {
    rows.push(row)
    cb(null)
  }
  function onend (cb) {
    try {
      stream.push(flatten(rows, opts || {}))
      cb(null)
    } catch (err) {
      cb(err)
    }
  }
}

function sortModules (rows) {
  var modules = {}
  var seen = {}
  rows.forEach(function (row) {
    modules[row.id] = row
  })

  var sorted = []
  rows.forEach(function visit (row) {
    if (!row || seen[row.id]) return
    seen[row.id] = true
    if (row.deps) {
      Object.keys(row.deps).sort(function (a, b) {
        // ensure the order is consistent
        return row.deps[a] - row.deps[b]
      }).map(function (dep) {
        return modules[row.deps[dep]]
      }).forEach(visit)
    }
    sorted.push(row)
  })
  return sorted
}

/**
 * Detect cyclical dependencies in the bundle. All modules in a dependency cycle
 * are moved to the top of the bundle and wrapped in functions so they're not
 * evaluated immediately. When other modules need a module that's in a dependency
 * cycle, instead of using the module's exportName, it'll call the `__cycle` runtime
 * function, which will execute the requested module and return its exports.
 */
function detectCycles (rows) {
  var rowsById = {}
  rows.forEach(function (row) { rowsById[row.id] = row })

  var cyclicalModules = new Set
  rows.forEach(function (module) {
    var visited = []

    check(module)

    function check (row) {
      var i = visited.indexOf(row)
      if (i !== -1) {
        for (; i < visited.length; i++) {
          cyclicalModules.add(visited[i])
        }
        return
      }
      visited.push(row)
      Object.keys(row.deps).forEach(function (k) {
        var dep = row.deps[k]
        var other = rowsById[dep]
        if (other) check(other, visited)
      })
      visited.pop()
    }
  })

  // move modules in a dependency cycle to the top of the bundle and mark them as being cyclical.
  for (var i = 0; i < rows.length; i++) {
    if (cyclicalModules.has(rows[i])) {
      var row = rows.splice(i, 1)
      rows.unshift(row[0])
      row[0].isCycle = true
    }
  }
  return cyclicalModules.size > 0
}

function isModuleExports (node) {
  return node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' && node.object.name === 'module' &&
    (node.property.type === 'Identifier' && node.property.name === 'exports' ||
      node.property.type === 'Literal' && node.property.value === 'exports')
}
function isModule (node) {
  return isFreeIdentifier(node) && node.name === 'module' &&
    !isModuleExports(node.parent)
}
function isExports (node) {
  return isFreeIdentifier(node) && node.name === 'exports'
}
function isRequire (node) {
  return node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' && node.callee.name === 'require'
}
function isObjectKey (node) {
  return node.parent.type === 'Property' && node.parent.key === node
}
function isShorthandProperty (node) {
  return node.type === 'Identifier' && isObjectKey(node) && node.parent.shorthand
}
function isFreeIdentifier (node) {
  return node.type === 'Identifier' &&
    !isObjectKey(node) &&
    (node.parent.type !== 'MemberExpression' || node.parent.object === node ||
      (node.parent.property === node && node.parent.computed))
}
function isInTopLevelScope (node, lex) {
  var parent = node.parent
  do {
    if (parent.type === 'FunctionDeclaration' || parent.type === 'FunctionExpression' || parent.type === 'ArrowFunctionExpression') {
      return false
    }
    if (lex && parent.type === 'BlockStatement') {
      return false
    }
  } while ((parent = parent.parent))
  return true
}
function isTopLevelDefinition (node) {
  if (node.type === 'Identifier' && node.parent.type === 'FunctionDeclaration') {
    return isInTopLevelScope(node.parent, false)
  }
  if (node.type === 'Identifier' && node.parent.type === 'VariableDeclarator' &&
      node.parent.id === node) {
    return isInTopLevelScope(node.parent, node.parent.parent.kind !== 'var')
  }
  return false
}

function isFunction (node) {
  return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'
}
