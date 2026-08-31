import type { MergeConfirmationRequest, WebMcpInteraction } from './types'

/** One visible decision at a time, scoped to the current registered browser session. */
export function createMergeConfirmationController() {
  const listeners = new Set<() => void>()
  let snapshot: MergeConfirmationRequest | null = null
  let settle: ((confirmed: boolean) => void) | null = null
  const notify = () => listeners.forEach((listener) => listener())

  const confirmMerge: WebMcpInteraction['confirmMerge'] = (input, options) => {
    if (settle || options?.signal?.aborted) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const signal = options?.signal
      const onAbort = () => finish(false)
      const finish = (confirmed: boolean) => {
        if (settle !== finish) return
        signal?.removeEventListener('abort', onAbort)
        settle = null
        snapshot = null
        notify()
        resolve(confirmed && !signal?.aborted)
      }
      settle = finish
      snapshot = Object.freeze({ ...input })
      signal?.addEventListener('abort', onAbort, { once: true })
      notify()
    })
  }

  return {
    confirmMerge,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    respond: (request: MergeConfirmationRequest | null, confirmed: boolean) => {
      if (request && request === snapshot) settle?.(confirmed)
    },
    cancel: () => settle?.(false),
  }
}
