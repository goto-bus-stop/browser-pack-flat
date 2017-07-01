var imported = require('./other')
var keep = require('./keep')
var moduleExports = require('./moduleExports')()

console.log(imported.hello)
console.log(imported.world)
console.log(keep)
console.log(moduleExports)
console.log(require('./cycle.js'))
