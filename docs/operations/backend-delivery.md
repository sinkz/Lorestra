# Backend integration delivery

Date: 2026-08-31. Baseline: `8f3aa74`, branch `feat/celestial-galaxies`.

## Delivered locally

The HTTP product now persists knowledge and review state through Hono/Workers, D1 and private R2 objects. It does not use the browser mock to answer successful business requests. Shared deployment is not configured or authorized.

- Three incremental SQL migrations, generated binding types and a portable loopback-only operator runtime.
- Canonical import of 75 bilingual Markdown documents, including all 36 celestial examples. Reimport does not overwrite later live revisions.
- Server-derived local identity, roles/capabilities, HttpOnly sessions, expiry/logout, Origin/CSRF checks, conservative public/historical visibility and request/write limits.
- Incremental directories, paginated library/search/proposals/history, stable ID reads, old slug/path aliases and bounded graph projections. Production HTTP chunks exclude the mock fixtures.
- Create, edit/resubmit, request changes, approve and merge. Explicit document bases and proposal versions prevent lost updates. Approval binds content hash and never publishes by itself.
- Multi-file publication through prepared immutable R2 objects plus one guarded D1 transaction. Idempotent replay, tombstones, complete revision metadata and append-only audit events with server-generated request IDs.
- Shared UI/WebMCP clients and mutation invalidation, draft-preserving errors, principal-specific cache isolation, metadata editing and human merge confirmation. Eleven native tools are registered, including proposal update/resubmission.
- Checksummed backup and restore, plus portable Markdown export/reimport preserving current identities, authors, versions, relations and old aliases. Restored/imported installations start read-only and do not restore session credentials.
- Local runbook, API matrix, accepted ADRs, English README/SECURITY/architecture and updated product Docs in both languages. A separate HTTP smoke CI job is configured without uploading authenticated artifacts.

The approved celestial renderer, camera gestures, motion, palette and layout were retained. The backend work did not replace the Atlas with a different graph design.

## Verification records

See [the detailed acceptance map](backend-verification.md), [native evidence](native-webmcp-evidence.md), and [measured D1 scale work](../reports/backend-scale.md). Those records distinguish actual HTTP, storage, controlled-transport unit tests and mock visual regressions.

The final `pnpm check` passed: formatting, ESLint, dependency boundaries, Knip, peer constraints, typechecking, **145 tests** and production builds. The complete HTTP BDD suite was then rerun against that code and passed **14/14**, zero retries, in 2.1 minutes.

| Gate                       | Current recorded result                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| API integration/unit       | 49 passing tests across 6 files, including the final alias/import and failed-check regressions |
| Contract and mock packages | 13 + 13 passing tests; mock results are not durable-storage evidence                           |
| Web unit/integration       | 63 passing tests in the final consolidated run                                                 |
| Operator tooling           | 7 passing tests, including UTF-8/emoji/CRLF export/reimport and full backup recovery           |
| Visual/mock BDD            | 19/19, zero retries; camera/motion/overflow thresholds retained                                |
| HTTP BDD                   | 14/14 in the final-code rerun, zero retries                                                    |
| Full quality gate          | Passed on final code: 145 tests and both production builds                                     |
| Native WebMCP              | Real guide/search/read calls passed; authenticated native lifecycle not certified              |
| Remote CI / staging        | Not run; no push or deployment performed                                                       |

The Workers test suite runs files serially to keep workerd memory bounded on Windows. An initial parallel runtime crash was not counted as a pass; the serial run completed. Tests do not require or access a Cloudflare account.

No new broad mutation suite was added: direct D1 transaction failures, R2 preparation failures, racing sessions/merges and query-budget regressions protect the new critical boundaries. The pre-existing targeted Stryker command remains available; this delivery does not claim a new mutation score.

## Acceptance boundary — do not label the whole plan “100%” yet

The local implementation is usable, but the original plan's full L sign-off is stricter than the implemented smoke suite. The acceptance matrix keeps remaining clauses visible, including the full native authenticated create/correct/merge flow, stale human confirmation across native sessions, and every specified HTTP responsive/graph/offline interaction. Equivalent unit/storage evidence is identified as such, not renamed an end-to-end browser pass.

Permission was requested before entering a synthetic local credential in the native browser. Until confirmed and exercised, native authenticated B29/B30/B34 remain pending. This does not change the separately verified HTTP authorization and publication behavior.

S remains unstarted: a real identity provider, Cloudflare account/resources, origin, authorized members, remote backup destination/retention, staging and two-machine validation require explicit user decisions and deployment authority. Local development credentials must not be exposed publicly.

Other deliberate PoC limits: single vault, no autonomous third-party agent tokens, no CRDT/offline synchronization, offset rather than snapshot cursors, literal D1 search rather than vector/FTS, bounded graph sampling, and operator-driven backups. Checksums/append-only triggers do not defeat an administrator controlling both stores. Private orphaned R2 preparations are retained, not automatically garbage-collected.

## Start and inspect

```sh
pnpm backend:init
pnpm backend:dev
```

In a second terminal, configure the HTTP adapter as shown in the [runbook](local-backend.md), then start `pnpm --filter @lorestra/web dev`. Use the generated local credential through the sign-in dialog; never paste it into repository documentation.

The API defaults to `127.0.0.1:8787`, browser origin to `127.0.0.1:5173`. The temporary review preview uses separate ports and is not the canonical installation. No seed runs implicitly on restart. Stop the local server before maintenance/import/backup commands targeting its store.

All generated state, sessions, logs, traces and review screenshots remain outside version control. The local commit contains source, migrations, safe synthetic fixtures, tests and documentation only.
