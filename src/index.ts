import { ConfigError } from './config.js'
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
  unsplash-mcp-server --version  Print the version and exit
  unsplash-mcp-server --help     Print this help and exit

Environment:
  UNSPLASH_ACCESS_KEY  (required)    your Unsplash API access key
  UNSPLASH_APP_NAME    (recommended) your registered app name (attribution)
  LOG_LEVEL            debug | info | warn | error (default: info)

Docs: https://github.com/hanoak/unsplash-mcp-server`

// Last-resort crash guards. A stray throw must go to stderr, never stdout
// (which carries the JSON-RPC stream), and must exit non-zero.
function fatal(prefix: string, error: unknown): never {
  // Configuration problems are user-facing: print the guidance verbatim,
  // without the "fatal" framing or a stack trace.
  if (error instanceof ConfigError) {
    process.stderr.write(`${error.message}\n`)
    process.exit(1)
  }
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`[unsplash-mcp-server] fatal: ${prefix}: ${detail}\n`)
  process.exit(1)
}

function main(): void {
  const args = new Set(process.argv.slice(2))

  if (args.has('--version') || args.has('-v')) {
    process.stdout.write(`${PACKAGE_VERSION}\n`)
    return
  }
  if (args.has('--help') || args.has('-h')) {
    process.stdout.write(`${HELP}\n`)
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
