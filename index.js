var falafel = require('falafel')
var through = require('through2')

function isModuleExports (node) {
  return node.type === 'MemberExpression' &&
    node.object.type === 'Identifier' && node.object.name === 'module' &&
    node.property.type === 'Identifier' && node.property.name === 'exports'
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
function isFreeIdentifier (node) {
  return node.type === 'Identifier' &&
    !isObjectKey(node) &&
    (node.parent.type !== 'MemberExpression' || node.parent.object === node ||
      (node.parent.property === node && node.parent.computed))
}
function isInModuleScope (node, lex) {
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
function isModuleVariable (node) {
  if (node.type === 'Identifier' && node.parent.type === 'FunctionDeclaration') {
    return isInModuleScope(node.parent, false)
  }
  if (node.type === 'Identifier' && node.parent.type === 'VariableDeclarator') {
    return isInModuleScope(node.parent, node.parent.parent.kind !== 'var')
  }
  return false
}

var dedupedRx = /^arguments\[4\]\[(\d+)\]/

function parseModule (row) {
  var moduleExportsName = '__module_' + row.id
  var moduleExportsList = []
  var exportsList = []
  var globals = {}
  var identifiers = {}
  var shouldWrap = false
  if (dedupedRx.test(row.source)) {
    var n = row.source.match(dedupedRx)[1]
    row.source = 'var ' + moduleExportsName + ' = __module_' + n + ';'
  } else {
    var ast = falafel(row.source, function (node) {
      if (isModuleExports(node)) {
        moduleExportsList.push(node)
      } else if (isExports(node)) {
        exportsList.push(node)
      } else if (isRequire(node)) {
        var required = node.arguments[0].value
        if (row.deps[required]) node.update('__module_' + row.deps[required])
      } else {
        if (isFreeIdentifier(node)) {
          var name = node.name
          if (!Array.isArray(identifiers[name])) {
            identifiers[name] = [node]
          } else {
            identifiers[name].push(node)
          }
        }
        if (isModuleVariable(node)) {
          globals[node.name] = true
        }
      }
    })

    shouldWrap = moduleExportsList.length > 0 && exportsList.length > 0
    if (!shouldWrap) {
      moduleExportsList.concat(exportsList).forEach(function (node) {
        node.update(moduleExportsName)
      })
      Object.keys(globals).forEach(function (name) {
        identifiers[name].forEach(function (node) {
          node.update('__' + node.name + '_' + row.id)
        })
      })
    }

    row.source = (
      shouldWrap
        ? 'var ' + moduleExportsName + ' = { exports: {} }; (function(module,exports){' +
            ast +
          '})(' + moduleExportsName + ',' + moduleExportsName + '.exports);' + moduleExportsName + ' = ' + moduleExportsName + '.exports;'
        : 'var ' + moduleExportsName + ' = {};' + ast
    )
  }

  return row
}

function sort (rows) {
  var modules = {}
  var seen = {}
  rows.forEach(function (row) {
    modules[row.id] = row
  })

  var sorted = []
  rows.forEach(function visit (row) {
    if (seen[row.id]) return
    seen[row.id] = true
    if (row.deps) {
      Object.keys(row.deps).map(function (dep) {
        return modules[row.deps[dep]]
      }).forEach(visit)
    }
    sorted.push(row)
  })
  return sorted
}

function flatten (rows) {
  rows = sort(rows)

  var modules = rows.map(parseModule).map(function (row) {
    return row.source
  })

  return '(function(){' + modules.join('\n') + '})();'
}

module.exports = function browserPackFlat() {
  var rows = []
  return through.obj(function (row, enc, cb) {
    rows.push(row)
    cb(null)
  }, function (cb) {
    try {
      this.push(flatten(rows))
      cb(null)
    } catch (err) {
      cb(err)
    }
  })
}
