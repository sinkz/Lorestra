@http
Feature: Preserve knowledge through retries failures and maintenance
  Recovery is part of a functional backend rather than an untested deployment promise.

  @storage
  Scenario: B02 Import the seed repeatedly without overwriting live work
    Given an empty isolated local D1 database and R2 bucket
    When the versioned bilingual seed is imported twice
    Then document, folder and revision identities are unchanged by the second import
    And no duplicate proposals or history events are created
    When a seeded document is changed through a reviewed merge
    And the same seed is imported again
    Then the newer revision remains official
    And the importer reports any incompatible seeded content without overwriting it

  Scenario: B19 Recover from transport failure without silent mock fallback
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And Casey is editing an unsent proposal
    When the API becomes unreachable
    And Casey attempts to submit the proposal
    Then the UI shows a recoverable connectivity error
    And the draft remains available to Casey in that session
    And no mock proposal or false success is produced
    When connectivity returns
    Then submission requires a deliberate retry
    And a delayed older search response cannot replace a newer query result

  @storage
  Scenario Outline: B23 A failed multi-file merge never partially publishes
    Given the isolated HTTP environment has an approved three-file proposal
    And all three current revisions and publication event counts are recorded
    And the harness will fail at "<failure>" for this operation
    When Morgan explicitly merges the proposal
    Then the operation fails with a recoverable typed error
    And all three current revisions remain unchanged
    And no published links, search entries or history events from the merge appear
    And the proposal is not marked merged
    And any prepared R2 objects remain private and unreferenced by published data

    Examples:
      | failure                                          |
      | the second prepared R2 object                    |
      | a final-file precondition inside the D1 batch     |
      | the last publication statement in the D1 batch    |

  @storage @smoke
  Scenario: B24 Restart the backend and read the published result from another context
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And Morgan has merged a proposal into document version 2
    And its revision ID, body and history event are recorded
    When the harness restarts its Worker without resetting D1 or R2
    And a fresh independent browser context opens the document and history
    Then version 2 has the same revision ID and body
    And the proposal remains merged with the same history event
    And the result does not depend on the first browser's storage

  @storage
  Scenario: B25 Restore a complete backup into an empty environment
    Given the isolated source environment contains published revisions and open proposals
    When its authorized backup procedure freezes writes and exports a consistent manifest
    And the backup is restored into a separate empty D1 database and R2 bucket
    Then current and historical documents match their recorded hashes and metadata
    And proposal versions, references and review events remain navigable
    And the restored environment requires new authenticated sessions
    And no active source database or bucket was overwritten
    When a referenced object is missing or has a mismatched hash
    Then restore verification fails instead of declaring the backup healthy

  @security
  Scenario Outline: B36 Reject excessive work without data loss
    Given the isolated HTTP environment is ready with configured low test limits
    And Casey has a valid contributor session and an unsent proposal
    When Casey submits a request exceeding "<limit>"
    Then the API returns "<status>" with a typed explanation
    And temporary rate limiting includes Retry-After
    And the UI preserves the draft without automatic unbounded retries
    And no partial proposal or published revision is stored

    Examples:
      | limit                       | status |
      | request body bytes          | 413    |
      | configured file count       | 422    |
      | principal request rate      | 429    |
      | shared global write budget  | 429    |

  Scenario: B37 Read-only maintenance denies writes without breaking reading
    Given the isolated HTTP environment is ready with the bilingual vault fixture
    And an authorized operator enables the server-side read-only switch
    When Morgan opens Library and a published document
    Then reading remains available and the maintenance reason is visible
    When Morgan attempts a valid mutation through direct HTTP
    Then the server rejects it with the documented maintenance response
    And the proposal and published vault remain unchanged
    When the operator disables read-only mode
    Then authorized writes can resume without resetting the vault

  @storage @security
  Scenario: B38 Reject invalid imports before publishing seed state
    Given an isolated local environment with a known current vault
    When an import contains duplicate IDs, duplicate locale slugs or a path escaping the vault
    Then the importer rejects the manifest with actionable validation errors
    And the existing published documents and revision pointers remain unchanged
    And no file is read or written outside the validated import destination
    And the runtime never runs a seed automatically on normal startup

  @storage
  Scenario: B39 Export portable Markdown without confusing it with a full backup
    Given the isolated HTTP environment contains bilingual linked documents
    When an authorized operator exports the portable vault
    Then the Markdown, stable IDs, locale, editable metadata and supported links are preserved
    And sessions, credentials and private operational secrets are excluded
    And the export declares that workflow restoration requires the full backup format
    When that portable vault is imported into a new empty environment
    Then its authorized documents and links can be read with the same identities
