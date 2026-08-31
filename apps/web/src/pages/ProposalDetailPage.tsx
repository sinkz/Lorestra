import { ProposalEditorDialog } from '../features/proposals/ProposalEditorDialog'
import { useSession } from '../shared/api/session'
import { errorMessageKey } from '../shared/api/errors'
import type { DurableProposalTransitionInput } from '@lorestra/contracts'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useMutation } from '@tanstack/react-query'
import { useAppClients } from '../shared/api/client'
import { useLocale, useProposalQuery } from '../shared/api/hooks'
import type { ProposalFile, Proposal } from '../shared/model/types'
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
  const { session } = useSession()
  const [editing, setEditing] = useState(false)
  const [mergeSnapshot, setMergeSnapshot] = useState<Proposal | null>(null)
  const [reviewVersion, setReviewVersion] = useState<number | null>(null)
  const [fileIndex, setFileIndex] = useState(0)
  const proposalQuery = useProposalQuery(proposalId)
  const [changesOpen, setChangesOpen] = useState(false)
  const proposal = proposalQuery.data
  const transition = useMutation({
    mutationFn: (input: DurableProposalTransitionInput) =>
      clients.proposals.transition(input),
    onSuccess: () => {
      setChangesOpen(false)
      setMergeSnapshot(null)
    },
  })
  const changeStatus = (
    status: DurableProposalTransitionInput['status'],
    reason?: string,
    snapshot = proposal,
  ) => {
    if (!snapshot?.proposalVersion) return
    transition.mutate({
      proposalId: snapshot.id,
      expectedProposalVersion:
        status === 'changes_requested'
          ? (reviewVersion ?? snapshot.proposalVersion)
          : snapshot.proposalVersion,
      status,
      reason,
      ...(status === 'merged' && snapshot.contentHash
        ? {
            confirmation: {
              proposalId: snapshot.id,
              proposalVersion: snapshot.proposalVersion,
              contentHash: snapshot.contentHash,
            },
          }
        : {}),
    })
  }

  if (proposalQuery.isLoading) return <LoadingState />
  if (proposalQuery.isError)
    return (
      <ErrorState
        error={proposalQuery.error}
        onRetry={() => void proposalQuery.refetch()}
      />
    )
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
    session.capabilities.reviewProposal &&
    !session.readOnly.enabled &&
    Boolean(proposal.proposalVersion) &&
    (proposal.status === 'open' || proposal.status === 'changes-requested')
  const canMerge =
    session.capabilities.mergeProposal &&
    !session.readOnly.enabled &&
    proposal.status === 'approved' &&
    Boolean(proposal.proposalVersion && proposal.contentHash)
  const canEdit =
    !session.readOnly.enabled &&
    proposal.status !== 'merged' &&
    Boolean(proposal.proposalVersion) &&
    proposal.files.every((file) => Boolean(file.change)) &&
    (session.capabilities.editAnyProposal ||
      (session.capabilities.editOwnProposal &&
        proposal.authorId === session.principal?.id))

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
            {proposal.proposalVersion ? (
              <span>
                {t('editor.proposalVersion', { version: proposal.proposalVersion })}
              </span>
            ) : null}
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
                  const displayPath =
                    file.path ??
                    (file.slug ? `${file.slug}.md` : t('proposals.pathUnavailable'))
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
                  return file.slug &&
                    (file.documentId || proposal.status === 'merged') ? (
                    <Link
                      className="file-chip"
                      to={`/documents/${encodeURIComponent(file.slug ?? '')}?tab=preview`}
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
            {proposal.files.length > 1 ? (
              <label className="form-field">
                <span>{t('proposals.affectedFiles')}</span>
                <select
                  value={fileIndex}
                  onChange={(event) => setFileIndex(Number(event.target.value))}
                >
                  {proposal.files.map((file, index) => (
                    <option key={index} value={index}>
                      {index + 1}. {file.path ?? file.slug}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {proposal.files[Math.min(fileIndex, proposal.files.length - 1)] ? (
              <DiffFile
                file={proposal.files[Math.min(fileIndex, proposal.files.length - 1)]}
              />
            ) : null}
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
            {canEdit ? (
              <Button
                variant="secondary"
                disabled={transition.isPending}
                onClick={() => setEditing(true)}
              >
                {t('editor.editProposal')}
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                variant="primary"
                disabled={transition.isPending}
                onClick={() => changeStatus('approved')}
              >
                {t('proposals.approve')}
              </Button>
            ) : null}
            {canApprove ? (
              <Button
                variant="danger"
                disabled={transition.isPending}
                onClick={() => {
                  setReviewVersion(proposal.proposalVersion ?? null)
                  setChangesOpen(true)
                }}
              >
                {t('proposals.requestChanges')}
              </Button>
            ) : null}
            {canMerge ? (
              <Button
                variant="primary"
                disabled={transition.isPending}
                onClick={() => setMergeSnapshot(proposal)}
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
                {t(errorMessageKey(transition.error))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <ProposalEditorDialog
        open={editing}
        proposal={proposal}
        onClose={() => setEditing(false)}
        onCreated={() => void proposalQuery.refetch()}
      />
      <ModalDialog
        className="memory-dialog"
        open={Boolean(mergeSnapshot)}
        aria-labelledby="confirm-merge-title"
        onRequestClose={() => {
          if (!transition.isPending) setMergeSnapshot(null)
        }}
      >
        <div className="memory-dialog-card">
          <h2 id="confirm-merge-title">{t('editor.confirmMerge')}</h2>
          <p>
            {t('editor.mergeExplanation', {
              title: mergeSnapshot?.title,
              version: mergeSnapshot?.proposalVersion,
            })}
          </p>
          <dl className="merge-confirmation-target">
            <div>
              <dt>{t('editor.proposalId')}</dt>
              <dd>
                <code>{mergeSnapshot?.id}</code>
              </dd>
            </div>
            <div>
              <dt>{t('document.version')}</dt>
              <dd>v{mergeSnapshot?.proposalVersion}</dd>
            </div>
            <div>
              <dt>{t('editor.contentHash')}</dt>
              <dd>
                <code>{mergeSnapshot?.contentHash}</code>
              </dd>
            </div>
          </dl>
          <div className="dialog-actions">
            <Button
              variant="secondary"
              disabled={transition.isPending}
              onClick={() => setMergeSnapshot(null)}
            >
              {t('document.cancel')}
            </Button>
            <Button
              variant="primary"
              disabled={transition.isPending}
              onClick={() => changeStatus('merged', undefined, mergeSnapshot)}
            >
              {t('editor.confirmMerge')}
            </Button>
          </div>
          {transition.isError ? (
            <p className="field-error" role="alert">
              {t(errorMessageKey(transition.error))}
            </p>
          ) : null}
        </div>
      </ModalDialog>
      <ChangesDialog
        open={changesOpen}
        isSubmitting={transition.isPending}
        onClose={() => setChangesOpen(false)}
        onSubmit={(reason) => changeStatus('changes_requested', reason)}
      />
    </section>
  )
}

function DiffFile({ file }: { file: ProposalFile }) {
  const { t } = useTranslation()
  const displayPath =
    file.path ?? (file.slug ? `${file.slug}.md` : t('proposals.pathUnavailable'))
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
        {file.change ? (
          <details className="proposal-metadata-diff">
            <summary>{t('editor.metadata')}</summary>
            <dl>
              <div>
                <dt>{t('editor.documentTitle')}</dt>
                <dd>{file.change.target.title}</dd>
              </div>
              <div>
                <dt>Slug</dt>
                <dd>{file.change.target.slug}</dd>
              </div>
              {Object.entries(file.change.metadata).map(([key, value]) => {
                const previous =
                  file.beforeMetadata?.[
                    key as keyof NonNullable<typeof file.beforeMetadata>
                  ]
                const changed =
                  previous !== undefined &&
                  JSON.stringify(previous) !== JSON.stringify(value)
                return (
                  <div key={key}>
                    <dt>{t(`editor.metadataFields.${key}`, { defaultValue: key })}</dt>
                    <dd>
                      {changed ? (
                        <>
                          <del>
                            {Array.isArray(previous)
                              ? previous.join(', ')
                              : String(previous)}
                          </del>{' '}
                          →{' '}
                        </>
                      ) : null}
                      {Array.isArray(value) ? value.join(', ') : String(value)}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </details>
        ) : null}
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
