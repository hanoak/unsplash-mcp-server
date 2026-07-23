import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { parseResponse } from '../schemas/parse.js'
import { PhotoSchema } from '../schemas/photo.js'
import { toCompactPhoto } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const randomPhotoInput = {
  query: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe('Limit the random selection to photos matching this search term.'),
  orientation: z
    .enum(['landscape', 'portrait', 'squarish'])
    .optional()
    .describe('Filter by photo orientation.'),
  content_filter: z
    .enum(['low', 'high'])
    .default('high')
    .describe('Content safety filter. Defaults to "high" to exclude potentially unsafe content.'),
  collections: z
    .string()
    .optional()
    .describe('Comma-separated public collection ID(s) to narrow the selection.'),
  topics: z
    .string()
    .optional()
    .describe('Comma-separated topic ID(s)/slug(s) to narrow the selection.'),
  username: z
    .string()
    .optional()
    .describe('Limit the selection to photos by this Unsplash username.'),
}

/** Register the photos-domain tools onto the server. */
export function registerPhotoTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_random_photo',
    {
      title: 'Random Unsplash Photo',
      description:
        'Fetch a single random photo from Unsplash. Optionally filter by search term, ' +
        'orientation, collections, topics, or user. Returns photo URLs, dimensions, color, ' +
        'and ready-to-use attribution (text + HTML). Content is filtered to "high" safety by ' +
        'default. Read-only.',
      inputSchema: randomPhotoInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get('/photos/random', {
          params: {
            query: args.query,
            orientation: args.orientation,
            content_filter: args.content_filter,
            collections: args.collections,
            topics: args.topics,
            username: args.username,
          },
          signal: extra.signal,
        })
        const photo = parseResponse(PhotoSchema, res.data, 'random photo')
        return toJsonResult({
          photo: toCompactPhoto(photo, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
