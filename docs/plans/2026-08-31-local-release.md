# Local release plan

- Date: 2026-08-31.
- Status: **runner and packaging implemented; local browser/native and Docker Desktop evidence recorded**.
- Scope: make the durable local Lorestra path reproducible after cloning without changing the shared deployment boundary.

## In scope

- Build the web app once with the HTTP adapter and serve its production output through Vite preview.
- Start one loopback-only Miniflare Worker and preview server in a private detached child supervised by the local CLI; proxy `/api` to the Worker's ephemeral port.
- Require an explicit `backend:init` before startup; restart preserves the named/local state and never seeds implicitly.
- Fail clearly on a missing build, missing initialization marker or occupied preview port. Close Vite, Miniflare and the local operator lock on Ctrl+C/SIGTERM.
- Keep the existing mock `pnpm dev` workflow available for disposable visual work.
- Offer an optional non-root Docker image and one-service compose file with a named state volume and host binding limited to `127.0.0.1`.
- Explain native WebMCP's two-phase confirmation and the distinction between human UI compatibility and native browser evidence.

## Deliberate non-goals

- No automatic seed, reset, migration destructive action, credential generation at startup or remote provisioning.
- No public/network binding for direct local runs; the container wrapper opts into its internal all-interface listener only so Docker can publish it on host loopback.
- No Cloudflare account, third-party identity provider, billing, deployment, online credential copy or production service claim.
- No claim beyond the recorded Docker Desktop `linux/amd64` run; cross-machine operation, other host platforms and every browser's WebMCP implementation remain separate gates.

## Verification record

| Check | Result |
| --- | --- |
| `pnpm test:local` | 9/9 focused runner tests passed |
| `pnpm local:build` | Production HTTP bundle built successfully |
| `pnpm local:start` | Supervisor/child path implemented; real restart/lock/HTTP lifecycle regression passed 1/1 across two start/stop cycles (one restart), with full document-body/version preservation, cooperative Windows IPC shutdown and no retained operator lock |
| Native WebMCP release exercise | Recorded in [local release evidence](../operations/local-release-evidence.md) |
| Docker engine run | Docker Desktop 27.4 `linux/amd64`: build, init, UI/API/WebMCP checks, proposal governance, immutable revisions, recreation, host reboot, session renewal and named-volume persistence passed; see [Docker local evidence](../operations/docker-local-evidence.md) |

The broader backend plan and its remaining gates stay authoritative; this plan records a local distribution path, not a replacement acceptance matrix.
