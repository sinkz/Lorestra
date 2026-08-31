import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAppClients } from '../shared/api/client'
import {
  useDocumentQuery,
  useHistoryQuery,
  useLocale,
  useNavigationQuery,
} from '../shared/api/hooks'
import type { Document, DocumentSummary, HistoryEvent } from '../shared/model/types'
import {
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MarkdownContent,
  ModalDialog,
  StatusBadge,
  formatDate,
} from '../shared/ui'

type DocumentTab = 'preview' | 'markdown' | 'relations' | 'history'
type ProposalForm = { title: string; body: string; reason: string }
const documentTabs: DocumentTab[] = ['preview', 'markdown', 'relations', 'history']

export function DocumentPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [source, setSource] = useState('')
  const [copied, setCopied] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const tabRefs = useRef<Partial<Record<DocumentTab, HTMLButtonElement | null>>>({})
  const requestedVersion = positiveVersion(params.get('version'))
  const documentQuery = useDocumentQuery(slug, requestedVersion)
  const navigation = useNavigationQuery()
  const document = documentQuery.data
  const history = useHistoryQuery(document?.id)
  const tab = normalizeTab(params.get('tab'))
  const documentSlugs = useMemo(
    () =>
      (navigation.data?.documents ?? [])
        .filter((item) => item.locale === locale)
        .map((item) => item.slug),
    [locale, navigation.data?.documents],
  )

  useEffect(() => {
    setSource(document?.body ?? '')
    setEditing(false)
    setCopied(false)
  }, [document?.id, document?.body])

  const relatedDocuments = useMemo(() => {
    if (!document || !navigation.data) return []
    const ids = new Set([
      ...document.relatedDocumentIds,
      ...document.outgoingLinks,
      ...document.inboundLinks,
    ])
    return navigation.data.documents.filter(
      (item) => ids.has(item.id) || ids.has(item.slug),
    )
  }, [document, navigation.data])

  const setTab = (next: DocumentTab) => {
    const nextParams = new URLSearchParams(params)
    nextParams.set('tab', next)
    setParams(nextParams)
    requestAnimationFrame(() => tabRefs.current[next]?.focus())
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  if (documentQuery.isLoading || navigation.isLoading) return <LoadingState />
  if (documentQuery.isError || navigation.isError)
    return (
      <ErrorState
        onRetry={() => {
          void documentQuery.refetch()
          void navigation.refetch()
        }}
      />
    )
  if (!document)
    return (
      <div className="page-surface">
        <EmptyState
          title={t('document.notFound')}
          action={
            <Link className="button button-secondary" to="/library">
              {t('document.backLibrary')}
            </Link>
          }
        />
      </div>
    )

  return (
    <section className="document" aria-labelledby="page-heading">
      <div className="document-toolbar">
        <div
          className="workspace-toggle"
          role="group"
          aria-label={t('document.document')}
        >
          <button type="button" className="is-active" aria-pressed="true">
            {t('document.document')}
          </button>
          <Link
            className="workspace-toggle-link"
            to={`/atlas?scope=related&document=${encodeURIComponent(document.id)}`}
          >
            {t('document.graph')}
          </Link>
        </div>
        <div className="document-path">
          <small>{document.folderPath}</small>
          <strong>{document.title}</strong>
        </div>
        <div className="document-actions">
          <Button variant="secondary" icon="link" onClick={() => void copyLink()}>
            {copied ? t('document.copied') : t('document.copyLink')}
          </Button>
          <Button variant="primary" icon="plus" onClick={() => setProposalOpen(true)}>
            {t('document.proposeChanges')}
          </Button>
        </div>
      </div>
      <header className="document-hero">
        <div className="document-hero-inner">
          <div className="document-status">
            <StatusBadge status={document.status} kind={document.kind} />
            <span className="document-kind">
              {t(`common.kind.${document.kind}`, { defaultValue: document.kind })}
            </span>
            <span className="document-kind">v{document.version}</span>
          </div>
          <h1 id="page-heading" tabIndex={-1}>
            {document.title}
          </h1>
          <p className="document-summary">{document.summary}</p>
        </div>
      </header>
      <nav className="document-tabs" aria-label={t('document.document')} role="tablist">
        {documentTabs.map((item, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === item}
            aria-controls="document-panel"
            id={`document-tab-${item}`}
            className={tab === item ? 'is-active' : ''}
            tabIndex={tab === item ? 0 : -1}
            ref={(element) => {
              tabRefs.current[item] = element
            }}
            key={item}
            onClick={() => setTab(item)}
            onKeyDown={(event) => {
              const nextIndex =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? documentTabs.length - 1
                    : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                      ? (index + 1) % documentTabs.length
                      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                        ? (index - 1 + documentTabs.length) % documentTabs.length
                        : -1
              if (nextIndex < 0) return
              event.preventDefault()
              setTab(documentTabs[nextIndex])
            }}
          >
            {t(`document.${item}`)}
          </button>
        ))}
      </nav>
      <div className="document-body">
        <div
          className="document-content"
          role="tabpanel"
          id="document-panel"
          aria-labelledby={`document-tab-${tab}`}
        >
          {tab === 'preview' ? (
            <MarkdownContent source={document.body} documentSlugs={documentSlugs} />
          ) : tab === 'markdown' ? (
            <MarkdownTab
              source={source}
              editing={editing}
              onChange={setSource}
              onEdit={() => setEditing(true)}
              onPropose={() => setProposalOpen(true)}
            />
          ) : tab === 'relations' ? (
            <RelationsTab document={document} relatedDocuments={relatedDocuments} />
          ) : (
            <DocumentHistoryTab
              events={
                history.data?.events ??
                document.revisions.map((revision) => ({
                  id: revision.id,
                  type: 'publish' as const,
                  title:
                    revision.summary ||
                    t('document.revision', { version: revision.version }),
                  body: '',
                  createdAt: revision.createdAt,
                  actor: revision.author,
                  revisionId: revision.id,
                  documentId: document.id,
                  proposalId: revision.proposalId,
                }))
              }
            />
          )}
        </div>
        <DocumentAside document={document} locale={locale} />
      </div>
      <ProposalDialog
        open={proposalOpen}
        document={document}
        initialBody={source || document.body}
        locale={locale}
        onClose={() => setProposalOpen(false)}
        onCreated={(id) => navigate(`/proposals/${encodeURIComponent(id)}`)}
      />
    </section>
  )
}

function normalizeTab(value: string | null): DocumentTab {
  return value === 'markdown' || value === 'relations' || value === 'history'
    ? value
    : 'preview'
}

function positiveVersion(value: string | null): number | undefined {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

function MarkdownTab({
  source,
  editing,
  onChange,
  onEdit,
  onPropose,
}: {
  source: string
  editing: boolean
  onChange: (value: string) => void
  onEdit: () => void
  onPropose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="editor-note">{t('document.sourceNote')}</p>
      {editing ? (
        <textarea
          className="source-editor"
          value={source}
          onChange={(event) => onChange(event.target.value)}
          aria-label={t('document.markdown')}
        />
      ) : (
        <pre className="markdown-source">
          <code>{source}</code>
        </pre>
      )}
      <div className="editor-actions">
        {editing ? (
          <Button variant="primary" onClick={onPropose}>
            {t('document.proposeChanges')}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onEdit}>
            {t('document.edit')}
          </Button>
        )}
      </div>
    </div>
  )
}

function RelationsTab({
  document,
  relatedDocuments,
}: {
  document: Document
  relatedDocuments: DocumentSummary[]
}) {
  const { t } = useTranslation()
  if (!relatedDocuments.length) return <EmptyState title={t('document.noRelations')} />
  return (
    <div>
      <div className="section-heading">
        <span className="eyebrow">{t('document.relations')}</span>
        <h2>{t('document.relations')}</h2>
        <p>{t('document.relationsLead')}</p>
      </div>
      <div className="relation-grid">
        {relatedDocuments.map((related) => (
          <Link
            className="relation-card"
            to={`/documents/${encodeURIComponent(related.slug)}?tab=preview`}
            key={related.id}
          >
            <small>
              {document.outgoingLinks.includes(related.id)
                ? t('document.linksOut')
                : t('document.backlinks')}
            </small>
            <strong>{related.title}</strong>
            <span>
              {related.folderPath} ·{' '}
              {t(`common.kind.${related.kind}`, { defaultValue: related.kind })}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function DocumentHistoryTab({ events }: { events: HistoryEvent[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  if (!events.length) return <EmptyState title={t('history.noEvents')} />
  return (
    <div className="timeline">
      {events.map((event) => (
        <div className="timeline-item" key={event.id}>
          <span className="timeline-dot" aria-hidden="true" />
          <Link
            className="history-link"
            to={`/history/${encodeURIComponent(event.id)}`}
          >
            <strong>{event.title}</strong>
            <p>{event.body || `${event.actor} · ${t('history.eventDetail')}`}</p>
            <time dateTime={event.createdAt}>
              {formatDate(event.createdAt, locale)}
            </time>
          </Link>
        </div>
      ))}
    </div>
  )
}

function DocumentAside({
  document,
  locale,
}: {
  document: Document
  locale: 'en' | 'pt-BR'
}) {
  const { t } = useTranslation()
  return (
    <aside className="document-aside">
      <div className="aside-section">
        <div className="aside-label">{t('document.contributors')}</div>
        <div className="avatar-stack" aria-label={document.author}>
          <span className="avatar">{document.author.slice(0, 2).toUpperCase()}</span>
        </div>
      </div>
      <div className="aside-section">
        <div className="aside-label">{t('document.details')}</div>
        <dl className="meta-list">
          <div className="meta-row">
            <dt>{t('document.version')}</dt>
            <dd>v{document.version}</dd>
          </div>
          <div className="meta-row">
            <dt>{t('library.updated')}</dt>
            <dd>{formatDate(document.updatedAt, locale)}</dd>
          </div>
          <div className="meta-row">
            <dt>{t('library.author')}</dt>
            <dd>{document.author}</dd>
          </div>
          <div className="meta-row">
            <dt>{t('document.linksOut')}</dt>
            <dd>{document.outgoingLinks.length}</dd>
          </div>
          <div className="meta-row">
            <dt>{t('document.backlinks')}</dt>
            <dd>{document.inboundLinks.length}</dd>
          </div>
        </dl>
      </div>
      {document.tags.length ? (
        <div className="aside-section">
          <div className="aside-label">{t('document.tags')}</div>
          <div className="tag-list">
            {document.tags.map((tag) => (
              <span className="tag" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  )
}

function ProposalDialog({
  open,
  document,
  initialBody,
  locale,
  onClose,
  onCreated,
}: {
  open: boolean
  document: Document
  initialBody: string
  locale: 'en' | 'pt-BR'
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useTranslation()
  const clients = useAppClients()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting, errors },
  } = useForm<ProposalForm>({
    defaultValues: { title: `Update ${document.title}`, body: initialBody, reason: '' },
  })

  useEffect(() => {
    if (open)
      reset({ title: `Update ${document.title}`, body: initialBody, reason: '' })
  }, [document.title, initialBody, open, reset])
  const close = () => {
    reset()
    setError('')
    onClose()
  }
  const submit = async (values: ProposalForm) => {
    try {
      const proposal = await clients.proposals.create({
        title: values.title,
        body: `${values.reason ? `${values.reason}\n\n` : ''}${values.body}`,
        documentId: document.id,
        locale,
      })
      await queryClient.invalidateQueries({ queryKey: ['proposals'] })
      close()
      onCreated(proposal.id)
    } catch {
      setError(t('common.errorTitle'))
    }
  }

  return (
    <ModalDialog
      className="memory-dialog"
      open={open}
      aria-labelledby="proposal-dialog-title"
      onRequestClose={close}
    >
      <div className="memory-dialog-card">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{t('document.proposeChanges')}</span>
            <h2 id="proposal-dialog-title">{document.title}</h2>
          </div>
          <Button
            variant="subtle"
            icon="close"
            aria-label={t('common.close')}
            onClick={close}
          />
        </div>
        <p className="editor-note">{t('document.sourceNote')}</p>
        <form onSubmit={(event) => void handleSubmit(submit)(event)}>
          <label className="form-field">
            <span>{t('proposals.titleField')}</span>
            <input autoFocus {...register('title', { required: true })} />
            {errors.title ? (
              <small className="field-error">{t('common.required')}</small>
            ) : null}
          </label>
          <label className="form-field">
            <span>{t('proposals.reasonField')}</span>
            <input
              {...register('reason')}
              placeholder={t('proposals.reasonPlaceholder')}
            />
          </label>
          <label className="form-field">
            <span>{t('document.markdown')}</span>
            <textarea {...register('body', { required: true })} rows={12} />
            {errors.body ? (
              <small className="field-error">{t('common.required')}</small>
            ) : null}
          </label>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="dialog-actions">
            <Button type="button" variant="secondary" onClick={close}>
              {t('document.cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('document.proposeChanges')}
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  )
}
