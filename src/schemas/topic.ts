import { z } from 'zod'

import { PhotoSchema } from './photo.js'
import { UserSchema } from './user.js'

/**
 * Lenient schema for an Unsplash topic (spec `Topic.Basic`/`Topic.Full`). Only
 * `id` is required; `cover_photo` reuses the lenient photo schema and `owners`
 * the lenient user schema.
 */
export const TopicSchema = z.object({
  id: z.string(),
  slug: z.string().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  total_photos: z.number().optional(),
  featured: z.boolean().optional(),
  status: z.string().nullish(),
  published_at: z.string().optional(),
  links: z.object({ html: z.string().optional() }).optional(),
  cover_photo: PhotoSchema.nullish(),
  owners: z.array(UserSchema).optional(),
})
export type Topic = z.infer<typeof TopicSchema>
