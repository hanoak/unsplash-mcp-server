import { describe, expect, it } from 'vitest'

import type { Config } from '../../src/config.js'
import { SchemaValidationError } from '../../src/schemas/parse.js'
import type { ToolContext } from '../../src/tools/index.js'
import {
  requireUserToken,
  toJsonResult,
  toTextResult,
  toToolError,
} from '../../src/tools/result.js'
import { UnsplashClient } from '../../src/unsplash/client.js'
import { UnsplashApiError } from '../../src/unsplash/errors.js'

const config: Config = { accessKey: 'test-key', appName: undefined }
const baseCtx: ToolContext = {
  client: new UnsplashClient(config),
  config,
  redact: (s: string) => s,
}

describe('toTextResult / toJsonResult', () => {
  it('wraps text', () => {
    expect(toTextResult('hi')).toEqual({ content: [{ type: 'text', text: 'hi' }] })
  })

  it('wraps JSON payloads', () => {
    const r = toJsonResult({ a: 1 })
    expect(r.content[0]).toMatchObject({ type: 'text' })
    expect(JSON.parse((r.content[0] as { text: string }).text)).toEqual({ a: 1 })
  })
})

describe('toToolError', () => {
  it('maps UnsplashApiError to an isError result with its message', () => {
    const err = new UnsplashApiError('auth', 'bad key (401)', { status: 401 })
    const r = toToolError(err)
    expect(r.isError).toBe(true)
    expect((r.content[0] as { text: string }).text).toBe('bad key (401)')
  })

  it('maps SchemaValidationError to an isError result', () => {
    const r = toToolError(new SchemaValidationError('random photo'))
    expect(r.isError).toBe(true)
    expect((r.content[0] as { text: string }).text).toContain('Unexpected Unsplash response shape')
  })

  it('maps an unknown error to a generic isError result', () => {
    const r = toToolError(new Error('boom'))
    expect(r.isError).toBe(true)
    expect((r.content[0] as { text: string }).text).toBe('Unexpected error: boom')
  })

  it('applies the redactor to the message', () => {
    const err = new UnsplashApiError('unknown', 'leaked SECRET123 here')
    const r = toToolError(err, (s) => s.split('SECRET123').join('[REDACTED]'))
    expect((r.content[0] as { text: string }).text).toBe('leaked [REDACTED] here')
  })
})

describe('requireUserToken', () => {
  it('returns the token when logged in', () => {
    expect(requireUserToken({ ...baseCtx, userToken: 'user-token-1' })).toBe('user-token-1')
  })

  it('throws an actionable auth error when not logged in', () => {
    expect(() => requireUserToken(baseCtx)).toThrow(UnsplashApiError)
    try {
      requireUserToken(baseCtx)
    } catch (error) {
      expect(error).toBeInstanceOf(UnsplashApiError)
      expect((error as UnsplashApiError).kind).toBe('auth')
      expect((error as UnsplashApiError).message).toContain('login')
    }
  })
})
