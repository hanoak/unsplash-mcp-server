import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { parseResponse } from '../schemas/parse.js'
import { PrivateUserSchema } from '../schemas/me.js'
import { toCompactUser } from './format.js'
import type { ToolContext } from './index.js'
import { requireUserToken, toJsonResult, toToolError } from './result.js'

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const updateMyProfileInput = {
  username: z.string().trim().min(1).optional().describe('New Unsplash username.'),
  first_name: z.string().trim().min(1).optional().describe('New first name.'),
  last_name: z.string().trim().min(1).optional().describe('New last name.'),
  email: z.string().email().optional().describe('New account email.'),
  url: z.string().url().optional().describe("New portfolio/website URL on the user's profile."),
  location: z.string().trim().min(1).optional().describe('New location text.'),
  bio: z.string().trim().min(1).optional().describe('New bio text.'),
  instagram_username: z.string().trim().min(1).optional().describe('New Instagram username.'),
}

/** Project a PrivateUser into the same compact shape as public users, plus the private fields. */
function toCompactMe(profile: z.infer<typeof PrivateUserSchema>) {
  return {
    ...toCompactUser(profile),
    email: profile.email,
    instagram_username: profile.instagram_username ?? undefined,
    uploads_remaining: profile.uploads_remaining,
  }
}

/** Register the `/me` (authenticated user) tools onto the server. */
export function registerMeTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_get_my_profile',
    {
      title: 'Get My Unsplash Profile',
      description:
        "Get the authenticated user's own Unsplash profile, including private fields " +
        '(email, remaining uploads). Requires OAuth sign-in — run ' +
        '`npx @hanoak/unsplash-mcp-server login` first. Read-only.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    async (_args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.get('/me', { authToken, signal: extra.signal })
        const profile = parseResponse(PrivateUserSchema, res.data, 'get my profile')
        return toJsonResult({ profile: toCompactMe(profile), rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_update_my_profile',
    {
      title: 'Update My Unsplash Profile',
      description:
        "Update the authenticated user's own Unsplash profile. Only the fields you pass are " +
        'changed. Requires OAuth sign-in — run `npx @hanoak/unsplash-mcp-server login` first. ' +
        'Not read-only.',
      inputSchema: updateMyProfileInput,
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.put('/me', args, { authToken, signal: extra.signal })
        const profile = parseResponse(PrivateUserSchema, res.data, 'update my profile')
        return toJsonResult({ profile: toCompactMe(profile), rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
