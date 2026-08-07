import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearCredentials,
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from '../../src/auth/store.js'

let tmpDir: string
let env: NodeJS.ProcessEnv

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'unsplash-mcp-store-'))
  env = { XDG_CONFIG_HOME: tmpDir }
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('credentialsPath', () => {
  it('nests under XDG_CONFIG_HOME/unsplash-mcp-server/credentials.json', () => {
    expect(credentialsPath(env)).toBe(path.join(tmpDir, 'unsplash-mcp-server', 'credentials.json'))
  })
})

describe('saveCredentials / loadCredentials / clearCredentials', () => {
  it('round-trips credentials', async () => {
    const creds = { accessToken: 'user-token-1', scope: 'public write_user', createdAt: 1 }

    const filePath = await saveCredentials(creds, env)
    expect(filePath).toBe(credentialsPath(env))

    expect(await loadCredentials(env)).toEqual(creds)

    expect(await clearCredentials(env)).toBe(true)
    expect(await loadCredentials(env)).toBeUndefined()
  })

  // Unix permission bits are meaningless on Windows (chmod only toggles the
  // read-only attribute there), so this assertion is Unix-only.
  it.skipIf(process.platform === 'win32')(
    'writes the dir/file with owner-only permissions',
    async () => {
      const filePath = await saveCredentials(
        { accessToken: 'user-token-1', scope: 'public', createdAt: 1 },
        env,
      )

      const dirStat = await fs.stat(path.dirname(filePath))
      const fileStat = await fs.stat(filePath)
      expect(dirStat.mode & 0o777).toBe(0o700)
      expect(fileStat.mode & 0o777).toBe(0o600)
    },
  )

  it('loadCredentials returns undefined when nothing was ever saved', async () => {
    expect(await loadCredentials(env)).toBeUndefined()
  })

  it('clearCredentials returns false when there was nothing to remove', async () => {
    expect(await clearCredentials(env)).toBe(false)
  })

  it('loadCredentials tolerates a corrupted file instead of throwing', async () => {
    const filePath = credentialsPath(env)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, 'not json')

    expect(await loadCredentials(env)).toBeUndefined()
  })

  it('loadCredentials rejects a file missing required fields', async () => {
    const filePath = credentialsPath(env)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify({ accessToken: '' }))

    expect(await loadCredentials(env)).toBeUndefined()
  })
})
