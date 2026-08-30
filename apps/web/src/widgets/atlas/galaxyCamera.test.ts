import { describe, expect, it } from 'vitest'
import { defaultCamera, moveCamera, projectPoint } from './galaxyCamera'

describe('celestial camera', () => {
  const viewport = { width: 1200, height: 800, extent: 600 }
  it('centers the origin and preserves equal horizontal and vertical body scale', () => {
    const origin = projectPoint({ x: 0, y: 0, z: 0 }, defaultCamera(), viewport)
    expect(origin.x).toBe(600)
    expect(origin.y).toBe(400)
    expect(origin.scale).toBeGreaterThan(0)
  })
  it('rotates a spatial point and bounds zoom and pitch to safe ranges', () => {
    const start = defaultCamera()
    const point = { x: 240, y: 110, z: 130 }
    expect(projectPoint(point, moveCamera(start, 0.4), viewport)).not.toEqual(
      projectPoint(point, start, viewport),
    )
    expect(moveCamera(start, 100, 100, 100)).toMatchObject({ pitch: 1.05, zoom: 3 })
    expect(moveCamera(start, -100, -100, 0.001)).toMatchObject({
      pitch: -1.05,
      zoom: 0.45,
    })
    expect(defaultCamera()).toEqual(start)
  })
  it('stays finite for empty and narrow viewports', () => {
    for (const width of [0, 320]) {
      const projection = projectPoint({ x: 0, y: 0, z: 0 }, defaultCamera(), {
        width,
        height: 400,
        extent: 0,
      })
      expect(Object.values(projection).every(Number.isFinite)).toBe(true)
    }
  })
})
