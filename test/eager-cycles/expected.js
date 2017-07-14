(function(){
var _$cycle = function r(o,t,n){if((t=r.r).hasOwnProperty(o))return t[o].exports;if(r.hasOwnProperty(o))return n={},t[o]={exports:n},r[o](t[o],n),t[o].exports;throw Error("Cannot find module #"+o)}; _$cycle.r = {};
_$cycle[1] = (function (module, exports) {
exports.b = _$b_3
exports.c = _$cycle(4)

});
_$cycle[4] = (function (module, exports) {
module.exports = 10 + _$cycle(1).b

});
var _$b_3 = 10

var _$d_5 = 'hello'

var _$e_6 = 'world'

var _$app_2 = {};
console.log({
  d: _$d_5,
  a: _$cycle(1),
  e: _$e_6
})

}());