import process from 'node:process'
import { URL } from 'node:url'

// Avoid oxc's experimental multi-gigabyte raw-transfer reservation on Windows.
// An explicitly supplied value wins; no Knip checks or issue types are disabled.
if (
  process.platform === 'win32' &&
  process.env.KNIP_DISABLE_RAW_TRANSFER === undefined
) {
  process.env.KNIP_DISABLE_RAW_TRANSFER = '1'
}

// Run the installed CLI in this process, preserving argv, signals, and exit status.
await import(new URL('../bin/knip.js', import.meta.resolve('knip')).href)
