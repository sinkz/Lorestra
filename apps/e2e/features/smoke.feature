Feature: Lorestra knowledge workflow
  The public vault stays easy to navigate for people and agents.

  Scenario: Explore the constellation and open a document
    Given I open Lorestra at "/atlas?scope=entire"
    Then the heading "The living map" is visible
    And the knowledge graph has visible nodes
    And the knowledge graph is spread across both axes
    And the knowledge graph exposes separate galaxies
    When I open the graph node "What is Lorestra?"
    Then the heading "What is Lorestra?" is visible
    When I switch from the document to its graph
    Then the URL contains "scope=related"

  Scenario: Navigate the celestial graph with camera controls and a keyboard
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    When I rotate, tilt, and zoom the constellation and reset its view
    And I select the graph node "What is Lorestra?" with the keyboard
    Then the selected graph node offers to open "What is Lorestra?"
    When I open the selected graph node "What is Lorestra?" with the keyboard
    Then the heading "What is Lorestra?" is visible

  Scenario: Pan a zoomed constellation with right drag and both button orders
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    When I pause the celestial animation
    And I zoom the graph for panning
    And I pan the graph using "right"
    And I pan the graph using "left then right"
    And I pan the graph using "right then left"
    And I pan the graph using "Shift and left"
    And I pan the graph using "pan mode"
    And I select the graph node "What is Lorestra?"
    Then the selected graph node offers to open "What is Lorestra?"
    When I open the selected graph node "What is Lorestra?" with the keyboard
    Then the heading "What is Lorestra?" is visible

  Scenario: Pan by keyboard without making toolbar drags move the graph
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    When I pause the celestial animation
    And I pan and reset the graph camera with the keyboard
    And I drag a camera toolbar control without moving the view
    Then the page has no horizontal overflow

  Scenario: Respect reduced motion while keeping the camera keyboard accessible
    Given I prefer reduced motion
    And I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    And automatic graph motion is paused
    When I rotate and reset the graph camera with the keyboard
    Then automatic graph motion is paused
    And the celestial scene remains frozen

  Scenario: Animate celestial bodies and honor pause and resume
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    And celestial bodies visibly animate
    When I pause the celestial animation
    Then the celestial scene remains frozen
    When I resume the celestial animation
    Then celestial bodies visibly animate

  Scenario: Explain camera controls on hover and keyboard focus
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    When I hover the camera control "Zoom in"
    Then the camera tooltip "Zoom in" is visible inside the viewport
    When I focus the camera control "Rotate right"
    Then the camera tooltip "Rotate right" is visible inside the viewport
    When I dismiss the camera tooltip with Escape
    Then the camera tooltip is hidden
    And the camera control "Rotate right" keeps keyboard focus

  Scenario: Read a demo satellite process and its archived predecessor
    Given I open Lorestra at "/atlas?scope=folder&folder=folder.demo.orion.en"
    Then the knowledge graph has visible nodes
    When I select the graph node "Orion: recovery checklist"
    Then the selected graph node offers to open "Orion: recovery checklist"
    When I open the selected graph node "Orion: recovery checklist" with the keyboard
    Then the heading "Orion: recovery checklist" is visible
    And the URL contains "/documents/demo-orion-runbook"
    And the document body contains "Use this example checklist when the returned revision disagrees with the requested revision."
    And the document type is "Process"
    When I return to the previous Atlas view
    Then the URL contains "folder=folder.demo.orion.en"
    And the knowledge graph has visible nodes
    When I select the graph node "Orion: retired cache rule"
    Then the selected graph node offers to open "Orion: retired cache rule"
    When I open the selected graph node "Orion: retired cache rule" with the keyboard
    Then the heading "Orion: retired cache rule" is visible
    And the URL contains "/documents/demo-orion-legacy"
    And the document body contains "Do not apply this rule."
    And the document status "Archived" is readable
    When I follow the document reference "Orion: reliable responses"
    Then the heading "Orion: reliable responses" is visible
    And the URL contains "/documents/demo-orion-overview"

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

  Scenario: Browse proposals as a review queue
    Given I open Lorestra at "/proposals"
    Then the heading "Proposals" is visible
    And the proposal review queue uses rows instead of cards

  Scenario: Keep long Markdown source inside its workspace
    Given I open Lorestra at "/documents/what-is-lorestra?tab=preview"
    Then the heading "What is Lorestra?" is visible
    When I open the Markdown source tab
    Then the Markdown source stays inside the document panel
    And the page has no horizontal overflow

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
    Then history contains "Published Using Lorestra through an approved proposal."
    And history contains "Published as revision 2"

  Scenario: Read bilingual vault documentation
    Given I open Lorestra at "/docs/en"
    Then the heading "Learn Lorestra" is visible
    When I choose the language "Português (Brasil)"
    Then the heading "Aprenda Lorestra" is visible
    And the URL contains "/docs/pt-BR"

  @mobile
  Scenario: Keep a touch pan captured from both the canvas and a memory
    Given I open Lorestra at "/atlas?scope=folder&folder=folder.demo.orion.en"
    Then the knowledge graph has visible nodes
    When I pause the celestial animation
    And I enable touch panning
    And I continuously pan "canvas" by touch through 80 pixels
    And I reset the graph pan
    And I continuously pan "Orion: reliable responses" by touch through 120 pixels
    Then the URL contains "folder=folder.demo.orion.en"

  @mobile
  Scenario: Explore the celestial graph without mobile overflow
    Given I open Lorestra at "/atlas?scope=entire"
    Then the knowledge graph has visible nodes
    And the page has no horizontal overflow
    When I rotate, tilt, and zoom the constellation and reset its view
    Then the page has no horizontal overflow
    When I focus the camera control "Zoom in"
    Then the camera tooltip "Zoom in" is visible inside the viewport
    When I dismiss the camera tooltip with Escape
    Then the camera tooltip is hidden

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
