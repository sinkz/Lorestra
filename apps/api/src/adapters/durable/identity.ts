import {
  PrincipalSchema,
  SessionResponseSchema,
  NavigationResponseSchema,
  type Principal,
  type SessionCapabilities,
} from '@lorestra/contracts'
import { ApiError } from '../../app/errors.js'
import { randomToken, sha256, type StorageBindings } from './primitives.js'

export const DEFAULT_LIMITS = {
  maxDocumentBytes: 65_536,
  maxProposalBytes: 262_144,
  maxFilesPerProposal: 20,
  maxOpenProposals: 100,
  maxRequestsPerMinute: 240,
  maxWritesPerMinute: 60,
}

export type Identity = {
  principal: Principal | null
  tokenHash: string | null
  csrfToken: string | null
  expiresAt: string | null
}

function capabilities(principal: Principal | null): SessionCapabilities {
  const member = principal !== null
  const contributor =
    principal?.role === 'contributor' || principal?.role === 'maintainer'
  const maintainer = principal?.role === 'maintainer'
  return {
    readPublic: true,
    readInternal: member,
    readProposals: member,
    createProposal: contributor,
    editOwnProposal: contributor,
    editAnyProposal: maintainer,
    reviewProposal: maintainer,
    mergeProposal: maintainer,
    manageVault: maintainer,
  }
}

/** Operator/harness entry point, never exposed as a principal-selection HTTP route. */
export async function createLocalSession(
  env: StorageBindings,
  input: Principal,
  expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
) {
  const principal = PrincipalSchema.parse(input)
  const token = randomToken()
  const tokenHash = await sha256(token)
  const csrfToken = await sha256(`csrf:${token}`)
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO members(id,name,role,active) VALUES(?,?,?,1) ON CONFLICT(id) DO NOTHING',
    ).bind(principal.id, principal.name, principal.role),
    env.DB.prepare(
      'INSERT INTO sessions(token_hash,principal_id,csrf_hash,expires_at) VALUES(?,?,?,?)',
    ).bind(tokenHash, principal.id, await sha256(csrfToken), Date.parse(expiresAt)),
  ])
  return { token, csrfToken, expiresAt }
}

export async function identityFromToken(
  env: StorageBindings,
  token: string | undefined,
): Promise<Identity> {
  const visitor: Identity = {
    principal: null,
    tokenHash: null,
    csrfToken: null,
    expiresAt: null,
  }
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return visitor
  const tokenHash = await sha256(token)
  const row = await env.DB.prepare(
    `SELECT m.id,m.name,m.role,s.expires_at FROM sessions s
    JOIN members m ON m.id=s.principal_id WHERE s.token_hash=? AND s.expires_at>? AND m.active=1`,
  )
    .bind(tokenHash, Date.now())
    .first<{ id: string; name: string; role: string; expires_at: number }>()
  if (!row) return visitor
  return {
    principal: PrincipalSchema.parse(row),
    tokenHash,
    csrfToken: await sha256(`csrf:${token}`),
    expiresAt: new Date(row.expires_at).toISOString(),
  }
}

export async function readIdentity(
  env: StorageBindings,
  request: Request,
): Promise<Identity> {
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith('lorestra_session='))
    ?.slice('lorestra_session='.length)
  return identityFromToken(env, token)
}

export async function runtimeSettings(env: StorageBindings) {
  const rows = await env.DB.prepare(
    "SELECT key,value FROM vault_settings WHERE key IN ('vault','limits','read_only','read_only_reason','seed_id')",
  ).all<{ key: string; value: string }>()
  const settings = Object.fromEntries(rows.results.map((row) => [row.key, row.value]))
  const limits = SessionResponseSchema.shape.limits.parse(
    settings.limits
      ? { ...DEFAULT_LIMITS, ...JSON.parse(settings.limits) }
      : DEFAULT_LIMITS,
  )
  if (
    limits.maxDocumentBytes > DEFAULT_LIMITS.maxDocumentBytes ||
    limits.maxProposalBytes > DEFAULT_LIMITS.maxProposalBytes ||
    limits.maxFilesPerProposal > DEFAULT_LIMITS.maxFilesPerProposal
  ) {
    throw new ApiError(
      'service_unavailable',
      'Configured limits exceed the supported storage ceilings.',
      503,
    )
  }
  return {
    limits,
    readOnly: {
      enabled: settings.read_only === 'true',
      reason: settings.read_only_reason ?? null,
    },
    vault: NavigationResponseSchema.shape.vault.parse(
      settings.vault
        ? JSON.parse(settings.vault)
        : { id: 'lorestra', name: 'Lorestra Vault', branch: 'main' },
    ),
    seedId: settings.seed_id ?? null,
  }
}

export async function sessionResponse(
  env: StorageBindings,
  identity: Identity,
  mode: 'local' | 'shared',
) {
  const settings = await runtimeSettings(env)
  return SessionResponseSchema.parse({
    vaultId: settings.vault.id,
    principal: identity.principal,
    capabilities: capabilities(identity.principal),
    mode,
    csrfToken: identity.csrfToken,
    expiresAt: identity.expiresAt,
    limits: settings.limits,
    readOnly: settings.readOnly,
  })
}

export async function requireMutation(
  env: StorageBindings,
  identity: Identity,
  request: Request,
  allowedOrigin: string,
  allowReadOnly = false,
) {
  if (!identity.principal)
    throw new ApiError('unauthorized', 'Sign in before changing the vault.', 401)
  if (request.headers.get('origin') !== allowedOrigin)
    throw new ApiError('forbidden', 'The request origin is not allowed.', 403)
  const supplied = request.headers.get('x-csrf-token') ?? ''
  const [givenHash, expectedHash] = await Promise.all([
    sha256(supplied),
    sha256(identity.csrfToken ?? ''),
  ])
  // Compare fixed-size digests, never a variable-length attacker-controlled token.
  let difference = 0
  for (let index = 0; index < givenHash.length; index++)
    difference |= givenHash.charCodeAt(index) ^ expectedHash.charCodeAt(index)
  if (difference !== 0) {
    throw new ApiError(
      'forbidden',
      'Refresh the session before retrying this request.',
      403,
    )
  }
  const settings = await runtimeSettings(env)
  if (settings.readOnly.enabled && !allowReadOnly)
    throw new ApiError(
      'service_unavailable',
      settings.readOnly.reason ?? 'The vault is temporarily read-only.',
      503,
    )
  return settings
}
