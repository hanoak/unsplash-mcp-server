import { describe, expect, it } from 'vitest'

import { waitForCallback } from '../../src/auth/callback-server.js'
import { OAuthError } from '../../src/auth/oauth.js'

describe('waitForCallback', () => {
  it('resolves with code and state from a successful redirect', async () => {
    let port = 0
    const result = waitForCallback({
      port: 0,
      onListening: (p) => {
        port = p
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const res = await fetch(`http://127.0.0.1:${port}/callback?code=abc123&state=xyz789`)
    expect(res.status).toBe(200)

    await expect(result).resolves.toEqual({ code: 'abc123', state: 'xyz789' })
  })

  it('rejects when Unsplash reports an authorization error', async () => {
    let port = 0
    const result = waitForCallback({
      port: 0,
      onListening: (p) => {
        port = p
      },
    })
    // Attach the rejection assertion before firing the request that causes
    // it, so the promise is never briefly unhandled.
    const assertion = expect(result).rejects.toBeInstanceOf(OAuthError)
    await new Promise((resolve) => setTimeout(resolve, 20))

    await fetch(`http://127.0.0.1:${port}/callback?error=access_denied`)

    await assertion
  })

  it('rejects when the callback is missing code or state', async () => {
    let port = 0
    const result = waitForCallback({
      port: 0,
      onListening: (p) => {
        port = p
      },
    })
    const assertion = expect(result).rejects.toBeInstanceOf(OAuthError)
    await new Promise((resolve) => setTimeout(resolve, 20))

    await fetch(`http://127.0.0.1:${port}/callback`)

    await assertion
  })

  it('404s unrelated paths and keeps waiting for the real callback', async () => {
    let port = 0
    const result = waitForCallback({
      port: 0,
      onListening: (p) => {
        port = p
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const miss = await fetch(`http://127.0.0.1:${port}/not-the-callback`)
    expect(miss.status).toBe(404)

    const hit = await fetch(`http://127.0.0.1:${port}/callback?code=abc&state=xyz`)
    expect(hit.status).toBe(200)
    await expect(result).resolves.toEqual({ code: 'abc', state: 'xyz' })
  })

  it('rejects after the timeout elapses with no callback', async () => {
    const result = waitForCallback({ port: 0, timeoutMs: 20 })
    await expect(result).rejects.toBeInstanceOf(OAuthError)
  })
})
