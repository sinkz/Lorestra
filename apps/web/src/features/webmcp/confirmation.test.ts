import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMergeConfirmationController } from './confirmation'
import type { MergeConfirmationBinding, MergeConfirmationInput } from './types'

const input: MergeConfirmationInput = {
  proposalId: 'proposal-confirmation',
  proposalVersion: 2,
  contentHash: 'a'.repeat(64),
  title: 'Reviewed memory',
}

function binding(
  idempotencyKey = 'merge-key',
  payloadFingerprint = 'payload',
): MergeConfirmationBinding {
  return {
    proposalId: input.proposalId,
    proposalVersion: input.proposalVersion,
    contentHash: input.contentHash,
    idempotencyKey,
    payloadFingerprint,
  }
}

describe('WebMCP merge confirmation', () => {
  afterEach(() => vi.useRealTimers())

  it('returns promptly, freezes the displayed tuple, and consumes acceptance once', () => {
    const controller = createMergeConfirmationController()
    const changed = vi.fn()
    controller.subscribe(changed)

    const decision = controller.requestMergeConfirmation!(input, {
      binding: binding(),
    })
    expect(decision.status).toBe('confirmation_required')
    if (decision.status !== 'confirmation_required') return
    const request = controller.getSnapshot()!
    expect(request).toMatchObject(input)
    expect(request.expiresAt).toBeTruthy()
    expect(Object.isFrozen(request)).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)

    controller.respond(request, true)
    const accepted = controller.requestMergeConfirmation!(input, {
      binding: binding(),
    })
    expect(accepted).toEqual({
      status: 'confirmation_confirmed',
      confirmation: {
        proposalId: input.proposalId,
        proposalVersion: input.proposalVersion,
        contentHash: input.contentHash,
      },
    })
    expect(controller.getSnapshot()).toBeNull()
    controller.settleMergeConfirmation!(binding(), 'committed')
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_required')
    controller.dispose()
  })

  it('keeps one prompt and reports busy for another operation', () => {
    const controller = createMergeConfirmationController()
    const first = controller.requestMergeConfirmation!(input, { binding: binding() })
    expect(first.status).toBe('confirmation_required')
    const same = controller.requestMergeConfirmation!(input, { binding: binding() })
    expect(same.status).toBe('confirmation_required')
    expect(same).toEqual(first)
    const other = controller.requestMergeConfirmation!(input, {
      binding: binding('other-key'),
    })
    expect(other.status).toBe('confirmation_busy')
    controller.dispose()
  })

  it('retains decline/cancel outcomes for the same key and rejects an old dialog callback', () => {
    const controller = createMergeConfirmationController()
    const first = controller.requestMergeConfirmation!(input, { binding: binding() })
    if (first.status !== 'confirmation_required') return
    const oldRequest = controller.getSnapshot()!
    controller.cancel(oldRequest)
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_cancelled')

    const second = controller.requestMergeConfirmation!(input, {
      binding: binding('new-key'),
    })
    expect(second.status).toBe('confirmation_required')
    if (second.status !== 'confirmation_required') return
    const newRequest = controller.getSnapshot()!
    controller.respond(oldRequest, true)
    expect(controller.getSnapshot()).toBe(newRequest)
    controller.respond(newRequest, false)
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('new-key'),
      }).status,
    ).toBe('confirmation_declined')
    controller.dispose()
  })

  it('cancels before consumption and revokes accepted permission during a commit', () => {
    const controller = createMergeConfirmationController()
    const scope = new AbortController()
    const first = controller.requestMergeConfirmation!(input, {
      binding: binding(),
      signal: scope.signal,
    })
    expect(first.status).toBe('confirmation_required')
    scope.abort()
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding(),
        signal: scope.signal,
      }).status,
    ).toBe('confirmation_cancelled')

    const nextScope = new AbortController()
    const next = controller.requestMergeConfirmation!(input, {
      binding: binding('next-key'),
      signal: nextScope.signal,
    })
    expect(next.status).toBe('confirmation_required')
    if (next.status !== 'confirmation_required') return
    const request = controller.getSnapshot()!
    controller.respond(request, true)
    nextScope.abort()
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('next-key'),
      }).status,
    ).toBe('confirmation_cancelled')

    const committingScope = new AbortController()
    const committing = controller.requestMergeConfirmation!(input, {
      binding: binding('committing-key'),
      signal: committingScope.signal,
    })
    expect(committing.status).toBe('confirmation_required')
    if (committing.status !== 'confirmation_required') return
    controller.respond(controller.getSnapshot(), true)
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('committing-key'),
      }).status,
    ).toBe('confirmation_confirmed')
    committingScope.abort()
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('committing-key'),
      }).status,
    ).toBe('confirmation_busy')
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('other-key'),
      }).status,
    ).toBe('confirmation_busy')
    controller.settleMergeConfirmation!(binding('next-key'), 'uncertain')
    controller.settleMergeConfirmation!(binding('next-key'), 'failed')
    controller.settleMergeConfirmation!(binding('committing-key'), 'uncertain')
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('committing-key'),
      }).status,
    ).toBe('confirmation_cancelled')
    controller.dispose()
  })

  it('expires visibly and allows a new key to start a fresh prompt', () => {
    vi.useFakeTimers()
    const controller = createMergeConfirmationController({ ttlMs: 100 })
    const first = controller.requestMergeConfirmation!(input, { binding: binding() })
    expect(first.status).toBe('confirmation_required')
    vi.advanceTimersByTime(101)
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_expired')
    expect(
      controller.requestMergeConfirmation!(input, {
        binding: binding('fresh-key'),
      }).status,
    ).toBe('confirmation_required')
    controller.dispose()
  })

  it('retains accepted consent for same-key uncertain recovery', () => {
    const controller = createMergeConfirmationController()
    const first = controller.requestMergeConfirmation!(input, { binding: binding() })
    expect(first.status).toBe('confirmation_required')
    const request = controller.getSnapshot()!
    controller.respond(request, true)
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_confirmed')
    controller.settleMergeConfirmation!(binding(), 'uncertain')
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_confirmed')
    controller.settleMergeConfirmation!(binding(), 'failed')
    expect(
      controller.requestMergeConfirmation!(input, { binding: binding() }).status,
    ).toBe('confirmation_required')
    controller.dispose()
  })
})
