# Contributing to Lorestra

Lorestra keeps Markdown knowledge portable and makes every published change
reviewable. Contributions should preserve that boundary.

## Development

Use Node 24 LTS and pnpm 11.24.0. After dependencies are installed, run:

```text
pnpm check
```

The API is a Cloudflare Workers/Hono application. Its tests use the Workers
Vitest integration and its read behavior is grouped by vertical slice. The
shared contract package may depend on Zod only; it must not import Hono,
Cloudflare, React, filesystem, or mock-vault code.

## Pull requests

Use Conventional Commits, keep changes focused, and include tests at the seam
you changed. A proposal is not published knowledge until an explicit merge
transition creates a new revision. Do not add credentials, Cloudflare resource
IDs, or local vault secrets.
