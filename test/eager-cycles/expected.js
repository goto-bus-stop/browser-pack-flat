(function(){
var _$cycle = function r(r){var t;return function(){return t||r(t={exports:{}},t.exports),t.exports}};
var _$a_1 = _$cycle(function (module, exports) {
exports.b = _$b_3
exports.c = _$c_4()

});
var _$c_4 = _$cycle(function (module, exports) {
module.exports = 10 + _$a_1().b

});
var _$b_3 = 10

var _$d_5 = 'hello'

var _$e_6 = 'world'

var _$app_2 = {};
console.log({
  d: _$d_5,
  a: _$a_1(),
  e: _$e_6
})

}());