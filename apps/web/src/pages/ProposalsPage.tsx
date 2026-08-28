import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useProposalsQuery } from '../shared/api/hooks'
import type { Proposal, ProposalStatus } from '../shared/model/types'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  PageHeading,
  Pagination,
  StatusBadge,
  formatRelativeDate,
} from '../shared/ui'

const filters: Array<ProposalStatus | 'all'> = [
  'all',
  'open',
  'changes-requested',
  'approved',
  'merged',
]

const PAGE_SIZE = 30

export function ProposalsPage() {
  const { t } = useTranslation()
  const locale = useCurrentLocale()
  const [params, setParams] = useSearchParams()
  const status = normalizeStatus(params.get('status'))
  const cursor = params.get('cursor') ?? undefined
  const proposals = useProposalsQuery(status, cursor)
  const visible = proposals.data?.items ?? []

  const updateCursor = (nextCursor: string | null) => {
    const next = new URLSearchParams(params)
    if (nextCursor && nextCursor !== '0') next.set('cursor', nextCursor)
    else next.delete('cursor')
    setParams(next)
  }

  const changeStatus = (nextStatus: ProposalStatus | 'all') => {
    const nextParams = new URLSearchParams(params)
    if (nextStatus === 'all') nextParams.delete('status')
    else nextParams.set('status', nextStatus)
    nextParams.delete('cursor')
    setParams(nextParams)
  }

  if (proposals.isLoading) return <LoadingState />
  if (proposals.isError)
    return <ErrorState onRetry={() => void proposals.refetch()} />

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner">
        <PageHeading
          kicker={t('proposals.kicker')}
          title={t('proposals.title')}
          lead={t('proposals.lead')}
          actions={
            <Link className="button button-primary" to="/library?new=1">
              <Icon name="plus" />
              {t('proposals.newProposal')}
            </Link>
          }
        />
        <div className="proposal-toolbar">
          <div
            className="filter-chips"
            role="group"
            aria-label={t('proposals.listLabel')}
          >
            {filters.map((item) => (
              <button
                type="button"
                className={`filter-chip ${status === item ? 'is-active' : ''}`}
                aria-pressed={status === item}
                key={item}
                onClick={() => changeStatus(item)}
              >
                {t(
                  `proposals.${item === 'changes-requested' ? 'changesRequested' : item}`,
                )}
                {status === item && proposals.data ? (
                  <span className="filter-count">
                    {proposals.data.pageInfo.totalCount}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
          <span className="muted-paper">
            {t('proposals.awaiting', {
              count: visible.filter(
                (item) =>
                  item.status === 'open' || item.status === 'changes-requested',
              ).length,
            })}
          </span>
        </div>
        {visible.length && proposals.data ? (
          <div className="proposal-queue-shell">
            <header className="proposal-queue-header">
              <div>
                <span className="proposal-queue-icon" aria-hidden="true">
                  ⇄
                </span>
                <div>
                  <strong>{t('proposals.reviewQueue')}</strong>
                  <span>
                    {t('proposals.queueSummary', {
                      count: proposals.data.pageInfo.totalCount,
                    })}
                  </span>
                </div>
              </div>
              <span className="proposal-queue-policy">
                {t('proposals.queuePolicy')}
              </span>
            </header>
            <div className="proposal-queue" aria-label={t('proposals.listLabel')}>
              {visible.map((proposal) => (
                <ProposalRow key={proposal.id} proposal={proposal} locale={locale} />
              ))}
            </div>
            <Pagination
              pageInfo={proposals.data.pageInfo}
              pageSize={Math.min(PAGE_SIZE, visible.length)}
              cursor={cursor}
              onPrevious={updateCursor}
              onNext={updateCursor}
            />
          </div>
        ) : (
          <EmptyState
            title={t('proposals.emptyTitle')}
            body={t('proposals.emptyBody')}
            action={
              status !== 'all' ? (
                <Button variant="secondary" onClick={() => changeStatus('all')}>
                  {t('proposals.all')}
                </Button>
              ) : null
            }
          />
        )}
      </div>
    </section>
  )
}

function ProposalRow({
  proposal,
  locale,
}: {
  proposal: Proposal
  locale: 'en' | 'pt-BR'
}) {
  const { t } = useTranslation()
  return (
    <article className="proposal-row" data-status={proposal.status}>
      <span className="proposal-state-icon" aria-hidden="true">
        <span />
      </span>
      <Link
        className="proposal-row-link"
        to={`/proposals/${encodeURIComponent(proposal.id)}`}
        aria-label={t('proposals.openProposal', { number: proposal.number })}
      >
        <div className="proposal-row-title">
          <strong>{proposal.title}</strong>
          <span className="proposal-number">#{proposal.number}</span>
          {proposal.createsDocument ? (
            <span className="proposal-new-label">{t('proposals.newDocument')}</span>
          ) : null}
        </div>
        <p>{proposal.summary || proposal.body.slice(0, 180)}</p>
        <div className="proposal-row-meta">
          <span>
            {t('proposals.updatedBy', {
              date: formatRelativeDate(proposal.updatedAt, locale),
              author: proposal.author,
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span>{t('proposals.changeCount', { count: proposal.changeCount })}</span>
        </div>
      </Link>
      <div className="proposal-row-status">
        <StatusBadge status={proposal.status} />
        <Icon name="arrow" />
      </div>
    </article>
  )
}

function normalizeStatus(value: string | null): ProposalStatus | 'all' {
  return value === 'open' ||
    value === 'changes-requested' ||
    value === 'approved' ||
    value === 'merged'
    ? value
    : 'all'
}

function useCurrentLocale(): 'en' | 'pt-BR' {
  const { i18n } = useTranslation()
  return i18n.language === 'pt-BR' ? 'pt-BR' : 'en'
}
