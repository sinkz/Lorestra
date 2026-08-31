import type { MergeConfirmation } from '@lorestra/contracts'

type JsonSchema = Record<string, unknown>

export type MergeConfirmationInput = Readonly<MergeConfirmation & { title: string }>

export type MergeConfirmationRequest = Readonly<
  MergeConfirmationInput & { expiresAt: string }
>

/** The browser-local binding for one explicit merge attempt. */
export type MergeConfirmationBinding = Readonly<
  MergeConfirmation & {
    idempotencyKey: string
    payloadFingerprint: string
  }
>

export type MergeConfirmationDecision =
  | {
      status: 'confirmation_required'
      request: MergeConfirmationRequest
    }
  | {
      status: 'confirmation_confirmed'
      confirmation: MergeConfirmation
    }
  | {
      status:
        | 'confirmation_declined'
        | 'confirmation_cancelled'
        | 'confirmation_expired'
        | 'confirmation_busy'
        | 'confirmation_mismatch'
      request?: MergeConfirmationRequest
    }

export type MergeConfirmationResolution = 'committed' | 'uncertain' | 'failed'

export class WebMcpToolError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'WebMcpToolError'
  }
}

export interface WebMcpInteraction {
  /**
   * Starts or consumes one local confirmation without awaiting a human.
   * The returned decision is intentionally synchronous so native WebMCP calls
   * never hold the CDP evaluation open while a dialog is visible.
   */
  requestMergeConfirmation?: (
    input: MergeConfirmationInput,
    options: { binding: MergeConfirmationBinding; signal?: AbortSignal },
  ) => MergeConfirmationDecision
  settleMergeConfirmation?: (
    binding: MergeConfirmationBinding,
    resolution: MergeConfirmationResolution,
  ) => void
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
