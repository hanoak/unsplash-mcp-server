import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadConfig } from './config.js'
import { logger } from './lib/logger.js'
import { createRedactor } from './lib/redact.js'
import { registerTools, type ToolContext } from './tools/index.js'
import { UnsplashClient } from './unsplash/client.js'
import { PACKAGE_NAME, PACKAGE_VERSION } from './version.js'

/** Server identity reported to MCP clients (sourced from the shared version module). */
export const SERVER_NAME = PACKAGE_NAME
export const SERVER_VERSION = PACKAGE_VERSION

/**
 * Build the MCP server and register its tools against the injected context.
 * Pure and dependency-injected — tests pass a fake client via `ctx`.
 */
export function createServer(ctx: ToolContext): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  })

  registerTools(server, ctx)

  return server
}

/**
 * Composition root: fail-fast validate the environment, build the Unsplash
 * client, assemble the server, and wire it to the stdio transport.
 */
export async function runServer(): Promise<void> {
  // Fail fast: validate the environment before opening the transport, so a
  // missing key surfaces as a clear startup message, not a cryptic 401 later.
  const config = loadConfig()

  // Attribution nudge (optional, non-blocking): a generic utm_source is still
  // valid, but Unsplash expects it to match your registered app name.
  if (config.appName === undefined) {
    logger.warn(
      'UNSPLASH_APP_NAME is not set — attribution utm_source defaults to ' +
        '"unsplash_mcp_server". Set it to your registered Unsplash app name for ' +
        'correct attribution (see the README).',
    )
  }

  const client = new UnsplashClient(config)
  const redact = createRedactor(config.accessKey)
  const server = createServer({ client, config, redact })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} started on stdio`)
  logger.debug(`config loaded (app name: ${config.appName ?? 'not set'})`)

  installShutdownHandlers()
}

/**
 * Exit cleanly when the client stops us: by signal, or by closing our stdin
 * (how MCP clients such as Claude Desktop terminate a spawned server). Without
 * this the process lingers as an orphan on every client restart.
 */
function installShutdownHandlers(): void {
  let shuttingDown = false
  const shutdown = (reason: string, code = 0): void => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`shutting down (${reason})`)
    process.exit(code)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.stdin.on('end', () => shutdown('stdin closed'))
  process.stdin.on('close', () => shutdown('stdin closed'))
}
