#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { URL } from 'node:url'

const { argv } = process

const helpText = 'Usage: vendurl [--clean | -c [--yes | -y]] [--verbose | -v] [--no-color]'
const help = ['help', '--help', '-h'].some((arg) => argv.includes(arg))
if (help) {
  console.log(helpText)
  process.exit(0)
}

const s = (s) => s
const { red, blue, green, grey } = process.env.NO_COLOR || argv.includes('--no-color')
  ? { red: s, blue: s, green: s, grey: s }
  : {
      red: s => `\u001b[31m${s}\u001b[39m`,
      blue: s => `\u001b[34m${s}\u001b[39m`,
      green: s => `\u001b[32m${s}\u001b[39m`,
      grey: s => `\u001b[90m${s}\u001b[39m`,
    }

function createURL (specifier, bundleParam, base) {
  try {
    return new URL(specifier)
  } catch (err) {
    try {
      const url = new URL(specifier, base)
      if (bundleParam) url.searchParams.set('bundle', 'true')
      return url
    } catch {
      throw new Error(`Unable to parse "${specifier}" to URL`)
    }
  }
}

const ESM_SH = 'https://esm.sh/'
const cwd = process.cwd()
const packagePath = path.join(cwd, 'package.json')
const packageString = fs.readFileSync(packagePath, 'utf8')
const pkg = JSON.parse(packageString)
const { name, vendurl } = pkg

const verbose = ['--verbose', '-v'].some((arg) => argv.includes(arg))
const clean = ['--clean', '-c'].some((arg) => argv.includes(arg))
let yes = ['--yes', '-y'].some((arg) => argv.includes(arg))

if (!(vendurl && vendurl.packages && typeof vendurl.packages === 'object')) {
  console.error(red(`"${name} is missing "vendurl" in package.json`))
  process.exit(1)
}

// defaults
const { bundle = true, destination = './vendor', packages, provider = ESM_SH } = vendurl

if (clean) {
  const fullDestination = path.join(cwd, destination)
  try {
    if (!yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })

      const confirm = await rl.question(`Delete "${fullDestination.replace(cwd, '')}"? (y/N) `)
      rl.close()

      yes = confirm.toLowerCase() === 'y'
    }

    if (!yes) {
      console.log('Aborting')
      process.exit(1)
    }

    fs.rmSync(fullDestination, { recursive: true, force: true })

    if (verbose) console.log(grey(`Deleted "${fullDestination.replace(cwd, '')}"`))
  } catch (error) {
    throw new Error(`Unable to remove "${fullDestination}"`)
  }
}

// parse packages
let ok = true
const manifest = []
for (const [filename, specifier] of Object.entries(packages)) {
  if (Array.isArray(specifier)) {
    ok = false
    console.error(`Specifier should be a string or object. ${red(`Found Array. Skipping "${filename}".`)}`)
  } else if (typeof specifier === 'object') {
    const { specifier: pSpecifier, provider: pProvider, bundle: pBundle, ...rest } = specifier
    const url = createURL(pSpecifier, pBundle || bundle, pProvider || provider)
    manifest.push({ filename, url, specifier: pSpecifier, ...rest })
  } else if (typeof specifier === 'string') {
    const url = createURL(specifier, bundle, provider)
    manifest.push({ filename, url, specifier })
  } else {
    ok = false
    console.error(`Specifier should be a string or object. ${red(`Skipping "${filename}".`)}`)
  }
}

// download packages
for (let { filename, specifier, url, destination: pDestination } of manifest) {
  const outputPath = pDestination || destination
  const fullOutputPath = path.join(cwd, outputPath)

  if (url) {
    if (verbose) console.log(grey(`Creating "${filename}" from "${specifier}"`))
    try {
      let response = await fetch(url)

      if (response.status !== 200) {
        ok = false
        console.error(red(`Unable to fetch "${specifier}" from constructed URL: ${url}`))
        continue
      }

      const esmId = response.headers.get('X-Esm-Id') // esm.sh final URL path
      if (esmId) {
        url = new URL(esmId, provider)
        if (verbose) console.log(grey(`Redirected to ${url}`))
        response = await fetch(url)
      }

      const contents = await response.text()

      try {
        if (!fs.existsSync(fullOutputPath)) {
          fs.mkdirSync(fullOutputPath, { recursive: true })
          if (verbose) console.log(grey(`Created "${outputPath}"`))
        }
      } catch (error) {
        console.error(red(`Unable to create "${fullOutputPath}"`))
        if (verbose) console.error(error)
        continue
      }

      try {
        fs.writeFileSync(path.join(fullOutputPath, filename), contents)
        console.log(`${blue('Saved')} "${filename}"${verbose ? `to ${outputPath}` : ''}`)
      } catch (error) {
        ok = false
        console.error(red(`Unable to save "${filename}" to ${fullOutputPath}`))
        if (verbose) console.error(error)
      }
    } catch (error) {
      ok = false
      console.error(red(`Unable to download "${filename}" from ${url}`))
      if (verbose) console.error(error)
    }
  }
}

console.log(green('✔ Vendored.'))
process.exit(ok ? 0 : 1)
