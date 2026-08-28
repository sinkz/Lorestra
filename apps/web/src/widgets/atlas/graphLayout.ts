import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import type { GraphSnapshot } from '../../shared/model/types'

type LayoutNode = SimulationNodeDatum & {
  id: string
  kind: GraphSnapshot['nodes'][number]['kind']
  clusterX: number
  clusterY: number
}

type LayoutLink = SimulationLinkDatum<LayoutNode> & {
  relation: GraphSnapshot['edges'][number]['relation']
}

export type GraphPosition = { id: string; x: number; y: number }

const SCENE_WIDTH = 1_600
const SCENE_HEIGHT = 980

export function layoutGraph(graph: GraphSnapshot): GraphPosition[] {
  if (!graph.nodes.length) return []
  const folderIds = graph.nodes
    .filter((node) => node.kind === 'folder')
    .map((node) => node.id)
  const folderIndex = new Map(folderIds.map((id, index) => [id, index]))
  const parentByDocument = new Map(
    graph.edges
      .filter((edge) => edge.relation === 'contains')
      .map((edge) => [edge.target, edge.source]),
  )
  const folderPosition = (folderId: string) => {
    const index = folderIndex.get(folderId) ?? 0
    if (folderIds.length <= 1) return { x: SCENE_WIDTH / 2, y: SCENE_HEIGHT / 2 }
    const angle = (index / folderIds.length) * Math.PI * 2 - 0.7
    return {
      x: SCENE_WIDTH / 2 + Math.cos(angle) * 470,
      y: SCENE_HEIGHT / 2 + Math.sin(angle) * 310,
    }
  }
  const nodes: LayoutNode[] = graph.nodes.map((node) => {
    const parent = node.kind === 'folder' ? node.id : parentByDocument.get(node.id)
    const cluster = folderPosition(parent ?? folderIds[0] ?? node.id)
    const seed = stableHash(node.id)
    const angle = ((seed % 360) / 180) * Math.PI
    const distance = node.kind === 'folder' ? 0 : 105 + (seed % 125)
    return {
      id: node.id,
      kind: node.kind,
      clusterX: cluster.x,
      clusterY: cluster.y,
      x: cluster.x + Math.cos(angle) * distance,
      y: cluster.y + Math.sin(angle) * distance,
      ...(node.kind === 'folder' ? { fx: cluster.x, fy: cluster.y } : {}),
    }
  })
  const links: LayoutLink[] = graph.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    relation: edge.relation,
  }))
  const simulation = forceSimulation(nodes)
    .alpha(1)
    .alphaDecay(0.035)
    .velocityDecay(0.36)
    .force(
      'link',
      forceLink<LayoutNode, LayoutLink>(links)
        .id((node) => node.id)
        .distance((link) => (link.relation === 'contains' ? 265 : 160))
        .strength((link) => (link.relation === 'contains' ? 0.32 : 0.58)),
    )
    .force(
      'charge',
      forceManyBody<LayoutNode>().strength((node) =>
        node.kind === 'folder' ? -1_800 : -850,
      ),
    )
    .force(
      'collision',
      forceCollide<LayoutNode>()
        .radius((node) => (node.kind === 'folder' ? 110 : 96))
        .strength(1)
        .iterations(3),
    )
    .force(
      'cluster-x',
      forceX<LayoutNode>((node) => node.clusterX).strength((node) =>
        node.kind === 'folder' ? 0.8 : folderIds.length <= 1 ? 0.008 : 0.025,
      ),
    )
    .force(
      'cluster-y',
      forceY<LayoutNode>((node) => node.clusterY).strength((node) =>
        node.kind === 'folder' ? 0.8 : folderIds.length <= 1 ? 0.008 : 0.025,
      ),
    )
    .force('center', forceCenter(SCENE_WIDTH / 2, SCENE_HEIGHT / 2))
    .stop()

  for (let tick = 0; tick < 240; tick += 1) simulation.tick()
  simulation.stop()

  return nodes.map((node) => ({
    id: node.id,
    x: (node.x ?? SCENE_WIDTH / 2) - (node.kind === 'folder' ? 62 : 82),
    y: (node.y ?? SCENE_HEIGHT / 2) - (node.kind === 'folder' ? 62 : 38),
  }))
}

function stableHash(value: string): number {
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return hash >>> 0
}
