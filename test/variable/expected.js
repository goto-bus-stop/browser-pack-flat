(function(){var __module_2 = {};
__module_2 = function (module) {
  return { exports: module }
}

var __module_1 = {};
__module_1.param = __module_2
__module_1.something = function () {
  var exports = {}
  exports.something = __module_2
  return exports
}

module.exports = __module_1
}());