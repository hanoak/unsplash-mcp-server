import { z } from 'zod'

/**
 * Thrown when the server is misconfigured (e.g. a missing access key). The
 * message is user-facing guidance — the entry point prints it verbatim to
 * stderr and exits non-zero, rather than dumping a stack trace.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

const EnvSchema = z.object({
  UNSPLASH_ACCESS_KEY: z.string().trim().min(1),
  UNSPLASH_APP_NAME: z.string().trim().min(1).optional(),
})

export interface Config {
  /** Unsplash API access key, sent as `Authorization: Client-ID <key>`. */
  readonly accessKey: string
  /**
   * Registered Unsplash application name, used as the attribution `utm_source`.
   * `undefined` when not provided.
   */
  readonly appName: string | undefined
}

/**
 * Load and validate configuration from the environment. Throws {@link ConfigError}
 * with actionable guidance when required values are missing — a fail-fast at
 * startup instead of a cryptic 401 on the first tool call.
 *
 * Accepts an explicit env map for testability; defaults to `process.env`.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = EnvSchema.safeParse(env)

  if (!result.success) {
    const missingKey = result.error.issues.some((issue) => issue.path[0] === 'UNSPLASH_ACCESS_KEY')
    const lines = ['Invalid configuration for unsplash-mcp-server:']
    for (const issue of result.error.issues) {
      lines.push(`  - ${String(issue.path[0] ?? '(root)')}: ${issue.message}`)
    }
    if (missingKey) {
      lines.push('')
      lines.push('Set UNSPLASH_ACCESS_KEY to your Unsplash API access key.')
      lines.push('Create a free app to get one: https://unsplash.com/developers')
    }
    throw new ConfigError(lines.join('\n'))
  }

  return {
    accessKey: result.data.UNSPLASH_ACCESS_KEY,
    appName: result.data.UNSPLASH_APP_NAME,
  }
}
