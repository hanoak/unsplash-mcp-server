import { describe, expect, it } from 'vitest'

import type { Config } from '../../src/config.js'
import { UnsplashClient } from '../../src/unsplash/client.js'
import { UnsplashApiError } from '../../src/unsplash/errors.js'

const config: Config = { accessKey: 'test-access-key-123', appName: undefined }

const noopSleep = async (): Promise<void> => {}

interface Recorded {
  url: string
  init: RequestInit
}

function fakeFetch(responder: (call: number) => Response | Promise<Response>) {
  const calls: Recorded[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return responder(calls.length - 1)
  }) as unknown as typeof fetch
  return { fn, calls }
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

async function catchError(promise: Promise<unknown>): Promise<UnsplashApiError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof UnsplashApiError) return error
    throw error
  }
  throw new Error('expected the promise to reject')
}

describe('UnsplashClient.get', () => {
  it('sends the required headers and returns parsed data + rate limit', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse(
        { id: 'abc' },
        { headers: { 'x-ratelimit-limit': '50', 'x-ratelimit-remaining': '49' } },
      ),
    )
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const res = await client.get<{ id: string }>('/photos/abc')

    expect(res.data).toEqual({ id: 'abc' })
    expect(res.rateLimit).toEqual({ limit: 50, remaining: 49 })

    const headers = new Headers(calls[0]!.init.headers)
    expect(headers.get('authorization')).toBe('Client-ID test-access-key-123')
    expect(headers.get('accept-version')).toBe('v1')
    expect(headers.get('user-agent')).toContain('unsplash-mcp-server/')
  })

  it('serializes query params and skips undefined values', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse([]))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    await client.get('/search/photos', {
      params: { query: 'cats', page: 1, orientation: undefined },
    })

    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/search/photos')
    expect(url.searchParams.get('query')).toBe('cats')
    expect(url.searchParams.get('page')).toBe('1')
    expect(url.searchParams.has('orientation')).toBe(false)
  })

  it('maps 401 to an auth error', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ errors: ['OAuth error'] }, { status: 401 }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/me'))
    expect(error.kind).toBe('auth')
    expect(error.status).toBe(401)
  })

  it('maps 403 with remaining=0 to a rate_limit error', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({}, { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
    )
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/photos'))
    expect(error.kind).toBe('rate_limit')
    expect(error.status).toBe(403)
    expect(error.rateLimit?.remaining).toBe(0)
  })

  it('maps a non-quota 403 to a forbidden error', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({}, { status: 403, headers: { 'x-ratelimit-remaining': '10' } }),
    )
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/photos'))
    expect(error.kind).toBe('forbidden')
  })

  it('maps 404 to a not_found error', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ errors: ["Couldn't find Photo"] }, { status: 404 }),
    )
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/photos/missing'))
    expect(error.kind).toBe('not_found')
  })

  it('retries a 429 then succeeds', async () => {
    const responses = [
      jsonResponse(
        { errors: ['Rate Limit Exceeded'] },
        { status: 429, headers: { 'retry-after': '0' } },
      ),
      jsonResponse({ ok: true }),
    ]
    const { fn, calls } = fakeFetch((i) => responses[i]!)
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 2 })

    const res = await client.get<{ ok: boolean }>('/x')
    expect(res.data).toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })

  it('honors Retry-After (seconds) on a 429', async () => {
    const delays: number[] = []
    const responses = [
      jsonResponse({}, { status: 429, headers: { 'retry-after': '2' } }),
      jsonResponse({ ok: true }),
    ]
    const { fn } = fakeFetch((i) => responses[i]!)
    const client = new UnsplashClient(config, {
      fetch: fn,
      sleep: async (ms) => {
        delays.push(ms)
      },
      maxRetries: 2,
    })

    await client.get('/x')
    expect(delays[0]).toBe(2000)
  })

  it('exhausts retries on 5xx and throws a server error', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({}, { status: 503 }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 1 })

    const error = await catchError(client.get('/x'))
    expect(error.kind).toBe('server')
    expect(calls.length).toBe(2) // initial attempt + 1 retry
  })

  it('redacts the access key from error messages', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ errors: ['rejected token test-access-key-123'] }, { status: 400 }),
    )
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const error = await catchError(client.get('/x'))
    expect(error.message).not.toContain('test-access-key-123')
    expect(error.message).toContain('[REDACTED]')
  })

  it('maps a timeout to a timeout error', async () => {
    const { fn, calls } = fakeFetch(() => {
      throw Object.assign(new Error('timed out'), { name: 'TimeoutError' })
    })
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 0 })

    const error = await catchError(client.get('/x'))
    expect(error.kind).toBe('timeout')
    expect(calls.length).toBe(1)
  })

  it('retries a network failure then succeeds', async () => {
    let firstCall = true
    const { fn, calls } = fakeFetch(() => {
      if (firstCall) {
        firstCall = false
        throw new TypeError('fetch failed')
      }
      return jsonResponse({ ok: true })
    })
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 2 })

    const res = await client.get<{ ok: boolean }>('/x')
    expect(res.data).toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController()
    controller.abort()
    const { fn, calls } = fakeFetch(() => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    })
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 3 })

    const error = await catchError(client.get('/x', { signal: controller.signal }))
    expect(error.kind).toBe('network')
    expect(calls.length).toBe(1)
  })
})

describe('UnsplashClient mutation methods', () => {
  it('post() sends a JSON body with Content-Type and Client-ID auth by default', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ id: 'coll_1' }, { status: 201 }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const res = await client.post<{ id: string }>('/collections', { title: 'Nature' })

    expect(res.data).toEqual({ id: 'coll_1' })
    const { init } = calls[0]!
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ title: 'Nature' }))
    const headers = new Headers(init.headers)
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('authorization')).toBe('Client-ID test-access-key-123')
  })

  it('put() sends Authorization: Bearer when authToken is provided', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ id: 'me' }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    await client.put('/me', { bio: 'hi' }, { authToken: 'user-token-abc' })

    const headers = new Headers(calls[0]!.init.headers)
    expect(headers.get('authorization')).toBe('Bearer user-token-abc')
  })

  it('delete() tolerates an empty 204 response body', async () => {
    const { fn, calls } = fakeFetch(() => new Response(null, { status: 204 }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    const res = await client.delete('/collections/1', { authToken: 'user-token-abc' })

    expect(res.data).toBeUndefined()
    expect(calls[0]!.init.method).toBe('DELETE')
  })

  it('delete() with query params builds the URL correctly', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ ok: true }))
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep })

    await client.delete('/collections/1/remove', { params: { photo_id: 'abc' } })

    const url = new URL(calls[0]!.url)
    expect(url.pathname).toBe('/collections/1/remove')
    expect(url.searchParams.get('photo_id')).toBe('abc')
  })

  it('retries a mutating request on a 5xx like get() does', async () => {
    const responses = [
      jsonResponse({}, { status: 503 }),
      jsonResponse({ ok: true }, { status: 201 }),
    ]
    const { fn, calls } = fakeFetch((i) => responses[i]!)
    const client = new UnsplashClient(config, { fetch: fn, sleep: noopSleep, maxRetries: 2 })

    const res = await client.post<{ ok: boolean }>('/collections', { title: 'x' })
    expect(res.data).toEqual({ ok: true })
    expect(calls.length).toBe(2)
  })
})
