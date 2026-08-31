@http
Feature: Read the real persisted vault
  Markdown bodies and authorized projections are served by a local Worker with D1 and R2.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And business reads use the Worker with local D1 and R2

  @smoke
  Scenario: B01 Explore the same three communities through the backend
    Given I browse as a visitor
    When I open the entire persisted Atlas
    Then Orion, Lyra and Cygnus are represented in the persisted graph
    And only real fixture references form cross-community bridges
    When I open the persisted Orion recovery process from the graph
    Then its persisted Markdown and process metadata are displayed
    And the related graph and list alternative can open the same document
    And no successful read was supplied by the browser mock

  @smoke
  Scenario: B03 Read localized Docs without replacing the other language
    Given I browse as a visitor
    When I open English Docs and follow a cookbook reference
    Then the English cookbook is loaded through HTTP
    When I choose Portuguese and open its introductory Docs page
    Then the Portuguese document and URL reflect the chosen language
    When I reload the persisted document
    Then Portuguese remains selected and both translation IDs are preserved
    And no successful read was supplied by the browser mock
