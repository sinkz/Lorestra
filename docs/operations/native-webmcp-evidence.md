# Native WebMCP evidence — local HTTP backend

Date: 2026-08-31. Browser: Codex in-app browser, actual native WebMCP capability. Page: `http://127.0.0.1:4179/atlas?scope=entire`, frontend HTTP adapter, local Worker/D1/R2, synthetic bilingual vault. No fabricated `navigator.modelContext`, registry double or browser-response mock was used for these checks.

## Observed

- Native discovery returned 11 registered tools, including `lorestra_update_proposal`, read-only/untrusted-content annotations and strict input schemas.
- `lorestra_get_agent_guide({})` returned local session mode, anonymous capabilities, workflow guidance and configured limits. It did not expose an opaque credential.
- `lorestra_search({query:"Lyra",locale:"en",limit:3})` returned three of six results and a continuation cursor. The results included published and archived documents with stable IDs, locale, status and revision-related metadata. After reloading the updated page, the archived result explicitly contained `status:"archived"`.
- `lorestra_read_document({slug:"demo-lyra-legacy",locale:"en"})` returned the archived document's real Markdown, revision/base version 1, metadata and relations from the HTTP backend.
- A deliberate visual review confirmed the approved celestial Atlas, four displayed folder groups (Docs plus Orion/Lyra/Cygnus), 32 visible nodes and 110 relations in the Portuguese fixture. Camera controls, reduced-motion control and list alternative remain available. This screenshot check is not a performance benchmark.

## Not certified by this evidence

Authenticated native creation/resubmission/approval/merge and its human confirmation have **not yet been executed in the native browser**. Permission to enter a synthetic local credential was requested separately; no user account or Cloudflare credential was accessed. Actual HTTP writes have their own passing BDD and Workers integration evidence; they must not be relabeled native-tool evidence.

This provides partial B29 discovery/read evidence and archived-status evidence, not a passed B29–B30 end-to-end gate, the B34 authority scenario, or a completed shared deployment. The ordinary-browser fallback and tool unit tests are separate checks. When resuming the native write demonstration, use an isolated synthetic vault/session, confirm the exact proposal ID/version/hash, and record sanitized results only; never publish cookies, token files or authenticated traces.
