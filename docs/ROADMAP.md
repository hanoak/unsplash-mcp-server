# unsplash-mcp-server — status & roadmap

What has shipped and what's planned next. The **roadmap** below covers upcoming releases; the detailed **v1 implementation checklist** — everything built and verified for the first release — is preserved beneath it as the record of what shipped.

## Roadmap

### ✅ v1 — shipped

The public, read-only surface plus production hardening: **21 tools** across photos, search, users, collections, topics, and stats; an `unsplash://guides/attribution` resource and a `find_photo` prompt; built-in Unsplash-guideline compliance (ready-to-use attribution + download tracking); a robust retrying HTTP client; and CI quality gates (coverage, dependency-license, package validation). Full detail in the checklist below.

### ✅ v2 — shipped — OAuth write / `me` endpoints

The 8 tier-2 endpoints that require the Unsplash **OAuth authorization-code flow** (user access tokens + scopes) — not possible with the Client-ID access key alone:

- `unsplash_get_my_profile` / `unsplash_update_my_profile` (`GET`/`PUT /me`)
- `unsplash_create_collection` / `unsplash_update_collection` / `unsplash_delete_collection` / `unsplash_add_photo_to_collection` / `unsplash_remove_photo_from_collection`
- `unsplash_update_photo` (`PUT /photos/{id}`)

Delivered via a new `login`/`logout` CLI command (`npx @hanoak/unsplash-mcp-server login`): a local loopback OAuth flow that opens the consent screen, captures the redirect, exchanges the code, and persists the resulting user access token to `~/.config/unsplash-mcp-server/credentials.json` (owner-only permissions). Unsplash user access tokens don't expire, so there's no refresh-token flow to maintain. The 8 new tools are gated behind a shared `requireUserToken` guard and report a clear "run login" error until the user signs in; every other tool is unaffected. See the README's "OAuth sign-in" section for setup.

### ✅ v3 — current release — expanded prompt library

v1 shipped a single `find_photo` prompt. v3 adds 7 more, covering every tool domain at least once — see the README's [Resources & prompts](../README.md#resources--prompts) section for the full table:

- **Read-only**: `photo_gallery` (themed multi-photo set with color/mood filters), `topic_spotlight` (curated topic showcase), `photographer_spotlight` (a user's profile + best work), `platform_pulse` (quick stats briefing).
- **OAuth-gated**, showcasing the v2 write tools: `curate_collection` (search, then build or extend a real collection), `describe_photo` (tag/describe a photo you own), `refresh_profile` (update your bio/portfolio with before/after).

**`.mcpb` Desktop Extension dropped from v3.** A one-click Claude Desktop install bundle was the original other half of v3's scope, but was moved to unscheduled future scope after a tradeoffs discussion: `npx` already works across every supported client (not just Claude Desktop), the OAuth tools would still need a terminal step regardless (MCPB has no "run a setup script on install" hook), and the concrete win — Smithery listing, which needs a hosted URL or a `.mcpb` — matters only if that listing becomes a priority. Revisit if it does; not on the roadmap otherwise.

---

## v1 implementation checklist

Everything below was built and verified for the first release; the few remaining `[ ]`/`[~]` items are release-time steps or deferred to the roadmap above.

**Status legend:** `[ ]` not started · `[~]` in progress (release-time) · `[x]` done
**Tags:** `[v1]` in the first release · `[post-v1]` deferred (see Roadmap).

---

## 0. Core stack decisions (foundational)

- [x] `[v1]` Language/runtime: **TypeScript + Node** ✅ decided
- [x] `[v1]` Runtime validation with **zod** (tool inputs _and_ Unsplash API responses) ✅ response schemas in `src/schemas/`; tool-input schemas on all 21 tools
- [x] `[v1]` Transport: **stdio** first (HTTP/SSE possible later) ✅ decided
- [x] `[v1]` Module format: **ESM-only** ✅ decided (MCP SDK is ESM; simplest for a bin package)
- [x] `[v1]` Node version target: **Node 20+** ✅ decided (Node 18 is EOL Apr 2025)
- [x] `[v1]` Use **lenient/passthrough zod on API responses** — validate only fields we consume, so an upstream field add/rename/reorder degrades gracefully instead of breaking every tool ✅ (`src/schemas/`: only `id` required, rest optional/nullable, unknown fields stripped; `parseResponse` warns-then-surfaces)

## 1. Unsplash API compliance (legal — non-negotiable)

- [x] `[v1]` Trigger the `download_location` endpoint when a photo is used ✅ unsplash_track_download tool
- [x] `[v1]` Attribution: photographer name + profile link + Unsplash link, with UTM params ✅ attribution helper w/ UTM (src/tools/format.ts)
- [x] `[v1]` Return ready-to-use attribution text/HTML per photo ✅ attribution.text + .html
- [x] `[v1]` Serve image URLs directly from Unsplash (no hotlink/rehost) ✅ return Unsplash URLs, never rehosted
- [x] `[v1]` No "core Unsplash experience" clone; no automated bulk downloading ✅ README compliance statement: search/metadata tool for individual attributed use, no bulk download
- [x] `[v1]` Rate-limit handling + clear docs (demo 50/hr, prod 5,000/hr) ✅ client surfaces remaining + 403 handling; README documents tiers + troubleshooting
- [x] `[v1]` **Design the download-tracking trigger**: explicit "use" step (a dedicated `track_download` tool the agent calls on selection, and/or on `get_photo`) — **never fire per search result** (violates the guideline + burns the 50/hr budget); ping must be fire-and-forget / non-blocking ✅ dedicated track_download tool, explicit use, SSRF-guarded
- [x] `[v1]` Send required headers: `Accept-Version: v1`, `Authorization: Client-ID <key>` (**header, never `?client_id=` query param** — keeps key out of loggable URLs), descriptive versioned User-Agent ✅ (`src/unsplash/client.ts`)
- [x] `[v1]` Make app identity configurable (`utm_source` + "Powered by Unsplash" credit) — one package serves many registered apps, so it's a documented config value, not hardcoded ✅ utm_source from config.appName
- [x] `[v1]` "Unofficial — not affiliated with or endorsed by Unsplash" disclaimer (README + package.json) + brand/trademark compliance ✅ README IMPORTANT note + package.json description
- [x] `[v1]` Document app registration + Demo (50/hr) → Production (5,000/hr) approval flow (the #1 onboarding blocker) ✅ README Quick start + Requirements
- [x] `[v1]` State that each user operates under their own Unsplash API Terms/License (attribution, hotlinking, download tracking are their responsibility) — sets the liability boundary ✅ README IMPORTANT note

## 2. Security & secrets

- [x] `[v1]` API key via env var only (`UNSPLASH_ACCESS_KEY`); never logged/committed ✅ (`src/config.ts` reads env only; never logged)
- [x] `[v1]` `.env.example` committed; real `.env` gitignored ✅ (`.gitignore` covers `.env*`)
- [x] `[v1]` Secret scanning (pre-commit hook / CI, e.g. gitleaks) ✅ local `gitleaks protect --staged` pre-commit hook (skip-if-absent + warn) + CI gitleaks Action full-history scan (`.github/workflows/secret-scan.yml`)
- [x] `[v1]` Dependency security: `npm audit`, Dependabot/Renovate, minimal deps ✅ Dependabot (`.github/dependabot.yml`) + `npm audit --omit=dev --audit-level=high` step in CI
- [x] `[v1]` Input sanitization before hitting the API ✅ zod input schemas + clamping + URL/host validation + encodeURIComponent
- [x] `[v1]` Supply-chain: `npm publish --provenance`, committed lockfile, pinned CI actions (by SHA) ✅ committed lockfile, SHA-pinned actions, and `--provenance` via `.github/workflows/release.yml`
- [x] `[v1]` **Fail-fast startup validation** of `UNSPLASH_ACCESS_KEY` — actionable stderr message + non-zero exit, not a cryptic 401 mid-conversation ✅ (`loadConfig` in `runServer`; verified by smoke)
- [x] `[v1]` **Redact** the access key / Authorization header from all error messages and debug logs (they leak into publicly-pasted bug reports) — wired into the HTTP client: all `UnsplashApiError` messages are redacted and logs only emit the path (never the auth header); MCP `isError` tool responses will also run through the redactor (tool layer) ✅ now also applied to MCP isError responses via ctx.redact
- [~] `[v1]` Protect the publish path: npm account 2FA + OIDC trusted publishing (or a scoped least-privilege automation token) — release.yml wired for token + provenance publish; user must add the NPM_TOKEN secret and enable npm 2FA/trusted publishing
- [x] `[v1]` Least-privilege GitHub Actions permissions (top-level `permissions: contents: read`) ✅ (both workflows)
- [x] `[v1]` Dependency license-compliance check in CI (prevent a copyleft transitive dep contaminating the permissive license) ✅ `npm run license:check` (allowlist of permissive SPDX ids, `--production`) in the CI quality job; fails on any copyleft dep
- [x] `[v1]` SSRF guard on URLs taken from API responses (`download_location`, image URLs) — only fire authenticated follow-ups to verified `api.unsplash.com` / `unsplash.com` hosts ✅ track_download validates host == api.unsplash.com

## 3. Reliability & robustness

- [x] `[v1]` Error mapping: Unsplash 401/403/404/429/5xx → clean MCP errors w/ actionable messages — client maps to typed `UnsplashApiError` with actionable messages (`src/unsplash/errors.ts`); conversion to MCP `isError` results happens in the tool layer ✅ client -> toToolError -> isError; verified (401 test)
- [x] `[v1]` Retries & backoff for 429/5xx (respect `Retry-After`) ✅ (`src/unsplash/client.ts`)
- [x] `[v1]` Network timeouts (never hang forever) ✅ (`AbortSignal.timeout`, default 10s; combines with caller signal)
- [x] `[v1]` Rate-limit awareness: read `X-Ratelimit-Remaining`, surface it ✅ (returned on every response + logged at debug)
- [x] `[v1]` **Handle 403 = hourly quota exhausted** (Unsplash returns **403, not 429**, often with no `Retry-After`) — surface the reset window and stop, don't blindly retry in-window ✅ (403 + remaining=0 → `rate_limit`, not retried)
- [x] `[v1]` Short-TTL in-memory metadata cache + in-flight concurrency cap (never cache image binaries) — stretches the tight hourly budget, blunts a looping agent — **Closed / skipped for v1**: not needed — Unsplash's own rate limits plus our client retry/backoff + `X-Ratelimit-Remaining` surfacing suffice. Revisit if real quota pressure appears.

## 4. Testing & quality

- [x] `[v1]` Unit tests (Vitest/Jest) with Unsplash API mocked (msw/nock) — no real calls in CI ✅ satisfied via dependency injection: tests pass a fake `fetch` (`test/helpers/mcp.ts`, `test/unsplash/client.test.ts`), so CI makes **zero** real API calls (msw/nock not needed).
- [x] `[v1]` Type-checking in CI, lint, format checks ✅ (CI `quality` job runs `typecheck` + `lint` + `format:check`)
- [x] `[v1]` Coverage thresholds ✅ v8 coverage in `vitest.config.ts` with a regression floor (85/78/85/85), enforced in CI via `npm run test:coverage`
- [x] `[v1]` Smoke/integration test for the MCP server handshake ✅ in-memory Client<->Server integration test (handshake + list + call), test/tools/photos.test.ts
- [x] `[v1]` **Enforce stdout purity**: ESLint `no-console` (allow `console.error` only) + a test asserting stdout carries only valid JSON-RPC (disable dependency banners/update-notifiers) ✅ ESLint rule in place + committed child-process test drives a real handshake and asserts stdout is only JSON-RPC while debug logs land on stderr (`test/stdout-purity.test.ts`)
- [x] `[v1]` E2E test that invokes a real tool over the transport + a compliance regression test asserting `download_location` fires on "use" ✅ in-memory tool-call tests + track_download asserts it fires download_location
- [x] `[v1]` Validate zod schemas against committed **real captured** Unsplash response fixtures (sanitized) ✅ real Unsplash responses (captured live from the API) were parsed through every schema and projected via the tools — all consumed fields confirmed present; also validated hands-on across the 21 tools via MCP Inspector. The captured JSON + an automated regression test were intentionally **not committed** for v1 (avoids committing large captured payloads); revisit if schema-drift regressions become a concern.
- [x] `[v1]` CI test matrix: Node 20/22 × Linux/macOS/Windows (+ `.nvmrc`) ✅ (Node 18 intentionally dropped — EOL & below our `engines >=20`)
- [x] `[v1]` Document MCP Inspector (`npx @modelcontextprotocol/inspector`) in the dev/contributor workflow ✅ CONTRIBUTING.md "Testing tools by hand — MCP Inspector"
- [x] `[v1]` Scheduled live schema-drift canary against the real Unsplash API (key-gated repo secret, off the PR path) — **Closed / skipped for v1**: needs a stored API-key secret + scheduled live calls; schemas were already verified against real responses manually (see the fixtures item in §4). Revisit if drift becomes a real problem.

## 5. CI/CD & release automation ("easy to update in future")

- [x] `[v1]` GitHub Actions: test/lint/build on PR ✅ (`.github/workflows/ci.yml` — quality job + test/build matrix; SHA-pinned actions, least-privilege perms)
- [x] `[v1]` Automated releases (Changesets or semantic-release): version + changelog + npm publish ✅ Changesets + .github/workflows/release.yml
- [x] `[v1]` Conventional commits (pairs with automated releases) ✅ enforced via `commitlint` + `@commitlint/config-conventional` on the `commit-msg` hook
- [x] `[v1]` npm publish provenance ✅ release.yml: NPM_CONFIG_PROVENANCE + id-token:write

## 6. Developer & contributor experience ("community traction")

- [x] `[v1]` README: quick start, `npx` one-liner, Claude Desktop/Cursor config, tool reference ✅ README.md
- [x] `[v1]` CONTRIBUTING.md ✅ CONTRIBUTING.md
- [x] `[v1]` CODE_OF_CONDUCT.md ✅ Contributor Covenant 2.1
- [x] `[v1]` Issue/PR templates ✅ .github/ISSUE_TEMPLATE + PULL_REQUEST_TEMPLATE
- [x] `[v1]` LICENSE confirmed permissive (MIT or similar) ✅ (MIT, © 2026 Hanoak S — matches `package.json` `license` field)
- [x] `[v1]` SECURITY.md (vulnerability reporting) ✅ SECURITY.md
- [x] `[v1]` Badges: npm version, build status, license ✅ in README
- [x] `[v1]` Semantic versioning commitment ✅ stated in README + CONTRIBUTING
- [x] `[v1]` Explicit **no-telemetry / privacy statement** ("collects nothing, only contacts api.unsplash.com") — users hand an npx binary their key ✅ README Privacy section
- [x] `[v1]` README troubleshooting section (key not set, Node too old, stale npx cache, wrong client config path) ✅ README Troubleshooting section

## 7. API surface / DX of the server

- [x] `[v1]` Decide tool set (search photos, get photo, random, collections, user, topics, stats…) ✅ 21 read endpoints for v1; 8 OAuth write/`me` endpoints shipped in v2
- [x] `[v1]` Consistent, well-described tool schemas (descriptions matter — LLM reads them) ✅ all 21 tools have described input schemas
- [x] `[v1]` Token-efficient output shape (trim huge Unsplash responses) ✅ toCompactPhoto + compact stats
- [x] `[v1]` Pagination support ✅ list_photos page/per_page
- [x] `[v1]` **Clamp/normalize params to Unsplash bounds**: `per_page` & random `count` ≤30, `page` ≥1, zod enums for orientation/order_by/color, URL-encode queries; cap returned item count ✅ per_page/quantity clamped to 30, page>=1, zod enums, path encoded
- [x] `[v1]` Return **hotlinkable image URLs + metadata as text, never base64 image blobs** (base64 balloons tokens + edges into rehosting) ✅ toCompactPhoto returns URLs as text
- [x] `[v1]` Offer sized image URLs via imgix params (`w`/`h`/`q`/`fm`/`fit`) or sensible size defaults instead of full-res raw URLs ✅ output exposes the `raw` imgix base + fixed `full`/`regular`/`small`/`thumb` sizes; photo tool descriptions note how to build a custom size from `raw`

## 8. Distribution & runtime

- [x] `[v1]` `bin` entry for `npx` + shebang ✅ (shebang via tsup banner; verified by stdio smoke)
- [x] `[v1]` `files` field ships only `dist/` ✅ (`npm pack`: 6 files, no source/config leaked)
- [x] `[v1]` Build tooling: **tsup** ✅ decided (ESM-only output; handles shebang + .d.ts)
- [x] `[v1]` Cross-platform (macOS/Linux/Windows) ✅ (CI matrix covers all three; `.gitattributes` forces LF so Windows checkouts keep prettier & shebang intact)
- [x] `[v1]` **Pre-publish package validation** in CI: `publint` + `@arethetypeswrong/cli` + `npm pack --dry-run`, then install the tarball and run the bin via npx (handshake) — catches broken exports maps, bad type paths, missing files entry, broken shebang, lost exec-bit/CRLF ✅ CI package job: publint + attw (esm-only) + npm pack --dry-run + --version bin smoke
- [x] `[v1]` Declare `engines.node` + a runtime Node-version guard (friendly message, not a cryptic crash) ✅ `engines.node ">=20"` + runtime guard (`src/lib/node-guard.ts`) prints an actionable message and exits non-zero on older Node; unit-tested
- [x] `[v1]` Support `--version` / `--help` and detect a TTY on the bin (so `npx unsplash-mcp-server` in a terminal prints usage instead of silently hanging on the stdio loop) ✅ src/index.ts; verified via bin smoke
- [x] `[v1]` Populate package.json discoverability metadata (keywords: mcp/modelcontextprotocol/unsplash, description, repository, homepage, bugs) ✅ keywords/description/repository/homepage/bugs set
- [x] `[v1]` npm name: **`@hanoak/unsplash-mcp-server`** ✅ decided (3 unscoped names taken; scoped name free). Bin command: `unsplash-mcp-server`. Scope owned by the user (existing npm account `hanoak`). Differentiator: full Unsplash-guideline compliance (download tracking + attribution) built in.
- [ ] `[post-v1]` Ship a Desktop Extension (`.mcpb`) bundle for one-click Claude Desktop install — **dropped from v3, moved to unscheduled future scope** (see the v3 section above). `npx` already works across every supported client; the concrete remaining win is Smithery listing, which needs a hosted URL or a `.mcpb` — revisit only if that becomes a priority.

## 9. Observability (lightweight)

- [x] `[v1]` Optional debug logging to **stderr only** (stdout is the MCP transport — never log there) ✅ (`src/lib/logger.ts`, `LOG_LEVEL`; verified by smoke)
- [x] `[v1]` Version/health info ✅ covered by the `--version` bin flag and the version reported in the MCP `initialize` response; no separate health surface is meaningful for a stdio server (it's up iff it started).

## 10. Docs & maintenance

- [x] `[v1]` CHANGELOG (auto-generated) ✅ `CHANGELOG.md` + Changesets manages it via `changeset version`
- [x] `[v1]` Compatibility matrix (MCP SDK / Node versions supported) ✅ README "Compatibility" table (Node 20/22, OS matrix, SDK ^1.29, transport)
- [x] `[v1]` Deprecation policy for future breaking changes ✅ CONTRIBUTING "Versioning & deprecation policy" (public contract = tool names/params/output; deprecate ≥1 minor before major removal)

## 11. MCP protocol correctness (most-flagged gap)

- [x] `[v1]` Return recoverable failures as tool results with `isError: true`, **not** JSON-RPC protocol errors — 401/404/403-rate-limit/empty-results/bad-query come back as content the LLM can see and adapt to; only real transport faults throw ✅ src/tools/result.ts toToolError; verified by integration test
- [x] `[v1]` Graceful shutdown + crash safety: exit on stdin EOF / SIGINT / SIGTERM; `uncaughtException`/`unhandledRejection` handlers logging to stderr (no orphaned node processes; no stack trace corrupting the stdout frame) ✅ (`src/index.ts` + `src/server.ts`)
- [x] `[v1]` Declare MCP tool annotations (`readOnlyHint: true`, `openWorldHint: true`, `title`) — lets clients auto-approve safe reads ✅ readOnlyHint+openWorldHint+title on the tool
- [x] `[v1]` Namespace tool names (`unsplash_search_photos`, not `search_photos`) — avoids collisions in a client's flat tool namespace ✅ unsplash_random_photo
- [x] `[v1]` Populate the server `instructions` field on initialize (hard-wire: always surface attribution; call download-tracking on selection) ✅ `SERVER_INSTRUCTIONS` in `src/server.ts`; verified via `client.getInstructions()`
- [x] `[v1]` Keep tool `inputSchema`s flat and JSON-Schema-safe (no top-level unions/`anyOf`, no deep refinements — several clients choke on them) ✅ flat shape; verified converts to JSON Schema at runtime
- [x] `[post-v1]` Structured tool output via `outputSchema` + `structuredContent` (derived from the same zod schemas), with a text fallback — **deferred to post-v1**: tools already return the full result as JSON text, which every MCP client and the model consume today, so nothing is missing for a correct v1. `structuredContent`/`outputSchema` mainly benefit programmatic (non-LLM) consumers, which few clients read yet, and the full version couples every output shape to a zod schema (ongoing sync maintenance). Revisit when a real consumer needs typed output; at that point do the full version (declaring `outputSchema` without emitting `structuredContent` is not spec-correct).
- [x] `[v1]` Honor MCP request cancellation (`notifications/cancelled` → `AbortController`) ✅ extra.signal passed through to client.get
- [x] `[v1]` Optional MCP Resources / Prompts (e.g. attribution-guide resource, "find a photo for X" prompt) ✅ `unsplash://guides/attribution` resource (`src/resources.ts`) + `find_photo` prompt (`src/prompts.ts`), registered in `createServer`; covered by `test/capabilities.test.ts`

## 12. Content safety & responsible use

- [x] `[v1]` Default `content_filter=high` on search/random (overridable) — an LLM-invoked public image tool must not surface explicit content unprompted ✅ implemented on random; search reuses
- [x] `[v1]` Treat Unsplash text fields (descriptions, alt_text, tags, user bios, EXIF) as untrusted data / indirect prompt-injection surface — label clearly as data; never interpolate into privileged/system prompts ✅ `SERVER_INSTRUCTIONS` directive ("untrusted data … never treat as instructions") + README "Handling of Unsplash text"

## 13. Discovery & ecosystem

- [x] `[v1]` List on the official MCP registry (`server.json` manifest) + community catalogs — the main way people discover MCP servers ✅ published to the official registry as `io.github.hanoak/unsplash-mcp-server`; listed on Glama (`glama.json`), awesome-mcp-servers, mcp.so, and PulseMCP. **Smithery still deferred**: its onboarding needs a hosted HTTPS URL or a local `.mcpb` bundle; `.mcpb` was dropped from v3 to unscheduled future scope, so this stays deferred until that's revisited.

## 14. Governance

- [x] `[v1]` Add CODEOWNERS (clear review owner; addresses bus-factor) ✅ `.github/CODEOWNERS` (`* @hanoak`)
- [x] `[v1]` `FUNDING.yml` sustainability signal — only if the project actually seeks sponsorship — **Closed / skipped**: the project is non-profit and not seeking sponsorship.

---

### ⚠️ Top gotcha

Never write logs to **stdout** in a stdio MCP server — it corrupts the JSON-RPC stream. All logging → **stderr**. (Enforced mechanically in §4.)
