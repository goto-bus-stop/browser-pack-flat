var globalVar = 0

function setExports (argument) {
  var localVar = 1
  module.exports = {
    globalVar,
    localVar,
    argument
  }
}

setExports(10)
