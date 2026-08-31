@staging @security
Feature: Validate the authorized shared Lorestra deployment
  Local simulated identity does not prove real hosted authentication or operations.

  Background:
    Given deployment and infrastructure changes have been explicitly authorized
    And staging has isolated configured resources and synthetic test members
    And the build has no development identity or in-memory business adapter

  Scenario: B40 Authenticate through the real provider and protect direct API access
    Given a visitor can read the public vault without signing in
    When an invited maintainer signs in through the configured identity provider
    Then Lorestra creates a protected session with the expected vault capabilities
    And an authorized reviewed proposal can be merged through the shared API
    When direct requests use a forged, expired or wrong-audience assertion
    Then authentication fails before any mutation
    And no role supplied by the browser overrides that result
    And credential values are absent from application logs and test artifacts

  Scenario: B41 Revoke an existing member session and deny the next write
    Given a real authenticated member has an active Lorestra session
    When an authorized operator disables that member
    And the member sends another mutation with the existing session
    Then the shared API denies the operation
    And the UI refreshes its capabilities and removes cached private content
    And signing in again does not bypass the disabled membership
    And public reading remains available under the visitor policy

  Scenario: B42 Share a reviewed memory across independent clients
    Given two authorized users are connected from independent browser sessions on separate machines
    When the first user proposes a memory and an authorized maintainer explicitly reviews and merges it
    And the second user refreshes or focuses the application
    Then the second user can search and open the persisted memory
    And its proposal, author, revision and history agree between both clients
    When the first user signs out and the application is reopened
    Then the memory remains available according to its visibility
    And no browser-local fixture or storage is required to reconstruct it
