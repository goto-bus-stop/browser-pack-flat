(function(){
var _$cycle = function r(o){var t=r.r;if(t[o])return t[o].exports;if(r.hasOwnProperty(o))return t[o]={exports:{}},r[o](t[o],t[o].exports),t[o].exports;throw new Error("Cannot find module #"+o)}; _$cycle.r = {};
_$cycle[3] = (function (module, exports) {
module.exports = {
  x: _$x_4,
  z: _$cycle(6)
}

});
_$cycle[6] = (function (module, exports) {
module.exports = _$cycle(3).x

});
var _$x_4 = 'x'

var _$y_5 = _$cycle(6) + _$x_4

var _$cycle_2 = {};
_$cycle_2.x = _$x_4
_$cycle_2.y = _$y_5
_$cycle_2.z = _$cycle(6)
_$cycle_2.w = _$cycle(3)

var _$keep_7 = {};
// these should not be rewritten to variables
// because the exports object is used standalone
_$keep_7.a = function a () {}
_$keep_7.b = function b () {}

var _$moduleExports_8 = function () {
  return 'module.exports'
}

var _$other_9$$world;
var _$other_9$$hello;
// These should be rewritten to simple variables
_$other_9$$hello = 'hello'
_$other_9$$world = 'world'

var _$app_1 = {};


var __moduleExports_1 = _$moduleExports_8()

console.log(_$other_9$$hello)
console.log(_$other_9$$world)
console.log(_$keep_7)
console.log(__moduleExports_1)
console.log(_$cycle_2)

}());