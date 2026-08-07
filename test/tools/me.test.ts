import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { describe, expect, it } from 'vitest'

import { connect, fakeFetchDetailed, jsonResponse, parseResult } from '../helpers/mcp.js'

const meFixture = {
  id: 'u1',
  username: 'janedoe',
  name: 'Jane Doe',
  first_name: 'Jane',
  last_name: 'Doe',
  bio: 'hi',
  location: 'NYC',
  links: { html: 'https://unsplash.com/@janedoe' },
  profile_image: { medium: 'https://img/medium.jpg' },
  total_photos: 5,
  total_collections: 2,
  email: 'jane@example.com',
  uploads_remaining: 100,
}

async function call(
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

describe('me domain tools (in-memory MCP integration)', () => {
  it('registers both profile tools', async () => {
    const { fn } = fakeFetchDetailed(() => jsonResponse(meFixture))
    const client = await connect(fn)
    const names = (await client.listTools()).tools.map((t) => t.name)
    expect(names).toEqual(
      expect.arrayContaining(['unsplash_get_my_profile', 'unsplash_update_my_profile']),
    )
  })

  it('unsplash_get_my_profile errors when not logged in', async () => {
    const { res } = await call('unsplash_get_my_profile', {}, () => jsonResponse(meFixture))
    expect(res.isError).toBe(true)
    expect((res.content[0] as { text: string }).text).toContain('login')
  })

  it('unsplash_get_my_profile returns the private profile when logged in', async () => {
    const { res, calls } = await call(
      'unsplash_get_my_profile',
      {},
      () => jsonResponse(meFixture),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as {
      profile: { id: string; email: string; uploads_remaining: number }
    }
    expect(parsed.profile.id).toBe('u1')
    expect(parsed.profile.email).toBe('jane@example.com')
    expect(parsed.profile.uploads_remaining).toBe(100)

    const { url, init } = calls[0]!
    expect(url).toContain('/me')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer user-token-1')
  })

  it('unsplash_update_my_profile errors when not logged in', async () => {
    const { res } = await call('unsplash_update_my_profile', { bio: 'new bio' }, () =>
      jsonResponse(meFixture),
    )
    expect(res.isError).toBe(true)
  })

  it('unsplash_update_my_profile sends a PUT with the given fields and returns the updated profile', async () => {
    const { res, calls } = await call(
      'unsplash_update_my_profile',
      { bio: 'new bio', email: 'new@example.com' },
      () => jsonResponse({ ...meFixture, bio: 'new bio', email: 'new@example.com' }),
      'user-token-1',
    )
    expect(res.isError).toBeFalsy()
    const parsed = parseResult(res) as { profile: { bio: string; email: string } }
    expect(parsed.profile.email).toBe('new@example.com')
    expect(parsed.profile.bio).toBe('new bio')

    const { url, init } = calls[0]!
    expect(url).toContain('/me')
    expect(init.method).toBe('PUT')
    const headers = new Headers(init.headers)
    expect(headers.get('authorization')).toBe('Bearer user-token-1')
    expect(JSON.parse(init.body as string)).toEqual({
      bio: 'new bio',
      email: 'new@example.com',
    })
  })
})
