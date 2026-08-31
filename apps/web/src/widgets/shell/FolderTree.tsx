import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react'
import { Link, useLocation } from 'react-router'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTranslation } from 'react-i18next'
import type { DocumentSummary, FolderNode } from '../../shared/model/types'
import { Icon } from '../../shared/ui'
import { useShellStore } from '../../shared/store/useShellStore'

type TreeEntry = {
  kind: 'folder' | 'document'
  id: string
  name: string
  depth: number
  document?: DocumentSummary
  hasChildren?: boolean
  itemCount?: number
  partialCount?: boolean
}

function flattenTree(
  folders: FolderNode[],
  documents: DocumentSummary[],
  expanded: Record<string, boolean>,
  depth = 1,
  defaultExpanded = true,
  partialCounts = false,
): TreeEntry[] {
  const entries: TreeEntry[] = []
  const docsByFolder = new Map<string, DocumentSummary[]>()
  for (const document of documents) {
    const list = docsByFolder.get(document.folderId) ?? []
    list.push(document)
    docsByFolder.set(document.folderId, list)
  }
  const countByFolder = new Map<string, number>()
  const countDocuments = (node: FolderNode): number => {
    const cached = countByFolder.get(node.id)
    if (cached !== undefined) return cached
    const count =
      Math.max(node.documentCount, docsByFolder.get(node.id)?.length ?? 0) +
      node.children.reduce((total, child) => total + countDocuments(child), 0)
    countByFolder.set(node.id, count)
    return count
  }
  const visit = (nodes: FolderNode[], currentDepth: number) => {
    for (const node of nodes) {
      const itemCount = countDocuments(node)
      if (itemCount === 0 && !node.hasChildren) continue
      const hasChildren =
        node.hasChildren ||
        node.children.length > 0 ||
        (docsByFolder.get(node.id)?.length ?? 0) > 0
      entries.push({
        kind: 'folder',
        id: node.id,
        name: node.name,
        depth: currentDepth,
        hasChildren,
        itemCount,
        partialCount: partialCounts,
      })
      if (!(expanded[node.id] ?? defaultExpanded)) continue
      visit(node.children, currentDepth + 1)
      for (const document of docsByFolder.get(node.id) ?? []) {
        entries.push({
          kind: 'document',
          id: document.id,
          name: document.title,
          depth: currentDepth + 1,
          document,
        })
      }
    }
  }
  visit(folders, depth)
  return entries
}

export function FolderTree({
  folders,
  documents,
  defaultExpanded = true,
  partialCounts = false,
  onToggleFolder,
}: {
  folders: FolderNode[]
  documents: DocumentSummary[]
  defaultExpanded?: boolean
  partialCounts?: boolean
  onToggleFolder?: (id: string) => void
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const expandedFolders = useShellStore((state) => state.expandedFolders)
  const storeToggleFolder = useShellStore((state) => state.toggleFolder)
  const toggleFolder = onToggleFolder ?? storeToggleFolder
  const parentRef = useRef<HTMLDivElement>(null)
  const entries = useMemo(
    () =>
      flattenTree(
        folders,
        documents,
        expandedFolders,
        1,
        defaultExpanded,
        partialCounts,
      ),
    [documents, expandedFolders, folders, defaultExpanded, partialCounts],
  )
  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 8,
    enabled: entries.length > 80,
  })
  const visibleEntries =
    entries.length > 80
      ? virtualizer.getVirtualItems()
      : entries.map((_, index) => ({ index, start: index * 38, size: 38 }))
  const selectedIndex = entries.findIndex(
    (entry) =>
      entry.kind === 'document' &&
      entry.document &&
      location.pathname.includes(`/documents/${entry.document.slug}`),
  )
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0)
  const rowRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    if (!entries.length) {
      setActiveIndex(0)
      return
    }
    if (selectedIndex >= 0) setActiveIndex(selectedIndex)
    else setActiveIndex((current) => Math.min(current, entries.length - 1))
  }, [entries.length, selectedIndex])

  const focusRow = useCallback(
    (index: number) => {
      if (!entries.length) return
      const nextIndex = Math.max(0, Math.min(index, entries.length - 1))
      setActiveIndex(nextIndex)
      if (entries.length > 80) virtualizer.scrollToIndex(nextIndex, { align: 'auto' })
      requestAnimationFrame(() =>
        requestAnimationFrame(() => rowRefs.current[nextIndex]?.focus()),
      )
    },
    [entries.length, virtualizer],
  )

  const onTreeKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>, index: number) => {
      const entry = entries[index]
      if (!entry) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        focusRow(index + 1)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        focusRow(index - 1)
        return
      }
      if (event.key === 'Home') {
        event.preventDefault()
        focusRow(0)
        return
      }
      if (event.key === 'End') {
        event.preventDefault()
        focusRow(entries.length - 1)
        return
      }
      const open =
        entry.kind === 'folder' && (expandedFolders[entry.id] ?? defaultExpanded)
      if (event.key === 'ArrowRight' && entry.kind === 'folder') {
        event.preventDefault()
        if (!open) toggleFolder(entry.id)
        else if (entries[index + 1]?.depth > entry.depth) focusRow(index + 1)
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (entry.kind === 'folder' && open) {
          toggleFolder(entry.id)
          return
        }
        for (let parentIndex = index - 1; parentIndex >= 0; parentIndex -= 1) {
          if (
            entries[parentIndex].kind === 'folder' &&
            entries[parentIndex].depth === entry.depth - 1
          ) {
            focusRow(parentIndex)
            return
          }
        }
        return
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (entry.kind === 'folder') {
          event.preventDefault()
          rowRefs.current[index]
            ?.querySelector<HTMLAnchorElement>('.tree-folder-link')
            ?.click()
        }
      }
    },
    [entries, expandedFolders, focusRow, toggleFolder, defaultExpanded],
  )

  const registerRow = useCallback((index: number, node: HTMLElement | null) => {
    rowRefs.current[index] = node
  }, [])

  const focusEntry = useCallback((index: number) => setActiveIndex(index), [])

  return (
    <div
      className="folder-tree-wrap"
      ref={parentRef}
      role="tree"
      aria-label={t('folders.title')}
    >
      {entries.length > 80 ? (
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {visibleEntries.map((virtualRow) => {
            const entry = entries[virtualRow.index]
            return (
              <TreeRow
                key={`${entry.kind}-${entry.id}`}
                index={virtualRow.index}
                entry={entry}
                selected={virtualRow.index === selectedIndex}
                open={
                  entry.kind === 'folder' && entry.hasChildren
                    ? (expandedFolders[entry.id] ?? defaultExpanded)
                    : false
                }
                t={t}
                toggleFolder={toggleFolder}
                active={activeIndex === virtualRow.index}
                registerRow={registerRow}
                onFocus={focusEntry}
                onKeyDown={onTreeKeyDown}
                style={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  width: '100%',
                }}
              />
            )
          })}
        </div>
      ) : (
        visibleEntries.map((virtualRow) => (
          <TreeRow
            key={`${entries[virtualRow.index].kind}-${entries[virtualRow.index].id}`}
            index={virtualRow.index}
            entry={entries[virtualRow.index]}
            selected={virtualRow.index === selectedIndex}
            open={
              entries[virtualRow.index].kind === 'folder' &&
              entries[virtualRow.index].hasChildren
                ? (expandedFolders[entries[virtualRow.index].id] ?? defaultExpanded)
                : false
            }
            t={t}
            toggleFolder={toggleFolder}
            active={activeIndex === virtualRow.index}
            registerRow={registerRow}
            onFocus={focusEntry}
            onKeyDown={onTreeKeyDown}
          />
        ))
      )}
    </div>
  )
}

const TreeRow = memo(function TreeRow({
  index,
  entry,
  selected,
  open,
  t,
  toggleFolder,
  active,
  registerRow,
  onFocus,
  onKeyDown,
  style,
}: {
  index: number
  entry: TreeEntry
  selected: boolean
  open: boolean
  t: ReturnType<typeof useTranslation>['t']
  toggleFolder: (id: string) => void
  active: boolean
  registerRow: (index: number, node: HTMLElement | null) => void
  onFocus: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLElement>, index: number) => void
  style?: CSSProperties
}) {
  const rowRef = useCallback(
    (node: HTMLElement | null) => registerRow(index, node),
    [index, registerRow],
  )
  const handleFocus = useCallback(() => onFocus(index), [index, onFocus])
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => onKeyDown(event, index),
    [index, onKeyDown],
  )

  if (entry.kind === 'document' && entry.document) {
    return (
      <Link
        className={`tree-row tree-document ${selected ? 'is-selected' : ''}`}
        to={`/documents/${encodeURIComponent(entry.document.slug)}?tab=preview`}
        style={{ ...style, '--tree-depth': entry.depth } as CSSProperties}
        role="treeitem"
        aria-level={entry.depth}
        aria-current={selected ? 'page' : undefined}
        tabIndex={active ? 0 : -1}
        ref={rowRef as (node: HTMLAnchorElement | null) => void}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
      >
        <Icon name="file" />
        <span className="tree-row-name">{entry.name}</span>
        <span className="tree-row-meta">md</span>
      </Link>
    )
  }
  return (
    <div
      className="tree-folder-row"
      style={style}
      role="treeitem"
      aria-level={entry.depth}
      aria-expanded={entry.hasChildren ? open : undefined}
      tabIndex={active ? 0 : -1}
      ref={rowRef}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="tree-disclosure"
        onClick={() => toggleFolder(entry.id)}
        disabled={!entry.hasChildren}
        tabIndex={-1}
        aria-label={
          open
            ? t('folders.collapse', { name: entry.name })
            : t('folders.expand', { name: entry.name })
        }
        aria-expanded={entry.hasChildren ? open : undefined}
      >
        <span
          className={`disclosure-glyph ${open ? 'is-open' : ''}`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      <Link
        className="tree-folder-link"
        to={`/atlas?scope=folder&folder=${encodeURIComponent(entry.id)}`}
        style={{ '--tree-depth': entry.depth } as CSSProperties}
        aria-label={t('folders.openFolder', { name: entry.name })}
        tabIndex={-1}
      >
        <Icon name="folder" />
        <span className="tree-row-name">{entry.name}</span>
        <span
          className="tree-row-meta"
          aria-label={t(
            entry.partialCount ? 'editor.loadedCount' : 'folders.documentCount',
            { count: entry.itemCount },
          )}
        >
          {entry.partialCount
            ? entry.itemCount
              ? `${entry.itemCount}+`
              : '…'
            : entry.itemCount}
        </span>
      </Link>
    </div>
  )
})
