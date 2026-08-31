import { startFrontend } from './frontend-server'

export default function startMockFrontend() {
  return startFrontend('mock', 4185)
}
