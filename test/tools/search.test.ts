import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import type { Config } from '../../src/config.js'
import { createServer } from '../../src/server.js'
import { UnsplashClient } from '../../src/unsplash/client.js'

const config: Config = { accessKey: 'test-key', appName: 'test-app' }

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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function fakeFetch(responder: () => Response) {
  const calls: string[] = []
  const fn = (async (input: string | URL | Request) => {
    calls.push(String(input))
    return responder()
  }) as unknown as typeof fetch
  return { fn, calls }
}

async function connect(fetchImpl: typeof fetch): Promise<Client> {
  const client = new UnsplashClient(config, { fetch: fetchImpl, sleep: async () => {} })
  const server = createServer({ client, config, redact: (s) => s })
  const mcpClient = new Client({ name: 'test', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await mcpClient.connect(clientTransport)
  return mcpClient
}

function parseResult(res: CallToolResult): unknown {
  const content = res.content as Array<{ type: string; text: string }>
  return JSON.parse(content[0]!.text)
}

describe('search domain tools (in-memory MCP integration)', () => {
  it('registers all three search tools as read-only', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ results: [] }))
    const client = await connect(fn)
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_search_photos',
        'unsplash_search_collections',
        'unsplash_search_users',
      ]),
    )
    expect(tools.find((t) => t.name === 'unsplash_search_photos')?.annotations?.readOnlyHint).toBe(
      true,
    )
  })

  it('search_photos passes query, defaults content_filter=high, clamps per_page, maps filters', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({ total: 100, total_pages: 10, results: [photoFixture] }),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_search_photos',
      arguments: { query: 'cats', per_page: 50, color: 'blue' },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      total: number
      count: number
      per_page: number
      photos: Array<{ id: string; attribution: { text: string } }>
    }
    expect(parsed.total).toBe(100)
    expect(parsed.count).toBe(1)
    expect(parsed.per_page).toBe(30)
    expect(parsed.photos[0]!.id).toBe('ph1')
    expect(parsed.photos[0]!.attribution.text).toBe('Photo by Jane Doe on Unsplash')
    expect(calls[0]).toContain('query=cats')
    expect(calls[0]).toContain('content_filter=high')
    expect(calls[0]).toContain('per_page=30')
    expect(calls[0]).toContain('color=blue')
  })

  it('search_collections returns compact collections', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ total: 5, total_pages: 1, results: [collectionFixture] }),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_search_collections',
      arguments: { query: 'nature' },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      collections: Array<{
        title: string
        total_photos: number
        cover_photo: { id: string } | null
        curator: { username: string }
      }>
    }
    expect(parsed.collections[0]!.title).toBe('Nature')
    expect(parsed.collections[0]!.total_photos).toBe(42)
    expect(parsed.collections[0]!.cover_photo?.id).toBe('ph1')
    expect(parsed.collections[0]!.curator.username).toBe('janedoe')
  })

  it('search_users returns compact user profiles', async () => {
    const { fn } = fakeFetch(() =>
      jsonResponse({ total: 3, total_pages: 1, results: [userFixture] }),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_search_users',
      arguments: { query: 'jane' },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      users: Array<{ username: string; name: string; profile_image: string; total_photos: number }>
    }
    expect(parsed.users[0]!.username).toBe('janedoe')
    expect(parsed.users[0]!.name).toBe('Jane Doe')
    expect(parsed.users[0]!.profile_image).toBe('m')
    expect(parsed.users[0]!.total_photos).toBe(10)
  })
})
