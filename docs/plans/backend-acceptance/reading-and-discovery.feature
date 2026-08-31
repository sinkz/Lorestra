@http
Feature: Discover the persistent Lorestra vault
  People can navigate the same authorized knowledge through every reading surface.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And business reads use the Worker with local D1 and R2

  @smoke
  Scenario: B01 Explore the same three communities through the backend
    Given I browse as a visitor
    When I open the entire Atlas
    Then Orion, Lyra and Cygnus are represented in the graph
    And only real fixture references form cross-community bridges
    When I open the Orion recovery process from the graph
    Then its persisted Markdown and process metadata are displayed
    And the related graph and list alternative can open the same document
    And no successful read was supplied by the browser mock

  @smoke
  Scenario: B03 Read localized Docs without replacing the other language
    Given I browse as a visitor in English
    When I open Docs and follow a cookbook reference
    Then the English document is loaded through HTTP
    When I choose Portuguese and open Docs
    Then the Portuguese landing document is displayed
    And the URL and document language reflect Portuguese
    When I reload the page
    Then the selected interface language is preserved
    And both translation IDs remain separate persisted documents

  @security @smoke
  Scenario Outline: B04 Keep unauthorized content out of every projection
    Given the fixture has a public published document and a public archive
    And it has a draft and an internal document with unique secret markers
    And another document was "<previous visibility>" in version 1 and is "<current visibility>" in version 2
    And I browse as a visitor
    When I inspect the "<surface>" through the UI and its HTTP response
    Then authorized published and archived content is available where applicable
    And no draft or internal title, body, ID, path or marker is disclosed
    And no count or relationship reveals an unauthorized target
    And version 1 of the visibility-changed document is not disclosed to the visitor
    And a permitted member can still read both of its stored revisions

    Examples:
      | surface                              | previous visibility | current visibility |
      | navigation and Library               | internal            | public             |
      | search                               | internal            | public             |
      | entire and related graph             | internal            | public             |
      | direct revision and old slug alias   | internal            | public             |
      | proposals and proposal diff          | internal            | public             |
      | history and event detail              | internal            | public             |
      | navigation and Library               | public              | internal           |
      | search                               | public              | internal           |
      | entire and related graph             | public              | internal           |
      | direct revision and old slug alias   | public              | internal           |
      | proposals and proposal diff          | public              | internal           |
      | history and event detail              | public              | internal           |

  Scenario: B05 Open a historical deep link without loading the first history page
    Given a public document has versions 1 and 2 with different titles and bodies
    And its version 1 event is not on the first page of history
    When I directly open the link to version 1
    Then the body and metadata of version 1 are displayed together
    And a historical version indicator is visible
    When I follow its proposal link and return to the latest document
    Then version 2 is displayed without changing either stored revision

  Scenario: B16 Preserve identity and references after a rename and move
    Given I am signed in as Morgan the maintainer
    And a document has a stable ID, an old slug and an incoming reference
    When I merge a reviewed proposal changing its title, slug and folder
    Then the stable document ID remains unchanged
    And the document is listed under its new folder
    And the old URL resolves to the same authorized document
    And the incoming reference still opens it
    And the previous revision retains its previous title and location metadata

  @large @smoke
  Scenario: B18 Page and filter review queues without stale selection
    Given the large fixture is loaded
    When I page through Library, Proposals and History
    Then each response respects its requested page size
    And the unchanged fixture produces no duplicate or missing items across pages
    When I change a filter while a later page is selected
    Then pagination restarts for the new filter
    And an incompatible old cursor is not reused
    And the empty state can clear the filter without opening an unrelated document
    And browser Back restores the previous URL-backed filter

  @large
  Scenario: B20 Load directory children only when needed
    Given the large fixture contains nested collapsed folders
    When I open Library
    Then the initial navigation response does not contain the full document corpus
    And collapsed descendants have not been requested
    When I expand a folder and page its children
    Then only that branch requests its children
    When I select a document in that branch
    Then unrelated collapsed branches remain collapsed
    And virtualized rows remain bounded by the viewport and configured overscan
    When I directly open a deeply nested document
    Then its ancestors are resolved without downloading the entire vault

  @large
  Scenario: B31 Explain a bounded graph without losing the requested center
    Given the authorized graph exceeds 200 nodes and 500 edges
    When I open the entire Atlas
    Then the HTTP response respects the graph limits
    And every returned edge has both endpoints in the returned nodes
    And the UI explains that the graph is a bounded view
    When I open a related scope for a document outside the initial view
    Then that document is included as the requested center
    And narrowing the scope does not reveal internal documents to a visitor

  @mobile
  Scenario: B35 Review persisted content on a narrow screen
    Given I am signed in as Morgan the maintainer on a 360 pixel viewport
    When I open a proposal containing a long line and a Markdown table
    Then the page has no horizontal overflow
    And source and diff overflow is contained inside their own panels
    When I open and close the navigation drawer with the keyboard
    Then focus is trapped while open and restored to its trigger on close
    When I open the Atlas and zoom then pan a galaxy into view
    Then graph selection and camera tooltips remain usable
    And reduced motion is respected when requested
