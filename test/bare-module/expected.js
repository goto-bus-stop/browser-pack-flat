(function(){
var __module_2 = { exports: {} };
(function (module) {
  module.exports = 'whatever'
})(__module_2)

__module_2 = __module_2.exports
var __module_1 = { exports: {} };
__module_2

if ("object" === 'object' && __module_1.exports) {
  console.log('commonjs')
}

__module_1 = __module_1.exports
module.exports = __module_1;

}());