# Celestial galaxies — production integration

Status: Implemented and verified · approved C visual direction

## Acceptance

- Related memories gather around a larger hub; disconnected communities have breathing room.
- Cross-community bridges correspond only to existing relations and highlight with selection.
- Planet, star, ringed decision, comet, archived black hole, and redesigned satellite retain distinct silhouettes.
- Production Atlas supports rotation, tilt, zoom, reset, selection, opening documents/folders, and a list alternative.
- Camera updates do not rerender the React tree; hidden/reduced-motion views do not run continuous animation.
- Scopes, English/Portuguese, mobile layout, and shared contracts continue to work.
- Unit tests cover clustering/projection invariants; BDD smoke covers navigation/camera; `pnpm check` passes.

## Work

1. Implement deterministic communities and separated placement; test actual bridge attribution.
2. Rewrite approved body rendering as typed production code and improve the satellite SVG.
3. Integrate Canvas scene, semantic nodes, camera controls, and localized responsive HUD.
4. Remove superseded React Flow / force-layout implementation and dependencies.
5. Test in the browser, review dense views, run quality gates, record evidence, and commit production files independently of the disposable prototype.

## Scope

No Cloudflare deployment, new backend contract, physical simulation, or external image service. The existing adapter provides graph data. See ADR-0005 for tradeoffs.

## Verification — 2026-08-30

- `pnpm check`: passed formatting, lint, dependency boundaries, Knip, peer checks, typechecks, 61 unit/integration tests, frontend build, and Worker dry-run build. No deployment performed.
- Playwright/Gherkin: 13/13 smoke scenarios passed, including graph selection/open, camera rotation/tilt/zoom/reset, keyboard operation, reduced-motion, mobile overflow, proposals, Markdown, and bilingual docs.
- Browser review: real Atlas in Portuguese; pointer drag changed yaw from 0.12 to 0.72; document selection highlighted its real neighborhood; no browser console errors.
- Temporary harness: inspected 74-node and 200-node snapshots, including six communities, two disconnected memories, four real bridges, all body types, selected satellite detail, and zoom. Harness removed after inspection.
- Independent review found and resolved empty-to-populated wheel attachment, label collisions, canceled-drag click suppression, focus restoration, reduced-motion UI synchronization, and idle per-frame DOM writes.
- Initial integration bounded textures to one 128/64px image per node (at most 12.5 MiB for 200 nodes), with a separately cached scene backdrop. This froze body animation; the motion follow-up below replaces that backdrop strategy while preserving the texture bound and avoiding React updates per frame.
- Production graph chunk: 27.50 kB / 9.61 kB gzip; satellite SVG: 5.34 kB / 1.77 kB gzip. React Flow and d3-force removed.

## Follow-up — motion and toolbar help

The first integration cached body drawing at time zero, losing visible motion from the approved single-HTML C experiment. Restore slow body drift, stellar pulse/corona, black-hole accretion, satellite rotation, pointer parallax, traveling relationship particles, and the rotating selected orbit with its probe.

- Keep the procedural budget at 12 visible stars/black holes, prioritizing selection and hover, then nearer bodies. Cache other body textures. Cap continuous painting at 25 fps without rerendering React, regrouping communities, or rerunning label collision checks per frame.
- Align semantic hit targets imperatively with the moving bodies. Use the satellite's rotational envelope for its clickable area, label offset, and collision avoidance.
- Preserve the current animation phase across pause/resume and hidden tabs. Reduced motion disables continuous painting and pointer parallax.
- Replace browser-native toolbar titles with localized, viewport-clamped tooltips: hover, keyboard focus, Escape dismissal, and an explanation for disabled motion controls. Render help outside the clipped graph boundary.

Verification: `pnpm check` passed with 65 unit/integration tests; the final scene adjustments also passed focused lint, typecheck, all 38 web tests, and the production web build. Playwright/Gherkin covers 15 smoke scenarios, including actual Canvas-pixel and hit-position changes, frozen pause/reduced-motion snapshots, resume, and desktop/mobile tooltip bounds. Browser inspection verified the Portuguese tooltip, Escape dismissal, and selected orbit. The graph chunk is 32.05 kB / 11.25 kB gzip; no dependencies or backend contracts changed.

## Local tooling notes

Windows Knip uses its supported non-raw-transfer parser path to avoid the experimental 6 GiB allocation; every check remains enabled. Existing source formatting was normalized without behavior changes. The local dependency tree was reused with `pnpm_config_verify_deps_before_run=false` after a lockfile-only offline update; no checks were skipped. Wrangler emitted a sandbox warning for its global log path, but its tests and dry-run build succeeded.

The production work is on `feat/celestial-galaxies`, based on `main`. The original HTML and sprite experiment remains committed separately on `prototype/celestial-atlas-variants` and is not part of this production branch.
