---
id: lorestra.docs.security-governance.en
slug: security-and-governance
locale: en
title: Security and governance
description: Guardrails that keep portable knowledge useful without making it unsafe.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-20T10:00:00.000Z
author: Lorestra team
tags: [security, governance, privacy]
relatedDocumentIds:
  [lorestra.engineering.navigation-content-model, lorestra.team.security-escalation]
nav:
  visible: true
  parentId: folder.docs.en
  order: 40
---

# Security and governance

The first release is public and read-only. Read access, menu presence, proposal authority, review authority, and merge authority are separate decisions. A document can appear in an authorized team's menu while remaining absent from the public projection.

## Protect the source

Treat Markdown as untrusted input. Render with raw HTML disabled, validate frontmatter, reject path traversal, and keep secrets, credentials, tokens, and unnecessary personal data out of the vault. Do not use a document's slug or menu visibility as an authorization check.

## Protect the workflow

A future authenticated adapter will resolve a principal and an authorization policy. Client-side flags cannot grant write or merge authority. A proposal records its target and base version. Approval means that reviewers accept the content; merge is the operation that creates the next published revision. History should be append-only from the product point of view.

## Handle an exposure

If sensitive content appears in a proposal, stop the merge, preserve the proposal identifier and evidence location, restrict the affected projection, and notify the security owner. Do not copy the sensitive value into a new document or chat message. A redaction is a new reviewed change; silently rewriting history makes later investigation harder.

For the operational response loop, read [Incident to reusable knowledge](cookbooks/incident-to-knowledge.md) and the Team [security escalation](../../Team/security-escalation.md) document.
