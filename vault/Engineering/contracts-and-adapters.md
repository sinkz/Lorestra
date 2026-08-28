---
id: lorestra.engineering.contracts-adapters
slug: engineering-contracts-and-adapters
locale: en
title: Contracts and adapters
description: How the final contract stays stable while implementations change.
folderId: folder.engineering
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Platform guild
tags: [contracts, adapters, testing]
relatedDocumentIds:
  [lorestra.engineering.architecture, lorestra.docs.security-governance.en]
nav:
  visible: true
  parentId: folder.engineering
  order: 20
---

# Contracts and adapters

`@lorestra/contracts` is the final shared transport contract. It owns runtime schemas and stable DTOs, not application internals. The web's `KnowledgeClient` validates responses and normalizes transport errors. The API maps its domain records to the same DTOs.

## What a consumer may know

A consumer may know the shape and invariants of the `KnowledgeClient` interface: which input identifies a document, how not-found differs from a network error, and whether cancellation is supported. It should not know the URL layout, Hono context, Cloudflare bindings, frontmatter keys, or a physical vault path.

## What an adapter absorbs

An adapter absorbs protocol and storage details. `MockKnowledgeClient` and `MockProposalClient` use deterministic in-memory records. An HTTP adapter will validate the same schemas over `fetch`. A filesystem reader will parse Markdown locally. A future R2/D1 implementation can replace both without changing pages or query hooks.

The mock is removable because it is selected only by composition. There is no `USE_MOCK` branch in a feature and no fixture import from an entity. Adapter contract tests are the guard against a fake that behaves differently from the final interface.
