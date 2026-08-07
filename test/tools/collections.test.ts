import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, fakeFetchDetailed, jsonResponse, parseResult } from '../helpers/mcp.js'

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

async function callWithAuth(
  name: string,
  args: Record<string, unknown>,
  responder: () => Response,
  userToken?: string,
) {
  const { fn, calls } = fakeFetchDetailed(responder)
  const client = await connect(fn, userToken ? { userToken } : {})
  const res = (await client.callTool({ name, arguments: args })) as CallToolResult
  return { res, calls }
}

describe('collections domain tools (in-memory MCP integration)', () => {
  it('registers all nine collection tools', async () => {
    const { fn } = fakeFetch(() => jsonResponse([collectionFixture]))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_list_collections',
        'unsplash_get_collection',
        'unsplash_collection_photos',
        'unsplash_related_collections',
        'unsplash_create_collection',
        'unsplash_update_collection',
        'unsplash_delete_collection',
        'unsplash_add_photo_to_collection',
        'unsplash_remove_photo_from_collection',
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

  it('create_collection errors when not logged in', async () => {
    const { res } = await callWithAuth('unsplash_create_collection', { title: 'Nature' }, () =>
      jsonResponse(collectionFixture, { status: 201 }),
    )
    expect(res.isError).toBe(true)
  })

  it('create_collection posts the given fields and returns the new collection', async () => {
    const { res, calls } = await callWithAuth(
      'unsplash_create_collection',
      { title: 'Nature', private: true },
      () => jsonResponse(collectionFixture, { status: 201 }),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collection: { id: string } }
    expect(parsed.collection.id).toBe('c1')

    const { url, init } = calls[0]!
    expect(url).toContain('/collections')
    expect(init.method).toBe('POST')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer user-token-1')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'Nature', private: true })
  })

  it('update_collection PUTs the body without the id and returns the updated collection', async () => {
    const { res, calls } = await callWithAuth(
      'unsplash_update_collection',
      { id: 'c1', title: 'New Title' },
      () => jsonResponse({ ...collectionFixture, title: 'New Title' }),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collection: { title: string } }
    expect(parsed.collection.title).toBe('New Title')

    const { url, init } = calls[0]!
    expect(url).toContain('/collections/c1')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({ title: 'New Title' })
  })

  it('delete_collection sends a DELETE and confirms deletion despite an empty 204 body', async () => {
    const { res, calls } = await callWithAuth(
      'unsplash_delete_collection',
      { id: 'c1' },
      () => new Response(null, { status: 204 }),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    expect(parseResult(res)).toEqual({ deleted: true, id: 'c1', rate_limit: expect.anything() })

    const { url, init } = calls[0]!
    expect(url).toContain('/collections/c1')
    expect(init.method).toBe('DELETE')
  })

  it('add_photo_to_collection posts photo_id and returns the link', async () => {
    const { res, calls } = await callWithAuth(
      'unsplash_add_photo_to_collection',
      { id: 'c1', photo_id: 'ph1' },
      () =>
        jsonResponse(
          { collection: collectionFixture, photo: photoFixture, created_at: '2024-01-01' },
          { status: 201 },
        ),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collection: { id: string }; photo: { id: string } }
    expect(parsed.collection.id).toBe('c1')
    expect(parsed.photo.id).toBe('ph1')

    const { url, init } = calls[0]!
    expect(url).toContain('/collections/c1/add')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ photo_id: 'ph1' })
  })

  it('remove_photo_from_collection sends photo_id as a query param', async () => {
    const { res, calls } = await callWithAuth(
      'unsplash_remove_photo_from_collection',
      { id: 'c1', photo_id: 'ph1' },
      () => jsonResponse({ collection: collectionFixture, photo: photoFixture }),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { collection: { id: string }; photo: { id: string } }
    expect(parsed.collection.id).toBe('c1')
    expect(parsed.photo.id).toBe('ph1')

    const { url, init } = calls[0]!
    const parsedUrl = new URL(url)
    expect(parsedUrl.pathname).toBe('/collections/c1/remove')
    expect(parsedUrl.searchParams.get('photo_id')).toBe('ph1')
    expect(init.method).toBe('DELETE')
  })
})
