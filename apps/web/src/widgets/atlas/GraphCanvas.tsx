import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSnapshot } from '../../shared/model/types'
import { layoutGalaxies } from './galaxyLayout'
import { createGalaxyScene } from './galaxyScene'
import './galaxy.css'

export function GraphCanvas({
  graph,
  onOpen,
}: {
  graph: GraphSnapshot
  onOpen: (id: string) => void
}) {
  const { t } = useTranslation()
  const layout = useMemo(() => layoutGalaxies(graph), [graph])
  const hasNodes = graph.nodes.length > 0
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const motionPaused = paused || reducedMotion
  const motionLabel = reducedMotion
    ? 'atlas.reducedMotion'
    : paused
      ? 'atlas.resumeMotion'
      : 'atlas.pauseMotion'
  const [unavailable, setUnavailable] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const targets = useRef(new Map<string, HTMLButtonElement>())
  const scene = useRef<ReturnType<typeof createGalaxyScene>>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const selected = graph.nodes.find((node) => node.id === selectedId)
  const positionById = useMemo(
    () => new Map(layout.nodes.map((node) => [node.id, node])),
    [layout],
  )
  const selectedPosition = selectedId ? positionById.get(selectedId) : undefined
  const selectedBridges = selectedId
    ? layout.bridges.filter((bridge) =>
        bridge.edgeIds.some((id) => {
          const edge = layout.edges.find((item) => item.id === id)
          return edge?.source === selectedId || edge?.target === selectedId
        }),
      ).length
    : 0

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) {
      setUnavailable(false)
      setSelectedId(null)
      drag.current = null
      suppressClick.current = false
      return
    }
    const current = createGalaxyScene({
      canvas: canvasRef.current,
      container: containerRef.current,
      targets: targets.current,
      graph,
      layout,
    })
    scene.current = current
    setUnavailable(!current)
    setSelectedId(null)
    return () => {
      current?.destroy()
      scene.current = null
    }
  }, [graph, layout])
  useEffect(() => {
    scene.current?.motion(!motionPaused)
  }, [motionPaused, layout])
  useEffect(() => {
    scene.current?.select(selectedId)
  }, [selectedId, layout])
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      scene.current?.zoom(Math.exp(-Math.max(-80, Math.min(80, event.deltaY)) * 0.002))
    }
    container.addEventListener('wheel', wheel, { passive: false })
    return () => container.removeEventListener('wheel', wheel)
  }, [hasNodes])

  if (!hasNodes) return <div className="galaxy-empty">{t('atlas.noGraph')}</div>
  return (
    <div
      className="galaxy-canvas"
      ref={containerRef}
      data-galaxy-count={layout.galaxies.length}
      data-bridge-count={layout.bridges.length}
      data-motion={motionPaused ? 'paused' : 'active'}
      onPointerDown={(event) => {
        suppressClick.current = false
        if (
          (event.target as HTMLElement).closest('.galaxy-toolbar, .galaxy-selection')
        ) {
          drag.current = null
          return
        }
        if (event.button !== 0) return
        drag.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          moved: false,
        }
      }}
      onPointerMove={(event) => {
        const start = drag.current
        if (!start || start.id !== event.pointerId) return
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (!start.moved && Math.abs(dx) + Math.abs(dy) < 5) return
        event.currentTarget.setPointerCapture(event.pointerId)
        start.moved = true
        suppressClick.current = true
        scene.current?.rotate(dx * 0.006, dy * 0.006)
        start.x = event.clientX
        start.y = event.clientY
      }}
      onPointerUp={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId)
        drag.current = null
      }}
      onPointerCancel={() => {
        drag.current = null
        suppressClick.current = false
      }}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }
      }}
    >
      <canvas
        className="galaxy-camera"
        ref={canvasRef}
        tabIndex={0}
        aria-label={t('atlas.graphLabel')}
        aria-describedby="galaxy-help"
        onClick={() => setSelectedId(null)}
        onKeyDown={(event) => {
          const controls: Record<string, () => void> = {
            ArrowLeft: () => scene.current?.rotate(-0.16),
            ArrowRight: () => scene.current?.rotate(0.16),
            ArrowUp: () => scene.current?.rotate(0, -0.12),
            ArrowDown: () => scene.current?.rotate(0, 0.12),
            '+': () => scene.current?.zoom(1.15),
            '=': () => scene.current?.zoom(1.15),
            '-': () => scene.current?.zoom(1 / 1.15),
            Home: () => scene.current?.reset(),
            Escape: () => setSelectedId(null),
          }
          if (controls[event.key]) {
            event.preventDefault()
            controls[event.key]()
          }
        }}
      />
      <div className="galaxy-summary" aria-live="polite">
        <span>{t('atlas.galaxies', { count: layout.galaxies.length })}</span>
        <span>◇ {t('atlas.bridges', { count: layout.bridges.length })}</span>
      </div>
      {!unavailable &&
        graph.nodes.map((node) => {
          const position = positionById.get(node.id)
          return (
            <button
              key={node.id}
              type="button"
              className="celestial-node"
              ref={(element) => {
                if (element) targets.current.set(node.id, element)
                else targets.current.delete(node.id)
              }}
              data-node-id={node.id}
              data-galaxy-id={position?.galaxyId}
              data-hub={position?.isHub}
              aria-label={t('atlas.selectNode', { title: node.label })}
              aria-pressed={selectedId === node.id}
              onClick={() => setSelectedId(node.id)}
              onDoubleClick={() => onOpen(node.id)}
              onPointerEnter={() => scene.current?.hover(node.id)}
              onPointerLeave={() => scene.current?.hover(null)}
              onFocus={() => scene.current?.hover(node.id)}
              onBlur={() => scene.current?.hover(null)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSelectedId(null)
                  canvasRef.current?.focus()
                }
              }}
            >
              <span className="celestial-label">
                {node.label}
                {position?.isHub && <small>{t('atlas.hub')}</small>}
              </span>
            </button>
          )
        })}
      {unavailable && (
        <p className="galaxy-fallback" role="status">
          {t('atlas.canvasUnavailable')}
        </p>
      )}
      {selected && (
        <div className="galaxy-selection" aria-live="polite">
          <span className="eyebrow">
            {t(`common.kind.${selected.kind}`)} ·{' '}
            {t('atlas.relations', { count: selectedPosition?.degree ?? 0 })}
          </span>
          <strong>{selected.label}</strong>
          {selectedBridges > 0 && (
            <small>◇ {t('atlas.bridges', { count: selectedBridges })}</small>
          )}
          <div>
            <button
              type="button"
              onClick={() => onOpen(selected.id)}
              aria-label={t('atlas.openNode', { title: selected.label })}
            >
              {t('common.open')} ↗
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedId(null)
                const target = targets.current.get(selected.id)
                target?.focus({ preventScroll: true })
                if (!target || document.activeElement !== target) {
                  canvasRef.current?.focus({ preventScroll: true })
                }
              }}
              aria-label={t('common.close')}
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div
        className="galaxy-toolbar"
        role="group"
        aria-label={t('atlas.cameraControls')}
      >
        <button
          type="button"
          aria-label={t('atlas.rotateLeft')}
          title={t('atlas.rotateLeft')}
          onClick={() => scene.current?.rotate(-0.16)}
        >
          ↶
        </button>
        <button
          type="button"
          aria-label={t('atlas.rotateRight')}
          title={t('atlas.rotateRight')}
          onClick={() => scene.current?.rotate(0.16)}
        >
          ↷
        </button>
        <button
          type="button"
          aria-label={t('atlas.tiltUp')}
          title={t('atlas.tiltUp')}
          onClick={() => scene.current?.rotate(0, -0.12)}
        >
          ↑
        </button>
        <button
          type="button"
          aria-label={t('atlas.tiltDown')}
          title={t('atlas.tiltDown')}
          onClick={() => scene.current?.rotate(0, 0.12)}
        >
          ↓
        </button>
        <span aria-hidden="true" />
        <button
          type="button"
          aria-label={t('atlas.zoomOut')}
          title={t('atlas.zoomOut')}
          onClick={() => scene.current?.zoom(1 / 1.2)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={t('atlas.zoomIn')}
          title={t('atlas.zoomIn')}
          onClick={() => scene.current?.zoom(1.2)}
        >
          +
        </button>
        <button
          type="button"
          aria-label={t('atlas.resetView')}
          title={t('atlas.resetView')}
          onClick={() => scene.current?.reset()}
        >
          ◎
        </button>
        <button
          type="button"
          aria-label={t(motionLabel)}
          title={t(motionLabel)}
          aria-pressed={motionPaused}
          disabled={reducedMotion}
          onClick={() => setPaused((current) => !current)}
        >
          {motionPaused ? '▷' : 'Ⅱ'}
        </button>
      </div>
      <p id="galaxy-help" className="galaxy-help">
        {t('atlas.cameraHint')}
      </p>
    </div>
  )
}
