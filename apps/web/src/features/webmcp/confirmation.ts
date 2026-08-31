import type {
  MergeConfirmationBinding,
  MergeConfirmationDecision,
  MergeConfirmationInput,
  MergeConfirmationRequest,
  MergeConfirmationResolution,
  WebMcpInteraction,
} from './types'

const DEFAULT_TTL_MS = 2 * 60 * 1000

type StoredState =
  | 'confirmation_required'
  | 'confirmation_confirmed'
  | 'confirmation_committing'
  | 'confirmation_declined'
  | 'confirmation_cancelled'
  | 'confirmation_expired'

interface StoredConfirmation {
  readonly binding: MergeConfirmationBinding
  readonly request: MergeConfirmationRequest
  readonly expiresAt: number
  state: StoredState
  lifecycleRevoked: boolean
  timer: ReturnType<typeof setTimeout> | undefined
  signal: AbortSignal | undefined
  onAbort: (() => void) | undefined
}

export interface MergeConfirmationControllerOptions {
  /** The default is intentionally bounded; callers can use a shorter test TTL. */
  ttlMs?: number
  now?: () => number
}

function sameBinding(
  left: MergeConfirmationBinding,
  right: MergeConfirmationBinding,
): boolean {
  return (
    left.proposalId === right.proposalId &&
    left.proposalVersion === right.proposalVersion &&
    left.contentHash === right.contentHash &&
    left.idempotencyKey === right.idempotencyKey &&
    left.payloadFingerprint === right.payloadFingerprint
  )
}

function sameRequest(
  left: MergeConfirmationRequest,
  right: MergeConfirmationInput,
): boolean {
  return (
    left.proposalId === right.proposalId &&
    left.proposalVersion === right.proposalVersion &&
    left.contentHash === right.contentHash &&
    left.title === right.title
  )
}

function requestForDecision(stored: StoredConfirmation): MergeConfirmationDecision {
  switch (stored.state) {
    case 'confirmation_required':
      return { status: 'confirmation_required', request: stored.request }
    case 'confirmation_declined':
      return { status: 'confirmation_declined', request: stored.request }
    case 'confirmation_cancelled':
      return { status: 'confirmation_cancelled', request: stored.request }
    case 'confirmation_expired':
      return { status: 'confirmation_expired', request: stored.request }
    case 'confirmation_committing':
      return { status: 'confirmation_busy', request: stored.request }
    case 'confirmation_confirmed':
      stored.state = 'confirmation_committing'
      return {
        status: 'confirmation_confirmed',
        confirmation: {
          proposalId: stored.binding.proposalId,
          proposalVersion: stored.binding.proposalVersion,
          contentHash: stored.binding.contentHash,
        },
      }
  }
}

/**
 * A page-scoped, one-slot confirmation ledger for native WebMCP merges.
 *
 * Starting a confirmation is synchronous: it stores a frozen request and
 * returns immediately. A later identical tool call consumes the accepted
 * decision. No promise is held across the human interaction, which keeps the
 * native browser transport responsive.
 */
export function createMergeConfirmationController(
  options: MergeConfirmationControllerOptions = {},
): WebMcpInteraction & {
  getSnapshot: () => MergeConfirmationRequest | null
  subscribe: (listener: () => void) => () => void
  respond: (request: MergeConfirmationRequest | null, confirmed: boolean) => void
  cancel: (request?: MergeConfirmationRequest | null) => void
  dispose: () => void
} {
  const listeners = new Set<() => void>()
  const ttlMs = Math.max(1, options.ttlMs ?? DEFAULT_TTL_MS)
  const now = options.now ?? Date.now
  let stored: StoredConfirmation | null = null

  const notify = () => listeners.forEach((listener) => listener())

  const clearTimer = (entry: StoredConfirmation) => {
    if (entry.timer !== undefined) clearTimeout(entry.timer)
    entry.timer = undefined
  }

  const clearAbort = (entry: StoredConfirmation) => {
    if (entry.signal && entry.onAbort)
      entry.signal.removeEventListener('abort', entry.onAbort)
    entry.signal = undefined
    entry.onAbort = undefined
  }

  const clearStored = (entry: StoredConfirmation) => {
    clearTimer(entry)
    clearAbort(entry)
    if (stored === entry) stored = null
  }

  const expire = (entry: StoredConfirmation) => {
    if (
      stored !== entry ||
      entry.state === 'confirmation_expired' ||
      entry.state === 'confirmation_committing'
    )
      return
    clearAbort(entry)
    entry.state = 'confirmation_expired'
    notify()
  }

  const scheduleExpiry = (entry: StoredConfirmation) => {
    entry.timer = setTimeout(() => expire(entry), ttlMs)
  }

  const decisionFor = (
    input: MergeConfirmationInput,
    binding: MergeConfirmationBinding,
    signal?: AbortSignal,
  ): MergeConfirmationDecision => {
    if (signal?.aborted) {
      if (stored && sameBinding(stored.binding, binding)) {
        if (stored.state !== 'confirmation_committing') {
          clearAbort(stored)
          stored.state = 'confirmation_cancelled'
          notify()
        }
      }
      return stored?.state === 'confirmation_committing'
        ? { status: 'confirmation_busy', request: stored.request }
        : { status: 'confirmation_cancelled' }
    }

    if (stored) {
      if (now() >= stored.expiresAt) expire(stored)

      const sameKey = stored.binding.idempotencyKey === binding.idempotencyKey
      const active =
        stored.state === 'confirmation_required' ||
        stored.state === 'confirmation_confirmed' ||
        stored.state === 'confirmation_committing'

      if (sameKey && !sameBinding(stored.binding, binding)) {
        return { status: 'confirmation_mismatch', request: stored.request }
      }
      if (active && !sameKey) {
        return { status: 'confirmation_busy', request: stored.request }
      }
      if (!sameKey && !active) {
        clearStored(stored)
        notify()
      }
    }

    if (stored) {
      if (!sameRequest(stored.request, input))
        return { status: 'confirmation_mismatch', request: stored.request }
      return requestForDecision(stored)
    }

    const expiresAt = now() + ttlMs
    const request = Object.freeze({
      ...input,
      expiresAt: new Date(expiresAt).toISOString(),
    })
    const entry: StoredConfirmation = {
      binding: Object.freeze({ ...binding }),
      request,
      expiresAt,
      state: 'confirmation_required',
      lifecycleRevoked: false,
      timer: undefined,
      signal,
      onAbort: undefined,
    }
    if (signal) {
      entry.onAbort = () => {
        if (stored !== entry) return
        // An abort while the guarded transition is in flight must not turn an
        // uncertain response into a fresh operation. Revoke the accepted
        // permission immediately; a persisted backend result remains
        // recoverable with the original key, but this registration cannot
        // authorize another dispatch.
        if (entry.state === 'confirmation_committing') {
          entry.lifecycleRevoked = true
          clearAbort(entry)
          return
        }
        clearAbort(entry)
        entry.state = 'confirmation_cancelled'
        notify()
      }
      signal.addEventListener('abort', entry.onAbort, { once: true })
    }
    stored = entry
    scheduleExpiry(entry)
    notify()
    return { status: 'confirmation_required', request }
  }

  const settle = (
    binding: MergeConfirmationBinding,
    resolution: MergeConfirmationResolution,
  ) => {
    if (!stored || !sameBinding(stored.binding, binding)) return
    if (resolution === 'uncertain') {
      if (stored.state === 'confirmation_committing') {
        if (stored.lifecycleRevoked) {
          stored.state = 'confirmation_cancelled'
          notify()
          return
        }
        if (now() < stored.expiresAt) stored.state = 'confirmation_confirmed'
        else {
          clearAbort(stored)
          stored.state = 'confirmation_expired'
        }
        notify()
      }
      return
    }
    clearStored(stored)
    notify()
  }

  const controller: WebMcpInteraction & {
    getSnapshot: () => MergeConfirmationRequest | null
    subscribe: (listener: () => void) => () => void
    respond: (request: MergeConfirmationRequest | null, confirmed: boolean) => void
    cancel: (request?: MergeConfirmationRequest | null) => void
    dispose: () => void
  } = {
    requestMergeConfirmation: (input, requestOptions) =>
      decisionFor(input, requestOptions.binding, requestOptions.signal),
    settleMergeConfirmation: settle,
    getSnapshot: () =>
      stored?.state === 'confirmation_required' ? stored.request : null,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    respond: (request, confirmed) => {
      if (
        !stored ||
        stored.state !== 'confirmation_required' ||
        !request ||
        request !== stored.request
      )
        return
      stored.state = confirmed ? 'confirmation_confirmed' : 'confirmation_declined'
      if (!confirmed) clearAbort(stored)
      notify()
    },
    cancel: (request) => {
      if (
        !stored ||
        (request && request !== stored.request) ||
        stored.state === 'confirmation_expired' ||
        stored.state === 'confirmation_committing'
      )
        return
      clearAbort(stored)
      stored.state = 'confirmation_cancelled'
      notify()
    },
    dispose: () => {
      if (!stored) return
      clearStored(stored)
      notify()
    },
  }

  return controller
}
