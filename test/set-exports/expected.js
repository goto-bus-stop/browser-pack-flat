(function(){
var __module_2 = {};
__module_2 = __module_2 = 2

var __module_3 = {};
__module_3 = 3

var __module_4 = { exports: {} };
var __something_4 = function () {
  return __module_4
}
__something_4().exports = 5

__module_4 = __module_4.exports
var __module_5 = {};
__module_5 = 1

var __module_6 = {};
__module_6 = 4

var __module_1 = {};
__module_1.moduleExports = __module_5
__module_1.both = __module_2
__module_1.exportsOnly = __module_3
__module_1.quoted = __module_6
__module_1.free = __module_4

module.exports = __module_1;
}());