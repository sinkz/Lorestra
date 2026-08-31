---
id: 'lorestra.demo.orion.incident.en'
slug: 'demo-orion-incident'
locale: 'en'
title: 'Orion: stale response'
description: 'A fictional incident shows why successful cache hits can still return old content.'
folderId: 'folder.demo.orion.en'
type: 'incident'
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
    'lorestra.demo.orion.decision.en',
    'lorestra.demo.orion.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.orion.en
  order: 40
---

# Orion: stale response

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

In this demonstration, a publication completed while one cache key still held the previous revision. Requests returned successfully, but the response revision did not match the revision selected by the reader. No real outage or customer is represented.

The example mitigation is to bypass the affected cache path and verify the authoritative revision before restoring traffic to that path. The lesson is to observe correctness explicitly; a successful status code and a high hit rate do not establish it.

- Symptom: an older revision was returned.
- Contributing design: a key did not distinguish immutable revisions.
- Follow-up: review the versioned-cache decision and recovery procedure.

## Connected examples

- [Orion: reliable responses](./demo-orion-overview.md)
- [Orion: latency notebook](./demo-orion-observations.md)
- [Orion: versioned cache](./demo-orion-decision.md)
- [Orion: recovery checklist](./demo-orion-runbook.md)
