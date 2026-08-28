---
id: lorestra.docs.humans-and-agents.en
slug: humans-and-agents
locale: en
title: Humans and multiple agents
description: A collaboration model in which every actor leaves inspectable context.
folderId: folder.docs.en
visibility: public
status: published
version: 1
createdAt: 2026-08-01T09:00:00.000Z
updatedAt: 2026-08-20T10:00:00.000Z
author: Lorestra team
tags: [agents, collaboration, handoff]
relatedDocumentIds:
  [lorestra.team.agent-operating-manual, lorestra.docs.security-governance.en]
nav:
  visible: true
  parentId: folder.docs.en
  order: 30
---

# Humans and multiple agents

Lorestra treats humans and agents as peers in discovery but not as indistinguishable authorities. An agent may search, summarize, compare revisions, connect related documents, and prepare a proposal. A human reviewer decides whether the evidence and scope are good enough to publish, unless an explicit future policy grants an equivalent authenticated role.

## Make every handoff inspectable

Every contribution should state:

- the intended outcome and audience;
- the documents and external sources inspected;
- assumptions and confidence;
- the seam or files changed;
- unresolved questions;
- the exact check a successor should run.

Multiple agents can work in parallel when their roles are distinct. One agent can gather evidence, another can challenge contradictions, and a third can edit the proposal for clarity. Parallel activity is not a substitute for a single owner who integrates the result.

## Preserve provenance

An agent should quote only the minimum useful evidence, link to the source document, and distinguish an observation from an inference. A fluent paragraph without provenance is not a trustworthy knowledge change. If an agent discovers that a published document is incomplete, it should open a proposal or leave a review comment rather than silently patching the vault.

See [WebMCP agent tools](webmcp-agent-tools.md), the [agent handoff cookbook](cookbooks/agent-handoff.md), and the [security and governance guide](security-and-governance.md) before automating a write.
