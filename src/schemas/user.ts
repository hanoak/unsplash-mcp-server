import { z } from 'zod'

import { StatSchema } from './photo.js'

/**
 * Lenient schema for an Unsplash user (spec `User.Basic`/`User.Full`). Only the
 * fields we surface are modelled; everything but `id` is optional/nullable.
 */
export const UserSchema = z.object({
  id: z.string(),
  username: z.string().nullish(),
  name: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  bio: z.string().nullish(),
  location: z.string().nullish(),
  total_photos: z.number().optional(),
  total_collections: z.number().optional(),
  total_likes: z.number().optional(),
  links: z.object({ html: z.string().optional() }).optional(),
  profile_image: z
    .object({
      small: z.string().optional(),
      medium: z.string().optional(),
      large: z.string().optional(),
    })
    .optional(),
})
export type User = z.infer<typeof UserSchema>

export const SearchUsersResponseSchema = z.object({
  total: z.number().optional(),
  total_pages: z.number().optional(),
  results: z.array(UserSchema).default([]),
})
export type SearchUsersResponse = z.infer<typeof SearchUsersResponseSchema>

/** Response of `GET /users/{username}/statistics`. */
export const UserStatisticsSchema = z.object({
  username: z.string().optional(),
  downloads: StatSchema.optional(),
  views: StatSchema.optional(),
})
export type UserStatistics = z.infer<typeof UserStatisticsSchema>
