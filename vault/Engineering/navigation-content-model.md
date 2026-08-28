---
id: lorestra.engineering.navigation-content-model
slug: engineering-navigation-content-model
locale: en
title: Navigation and content model
description: How Markdown metadata becomes a safe, localized menu.
folderId: folder.engineering
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Content systems guild
tags: [navigation, markdown, i18n]
relatedDocumentIds:
  [lorestra.docs.security-governance.en, lorestra.docs.what-is-lorestra.en]
nav:
  visible: true
  parentId: folder.engineering
  order: 40
---

# Navigation and content model

Every Markdown document has a stable ID, mutable slug, locale, visibility, publication status, and navigation metadata. The reader validates duplicate IDs, duplicate slugs, missing parents, and cycles before exposing a navigation snapshot.

The menu is a projection of the vault, not a second source of truth. `nav.visible` says that a document belongs in a menu; it does not grant read access. An internal document can be present in an authorized team's menu while remaining absent from the public projection.

## Locales

Localized Docs use parallel folders and stable, language-specific IDs. A missing translation should have an explicit fallback rule rather than a silent duplicate. Links from a translated document should prefer the same locale when it exists and make a language change visible when it does not.

## Validation before rendering

Reject path traversal, unsafe or duplicate slugs, invalid frontmatter, parent cycles, and references to non-existent documents. A generated index may be cached for speed, but it is never editorially canonical and must be rebuildable from Markdown.
