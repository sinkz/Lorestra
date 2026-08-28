---
id: lorestra.product-experiment-log
slug: product-experiment-log
locale: en
title: Experiment log
description: A place to keep hypotheses, outcomes, and the decision each experiment unlocked.
folderId: folder.product
visibility: internal
status: published
version: 1
createdAt: 2026-08-03T09:00:00.000Z
updatedAt: 2026-08-28T12:00:00.000Z
author: Product guild
tags: [experiments, learning, measurement]
relatedDocumentIds:
  [lorestra.product.feedback-loop, lorestra.product.discovery-to-decision]
nav:
  visible: true
  parentId: folder.product
  order: 60
---

# Experiment log

Each experiment names a hypothesis, audience, timebox, success signal, failure signal, and decision owner. The result should say what the evidence changed, not only whether a metric moved.

## Current examples

| Hypothesis                                                  | Signal                                   | Status  | Next decision                                      |
| ----------------------------------------------------------- | ---------------------------------------- | ------- | -------------------------------------------------- |
| A relation preview helps a reader choose the right document | Time to first useful context             | Running | Keep, narrow, or remove the relation panel         |
| Proposal diffs improve review confidence                    | Reviewer comments per changed file       | Planned | Test with one Engineering and one Product proposal |
| Bilingual Docs reduce first-session confusion               | Successful first browse in chosen locale | Planned | Improve fallback or expand translations            |

Do not turn an experiment log into a dashboard of vanity metrics. Link each row to evidence and, when the conclusion becomes durable, create a reviewed document.
