(function(){
var createModuleFactory = function createModuleFactory(factory) {
  var module
  return function (parent) {
    if (!module) {
      module = { exports: {}, parent: parent }
      factory(module, module.exports)
    }
    return module.exports
  }
};
var _$a_1 = createModuleFactory(function (module, exports) {
var b = _$b_3({})
module.exports = function () {
  return b()
}

});
var _$b_3 = createModuleFactory(function (module, exports) {
module.exports = function () {
  return _$a_1({}).toString()
}

});
var _$app_2 = {};
console.log(
  _$a_1({})()
)

}());
