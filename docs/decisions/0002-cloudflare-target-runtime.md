# ADR-0002: Target Cloudflare Workers without provisioning infrastructure yet

## Status

Accepted

## Date

2026-08-28

## Context

Lorestra should run economically on Cloudflare, but the current milestone is product and UX validation. Binding the first implementation to real D1 or R2 resources would slow the design loop and introduce account configuration, credentials, and deployment state into an open-source hackathon repository.

## Decision

Build a Hono API for the Cloudflare Workers runtime using web-standard APIs. Organize it by vertical slice and inject persistence/authentication ports at the composition root.

Keep a fixed `compatibility_date` in `wrangler.jsonc`. Generate binding types with Wrangler when bindings are introduced. Do not add production identifiers or credentials to source control.

The intended production split is:

- R2: canonical Markdown bodies and immutable revision objects.
- D1: searchable metadata, links, proposal state, and published revision pointers.
- Cloudflare Access or an OIDC adapter: authenticated proposal/review actions.

No production write routes are enabled before authentication and authorization exist.

## Alternatives considered

### Deploy immediately to D1 and R2

Would validate infrastructure early, but distracts from the hackathon product and introduces environment-specific state. Deferred.

### Use a Node-only backend

Would permit filesystem shortcuts that do not translate safely to Workers. Rejected.

### Store every artifact only in Git

Excellent for repository history but insufficient as the only product model for concurrent proposals, permissions, and queryable audit history. Git remains an editorial/export mechanism, not the complete runtime model.

## Consequences

- Runtime code avoids unsupported Node assumptions.
- Local adapters must still honor production invariants.
- Real Cloudflare integration is a bounded adapter task rather than a rewrite.
- Durability, concurrency, abuse limits, and backups remain explicitly unimplemented in this milestone.
