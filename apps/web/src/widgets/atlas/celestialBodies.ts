import type { GraphSnapshot } from '../../shared/model/types'

export type CelestialBodyKind =
  'star' | 'planet' | 'moon' | 'ringed' | 'comet' | 'satellite' | 'blackhole'

const colors: Record<CelestialBodyKind, string> = {
  star: '#d3f56a',
  planet: '#85d9c0',
  moon: '#b7d6e2',
  ringed: '#edc081',
  comet: '#ef9990',
  satellite: '#83c8ec',
  blackhole: '#c6b1e9',
}

export function bodyKind(node: GraphSnapshot['nodes'][number]): CelestialBodyKind {
  if (node.kind === 'folder') return 'star'
  if (node.status === 'archived') return 'blackhole'
  switch (node.kind) {
    case 'decision':
      return 'ringed'
    case 'incident':
      return 'comet'
    case 'runbook':
    case 'process':
      return 'satellite'
    case 'note':
      return 'moon'
    default:
      return 'planet'
  }
}

export function bodyColor(kind: CelestialBodyKind): string {
  return colors[kind]
}

interface BodyOptions {
  kind: CelestialBodyKind
  radius: number
  seed: string
  /** Milliseconds; pass a fixed value when motion is reduced or rendering a cache. */
  time: number
  detailed: boolean
  satellite?: CanvasImageSource
}

const tau = Math.PI * 2

function seedValue(seed: string, salt = 0): number {
  let value = 19 + salt * 97
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 31 + seed.charCodeAt(i)) % 104729
  }
  return value / 104729
}

function circle(ctx: CanvasRenderingContext2D, radius: number) {
  ctx.beginPath()
  ctx.arc(0, 0, radius, 0, tau)
}

/** Draws around the current origin. The widest glow/tail fits within 4.2 × radius. */
export function drawCelestialBody(
  ctx: CanvasRenderingContext2D,
  options: BodyOptions,
): void {
  if (!Number.isFinite(options.radius) || options.radius <= 0) return
  ctx.save()
  try {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    switch (options.kind) {
      case 'star':
        drawStar(ctx, options)
        break
      case 'moon':
        drawMoon(ctx, options)
        break
      case 'ringed':
        drawRingedPlanet(ctx, options)
        break
      case 'comet':
        drawComet(ctx, options)
        break
      case 'satellite':
        drawSatellite(ctx, options)
        break
      case 'blackhole':
        drawBlackHole(ctx, options)
        break
      default:
        drawPlanet(ctx, options)
    }
  } finally {
    ctx.restore()
  }
}

function drawStar(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, seed, time, detailed } = options
  const pulse = 1 + Math.sin(time * 0.0016) * 0.02
  ctx.scale(pulse, pulse)
  const halo = ctx.createRadialGradient(0, 0, size * 0.08, 0, 0, size * 2.65)
  halo.addColorStop(0, 'rgba(247,255,190,.9)')
  halo.addColorStop(0.24, 'rgba(211,245,106,.42)')
  halo.addColorStop(0.58, 'rgba(137,196,74,.1)')
  halo.addColorStop(1, 'rgba(211,245,106,0)')
  ctx.fillStyle = halo
  circle(ctx, size * 2.65)
  ctx.fill()

  if (detailed) {
    ctx.save()
    ctx.rotate(time * 0.000025)
    for (let ray = 0; ray < 14; ray += 1) {
      const angle = (ray / 14) * tau
      const length = size * (1.3 + seedValue(seed, ray) * 0.6)
      const gradient = ctx.createLinearGradient(
        Math.cos(angle) * size * 0.78,
        Math.sin(angle) * size * 0.78,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
      )
      gradient.addColorStop(0, 'rgba(239,255,169,.36)')
      gradient.addColorStop(1, 'rgba(211,245,106,0)')
      ctx.strokeStyle = gradient
      ctx.lineWidth = Math.max(0.7, size * 0.026)
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * size * 0.78, Math.sin(angle) * size * 0.78)
      ctx.quadraticCurveTo(
        Math.cos(angle + 0.09) * size * 1.18,
        Math.sin(angle + 0.09) * size * 1.18,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
      )
      ctx.stroke()
    }
    ctx.restore()
  }

  const body = ctx.createRadialGradient(
    -size * 0.32,
    -size * 0.36,
    size * 0.04,
    0,
    0,
    size,
  )
  body.addColorStop(0, '#ffffff')
  body.addColorStop(0.16, '#f1ffaf')
  body.addColorStop(0.5, colors.star)
  body.addColorStop(0.82, '#8eb838')
  body.addColorStop(1, '#405918')
  ctx.fillStyle = body
  circle(ctx, size)
  ctx.fill()
  if (detailed) {
    ctx.save()
    ctx.clip()
    ctx.fillStyle = 'rgba(255,255,214,.16)'
    for (let grain = 0; grain < 18; grain += 1) {
      const angle = seedValue(seed, grain) * tau
      const distance = Math.sqrt(seedValue(seed, grain + 31)) * size * 0.9
      ctx.beginPath()
      ctx.arc(
        Math.cos(angle) * distance,
        Math.sin(angle) * distance,
        size * (0.012 + seedValue(seed, grain + 67) * 0.028),
        0,
        tau,
      )
      ctx.fill()
    }
    ctx.restore()
  }
  ctx.strokeStyle = 'rgba(246,255,210,.48)'
  ctx.lineWidth = Math.max(0.7, size * 0.025)
  circle(ctx, size)
  ctx.stroke()
}

function drawPlanet(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, seed, kind, detailed } = options
  const warm = kind === 'ringed' || kind === 'comet'
  ctx.save()
  circle(ctx, size)
  ctx.clip()
  const sphere = ctx.createRadialGradient(
    -size * 0.38,
    -size * 0.42,
    size * 0.04,
    size * 0.12,
    size * 0.08,
    size * 1.18,
  )
  sphere.addColorStop(0, warm ? '#fff0cf' : '#d5fff0')
  sphere.addColorStop(0.16, colors[kind])
  sphere.addColorStop(0.52, warm ? '#865b40' : '#2f6872')
  sphere.addColorStop(0.78, warm ? '#382b27' : '#15333a')
  sphere.addColorStop(1, '#02090c')
  ctx.fillStyle = sphere
  ctx.fillRect(-size, -size, size * 2, size * 2)

  if (detailed) {
    for (let mark = 0; mark < 8; mark += 1) {
      const noise = seedValue(seed, mark)
      const angle = noise * tau + mark * 1.17
      const distance = size * (0.12 + seedValue(seed, mark + 11) * 0.5)
      ctx.fillStyle =
        mark % 2 === 0
          ? warm
            ? 'rgba(255,221,174,.18)'
            : 'rgba(183,237,201,.22)'
          : 'rgba(7,28,37,.22)'
      ctx.beginPath()
      ctx.ellipse(
        Math.cos(angle) * distance - size * 0.08,
        Math.sin(angle) * distance,
        size * (0.1 + noise * 0.15),
        size * (0.045 + seedValue(seed, mark + 23) * 0.07),
        angle * 0.35,
        0,
        tau,
      )
      ctx.fill()
    }
    ctx.strokeStyle = warm ? 'rgba(255,230,191,.23)' : 'rgba(217,255,240,.16)'
    ctx.lineWidth = Math.max(0.5, size * 0.018)
    for (let band = -2; band <= 2; band += 1) {
      ctx.beginPath()
      ctx.ellipse(
        0,
        band * size * 0.23,
        size * 0.94,
        size * 0.12,
        -0.08,
        0.1,
        Math.PI - 0.1,
      )
      ctx.stroke()
    }
  }

  const shade = ctx.createLinearGradient(-size * 0.7, -size * 0.2, size, size * 0.18)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(0.48, 'rgba(0,0,0,.03)')
  shade.addColorStop(0.78, 'rgba(1,7,12,.48)')
  shade.addColorStop(1, 'rgba(1,5,10,.86)')
  ctx.fillStyle = shade
  ctx.fillRect(-size, -size, size * 2, size * 2)
  ctx.restore()

  ctx.save()
  ctx.strokeStyle = warm ? 'rgba(255,220,177,.42)' : 'rgba(144,224,224,.58)'
  ctx.shadowColor = colors[kind]
  ctx.shadowBlur = detailed ? Math.min(12, size * 0.36) : 0
  ctx.lineWidth = Math.max(0.65, size * 0.035)
  circle(ctx, size)
  ctx.stroke()
  ctx.restore()
  if (detailed) {
    ctx.fillStyle = 'rgba(255,255,255,.44)'
    ctx.beginPath()
    ctx.ellipse(-size * 0.32, -size * 0.38, size * 0.13, size * 0.075, -0.55, 0, tau)
    ctx.fill()
  }
}

function drawMoon(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, seed, detailed } = options
  ctx.save()
  circle(ctx, size)
  ctx.clip()
  const sphere = ctx.createRadialGradient(
    -size * 0.38,
    -size * 0.4,
    size * 0.03,
    0,
    0,
    size * 1.08,
  )
  sphere.addColorStop(0, '#f2fbff')
  sphere.addColorStop(0.32, '#9dc8d7')
  sphere.addColorStop(0.72, '#526f7b')
  sphere.addColorStop(1, '#0a141d')
  ctx.fillStyle = sphere
  ctx.fillRect(-size, -size, size * 2, size * 2)
  if (detailed) {
    for (let crater = 0; crater < 7; crater += 1) {
      const angle = seedValue(seed, crater) * tau
      const distance = size * (0.18 + seedValue(seed, crater + 9) * 0.44)
      const radius = size * (0.055 + seedValue(seed, crater + 17) * 0.09)
      const x = Math.cos(angle) * distance - size * 0.07
      const y = Math.sin(angle) * distance
      ctx.fillStyle = 'rgba(26,49,61,.42)'
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, tau)
      ctx.fill()
      ctx.strokeStyle = 'rgba(221,245,250,.36)'
      ctx.lineWidth = Math.max(0.45, size * 0.018)
      ctx.beginPath()
      ctx.arc(x, y, radius, 0.05, Math.PI * 0.9)
      ctx.stroke()
    }
  }
  const shade = ctx.createLinearGradient(-size * 0.25, 0, size, 0)
  shade.addColorStop(0, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,4,11,.78)')
  ctx.fillStyle = shade
  ctx.fillRect(-size, -size, size * 2, size * 2)
  ctx.restore()
  ctx.strokeStyle = 'rgba(196,235,246,.56)'
  ctx.lineWidth = Math.max(0.65, size * 0.03)
  circle(ctx, size)
  ctx.stroke()
}

function drawRingedPlanet(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, detailed } = options
  const rings = ctx.createLinearGradient(-size * 2, 0, size * 2, 0)
  rings.addColorStop(0, 'rgba(115,72,26,.12)')
  rings.addColorStop(0.24, 'rgba(255,205,112,.72)')
  rings.addColorStop(0.53, 'rgba(255,241,196,.9)')
  rings.addColorStop(0.78, 'rgba(220,142,50,.55)')
  rings.addColorStop(1, 'rgba(87,54,22,.08)')
  const drawRings = (front: boolean) => {
    ctx.save()
    ctx.rotate(-0.23)
    ctx.strokeStyle = rings
    ctx.lineWidth = Math.max(1, size * 0.23)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 1.82, size * 0.48, 0, 0, front ? Math.PI : tau)
    ctx.stroke()
    if (detailed) {
      ctx.strokeStyle = 'rgba(255,244,207,.42)'
      ctx.lineWidth = Math.max(0.55, size * 0.035)
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 2.03, size * 0.56, 0, 0, front ? Math.PI : tau)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(20,23,25,.44)'
      ctx.lineWidth = Math.max(0.5, size * 0.025)
      ctx.beginPath()
      ctx.ellipse(0, 0, size * 1.78, size * 0.47, 0, 0, front ? Math.PI : tau)
      ctx.stroke()
    }
    ctx.restore()
  }
  drawRings(false)
  drawPlanet(ctx, options)
  drawRings(true)
}

function drawComet(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, detailed } = options
  ctx.save()
  ctx.rotate(-0.7)
  const tail = ctx.createLinearGradient(-size * 4.2, 0, size, 0)
  tail.addColorStop(0, 'rgba(239,116,110,0)')
  tail.addColorStop(0.68, 'rgba(239,143,129,.24)')
  tail.addColorStop(1, 'rgba(255,215,190,.68)')
  ctx.fillStyle = tail
  ctx.beginPath()
  ctx.moveTo(-size * 4.2, -size * 0.08)
  ctx.quadraticCurveTo(-size * 1.2, -size * 0.72, size * 0.2, 0)
  ctx.quadraticCurveTo(-size * 1.2, size * 0.72, -size * 4.2, size * 0.08)
  ctx.fill()
  if (detailed) {
    ctx.strokeStyle = tail
    ctx.lineWidth = Math.max(0.6, size * 0.045)
    ctx.beginPath()
    ctx.moveTo(-size * 3.8, -size * 0.15)
    ctx.quadraticCurveTo(-size * 1.4, size * 0.04, 0, 0)
    ctx.stroke()
  }
  ctx.restore()
  drawPlanet(ctx, { ...options, radius: size * 0.82 })
}

function drawSatellite(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, satellite, detailed } = options
  ctx.rotate(-0.18)
  if (satellite) {
    // The asset viewBox is 256 × 176. Match aspect ratio instead of stretching it.
    ctx.drawImage(satellite, -size * 1.85, -size * 1.272, size * 3.7, size * 2.544)
    return
  }

  // First-paint fallback: use the same silhouette while the bundled SVG decodes.
  ctx.scale(size / 42, size / 42)
  ctx.strokeStyle = '#9bbbc6'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-48, 0)
  ctx.lineTo(48, 0)
  ctx.stroke()
  const panel = ctx.createLinearGradient(-60, -14, 60, 18)
  panel.addColorStop(0, '#4780a8')
  panel.addColorStop(0.5, '#183e60')
  panel.addColorStop(1, '#326b90')
  ctx.fillStyle = panel
  ctx.strokeStyle = '#73adc8'
  ctx.lineWidth = 1.5
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.scale(side, 1)
    ctx.fillRect(27, -19, 39, 38)
    ctx.strokeRect(27, -19, 39, 38)
    if (detailed) {
      ctx.strokeStyle = 'rgba(165,220,244,.48)'
      ctx.lineWidth = 0.7
      ctx.beginPath()
      for (let column = 1; column <= 4; column += 1) {
        ctx.moveTo(27 + column * 7.8, -18)
        ctx.lineTo(27 + column * 7.8, 18)
      }
      for (let row = -1; row <= 1; row += 1) {
        ctx.moveTo(28, row * 9)
        ctx.lineTo(65, row * 9)
      }
      ctx.stroke()
    }
    ctx.restore()
  }
  ctx.fillStyle = '#71929d'
  ctx.strokeStyle = '#d6e5df'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(-15, -14)
  ctx.lineTo(3, -25)
  ctx.lineTo(20, -13)
  ctx.lineTo(17, 19)
  ctx.lineTo(-2, 28)
  ctx.lineTo(-18, 15)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#d5d8bb'
  ctx.beginPath()
  ctx.moveTo(-15, -14)
  ctx.lineTo(3, -25)
  ctx.lineTo(20, -13)
  ctx.lineTo(0, -3)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#354e5e'
  ctx.beginPath()
  ctx.moveTo(0, -3)
  ctx.lineTo(20, -13)
  ctx.lineTo(17, 19)
  ctx.lineTo(-2, 28)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = '#bdd4d9'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(2, -22)
  ctx.lineTo(7, -40)
  ctx.stroke()
  ctx.fillStyle = '#e3eee7'
  ctx.beginPath()
  ctx.ellipse(7, -33, 10, 4, -0.4, 0, Math.PI)
  ctx.fill()
  ctx.fillStyle = '#d3f56a'
  ctx.beginPath()
  ctx.arc(-8, 6, 2, 0, tau)
  ctx.fill()
}

function drawBlackHole(ctx: CanvasRenderingContext2D, options: BodyOptions) {
  const { radius: size, seed, time, detailed } = options
  const tilt = -0.2
  const spin = time * 0.00006
  ctx.save()
  ctx.rotate(tilt)
  ctx.scale(1, 0.38)
  const disk = ctx.createRadialGradient(0, 0, size * 0.32, 0, 0, size * 2.45)
  disk.addColorStop(0, 'rgba(0,0,0,0)')
  disk.addColorStop(0.27, 'rgba(0,0,0,0)')
  disk.addColorStop(0.36, 'rgba(255,252,222,.92)')
  disk.addColorStop(0.43, 'rgba(255,188,82,.88)')
  disk.addColorStop(0.58, 'rgba(222,95,62,.52)')
  disk.addColorStop(0.76, 'rgba(100,117,208,.24)')
  disk.addColorStop(1, 'rgba(28,44,97,0)')
  ctx.fillStyle = disk
  circle(ctx, size * 2.45)
  ctx.fill()
  if (detailed) {
    ctx.rotate(spin)
    for (let streak = 0; streak < 8; streak += 1) {
      const start = seedValue(seed, streak) * tau
      const radius = size * (0.92 + seedValue(seed, streak + 9) * 1.05)
      ctx.strokeStyle =
        streak % 3 === 0 ? 'rgba(174,218,255,.5)' : 'rgba(255,222,151,.48)'
      ctx.lineWidth = Math.max(
        0.5,
        size * (0.025 + seedValue(seed, streak + 21) * 0.035),
      )
      ctx.beginPath()
      ctx.arc(0, 0, radius, start, start + 0.38 + seedValue(seed, streak + 32) * 0.8)
      ctx.stroke()
    }
  }
  ctx.restore()

  const lens = ctx.createRadialGradient(0, 0, size * 0.42, 0, 0, size * 1.42)
  lens.addColorStop(0, 'rgba(0,0,0,0)')
  lens.addColorStop(0.48, 'rgba(0,0,0,0)')
  lens.addColorStop(0.58, 'rgba(162,206,255,.3)')
  lens.addColorStop(0.7, 'rgba(137,106,213,.13)')
  lens.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = lens
  circle(ctx, size * 1.45)
  ctx.fill()
  if (detailed) {
    ctx.save()
    ctx.rotate(tilt)
    ctx.strokeStyle = 'rgba(207,230,255,.48)'
    ctx.lineWidth = Math.max(0.6, size * 0.035)
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 1.08, size * 1.34, 0, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(0, 0, size * 1.08, size * 1.34, 0, Math.PI * 0.1, Math.PI * 0.9)
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = '#010202'
  circle(ctx, size * 0.73)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,234,191,.9)'
  ctx.lineWidth = Math.max(0.8, size * 0.075)
  circle(ctx, size * 0.79)
  ctx.stroke()

  ctx.save()
  ctx.rotate(tilt)
  const foreground = ctx.createLinearGradient(-size * 2, 0, size * 2, 0)
  foreground.addColorStop(0, 'rgba(91,145,230,.12)')
  foreground.addColorStop(0.28, 'rgba(255,178,72,.65)')
  foreground.addColorStop(0.58, 'rgba(255,250,219,.96)')
  foreground.addColorStop(1, 'rgba(218,87,57,.18)')
  ctx.strokeStyle = foreground
  ctx.shadowColor = 'rgba(255,173,75,.68)'
  ctx.shadowBlur = detailed ? Math.min(12, size * 0.42) : 0
  ctx.lineWidth = Math.max(1, size * 0.17)
  ctx.beginPath()
  ctx.ellipse(0, 0, size * 1.78, size * 0.44, 0, 0, Math.PI)
  ctx.stroke()
  ctx.restore()
}
