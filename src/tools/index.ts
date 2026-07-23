import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { Config } from '../config.js'
import type { UnsplashClient } from '../unsplash/client.js'
import { registerPhotoTools } from './photos.js'

/**
 * Dependencies injected into every tool handler. Built by the composition root
 * (`runServer`) and passed through `createServer`.
 */
export interface ToolContext {
  readonly client: UnsplashClient
  readonly config: Config
  /** Secret redactor bound to the access key; applied to MCP error output. */
  readonly redact: (input: string) => string
}

/**
 * Register all Unsplash MCP tools onto the server. Each tool lives in its own
 * file under `src/tools/` and exposes a registrar this function calls, e.g.:
 *
 *   registerSearchPhotos(server, ctx)
 *
 * No tools are implemented yet, so this is currently a no-op — but the seam
 * exists so tools land by adding one file + one call here, never by editing
 * `server.ts`.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  registerPhotoTools(server, ctx)
  // Future domains: registerCollectionTools, registerTopicTools, registerUserTools,
  // registerSearchTools, registerStatsTools.
}
