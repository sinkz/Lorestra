import { createApp } from '../app/create-app.js'

/**
 * Composition root. The in-memory reader is deliberately the only default for
 * this scaffold; future R2/D1 adapters are injected here without changing slices.
 */
const app = createApp()

export default app
