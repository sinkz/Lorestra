import { describe, expect, it, vi } from 'vitest'
import { createMergeConfirmationController } from './confirmation'

const input = {
  proposalId: 'proposal-confirmation',
  proposalVersion: 2,
  contentHash: 'a'.repeat(64),
  title: 'Reviewed memory',
}

describe('WebMCP merge confirmation', () => {
  it('waits for an explicit response and freezes the displayed tuple', async () => {
    const controller = createMergeConfirmationController()
    const changed = vi.fn()
    controller.subscribe(changed)
    const mutable = { ...input }
    const pending = controller.confirmMerge(mutable)
    const request = controller.getSnapshot()!
    mutable.title = 'Different title'
    mutable.proposalVersion = 9
    expect(request).toEqual(input)
    expect(Object.isFrozen(request)).toBe(true)
    expect(changed).toHaveBeenCalledTimes(1)
    controller.respond(request, true)
    expect(await pending).toBe(true)
    expect(controller.getSnapshot()).toBeNull()
    expect(changed).toHaveBeenCalledTimes(2)
  })

  it('does not replace a pending dialog with a concurrent tool call', async () => {
    const controller = createMergeConfirmationController()
    const pending = controller.confirmMerge(input)
    const request = controller.getSnapshot()
    expect(await controller.confirmMerge({ ...input, proposalId: 'another' })).toBe(
      false,
    )
    expect(controller.getSnapshot()).toBe(request)
    controller.respond(request, false)
    expect(await pending).toBe(false)
  })

  it('settles cancellation and ignores a response from an older dialog', async () => {
    const controller = createMergeConfirmationController()
    const first = controller.confirmMerge(input)
    const old = controller.getSnapshot()
    controller.cancel()
    expect(await first).toBe(false)
    const second = controller.confirmMerge({ ...input, proposalVersion: 4 })
    controller.respond(old, true)
    expect(controller.getSnapshot()?.proposalVersion).toBe(4)
    controller.respond(controller.getSnapshot(), false)
    expect(await second).toBe(false)
  })

  it('cancels on scope or tool abort and refuses an already-aborted call', async () => {
    const controller = createMergeConfirmationController()
    const signal = new AbortController()
    const pending = controller.confirmMerge(input, { signal: signal.signal })
    signal.abort()
    expect(await pending).toBe(false)
    expect(controller.getSnapshot()).toBeNull()
    expect(await controller.confirmMerge(input, { signal: signal.signal })).toBe(false)
    expect(controller.getSnapshot()).toBeNull()
  })
})
