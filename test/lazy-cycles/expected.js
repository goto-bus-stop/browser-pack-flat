(function(){
var _$cycle = function r(r){var t;return function(){return t||r(t={exports:{}},t.exports),t.exports}};
var _$a_1 = _$cycle(function (module, exports) {
var b = _$b_3()
module.exports = function () {
  return b()
}

});
var _$b_3 = _$cycle(function (module, exports) {
module.exports = function () {
  return _$a_1().toString()
}

});
var _$app_2 = {};
console.log(
  _$a_1()()
)

}());
