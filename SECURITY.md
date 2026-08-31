# Security Policy

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for the repository when available. If private reporting is not configured, contact the maintainers through a private channel listed on the repository profile.

Include the affected version, reproduction steps, expected impact, and any suggested mitigation. We will acknowledge a valid report as soon as practical and coordinate disclosure after a fix is available.

## Current security boundary

The durable local build uses real Workers/D1/R2 bindings with session hashes, server-side roles, origin/CSRF checks, byte limits, quotas, optimistic versions and atomic publication. Development sessions are synthetic credentials issued by an operator CLI. The local session exchange cannot create an actor or accept a client-selected role.

Do not expose the local entry point or development credentials to the public internet. The shared entry point excludes local sign-in; Access/OIDC login, deployment configuration and staging validation remain outstanding. Public read access is not permission to write. Browser mocks remain a visual-test adapter, never a security boundary.

R2 is private. Current and historical document, folder and relation visibility constrain public projections; a proposal involving private historical context is hidden as a whole. Append-only application triggers and checksums are not proof against a privileged operator controlling both stores. Treat portable exports and backups as potentially private; local tooling does not encrypt or upload them.

Sessions and tokens are excluded from backups and automatic HTTP test screenshots/traces/videos. Restoring requires a separate empty target and leaves writes disabled. See [local operations](docs/operations/local-backend.md).

## Secrets

Lorestra never requires secrets in source control. Use Wrangler secrets or the chosen deployment platform's encrypted secret store. Repository examples contain names only—never live IDs, tokens, credentials, or production database identifiers.
