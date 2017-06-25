(function(){
var __cycle = function factories(id) {
  var resolved = factories.r
  if (resolved[id]) return resolved[id].exports
  if (factories.hasOwnProperty(id)) {
    resolved[id] = { exports: {} }
    factories[id](resolved[id], resolved[id].exports)
    return resolved[id].exports
  }
  throw new Error('Cannot find module #' + id)
}; __cycle.r = {};
__cycle[1] = (function (module, exports) {
var b = __cycle(3)
module.exports = function () {
  return b()
}
});
__cycle[3] = (function (module, exports) {
module.exports = function () {
  return __cycle(1).toString()
}
});
var __module_2 = {};
console.log(
  __cycle(1)()
)
}());