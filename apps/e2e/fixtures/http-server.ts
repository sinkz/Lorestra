import { startFrontend } from './frontend-server'

export default function startHttpFrontend() {
  return startFrontend('http', 4176, 'http://127.0.0.1:8795')
}
