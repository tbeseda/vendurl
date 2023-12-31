<h1 align="center"><code>vendurl</code> 🛍️</h1>

<p align="center">
  Vendor (<em>verb</em>: download and store) a JS dependency from a URL.<br>
  <a href="https://www.npmjs.com/package/vendurl"><strong><code>vendurl</code> on npmjs.org »</strong></a><br>
  <br>
  Contents:
  <a href="#Installation-and-usage">Install</a>
  •
  <a href="#How-it-works">How it works</a>
  •
  <a href="#Development">Development</a>
  •
  <a href="#FAQ">FAQ</a>
</p>

> [!NOTE]  
> `vendurl` is in no way intended to replace `npm` for dependency management. It is best utilized for vendoring a few, small packages that are not published in a way you'd like to consume.

## Installation and usage

```sh
npm i -D vendurl
```

Add packages to the "vendurl" key in `package.json` by setting a filename with extension and package specifier:

```json
{
  "vendurl": {
    "packages": {
      "temporal.js": "@js-temporal/polyfill",
      "chalk4.mjs": "chalk@4",
      "leftpad.cjs": "https://unpkg.com/leftpad@0.0.1/index.js"
    }
  }
}
```

Run `vendurl` to download and store the packages:

```sh
npx vendurl
```

Use the packages in your code:

```js
import { Temporal } from './vendor/temporal.js';
import chalk from './vendor/chalk4.mjs';
import leftpad from './vendor/leftpad.cjs';
```

### Options

#### Optional `package.json` `vendurl` configuration:

```js
{
  "vendurl": {
    "destination": "./src/lib",       // default: "./vendor"
    "provider": "https://unpkg.com/", // default: "https://esm.sh/"
    "bundle": false,                  // esm.sh specific. default: true
    "packages": { }
  }
}
```

#### Specifier options

The specifier can be an object:

```js
{
  "vendurl": {
    "packages": {
      "leftpad.cjs": {
        "specifier": "leftpad@0.0.1/index.js",
        "provider": "https://unpkg.com/",
        "bundle": false
      },
      "robots.txt": {
        "specifier": "https://raw.githubusercontent.com/mitchellkrogza/nginx-ultimate-bad-bot-blocker/master/robots.txt/robots.txt",
        "destination": "./public"
      }
    }
  }
}
```

#### npm postinstall

```js
{
  "scripts": {
    "postinstall": "vendurl"
  },
  "vendurl": {
    "packages": { }
  }
}
```

### CLI Options and Exit Codes

> [!IMPORTANT]  
> `vendurl` will exit with code `1` if there are any errors, but will optimistically continue to vendor what it can.

Verbose output is available with `--verbose` or `-v`:

```sh
npx vendurl --verbose
```

Use the `--clean` flag to nuke the destination folder before downloading (this will not clean destinations specified in object specifiers):

```sh
npx vendurl --clean
```

Pass `--yes` to skip the confirmation prompt:

```sh
npx vendurl --clean --yes
```

## How it works

Mostly with `fetch` and `fs`: download the file and save it. `index.js` is brief and has no dependencies; check it out!

`vendurl` leans on [esm.sh](https://esm.sh) conventions to resolve specific versioned bundles.

### Module Resolution

For example, the specifier of "chalk" (currently) resolves to the cached build as such:  
`chalk` → `chalk@latest` → `chalk@5.3.0` → `/v132/chalk@5.3.0/es2021/chalk.bundle.mjs`.

## Development

`./test/mock-project/` has a simple `package.json` with a few package entries to test with.

`./test/test.sh` runs a simple test procedure and executes `./test/mock-project/index.js`.

## FAQ

**Does it work for all packages?**  
Not likely. The dependency graphs for some "modern" tools are a mess and rely on a build step. `vendurl` does work well for simpler packages that aren't published in a way you'd like to consume -- e.g. the entire test suite and 17 dist versions are shipped to npmjs.org...  
*If there's a package you think should work, but it doesn't, please open an issue.* 🙏🏻

**Just JavaScript?**  
`vendurl` will optimistically download any URL and put it in "./vendor". A `.css` file would probably work, but at that point you're venturing into build pipeline territory 🐉

**ESBuild options, WASM, and other esm.sh features?**  
Good idea! I can work on that or feel free to send a PR.  
In the meantime: currently, search params on the specifier are not stripped, so you could try that!

**I'm getting esm.sh HTTP errors.**  
You may want to check [esm.sh's status page](https://esm.instatus.com).
