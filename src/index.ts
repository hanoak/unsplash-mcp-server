import { runServer } from './server.js'

/**
 * Entry point for the `unsplash-mcp-server` bin. The tsup build prepends the
 * `#!/usr/bin/env node` shebang so this file is directly executable via npx.
 */

// Last-resort crash guards. A stray throw must go to stderr, never stdout
// (which carries the JSON-RPC stream), and must exit non-zero.
function fatal(prefix: string, error: unknown): never {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error)
  process.stderr.write(`[unsplash-mcp-server] fatal: ${prefix}: ${detail}\n`)
  process.exit(1)
}

process.on('uncaughtException', (error) => fatal('uncaughtException', error))
process.on('unhandledRejection', (reason) => fatal('unhandledRejection', reason))

runServer().catch((error: unknown) => fatal('startup', error))
