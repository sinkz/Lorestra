# ADR-0007: Isolate local identity and deny shared write access by default

- Date: 2026-08-31
- Status: Accepted
- Extends: ADR-0002

## Decision

An operator CLI creates synthetic local members and random, expiring session credentials through trusted bindings. The local HTTP session endpoint only exchanges an already-created credential for an HttpOnly, SameSite cookie. It does not accept a user-selected role or create accounts. Store only credential hashes server-side; never log credentials or ship them to the frontend bundle. Browser sessions receive capabilities and a CSRF token, not merge authority embedded in code.

The visitor reads public published and archived knowledge. Readers can inspect internal knowledge and proposals. Contributors create proposals and edit their own. Maintainers can review, edit any proposal and merge. Maintainers may review their own contributions in this PoC; there is no enforced two-person rule.

Every write checks exact origin, JSON content, CSRF, session and server-side role. The transactional publication guard rechecks changing permissions, not just the initial HTTP middleware. Logout revokes the session in D1. Private responses use `private, no-store`; changing principal clears browser query state. No direct browser account management or third-party agent tokens are introduced.

`local-worker.ts` and `worker.ts` choose different compositions. The shared composition does not register the local token-exchange endpoint. An environment variable cannot switch it into development authentication. Provisioning an Access/OIDC provider, validating provider JWTs, mapping real memberships, shared login and deployment remain the separately authorized staging milestone. Until then, this is a complete local development identity, not production authentication.

## Agent implications

WebMCP inherits the browser session; an agent has no independent identity or elevated role. UI and tools use the same mutation coordinator and typed HTTP clients. Editing reopens the same proposal, increments its version and invalidates approval. Browser-agent merge additionally requests human confirmation for the exact approved version and hash. HTTP itself cannot distinguish a human from an agent based on a caller-supplied header: it enforces the authenticated maintainer, version, approval and checks, and validates the confirmation tuple when supplied.

## Alternatives and consequences

Public mutation endpoints with UI-only permissions are rejected. A shared development password or a request-supplied role would be impersonation, not authentication. Remote OAuth/MCP agent provisioning is deliberately out of scope. Local setup stays account-free, while the repository clearly documents the additional work before internet exposure. Credential files are ignored and private; Windows users must rely on actual filesystem ACLs, not assume POSIX mode bits secure a file.
