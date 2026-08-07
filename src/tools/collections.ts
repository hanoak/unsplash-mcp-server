import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { CollectionPhotoLinkSchema, CollectionSchema } from '../schemas/collection.js'
import { parseResponse } from '../schemas/parse.js'
import { PhotoSchema } from '../schemas/photo.js'
import { IMAGE_URL_HINT, toCompactCollection, toCompactPhoto } from './format.js'
import type { ToolContext } from './index.js'
import { requireUserToken, toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: true } as const
const LOGIN_NOTE =
  ' Requires OAuth sign-in — run `npx @hanoak/unsplash-mcp-server login` first. Not read-only.'

const collectionId = () => z.string().trim().min(1).describe('The Unsplash collection ID.')
const photoId = () => z.string().trim().min(1).describe('The Unsplash photo ID.')
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

const createCollectionInput = {
  title: z.string().trim().min(1).describe('Title for the new collection.'),
  description: z.string().trim().min(1).optional().describe('Description for the collection.'),
  private: z.boolean().optional().describe('Create as a private collection (default false).'),
}
const updateCollectionInput = {
  id: collectionId(),
  title: z.string().trim().min(1).optional().describe('New title.'),
  description: z.string().trim().min(1).optional().describe('New description.'),
  private: z.boolean().optional().describe('New private/public visibility.'),
}
const deleteCollectionInput = { id: collectionId() }
const addPhotoToCollectionInput = { id: collectionId(), photo_id: photoId() }
const removePhotoFromCollectionInput = { id: collectionId(), photo_id: photoId() }

/** Project a collection/photo link response (add/remove) into compact output. */
function toLinkResult(
  link: z.infer<typeof CollectionPhotoLinkSchema>,
  appName: string | undefined,
) {
  return {
    collection: link.collection ? toCompactCollection(link.collection, appName) : undefined,
    photo: link.photo ? toCompactPhoto(link.photo, appName) : undefined,
  }
}

/** Register the collections-domain tools onto the server. */
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
        'Read-only.' +
        IMAGE_URL_HINT,
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

  server.registerTool(
    'unsplash_create_collection',
    {
      title: 'Create Unsplash Collection',
      description: 'Create a new collection owned by the authenticated user.' + LOGIN_NOTE,
      inputSchema: createCollectionInput,
      annotations: WRITE,
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.post('/collections', args, { authToken, signal: extra.signal })
        const collection = parseResponse(CollectionSchema, res.data, 'create collection')
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
    'unsplash_update_collection',
    {
      title: 'Update Unsplash Collection',
      description:
        'Update a collection owned by the authenticated user. Only the fields you pass are ' +
        'changed.' +
        LOGIN_NOTE,
      inputSchema: updateCollectionInput,
      annotations: WRITE,
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const { id, ...body } = args
        const res = await ctx.client.put(`/collections/${encodeURIComponent(id)}`, body, {
          authToken,
          signal: extra.signal,
        })
        const collection = parseResponse(CollectionSchema, res.data, 'update collection')
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
    'unsplash_delete_collection',
    {
      title: 'Delete Unsplash Collection',
      description:
        'Permanently delete a collection owned by the authenticated user. This cannot be ' +
        'undone.' +
        LOGIN_NOTE,
      inputSchema: deleteCollectionInput,
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: true },
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.delete(`/collections/${encodeURIComponent(args.id)}`, {
          authToken,
          signal: extra.signal,
        })
        return toJsonResult({ deleted: true, id: args.id, rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_add_photo_to_collection',
    {
      title: 'Add Photo to Unsplash Collection',
      description: 'Add a photo to a collection owned by the authenticated user.' + LOGIN_NOTE,
      inputSchema: addPhotoToCollectionInput,
      annotations: WRITE,
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.post(
          `/collections/${encodeURIComponent(args.id)}/add`,
          { photo_id: args.photo_id },
          { authToken, signal: extra.signal },
        )
        const link = parseResponse(CollectionPhotoLinkSchema, res.data, 'add photo to collection')
        return toJsonResult({
          ...toLinkResult(link, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_remove_photo_from_collection',
    {
      title: 'Remove Photo from Unsplash Collection',
      description: 'Remove a photo from a collection owned by the authenticated user.' + LOGIN_NOTE,
      inputSchema: removePhotoFromCollectionInput,
      annotations: WRITE,
    },
    async (args, extra) => {
      try {
        const authToken = requireUserToken(ctx)
        const res = await ctx.client.delete(`/collections/${encodeURIComponent(args.id)}/remove`, {
          params: { photo_id: args.photo_id },
          authToken,
          signal: extra.signal,
        })
        const link = parseResponse(
          CollectionPhotoLinkSchema,
          res.data,
          'remove photo from collection',
        )
        return toJsonResult({
          ...toLinkResult(link, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
