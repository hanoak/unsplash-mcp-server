import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import { parseResponse } from '../schemas/parse.js'
import { DownloadLinkSchema, PhotoSchema, PhotoStatisticsSchema } from '../schemas/photo.js'
import { UnsplashApiError } from '../unsplash/errors.js'
import { IMAGE_URL_HINT, toCompactPhoto } from './format.js'
import type { ToolContext } from './index.js'
import { toJsonResult, toToolError } from './result.js'

const MAX_PER_PAGE = 30
const MAX_STATS_DAYS = 30
// SSRF guard: only ever fire an authenticated request at Unsplash's own host.
const ALLOWED_DOWNLOAD_HOSTS = new Set(['api.unsplash.com'])

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

const listPhotosInput = {
  page: z.number().int().min(1).default(1).describe('Page number, 1-based.'),
  per_page: z
    .number()
    .int()
    .min(1)
    .default(10)
    .describe('Items per page (clamped to a max of 30).'),
}

const getPhotoInput = {
  id: z.string().trim().min(1).describe('The Unsplash photo ID or slug.'),
}

const photoStatisticsInput = {
  id: z.string().trim().min(1).describe('The Unsplash photo ID or slug.'),
  quantity: z
    .number()
    .int()
    .min(1)
    .default(30)
    .describe('Number of days of statistics to return (clamped to a max of 30).'),
}

const trackDownloadInput = {
  download_location: z
    .string()
    .trim()
    .min(1)
    .describe(
      'The `download_location` URL from a photo result. Call this when a photo is actually ' +
        'used/displayed to comply with the Unsplash download-tracking guideline.',
    ),
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const

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
        'default. Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: randomPhotoInput,
      annotations: READ_ONLY,
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

  server.registerTool(
    'unsplash_list_photos',
    {
      title: 'List Unsplash Photos',
      description:
        'List the latest featured Unsplash photos (paginated). Returns compact photo objects ' +
        'with URLs and ready-to-use attribution. Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: listPhotosInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const perPage = Math.min(args.per_page, MAX_PER_PAGE)
        const res = await ctx.client.get('/photos', {
          params: { page: args.page, per_page: perPage },
          signal: extra.signal,
        })
        const photos = parseResponse(z.array(PhotoSchema), res.data, 'list photos')
        return toJsonResult({
          photos: photos.map((p) => toCompactPhoto(p, ctx.config.appName)),
          count: photos.length,
          page: args.page,
          per_page: perPage,
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_get_photo',
    {
      title: 'Get Unsplash Photo',
      description:
        'Get a single Unsplash photo by its ID or slug, with full detail, URLs, and ' +
        'ready-to-use attribution. Read-only.' +
        IMAGE_URL_HINT,
      inputSchema: getPhotoInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const res = await ctx.client.get(`/photos/${encodeURIComponent(args.id)}`, {
          signal: extra.signal,
        })
        const photo = parseResponse(PhotoSchema, res.data, 'get photo')
        return toJsonResult({
          photo: toCompactPhoto(photo, ctx.config.appName),
          rate_limit: res.rateLimit,
        })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )

  server.registerTool(
    'unsplash_photo_statistics',
    {
      title: 'Unsplash Photo Statistics',
      description:
        'Get download and view totals for a photo over the last N days (default 30). ' +
        'Read-only.',
      inputSchema: photoStatisticsInput,
      annotations: READ_ONLY,
    },
    async (args, extra) => {
      try {
        const quantity = Math.min(args.quantity, MAX_STATS_DAYS)
        const res = await ctx.client.get(`/photos/${encodeURIComponent(args.id)}/statistics`, {
          params: { quantity },
          signal: extra.signal,
        })
        const stats = parseResponse(PhotoStatisticsSchema, res.data, 'photo statistics')
        return toJsonResult({
          photo_id: args.id,
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

  server.registerTool(
    'unsplash_track_download',
    {
      title: 'Track Unsplash Photo Download',
      description:
        'Register a download for a photo when it is actually used/displayed, as required by ' +
        "Unsplash's API guidelines. Pass the `download_location` URL from a prior photo result. " +
        'Returns a fresh, usable image download URL. This has a side effect (it counts toward ' +
        "the photographer's download stats), so it is NOT read-only — call it only on real use.",
      inputSchema: trackDownloadInput,
      // Not read-only: registering a download is a (non-destructive) side effect.
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args, extra) => {
      try {
        let url: URL
        try {
          url = new URL(args.download_location)
        } catch {
          throw new UnsplashApiError('bad_request', 'download_location is not a valid URL.')
        }
        if (url.protocol !== 'https:' || !ALLOWED_DOWNLOAD_HOSTS.has(url.host)) {
          throw new UnsplashApiError(
            'bad_request',
            `Refusing to fetch a non-Unsplash download URL (host: ${url.host}).`,
          )
        }
        const res = await ctx.client.get(url.pathname + url.search, { signal: extra.signal })
        const link = parseResponse(DownloadLinkSchema, res.data, 'track download')
        return toJsonResult({ tracked: true, download_url: link.url, rate_limit: res.rateLimit })
      } catch (error) {
        return toToolError(error, ctx.redact)
      }
    },
  )
}
