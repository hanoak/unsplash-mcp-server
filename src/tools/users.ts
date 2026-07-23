import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { CollectionSchema } from '../schemas/collection.js'
import { parseResponse } from '../schemas/parse.js'
import { PhotoSchema } from '../schemas/photo.js'
import { UserSchema, UserStatisticsSchema } from '../schemas/user.js'
import { toCompactCollection, toCompactPhoto, toCompactUser } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const MAX_STATS_DAYS = 30
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const username = () => z.string().trim().min(1).describe('The Unsplash username (without the @).')
const page = () => z.number().int().min(1).default(1).describe('Page number, 1-based.')
const perPage = () =>
  z.number().int().min(1).default(10).describe('Items per page (clamped to a max of 30).')

const getUserInput = { username: username() }
const userPhotosInput = {
  username: username(),
  page: page(),
  per_page: perPage(),
  order_by: z
    .enum(['latest', 'oldest', 'popular', 'views', 'downloads'])
    .optional()
    .describe('Sort order for the photos.'),
  orientation: z
    .enum(['landscape', 'portrait', 'squarish'])
    .optional()
    .describe('Filter by photo orientation.'),
}
const userCollectionsInput = { username: username(), page: page(), per_page: perPage() }
const userStatisticsInput = {
  username: username(),
  quantity: z
    .number()
    .int()
    .min(1)
    .default(30)
    .describe('Number of days of statistics to return (clamped to a max of 30).'),
}

/** Register the users-domain tools onto the server. */
export function registerUserTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_get_user',
    {
      title: 'Get Unsplash User',
      description: "Get an Unsplash user's public profile by username. Read-only.",
      inputSchema: getUserInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/users/${encodeURIComponent(args.username)}`, {
          signal: extra.signal,
        })
        const user = parseResponse(UserSchema, res.data, 'get user')
        return toJsonResult({ user: toCompactUser(user), rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_user_photos',
    {
      title: 'Unsplash User Photos',
      description:
        "List a user's photos (paginated), with URLs and ready-to-use attribution. Read-only.",
      inputSchema: userPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get(`/users/${encodeURIComponent(args.username)}/photos`, {
          params: {
            page: args.page,
            per_page,
            order_by: args.order_by,
            orientation: args.orientation,
          },
          signal: extra.signal,
        })
        const photos = parseResponse(z.array(PhotoSchema), res.data, 'user photos')
        return toJsonResult({
          photos: photos.map((p) => toCompactPhoto(p, ctx.config.appName)),
          count: photos.length,
          page: args.page,
          per_page,
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_user_collections',
    {
      title: 'Unsplash User Collections',
      description: "List a user's collections (paginated). Read-only.",
      inputSchema: userCollectionsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get(
          `/users/${encodeURIComponent(args.username)}/collections`,
          {
            params: { page: args.page, per_page },
            signal: extra.signal,
          },
        )
        const collections = parseResponse(z.array(CollectionSchema), res.data, 'user collections')
        return toJsonResult({
          collections: collections.map((c) => toCompactCollection(c, ctx.config.appName)),
          count: collections.length,
          page: args.page,
          per_page,
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_user_statistics',
    {
      title: 'Unsplash User Statistics',
      description:
        "Get a user's download and view totals over the last N days (default 30). Read-only.",
      inputSchema: userStatisticsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const quantity = Math.min(args.quantity, MAX_STATS_DAYS)
        const res = await ctx.client.get(`/users/${encodeURIComponent(args.username)}/statistics`, {
          params: { quantity },
          signal: extra.signal,
        })
        const stats = parseResponse(UserStatisticsSchema, res.data, 'user statistics')
        return toJsonResult({
          username: args.username,
          downloads_total: stats.downloads?.total,
          views_total: stats.views?.total,
          period_days: quantity,
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
