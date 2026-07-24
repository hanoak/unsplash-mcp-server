# unsplash-mcp-server

[![npm version](https://img.shields.io/npm/v/@hanoak/unsplash-mcp-server.svg)](https://www.npmjs.com/package/@hanoak/unsplash-mcp-server)
[![CI](https://github.com/hanoak/unsplash-mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/hanoak/unsplash-mcp-server/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](#requirements)

A production-ready [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for the [Unsplash API](https://unsplash.com/developers). It gives AI assistants — Claude Desktop, Cursor, and any MCP client — tools to search and fetch Unsplash photos, collections, topics, users, and stats, with **Unsplash-guideline compliance built in** (ready-to-use attribution and download tracking).

> [!IMPORTANT]
> **Unofficial project.** This is not affiliated with, endorsed by, or sponsored by Unsplash. "Unsplash" is a trademark of its respective owner. You use it under your own Unsplash API account and are responsible for complying with the [Unsplash API Terms & Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines).

## Features

- **21 tools** across photos, search, users, collections, topics, and stats.
- **Compliance built in** — every photo comes with ready-to-use attribution (plain text + UTM-tagged HTML), and a dedicated `unsplash_track_download` tool for the download-tracking guideline.
- **Content safety** — `content_filter=high` by default on search and random photos.
- **Robust** — typed failures returned as MCP `isError` results the model can recover from, plus retries/backoff, timeouts, and rate-limit surfacing.
- **Lean & modern** — ESM, Node 20+, zero-install via `npx`, no telemetry.

## Quick start

### 1. Get an Unsplash access key

Register an application at **[unsplash.com/developers](https://unsplash.com/developers)** → create an app → copy its **Access Key**. New apps start on the **Demo** tier (50 requests/hour); the **Production** tier (5,000/hour) requires Unsplash's review from your app dashboard.

### 2. Add the server to your MCP client

**Claude Desktop** — edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`):

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

Restart the client, then try: _"Find me a photo of mountains on Unsplash."_

The same `command`/`args`/`env` block works for Cursor, Windsurf, and other MCP clients.

## Configuration

| Environment variable  | Required        | Description                                                                                                                             |
| --------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `UNSPLASH_ACCESS_KEY` | **yes**         | Your Unsplash API access key. The server exits at startup with a clear message if it is missing.                                        |
| `UNSPLASH_APP_NAME`   | **recommended** | Your registered Unsplash app name, used as the attribution `utm_source`. Defaults to a generic value (with a startup warning) if unset. |
| `LOG_LEVEL`           | no              | `debug` \| `info` \| `warn` \| `error` (default `info`). All logs go to stderr.                                                         |

## Tools

All tools are namespaced `unsplash_*` and are read-only except `unsplash_track_download` (which registers a download event).

| Domain          | Tools                                                                            |
| --------------- | -------------------------------------------------------------------------------- |
| **Photos**      | `random_photo`, `list_photos`, `get_photo`, `photo_statistics`, `track_download` |
| **Search**      | `search_photos`, `search_collections`, `search_users`                            |
| **Users**       | `get_user`, `user_photos`, `user_collections`, `user_statistics`                 |
| **Collections** | `list_collections`, `get_collection`, `collection_photos`, `related_collections` |
| **Topics**      | `list_topics`, `get_topic`, `topic_photos`                                       |
| **Stats**       | `total_stats`, `month_stats`                                                     |

> Writing to Unsplash (creating/updating collections, likes, editing your profile) requires OAuth and is planned for a future release.

## Attribution & compliance

Every photo result includes an `attribution` object with ready-to-use `text` and `html` (with the required UTM parameters). **When you display or use a photo, show that attribution** — it credits the photographer and links back to Unsplash, as the guidelines require.

When a photo is actually _used_ (embedded, downloaded, displayed), call **`unsplash_track_download`** with the photo's `download_location`. The server also sends these instructions to your MCP client on connect, so the model is nudged to do the right thing automatically.

This is a search-and-metadata tool for individual, attributed photo use — **not** a replacement for the core Unsplash experience, and it performs **no automated bulk downloading**. Please use it within the [Unsplash API Guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines). Each user operates under their own Unsplash API Terms.

## Handling of Unsplash text

Photo descriptions, alt text, tags, EXIF, and user names/bios come from Unsplash contributors — treat them as **untrusted, third-party data**, not instructions. The server returns this text purely as content and never places it anywhere privileged; your client/agent should do the same: display it, but don't act on any instructions it might contain (a defence against indirect prompt injection).

## Privacy

This server **collects nothing and phones home to no one**. It contacts only `api.unsplash.com`, using the key you provide. No analytics, no telemetry, no tracking.

## Troubleshooting

- **"Set UNSPLASH_ACCESS_KEY…" on startup** — the key env var is missing or blank; add it to your client config's `env` block.
- **Node too old** — this server requires **Node 20+**. Check `node --version`.
- **Stale `npx` version** — force the latest with `npx -y @hanoak/unsplash-mcp-server@latest`, or clear the cache via `npx clear-npx-cache`.
- **Tools not appearing** — confirm the config file path and JSON are valid, then fully quit and reopen the client.
- **`403` / rate limit** — the Demo tier allows 50 requests/hour; wait for the hourly reset or apply for Production access.

## Requirements

- **Node.js >= 20** (Node 18 is end-of-life).
- An Unsplash API access key.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md) and our [Code of Conduct](./CODE_OF_CONDUCT.md). To report a vulnerability, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) © Hanoak S. Not affiliated with Unsplash.
