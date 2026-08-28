---
id: lorestra.engineering.architecture
slug: engineering-architecture
locale: en
title: Engineering architecture
description: The seams that keep Lorestra portable from local Markdown to Cloudflare storage.
folderId: folder.engineering
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Engineering guild
tags: [architecture, modules, seams]
relatedDocumentIds:
  [lorestra.engineering.contracts-adapters, lorestra.engineering.mock-removal]
nav:
  visible: true
  parentId: folder.engineering
  order: 10
---

# Engineering architecture

The web application follows Feature-Sliced Design and depends on a small `KnowledgeClient` interface. The API follows Vertical Slice Architecture: each use case owns its route, mapping, and verification. A deep `KnowledgeReader` module hides parsing, indexing, navigation, visibility, and version resolution behind a small interface.

## The seams

- **Contract seam:** `@lorestra/contracts` owns the final transport schemas and stable DTOs.
- **Client seam:** the web composition root chooses an HTTP adapter or the removable memory adapter.
- **Knowledge seam:** the API reader accepts a vault adapter and exposes read semantics, not files.
- **Storage seam:** filesystem is local-only; R2/D1 adapters are future implementations.
- **Auth seam:** a principal resolver and authorization policy are explicit, even while public reads are anonymous.

The application can be run locally without real Cloudflare resources. The Worker entrypoint remains Worker-compatible and compile-checked, while the local runtime reads the example vault or injects the memory adapter for tests.

## A useful depth test

If a page needs to know how Markdown is parsed, how ETags work, or where a revision is stored, a module has leaked. Callers should ask for navigation or a document and receive a typed result. Change belongs behind the seam so locality is preserved.
