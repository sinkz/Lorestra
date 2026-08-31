# Local backend operations

Lorestra's local backend runs the real Worker application against local D1 and R2 using Miniflare. These commands do not create Cloudflare resources, deploy a Worker, or authenticate against a remote account.

The shared Worker and the local operator are different entry points. Local identities are synthetic development credentials; they are not proof that shared authentication or a production identity provider has been configured.

## First run

Install the pinned workspace dependencies with the Node and pnpm versions in the root `package.json`. Then run:

```sh
node scripts/backend-seed.mjs
node scripts/backend-local.mjs init
node scripts/backend-local.mjs dev
```

The first command validates the canonical Markdown without changing storage. `init` applies migrations, explicitly imports the seed, and writes a local maintainer credential file. `dev` opens the existing store without reimporting Markdown.

The defaults are:

| Setting                | Default                              |
| ---------------------- | ------------------------------------ |
| Worker                 | `http://127.0.0.1:8787/api`          |
| Allowed browser origin | `http://127.0.0.1:5173`              |
| D1/R2 state            | `.lorestra/state/`                   |
| Local credential       | `.lorestra/state/local-session.json` |

For the frontend, set `VITE_DATA_ADAPTER=http` and `LORESTRA_API_ORIGIN=http://127.0.0.1:8787` in the local environment, then run the web development server. The Vite proxy keeps browser requests same-origin under `/api`. An unavailable backend must produce an error, not silently switch to mock data.

Open the local sign-in dialog and copy only the `token` value from the credential file. The CLI prints its location, never its contents. The file is local development material: do not commit it, paste it into a ticket, include it in a screenshot, or share it with another machine. Its filesystem permissions inherit the host's security model; on Windows, a POSIX file mode is not an ACL guarantee.

To create another local credential after expiry, stop the local server and run:

```sh
node scripts/backend-local.mjs session
```

Creating a new credential does not revoke other active sessions. Use the application's logout action to revoke the current session. Shared-provider validation and cross-machine session revocation require the separate staging acceptance work.

## Seed and ownership

`vault/**/*.md` supplies the Markdown body, frontmatter, identity, language, visibility, status, and links. The CLI reads the existing folder descriptors and legacy type metadata solely to build the import manifest; neither the API nor its business services import React or the browser mock adapter.

The complete seed includes English and Brazilian Portuguese Docs, the Orion/Lyra/Cygnus examples in both languages, and internal documents intentionally omitted from the old public mock. Internal data remains subject to backend authorization.

Import validation rejects ambiguous YAML, aliases, symlinks, traversal paths, duplicate IDs, duplicate locale/slug pairs, missing references, cycles, and incorrect body checksums before publishing anything. Reimporting an unchanged seed is idempotent. A conflicting source identity fails instead of overwriting live knowledge; subsequent changes belong in proposals.

```sh
node scripts/backend-local.mjs seed
```

The live D1/R2 vault is not continuously mirrored into the repository's Markdown files. Use a portable export to obtain the current documents.

## One operator per local store

A running development server holds `operator.lock` inside its state directory. Stop it with Ctrl+C before running a seed, session, maintenance, backup, or restore command against the same store. The tools do not open a second Worker on a live SQLite database and do not expose public reset, import, fault-injection, or principal-selection endpoints.

If a process crashes, inspect the lock's PID and confirm that the process is no longer using this store before removing that one stale lock file. Never delete the state directory as a troubleshooting shortcut.

`--state=path`, `--origin=http://127.0.0.1:5173`, and `--port=8787` customize local commands. `LORESTRA_LOCAL_STATE` and `LORESTRA_LOCAL_ORIGIN` provide equivalent defaults. Only HTTP loopback origins are accepted by the local runner.

On Windows, deeply nested workspace paths can exceed workerd/SQLite path limits. The HTTP test harness uses short, unique temporary directories. For a manually operated installation with an unusually long checkout path, choose an explicit short state path and keep using that same path for every command.

## Backup and portable export

A backup contains review state, immutable revisions, history, slug and Markdown-path aliases, folder metadata, members, and all referenced Markdown objects. Session credentials, rate windows, and transient commit guards are deliberately excluded. Backup checksums detect corruption; they are not a signature proving who created an archive.

Stop the local server, enable maintenance, then create a new destination:

```sh
node scripts/backend-local.mjs readonly on --reason="Local backup"
node scripts/backend-backup.mjs create --out=.lorestra/backups/demo
node scripts/backend-backup.mjs export --out=.lorestra/exports/demo
node scripts/backend-local.mjs readonly off
node scripts/backend-local.mjs dev
```

Existing output directories are never overwritten. Backups are checked against referenced R2 hashes and a migration fingerprint. The current local tooling imposes a 256 MiB archive safety ceiling and the backend's 64 KiB Markdown-object ceiling; it is intended for this proof of concept, not an unbounded production archive service.

The portable export contains the current, nondeleted Markdown documents with compatible frontmatter, plus `lorestra-vault.json` describing the vault, folders, stable identities, slug/path aliases and file checksums. Author identity and Markdown bytes are preserved. Deleted documents are excluded explicitly; their tombstones and old revisions belong in the full backup. The Markdown text is not rewritten, while structured relations reflect the current published graph.

It does **not** include the complete proposal workflow or historical revisions and is not a substitute for the full backup. Import it into a separate new or empty target:

```sh
node scripts/backend-backup.mjs import --from=.lorestra/exports/demo --state=.lorestra/imported-demo
```

The importer verifies checksums, paths, references and folder identities before publishing the manifest. It does not load executable files from the exported directory. The new installation has no sessions or prior proposal history and remains read-only until an operator verifies it and deliberately enables writes. Keep the export's manifest and Markdown together; editing a file without updating its verified manifest is not an accepted portable import.

Both formats can contain internal knowledge. Keep their destinations private; these tools do not encrypt files or upload them to a backup provider.

## Restore into a separate empty target

```sh
node scripts/backend-backup.mjs restore --from=.lorestra/backups/demo --state=.lorestra/restored-demo
```

The archive and object checksums are verified before restoring. The target must be explicitly named and new or empty; the current store is never replaced. The checkout's migrations must match the backup fingerprint. Restored sessions are empty and writes remain disabled until an operator verifies the result and explicitly enables them.

Use `backend-local.mjs session --state=.lorestra/restored-demo` to obtain a new local credential, then start that target and inspect documents, proposals, and history. After verification, stop it and run `backend-local.mjs readonly off --state=.lorestra/restored-demo` if writes should resume.

If preparation fails after writing immutable objects but before publishing D1 pointers, retain the failed target for inspection or remove only that deliberately disposable target. Never reuse a partially restored directory without examining the failure.

## Verification boundaries

```sh
pnpm test:tooling
pnpm --filter @lorestra/e2e test:e2e:http
```

The HTTP suite owns a separate Vite server on port 4176 and Worker on port 8795. It refuses server reuse, seeds a closed template once per worker, and clones that offline template into a new private directory for each scenario. This preserves isolation without paying the full seed cost for each test. Actions and reads use actual HTTP and the UI; setup uses trusted local bindings.

Tooling tests run serially to avoid launching several workerd runtimes at once on a memory-constrained workstation. They cover seed validation, actual migration/trigger behavior, durable restart, and full backup restore with corrupted-object rejection. `node scripts/backend-local.mjs --help` and `node scripts/backend-backup.mjs --help` describe the available flags.

HTTP test traces, videos, and screenshots are disabled from the beginning so synthetic credentials cannot enter automatic artifacts. No fake native WebMCP registration or skipped staging test counts as evidence. Native WebMCP, external identity providers, remote machines, Cloudflare provisioning, and deployment must be verified separately when the required runtime and authorization are available.
