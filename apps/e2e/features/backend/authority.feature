@http
Feature: Preserve authority and recovery over real HTTP
  Requests use opaque operator-provisioned sessions and the same durable mutation endpoints as the UI.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And Casey has a persisted open proposal

  @security
  Scenario: B26 B28 Deny forged authority and invalid CSRF without business writes
    When unauthorized actors, forged metadata and invalid CSRF attempt mutations
    Then each denial has a typed error and leaves business state unchanged

  @concurrency
  Scenario: B13 B17 B21 Keep reviews bound to the exact proposal version
    When another session resubmits and a stale reviewer tries approval
    Then the stale approval is refused and editing invalidates the later approval
    And a newly reviewed merge cannot be edited or reopened

  @concurrency @storage
  Scenario: B14 B15 B22 Retry operations and concurrently merge only once
    When Casey retries one creation key and later changes its payload
    Then replay returns the same proposal and changed payload conflicts
    When two maintainers concurrently merge that exact approved proposal
    Then only one revision and publication commit and a lost-response retry returns the original result

  @security
  Scenario: B27 Expired authority cannot write and logout clears the private draft
    When Casey saves a private local draft and signs out through the UI
    Then the visitor cannot see that private document or restore the draft
    And the old and expired credentials cannot mutate through HTTP

  @security
  Scenario: B36 B37 Quotas and maintenance protect the vault while preserving drafts
    When a small write budget rejects Casey's UI submission
    Then the typed rate limit preserves the draft without repeated retries
    When the operator enables read-only maintenance
    Then public reading still works and all mutation roles are denied until maintenance ends

  @mobile @smoke
  Scenario: B06 Mobile can create and inspect a real persisted proposal
    Given Casey is using the HTTP application
    When Casey submits a new process with explicit metadata and Markdown
    Then the new-file proposal survives reload with Casey as its author
    And the HTTP proposal view fits the narrow viewport
