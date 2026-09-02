# ADR-0009: Publish the public showcase as static assets only

## Status

Accepted

## Date

2026-09-01

## Context

Lorestra needs a public URL where hackathon visitors can inspect the product and use native WebMCP reads in a compatible browser. The durable local application already demonstrates the complete proposal and publication workflow, but exposing that backend would require shared identity, abuse controls, remote persistence, backup policy, and an explicit billing budget.

The public experience does not need to accept or retain mutations. Search, graph traversal, document reads, proposal reads, and history reads can operate over the bounded fictional vault already packaged with the frontend.

## Decision

Deploy the public showcase with Cloudflare Workers Static Assets and no Worker entry point. The `public` Vite mode selects the contract-compatible mock adapter at the composition root and creates an anonymous read-only session. The browser registers only tool definitions annotated with `readOnlyHint: true`; create, update, review, and merge tools are not registered.

Ship an `_headers` rule with the static bundle that sets `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)` on every SPA route. This is part of the public WebMCP contract, not a dynamic Worker or binding.

The public Wrangler configuration contains only an assets directory and single-page application fallback. It contains no D1, R2, Durable Object, Queue, AI, service, environment-secret, or rate-limit binding. All public data is an immutable fictional snapshot shipped in the JavaScript bundle. Reloading resets process-local UI state, and one visitor cannot change another visitor's view.

The full Worker/D1/R2 application remains the local and Docker path. A future shared cloud deployment requires a separate decision covering identity, authorization, persistence, backups, abuse limits, observability, budget alerts, and rollback.

## Alternatives considered

### Deploy the durable backend on the free tiers

This would demonstrate remote writes, but daily D1 limits can make the service unavailable and R2 is usage-based beyond its free allocation. It would also expose an unauthenticated collaboration surface before shared identity is complete. Rejected for the public hackathon showcase.

### Add a dynamic Worker only for rate limiting

This introduces metered Worker invocations to protect operations that already happen locally in each browser. It adds cost and failure modes without protecting a shared backend. Rejected.

### Host only screenshots

This has a similarly small infrastructure footprint, but visitors and agents could not exercise search, navigation, graph exploration, or native read-only WebMCP. Rejected.

## Consequences

- Static asset delivery is the only Cloudflare runtime surface for the showcase.
- The public URL demonstrates discovery and retrieval, not shared persistence or collaboration.
- The same typed clients and screens remain in use; only the composition root and registered tool set change.
- A dry-run can validate the bundle without creating Cloudflare resources.
- Any addition to `wrangler.public.jsonc` requires a cost and security review because it can change the billing boundary.
