---
id: lorestra.engineering.mock-removal
slug: engineering-mock-removal
locale: en
title: Mock removal runbook
description: The exact seam for replacing the in-memory vault with an HTTP client.
folderId: folder.engineering
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Platform guild
tags: [mocks, migration, runbook]
relatedDocumentIds:
  [lorestra.engineering.contracts-adapters, lorestra.docs.using-lorestra.en]
nav:
  visible: true
  parentId: folder.engineering
  order: 30
---

# Mock removal runbook

The mock adapter is a development and test implementation of the client seam. It is not a second product mode. Replace it in one composition location after the HTTP adapter and API are ready.

## Checklist

1. Implement `HttpKnowledgeClient` and `HttpProposalClient` against the final contract.
2. Run the same adapter contract suite against HTTP and memory implementations.
3. Change only the web composition root and development environment selection.
4. Delete `packages/mock-vault` and confirm no production import, fixture path, or mock flag remains.
5. Run typecheck, API integration tests, browser smoke scenarios, and a bundle check.

If a consumer needs a mock-specific method, the seam is too shallow or the contract is incomplete; do not add a conditional escape hatch. The goal is to make the deletion test pass: removing the adapter should not make knowledge semantics reappear across pages.
