var pack = require('./index')

module.exports = function apply (b, opts) {
  b.pipeline.get('pack').splice(0, 1,
    pack({ standalone: b._options.standalone })
  )

  b.on('reset', function () { apply(b, opts) })
}
