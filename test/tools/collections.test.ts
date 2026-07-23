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
const collectionFixture = {
  id: 'c1',
  title: 'Nature',
  description: 'wild things',
  total_photos: 42,
  links: { html: 'https://unsplash.com/collections/c1' },
  cover_photo: photoFixture,
  user: {
    id: 'u1',
    username: 'janedoe',
    name: 'Jane Doe',
    links: { html: 'https://unsplash.com/@janedoe' },
  },
}

async function call(name: string, args: Record<string, unknown>, responder: () => Response) {
  const { fn, calls } = fakeFetch(responder)
  const client = await connect(fn)
  const res = (await client.callTool({ name, arguments: args })) as CallToolResult
  return { res, calls }
}

describe('collections domain tools (in-memory MCP integration)', () => {
  it('registers all four public collection tools', async () => {
    const { fn } = fakeFetch(() => jsonResponse([collectionFixture]))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_list_collections',
        'unsplash_get_collection',
        'unsplash_collection_photos',
        'unsplash_related_collections',
      ]),
    )
  })

  it('list_collections returns compact collections (bare array) and clamps per_page', async () => {
    const { res, calls } = await call('unsplash_list_collections', { per_page: 80 }, () =>
      jsonResponse([collectionFixture]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      collections: Array<{
        title: string
        cover_photo: { id: string } | null
        curator: { username: string }
      }>
      per_page: number
    }
    expect(parsed.per_page).toBe(30)
    expect(parsed.collections[0]!.title).toBe('Nature')
    expect(parsed.collections[0]!.cover_photo?.id).toBe('ph1')
    expect(parsed.collections[0]!.curator.username).toBe('janedoe')
    expect(calls[0]).toContain('per_page=30')
  })

  it('get_collection returns one compact collection', async () => {
    const { res, calls } = await call('unsplash_get_collection', { id: 'c1' }, () =>
      jsonResponse(collectionFixture),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collection: { id: string } }
    expect(parsed.collection.id).toBe('c1')
    expect(calls[0]).toContain('/collections/c1')
  })

  it('collection_photos returns compact photos and hits the right path', async () => {
    const { res, calls } = await call('unsplash_collection_photos', { id: 'c1' }, () =>
      jsonResponse([photoFixture]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { photos: Array<{ id: string }> }
    expect(parsed.photos[0]!.id).toBe('ph1')
    expect(calls[0]).toContain('/collections/c1/photos')
  })

  it('related_collections returns compact collections', async () => {
    const { res, calls } = await call('unsplash_related_collections', { id: 'c1' }, () =>
      jsonResponse([{ ...collectionFixture, id: 'c2', title: 'Mountains' }]),
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collections: Array<{ id: string; title: string }> }
    expect(parsed.collections[0]!.id).toBe('c2')
    expect(calls[0]).toContain('/collections/c1/related')
  })
})
