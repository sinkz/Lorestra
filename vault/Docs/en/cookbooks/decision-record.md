---
id: lorestra.docs.cookbook-decision.en
slug: cookbook-decision-record
locale: en
title: 'Cookbook: decision record'
description: Make a consequential decision easy to revisit without reopening the entire debate.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-02T09:00:00.000Z
updatedAt: 2026-08-21T09:00:00.000Z
author: Product and engineering
tags: [cookbook, decision, adr]
relatedDocumentIds:
  [lorestra.product.north-star, lorestra.engineering.contracts-adapters]
nav:
  visible: true
  parentId: folder.docs.en
  order: 60
---

# Cookbook: decision record

Start with the decision question and the date by which it matters. A reader should be able to understand the context, the chosen path, and the conditions for revisiting it without replaying every conversation.

## Required sections

- **Question:** What decision must be made?
- **Context:** Which user, technical, or operational constraint makes it relevant now?
- **Options:** At least two viable options, including the cost of doing nothing.
- **Decision:** What was chosen and why?
- **Dissent:** Which evidence or person disagreed, and what risk remains?
- **Revisit signal:** What metric, event, or date would cause a new proposal?
- **Owner:** Who keeps the decision connected to reality?

An agent can compare prior decisions and flag inconsistent assumptions, but it should preserve source links and mark interpretation as interpretation. A polished summary without provenance is not a decision record.

When new evidence changes the context, propose a focused correction or a new decision. Do not edit the old record until the history can explain what changed and why.
