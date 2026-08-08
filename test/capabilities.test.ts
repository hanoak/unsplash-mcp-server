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

  it('exposes and reads the oauth-setup-guide resource', async () => {
    const client = await connect(noFetch)
    const { resources } = await client.listResources()
    expect(resources.some((r) => r.uri === 'unsplash://guides/oauth-setup')).toBe(true)

    const res = await client.readResource({ uri: 'unsplash://guides/oauth-setup' })
    const text = (res.contents[0] as { text: string }).text
    expect(text).toContain('UNSPLASH_SECRET_KEY')
    expect(text).toContain('npx @hanoak/unsplash-mcp-server login')
    expect(text).toContain('do not expire')
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

  it('templates curate_collection creating a new collection when no collection_id is given', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'curate_collection')).toBe(true)

    const got = await client.getPrompt({
      name: 'curate_collection',
      arguments: { theme: 'cozy autumn mornings', count: '4' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('cozy autumn mornings')
    expect(text).toContain('unsplash_search_photos')
    expect(text).toContain('unsplash_create_collection')
    expect(text).toContain('unsplash_add_photo_to_collection')
    expect(text).toContain('up to 4')
    expect(text).toContain('login')
  })

  it('templates curate_collection adding to an existing collection when collection_id is given', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({
      name: 'curate_collection',
      arguments: { theme: 'cozy autumn mornings', collection_id: 'coll_123' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('coll_123')
    expect(text).not.toContain('unsplash_create_collection')
    expect(text).toContain('unsplash_add_photo_to_collection')
    expect(text).toContain('up to 6') // default count
  })

  it('templates describe_photo with description and tags provided', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'describe_photo')).toBe(true)

    const got = await client.getPrompt({
      name: 'describe_photo',
      arguments: { id: 'ph1', description: 'a foggy pine forest', tags: 'forest, fog' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('"ph1"')
    expect(text).toContain('description: "a foggy pine forest"')
    expect(text).toContain('tags: "forest, fog"')
    expect(text).toContain('unsplash_get_photo')
    expect(text).toContain('unsplash_update_photo')
    expect(text).toContain('login')
  })

  it('describe_photo asks the user for values when none are given', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({ name: 'describe_photo', arguments: { id: 'ph1' } })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('Ask the user what new description/tags they want')
  })

  it('templates refresh_profile with bio, location, and url provided', async () => {
    const client = await connect(noFetch)
    const { prompts } = await client.listPrompts()
    expect(prompts.some((p) => p.name === 'refresh_profile')).toBe(true)

    const got = await client.getPrompt({
      name: 'refresh_profile',
      arguments: { bio: 'Landscape photographer', location: 'Kyoto', url: 'https://example.com' },
    })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('bio: "Landscape photographer"')
    expect(text).toContain('location: "Kyoto"')
    expect(text).toContain('url: "https://example.com"')
    expect(text).toContain('unsplash_get_my_profile')
    expect(text).toContain('unsplash_update_my_profile')
    expect(text).toContain('login')
  })

  it('refresh_profile asks the user for values when none are given', async () => {
    const client = await connect(noFetch)
    const got = await client.getPrompt({ name: 'refresh_profile', arguments: {} })
    const text = (got.messages[0]!.content as { type: string; text: string }).text
    expect(text).toContain('Ask the user what they want to change')
  })
})
