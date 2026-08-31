import { describe, expect, it, vi } from 'vitest'
import {
  createCrossTabInvalidationChannel,
  type CrossTabInvalidation,
} from './cross-tab'

type FakeChannel = {
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ) => void
  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent<unknown>) => void,
  ) => void
  postMessage: (message: CrossTabInvalidation) => void
  close: () => void
  emit: (data: unknown) => void
  posted: CrossTabInvalidation[]
}

function fakeChannel(): FakeChannel {
  let listener: ((event: MessageEvent<unknown>) => void) | undefined
  const posted: CrossTabInvalidation[] = []
  return {
    addEventListener: (_type, next) => {
      listener = next
    },
    removeEventListener: (_type, next) => {
      if (listener === next) listener = undefined
    },
    postMessage: (message) => posted.push(message),
    close: vi.fn(),
    emit: (data) => listener?.({ data } as MessageEvent<unknown>),
    posted,
  }
}

describe('cross-tab invalidation', () => {
  it('publishes a minimal versioned marker and accepts only the same vault', () => {
    const channel = fakeChannel()
    const signals: CrossTabInvalidation[] = []
    const invalidation = createCrossTabInvalidationChannel(
      'vault-a',
      (signal) => signals.push(signal),
      { channelFactory: () => channel },
    )

    invalidation.publish('publication')
    expect(channel.posted).toEqual([
      { version: 1, vaultId: 'vault-a', kind: 'publication' },
    ])
    channel.emit({ version: 1, vaultId: 'vault-b', kind: 'publication' })
    channel.emit({ version: 1, vaultId: 'vault-a', kind: 'proposal' })
    expect(signals).toEqual([{ version: 1, vaultId: 'vault-a', kind: 'proposal' }])
  })

  it('rejects malformed or content-bearing messages without invoking the receiver', () => {
    const channel = fakeChannel()
    const receive = vi.fn()
    const invalidation = createCrossTabInvalidationChannel('vault-a', receive, {
      channelFactory: () => channel,
    })

    for (const value of [
      null,
      [],
      { version: 2, vaultId: 'vault-a', kind: 'proposal' },
      { version: 1, vaultId: '', kind: 'proposal' },
      { version: 1, vaultId: 'vault-a', kind: 'unknown' },
      { version: 1, vaultId: 'vault-a', kind: 'proposal', body: 'secret' },
      { version: 1, vaultId: 'vault-a', kind: 'proposal', csrfToken: 'secret' },
    ])
      channel.emit(value)
    expect(receive).not.toHaveBeenCalled()
    invalidation.close()
  })

  it('detaches and closes safely; later messages and publishes are ignored', () => {
    const channel = fakeChannel()
    const receive = vi.fn()
    const invalidation = createCrossTabInvalidationChannel('vault-a', receive, {
      channelFactory: () => channel,
    })

    invalidation.close()
    invalidation.close()
    channel.emit({ version: 1, vaultId: 'vault-a', kind: 'session' })
    invalidation.publish('session')
    expect(receive).not.toHaveBeenCalled()
    expect(channel.posted).toEqual([])
    expect(channel.close).toHaveBeenCalledOnce()
  })

  it('treats construction, post, and receiver failures as optional-channel failures', () => {
    const receive = vi.fn(() => {
      throw new Error('receiver failed')
    })
    const channel = fakeChannel()
    channel.postMessage = () => {
      throw new Error('post failed')
    }
    const invalidation = createCrossTabInvalidationChannel('vault-a', receive, {
      channelFactory: () => channel,
    })

    expect(() => invalidation.publish('proposal')).not.toThrow()
    expect(() =>
      channel.emit({ version: 1, vaultId: 'vault-a', kind: 'proposal' }),
    ).not.toThrow()
    expect(receive).toHaveBeenCalledOnce()
    expect(() =>
      createCrossTabInvalidationChannel('vault-a', vi.fn(), {
        channelFactory: () => {
          throw new Error('blocked')
        },
      }),
    ).not.toThrow()
  })
})
