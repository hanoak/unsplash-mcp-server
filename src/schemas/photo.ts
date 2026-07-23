import { z } from 'zod'

/**
 * Lenient schemas for the Unsplash responses we consume.
 *
 * Design: validate only the fields we actually use, and keep nearly everything
 * optional/nullable. Unknown fields Unsplash adds are ignored (stripped);
 * fields it renames or drops surface as `undefined` instead of crashing every
 * tool. Only the essential `id` is required.
 *
 * Reconciled against the Unsplash OpenAPI `Asset.Basic`/`Asset.Full` schemas:
 * field names and types match (incl. the compliance-critical
 * `links.download_location`); we deliberately relax the spec's `required` to
 * stay lenient. The spec omits `alt_description`/`likes`/`slug`, which the live
 * API does return — kept optional here so both cases work.
 */

export const PhotoUrlsSchema = z.object({
  raw: z.string().optional(),
  full: z.string().optional(),
  regular: z.string().optional(),
  small: z.string().optional(),
  thumb: z.string().optional(),
})
export type PhotoUrls = z.infer<typeof PhotoUrlsSchema>

export const PhotoLinksSchema = z.object({
  html: z.string().optional(),
  download: z.string().optional(),
  // The endpoint that MUST be hit to comply with Unsplash's download guideline.
  download_location: z.string().optional(),
})
export type PhotoLinks = z.infer<typeof PhotoLinksSchema>

export const PhotoUserSchema = z.object({
  id: z.string().optional(),
  username: z.string().optional(),
  name: z.string().nullish(),
  links: z.object({ html: z.string().optional() }).optional(),
})
export type PhotoUser = z.infer<typeof PhotoUserSchema>

export const PhotoSchema = z.object({
  id: z.string(),
  slug: z.string().nullish(),
  description: z.string().nullish(),
  alt_description: z.string().nullish(),
  width: z.number().optional(),
  height: z.number().optional(),
  color: z.string().nullish(),
  blur_hash: z.string().nullish(),
  likes: z.number().optional(),
  created_at: z.string().optional(),
  urls: PhotoUrlsSchema.optional(),
  links: PhotoLinksSchema.optional(),
  user: PhotoUserSchema.optional(),
})
export type Photo = z.infer<typeof PhotoSchema>

export const SearchPhotosResponseSchema = z.object({
  total: z.number().optional(),
  total_pages: z.number().optional(),
  // Default to an empty list so a missing/renamed field degrades gracefully.
  results: z.array(PhotoSchema).default([]),
})
export type SearchPhotosResponse = z.infer<typeof SearchPhotosResponseSchema>

/** Response of `GET /photos/{id}/download` — a fresh, trackable download URL. */
export const DownloadLinkSchema = z.object({
  url: z.string().optional(),
})
export type DownloadLink = z.infer<typeof DownloadLinkSchema>

/** One stat series (`downloads` or `views`); `historical` is large and unused. */
export const StatSchema = z.object({
  total: z.number().optional(),
  historical: z.unknown().optional(),
})

/** Response of `GET /photos/{id}/statistics`. */
export const PhotoStatisticsSchema = z.object({
  id: z.string().optional(),
  downloads: StatSchema.optional(),
  views: StatSchema.optional(),
})
export type PhotoStatistics = z.infer<typeof PhotoStatisticsSchema>
