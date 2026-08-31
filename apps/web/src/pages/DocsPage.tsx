import { useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useDocumentQuery, useNavigationQuery } from '../shared/api/hooks'
import { useShellStore } from '../shared/store/useShellStore'
import type { Locale } from '../shared/model/types'
import {
  EmptyState,
  ErrorState,
  Icon,
  LoadingState,
  MarkdownContent,
  PageHeading,
} from '../shared/ui'

export function DocsPage() {
  const { t, i18n } = useTranslation()
  const params = useParams<{ locale: string; '*': string }>()
  const locale: Locale = params.locale === 'pt-BR' ? 'pt-BR' : 'en'
  const slug = params['*'] || undefined
  const setLocale = useShellStore((state) => state.setLocale)
  const navigation = useNavigationQuery()
  const documentQuery = useDocumentQuery(slug)
  const documentSlugs = useMemo(
    () =>
      (navigation.data?.documents ?? [])
        .filter((document) => document.locale === locale)
        .map((document) => document.slug),
    [locale, navigation.data?.documents],
  )

  useEffect(() => {
    setLocale(locale)
    if (i18n.language !== locale) void i18n.changeLanguage(locale)
  }, [i18n, locale, setLocale])

  const documents = useMemo(
    () =>
      (navigation.data?.documents ?? []).filter(
        (document) =>
          document.locale === locale &&
          (document.folderPath === 'Docs' || document.folderPath.startsWith('Docs/')),
      ),
    [locale, navigation.data?.documents],
  )

  if (navigation.isLoading || (slug && documentQuery.isLoading)) {
    return <LoadingState />
  }
  if (navigation.isError || documentQuery.isError) {
    return (
      <ErrorState
        onRetry={() => {
          void navigation.refetch()
          if (slug) void documentQuery.refetch()
        }}
      />
    )
  }

  if (slug) {
    const document = documentQuery.data
    if (!document) {
      return (
        <div className="page-surface">
          <EmptyState
            title={t('docs.noDoc')}
            action={
              <Link className="button button-secondary" to={`/docs/${locale}`}>
                <Icon name="back" />
                {t('docs.back')}
              </Link>
            }
          />
        </div>
      )
    }
    return (
      <section className="page-surface docs-reader" aria-labelledby="page-heading">
        <div className="page-inner docs-reader-layout">
          <aside className="docs-reader-nav" aria-label={t('docs.contents')}>
            <Link className="button button-link" to={`/docs/${locale}`}>
              <Icon name="back" />
              {t('docs.back')}
            </Link>
            <strong>{t('docs.contents')}</strong>
            <nav>
              {documents.map((item) => (
                <Link
                  aria-current={item.slug === document.slug ? 'page' : undefined}
                  className={item.slug === document.slug ? 'is-active' : ''}
                  key={item.id}
                  to={`/docs/${locale}/${item.slug}`}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          </aside>
          <article className="docs-reader-content">
            <span className="eyebrow">{document.folderPath}</span>
            <h1 id="page-heading" tabIndex={-1}>
              {document.title}
            </h1>
            <p className="docs-reader-lead">{document.summary}</p>
            <MarkdownContent source={document.body} documentSlugs={documentSlugs} />
          </article>
        </div>
      </section>
    )
  }

  return (
    <section className="page-surface" aria-labelledby="page-heading">
      <div className="page-inner">
        <div className="docs-hero">
          <PageHeading
            kicker={t('docs.kicker')}
            title={t('docs.title')}
            lead={t('docs.lead')}
          />
          <aside className="docs-callout">
            <strong>{t('docs.agentReady')}</strong>
            <p>{t('docs.agentReadyBody')}</p>
          </aside>
        </div>
        {documents.length ? (
          <div className="docs-grid">
            {documents.map((document) => (
              <Link
                className="docs-card"
                key={document.id}
                to={`/docs/${locale}/${document.slug}`}
              >
                <small>
                  {document.tags.includes('cookbook')
                    ? t('docs.cookbook')
                    : t('docs.read')}
                </small>
                <h2>{document.title}</h2>
                <p>{document.summary}</p>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t('docs.noDoc')} />
        )}
      </div>
    </section>
  )
}
