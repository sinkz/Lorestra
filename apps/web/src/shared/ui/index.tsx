import { ApiError, errorMessageKey } from '../api/errors'

import {
  useEffect,
  useMemo,
  useRef,
  type ButtonHTMLAttributes,
  type DialogHTMLAttributes,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { resolveMarkdownDocumentLink } from './markdownLinks'
import type {
  DocumentStatus,
  DocumentKind,
  PageInfo,
  ProposalStatus,
} from '../model/types'

export type IconName =
  | 'atlas'
  | 'library'
  | 'docs'
  | 'proposals'
  | 'history'
  | 'search'
  | 'plus'
  | 'menu'
  | 'close'
  | 'arrow'
  | 'folder'
  | 'file'
  | 'link'
  | 'check'
  | 'external'
  | 'back'

const glyphs: Record<IconName, string> = {
  atlas: '✦',
  library: '▤',
  docs: '▥',
  proposals: '⇄',
  history: '◷',
  search: '⌕',
  plus: '+',
  menu: '☰',
  close: '×',
  arrow: '→',
  folder: '▾',
  file: '·',
  link: '↗',
  check: '✓',
  external: '↗',
  back: '←',
}

export function Icon({ name, label }: { name: IconName; label?: string }) {
  return (
    <span className="icon" aria-hidden={label ? undefined : true} aria-label={label}>
      {glyphs[name]}
    </span>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'subtle' | 'link'

export function Button({
  variant = 'secondary',
  icon,
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  icon?: IconName
}) {
  return (
    <button className={`button button-${variant} ${className}`} {...props}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  )
}

export function ModalDialog({
  open,
  onRequestClose,
  children,
  onClick,
  onKeyDown,
  ...props
}: DialogHTMLAttributes<HTMLDialogElement> & {
  open: boolean
  onRequestClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        restoreFocusRef.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        if (typeof dialog.showModal === 'function') dialog.showModal()
        else dialog.setAttribute('open', '')
      }
      requestAnimationFrame(() => {
        const autofocus = dialog.querySelector<HTMLElement>('[autofocus]')
        const firstFocusable = dialog.querySelector<HTMLElement>(
          'button, input, textarea, select, a[href], [tabindex]:not([tabindex="-1"])',
        )
        ;(autofocus ?? firstFocusable ?? dialog).focus()
      })
      return
    }
    if (dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    const restore = restoreFocusRef.current
    restoreFocusRef.current = null
    requestAnimationFrame(() => restore?.focus())
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      onRequestClose()
    }
    const onClose = () => {
      const restore = restoreFocusRef.current
      restoreFocusRef.current = null
      requestAnimationFrame(() => restore?.focus())
    }
    dialog.addEventListener('cancel', onCancel)
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('cancel', onCancel)
      dialog.removeEventListener('close', onClose)
    }
  }, [onRequestClose])

  return (
    <dialog
      ref={dialogRef}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        if (event.target === event.currentTarget) onRequestClose()
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event)
        if (!event.defaultPrevented && event.key === 'Escape') {
          event.preventDefault()
          onRequestClose()
        }
      }}
    >
      {children}
    </dialog>
  )
}

export function StatusBadge({
  status,
  kind,
}: {
  status: DocumentStatus | ProposalStatus
  kind?: DocumentKind
}) {
  const { t } = useTranslation()
  const key =
    status === 'changes-requested'
      ? 'proposals.changesRequested'
      : status === 'approved'
        ? 'proposals.approved'
        : status === 'merged'
          ? 'proposals.merged'
          : status === 'open'
            ? 'proposals.open'
            : status === 'published'
              ? 'common.published'
              : status === 'draft'
                ? 'common.draft'
                : status === 'archived'
                  ? 'common.archived'
                  : status
  const label = t(key, { defaultValue: status.replaceAll('-', ' ') })
  return (
    <span className={`status-badge status-${status}`} data-kind={kind}>
      <span className="status-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export function PageHeading({
  kicker,
  title,
  lead,
  actions,
}: {
  kicker?: string
  title: string
  lead?: string
  actions?: ReactNode
}) {
  return (
    <header className="page-heading">
      <div className="page-heading-copy">
        <span className="eyebrow">{kicker}</span>
        <h1 id="page-heading" tabIndex={-1}>
          {title}
        </h1>
        {lead ? <p>{lead}</p> : null}
      </div>
      {actions ? <div className="page-heading-actions">{actions}</div> : null}
    </header>
  )
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string
  body?: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state" role="status">
      <div className="empty-orbit" aria-hidden="true">
        ◌
      </div>
      <h2>{title}</h2>
      {body ? <p>{body}</p> : null}
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  )
}

export function LoadingState() {
  const { t } = useTranslation()
  return (
    <div className="loading-state" role="status">
      <span className="loading-pulse" aria-hidden="true" />
      {t('common.loading')}
    </div>
  )
}

export function ErrorState({
  onRetry,
  error,
}: {
  onRetry?: () => void
  error?: unknown
}) {
  const { t } = useTranslation()
  return (
    <div className="error-state" role="alert">
      <strong>{t(errorMessageKey(error))}</strong>
      {error instanceof ApiError && error.requestId ? (
        <small>{t('apiErrors.reference', { id: error.requestId })}</small>
      ) : null}
      {onRetry ? <Button onClick={onRetry}>{t('common.retry')}</Button> : null}
    </div>
  )
}

export function Pagination({
  pageInfo,
  pageSize,
  cursor,
  onPrevious,
  onNext,
}: {
  pageInfo: PageInfo
  pageSize: number
  cursor?: string
  onPrevious: (cursor: string | null) => void
  onNext: (cursor: string | null) => void
}) {
  const { t } = useTranslation()
  // Durable HTTP cursors are opaque base64 values. Only the legacy mock's
  // numeric offsets can support a truthful range label; never decode or
  // partially parse an opaque cursor as if it were an offset.
  const parsed = cursor && /^\d+$/.test(cursor) ? Number(cursor) : null
  const start = parsed === null ? null : parsed + 1
  const end =
    start === null ? null : Math.min(start + pageSize - 1, pageInfo.totalCount)
  if (!pageInfo.hasPreviousPage && !pageInfo.hasNextPage) return null
  return (
    <nav className="pagination" aria-label={t('common.pagination')}>
      <span className="pagination-range">
        {start === null || end === null
          ? t('common.paginationTotal', { total: pageInfo.totalCount })
          : t('common.paginationRange', {
              start,
              end,
              total: pageInfo.totalCount,
            })}
      </span>
      <div className="pagination-actions">
        <Button
          variant="secondary"
          icon="back"
          disabled={!pageInfo.hasPreviousPage}
          onClick={() => onPrevious(pageInfo.previousCursor)}
        >
          {t('common.previous')}
        </Button>
        <Button
          variant="secondary"
          disabled={!pageInfo.hasNextPage}
          onClick={() => onNext(pageInfo.nextCursor)}
        >
          {t('common.next')}
          <Icon name="arrow" />
        </Button>
      </div>
    </nav>
  )
}

export function MarkdownContent({
  source,
  documentSlugs,
  resolvedLinks,
}: {
  source: string
  documentSlugs?: readonly string[]
  resolvedLinks?: readonly { href: string; slug: string }[]
}) {
  const components = useMemo<Components>(() => {
    const slugs = new Set(documentSlugs)
    return {
      a: ({ href, ...props }) => {
        delete props.node
        const resolved = resolvedLinks?.find((link) => link.href === href)
        const destination = resolved
          ? `/documents/${encodeURIComponent(resolved.slug)}${href?.match(/[?#].*$/)?.[0] ?? ''}`
          : resolveMarkdownDocumentLink(href, slugs)
        return destination ? (
          <Link {...props} to={destination} />
        ) : (
          <a {...props} href={href} />
        )
      },
    }
  }, [documentSlugs, resolvedLinks])

  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  )
}

export function formatDate(
  value: string,
  locale: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return new Intl.DateTimeFormat(
    locale === 'pt-BR' ? 'pt-BR' : 'en-US',
    options ?? { dateStyle: 'medium' },
  ).format(date)
}

export function formatRelativeDate(value: string, locale: string) {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  const delta = date.getTime() - Date.now()
  const abs = Math.abs(delta)
  const unit: Intl.RelativeTimeFormatUnit =
    abs > 86_400_000 ? 'day' : abs > 3_600_000 ? 'hour' : 'minute'
  const divisor = unit === 'day' ? 86_400_000 : unit === 'hour' ? 3_600_000 : 60_000
  return new Intl.RelativeTimeFormat(locale === 'pt-BR' ? 'pt-BR' : 'en-US', {
    numeric: 'auto',
  }).format(Math.round(delta / divisor), unit)
}
