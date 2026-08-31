import { createDurableApp } from '../app/create-durable-app.js'

// Shared builds never contain the local token exchange or mock fixture adapter.
export default createDurableApp({ mode: 'shared' })
