import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { login, logout } from '../../src/auth/login.js'
import { OAuthError } from '../../src/auth/oauth.js'
import { loadCredentials, saveCredentials } from '../../src/auth/store.js'
import { ConfigError } from '../../src/config.js'

let tmpDir: string
let baseEnv: NodeJS.ProcessEnv

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unsplash-mcp-login-'))
  baseEnv = {
    UNSPLASH_ACCESS_KEY: 'client-abc',
    UNSPLASH_SECRET_KEY: 'super-secret-value',
    XDG_CONFIG_HOME: tmpDir,
    UNSPLASH_OAUTH_REDIRECT_URI: 'http://localhost:0/callback',
  }
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

function fakeTokenFetch() {
  return (async () =>
    new Response(
      JSON.stringify({ access_token: 'user-token-1', scope: 'public write_user', created_at: 1 }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    )) as unknown as typeof fetch
}

describe('login', () => {
  it('throws ConfigError when UNSPLASH_ACCESS_KEY is missing', async () => {
    const env = { ...baseEnv }
    delete env.UNSPLASH_ACCESS_KEY
    await expect(login({ env })).rejects.toBeInstanceOf(ConfigError)
  })

  it('throws OAuthError when UNSPLASH_SECRET_KEY is missing', async () => {
    const env = { ...baseEnv }
    delete env.UNSPLASH_SECRET_KEY
    await expect(login({ env })).rejects.toBeInstanceOf(OAuthError)
  })

  it('drives the full flow: opens the browser, awaits the callback, saves the token', async () => {
    const openedUrls: string[] = []
    const lines: string[] = []

    const result = login({
      env: baseEnv,
      write: (line) => lines.push(line),
      fetch: fakeTokenFetch(),
      openBrowser: (url) => openedUrls.push(url),
      onListening: (port) => {
        const authorizeUrl = new URL(openedUrls[0]!)
        const state = authorizeUrl.searchParams.get('state')!
        void fetch(`http://127.0.0.1:${port}/callback?code=auth-code&state=${state}`)
      },
    })

    await result

    expect(openedUrls).toHaveLength(1)
    expect(new URL(openedUrls[0]!).hostname).toBe('unsplash.com')
    expect(lines.join('')).toContain('Logged in. Granted scopes: public write_user')

    const saved = await loadCredentials(baseEnv)
    expect(saved).toEqual({ accessToken: 'user-token-1', scope: 'public write_user', createdAt: 1 })
  })

  it('rejects when the callback state does not match', async () => {
    const result = login({
      env: baseEnv,
      write: () => {},
      fetch: fakeTokenFetch(),
      openBrowser: () => {},
      onListening: (port) => {
        void fetch(`http://127.0.0.1:${port}/callback?code=auth-code&state=wrong-state`)
      },
    })

    await expect(result).rejects.toThrow(/state mismatch/i)
  })
})

describe('logout', () => {
  it('reports nothing to do when never logged in', async () => {
    expect(await logout(baseEnv)).toMatch(/not logged in/i)
  })

  it('removes stored credentials', async () => {
    await saveCredentials({ accessToken: 'x', scope: 'public', createdAt: 1 }, baseEnv)

    expect(await logout(baseEnv)).toMatch(/logged out/i)
    expect(await loadCredentials(baseEnv)).toBeUndefined()
  })
})
