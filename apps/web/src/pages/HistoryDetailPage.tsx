import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  useHistoryQuery,
  useLocale,
  useNavigationQuery,
  useProposalQuery,
} from '../shared/api/hooks'
import {
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  MarkdownContent,
  formatDate,
} from '../shared/ui'

export function HistoryDetailPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { eventId } = useParams<{ eventId: string }>()
  const [params] = useSearchParams()
  const cursor = params.get('cursor') ?? undefined
  const history = useHistoryQuery(undefined, cursor)
  const historyHref = cursor ? `/history?cursor=${encodeURIComponent(cursor)}` : '/history'
  const navigation = useNavigationQuery()
  const event = useMemo(
    () => history.data?.events.find((item) => item.id === eventId),
    [eventId, history.data?.events],
  )
  const document = useMemo(
    () =>
      navigation.data?.documents.find(
        (item) => item.id === event?.documentId || item.slug === event?.documentSlug,
      ),
    [event?.documentId, event?.documentSlug, navigation.data?.documents],
  )
  const proposal = useProposalQuery(event?.proposalId)

  if (
    history.isLoading ||
    navigation.isLoading ||
    (event?.proposalId && proposal.isLoading)
  )
    return <LoadingState />
  if (history.isError || navigation.isError || proposal.isError)
    return (
      <ErrorState
        onRetry={() => {
          void history.refetch()
          void navigation.refetch()
          void proposal.refetch()
        }}
      />
    )
  if (!event)
    return (
      <div className="page-surface">
        <EmptyState
          title={t('history.noEvents')}
          action={
            <Link className="button button-secondary" to={historyHref}>
              <Icon name="back" />
              {t('history.back')}
            </Link>
          }
        />
      </div>
    )

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner history-detail">
        <Link className="button button-secondary" to={historyHref}>
          <Icon name="back" />
          {t('history.back')}
        </Link>
        <div className="surface history-detail-card">
          <span className="eyebrow">
            {t('history.eventDetail')} ·{' '}
            {t(`history.eventTypes.${event.type}`, { defaultValue: event.type })}
          </span>
          <h1 id="page-heading" tabIndex={-1}>
            {event.title}
          </h1>
          <p>
            {event.revisionId
              ? t('history.publishedRevision', {
                  version: event.revisionId.replace(/^v/, ''),
                })
              : event.body || t('history.immutable')}
          </p>
          <div className="history-detail-meta">
            <span>{event.actor}</span>
            <time dateTime={event.createdAt}>
              {formatDate(event.createdAt, locale, {
                dateStyle: 'full',
                timeStyle: 'short',
              })}
            </time>
          </div>
          {event.proposalId ? (
            <div className="detail-target">
              <span className="aside-label">{t('history.proposal')}</span>
              <Link
                className="target-chip"
                to={`/proposals/${encodeURIComponent(event.proposalId)}`}
              >
                {proposal.data?.title ?? event.proposalId}
              </Link>
            </div>
          ) : null}
          {document ? (
            <div className="detail-target">
              <span className="aside-label">{t('history.document')}</span>
              <Link
                className="target-chip"
                to={documentRevisionHref(document.slug, event.revisionId)}
              >
                {document.title}
              </Link>
            </div>
          ) : event.documentId ? (
            <div className="detail-target">
              <span className="aside-label">{t('history.document')}</span>
              <span className="target-chip">{event.documentId}</span>
            </div>
          ) : null}
          {event.revisionId ? (
            <div className="detail-target">
              <span className="aside-label">{t('history.resultingRevision')}</span>
              {document ? (
                <Link
                  className="target-chip"
                  to={documentRevisionHref(document.slug, event.revisionId)}
                >
                  {event.revisionId}
                </Link>
              ) : (
                <span className="target-chip">{event.revisionId}</span>
              )}
            </div>
          ) : null}
          {event.body && !event.revisionId ? (
            <div className="history-detail-body">
              <MarkdownContent source={event.body} />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function documentRevisionHref(slug: string, revisionId?: string): string {
  const match = revisionId?.match(/^v(\d+)$/)
  const version = match?.[1] ? `&version=${encodeURIComponent(match[1])}` : ''
  return `/documents/${encodeURIComponent(slug)}?tab=history${version}`
}
