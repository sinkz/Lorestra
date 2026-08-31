import { ProposalEditorDialog } from '../features/proposals/ProposalEditorDialog'
import { useSession } from '../shared/api/session'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
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
  Pagination,
  StatusBadge,
  formatDate,
} from '../shared/ui'

type DocumentTab = 'preview' | 'markdown' | 'relations' | 'history'
const documentTabs: DocumentTab[] = ['preview', 'markdown', 'relations', 'history']

export function DocumentPage() {
  const { slug } = useParams<{ slug: string }>()
  const locale = useLocale()
  const [params] = useSearchParams()
  // A different document/revision starts a separate editor; tab changes preserve its draft.
  return (
    <DocumentWorkspace
      key={`${locale}:${slug}:${params.get('version') ?? 'current'}`}
    />
  )
}

function DocumentWorkspace() {
  const { t } = useTranslation()
  const locale = useLocale()
  const { session } = useSession()
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [editorBase, setEditorBase] = useState<Document | undefined>()
  const [source, setSource] = useState('')
  const [copied, setCopied] = useState(false)
  const [proposalOpen, setProposalOpen] = useState(false)
  const tabRefs = useRef<Partial<Record<DocumentTab, HTMLButtonElement | null>>>({})
  const requestedVersion = positiveVersion(params.get('version'))
  const documentQuery = useDocumentQuery(slug, requestedVersion)
  const navigation = useNavigationQuery()
  const document = documentQuery.data
  const tab = normalizeTab(params.get('tab'))
  const historyCursor = params.get('historyCursor') ?? undefined
  const history = useHistoryQuery(
    document?.id,
    historyCursor,
    undefined,
    undefined,
    Boolean(document?.id) && tab === 'history',
  )
  const documentSlugs = useMemo(
    () =>
      (navigation.data?.documents ?? [])
        .filter((item) => item.locale === locale)
        .map((item) => item.slug),
    [locale, navigation.data?.documents],
  )

  useEffect(() => {
    if (!editing && !proposalOpen) setSource(document?.body ?? '')
    setCopied(false)
  }, [document?.id, document?.body, editing, proposalOpen])

  const relatedDocuments = useMemo(() => {
    if (!document) return []
    if (document.relatedDocuments) return document.relatedDocuments
    if (!navigation.data) return []
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
          <Button
            variant="primary"
            icon="plus"
            disabled={!session.capabilities.createProposal || session.readOnly.enabled}
            onClick={() => {
              if (!editing) setEditorBase(document)
              setProposalOpen(true)
            }}
          >
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
            <MarkdownContent
              source={document.body}
              documentSlugs={documentSlugs}
              resolvedLinks={document.resolvedLinks}
            />
          ) : tab === 'markdown' ? (
            <MarkdownTab
              source={source}
              editing={editing}
              onChange={setSource}
              onEdit={() => {
                setEditorBase(document)
                setEditing(true)
              }}
              onPropose={() => setProposalOpen(true)}
            />
          ) : tab === 'relations' ? (
            <RelationsTab document={document} relatedDocuments={relatedDocuments} />
          ) : history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState error={history.error} onRetry={() => void history.refetch()} />
          ) : (
            <>
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
              {history.data ? (
                <Pagination
                  pageInfo={history.data.pageInfo}
                  pageSize={history.data.events.length}
                  cursor={historyCursor}
                  onNext={(cursor) => {
                    const next = new URLSearchParams(params)
                    if (cursor) next.set('historyCursor', cursor)
                    else next.delete('historyCursor')
                    setParams(next)
                  }}
                  onPrevious={(cursor) => {
                    const next = new URLSearchParams(params)
                    if (cursor) next.set('historyCursor', cursor)
                    else next.delete('historyCursor')
                    setParams(next)
                  }}
                />
              ) : null}
            </>
          )}
        </div>
        <DocumentAside document={document} locale={locale} />
      </div>
      <ProposalEditorDialog
        open={proposalOpen}
        document={editorBase ?? document}
        initialBody={source}
        onClose={() => setProposalOpen(false)}
        onCreated={(id) => {
          setEditing(false)
          navigate(`/proposals/${encodeURIComponent(id)}`)
        }}
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
  relatedDocuments: Array<
    Pick<DocumentSummary, 'id' | 'slug' | 'title' | 'kind' | 'status' | 'folderPath'>
  >
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
