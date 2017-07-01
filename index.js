var pathParse = require('path-parse')
var path = require('path')
var Bundle = require('magic-string').Bundle
var transformAst = require('transform-ast')
var through = require('through2')
var umd = require('umd')
var json = require('JSONStream')
var Binding = require('./lib/binding')
var Scope = require('./lib/scope')

var dedupedRx = /^arguments\[4\]\[(\d+)\]/
var CYCLE_HELPER = 'function r(o){var t=r.r;if(t[o])return t[o].exports;if(r.hasOwnProperty(o))return t[o]={exports:{}},r[o](t[o],t[o].exports),t[o].exports;throw new Error("Cannot find module #"+o)}'
var DEFAULT_EXPORT = Symbol('default export')

function parseModule (row, index, rows) {
  // Holds the `module.exports` variable name.
  row.exportsName = '_$' + getModuleName(row.file || '') + '_' + row.id
  if (dedupedRx.test(row.source)) {
    var n = row.source.match(dedupedRx)[1]
    var dedup = rows.filter(function (other) {
      return String(other.id) === n
    })[0]
    row.source = dedup.source
  }

  var requireCalls = []

  var ast
  // hack to keep track of `module`/`exports` references correctly.
  // in node.js they're defined by a function wrapper, so their scope is
  // one level higher-ish than the module scope. this emulates that.
  var globalScope = {
    type: 'BrowserPackFlatWrapper',
    parent: null,
    scope: new Scope()
      .define(new Binding('module'))
      .define(new Binding('exports'))
  }

  var source = removeSourceMappingComment(row.source)
  var magicString = transformAst(source, function (node) {
    if (node.type === 'Program') ast = node
    registerScopeBindings(node)

    if (isRequire(node)) {
      var required = node.arguments[0].value
      if (row.deps[required] && moduleExists(row.deps[required])) {
        var other = rows.byId[row.deps[required]]
        requireCalls.push({
          id: row.deps[required],
          node: node,
          requiredModule: other
        })
      }
    }
  })
  magicString.walk(function (node) {
    ast.parent = globalScope
    if (isFreeIdentifier(node)) {
      registerReference(node)
    } else if (isShorthandProperty(node)) {
      registerReference(node)
    }
  })
  function moduleExists (id) {
    return rows.some(function (row) {
      return String(row.id) === String(id)
    })
  }

  var moduleExportsList = globalScope.scope.getReferences('module')
    .map(function (node) { return node.parent })
    .filter(isModuleExports)
  var exportsList = globalScope.scope.getReferences('exports')
  var moduleList = globalScope.scope.getReferences('module')
    .filter(function (node) { return !isModuleExports(node.parent) })

  // Detect simple exports that are just `module.exports = `, we can compile them to a single
  // variable assignment.
  var isSimpleExport = false
  if (moduleExportsList.length === 1 && exportsList.length === 0 && moduleList.length === 0) {
    var node = moduleExportsList[0]
    if (node.parent.type === 'AssignmentExpression' && node.parent.left === node &&
        node.parent.parent.type === 'ExpressionStatement') {
      isSimpleExport = getScope(node.object, false) === ast

      // Change the module variable name to something nice if a named thing is being exported.
      var name = getNodeName(node.parent.right)
      if (name) {
        row.exportsName = '_$' + name + '_' + row.id
      }
    }
  }

  // Need to keep the exports object in a few cases:
  row.keepExportObject =
    // If this is a cyclical module, because the module can only be accessed thru its exports object
    // (through the cycle() helper)
    row.isCycle ||
    // If this is the entry module, since we may need to expose its exports object to the world
    row.entry ||
    // If this module uses the `module` variable, since it will get a wrapper. This one can probably
    // be avoided but that's not happening right now.
    moduleList.length > 0

  var exports = collectExports(row, globalScope)
  if (exports.has(DEFAULT_EXPORT)) row.keepExportObject = true

  var imports = collectImports(row, requireCalls)

  row.ast = ast
  row.isSimpleExport = isSimpleExport
  row.exports = exports
  row.imports = imports
  row.hasExports = (moduleExportsList.length + exportsList.length) > 0
  row.requireCalls = requireCalls
  row.references = {
    module: moduleList,
    exports: exportsList,
    'module.exports': moduleExportsList
  }
  row.magicString = magicString
}

function collectExports (row, globalScope) {
  var exports = new Map()
  var exportsList = globalScope.scope.getReferences('exports')
  var moduleExportsList = globalScope.scope.getReferences('module')
    .map(function (node) { return node.parent })
    .filter(isModuleExports)

  exportsList.concat(moduleExportsList).forEach(function (node) {
    // This thing checks for `exports.xyz =` cases.
    if (node.parent.type === 'MemberExpression' && node.parent.object === node &&
        !node.parent.computed && node.parent.property.type === 'Identifier' &&
        node.parent.parent.type === 'AssignmentExpression') {
      exports.set(node.parent.property.name, {
        node: node.parent,
        name: row.exportsName + '$$' + node.parent.property.name
      })
    } else {
      exports.set(DEFAULT_EXPORT, {
        node: node,
        name: row.exportsName
      })
    }
  })

  return exports
}

function collectImports (row, requireCalls) {
  var imports = new Map()

  requireCalls.forEach(function (req) {
    var other = req.requiredModule

    // Find name for this import in the module.
    var assignment = req.node.parent
    var name
    if (assignment.type === 'VariableDeclarator' && assignment.init === req.node) {
      name = assignment.id
    }
    if (assignment.type === 'AssignmentExpression' && assignment.right === req.node) {
      name = assignment.left
    }

    var thisImports = imports.get(req.id)
    if (!thisImports) {
      thisImports = Object.create(null)
      thisImports[DEFAULT_EXPORT] = []
      imports.set(req.id, thisImports)
    }

    // If the `require()` result is used for something other than assigning or
    // `.xyz`-ing, we bail out and use the exports object.
    if (!name || name.type !== 'Identifier') {
      thisImports[DEFAULT_EXPORT].push({
        node: req.node,
        module: other
      })
      other.keepExportObject = true
      return
    }

    var scope = getDeclaredScope(name)
    var references = scope.scope.getReferences(name.name)

    references.forEach(function (node) {
      if (node === name) return // ignore `xyz = require('abc')` assignment

      // Collect `.xyz` uses of the module, which can (maybe) be rewritten to simple variables
      if (node.parent.type === 'MemberExpression' && node.parent.object === node) {
        var property = node.parent.property
        if (!node.parent.computed && property.type === 'Identifier' && other.exports.has(property.name)) {
          thisImports[property.name] = thisImports[property] || []
          thisImports[property.name].push({
            module: other,
            node: node.parent
          })
          return
        }
      }
      // Otherwise bail out and use the exports object.
      thisImports[DEFAULT_EXPORT].push({
        module: other,
        node: node
      })
      other.keepExportObject = true
    })
  })

  return imports
}

function rewriteModule (row, i, rows) {
  var moduleExportsName = row.exportsName
  var moduleBaseName

  var ast = row.ast
  var magicString = row.magicString
  var moduleList = row.references.module
  var moduleExportsList = row.references['module.exports']
  var exportsList = row.references.exports

  // If `module` is used as a free variable we need to turn it into an object with an `.exports`
  // property, to deal with situations like:
  //
  //     var a = module;
  //     a.exports = 'hello'
  //
  // Not too common, but it happens…
  if (moduleList.length > 0) {
    moduleBaseName = moduleExportsName
    moduleExportsName += '.exports'
  }

  if (!row.isCycle) { // cycles have a function wrapper and don't need to be rewritten
    moduleExportsList.concat(exportsList).forEach(function (node) {
      if (row.isSimpleExport) {
        node.edit.update('var ' + moduleExportsName)
      } else {
        renameIdentifier(node, moduleExportsName)
      }
    })
    moduleList.forEach(function (node) {
      if (node.parent.type === 'UnaryExpression' && node.parent.operator === 'typeof') {
        node.parent.edit.update('"object"')
      } else {
        renameIdentifier(node, moduleBaseName)
      }
    })
    if (ast.scope) {
      ast.scope.forEach(function (binding, name) {
        binding.rename('__' + name + '_' + row.id)
      })
    }
  }

  if (!row.keepExportObject) {
    row.exports.forEach(function (exp, name) {
      row.magicString.prepend('var ' + exp.name + ';\n')
      exp.node.edit.update(exp.name)
    })
  }

  row.imports.forEach(function (imports, otherId) {
    Object.keys(imports).forEach(function (name) {
      imports[name].forEach(function (req) {
        var node = req.node
        var other = req.module
        if (other.keepExportObject) {
          return
        }
        if (name !== DEFAULT_EXPORT && other.exports.has(name) && !other.isCycle) {
          node.edit.update(other.exports.get(name).name)
        } else {
          if (other && other.isCycle) {
            node.edit.update('_$cycle(' + req.id + ')')
          } else if (other && other.exportsName) {
            node.edit.update(other.exportsName)
          } else {
            node.edit.update('_$module_' + req.id)
          }
        }
      })
    })
  })

  row.requireCalls.forEach(function (req) {
    var node = req.node
    var other = req.requiredModule
    var name = other && other.exportsName
      ? other.exportsName
      : '_$module_' + req.id

    if (other && other.isCycle) {
      node.edit.update('_$cycle(' + req.id + ')')
      return
    }

    if (other) {
      // Remove the variable declaration if this is something like `var xyz = require('abc')`.
      if (node.parent.type === 'VariableDeclarator' && node.parent.init === node && node.parent.id.type === 'Identifier') {
        var scope = getDeclaredScope(node.parent.id)
        if (scope && other.keepExportObject) {
          var binding = scope.scope.get(node.parent.id.name)
          binding.rename(name)
        }
        removeVariableDeclarator(node.parent)
        return
      }
      if (!other.keepExportObject) {
        node.edit.update('void 0')
        return
      }
    }

    node.edit.update(name)
  })

  if (row.isCycle) {
    magicString.prepend('_$cycle[' + JSON.stringify(row.id) + '] = (function (module, exports) {\n')
    magicString.append('\n});')
  } else if (moduleBaseName) {
    magicString
      .prepend('var ' + moduleBaseName + ' = { exports: {} };\n')
      .append('\n' + moduleBaseName + ' = ' + moduleExportsName)
    moduleExportsName = moduleBaseName
  } else if (!row.isSimpleExport && row.keepExportObject) {
    magicString.prepend('var ' + moduleExportsName + ' = {};\n')
  }
}

function flatten (rows, opts) {
  rows = sortModules(rows)
  rows.byId = Object.create(null)
  rows.forEach(function (row) { rows.byId[row.id] = row })

  var containsCycles = detectCycles(rows)

  var bundle = new Bundle()
  var includeMap = false

  // Add the circular dependency runtime if necessary.
  if (containsCycles) {
    bundle.prepend('var _$cycle = ' + CYCLE_HELPER + '; _$cycle.r = {};\n')
  }

  rows.forEach(parseModule)
  rows.forEach(rewriteModule)
  moveCircularDependenciesToStart(rows)
  rows.forEach(function (row) {
    if (row.sourceFile && !row.nomap) {
      includeMap = true
    }
    bundle.addSource({
      filename: row.sourceFile,
      content: row.magicString
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
    bundle.append('\n}());')
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
 * cycle, instead of using the module's exportName, it'll call the `_$cycle` runtime
 * function, which will execute the requested module and return its exports.
 */
function detectCycles (rows) {
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
        var other = rows.byId[dep]
        if (other) check(other, visited)
      })
      visited.pop()
    }
  })

  // mark cyclical dependencies
  for (var i = 0; i < rows.length; i++) {
    rows[i].isCycle = cyclicalModules.has(rows[i])
  }
  return cyclicalModules.size > 0
}

function moveCircularDependenciesToStart (rows) {
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].isCycle) {
      var row = rows.splice(i, 1)[0]
      rows.unshift(row)
    }
  }
}

function removeVariableDeclarator (node) {
  if (node.parent.declarations.length === 1) {
    // Remove the entire declaration.
    node.parent.edit.update('')
  } else {
    // This will leave behind some unnecessary variables, but since they are never used
    // a minifier should remove them.
    node.edit.update('_$dummy')
  }
}

function getNodeName (node) {
  if (node.type === 'FunctionExpression') node = node.id
  else if (node.type === 'ClassExpression') node = node.id
  if (node && node.type === 'Identifier') {
    return node.name
  }
}

function isModuleExports (node) {
  return node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' && node.object.name === 'module' &&
    (node.property.type === 'Identifier' && node.property.name === 'exports' ||
      node.property.type === 'Literal' && node.property.value === 'exports')
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

function renameIdentifier (node, name) {
  if (isShorthandProperty(node)) {
    node.edit.update(node.name + ': ' + name)
  } else {
    node.edit.update(name)
  }
}

// Get the scope that a declaration will be declared in
function getScope (node, blockScope) {
  var parent = node
  while (parent.parent) {
    parent = parent.parent
    if (isFunction(parent)) {
      break
    }
    if (blockScope && parent.type === 'BlockStatement') {
      break
    }
    if (parent.type === 'Program') {
      break
    }
  }
  return parent
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
  while (parent.parent) {
    parent = parent.parent
    if (parent.scope && parent.scope.has(id.name)) {
      break
    }
  }
  return parent
}

function registerScopeBindings (node) {
  if (node.type === 'VariableDeclaration') {
    var scope = getScope(node, node.kind !== 'var')
    if (!scope.scope) scope.scope = new Scope()
    node.declarations.forEach(function (decl) {
      scope.scope.define(new Binding(decl.id.name, decl.id))
    })
  }
  if (node.type === 'FunctionDeclaration') {
    var scope = getScope(node, false)
    if (!scope.scope) scope.scope = new Scope()
    if (node.id && node.id.type === 'Identifier') {
      scope.scope.define(new Binding(node.id.name, node.id))
    }
  }
  if (isFunction(node)) {
    if (!node.scope) node.scope = new Scope()
    node.params.forEach(function (param) {
      node.scope.define(new Binding(param.name, param))
    })
  }
  if (node.type === 'FunctionExpression') {
    if (node.id && node.id.type === 'Identifier') {
      node.scope.define(new Binding(node.id.name, node.id))
    }
  }
}

function registerReference (node) {
  var scope = getDeclaredScope(node)
  if (scope.scope && scope.scope.has(node.name)) {
    scope.scope.add(node.name, node)
  }
}

function isFunction (node) {
  return node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'
}

function removeSourceMappingComment (str) {
  return str.replace(/^\s*\/(?:\/|\*)[@#]\s+sourceMappingURL=data:(?:application|text)\/json;(?:charset[:=]\S+?;)?base64,(?:.*)$/mg, '')
}

function getModuleName (file) {
  var parts = pathParse(file)
  var name = parts.base === 'index.js'
    ? path.basename(parts.dir)
    : parts.name
  return toIdentifier(name) || 'module'
}

// Yoinked from babel:
// https://github.com/babel/babel/blob/9ad660bbe103a3484b780a1f2f2e124037b3ee0a/packages/babel-types/src/converters.js#L135
function toIdentifier(name) {
  return name
    // replace all non-valid identifiers with dashes
    .replace(/[^a-zA-Z0-9$_]/g, '-')
    // remove all dashes and numbers from start of name
    .replace(/^[-0-9]+/, "")
    // camel case
    .replace(/[-\s]+(.)?/g, function (match, c) { return c ? c.toUpperCase() : '' })
}
