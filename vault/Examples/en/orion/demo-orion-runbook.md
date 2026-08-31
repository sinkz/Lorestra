---
id: 'lorestra.demo.orion.runbook.en'
slug: 'demo-orion-runbook'
locale: 'en'
title: 'Orion: recovery checklist'
description: 'A fictional operational checklist verifies revision correctness before restoring a cache path.'
folderId: 'folder.demo.orion.en'
type: 'process'
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
  ]
nav:
  visible: true
  parentId: folder.demo.orion.en
  order: 50
---

# Orion: recovery checklist

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

Use this example checklist when the returned revision disagrees with the requested revision. It is a teaching artifact, not a production runbook: adapt ownership, permissions, and rollback steps before using the pattern in a real service.

1. Record the requested and returned revision without copying sensitive content.
2. Reproduce with the same request label and observation window.
3. Ask the service owner to authorize a reversible cache bypass.
4. Verify correctness and latency on the bypassed path.
5. Restore the cache only after the corrected keying policy is reviewed.

Attach the evidence to a proposal and connect the incident, cache decision, and updated lesson. Keep hypotheses separate from observations.

## Connected examples

- [Orion: reliable responses](./demo-orion-overview.md)
- [Orion: versioned cache](./demo-orion-decision.md)
- [Orion: stale response](./demo-orion-incident.md)
- [Orion: retired cache rule](./demo-orion-legacy.md)
