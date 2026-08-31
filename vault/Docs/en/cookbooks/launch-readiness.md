---
id: lorestra.docs.cookbook-launch.en
slug: cookbook-launch-readiness
locale: en
title: 'Cookbook: launch readiness'
description: Make a knowledge surface ready to ship without hiding risk.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-03T09:00:00.000Z
updatedAt: 2026-08-22T09:00:00.000Z
author: Product and delivery
tags: [cookbook, launch, quality]
relatedDocumentIds:
  [lorestra.product.launch-readiness, lorestra.engineering.mock-removal]
nav:
  visible: true
  parentId: folder.docs.en
  order: 80
---

# Cookbook: launch readiness

Use this recipe when a knowledge surface is ready for a deliberate launch. A green checklist is useful only when it remains connected to an owner, evidence, and a rollback decision.

## Check the reader path

- Browse folders and open a document from the menu.
- Search for a known incident and inspect its relations.
- Open Preview, Markdown, Relations, and History without losing URL context.
- Verify English and Portuguese fallback behavior.
- Exercise empty, not-found, and network-error states.

## Check the contributor path

- A draft proposal does not change the published body.
- Approval is visible but does not publish.
- Merge creates one new immutable revision and one history event.
- A stale base version is rejected instead of overwriting current knowledge.
- Public projections exclude internal and draft content.

Record unresolved risks, owners, launch date, and rollback condition in the proposal. Observe real use after launch; a checklist cannot replace feedback.
