import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAppClients } from '../../shared/api/client'
import { useLocale } from '../../shared/api/hooks'
import { useSession, sessionScope } from '../../shared/api/session'
import { useShellStore } from '../../shared/store/useShellStore'
import type { FolderNode, NavigationData } from '../../shared/model/types'
import { Button } from '../../shared/ui'
import { FolderTree } from './FolderTree'

function mergePages(pages: NavigationData[]) {
  const folders = new Map<string, FolderNode>()
  const documents = new Map(
    pages.flatMap((page) =>
      page.documents.map((document) => [document.id, document] as const),
    ),
  )
  function collect(folder: FolderNode) {
    folders.set(folder.id, { ...folder, children: [] })
    folder.children.forEach(collect)
  }
  pages.forEach((page) => page.folders.forEach(collect))
  const roots: FolderNode[] = []
  for (const folder of folders.values()) {
    const parent = folder.parentId ? folders.get(folder.parentId) : undefined
    if (parent) parent.children.push(folder)
    else roots.push(folder)
  }
  return { folders: roots, documents: [...documents.values()] }
}

/** Only expanded, reachable branches request their first page. Each continuation is explicit. */
export function RemoteFolderTree({ root }: { root: NavigationData }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const clients = useAppClients()
  const scope = sessionScope(useSession().session)
  const expanded = useShellStore((state) => state.expandedFolders)
  const setExpanded = useShellStore((state) => state.setFolderExpanded)
  const [known, setKnown] = useState<Record<string, NavigationData>>({})
  const [cursors, setCursors] = useState<Record<string, string[]>>({})
  const merged = useMemo(
    () => mergePages([root, ...Object.values(known)]),
    [root, known],
  )
  const parentIds = useMemo(() => {
    const ids: string[] = []
    function visit(nodes: FolderNode[]) {
      for (const folder of nodes)
        if (expanded[folder.id] === true) {
          ids.push(folder.id)
          visit(folder.children)
        }
    }
    visit(merged.folders)
    return ids
  }, [merged.folders, expanded])
  const requests = useMemo(
    () => [
      ...(cursors.root ?? []).map((cursor) => ({
        key: `root:${cursor}`,
        parentId: undefined as string | undefined,
        cursor,
      })),
      ...parentIds.flatMap((parentId) => [
        { key: parentId, parentId, cursor: undefined as string | undefined },
        ...(cursors[parentId] ?? []).map((cursor) => ({
          key: `${parentId}:${cursor}`,
          parentId,
          cursor,
        })),
      ]),
    ],
    [cursors, parentIds],
  )
  const queries = useQueries({
    queries: requests.map((request) => ({
      queryKey: [
        scope,
        'navigation',
        locale,
        { parentId: request.parentId, cursor: request.cursor, limit: 50 },
      ],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        clients.knowledge.getNavigation(
          { locale, parentId: request.parentId, cursor: request.cursor, limit: 50 },
          { signal },
        ),
    })),
  })
  useEffect(() => {
    setKnown((current) => {
      const next = { ...current }
      let changed = false
      queries.forEach((query, index) => {
        if (query.data && current[requests[index].key] !== query.data) {
          next[requests[index].key] = query.data
          changed = true
        }
      })
      return changed ? next : current
    })
  }, [queries, requests])
  const toggle = useCallback(
    (id: string) => setExpanded(id, !(expanded[id] ?? false)),
    [expanded, setExpanded],
  )
  const continuations = [
    {
      id: 'root',
      label: t('folders.title'),
      page: cursors.root?.length ? known[`root:${cursors.root.at(-1)}`] : root,
    },
    ...parentIds.map((id) => ({
      id,
      label: id,
      page: cursors[id]?.length ? known[`${id}:${cursors[id].at(-1)}`] : known[id],
    })),
  ]
  return (
    <div className="remote-tree">
      <FolderTree
        folders={merged.folders}
        documents={merged.documents}
        defaultExpanded={false}
        partialCounts
        onToggleFolder={toggle}
      />
      <div className="remote-tree-pages">
        {queries.some((query) => query.isLoading) ? (
          <small role="status">{t('editor.loadingFolder')}</small>
        ) : null}
        {queries
          .filter((query) => query.isError)
          .map((query, index) => (
            <Button key={index} variant="subtle" onClick={() => void query.refetch()}>
              {t('common.retry')}
            </Button>
          ))}
        {continuations.map(({ id, label, page }) =>
          page?.pageInfo?.nextCursor ? (
            <Button
              key={id}
              variant="subtle"
              onClick={() =>
                setCursors((current) => ({
                  ...current,
                  [id]: [
                    ...new Set([...(current[id] ?? []), page.pageInfo!.nextCursor!]),
                  ],
                }))
              }
            >
              {t('editor.loadMore')} · {label}
            </Button>
          ) : null,
        )}
      </div>
    </div>
  )
}
