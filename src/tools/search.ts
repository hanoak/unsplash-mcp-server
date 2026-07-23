import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { SearchCollectionsResponseSchema } from '../schemas/collection.js'
import { parseResponse } from '../schemas/parse.js'
import { SearchPhotosResponseSchema } from '../schemas/photo.js'
import { SearchUsersResponseSchema } from '../schemas/user.js'
import { toCompactCollection, toCompactPhoto, toCompactUser } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const COLORS = [
  'black_and_white',
  'black',
  'white',
  'yellow',
  'orange',
  'red',
  'purple',
  'magenta',
  'green',
  'teal',
  'blue',
] as const

const searchPhotosInput = {
  query: z.string().trim().min(1).describe('Search terms (required).'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Results per page (clamped to a max of 30).'),
  order_by: z
    .enum(['latest', 'editorial', 'relevant'])
    .optional()
    .describe('Sort order (Unsplash defaults to relevant).'),
  orientation: z
    .enum(['landscape', 'portrait', 'squarish'])
    .optional()
    .describe('Filter by photo orientation.'),
  color: z.enum(COLORS).optional().describe('Filter by dominant color.'),
  content_filter: z
    .enum(['low', 'high'])
    .default('high')
    .describe('Content safety filter. Defaults to "high" to exclude potentially unsafe content.'),
  collections: z
    .string()
    .optional()
    .describe('Comma-separated collection ID(s) to limit results to.'),
  lang: z.string().optional().describe('ISO language code for the query, e.g. "en", "es", "fr".'),
}

// Collections and users search share the same simple input.
const searchQueryInput = {
  query: z.string().trim().min(1).describe('Search terms (required).'),
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Results per page (clamped to a max of 30).'),
}

/** Register the search-domain tools onto the server. */
export function registerSearchTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_search_photos',
    {
      title: 'Search Unsplash Photos',
      description:
        'Search Unsplash photos by keyword, with optional filters (orientation, color, order, ' +
        'collections, language). Returns paginated compact photos with URLs and ready-to-use ' +
        'attribution. Content is filtered to "high" safety by default. Read-only.',
      inputSchema: searchPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/search/photos', {
          params: {
            query: args.query,
            page: args.page,
            per_page: perPage,
            order_by: args.order_by,
            orientation: args.orientation,
            color: args.color,
            content_filter: args.content_filter,
            collections: args.collections,
            lang: args.lang,
          },
          signal: extra.signal,
        })
        const parsed = parseResponse(SearchPhotosResponseSchema, res.data, 'search photos')
        return toJsonResult({
          total: parsed.total,
          total_pages: parsed.total_pages,
          count: parsed.results.length,
          page: args.page,
          per_page: perPage,
          photos: parsed.results.map((p) => toCompactPhoto(p, ctx.config.appName)),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_search_collections',
    {
      title: 'Search Unsplash Collections',
      description:
        'Search Unsplash collections by keyword. Returns paginated compact collections ' +
        '(title, description, cover photo, curator). Read-only.',
      inputSchema: searchQueryInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/search/collections', {
          params: { query: args.query, page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(
          SearchCollectionsResponseSchema,
          res.data,
          'search collections',
        )
        return toJsonResult({
          total: parsed.total,
          total_pages: parsed.total_pages,
          count: parsed.results.length,
          page: args.page,
          per_page: perPage,
          collections: parsed.results.map((c) => toCompactCollection(c, ctx.config.appName)),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_search_users',
    {
      title: 'Search Unsplash Users',
      description:
        'Search Unsplash users by keyword. Returns paginated compact user profiles ' +
        '(name, username, bio, profile link, photo/collection counts). Read-only.',
      inputSchema: searchQueryInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/search/users', {
          params: { query: args.query, page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const parsed = parseResponse(SearchUsersResponseSchema, res.data, 'search users')
        return toJsonResult({
          total: parsed.total,
          total_pages: parsed.total_pages,
          count: parsed.results.length,
          page: args.page,
          per_page: perPage,
          users: parsed.results.map((u) => toCompactUser(u)),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
