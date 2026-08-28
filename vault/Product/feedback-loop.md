---
id: lorestra.product.feedback-loop
slug: product-feedback-loop
locale: en
title: Feedback loop
description: How product feedback becomes a bounded, reviewable knowledge change.
folderId: folder.product
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Product guild
tags: [feedback, measurement, learning]
relatedDocumentIds:
  [lorestra.engineering.incident-response, lorestra.product.launch-readiness]
nav:
  visible: true
  parentId: folder.product
  order: 30
---

# Feedback loop

Feedback enters as a source-linked note, not as an unowned backlog item. Cluster related observations, identify the user or team affected, and choose a test. The resulting proposal should include evidence, expected behavior change, owner, and a review signal.

## Loop

```text
collect → cluster → hypothesize → test → decide → propose → review → merge → observe
```

After merge, link outcomes back to the document. If the lesson stops being true, open a new proposal rather than rewriting history. This keeps the loop honest and gives agents a reliable temporal signal.

The loop should produce fewer, clearer changes rather than an ever-growing stream of annotations. A proposal with no source, owner, or next check is not ready for review; return it for clarification instead of guessing.
