# Backend acceptance specifications

Status: **acceptance specification; implementation and execution are tracked separately**. These files remain the full acceptance companion to the [integration plan](../2026-08-30-backend-full-integration.md), not executable test results.

The active, implemented Gherkin lives in [apps/e2e/features/backend](../../../apps/e2e/features/backend). See the [HTTP verification matrix](../../operations/backend-verification.md), [native-tool evidence](../../operations/native-webmcp-evidence.md) and [scale report](../../reports/backend-scale.md). Grouped active scenarios exercise documented subsets of these requirements; retaining the complete specification here does not mark unexercised clauses as passed. The native authenticated gate and shared staging are explicitly separate.

Gherkin is written in English to match the existing `apps/e2e/features/smoke.feature`. The implementation plan is in Portuguese. Scenario IDs are stable references for PRs and verification reports; scenario outlines can produce multiple test cases.

## Files

| File                                                                   | Coverage                                                                        | IDs                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------- |
| [reading-and-discovery.feature](reading-and-discovery.feature)         | HTTP reads, locales, privacy, revisions, directories, pagination, graph, mobile | B01, B03–B05, B16, B18, B20, B31, B35 |
| [proposal-workflow.feature](proposal-workflow.feature)                 | Create, revise, review, merge, conflicts, idempotency, archive/delete           | B06–B15, B17, B21–B22, B32            |
| [identity-and-agents.feature](identity-and-agents.feature)             | Capabilities, sessions, CSRF, WebMCP and fallback                               | B26–B30, B33–B34                      |
| [resilience-and-operations.feature](resilience-and-operations.feature) | Seeds, transport, failures, restart, backup, quotas, portability                | B02, B19, B23–B25, B36–B39            |
| [shared-staging.feature](shared-staging.feature)                       | Real identity, revocation and shared deployment                                 | B40–B42                               |

## Test environment contract

- Every `@http` scenario uses the real frontend HTTP adapter, Hono Worker, migrations and local D1/R2 bindings. No in-memory business adapter or successful business response interception is allowed.
- The harness owns separate web/API ports and a unique storage directory for each run. Do not reuse the user's preview server. Bootstrap checks storage mode and fixture revision before navigating.
- Scenarios start from isolated fixtures. Seed/setup can use trusted CLI/bindings; actions named as user actions use real UI, actions named as API requests use actual HTTP. Assertions should observe visible results and persisted API reads, not private React state.
- Actors: visitor (anonymous), Riley (member reader), Casey (contributor), Morgan (maintainer), Taylor (second maintainer). All are synthetic. Tokens, sessions and keys are generated per run and never committed.
- The authenticated principal comes from a server-side test identity adapter, not a role field provided in a mutation. The adapter is local/test-only and absent from shared builds. Native Access/OIDC validation is separately covered in staging and JWT integration tests.
- Baseline content contains Docs EN/PT-BR, Orion/Lyra/Cygnus, a public published document at v1, a public archive, an internal document, a draft, a proposal with failed/pending checks and an approved valid proposal. Tests resolve fixture identifiers from one manifest, not localized labels guessed by tests.
- The large fixture adds 1,000 documents, 120 folders, 200 proposals and 500 history events. Tests can use a smaller fixture unless marked `@large`.
- A fixture proposal or document is synthetic initial state, not a claim of an action already performed by a real user.
- Storage faults are injected through test-owned dependencies/process controls. No production HTTP fault/reset/impersonation endpoints may be added.
- The publication guard must also have direct Workers/D1 integration tests: browser scenarios alone cannot exhaust transaction races and failure points.

## Tags and execution boundaries

| Tag            | Meaning                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `@http`        | Real local HTTP integration; mandatory adapter/storage preflight                |
| `@smoke`       | Short, high-value subset for integration PRs                                    |
| `@concurrency` | Two isolated contexts and controlled request barriers, not sleeps               |
| `@storage`     | Process restart or fault/backup harness; serialize per isolated storage         |
| `@security`    | Assert both denied operations and absence of hidden-data disclosure             |
| `@large`       | Deterministic large dataset and bounded payload/DOM assertions                  |
| `@mobile`      | Narrow viewport, keyboard/touch and overflow checks                             |
| `@webmcp-real` | Native registration and real tool invocation; no fabricated `modelContext`      |
| `@staging`     | Authorized shared deployment, real identity provider and external configuration |

Native WebMCP depends on a compatible browser/agent interface. Run B29/B30/B34 in a dedicated compatible-browser project and attach tool execution evidence. If that runtime is unavailable, report these scenarios **not verified**; the ordinary UI and fallback tests do not replace them. Client/tool unit tests may use a registry double, explicitly labeled as unit tests. The regular HTTP smoke selects `@http and @smoke and not @webmcp-real and not @staging`; the native gate remains mandatory separately for the milestone.

Disable automatic traces, HAR, videos and screenshots for the entire real-authentication/staging project. Use sanitized reports without credential-bearing headers/cookies and only deliberately checked screenshots of fictional content. Local traces also contain synthetic session credentials: restrict their retention and never publish them raw. Sanitization and scanning for test credential values must precede publishing any artifact.

The first local gate must pass the implemented `@smoke` subset plus storage/policy integration tests. The complete local milestone requires B01–B39, including explicit native-WebMCP evidence. The shared milestone additionally requires B40–B42 and the real deployment runbook checks.

## Implementing these specifications

1. Implement the contract/slice from the plan before activating its acceptance scenario.
2. Move the scenario to `apps/e2e/features/backend/` and add `playwright-bdd` steps/fixtures using the existing runner.
3. Reference its ID in the PR and record command, environment, result and artifact path.
4. Remove the planned duplicate or replace it with a link. Never keep two contradictory acceptance definitions.
5. Do not mark a pending scenario as passed with `skip`, placeholder assertions or mocked successful responses.

This folder is deliberately outside the active BDD glob. Parsing these files validates syntax only; it does not prove step implementations exist or that the backend meets these criteria.
