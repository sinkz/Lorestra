import type { GraphSnapshot } from '../../shared/model/types'

type SourceNode = GraphSnapshot['nodes'][number]
type SourceEdge = GraphSnapshot['edges'][number]

interface GalaxyNodePosition {
  id: string
  x: number
  y: number
  z: number
  radius: number
  degree: number
  galaxyId: string
  isHub: boolean
}

interface GalaxyPosition {
  id: string
  label: string
  hubId: string
  x: number
  y: number
  z: number
  radius: number
  nodeIds: string[]
}

interface GalaxyBridge {
  id: string
  sourceGalaxy: string
  targetGalaxy: string
  edgeIds: string[]
}

interface GalaxyLayout {
  nodes: GalaxyNodePosition[]
  galaxies: GalaxyPosition[]
  bridges: GalaxyBridge[]
  edges: GraphSnapshot['edges']
  extent: number
}

const TAU = Math.PI * 2
const GALAXY_GAP = 135
const BODY_GAP = 34
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/** Pure, input-order-independent layout for the graph contract's bounded 200 nodes. */
export function layoutGalaxies(graph: GraphSnapshot): GalaxyLayout {
  const sourceNodes = [...graph.nodes].sort(
    (a, b) =>
      compare(a.id, b.id) ||
      compare(
        JSON.stringify([a.label, a.kind, a.status]),
        JSON.stringify([b.label, b.kind, b.status]),
      ),
  )
  const uniqueNodes = [...new Map(sourceNodes.map((node) => [node.id, node])).values()]
  const indexById = new Map(uniqueNodes.map((node, index) => [node.id, index]))
  const edges = normalizeEdges(graph.edges, indexById)
  if (!uniqueNodes.length)
    return { nodes: [], galaxies: [], bridges: [], edges, extent: 0 }

  const adjacency = uniqueNodes.map(() => new Map<number, number>())
  for (const edge of edges) {
    const source = indexById.get(edge.source)!
    const target = indexById.get(edge.target)!
    // A reference and its returned backlink are one affinity, not two votes.
    const weight = Math.max(adjacency[source].get(target) ?? 0, edgeWeight(edge))
    adjacency[source].set(target, weight)
    adjacency[target].set(source, weight)
  }

  const communities = findCommunities(adjacency)
  const nodes: GalaxyNodePosition[] = []
  const galaxies: GalaxyPosition[] = []

  for (const members of communities) {
    const memberSet = new Set(members)
    const internalDegree = (index: number) =>
      [...adjacency[index]].reduce(
        (sum, [neighbor, weight]) => sum + (memberSet.has(neighbor) ? weight : 0),
        0,
      )
    const ranked = [...members].sort(
      (a, b) =>
        internalDegree(b) - internalDegree(a) ||
        Number(uniqueNodes[b].kind === 'folder') -
          Number(uniqueNodes[a].kind === 'folder') ||
        compare(uniqueNodes[a].id, uniqueNodes[b].id),
    )
    const hub = uniqueNodes[ranked[0]]
    const galaxyId = `galaxy:${uniqueNodes[members[0]].id}`
    const bodies = ranked.map((index, position) => ({
      id: uniqueNodes[index].id,
      x: 0,
      y: 0,
      z: 0,
      radius: bodyRadius(uniqueNodes[index], adjacency[index].size, position === 0),
      degree: adjacency[index].size,
      galaxyId,
      isHub: position === 0,
    }))
    arrangeBodies(bodies, galaxyId)
    const radius =
      Math.max(
        ...bodies.map((node) => Math.hypot(node.x, node.y, node.z) + node.radius),
      ) + 32
    galaxies.push({
      id: galaxyId,
      label: hub.label,
      hubId: hub.id,
      x: 0,
      y: 0,
      z: 0,
      radius,
      nodeIds: members.map((index) => uniqueNodes[index].id),
    })
    nodes.push(...bodies)
  }

  placeGalaxies(galaxies)
  const galaxyById = new Map(galaxies.map((galaxy) => [galaxy.id, galaxy]))
  const galaxyByNode = new Map(nodes.map((node) => [node.id, node.galaxyId]))
  for (const node of nodes) {
    const galaxy = galaxyById.get(node.galaxyId)!
    node.x += galaxy.x
    node.y += galaxy.y
    node.z += galaxy.z
  }

  const bridges = new Map<string, GalaxyBridge>()
  for (const edge of edges) {
    const source = galaxyByNode.get(edge.source)!
    const target = galaxyByNode.get(edge.target)!
    if (source === target) continue
    const [sourceGalaxy, targetGalaxy] = [source, target].sort(compare)
    const id = `bridge:${JSON.stringify([sourceGalaxy, targetGalaxy])}`
    const bridge = bridges.get(id) ?? { id, sourceGalaxy, targetGalaxy, edgeIds: [] }
    bridge.edgeIds.push(edge.id)
    bridges.set(id, bridge)
  }

  return {
    nodes: nodes.sort((a, b) => compare(a.id, b.id)),
    galaxies: galaxies.sort((a, b) => compare(a.id, b.id)),
    bridges: [...bridges.values()].sort((a, b) => compare(a.id, b.id)),
    edges,
    extent: Math.max(
      ...galaxies.map(
        (galaxy) => Math.hypot(galaxy.x, galaxy.y, galaxy.z) + galaxy.radius,
      ),
    ),
  }
}

function normalizeEdges(
  edges: SourceEdge[],
  indexById: Map<string, number>,
): SourceEdge[] {
  const ids = new Set<string>()
  const relationships = new Set<string>()
  const keyById = new Map<string, string>()
  const conflictingIds = new Set<string>()
  for (const edge of edges) {
    const key = edgeKey(edge)
    if (keyById.has(edge.id) && keyById.get(edge.id) !== key)
      conflictingIds.add(edge.id)
    keyById.set(edge.id, key)
  }
  return [...edges]
    .sort((a, b) => compare(a.id, b.id) || compare(edgeKey(a), edgeKey(b)))
    .filter((edge) => {
      const key = edgeKey(edge)
      if (
        !indexById.has(edge.source) ||
        !indexById.has(edge.target) ||
        edge.source === edge.target ||
        conflictingIds.has(edge.id) ||
        ids.has(edge.id) ||
        relationships.has(key)
      )
        return false
      ids.add(edge.id)
      relationships.add(key)
      return true
    })
}

function edgeKey(edge: SourceEdge): string {
  return JSON.stringify([edge.source, edge.target, edge.relation])
}

function edgeWeight(edge: SourceEdge): number {
  if (edge.relation === 'contains') return 0.22
  if (edge.relation === 'suggested') return 0.35
  return 1
}

/** Greedy weighted modularity keeps dense neighborhoods apart across sparse bridges. */
function findCommunities(adjacency: Map<number, number>[]): number[][] {
  const weights = adjacency.map((neighbors) => new Map(neighbors))
  const totals = adjacency.map((neighbors) =>
    [...neighbors.values()].reduce((sum, weight) => sum + weight, 0),
  )
  const totalDegree = totals.reduce((sum, total) => sum + total, 0)
  const members = adjacency.map((_, index) => [index])
  const active = adjacency.map(() => true)
  if (!totalDegree) return members

  // At most n-1 merges; n is bounded by the transport contract, not viewport size.
  for (let merge = 1; merge < adjacency.length; merge += 1) {
    let bestGain = 1e-9
    let bestSource = -1
    let bestTarget = -1
    for (let source = 0; source < weights.length; source += 1) {
      if (!active[source]) continue
      for (const [target, weight] of weights[source]) {
        if (target <= source || !active[target]) continue
        const gain = totalDegree * weight - totals[source] * totals[target]
        if (
          gain > bestGain + 1e-9 ||
          (Math.abs(gain - bestGain) < 1e-9 &&
            bestSource >= 0 &&
            (source < bestSource || (source === bestSource && target < bestTarget)))
        ) {
          bestGain = gain
          bestSource = source
          bestTarget = target
        }
      }
    }
    if (bestSource < 0) break
    members[bestSource].push(...members[bestTarget])
    active[bestTarget] = false
    totals[bestSource] += totals[bestTarget]
    weights[bestSource].delete(bestTarget)
    for (const [neighbor, weight] of weights[bestTarget]) {
      if (!active[neighbor] || neighbor === bestSource) continue
      const combined = (weights[bestSource].get(neighbor) ?? 0) + weight
      weights[bestSource].set(neighbor, combined)
      weights[neighbor].set(bestSource, combined)
      weights[neighbor].delete(bestTarget)
    }
  }
  return members
    .filter((_, index) => active[index])
    .map((group) => group.sort((a, b) => a - b))
}

function bodyRadius(node: SourceNode, degree: number, isHub: boolean): number {
  if (isHub) return 34 + Math.min(14, Math.sqrt(degree) * 2.5)
  if (node.kind === 'folder') return 23
  return 12 + Math.min(8, Math.sqrt(degree) * 1.8) + (node.kind === 'decision' ? 2 : 0)
}

function arrangeBodies(bodies: GalaxyNodePosition[], seed: string): void {
  if (bodies.length < 2) return
  const maxRadius = Math.max(...bodies.slice(1).map((body) => body.radius))
  const spacing = maxRadius * 2 + BODY_GAP
  const phase = (stableHash(seed) / 0xffffffff) * TAU
  const tilt = 0.32 + ((stableHash(`${seed}:tilt`) % 100) / 100) * 0.38
  let orbitRadius = bodies[0].radius + maxRadius + BODY_GAP + 12
  let offset = 1
  while (offset < bodies.length) {
    // The chord, not arc length, bounds the minimum distance between neighbors.
    const capacity = Math.max(
      3,
      Math.floor(Math.PI / Math.asin(spacing / (2 * orbitRadius))),
    )
    const count = Math.min(capacity, bodies.length - offset)
    for (let index = 0; index < count; index += 1) {
      const angle = phase + (index / count) * TAU + offset * GOLDEN_ANGLE
      const body = bodies[offset + index]
      body.x = Math.cos(angle) * orbitRadius
      body.y = Math.sin(angle) * orbitRadius * Math.cos(tilt)
      body.z = Math.sin(angle) * orbitRadius * Math.sin(tilt)
    }
    offset += count
    orbitRadius += spacing + 12
  }
}

function placeGalaxies(galaxies: GalaxyPosition[]): void {
  const ordered = [...galaxies].sort(
    (a, b) => b.radius - a.radius || compare(a.id, b.id),
  )
  const placed: GalaxyPosition[] = []
  for (let index = 0; index < ordered.length; index += 1) {
    const galaxy = ordered[index]
    const angle = index * GOLDEN_ANGLE + 0.25
    const direction = { x: Math.cos(angle), y: Math.sin(angle) }
    // Project occupied circles onto a ray and leave the union of blocked intervals.
    // This avoids an unbounded force simulation or trial-and-error collision loop.
    const intervals = placed
      .flatMap((other) => {
        const clearance = galaxy.radius + other.radius + GALAXY_GAP
        const projection = other.x * direction.x + other.y * direction.y
        const perpendicularSquared = other.x ** 2 + other.y ** 2 - projection ** 2
        if (perpendicularSquared >= clearance ** 2) return []
        const halfWidth = Math.sqrt(Math.max(0, clearance ** 2 - perpendicularSquared))
        return [{ start: projection - halfWidth, end: projection + halfWidth }]
      })
      .sort((a, b) => a.start - b.start)
    let distance = 0
    for (const interval of intervals) {
      if (interval.start > distance) break
      distance = Math.max(distance, interval.end + 1)
    }
    galaxy.x = direction.x * distance
    galaxy.y = direction.y * distance
    galaxy.z = ordered.length === 1 ? 0 : (stableHash(galaxy.id) % 161) - 80
    placed.push(galaxy)
  }

  const centerX =
    (Math.min(...galaxies.map((galaxy) => galaxy.x - galaxy.radius)) +
      Math.max(...galaxies.map((galaxy) => galaxy.x + galaxy.radius))) /
    2
  const centerY =
    (Math.min(...galaxies.map((galaxy) => galaxy.y - galaxy.radius)) +
      Math.max(...galaxies.map((galaxy) => galaxy.y + galaxy.radius))) /
    2
  for (const galaxy of galaxies) {
    galaxy.x = (galaxy.x - centerX) * 1.75
    galaxy.y -= centerY
  }
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
