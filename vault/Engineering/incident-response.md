---
id: lorestra.engineering.incident-response
slug: engineering-incident-response
locale: en
title: Incident response
description: A lightweight response loop that leaves a useful trail for the next incident.
folderId: folder.engineering
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Reliability guild
tags: [operations, incident, runbook]
relatedDocumentIds: [lorestra.docs.cookbook-incident.en, lorestra.product.feedback-loop]
nav:
  visible: true
  parentId: folder.engineering
  order: 50
---

# Incident response

During an incident, the live channel is for coordination and the vault is for durable context. Stabilize the system first. Afterward, record the timeline, commands, dashboards, and decisions while evidence is still available.

## Response loop

1. Name an incident owner and a next check.
2. Capture customer impact and observed signals without guessing at cause.
3. Choose the smallest reversible mitigation and record who authorized it.
4. When stable, separate symptom, confirmed cause, contributing factors, and open hypotheses.
5. Open a follow-up proposal for material changes to a runbook or operating policy.
6. Ask someone outside the immediate response loop to review the lesson.

The owner is accountable for the proposal, but review should include a fresh perspective. This separation catches hindsight bias before a lesson becomes official.
