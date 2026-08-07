/**
 * A one-shot local HTTP server that receives the OAuth redirect from
 * Unsplash's consent screen, extracts `code`/`state` (or `error`), and shuts
 * itself down after handling exactly one request or timing out. Binds only to
 * the loopback address — never reachable off-box.
 */
import * as http from 'node:http'

import { OAuthError } from './oauth.js'

const DEFAULT_TIMEOUT_MS = 5 * 60_000
const DEFAULT_PATH = '/callback'

export interface CallbackResult {
  readonly code: string
  readonly state: string
}

export interface WaitForCallbackOptions {
  /** Port to bind. Pass `0` to let the OS assign a free port (tests only — a real login needs a fixed, pre-registered redirect URI). */
  readonly port: number
  readonly path?: string
  readonly timeoutMs?: number
  /** Fired once bound, with the actual port (useful when `port` is `0`). */
  readonly onListening?: (port: number) => void
}

/** Wait for the single OAuth redirect request, then close the server. */
export function waitForCallback(options: WaitForCallbackOptions): Promise<CallbackResult> {
  const routePath = options.path ?? DEFAULT_PATH
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    let settled = false

    function finish(action: () => void): void {
      if (settled) return
      settled = true
      clearTimeout(timer)
      action()
      server.close()
    }

    const server = http.createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost')
      if (url.pathname !== routePath) {
        res.writeHead(404).end()
        return
      }

      const error = url.searchParams.get('error')
      if (error) {
        respond(res, false, `Authorization was denied (${error}).`)
        finish(() => reject(new OAuthError(`Unsplash authorization was denied: ${error}.`)))
        return
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')
      if (!code || !state) {
        respond(res, false, 'The callback was missing the expected code/state.')
        finish(() =>
          reject(new OAuthError('Unsplash callback was missing the expected code/state.')),
        )
        return
      }

      respond(res, true, 'You can close this tab and return to your terminal.')
      finish(() => resolve({ code, state }))
    })

    const timer = setTimeout(() => {
      finish(() =>
        reject(new OAuthError(`Timed out after ${timeoutMs}ms waiting for the OAuth callback.`)),
      )
    }, timeoutMs)

    server.on('error', (error) => {
      finish(() =>
        reject(new OAuthError('The local callback server failed to start.', { cause: error })),
      )
    })

    server.listen(options.port, '127.0.0.1', () => {
      const address = server.address()
      const boundPort = typeof address === 'object' && address ? address.port : options.port
      options.onListening?.(boundPort)
    })
  })
}

function respond(res: http.ServerResponse, ok: boolean, message: string): void {
  res.writeHead(ok ? 200 : 400, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(
    `<!doctype html><title>unsplash-mcp-server</title>` +
      `<body style="font-family: sans-serif; padding: 2rem;">${ok ? '✅' : '⚠️'} ${escapeHtml(message)}</body>`,
  )
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
