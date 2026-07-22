import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { logger } from './lib/logger.js'

/** Package name used to identify the server to MCP clients. */
export const SERVER_NAME = 'unsplash-mcp-server'
/** Kept in sync with package.json at release time. */
export const SERVER_VERSION = '0.0.0'

/**
 * Build the MCP server instance. Tools/resources are registered here in later
 * steps; for now this returns a bare, connectable server so we have a green,
 * runnable baseline.
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  })

  // TODO: register Unsplash tools (search, get photo, random, download tracking…).

  return server
}

/** Create the server, wire the stdio transport, and install shutdown handlers. */
export async function runServer(): Promise<void> {
  const server = createServer()
  const transport = new StdioServerTransport()

  await server.connect(transport)
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} started on stdio`)

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
