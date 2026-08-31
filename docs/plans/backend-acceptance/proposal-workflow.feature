@http
Feature: Review and publish durable knowledge proposals
  Only an authorized explicit merge changes the published vault.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And business writes use the Worker with local D1 and R2

  @smoke
  Scenario: B06 Create a new memory without publishing it
    Given I am signed in as Casey the contributor
    When I submit a new process with a title, folder, tags, locale and Markdown body
    Then a persisted open proposal is displayed with a new-file diff
    And the proposal records Casey as the authenticated author
    When I reload and reopen the proposal
    Then the same proposal and submitted metadata remain available
    And the new memory is absent from the published Library, search and Atlas

  @smoke
  Scenario: B07 Keep the editing reason outside the document body
    Given I am signed in as Casey the contributor
    And I opened version 1 of a published document in the editor
    When I submit changed Markdown with a separate editing reason
    Then the proposal targets the version that I originally read
    And the before side of the diff comes from the persisted version 1
    And the editing reason appears in the proposal discussion
    When Morgan reviews and merges the proposal
    Then the new document body contains exactly the submitted Markdown
    And the editing reason is not appended to the document body

  @smoke
  Scenario: B08 Correct and resubmit the same proposal
    Given Casey has an open proposal
    When Morgan requests changes with a reason
    Then the reason and authenticated reviewer are recorded
    When Casey corrects the proposal and resubmits it
    Then the proposal keeps its ID and gains a new proposal version
    And its status returns to open
    And the reviewer can inspect the updated diff and prior review event
    And checks are recalculated for the new proposal version
    And no published document changes

  @smoke
  Scenario: B09 Approval is not publication and failed checks block merge
    Given Morgan is reviewing open proposal version 1 with a blocking failed check
    When Morgan approves the proposal with expected proposal version 1
    Then the proposal status is approved at proposal version 2
    And its approval records reviewed proposal version 1 and the unchanged content hash
    And the published document, search index and graph remain unchanged
    When Morgan explicitly attempts to merge it with expected proposal version 2
    Then the server rejects publication with a typed governance error
    And no document revision or publication event is added

  @smoke
  Scenario: B10 Publish every file of a valid proposal together
    Given Morgan is reviewing an approved proposal with passing checks
    And it adds one document and updates two existing documents
    When Morgan explicitly merges the proposal
    Then all three changes become visible through persisted reads
    And each affected document has exactly one resulting revision from that merge
    And the proposal is merged with one publication operation
    And Library, navigation, search, relations and history reflect all three changes
    And the history links open the proposal and exact resulting revisions

  @concurrency
  Scenario: B11 Reject a proposal created from an outdated editor base
    Given Casey opened version 1 of a document in one browser context
    And Morgan published version 2 in another context
    When Casey submits the draft still based on version 1
    Then the server returns a version conflict
    And the editor preserves Casey's unsent Markdown
    And the UI identifies the base version and current version
    And no proposal pretending to be based on version 2 is created

  @concurrency @smoke
  Scenario: B12 Prevent a stale proposal from overwriting a newer revision
    Given two approved proposals target version 1 of the same document
    When Morgan merges the first proposal as version 2
    And Taylor attempts to merge the second proposal
    Then the second merge returns a conflict for that document
    And version 2 and its body remain unchanged
    And the second proposal is not marked merged
    And its content remains available for a deliberate correction and new review

  @concurrency
  Scenario: B13 Reject a review performed on an outdated proposal version
    Given Morgan opened proposal version 1 for review
    And Casey submitted proposal version 2 in another context
    When Morgan sends approval for proposal version 1
    Then the server returns a proposal-version conflict
    And proposal version 2 is not approved by that request
    And the UI asks Morgan to review the new diff

  Scenario: B14 Retry creation safely and reject key reuse with another payload
    Given Casey is creating a proposal with an idempotency key
    When the same request is delivered twice with that key
    Then both successful responses identify the same proposal
    And only one proposal-created event is recorded
    When a different payload is sent with that same key
    Then the server returns an idempotency conflict
    And the original proposal remains unchanged

  @concurrency
  Scenario: B15 Concurrent merge attempts publish only once
    Given Morgan and Taylor opened the same approved proposal version
    When both submit merge requests concurrently
    Then exactly one publication operation commits
    And every affected document gains exactly one revision
    And the second caller receives an existing result or a typed conflict
    And no duplicate publication events are recorded

  Scenario: B17 Editing an approved proposal invalidates its approval
    Given Morgan reviewed proposal version 1 and it is now approved at version 2
    When its authorized author changes the folder, type, references and body using expected proposal version 2
    Then the proposal returns to open at proposal version 3 with a new content hash
    And the old approval cannot authorize publication of the new content
    And checks are recalculated and the new diff includes metadata changes
    When Morgan reviews proposal version 3 and approval produces proposal version 4
    And Morgan explicitly merges using expected proposal version 4
    Then its metadata and body are published together
    And the proposal becomes merged at proposal version 5

  Scenario: B21 A merged proposal cannot be edited or reopened
    Given I am signed in as Morgan the maintainer
    And a proposal is already merged
    When I attempt to edit or reopen that proposal through HTTP
    Then the server rejects both operations
    And the proposal, published revision and prior review events remain unchanged
    And the UI offers a new proposal for further corrections

  @storage
  Scenario: B22 Recover a committed merge after its response is lost
    Given Morgan is merging a valid approved proposal with an idempotency key
    And the test harness drops the response only after the server commits
    When the UI reports that the operation outcome is uncertain
    And Morgan retries using the same idempotency key
    Then the persisted original merge result is returned
    And no additional revision or publication event is created
    And the UI shows the confirmed published result

  Scenario Outline: B32 Archive or delete through a reviewed proposal
    Given I am signed in as Morgan the maintainer
    And a public document has an incoming reference and a stored version 1
    When I merge an approved proposal to "<action>" the document
    Then the current document projection is "<projection>"
    And the authorized history retains the exact version 1 content
    And the incoming reference has a deliberate readable state
    And no historical R2 snapshot is physically removed by the operation

    Examples:
      | action  | projection                                      |
      | archive | retained as an archive in Library and the Atlas  |
      | delete  | absent from current Library and the Atlas        |
