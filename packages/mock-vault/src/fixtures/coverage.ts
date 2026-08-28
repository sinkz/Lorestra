/**
 * The mock is a curated, deterministic projection rather than a Markdown
 * parser. These files intentionally remain outside that projection:
 *
 * - the English launch-readiness file is represented by an unmerged proposal;
 * - the remaining files are internal working templates not shipped in the
 *   public hackathon fixture.
 *
 * The coverage test makes this boundary explicit and fails when a new vault
 * file or stale fixture path is introduced without a deliberate decision.
 */
export const intentionallyUnrepresentedVaultPaths = [
  'vault/Docs/en/cookbooks/launch-readiness.md',
  'vault/Engineering/review-checklist.md',
  'vault/Product/experiment-log.md',
  'vault/Team/retrospective-template.md',
] as const
