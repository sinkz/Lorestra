---
id: lorestra.docs.cookbook-agent-handoff.en
slug: cookbook-agent-handoff
locale: en
title: 'Cookbook: handoff between agents'
description: A bounded handoff that lets a second agent continue without guessing.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-02T09:00:00.000Z
updatedAt: 2026-08-21T09:00:00.000Z
author: Agent council
tags: [cookbook, agents, handoff]
relatedDocumentIds:
  [lorestra.team.agent-operating-manual, lorestra.docs.humans-and-agents.en]
nav:
  visible: true
  parentId: folder.docs.en
  order: 70
---

# Cookbook: handoff between agents

A handoff is a compact contract. It should reduce the amount the next agent has to infer, not become another long status report.

## Handoff template

```text
Goal: one sentence describing the outcome.
Evidence: documents, tests, and external sources inspected.
Changed seam: module/interface/adapter touched, if any.
Not changed: explicit exclusions and preserved user work.
Open questions: assumptions that need a decision.
Next check: exact command or scenario to run.
Owner: person or agent responsible for integration.
```

The receiving agent verifies the current state before continuing. If the task has moved, it records why the seam or scope must change. A handoff does not grant publication authority; any durable change still travels through a proposal and review.

For parallel work, assign different files or seams and name the integration owner. One agent can gather evidence, another can inspect accessibility, and a third can test the adapter contract. The owner resolves conflicts before merge and reports verification honestly.
