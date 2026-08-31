import type { AppClients, Locale } from '../../shared/model/types'

import { createLorestraWebMcpTools } from './tools'
import type { WebMcpDocument, WebMcpRegistration } from './types'
const registrationOwners = new WeakMap<Document, symbol>()

export async function registerLorestraWebMcpTools(
  targetDocument: Document,
  clients: AppClients,
  getLocale: () => Locale,
  parentSignal?: AbortSignal,
): Promise<WebMcpRegistration> {
  const modelContext = (targetDocument as WebMcpDocument).modelContext
  const tools = createLorestraWebMcpTools(clients, getLocale)
  const controller = new AbortController()
  const owner = Symbol('registration')
  registrationOwners.set(targetDocument, owner)
  parentSignal?.addEventListener('abort', () => controller.abort(), { once: true })
  if (parentSignal?.aborted) controller.abort()

  if (!modelContext?.registerTool) {
    targetDocument.documentElement.dataset.webmcp = 'unsupported'
    return {
      status: 'unsupported',
      registeredToolCount: 0,
      toolCount: tools.length,
      errors: [],
      dispose: () => {
        controller.abort()
        if (registrationOwners.get(targetDocument) === owner) {
          delete targetDocument.documentElement.dataset.webmcp
          delete targetDocument.documentElement.dataset.webmcpTools
        }
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
  if (registrationOwners.get(targetDocument) === owner && !controller.signal.aborted) {
    targetDocument.documentElement.dataset.webmcp = status
    targetDocument.documentElement.dataset.webmcpTools = String(registeredToolCount)
  }

  return {
    status,
    registeredToolCount,
    toolCount: tools.length,
    errors,
    dispose: () => {
      controller.abort()
      if (registrationOwners.get(targetDocument) === owner) {
        delete targetDocument.documentElement.dataset.webmcp
        delete targetDocument.documentElement.dataset.webmcpTools
      }
    },
  }
}
