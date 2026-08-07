import { z } from 'zod'

import { UserSchema } from './user.js'

/**
 * Lenient schema for the authenticated user's own profile (spec
 * `User.FullWithAuth`) — the same public fields as {@link UserSchema}, plus
 * the private ones only `/me` exposes.
 */
export const PrivateUserSchema = UserSchema.extend({
  email: z.string().optional(),
  instagram_username: z.string().nullish(),
  uploads_remaining: z.number().optional(),
})
export type PrivateUser = z.infer<typeof PrivateUserSchema>
