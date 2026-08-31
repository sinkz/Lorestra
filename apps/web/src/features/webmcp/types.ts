import type { MergeConfirmation } from '@lorestra/contracts'

type JsonSchema = Record<string, unknown>

export type MergeConfirmationRequest = Readonly<MergeConfirmation & { title: string }>

export interface WebMcpInteraction {
  confirmMerge: (
    input: MergeConfirmationRequest,
    options?: { signal?: AbortSignal },
  ) => boolean | Promise<boolean>
}

export interface WebMcpToolResult {
  content: Array<{ type: 'text'; text: string }>
  structuredContent?: unknown
  isError?: boolean
}

export interface WebMcpToolDefinition {
  name: string
  title?: string
  description: string
  inputSchema?: JsonSchema
  annotations?: {
    readOnlyHint?: boolean
    untrustedContentHint?: boolean
  }
  execute: (
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ) => Promise<WebMcpToolResult>
}

interface WebMcpModelContext {
  registerTool(
    tool: WebMcpToolDefinition,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ): Promise<undefined | void>
}

export type WebMcpDocument = Document & {
  modelContext?: WebMcpModelContext
}

export interface WebMcpRegistration {
  status: 'registered' | 'partial' | 'unsupported'
  registeredToolCount: number
  toolCount: number
  errors: unknown[]
  dispose: () => void
}
