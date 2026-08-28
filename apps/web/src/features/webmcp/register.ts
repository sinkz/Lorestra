import type { AppClients, Locale } from '../../shared/model/types'

import { createLorestraWebMcpTools } from './tools'
import type { WebMcpDocument, WebMcpRegistration } from './types'

export async function registerLorestraWebMcpTools(
  targetDocument: Document,
  clients: AppClients,
  getLocale: () => Locale,
): Promise<WebMcpRegistration> {
  const modelContext = (targetDocument as WebMcpDocument).modelContext
  const tools = createLorestraWebMcpTools(clients, getLocale)
  const controller = new AbortController()

  if (!modelContext?.registerTool) {
    targetDocument.documentElement.dataset.webmcp = 'unsupported'
    return {
      status: 'unsupported',
      registeredToolCount: 0,
      toolCount: tools.length,
      errors: [],
      dispose: () => {
        controller.abort()
        delete targetDocument.documentElement.dataset.webmcp
        delete targetDocument.documentElement.dataset.webmcpTools
      },
    }
  }

  const registrations = await Promise.allSettled(
    tools.map((definition) =>
      modelContext.registerTool(definition, { signal: controller.signal }),
    ),
  )
  const errors = registrations
    .filter((registration) => registration.status === 'rejected')
    .map((registration) => registration.reason as unknown)
  const registeredToolCount = registrations.length - errors.length
  const status = errors.length === 0 ? 'registered' : 'partial'
  targetDocument.documentElement.dataset.webmcp = status
  targetDocument.documentElement.dataset.webmcpTools = String(registeredToolCount)

  return {
    status,
    registeredToolCount,
    toolCount: tools.length,
    errors,
    dispose: () => {
      controller.abort()
      delete targetDocument.documentElement.dataset.webmcp
      delete targetDocument.documentElement.dataset.webmcpTools
    },
  }
}
