import { useEffect, useRef, type KeyboardEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useNavigationQuery, useProposalsQuery } from '../../shared/api/hooks'
import { Button, Icon, LoadingState, ErrorState } from '../../shared/ui'
import { useShellStore } from '../../shared/store/useShellStore'
import { FolderTree } from './FolderTree'
import { LanguageSwitcher } from './LanguageSwitcher'
import { TopbarSearch } from './TopbarSearch'

export function Shell() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigationQuery()
  const proposals = useProposalsQuery('open')
  const sidebarOpen = useShellStore((state) => state.sidebarOpen)
  const locale = useShellStore((state) => state.locale)
  const setSidebarOpen = useShellStore((state) => state.setSidebarOpen)
  const sidebarRef = useRef<HTMLElement>(null)
  const appMainRef = useRef<HTMLDivElement>(null)
  const wasMobileSidebarOpenRef = useRef(false)

  useEffect(() => {
    const heading = document.getElementById('page-heading')
    if (heading) requestAnimationFrame(() => heading.focus())
  }, [location.pathname])

  useEffect(() => {
    const syncInert = () => {
      const isMobile = window.matchMedia('(max-width: 760px)').matches
      if (isMobile) {
        sidebarRef.current?.toggleAttribute('inert', !sidebarOpen)
        appMainRef.current?.toggleAttribute('inert', sidebarOpen)
        if (sidebarOpen && !wasMobileSidebarOpenRef.current) {
          requestAnimationFrame(() =>
            sidebarRef.current?.querySelector<HTMLElement>('.mobile-close')?.focus(),
          )
        }
        if (!sidebarOpen && wasMobileSidebarOpenRef.current) {
          requestAnimationFrame(() =>
            appMainRef.current?.querySelector<HTMLElement>('.mobile-menu')?.focus(),
          )
        }
        wasMobileSidebarOpenRef.current = sidebarOpen
        return
      }
      sidebarRef.current?.removeAttribute('inert')
      appMainRef.current?.removeAttribute('inert')
      wasMobileSidebarOpenRef.current = false
    }
    syncInert()
    window.addEventListener('resize', syncInert)
    return () => window.removeEventListener('resize', syncInert)
  }, [sidebarOpen])

  const onSidebarKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!sidebarOpen || !window.matchMedia('(max-width: 760px)').matches) return
    if (event.key === 'Escape') {
      event.preventDefault()
      setSidebarOpen(false)
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      sidebarRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => element.getClientRects().length > 0)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last) return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const navItems = [
    { to: '/atlas?scope=entire', key: 'atlas', icon: 'atlas' as const },
    { to: '/library', key: 'library', icon: 'library' as const },
    { to: `/docs/${locale}`, key: 'docs', icon: 'docs' as const },
    {
      to: '/proposals',
      key: 'proposals',
      icon: 'proposals' as const,
      count: proposals.data?.length,
    },
    { to: '/history', key: 'history', icon: 'history' as const },
  ]

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('shell.skip')}
      </a>
      <aside
        id="vault-sidebar"
        className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}
        ref={sidebarRef}
        aria-label={t('shell.vault')}
        onKeyDown={onSidebarKeyDown}
      >
        <div className="sidebar-header">
          <NavLink
            to="/atlas?scope=entire"
            className="brand"
            onClick={() => setSidebarOpen(false)}
          >
            <span className="brand-mark" aria-hidden="true">
              <span />
            </span>
            <span>
              <strong>Lorestra</strong>
              <small>{t('brand.subtitle')}</small>
            </span>
          </NavLink>
          <Button
            className="mobile-close"
            variant="subtle"
            icon="close"
            aria-label={t('shell.closeNavigation')}
            onClick={() => setSidebarOpen(false)}
          />
        </div>
        <button
          type="button"
          className="vault-switcher"
          onClick={() => navigate('/atlas?scope=entire')}
        >
          <span className="vault-orb" aria-hidden="true" />
          <span>
            <strong>{navigation.data?.vault.name ?? 'Lorestra Vault'}</strong>
            <small>
              {t('shell.branch')} · {navigation.data?.vault.branch ?? 'main'}
            </small>
          </span>
          <Icon name="arrow" />
        </button>
        <nav className="primary-nav" aria-label={t('shell.primaryNavigation')}>
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon name={item.icon} />
              <span>{t(`nav.${item.key}`)}</span>
              {item.count ? <span className="nav-count">{item.count}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="folder-panel">
          <div className="folder-heading">
            <span>{t('folders.title')}</span>
            <span>{navigation.data?.documents.length ?? '—'}</span>
          </div>
          {navigation.isLoading ? (
            <LoadingState />
          ) : navigation.isError ? (
            <ErrorState onRetry={() => void navigation.refetch()} />
          ) : (
            <FolderTree
              folders={navigation.data?.folders ?? []}
              documents={navigation.data?.documents ?? []}
            />
          )}
        </div>
        <div className="sidebar-footer">
          <span className="sync-dot" aria-hidden="true" />
          <span>
            {t('shell.synced')} · {t('shell.momentsAgo')}
          </span>
          <LanguageSwitcher />
        </div>
      </aside>
      {sidebarOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label={t('shell.closeNavigation')}
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="app-main" ref={appMainRef}>
        <header className="topbar">
          <Button
            className="mobile-menu"
            variant="subtle"
            icon="menu"
            aria-label={t('shell.openNavigation')}
            aria-expanded={sidebarOpen}
            aria-controls="vault-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          />
          <div className="topbar-context">
            <span className="context-dot" aria-hidden="true" />
            {navigation.data?.vault.name ?? 'Lorestra'}
            <span>/</span>
            {navigation.data?.vault.branch ?? 'main'}
          </div>
          <TopbarSearch />
          <NavLink
            className="topbar-new"
            to="/library?new=1"
            aria-label={t('shell.newMemory')}
          >
            <Icon name="plus" />
            <span>{t('shell.newMemory')}</span>
          </NavLink>
        </header>
        <main id="main-content" className="workspace" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
