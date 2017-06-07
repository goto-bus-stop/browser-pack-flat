#!/usr/bin/env node

var json = require('JSONStream')
var concat = require('concat-stream')
var flatPack = require('./')

process.stdin.pipe(json.parse([ true ])).pipe(concat(function (rows) {
  process.stdout.write(flatPack(rows))
}))
