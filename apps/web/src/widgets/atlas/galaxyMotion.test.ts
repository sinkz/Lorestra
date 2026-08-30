import { describe, expect, it } from 'vitest'
import { bodyMotion, createMotionClock, liveBodyIds } from './galaxyMotion'

describe('celestial motion', () => {
  it('has a neutral pose and moves bodies without changing the layout', () => {
    expect(bodyMotion('star', 4, 0)).toEqual({ x: 0, y: 0, scale: 1, tilt: 0 })
    const first = bodyMotion('planet', 4, 200)
    expect(bodyMotion('planet', 4, 1500)).not.toEqual(first)
    expect(bodyMotion('planet', 4, 200)).toEqual(first)
  })
  it('keeps drift, star pulse, and satellite rotation bounded', () => {
    expect(bodyMotion('satellite', 0, 20_000).tilt).toBeCloseTo(2.2)
    for (let time = 0; time < 100000; time += 333) {
      for (const kind of ['planet', 'star', 'satellite'] as const) {
        const pose = bodyMotion(kind, 17, time)
        expect(Math.abs(pose.x)).toBeLessThanOrEqual(2.5)
        expect(Math.abs(pose.y)).toBeLessThanOrEqual(4.8)
        expect(pose.scale).toBeGreaterThanOrEqual(0.965)
        expect(pose.scale).toBeLessThanOrEqual(1.035)
        expect(pose.tilt).toBeGreaterThanOrEqual(0)
        expect(pose.tilt).toBeLessThan(Math.PI * 2)
      }
    }
  })
  it('reserves the bounded live-body budget for selection and hover', () => {
    const bodies = Array.from({ length: 20 }, (_, index) => ({
      id: `body-${index}`,
      kind: 'star' as const,
      depth: index,
      radius: 14,
      visible: true,
    }))
    const live = liveBodyIds(
      [
        ...bodies,
        { id: 'selected', kind: 'blackhole', depth: 200, radius: 20, visible: true },
        { id: 'hidden', kind: 'star', depth: -100, radius: 20, visible: false },
        { id: 'tiny', kind: 'star', depth: -100, radius: 3, visible: true },
      ],
      'selected',
      'body-19',
    )
    expect(live.size).toBe(12)
    expect([...live].slice(0, 3)).toEqual(['selected', 'body-19', 'body-0'])
    expect(live.has('hidden')).toBe(false)
    expect(live.has('tiny')).toBe(false)
  })
  it('resumes from the paused phase and excludes time spent hidden', () => {
    const clock = createMotionClock()
    expect(clock.tick(1000)).toBe(0)
    expect(clock.tick(1040)).toBe(40)
    clock.suspend()
    expect(clock.time).toBe(40)
    expect(clock.tick(80000)).toBe(40)
    expect(clock.tick(80040)).toBe(80)
    expect(clock.tick(90000)).toBe(160)
  })
})
