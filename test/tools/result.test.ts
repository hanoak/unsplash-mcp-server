import { describe, expect, it } from 'vitest'

import { SchemaValidationError } from '../../src/schemas/parse.js'
import { toJsonResult, toTextResult, toToolError } from '../../src/tools/result.js'
import { UnsplashApiError } from '../../src/unsplash/errors.js'

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
