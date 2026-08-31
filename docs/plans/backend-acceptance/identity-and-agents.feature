@http
Feature: Use the same authority boundary for people and browser agents
  A client capability is guidance and never a replacement for server authorization.

  Background:
    Given the isolated HTTP environment is ready with the bilingual vault fixture

  @security @smoke
  Scenario Outline: B26 Enforce role permissions on direct HTTP mutations
    Given I use the "<principal>" session
    When I attempt to "<operation>" through a direct HTTP request
    Then the API returns "<result>"
    And a denied operation creates no proposal, revision or publication event

    Examples:
      | principal             | operation                   | result  |
      | anonymous visitor     | create a proposal           | 401     |
      | Riley the reader      | create a proposal           | 403     |
      | Casey the contributor | edit another author's draft | 403     |
      | Casey the contributor | approve a proposal          | 403     |
      | Casey the contributor | merge a proposal            | 403     |
      | Morgan the maintainer | merge a valid reviewed one  | success |

  @security
  Scenario: B27 Expiration and logout do not retain another principal's cache
    Given Casey is viewing internal content and editing a local unsent draft
    When Casey's session expires and a mutation is attempted
    Then the API returns 401 and the UI asks for authentication
    And no success or publication is shown
    When Casey explicitly logs out and the visitor session opens
    Then pending private requests are cancelled
    And private query results and Casey's locally persisted draft are cleared
    And old placeholder content is not displayed to the visitor
    And the revoked session cannot mutate through HTTP

  @security
  Scenario: B28 Reject forged authority and cross-origin mutations
    Given Casey has a valid contributor session
    When a request claims a maintainer role, fake author or passed checks in its payload
    Then the server rejects reserved fields or derives authority from Casey's session
    And Casey does not gain merge permission
    When a cookie-authenticated mutation has an unauthorized Origin or missing required CSRF proof
    Then the mutation is rejected even when its JSON body is otherwise valid
    And no persistent business state changes

  @webmcp-real @smoke
  Scenario: B29 Discover and read persisted knowledge using native WebMCP
    Given a compatible browser has registered the real Lorestra tools
    And Casey is signed in to the HTTP application
    When the browser agent invokes the guide and searches for the Orion recovery process
    And it reads the result through the registered tool
    Then it receives the persisted document ID, locale and base version
    And the guide reports Casey's actual capabilities and effective limits
    And Markdown is marked as untrusted content
    And bounded results expose continuation or explicit truncation
    And the tool's document agrees with the HTTP document shown in the UI

  @webmcp-real
  Scenario: B30 Agent work and human review update the open UI without reload
    Given a compatible browser has registered the real Lorestra tools
    And Casey's browser agent creates a proposal through the registered tool
    When Morgan requests changes through the UI
    And Casey's agent updates and resubmits the same proposal
    Then the current proposal detail reflects the new version without a full reload
    When Morgan reviews and approves that version
    And Morgan's browser agent requests an explicit merge
    Then a human confirmation identifies that proposal ID and version
    When Casey changes the proposal before Morgan confirms
    And Morgan attempts to use the old confirmation
    Then the stale merge confirmation cannot publish the changed proposal
    When Morgan reviews and approves the new proposal version
    And Morgan confirms a new merge for that exact proposal version
    Then the tool returns the real persisted publication result
    And the already open Library, document, graph and history queries update
    And the tool does not claim simulated-local governance

  Scenario: B33 Keep the human workflow available without WebMCP
    Given the browser does not support native WebMCP
    And Morgan is signed in to the HTTP application
    When Morgan searches, reads and reviews a valid proposal
    Then the human workflow remains available without registration errors
    And the UI honestly reports agent-tool availability
    And no fake native registration is created to make the status successful

  @webmcp-real @security
  Scenario: B34 An agent cannot elevate authority from document instructions
    Given a compatible browser has registered the real Lorestra tools
    And Casey reads a document containing instructions to impersonate a maintainer
    When Casey's browser agent attempts an unauthorized merge through the tool
    Then the operation is denied by the same backend policy as HTTP
    And no published content or revision changes
    And the result provides a safe typed error without private data
    And document text has not changed the session principal or capabilities
