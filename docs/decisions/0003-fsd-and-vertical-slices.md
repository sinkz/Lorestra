# ADR-0003: Use Feature-Sliced Design in the web app and vertical slices in the API

## Status

Accepted

## Date

2026-08-28

## Context

Lorestra has two different change patterns. Frontend work combines reusable entities and user-facing features across routes. Backend work changes one use case from transport through policy and persistence. One horizontal architecture for both would either over-couple the frontend or scatter backend behavior.

## Decision

The web application follows the FSD dependency direction:

```text
shared → entities → features → widgets → pages → app
```

The API is organized by use-case slices. A slice colocates route, validation, handler/use case, mapping, and its integration test. Shared backend logic becomes a deep module only when multiple slices genuinely benefit from the same interface.

Dependency-cruiser enforces cycles and architectural rules. Steiger provides advisory FSD feedback while its ecosystem matures.

## Alternatives considered

### Organize everything by technical type

Global `components`, `services`, `controllers`, and `repositories` folders make one user-facing change span many unrelated directories. Rejected.

### Put each domain in its own workspace package

Creates package overhead and premature public interfaces before a second consumer exists. Rejected for the initial product.

### Use vertical slices in both frontend and backend

Can work, but shared visual entities and route composition become harder to place consistently. Rejected in favor of FSD's explicit frontend dependency model.

## Consequences

- A frontend feature has a predictable home and import direction.
- A backend use case is reviewable end to end.
- Public slice interfaces must remain deliberate.
- Architectural checks are part of `pnpm check`.
