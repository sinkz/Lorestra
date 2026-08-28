import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { localeOptions } from '../../shared/i18n'
import type {
  DocumentSummary,
  FolderNode,
  Locale,
  NavigationData,
} from '../../shared/model/types'
import { useShellStore } from '../../shared/store/useShellStore'
import { useAppClients } from '../../shared/api/client'

function flattenFolders(folders: FolderNode[]): FolderNode[] {
  return folders.flatMap((folder) => [folder, ...flattenFolders(folder.children)])
}

function hasDocuments(folder: FolderNode, documents: DocumentSummary[]): boolean {
  return documents.some(
    (document) =>
      document.folderId === folder.id ||
      document.folderPath === folder.path ||
      document.folderPath.startsWith(`${folder.path}/`),
  )
}

function findFolderCounterpart(
  source: FolderNode | undefined,
  target: NavigationData,
): FolderNode | undefined {
  if (!source) return undefined
  const targetFolders = flattenFolders(target.folders)
  return (
    targetFolders.find(
      (folder) => folder.id === source.id && hasDocuments(folder, target.documents),
    ) ??
    targetFolders.find(
      (folder) => folder.path === source.path && hasDocuments(folder, target.documents),
    )
  )
}

function findDocumentCounterpart(
  source: DocumentSummary | undefined,
  current: NavigationData,
  target: NavigationData,
): DocumentSummary | undefined {
  if (!source) return undefined
  const targetByBaseId = target.documents.find(
    (document) =>
      document.id === source.id ||
      document.id.replace(/\.(?:en|pt-br)$/i, '') ===
        source.id.replace(/\.(?:en|pt-br)$/i, ''),
  )
  if (targetByBaseId) return targetByBaseId

  const folderRoot = source.folderPath.split('/')[0]
  const currentSiblings = current.documents.filter(
    (document) => document.folderPath.split('/')[0] === folderRoot,
  )
  const targetSiblings = target.documents.filter(
    (document) => document.folderPath.split('/')[0] === folderRoot,
  )
  const sourceIndex = currentSiblings.findIndex((document) => document.id === source.id)
  return sourceIndex >= 0 ? targetSiblings[sourceIndex] : undefined
}

function withSearch(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname
}

function fallbackRoute(pathname: string, search: string): string {
  if (pathname.startsWith('/documents/')) return '/library'
  if (pathname === '/atlas' || pathname === '/atlas/') return '/atlas?scope=entire'
  if (pathname.startsWith('/history/')) return '/history'
  return withSearch(pathname, search)
}

function resolveLocaleRoute(
  pathname: string,
  search: string,
  current: NavigationData,
  target: NavigationData,
): string {
  const params = new URLSearchParams(search)

  if (pathname.startsWith('/docs/'))
    return `/docs/${target.documents[0]?.locale ?? 'en'}`

  if (pathname.startsWith('/documents/')) {
    const encodedSlug = pathname.slice('/documents/'.length).split('/')[0]
    const slug = decodeURIComponent(encodedSlug)
    const source = current.documents.find((document) => document.slug === slug)
    const counterpart = findDocumentCounterpart(source, current, target)
    return counterpart
      ? withSearch(`/documents/${encodeURIComponent(counterpart.slug)}`, search)
      : '/library'
  }

  if (pathname === '/atlas' || pathname === '/atlas/') {
    const scope = params.get('scope')
    if (scope === 'related') {
      const source = current.documents.find(
        (document) => document.id === params.get('document'),
      )
      const counterpart = findDocumentCounterpart(source, current, target)
      return counterpart
        ? `/atlas?scope=related&document=${encodeURIComponent(counterpart.id)}`
        : '/atlas?scope=entire'
    }
    if (scope === 'folder') {
      const source = flattenFolders(current.folders).find(
        (folder) => folder.id === params.get('folder'),
      )
      const counterpart = findFolderCounterpart(source, target)
      return counterpart
        ? `/atlas?scope=folder&folder=${encodeURIComponent(counterpart.id)}`
        : '/atlas?scope=entire'
    }
    params.delete('document')
    params.delete('folder')
    params.set('scope', 'entire')
    return `/atlas?${params.toString()}`
  }

  if (pathname === '/library' || pathname === '/library/') {
    const source = flattenFolders(current.folders).find(
      (folder) => folder.id === params.get('folder'),
    )
    if (params.has('folder')) {
      const counterpart = findFolderCounterpart(source, target)
      if (counterpart) params.set('folder', counterpart.id)
      else params.delete('folder')
    }
    return withSearch('/library', params.toString() ? `?${params.toString()}` : '')
  }

  if (pathname === '/history' || pathname === '/history/')
    return withSearch('/history', search)
  if (pathname.startsWith('/history/')) return '/history'

  return withSearch(pathname, search)
}

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const clients = useAppClients()
  const setLocale = useShellStore((state) => state.setLocale)
  const [changing, setChanging] = useState(false)
  const current = i18n.language === 'pt-BR' ? 'pt-BR' : 'en'

  const onChange = async (value: Locale) => {
    if (value === current || changing) return
    setChanging(true)
    let nextRoute = fallbackRoute(location.pathname, location.search)
    try {
      const [currentNavigation, targetNavigation] = await Promise.all([
        clients.knowledge.getNavigation({ locale: current }),
        clients.knowledge.getNavigation({ locale: value }),
      ])
      nextRoute = resolveLocaleRoute(
        location.pathname,
        location.search,
        currentNavigation,
        targetNavigation,
      )
    } catch {
      // Keep the user on a known safe route if the target navigation is unavailable.
    }
    setLocale(value)
    await i18n.changeLanguage(value)
    navigate(nextRoute)
    setChanging(false)
  }

  return (
    <label className="language-switcher">
      <span>{t('common.locale')}</span>
      <select
        value={current}
        disabled={changing}
        onChange={(event) => void onChange(event.target.value as Locale)}
        aria-label={t('common.locale')}
      >
        {localeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
