/* global document, window */

import { chromium } from '@playwright/test'

const url = process.env.WEBMCP_DEMO_URL ?? 'http://127.0.0.1:4175'
const channel = process.env.WEBMCP_BROWSER_CHANNEL
const browser = await chromium.launch({
  headless: false,
  ...(channel ? { channel } : {}),
})

try {
  const page = await browser.newPage()
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => document.documentElement.dataset.webmcp !== undefined,
    undefined,
    { timeout: 10_000 },
  )
  const evidence = await page.evaluate(() => {
    const registerTool = (() => {
      try {
        return typeof document.modelContext?.registerTool === 'function'
      } catch {
        return false
      }
    })()
    return {
      url: window.location.href,
      secureContext: window.isSecureContext,
      registerTool,
      status: document.documentElement.dataset.webmcp ?? 'absent',
      registeredTools: Number(document.documentElement.dataset.webmcpTools ?? '0'),
    }
  })
  console.log(JSON.stringify(evidence, null, 2))
  if (!evidence.registerTool || evidence.status !== 'registered') {
    throw new Error(
      'WebMCP is unavailable. Use a compatible browser and enable its WebMCP support.',
    )
  }
  if (evidence.registeredTools !== 11) {
    throw new Error(`Expected 11 Lorestra tools, got ${evidence.registeredTools}.`)
  }
  console.log(
    'Registration verified in a real browser. Use its connected agent surface to call lorestra_get_agent_guide, then lorestra_search.',
  )
  await page.waitForTimeout(15_000)
} finally {
  await browser.close()
}
