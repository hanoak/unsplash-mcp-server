import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

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
        // Kept a lenient string rather than a z.enum: MCP prompt arguments always
        // arrive as strings, and some clients (e.g. Claude Desktop) send "" for an
        // unfilled optional — which a strict enum rejects with -32602. We validate
        // the value in the handler instead, ignoring anything unexpected.
        orientation: z
          .string()
          .optional()
          .describe('Optional preferred orientation: landscape, portrait, or squarish.'),
      },
    },
    (args) => {
      const ORIENTATIONS = ['landscape', 'portrait', 'squarish']
      const orientation =
        args.orientation && ORIENTATIONS.includes(args.orientation)
          ? ` in ${args.orientation} orientation`
          : ''
      const text = [
        `Find a high-quality Unsplash photo of ${args.subject}${orientation}.`,
        'Use the `unsplash_search_photos` tool, choose the most fitting result, then present it:',
        '- display the image using its `regular` URL,',
        '- include the ready-to-use attribution (`attribution.text` or `attribution.html`),',
        "- and call `unsplash_track_download` with the photo's `download_location` once you present it.",
      ].join('\n')

      return { messages: [{ role: 'user', content: { type: 'text', text } }] }
    },
  )
}
