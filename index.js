#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { URL } from 'node:url'

const help = ['help', '--help', '-h'].some((arg) => process.argv.includes(arg))
if (help) {
  console.log('Usage: vendurl [--clean | -c [--yes | -y]] [--verbose | -v] [--no-color]')
  process.exit(0)
}

const s = (s) => s
const { red, blue, green, grey } = process.env.NO_COLOR || process.argv.includes('--no-color')
  ? { red: s, blue: s, green: s, grey: s }
  : {
      red: s => `\u001b[31m${s}\u001b[39m`,
      blue: s => `\u001b[34m${s}\u001b[39m`,
      green: s => `\u001b[32m${s}\u001b[39m`,
      grey: s => `\u001b[90m${s}\u001b[39m`,
    }

const ESMSH = 'https://esm.sh/'
const cwd = process.cwd()
const packagePath = path.join(cwd, 'package.json')
const packageString = fs.readFileSync(packagePath, 'utf8')
const pkg = JSON.parse(packageString)
const { name, vendurl } = pkg

const verbose = ['--verbose', '-v'].some((arg) => process.argv.includes(arg))
const clean = ['--clean', '-c'].some((arg) => process.argv.includes(arg))
let yes = ['--yes', '-y'].some((arg) => process.argv.includes(arg))

if (!(vendurl && vendurl.packages && typeof vendurl.packages === 'object')) {
  throw new Error(`"${name} is missing "vendurl" in package.json`)
}

// defaults
const { bundle = true, destination = './vendor', packages, provider = ESMSH } = vendurl
const fullDestination = path.join(cwd, destination)

if (clean) {
  try {
    if (!yes) {
      const rl = createInterface({ input: process.stdin, output: process.stdout })

      const confirm = await rl.question(`Delete "${fullDestination.replace(cwd, '')}"? (y/N) `)
      rl.close()

      yes = confirm.toLowerCase() === 'y'
    }

    if (!yes) {
      console.log('Aborting')
      process.exit(0)
    }

    fs.rmSync(fullDestination, { recursive: true, force: true })

    if (verbose) console.log(`${blue('Deleted')} "${fullDestination.replace(cwd, '')}"`)
  } catch (error) {
    throw new Error(`Unable to remove "${fullDestination}"`)
  }
}

try {
  await fs.mkdirSync(fullDestination, { recursive: true })
  if (verbose) console.log(`${blue('Created')} "${fullDestination.replace(cwd, '')}"`)
} catch (error) {
  throw new Error(`Unable to create "${fullDestination}"`)
}

// parse packages
let ok = true
const manifest = []
for (const [filename, specifier] of Object.entries(packages)) {
  let url
  if (Array.isArray(specifier)) {
    ok = false
    console.error(`Specifier should be a string or object. ${red(`Found array. Skipping "${filename}".`)}`)
  } else if (typeof specifier === 'object') {
    ok = false
    console.error(`Object specifier not yet supported. ${red(`Skipping "${filename}".`)}`)
  } else if (typeof specifier === 'string') {
    try {
      url = new URL(specifier)
    } catch (err) {
      try {
        url = new URL(specifier, provider)
        if (bundle) url.searchParams.set('bundle', 'true')
      } catch {
        throw new Error(`Unable to parse "${specifier}" to URL`)
      }
    }
    manifest.push({ filename, specifier, url })
  } else {
    ok = false
    console.error(`Specifier should be a string or object. ${red(`Skipping "${filename}".`)}`)
  }
}

// download packages
for (let { filename, specifier, url } of manifest) {
  if (url) {
    if (verbose) console.log(grey(`Creating "${filename}" from "${specifier}"`))
    try {
      let response = await fetch(url)

      if (response.status !== 200) {
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
        fs.writeFileSync(path.join(fullDestination, filename), contents)
        console.log(`${blue('Saved')} "${filename}"${verbose ? `to ${destination}` : ''}`)
      } catch (error) {
        console.error(red(`Unable to save "${filename}" to ${destination}`))
      }
    } catch (error) {
      console.error(red(`Unable to download "${filename}" from ${url}`))
    }
  }
}

console.log(green('✔ Vendored.'))
process.exit(ok ? 0 : 1)
