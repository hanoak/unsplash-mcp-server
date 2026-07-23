import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { parseResponse } from '../schemas/parse.js'
import { MonthStatsSchema, TotalStatsSchema } from '../schemas/stats.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

/** Register the stats-domain tools onto the server. Neither takes parameters. */
export function registerStatsTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_total_stats',
    {
      title: 'Unsplash Total Stats',
      description:
        'Get Unsplash-wide totals: photos, downloads, views, photographers, and more. Read-only.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async (_args, extra) => {
      try {
        const res = await ctx.client.get('/stats/total', { signal: extra.signal })
        const stats = parseResponse(TotalStatsSchema, res.data, 'total stats')
        return toJsonResult({ stats, rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_month_stats',
    {
      title: 'Unsplash Monthly Stats',
      description:
        'Get Unsplash-wide totals for the past 30 days: new photos, downloads, views, and more. ' +
        'Read-only.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async (_args, extra) => {
      try {
        const res = await ctx.client.get('/stats/month', { signal: extra.signal })
        const stats = parseResponse(MonthStatsSchema, res.data, 'month stats')
        return toJsonResult({ stats, rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
