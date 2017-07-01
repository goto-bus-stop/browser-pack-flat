(function(){
var _$cycle = function r(o){var t=r.r;if(t[o])return t[o].exports;if(r.hasOwnProperty(o))return t[o]={exports:{}},r[o](t[o],t[o].exports),t[o].exports;throw new Error("Cannot find module #"+o)}; _$cycle.r = {};
_$cycle[1] = (function (module, exports) {
var b = _$cycle(3)
module.exports = function () {
  return b()
}

});
_$cycle[3] = (function (module, exports) {
module.exports = function () {
  return _$cycle(1).toString()
}

});
var _$app_2 = {};
console.log(
  _$cycle(1)()
)

}());