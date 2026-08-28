---
id: lorestra.product.launch-readiness
slug: product-launch-readiness
locale: en
title: Launch readiness
description: A practical checklist for launching a knowledge surface without hiding risk.
folderId: folder.product
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Product and delivery
tags: [launch, quality, risk]
relatedDocumentIds: [lorestra.product.north-star, lorestra.team.collaboration-protocol]
nav:
  visible: true
  parentId: folder.product
  order: 40
---

# Launch readiness

A launch is ready when the happy path, failure path, ownership, and rollback story are all visible. The checklist is a conversation starter, not evidence by itself.

## Reader path

- Browse folders and open a document from the menu.
- Search for a known incident and inspect its relations.
- Open Preview, Markdown, Relations, and History without losing URL context.
- Verify English and Portuguese fallback behavior.
- Exercise empty, not-found, and network-error states.

## Contributor path

- A draft proposal does not change the published body.
- Approval is visible but does not publish.
- Merge creates one new immutable revision and one history event.
- A stale base version is rejected instead of overwriting current knowledge.
- Public projections exclude internal and draft content.

Record unresolved risks, owners, launch date, and rollback condition in the proposal. Observe real use after launch; a checklist cannot replace feedback.
