import { describe, expect, it } from 'vitest'

import { resolveMarkdownDocumentLink } from './markdownLinks'

const slugs = new Set(['demo-orion-overview', 'demo-cygnus-runbook'])

describe('portable Markdown document links', () => {
  it('resolves known filenames while preserving valid query strings and fragments', () => {
    expect(resolveMarkdownDocumentLink('demo-orion-overview.md', slugs)).toBe(
      '/documents/demo-orion-overview',
    )
    expect(
      resolveMarkdownDocumentLink(
        './demo-orion-overview.md?version=1&tab=preview#why%20this',
        slugs,
      ),
    ).toBe('/documents/demo-orion-overview?version=1&tab=preview#why%20this')
    expect(resolveMarkdownDocumentLink('demo%2Dorion-overview.md#context', slugs)).toBe(
      '/documents/demo-orion-overview#context',
    )
  })

  it('resolves sibling and cross-folder references by catalog slug, not folder or title', () => {
    for (const path of [
      '../Cygnus/demo-cygnus-runbook.md',
      '../../en/Cygnus/demo-cygnus-runbook.md',
      'Examples/en/Cygnus/demo-cygnus-runbook.md',
    ]) {
      expect(resolveMarkdownDocumentLink(path, slugs)).toBe(
        '/documents/demo-cygnus-runbook',
      )
    }
    expect(resolveMarkdownDocumentLink('demo-orion-overview.md', new Set())).toBe(
      undefined,
    )
  })

  it('leaves external, absolute, anchor, unknown, and malformed destinations alone', () => {
    for (const href of [
      undefined,
      '',
      'https://example.com/demo-orion-overview.md',
      '//example.com/demo-orion-overview.md',
      'mailto:demo-orion-overview.md',
      'javascript:demo-orion-overview.md',
      '/vault/demo-orion-overview.md',
      '\\server\\demo-orion-overview.md',
      '#demo-orion-overview.md',
      '?file=demo-orion-overview.md',
      'unknown.md',
      'Orion%20overview.md',
      'demo-orion-overview.html',
      'demo-orion-overview.md?version=%zz',
    ]) {
      expect(resolveMarkdownDocumentLink(href, slugs)).toBe(undefined)
    }
  })
})
