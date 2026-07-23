# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial MCP server for the Unsplash API over stdio.
- **21 tools** across photos, search, users, collections, topics, and stats (read-only, plus `unsplash_track_download`).
- Built-in Unsplash compliance: ready-to-use attribution (plain text + UTM-tagged HTML), a dedicated `unsplash_track_download` tool, and server `instructions` that nudge clients to attribute and track downloads correctly.
- `content_filter=high` default on search and random photos.
- Robust HTTP client: required headers, request timeouts, retries/backoff (including `403` hourly-limit handling), rate-limit surfacing, and access-key redaction in all error output.
- Lenient zod response schemas; failures returned as MCP `isError` results rather than thrown protocol errors.
