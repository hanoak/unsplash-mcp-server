# Production Readiness Checklist

> Living reference for building `unsplash-mcp-server` into a real, production-ready,
> open-source npm package. We work through these **one by one**. Update the status
> box (`[ ]` → `[x]`) as each item lands. Nothing here is "done" until it's tested.

**Status legend:** `[ ]` not started · `[~]` in progress · `[x]` done
**Scope:** every item is `[v1]` — all are in scope for the first npm publish.

> This file is a build tracker kept in the repo **only until the first npm publish**,
> then deleted (see the pre-publish reminder). It doubles as a public statement of the
> project's quality bar while we build.

---

## 0. Core stack decisions (foundational)

- [x] `[v1]` Language/runtime: **TypeScript + Node** ✅ decided
- [ ] `[v1]` Runtime validation with **zod** (tool inputs _and_ Unsplash API responses)
- [x] `[v1]` Transport: **stdio** first (HTTP/SSE possible later) ✅ decided
- [x] `[v1]` Module format: **ESM-only** ✅ decided (MCP SDK is ESM; simplest for a bin package)
- [x] `[v1]` Node version target: **Node 20+** ✅ decided (Node 18 is EOL Apr 2025)
- [ ] `[v1]` Use **lenient/passthrough zod on API responses** — validate only fields we consume, so an upstream field add/rename/reorder degrades gracefully instead of breaking every tool

## 1. Unsplash API compliance (legal — non-negotiable)

- [ ] `[v1]` Trigger the `download_location` endpoint when a photo is used
- [ ] `[v1]` Attribution: photographer name + profile link + Unsplash link, with UTM params
- [ ] `[v1]` Return ready-to-use attribution text/HTML per photo
- [ ] `[v1]` Serve image URLs directly from Unsplash (no hotlink/rehost)
- [ ] `[v1]` No "core Unsplash experience" clone; no automated bulk downloading
- [ ] `[v1]` Rate-limit handling + clear docs (demo 50/hr, prod 5,000/hr)
- [ ] `[v1]` **Design the download-tracking trigger**: explicit "use" step (a dedicated `track_download` tool the agent calls on selection, and/or on `get_photo`) — **never fire per search result** (violates the guideline + burns the 50/hr budget); ping must be fire-and-forget / non-blocking
- [x] `[v1]` Send required headers: `Accept-Version: v1`, `Authorization: Client-ID <key>` (**header, never `?client_id=` query param** — keeps key out of loggable URLs), descriptive versioned User-Agent ✅ (`src/unsplash/client.ts`)
- [ ] `[v1]` Make app identity configurable (`utm_source` + "Powered by Unsplash" credit) — one package serves many registered apps, so it's a documented config value, not hardcoded
- [ ] `[v1]` "Unofficial — not affiliated with or endorsed by Unsplash" disclaimer (README + package.json) + brand/trademark compliance
- [ ] `[v1]` Document app registration + Demo (50/hr) → Production (5,000/hr) approval flow (the #1 onboarding blocker)
- [ ] `[v1]` State that each user operates under their own Unsplash API Terms/License (attribution, hotlinking, download tracking are their responsibility) — sets the liability boundary

## 2. Security & secrets

- [x] `[v1]` API key via env var only (`UNSPLASH_ACCESS_KEY`); never logged/committed ✅ (`src/config.ts` reads env only; never logged)
- [x] `[v1]` `.env.example` committed; real `.env` gitignored ✅ (`.gitignore` covers `.env*`)
- [x] `[v1]` Secret scanning (pre-commit hook / CI, e.g. gitleaks) ✅ local `gitleaks protect --staged` pre-commit hook (skip-if-absent + warn) + CI gitleaks Action full-history scan (`.github/workflows/secret-scan.yml`)
- [~] `[v1]` Dependency security: `npm audit`, Dependabot/Renovate, minimal deps — Dependabot configured (`.github/dependabot.yml`: npm + github-actions, weekly); `npm audit` CI step still to add
- [ ] `[v1]` Input sanitization before hitting the API
- [~] `[v1]` Supply-chain: `npm publish --provenance`, committed lockfile, pinned CI actions (by SHA) — lockfile committed ✅, CI actions SHA-pinned ✅; `--provenance` comes with release automation (§5)
- [x] `[v1]` **Fail-fast startup validation** of `UNSPLASH_ACCESS_KEY` — actionable stderr message + non-zero exit, not a cryptic 401 mid-conversation ✅ (`loadConfig` in `runServer`; verified by smoke)
- [~] `[v1]` **Redact** the access key / Authorization header from all error messages and debug logs (they leak into publicly-pasted bug reports) — wired into the HTTP client: all `UnsplashApiError` messages are redacted and logs only emit the path (never the auth header); MCP `isError` tool responses will also run through the redactor (tool layer)
- [ ] `[v1]` Protect the publish path: npm account 2FA + OIDC trusted publishing (or a scoped least-privilege automation token)
- [x] `[v1]` Least-privilege GitHub Actions permissions (top-level `permissions: contents: read`) ✅ (both workflows)
- [ ] `[v1]` Dependency license-compliance check in CI (prevent a copyleft transitive dep contaminating the permissive license)
- [ ] `[v1]` SSRF guard on URLs taken from API responses (`download_location`, image URLs) — only fire authenticated follow-ups to verified `api.unsplash.com` / `unsplash.com` hosts

## 3. Reliability & robustness

- [~] `[v1]` Error mapping: Unsplash 401/403/404/429/5xx → clean MCP errors w/ actionable messages — client maps to typed `UnsplashApiError` with actionable messages (`src/unsplash/errors.ts`); conversion to MCP `isError` results happens in the tool layer
- [x] `[v1]` Retries & backoff for 429/5xx (respect `Retry-After`) ✅ (`src/unsplash/client.ts`)
- [x] `[v1]` Network timeouts (never hang forever) ✅ (`AbortSignal.timeout`, default 10s; combines with caller signal)
- [x] `[v1]` Rate-limit awareness: read `X-Ratelimit-Remaining`, surface it ✅ (returned on every response + logged at debug)
- [x] `[v1]` **Handle 403 = hourly quota exhausted** (Unsplash returns **403, not 429**, often with no `Retry-After`) — surface the reset window and stop, don't blindly retry in-window ✅ (403 + remaining=0 → `rate_limit`, not retried)
- [ ] `[v1]` Short-TTL in-memory metadata cache + in-flight concurrency cap (never cache image binaries) — stretches the tight hourly budget, blunts a looping agent

## 4. Testing & quality

- [ ] `[v1]` Unit tests (Vitest/Jest) with Unsplash API mocked (msw/nock) — no real calls in CI
- [ ] `[v1]` Type-checking in CI, lint, format checks
- [ ] `[v1]` Coverage thresholds
- [ ] `[v1]` Smoke/integration test for the MCP server handshake
- [~] `[v1]` **Enforce stdout purity**: ESLint `no-console` (allow `console.error` only) + a test asserting stdout carries only valid JSON-RPC (disable dependency banners/update-notifiers) — ESLint rule in place (`eslint.config.js`); committed stdout-purity test still pending
- [ ] `[v1]` E2E test that invokes a real tool over the transport + a compliance regression test asserting `download_location` fires on "use"
- [ ] `[v1]` Validate zod schemas against committed **real captured** Unsplash response fixtures (sanitized)
- [x] `[v1]` CI test matrix: Node 20/22 × Linux/macOS/Windows (+ `.nvmrc`) ✅ (Node 18 intentionally dropped — EOL & below our `engines >=20`)
- [ ] `[v1]` Document MCP Inspector (`npx @modelcontextprotocol/inspector`) in the dev/contributor workflow
- [ ] `[v1]` Scheduled live schema-drift canary against the real Unsplash API (key-gated repo secret, off the PR path)

## 5. CI/CD & release automation ("easy to update in future")

- [x] `[v1]` GitHub Actions: test/lint/build on PR ✅ (`.github/workflows/ci.yml` — quality job + test/build matrix; SHA-pinned actions, least-privilege perms)
- [ ] `[v1]` Automated releases (Changesets or semantic-release): version + changelog + npm publish
- [x] `[v1]` Conventional commits (pairs with automated releases) ✅ enforced via `commitlint` + `@commitlint/config-conventional` on the `commit-msg` hook
- [ ] `[v1]` npm publish provenance

## 6. Developer & contributor experience ("community traction")

- [ ] `[v1]` README: quick start, `npx` one-liner, Claude Desktop/Cursor config, tool reference
- [ ] `[v1]` CONTRIBUTING.md
- [ ] `[v1]` CODE_OF_CONDUCT.md
- [ ] `[v1]` Issue/PR templates
- [ ] `[v1]` LICENSE confirmed permissive (MIT or similar)
- [ ] `[v1]` SECURITY.md (vulnerability reporting)
- [ ] `[v1]` Badges: npm version, build status, license
- [ ] `[v1]` Semantic versioning commitment
- [ ] `[v1]` Explicit **no-telemetry / privacy statement** ("collects nothing, only contacts api.unsplash.com") — users hand an npx binary their key
- [ ] `[v1]` README troubleshooting section (key not set, Node too old, stale npx cache, wrong client config path)

## 7. API surface / DX of the server

- [ ] `[v1]` Decide tool set (search photos, get photo, random, collections, user, topics, stats…)
- [ ] `[v1]` Consistent, well-described tool schemas (descriptions matter — LLM reads them)
- [ ] `[v1]` Token-efficient output shape (trim huge Unsplash responses)
- [ ] `[v1]` Pagination support
- [ ] `[v1]` **Clamp/normalize params to Unsplash bounds**: `per_page` & random `count` ≤30, `page` ≥1, zod enums for orientation/order_by/color, URL-encode queries; cap returned item count
- [ ] `[v1]` Return **hotlinkable image URLs + metadata as text, never base64 image blobs** (base64 balloons tokens + edges into rehosting)
- [ ] `[v1]` Offer sized image URLs via imgix params (`w`/`h`/`q`/`fm`/`fit`) or sensible size defaults instead of full-res raw URLs

## 8. Distribution & runtime

- [x] `[v1]` `bin` entry for `npx` + shebang ✅ (shebang via tsup banner; verified by stdio smoke)
- [x] `[v1]` `files` field ships only `dist/` ✅ (`npm pack`: 6 files, no source/config leaked)
- [x] `[v1]` Build tooling: **tsup** ✅ decided (ESM-only output; handles shebang + .d.ts)
- [x] `[v1]` Cross-platform (macOS/Linux/Windows) ✅ (CI matrix covers all three; `.gitattributes` forces LF so Windows checkouts keep prettier & shebang intact)
- [ ] `[v1]` **Pre-publish package validation** in CI: `publint` + `@arethetypeswrong/cli` + `npm pack --dry-run`, then install the tarball and run the bin via npx (handshake) — catches broken exports maps, bad type paths, missing files entry, broken shebang, lost exec-bit/CRLF
- [~] `[v1]` Declare `engines.node` + a runtime Node-version guard (friendly message, not a cryptic crash) — `engines.node ">=20"` declared; runtime guard pending
- [ ] `[v1]` Support `--version` / `--help` and detect a TTY on the bin (so `npx unsplash-mcp-server` in a terminal prints usage instead of silently hanging on the stdio loop)
- [ ] `[v1]` Populate package.json discoverability metadata (keywords: mcp/modelcontextprotocol/unsplash, description, repository, homepage, bugs)
- [x] `[v1]` npm name: **`@hanoak/unsplash-mcp-server`** ✅ decided (3 unscoped names taken; scoped name free). Bin command: `unsplash-mcp-server`. Scope owned by the user (existing npm account `hanoak`). Differentiator: full Unsplash-guideline compliance (download tracking + attribution) built in.
- [ ] `[v1]` Ship a Desktop Extension (`.mcpb`) bundle for one-click Claude Desktop install

## 9. Observability (lightweight)

- [x] `[v1]` Optional debug logging to **stderr only** (stdout is the MCP transport — never log there) ✅ (`src/lib/logger.ts`, `LOG_LEVEL`; verified by smoke)
- [ ] `[v1]` Version/health info

## 10. Docs & maintenance

- [ ] `[v1]` CHANGELOG (auto-generated)
- [ ] `[v1]` Compatibility matrix (MCP SDK / Node versions supported)
- [ ] `[v1]` Deprecation policy for future breaking changes

## 11. MCP protocol correctness (most-flagged gap)

- [ ] `[v1]` Return recoverable failures as tool results with `isError: true`, **not** JSON-RPC protocol errors — 401/404/403-rate-limit/empty-results/bad-query come back as content the LLM can see and adapt to; only real transport faults throw
- [x] `[v1]` Graceful shutdown + crash safety: exit on stdin EOF / SIGINT / SIGTERM; `uncaughtException`/`unhandledRejection` handlers logging to stderr (no orphaned node processes; no stack trace corrupting the stdout frame) ✅ (`src/index.ts` + `src/server.ts`)
- [ ] `[v1]` Declare MCP tool annotations (`readOnlyHint: true`, `openWorldHint: true`, `title`) — lets clients auto-approve safe reads
- [ ] `[v1]` Namespace tool names (`unsplash_search_photos`, not `search_photos`) — avoids collisions in a client's flat tool namespace
- [ ] `[v1]` Populate the server `instructions` field on initialize (hard-wire: always surface attribution; call download-tracking on selection)
- [ ] `[v1]` Keep tool `inputSchema`s flat and JSON-Schema-safe (no top-level unions/`anyOf`, no deep refinements — several clients choke on them)
- [ ] `[v1]` Structured tool output via `outputSchema` + `structuredContent` (derived from the same zod schemas), with a text fallback
- [ ] `[v1]` Honor MCP request cancellation (`notifications/cancelled` → `AbortController`)
- [ ] `[v1]` Optional MCP Resources / Prompts (e.g. attribution-guide resource, "find a photo for X" prompt)

## 12. Content safety & responsible use

- [ ] `[v1]` Default `content_filter=high` on search/random (overridable) — an LLM-invoked public image tool must not surface explicit content unprompted
- [ ] `[v1]` Treat Unsplash text fields (descriptions, alt_text, tags, user bios, EXIF) as untrusted data / indirect prompt-injection surface — label clearly as data; never interpolate into privileged/system prompts

## 13. Discovery & ecosystem

- [ ] `[v1]` List on the official MCP registry (`server.json` manifest) + community catalogs (awesome-mcp, Smithery, Glama, mcp.so) — the main way people discover MCP servers

## 14. Governance

- [ ] `[v1]` Add CODEOWNERS (clear review owner; addresses bus-factor)
- [ ] `[v1]` `FUNDING.yml` sustainability signal — only if the project actually seeks sponsorship

---

### ⚠️ Top gotcha

Never write logs to **stdout** in a stdio MCP server — it corrupts the JSON-RPC stream. All logging → **stderr**. (Enforced mechanically in §4.)
