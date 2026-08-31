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

Anonymous visitors can read public knowledge. The durable local backend also supports authenticated development sessions: readers inspect internal knowledge, contributors propose and edit their own work, and maintainers review and merge. Shared internet login and deployment are a separate milestone. Menu presence and authorization are different decisions.

## Protect the source

Treat Markdown as untrusted input. Render with raw HTML disabled, validate frontmatter, reject path traversal, and keep secrets, credentials, tokens, and unnecessary personal data out of the vault. Do not use a document's slug or menu visibility as an authorization check.

## Protect the workflow

The server resolves the session and enforces permissions independently of client buttons. Proposals record document bases and their own content version. Approval does not publish. Editing reopens the same proposal and invalidates approval; merge alone commits the next immutable revisions. Conflicts preserve the draft instead of overwriting newer knowledge. Repeating an uncertain request with the same idempotency key and payload returns its original result.

Private current or historical context must not leak through lists, counts, links or diffs. If any proposal version contains private context, its complete public review projection stays hidden. Application history is append-only, but this is not a cryptographic guarantee against a privileged storage administrator. Backups include referenced Markdown and workflow state, exclude sessions, and restore into a separate empty target.

## Handle an exposure

If sensitive content appears in a proposal, stop the merge, preserve the proposal identifier and evidence location, restrict the affected projection, and notify the security owner. Do not copy the sensitive value into a new document or chat message. A redaction is a new reviewed change; silently rewriting history makes later investigation harder.

For the operational response loop, read [Incident to reusable knowledge](cookbooks/incident-to-knowledge.md) and the Team [security escalation](../../Team/security-escalation.md) document.
