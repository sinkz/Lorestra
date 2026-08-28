# Lorestra Hackathon Product Plan

**Date:** 2026-08-28  
**Status:** Implemented and verified  
**Goal:** Ship an open-source Lorestra product that is visually memorable, technically credible, easy for humans and agents to use, and ready to replace local mocks with Cloudflare infrastructure without rewriting consumers.

## Delivery record

The hackathon POC was completed against this plan on 2026-08-28:

- `pnpm check` passes formatting, lint, dependency boundaries, Knip, peer compatibility, type checks, 37 unit/integration tests, the Worker dry build, and the production web build.
- Playwright BDD passes 8/8 Gherkin journeys across desktop and mobile, including search focus, modal Escape, mobile drawer focus restoration, governance, immutable revisions, i18n, and horizontal overflow.
- Targeted mutation testing reports 100% mutation score: 83 killed, 5 timed out, 0 survived, and 0 uncovered across critical search and proposal-transition rules.
- A compatible in-app browser reports WebMCP status `registered` with all 10 typed Lorestra tools; a standalone evidence script is documented for hackathon capture.
- The production dependency audit reports no known vulnerabilities, and the repository secret scan reports no committed credentials.
- Independent architecture, WebMCP/quality, and UX reviewers reached `READY` consensus with no unresolved P0/P1 findings after correction loops.

Production authentication, durable Cloudflare persistence, multi-user concurrency, and abuse controls remain explicitly outside this POC and are not represented as complete.

## 1. Product outcome

Lorestra turns lessons, decisions, incidents, notes, processes, and internal documentation into shared, searchable, reviewable Markdown knowledge. Humans and agents use the same durable vault and the same proposal workflow.

The hackathon release must prove five things:

1. A vault is pleasant to browse as folders, documents, search results, and a connected Atlas.
2. Markdown remains the portable source of truth.
3. A proposed change never becomes official before review and merge.
4. History explains who changed what, why, and which document version resulted.
5. The application consumes the final contract even while data comes from removable mocks.

## 2. Scope

### In scope

- A polished React web application with English and Brazilian Portuguese.
- Atlas, Library, document reader/editor, Proposals, History, and vault-backed Docs.
- A final shared runtime contract and both mock and HTTP client adapters.
- A Cloudflare Workers/Hono backend skeleton organized by vertical slice.
- Public read-only behavior and explicit future seams for authenticated writes/reviews.
- High-value unit and integration tests plus Playwright/Gherkin smoke scenarios.
- Linting, formatting, type checking, dependency rules, unused-code checks, commit conventions, CI, contribution templates, and repository documentation.
- Responsive layout and WCAG-oriented keyboard/focus/contrast behavior.

### Out of scope for this iteration

- Cloudflare deployment, D1/R2 creation, production authentication, and secrets.
- Multi-user persistence or real concurrent editing.
- Full Git provider integration.
- Exhaustive test coverage or mutation testing of presentation code.
- Unlimited graph rendering.

## 3. Technical baseline

Versions are pinned in the lockfile. The chosen baseline favors current stable releases with known tooling compatibility.

| Area | Decision |
| --- | --- |
| Runtime | Node 24 LTS, pnpm workspace |
| Language | TypeScript 6.0.x; TypeScript 7 waits for `typescript-eslint` compatibility |
| Web | React 19.2, Vite 8, React Router 8 in Data Mode |
| Server state | TanStack Query 5 |
| UI state | Zustand 5, restricted to ephemeral preferences and shell state |
| Forms | React Hook Form 7 + Zod resolver |
| i18n | i18next + react-i18next + browser language detection |
| Graph | React Flow, route-level lazy loaded, with memoized custom nodes |
| Long lists | TanStack Virtual after an explicit item threshold |
| Markdown | react-markdown + remark-gfm; raw HTML disabled |
| API | Cloudflare Workers + Hono + Zod OpenAPI |
| Runtime contracts | Zod schemas in `@lorestra/contracts` |
| Unit/integration | Vitest for pure boundaries and WebMCP; Hono `app.request()` for API slices |
| E2E/BDD | Playwright + playwright-bdd with `.feature` specifications |
| Mutation | Stryker only for critical pure search/filter and workflow transition logic |
| Tooling | ESLint flat config, Prettier, dependency-cruiser, Knip, peer checks, Commitlint, and Husky |
| Git conventions | Conventional Commits, Commitlint, Husky, PR and issue templates |

React Router Data Mode preserves architectural control for FSD while providing URL-driven loaders, pending states, and route code splitting. The Cloudflare API remains a separate workspace application for a clean backend seam.

## 4. Repository structure

```text
Lorestra/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/                 # providers, composition root, router, global styles
│  │  │  ├─ pages/               # route composition
│  │  │  ├─ widgets/             # sidebar, atlas, document workspace, review detail
│  │  │  ├─ features/            # search, select-language, edit, propose, review, filters
│  │  │  ├─ entities/            # document, folder, proposal, revision, history event
│  │  │  └─ shared/              # UI primitives, client interface/adapters, i18n, utilities
│  │  └─ public/
│  └─ api/
│     ├─ src/
│     │  ├─ app/                  # composition and normalized errors
│     │  ├─ slices/               # one folder per use case
│     │  ├─ modules/              # deep domain modules and ports
│     │  ├─ adapters/             # memory now; R2/D1/Auth later
│     │  └─ runtime/worker.ts
│     └─ wrangler.jsonc
├─ packages/
│  ├─ contracts/                  # Zod schemas and DTOs; no framework/runtime imports
│  └─ mock-vault/                 # removable mock adapter and Markdown fixtures
├─ vault/                          # example portable vault content
│  ├─ Docs/en/
│  ├─ Docs/pt-BR/
│  ├─ Engineering/
│  ├─ Product/
│  └─ Team/
├─ tests/e2e/
│  ├─ features/
│  └─ steps/
├─ docs/
│  ├─ plans/
│  ├─ adr/
│  ├─ architecture/
│  └─ contributing/
└─ .github/
   ├─ workflows/
   ├─ ISSUE_TEMPLATE/
   └─ PULL_REQUEST_TEMPLATE.md
```

## 5. Architectural rules

### 5.1 Shared contract

`@lorestra/contracts` is the final transport contract. It owns Zod schemas for documents, navigation, graph snapshots, search, proposals, revisions, history, pagination, and normalized errors.

- Contracts import no React, Hono, Cloudflare, filesystem, or mocks.
- Stable document IDs are distinct from mutable slugs.
- DTOs expose no physical storage paths.
- Every adapter validates data at runtime against the same schemas.
- OpenAPI is generated from the same response and request schemas.

### 5.2 Client seam and removable mocks

Consumers depend on two small interfaces:

```ts
interface KnowledgeClient {
  getNavigation(input?: NavigationInput): Promise<NavigationResponse>;
  getDocument(input: GetDocumentInput): Promise<DocumentResponse>;
  getGraph(input: GraphInput): Promise<GraphResponse>;
  search(input: SearchInput): Promise<SearchResponse>;
  getHistory(input: HistoryInput): Promise<HistoryResponse>;
}

interface ProposalClient {
  list(input: ListProposalsInput): Promise<ProposalListResponse>;
  get(input: GetProposalInput): Promise<ProposalResponse>;
  create(input: CreateProposalInput): Promise<ProposalResponse>;
  transition(input: TransitionProposalInput): Promise<ProposalResponse>;
}
```

The web composition root is the only location that chooses adapters:

- `MockKnowledgeClient` and `MockProposalClient` for the hackathon build.
- `HttpKnowledgeClient` and `HttpProposalClient` for the final API.

No page, widget, feature, entity, or query hook imports mock data. Removing `packages/mock-vault` requires changing only the composition root/environment configuration.

### 5.3 FSD frontend rules

Allowed dependency direction:

```text
shared → entities → features → widgets → pages → app
```

- A layer never imports a higher layer.
- Slices expose deliberate public interfaces.
- Direct imports are preferred internally; giant barrel files are forbidden.
- TanStack Query owns asynchronous/remote state.
- Zustand owns only language preference, sidebar disclosure state, layout preference, and reduced visual effects.
- URL/search parameters own selected document, folder, proposal, history event, graph scope, and durable filters.
- React Hook Form owns form state.

### 5.4 Vertical Slice backend rules

Initial read slices:

- `health`
- `read-navigation`
- `read-document`
- `read-graph`
- `search-knowledge`
- `list-proposals`
- `read-proposal`
- `read-history`

Write/review slices can exist behind development adapters but are not registered as public production routes until authentication and authorization are implemented.

Each slice colocates route, request/response schema mapping, handler/use case, and integration test. Shared complexity moves into a deep module only when more than one slice genuinely needs it.

Future production adapters:

- R2 for canonical Markdown bodies and immutable revision objects.
- D1 for searchable metadata, relationships, proposal state, and revision pointers.
- Cloudflare Access or OIDC for principal resolution.
- Rate limiting/queues only when measured demand justifies them.

## 6. Content model

Docs are normal vault documents, not a separately hardcoded marketing page. The example vault contains localized documentation under:

```text
Docs/en/
Docs/pt-BR/
```

The Docs menu item opens the localized Docs folder and its landing document. Agents propose edits through the same Proposal workflow used by engineering and product knowledge.

Each document includes stable frontmatter fields:

```yaml
id: lorestra.docs.what-is-lorestra.en
slug: what-is-lorestra
locale: en
title: What is Lorestra?
visibility: public
status: published
version: 1
nav:
  visible: true
  parentId: lorestra.docs.en
  order: 10
```

`nav.visible` never grants read access. Visibility, publication status, and authorization policy remain separate.

## 7. UX specification

### 7.1 Navigation and reset policy

URL is the source of truth. Primary routes are:

```text
/
/library?folder=<id>&view=list
/documents/:slug?tab=preview
/atlas?scope=entire|folder|related&document=<id>&folder=<id>
/proposals
/proposals/:proposalId
/history
/history/:eventId
/docs/:locale/:slug?
```

Rules:

- Moving between primary pages clears transient selection not represented in the destination URL.
- Browser Back restores the exact document, folder, filter, and scroll context.
- Library never silently inherits the folder of a previously opened document.
- Opening Graph from a document explicitly sets `scope=related&document=<id>`.
- Opening Library from a folder explicitly carries `folder=<id>`.
- Unsaved editor content triggers a navigation warning.
- Search terms, proposal status filters, and list/grid preference are URL-backed or intentionally persisted.

### 7.2 Folder experience

- Folder disclosure and folder selection are separate controls.
- Correct `tree`, `treeitem`, `group`, `aria-expanded`, `aria-level`, and keyboard semantics.
- Left/Right arrows collapse/expand; Up/Down navigate visible rows; Home/End jump.
- The current document path auto-expands without reopening folders the user intentionally collapsed.
- Collapse state is preserved per vault.
- Visible rows are flattened; TanStack Virtual activates beyond 80 visible rows.
- Search can filter folders without destroying disclosure state.
- On mobile, the closed sidebar is `inert` and has a backdrop.

### 7.3 Atlas

- Entire vault on first load.
- Folder scope highlights internal nodes and de-emphasizes external neighbors.
- Returning from a document defaults to its direct relations.
- React Flow is route-level lazy loaded.
- Custom node definitions and callbacks are memoized.
- Large graphs are clustered/paginated; the initial canvas renders at most 200 visible nodes.
- Edge animation is disabled over 80 visible edges and under reduced motion.
- A list representation provides equivalent navigation and accessibility.

### 7.4 Library

- Dense, scannable list is the desktop default: title, path, type, status, author, updated date, and relation count.
- Optional card view is retained for discovery but not used as the only layout.
- Responsive cards replace the table on narrow screens.
- Sort, type/status filters, folder scope, and result count are visible.
- A preview panel is optional on wide screens and never traps navigation.
- Virtualization activates over 100 loaded rows; server pagination remains the future large-vault strategy.

### 7.5 Document workspace

- A document replaces the graph in the main workspace.
- Workspace toggle switches between Document and contextual Graph.
- Tabs: Preview, Markdown, Relations, History.
- Tabs use semantic tab patterns and restore focus after route updates.
- Preview is optimized for reading; raw HTML in Markdown is not rendered.
- Editing changes a proposal draft, never the published document.
- A merge is the only event that creates a new published revision.

### 7.6 Proposals

- `/proposals` is a filterable list.
- Selecting an item navigates to `/proposals/:id`; detail is never stale when a filter has no results.
- Desktop uses a 360–400px list plus a flexible detail region.
- Mobile uses separate list and detail routes with a visible Back action.
- Exact status filters: Open, Changes requested, Approved, Merged, All.
- Detail shows metadata, affected files, checks, discussion summary, and diff per file.
- New documents show a `New file` badge and a GitHub-like full-file addition.
- Approval does not mutate the published document.
- After approval, `Merge into vault` becomes the primary action.
- Request changes requires a reason and remains reversible.

### 7.7 History

- Filterable timeline/list with author, event type, time, proposal, document, and resulting version.
- `/history/:eventId` explains the event and exposes links to its Proposal and document revision.
- Opening a version never silently replaces the current published version.
- History is immutable in the UI.

### 7.8 Internationalization

- Browser language is detected on first visit.
- The user can choose `Português (Brasil)` or `English` from a visible language control.
- Choice is persisted and `document.documentElement.lang` is updated.
- Dates/numbers use `Intl` for the active locale.
- UI translation keys are namespaced and statically checked where practical.
- Vault documents declare `locale`; Docs resolve to the current-language counterpart when one exists.

## 8. Design system

Direction: **editorial observatory** — serious instrument, warm reading surface, dark spatial navigation, no generic purple AI gradient.

### Core palette

| Token | Value | Use |
| --- | --- | --- |
| `ink-950` | `#07110F` | Dark application background |
| `ink-900` | `#0D1B18` | Sidebar and dark surfaces |
| `ink-800` | `#142620` | Elevated dark surfaces |
| `paper-50` | `#F5F2E9` | Reading and review background |
| `paper-100` | `#ECE8DC` | Secondary light surface |
| `forest-950` | `#122019` | Primary text on paper |
| `forest-700` | `#365848` | Secondary emphasis on paper |
| `forest-600` | `#426B58` | Muted text/borders on paper |
| `signal-300` | `#D3F56A` | Accent on dark surfaces only |
| `success-700` | `#216B4A` | Approved/merge action on paper |
| `danger-700` | `#9C3636` | Destructive/request-changes action on paper |
| `warning-700` | `#8A5A16` | Changes requested on paper |
| `info-700` | `#2C6280` | Informational status on paper |

Rules:

- Lime is never used as body text or an outline-only button on paper.
- Buttons have surface-specific variants; dark-surface and paper-surface tokens are not mixed.
- Disabled controls preserve readable labels and never rely on low opacity alone.
- Status always combines text with icon or shape, never color alone.
- Normal text contrast targets at least 4.5:1; UI boundaries target at least 3:1.
- Typography uses a distinctive editorial serif for document/section titles and a legible humanist sans for UI.
- Spacing follows an 8px system with 4px optical adjustments.
- Focus is a high-contrast 3px ring that is not obscured by sticky headers.

### Action hierarchy on paper

1. Before approval: `Approve` is filled `success-700`; `Request changes` is a high-contrast danger outline; Merge is disabled with an explicit reason.
2. After approval: `Merge into vault` becomes filled `success-700`; approval becomes a visible completed status.
3. Neutral actions use ink outlines/text, not pale text.

## 9. Performance budgets

- Initial web JavaScript target: under 250 KB gzip excluding the lazy Atlas chunk.
- Atlas and Markdown editor are lazy loaded.
- No route imports the graph library before Atlas/contextual Graph is opened.
- Lists virtualize only above measured thresholds; small lists stay simple.
- Search debounce: approximately 150 ms locally; final API adds cancellation and pagination.
- Query keys are colocated with typed query option factories.
- Graph consumers subscribe to selected IDs/derived booleans instead of the entire node array.
- No expensive SVG edge effects on large scopes.
- CI tracks bundle composition and fails on accidental Node-only imports in the Worker.

## 10. Testing strategy

### Unit tests — small, critical set

- Contract schema success/failure.
- Search normalization, ranking, and filtering.
- Folder flattening, disclosure, and reset policy.
- Proposal transition state machine.
- Graph scope derivation.

### Integration tests

- Both mock and HTTP-shaped adapters satisfy the same client contract suite.
- Hono slices return responses validated by shared schemas.
- Public read routes exclude draft/internal content.
- Proposal approval does not change a published document; merge creates a new revision.
- Router restores URL-backed state and clears transient state correctly.

### Playwright/Gherkin smoke scenarios

1. Switch between English and Portuguese and persist the choice.
2. Collapse folders, open a document, switch Preview/Markdown, and return to contextual Graph.
3. Search for a known incident and open it.
4. Change Library filters without inheriting stale document context.
5. Open a proposal from the list, inspect a new-file diff, approve, and merge.
6. Open a History event, navigate to its proposal, then open the resulting document revision.
7. Open Docs and navigate localized usage/cookbook documents.
8. Mobile smoke: open/close navigation and review a proposal without horizontal overflow.

### Mutation tests

Stryker runs only against:

- search ranking/filter predicates;
- folder visibility derivation;
- proposal transition guards.

It is a manual/nightly quality gate, not part of every local test run.

## 11. Tooling and repository quality

Root commands:

```text
pnpm dev
pnpm build
pnpm check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:mutation
pnpm deps:check
pnpm knip
```

`pnpm check` runs format, lint, architecture rules, types, unit/integration tests, and build. E2E and mutation remain explicit to keep the inner loop fast.

Repository assets:

- English README with product story, screenshots, architecture diagram, setup, mock-removal path, security policy, and roadmap.
- `LICENSE` (MIT), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, and `SECURITY.md`.
- Issue templates for bug, feature, and knowledge cookbook.
- PR template with UX, i18n, accessibility, security, and tests checklist.
- CI for checks/build and a separate Playwright workflow.
- No credentials, IDs, database names, or placeholder production secrets in source control.

## 12. Implementation phases and commits

1. `chore(repo): initialize Lorestra monorepo and quality tooling`
2. `docs(architecture): record contracts, adapters, frontend and worker decisions`
3. `feat(contracts): define the final Lorestra transport schemas`
4. `feat(api): scaffold Cloudflare worker vertical slices`
5. `feat(web): build the application shell, routing, design tokens and i18n`
6. `feat(vault): add removable bilingual mock vault and client adapters`
7. `feat(web): implement folders, Library, Atlas and document workspace`
8. `feat(review): implement Proposals and navigable History`
9. `docs(vault): add bilingual Lorestra guides and cookbooks`
10. `test(smoke): add contract, integration and Playwright BDD coverage`
11. `perf(web): add lazy loading and measured virtualization thresholds`
12. `fix(a11y): resolve contrast, focus, keyboard and responsive audit findings`
13. `docs(readme): prepare the public hackathon presentation`

Commits may be combined when a coherent slice is implemented together, but every commit must remain conventional and reviewable.

## 13. Definition of done

- Fresh install, lint, types, tests, build, and smoke suite pass.
- No dependency cycles or FSD/VSA boundary violations remain.
- Mock adapters can be removed without changing consumers.
- The web app never imports mock fixtures outside the composition root/adapter.
- Both languages cover all navigation, action, empty, error, and documentation text.
- Folder navigation is collapsible, keyboard accessible, and scalable.
- Proposals never mutate published knowledge before merge.
- History opens related proposals and immutable document revisions.
- Paper-surface actions meet contrast and hierarchy requirements.
- Desktop and mobile smoke scenarios have no horizontal overflow.
- Atlas loads lazily and renders only a bounded scope.
- README and repository metadata explain the problem, product, architecture, agent workflow, setup, and limitations.
- Independent implementation, UX, architecture, and test reviewers reach no unresolved P0/P1 findings.
