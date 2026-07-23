import { z } from 'zod'

/** Response of `GET /stats/total` — Unsplash-wide totals. */
export const TotalStatsSchema = z.object({
  views: z.number().optional(),
  downloads: z.number().optional(),
  views_per_second: z.number().optional(),
  downloads_per_second: z.number().optional(),
  photographers: z.number().optional(),
  photos: z.number().optional(),
  developers: z.number().optional(),
  applications: z.number().optional(),
  pixels: z.number().optional(),
  requests: z.number().optional(),
})
export type TotalStats = z.infer<typeof TotalStatsSchema>

/** Response of `GET /stats/month` — Unsplash-wide totals for the last 30 days. */
export const MonthStatsSchema = z.object({
  views: z.number().optional(),
  downloads: z.number().optional(),
  new_photographers: z.number().optional(),
  new_photos: z.number().optional(),
  new_developers: z.number().optional(),
  new_applications: z.number().optional(),
  new_pixels: z.number().optional(),
  new_requests: z.number().optional(),
})
export type MonthStats = z.infer<typeof MonthStatsSchema>
