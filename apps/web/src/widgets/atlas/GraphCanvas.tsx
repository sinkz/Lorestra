import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useNodesState,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTranslation } from 'react-i18next'
import type { DocumentKind, GraphSnapshot } from '../../shared/model/types'
import { layoutGraph } from './graphLayout'

type ConstellationData = {
  label: string
  kind: DocumentKind
  kindLabel: string
  degree: number
  openLabel: string
  onOpen: () => void
}

type ConstellationNode = Node<ConstellationData, 'constellation'>

const nodeTypes = {
  constellation: memo(function ConstellationNodeView({
    data,
    selected,
  }: NodeProps<ConstellationNode>) {
    return (
      <div className="constellation-node-inner">
        <Handle
          type="target"
          position={Position.Top}
          className="constellation-handle"
        />
        <span className="constellation-signal" aria-hidden="true" />
        <span className="constellation-copy">
          <strong title={data.label}>{data.label}</strong>
          <small>
            {data.kindLabel} · {data.degree}
          </small>
        </span>
        {selected ? (
          <button
            type="button"
            className="constellation-open"
            onClick={(event) => {
              event.stopPropagation()
              data.onOpen()
            }}
            aria-label={data.openLabel}
          >
            ↗
          </button>
        ) : null}
        <Handle
          type="source"
          position={Position.Bottom}
          className="constellation-handle"
        />
      </div>
    )
  }),
}

export function GraphCanvas({
  graph,
  onOpen,
}: {
  graph: GraphSnapshot
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const [reducedMotion, setReducedMotion] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const instanceRef = useRef<ReactFlowInstance<ConstellationNode, Edge> | null>(
    null,
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener?.('change', update)
    return () => media.removeEventListener?.('change', update)
  }, [])

  const visibleGraph = useMemo(() => {
    const nodes = graph.nodes.slice(0, 220)
    const nodeIds = new Set(nodes.map((node) => node.id))
    return {
      nodes,
      edges: graph.edges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .slice(0, 520),
    }
  }, [graph.edges, graph.nodes])

  const layout = useMemo(() => layoutGraph(visibleGraph), [visibleGraph])
  const degree = useMemo(() => {
    const result = new Map<string, number>()
    for (const edge of visibleGraph.edges) {
      result.set(edge.source, (result.get(edge.source) ?? 0) + 1)
      result.set(edge.target, (result.get(edge.target) ?? 0) + 1)
    }
    return result
  }, [visibleGraph.edges])
  const connectedToSelection = useMemo(() => {
    if (!selectedId) return new Set<string>()
    const ids = new Set([selectedId])
    for (const edge of visibleGraph.edges) {
      if (edge.source === selectedId) ids.add(edge.target)
      if (edge.target === selectedId) ids.add(edge.source)
    }
    return ids
  }, [selectedId, visibleGraph.edges])

  const finalNodes = useMemo<ConstellationNode[]>(
    () =>
      visibleGraph.nodes.map((node, index) => {
        const position = layout.find((item) => item.id === node.id) ?? {
          x: 800,
          y: 490,
        }
        return {
          id: node.id,
          type: 'constellation',
          position: { x: position.x, y: position.y },
          data: {
            label: node.label,
            kind: node.kind,
            kindLabel: t(`common.kind.${node.kind}`, { defaultValue: node.kind }),
            degree: degree.get(node.id) ?? 0,
            openLabel: t('atlas.openNode', { title: node.label }),
            onOpen: () => onOpen(node.id),
          },
          className: `flow-node flow-${node.kind}`,
          style: {
            '--node-scale': Math.min(
              1.12,
              0.96 + (degree.get(node.id) ?? 0) * 0.025,
            ),
            '--node-delay': `${Math.min(index * 24, 240)}ms`,
          } as CSSProperties,
          draggable: true,
          selectable: true,
        }
      }),
    [degree, layout, onOpen, t, visibleGraph.nodes],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<ConstellationNode>(finalNodes)

  useEffect(() => {
    setSelectedId(null)
    if (reducedMotion) {
      setNodes(finalNodes)
      requestAnimationFrame(() => void instanceRef.current?.fitView({ padding: 0.16 }))
      return
    }
    setNodes(
      finalNodes.map((node, index) => ({
        ...node,
        position: {
          x: 715 + ((index % 3) - 1) * 12,
          y: 440 + ((index % 4) - 1.5) * 10,
        },
      })),
    )
    const spreadTimer = window.setTimeout(() => setNodes(finalNodes), 60)
    const fitTimer = window.setTimeout(
      () => void instanceRef.current?.fitView({ padding: 0.16, duration: 280 }),
      940,
    )
    return () => {
      window.clearTimeout(spreadTimer)
      window.clearTimeout(fitTimer)
    }
  }, [finalNodes, reducedMotion, setNodes])

  const renderedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        className: [
          `flow-node flow-${node.data.kind}`,
          selectedId === node.id ? 'is-active' : '',
          selectedId && !connectedToSelection.has(node.id) ? 'is-dimmed' : '',
        ]
          .filter(Boolean)
          .join(' '),
      })),
    [connectedToSelection, nodes, selectedId],
  )
  const edges = useMemo<Edge[]>(
    () =>
      visibleGraph.edges.map((edge) => {
        const active =
          selectedId !== null &&
          (edge.source === selectedId || edge.target === selectedId)
        const dimmed = selectedId !== null && !active
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: 'bezier',
          animated:
            active && visibleGraph.edges.length <= 100 && !reducedMotion,
          className: [
            `flow-edge flow-edge-${edge.relation}`,
            active ? 'is-active' : '',
            dimmed ? 'is-dimmed' : '',
          ]
            .filter(Boolean)
            .join(' '),
        }
      }),
    [reducedMotion, selectedId, visibleGraph.edges],
  )
  const onNodeClick: NodeMouseHandler<ConstellationNode> = (_event, node) =>
    setSelectedId((current) => (current === node.id ? null : node.id))
  const onNodeDoubleClick: NodeMouseHandler<ConstellationNode> = (_event, node) =>
    onOpen(node.id)

  return (
    <div className="flow-canvas" aria-label={t('atlas.graphLabel')}>
      <ReactFlow<ConstellationNode, Edge>
        nodes={renderedNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          instanceRef.current = instance
          void instance.fitView({ padding: 0.16 })
        }}
        fitView
        fitViewOptions={{ padding: 0.16 }}
        minZoom={0.28}
        maxZoom={1.8}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => setSelectedId(null)}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        selectionOnDrag={false}
      >
        <Background color="#76d6b0" gap={42} size={0.8} />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          nodeColor={(node) =>
            node.className?.includes('incident')
              ? '#d85d59'
              : node.className?.includes('decision')
                ? '#e4aa4c'
                : node.className?.includes('folder')
                  ? '#d3f56a'
                  : '#76d6b0'
          }
        />
      </ReactFlow>
      <div className="constellation-hint" aria-live="polite">
        {selectedId ? t('atlas.selectedHint') : t('atlas.interactionHint')}
      </div>
    </div>
  )
}
