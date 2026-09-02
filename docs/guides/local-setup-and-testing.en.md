# Local setup and testing

[Português (Brasil)](local-setup-and-testing.pt-BR.md) · [README](../../README.md)

This guide takes a fresh checkout through local sign-in, a reviewable document change, and the relevant automated tests. Run commands from the repository root unless stated otherwise. Shell commands work in Bash and PowerShell except where explicitly labeled.

The durable local path uses the real Worker application with local D1/R2 storage. **It does not provision Cloudflare resources or require a Cloudflare account.** Dependency/browser downloads require internet access. Do not deploy, configure paid services, or expose the local authentication endpoint to the internet as part of this guide.

## 1. Prerequisites and installation

- Git; on Windows, install Git for Windows with Git Bash available for repository hooks.
- Node.js `>=24.12.0 <25`. CI and the Dockerfile pin `24.20.0`; the source of truth is [package.json](../../package.json).
- pnpm `11.24.0`, selected through Corepack.
- A browser for the human interface. Codex's in-app browser is the validated native WebMCP surface, not a requirement for ordinary UI or Playwright tests.
- Optional: a running Docker engine with Compose v2 for section 6.

```sh
git clone https://github.com/sinkz/Lorestra.git
cd Lorestra
node --version
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm --version
pnpm install --frozen-lockfile
```

If you already cloned the repository, enter that checkout instead. If Corepack is missing, follow its [official installation instructions](https://github.com/nodejs/corepack#how-to-install); do not replace the workspace install with `npm install` or regenerate the lockfile to bypass an installation error. On a restricted Windows installation, `corepack enable` may need permission to write shims beside Node; fix the installation permissions rather than disabling repository hooks.

## 2. Run the persistent local application

For a new store:

```sh
pnpm backend:init
pnpm local:build
pnpm local:start
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). This path selects the HTTP adapter automatically; no `.env` file is needed. Keep this terminal open. One supervisor owns the preview and a private Worker child; you do not need another API server.

### Sign in and preserve your work

1. Open `.lorestra/state/local-session.json` locally in your editor.
2. Choose **Sign in** and paste only its `token` value. Do not paste the whole JSON.
3. The default synthetic account is a local maintainer. Visitors can read public knowledge; mutations require an authorized session.

The session file is ignored by Git. Never put it in a commit, screenshot, chat, issue, or test artifact. Do not put tokens in `VITE_*` variables: those variables are browser-visible. These credentials are for local development, not shared production login.

Stop with Ctrl+C and wait for the runner to exit before starting another operation against the same store. Restart with `pnpm local:start`; **do not rerun initialization on every start**. After source changes, stop, run `pnpm local:build`, and restart. D1/R2 data stays under `.lorestra/state`; live edits are not automatically written back into `vault/**/*.md`.

If the session expired or you logged out, stop the runner, renew, then restart:

```sh
pnpm backend:session
pnpm local:start
```

Use the new token from the same file. Renewal does not revoke other active sessions; logout revokes the current one. For a separate, disposable manual-test store, use the same explicit path throughout:

```sh
pnpm backend:init --state=.lorestra/manual-demo
pnpm local:start --state=.lorestra/manual-demo
```

Its credential is `.lorestra/manual-demo/local-session.json`. Stop that runner before `pnpm backend:session --state=.lorestra/manual-demo`. Stores do not imply extra available ports: only one runner can bind the default `4173` at a time. See [local operations](../operations/local-backend.md) for backup, export and restoration into a separate target.

## 3. Choose a development mode

Use one mode at a time. Stop the previous runner first to keep process and memory use bounded.

| Mode                                       | Persistence               | Frontend URL            | Use it for                                 |
| ------------------------------------------ | ------------------------- | ----------------------- | ------------------------------------------ |
| `local:build` + `local:start`              | Local D1/R2               | `http://127.0.0.1:4173` | Product demo and durable manual checks     |
| Web dev server with `mock`                 | Disposable in-memory data | `http://127.0.0.1:5173` | Fast layout work, not persistence evidence |
| `backend:dev` + web dev server with `http` | Local D1/R2               | `http://127.0.0.1:5173` | Full-stack work with frontend hot reload   |

For either dev-server mode, create `apps/web/.env` from [the example](../../apps/web/.env.example) only if you do not already have local settings. Never overwrite an existing environment file blindly.

Bash:

```bash
cp apps/web/.env.example apps/web/.env
```

PowerShell:

```powershell
Copy-Item apps/web/.env.example apps/web/.env
```

For mock mode, leave `VITE_DATA_ADAPTER=mock` and run only the frontend:

```sh
pnpm --filter @lorestra/web dev --host 127.0.0.1 --port 5173 --strictPort
```

For HTTP mode, edit that ignored file:

```dotenv
VITE_DATA_ADAPTER=http
VITE_LORESTRA_API_URL=/api
LORESTRA_API_ORIGIN=http://127.0.0.1:8787
```

Initialize once if needed, then use two terminals:

```sh
# Terminal 1: existing local store, Worker on 8787
pnpm backend:dev
```

```sh
# Terminal 2: same-origin frontend proxy on 5173
pnpm --filter @lorestra/web dev --host 127.0.0.1 --port 5173 --strictPort
```

Sign in again at this origin if needed. Use `127.0.0.1`, not a mixture of `localhost` and `127.0.0.1`; origin and CSRF checks are intentional. Restart Vite after changing `.env`. The root `pnpm dev` starts multiple workspace dev scripts; use the focused commands above when you only need one frontend or the initialized local backend.

## 4. Run automated tests

### Quality gate and focused checks

```sh
pnpm check
```

This runs formatting, ESLint, dependency boundaries, unused-code and peer checks, TypeScript, unit/integration/tooling tests, and builds. The API build uses `wrangler deploy --dry-run`; it does not deploy. **Playwright and mutation tests are separate.** A green quality gate alone does not prove native WebMCP, container execution or Linux browser E2E compatibility; each has its own evidence boundary.

For a shorter feedback loop:

| Command                                  | What it checks                                            |
| ---------------------------------------- | --------------------------------------------------------- |
| `pnpm --filter @lorestra/contracts test` | Runtime schemas and shared contracts                      |
| `pnpm --filter @lorestra/web test`       | Frontend logic, graph and WebMCP boundaries               |
| `pnpm --filter @lorestra/api test`       | Worker behavior and storage/authorization boundaries      |
| `pnpm test:tooling`                      | Seed, migrations, storage restart, backup and restore     |
| `pnpm test:local`                        | Local runner preflights, proxy and shutdown orchestration |
| `pnpm lint` / `pnpm typecheck`           | Lint or type checks without a full build                  |

Keep heavy commands sequential. The regular suites are configured with bounded concurrency; do not increase workers just to make a local run faster. Some runtime lifecycle checks wait for child shutdown and are slower than pure unit tests.

### Playwright + Gherkin

Install only Chromium, which also covers the current mobile emulation projects:

```sh
pnpm --filter @lorestra/e2e exec playwright install chromium
```

On Linux, install the required system libraries as well; this may ask for administrator permission:

```sh
pnpm --filter @lorestra/e2e exec playwright install --with-deps chromium
```

Run one suite at a time, after stopping unnecessary preview/dev processes. You do **not** run `backend:init`, `backend:dev` or `local:start` for these suites: their fixtures own their servers and data.

| Command                     | Scope                                    | Reserved ports  |
| --------------------------- | ---------------------------------------- | --------------- |
| `pnpm test:e2e`             | Mock-backed UI smoke, desktop and mobile | `4185`          |
| `pnpm test:e2e:http:smoke`  | Persistent HTTP smoke subset             | `4176` + `8795` |
| `pnpm test:e2e:http`        | Full persistent HTTP suite               | `4176` + `8795` |
| `pnpm test:e2e:http:mobile` | HTTP mobile project only                 | `4176` + `8795` |

The mock suite does not prove backend durability. HTTP fixtures create private temporary stores, seed a closed template and isolate each scenario from your `.lorestra/state` store. Occupied test ports are an error, not permission to kill another process.

Gherkin sources live in [UI smoke](../../apps/e2e/features/smoke.feature) and [backend features](../../apps/e2e/features/backend); their step bindings live in [steps](../../apps/e2e/steps). The test scripts generate Playwright cases automatically. To discover HTTP scenarios without launching browsers, or run the concurrency group:

```sh
pnpm --filter @lorestra/e2e test:e2e:http --list
pnpm --filter @lorestra/e2e test:e2e:http --grep @concurrency
```

Read the terminal failures first. Open generated reports after the suite exits:

```sh
pnpm --filter @lorestra/e2e exec playwright show-report playwright-report
pnpm --filter @lorestra/e2e exec playwright show-report playwright-report/http
```

Choose the report for the suite you ran; each command starts a report server, so stop it with Ctrl+C before starting another. Mock failure screenshots/traces are under `apps/e2e/test-results`. Authenticated HTTP traces, screenshots and video are **disabled intentionally** to keep credentials out of artifacts. Inspect any report before sharing it.

**Linux fixture boundary:** an earlier [published CI run](https://github.com/sinkz/Lorestra/actions/runs/33430905870) exposed an `EEXIST` difference before browser assertions. The corrected [fixture](../../apps/e2e/fixtures/backend.ts) now creates an isolated temporary parent and copies the closed template into a nonexistent child while retaining `errorOnExist: true`. This preserves overwrite protection consistently across Windows and Linux. Do not disable isolation, overwrite a live store or delete your vault to work around a harness failure.

### Optional targeted mutation tests

```sh
pnpm --filter @lorestra/api test:mutation --concurrency 1
```

This deliberately mutates backend search and proposal transition rules; it is not part of every edit. Use one worker on a constrained machine. The root shortcut is `pnpm test:mutation`, but it does not explicitly cap Stryker concurrency. Reports go under `apps/api/reports/mutation`; investigate surviving critical mutants rather than lowering the configured score threshold to make a run green.

## 5. Manual product and native-agent checks

Use the persistent local application from section 2 and fictional documents. These checks change that local vault; use a separate test store if you want to keep your own notes untouched.

1. As a visitor, open Library, search, change a folder filter, and switch between English and Brazilian Portuguese. Open preview, Markdown and Atlas; long content should stay inside the workspace.
2. Sign in, edit a document, and submit a proposal with a reason. Check the diff; the published document must remain unchanged.
3. Request changes, edit and resubmit the same proposal. Earlier approval must not survive a content edit. Approve it and confirm that approval alone still does not publish.
4. Explicitly merge the reviewed version. Verify the new revision, proposal status and History links. Restart the local runner without seeding and verify the same content again.

For native WebMCP, open that HTTP page in the Codex in-app browser and sign in there. Ask the connected agent:

> Read `lorestra_get_agent_guide`, search for an existing fictional document and read its current version. Propose a small documentation improvement. Do not approve or merge it yet. Report the proposal ID and what changed.

Then review the proposal yourself. If you explicitly ask the agent to merge an approved proposal, the first native call returns `confirmation_required`. The human dialog authorizes the exact version/hash; it does not publish by itself. After authorization, the agent must retry the same operation with its original idempotency key. Verify the final document and History, not just a successful tool registration.

The optional `pnpm demo:webmcp` helper opens a **separate Playwright-controlled browser**, not the existing Codex tab. To test registration against the running release, select its URL:

```bash
WEBMCP_DEMO_URL=http://127.0.0.1:4173 pnpm demo:webmcp
```

PowerShell equivalent:

```powershell
$env:WEBMCP_DEMO_URL = 'http://127.0.0.1:4173'
pnpm demo:webmcp
```

In a supported runtime it reports `registerTool: true`, `status: "registered"` and `registeredTools: 11`. Bundled Chromium may not support this API; an unsupported result is not a UI failure. The helper does not inherit the Codex login or validate publication. Do not fake `document.modelContext` to claim native support. See [local release evidence](../operations/local-release-evidence.md) and the [two-agent experiment](../operations/dual-webmcp-tabs.md); two tabs can share a session and do not establish two independent people or machines.

## 6. Optional Docker packaging

This workflow was validated on 2026-08-31 and again after a host reboot on 2026-09-01 with Docker Desktop 27.4 (`linux/amd64`). The run covered a clean image build, explicit import of 75 documents, local sign-in, proposal/review/resubmit/approve/merge, immutable `v1`/`v2` reads, search, graph, native WebMCP reads, container recreation, host reboot, session renewal and named-volume persistence. It does not certify production, shared identity, cloud deployment or other host platforms; see the [Docker evidence record](../operations/docker-local-evidence.md).

Host Node/pnpm are unnecessary for this path; Git and a working Docker engine/Compose are required. Allow several gigabytes of temporary disk space: the validated application image measured about 2.22 GB before cleanup, excluding builder cache. Stop any host runner using port `4173` first.

```sh
docker compose version
docker compose build
docker compose run --name lorestra-init --no-deps lorestra node scripts/backend-local.mjs init
```

Create the ignored destination for the local credential copy. Bash:

```bash
mkdir -p .lorestra/state
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force .lorestra/state
```

The copy below replaces a file at that destination if it exists. If you also have a native local store, choose a different ignored destination so its session file is not overwritten.

```sh
docker cp lorestra-init:/app/.lorestra/state/local-session.json .lorestra/state/docker-session.json
docker rm lorestra-init
docker compose up
```

Open `http://127.0.0.1:4173` and sign in with the token from `docker-session.json`. The named volume `lorestra-state` contains the container's D1/R2 store; it is separate from host `.lorestra/state` storage. The one-shot `docker rm` above removes only the stopped initialization container, not that volume.

Stop with `docker compose down`; it preserves the volume. **Do not add `-v` unless intentionally deleting the local vault.** To renew a session, stop Compose, repeat the named one-shot/copy/remove pattern with `session` instead of `init`, and start again. If initialization failed, inspect that container's logs before reusing its name. No cloud deployment is part of this path.

## 7. Troubleshooting and completion checklist

| Symptom                                                   | Safe next step                                                                                                                                                  |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wrong Node/pnpm version or frozen-lockfile error          | Match the pinned toolchain and inspect the error; do not update dependencies as a setup workaround.                                                             |
| Shell or hook executable not found on Windows             | Open Git Bash with Node/Corepack on `PATH`, enter the same checkout and retry. Do not bypass hooks or loosen machine-wide execution policy.                     |
| Missing initialization marker / missing production bundle | Run `backend:init` once for that exact store / run `local:build`, with the previous runner stopped.                                                             |
| `operator.lock` / store already in use                    | Stop its owning runner. After a crash, verify the recorded PID no longer owns that store before removing only the stale lock. Never delete the state directory. |
| Port occupied / too many processes                        | Stop the exact terminal or container you started; wait for exit. Never kill every Node, browser or workerd process.                                             |
| Sign-in fails / HTTP 401 or 403                           | Check the token's store, expiry and exact origin. Renew with the server stopped; keep origin/CSRF checks enabled.                                               |
| Changes disappear after reload                            | Check whether you selected mock mode. Durable changes require HTTP and an explicit merge.                                                                       |
| Long-path or SQLite errors on Windows                     | Choose a short explicit state path and use it consistently; do not move or erase an active store.                                                               |
| Docker build ends with `unexpected EOF` while loading     | Confirm the Docker engine is healthy and retry the same build. Cached layers may be reused, but do not treat the image as valid until Compose can start it.     |
| Playwright executable or Linux libraries missing          | Run the Chromium installation command above; inspect fixture setup separately from browser assertions.                                                          |
| No native WebMCP tools                                    | UI remains available. Confirm a supported agent/browser surface; a mocked registry is not native evidence.                                                      |

Windows physical Ctrl+C delivery remains a documented validation limit; the cooperative shutdown/lifecycle regression is separate evidence. If a runner does not exit, inspect its exact process ownership before retrying. Avoid opening additional servers while investigating.

- [ ] Local UI opens at the expected origin; no cloud resources were created.
- [ ] Proposal → review → explicit merge → History works on fictional data.
- [ ] Restart preserves the published revision without reinitialization.
- [ ] `pnpm check` passes; record E2E and mutation results separately, including failures or unverified platforms.
- [ ] No credentials, private documents or local runtime artifacts appear in `git status --short` or shared evidence.
- [ ] Unneeded servers, report viewers and test browsers have exited.

For contributions, follow [CONTRIBUTING.md](../../CONTRIBUTING.md), use Conventional Commits and include the commands and results in the PR. Do not present a historical successful run as fresh validation of your checkout.
