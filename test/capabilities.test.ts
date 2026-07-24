import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse } from './helpers/mcp.js'

// Resources and prompts are static, so a never-called fake fetch is fine.
const noFetch = fakeFetch(() => jsonResponse({})).fn

describe('resources', () => {
  it('exposes and reads the attribution-guide resource', async () => {
    const client = await connect(noFetch)
    const { resources } = await client.listResources()
    expect(resources.some((r) => r.uri === 'unsplash://guides/attribution')).toBe(true)

    const res = await client.readResource({ uri: 'unsplash://guides/attribution' })
    const text = (res.contents[0] as { text: string }).text
    expect(text).toContain('attribution')
    expect(text).toContain('unsplash_track_download')
  })
})

describe('prompts', () => {
  it('templates find_photo from the subject argument', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'find_photo')).toBe(true)

    const got = await client.getPrompt({
      name: 'find_photo',
      arguments: { subject: 'a foggy pine forest', orientation: 'landscape' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('a foggy pine forest')
    expect(text).toContain('landscape orientation')
    expect(text).toContain('unsplash_search_photos')
    expect(text).toContain('unsplash_track_download')
  })

  it('tolerates an empty optional orientation (clients send "" not undefined)', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'find_photo',
      arguments: { subject: 'mountains', orientation: '' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('mountains')
    expect(text).not.toContain('orientation')
  })
})
