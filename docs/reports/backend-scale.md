# Durable backend: bounded-read evidence

Date: 2026-08-31. Scope: local Workers/D1/R2 bindings, not a deployed Cloudflare benchmark.

The scale suite exercises the real durable reader and HTTP application without importing the frontend mock adapter. Its purpose is to catch accidental full-payload loading, per-item queries, broken pagination, incorrect graph totals, and privacy regressions as the vault grows. These numbers are observations and regression guards, **not a throughput SLA or proof that a public workload fits the Cloudflare free tier**.

## Reproduce

From the repository root, after installing the pinned dependencies:

```sh
pnpm --filter @lorestra/api exec vitest run src/adapters/durable/knowledge-scale.test.ts --reporter=verbose --silent=false
```

Source: [knowledge-scale.test.ts](../../apps/api/src/adapters/durable/knowledge-scale.test.ts). The suite emits one `SCALE_METRIC` JSON record per measured reader operation. It applies the actual D1 migrations through the Workers Vitest integration and seeds isolated synthetic operator data. It does not start a server, call a deployed environment, or modify the canonical Markdown vault.

## Corpus and privacy cases

- 1,000 documents, 120 folders, 200 proposals, 500 history events, and 6,000 directed document relations.
- Ten root folders with 110 children. One child folder is internal, hiding nine otherwise-public documents from anonymous readers.
- 999 English documents and one Brazilian Portuguese document. The anonymous English list contains 990 documents; one is archived and remains readable.
- Every document has six outgoing links. This exercises graph clipping and incoming/outgoing relations for a selected document ordered beyond the first page.
- Proposals contain about 16.8 KiB of before/after Markdown each. Their list must retrieve summaries from D1, not fetch and discard those bodies in JavaScript.
- An older revision belongs to an internal folder while its current document is public. Another proposal retains internal-folder `beforeMetadata` after its target moves public. Both historical surfaces must remain hidden from visitors.
- Some otherwise-public merged proposals reference an internal document. Their detail, summary counts, and history must not expose those references.

The 1,000 current revision object keys deliberately have no R2 bodies: the measured lists, search, navigation, graph, proposals, and history must not fetch them. One additional historical revision has an actual R2 object, used to verify both authorized checksum-checked access and anonymous denial. Synthetic proposal hashes and review fields are fixtures, not evidence of writer validation; the separate durable proposal integration suite covers that workflow.

## Recorded reader measurements

`rows_read` and `rows_written` come from the local D1 result metadata. Each `.first()` is observed by executing the same SQL once through `.all()` and selecting its first row, preserving access to that metadata; it does not issue a second query. Byte counts use UTF-8 JSON serialization, excluding protocol framing and HTTP headers.

| Operation                                          | SQL statements | Rows read | Largest query result, bytes | Reader response, bytes |
| -------------------------------------------------- | -------------: | --------: | --------------------------: | ---------------------: |
| English documents, page of 20                      |              2 |     8,087 |                      11,920 |                  9,921 |
| Search `memory`, page of 20                        |              2 |    15,904 |                      12,140 |                 10,199 |
| Root navigation, page of 5 plus selected ancestors |              7 |       179 |                         856 |                  1,496 |
| Entire English graph                               |              6 |    73,705 |                      24,001 |                 83,322 |
| Related graph centered on document 998             |              7 |    16,016 |                       2,761 |                  9,562 |
| Member proposals, page of 20                       |              2 |       600 |                       9,566 |                  8,547 |
| Member history, page of 20                         |              2 |       520 |                       7,451 |                  6,512 |
| Public history, page of 20                         |              2 |    18,898 |                       7,301 |                  6,362 |

All measured reader calls wrote zero rows. This does **not** mean an HTTP GET is write-free: the application middleware updates a rate-limit bucket, and middleware/authentication queries are outside these reader-only measurements.

The full graph initially read 6,951,164 rows on this same local corpus. Materializing the authorized scope once in the totals query reduced that to 73,705, approximately 98.9% fewer rows. The initial implementation failed the 100,000-row guard; the corrected graph passes it. Graph totals describe the whole authorized scope, while the transmitted graph remains capped at 200 nodes and 500 edges with an explicit truncation flag.

## Executable regression guards

Every recorded operation must stay below 100,000 rows read and 65,536 bytes for any single SQL result. Additional limits are:

| Operation                 | Maximum SQL statements | Maximum response bytes |
| ------------------------- | ---------------------: | ---------------------: |
| Document list / search    |                      2 |                 32,768 |
| Navigation with ancestors |                      9 |                 16,384 |
| Entire graph              |                      7 |                131,072 |
| Related graph             |                      8 |                 32,768 |
| Proposal list / history   |                      2 |                 16,384 |

These are deliberately loose, corpus-specific regression ceilings, not product quotas. They should not be increased merely to make a regression pass: inspect the emitted per-query row counts and SQL hints first. Statement count and response size remain bounded, but row work can grow with vault size because visibility checks, exact counts, filtering, and full-scope graph totals still inspect multiple rows.

The suite also checks:

- Nonoverlapping sequential pages, stable sort order, and rejection of cursors reused with different filters or identity scope.
- Locale and archived-status filters, literal search punctuation, and valid long search/history queries through HTTP.
- Parent-scoped folder pages, selected-document ancestor retrieval, and hidden-folder denial.
- Graph endpoint closure: every emitted edge has both endpoints present; a late selected document and its incoming/outgoing links survive related-scope sampling.
- Authorized full-scope graph totals rather than totals computed only from the rendered sample.
- No Markdown bodies in proposal summary query results; no private proposal/history data or counts.
- Historical private-folder reads denied through the real HTTP application, while members retain checksum-verified access.

## What this does not establish

This is a deterministic local regression workload, not a concurrent load test. It does not measure production CPU time, network latency, remote D1 query planning, free-tier exhaustion, larger/deeper vaults, browser memory, or graph rendering speed. It does not establish snapshot-stable pagination while other clients publish between page requests. Shared identity-provider and native WebMCP validation remain separate acceptance work.

Before public deployment, repeat representative operations against an authorized staging environment, include middleware costs, and observe real database and Worker usage. Keep operational limits and clear rate-limit errors; these local numbers are not a reason to remove them.
