import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

import { SchemaValidationError } from '../schemas/parse.js'
import { UnsplashApiError } from '../unsplash/errors.js'
import type { ToolContext } from './index.js'

type Redactor = (input: string) => string
const noRedact: Redactor = (input) => input

/**
 * Guard for the tier-2 (write/`me`) tools: returns the stored OAuth user
 * token, or throws a clear, actionable error if the user hasn't logged in.
 * Single source of truth so every write tool reports the same guidance.
 */
export function requireUserToken(ctx: ToolContext): string {
  if (!ctx.userToken) {
    throw new UnsplashApiError(
      'auth',
      'This tool needs Unsplash OAuth sign-in. Run `npx @hanoak/unsplash-mcp-server login` ' +
        'in a terminal (not through this MCP client), then restart this MCP server.',
    )
  }
  return ctx.userToken
}

/** Wrap plain text as a successful tool result. */
export function toTextResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] }
}

/** Wrap a JSON-serializable payload as a pretty-printed text tool result. */
export function toJsonResult(payload: unknown): CallToolResult {
  return toTextResult(JSON.stringify(payload, null, 2))
}

/**
 * Map any thrown error to an MCP result with `isError: true`, so recoverable
 * failures come back as content the model can see and adapt to — never as a
 * thrown JSON-RPC protocol error. The message is redacted defense-in-depth
 * (UnsplashApiError messages are already redacted by the client).
 */
export function toToolError(error: unknown, redact: Redactor = noRedact): CallToolResult {
  return { content: [{ type: 'text', text: redact(errorText(error)) }], isError: true }
}

function errorText(error: unknown): string {
  if (error instanceof UnsplashApiError) return error.message
  if (error instanceof SchemaValidationError) return error.message
  if (error instanceof Error) return `Unexpected error: ${error.message}`
  return 'Unexpected error.'
}
