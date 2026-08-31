# Two-agent native WebMCP concurrency experiment

Date: 2026-08-31. Code baseline: `8926289`. This record describes actual native browser calls, not a mocked registry or an HTTP-only substitute.

## Scope and setup

The user authorized two agents working on the same fictional memory through two Codex in-app browser tabs. Agent A was the coordinating Codex agent; agent B was the independent `webmcp_peer_live` subagent. Each discovered the eleven registered tools and called them through its own page-bound WebMCP handle.

The runtime assigned A browser connection `-b2bd-4abd-80ab-5f3104a5742e`, tab `7`, and B connection `-e801-4198-aa0d-e0ebd608bc33`, tab `1`. Different connection IDs do **not** establish independent browser profiles or users. Both reported the same synthetic principal, `demo.native.reviewer.20260831`, role `maintainer`. B opened already authenticated after A signed in. This is a concurrent-agent test, not session-isolation or two-machine evidence.

Frontend: `http://127.0.0.1:4179`; local Worker: `http://127.0.0.1:8796`. The HTTP adapter uses actual local D1/R2. All business reads/writes in the experiment used native WebMCP; the visible UI supplied explicit merge confirmations under the user's delegated test authorization. There was no direct HTTP business-call fallback.

The earlier synthetic session had expired. The trusted local operator refreshed the existing principal for two hours without changing its membership or role. The backend was briefly stopped and restarted against the same store, without seeding. A stale operator lock was removed only after its recorded owner was confirmed stopped. No vault data was deleted. Credentials and helpers remain ignored local artifacts; no secret is included here. No Cloudflare resource, deployment, Docker service, paid API or billing-producing infrastructure was created.

A first preparation agent lost its browser connection after finishing its turn. Its replacement remained active throughout the coordinated test. The failed preparation is not counted as a successful concurrent writer.

## Target and prepared changes

- Published document: `doc-47eed9238125e6bbcbb106ab8e46bf2e`, slug `demo-conversa-memoria-revisada`, initially revision **1**.
- Shared proposal: `proposal-91a3dd4ead2a4c58eef9278fd2808ff9`, initially `open`, proposal version **1**, document base **1**.
- Both agents read that same proposal version and content hash before preparing their independent updates.
- A appended a fictional contribution about recording origin/context; B appended one about observable review evidence. Both preserved the original target, path, metadata and document base.

The intentionally shared identity means the audit actor is the same maintainer. Separate agent contributions and review reasons identify the experiment's participants; this is not cryptographic attribution to two people.

## Result 1: overlapping native updates

A controlled start barrier released both calls with `expectedProposalVersion: 1`. Times below are UTC, measured immediately around each native tool invocation; they are not server lock-acquisition timestamps.

| Caller | Start           | End             | Observed native result                                          |
| ------ | --------------- | --------------- | --------------------------------------------------------------- |
| A      | `13:48:19.305Z` | `13:48:23.412Z` | `409 proposal_version_conflict`, current proposal version **2** |
| B      | `13:48:19.305Z` | `13:48:23.098Z` | Accepted, `open` proposal version **2**, no publication         |

The invocations overlapped for 3.793 seconds. B's successful content hash was `ecd305ed1941ff44629b00a20d7ab8b22cba0180ff506942c152b9bd718b9db8`. A's conflict included request ID `6bdaaa9b-e6ed-4c76-868a-4c0913c0b6d6` and `currentProposalVersion: 2`.

Native readback showed B's contribution present and A's absent from the winning draft. A's losing payload remained in the agent's memory; this does not claim that a server autosaved the rejected payload or that a UI editor held it. A explicitly read version 2 and combined both contributions, submitting against proposal version 2 while keeping document base 1. This produced proposal version **3**. The published document remained byte-for-byte unchanged at revision 1.

B independently checked exact body equality (`original + experiment marker + B + A`), metadata, target, base and checks, then approved version 3. The proposal became **approved v4**. A explicitly confirmed its native merge; readback showed **merged v5** and published document revision **2** containing both contributions exactly. Historical revision 1 remained readable and unchanged.

## Result 2: competing publication from an older document base

Before A published revision 2, B created and approved a separate proposal for the same document base 1:

- Proposal: `proposal-53a35b8a1cdde186144de049411a4fcc`.
- State before attempt: **approved proposal v2**, document base **1**.
- Reviewed hash: `6450d65cbc817bcf154921be75b3a7cc129a5efaed4b17954069bc5a50fda018`.

After the combined publication, B invoked native merge without silently advancing that base, then explicitly confirmed the displayed ID/version/hash. Subsequent independent native reads established:

- The competing proposal remained **approved v2**, not merged, with its draft intact.
- The published document remained **revision 2**, exactly matching A+B; the competing alternative was absent.
- The complete history contained **44 events**, `hasNextPage: false`, with zero merge/publication events for the competing proposal.

**Response limitation:** B's original native call timed out (`13:53:28.157Z–13:53:57.198Z`) before the confirmation interaction completed. No original HTTP code or request ID was captured for that merge. Thus this establishes unchanged publication state after a stale-base attempt, **not a captured native `409 document_version_conflict` response**. The update conflict in Result 1 did return a real native 409 and is separate evidence.

## Publication, retry and history

A's merge also encountered the already documented native transport timeout while waiting for confirmation. It recovered the persisted result using the identical payload and original idempotency key `dual-tabs-20260831-merge-reconciled-v4`, without a second publication.

Both agents read the audit trail independently. The shared proposal had exactly one merge event and one document revision event, at `2026-08-31T13:52:24.386Z`:

- Merge: `event-46e371a5-b2e5-4221-823e-4b5d4b7079de`.
- Document revision 2: `event-2d8bf069-66f1-425d-a6d9-50477ae4889a`.

The failed competitor was deliberately left available for inspection, without retries, silent rebasing or forced publication.

## UX and acceptance boundaries

The open UI in A still displayed proposal version 1 after B's write, while an explicit native read already returned version 2. A's own subsequent successful mutation refreshed its UI. Cross-tab external-change notifications or refresh affordances remain a UX improvement; this test does not claim instantaneous synchronization of every open screen.

The native confirmation transport timeout remains unresolved. This experiment does not certify every native cancellation/conflict response, separate identities, independent sessions, different machines, a load benchmark, CRDT editing or shared staging. It does establish that two independent agents invoked actual WebMCP updates with overlapping execution, that one stale update was rejected, and that explicit reconciliation preserved both contributions.

No application code or contracts were changed for the experiment. The [manual Gherkin protocol](dual-webmcp-tabs.feature) is not an automated Playwright binding. Existing HTTP/storage tests remain separate evidence.

Deliberate screenshots are local ignored artifacts under `artifacts/dual-webmcp-tabs/`:

- `combined-document-v2.png`: both contributions in the rendered document.
- `competing-proposal-unmerged.png`: the competing proposal still approved, not published.

## Repository verification

After recording the experiment, `pnpm check` passed: formatting, lint, dependency boundaries, unused-code and peer checks, typechecks, all **152 tests**, and production builds. The Worker build used `wrangler deploy --dry-run`; nothing was deployed. The manual protocol's three scenarios parsed as valid Gherkin, relative report links resolved, and `git diff --check` was clean. A scan of 315 tracked/unignored files found neither renewed test credential nor its CSRF value.

The HTTP E2E and visual suites were not rerun in this experiment. The native calls, readbacks and deliberately captured screenshots above are the fresh browser evidence; the manual Gherkin file does not turn that evidence into an automated regression test.

See also [the previous native multi-agent demonstration](native-agents-demo.md) and [the native acceptance boundary](native-webmcp-evidence.md).
