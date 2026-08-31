import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'features/backend/**/*.feature',
  steps: ['fixtures/backend.ts', 'steps/backend/**/*.ts'],
  outputDir: '.features-gen/http',
  missingSteps: 'fail-on-gen',
})

export default defineConfig({
  testDir,
  globalSetup: './fixtures/http-server.ts',
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: 'test-results/http',
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report/http' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4176',
    actionTimeout: 10_000,
    // Even synthetic session credentials must never enter published artifacts.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'http-chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile/,
    },
    { name: 'http-mobile', use: { ...devices['Pixel 7'] }, grep: /@mobile/ },
  ],
})
