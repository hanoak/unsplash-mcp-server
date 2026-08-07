import { login, logout } from './auth/login.js'
import { OAuthError } from './auth/oauth.js'
import { ConfigError } from './config.js'
import { nodeVersionError } from './lib/node-guard.js'
import { runServer } from './server.js'
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js'

/**
 * Entry point for the `unsplash-mcp-server` bin. The tsup build prepends the
 * `#!/usr/bin/env node` shebang so this file is directly executable via npx.
 */

const HELP = `${PACKAGE_NAME} v${PACKAGE_VERSION}
A Model Context Protocol (MCP) server for the Unsplash API.

This is a stdio server, meant to be launched by an MCP client (Claude Desktop,
Cursor, etc.) — not run directly. Configure it in your client and provide an
Unsplash access key via the UNSPLASH_ACCESS_KEY environment variable.

Usage:
  unsplash-mcp-server            Run the MCP server over stdio
  unsplash-mcp-server login      Authorize via Unsplash OAuth (enables the write/me tools)
  unsplash-mcp-server logout     Remove the stored OAuth credentials
  unsplash-mcp-server --version  Print the version and exit
  unsplash-mcp-server --help     Print this help and exit

Environment:
  UNSPLASH_ACCESS_KEY          (required)         your Unsplash API access key
  UNSPLASH_APP_NAME            (recommended)       your registered app name (attribution)
  UNSPLASH_SECRET_KEY          (for "login" only)  your Unsplash app's secret key
  UNSPLASH_OAUTH_REDIRECT_URI  (for "login" only)  override the default
                                                    http://localhost:8734/callback redirect URI
  LOG_LEVEL                    debug | info | warn | error (default: info)

Docs: https://github.com/hanoak/unsplash-mcp-server`

// Last-resort crash guards. A stray throw must go to stderr, never stdout
// (which carries the JSON-RPC stream), and must exit non-zero.
function fatal(prefix: string, error: unknown): never {
  // Configuration/OAuth problems are user-facing: print the guidance verbatim,
  // without the "fatal" framing or a stack trace.
  if (error instanceof ConfigError || error instanceof OAuthError) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`[unsplash-mcp-server] fatal: ${prefix}: ${detail}\n`)
  process.exit(1)
}

function main(): void {
  // Refuse to run on an unsupported Node.js with a clear message instead of a
  // cryptic crash mid-conversation when a newer API is missing.
  const versionError = nodeVersionError()
  if (versionError !== null) {
    process.stderr.write(`${versionError}\n`)
    process.exit(1)
  }

  const args = new Set(process.argv.slice(2))

  if (args.has('--version') || args.has('-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`)
    return
  }
  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(`${HELP}\n`)
    return
  }

  // login/logout are interactive CLI commands, not the stdio server — handle
  // them before the TTY guard below (which exists specifically to stop the
  // server from hanging when launched from an interactive terminal).
  const command = process.argv[2]
  if (command === 'login') {
    login()
      .then(() => process.exit(0))
      .catch((error: unknown) => fatal('login', error))
    return
  }
  if (command === 'logout') {
    logout()
      .then((message) => {
        process.stdout.write(`${message}\n`)
        process.exit(0)
      })
      .catch((error: unknown) => fatal('logout', error))
    return
  }

  // Launched interactively in a terminal? The stdio JSON-RPC loop would just
  // hang waiting for input, so print usage and exit instead of appearing frozen.
  if (process.stdin.isTTY) {
    process.stderr.write(`${HELP}\n`)
    return
  }

  process.on('uncaughtException', (error) => fatal('uncaughtException', error))
  process.on('unhandledRejection', (reason) => fatal('unhandledRejection', reason))
  runServer().catch((error: unknown) => fatal('startup', error))
}

main()
