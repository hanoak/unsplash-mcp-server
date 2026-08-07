/**
 * Local persistence for the OAuth user access token obtained by the `login`
 * CLI command. Stored outside the repo/package, in the user's config
 * directory, with owner-only permissions — this is a bearer credential.
 */
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { z } from 'zod'

import { logger } from '../lib/logger.js'

const DIR_MODE = 0o700
const FILE_MODE = 0o600

const StoredCredentialsSchema = z.object({
  accessToken: z.string().trim().min(1),
  scope: z.string(),
  createdAt: z.number(),
})

export type StoredCredentials = z.infer<typeof StoredCredentialsSchema>

function configDir(env: NodeJS.ProcessEnv): string {
  const xdg = env.XDG_CONFIG_HOME?.trim()
  const base = xdg ? xdg : path.join(os.homedir(), '.config')
  return path.join(base, 'unsplash-mcp-server')
}

/** Path to the credentials file. Respects `XDG_CONFIG_HOME`; accepts an explicit env map for testability. */
export function credentialsPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(configDir(env), 'credentials.json')
}

/** Write credentials to disk (dir `0700` / file `0600`), returning the path written. */
export async function saveCredentials(
  credentials: StoredCredentials,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  const filePath = credentialsPath(env)
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: DIR_MODE })
  await fs.writeFile(filePath, JSON.stringify(credentials, null, 2), { mode: FILE_MODE })
  // Explicit chmod: mkdir's `mode` doesn't apply if the dir already existed,
  // and writeFile's `mode` only takes effect when it creates the file.
  await fs.chmod(path.dirname(filePath), DIR_MODE)
  await fs.chmod(filePath, FILE_MODE)
  return filePath
}

/**
 * Read stored credentials, or `undefined` if never logged in. A present but
 * corrupted/unreadable file is treated the same as "not logged in" (a warning
 * is logged) rather than crashing server startup over a local file problem.
 */
export async function loadCredentials(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StoredCredentials | undefined> {
  const filePath = credentialsPath(env)
  let raw: string
  try {
    raw = await fs.readFile(filePath, 'utf8')
  } catch (error) {
    if (isEnoent(error)) return undefined
    logger.warn(`could not read ${filePath}: ${(error as Error).message}`)
    return undefined
  }

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    logger.warn(`ignoring malformed credentials at ${filePath}; run "login" again`)
    return undefined
  }

  const result = StoredCredentialsSchema.safeParse(json)
  if (!result.success) {
    logger.warn(`ignoring malformed credentials at ${filePath}; run "login" again`)
    return undefined
  }
  return result.data
}

/** Delete stored credentials. Returns `true` if a file was removed, `false` if there was none. */
export async function clearCredentials(env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  try {
    await fs.unlink(credentialsPath(env))
    return true
  } catch (error) {
    if (isEnoent(error)) return false
    throw error
  }
}

function isEnoent(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
