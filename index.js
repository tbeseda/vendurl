#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { URL } from 'node:url'

const ESMSH = 'https://esm.sh/'
const cwd = process.cwd()
const packagePath = path.join(cwd, 'package.json')
const packageString = fs.readFileSync(packagePath, 'utf8')
const pkg = JSON.parse(packageString)

const { name, vendurl } = pkg

const clean = process.argv.includes('--clean')

if (!(vendurl && vendurl.packages && typeof vendurl.packages === 'object')) { throw new Error(`"${name} is missing "vendurl" in package.json`) }

const { bundle = true, destination = './vendor', packages, provider = ESMSH } = vendurl
const fullDestination = path.join(cwd, destination)

try {
  if (clean) {
    fs.rmSync(fullDestination, { recursive: true, force: true })
    console.log(`Removed "${fullDestination}"`)
  }
  await fs.mkdirSync(fullDestination, { recursive: true })
} catch (error) {
  throw new Error(`Unable to create "${fullDestination}"`)
}

for (const [filename, specifier] of Object.entries(packages)) {
  let url
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

  if (url) {
    console.log(`Creating "${filename}" from "${specifier}"`)
    try {
      let response = await fetch(url)

      if (response.status !== 200) {
        console.error(`Unable to fetch "${specifier}" from constructed URL: ${url}`)
        continue
      }

      const esmId = response.headers.get('X-Esm-Id') // esm.sh final URL path
      if (esmId) {
        url = new URL(esmId, provider)
        console.log(`Redirecting to ${url}`)
        response = await fetch(url)
      }

      const contents = await response.text()

      try {
        fs.writeFileSync(path.join(fullDestination, filename), contents)
        console.log(`Saved "${filename}" to ${destination}`)
      } catch (error) {
        console.error(`Unable to save "${filename}" to ${destination}`)
      }
    } catch (error) {
      console.error(`Unable to download "${filename}" from ${url}`)
    }
  }
}
