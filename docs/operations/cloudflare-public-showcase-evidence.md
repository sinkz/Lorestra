# Cloudflare public showcase evidence

Date: 2026-09-02. Target: [public Lorestra Atlas](https://lorestra-webmcp-demo.diego-augusto-gdp.workers.dev/atlas?scope=entire).

## Deployment boundary

Wrangler assembled 36 static files and uploaded the 22 new or modified assets for the `lorestra-webmcp-demo` asset-only Worker. The validated public configuration has no Worker entry point and no D1, R2, KV, Queue, Durable Object, AI, service, secret, or observability binding. The bundle uses the anonymous read-only composition and an immutable fictional vault.

The first route check ran before edge propagation completed and returned a non-success response. Direct checks of `/` and `/library` then returned HTTP 200 with the same SPA entry, and the complete remote smoke passed on the next run. This transient result is not counted as a successful validation.

An initial native discovery attempt exposed a deployment defect: static responses did not opt into an origin-keyed agent cluster. The Vite public directory now ships a Cloudflare `_headers` rule for every route. After redeployment, a direct edge response returned `Origin-Agent-Cluster: ?1` and `Permissions-Policy: tools=(self)`. These headers satisfy the WebMCP origin-isolation gate and explicitly preserve same-origin tool registration.

Reloading the tab that first observed the origin without the header is not a valid retest. Origin-keying is kept consistent inside a browsing context group, so that old group remains site-keyed even after the response is corrected. A fresh public origin was therefore deployed under the canonical `lorestra-webmcp-demo` name. It returned `window.originAgentCluster === true` in an isolated browser context and registered tools natively in the Codex in-app browser.

## Remote browser smoke

The final Playwright run against the deployed URL passed:

- direct `/library` SPA navigation;
- visible read-only state and no enabled proposal creation;
- client-side document search;
- Atlas graph rendering;
- proposal queue/detail reads with no enabled approve, request-changes, or merge action.
- the required WebMCP origin-isolation and permissions-policy response headers.

## WebMCP host-contract smoke

The same remote run installed a page-scoped test host before application initialization. The application registered exactly these eight tools, all with `readOnlyHint: true`, and every callback returned a successful structured result:

- `lorestra_get_agent_guide`;
- `lorestra_list_documents`;
- `lorestra_read_document`;
- `lorestra_search`;
- `lorestra_read_graph`;
- `lorestra_list_proposals`;
- `lorestra_read_proposal`;
- `lorestra_read_history`.

The smoke used returned document and proposal identities as inputs to subsequent reads. It verified non-empty documents, search results, graph nodes, proposals, and history. The agent guide reports proposal reads as enabled while every proposal mutation capability is disabled. The write tools `lorestra_create_proposal`, `lorestra_update_proposal`, and `lorestra_transition_proposal` were absent.

This host-contract smoke exercises the real public bundle, registration definitions, validation, callbacks, adapters, and data. The test host stands in for a browser agent's registry, so it is separate from the native-agent evidence below.

## Native Codex in-app browser evidence

The Codex in-app browser opened the canonical public origin in a fresh browsing context and discovered the same eight tools. The connected agent invoked every tool through the browser's native WebMCP surface rather than a page-injected registry:

- the guide returned the anonymous, read-only public session;
- document listing returned three entries in the bounded request;
- search for `cache` returned three matches and a continuation cursor;
- document reading returned `demo-orion-overview`;
- the graph returned 32 nodes;
- proposal listing and reading returned `proposal-launch-cookbook-003`;
- history returned three entries.

Every invocation succeeded and carried `readOnlyHint: true`. The public origin therefore has both repeatable host-contract coverage and direct native Codex-browser execution evidence. Native evidence for the full writable local application remains recorded separately in [local release evidence](local-release-evidence.md).
