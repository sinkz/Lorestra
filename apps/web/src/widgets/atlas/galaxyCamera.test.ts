import { describe, expect, it } from 'vitest'
import {
  defaultCamera,
  moveCamera,
  panCamera,
  projectPoint,
  zoomCamera,
} from './galaxyCamera'

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
  it('pans by exact screen pixels after rotation and zoom without changing scale or orientation', () => {
    const start = moveCamera(defaultCamera(), 0.7, 0.4, 2.3)
    const panned = panCamera(start, 185, -73, viewport)
    expect(panned).toMatchObject({
      yaw: start.yaw,
      pitch: start.pitch,
      zoom: start.zoom,
    })
    expect(start).toMatchObject({ panX: 0, panY: 0 })
    for (const point of [
      { x: 240, y: 110, z: 130 },
      { x: -110, y: -65, z: -300 },
    ]) {
      const before = projectPoint(point, start, viewport)
      const after = projectPoint(point, panned, viewport)
      expect(after.x - before.x).toBeCloseTo(185, 10)
      expect(after.y - before.y).toBeCloseTo(-73, 10)
      expect(after.z).toBe(before.z)
      expect(after.scale).toBe(before.scale)
    }
  })
  it('preserves normalized offsets through rotation and resets them with the default camera', () => {
    const panned = panCamera(defaultCamera(), 120, -80, viewport)
    const rotated = moveCamera(panned, 0.4, -0.2, 1.2)
    expect(rotated.panX).toBe(panned.panX)
    expect(rotated.panY).toBe(panned.panY)
    const resized = { ...viewport, width: 600, height: 400 }
    const origin = projectPoint({ x: 0, y: 0, z: 0 }, rotated, resized)
    expect(origin.x).toBe(360)
    expect(origin.y).toBe(160)
    expect(defaultCamera()).toEqual({
      yaw: 0.12,
      pitch: -0.22,
      zoom: 1,
      panX: 0,
      panY: 0,
    })
  })
  it('keeps the anchor fixed through zoom with existing pan, rotation, and the scene offset', () => {
    const point = { x: 240, y: 110, z: 130 }
    const start = panCamera(
      moveCamera(defaultCamera(), 0.7, 0.4, 1.3),
      100,
      -75,
      viewport,
    )
    const before = projectPoint(point, start, viewport)
    const visibleAnchor = { x: before.x, y: before.y - 20 }
    const zoomed = zoomCamera(start, 1.7, viewport, {
      x: visibleAnchor.x,
      y: visibleAnchor.y + 20,
    })
    const after = projectPoint(point, zoomed, viewport)
    expect(after.x).toBeCloseTo(visibleAnchor.x, 10)
    expect(after.y - 20).toBeCloseTo(visibleAnchor.y, 10)
    expect(after.scale / before.scale).toBeCloseTo(1.7, 10)
    expect(zoomed.yaw).toBe(start.yaw)
    expect(zoomed.pitch).toBe(start.pitch)
    expect(after.z).toBe(before.z)
  })
  it('uses the viewport center when zoom has no explicit anchor', () => {
    const start = panCamera(defaultCamera(), 120, -80, viewport)
    const zoomed = zoomCamera(start, 2, viewport)
    expect(zoomed).toMatchObject({ zoom: 2, panX: 0.2, panY: -0.2 })
    const point = { x: 240, y: 110, z: 130 }
    const before = projectPoint(point, start, viewport)
    const after = projectPoint(point, zoomed, viewport)
    expect(after.x - viewport.width / 2).toBeCloseTo(
      (before.x - viewport.width / 2) * 2,
      10,
    )
    expect(after.y - viewport.height / 2).toBeCloseTo(
      (before.y - viewport.height / 2) * 2,
      10,
    )
  })
  it('uses clamped zoom for anchoring and does not drift at either zoom limit', () => {
    const point = { x: 240, y: 110, z: 130 }
    const start = panCamera(
      moveCamera(defaultCamera(), 0.7, 0.4, 2.9),
      100,
      -75,
      viewport,
    )
    const anchor = projectPoint(point, start, viewport)
    for (const [factor, zoom] of [
      [100, 3],
      [0.001, 0.45],
    ]) {
      const bounded = zoomCamera(start, factor, viewport, anchor)
      expect(bounded.zoom).toBe(zoom)
      const projection = projectPoint(point, bounded, viewport)
      expect(projection.x).toBeCloseTo(anchor.x, 10)
      expect(projection.y).toBeCloseTo(anchor.y, 10)
      let repeated = bounded
      for (let i = 0; i < 100; i += 1) {
        repeated = zoomCamera(repeated, factor, viewport, { x: 50, y: 60 })
      }
      expect(repeated).toBe(bounded)
    }
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
    const start = panCamera(defaultCamera(), 100, -50, viewport)
    for (const empty of [
      { width: 0, height: 400 },
      { width: 400, height: 0 },
      { width: 0, height: 0 },
    ]) {
      expect(panCamera(start, 100, 100, empty)).toBe(start)
      expect(zoomCamera(start, 2, empty)).toBe(start)
      const projection = projectPoint({ x: 0, y: 0, z: 0 }, start, {
        ...empty,
        extent: 0,
      })
      expect(Object.values(projection).every(Number.isFinite)).toBe(true)
    }
  })
})
