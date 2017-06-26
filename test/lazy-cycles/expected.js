(function(){
var __cycle = function r(o){var t=r.r;if(t[o])return t[o].exports;if(r.hasOwnProperty(o))return t[o]={exports:{}},r[o](t[o],t[o].exports),t[o].exports;throw new Error("Cannot find module #"+o)}; __cycle.r = {};
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