# ADR-0008: Keep native WebMCP merge confirmation bounded and two-phase

- Date: 2026-08-31
- Status: Accepted
- Extends: ADR-0006, ADR-0007

## Context

The browser-native WebMCP callback must display a human authorization before a
proposal can be merged. Awaiting a dialog promise inside one native callback
keeps the browser's CDP evaluation open and can time out before a reviewer can
respond. A transport timeout is ambiguous: the guarded server write may not
have started, or it may have committed while the response was lost.

## Decision

Native merge uses two bounded calls. The first call re-reads the current
session and proposal, checks merge capability, the exact approved proposal
version, content hash and passing checks, then stores one page-scoped pending
request and returns typed `confirmation_required` without calling the
transition client. The visible dialog shows the proposal ID, approved version,
content hash and expiry. Accepting authorizes only that stored request; it does
not publish.

The agent must explicitly retry the identical merge operation with the same
idempotency key. The browser consumes an accepted decision only when the
proposal tuple, canonical operation fingerprint and key match. Confirmation
objects echoed by an agent are derived metadata and never grant authority by
themselves. The second call still sends the confirmation tuple to the existing
typed client and backend transaction, which rechecks session, role, approval,
versions, checks and document bases.

The page retains one bounded outcome at a time. A pending request expires;
decline, cancellation, session disposal and stale or mismatched input never
publish and remain addressable by the same key until the retained outcome is
replaced by a new explicit key. A second active request returns typed busy.
An accepted transition is marked committing; concurrent calls remain busy. A
network or server 5xx/invalid-response failure retains the accepted decision
for same-key idempotent recovery, while a definitive 4xx clears it. An abort
before dispatch cancels the decision. A registration/session abort during an
in-flight transition revokes local permission and does not restore the
accepted state after an uncertain result; the already-dispatched operation
remains recoverable only with its original key through the backend's persisted
result. Completed merges continue to use the existing same-key persisted-result
recovery path. No automatic retry, polling loop, new-key retry, fabricated
approval or client-side bypass is permitted.

## Consequences

Native tool calls return promptly and the workspace remains interactive while
the reviewer decides. Agents must understand `confirmation_required` and issue
one explicit retry after the user responds. Reloading or disposing the page
cannot authorize or start a new publication: the in-memory ledger is discarded
or cancelled and the server remains authoritative. A request already sent
before disposal may still commit, so its result is uncertain and must be
recovered with the original key. Native evidence must separately record
cancellation, stale conflicts and uncertain same-key recovery; a successful
visible dialog alone is not proof of publication.
