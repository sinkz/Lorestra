---
id: 'lorestra.demo.orion.legacy.en'
slug: 'demo-orion-legacy'
locale: 'en'
title: 'Orion: retired cache rule'
description: 'Archived fictional guidance that treated a cache hit as sufficient evidence of freshness.'
folderId: 'folder.demo.orion.en'
type: 'note'
visibility: 'public'
status: 'archived'
version: 1
createdAt: '2026-08-30T12:00:00.000Z'
updatedAt: '2026-08-30T12:00:00.000Z'
author: 'Lorestra demo team'
tags: ['demo', 'orion', 'reliability', 'cache', 'latency']
relatedDocumentIds:
  [
    'lorestra.demo.orion.overview.en',
    'lorestra.demo.orion.observations.en',
    'lorestra.demo.orion.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.en
  order: 60
---

# Orion: retired cache rule

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

This archived demonstration records a discarded rule: treat any successful cache hit as proof that a document is current. The assumption was convenient but failed to distinguish response success from revision correctness.

Do not apply this rule. It remains visible to explain the stale-response incident and why the team replaced its original workflow; retaining the rejected assumption makes the later decision easier to understand.

Superseded by [Orion: reliable responses](./demo-orion-overview.md).

## Connected examples

- [Orion: reliable responses](./demo-orion-overview.md)
- [Orion: latency notebook](./demo-orion-observations.md)
- [Orion: recovery checklist](./demo-orion-runbook.md)
