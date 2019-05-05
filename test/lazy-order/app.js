require('./a')
global.later = function () {
  require('./b') // should not run immediately
}
if (Math.random()>0.5) {
  require('./c') // should not always run
}
