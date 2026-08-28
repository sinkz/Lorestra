import { useDeferredValue, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import {
  useDocumentsQuery,
  useNavigationQuery,
  queryKeys,
  useLocale,
} from '../shared/api/hooks'
import { useAppClients } from '../shared/api/client'
import type {
  DocumentKind,
  DocumentStatus,
  DocumentSummary,
} from '../shared/model/types'
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  ModalDialog,
  PageHeading,
  Pagination,
  StatusBadge,
  formatDate,
} from '../shared/ui'

const kinds: Array<Exclude<DocumentKind, 'folder'>> = [
  'incident',
  'decision',
  'runbook',
  'guide',
  'process',
  'note',
  'docs',
]
const statuses: DocumentStatus[] = ['published', 'draft', 'archived']

type MemoryForm = { title: string; body: string }

export function LibraryPage() {
  const { t } = useTranslation()
  const locale = useLocale()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const navigation = useNavigationQuery()
  const folderId = params.get('folder') ?? ''
  const query = params.get('q') ?? ''
  const deferredQuery = useDeferredValue(query)
  const kind = params.get('type') as Exclude<DocumentKind, 'folder'> | null
  const status = params.get('status') as DocumentStatus | null
  const sort =
    params.get('sort') === 'title' || params.get('sort') === 'kind'
      ? (params.get('sort') as 'title' | 'kind')
      : 'updated'
  const cursor = params.get('cursor') ?? undefined
  const view = params.get('view') === 'cards' ? 'cards' : 'list'
  const isNew = params.get('new') === '1'
  const folder = navigation.data?.folders
    .flatMap((item) => [item, ...item.children])
    .find((item) => item.id === folderId)
  const documentsQuery = useDocumentsQuery({
    folderId: folderId || undefined,
    query: deferredQuery || undefined,
    kind: kind && kinds.includes(kind) ? kind : undefined,
    status: status && statuses.includes(status) ? status : undefined,
    sort,
    cursor,
  })
  const documents = documentsQuery.data?.items ?? []

  const updateParam = (name: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(name, value)
    else next.delete(name)
    if (!['view', 'new'].includes(name)) next.delete('cursor')
    setParams(next)
  }

  const updateCursor = (nextCursor: string | null) => {
    const next = new URLSearchParams(params)
    if (nextCursor && nextCursor !== '0') next.set('cursor', nextCursor)
    else next.delete('cursor')
    setParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams()
    if (view === 'cards') next.set('view', 'cards')
    setParams(next)
  }

  if (navigation.isLoading || documentsQuery.isLoading) return <LoadingState />
  if (navigation.isError || documentsQuery.isError)
    return (
      <ErrorState
        onRetry={() => {
          void navigation.refetch()
          void documentsQuery.refetch()
        }}
      />
    )
  if (!navigation.data) return <EmptyState title={t('library.emptyTitle')} />

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner">
        <PageHeading
          kicker={t('library.kicker')}
          title={folder ? folder.name : t('library.title')}
          lead={folder ? `${folder.path} · ${t('library.lead')}` : t('library.lead')}
          actions={
            <>
              <Link className="button button-secondary" to="/atlas?scope=entire">
                <Icon name="atlas" />
                {t('library.viewAtlas')}
              </Link>
              <Button
                variant="primary"
                icon="plus"
                onClick={() => updateParam('new', '1')}
              >
                {t('shell.newMemory')}
              </Button>
            </>
          }
        />
        <div className="toolbar" aria-label={t('library.search')}>
          <strong>
            {t('library.results', {
              count: documentsQuery.data?.pageInfo.totalCount ?? documents.length,
            })}
          </strong>
          <div className="library-controls">
            <label className="library-search">
              <Icon name="search" />
              <span className="sr-only">{t('library.search')}</span>
              <input
                value={query}
                onChange={(event) => updateParam('q', event.target.value)}
                placeholder={t('library.searchPlaceholder')}
              />
            </label>
            <label className="sr-only" htmlFor="library-sort">
              {t('library.sort')}
            </label>
            <select
              id="library-sort"
              className="select-control"
              value={sort}
              onChange={(event) => updateParam('sort', event.target.value)}
            >
              <option value="updated">{t('library.sortUpdated')}</option>
              <option value="title">{t('library.sortTitle')}</option>
              <option value="kind">{t('library.sortKind')}</option>
            </select>
            <label className="sr-only" htmlFor="library-kind">
              {t('library.type')}
            </label>
            <select
              id="library-kind"
              className="select-control"
              value={kind ?? ''}
              onChange={(event) => updateParam('type', event.target.value)}
            >
              <option value="">{t('library.type')}</option>
              {kinds.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="library-status">
              {t('library.status')}
            </label>
            <select
              id="library-status"
              className="select-control"
              value={status ?? ''}
              onChange={(event) => updateParam('status', event.target.value)}
            >
              <option value="">{t('library.status')}</option>
              {statuses.map((item) => (
                <option value={item} key={item}>
                  {item}
                </option>
              ))}
            </select>
            <div className="view-toggle" role="group" aria-label={t('library.view')}>
              <button
                type="button"
                className={view === 'list' ? 'is-active' : ''}
                aria-pressed={view === 'list'}
                onClick={() => updateParam('view', 'list')}
              >
                {t('library.list')}
              </button>
              <button
                type="button"
                className={view === 'cards' ? 'is-active' : ''}
                aria-pressed={view === 'cards'}
                onClick={() => updateParam('view', 'cards')}
              >
                {t('library.cards')}
              </button>
            </div>
          </div>
        </div>
        {folderId || query || kind || status ? (
          <div className="filter-summary">
            <span>{folder ? folder.path : null}</span>
            {query ? <span>“{query}”</span> : null}
            {kind ? <span>{kind}</span> : null}
            {status ? <span>{status}</span> : null}
            <Button variant="link" onClick={clearFilters}>
              {t('common.clear')}
            </Button>
          </div>
        ) : null}
        {documents.length && documentsQuery.data ? (
          <>
            {view === 'cards' ? (
              <LibraryCards documents={documents} />
            ) : (
              <LibraryTable documents={documents} />
            )}
            <Pagination
              pageInfo={documentsQuery.data.pageInfo}
              pageSize={documents.length}
              cursor={cursor}
              onPrevious={updateCursor}
              onNext={updateCursor}
            />
          </>
        ) : (
          <EmptyState
            title={t('library.emptyTitle')}
            body={t('library.emptyBody')}
            action={
              <Button variant="secondary" onClick={clearFilters}>
                {t('library.reset')}
              </Button>
            }
          />
        )}
      </div>
      <NewMemoryDialog
        open={isNew}
        locale={locale}
        onClose={() => updateParam('new', '')}
        onCreated={(proposalId) =>
          navigate(`/proposals/${encodeURIComponent(proposalId)}`)
        }
      />
    </section>
  )
}

function LibraryTable({ documents }: { documents: DocumentSummary[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  return (
    <div className="library-table-wrap">
      <table className="library-table">
        <caption className="sr-only">{t('library.title')}</caption>
        <thead>
          <tr>
            <th>{t('library.path')}</th>
            <th>{t('library.type')}</th>
            <th>{t('library.status')}</th>
            <th>{t('library.author')}</th>
            <th>{t('library.updated')}</th>
            <th>{t('library.relations')}</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr className="library-row" key={document.id}>
              <td data-label={t('library.path')}>
                <Link
                  to={`/documents/${encodeURIComponent(document.slug)}?tab=preview`}
                >
                  <span className="library-title">{document.title}</span>
                  <span className="library-path">{document.folderPath}</span>
                </Link>
              </td>
              <td data-label={t('library.type')}>
                <span className="library-kind">
                  {t(`common.kind.${document.kind}`, { defaultValue: document.kind })}
                </span>
              </td>
              <td data-label={t('library.status')}>
                <StatusBadge status={document.status} kind={document.kind} />
              </td>
              <td data-label={t('library.author')}>
                <span className="library-meta">{document.author}</span>
              </td>
              <td data-label={t('library.updated')}>
                <span className="library-meta">
                  {formatDate(document.updatedAt, locale)}
                </span>
              </td>
              <td data-label={t('library.relations')}>
                <span className="library-meta">{document.relationCount}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LibraryCards({ documents }: { documents: DocumentSummary[] }) {
  const { t } = useTranslation()
  return (
    <div className="library-cards">
      {documents.map((document) => (
        <Link
          className="library-card"
          key={document.id}
          to={`/documents/${encodeURIComponent(document.slug)}?tab=preview`}
        >
          <StatusBadge status={document.status} kind={document.kind} />
          <span className="library-title">{document.title}</span>
          <span className="library-path">{document.folderPath}</span>
          <p className="library-summary">{document.summary}</p>
          <div className="library-card-foot">
            <span>
              {t(`common.kind.${document.kind}`, { defaultValue: document.kind })} ·{' '}
              {t('library.relationsCount', { count: document.relationCount })}
            </span>
            <span>v{document.version}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}

function NewMemoryDialog({
  open,
  locale,
  onClose,
  onCreated,
}: {
  open: boolean
  locale: 'en' | 'pt-BR'
  onClose: () => void
  onCreated: (proposalId: string) => void
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
  } = useForm<MemoryForm>({ defaultValues: { title: '', body: '' } })

  const close = () => {
    reset()
    setError('')
    onClose()
  }
  const submit = async (values: MemoryForm) => {
    try {
      const proposal = await clients.proposals.create({
        title: values.title,
        body: values.body,
        locale,
      })
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.proposals('all', locale),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.proposals('open', locale),
        }),
      ])
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
      aria-labelledby="new-memory-title"
      onRequestClose={close}
    >
      <div className="memory-dialog-card">
        <div className="dialog-header">
          <div>
            <span className="eyebrow">{t('shell.newMemory')}</span>
            <h2 id="new-memory-title">{t('proposals.newProposal')}</h2>
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
            <input
              autoFocus
              {...register('title', { required: true })}
              placeholder={t('proposals.titleField')}
            />
            {errors.title ? (
              <small className="field-error">{t('common.required')}</small>
            ) : null}
          </label>
          <label className="form-field">
            <span>{t('document.markdown')}</span>
            <textarea
              {...register('body', { required: true })}
              rows={10}
              placeholder="# ..."
            />
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
              {isSubmitting ? t('common.loading') : t('proposals.newProposal')}
            </Button>
          </div>
        </form>
      </div>
    </ModalDialog>
  )
}
