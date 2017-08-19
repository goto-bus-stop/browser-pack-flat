# browser-pack-flat

Bundle browserify modules into a single scope, a la rollup.

Caveats:

 - This rewrites `require()` calls to simple variable assignments.
   If a module wraps `require()` somehow it probably will not work.
   In practice this is quite rare.
 - Using `factor-bundle` to split output code into separate files will not work with this plugin.

## Install

```bash
npm install --save-dev browser-pack-flat
```

## Usage

```bash
browserify /path/to/app.js | browser-unpack | browser-pack-flat
```

Or as a plugin:

```bash
browserify /path/to/app.js -p browser-pack-flat/plugin
```

The plugin replaces the `browser-pack` module used by default by browserify.

With the Node API:

```js
var browserify = require('browserify')
var packFlat = require('browser-pack-flat')

browserify({ entries: './src/app.js' })
  .plugin(packFlat, { /* options */ })
  .bundle()
  .pipe(fs.createWriteStream('bundle.js'))
```

## Related

 * [common-shakeify](https://github.com/goto-bus-stop/common-shakeify) - Tree-shaking plugin for browserify based on [@indutny](https://github.com/indutny)'s [common-shake](https://github.com/indutny/common-shake) library

## License

[MIT](./LICENSE)

