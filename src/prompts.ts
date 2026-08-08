import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

const ORIENTATIONS = ['landscape', 'portrait', 'squarish']
const COLORS = [
  'black_and_white',
  'black',
  'white',
  'yellow',
  'orange',
  'red',
  'purple',
  'magenta',
  'green',
  'teal',
  'blue',
]

/**
 * MCP prompt arguments always arrive as strings, and some clients (e.g. Claude
 * Desktop) send "" for an unfilled optional — which a strict z.enum rejects
 * with -32602. Keep enum-like args as plain strings and validate them here
 * instead, silently ignoring anything unrecognized.
 */
function pickLenient(value: string | undefined, allowed: readonly string[]): string | undefined {
  return value && allowed.includes(value) ? value : undefined
}

/** Parse a prompt's optional numeric arg (also always a string), clamped to [1, max]. */
function clampCount(value: string | undefined, fallback: number, max: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback
}

/** Register prompt templates that guide clients through common Unsplash tasks. */
export function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'find_photo',
    {
      title: 'Find an Unsplash photo',
      description:
        'Search Unsplash for a photo matching a description and present it with attribution.',
      argsSchema: {
        subject: z
          .string()
          .min(1)
          .describe('What the photo should depict, e.g. "a foggy pine forest at sunrise".'),
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or squarish.'),
      },
    },
    (args) => {
      const orientation = pickLenient(args.orientation, ORIENTATIONS)
      const orientationPart = orientation ? ` in ${orientation} orientation` : ''
      const text = [
        `Find a high-quality Unsplash photo of ${args.subject}${orientationPart}.`,
        'Use the `unsplash_search_photos` tool, choose the most fitting result, then present it:',
        '- display the image using its `regular` URL,',
        '- include the ready-to-use attribution (`attribution.text` or `attribution.html`),',
        "- and call `unsplash_track_download` with the photo's `download_location` once you present it.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'photo_gallery',
    {
      title: 'Build an Unsplash photo gallery',
      description:
        'Search Unsplash for a themed set of photos and present them all with attribution.',
      argsSchema: {
        theme: z
          .string()
          .min(1)
          .describe('What the gallery should be about, e.g. "autumn forests".'),
        count: z.string().optional().describe('How many photos to include (default 5, max 10).'),
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or squarish.'),
        color: z
          .string()
          .optional()
          .describe('Optional preferred color, e.g. blue, black_and_white, orange.'),
      },
    },
    (args) => {
      const orientation = pickLenient(args.orientation, ORIENTATIONS)
      const color = pickLenient(args.color, COLORS)
      const count = clampCount(args.count, 5, 10)

      const filters = [orientation && `orientation: "${orientation}"`, color && `color: "${color}"`]
        .filter(Boolean)
        .join(', ')
      const filtersSuffix = filters ? ` (${filters})` : ''

      const text = [
        `Build a themed Unsplash photo gallery about ${args.theme}${filtersSuffix}.`,
        `Use the \`unsplash_search_photos\` tool (per_page: ${count}${filters ? `, ${filters}` : ''}) ` +
          `to gather up to ${count} well-matched photos, then present each one:`,
        '- display the image using its `regular` URL,',
        '- include the ready-to-use attribution (`attribution.text` or `attribution.html`) next to it,',
        "- and call `unsplash_track_download` with each photo's `download_location` once you display it.",
        'Skip any results that do not fit the theme well rather than padding the gallery to the requested count.',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'topic_spotlight',
    {
      title: 'Spotlight an Unsplash topic',
      description: "Showcase a curated Unsplash topic's best photos with attribution.",
      argsSchema: {
        topic: z.string().min(1).describe('The topic ID or slug, e.g. "wallpapers" or "nature".'),
        count: z.string().optional().describe('How many photos to include (default 5, max 10).'),
      },
    },
    (args) => {
      const count = clampCount(args.count, 5, 10)
      const text = [
        `Spotlight the Unsplash topic "${args.topic}".`,
        `Use the \`unsplash_get_topic\` tool to introduce it (title + description), then ` +
          `\`unsplash_topic_photos\` (id: "${args.topic}", per_page: ${count}) to gather up to ` +
          `${count} of its photos.`,
        'Present the topic intro first, then each photo:',
        '- display the image using its `regular` URL,',
        '- include the ready-to-use attribution (`attribution.text` or `attribution.html`) next to it,',
        "- and call `unsplash_track_download` with each photo's `download_location` once you display it.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  server.registerPrompt(
    'photographer_spotlight',
    {
      title: 'Spotlight an Unsplash photographer',
      description: "Look up a user's profile and showcase their best work with attribution.",
      argsSchema: {
        username: z
          .string()
          .min(1)
          .describe('The Unsplash username (without the @), e.g. "janedoe".'),
        count: z.string().optional().describe('How many photos to include (default 5, max 10).'),
      },
    },
    (args) => {
      const count = clampCount(args.count, 5, 10)
      const text = [
        `Spotlight the Unsplash photographer "${args.username}".`,
        `Use the \`unsplash_get_user\` tool to introduce them (name, bio, stats), then ` +
          `\`unsplash_user_photos\` (username: "${args.username}", per_page: ${count}, ` +
          `order_by: "popular") to gather up to ${count} of their best photos.`,
        'Present their profile intro first, then each photo:',
        '- display the image using its `regular` URL,',
        '- include the ready-to-use attribution (`attribution.text` or `attribution.html`) next to it,',
        "- and call `unsplash_track_download` with each photo's `download_location` once you display it.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )
}
