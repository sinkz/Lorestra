import type { CelestialBodyKind } from './celestialBodies'

/** Shared deterministic motion phase; zero is also the reduced-motion pose. */
export function bodyMotion(kind: CelestialBodyKind, index: number, time: number) {
  const phase = index * 1.73
  return {
    x: (Math.sin(time * 0.00038 + phase) - Math.sin(phase)) * 1.25,
    y: (Math.sin(time * 0.00052 + phase) - Math.sin(phase)) * 2.4,
    scale: kind === 'star' ? 1 + Math.sin(time * 0.002) * 0.035 : 1,
    tilt: kind === 'satellite' ? (time * 0.00011) % (Math.PI * 2) : 0,
  }
}

/** Selection must not lose its procedural animation to distant background bodies. */
export function liveBodyIds(
  candidates: {
    id: string
    kind: CelestialBodyKind
    radius: number
    depth: number
    visible: boolean
  }[],
  selected: string | null,
  hovered: string | null,
) {
  return new Set(
    candidates
      .filter(
        (body) =>
          body.visible &&
          body.radius >= 7 &&
          (body.kind === 'star' || body.kind === 'blackhole'),
      )
      .sort(
        (a, b) =>
          Number(b.id === selected) - Number(a.id === selected) ||
          Number(b.id === hovered) - Number(a.id === hovered) ||
          a.depth - b.depth,
      )
      .slice(0, 12)
      .map((body) => body.id),
  )
}

/** Elapsed scene time excludes pauses, hidden-tab time, and long suspended frames. */
export function createMotionClock() {
  let time = 0
  let last: number | null = null
  return {
    get time() {
      return time
    },
    tick(now: number) {
      if (last !== null) time += Math.max(0, Math.min(80, now - last))
      last = now
      return time
    },
    suspend() {
      last = null
    },
  }
}
