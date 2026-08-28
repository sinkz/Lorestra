import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseUrl = process.env.LORESTRA_BASE_URL ?? 'http://127.0.0.1:4175'
const output = resolve(import.meta.dirname, '../../../docs/media/lorestra-atlas.png')
await mkdir(resolve(import.meta.dirname, '../../../docs/media'), { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'en-US',
  colorScheme: 'dark',
  reducedMotion: 'reduce',
})

await page.addInitScript(() => {
  localStorage.setItem('lorestra-locale', 'en')
  localStorage.setItem(
    'lorestra-shell-preferences',
    JSON.stringify({
      state: { locale: 'en', expandedFolders: {} },
      version: 0,
    }),
  )
})
await page.goto(`${baseUrl}/atlas?scope=entire`, {
  waitUntil: 'domcontentloaded',
})
await page.getByRole('heading', { name: 'The living map' }).waitFor()
await page.locator('.react-flow__node').first().waitFor()
await page.screenshot({ path: output, animations: 'disabled' })
await browser.close()

console.log(`Captured ${output}`)
