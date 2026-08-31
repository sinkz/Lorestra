import { z } from 'zod'

import { IdSchema, IsoDateTimeSchema } from './common.js'

export const MemberRoleSchema = z.enum(['reader', 'contributor', 'maintainer'])
export type MemberRole = z.infer<typeof MemberRoleSchema>

export const PrincipalSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1).max(120),
  role: MemberRoleSchema,
})
export type Principal = z.infer<typeof PrincipalSchema>

export const SessionCapabilitiesSchema = z.object({
  readPublic: z.boolean(),
  readInternal: z.boolean(),
  readProposals: z.boolean(),
  createProposal: z.boolean(),
  editOwnProposal: z.boolean(),
  editAnyProposal: z.boolean(),
  reviewProposal: z.boolean(),
  mergeProposal: z.boolean(),
  manageVault: z.boolean(),
})
export type SessionCapabilities = z.infer<typeof SessionCapabilitiesSchema>

export const EffectiveLimitsSchema = z.object({
  maxDocumentBytes: z.number().int().positive(),
  maxProposalBytes: z.number().int().positive(),
  maxFilesPerProposal: z.number().int().positive().max(200),
  maxOpenProposals: z.number().int().positive(),
  maxRequestsPerMinute: z.number().int().positive(),
  maxWritesPerMinute: z.number().int().positive(),
})
export type EffectiveLimits = z.infer<typeof EffectiveLimitsSchema>

export const SessionResponseSchema = z.object({
  vaultId: IdSchema,
  principal: PrincipalSchema.nullable(),
  capabilities: SessionCapabilitiesSchema,
  mode: z.enum(['local', 'shared', 'mock']),
  csrfToken: z.string().min(1).max(512).nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  limits: EffectiveLimitsSchema,
  readOnly: z.object({ enabled: z.boolean(), reason: z.string().max(500).nullable() }),
})
export type SessionResponse = z.infer<typeof SessionResponseSchema>

/** Local-only token exchange; no caller-supplied identity or role is accepted. */
export const LocalSessionInputSchema = z
  .object({ token: z.string().min(1).max(4096) })
  .strict()
export type LocalSessionInput = z.infer<typeof LocalSessionInputSchema>
