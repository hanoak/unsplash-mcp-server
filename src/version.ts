/**
 * Single source of truth for the package identity. Kept in sync with
 * package.json at release time.
 */
export const PACKAGE_NAME = 'unsplash-mcp-server'
export const PACKAGE_VERSION = '0.0.0'

/** Descriptive User-Agent sent on every Unsplash API request (good-citizen behaviour). */
export const USER_AGENT = `${PACKAGE_NAME}/${PACKAGE_VERSION} (+https://github.com/hanoak/unsplash-mcp-server)`
