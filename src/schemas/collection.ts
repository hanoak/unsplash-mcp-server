import { z } from 'zod'

import { PhotoSchema } from './photo.js'
import { UserSchema } from './user.js'

/**
 * Lenient schema for an Unsplash collection (spec `Collection.Basic`/`.Full`).
 * Only `id` is required; `cover_photo` reuses the lenient photo schema.
 */
export const CollectionSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  total_photos: z.number().optional(),
  featured: z.boolean().optional(),
  published_at: z.string().optional(),
  links: z.object({ html: z.string().optional() }).optional(),
  cover_photo: PhotoSchema.nullish(),
  user: UserSchema.optional(),
})
export type Collection = z.infer<typeof CollectionSchema>

export const SearchCollectionsResponseSchema = z.object({
  total: z.number().optional(),
  total_pages: z.number().optional(),
  results: z.array(CollectionSchema).default([]),
})
export type SearchCollectionsResponse = z.infer<typeof SearchCollectionsResponseSchema>
