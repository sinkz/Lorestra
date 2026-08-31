# ADR-0006: Publish immutable Markdown through one guarded D1 transaction

- Date: 2026-08-31
- Status: Accepted — local implementation authorized by the backend plan
- Extends: ADR-0001, ADR-0002, ADR-0003

## Context

The approved UI must become a real shared memory system without losing its replaceable client seam. Two editors can read the same document version, and an agent can retry a request whose response was lost. Writing several R2 objects and D1 records is not a cross-service transaction.

## Decision

Use private R2 objects for immutable Markdown bodies and D1 for canonical revision pointers, complete metadata snapshots, relationships, search projections, proposal versions, reviews, history and idempotent results. One installation contains one vault; this is not a multitenant SaaS schema.

Prepare every immutable R2 object first, using a conditional put and content hashes. Then execute one D1 batch containing publication preconditions, all document/revision/index changes, proposal status, history, and the exact operation result. SQL `CHECK(ok=1)` guards fail the entire transaction; an update affecting zero rows is not treated as a sufficient guard. Recheck membership, session expiry, role, maintenance, quotas, document bases and proposal version inside that same batch.

R2 objects left behind after an aborted batch remain private and unreferenced. Retain them during this PoC; do not run unsafe automatic garbage collection. Idempotent operation results are retained for the PoC as well. Never finish publication asynchronously after responding with success.

Canonical imported paths and stable document IDs are distinct from slugs. Renames retain aliases, deletion creates a tombstone, and reads of earlier versions use both body and metadata from that revision. Current and historical visibility both constrain public reads. If any historical proposal file, folder or referenced identity is private, hide the entire proposal/history projection rather than return a misleading redacted diff.

## Practical bounds

- 64 KiB per Markdown document, 256 KiB per proposal input, 20 changed files. Runtime settings may lower these ceilings, not increase them past supported storage limits.
- Default pages contain 20 records; maximum 100. Cursors bind filters, ordering and access scope, with stable ID tie-breaking. They are offset cursors, not snapshot-isolated pagination during concurrent insertions.
- The graph returns at most 200 nodes and 500 edges, with full-scope totals and explicit truncation. The current sampler reserves capacity for containing folders, so it selects at most 100 documents.
- Search normalizes diacritics and case at publication, matches all query terms literally, and ranks exact title, title substring, then other content. This first implementation scans bounded D1 text projections, not R2. It does not pretend to be a vector search engine or a fully indexed FTS implementation.
- Proposal list queries project summaries inside SQL, never transport every diff/body to the Worker just to discard it.

## Alternatives

An in-memory mutex cannot coordinate isolates or survive a restart. A chain of successful R2/D1 writes cannot ensure all-or-nothing publication. A Durable Object coordinator would introduce another state and failure boundary; proven D1 guards meet this scope with less infrastructure. Git remains an import/export format, not a runtime concurrency lock.

## Evidence and consequences

Workers integration tests exercise a failure in the last publication statement, response retry, concurrent merges and role/session changes between preparation and commit. The [scale report](../reports/backend-scale.md) measures actual D1 work on a fixed corpus. The graph's shared selected-set CTE is materialized after measurements exposed an expensive repeated query plan; see the [SQLite materialization documentation](https://sqlite.org/lang_with.html#materialization_hints).

Application-level append-only SQL triggers and hashes detect mistakes and corruption, not forgery by an administrator who controls both stores. Backup captures D1 plus referenced R2 objects during read-only maintenance and excludes sessions. Local integration does not authorize a Cloudflare deployment.
