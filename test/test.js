var assert = require('assert')
var fs = require('fs')
var path = require('path')
var browserify = require('browserify')
var concat = require('concat-stream')
var pack = require('../plugin')

var tests = fs.readdirSync(__dirname).filter(function (name) {
  return fs.statSync(path.join(__dirname, name)).isDirectory()
})

tests.forEach(function (name) {
  runTest(name)
})

function runTest (name) {
  var basedir = path.join(__dirname, name)
  var optionsPath = path.join(basedir, 'options.json')
  var options = {}
  try { options = JSON.parse(fs.readFileSync(optionsPath, 'utf8')) } catch (err) {}
  var entry = path.join(basedir, 'app.js')
  var expected = path.join(basedir, 'expected.js')
  var actual = path.join(basedir, 'actual.js')
  var bundle = browserify({ entries: entry })
    .plugin(pack, options)
    .bundle()
    .on('error', assert.fail)

  // Write actual output to a file for easier inspection
  bundle.pipe(fs.createWriteStream(actual))

  bundle.pipe(concat(function (result) {
    assert.equal(
      result.toString('utf8'),
      fs.readFileSync(expected, 'utf8')
    )
  }))
}
