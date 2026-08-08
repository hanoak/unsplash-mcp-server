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

  it('templates photo_gallery with theme, count, orientation, and color', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'photo_gallery')).toBe(true)

    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: { theme: 'autumn forests', count: '8', orientation: 'landscape', color: 'orange' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('autumn forests')
    expect(text).toContain('per_page: 8')
    expect(text).toContain('orientation: "landscape"')
    expect(text).toContain('color: "orange"')
    expect(text).toContain('unsplash_search_photos')
    expect(text).toContain('unsplash_track_download')
  })

  it('photo_gallery falls back to a default count and ignores invalid orientation/color', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: { theme: 'city skylines', count: '', orientation: 'sideways', color: 'rainbow' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 5')
    expect(text).not.toContain('orientation:')
    expect(text).not.toContain('color:')
  })

  it('photo_gallery clamps an oversized count to the max of 10', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'photo_gallery',
      arguments: { theme: 'oceans', count: '100' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 10')
  })

  it('templates topic_spotlight with topic and count', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'topic_spotlight')).toBe(true)

    const got = await client.getPrompt({
      name: 'topic_spotlight',
      arguments: { topic: 'wallpapers', count: '7' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('"wallpapers"')
    expect(text).toContain('per_page: 7')
    expect(text).toContain('unsplash_get_topic')
    expect(text).toContain('unsplash_topic_photos')
    expect(text).toContain('unsplash_track_download')
  })

  it('topic_spotlight falls back to the default count of 5', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'topic_spotlight',
      arguments: { topic: 'nature', count: '' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 5')
  })

  it('templates photographer_spotlight with username and count', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'photographer_spotlight')).toBe(true)

    const got = await client.getPrompt({
      name: 'photographer_spotlight',
      arguments: { username: 'janedoe', count: '3' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('"janedoe"')
    expect(text).toContain('per_page: 3')
    expect(text).toContain('order_by: "popular"')
    expect(text).toContain('unsplash_get_user')
    expect(text).toContain('unsplash_user_photos')
    expect(text).toContain('unsplash_track_download')
  })

  it('photographer_spotlight falls back to the default count of 5', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'photographer_spotlight',
      arguments: { username: 'janedoe', count: 'nope' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('per_page: 5')
  })

  it('templates platform_pulse with no arguments', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'platform_pulse')).toBe(true)

    const got = await client.getPrompt({ name: 'platform_pulse', arguments: {} })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('unsplash_total_stats')
    expect(text).toContain('unsplash_month_stats')
  })
})
