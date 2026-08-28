---
id: lorestra.team.security-escalation
slug: team-security-escalation
locale: en
title: Security escalation
description: What to do when a document, proposal, or adapter may expose sensitive material.
folderId: folder.team
visibility: internal
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Security group
tags: [security, incident, escalation]
relatedDocumentIds:
  [lorestra.docs.security-governance.en, lorestra.engineering.incident-response]
nav:
  visible: true
  parentId: folder.team
  order: 40
---

# Security escalation

If a secret, personal data, or unauthorized internal content appears in a proposal, stop the merge and preserve the proposal identifier and evidence location. Do not copy the sensitive value into chat or a new document. Restrict the affected projection, notify the security owner, and record only the minimum necessary incident context.

## Triage questions

1. Is the material still visible in a public navigation or document response?
2. Which adapter or projection exposed it?
3. Which principal could have seen it, and when?
4. Can the exposure be restricted without destroying evidence?
5. What reviewed correction prevents recurrence?

A redaction is a new reviewed change; silently rewriting history makes later investigation harder. If credentials may have escaped, rotate them through the approved secret-management process rather than putting replacement values in the vault.
