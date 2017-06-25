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

## License

[MIT](./LICENSE)

