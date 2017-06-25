(function(){
var __cycle = function r(o){var t=r.r;if(t[o])return t[o].exports;if(r.hasOwnProperty(o))return t[o]={exports:{}},r[o](t[o],t[o].exports),t[o].exports;throw new Error("Cannot find module #"+o)}; __cycle.r = {};
__cycle[1] = (function (module, exports) {
exports.b = __module_3
exports.c = __cycle(4)
});
__cycle[4] = (function (module, exports) {
module.exports = 10 + __cycle(1).b
});
var __module_3 = {};
__module_3 = 10

var __module_5 = {};
__module_5 = 'hello'

var __module_6 = {};
__module_6 = 'world'

var __module_2 = {};
console.log({
  d: __module_5,
  a: __cycle(1),
  e: __module_6
})
}());