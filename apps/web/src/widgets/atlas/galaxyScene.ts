import type { GraphSnapshot } from '../../shared/model/types'
import { bodyColor, bodyKind, drawCelestialBody } from './celestialBodies'
import { defaultCamera, moveCamera, projectPoint } from './galaxyCamera'
import type { layoutGalaxies } from './galaxyLayout'

type Layout = ReturnType<typeof layoutGalaxies>
type Options = {
  canvas: HTMLCanvasElement
  container: HTMLDivElement
  targets: Map<string, HTMLButtonElement>
  graph: GraphSnapshot
  layout: Layout
}

/** Imperative scene lifetime: no React updates for pointer movement or animation. */
export function createGalaxyScene({
  canvas,
  container,
  targets,
  graph,
  layout,
}: Options) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  let camera = defaultCamera()
  let width = 1
  let height = 1
  let fit = 1
  let spread = 1
  let frame = 0
  let lastPaint = 0
  let destroyed = false
  let moving = true
  let selected: string | null = null
  let hovered: string | null = null
  const backdrop = document.createElement('canvas')
  const backdropContext = backdrop.getContext('2d')!
  let routes: {
    a: { x: number; y: number }
    b: { x: number; y: number }
    mid: { x: number; y: number }
  }[] = []
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const positionById = new Map(layout.nodes.map((node) => [node.id, node]))
  const galaxiesById = new Map(layout.galaxies.map((galaxy) => [galaxy.id, galaxy]))
  const edgeById = new Map(layout.edges.map((edge) => [edge.id, edge]))
  const neighbors = new Map<string, Set<string>>()
  for (const edge of layout.edges) {
    for (const [from, to] of [
      [edge.source, edge.target],
      [edge.target, edge.source],
    ]) {
      const set = neighbors.get(from) ?? new Set<string>()
      set.add(to)
      neighbors.set(from, set)
    }
  }
  const textures = new Map<
    string,
    { image: HTMLCanvasElement; detailed: boolean; span: number }
  >()
  const satellite = new Image()
  satellite.onload = () => {
    if (destroyed) return
    textures.clear()
    invalidate()
  }
  satellite.src = new URL('./assets/satellite.svg', import.meta.url).href

  function texture(id: string, detailed: boolean) {
    const node = nodeById.get(id)!
    const kind = bodyKind(node)
    const span =
      kind === 'comet'
        ? 9
        : kind === 'star'
          ? 6
          : kind === 'planet' || kind === 'moon'
            ? 3
            : 5.5
    let cached = textures.get(id)
    if (!cached || cached.detailed !== detailed) {
      const image = document.createElement('canvas')
      // One bounded texture per node: < 13 MiB even at the 200-node contract limit.
      image.width = image.height = detailed ? 128 : 64
      const context = image.getContext('2d')!
      context.translate(image.width / 2, image.height / 2)
      drawCelestialBody(context, {
        kind,
        radius: image.width / span,
        seed: id,
        time: 0,
        detailed,
        satellite: satellite.complete && satellite.naturalWidth ? satellite : undefined,
      })
      cached = { image, detailed, span }
      textures.set(id, cached)
    }
    return cached
  }

  function project(point: { x: number; y: number; z: number }) {
    const projected = projectPoint({ ...point, x: point.x * spread }, camera, {
      width,
      height,
      extent: layout.extent * spread,
      fit,
    })
    return { ...projected, y: projected.y - 20 }
  }

  function screenRadius(node: Layout['nodes'][number], scale: number) {
    const minimum =
      layout.nodes.length > 60 ? (node.isHub ? 9 : 3) : node.isHub ? 17 : 6
    return Math.max(
      node.id === selected || node.id === hovered ? 14 : minimum,
      node.radius * scale,
    )
  }

  function draw(time: number) {
    if (!ctx || destroyed) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#071411'
    ctx.fillRect(0, 0, width, height)
    // Stable starfield: no random flickering or additional DOM nodes.
    for (let i = 1; i <= 100; i += 1) {
      ctx.fillStyle = i % 9 === 0 ? '#98b9b2' : '#36534b'
      ctx.beginPath()
      ctx.arc(
        (i * 193.7) % width,
        (i * 89.3) % height,
        i % 9 === 0 ? 1 : 0.55,
        0,
        Math.PI * 2,
      )
      ctx.fill()
    }
    const projected = new Map(layout.nodes.map((node) => [node.id, project(node)]))
    routes = []

    for (const galaxy of layout.galaxies) {
      const center = project(galaxy)
      const r = Math.max(1, galaxy.radius * center.scale)
      const haze = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        r * 1.25,
      )
      haze.addColorStop(0, 'rgba(73,139,110,0.10)')
      haze.addColorStop(0.65, 'rgba(50,104,91,0.045)')
      haze.addColorStop(1, 'rgba(50,104,91,0)')
      ctx.fillStyle = haze
      ctx.fillRect(center.x - r * 1.25, center.y - r * 1.25, r * 2.5, r * 2.5)
      if (galaxy.nodeIds.length > 1) {
        ctx.beginPath()
        ctx.ellipse(
          center.x,
          center.y,
          r * spread,
          r * 0.72,
          -0.18 + camera.pitch * 0.3,
          0,
          Math.PI * 2,
        )
        ctx.strokeStyle = 'rgba(119,180,158,0.12)'
        ctx.setLineDash([2, 8])
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // A corridor is a bundle of actual cross-community edges, not a synthetic link.
    for (const bridge of layout.bridges) {
      const sourceGalaxy = galaxiesById.get(bridge.sourceGalaxy)!
      const targetGalaxy = galaxiesById.get(bridge.targetGalaxy)!
      const a = project(sourceGalaxy)
      const b = project(targetGalaxy)
      const bend = Math.min(85, Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
      const mid = { x: (a.x + b.x) / 2 - (b.y - a.y) * 0.1, y: (a.y + b.y) / 2 - bend }
      for (const id of bridge.edgeIds) {
        const edge = edgeById.get(id)!
        const p = projected.get(edge.source)!
        const q = projected.get(edge.target)!
        const active = selected === edge.source || selected === edge.target
        if (active) routes.push({ a: p, b: q, mid })
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.quadraticCurveTo(mid.x, mid.y, q.x, q.y)
        ctx.strokeStyle = active
          ? 'rgba(219,238,153,0.8)'
          : selected
            ? 'rgba(117,167,164,0.06)'
            : 'rgba(139,189,194,0.26)'
        ctx.lineWidth = active ? 1.5 : 0.7
        ctx.setLineDash(
          edge.relation === 'contains' || edge.relation === 'suggested' ? [3, 6] : [],
        )
        ctx.stroke()
        if (active && !media.matches && moving) {
          ctx.strokeStyle = '#e2f4bd'
          ctx.setLineDash([3, 32])
          ctx.lineDashOffset = -time * 0.015
          ctx.stroke()
          ctx.lineDashOffset = 0
        }
        ctx.setLineDash([])
      }
      // Small waypoints make the space between communities readable as a bridge.
      if (
        !selected ||
        bridge.edgeIds.some((id) => {
          const edge = edgeById.get(id)!
          return edge.source === selected || edge.target === selected
        })
      ) {
        ctx.save()
        ctx.translate((a.x + 2 * mid.x + b.x) / 4, (a.y + 2 * mid.y + b.y) / 4)
        ctx.rotate(Math.PI / 4)
        ctx.strokeStyle = '#80ada6'
        ctx.lineWidth = 0.8
        ctx.strokeRect(-2.5, -2.5, 5, 5)
        ctx.restore()
      }
    }
    for (const edge of layout.edges) {
      const source = positionById.get(edge.source)!
      const target = positionById.get(edge.target)!
      if (source.galaxyId !== target.galaxyId) continue
      const a = projected.get(source.id)!
      const b = projected.get(target.id)!
      const active = selected === source.id || selected === target.id
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.quadraticCurveTo((a.x + b.x) / 2 + 10, (a.y + b.y) / 2 - 12, b.x, b.y)
      ctx.strokeStyle = active
        ? '#adc77c'
        : selected
          ? 'rgba(117,174,151,0.07)'
          : 'rgba(117,174,151,0.24)'
      ctx.lineWidth = active ? 1.3 : 0.7
      ctx.setLineDash(
        edge.relation === 'contains' || edge.relation === 'suggested' ? [2, 5] : [],
      )
      ctx.stroke()
      ctx.setLineDash([])
    }

    const occupied: { x: number; y: number; width: number }[] = []
    const ordered = [...layout.nodes].sort(
      (a, b) => projected.get(b.id)!.z - projected.get(a.id)!.z,
    )
    for (const node of ordered) {
      const p = projected.get(node.id)!
      const r = screenRadius(node, p.scale)
      const visible =
        p.x + r * 3 > 0 &&
        p.x - r * 3 < width &&
        p.y + r * 3 > 0 &&
        p.y - r * 3 < height
      const target = targets.get(node.id)
      if (target) {
        target.style.display = visible ? '' : 'none'
        target.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`
        target.style.width =
          target.style.height = `${Math.max(24, Math.min(110, r * 2.4))}px`
        target.style.zIndex = String(Math.round(1000 - p.z * 0.1))
        target.dataset.screenX = String(p.x)
        target.dataset.screenY = String(p.y)
      }
      if (!visible) continue
      const active = node.id === selected || node.id === hovered
      const dim =
        selected !== null &&
        node.id !== selected &&
        !neighbors.get(selected)?.has(node.id)
      ctx.globalAlpha = dim ? 0.22 : 1
      const { image, span } = texture(node.id, active || r > 7)
      ctx.drawImage(
        image,
        p.x - (r * span) / 2,
        p.y - (r * span) / 2,
        r * span,
        r * span,
      )
      if (active) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, r + 7, 0, Math.PI * 2)
        ctx.strokeStyle = bodyColor(bodyKind(nodeById.get(node.id)!))
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }
    // Label priority: selection, hubs, then nearby readable bodies. Hover always wins.
    const labelOrder = [...layout.nodes].sort(
      (a, b) =>
        Number(b.id === selected || b.id === hovered) -
          Number(a.id === selected || a.id === hovered) ||
        Number(b.isHub) - Number(a.isHub),
    )
    for (const node of labelOrder) {
      const p = projected.get(node.id)!
      const target = targets.get(node.id)
      if (!target) continue
      const dim =
        selected !== null &&
        node.id !== selected &&
        !neighbors.get(selected)?.has(node.id)
      const labelWidth = Math.min(152, nodeById.get(node.id)!.label.length * 6.5 + 12)
      const r = screenRadius(node, p.scale)
      const galaxy = galaxiesById.get(node.galaxyId)!
      const offset =
        node.isHub && galaxy.nodeIds.length > 1
          ? Math.max(r * 1.2 + 9, galaxy.radius * p.scale * 0.8 + 12)
          : Math.max(12, r * 1.2) + 9
      const y = p.y + offset
      target.style.setProperty(
        '--label-offset',
        `${Math.max(24, Math.min(110, r * 2.4)) / 2 + offset}px`,
      )
      const active = node.id === selected || node.id === hovered
      const collidesWithBody = layout.nodes.some((other) => {
        if (other.id === node.id) return false
        const otherPoint = projected.get(other.id)!
        const otherRadius = screenRadius(other, otherPoint.scale) + 5
        return (
          Math.abs(otherPoint.y - (y + 7)) < otherRadius + 7 &&
          Math.abs(otherPoint.x - p.x) < otherRadius + labelWidth / 2
        )
      })
      const collidesWithLabel = occupied.some(
        (box) =>
          Math.abs(box.y - y) < 23 &&
          Math.abs(box.x - p.x) < (box.width + labelWidth) / 2 + 8,
      )
      const shown =
        active ||
        (!dim && !collidesWithLabel && (node.isHub || (!collidesWithBody && r >= 6)))
      target.dataset.labelVisible = String(shown)
      target.dataset.dimmed = String(dim)
      if (shown) occupied.push({ x: p.x, y, width: labelWidth })
    }
    container.dataset.yaw = camera.yaw.toFixed(4)
    container.dataset.pitch = camera.pitch.toFixed(4)
    container.dataset.zoom = camera.zoom.toFixed(4)
  }

  function animate(time: number) {
    frame = 0
    if (destroyed || document.hidden) return
    if (time - lastPaint >= 40) {
      // Restore a static layer; animation never recalculates layout or rewrites hit targets.
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0)
      ctx!.drawImage(backdrop, 0, 0, width, height)
      const travelers = routes.slice(0, 30)
      for (const [index, route] of travelers.entries()) {
        const progress = (time * 0.00006 + index * 0.13) % 1
        const back = 1 - progress
        const x =
          back * back * route.a.x +
          2 * back * progress * route.mid.x +
          progress * progress * route.b.x
        const y =
          back * back * route.a.y +
          2 * back * progress * route.mid.y +
          progress * progress * route.b.y
        ctx!.fillStyle = '#cce9af'
        ctx!.beginPath()
        ctx!.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx!.fill()
      }
      // Sparse orbit dust supplies restrained life without moving selectable bodies.
      for (const [index, galaxy] of layout.galaxies.slice(0, 16).entries()) {
        if (galaxy.nodeIds.length < 2) continue
        const p = project(galaxy)
        const angle = time * 0.000025 + index * 1.7
        const r = galaxy.radius * p.scale * 0.87
        ctx!.fillStyle = 'rgba(161,206,182,0.45)'
        ctx!.beginPath()
        ctx!.arc(
          p.x + Math.cos(angle) * r,
          p.y + Math.sin(angle) * r * 0.72,
          1,
          0,
          Math.PI * 2,
        )
        ctx!.fill()
      }
      lastPaint = time
    }
    if (moving && !media.matches) frame = requestAnimationFrame(animate)
  }
  function invalidate() {
    if (destroyed) return
    draw(0)
    backdropContext.setTransform(1, 0, 0, 1, 0, 0)
    backdropContext.drawImage(canvas, 0, 0)
    if (!frame && moving && !media.matches && !document.hidden)
      frame = requestAnimationFrame(animate)
  }
  function resize() {
    width = Math.max(1, container.clientWidth)
    height = Math.max(1, container.clientHeight)
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    backdrop.width = canvas.width
    backdrop.height = canvas.height
    const neutral = defaultCamera()
    const rawX = Math.max(
      100,
      ...layout.nodes.map((node) => Math.abs(node.x) + node.radius + 35),
    )
    const rawY = Math.max(
      100,
      ...layout.nodes.map((node) => Math.abs(node.y) + node.radius + 35),
    )
    spread = Math.max(
      1,
      Math.min(3, (((width - 100) / Math.max(100, height - 160)) * rawY) / rawX),
    )
    const bounds = layout.nodes.map((node) => {
      const p = projectPoint({ ...node, x: node.x * spread }, neutral, {
        width: 0,
        height: 0,
        extent: layout.extent * spread,
        fit: 1,
      })
      return { x: p.x, y: p.y, r: (node.radius + 35) * p.scale }
    })
    const xExtent = Math.max(100, ...bounds.map((p) => Math.abs(p.x) + p.r))
    const yExtent = Math.max(100, ...bounds.map((p) => Math.abs(p.y) + p.r))
    fit = Math.max(
      0.001,
      Math.min((width - 80) / (xExtent * 2), (height - 140) / (yExtent * 2)),
    )
    invalidate()
  }
  function activityChanged() {
    cancelAnimationFrame(frame)
    frame = 0
    if (!document.hidden) invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  document.addEventListener('visibilitychange', activityChanged)
  media.addEventListener('change', activityChanged)
  resize()

  return {
    rotate(yaw: number, pitch = 0) {
      camera = moveCamera(camera, yaw, pitch)
      invalidate()
    },
    zoom(factor: number) {
      camera = moveCamera(camera, 0, 0, factor)
      invalidate()
    },
    reset() {
      camera = defaultCamera()
      invalidate()
    },
    select(id: string | null) {
      selected = id
      invalidate()
    },
    hover(id: string | null) {
      hovered = id
      invalidate()
    },
    motion(enabled: boolean) {
      moving = enabled
      activityChanged()
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', activityChanged)
      media.removeEventListener('change', activityChanged)
      satellite.onload = null
      textures.clear()
      backdrop.width = backdrop.height = 0
    },
  }
}
