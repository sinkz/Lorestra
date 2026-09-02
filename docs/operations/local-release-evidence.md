# Local release evidence

The durable `local:start` command is a signal-owning supervisor: it keeps the
Miniflare Worker and Vite preview in a private detached child and requests
cooperative IPC shutdown. The new real-runtime restart/lock regression passed
1/1 across two start/stop cycles (one restart), with full
document-body/version preservation, cooperative Windows IPC shutdown and no
retained operator lock. Windows physical Ctrl+C
delivery remains unvalidated in this environment. The optional Docker path was
subsequently validated on Docker Desktop, including persistence after a host
reboot; its separate scope and limitations are recorded in
[Docker local evidence](docker-local-evidence.md).

Date: 2026-08-31. Scope: a local synthetic installation of Lorestra, not a shared deployment or a production readiness claim.

This record covers the built local release runner and the fresh native WebMCP interaction exercised after the two-phase confirmation change. Credentials, cookies, session files and authenticated traces are intentionally omitted.

## Native WebMCP interaction

The actual Codex in-app browser registered and called the real eleven WebMCP tools against the local HTTP Worker, D1 and R2 state.

- The first merge call returned `confirmation_required` in 3,588 ms and opened the visible authorization dialog. Cancelling left the proposal approved and the document absent.
- A new idempotency key opened a fresh authorization. Accepting it did not publish; the document remained absent until the agent explicitly retried the identical payload with that same key.
- The explicit retry returned merged proposal version 3. A same-key replay returned the same persisted result. The document was revision `v1` and its history contained exactly one publication.
- The exercised proposal was `proposal-4253ef3f3df59b33ef459420987fcb08`; the resulting document was `doc-3bb3e39ec4ae9f1b2d31b233e46ed007` with slug `ensaio-local-confirmacao-final`.
- A stale competing proposal was authorized and retried through the native surface. The guarded Worker returned real `409 version_conflict` details (`base1/current2`); it did not publish the stale operation.
- A contributor reading adversarial quoted content remained a contributor. Its attempted native merge returned typed `403 forbidden` without opening a merge confirmation; the earlier approval-denial exercise is recorded separately in the historical multi-agent report.

The ordinary human merge dialog remains a direct one-step UI action. Native WebMCP merge authorization is deliberately two phase: accepting the dialog grants permission to the exact tuple and payload, but never publishes by itself. A native agent must make the explicit same-key retry. Cancellation, expiry, registration disposal and session changes fail closed; an uncertain transport result keeps the original idempotency key for recovery.

## Local release runner

The first release setup initialized the local state with 75 documents. The
production web build completed, and an early pre-supervisor run of `local:start`
served the built UI on `127.0.0.1:4173` while the same Node process hosted the
Worker on an ephemeral loopback port. The current runner uses the isolated
private child described above; its real-runtime lifecycle regression passed
1/1 across two start/stop cycles (one restart), preserving the full document body/version without
re-seeding or retaining `operator.lock`. The focused runner tests pass 9/9 via
`pnpm test:local`.

The final serial `pnpm check` passed with 177 assertions: 51 API, 83 web, 13
contract, 13 mock, 8 tooling and 9 local-runner tests. The tooling total is 8/8
in the current run; the earlier 7/7 tooling count predates the real supervisor
lifecycle coverage. Supporting recorded gates include the HTTP suite at 21/21
with zero retries in 2.4 minutes and the visual suite at 19/19 with zero retries
in 32.5 seconds.

The Docker path passed a clean Linux image build, explicit initialization, UI/API/WebMCP smoke checks, container recreation and host-reboot persistence on Docker Desktop 27.4. See [Docker local evidence](docker-local-evidence.md) for the exact checks, one transient image-load failure, cleanup and remaining boundaries. No Docker registry credentials, Cloudflare credentials, billing or deployment were used.

## Boundaries

The human interface is browser-agnostic at the application level. Native WebMCP behavior is validated here only in the Codex in-app browser; other compatible browsers remain unverified. For current external implementation status, see [WebMCP implementation status](https://github.com/webmachinelearning/webmcp/blob/main/implementation-status.md) and the [Chrome WebMCP documentation](https://developer.chrome.com/docs/ai/webmcp).

This evidence does not mark the complete backend plan as 100% complete. Shared identity, staging, cross-machine operation, additional host platforms and the remaining acceptance clauses remain separate gates.
