# Changelog

## 1.2.0

### Minor Changes

- ab74ca1: Add 7 new MCP prompts, covering every tool domain at least once.

  - Read-only: `photo_gallery` (themed multi-photo set with color/mood filters), `topic_spotlight` (curated topic showcase), `photographer_spotlight` (a user's profile + best work), `platform_pulse` (quick Unsplash-wide stats briefing).
  - OAuth-gated, showcasing the v2 write tools: `curate_collection` (search, then build or extend a real collection), `describe_photo` (tag/describe a photo you own), `refresh_profile` (update your bio/portfolio with before/after).
  - `find_photo` (from v1) is unchanged.

- 7400e40: Add two more MCP resources, alongside the existing attribution guide:

  - `unsplash://guides/oauth-setup` — how to sign in for the 8 write/`me` tools.
  - `unsplash://guides/prompts` — a "which prompt to use" reference for the 8 available prompts.

## 1.1.0

### Minor Changes

- 9778412: Add the 8 OAuth tier-2 (write/`me`) tools, plus a `login`/`logout` CLI command to authorize them.

  - New tools: `unsplash_get_my_profile`, `unsplash_update_my_profile`, `unsplash_create_collection`, `unsplash_update_collection`, `unsplash_delete_collection`, `unsplash_add_photo_to_collection`, `unsplash_remove_photo_from_collection`, `unsplash_update_photo`.
  - `npx @hanoak/unsplash-mcp-server login` runs a local OAuth authorization-code flow (opens the consent screen, captures the redirect on a short-lived loopback server, exchanges the code) and persists the resulting user access token to `~/.config/unsplash-mcp-server/credentials.json` with owner-only permissions. `logout` removes it. Unsplash user access tokens don't expire, so this is a one-time step.
  - New env vars `UNSPLASH_SECRET_KEY` and `UNSPLASH_OAUTH_REDIRECT_URI`, only needed to run `login`.
  - The 21 existing read-only tools, and everyone who doesn't run `login`, are unaffected.

## 1.0.1

Add an `mcpName` field to `package.json` so the package can be listed on the official MCP Registry (registry.modelcontextprotocol.io). No runtime or API changes.

## 1.0.0

Initial release: a Model Context Protocol (MCP) server for the Unsplash API.

- 21 read-only tools across photos, search, users, collections, topics, and stats, plus a dedicated `unsplash_track_download` tool.
- Built-in Unsplash-guideline compliance: ready-to-use attribution (plain text + UTM-tagged HTML) on every photo, download tracking, and server `instructions` that nudge clients to attribute and track correctly.
- An `unsplash://guides/attribution` resource and a `find_photo` prompt.
- Image URLs expose `raw`/`full`/`regular`/`small`/`thumb` sizes plus a `raw` imgix base for custom sizing.
- `content_filter=high` defaults, a robust retrying HTTP client (timeouts, `403`/`429` rate-limit handling, access-key redaction), fail-fast startup validation, and lenient zod response validation (failures surface as MCP `isError` results, not protocol errors).
