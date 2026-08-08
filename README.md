# unsplash-mcp-server

[![npm version](https://img.shields.io/npm/v/@hanoak/unsplash-mcp-server.svg)](https://www.npmjs.com/package/@hanoak/unsplash-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/@hanoak/unsplash-mcp-server.svg)](https://www.npmjs.com/package/@hanoak/unsplash-mcp-server)
[![CI](https://github.com/hanoak/unsplash-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/hanoak/unsplash-mcp-server/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](#requirements)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

A production-ready [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Unsplash API](https://unsplash.com/developers). It gives AI assistants — Claude Desktop, Claude Code, Cursor, VS Code, Windsurf, and any MCP client — tools to search and fetch Unsplash photos, collections, topics, users, and stats, with **Unsplash-guideline compliance built in** (ready-to-use attribution and download tracking). Sign in once via OAuth to also manage your own profile, collections, and photo metadata.

> [!IMPORTANT]
> **Unofficial project.** This is not affiliated with, endorsed by, or sponsored by Unsplash. "Unsplash" is a trademark of its respective owner. You use it under your own Unsplash API account and are responsible for complying with the [Unsplash API Terms & Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Example interaction](#example-interaction)
- [Configuration](#configuration)
- [OAuth sign-in (optional)](#oauth-sign-in-optional)
- [Tools](#tools)
  - [Tool reference](#tool-reference)
  - [Output shape](#output-shape)
  - [Resources & prompts](#resources--prompts)
- [Example prompts](#example-prompts)
- [Attribution & compliance](#attribution--compliance)
- [Rate limits](#rate-limits)
- [Handling of Unsplash text](#handling-of-unsplash-text)
- [Privacy & security](#privacy--security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Requirements](#requirements)
- [Compatibility](#compatibility)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [Contact & community](#contact--community)
- [License](#license)

## Features

- **29 tools** across photos, search, users, collections, topics, stats, and your own profile — 21 read-only out of the box, plus 8 write/`me` tools once you [sign in](#oauth-sign-in-optional).
- **Compliance built in** — every photo comes with ready-to-use attribution (plain text + UTM-tagged HTML), and a dedicated `unsplash_track_download` tool for the download-tracking guideline.
- **Content safety** — `content_filter=high` by default on search and random photos.
- **Flexible image URLs** — each photo returns `raw`/`full`/`regular`/`small`/`thumb` sizes, plus a `raw` imgix base for custom sizes (`?w=&h=&q=&fm=&fit=`).
- **Token-efficient output** — full Unsplash responses are trimmed to a compact shape (URLs + metadata as text, never base64 image blobs) to keep model context small.
- **Robust** — typed failures returned as MCP `isError` results the model can recover from, plus retries/backoff, timeouts, `403` hourly-limit handling, and rate-limit surfacing.
- **Safe** — access-key redaction in all error output, an SSRF guard on download URLs, and untrusted-text handling guidance for indirect prompt-injection defence.
- **Lean & modern** — ESM, Node 20+, zero-install via `npx`, no telemetry.

## Quick start

### 1. Get an Unsplash access key

Register an application at **[unsplash.com/developers](https://unsplash.com/developers)** → **New Application** → accept the API terms → copy its **Access Key** (not the Secret Key). New apps start on the **Demo** tier (50 requests/hour); the **Production** tier (5,000/hour) requires Unsplash's review from your app dashboard. See [Rate limits](#rate-limits).

### 2. Add the server to your MCP client

**Claude Desktop** — edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "unsplash": {
      "command": "npx",
      "args": ["-y", "@hanoak/unsplash-mcp-server"],
      "env": {
        "UNSPLASH_ACCESS_KEY": "your_access_key",
        "UNSPLASH_APP_NAME": "your_registered_app_name"
      }
    }
  }
}
```

Restart the client. See [Configuration](#configuration) for every supported variable.

<details>
<summary><b>Other clients (Claude Code, Cursor, VS Code, Windsurf, generic stdio)</b></summary>

**Claude Code** (CLI):

```bash
claude mcp add unsplash \
  --env UNSPLASH_ACCESS_KEY=your_access_key \
  --env UNSPLASH_APP_NAME=your_registered_app_name \
  -- npx -y @hanoak/unsplash-mcp-server
```

**Cursor** — `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (per-project): use the exact same `mcpServers` block as Claude Desktop above.

**Windsurf** — `~/.codeium/windsurf/mcp_config.json`: same `mcpServers` block as Claude Desktop above.

**VS Code** — `.vscode/mcp.json` (note the top-level key is `servers`, not `mcpServers`):

```json
{
  "servers": {
    "unsplash": {
      "command": "npx",
      "args": ["-y", "@hanoak/unsplash-mcp-server"],
      "env": {
        "UNSPLASH_ACCESS_KEY": "your_access_key",
        "UNSPLASH_APP_NAME": "your_registered_app_name"
      }
    }
  }
}
```

**Any other MCP client** — run the server over **stdio** with:

```bash
UNSPLASH_ACCESS_KEY=your_access_key npx -y @hanoak/unsplash-mcp-server
```

Point your client's stdio transport at `command: npx`, `args: ["-y", "@hanoak/unsplash-mcp-server"]`, and pass the key via `env`.

</details>

### 3. Try it

Restart your client and ask:

> _"Find me a photo of mountains on Unsplash and show the attribution."_

## Example interaction

A typical flow: the model calls `unsplash_search_photos`, picks a result, presents the image with its attribution, and calls `unsplash_track_download` when it actually uses the photo.

> **You:** Find a landscape photo of a foggy pine forest and credit the photographer.
>
> **Assistant:** _(calls `unsplash_search_photos` with `query: "foggy pine forest"`, `orientation: "landscape"`, picks the best result, then calls `unsplash_track_download` with its `download_location`)_
> Here's a great match — _Photo by Jane Doe on Unsplash_ — along with a ready-to-embed credit line and the image URL.

Each tool returns a compact JSON payload. Here's the shape of a single photo result (illustrative values):

<details>
<summary><b>Example tool output</b></summary>

```json
{
  "photo": {
    "id": "Dwu85P9SOIk",
    "description": "brown rocky mountain under blue sky during daytime",
    "width": 6000,
    "height": 4000,
    "color": "#734940",
    "blur_hash": "L6Pj0^i_.AyE_3t7t7R**0o#DgR4",
    "urls": {
      "raw": "https://images.unsplash.com/photo-1465…?ixid=…",
      "full": "https://images.unsplash.com/photo-1465…?ixid=…&q=85",
      "regular": "https://images.unsplash.com/photo-1465…?ixid=…&w=1080",
      "small": "https://images.unsplash.com/photo-1465…?ixid=…&w=400",
      "thumb": "https://images.unsplash.com/photo-1465…?ixid=…&w=200"
    },
    "photo_page": "https://unsplash.com/photos/Dwu85P9SOIk",
    "download_location": "https://api.unsplash.com/photos/Dwu85P9SOIk/download?ixid=…",
    "photographer": {
      "name": "Jane Doe",
      "username": "janedoe",
      "profile": "https://unsplash.com/@janedoe"
    },
    "attribution": {
      "text": "Photo by Jane Doe on Unsplash",
      "html": "Photo by <a href=\"https://unsplash.com/@janedoe?utm_source=your_app&utm_medium=referral\">Jane Doe</a> on <a href=\"https://unsplash.com/?utm_source=your_app&utm_medium=referral\">Unsplash</a>",
      "photographerName": "Jane Doe",
      "photographerUrl": "https://unsplash.com/@janedoe?utm_source=your_app&utm_medium=referral",
      "unsplashUrl": "https://unsplash.com/?utm_source=your_app&utm_medium=referral"
    }
  },
  "rate_limit": { "limit": 50, "remaining": 49 }
}
```

Every tool result includes a `rate_limit` object (`limit`, `remaining`) read from the Unsplash response headers. List/search tools wrap results in `photos`/`collections`/`users`/`topics` arrays with pagination fields (`total`, `total_pages`, `count`, `page`, `per_page`).

</details>

## Configuration

Configuration is entirely via environment variables — no config files, no flags for secrets.

| Environment variable          | Required         | Description                                                                                                                             |
| ----------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `UNSPLASH_ACCESS_KEY`         | **yes**          | Your Unsplash API access key. The server exits at startup with a clear message if it is missing or blank.                               |
| `UNSPLASH_APP_NAME`           | **recommended**  | Your registered Unsplash app name, used as the attribution `utm_source`. Defaults to a generic value (with a startup warning) if unset. |
| `UNSPLASH_SECRET_KEY`         | only for `login` | Your Unsplash app's secret key. Only needed to run `login` — see [OAuth sign-in](#oauth-sign-in-optional).                              |
| `UNSPLASH_OAUTH_REDIRECT_URI` | only for `login` | Override the default `http://localhost:8734/callback` used by `login`. Must match the redirect URI registered on your Unsplash app.     |
| `LOG_LEVEL`                   | no               | `debug` \| `info` \| `warn` \| `error` (default `info`). All logs go to **stderr**; stdout carries only the MCP protocol.               |

CLI flags: `--version` and `--help` are supported (e.g. `npx @hanoak/unsplash-mcp-server --version`). `login`/`logout` are subcommands, not flags — see below.

## OAuth sign-in (optional)

The 21 core tools work out of the box with just `UNSPLASH_ACCESS_KEY`. To also use the **8 write/`me` tools** (update your profile, manage collections, edit photo metadata), sign in once via OAuth:

1. On your app's page at [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications), add `http://localhost:8734/callback` as a redirect URI, and copy the **Secret key**.
2. Set both `UNSPLASH_ACCESS_KEY` and `UNSPLASH_SECRET_KEY` in your shell (not just the MCP client config — `login` runs from your terminal).
3. Run:

   ```bash
   npx @hanoak/unsplash-mcp-server login
   ```

   This opens your browser to Unsplash's consent screen, captures the redirect on a short-lived local server, exchanges the code for a user access token, and saves it to `~/.config/unsplash-mcp-server/credentials.json` (owner-only file permissions). Unsplash user access tokens **don't expire**, so this is a one-time step — no periodic re-auth.

4. Restart your MCP client. The 8 write/`me` tools are now available; the 21 read-only tools are unaffected either way.

Run `npx @hanoak/unsplash-mcp-server logout` at any time to remove the stored token. To revoke it server-side, regenerate your app's secret key from the Unsplash dashboard.

## Tools

All tools are namespaced `unsplash_*`. Most are **read-only** (annotated `readOnlyHint: true`); the exceptions are `unsplash_track_download` (registers a download event) and the 8 write/`me` tools below, all marked non-read-only and gated behind [OAuth sign-in](#oauth-sign-in-optional). Parameters map to the Unsplash API; `per_page` and stats `quantity` are clamped to a max of **30**, and `page` is 1-based.

| Domain          | Tools                                                                                                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Photos**      | `random_photo`, `list_photos`, `get_photo`, `photo_statistics`, `track_download`, `update_photo` 🔒                                                                                                                       |
| **Search**      | `search_photos`, `search_collections`, `search_users`                                                                                                                                                                     |
| **Users**       | `get_user`, `user_photos`, `user_collections`, `user_statistics`                                                                                                                                                          |
| **Collections** | `list_collections`, `get_collection`, `collection_photos`, `related_collections`, `create_collection` 🔒, `update_collection` 🔒, `delete_collection` 🔒, `add_photo_to_collection` 🔒, `remove_photo_from_collection` 🔒 |
| **Topics**      | `list_topics`, `get_topic`, `topic_photos`                                                                                                                                                                                |
| **Stats**       | `total_stats`, `month_stats`                                                                                                                                                                                              |
| **Me**          | `get_my_profile` 🔒, `update_my_profile` 🔒                                                                                                                                                                               |

🔒 = requires [OAuth sign-in](#oauth-sign-in-optional) (`login`) first.

### Tool reference

<details>
<summary><b>Photos</b></summary>

| Tool                        | Parameters                                                                                                                                                                                                                                     | Description                                                               |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `unsplash_random_photo`     | `query?`, `orientation?` (`landscape`\|`portrait`\|`squarish`), `content_filter?` (`low`\|`high`, default `high`), `collections?`, `topics?`, `username?`                                                                                      | A single random photo, optionally filtered.                               |
| `unsplash_list_photos`      | `page?` (default 1), `per_page?` (default 10, max 30)                                                                                                                                                                                          | The latest featured photos, paginated.                                    |
| `unsplash_get_photo`        | `id` **(required)**                                                                                                                                                                                                                            | A single photo by ID or slug, full detail.                                |
| `unsplash_photo_statistics` | `id` **(required)**, `quantity?` (days, default 30, max 30)                                                                                                                                                                                    | Download/view totals for a photo over N days.                             |
| `unsplash_track_download`   | `download_location` **(required)** — the `download_location` URL from a prior photo result (must be an `https://api.unsplash.com` URL)                                                                                                         | Registers a download on real use; returns a fresh, usable download URL.   |
| `unsplash_update_photo` 🔒  | `id` **(required)**, `show_on_profile?`, `description?`, `tags?` (comma-separated), `location?` (`city`/`country`/`name`/`latitude`/`longitude`), `exif?` (`make`/`model`/`exposure_time`/`aperture_value`/`focal_length`/`iso_speed_ratings`) | Update metadata on a photo you own. Only the fields you pass are changed. |

</details>

<details>
<summary><b>Search</b></summary>

| Tool                          | Parameters                                                                                                                                                                                                          | Description                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `unsplash_search_photos`      | `query` **(required)**, `page?`, `per_page?`, `order_by?` (`latest`\|`editorial`\|`relevant`), `orientation?`, `color?` (11 named colors, e.g. `blue`), `content_filter?` (default `high`), `collections?`, `lang?` | Keyword photo search with rich filters. |
| `unsplash_search_collections` | `query` **(required)**, `page?`, `per_page?`                                                                                                                                                                        | Keyword collection search.              |
| `unsplash_search_users`       | `query` **(required)**, `page?`, `per_page?`                                                                                                                                                                        | Keyword user search.                    |

</details>

<details>
<summary><b>Users</b></summary>

| Tool                        | Parameters                                                                                                                         | Description                                |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `unsplash_get_user`         | `username` **(required)**                                                                                                          | A user's public profile.                   |
| `unsplash_user_photos`      | `username` **(required)**, `page?`, `per_page?`, `order_by?` (`latest`\|`oldest`\|`popular`\|`views`\|`downloads`), `orientation?` | A user's photos, paginated.                |
| `unsplash_user_collections` | `username` **(required)**, `page?`, `per_page?`                                                                                    | A user's collections, paginated.           |
| `unsplash_user_statistics`  | `username` **(required)**, `quantity?` (days, default 30, max 30)                                                                  | A user's download/view totals over N days. |

</details>

<details>
<summary><b>Collections</b></summary>

| Tool                                       | Parameters                                                | Description                                                   |
| ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------- |
| `unsplash_list_collections`                | `page?`, `per_page?`                                      | The latest featured collections.                              |
| `unsplash_get_collection`                  | `id` **(required)**                                       | A single collection by ID.                                    |
| `unsplash_collection_photos`               | `id` **(required)**, `page?`, `per_page?`, `orientation?` | Photos within a collection, paginated.                        |
| `unsplash_related_collections`             | `id` **(required)**                                       | Collections related to a given one.                           |
| `unsplash_create_collection` 🔒            | `title` **(required)**, `description?`, `private?`        | Create a new collection you own.                              |
| `unsplash_update_collection` 🔒            | `id` **(required)**, `title?`, `description?`, `private?` | Update a collection you own. Only the fields you pass change. |
| `unsplash_delete_collection` 🔒            | `id` **(required)**                                       | Permanently delete a collection you own. Cannot be undone.    |
| `unsplash_add_photo_to_collection` 🔒      | `id` **(required)**, `photo_id` **(required)**            | Add a photo to a collection you own.                          |
| `unsplash_remove_photo_from_collection` 🔒 | `id` **(required)**, `photo_id` **(required)**            | Remove a photo from a collection you own.                     |

</details>

<details>
<summary><b>Me (requires OAuth sign-in)</b></summary>

| Tool                            | Parameters                                                                                             | Description                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `unsplash_get_my_profile` 🔒    | _(none)_                                                                                               | Your own profile, including private fields (email, uploads remaining). |
| `unsplash_update_my_profile` 🔒 | `username?`, `first_name?`, `last_name?`, `email?`, `url?`, `location?`, `bio?`, `instagram_username?` | Update your own profile. Only the fields you pass are changed.         |

</details>

<details>
<summary><b>Topics & stats</b></summary>

| Tool                    | Parameters                                                                                               | Description                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `unsplash_list_topics`  | `page?`, `per_page?`, `order_by?` (`featured`\|`latest`\|`oldest`\|`position`), `ids?` (comma-separated) | Curated topics, paginated.                   |
| `unsplash_get_topic`    | `id` **(required)** — ID or slug (e.g. `nature`, `wallpapers`)                                           | A single topic.                              |
| `unsplash_topic_photos` | `id` **(required)**, `page?`, `per_page?`, `orientation?`, `order_by?` (`latest`\|`oldest`\|`popular`)   | Photos within a topic, paginated.            |
| `unsplash_total_stats`  | _(none)_                                                                                                 | Unsplash-wide totals (photos, downloads, …). |
| `unsplash_month_stats`  | _(none)_                                                                                                 | Unsplash-wide totals for the past 30 days.   |

</details>

### Output shape

Tools return trimmed, token-efficient JSON rather than raw Unsplash responses:

- **Photos** → `id`, `description`, `width`/`height`, `color`, `blur_hash`, `urls` (`raw`/`full`/`regular`/`small`/`thumb`), `photo_page`, `download_location`, `photographer`, and a ready-to-use `attribution` object. See [Example interaction](#example-interaction).
- **Users** → `id`, `username`, `name`, `bio`, `location`, `profile_url`, `profile_image`, `total_photos`, `total_collections`.
- **Collections / Topics** → title, description, counts, page link, curator/owners, and a compact `cover_photo`.
- Every result carries a `rate_limit` (`limit`, `remaining`); lists/searches add pagination fields.

### Resources & prompts

Beyond tools, the server also exposes:

- **Resource** `unsplash://guides/attribution` — a compact compliance guide (attribution, download tracking, hotlinking, content safety) your client can pull in as context.
- **Prompts** — ready-made tasks your client can surface directly; each expands into a guided, multi-step tool-calling task:

  | Prompt                   | Arguments                                              | What it does                                                       |
  | ------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------ |
  | `find_photo`             | `subject` (required), `orientation?`                   | Search for one photo and present it with attribution.              |
  | `photo_gallery`          | `theme` (required), `count?`, `orientation?`, `color?` | Build a themed set of photos (up to 10), each with attribution.    |
  | `topic_spotlight`        | `topic` (required), `count?`                           | Showcase a curated topic's best photos.                            |
  | `photographer_spotlight` | `username` (required), `count?`                        | A photographer's profile + their most popular work.                |
  | `platform_pulse`         | _(none)_                                               | A quick Unsplash-wide stats briefing.                              |
  | `curate_collection` 🔒   | `theme` (required), `count?`, `collection_id?`         | Search, then build (or extend) a real collection from the matches. |
  | `describe_photo` 🔒      | `id` (required), `description?`, `tags?`               | Add a description/tags to a photo you own.                         |
  | `refresh_profile` 🔒     | `bio?`, `location?`, `url?`                            | Update your own bio, location, or portfolio URL.                   |

  🔒 = requires [OAuth sign-in](#oauth-sign-in-optional) first.

## Example prompts

Natural-language asks that map cleanly onto the tools:

- _"Find a photo of a foggy forest at sunrise and give me the HTML attribution."_
- _"Search Unsplash for 5 minimalist workspace photos in landscape orientation."_
- _"Get a random nature photo and show it with credit."_
- _"Show me the most popular photos in the `wallpapers` topic."_
- _"What are this month's Unsplash-wide download stats?"_
- _"Who is the photographer behind photo `Dwu85P9SOIk`, and how many downloads does it have?"_

## Attribution & compliance

Every photo result includes an `attribution` object with ready-to-use `text` and `html` (with the required UTM parameters). **When you display or use a photo, show that attribution** — it credits the photographer and links back to Unsplash, as the guidelines require.

When a photo is actually _used_ (embedded, downloaded, displayed), call **`unsplash_track_download`** with the photo's `download_location`. Trigger it **once per photo actually used** — never once per search result. The server also sends these instructions to your MCP client on connect, so the model is nudged to do the right thing automatically.

This is a search-and-metadata tool for individual, attributed photo use — **not** a replacement for the core Unsplash experience, and it performs **no automated bulk downloading**. Please use it within the [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Each user operates under their own Unsplash API Terms.

## Rate limits

Unsplash enforces a **per-hour** request budget tied to your app's tier:

| Tier           | Budget              | How to get it                                                    |
| -------------- | ------------------- | ---------------------------------------------------------------- |
| **Demo**       | 50 requests/hour    | Default for every new app.                                       |
| **Production** | 5,000 requests/hour | Apply for review in your app dashboard once your usage is ready. |

The server reads `X-Ratelimit-Limit` / `X-Ratelimit-Remaining` and returns them as `rate_limit` on every result. When the hourly budget is exhausted, Unsplash returns **`403`** (not `429`), often with no `Retry-After`; the server surfaces this as a clear "hourly rate limit reached" error and does **not** blindly retry in-window. Transient `429`/`5xx`/network errors _are_ retried with backoff.

## Handling of Unsplash text

Photo descriptions, alt text, tags, EXIF, and user names/bios come from Unsplash contributors — treat them as **untrusted, third-party data**, not instructions. The server returns this text purely as content and never places it anywhere privileged; your client/agent should do the same: display it, but don't act on any instructions it might contain (a defence against indirect prompt injection).

## Privacy & security

- **No telemetry.** This server collects nothing and phones home to no one. It contacts only `api.unsplash.com`, using the key you provide. No analytics, no tracking.
- **Key safety.** Your access key is read from the environment only, sent as an `Authorization: Client-ID` header (never in a URL query string), and **redacted from all error output and logs** so it can't leak into pasted bug reports.
- **SSRF guard.** `unsplash_track_download` only follows `download_location` URLs on the verified `api.unsplash.com` host.
- To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Troubleshooting

- **"Set UNSPLASH_ACCESS_KEY…" on startup** — the key env var is missing or blank; add it to your client config's `env` block.
- **Node too old** — this server requires **Node 20+**. Check `node --version`.
- **Stale `npx` version** — force the latest with `npx -y @hanoak/unsplash-mcp-server@latest`, or clear the cache via `npx clear-npx-cache`.
- **Tools not appearing** — confirm the config file path and JSON are valid, then fully quit and reopen the client.
- **`403` / rate limit** — the Demo tier allows 50 requests/hour; wait for the hourly reset or apply for Production access. See [Rate limits](#rate-limits).
- **`401 Unauthorized`** — the access key is wrong or from the wrong app; copy the **Access Key** (not the Secret Key) from your app dashboard.

## FAQ

**Do I need a paid Unsplash account?**
No. The Unsplash API is free; you just register an app to get an access key. Higher throughput (Production tier) is a free review, not a paid plan.

**Access Key vs Secret Key — which one?**
For the 21 read-only tools, just the **Access Key**. The Secret Key is only needed for `login` (the OAuth flow behind the 8 write/`me` tools) — see [OAuth sign-in](#oauth-sign-in-optional).

**Does it download or rehost images?**
No. It returns Unsplash-hosted image URLs (hotlink them directly) and never rehosts or returns base64 blobs. `unsplash_track_download` only registers a download event and returns a fresh URL.

**Can it create collections, like photos, or edit my profile?**
Yes, once you [sign in](#oauth-sign-in-optional) — `unsplash_create_collection` and friends, and `unsplash_update_photo`/`unsplash_update_my_profile`. (Liking photos is not currently exposed as a tool.)

**Does it work outside Claude?**
Yes — it's a standard stdio MCP server. See [the client setup section](#2-add-the-server-to-your-mcp-client) for Claude Code, Cursor, VS Code, Windsurf, and generic stdio.

## Requirements

- **Node.js >= 20** (Node 18 is end-of-life).
- An Unsplash API access key.

## Compatibility

| Component | Supported                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Node.js   | **20** and **22**, tested in CI; `>=20` required (enforced by `engines` and a runtime guard).        |
| OS        | Linux, macOS, and Windows (all tested in CI).                                                        |
| MCP SDK   | `@modelcontextprotocol/sdk` `^1.29`; the protocol version is negotiated with your client on connect. |
| Transport | stdio (HTTP/SSE may be added in a future release).                                                   |

## Roadmap

Full detail lives in [docs/ROADMAP.md](./docs/ROADMAP.md). In short:

- **v1** _(shipped)_ — the 21 read-only tools, attribution + download-tracking compliance, the attribution resource, and the `find_photo` prompt.
- **v2** _(shipped)_ — the 8 OAuth write / `me` endpoints (profile, collections, photo metadata) via a `login`/`logout` CLI and the Unsplash authorization-code flow.
- **v3** _(current)_ — 7 more MCP prompts covering every tool domain (see [Resources & prompts](#resources--prompts)). A `.mcpb` Desktop Extension was considered for this phase but dropped to unscheduled future scope — `npx` already works across every supported client.

Changes are tracked in [CHANGELOG.md](./CHANGELOG.md); the project follows [Semantic Versioning](https://semver.org).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md). It covers local setup, the test suite, testing tools by hand with the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), and the versioning/deprecation policy. To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## Contact & community

Maintained by **Hanoak S**. The fastest way to get help or propose a feature is to [open an issue](https://github.com/hanoak/unsplash-mcp-server/issues) — it's public, searchable, and helps the whole community. For anything else, reach out:

[![LinkedIn](https://img.shields.io/badge/LinkedIn-hanoak-0A66C2?logo=linkedin&logoColor=white)](https://linkedin.com/in/hanoak)
[![X](https://img.shields.io/badge/X-%40__hanoak-000000?logo=x&logoColor=white)](https://x.com/_hanoak)

If this project helps you, a ⭐ on [GitHub](https://github.com/hanoak/unsplash-mcp-server) is appreciated — it aids discoverability for others looking for an Unsplash MCP server.

## License

[MIT](./LICENSE) © Hanoak S. Not affiliated with Unsplash.
