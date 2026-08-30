export type Camera = { yaw: number; pitch: number; zoom: number }
export type Point3 = { x: number; y: number; z: number }

export function defaultCamera(): Camera {
  return { yaw: 0.12, pitch: -0.22, zoom: 1 }
}

export function moveCamera(camera: Camera, yaw = 0, pitch = 0, zoom = 1): Camera {
  return {
    yaw: (((camera.yaw + yaw) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: Math.max(-1.05, Math.min(1.05, camera.pitch + pitch)),
    zoom: Math.max(0.45, Math.min(3, camera.zoom * zoom)),
  }
}

export function projectPoint(
  point: Point3,
  camera: Camera,
  viewport: { width: number; height: number; extent: number; fit?: number },
) {
  const x = point.x * Math.cos(camera.yaw) + point.z * Math.sin(camera.yaw)
  const z0 = -point.x * Math.sin(camera.yaw) + point.z * Math.cos(camera.yaw)
  const y = point.y * Math.cos(camera.pitch) - z0 * Math.sin(camera.pitch)
  const z = point.y * Math.sin(camera.pitch) + z0 * Math.cos(camera.pitch)
  const extent = Math.max(100, viewport.extent)
  const perspective = (extent * 5) / Math.max(extent, extent * 5 + z)
  const fit =
    viewport.fit ?? Math.min(viewport.width, viewport.height) / (extent * 2.25)
  const scale = fit * camera.zoom * perspective
  return {
    x: viewport.width / 2 + x * scale,
    y: viewport.height / 2 + y * scale,
    z,
    scale,
  }
}
