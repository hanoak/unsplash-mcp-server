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
const topicFixture = {
  id: 't1',
  slug: 'nature',
  title: 'Nature',
  description: 'the great outdoors',
  total_photos: 1000,
  status: 'open',
  links: { html: 'https://unsplash.com/t/nature' },
  cover_photo: photoFixture,
  owners: [
    {
      id: 'u1',
      username: 'janedoe',
      name: 'Jane Doe',
      links: { html: 'https://unsplash.com/@janedoe' },
    },
  ],
}

async function call(name: string, args: Record<string, unknown>, responder: () => Response) {
  const { fn, calls } = fakeFetch(responder)
  const client = await connect(fn)
  const res = (await client.callTool({ name, arguments: args })) as CallToolResult
  return { res, calls }
}

describe('topics domain tools (in-memory MCP integration)', () => {
  it('registers all three topic tools', async () => {
    const { fn } = fakeFetch(() => jsonResponse([topicFixture]))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_list_topics',
        'unsplash_get_topic',
        'unsplash_topic_photos',
      ]),
    )
  })

  it('list_topics returns compact topics (bare array) and clamps per_page', async () => {
    const { res, calls } = await call('unsplash_list_topics', { per_page: 77 }, () =>
      jsonResponse([topicFixture]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      topics: Array<{
        title: string
        cover_photo: { id: string } | null
        owners: Array<{ username: string }>
      }>
      per_page: number
    }
    expect(parsed.per_page).toBe(30)
    expect(parsed.topics[0]!.title).toBe('Nature')
    expect(parsed.topics[0]!.cover_photo?.id).toBe('ph1')
    expect(parsed.topics[0]!.owners[0]!.username).toBe('janedoe')
    expect(calls[0]).toContain('per_page=30')
  })

  it('get_topic fetches by id/slug and returns a compact topic', async () => {
    const { res, calls } = await call('unsplash_get_topic', { id: 'nature' }, () =>
      jsonResponse(topicFixture),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { topic: { id: string; slug: string } }
    expect(parsed.topic.slug).toBe('nature')
    expect(calls[0]).toContain('/topics/nature')
  })

  it('topic_photos returns compact photos and hits the right path', async () => {
    const { res, calls } = await call('unsplash_topic_photos', { id: 'nature' }, () =>
      jsonResponse([photoFixture]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { photos: Array<{ id: string }> }
    expect(parsed.photos[0]!.id).toBe('ph1')
    expect(calls[0]).toContain('/topics/nature/photos')
  })
})
