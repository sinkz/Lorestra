---
id: 'lorestra.demo.orion.observations.en'
slug: 'demo-orion-observations'
locale: 'en'
title: 'Orion: latency notebook'
description: 'A fictional measurement notebook distinguishes cache hits, revisions, and sample windows.'
folderId: 'folder.demo.orion.en'
type: 'note'
visibility: 'public'
status: 'published'
version: 1
createdAt: '2026-08-30T12:00:00.000Z'
updatedAt: '2026-08-30T12:00:00.000Z'
author: 'Lorestra demo team'
tags: ['demo', 'orion', 'reliability', 'cache', 'latency']
relatedDocumentIds:
  [
    'lorestra.demo.orion.overview.en',
    'lorestra.demo.orion.decision.en',
    'lorestra.demo.orion.incident.en',
    'lorestra.demo.orion.legacy.en',
    'lorestra.demo.cygnus.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.en
  order: 20
---

# Orion: latency notebook

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

The sample notebook records a request label, response revision, cache result, duration in milliseconds, and observation window. The numbers are demonstration data, not a benchmark or a promise about Lorestra performance.

Averages can hide a small set of slow requests. Record the sample size and distribution, then repeat the same request mix after a change. The linked Cygnus collection procedure provides the shared unit and provenance checklist for this comparison.

- Record the unit at collection time.
- Preserve failed and slow observations rather than silently dropping them.
- Mark a changed request mix before comparing two windows.

## Connected examples

- [Orion: reliable responses](./demo-orion-overview.md)
- [Orion: versioned cache](./demo-orion-decision.md)
- [Orion: stale response](./demo-orion-incident.md)
- [Orion: retired cache rule](./demo-orion-legacy.md)
- [Cygnus: collection protocol](../cygnus/demo-cygnus-runbook.md)
