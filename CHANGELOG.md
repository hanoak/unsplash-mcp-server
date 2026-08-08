# Changelog

## 1.1.0

### Minor Changes

- 9778412: Add the 8 OAuth tier-2 (write/`me`) tools, plus a `login`/`logout` CLI command to authorize them.

  - New tools: `unsplash_get_my_profile`, `unsplash_update_my_profile`, `unsplash_create_collection`, `unsplash_update_collection`, `unsplash_delete_collection`, `unsplash_add_photo_to_collection`, `unsplash_remove_photo_from_collection`, `unsplash_update_photo`.
  - `npx @hanoak/unsplash-mcp-server login` runs a local OAuth authorization-code flow (opens the consent screen, captures the redirect on a short-lived loopback server, exchanges the code) and persists the resulting user access token to `~/.config/unsplash-mcp-server/credentials.json` with owner-only permissions. `logout` removes it. Unsplash user access tokens don't expire, so this is a one-time step.
  - New env vars `UNSPLASH_SECRET_KEY` and `UNSPLASH_OAUTH_REDIRECT_URI`, only needed to run `login`.
  - The 21 existing read-only tools, and everyone who doesn't run `login`, are unaffected.

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.1

Add an `mcpName` field to `package.json` so the package can be listed on the official MCP Registry (registry.modelcontextprotocol.io). No runtime or API changes.

## 1.0.0

Initial release: a Model Context Protocol (MCP) server for the Unsplash API.

- 21 read-only tools across photos, search, users, collections, topics, and stats, plus a dedicated `unsplash_track_download` tool.
- Built-in Unsplash-guideline compliance: ready-to-use attribution (plain text + UTM-tagged HTML) on every photo, download tracking, and server `instructions` that nudge clients to attribute and track correctly.
- An `unsplash://guides/attribution` resource and a `find_photo` prompt.
- Image URLs expose `raw`/`full`/`regular`/`small`/`thumb` sizes plus a `raw` imgix base for custom sizing.
- `content_filter=high` defaults, a robust retrying HTTP client (timeouts, `403`/`429` rate-limit handling, access-key redaction), fail-fast startup validation, and lenient zod response validation (failures surface as MCP `isError` results, not protocol errors).
