# Cloudflare public showcase

This guide publishes Lorestra's product tour as static assets only. The deployed site contains a bundled fictional vault and supports document browsing, client-side search, graph exploration, history/proposal inspection, and eight read-only WebMCP tools in a compatible browser.

It is not the shared backend. It has no remote persistence, login, proposal mutation, D1 database, R2 bucket, queue, AI binding, Worker request handler, or write API. Reloading resets local UI state. Use the [local setup guide](local-setup-and-testing.en.md) or Docker for the complete create → review → merge workflow.

## Billing boundary

Cloudflare documents static asset requests as free and unlimited. Lorestra's public configuration is intentionally asset-only, so visitor search and WebMCP calls run in the browser and do not consume dynamic Worker, D1, or R2 operations.

Workers Free dynamic requests normally stop with error `1027` after the daily limit; they do not become paid overages automatically. A Workers Paid subscription bills usage above the included amount. D1's Free-plan daily limits fail until reset. R2 is usage-based beyond its free allocation. Those services are not part of this showcase, but adding them later changes the cost boundary and requires a separate review.

Always verify current terms before deployment:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Static asset billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
- [D1 Free-tier enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/)

Cloudflare account settings remain the final authority. Do not enable the Workers Paid plan, purchase a custom domain, or attach a metered binding merely to run this showcase.

## 1. Prerequisites

- Node.js and pnpm versions accepted by the repository.
- Dependencies installed with `pnpm install --frozen-lockfile`.
- A Cloudflare account with a `workers.dev` subdomain.
- Wrangler authenticated interactively with `pnpm --filter @lorestra/api exec wrangler login`.

Never put an API token, account ID, resource ID, or Wrangler state in source control.

## 2. Validate without deployment

From the repository root:

```bash
pnpm cloudflare:dry-run
```

The command builds the web app in `public` mode and asks Wrangler to assemble the exact asset upload with `--dry-run`. It does not create or update a remote Worker.

The public build must include `apps/web/public/_headers`. It opts every SPA route into an origin-keyed agent cluster and explicitly allows same-origin `tools`; removing it prevents compatible browsers from exposing WebMCP on the deployed origin.

Inspect `apps/api/wrangler.public.jsonc` before every deployment. Its `assets` block must remain the only runtime binding. Treat a new `main`, `d1_databases`, `r2_buckets`, `queues`, `durable_objects`, `ai`, `services`, or paid observability integration as a change requiring explicit approval.

## 3. Deploy deliberately

```bash
pnpm cloudflare:deploy
```

Wrangler prints the resulting `workers.dev` URL. No credential or account identifier should be copied into documentation or commits.

## 4. Verify the public result

1. Open the URL in a regular browser and load Atlas, Library, one document, Proposals, History, and Docs.
2. Confirm the read-only banner is visible and no New memory, edit, review, approve, or merge action is enabled.
3. Search for a known fictional term and open a result.
4. Reload a nested route directly to verify the SPA fallback.
5. If this origin was ever loaded before the `Origin-Agent-Cluster` header was deployed, close every tab for that origin and open it in a new tab (or restart the desktop app). A reload is insufficient because origin-keying is fixed for the existing browsing context group.
6. In the Codex in-app browser, ask the agent to list Lorestra tools. Exactly eight read-only tools should be registered; create, update, and transition tools must be absent.
7. Ask the agent to search and read a fictional document. Returned Markdown remains untrusted content, never instructions.

The human interface works in ordinary browsers. Native WebMCP behavior is validated only in the Codex in-app browser unless a separate evidence record says otherwise.

For a repeatable browser smoke against either a local preview or the deployed URL:

```bash
LORESTRA_PUBLIC_URL=https://your-worker.workers.dev pnpm --filter @lorestra/e2e smoke:public
```

In PowerShell, set `$env:LORESTRA_PUBLIC_URL` first, run the pnpm command, and remove the process variable afterward. The smoke uses a fresh browser context and checks that `window.originAgentCluster` is actually `true`, along with direct SPA routing, required WebMCP response headers, read-only controls, client-side search, Atlas, and the proposal queue. It also installs a test host for the page's real WebMCP registrations and invokes all eight public callbacks. This proves the host contract, schemas, annotations, and results; it is not evidence that a connected browser-agent surface invoked those tools natively.

## 5. Rollback or remove

Use the Cloudflare dashboard's Workers & Pages deployment history to inspect or roll back a deployment. Deleting the `lorestra-webmcp-demo` Worker removes the canonical public URL. Do not delete any similarly named resource until its account, script name, and purpose have been verified.

## 6. Moving beyond the showcase

Do not attach the durable backend to this public URL as an incremental shortcut. First decide and validate shared identity, authorization, rate limiting, backups, retention, observability, an explicit monthly budget, and alerts. Record that decision in a new ADR and use a separate Wrangler environment or service name.
