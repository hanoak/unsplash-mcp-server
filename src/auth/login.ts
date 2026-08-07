/**
 * The `login`/`logout` CLI commands: drive a user through Unsplash's OAuth
 * consent screen via a local loopback callback, then persist the resulting
 * user access token so the tier-2 (write/`me`) tools can use it.
 */
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'

import { loadConfig } from '../config.js'
import { waitForCallback } from './callback-server.js'
import { buildAuthorizeUrl, exchangeCodeForToken, OAuthError } from './oauth.js'
import { clearCredentials, credentialsPath, saveCredentials } from './store.js'

const DEFAULT_PORT = 8734
const DEFAULT_REDIRECT_URI = `http://localhost:${DEFAULT_PORT}/callback`

export interface LoginOptions {
  readonly env?: NodeJS.ProcessEnv
  /** Override how the consent URL is opened (tests inject a no-op). */
  readonly openBrowser?: (url: string) => void
  /** Injectable fetch for the token exchange (tests inject a fake). */
  readonly fetch?: typeof fetch
  /** Write destination for progress messages (tests inject a collector). */
  readonly write?: (line: string) => void
  /** Fired once the local callback server is actually listening (tests only — lets a test using port 0 learn the real port). */
  readonly onListening?: (port: number) => void
}

/** Run one interactive OAuth login and persist the resulting token. */
export async function login(options: LoginOptions = {}): Promise<void> {
  const env = options.env ?? process.env
  const write = options.write ?? ((line) => process.stdout.write(line))

  // Reuses loadConfig's existing UNSPLASH_ACCESS_KEY validation/messaging.
  const clientId = loadConfig(env).accessKey

  const clientSecret = env.UNSPLASH_SECRET_KEY?.trim()
  if (!clientSecret) {
    throw new OAuthError(
      'UNSPLASH_SECRET_KEY is not set. Find the "Secret key" on your app\'s page at ' +
        'https://unsplash.com/oauth/applications, set it, then run "login" again.',
    )
  }

  let redirectUri: URL
  try {
    redirectUri = new URL(env.UNSPLASH_OAUTH_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI)
  } catch (error) {
    throw new OAuthError('UNSPLASH_OAUTH_REDIRECT_URI is not a valid URL.', { cause: error })
  }
  const port = redirectUri.port ? Number(redirectUri.port) : DEFAULT_PORT

  const state = randomUUID()
  const authorizeUrl = buildAuthorizeUrl({
    clientId,
    redirectUri: redirectUri.toString(),
    state,
  })

  const callback = waitForCallback({
    port,
    path: redirectUri.pathname,
    onListening: (boundPort) => {
      write(`Open this URL to authorize unsplash-mcp-server:\n\n  ${authorizeUrl}\n\n`)
      write(
        `Waiting for the browser redirect on ${redirectUri.origin}${redirectUri.pathname} ...\n`,
      )
      ;(options.openBrowser ?? openInBrowser)(authorizeUrl)
      options.onListening?.(boundPort)
    },
  })

  const { code, state: returnedState } = await callback
  if (returnedState !== state) {
    throw new OAuthError('OAuth state mismatch — the callback did not match this login attempt.')
  }

  const token = await exchangeCodeForToken({
    clientId,
    clientSecret,
    redirectUri: redirectUri.toString(),
    code,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  })

  const filePath = await saveCredentials(
    { accessToken: token.accessToken, scope: token.scope, createdAt: token.createdAt },
    env,
  )

  write(`\nLogged in. Granted scopes: ${token.scope}\nSaved to ${filePath}\n`)
}

/** Remove any stored credentials. */
export async function logout(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const removed = await clearCredentials(env)
  return removed ? `Logged out. Removed ${credentialsPath(env)}` : 'Not logged in — nothing to do.'
}

function openInBrowser(url: string): void {
  try {
    const child =
      process.platform === 'darwin'
        ? spawn('open', [url], { stdio: 'ignore' })
        : process.platform === 'win32'
          ? spawn('cmd', ['/c', 'start', '""', url], { stdio: 'ignore' })
          : spawn('xdg-open', [url], { stdio: 'ignore' })
    // Missing launcher binary (e.g. no xdg-open in a headless env) must not
    // crash the flow — the URL is already printed for the user to open by hand.
    child.on('error', () => {})
  } catch {
    // Best-effort only.
  }
}
