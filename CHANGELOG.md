# Changelog

All notable changes to this project are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

Initial release: a Model Context Protocol (MCP) server for the Unsplash API.

- 21 read-only tools across photos, search, users, collections, topics, and stats, plus a dedicated `unsplash_track_download` tool.
- Built-in Unsplash-guideline compliance: ready-to-use attribution (plain text + UTM-tagged HTML) on every photo, download tracking, and server `instructions` that nudge clients to attribute and track correctly.
- An `unsplash://guides/attribution` resource and a `find_photo` prompt.
- Image URLs expose `raw`/`full`/`regular`/`small`/`thumb` sizes plus a `raw` imgix base for custom sizing.
- `content_filter=high` defaults, a robust retrying HTTP client (timeouts, `403`/`429` rate-limit handling, access-key redaction), fail-fast startup validation, and lenient zod response validation (failures surface as MCP `isError` results, not protocol errors).
