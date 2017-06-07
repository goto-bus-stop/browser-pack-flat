# browser-pack-flat

Scope hoisting for browserified bundles.

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

## License

[MIT](./LICENSE)

