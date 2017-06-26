var test = require('tape')
var fs = require('fs')
var path = require('path')
var assert = require('assert')
var browserify = require('browserify')
var through = require('through2')
var unpack = require('browser-unpack')

function unpackStream () {
  var d = ''
  return through({ objectMode: true }, function (chunk, enc, cb) {
    d += chunk
    cb()
  }, function (cb) {
    unpack(d).forEach(this.push, this)
    cb(null)
  })
}

function runBundle (packer) {
  var b = browserify({ entries: path.join(__dirname, '../index') })

  return b.bundle()
    .pipe(unpackStream())
    .pipe(packer())
}

test('bundling itself with itself', function (t) {
  t.plan(1)
  runBundle(require('../index'))
    .pipe(fs.createWriteStream(path.join(__dirname, './self.expected.js')))
    .on('finish', onbundle)

  function onbundle () {
    runBundle(require('./self.expected'))
      .pipe(fs.createWriteStream(path.join(__dirname, './self.actual.js')))
      .on('finish', oncompare)
  }

  function oncompare () {
    t.is(
      fs.readFileSync(path.join(__dirname, './self.expected.js'), 'utf8'),
      fs.readFileSync(path.join(__dirname, './self.actual.js'), 'utf8'),
      'flattened browserified code should have the same output as the commonjs version'
    )
    t.end()
  }
})
