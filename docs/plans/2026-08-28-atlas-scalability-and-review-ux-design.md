# Lorestra Atlas, Scalability, and Review UX Design

**Date:** 2026-08-28  
**Status:** Approved  
**Scope:** Web UI and shared client contracts; Cloudflare persistence remains out of scope.

## Outcome

Lorestra should feel like a durable knowledge workspace rather than a generic dashboard. This pass fixes the Markdown layout failure, turns the Atlas into an original spatial constellation, makes review queues scan like mature code-hosting products, and gives every growing collection an explicit scaling strategy.

## Design principles

1. **A graph is a lens, not a dump.** The Atlas shows an intelligible bounded subgraph, never a silent slice of an arbitrarily large vault.
2. **Review is a queue.** Proposals use dense rows, strong state hierarchy, useful metadata, and stable pagination instead of decorative cards.
3. **Pagination limits data; virtualization limits DOM.** They solve different problems and are combined only where both are useful.
4. **Portable contracts stay honest.** Mock and HTTP clients expose the same cursor semantics so replacing fixtures does not require changing page code.
5. **Motion explains structure.** Graph movement settles quickly, selection reveals relationships, and reduced-motion users receive a stable layout.
6. **Only affected UI should re-render.** Tree rows receive primitive state, stable callbacks, and a one-pass derived index.

## Atlas: the Lorestra constellation

The recommended renderer remains React Flow. A deterministic `d3-force` layout computes positions from semantic forces:

- folder nodes are cluster anchors;
- documents are attracted to their folder and connected documents;
- collision force respects node dimensions;
- link distance changes by relationship type;
- charge spreads clusters across the available scene;
- a stable hash seeds initial coordinates, avoiding layout changes on reload;
- the simulation runs for a bounded number of ticks and then stops;
- dragging may locally reheat the scene;
- reduced-motion skips animated settling.

Visual language:

- folders are luminous anchor nodes;
- documents use compact memory capsules with a type accent;
- selected paths brighten while unrelated nodes and edges recede;
- curved edges reduce the appearance of a rigid diagram;
- node scale reflects degree within conservative bounds;
- background, minimap, controls, legend, and empty states share the Lorestra palette;
- graph scope remains global, folder, or related, with the active lens visible;
- bounded results show an explicit count and suggest narrowing the scope.

React Flow remains appropriate for a few hundred richly styled nodes. A WebGL renderer such as Sigma is a future adapter for truly large graphs, not a dependency for this pass.

## Markdown containment

Every document panel must keep intrinsic content inside its grid column:

- all grid/flex ancestors use `min-width: 0` where needed;
- raw Markdown wraps long prose by default and never paints over the aside;
- code blocks and tables scroll inside their own boundary;
- images, links, and embedded content respect the column width;
- the document aside stacks predictably at intermediate widths;
- Playwright asserts that the document panel does not overflow at desktop, tablet, or mobile widths.

## Collection scaling policy

| Surface | Data strategy | Rendering strategy | UX |
| --- | --- | --- | --- |
| Library | Cursor query, 50 items | One page at a time | URL-backed page, filters, sort, result range |
| Proposals | Cursor query, 30 items | One page at a time | GitHub/GitLab-style queue and pagination |
| History | Cursor query, additive pages | Virtualize after the loaded set grows | Explicit “load more” timeline |
| Folder tree | Lazy-ready navigation contract | Virtualize above 80 visible rows | Preserve expansion and selection |
| Atlas | Bounded subgraph by scope | Render only the active lens | Counts and narrowing guidance |
| Proposal files | Bounded detail response | Collapse sections; virtualize if needed later | File-by-file review |
| Global search | Bounded top results | Small result popover | Existing limit remains intentional |

The shared contracts already define cursor primitives. The web adapters must stop discarding `pageInfo`. Library data should no longer depend on an all-documents navigation payload for page rendering. During this POC, mock clients implement the same pagination behavior expected from the future Worker.

## Proposals redesign

The proposal index becomes a review queue:

- rows, not floating cards;
- proposal number, title, concise summary, author, relative update time, change count, and status in a predictable scan order;
- new-document proposals receive a clear `New` marker;
- status filters include counts and remain in the URL;
- selected filters, pagination, and back navigation retain context;
- hover and focus reveal interactivity without moving the layout;
- a compact review summary replaces the empty decorative right rail;
- empty and loading states preserve the queue shape;
- mobile rows stack metadata without becoming card-heavy.

Proposal detail keeps the established code-review model: overview, affected files, bounded diff, checks, discussion summary, and explicit governance actions. Semantic colors must keep sufficient contrast on the paper background.

## Folder render model

The current tree already windows more than 80 visible entries, but it still invalidates every row on route and expansion changes. The revised model will:

- index documents by folder once;
- calculate descendant counts in one post-order traversal;
- derive only visible entries from expansion state;
- pass `selected`, `open`, and other primitive props to rows;
- memoize rows and use stable callbacks;
- provide stable virtual item keys;
- keep roving keyboard focus and ARIA tree semantics;
- remain compatible with future child loading per expanded folder.

## Verification

Focused automated coverage will verify:

- raw Markdown remains contained at 1440, 1024, and 375 pixels;
- graph nodes occupy the scene in both axes and do not overlap after layout;
- reduced motion yields a stable graph;
- proposal filtering and pagination preserve URL state;
- library pagination/filter combinations show correct ranges;
- folder expansion and keyboard navigation remain functional;
- console warnings and errors remain zero on affected routes;
- the existing lint, typecheck, unit, integration, build, and Playwright suites remain green.

## Explicit non-goals

- Cloudflare deployment or persistent production storage;
- authentication and reviewer authorization;
- WebGL rendering for tens of thousands of nodes;
- a complete virtualized data-grid framework;
- visual imitation of GitHub, GitLab, Neo4j, or Obsidian.
