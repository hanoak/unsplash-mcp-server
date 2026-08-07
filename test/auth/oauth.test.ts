import { describe, expect, it } from 'vitest'

import { buildAuthorizeUrl, exchangeCodeForToken, OAuthError } from '../../src/auth/oauth.js'

describe('buildAuthorizeUrl', () => {
  it('builds the authorize URL with client_id, redirect_uri, scope, and state', () => {
    const url = new URL(
      buildAuthorizeUrl({
        clientId: 'client-abc',
        redirectUri: 'http://localhost:8734/callback',
        state: 'state-123',
      }),
    )

    expect(url.origin + url.pathname).toBe('https://unsplash.com/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe('client-abc')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8734/callback')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('state')).toBe('state-123')
    expect(url.searchParams.get('scope')).toBe(
      'public read_user write_user write_photos write_collections',
    )
  })
})

function fakeFetch(responder: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return responder()
  }) as unknown as typeof fetch
  return { fn, calls }
}

const baseParams = {
  clientId: 'client-abc',
  clientSecret: 'super-secret-value',
  redirectUri: 'http://localhost:8734/callback',
  code: 'auth-code-xyz',
}

describe('exchangeCodeForToken', () => {
  it('posts form-encoded params and returns the parsed token', async () => {
    const { fn, calls } = fakeFetch(
      () =>
        new Response(
          JSON.stringify({
            access_token: 'user-token-1',
            scope: 'public write_user',
            created_at: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    )

    const token = await exchangeCodeForToken({ ...baseParams, fetch: fn })

    expect(token).toEqual({ accessToken: 'user-token-1', scope: 'public write_user', createdAt: 1 })
    const { url, init } = calls[0]!
    expect(url).toBe('https://unsplash.com/oauth/token')
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(init.body as string)
    expect(body.get('client_id')).toBe('client-abc')
    expect(body.get('client_secret')).toBe('super-secret-value')
    expect(body.get('code')).toBe('auth-code-xyz')
    expect(body.get('grant_type')).toBe('authorization_code')
  })

  it('throws a redacted OAuthError on a non-2xx response', async () => {
    const { fn } = fakeFetch(
      () => new Response('client_secret super-secret-value is invalid', { status: 400 }),
    )

    await expect(exchangeCodeForToken({ ...baseParams, fetch: fn })).rejects.toMatchObject({
      name: 'OAuthError',
    })
    try {
      await exchangeCodeForToken({ ...baseParams, fetch: fn })
    } catch (error) {
      expect(error).toBeInstanceOf(OAuthError)
      expect((error as Error).message).not.toContain('super-secret-value')
      expect((error as Error).message).toContain('[REDACTED]')
    }
  })

  it('throws OAuthError when the response shape is unexpected', async () => {
    const { fn } = fakeFetch(() => new Response(JSON.stringify({ nope: true }), { status: 200 }))

    await expect(exchangeCodeForToken({ ...baseParams, fetch: fn })).rejects.toBeInstanceOf(
      OAuthError,
    )
  })

  it('throws OAuthError when the network request fails', async () => {
    const fn = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch

    await expect(exchangeCodeForToken({ ...baseParams, fetch: fn })).rejects.toBeInstanceOf(
      OAuthError,
    )
  })
})
