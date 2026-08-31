@manual @webmcp-real @local-only
Feature: Review synthetic documentation with local agents
  This is a manual native-browser execution protocol, not an automated Playwright binding.
  Keep its execution evidence in native-agents-demo.md.

  Background:
    Given Lorestra uses the HTTP adapter with local Worker, D1 and R2
    And operator-issued synthetic contributor and maintainer sessions are available
    And no Cloudflare resource or paid service is provisioned

  Scenario: Independent agents correct and publish a useful runbook
    When the contributor proposes the fictional Aurora recovery runbook
    And the maintainer requests verifiable release criteria
    And the contributor corrects the same proposal using its current version
    Then the proposal reopens with no published document
    When the maintainer reads, approves and explicitly merges the corrected version
    Then the published Markdown matches the corrected body
    And the history preserves author, reviewer and proposal transitions

  Scenario: A document with unresolved editorial decisions stays unpublished
    Given the contributor proposes the fictional shared-memory ADR
    When the reviewer requests an owner, cadence and reconsideration trigger
    Then the proposal remains changes_requested
    And the proposed document is not available as published knowledge

  Scenario: Native tools inherit session authority and update the open UI
    Given the browser has discovered the actual Lorestra WebMCP tools
    And the guide reports the contributor's real capabilities
    When the contributor creates a fictional conversation cookbook through WebMCP
    Then native approval is denied with a typed forbidden result
    When the maintainer requests changes through local HTTP
    And the contributor resubmits the same proposal through WebMCP
    Then the open proposal detail shows its new version without reload
    And no published document exists before merge

  Scenario: Cancelling native confirmation publishes nothing
    Given a maintainer has read and approved the current proposal
    When its native merge tool opens the asynchronous confirmation
    Then the dialog shows the exact proposal ID, version and content hash
    When the confirmation is cancelled
    Then the tool reports no publication
    And the proposal remains approved with no new document revision

  Scenario: Concurrent editing invalidates the visible native confirmation
    Given a native merge confirmation is open for an approved proposal
    When another authorized session edits that proposal before confirmation
    And the original confirmation is accepted
    Then the server rejects the stale publication with a conflict
    And the new draft remains unpublished
    When the maintainer reads and approves the new version
    And explicitly confirms a new native merge for that version
    Then the tool returns the persisted publication result

  Scenario: Correct an already published document without overwriting its history
    Given the published runbook has a relative Markdown link unresolved by the API
    When an agent proposes only that correction against document base version 1
    And another maintainer reviews, approves and explicitly merges it
    Then the document has a new immutable revision
    And its old revision remains readable
    And the corrected visible link opens the intended document
