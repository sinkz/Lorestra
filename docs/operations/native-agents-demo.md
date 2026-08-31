# Local multi-agent documentation demonstration

Date: 2026-08-31. Baseline: `ea73da5`. This is a local, synthetic demonstration authorized by the user, not a shared deployment or a third-party agent service. A later clean release exercise closes the original native confirmation-response gap; see the [local release evidence](local-release-evidence.md). The detailed observations below remain historical and are not rewritten as if the older transport run captured responses it did not capture.

## Environment and authority

The frontend uses its HTTP adapter at `http://127.0.0.1:4179`; the Worker listens on `http://127.0.0.1:8796`. D1 and R2 persist under the ignored `.lorestra/frontend-review` directory. The existing vault was preserved; no automatic reseed or reset was performed. Only a verified stale operator lock was removed before starting the local server.

Four synthetic, expiring local sessions were issued through the trusted operator runtime. Opaque credentials remain in ignored files and HttpOnly cookies, never in this report, screenshots, source or tool results. No Cloudflare account, remote resource, Docker service, paid API or deployment was used.

| Participant            | Local role  | Execution surface                                   |
| ---------------------- | ----------- | --------------------------------------------------- |
| Íris · Agente autor    | contributor | Subagent, direct local HTTP                         |
| Atlas · Agente revisor | maintainer  | Independent editorial subagent, direct local HTTP   |
| Codex · Autor WebMCP   | contributor | Actual registered tools in the Codex in-app browser |
| Codex · Revisor WebMCP | maintainer  | Actual registered tools and visible confirmation UI |

These are operator-issued demonstration identities, not authenticated external humans. Different roles were not chosen in the client payload. The contributor's attempted native approval returned a typed `403 forbidden` and did not advance the proposal. The guide exposed the actual role, capabilities and effective limits without exposing credentials.

The user delegated this fictional demonstration, including approval and refusal. Codex operated the visible confirmation buttons under that authorization; “human confirmation UI” names the product surface, not a claim that a person physically clicked during this unattended exercise.

## Authored knowledge and review

### Runbook: recovery exercise Aurora

Proposal `proposal-c2a5a472a803a868a73540cd4205f6c1` followed `open v1 → changes_requested v2 → open v3 → approved v4 → merged v5`.

The reviewer rejected vague release criteria. The author added a verifiable checklist for document/revision identities, body bytes, metadata/privacy, relations/aliases, proposals, history and read-only state. Both explicitly distinguished publishing a fictional procedure from actually executing a recovery. No backup/restore was performed by the document's instructions.

The published document is `doc-00c0e851e559e736a7312587b1d4539b`, slug `demo-aurora-recuperacao-local`, initial revision `v1`. The author verified byte-for-byte equality with the corrected Markdown. The document's initial author field identifies the publishing maintainer; proposal author and audit history retain the original contributor. Do not mislabel these different fields.

A subsequent API reading found an unresolved relative Markdown link (`resolvedLinks` was empty). This does not establish that the original UI link failed: the renderer has a catalog fallback. The reviewer created a separate corrective proposal, `proposal-1dffc71ceb08a0672b1c680f8cbb550e`, against document base version 1. An independent native review compared the before/after lines and approved the single link replacement. The original merged proposal was not edited.

The corrective proposal completed `open v1 → approved v2 → merged v3` through native review and visible merge confirmation. The already-open document updated to revision `v2` without reload. Subsequent native reads returned both the immutable `v1` with its original relative link and current `v2` with `/documents/seguranca-e-governanca`. Clicking the corrected link in the rendered preview opened **Segurança e governança**. The published cookbook's **Registro de decisão** link was also clicked and opened its intended document.

### ADR: limits of shared memory

Proposal `proposal-4ffdef4f4ba4a8ad2ba79cf15474f4cd` remains `changes_requested v2`. The reviewer asked for an accountable owner, review cadence and observable reconsideration trigger. It is deliberately not published. In this PoC, “reject” means request changes, not a separate permanent rejection/closed state.

### Cookbook: from conversation to reviewed memory

Proposal `proposal-a49ad22b94f916aeffdb0c32de4fa2e0` was created through native WebMCP. Search and an existing decision cookbook were consulted first. The author proposed a fictional note showing that useful memory can originate in a debate, without a code change or incident.

The independent reviewer requested a responsible role, measurable review trigger and evidence requirements. Native update resubmitted the same ID from `changes_requested v2` to `open v3`. The already-open proposal UI showed version 3 and the corrected diff without a page reload. Reading its slug still returned document-not-found: neither creation nor correction published it.

The reviewer approved v3, producing v4. A later editorial correction replaced unsupported wikilink syntax with ordinary Markdown links to observed `/documents/<slug>` routes, reopened v5 and invalidated the earlier approval. Native review then approved v5, producing v6. No relative-link or wikilink support was fabricated for the demo; explicit relations remain separate structured metadata.

## Defect found by the native test

The first native merge attempt exposed a blocking `window.confirm` path: the tool call and subsequent dialog/navigation operations timed out. That attempt is not counted as a successful publication. A fresh tab recovered the local review session; no attempt was made to force-accept the blocked confirmation or bypass server authorization.

The fix uses Lorestra's existing accessible `ModalDialog` through an asynchronous interaction adapter. It keeps a frozen proposal ID, approved version and content hash, refuses a second simultaneous confirmation, and settles pending work on cancel, Escape, abort or session cleanup. No configured confirmation surface means fail closed; an absent dialog never implies consent. The backend still validates the original tuple at publication time. The dialog subscribes to its own stable controller, without updating the entire workspace on every confirmation change.

## Actual native confirmation and concurrency results

The visible native dialog showed the exact proposal ID/version/hash and initially focused **Cancel**. Both clicking Cancel and using Escape closed it; follow-up reads found the proposal still approved, without publication. The original call's cancellation response was not captured because the native transport timed out.

For the concurrency exercise, the cookbook's confirmation remained open at approved `v6`. Another authorized session added the explicit instruction not to copy personal data, reopening `v7` and clearing approval. Accepting the older dialog did not publish: native readback found `open v7`, and the document slug was still not found. The initial native call timed out, so this is observed stale-publication protection, **not a captured native typed-409 result**. Typed conflict handling has separate automated integration evidence.

After reading the new content, the native reviewer approved `v7 → v8` and explicitly accepted a fresh confirmation for `v8`, hash `79d1a96247ee6fe7209d1d877cf6e5c63b5f040dfed039055bb263c39d479934`. Readback confirmed **merged v9**, document `doc-47eed9238125e6bbcbb106ab8e46bf2e`, slug `demo-conversa-memoria-revisada`, published revision `v1`.

### Transport limitation and safe recovery

The asynchronous modal fixed the blocked browser UI, but the native browser transport still produced a CDP `Runtime.evaluate` timeout while awaiting the human decision. The UI remained usable and the explicitly confirmed merge persisted. Do not treat a transport timeout as either proof of publication or proof of cancellation.

Repeating the **identical** native merge payload with its **original** idempotency key returned the persisted result without another confirmation or another revision:

| Proposal              | Approved input version | Replay key                          | Persisted result             |
| --------------------- | ---------------------- | ----------------------------------- | ---------------------------- |
| Runbook correction    | 2                      | `native-demo-merge-runbook-link-v2` | `merged`, proposal version 3 |
| Conversation cookbook | 8                      | `native-demo-publish-cookbook-v8`   | `merged`, proposal version 9 |

These replay keys identify synthetic operations, not credentials. A complete history read returned 36 events and `hasNextPage: false`; the cookbook had exactly one document-creation event and one merge event, both at `2026-08-31T04:52:43.608Z`, with revision `v1`. Recovery did not duplicate publication. A new key or changed payload is not a safe uncertain-response retry.

The ordinary direct UI merge remains available. The timeout described above belongs to the earlier single-call run; the current bounded two-call native interaction, including prompt cancellation and the explicit same-key retry, is recorded in the [local release evidence](local-release-evidence.md).

## Automated verification and visual inspection

- `pnpm check`: passed formatting, ESLint, dependency boundaries, unused-code and peer checks, typechecking, **152 tests** (49 API + 70 web + 13 contracts + 13 mock + 7 operator tooling), and production builds. The Worker build used `wrangler deploy --dry-run`, not deployment.
- `pnpm test:e2e:http`: **14/14**, zero retries, 2.1 minutes after the confirmation fix; actual local Worker/D1/R2, 13 desktop and one mobile scenario.
- `pnpm test:e2e`: **19/19**, zero retries, 35.1 seconds after the fix; separate mock visual regression suite, not durable-backend evidence.
- The six scenarios in the manual `.feature` parsed successfully with the installed Gherkin parser; syntax validation does not mean their expected native response payloads all passed.
- Controller/tool tests cover frozen confirmation targets, refusal of a concurrent prompt, cancellation/abort/cleanup, stale responses, fail-closed behavior and stale publication. They are not substituted for native browser evidence.
- ESLint now excludes generated `.lorestra` and `artifacts` directories, matching the existing Git/formatting boundaries; application source remains checked. No dependency was added.
- Deliberate screenshots show the final seven-proposal list, the published cookbook and the actual native confirmation. The ADR is the one unresolved demo proposal; the three pre-existing HTTP exercise proposals were preserved.

Remaining visual polish found, not silently declared fixed: the body-derived document summary is too long and repeats the title; a single-line edit displays full-file removal/addition (`+56 −56`); accumulated review comments would read better as attributed timeline entries; technical audit titles retain English prefixes in the Portuguese UI. No layout redesign was folded into the confirmation fix.

Local screenshot inventory under `artifacts/native-agents/`:

| File                         | Evidence                                                             |
| ---------------------------- | -------------------------------------------------------------------- |
| `01-requested-changes.png`   | Earlier cookbook review feedback                                     |
| `04-native-confirmation.png` | Actual async confirmation at cookbook v6, before the concurrent edit |
| `05-proposals-final.png`     | Published examples and ADR still requesting changes                  |
| `06-cookbook-published.png`  | Final published cookbook, including the long-summary polish issue    |
| `07-history.png`             | Real audit list with proposal and document-revision links            |
| `08-publication-event.png`   | Publication event with maintainer, date and resulting revision       |
| `09-atlas-docs.png`          | Docs projection including both published demonstration documents     |

## Verification boundary

The manual protocol is in [native-agents-demo.feature](native-agents-demo.feature). Its scenarios describe the intended assertions; the observations and transport exceptions above determine what was actually established. Automated controller/registration tests and actual native browser evidence are distinct; neither is renamed as the complete B29–B34 acceptance suite. In particular, an ordinary forbidden-operation test does not certify the malicious-document authority scenario.

The demo is local only. An independent identity provider, cross-machine collaboration, real staging and public third-party agent access remain outside this evidence.

Generated helper scripts, session files and screenshots are local ignored artifacts under `.lorestra/agent-demo` and `artifacts/native-agents`. The user-facing delivery includes the actual screenshots inline; authenticated traces are not published.
