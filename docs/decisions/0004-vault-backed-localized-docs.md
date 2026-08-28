# ADR-0004: Treat product documentation as localized vault knowledge

## Status

Accepted

## Date

2026-08-28

## Context

Lorestra needs a documentation page explaining the product, human and agent workflows, and practical cookbooks. Hardcoding those pages in React would contradict the product promise: useful knowledge should be editable, versioned, searchable, connected, and improvable by agents.

## Decision

Store product documentation as normal Markdown entries under `Docs/en` and `Docs/pt-BR`. The Docs menu resolves to the active locale's landing document. Documentation uses the same read, relation, proposal, review, and history flows as every other vault entry.

UI strings remain in i18next resources. Content language and interface language are related but separate concepts; a document declares its own locale and may link to a translated counterpart.

## Alternatives considered

### Hardcoded React documentation routes

Easy to style, but agents cannot manipulate the content through Lorestra and the content bypasses version governance. Rejected.

### One bilingual Markdown file per topic

Makes search and navigation noisy and complicates independent translation updates. Rejected.

### External documentation site

Useful later for public marketing, but weakens the proof that Lorestra can document itself. Deferred.

## Consequences

- Lorestra demonstrates its own value with self-hosted knowledge.
- Agents can propose documentation improvements through the same contract.
- Localized counterparts need stable relationship metadata.
- Interface translation coverage and vault content coverage are validated separately.
