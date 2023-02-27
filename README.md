# picasa-vue

Another Picasa App powered by [Electron Vite](https://evite.netlify.app/)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Bundle for Electron

Electron doesn't support ESM yet, then if a package is ESM, it will not be able to be used in electron.

There are 3 section in electron.vite.config.js, For preload script, use @rollup/plugin-babel to re-bundle esm into cjs (commonjs)

```javascript
module.export = { 
    preload: {
        plugins: [externalizeDepsPlugin(), babel({ babelHelpers: "bundled" })],
    },
}
```

And any package used for preload only, should be in devDependencies, as it will be bundled.

For other commonjs package, electron-builder package will package it properly.

### Install

```bash
$ yarn install
```



### Development

```bash
$ yarn dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

# Troubleshooting

## vue-i18n

Must turn on `script-src 'unsafe-eval'` to allow handling of json

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self' https://sessions.bugsnag.com/ https://notify.bugsnag.com/; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; font-src 'self';"
    /> 
```