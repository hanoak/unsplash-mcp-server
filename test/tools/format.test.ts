import { describe, expect, it } from 'vitest'

import type { Photo } from '../../src/schemas/photo.js'
import { buildAttribution, toCompactPhoto } from '../../src/tools/format.js'

const photo: Photo = {
  id: 'abc123',
  description: null,
  alt_description: 'a cat on a sofa',
  width: 4000,
  height: 3000,
  color: '#0c0c0c',
  blur_hash: 'LKO2?U',
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
    username: 'janedoe',
    name: 'Jane Doe',
    links: { html: 'https://unsplash.com/@janedoe' },
  },
}

describe('buildAttribution', () => {
  it('builds text + UTM-tagged links using the app name', () => {
    const a = buildAttribution(photo, 'my-app')
    expect(a.text).toBe('Photo by Jane Doe on Unsplash')
    expect(a.photographerUrl).toBe(
      'https://unsplash.com/@janedoe?utm_source=my-app&utm_medium=referral',
    )
    expect(a.unsplashUrl).toBe('https://unsplash.com/?utm_source=my-app&utm_medium=referral')
    expect(a.html).toContain('<a href="https://unsplash.com/@janedoe?utm_source=my-app')
    expect(a.html).toContain('<a href="https://unsplash.com/?utm_source=my-app')
  })

  it('falls back to the default UTM source when no app name is set', () => {
    const a = buildAttribution(photo, undefined)
    expect(a.photographerUrl).toContain('utm_source=unsplash_mcp_server')
  })

  it('escapes the photographer name in the HTML variant', () => {
    const evil: Photo = {
      ...photo,
      user: { username: 'x', name: 'A <script> B', links: { html: 'h' } },
    }
    const a = buildAttribution(evil, 'app')
    expect(a.html).toContain('A &lt;script&gt; B')
    expect(a.html).not.toContain('<script>')
  })
})

describe('toCompactPhoto', () => {
  it('projects the fields tools return', () => {
    const c = toCompactPhoto(photo, 'app')
    expect(c.id).toBe('abc123')
    expect(c.description).toBe('a cat on a sofa') // falls back to alt_description
    expect(c.urls.regular).toBe('https://images.unsplash.com/regular')
    expect(c.download_location).toBe('https://api.unsplash.com/photos/abc123/download')
    expect(c.photographer.username).toBe('janedoe')
    expect(c.attribution.text).toBe('Photo by Jane Doe on Unsplash')
  })

  it('degrades gracefully when optional fields are missing', () => {
    const bare: Photo = { id: 'x' }
    const c = toCompactPhoto(bare, undefined)
    expect(c.id).toBe('x')
    expect(c.description).toBeNull()
    expect(c.urls.regular).toBeUndefined()
    expect(c.download_location).toBeUndefined()
    expect(c.attribution.text).toBe('Photo on Unsplash')
  })
})
