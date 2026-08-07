# Contributing

Thanks for your interest in improving `unsplash-mcp-server`! This guide covers the dev setup and the conventions that keep the codebase consistent.

## Development setup

Requires **Node.js >= 20**.

```bash
git clone https://github.com/hanoak/unsplash-mcp-server.git
cd unsplash-mcp-server
npm install          # also installs git hooks via husky
cp .env.example .env # then add your UNSPLASH_ACCESS_KEY
```

### Scripts

| Command                 | What it does                                                    |
| ----------------------- | --------------------------------------------------------------- |
| `npm run build`         | Bundle to `dist/` with tsup (ESM + shebang + `.d.ts`).          |
| `npm run typecheck`     | `tsc --noEmit` (strict).                                        |
| `npm run lint`          | ESLint (flat config).                                           |
| `npm run format`        | Prettier write.                                                 |
| `npm test`              | Vitest (unit + in-memory MCP integration tests).                |
| `npm run test:coverage` | Vitest with v8 coverage + thresholds (the coverage gate).       |
| `npm run license:check` | Fail if any production dependency has a non-permissive license. |
| `npm run check`         | typecheck + lint + format:check + test (core local gate).       |

### Testing tools by hand — MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) is the quickest way to exercise tools interactively:

```bash
npm run build
npx @modelcontextprotocol/inspector -e UNSPLASH_ACCESS_KEY=your_key node dist/index.js
```

Connect, open the **Tools** tab, and run any tool. Server logs (stderr) appear in the terminal where you launched the Inspector.

## Project structure & conventions

- **One file per resource domain** under `src/tools/` (`photos.ts`, `search.ts`, `users.ts`, `collections.ts`, `topics.ts`, `stats.ts`, `me.ts`). Each file exposes a `register<Domain>Tools(server, ctx)` registrar that `src/tools/index.ts` calls. Adding a tool means editing its domain file — never `server.ts`.
- **Tool input schemas** live in the tool file (zod, kept flat/JSON-Schema-safe). `src/schemas/` is for **Unsplash response/wire schemas only**, and they are intentionally **lenient** (only `id` required; everything else optional/nullable) so upstream field changes degrade gracefully.
- **Errors** are mapped to MCP `isError` results via `src/tools/result.ts` — never thrown as protocol errors. Do not copy-paste error mapping.
- **Tier-2 (write/`me`) tools** call `requireUserToken(ctx)` from `src/tools/result.ts` first — it returns the stored OAuth token or throws the one shared "run login" error. The OAuth flow itself (authorize URL, token exchange, credential store, loopback callback server, `login`/`logout` CLI) lives in `src/auth/`.
- **No secrets in logs.** stdout is the JSON-RPC channel; log only to stderr (`src/lib/logger.ts`). All error text runs through the redactor.
- **`no-explicit-any`** and **`no-console`** (except `console.error`) are enforced by ESLint.

## Commits & branches

- **Conventional Commits** are enforced by a `commit-msg` hook (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:` …).
- A `pre-commit` hook runs gitleaks + `lint-staged` (Prettier + ESLint on staged files) and blocks direct commits to `main`.
- Open pull requests against `main`; CI must pass — lint, typecheck, format, coverage thresholds, a dependency-license check, package validation (`publint` + `attw` + tarball), tests on Node 20/22 × Linux/macOS/Windows, and a gitleaks secret scan.

## Versioning & deprecation policy

This project follows [Semantic Versioning](https://semver.org). **Tool names, input parameters, and output shapes are part of the public contract** — an incompatible change to any of them ships only in a **major** release.

When something must change incompatibly, we deprecate before removing: the old behaviour is kept for at least one subsequent **minor** release, called out in the `CHANGELOG`, and — where possible — flagged in the tool description or via a runtime warning that points to the replacement. Removal then happens in the next major. Additive changes (new tools, new optional fields) are minor and backwards-compatible.

## Code of Conduct

By participating you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).
