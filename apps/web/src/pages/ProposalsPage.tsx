import { useMemo } from 'react'
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

export function ProposalsPage() {
  const { t } = useTranslation()
  const locale = useCurrentLocale()
  const [params, setParams] = useSearchParams()
  const status = normalizeStatus(params.get('status'))
  const proposals = useProposalsQuery(status)
  const visible = useMemo(() => {
    const items = proposals.data ?? []
    return status === 'all' ? items : items.filter((item) => item.status === status)
  }, [proposals.data, status])

  const changeStatus = (next: ProposalStatus | 'all') => {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('status')
    else nextParams.set('status', next)
    nextParams.delete('proposal')
    setParams(nextParams)
  }

  if (proposals.isLoading) return <LoadingState />
  if (proposals.isError) return <ErrorState onRetry={() => void proposals.refetch()} />

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
              </button>
            ))}
          </div>
          <span className="muted-paper">
            {t('proposals.awaiting', {
              count: visible.filter(
                (item) => item.status === 'open' || item.status === 'changes-requested',
              ).length,
            })}
          </span>
        </div>
        {visible.length ? (
          <div className="proposal-layout proposal-layout-list">
            <div className="proposal-list" aria-label={t('proposals.listLabel')}>
              {visible.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} locale={locale} />
              ))}
            </div>
            <div className="proposal-list-note">
              <span className="eyebrow">{t('proposals.reviewSummary')}</span>
              <h2>{t('proposals.noSelection')}</h2>
              <p>{t('proposals.detailPrompt')}</p>
            </div>
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

function ProposalCard({
  proposal,
  locale,
}: {
  proposal: Proposal
  locale: 'en' | 'pt-BR'
}) {
  const { t } = useTranslation()
  return (
    <Link
      className="proposal-card"
      to={`/proposals/${encodeURIComponent(proposal.id)}`}
      aria-label={t('proposals.openProposal', { number: proposal.number })}
    >
      <div className="proposal-card-top">
        <span className="proposal-number">#{proposal.number}</span>
        <StatusBadge status={proposal.status} />
      </div>
      <h2>{proposal.title}</h2>
      <p>{proposal.summary || proposal.body.slice(0, 130)}</p>
      <div className="proposal-card-meta">
        <span>{proposal.author}</span>
        <span>{formatRelativeDate(proposal.updatedAt, locale)}</span>
        <span>{t('proposals.files', { count: proposal.changeCount })}</span>
      </div>
    </Link>
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
