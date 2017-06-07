#!/usr/bin/env node

var json = require('JSONStream')
var pack = require('./')

process.stdin
  .pipe(json.parse([ true ]))
  .pipe(pack())
  .pipe(process.stdout)
