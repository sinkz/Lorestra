---
id: 'lorestra.demo.cygnus.incident.en'
slug: 'demo-cygnus-incident'
locale: 'en'
title: 'Cygnus: mixed units'
description: 'A fictional import combined durations recorded in seconds and milliseconds without conversion metadata.'
folderId: 'folder.demo.cygnus.en'
type: 'incident'
visibility: 'public'
status: 'published'
version: 1
createdAt: '2026-08-30T12:00:00.000Z'
updatedAt: '2026-08-30T12:00:00.000Z'
author: 'Lorestra demo team'
tags: ['demo', 'cygnus', 'research', 'units', 'reproducibility']
relatedDocumentIds:
  [
    'lorestra.demo.cygnus.overview.en',
    'lorestra.demo.cygnus.observations.en',
    'lorestra.demo.cygnus.decision.en',
    'lorestra.demo.cygnus.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.cygnus.en
  order: 40
---

# Cygnus: mixed units

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

In this demonstration, two session exports used the same column label for durations, but one contained seconds and the other milliseconds. A combined chart exaggerated the difference because the import had lost the unit metadata. No real study result is represented.

The example response marks the combined table as invalid, preserves the original exports, and rebuilds derived values only after the units are known. If a unit cannot be established from evidence, retain the record as unresolved rather than inventing a conversion.

- Symptom: a large apparent difference between sessions.
- Confirmed issue in the example: inconsistent units under one label.
- Follow-up: update the collection checklist and declared-units decision.

## Connected examples

- [Cygnus: repeatable evidence](./demo-cygnus-overview.md)
- [Cygnus: observation ledger](./demo-cygnus-observations.md)
- [Cygnus: declared units](./demo-cygnus-decision.md)
- [Cygnus: collection protocol](./demo-cygnus-runbook.md)
