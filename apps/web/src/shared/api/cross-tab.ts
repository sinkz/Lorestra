type CrossTabInvalidationKind = 'publication' | 'proposal' | 'session'

export type CrossTabInvalidation = {
  version: 1
  vaultId: string
  kind: CrossTabInvalidationKind
}

type CrossTabChannel = {
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
}

export type CrossTabInvalidationChannel = {
  publish: (kind: CrossTabInvalidationKind) => void
  close: () => void
}

export type CrossTabInvalidationOptions = {
  channelFactory?: (name: string) => CrossTabChannel
}

const CHANNEL_NAME = 'lorestra:query-invalidation'
const kinds = new Set<CrossTabInvalidationKind>(['publication', 'proposal', 'session'])

function parseSignal(value: unknown): CrossTabInvalidation | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== 3 ||
    !keys.includes('version') ||
    !keys.includes('vaultId') ||
    !keys.includes('kind') ||
    record.version !== 1 ||
    typeof record.vaultId !== 'string' ||
    record.vaultId.length === 0 ||
    typeof record.kind !== 'string' ||
    !kinds.has(record.kind as CrossTabInvalidationKind)
  )
    return null
  return {
    version: 1,
    vaultId: record.vaultId,
    kind: record.kind as CrossTabInvalidationKind,
  }
}

function defaultChannelFactory(name: string): CrossTabChannel {
  return new BroadcastChannel(name)
}

/**
 * Sends content-free, same-origin invalidation markers between Lorestra tabs.
 *
 * BroadcastChannel is progressive enhancement: unsupported or blocked browser
 * primitives result in a no-op channel. Query focus refresh remains the
 * fallback, and a transport failure must never turn a committed mutation into
 * an error.
 */
export function createCrossTabInvalidationChannel(
  vaultId: string,
  onSignal: (signal: CrossTabInvalidation) => void,
  options: CrossTabInvalidationOptions = {},
): CrossTabInvalidationChannel {
  let channel: CrossTabChannel | undefined
  let closed = false
  const factory = options.channelFactory ?? defaultChannelFactory
  const handleMessage = (event: MessageEvent<unknown>) => {
    if (closed) return
    const signal = parseSignal(event.data)
    if (!signal || signal.vaultId !== vaultId) return
    try {
      onSignal(signal)
    } catch {
      // A receiver cannot poison the channel or another tab's mutation.
    }
  }

  try {
    if (typeof BroadcastChannel !== 'undefined' || options.channelFactory) {
      channel = factory(CHANNEL_NAME)
      channel.addEventListener('message', handleMessage)
    }
  } catch {
    channel = undefined
  }

  return {
    publish(kind) {
      if (closed || !channel) return
      try {
        channel.postMessage({ version: 1, vaultId, kind })
      } catch {
        // Unsupported/closed channels are an optional optimization only.
      }
    },
    close() {
      if (closed) return
      closed = true
      if (!channel) return
      try {
        channel.removeEventListener('message', handleMessage)
        channel.close()
      } catch {
        // Cleanup is best effort when a browser has already disposed the tab.
      }
      channel = undefined
    },
  }
}
