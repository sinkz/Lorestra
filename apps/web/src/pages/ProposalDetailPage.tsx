import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppClients } from '../shared/api/client'
import { useLocale, useNavigationQuery, useProposalQuery } from '../shared/api/hooks'
import type { ProposalFile, ProposalStatus } from '../shared/model/types'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  ModalDialog,
  MarkdownContent,
  StatusBadge,
  formatDate,
} from '../shared/ui'

type ChangesForm = { reason: string }

export function ProposalDetailPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { proposalId } = useParams<{ proposalId: string }>()
  const clients = useAppClients()
  const queryClient = useQueryClient()
  const navigation = useNavigationQuery()
  const proposalQuery = useProposalQuery(proposalId)
  const [changesOpen, setChangesOpen] = useState(false)
  const proposal = proposalQuery.data
  const transition = useMutation({
    mutationFn: (input: { status: Exclude<ProposalStatus, 'open'>; reason?: string }) =>
      clients.proposals.transition({ proposalId: proposalId ?? '', ...input, locale }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] }),
        queryClient.invalidateQueries({ queryKey: ['proposals'] }),
        queryClient.invalidateQueries({ queryKey: ['history'] }),
        queryClient.invalidateQueries({ queryKey: ['navigation', locale] }),
        queryClient.invalidateQueries({ queryKey: ['document'] }),
        queryClient.invalidateQueries({ queryKey: ['graph'] }),
        queryClient.invalidateQueries({ queryKey: ['search'] }),
      ])
      setChangesOpen(false)
    },
  })

  const fileDocuments = useMemo(() => {
    if (!proposal || !navigation.data) return new Map<string, string>()
    return new Map(
      navigation.data.documents.map((document) => [document.id, document.slug]),
    )
  }, [navigation.data, proposal])

  if (proposalQuery.isLoading) return <LoadingState />
  if (proposalQuery.isError)
    return <ErrorState onRetry={() => void proposalQuery.refetch()} />
  if (!proposal)
    return (
      <div className="page-surface">
        <EmptyState
          title={t('proposals.emptyTitle')}
          action={
            <Link className="button button-secondary" to="/proposals">
              {t('proposals.back')}
            </Link>
          }
        />
      </div>
    )

  const passed = proposal.checks.filter((check) => check.status === 'passed').length
  const canApprove =
    proposal.status === 'open' || proposal.status === 'changes-requested'
  const canMerge = proposal.status === 'approved'

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner">
        <Link className="button button-secondary proposal-back" to="/proposals">
          <Icon name="back" />
          {t('proposals.back')}
        </Link>
        <div className="proposal-detail">
          <header className="proposal-detail-header">
            <div>
              <span className="proposal-number">#{proposal.number}</span>
              <h1 id="page-heading" tabIndex={-1}>
                {proposal.title}
              </h1>
              <p>{proposal.summary || proposal.body.slice(0, 180)}</p>
            </div>
            <StatusBadge status={proposal.status} />
          </header>
          <div className="review-summary">
            <span>
              {t('proposals.checks', { passed, total: proposal.checks.length })}
            </span>
            <span>·</span>
            <span>{proposal.author}</span>
            <span>·</span>
            <span>{formatDate(proposal.updatedAt, locale)}</span>
          </div>
          <section className="proposal-section">
            <h2 className="sr-only">{t('proposals.reviewSummary')}</h2>
            <MarkdownContent source={proposal.body} />
          </section>
          <section className="proposal-section">
            <h3>{t('proposals.affectedFiles')}</h3>
            <div className="file-chip-list">
              {proposal.files.length ? (
                proposal.files.map((file, index) => {
                  const displayPath = file.path ?? t('proposals.pathUnavailable')
                  const fileLabel = (
                    <>
                      <Icon name="file" />
                      {displayPath}
                      {file.changeType === 'added' ? (
                        <span className="file-badge">{t('proposals.newFile')}</span>
                      ) : null}
                    </>
                  )
                  const key = `${proposal.id}-file-${index}`
                  return file.documentId && fileDocuments.get(file.documentId) ? (
                    <Link
                      className="file-chip"
                      to={`/documents/${encodeURIComponent(fileDocuments.get(file.documentId) ?? '')}?tab=preview`}
                      key={key}
                    >
                      {fileLabel}
                    </Link>
                  ) : (
                    <span className="file-chip" key={key}>
                      {fileLabel}
                    </span>
                  )
                })
              ) : (
                <span className="muted-paper">
                  {t('proposals.files', { count: 0 })}
                </span>
              )}
            </div>
            {proposal.files.map((file, index) => (
              <DiffFile file={file} key={`${proposal.id}-diff-${index}`} />
            ))}
          </section>
          <section className="proposal-section">
            <h3>{t('proposals.checks', { passed, total: proposal.checks.length })}</h3>
            <ul className="check-list">
              {proposal.checks.length ? (
                proposal.checks.map((check) => (
                  <li key={check.id} className={`check-${check.status}`}>
                    <span aria-hidden="true">
                      {check.status === 'passed'
                        ? '✓'
                        : check.status === 'failed'
                          ? '×'
                          : '…'}
                    </span>
                    {check.label}
                  </li>
                ))
              ) : (
                <li className="check-pending">{t('proposals.formatValid')}</li>
              )}
            </ul>
          </section>
          <div className="proposal-actions" aria-label={t('proposals.detailLabel')}>
            {canApprove ? (
              <Button
                variant="primary"
                disabled={transition.isPending}
                onClick={() => transition.mutate({ status: 'approved' })}
              >
                {t('proposals.approve')}
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                variant="danger"
                disabled={transition.isPending}
                onClick={() => setChangesOpen(true)}
              >
                {t('proposals.requestChanges')}
              </Button>
            ) : null}
            {canMerge ? (
              <Button
                variant="primary"
                disabled={transition.isPending}
                onClick={() => transition.mutate({ status: 'merged' })}
              >
                {t('proposals.merge')}
              </Button>
            ) : null}
            {proposal.status === 'merged' ? (
              <span className="merged-note">
                <Icon name="check" />
                {t('proposals.merged')}
              </span>
            ) : null}
            {transition.isError ? (
              <span className="field-error" role="alert">
                {t('common.errorTitle')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <ChangesDialog
        open={changesOpen}
        isSubmitting={transition.isPending}
        onClose={() => setChangesOpen(false)}
        onSubmit={(reason) =>
          transition.mutate({ status: 'changes-requested', reason })
        }
      />
    </section>
  )
}

function DiffFile({ file }: { file: ProposalFile }) {
  const { t } = useTranslation()
  const displayPath = file.path ?? t('proposals.pathUnavailable')
  return (
    <div className="diff-file">
      <div className="diff-file-header">
        <span>
          {displayPath}
          {file.changeType === 'added' ? (
            <span className="file-badge">{t('proposals.newFile')}</span>
          ) : null}
        </span>
        <span>
          +{file.additions} −{file.deletions}
        </span>
      </div>
      <div className="diff-lines">
        {file.diff.length ? (
          file.diff.map((line, index) => (
            <div className={`diff-line ${line.type}`} key={`${displayPath}-${index}`}>
              <span className="diff-line-number">{line.lineNumber ?? ''}</span>
              <code>{`${line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '} ${line.text}`}</code>
            </div>
          ))
        ) : (
          <div className="diff-line context">
            <span className="diff-line-number">·</span>
            <code>{t('proposals.noDiff')}</code>
          </div>
        )}
      </div>
    </div>
  )
}

function ChangesDialog({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: {
  open: boolean
  isSubmitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
}) {
  const { t } = useTranslation()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangesForm>({ defaultValues: { reason: '' } })
  useEffect(() => {
    if (open) reset({ reason: '' })
  }, [open, reset])
  return (
    <ModalDialog
      className="memory-dialog"
      open={open}
      aria-labelledby="changes-title"
      onRequestClose={onClose}
    >
      <div className="memory-dialog-card">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{t('proposals.requestChanges')}</span>
            <h2 id="changes-title">{t('proposals.reasonField')}</h2>
          </div>
          <Button
            variant="subtle"
            icon="close"
            aria-label={t('common.close')}
            onClick={onClose}
          />
        </div>
        <form
          onSubmit={(event) =>
            void handleSubmit((values) => onSubmit(values.reason))(event)
          }
        >
          <label className="form-field">
            <span>{t('proposals.reasonField')}</span>
            <textarea
              autoFocus
              rows={6}
              {...register('reason', { required: true })}
              placeholder={t('proposals.reasonPlaceholder')}
            />
            {errors.reason ? (
              <small className="field-error">{t('common.required')}</small>
            ) : null}
          </label>
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('document.cancel')}
            </Button>
            <Button type="submit" variant="danger" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('proposals.requestChanges')}
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  )
}
