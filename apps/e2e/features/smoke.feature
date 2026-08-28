Feature: Lorestra knowledge workflow
  The public vault stays easy to navigate for people and agents.

  Scenario: Explore the constellation and open a document
    Given I open Lorestra at "/atlas?scope=entire"
    Then the heading "The living map" is visible
    And the knowledge graph has visible nodes
    When I open the graph node "What is Lorestra?"
    Then the heading "What is Lorestra?" is visible
    When I switch from the document to its graph
    Then the URL contains "scope=related"

  Scenario: Clear stale library state and create a proposal
    Given I open Lorestra at "/library?q=no-document-can-match"
    Then the heading "All knowledge" is visible
    When I clear the empty library state
    Then the library contains documents
    When I type "architecture" in the library filter
    Then the library filter keeps keyboard focus
    And the library contains documents
    When I start a new memory
    And I close the memory dialog with Escape
    Then the memory dialog is closed
    When I start a new memory
    And I submit a memory titled "Agent-friendly rollback note"
    Then I see the proposal detail for "Agent-friendly rollback note"
    And the open proposal counter is 2
    And the proposal shows a new Markdown file diff

  Scenario: Review a proposal without silently publishing it
    Given I open Lorestra at "/proposals/proposal-docs-reading-loop-002"
    Then the heading "Make the reading loop explicit in the Docs guide" is visible
    And the proposal action "Merge into vault" is visible
    And the proposal shows a Markdown diff

  Scenario: Approval does not publish a proposal with incomplete checks
    Given I open Lorestra at "/proposals/proposal-incident-runbook-001"
    When I open the affected document "vault/Engineering/incident-response.md"
    Then the document body does not contain "Escalation thresholds"
    When I return to the proposal
    And I approve the proposal
    Then the proposal status is "Approved"
    When I merge the proposal into the vault
    Then the proposal shows a governance error
    When I open the affected document "vault/Engineering/incident-response.md"
    Then the document body does not contain "Escalation thresholds"

  Scenario: Approved merge publishes and records a revision
    Given I open Lorestra at "/proposals/proposal-docs-reading-loop-002"
    When I open the affected document "vault/Docs/en/using-lorestra.md"
    Then the document body does not contain "Reader checklist"
    When I return to the proposal
    And I merge the proposal into the vault
    Then the proposal status is "Merged"
    When I open vault history
    Then history contains "creating v2"
    And history contains "Published as revision 2"

  Scenario: Read bilingual vault documentation
    Given I open Lorestra at "/docs/en"
    Then the heading "Learn Lorestra" is visible
    When I choose the language "Português (Brasil)"
    Then the heading "Aprenda Lorestra" is visible
    And the URL contains "/docs/pt-BR"

  @mobile
  Scenario: Collapse directories on a small screen
    Given I open Lorestra at "/library"
    When I open the mobile navigation
    Then the sidebar fits inside the viewport
    And keyboard focus is inside the sidebar
    When I close the mobile navigation with Escape
    Then the mobile navigation is closed and its trigger regains focus
    When I open the mobile navigation
    And I can collapse the "Docs" directory

  @mobile
  Scenario: Review a proposal without mobile overflow
    Given I open Lorestra at "/proposals/proposal-docs-reading-loop-002"
    Then the heading "Make the reading loop explicit in the Docs guide" is visible
    And the proposal action "Merge into vault" is visible
    And the page has no horizontal overflow
