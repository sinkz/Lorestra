---
id: lorestra.docs.cookbook-incident.en
slug: cookbook-incident-to-knowledge
locale: en
title: Cookbook: incident to reusable knowledge
description: Turn an incident timeline into a small, verifiable runbook.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-02T09:00:00.000Z
updatedAt: 2026-08-21T09:00:00.000Z
author: Reliability guild
tags: [cookbook, incident, operations]
relatedDocumentIds: [lorestra.engineering.incident-response, lorestra.docs.security-governance.en]
nav:
  visible: true
  parentId: folder.docs.en
  order: 50
---

# Cookbook: incident to reusable knowledge

Use this recipe after the system is stable. The goal is not a perfect essay; it is the smallest durable lesson that helps the next responder act safely.

## Steps

1. Create a proposal with the incident identifier and an explicit base version.
2. Link the timeline, dashboards, commands, and decisions. Distinguish observed facts from hypotheses.
3. Ask one agent to draft a concise lesson and another to challenge unsupported claims.
4. Convert the result into a runbook with trigger, diagnosis, mitigation, owner, and follow-up.
5. Review the diff. Check that examples do not contain credentials or personal data.
6. Approve the proposal only when the operational owner accepts the burden of keeping it true.
7. Merge deliberately. The merge creates a new document version; drafting and approval do not alter what readers see.

## Suggested shape

```md
## Trigger

What signal means this runbook applies?

## Diagnose

What can a responder check without making the incident worse?

## Mitigate

What is the reversible first action, and who can authorize the next one?

## Learn

Which evidence supports the lesson, and what would make us revisit it?
```

Link the resulting document from the incident record and add a follow-up date. If the lesson becomes false, open a new proposal instead of erasing the old reasoning.
