import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useSearchQuery } from '../../shared/api/hooks'
import { Icon } from '../../shared/ui'

export function TopbarSearch() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 150)
    return () => window.clearTimeout(timeout)
  }, [query])
  const search = useSearchQuery(debouncedQuery)
  const hasResults = query.trim().length > 1

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [])

  const openResult = (slug: string) => {
    setQuery('')
    navigate(`/documents/${encodeURIComponent(slug)}?tab=preview`)
  }

  return (
    <div className="topbar-search">
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setQuery('')
          if (event.key === 'Enter' && search.data?.results[0])
            openResult(search.data.results[0].slug)
        }}
        placeholder={t('shell.searchPlaceholder')}
        aria-label={t('shell.search')}
        aria-expanded={hasResults}
        aria-controls="search-results"
        aria-autocomplete="list"
      />
      <kbd>Ctrl K</kbd>
      {hasResults ? (
        <div
          className="search-results"
          id="search-results"
          ref={resultsRef}
          role="listbox"
          aria-label={t('shell.search')}
        >
          {search.isLoading ? (
            <div className="search-state">{t('common.loading')}</div>
          ) : search.data?.results.length ? (
            search.data.results.map((result) => (
              <button
                key={result.id}
                type="button"
                role="option"
                className="search-result"
                onClick={() => openResult(result.slug)}
              >
                <span className="result-kind">
                  {t(`common.kind.${result.kind}`, { defaultValue: result.kind })}
                </span>
                <span>
                  <strong>{result.title}</strong>
                  <small>
                    {result.folderPath} · {result.excerpt}
                  </small>
                </span>
                <Icon name="arrow" />
              </button>
            ))
          ) : (
            <div className="search-state">{t('library.emptyTitle')}</div>
          )}
        </div>
      ) : null}
    </div>
  )
}
