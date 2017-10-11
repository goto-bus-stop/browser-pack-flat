var pack = require('./index')
var through = require('through2')

module.exports = function apply (b, opts) {
  opts = assign(opts || {}, {
    raw: true,
    debug: opts.debug || b._options.debug,
    basedir: b._options.basedir || process.cwd()
  })

  var common = pack(assign(opts, { standalone: b._options.standalone }))
  b.pipeline.get('pack').splice(0, 1, common)

  b.on('reset', function () { apply(b, opts) })

  // Magic for factor-bundle
  common._expose = new Set
  b.on('factor.pipeline', function (file, pipeline) {
    pipeline.get('pack').splice(0, 1,
      through.obj(record),
      pack(opts)
    )
    function record (row, enc, next) {
      Object.keys(row.deps).forEach(function (req) {
        common._expose.add(String(row.deps[req]))
      })
      next(null, row)
    }
  })
}

function assign (base, merge) {
  var o = {}
  for (var i in base) if (base.hasOwnProperty(i)) {
    o[i] = base[i]
  }
  for (var i in merge) if (merge.hasOwnProperty(i)) {
    o[i] = merge[i]
  }
  return o
}
