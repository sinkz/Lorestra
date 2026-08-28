# Lorestra Agent Guide

This repository is designed for humans and coding agents working together.

## Start here

1. Read `README.md`.
2. Read the accepted decisions in `docs/decisions/`.
3. Read the active plan in `docs/plans/`.
4. Run `pnpm check` before presenting a change as complete.

## Architectural invariants

- `packages/contracts` is the final runtime contract and imports no app framework.
- Web consumers use client interfaces. They never import mock fixtures directly.
- The composition root is the only place that selects mock or HTTP adapters.
- Frontend imports follow `shared → entities → features → widgets → pages → app`.
- Backend behavior is organized by use-case vertical slices.
- A proposal never changes published Markdown before merge.
- Stable document IDs and mutable slugs are different concepts.
- Documentation under `vault/Docs` is product content and follows the same proposal workflow.
- Public read access does not imply public write access.

## Working rules

- Use Conventional Commits.
- Do not add credentials, Cloudflare IDs, tokens, or production secrets.
- Keep English and `pt-BR` interface strings in sync.
- Preserve keyboard behavior, focus, contrast, and reduced-motion support.
- Prefer small interfaces with mock and production adapters at real seams.
- Add tests at module interfaces and critical workflows, not implementation details.
- Update an ADR when changing an expensive architectural decision.

## Commands

See the root `README.md` and `package.json`. The canonical quality gate is `pnpm check`; Playwright and mutation tests are intentionally separate commands.
