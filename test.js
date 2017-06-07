var fs = require('fs')
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
  var b = browserify({ entries: './index' })

  return b.bundle()
    .pipe(unpackStream())
    .pipe(packer())
}

console.log('bundling with commonjs version...')
runBundle(require('./index'))
  .pipe(fs.createWriteStream('./test-result-expected.js'))
  .on('finish', onbundle)

function onbundle () {
  console.log('bundling with browserified version...')
  runBundle(require('./test-result-expected'))
    .pipe(fs.createWriteStream('./test-result-actual.js'))
    .on('finish', oncompare)
}

function oncompare () {
  assert.equal(
    fs.readFileSync('./test-result-expected.js', 'utf8'),
    fs.readFileSync('./test-result-actual.js', 'utf8'),
    'flattened browserified code should have the same output as the commonjs version'
  )
}
