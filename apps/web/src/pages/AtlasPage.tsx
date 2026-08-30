import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useGraphQuery, useNavigationQuery } from '../shared/api/hooks'
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../shared/ui'

const GraphCanvas = lazy(() =>
  import('../widgets/atlas/GraphCanvas').then((module) => ({
    default: module.GraphCanvas,
  })),
)

export function AtlasPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [mode, setMode] = useState<'graph' | 'list'>('graph')
  const navigation = useNavigationQuery()
  const requestedScope = params.get('scope')
  const documentId = params.get('document') ?? undefined
  const folderId = params.get('folder') ?? undefined
  const scope: 'entire' | 'folder' | 'related' =
    requestedScope === 'related' && documentId
      ? 'related'
      : requestedScope === 'folder' && folderId
        ? 'folder'
        : 'entire'
  const graph = useGraphQuery({ scope, documentId, folderId })
  const selectedDocument = navigation.data?.documents.find(
    (document) => document.id === documentId,
  )
  const selectedFolder = navigation.data?.folders
    .flatMap((folder) => [folder, ...folder.children])
    .find((folder) => folder.id === folderId)
  const heading =
    scope === 'related' && selectedDocument
      ? t('atlas.relatedTitle', { title: selectedDocument.title })
      : scope === 'folder' && selectedFolder
        ? selectedFolder.name
        : t('atlas.title')
  const subtitle =
    scope === 'related'
      ? t('atlas.relatedSubtitle')
      : scope === 'folder'
        ? t('atlas.folderSubtitle')
        : t('atlas.subtitle')
  const visibleDocs = useMemo(
    () =>
      graph.data?.nodes
        .map((node) =>
          navigation.data?.documents.find((document) => document.id === node.id),
        )
        .filter(Boolean) ?? [],
    [graph.data?.nodes, navigation.data?.documents],
  )

  const setScope = (nextScope: 'entire' | 'folder' | 'related') => {
    const next = new URLSearchParams(params)
    next.set('scope', nextScope)
    if (nextScope !== 'related') next.delete('document')
    if (nextScope !== 'folder') next.delete('folder')
    setParams(next)
  }

  if (navigation.isLoading || graph.isLoading) return <LoadingState />
  if (navigation.isError || graph.isError)
    return (
      <ErrorState
        onRetry={() => {
          void navigation.refetch()
          void graph.refetch()
        }}
      />
    )
  if (!navigation.data || !graph.data) return <EmptyState title={t('atlas.noGraph')} />

  return (
    <section className="atlas" aria-labelledby="page-heading">
      <div className="atlas-head">
        <div>
          <span className="eyebrow">{t('atlas.kicker')}</span>
          <h1 id="page-heading" tabIndex={-1}>
            {heading}
          </h1>
          <p>{subtitle}</p>
        </div>
        <div className="scope-switch" role="group" aria-label={t('atlas.kicker')}>
          <button
            type="button"
            className={scope === 'related' ? 'is-active' : ''}
            disabled={!documentId}
            onClick={() => setScope('related')}
          >
            {t('atlas.related')}
          </button>
          <button
            type="button"
            className={scope === 'folder' ? 'is-active' : ''}
            disabled={!folderId}
            onClick={() => setScope('folder')}
          >
            {t('atlas.folder')}
          </button>
          <button
            type="button"
            className={scope === 'entire' ? 'is-active' : ''}
            onClick={() => setScope('entire')}
          >
            {t('atlas.entire')}
          </button>
          <button
            type="button"
            className="scope-list-toggle"
            onClick={() => setMode(mode === 'graph' ? 'list' : 'graph')}
          >
            {mode === 'graph' ? t('atlas.listView') : t('atlas.graphView')}
          </button>
        </div>
      </div>
      {mode === 'graph' ? (
        <Suspense fallback={<LoadingState />}>
          <GraphCanvas
            key={`${scope}:${documentId ?? ''}:${folderId ?? ''}`}
            graph={graph.data}
            onOpen={(id) => {
              const document = navigation.data.documents.find((item) => item.id === id)
              if (document)
                navigate(`/documents/${encodeURIComponent(document.slug)}?tab=preview`)
              else if (
                graph.data.nodes.some(
                  (node) => node.id === id && node.kind === 'folder',
                )
              )
                setParams({ scope: 'folder', folder: id })
            }}
          />
        </Suspense>
      ) : (
        <div className="atlas-list">
          <div className="atlas-list-grid">
            {visibleDocs.map((document) =>
              document ? (
                <Link
                  className="atlas-list-link"
                  key={document.id}
                  to={`/documents/${encodeURIComponent(document.slug)}?tab=preview`}
                >
                  <StatusBadge status={document.status} kind={document.kind} />
                  <strong>{document.title}</strong>
                  <small>
                    {document.folderPath} · v{document.version}
                  </small>
                </Link>
              ) : null,
            )}
          </div>
        </div>
      )}
      <div className="atlas-foot">
        <div className="atlas-legend" aria-label={t('atlas.legendLabel')}>
          <span className="legend-item">
            <i className="legend-dot" style={{ background: '#76d6b0' }} />
            {t('atlas.legendKnowledge')}
          </span>
          <span className="legend-item">
            <i className="legend-dot" style={{ background: '#e4aa4c' }} />
            {t('atlas.legendDecision')}
          </span>
          <span className="legend-item">
            <i className="legend-dot" style={{ background: '#d85d59' }} />
            {t('atlas.legendIncident')}
          </span>
        </div>
        <div className="atlas-stat">
          <strong>
            {t('atlas.nodes', { count: graph.data.nodes.length })} ·{' '}
            {t('atlas.relations', { count: graph.data.edges.length })}
          </strong>
          <span>{t('atlas.subtitle')}</span>
        </div>
      </div>
    </section>
  )
}
