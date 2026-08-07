import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import type { Config } from '../config.js'
import type { UnsplashClient } from '../unsplash/client.js'
import { registerCollectionTools } from './collections.js'
import { registerMeTools } from './me.js'
import { registerPhotoTools } from './photos.js'
import { registerSearchTools } from './search.js'
import { registerStatsTools } from './stats.js'
import { registerTopicTools } from './topics.js'
import { registerUserTools } from './users.js'

/**
 * Dependencies injected into every tool handler. Built by the composition root
 * (`runServer`) and passed through `createServer`.
 */
export interface ToolContext {
  readonly client: UnsplashClient
  readonly config: Config
  /** Secret redactor bound to the access key (and the user token, once logged in); applied to MCP error output. */
  readonly redact: (input: string) => string
  /** OAuth user access token, present once `login` has been run. Tier-2 (write/`me`) tools require it — see `requireUserToken`. */
  readonly userToken?: string
}

/**
 * Register all Unsplash MCP tools onto the server. Tools are grouped one file
 * per resource domain under `src/tools/`, and each file exposes a registrar
 * (e.g. `registerSearchTools`) that this function calls. Adding a tool means
 * editing its domain file — never `server.ts`.
 */
export function registerTools(server: McpServer, ctx: ToolContext): void {
  registerPhotoTools(server, ctx)
  registerSearchTools(server, ctx)
  registerUserTools(server, ctx)
  registerCollectionTools(server, ctx)
  registerTopicTools(server, ctx)
  registerStatsTools(server, ctx)
  registerMeTools(server, ctx)
}
