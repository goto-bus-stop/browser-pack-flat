(function(){
var _$ThisIsAClass_2 = class ThisIsAClass {}

var _$thisIsAFunction_3 = function thisIsAFunction () {}

var _$thisIsAReference_4 = __thisIsAReference_4

function __thisIsAReference_4 () {}

var _$app_1 = {};
console.log(
  _$thisIsAFunction_3.name,
  _$ThisIsAClass_2.name,
  function () { _$thisIsAReference_4 }.toString()
)

}());