var pack = require('./index')

module.exports = function apply (b, opts) {
  opts = assign(opts || {}, {
    raw: true,
    debug: opts.debug || b._options.debug,
    basedir: b._options.basedir || process.cwd()
  })

  function addHooks () {
    var streams = b.pipeline.get('pack')
    var index = streams.indexOf(b._bpack)

    streams.splice(index, 1,
      pack(assign(opts, {
        standalone: b._options.standalone,
        standaloneModule: b._options.standaloneModule
      }))
    )
  }

  addHooks()
  b.on('reset', addHooks)
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
