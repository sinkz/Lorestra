---
id: lorestra.engineering.review-checklist
slug: engineering-review-checklist
locale: en
title: Engineering review checklist
description: A concise review surface for changes that cross modules or adapters.
folderId: folder.engineering
visibility: internal
status: published
version: 1
createdAt: 2026-08-05T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Engineering guild
tags: [review, quality, checklist]
relatedDocumentIds:
  [lorestra.engineering.contracts-adapters, lorestra.team.collaboration-protocol]
nav:
  visible: true
  parentId: folder.engineering
  order: 70
---

# Engineering review checklist

Before merging a change, ask whether its interface is smaller than its implementation and whether the seam is in the right place.

- Is the final contract validated at runtime?
- Does the consumer depend only on an interface, not an adapter detail?
- Are public reads still read-only and policy-filtered?
- Does a proposal leave the published document unchanged until merge?
- Does a version conflict fail safely rather than overwrite current knowledge?
- Are Markdown rendering, path handling, and i18n behavior covered?
- Is the Worker entrypoint free of Node-only imports?
- Is the verification command recorded for the next reviewer?

Review locality matters: a fix should make the invariant true for every consumer, not only for the scenario that motivated the change.
