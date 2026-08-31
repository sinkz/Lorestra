import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { DurableCreateProposalInputSchema } from '@lorestra/contracts'
import { useAppClients } from '../../shared/api/client'
import { useLocale, useNavigationQuery } from '../../shared/api/hooks'
import { useSession } from '../../shared/api/session'
import { ApiError, errorMessageKey } from '../../shared/api/errors'
import type { Document, Proposal } from '../../shared/model/types'
import { Button, ModalDialog } from '../../shared/ui'
import {
  documentDraft,
  proposalDraft,
  toProposalInput,
  type ProposalDraft,
} from './draft'

export function ProposalEditorDialog({
  open,
  document,
  initialBody,
  proposal,
  onClose,
  onCreated,
}: {
  open: boolean
  document?: Document
  initialBody?: string
  proposal?: Proposal
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const locale = useLocale()
  const clients = useAppClients()
  const { session } = useSession()
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)
  const [fileIndex, setFileIndex] = useState(0)
  const wasOpen = useRef(false)
  const expectedVersion = useRef<number | undefined>(undefined)
  const navigation = useNavigationQuery()
  const {
    register,
    watch,
    reset,
    handleSubmit,
    getValues,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<ProposalDraft>({
    defaultValues: documentDraft(document, locale, initialBody),
  })
  const files = watch('files')
  const current = files?.[fileIndex]
  const draftKey = `lorestra-draft:${session.vaultId}:${session.principal?.id ?? 'visitor'}:${proposal?.id ?? document?.id ?? 'new'}`
  useEffect(() => {
    if (open && !wasOpen.current) {
      const draft = proposal
        ? proposalDraft(proposal)
        : documentDraft(document, locale, initialBody)
      if (!document && !proposal && draft.files[0])
        draft.files[0].folderId = navigation.data?.folders[0]?.id ?? ''
      reset(draft)
      expectedVersion.current = proposal?.proposalVersion
      setFileIndex(0)
      setSaved(false)
      setError(null)
    }
    wasOpen.current = open
  }, [open, proposal, document, locale, initialBody, reset, navigation.data?.folders])
  useEffect(() => {
    if (!open || !isDirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [open, isDirty])
  const close = () => {
    if (isSubmitting) return
    if (isDirty && !saved && !window.confirm(t('editor.discard'))) return
    onClose()
  }
  const submit = async (values: ProposalDraft) => {
    setError(null)
    try {
      const parsed = DurableCreateProposalInputSchema.safeParse(toProposalInput(values))
      if (!parsed.success) throw new ApiError(422, 'validation_error')
      const input = parsed.data
      const created = proposal
        ? await clients.proposals.update({
            ...input,
            proposalId: proposal.id,
            expectedProposalVersion: expectedVersion.current!,
          })
        : await clients.proposals.create(input)
      try {
        localStorage.removeItem(draftKey)
      } catch {
        /* A completed server operation stays successful even if device storage is disabled. */
      }
      reset(values)
      onClose()
      onCreated(created.id)
    } catch (cause) {
      setError(cause)
    }
  }
  const restore = () => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (!stored) return
      const value = JSON.parse(stored) as ProposalDraft
      DurableCreateProposalInputSchema.parse(toProposalInput(value))
      reset(value)
      setSaved(true)
    } catch {
      setError(new ApiError(400, 'INVALID_DRAFT'))
    }
  }
  const folders =
    navigation.data?.folders.flatMap(
      function flatten(folder): typeof navigation.data.folders {
        return [folder, ...folder.children.flatMap(flatten)]
      },
    ) ?? []
  return (
    <ModalDialog
      className="memory-dialog"
      open={open}
      aria-labelledby="proposal-editor-title"
      onRequestClose={close}
    >
      <div className="memory-dialog-card">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">
              {t(proposal ? 'editor.editProposal' : 'proposals.newProposal')}
            </span>
            <h2 id="proposal-editor-title">
              {document?.title ?? proposal?.title ?? t('shell.newMemory')}
            </h2>
          </div>
          <Button
            variant="subtle"
            icon="close"
            aria-label={t('common.close')}
            onClick={close}
            disabled={isSubmitting}
          />
        </div>
        <p className="editor-note">
          {t('document.sourceNote')}{' '}
          {current?.baseVersion
            ? t('editor.baseVersion', { version: current.baseVersion })
            : t('proposals.newFile')}
        </p>
        <form
          onChange={() => setSaved(false)}
          onSubmit={(event) => void handleSubmit(submit)(event)}
        >
          <label className="form-field">
            <span>{t('proposals.titleField')}</span>
            <input
              autoFocus
              {...register('title', { required: true, maxLength: 240 })}
            />
            {errors.title ? (
              <small className="field-error">{t('common.required')}</small>
            ) : null}
          </label>
          <label className="form-field">
            <span>{t('editor.summary')}</span>
            <input {...register('summary', { maxLength: 500 })} />
          </label>
          <label className="form-field">
            <span>{t('proposals.reasonField')}</span>
            <input
              {...register('reason', { maxLength: 1000 })}
              placeholder={t('proposals.reasonPlaceholder')}
            />
          </label>
          {files?.length > 1 ? (
            <label className="form-field">
              <span>{t('proposals.affectedFiles')}</span>
              <select
                value={fileIndex}
                onChange={(event) => setFileIndex(Number(event.target.value))}
              >
                {files.map((file, index) => (
                  <option value={index} key={file.id}>
                    {index + 1}. {file.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {current ? (
            <div key={current.id}>
              {current.documentId ? (
                <label className="form-field">
                  <span>{t('editor.operation')}</span>
                  <select {...register(`files.${fileIndex}.changeType`)}>
                    <option value="modified">{t('editor.modify')}</option>
                    <option value="deleted">{t('editor.delete')}</option>
                  </select>
                </label>
              ) : null}
              <label className="form-field">
                <span>{t('document.markdown')}</span>
                <textarea
                  rows={12}
                  disabled={current.changeType === 'deleted'}
                  {...register(`files.${fileIndex}.body`)}
                />
              </label>
              <details className="editor-metadata">
                <summary>{t('editor.metadata')}</summary>
                <div className="editor-metadata-grid">
                  <label className="form-field">
                    <span>{t('editor.documentTitle')}</span>
                    <input {...register(`files.${fileIndex}.title`)} />
                  </label>
                  <label className="form-field">
                    <span>Slug</span>
                    <input
                      {...register(`files.${fileIndex}.slug`)}
                      pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    />
                  </label>
                  <label className="form-field">
                    <span>{t('library.type')}</span>
                    <select {...register(`files.${fileIndex}.type`)}>
                      {[
                        'note',
                        'lesson',
                        'decision',
                        'incident',
                        'process',
                        'document',
                      ].map((type) => (
                        <option key={type} value={type}>
                          {t(`editor.types.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t('common.locale')}</span>
                    <select
                      {...register(`files.${fileIndex}.locale`)}
                      disabled={Boolean(current.documentId)}
                    >
                      <option value="en">English</option>
                      <option value="pt-BR">Português (Brasil)</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t('folders.title')}</span>
                    <input
                      list="editor-folders"
                      {...register(`files.${fileIndex}.folderId`)}
                    />
                    <datalist id="editor-folders">
                      {folders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.path}
                        </option>
                      ))}
                    </datalist>
                  </label>
                  <label className="form-field">
                    <span>{t('editor.visibility')}</span>
                    <select {...register(`files.${fileIndex}.visibility`)}>
                      <option value="public">{t('editor.public')}</option>
                      <option value="internal">{t('editor.internal')}</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t('library.status')}</span>
                    <select {...register(`files.${fileIndex}.status`)}>
                      {['published', 'archived', 'draft'].map((status) => (
                        <option key={status} value={status}>
                          {t(`common.${status}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t('document.tags')}</span>
                    <input
                      {...register(`files.${fileIndex}.tags`)}
                      placeholder={t('editor.commaSeparated')}
                    />
                  </label>
                  <label className="form-field">
                    <span>{t('editor.relations')}</span>
                    <input
                      {...register(`files.${fileIndex}.relations`)}
                      placeholder={t('editor.commaSeparated')}
                    />
                  </label>
                </div>
              </details>
            </div>
          ) : null}
          {error ? (
            <div className="field-error" role="alert">
              <p>{t(errorMessageKey(error))}</p>
              {error instanceof ApiError && error.requestId ? (
                <small>{t('apiErrors.reference', { id: error.requestId })}</small>
              ) : null}
              {error instanceof ApiError && error.status === 409 ? (
                <>
                  <p>{t('editor.conflictHelp')}</p>
                  {error.versions?.currentVersion ? (
                    <p>
                      {t('editor.versionConflict', {
                        base: current?.baseVersion ?? error.versions.baseVersion,
                        current: error.versions.currentVersion,
                      })}
                    </p>
                  ) : null}
                  {error.versions?.currentProposalVersion ? (
                    <p>
                      {t('editor.proposalConflict', {
                        base: expectedVersion.current,
                        current: error.versions.currentProposalVersion,
                      })}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}
          <p className="editor-note">
            {t(saved ? 'editor.savedLocally' : 'editor.unsent')}
          </p>
          <div className="dialog-actions editor-draft-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                try {
                  localStorage.setItem(draftKey, JSON.stringify(getValues()))
                  setSaved(true)
                } catch {
                  setError(new ApiError(503, 'LOCAL_STORAGE_UNAVAILABLE'))
                }
              }}
            >
              {t('editor.saveLocal')}
            </Button>
            <Button type="button" variant="secondary" onClick={restore}>
              {t('editor.restoreLocal')}
            </Button>
          </div>
          <div className="dialog-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={close}
              disabled={isSubmitting}
            >
              {t('document.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                isSubmitting ||
                !session.capabilities.createProposal ||
                session.readOnly.enabled
              }
            >
              {isSubmitting
                ? t('common.loading')
                : t(
                    proposal
                      ? 'editor.resubmit'
                      : document
                        ? 'document.proposeChanges'
                        : 'proposals.newProposal',
                  )}
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  )
}
