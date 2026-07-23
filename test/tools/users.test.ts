import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse, parseResult } from '../helpers/mcp.js'

const photoFixture = {
  id: 'ph1',
  urls: { regular: 'g', small: 's', full: 'f' },
  links: {
    html: 'https://unsplash.com/photos/ph1',
    download_location: 'https://api.unsplash.com/photos/ph1/download',
  },
  user: { username: 'janedoe', name: 'Jane Doe', links: { html: 'https://unsplash.com/@janedoe' } },
}
const userFixture = {
  id: 'u1',
  username: 'janedoe',
  name: 'Jane Doe',
  bio: 'photographer',
  location: 'NYC',
  total_photos: 10,
  total_collections: 3,
  links: { html: 'https://unsplash.com/@janedoe' },
  profile_image: { small: 's', medium: 'm', large: 'l' },
}
const collectionFixture = {
  id: 'c1',
  title: 'Nature',
  total_photos: 42,
  links: { html: 'https://unsplash.com/collections/c1' },
}

async function call(name: string, args: Record<string, unknown>, responder: () => Response) {
  const { fn, calls } = fakeFetch(responder)
  const client = await connect(fn)
  const res = (await client.callTool({ name, arguments: args })) as CallToolResult
  return { res, calls }
}

describe('users domain tools (in-memory MCP integration)', () => {
  it('registers all four user tools as read-only', async () => {
    const { fn } = fakeFetch(() => jsonResponse(userFixture))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_get_user',
        'unsplash_user_photos',
        'unsplash_user_collections',
        'unsplash_user_statistics',
      ]),
    )
  })

  it('get_user returns a compact profile and encodes the username in the path', async () => {
    const { res, calls } = await call('unsplash_get_user', { username: 'jane doe' }, () =>
      jsonResponse(userFixture),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { user: { username: string; profile_image: string } }
    expect(parsed.user.username).toBe('janedoe')
    expect(parsed.user.profile_image).toBe('m')
    expect(calls[0]).toContain('/users/jane%20doe')
  })

  it('user_photos returns compact photos (bare array) and clamps per_page', async () => {
    const { res, calls } = await call(
      'unsplash_user_photos',
      { username: 'janedoe', per_page: 99 },
      () => jsonResponse([photoFixture, { ...photoFixture, id: 'ph2' }]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { count: number; per_page: number }
    expect(parsed.count).toBe(2)
    expect(parsed.per_page).toBe(30)
    expect(calls[0]).toContain('/users/janedoe/photos')
    expect(calls[0]).toContain('per_page=30')
  })

  it('user_collections returns compact collections', async () => {
    const { res } = await call('unsplash_user_collections', { username: 'janedoe' }, () =>
      jsonResponse([collectionFixture]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collections: Array<{ title: string }> }
    expect(parsed.collections[0]!.title).toBe('Nature')
  })

  it('user_statistics returns totals and clamps quantity', async () => {
    const { res, calls } = await call(
      'unsplash_user_statistics',
      { username: 'janedoe', quantity: 90 },
      () =>
        jsonResponse({ username: 'janedoe', downloads: { total: 500 }, views: { total: 9000 } }),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      downloads_total: number
      views_total: number
      period_days: number
    }
    expect(parsed.downloads_total).toBe(500)
    expect(parsed.views_total).toBe(9000)
    expect(parsed.period_days).toBe(30)
    expect(calls[0]).toContain('quantity=30')
  })
})
