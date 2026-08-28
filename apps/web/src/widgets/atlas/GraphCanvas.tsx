import { useEffect, useMemo, useState } from 'react'
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import type { GraphSnapshot } from '../../shared/model/types'

export function GraphCanvas({
  graph,
  onOpen,
}: {
  graph: GraphSnapshot
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const [reducedMotion, setReducedMotion] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])
  const visibleGraph = useMemo(() => {
    const nodes = graph.nodes.slice(0, 200)
    const nodeIds = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: graph.edges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .slice(0, 500),
    }
  }, [graph.edges, graph.nodes])
  const nodes = useMemo<Node[]>(
    () =>
      visibleGraph.nodes.map((node, index) => ({
        id: node.id,
        position: {
          x: node.x ?? 120 + (index % 4) * 220,
          y: node.y ?? 120 + Math.floor(index / 4) * 150,
        },
        data: {
          label: (
            <span className="flow-node-label">
              <strong>{node.label}</strong>
              <small>
                {t(`common.kind.${node.kind}`, { defaultValue: node.kind })}
              </small>
            </span>
          ),
        },
        className: `flow-node flow-${node.kind}`,
      })),
    [t, visibleGraph.nodes],
  )
  const edges = useMemo<Edge[]>(
    () =>
      visibleGraph.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        animated:
          edge.relation === 'suggested' &&
          visibleGraph.edges.length <= 80 &&
          !reducedMotion,
        className: `flow-edge flow-edge-${edge.relation}`,
      })),
    [reducedMotion, visibleGraph.edges],
  )
  const onNodeClick: NodeMouseHandler = (_event, node) => onOpen(node.id)

  return (
    <div className="flow-canvas" aria-label={t('atlas.graphLabel')}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.6}
        onNodeClick={onNodeClick}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
      >
        <Background color="#8ab39c" gap={36} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(node) =>
            node.className?.includes('incident')
              ? '#d85d59'
              : node.className?.includes('decision')
                ? '#e4aa4c'
                : '#76d6b0'
          }
        />
      </ReactFlow>
    </div>
  )
}
