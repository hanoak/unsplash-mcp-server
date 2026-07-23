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

async function connect(fetchImpl: typeof fetch): Promise<Client> {
  const client = new UnsplashClient(config, { fetch: fetchImpl, sleep: async () => {} })
  const server = createServer({ client, config, redact: (s) => s })
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
