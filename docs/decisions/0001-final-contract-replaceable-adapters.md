# ADR-0001: Use the final contract with replaceable adapters

## Status

Accepted

## Date

2026-08-28

## Context

The hackathon build needs convincing data and interactions before Cloudflare persistence is connected. A conventional prototype would import fixture arrays directly into pages, then require a second implementation pass when the API exists. That creates two subtly different contracts and makes mock removal expensive.

Humans and agents also need one documented interface to understand how the product reads knowledge, submits proposals, and navigates history.

## Decision

Create `@lorestra/contracts` as the framework-independent runtime contract. Zod schemas define requests, responses, normalized errors, and stable identities.

Frontend consumers depend on `KnowledgeClient` and `ProposalClient`. The composition root selects mock adapters during the hackathon and HTTP adapters when the backend is enabled. Pages, features, widgets, and entities never import fixture data.

The mock and HTTP implementations run the same contract tests.

## Alternatives considered

### Import fixture arrays from pages

Fast initially, but couples presentation to data shape and requires invasive replacement. Rejected.

### Mock network requests with a service worker in production development mode

Useful for tests, but it leaves transport behavior as the only seam and makes non-browser consumers harder to support. MSW remains useful in tests, not as the product's primary architecture.

### Generate all frontend types from the Hono application type

Provides strong compile-time coupling but makes a non-HTTP adapter awkward and does not validate runtime data by itself. Rejected in favor of shared schemas and OpenAPI.

## Consequences

- Mock removal changes composition, not consumers.
- Contracts stay stable across browser, Worker, agent, and test callers.
- Runtime validation adds a small cost but catches drift at the seam.
- Adapters must intentionally map storage models to transport DTOs.
