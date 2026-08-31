# Durable API contract

The executable contract is `packages/contracts/src`. The Worker publishes `GET /api/openapi.json` from the same input/output schemas used by its routes. UI and WebMCP use the same HTTP clients and query invalidation coordinator; neither calls D1 or R2 directly.

## Endpoints

All routes below have the `/api` prefix. Successful operations return JSON with HTTP 200, including idempotent replays. Lists contain `items` and `pageInfo`, except the explicitly typed navigation, graph and search projections; use their contract schemas instead of guessing a common shape.

| Method and route                      | Input / result                                                                                       | Access                                                                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `GET /session`                        | Principal, capabilities, CSRF token, expiry, operational limits and maintenance state                | Current browser session; anonymous allowed                                      |
| `POST /session`                       | `{token}` exchanges an operator-created opaque local credential for an HttpOnly cookie               | Local composition only, matching Origin; absent from shared Worker              |
| `POST /session/logout`                | `{}` → `{ok:true}`; revokes the current session                                                      | Authenticated, Origin and CSRF; still available during maintenance              |
| `GET /navigation`                     | Locale, parent folder, cursor, limit → immediate children and page information                       | Visible ancestor chain required                                                 |
| `GET /documents`                      | Locale, folder, `q`, type, status, sort, cursor, limit → summaries                                   | Public published/archived for visitors; authorized internal content for members |
| `GET /documents/:slug`                | Locale and optional version → document, immutable revision, resolved Markdown links                  | Current and historical visibility checks                                        |
| `GET /documents/by-id/:documentId`    | Optional version → same document response                                                            | Stable identity independent of rename                                           |
| `GET /search`                         | `q`, locale, cursor, limit → scored metadata results                                                 | Same visibility as documents; body search uses D1 projection                    |
| `GET /graph`                          | Locale, entire/folder/related scope, folder/document ID → bounded nodes, edges and totals            | Never includes hidden identifiers or counts                                     |
| `GET /proposals`                      | Status, locale, `q`, cursor, limit → summaries without diff bodies                                   | Members; visitors see only fully public merged history                          |
| `GET /proposals/:proposalId`          | ID → current version, changes, checks, approval/hash                                                 | Same proposal visibility policy                                                 |
| `POST /proposals`                     | `DurableCreateProposalInput` → proposal v1                                                           | Contributor or maintainer                                                       |
| `PATCH /proposals/:proposalId`        | Complete editable content + `expectedProposalVersion` → reopened proposal                            | Author-contributor or maintainer; not merged                                    |
| `PATCH /proposals/:proposalId/status` | ID, expected version, approved/changes_requested/merged, optional reason/confirmation → next version | Maintainer                                                                      |
| `GET /history`                        | Document/proposal ID, locale, type/category, `q`, cursor, limit → events                             | Proposal and document visibility apply                                          |
| `GET /history/:eventId`               | ID → event with proposal/document/revision identities                                                | Same historical visibility policy                                               |

## Write protocol

1. Read the exact document revision before editing. An added file has `target.documentId=null` and `baseVersion=null`; existing files require their stable ID and the version actually read.
2. Send complete explicit editable metadata: `folderId`, `type`, `locale`, `visibility`, editorial `status`, `tags`, `relations`. Identity, author, before-content, checks and timestamps are server-owned; forged extra fields are rejected.
3. Send JSON with matching `Origin`, `X-CSRF-Token` from the session, and `Idempotency-Key` for proposal mutations. Path and body proposal IDs must match. Cookies remain HttpOnly; do not put credentials in URLs or localStorage.
4. Reuse the same key and exact payload after a lost response. A different payload with that key conflicts. A deliberate edit is a new operation with a new key. Replay is still subject to current authorization.
5. Approval records the reviewed proposal version and SHA-256, but publishes nothing. Editing reopens the proposal and invalidates approval.
6. Merge checks current approval, versions, membership, session, role, limits and maintenance inside the publication transaction. The UI and native tool additionally request human confirmation of proposal ID, version and hash. Direct HTTP requires the same server policy, but the confirmation object remains optional in the accepted HTTP contract; it is not an authentication substitute.
7. Public bodies, metadata, links, revisions, proposal, events and idempotent result become visible through one guarded D1 batch after private immutable R2 objects are prepared. An aborted operation can leave private unreferenced objects, never partially published knowledge.

HTTP request IDs are generated server-side, returned as `X-Request-ID`, included in errors and stored in mutation audit event payloads. Retries return the original business result without creating another audit event. Client-supplied request IDs or authors are not trusted.

## Errors and recovery

The envelope is `{error:{code,message,requestId,details,retryAfterSeconds?}}`. Never infer success from a toast, timeout or local draft alone.

| HTTP      | Meaning                                                         | Recovery                                                                       |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 400 / 422 | Bad envelope, cursor, identity mismatch or schema validation    | Correct input; preserve the draft                                              |
| 401       | Missing, expired or revoked session                             | Authenticate again; do not reuse cached private data across principals         |
| 403       | Role, Origin or CSRF denied                                     | Refresh session or request legitimate access; never retry by forging a role    |
| 404       | Missing or not readable                                         | No existence leak for private identities                                       |
| 409       | Document/proposal version, idempotency or state conflict        | Read current versions and compare; never silently replace the original base    |
| 413       | Bytes exceed configured ceilings                                | Reduce content/change batch; count UTF-8 bytes, not JavaScript string length   |
| 429       | Request/write/open-proposal budget                              | Respect `Retry-After`; retain unsent content                                   |
| 503       | Read-only maintenance, storage preparation or integrity failure | Retain draft; for an uncertain operation retry its original key after recovery |

Defaults: 64 KiB Markdown, 256 KiB proposal input, 20 files per proposal, 100 open proposals, 240 requests/minute and 60 writes/minute. These are application controls, not a guarantee against Cloudflare billing or platform-wide quota exhaustion. Read lists are paginated; graph sampling and literal D1 search limitations are documented in ADR-0006.

No public seed, reset, impersonation, arbitrary SQL, R2 key access, token minting or full-backup endpoint exists. Local operator commands and test bindings are separate from the shared Worker.
