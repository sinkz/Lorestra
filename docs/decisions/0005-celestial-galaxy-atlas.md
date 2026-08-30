# ADR-0005: Relation-based celestial Atlas

- Date: 2026-08-30
- Status: Accepted

## Context

The approved C experiment established a spatial, celestial vocabulary. The previous folder-attracted layout crowded unrelated documents together and its DOM-shaped bodies lost their circular silhouettes. The product needs recognizable document types, genuinely separated communities, and useful navigation for people and agents.

## Decision

Use a native Canvas 2D renderer with projected 3D coordinates, an independently tested deterministic community layout, and semantic HTML controls. Keep `GraphSnapshot` and the existing client boundary unchanged. The public prototype is a reference only, never a runtime dependency.

Semantic references have greater clustering weight than folder containment. Disconnected components remain separate. Each community has a larger representative body; cross-community corridors bundle only edges actually present in the snapshot. The visual grouping is an aid, not an assertion of document ownership or a new stored relation.

Camera transforms, drawing, and hit-target positions stay outside React's render loop. Cache body textures, cap pixel density, cull offscreen bodies, and pause continuous rendering when hidden or motion is disabled. Keep the bounded server graph contract (200 nodes / 500 edges); use scopes for larger vaults instead of silently dropping another slice in the renderer.

Keep a list alternative, keyboard-operable nodes and camera controls, bilingual instructions, visible selection, and explicit reset. Redesign the station as an original same-origin satellite SVG, without external images or requests.

## Alternatives

- Retain React Flow: excellent general graph editing, but this read-only spatial map needs custom rendering and a camera rather than editable boxes.
- Three.js/WebGL: real geometry and lighting, but adds dependency, context recovery, and GPU complexity unnecessary for the approved experiment.
- Import the prototype: rejected because it contains example data, experiment controls, and no production boundaries.

## Consequences

The renderer owns projection and hit-target alignment, so test these interfaces and verify visually. Celestial bodies are illustrative, not physically simulated. Layout is deterministic for an identical snapshot; adding references may change communities. Accessibility remains HTML-based rather than relying on Canvas pixels.
