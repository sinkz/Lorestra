/** Resolve portable Markdown filenames only against the caller's visible catalog. */
export function resolveMarkdownDocumentLink(
  href: string | undefined,
  documentSlugs: ReadonlySet<string>,
): string | undefined {
  if (!href || href !== href.trim() || /^(?:[a-z][a-z\d+.-]*:|[/\\?#])/i.test(href)) {
    return undefined
  }

  const suffixIndex = href.search(/[?#]/)
  const path = suffixIndex < 0 ? href : href.slice(0, suffixIndex)
  const suffix = suffixIndex < 0 ? '' : href.slice(suffixIndex)
  const filename = path.slice(path.lastIndexOf('/') + 1)
  if (path.includes('\\') || !/\.md$/i.test(filename)) return undefined

  try {
    // Reject malformed URI escapes without normalizing a valid query or fragment.
    decodeURI(href)
    const slug = decodeURIComponent(filename.slice(0, -3))
    if (!documentSlugs.has(slug)) return undefined
    return `/documents/${encodeURIComponent(slug)}${suffix}`
  } catch {
    return undefined
  }
}
