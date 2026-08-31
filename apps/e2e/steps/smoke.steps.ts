import { expect, type Page } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

async function readCelestialFrame(page: Page) {
  return page.locator('.galaxy-canvas').evaluate((graph) => {
    const body = graph.querySelector('button.celestial-node[data-hub="false"]')
    const canvas = graph.querySelector('canvas')
    return {
      position: body
        ? `${body.getAttribute('data-screen-x')},${body.getAttribute('data-screen-y')}`
        : null,
      // Read only the rendered bitmap, excluding HUD/tooltip overlays.
      bitmap: canvas instanceof HTMLCanvasElement ? canvas.toDataURL() : null,
    }
  })
}

Given('I open Lorestra at {string}', async ({ page }, path: string) => {
  await page.goto(path)
})

Given('I prefer reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

Then('the heading {string} is visible', async ({ page }, heading: string) => {
  await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
})

Then('the knowledge graph has visible nodes', async ({ page }) => {
  await expect(page.getByLabel('Knowledge graph', { exact: true })).toBeVisible()
  await expect(page.locator('button.celestial-node').first()).toBeVisible()
})

When('I open the graph node {string}', async ({ page }, title: string) => {
  await page.getByRole('button', { name: `Select ${title}`, exact: true }).dblclick()
})

When('I select the graph node {string}', async ({ page }, title: string) => {
  await page.getByRole('button', { name: `Select ${title}`, exact: true }).click()
})

When('I return to the previous Atlas view', async ({ page }) => {
  await page.goBack()
  await expect(page.locator('.galaxy-canvas')).toBeVisible()
})

Then('the knowledge graph is spread across both axes', async ({ page }) => {
  await expect(async () => {
    const viewport = await page.locator('.galaxy-canvas').boundingBox()
    const positions = await page.locator('button.celestial-node').evaluateAll((nodes) =>
      nodes.map((node) => ({
        x: Number.parseFloat(node.getAttribute('data-screen-x') ?? ''),
        y: Number.parseFloat(node.getAttribute('data-screen-y') ?? ''),
      })),
    )
    expect(viewport).not.toBeNull()
    expect(viewport?.height ?? Infinity).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 0,
    )
    expect(positions.length).toBeGreaterThan(5)
    expect(
      positions.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)),
    ).toBe(true)
    const xs = positions.map(({ x }) => x)
    const ys = positions.map(({ y }) => y)
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(
      (viewport?.width ?? 0) * 0.4,
    )
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(
      (viewport?.height ?? 0) * 0.35,
    )
  }).toPass({ timeout: 5_000 })
})

Then('the knowledge graph exposes separate galaxies', async ({ page }) => {
  const graph = page.locator('.galaxy-canvas')
  await expect(graph).toHaveAttribute('data-galaxy-count', /^\d+$/)
  await expect(graph).toHaveAttribute('data-bridge-count', /^\d+$/)
  const galaxyIds = await graph
    .locator('button.celestial-node')
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-galaxy-id')))
  const count = Number(await graph.getAttribute('data-galaxy-count'))
  expect(count).toBeGreaterThan(1)
  expect(galaxyIds.every(Boolean)).toBe(true)
  expect(new Set(galaxyIds).size).toBe(count)
  await expect(graph.locator('button.celestial-node[data-hub="true"]')).toHaveCount(
    count,
  )
})

When(
  'I rotate, tilt, and zoom the constellation and reset its view',
  async ({ page }) => {
    const graph = page.locator('.galaxy-canvas')
    const before = {
      yaw: await graph.getAttribute('data-yaw'),
      pitch: await graph.getAttribute('data-pitch'),
      zoom: await graph.getAttribute('data-zoom'),
    }
    expect(before.yaw).not.toBeNull()
    expect(before.pitch).not.toBeNull()
    expect(before.zoom).not.toBeNull()

    await page.getByRole('button', { name: 'Rotate right', exact: true }).click()
    await expect(graph).not.toHaveAttribute('data-yaw', before.yaw ?? '')
    await page.getByRole('button', { name: 'Tilt up', exact: true }).click()
    await expect(graph).not.toHaveAttribute('data-pitch', before.pitch ?? '')
    await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
    await expect
      .poll(async () => Number(await graph.getAttribute('data-zoom')))
      .toBeGreaterThan(Number(before.zoom))

    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    await expect(graph).toHaveAttribute('data-yaw', before.yaw ?? '')
    await expect(graph).toHaveAttribute('data-pitch', before.pitch ?? '')
    await expect(graph).toHaveAttribute('data-zoom', before.zoom ?? '')
  },
)

When(
  'I select the graph node {string} with the keyboard',
  async ({ page }, title: string) => {
    const node = page.getByRole('button', { name: `Select ${title}`, exact: true })
    await node.focus()
    await expect(node).toBeFocused()
    await node.press('Enter')
  },
)

Then('automatic graph motion is paused', async ({ page }) => {
  await expect(page.locator('.galaxy-canvas')).toHaveAttribute('data-motion', 'paused')
  const motion = page.getByRole('button', {
    name: 'Motion disabled by your system preference',
    exact: true,
  })
  await expect(motion).toHaveAttribute('aria-pressed', 'true')
  await expect(motion).toBeDisabled()
})

Then('celestial bodies visibly animate', async ({ page }) => {
  await expect(page.locator('.galaxy-canvas')).toHaveAttribute('data-motion', 'active')
  const before = await readCelestialFrame(page)
  expect(before.position).not.toBeNull()
  expect(before.bitmap).not.toBeNull()
  await expect
    .poll(async () => {
      const current = await readCelestialFrame(page)
      return {
        positionChanged: current.position !== before.position,
        pixelsChanged: current.bitmap !== before.bitmap,
      }
    })
    .toEqual({ positionChanged: true, pixelsChanged: true })
})

When('I pause the celestial animation', async ({ page }) => {
  await page.getByRole('button', { name: 'Pause motion', exact: true }).click()
  await expect(page.locator('.galaxy-canvas')).toHaveAttribute('data-motion', 'paused')
})

Then('the celestial scene remains frozen', async ({ page }) => {
  const frozen = await readCelestialFrame(page)
  expect(frozen.position).not.toBeNull()
  expect(frozen.bitmap).not.toBeNull()
  const started = Date.now()
  await expect
    .poll(
      async () => {
        const current = await readCelestialFrame(page)
        expect(current.position).toBe(frozen.position)
        expect(current.bitmap === frozen.bitmap).toBe(true)
        return Date.now() - started
      },
      { intervals: [50, 75, 100], timeout: 2_000 },
    )
    .toBeGreaterThanOrEqual(300)
})

When('I resume the celestial animation', async ({ page }) => {
  await page.getByRole('button', { name: 'Resume motion', exact: true }).click()
  await expect(page.locator('.galaxy-canvas')).toHaveAttribute('data-motion', 'active')
})

When('I hover the camera control {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).hover()
})

When('I focus the camera control {string}', async ({ page }, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).focus()
})

Then(
  'the camera tooltip {string} is visible inside the viewport',
  async ({ page }, label: string) => {
    const tooltip = page.getByRole('tooltip')
    await expect(tooltip).toHaveText(label)
    await expect(tooltip).toBeVisible()
    const box = await tooltip.boundingBox()
    const viewport = page.viewportSize()
    expect(box).not.toBeNull()
    expect(viewport).not.toBeNull()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect(box?.y ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? Infinity) + (box?.width ?? 0)).toBeLessThanOrEqual(
      viewport?.width ?? 0,
    )
    expect((box?.y ?? Infinity) + (box?.height ?? 0)).toBeLessThanOrEqual(
      viewport?.height ?? 0,
    )
  },
)

When('I dismiss the camera tooltip with Escape', async ({ page }) => {
  await page.keyboard.press('Escape')
})

Then('the camera tooltip is hidden', async ({ page }) => {
  await expect(page.getByRole('tooltip')).toBeHidden()
})

Then(
  'the camera control {string} keeps keyboard focus',
  async ({ page }, label: string) => {
    await expect(page.getByRole('button', { name: label, exact: true })).toBeFocused()
  },
)

When('I rotate and reset the graph camera with the keyboard', async ({ page }) => {
  const graph = page.locator('.galaxy-canvas')
  const camera = page.getByLabel('Knowledge graph', { exact: true })
  const before = await graph.getAttribute('data-yaw')
  expect(before).not.toBeNull()
  await camera.focus()
  await expect(camera).toBeFocused()
  await camera.press('ArrowRight')
  await expect(graph).not.toHaveAttribute('data-yaw', before ?? '')
  await camera.press('Home')
  await expect(graph).toHaveAttribute('data-yaw', before ?? '')
})

Then(
  'the selected graph node offers to open {string}',
  async ({ page }, title: string) => {
    await expect(
      page.getByRole('button', { name: `Open ${title}`, exact: true }),
    ).toBeVisible()
  },
)

When(
  'I open the selected graph node {string} with the keyboard',
  async ({ page }, title: string) => {
    const open = page.getByRole('button', { name: `Open ${title}`, exact: true })
    await open.focus()
    await open.press('Enter')
  },
)

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

Then('the document type is {string}', async ({ page }, kind: string) => {
  await expect(page.locator('.document-status .document-kind').first()).toHaveText(kind)
})

When('I follow the document reference {string}', async ({ page }, title: string) => {
  await page
    .locator('.markdown-content')
    .getByRole('link', { name: title, exact: true })
    .first()
    .click()
})

Then('the document status {string} is readable', async ({ page }, status: string) => {
  const badge = page.locator('.document-status .status-badge')
  await expect(badge).toHaveText(status)
  await expect(badge).toBeVisible()
  const contrast = await badge.evaluate((element) => {
    const luminance = (color: string) => {
      const rgb = (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      return rgb.reduce((sum, component, index) => {
        const channel = component / 255
        const linear =
          channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        return sum + linear * [0.2126, 0.7152, 0.0722][index]!
      }, 0)
    }
    const foreground = luminance(getComputedStyle(element).color)
    // The status badge is transparent on the document's opaque paper surface.
    const paper = element.closest('.document')
    if (!paper) return 0
    const background = luminance(getComputedStyle(paper).backgroundColor)
    return (
      (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05)
    )
  })
  expect(contrast).toBeGreaterThanOrEqual(4.5)
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
