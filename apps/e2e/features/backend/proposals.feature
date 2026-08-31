@http
Feature: Review real durable proposals
  Drafts and review events persist without changing published knowledge until explicit merge.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture

  @smoke
  Scenario: B06 Create a memory through the UI without publishing it
    Given Casey is using the HTTP application
    When Casey submits a new process with explicit metadata and Markdown
    Then the new-file proposal survives reload with Casey as its author
    And the draft is absent from published reads, search and graph

  @smoke
  Scenario: B07 B09 Review an editing reason separately from the published body
    Given Casey is editing a persisted document at version one
    When Casey submits changed Markdown and a separate reason
    Then the proposal preserves the original base and before body
    When Morgan approves the proposal through the UI
    Then approval alone has not changed the published document
    When Morgan confirms the exact proposal merge through the UI
    Then only the submitted Markdown becomes the new revision

  @smoke
  Scenario: B08 Correct and resubmit a proposal after requested changes
    Given Casey has a persisted open proposal
    When Morgan requests changes through the UI
    And Casey corrects and resubmits the same proposal through the UI
    Then the same proposal is open at a newer version with its review history
    And approval alone has not changed the published document

  @smoke @storage
  Scenario: B10 B24 Publish three files and retain them after Worker restart
    Given Morgan has an approved proposal adding one and updating two documents
    When Morgan confirms the exact proposal merge through the UI
    Then all three files have one resulting revision and one publication event
    When the isolated Worker restarts without importing the seed again
    Then the publication and its exact document bodies remain available
    And a fresh browser context reads the restarted publication

  @storage
  Scenario: B32 Archive a document through a reviewed proposal without losing history
    Given Morgan has a reviewed archive proposal for the Orion process
    When Morgan merges the archive proposal through the UI
    Then the document is archived in Library and its prior revision remains readable

  @storage
  Scenario: B32 Delete a document through a reviewed proposal without erasing history
    Given Morgan has a reviewed delete proposal for the Orion process
    When Morgan merges the delete proposal through the UI
    Then the document is absent from current Library and its prior revision remains readable

  @concurrency
  Scenario: B11 Preserve an unsent editor when its original document becomes stale
    Given Casey is editing a persisted document at version one
    And Morgan publishes a newer version in another session
    When Casey submits the still-open stale editor
    Then the UI preserves the Markdown and identifies both conflicting versions

  @concurrency
  Scenario: Refresh a second tab without replacing its unsent editor
    Given Morgan is editing a persisted document at version one in one browser tab
    When Morgan publishes a newer version in a second browser tab
    Then the first tab shows the published version and preserves its unsent Markdown
    When Morgan submits the preserved stale editor
    Then the stale editor still contains its Markdown and identifies both conflicting versions

  @storage
  Scenario: B19 Retry an offline mutation deliberately without losing its draft
    Given Casey is editing a persisted document at version one
    When the API becomes unreachable and Casey submits the unsent editor
    Then the connection error preserves Casey's Markdown draft
    When connectivity returns and Casey deliberately retries the same editor
    Then one open proposal is created from the retained draft

  @concurrency @smoke
  Scenario: B12 Refuse a stale approved proposal without losing its content
    Given two approved proposals target the same original document
    When Morgan publishes the first and Taylor tries to merge the second through the UI
    Then the newer revision remains unchanged and the second proposal remains reviewable
