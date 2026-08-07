/**
 * Unsplash OAuth 2.0 authorization-code flow (the `login` CLI command's
 * pure pieces): building the consent URL and exchanging a callback code for
 * a user access token. Confirmed against
 * https://unsplash.com/documentation/user-authentication-workflow — Unsplash
 * user access tokens do not expire, so there is no refresh-token handling.
 */
import { z } from 'zod'

import { logger } from '../lib/logger.js'
import { createRedactor } from '../lib/redact.js'
import { parseResponse } from '../schemas/parse.js'

const AUTHORIZE_URL = 'https://unsplash.com/oauth/authorize'
const TOKEN_URL = 'https://unsplash.com/oauth/token'

/**
 * Scopes requested for the tier-2 tools this server supports: reading/updating
 * the authenticated user's profile, updating their photos, and managing their
 * collections. `public` is the baseline read scope.
 */
export const OAUTH_SCOPES = [
  'public',
  'read_user',
  'write_user',
  'write_photos',
  'write_collections',
] as const

/** Thrown for any failure specific to the OAuth login flow (not a tool call). */
export class OAuthError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'OAuthError'
  }
}

export interface AuthorizeUrlParams {
  readonly clientId: string
  readonly redirectUri: string
  /** Opaque value echoed back on the callback; verify it to prevent code injection. */
  readonly state: string
}

/** Build the `https://unsplash.com/oauth/authorize` consent-screen URL. */
export function buildAuthorizeUrl({ clientId, redirectUri, state }: AuthorizeUrlParams): string {
  const url = new URL(AUTHORIZE_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', OAUTH_SCOPES.join(' '))
  url.searchParams.set('state', state)
  return url.toString()
}

const TokenResponseSchema = z.object({
  access_token: z.string().trim().min(1),
  scope: z.string(),
  created_at: z.number(),
})

export interface OAuthToken {
  readonly accessToken: string
  readonly scope: string
  readonly createdAt: number
}

export interface ExchangeCodeParams {
  readonly clientId: string
  readonly clientSecret: string
  readonly redirectUri: string
  readonly code: string
  /** Injectable fetch implementation (defaults to the global `fetch`). */
  readonly fetch?: typeof fetch
}

/** Exchange an authorization code for a user access token via `POST /oauth/token`. */
export async function exchangeCodeForToken(params: ExchangeCodeParams): Promise<OAuthToken> {
  const fetchImpl = params.fetch ?? globalThis.fetch
  const redact = createRedactor(params.clientSecret)

  let response: Response
  try {
    response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        redirect_uri: params.redirectUri,
        code: params.code,
        grant_type: 'authorization_code',
      }).toString(),
    })
  } catch (error) {
    throw new OAuthError('Could not reach Unsplash to exchange the authorization code.', {
      cause: error,
    })
  }

  if (!response.ok) {
    const detail = redact(await response.text().catch(() => ''))
    const suffix = detail ? `: ${detail.slice(0, 200)}` : ''
    throw new OAuthError(
      `Unsplash rejected the OAuth token exchange (${response.status})${suffix}.`,
    )
  }

  const json: unknown = await response.json()
  let token: z.infer<typeof TokenResponseSchema>
  try {
    token = parseResponse(TokenResponseSchema, json, 'oauth token exchange')
  } catch (error) {
    throw new OAuthError('Unsplash returned an unexpected token response shape.', { cause: error })
  }
  logger.debug(`oauth token exchange succeeded (scope: ${token.scope})`)

  return { accessToken: token.access_token, scope: token.scope, createdAt: token.created_at }
}
