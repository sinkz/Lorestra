---
id: 'lorestra.demo.cygnus.decision.en'
slug: 'demo-cygnus-decision'
locale: 'en'
title: 'Cygnus: declared units'
description: 'An example research decision requires explicit units and preserves raw values before conversion.'
folderId: 'folder.demo.cygnus.en'
type: 'decision'
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
    'lorestra.demo.cygnus.incident.en',
    'lorestra.demo.cygnus.runbook.en',
  ]
nav:
  visible: true
  parentId: folder.demo.cygnus.en
  order: 30
---

# Cygnus: declared units

> Fictional demonstration. These examples are not records of real incidents, learners, or research results.

Decision for this fictional study: every observation declares its unit, and conversion creates a derived value with a named rule. The raw value remains unchanged. A column heading alone is not enough when records from different sessions may later be combined.

This adds metadata and makes invalid combinations easier to reject. Revisit the schema when the question or instrument changes; do not guess a missing unit merely to complete a table.

- Owner: the fictional research pair.
- Evidence: the observation ledger and mixed-units incident.
- Review signal: a new measurement method or an ambiguous imported record.

## Connected examples

- [Cygnus: repeatable evidence](./demo-cygnus-overview.md)
- [Cygnus: observation ledger](./demo-cygnus-observations.md)
- [Cygnus: mixed units](./demo-cygnus-incident.md)
- [Cygnus: collection protocol](./demo-cygnus-runbook.md)
