/**
 * Server/bin identity reported to MCP clients. `PACKAGE_VERSION` is kept in
 * sync with package.json at release time. `PACKAGE_NAME` is the unscoped bin
 * name (`unsplash-mcp-server`) — NOT package.json's scoped `name` field
 * (`@hanoak/unsplash-mcp-server`).
 */
export const PACKAGE_NAME = 'unsplash-mcp-server'
export const PACKAGE_VERSION = '0.0.0'

/** Descriptive User-Agent sent on every Unsplash API request (good-citizen behaviour). */
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION} (+https://github.com/hanoak/unsplash-mcp-server)`
