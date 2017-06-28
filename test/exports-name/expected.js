(function(){
var __ThisIsAClass_2 = class ThisIsAClass {}

var __thisIsAFunction_3 = function thisIsAFunction () {}

var __thisIsAReference_4 = __thisIsAReference_4

function __thisIsAReference_4 () {}

var __module_1 = {};
console.log(
  __thisIsAFunction_3.name,
  __ThisIsAClass_2.name,
  function () { __thisIsAReference_4 }.toString()
)

}());