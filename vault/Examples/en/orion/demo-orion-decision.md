---
id: 'lorestra.demo.orion.decision.en'
slug: 'demo-orion-decision'
locale: 'en'
title: 'Orion: versioned cache'
description: 'An example decision keys immutable cache entries by document and revision.'
folderId: 'folder.demo.orion.en'
type: 'decision'
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
    'lorestra.demo.orion.observations.en',
    'lorestra.demo.orion.incident.en',
    'lorestra.demo.orion.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.en
  order: 30
---

# Orion: versioned cache

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

Decision for this fictional service: cache an immutable revision under a key containing the document identifier and revision. Resolve the current revision separately, with a short, explicit freshness policy, instead of overwriting one ambiguous document key.

This adds an extra lookup and requires an eviction budget. Revisit the decision if measurements show that the lookup dominates latency or if revision retention becomes too costly; do not silently weaken the correctness requirement to improve a chart.

- Owner: the fictional service team.
- Evidence: the latency notebook and stale-response incident.
- Review trigger: changed freshness requirements or sustained lookup overhead.

## Connected examples

- [Orion: reliable responses](./demo-orion-overview.md)
- [Orion: latency notebook](./demo-orion-observations.md)
- [Orion: stale response](./demo-orion-incident.md)
- [Orion: recovery checklist](./demo-orion-runbook.md)
