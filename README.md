# Photasa

Another Picasa App powered by [Electron Vite](https://evite.netlify.app/)

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Mac: Install vips to support HEIC

vips is required to support HEIC, brew install vips have a [bottle support](https://formulae.brew.sh/formula/vips).

```shell
brew install vips
```

Then sharp will pick the global installed libvips if installed with brew.

## ESM Bundle for Electron

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
npm run install
```

### Development

```bash
npm run dev
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

## Troubleshooting

### vue-i18n

Must turn on `script-src 'unsafe-eval'` to allow handling of json

```html
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self' https://sessions.bugsnag.com/ https://notify.bugsnag.com/; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file:; font-src 'self';"
    />
```

### HEIC for sharp

[sharp requires global installed libvips which support HEIF](https://github.com/lovell/sharp/issues/2218)

So run electron-builder for mac, will only build Mac Version per arch

### Build for different platform

#### Install sharp per platform

Still need to run on different OS to have a prebuilt libvips properly with HEIC.

```json
{
    "script": {
        "sharp:mac": "del-cli ./node_modules/sharp && npm install --platform=darwin --arch=arm64 sharp && npm rebuild --platform=darwin --arch=x64 sharp",
        "sharp:win": "del-cli ./node_modules/sharp && npm install --platform=win32 --arch=x64 sharp",
        "sharp:linux": "del-cli ./node_modules/sharp && npm install --platform=linux --arch=x64 sharp",
    }
}
```

### Can't find sharp-darwin-arm64v8.node

```shell
npm rebuild --platform=darwin --arch=arm64 sharp
```
