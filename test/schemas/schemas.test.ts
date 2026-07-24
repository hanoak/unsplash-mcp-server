import { describe, expect, it } from 'vitest'

import { parseResponse, SchemaValidationError } from '../../src/schemas/parse.js'
import { PhotoSchema, SearchPhotosResponseSchema } from '../../src/schemas/photo.js'

const photoFixture = {
  id: 'abc123',
  slug: 'a-photo',
  description: null,
  alt_description: 'a cat on a sofa',
  width: 4000,
  height: 3000,
  color: '#0c0c0c',
  blur_hash: 'LKO2?U%2Tw=w',
  likes: 42,
  created_at: '2020-01-01T00:00:00Z',
  urls: {
    raw: 'https://images.unsplash.com/raw',
    full: 'https://images.unsplash.com/full',
    regular: 'https://images.unsplash.com/regular',
    small: 'https://images.unsplash.com/small',
    thumb: 'https://images.unsplash.com/thumb',
  },
  links: {
    html: 'https://unsplash.com/photos/abc123',
    download: 'https://unsplash.com/photos/abc123/download',
    download_location: 'https://api.unsplash.com/photos/abc123/download',
  },
  user: {
    id: 'u1',
    username: 'janedoe',
    name: 'Jane Doe',
    links: { html: 'https://unsplash.com/@janedoe' },
  },
  // A field we do not model — must be tolerated and stripped, not rejected.
  sponsorship: { tagline: 'sponsored' },
}

describe('PhotoSchema', () => {
  it('parses a realistic photo and strips unknown fields', () => {
    const photo = PhotoSchema.parse(photoFixture)
    expect(photo.id).toBe('abc123')
    expect(photo.user?.name).toBe('Jane Doe')
    expect(photo.links?.download_location).toContain('/download')
    expect('sponsorship' in photo).toBe(false)
  })

  it('tolerates null values on nullable fields', () => {
    const photo = PhotoSchema.parse({
      id: 'x',
      description: null,
      alt_description: null,
      color: null,
      blur_hash: null,
    })
    expect(photo.description).toBeNull()
    expect(photo.color).toBeNull()
  })

  it('requires only id (missing optional nested objects are undefined)', () => {
    const photo = PhotoSchema.parse({ id: 'x' })
    expect(photo.urls).toBeUndefined()
    expect(photo.user).toBeUndefined()
    expect(photo.links).toBeUndefined()
  })

  it('rejects a photo without an id', () => {
    expect(() => PhotoSchema.parse({ description: 'no id here' })).toThrow()
  })
})

describe('SearchPhotosResponseSchema', () => {
  it('parses a search response', () => {
    const res = SearchPhotosResponseSchema.parse({
      total: 100,
      total_pages: 10,
      results: [photoFixture],
    })
    expect(res.total).toBe(100)
    expect(res.results).toHaveLength(1)
    expect(res.results[0]!.id).toBe('abc123')
  })

  it('defaults results to an empty array when missing', () => {
    const res = SearchPhotosResponseSchema.parse({ total: 0, total_pages: 0 })
    expect(res.results).toEqual([])
  })
})

describe('parseResponse', () => {
  it('returns validated data on success', () => {
    const photo = parseResponse(PhotoSchema, { id: 'ok' }, 'get photo')
    expect(photo.id).toBe('ok')
  })

  it('throws SchemaValidationError on a genuine shape mismatch', () => {
    expect(() => parseResponse(PhotoSchema, { not: 'a photo' }, 'get photo')).toThrow(
      SchemaValidationError,
    )
  })
})
