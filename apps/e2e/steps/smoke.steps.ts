import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('I open Lorestra at {string}', async ({ page }, path: string) => {
  await page.goto(path)
})

Then('the heading {string} is visible', async ({ page }, heading: string) => {
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
})

Then('the knowledge graph has visible nodes', async ({ page }) => {
  await expect(page.locator('.react-flow__node').first()).toBeVisible()
})

When('I open the graph node {string}', async ({ page }, title: string) => {
  await page.locator('.react-flow__node').filter({ hasText: title }).dblclick()
})

Then('the knowledge graph is spread across both axes', async ({ page }) => {
  await page.waitForTimeout(1_100)
  const boxes = await page.locator('.react-flow__node').evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect()
      return { x: box.x, y: box.y }
    }),
  )
  expect(boxes.length).toBeGreaterThan(5)
  const xs = boxes.map((box) => box.x)
  const ys = boxes.map((box) => box.y)
  expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(350)
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(220)
})

When('I switch from the document to its graph', async ({ page }) => {
  await page.getByRole('link', { name: 'Graph', exact: true }).click()
})

When('I open the affected document {string}', async ({ page }, path: string) => {
  await page.getByRole('link', { name: path, exact: true }).click()
})

Then('the document body does not contain {string}', async ({ page }, text: string) => {
  await expect(page.locator('.document-content')).not.toContainText(text)
})

Then('the document body contains {string}', async ({ page }, text: string) => {
  await expect(page.locator('.document-content')).toContainText(text)
})

When('I return to the proposal', async ({ page }) => {
  await page.goBack()
  await expect(page.locator('.proposal-detail')).toBeVisible()
})

When('I approve the proposal', async ({ page }) => {
  await page.getByRole('button', { name: 'Approve', exact: true }).click()
})

Then('the proposal status is {string}', async ({ page }, status: string) => {
  await expect(page.locator('.proposal-detail .status-badge')).toHaveText(status)
})

Then('the proposal shows a governance error', async ({ page }) => {
  await expect(page.getByRole('alert')).toContainText('Something went wrong')
})

When('I merge the proposal into the vault', async ({ page }) => {
  await page.getByRole('button', { name: 'Merge into vault', exact: true }).click()
})

When('I open vault history', async ({ page }) => {
  await page.getByRole('link', { name: 'History', exact: true }).click()
})

Then('history contains {string}', async ({ page }, text: string) => {
  await expect(page.locator('.history-list')).toContainText(text)
})

Then('the URL contains {string}', async ({ page }, value: string) => {
  await expect(page).toHaveURL(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

When('I clear the empty library state', async ({ page }) => {
  await page.getByRole('button', { name: 'All documents' }).click()
})

Then('the library contains documents', async ({ page }) => {
  await expect(page.locator('.library-row, .library-card').first()).toBeVisible()
})

When('I type {string} in the library filter', async ({ page }, query: string) => {
  await page.getByRole('textbox', { name: 'Filter documents' }).pressSequentially(query)
})

Then('the library filter keeps keyboard focus', async ({ page }) => {
  await expect(page.getByRole('textbox', { name: 'Filter documents' })).toBeFocused()
})

When('I start a new memory', async ({ page }) => {
  await page.getByRole('button', { name: 'New memory' }).click()
})

When('I close the memory dialog with Escape', async ({ page }) => {
  await page.getByRole('dialog').press('Escape')
})

Then('the memory dialog is closed', async ({ page }) => {
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page).not.toHaveURL(/[?&]new=1(?:&|$)/)
})

When('I submit a memory titled {string}', async ({ page }, title: string) => {
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').nth(0).fill(title)
  await dialog
    .getByRole('textbox')
    .nth(1)
    .fill('# Rollback note\n\nKeep the evidence and owner together.')
  await dialog.getByRole('button', { name: 'New proposal' }).click()
})

Then('I see the proposal detail for {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible()
})

Then('the open proposal counter is {int}', async ({ page }, count: number) => {
  await expect(
    page.getByRole('link', { name: /Proposals/ }).locator('.nav-count'),
  ).toHaveText(String(count))
})

Then('the proposal shows a new Markdown file diff', async ({ page }) => {
  await expect(page.locator('.diff-file')).toContainText(
    'vault/Docs/en/agent-friendly-rollback-note.md',
  )
  await expect(page.locator('.diff-line.add').first()).toBeVisible()
})

Then('the proposal action {string} is visible', async ({ page }, action: string) => {
  await expect(page.getByRole('button', { name: action })).toBeVisible()
})

Then('the proposal shows a Markdown diff', async ({ page }) => {
  await expect(page.locator('.diff-file')).toBeVisible()
})

When('I choose the language {string}', async ({ page }, language: string) => {
  await page
    .getByRole('combobox', { name: 'Language' })
    .selectOption({ label: language })
})

When('I open the mobile navigation', async ({ page }) => {
  await page.getByRole('button', { name: 'Open navigation' }).click()
})

Then('keyboard focus is inside the sidebar', async ({ page }) => {
  await expect(
    page.getByRole('button', { name: 'Close navigation' }).first(),
  ).toBeFocused()
})

When('I close the mobile navigation with Escape', async ({ page }) => {
  await page.keyboard.press('Escape')
})

Then(
  'the mobile navigation is closed and its trigger regains focus',
  async ({ page }) => {
    await expect(page.locator('#vault-sidebar')).not.toHaveClass(/is-open/)
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeFocused()
  },
)

Then('the sidebar fits inside the viewport', async ({ page }) => {
  const box = await page.locator('#vault-sidebar').boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect((box?.width ?? Infinity) <= (viewport?.width ?? 0)).toBe(true)
})

Then('the page has no horizontal overflow', async ({ page }) => {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
})

When('I open the Markdown source tab', async ({ page }) => {
  await page.getByRole('tab', { name: 'Markdown' }).click()
})

Then('the Markdown source stays inside the document panel', async ({ page }) => {
  const dimensions = await page.locator('.document-content').evaluate((panel) => {
    const source = panel.querySelector('.markdown-source')
    if (!(source instanceof HTMLElement)) return null
    const panelBox = panel.getBoundingClientRect()
    const sourceBox = source.getBoundingClientRect()
    return {
      panelRight: panelBox.right,
      sourceRight: sourceBox.right,
      sourceClientWidth: source.clientWidth,
      sourceScrollWidth: source.scrollWidth,
    }
  })
  expect(dimensions).not.toBeNull()
  expect(dimensions?.sourceRight ?? Infinity).toBeLessThanOrEqual(
    (dimensions?.panelRight ?? 0) + 1,
  )
  expect(dimensions?.sourceScrollWidth ?? 0).toBeLessThanOrEqual(
    (dimensions?.sourceClientWidth ?? 0) + 1,
  )
})

Then('the proposal review queue uses rows instead of cards', async ({ page }) => {
  await expect(page.locator('.proposal-queue')).toBeVisible()
  await expect(page.locator('.proposal-row').first()).toBeVisible()
  await expect(page.locator('.proposal-grid')).toHaveCount(0)
})

Then('I can collapse the {string} directory', async ({ page }, folder: string) => {
  const disclosure = page.getByRole('button', { name: `Collapse ${folder}` }).first()
  await disclosure.click()
  await expect(
    page.getByRole('button', { name: `Expand ${folder}` }).first(),
  ).toHaveAttribute('aria-expanded', 'false')
})
