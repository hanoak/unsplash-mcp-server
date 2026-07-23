import { describe, expect, it } from 'vitest'

import { connect, fakeFetch, jsonResponse } from './helpers/mcp.js'

describe('server instructions', () => {
  it('sends compliance guidance to the client on initialize', async () => {
    const { fn } = fakeFetch(() => jsonResponse({}))
    const client = await connect(fn)
    const instructions = client.getInstructions()
    expect(instructions).toBeDefined()
    // The load-bearing compliance nudges.
    expect(instructions).toContain('attribution')
    expect(instructions).toContain('unsplash_track_download')
    expect(instructions).toContain('do not rehost')
  })
})
