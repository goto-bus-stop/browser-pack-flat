var test = require('tape')
var assert = require('assert')
var fs = require('fs')
var path = require('path')
var browserify = require('browserify')
var concat = require('concat-stream')
var pack = require('../plugin')

var tests = fs.readdirSync(__dirname).filter(function (name) {
  return fs.statSync(path.join(__dirname, name)).isDirectory() &&
    fs.existsSync(path.join(__dirname, name, 'app.js'))
})

tests.forEach(function (name) {
  test(name, function (t) {
    runTest(t, name)
  })
})

function runTest (t, name) {
  t.plan(1)
  var basedir = path.join(__dirname, name)
  var optionsPath = path.join(basedir, 'options.json')
  var options = {}
  try { options = JSON.parse(fs.readFileSync(optionsPath, 'utf8')) } catch (err) {}
  var entry = path.join(basedir, 'app.js')
  var expected = path.join(basedir, 'expected.js')
  var actual = path.join(basedir, 'actual.js')
  options.entries = entry
  var bundle = browserify(options)
    .plugin(pack)
    .bundle()
    .on('error', t.fail)

  // Write actual output to a file for easier inspection
  bundle.pipe(fs.createWriteStream(actual))

  bundle.pipe(concat(function (result) {
    t.is(
      result.toString('utf8'),
      fs.readFileSync(expected, 'utf8'),
      name
    )
    t.end()
  }))
}
