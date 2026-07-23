import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse, parseResult } from '../helpers/mcp.js'

async function call(name: string, responder: () => Response) {
  const { fn, calls } = fakeFetch(responder)
  const client = await connect(fn)
  const res = (await client.callTool({ name, arguments: {} })) as CallToolResult
  return { res, calls }
}

describe('stats domain tools (in-memory MCP integration)', () => {
  it('registers both stats tools', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['unsplash_total_stats', 'unsplash_month_stats']))
  })

  it('total_stats returns the totals object', async () => {
    const { res, calls } = await call('unsplash_total_stats', () =>
      jsonResponse({ photos: 5000000, downloads: 999, views: 12345, photographers: 300000 }),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { stats: { photos: number; downloads: number } }
    expect(parsed.stats.photos).toBe(5000000)
    expect(parsed.stats.downloads).toBe(999)
    expect(calls[0]).toContain('/stats/total')
  })

  it('month_stats returns the monthly totals object', async () => {
    const { res, calls } = await call('unsplash_month_stats', () =>
      jsonResponse({ downloads: 42, views: 100, new_photos: 7 }),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { stats: { new_photos: number } }
    expect(parsed.stats.new_photos).toBe(7)
    expect(calls[0]).toContain('/stats/month')
  })
})
