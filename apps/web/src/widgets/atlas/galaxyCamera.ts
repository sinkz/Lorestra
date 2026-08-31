export type Camera = {
  yaw: number
  pitch: number
  zoom: number
  /** Screen-space displacement as a fraction of the viewport dimensions. */
  panX: number
  panY: number
}
export type Point3 = { x: number; y: number; z: number }
type Viewport = { width: number; height: number }

const clampZoom = (zoom: number) => Math.max(0.45, Math.min(3, zoom))

function hasViewport(viewport: Viewport) {
  return (
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height) &&
    viewport.width > 0 &&
    viewport.height > 0
  )
}

export function defaultCamera(): Camera {
  return { yaw: 0.12, pitch: -0.22, zoom: 1, panX: 0, panY: 0 }
}

export function moveCamera(camera: Camera, yaw = 0, pitch = 0, zoom = 1): Camera {
  return {
    ...camera,
    yaw: (((camera.yaw + yaw) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
    pitch: Math.max(-1.05, Math.min(1.05, camera.pitch + pitch)),
    zoom: clampZoom(camera.zoom * zoom),
  }
}

export function panCamera(
  camera: Camera,
  dx: number,
  dy: number,
  viewport: Viewport,
): Camera {
  if (!hasViewport(viewport) || !Number.isFinite(dx) || !Number.isFinite(dy)) {
    return camera
  }
  return {
    ...camera,
    panX: camera.panX + dx / viewport.width,
    panY: camera.panY + dy / viewport.height,
  }
}

/** Keep the projected position beneath the anchor fixed, using the actual zoom delta. */
export function zoomCamera(
  camera: Camera,
  factor: number,
  viewport: Viewport,
  anchor = { x: viewport.width / 2, y: viewport.height / 2 },
): Camera {
  if (
    !hasViewport(viewport) ||
    !Number.isFinite(factor) ||
    factor <= 0 ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y)
  ) {
    return camera
  }
  const zoom = clampZoom(camera.zoom * factor)
  if (zoom === camera.zoom) return camera
  const ratio = zoom / camera.zoom
  return {
    ...camera,
    zoom,
    panX: camera.panX * ratio + (anchor.x / viewport.width - 0.5) * (1 - ratio),
    panY: camera.panY * ratio + (anchor.y / viewport.height - 0.5) * (1 - ratio),
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
    x: viewport.width * (0.5 + camera.panX) + x * scale,
    y: viewport.height * (0.5 + camera.panY) + y * scale,
    z,
    scale,
  }
}
