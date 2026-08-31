import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSnapshot } from '../../shared/model/types'
import { CameraToolbar } from './CameraToolbar'
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
  const [panMode, setPanMode] = useState(false)
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
  const stopDrag = useCallback((pointerId?: number) => {
    const active = drag.current
    if (!active || (pointerId !== undefined && active.id !== pointerId)) return
    drag.current = null
    const container = containerRef.current
    if (!container) return
    delete container.dataset.dragging
    if (container.hasPointerCapture(active.id))
      container.releasePointerCapture(active.id)
  }, [])
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
      stopDrag()
      current?.destroy()
      scene.current = null
    }
  }, [graph, layout, stopDrag])
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
    const onBlur = () => stopDrag()
    const onVisibility = () => {
      if (document.hidden) stopDrag()
    }
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [stopDrag])
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('.galaxy-toolbar, .galaxy-selection'))
        return
      event.preventDefault()
      const bounds = container.getBoundingClientRect()
      scene.current?.zoom(
        Math.exp(-Math.max(-80, Math.min(80, event.deltaY)) * 0.002),
        {
          x: event.clientX - bounds.left - container.clientLeft,
          y: event.clientY - bounds.top - container.clientTop,
        },
      )
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
      data-camera-mode={panMode ? 'pan' : 'orbit'}
      onPointerDown={(event) => {
        if (
          !event.isPrimary ||
          (drag.current && drag.current.id !== event.pointerId) ||
          ![0, 1, 2].includes(event.button)
        )
          return
        suppressClick.current = false
        if (
          (event.target as HTMLElement).closest('.galaxy-toolbar, .galaxy-selection')
        ) {
          stopDrag(event.pointerId)
          return
        }
        // Preserve normal primary clicks on memories; suppress middle-button autoscroll.
        if (event.button !== 0) event.preventDefault()
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
        if (event.pointerType === 'mouse' && event.buttons === 0) {
          stopDrag(event.pointerId)
          return
        }
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (!start.moved && Math.abs(dx) + Math.abs(dy) < 5) return
        event.preventDefault()
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.setPointerCapture(event.pointerId)
        start.moved = true
        suppressClick.current = true
        // Chorded buttons change on pointermove, not a second pointerdown.
        const pan = panMode || event.shiftKey || (event.buttons & 6) !== 0
        event.currentTarget.dataset.dragging = pan ? 'pan' : 'orbit'
        if (pan) scene.current?.pan(dx, dy)
        else scene.current?.rotate(dx * 0.006, dy * 0.006)
        start.x = event.clientX
        start.y = event.clientY
      }}
      onPointerUp={(event) => {
        if (event.pointerType === 'mouse' && event.buttons !== 0) return
        stopDrag(event.pointerId)
      }}
      onPointerCancel={(event) => stopDrag(event.pointerId)}
      onLostPointerCapture={(event) => {
        // Touch transfers implicit capture from the child to this container.
        if (event.target === event.currentTarget) stopDrag(event.pointerId)
      }}
      onPointerLeave={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
          stopDrag(event.pointerId)
      }}
      onContextMenu={(event) => {
        if (
          !(event.target as HTMLElement).closest('.galaxy-toolbar, .galaxy-selection')
        )
          event.preventDefault()
      }}
      onClickCapture={(event) => {
        // A right drag has no primary click. Keyboard activation must remain usable.
        if (suppressClick.current && event.detail > 0) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}
      onDoubleClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault()
          event.stopPropagation()
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
            ArrowLeft: () =>
              event.shiftKey
                ? scene.current?.pan(-48, 0)
                : scene.current?.rotate(-0.16),
            ArrowRight: () =>
              event.shiftKey ? scene.current?.pan(48, 0) : scene.current?.rotate(0.16),
            ArrowUp: () =>
              event.shiftKey
                ? scene.current?.pan(0, -48)
                : scene.current?.rotate(0, -0.12),
            ArrowDown: () =>
              event.shiftKey
                ? scene.current?.pan(0, 48)
                : scene.current?.rotate(0, 0.12),
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
      <CameraToolbar
        label={t('atlas.cameraControls')}
        controls={[
          {
            id: 'pan',
            label: t('atlas.panMap'),
            icon: '✥',
            onClick: () => setPanMode((current) => !current),
            pressed: panMode,
          },
          {
            id: 'rotate-left',
            label: t('atlas.rotateLeft'),
            icon: '↶',
            onClick: () => scene.current?.rotate(-0.16),
            separatorBefore: true,
          },
          {
            id: 'rotate-right',
            label: t('atlas.rotateRight'),
            icon: '↷',
            onClick: () => scene.current?.rotate(0.16),
          },
          {
            id: 'tilt-up',
            label: t('atlas.tiltUp'),
            icon: '↑',
            onClick: () => scene.current?.rotate(0, -0.12),
          },
          {
            id: 'tilt-down',
            label: t('atlas.tiltDown'),
            icon: '↓',
            onClick: () => scene.current?.rotate(0, 0.12),
          },
          {
            id: 'zoom-out',
            label: t('atlas.zoomOut'),
            icon: '−',
            onClick: () => scene.current?.zoom(1 / 1.2),
            separatorBefore: true,
          },
          {
            id: 'zoom-in',
            label: t('atlas.zoomIn'),
            icon: '+',
            onClick: () => scene.current?.zoom(1.2),
          },
          {
            id: 'reset',
            label: t('atlas.resetView'),
            icon: '◎',
            onClick: () => scene.current?.reset(),
          },
          {
            id: 'motion',
            label: t(motionLabel),
            icon: motionPaused ? '▷' : 'Ⅱ',
            onClick: () => setPaused((current) => !current),
            pressed: motionPaused,
            disabled: reducedMotion,
          },
        ]}
      />
      <p id="galaxy-help" className="galaxy-help">
        <span>{t(panMode ? 'atlas.cameraPanHint' : 'atlas.cameraHint')}</span>
        <span>{t('atlas.cameraKeyboardHint')}</span>
      </p>
    </div>
  )
}
