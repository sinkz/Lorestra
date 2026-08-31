# Native WebMCP evidence — local HTTP backend

Date: 2026-08-31. Browser: Codex in-app browser, actual native WebMCP capability. Page: `http://127.0.0.1:4179/atlas?scope=entire`, frontend HTTP adapter, local Worker/D1/R2, synthetic bilingual vault. No fabricated `navigator.modelContext`, registry double or browser-response mock was used for these checks.

## Observed

- Native discovery returned 11 registered tools, including `lorestra_update_proposal`, read-only/untrusted-content annotations and strict input schemas.
- `lorestra_get_agent_guide({})` returned local session mode, anonymous capabilities, workflow guidance and configured limits. It did not expose an opaque credential.
- `lorestra_search({query:"Lyra",locale:"en",limit:3})` returned three of six results and a continuation cursor. The results included published and archived documents with stable IDs, locale, status and revision-related metadata. After reloading the updated page, the archived result explicitly contained `status:"archived"`.
- `lorestra_read_document({slug:"demo-lyra-legacy",locale:"en"})` returned the archived document's real Markdown, revision/base version 1, metadata and relations from the HTTP backend.
- A deliberate visual review confirmed the approved celestial Atlas, four displayed folder groups (Docs plus Orion/Lyra/Cygnus), 32 visible nodes and 110 relations in the Portuguese fixture. Camera controls, reduced-motion control and list alternative remain available. This screenshot check is not a performance benchmark.

## Authenticated follow-up

After the user authorized synthetic local sessions, actual native tools created and corrected a cookbook, denied contributor approval with `403 forbidden`, approved reviewed content and opened the visible human merge confirmation. The cookbook and a separate runbook correction were published; historical runbook v1 remained readable alongside v2. Independent local HTTP agents also authored, requested changes and reviewed documentation. See [the multi-agent execution record](native-agents-demo.md) for IDs, exact transitions and screenshots.

The test exposed blocking `window.confirm` behavior, replaced by an asynchronous accessible modal. Cancel/Escape and stale-confirmation readback showed no publication. However, the native transport still timed out while awaiting human input: original cancellation/conflict payloads were not captured. After explicit confirmation, identical-payload, same-key retries recovered the persisted successful results without duplicate publication. This limitation remains open; do not call the complete native B29–B30 gate passed.

## Two-agent concurrency follow-up

An additional [two-agent native-tab experiment](dual-webmcp-tabs.md) later recorded overlapping WebMCP updates from two agents on the same proposal: one succeeded and the other returned `409 proposal_version_conflict`. Explicit reconciliation published both contributions once. Both tabs used the same synthetic principal, so this does not establish user/session isolation. The competing stale-document merge retained its unmerged state but still lacked the original response because of the confirmation transport timeout.

## Not certified by this evidence

The malicious-document authority scenario, every native error/cancellation response, cross-machine collaboration and shared staging remain uncertified. The ordinary-browser fallback, HTTP BDD and controller/tool unit tests are separate checks. Only operator-issued synthetic sessions were used; no user account or Cloudflare credential was accessed. Never publish cookies, token files or authenticated traces.
