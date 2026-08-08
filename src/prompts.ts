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

  server.registerPrompt(
    'platform_pulse',
    {
      title: 'Unsplash platform pulse',
      description: 'A quick briefing of Unsplash-wide stats: all-time totals and this month.',
      argsSchema: {},
    },
    () => {
      const text = [
        'Give a quick briefing of Unsplash-wide activity.',
        'Use `unsplash_total_stats` for all-time totals and `unsplash_month_stats` for the last ' +
          '30 days, then present both together as a short, readable summary (photos, downloads, ' +
          'views).',
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )

  const LOGIN_REMINDER =
    'If any tool reports you are not logged in, tell the user to run ' +
    '`npx @hanoak/unsplash-mcp-server login` in a terminal, then try again — this workflow needs ' +
    'OAuth sign-in.'

  server.registerPrompt(
    'curate_collection',
    {
      title: 'Curate an Unsplash collection',
      description:
        'Search Unsplash for a theme, then build (or extend) a real collection from the best ' +
        'matches. Requires OAuth sign-in.',
      argsSchema: {
        theme: z
          .string()
          .min(1)
          .describe('What the collection should be about, e.g. "cozy autumn mornings".'),
        count: z.string().optional().describe('How many photos to add (default 6, max 10).'),
        collection_id: z
          .string()
          .optional()
          .describe('An existing collection ID to add to, instead of creating a new one.'),
      },
    },
    (args) => {
      const count = clampCount(args.count, 6, 10)
      const collectionStep = args.collection_id
        ? `Add photos to the existing collection with id "${args.collection_id}" — do not create a new one.`
        : `Call \`unsplash_create_collection\` with a fitting title and description for "${args.theme}" to create a new collection.`

      const text = [
        `Curate an Unsplash collection about ${args.theme}.`,
        `1. Use \`unsplash_search_photos\` to find up to ${count} well-matched photos.`,
        `2. ${collectionStep}`,
        "3. For each photo you keep, call `unsplash_add_photo_to_collection` with the collection's id and the photo's id.",
        '4. Present each added photo with its attribution (`attribution.text` or `attribution.html`), then share the collection page link at the end.',
        LOGIN_REMINDER,
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )
}
