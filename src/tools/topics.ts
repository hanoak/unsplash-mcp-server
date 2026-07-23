import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { parseResponse } from '../schemas/parse.js'
import { PhotoSchema } from '../schemas/photo.js'
import { TopicSchema } from '../schemas/topic.js'
import { toCompactPhoto, toCompactTopic } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const topicId = () => z.string().trim().min(1).describe('The Unsplash topic ID or slug.')
const page = () => z.number().int().min(1).default(1).describe('Page number, 1-based.')
const perPage = () =>
  z.number().int().min(1).default(10).describe('Items per page (clamped to a max of 30).')

const listTopicsInput = {
  page: page(),
  per_page: perPage(),
  order_by: z
    .enum(['featured', 'latest', 'oldest', 'position'])
    .optional()
    .describe('Sort order for the topics.'),
  ids: z.string().optional().describe('Comma-separated topic ID(s)/slug(s) to filter to.'),
}
const getTopicInput = { id: topicId() }
const topicPhotosInput = {
  id: topicId(),
  page: page(),
  per_page: perPage(),
  orientation: z
    .enum(['landscape', 'portrait', 'squarish'])
    .optional()
    .describe('Filter by photo orientation.'),
  order_by: z
    .enum(['latest', 'oldest', 'popular'])
    .optional()
    .describe('Sort order for the photos.'),
}

/** Register the topics-domain tools onto the server. */
export function registerTopicTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_list_topics',
    {
      title: 'List Unsplash Topics',
      description: 'List Unsplash topics (curated themes), paginated. Read-only.',
      inputSchema: listTopicsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/topics', {
          params: { page: args.page, per_page, order_by: args.order_by, ids: args.ids },
          signal: extra.signal,
        })
        const topics = parseResponse(z.array(TopicSchema), res.data, 'list topics')
        return toJsonResult({
          topics: topics.map((t) => toCompactTopic(t, ctx.config.appName)),
          count: topics.length,
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
    'unsplash_get_topic',
    {
      title: 'Get Unsplash Topic',
      description: 'Get a single Unsplash topic by its ID or slug. Read-only.',
      inputSchema: getTopicInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/topics/${encodeURIComponent(args.id)}`, {
          signal: extra.signal,
        })
        const topic = parseResponse(TopicSchema, res.data, 'get topic')
        return toJsonResult({
          topic: toCompactTopic(topic, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_topic_photos',
    {
      title: 'Unsplash Topic Photos',
      description:
        'List the photos in a topic (paginated), with URLs and ready-to-use attribution. ' +
        'Read-only.',
      inputSchema: topicPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get(`/topics/${encodeURIComponent(args.id)}/photos`, {
          params: {
            page: args.page,
            per_page,
            orientation: args.orientation,
            order_by: args.order_by,
          },
          signal: extra.signal,
        })
        const photos = parseResponse(z.array(PhotoSchema), res.data, 'topic photos')
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
}
