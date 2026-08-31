# Celestial demo content

## Scope

Add three themed example communities to the existing mock vault without replacing current documents or changing the renderer's semantics. Each community has six documents in English and Brazilian Portuguese and a localized folder: Orion (engineering), Lyra (learning), and Cygnus (research).

Each includes a guide, note, decision, incident, process, and archived predecessor. Their existing metadata drives planet, moon, ringed planet, comet, satellite, and black-hole models; the folder is a star. Links describe meaningful relationships and sparse bridges, not decorative graph edges. Example content is explicitly fictional.

## Implementation

- Add one removable fixture module and portable Markdown counterparts.
- Prefer explicit fixture document types, preserving legacy fixture inference and immutable revision types.
- Expose public archives as historical knowledge through existing read contracts; continue hiding all drafts and internal documents in both adapters. No deployed infrastructure or new API fields.
- Explain the content-to-model mapping and current authoring limitations.
- Validate three example communities, all seven body models, bilingual reading, privacy boundaries, and existing smoke workflows. Preserve the current vault alongside the examples.

## Issues exposed by realistic content

- Expanded folders were stretching the entire shell and Canvas. Constrain the shell to the dynamic viewport and keep folder/workspace scrolling independent; retain the graph-distribution smoke threshold rather than weakening it.
- Portable relative `.md` links previously navigated to missing web URLs. Give example files their unique document slug as filename, and resolve relative Markdown links against the current language's visible document catalog. External, unknown, and absolute links are not rewritten. The Markdown files remain portable outside Lorestra.
- ESLint was inspecting generated Playwright trace bundles after a failed run. Ignore only the generated report and result directories, consistent with the existing Git and Prettier exclusions; application and test sources remain linted.

## Acceptance

The Atlas and folder tree show the added examples in either language. A satellite and archived black hole can be selected and opened as real documents. Existing Markdown, proposals, history, and Docs remain intact. Folder membership organizes navigation; semantic references determine galaxy membership rather than a hardcoded galaxy property.

## Verification

- `pnpm check` passed: formatting, lint, dependency boundaries, unused-code and peer checks, all typechecks, 73 unit/integration tests, and production builds. The Worker build used dry-run only; nothing was deployed.
- Playwright/Gherkin: 16/16 scenarios passed, including satellite-to-process navigation, return to the folder Atlas, readable archive status, and navigation to the replacement document. Existing distribution thresholds were retained and the canvas is checked against viewport height.
- Fixture audit: 36 Markdown files and 154 relative links, with no broken local destinations. Six records are archived, each with a visible replacement reference.
- Application-client integration confirms three example communities, two bridges, and all seven body models in both locales. Existing Docs remain a separate community in the complete vault.
- Manual in-app inspection in Portuguese confirmed folder scrolling, bounded Atlas height, and document reading. The public archived example was also read successfully through WebMCP without a write operation.
