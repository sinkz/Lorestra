import {
  Fragment,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'

interface CameraControl {
  id: string
  label: string
  icon: string
  onClick: () => void
  pressed?: boolean
  disabled?: boolean
  separatorBefore?: boolean
}

interface TooltipPosition {
  left: number
  top: number
  arrow: number
  side: 'above' | 'below'
}

/** Shared pointer/keyboard help, rendered outside the Atlas overflow boundary. */
export function CameraToolbar({
  label,
  controls,
}: {
  label: string
  controls: CameraControl[]
}) {
  const tooltipId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)
  const anchors = useRef(new Map<string, HTMLSpanElement>())
  const tooltip = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hovered = useRef<string | null>(null)
  const focused = useRef<string | null>(null)
  const dismissed = useRef<string | null>(null)
  const tooltipHovered = useRef(false)
  const active = controls.find((control) => control.id === activeId)

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  function open(id: string) {
    cancelClose()
    dismissed.current = null
    if (activeId !== id) {
      tooltipHovered.current = false
      setPosition(null)
    }
    setActiveId(id)
  }

  function scheduleClose() {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null
      if (tooltipHovered.current) return
      const next = hovered.current ?? focused.current
      if (!next || next === dismissed.current) {
        setActiveId(null)
      } else if (next !== activeId) {
        setPosition(null)
        setActiveId(next)
      }
    }, 120)
  }

  useEffect(
    () => () => {
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
    },
    [],
  )

  useEffect(() => {
    if (!activeId) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (closeTimer.current !== null) clearTimeout(closeTimer.current)
      closeTimer.current = null
      tooltipHovered.current = false
      dismissed.current = activeId
      setActiveId(null)
    }
    document.addEventListener('keydown', dismiss, true)
    return () => document.removeEventListener('keydown', dismiss, true)
  }, [activeId])

  useLayoutEffect(() => {
    if (!activeId) return
    const place = () => {
      const anchor = anchors.current.get(activeId)
      const popup = tooltip.current
      if (!anchor || !popup) return
      const bounds = anchor.getBoundingClientRect()
      const { width, height } = popup.getBoundingClientRect()
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = window.innerHeight
      if (bounds.bottom < 0 || bounds.top > viewportHeight) {
        setActiveId(null)
        return
      }
      const left = Math.max(
        8,
        Math.min(viewportWidth - width - 8, bounds.left + bounds.width / 2 - width / 2),
      )
      const above = bounds.top - height - 10 >= 8
      const top = Math.max(
        8,
        Math.min(
          viewportHeight - height - 8,
          above ? bounds.top - height - 10 : bounds.bottom + 10,
        ),
      )
      setPosition({
        left,
        top,
        arrow: Math.max(
          12,
          Math.min(width - 12, bounds.left + bounds.width / 2 - left),
        ),
        side: above ? 'above' : 'below',
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [activeId, active?.label])

  return (
    <div className="galaxy-toolbar" role="group" aria-label={label}>
      {controls.map((control) => (
        <Fragment key={control.id}>
          {control.separatorBefore && (
            <span className="galaxy-toolbar-separator" aria-hidden="true" />
          )}
          <span
            className="galaxy-control"
            ref={(element) => {
              if (element) anchors.current.set(control.id, element)
              else anchors.current.delete(control.id)
            }}
            role={control.disabled ? 'group' : undefined}
            tabIndex={control.disabled ? 0 : undefined}
            aria-label={control.disabled ? control.label : undefined}
            aria-disabled={control.disabled || undefined}
            aria-describedby={
              control.disabled && activeId === control.id ? tooltipId : undefined
            }
            onPointerEnter={() => {
              hovered.current = control.id
              open(control.id)
            }}
            onPointerLeave={() => {
              hovered.current = null
              scheduleClose()
            }}
            onFocus={() => {
              focused.current = control.id
              open(control.id)
            }}
            onBlur={() => {
              focused.current = null
              scheduleClose()
            }}
          >
            <button
              type="button"
              aria-label={control.label}
              aria-describedby={activeId === control.id ? tooltipId : undefined}
              aria-pressed={control.pressed}
              disabled={control.disabled}
              onClick={control.onClick}
            >
              <span aria-hidden="true">{control.icon}</span>
            </button>
          </span>
        </Fragment>
      ))}
      {active &&
        createPortal(
          <div
            className="galaxy-tooltip"
            role="tooltip"
            id={tooltipId}
            ref={tooltip}
            data-side={position?.side}
            style={
              {
                left: position?.left ?? 0,
                top: position?.top ?? 0,
                visibility: position ? 'visible' : 'hidden',
                '--tooltip-arrow-x': `${position?.arrow ?? 12}px`,
              } as CSSProperties
            }
            onPointerEnter={() => {
              tooltipHovered.current = true
              cancelClose()
            }}
            onPointerLeave={() => {
              tooltipHovered.current = false
              scheduleClose()
            }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {active.label}
          </div>,
          document.body,
        )}
    </div>
  )
}
