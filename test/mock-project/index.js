import assert from 'node:assert/strict'
import { Temporal, Intl } from './vendor/temporal.js'
import chalk from './vendor/chalk4.mjs'
import leftpad from './vendor/leftpad.cjs'

assert(Temporal)
assert(Intl)
assert(chalk)
assert(leftpad)

console.log(chalk.green(leftpad('All dependencies loaded successfully!', 45, ' ')))
