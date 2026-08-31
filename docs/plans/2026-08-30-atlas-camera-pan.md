# Atlas camera pan and focal zoom

## Request

After zooming in, a galaxy near the edge cannot be brought back into the view. The approved camera only stores rotation and zoom. Add independent screen-space translation without moving document coordinates or changing the knowledge layout.

## Interaction

- Primary drag continues to orbit. Right drag, left+right together (either press order), middle drag, and Shift+primary drag pan the map.
- A localized **Pan map / Mover mapa** toolbar toggle makes primary drag pan, including single-finger touch. A tap still selects a memory.
- Arrow keys rotate the focused camera; Shift+arrows pan. Home and Reset view restore rotation, zoom, and translation. Toolbar and selection-panel interactions do not start camera gestures.
- Wheel zoom keeps the spatial point beneath the cursor fixed. Toolbar and keyboard zoom use the visible viewport center. Effective clamped zoom prevents drift at zoom limits.

## Boundaries

Store translation as viewport-relative offsets and convert pointer movement from CSS pixels. Preserve offsets through rotation and resize. Projection applies the same translation to bodies, relations, and semantic hit targets. Compensate the renderer's vertical offset and global parallax when converting the visible zoom anchor.

Pointer state uses the current `buttons` bitmask: pressing the second mouse button produces a pointer move, not a second pointer down. One pointer owns a gesture. Capture, cancellation, leaving before capture, lost capture, blur, and hidden tabs end it safely. Drag-generated clicks are suppressed without blocking keyboard activation or the next ordinary click.

Touch begins with implicit capture on the canvas or node. When dragging transfers capture to the container, the child's bubbling `lostpointercapture` must be ignored; only loss of the container's own capture ends the gesture. Independent review reproduced this as movement stopping after the first touch move and verified the targeted event-origin guard.

Camera updates remain imperative, with no React state update or community-layout recomputation per pointer move. Only the explicit tool toggle changes React state. No backend contract, dependency, renderer artwork, or deployment changes.

## Verification plan

- Unit tests for screen-pixel pan after rotation/zoom, normalized offsets, reset, focal zoom, zoom limits, and empty viewports.
- Gherkin smoke with real mouse gestures for right drag and both chord orders, Shift+drag, pan mode, Shift+arrows, reset, and continued document/toolbar navigation.
- Visual check of a zoomed, displaced galaxy plus responsive toolbar/help placement.
- Run the complete existing smoke suite and `pnpm check` before committing.

## Verification — 2026-08-30

- `pnpm check` passed: formatting, lint, dependency boundaries, unused-code and peer checks, typechecks, 78 unit/integration tests, frontend production build, and Worker dry-run build. Nothing deployed.
- Playwright/Gherkin: 19/19 scenarios passed. The new mouse coverage checks right drag, both chord orders, Shift+drag, the pan toggle, keyboard pan/reset, toolbar isolation, and document selection/opening after a drag. All prior scenarios remain enabled.
- Mobile: 4/4 focused scenarios passed, including native Chromium touch from both a canvas and a memory node. Each intermediate displacement is asserted through 80/120 pixels to catch implicit-capture transfer regressions, with orientation, zoom, and route unchanged.
- Manual Portuguese browser review brought an offscreen Lyra galaxy back into view with a -320/+185 pixel drag at 1.728× zoom; yaw and pitch stayed unchanged. Cursor zoom kept the chosen body within one pixel of its prior position in the paused inspection. A 360-pixel viewport had no horizontal overflow, and toolbar/help did not overlap. Temporary viewport and motion changes were restored.
- Independent review reproduced the touch-capture bug, retested the event-origin guard on both start surfaces, and reported no remaining blockers. No dependencies or backend contracts changed; camera updates remain outside React's render loop.
