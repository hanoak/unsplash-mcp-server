import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { CollectionSchema } from '../schemas/collection.js'
import { parseResponse } from '../schemas/parse.js'
import { PhotoSchema } from '../schemas/photo.js'
import { toCompactCollection, toCompactPhoto } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

const collectionId = () => z.string().trim().min(1).describe('The Unsplash collection ID.')
const page = () => z.number().int().min(1).default(1).describe('Page number, 1-based.')
const perPage = () =>
  z.number().int().min(1).default(10).describe('Items per page (clamped to a max of 30).')

const listCollectionsInput = { page: page(), per_page: perPage() }
const getCollectionInput = { id: collectionId() }
const collectionPhotosInput = {
  id: collectionId(),
  page: page(),
  per_page: perPage(),
  orientation: z
    .enum(['landscape', 'portrait', 'squarish'])
    .optional()
    .describe('Filter by photo orientation.'),
}
const relatedCollectionsInput = { id: collectionId() }

/** Register the collections-domain tools (public reads only) onto the server. */
export function registerCollectionTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'unsplash_list_collections',
    {
      title: 'List Unsplash Collections',
      description: 'List the latest featured Unsplash collections (paginated). Read-only.',
      inputSchema: listCollectionsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/collections', {
          params: { page: args.page, per_page },
          signal: extra.signal,
        })
        const collections = parseResponse(z.array(CollectionSchema), res.data, 'list collections')
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
    'unsplash_get_collection',
    {
      title: 'Get Unsplash Collection',
      description: 'Get a single Unsplash collection by its ID. Read-only.',
      inputSchema: getCollectionInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/collections/${encodeURIComponent(args.id)}`, {
          signal: extra.signal,
        })
        const collection = parseResponse(CollectionSchema, res.data, 'get collection')
        return toJsonResult({
          collection: toCompactCollection(collection, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_collection_photos',
    {
      title: 'Unsplash Collection Photos',
      description:
        'List the photos in a collection (paginated), with URLs and ready-to-use attribution. ' +
        'Read-only.',
      inputSchema: collectionPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const per_page = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get(`/collections/${encodeURIComponent(args.id)}/photos`, {
          params: { page: args.page, per_page, orientation: args.orientation },
          signal: extra.signal,
        })
        const photos = parseResponse(z.array(PhotoSchema), res.data, 'collection photos')
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
    'unsplash_related_collections',
    {
      title: 'Related Unsplash Collections',
      description: 'List collections related to a given collection. Read-only.',
      inputSchema: relatedCollectionsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/collections/${encodeURIComponent(args.id)}/related`, {
          signal: extra.signal,
        })
        const collections = parseResponse(
          z.array(CollectionSchema),
          res.data,
          'related collections',
        )
        return toJsonResult({
          collections: collections.map((c) => toCompactCollection(c, ctx.config.appName)),
          count: collections.length,
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
