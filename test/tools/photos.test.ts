import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import type { Config } from '../../src/config.js'
import { createServer } from '../../src/server.js'
import { UnsplashClient } from '../../src/unsplash/client.js'

const config: Config = { accessKey: 'test-key', appName: 'test-app' }

const photoFixture = {
  id: 'rand123',
  alt_description: 'a mountain at dawn',
  color: '#123456',
  blur_hash: 'LKO2',
  width: 6000,
  height: 4000,
  urls: { raw: 'r', full: 'f', regular: 'g', small: 's', thumb: 't' },
  links: {
    html: 'https://unsplash.com/photos/rand123',
    download: 'd',
    download_location: 'https://api.unsplash.com/photos/rand123/download',
  },
  user: { username: 'janedoe', name: 'Jane Doe', links: { html: 'https://unsplash.com/@janedoe' } },
}

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
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

interface RecordedCall {
  readonly url: string
  readonly init: RequestInit
}

/** Like {@link fakeFetch}, but also records method/headers/body — for the update_photo tests. */
function fakeFetchDetailed(responder: () => Response) {
  const calls: RecordedCall[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return responder()
  }) as unknown as typeof fetch
  return { fn, calls }
}

async function connect(
  fetchImpl: typeof fetch,
  options: { userToken?: string } = {},
): Promise<Client> {
  const client = new UnsplashClient(config, { fetch: fetchImpl, sleep: async () => {} })
  const server = createServer({
    client,
    config,
    redact: (s) => s,
    ...(options.userToken ? { userToken: options.userToken } : {}),
  })
  const mcpClient = new Client({ name: 'test', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await mcpClient.connect(clientTransport)
  return mcpClient
}

function firstText(res: CallToolResult): string {
  const content = res.content as Array<{ type: string; text: string }>
  return content[0]!.text
}

describe('unsplash_random_photo (in-memory MCP integration)', () => {
  it('is listed with a valid input schema and read-only annotation', async () => {
    const { fn } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === 'unsplash_random_photo')
    expect(tool).toBeDefined()
    expect(tool?.annotations?.readOnlyHint).toBe(true)
    // Proves the zod v4 shape converted to JSON Schema at runtime.
    expect(tool?.inputSchema?.properties).toHaveProperty('content_filter')
  })

  it('returns a compact photo with attribution on success', async () => {
    const { fn } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_random_photo',
      arguments: {},
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = JSON.parse(firstText(res)) as {
      photo: { id: string; attribution: { text: string } }
    }
    expect(parsed.photo.id).toBe('rand123')
    expect(parsed.photo.attribution.text).toBe('Photo by Jane Doe on Unsplash')
  })

  it('defaults content_filter to high (safety)', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    await client.callTool({ name: 'unsplash_random_photo', arguments: {} })
    expect(calls[0]).toContain('content_filter=high')
  })

  it('returns isError (not a thrown protocol error) when Unsplash rejects the key', async () => {
    const { fn } = fakeFetch(() => jsonResponse({ errors: ['OAuth error'] }, { status: 401 }))
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_random_photo',
      arguments: {},
    })) as CallToolResult
    expect(res.isError).toBe(true)
    expect(firstText(res)).toContain('401')
  })
})

describe('photos domain tools (in-memory MCP integration)', () => {
  it('registers all five photos-domain tools with correct annotations', async () => {
    const { fn } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'unsplash_random_photo',
        'unsplash_list_photos',
        'unsplash_get_photo',
        'unsplash_photo_statistics',
        'unsplash_track_download',
      ]),
    )
    // track_download registers a download event → not read-only.
    expect(tools.find((t) => t.name === 'unsplash_track_download')?.annotations?.readOnlyHint).toBe(
      false,
    )
    expect(tools.find((t) => t.name === 'unsplash_get_photo')?.annotations?.readOnlyHint).toBe(true)
  })

  it('unsplash_list_photos returns compact photos and clamps per_page to 30', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse([photoFixture, { ...photoFixture, id: 'p2' }]),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_list_photos',
      arguments: { per_page: 100 },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = JSON.parse(firstText(res)) as {
      count: number
      per_page: number
      photos: Array<{ id: string }>
    }
    expect(parsed.count).toBe(2)
    expect(parsed.per_page).toBe(30)
    expect(parsed.photos[0]!.id).toBe('rand123')
    expect(calls[0]).toContain('per_page=30')
  })

  it('unsplash_get_photo fetches by id and returns one photo', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_get_photo',
      arguments: { id: 'rand123' },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    expect((JSON.parse(firstText(res)) as { photo: { id: string } }).photo.id).toBe('rand123')
    expect(calls[0]).toContain('/photos/rand123')
  })

  it('unsplash_photo_statistics returns totals and clamps quantity to 30', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({
        id: 'rand123',
        downloads: { total: 100, historical: { change: 5 } },
        views: { total: 5000, historical: {} },
      }),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_photo_statistics',
      arguments: { id: 'rand123', quantity: 90 },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = JSON.parse(firstText(res)) as {
      downloads_total: number
      views_total: number
      period_days: number
    }
    expect(parsed.downloads_total).toBe(100)
    expect(parsed.views_total).toBe(5000)
    expect(parsed.period_days).toBe(30)
    expect(calls[0]).toContain('quantity=30')
  })

  it('unsplash_track_download hits the download_location and returns a url', async () => {
    const { fn, calls } = fakeFetch(() =>
      jsonResponse({ url: 'https://images.unsplash.com/dl.jpg' }),
    )
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_track_download',
      arguments: { download_location: 'https://api.unsplash.com/photos/rand123/download?ixid=abc' },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    const parsed = JSON.parse(firstText(res)) as { tracked: boolean; download_url: string }
    expect(parsed.tracked).toBe(true)
    expect(parsed.download_url).toBe('https://images.unsplash.com/dl.jpg')
    expect(calls[0]).toContain('/photos/rand123/download?ixid=abc')
  })

  it('unsplash_track_download refuses a non-Unsplash host (SSRF guard) without fetching', async () => {
    const { fn, calls } = fakeFetch(() => jsonResponse({ url: 'x' }))
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_track_download',
      arguments: { download_location: 'https://evil.example.com/photos/x/download' },
    })) as CallToolResult
    expect(res.isError).toBe(true)
    expect(firstText(res)).toContain('non-Unsplash')
    expect(calls.length).toBe(0)
  })

  it('unsplash_update_photo errors when not logged in', async () => {
    const { fn } = fakeFetchDetailed(() => jsonResponse(photoFixture))
    const client = await connect(fn)
    const res = (await client.callTool({
      name: 'unsplash_update_photo',
      arguments: { id: 'rand123', description: 'new desc' },
    })) as CallToolResult
    expect(res.isError).toBe(true)
    expect(firstText(res)).toContain('login')
  })

  it('unsplash_update_photo PUTs the body without the id and returns the updated photo', async () => {
    const { fn, calls } = fakeFetchDetailed(() =>
      jsonResponse({ ...photoFixture, alt_description: 'new desc' }),
    )
    const client = await connect(fn, { userToken: 'user-token-1' })
    const res = (await client.callTool({
      name: 'unsplash_update_photo',
      arguments: { id: 'rand123', description: 'new desc', tags: ['sunset'] },
    })) as CallToolResult
    expect(res.isError).toBeFalsy()
    expect((JSON.parse(firstText(res)) as { photo: { id: string } }).photo.id).toBe('rand123')

    const { url, init } = calls[0]!
    expect(url).toContain('/photos/rand123')
    expect(init.method).toBe('PUT')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer user-token-1')
    expect(JSON.parse(init.body as string)).toEqual({
      description: 'new desc',
      tags: ['sunset'],
    })
  })
})
