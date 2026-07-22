import { describe, expect, it } from 'vitest'

import { ConfigError, loadConfig } from '../src/config.js'

describe('loadConfig', () => {
  it('returns config for a valid access key', () => {
    const cfg = loadConfig({ UNSPLASH_ACCESS_KEY: 'abc123def456' })
    expect(cfg.accessKey).toBe('abc123def456')
    expect(cfg.appName).toBeUndefined()
  })

  it('captures the optional app name', () => {
    const cfg = loadConfig({ UNSPLASH_ACCESS_KEY: 'abc123def456', UNSPLASH_APP_NAME: 'my-app' })
    expect(cfg.appName).toBe('my-app')
  })

  it('trims surrounding whitespace from values', () => {
    const cfg = loadConfig({
      UNSPLASH_ACCESS_KEY: '  abc123def456  ',
      UNSPLASH_APP_NAME: ' my-app ',
    })
    expect(cfg.accessKey).toBe('abc123def456')
    expect(cfg.appName).toBe('my-app')
  })

  it('ignores unrelated environment variables', () => {
    const cfg = loadConfig({ UNSPLASH_ACCESS_KEY: 'abc123def456', PATH: '/usr/bin', HOME: '/root' })
    expect(cfg).toEqual({ accessKey: 'abc123def456', appName: undefined })
  })

  it('throws ConfigError when the key is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError)
  })

  it('throws ConfigError when the key is blank/whitespace', () => {
    expect(() => loadConfig({ UNSPLASH_ACCESS_KEY: '   ' })).toThrow(ConfigError)
  })

  it('includes actionable guidance in the missing-key message', () => {
    let message = ''
    try {
      loadConfig({})
    } catch (error) {
      message = (error as Error).message
    }
    expect(message).toContain('UNSPLASH_ACCESS_KEY')
    expect(message).toContain('unsplash.com/developers')
  })
})
