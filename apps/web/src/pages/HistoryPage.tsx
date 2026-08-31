import { useDeferredValue, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useHistoryQuery, useLocale, useNavigationQuery } from '../shared/api/hooks'
import type {
  DocumentSummary,
  HistoryEvent,
  HistoryEventType,
} from '../shared/model/types'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeading,
  Pagination,
  formatDate,
  formatRelativeDate,
} from '../shared/ui'

const eventTypes: Array<HistoryEventType | 'all'> = [
  'all',
  'proposal',
  'publish',
  'create',
]

export function HistoryPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const type = params.get('type') as HistoryEventType | null
  const cursor = params.get('cursor') ?? undefined
  const history = useHistoryQuery(
    undefined,
    cursor,
    deferredQuery || undefined,
    type ?? undefined,
  )
  const navigation = useNavigationQuery()
  const visible = history.data?.events ?? []
  const documentTitles = useMemo(
    () =>
      new Map(
        (navigation.data?.documents ?? []).map((document) => [document.id, document]),
      ),
    [navigation.data?.documents],
  )

  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    next.delete('cursor')
    setParams(next)
  }
  const updateCursor = (nextCursor: string | null) => {
    const next = new URLSearchParams(params)
    if (nextCursor && nextCursor !== '0') next.set('cursor', nextCursor)
    else next.delete('cursor')
    setParams(next)
  }
  const clear = () => setParams(new URLSearchParams())

  if (history.isLoading || navigation.isLoading) return <LoadingState />
  if (history.isError || navigation.isError)
    return (
      <ErrorState
        onRetry={() => {
          void history.refetch()
          void navigation.refetch()
        }}
      />
    )

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner">
        <PageHeading
          kicker={t('history.kicker')}
          title={t('history.title')}
          lead={t('history.lead')}
          actions={
            <Button variant="secondary" onClick={() => downloadHistory(visible)}>
              {t('history.export')}
            </Button>
          }
        />
        <div className="toolbar">
          <strong>
            {t('history.versions', {
              branch: history.data?.branch ?? 'main',
              count: history.data?.totalVersions ?? visible.length,
            })}
          </strong>
          <div className="library-controls">
            <label className="library-search">
              <span className="sr-only">{t('common.search')}</span>
              <input
                value={query}
                onChange={(event) => update('q', event.target.value)}
                placeholder={t('history.searchPlaceholder')}
              />
            </label>
            <label className="sr-only" htmlFor="history-type">
              {t('history.eventType')}
            </label>
            <select
              id="history-type"
              className="select-control"
              value={type ?? ''}
              onChange={(event) => update('type', event.target.value)}
            >
              <option value="">{t('history.eventType')}</option>
              {eventTypes.slice(1).map((item) => (
                <option value={item} key={item}>
                  {t(`history.eventTypes.${item}`, { defaultValue: item })}
                </option>
              ))}
            </select>
            {query || type ? (
              <Button variant="link" onClick={clear}>
                {t('common.clear')}
              </Button>
            ) : null}
          </div>
        </div>
        {visible.length ? (
          <>
            <div className="history-list">
              <div className="timeline">
                {visible.map((event) => (
                  <HistoryCard
                    event={event}
                    key={event.id}
                    document={
                      event.documentId
                        ? documentTitles.get(event.documentId)
                        : undefined
                    }
                    locale={locale}
                    cursor={cursor}
                  />
                ))}
              </div>
            </div>
            {history.data ? (
              <Pagination
                pageInfo={history.data.pageInfo}
                pageSize={visible.length}
                cursor={cursor}
                onPrevious={updateCursor}
                onNext={updateCursor}
              />
            ) : null}
          </>
        ) : (
          <EmptyState title={t('history.noEvents')} />
        )}
      </div>
    </section>
  )
}

function HistoryCard({
  event,
  document,
  proposalTitle,
  locale,
  cursor,
}: {
  event: HistoryEvent
  document?: DocumentSummary
  proposalTitle?: string
  locale: 'en' | 'pt-BR'
  cursor?: string
}) {
  const { t } = useTranslation()
  return (
    <div className="timeline-item">
      <span className="timeline-dot" aria-hidden="true" />
      <article className="history-event-card">
        <Link
          className="history-link"
          to={`/history/${encodeURIComponent(event.id)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`}
          aria-label={t('history.openEvent', { title: event.title })}
        >
          <strong>{event.title}</strong>
          <p>
            {event.revisionId
              ? t('history.publishedRevision', {
                  version: event.revisionId.replace(/^v/, ''),
                })
              : event.body || event.actor}
          </p>
          <time dateTime={event.createdAt}>
            {formatRelativeDate(event.createdAt, locale)} ·{' '}
            {formatDate(event.createdAt, locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </Link>
        <div className="history-targets">
          {event.proposalId ? (
            <Link
              className="target-chip"
              to={`/proposals/${encodeURIComponent(event.proposalId)}`}
            >
              {t('history.proposal')}: {proposalTitle ?? event.proposalId}
            </Link>
          ) : null}
          {event.documentId ? (
            document || event.documentSlug ? (
              <Link
                className="target-chip"
                to={documentRevisionHref(
                  document?.slug ?? event.documentSlug!,
                  event.revisionId,
                )}
              >
                {t('history.document')}: {document?.title ?? event.documentSlug}
              </Link>
            ) : (
              <span className="target-chip">
                {t('history.document')}: {event.documentSlug ?? event.documentId}
              </span>
            )
          ) : null}
          {event.revisionId ? (
            document ? (
              <Link
                className="target-chip"
                to={documentRevisionHref(document.slug, event.revisionId)}
              >
                {t('history.revision')}: {event.revisionId}
              </Link>
            ) : (
              <span className="target-chip">
                {t('history.revision')}: {event.revisionId}
              </span>
            )
          ) : null}
        </div>
      </article>
    </div>
  )
}

function documentRevisionHref(slug: string, revisionId?: string): string {
  const match = revisionId?.match(/^v(\d+)$/)
  const version = match?.[1] ? `&version=${encodeURIComponent(match[1])}` : ''
  return `/documents/${encodeURIComponent(slug)}?tab=history${version}`
}

function downloadHistory(events: HistoryEvent[]) {
  const text = events
    .map((event) => `${event.createdAt}\t${event.actor}\t${event.title}`)
    .join('\n')
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'lorestra-history.txt'
  anchor.click()
  URL.revokeObjectURL(url)
}
