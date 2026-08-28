---
id: lorestra.engineering.binding-plan
slug: engineering-binding-plan
locale: en
title: Cloudflare binding plan
description: A future storage plan kept deliberately outside today's local runtime.
folderId: folder.engineering
visibility: internal
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Platform guild
tags: [cloudflare, r2, d1, future]
relatedDocumentIds:
  [lorestra.engineering.architecture, lorestra.docs.security-governance.en]
nav:
  visible: true
  parentId: folder.engineering
  order: 60
---

# Cloudflare binding plan

The Worker entrypoint is compiled against Hono and Cloudflare types, but the hackathon runtime uses a local filesystem adapter. R2 can hold canonical Markdown and immutable revision bodies; D1 can hold metadata, graph edges, proposal states, and revision pointers.

The migration must preserve published-read semantics and optimistic base-version checks. It must define atomic merge behavior before enabling authenticated writes. No binding identifier, secret, or production assumption belongs in the mock package.
