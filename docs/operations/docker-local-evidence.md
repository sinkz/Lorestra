# Docker local evidence

Dates: 2026-08-31 and 2026-09-01. Scope: an isolated, fictional local Lorestra vault on Docker Desktop 27.4 with a Linux `amd64` engine on a Windows host. This is packaging and local-runtime evidence, not a production, shared-identity, cloud, cross-machine or cross-platform certification.

No registry login, Cloudflare account, remote infrastructure, paid API or billing-producing action was used. Credentials remained in ignored local files and were never printed or committed.

## Environment and isolation

- A dedicated Compose project, named volume and Buildx builder isolated the run from pre-existing Docker resources.
- The application image ran as the non-root `node` user and published only `127.0.0.1:4173` on the host.
- The clean build installed the frozen pnpm dependency graph inside Linux and completed `pnpm local:build` with 537 transformed web modules.
- The resulting application image measured approximately 2.22 GB before cleanup. Builder cache requires additional temporary disk space.

## Exercised workflow

| Check                      | Result                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Start with an empty volume | Failed closed with the documented instruction to run `backend:init`; no implicit seed occurred                                                 |
| Explicit initialization    | Imported 75 bilingual Markdown documents and wrote a local session file without printing its token                                             |
| Health and UI              | `/api/health` returned `200`; the production UI loaded in English and Portuguese                                                               |
| Access boundaries          | Anonymous write returned `401`; wrong origin and invalid CSRF returned `403`                                                                   |
| Proposal governance        | Create, request changes, resubmit, approval invalidation, approve and explicit merge passed                                                    |
| Publication semantics      | Approval alone did not publish; idempotent merge replay did not duplicate publication                                                          |
| Immutable revisions        | The edited document returned exact current `v2` and unchanged historical `v1` bodies                                                           |
| Retrieval                  | Search and graph returned the fictional published document after restart                                                                       |
| Native WebMCP              | The Codex in-app browser registered 11 tools; guide, search and document reads returned the persisted `v2`                                     |
| Container recreation       | Removing/recreating the application container while preserving the named volume retained documents, proposals and one merge event per proposal |
| Host reboot                | Starting the same Compose project after a full host reboot retained exact `v2`/`v1`, proposals, history, search and graph                      |
| Session lifecycle          | Logout revoked the exercised session; a new one-shot `session` command restored authorized local access without resetting the vault            |

The main HTTP exercise made 25 assertions across sign-in, authorization, proposal transitions, idempotency and revisions. Persistence checks made nine assertions after container recreation and another nine after host reboot.

## Observed transient failure

The first image export completed its compilation but Docker returned `unexpected EOF` while importing the image into the engine. Engine health returned without an out-of-memory indication; the exact cause was not proven. Repeating the export/import with the already-built isolated cache loaded the image successfully, after which all runtime checks passed. A build is not considered successful until the image is present and Compose starts it.

## Cleanup

After verification, the dedicated application container, Compose network, named test volume, application image, Buildx builder and its test-only BuildKit image were removed. Pre-existing containers, images and volumes were inventoried before the run and left present. The ignored synthetic credential, fixture state, screenshot and helper output were also deleted.

## Remaining boundaries

- Only Docker Desktop 27.4 with a Linux `amd64` engine on the recorded Windows host was exercised.
- Native WebMCP was exercised only in the Codex in-app browser; the ordinary UI remains browser-agnostic.
- The named volume proves local persistence, not backup, disaster recovery or multi-machine synchronization.
- Shared identity, remote access, rate limiting under real load, Cloudflare provisioning and production operations require separate authorization and evidence.
