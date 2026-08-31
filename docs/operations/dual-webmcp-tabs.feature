@manual @webmcp-real @local-only @concurrency
Feature: Two native agents preserve edits to the same memory
  This manual protocol uses two Codex browser tabs and the same synthetic principal.
  It does not certify independent user sessions or automatically bind to Playwright.

  Background:
    Given the local HTTP product persists knowledge in D1 and R2
    And agent A and agent B have separate native WebMCP handles
    And both report the same authorized synthetic maintainer

  Scenario: Exactly one overlapping update accepts the original proposal version
    Given both agents read version 1 of the same open proposal
    And each retains an independent contribution based on document revision 1
    When a common start barrier releases both native updates with expected proposal version 1
    Then one native update returns proposal version 2 without publication
    And the other returns 409 proposal_version_conflict with current version 2
    And native readback contains only the winning contribution
    And the losing agent retains its rejected payload

  Scenario: Deliberate reconciliation preserves both contributions
    Given the losing agent has read the winning proposal version 2
    When it explicitly combines both contributions and submits against version 2
    Then the proposal becomes version 3 while document revision 1 remains unchanged
    When the other agent verifies exact content and approves the reconciled proposal
    And the first agent explicitly confirms publication of the approved version and hash
    Then native readback returns document revision 2 with both contributions
    And historical revision 1 remains byte-for-byte unchanged
    And the audit trail contains one merge and one resulting document revision

  Scenario: An older competing base cannot replace the combined publication
    Given another approved proposal still targets document revision 1
    And the combined publication already exists as document revision 2
    When agent B attempts and explicitly confirms the competing native merge
    Then subsequent native reads keep that proposal unmerged and its draft intact
    And document revision 2 retains the exact combined content
    And no merge or publication event exists for the competing proposal
    And any native transport timeout is reported without inventing an HTTP error code
