/**
 * Classification of a failed Unsplash request. The tool layer maps these to
 * MCP `isError` results with actionable messages the model can act on.
 */
export type UnsplashErrorKind =
  | 'auth' // 401 — bad/rejected access key
  | 'forbidden' // 403 that is NOT a rate-limit
  | 'rate_limit' // 403 with remaining=0 (hourly quota) or 429 (too many requests)
  | 'not_found' // 404
  | 'bad_request' // 400 / 422 — invalid parameters
  | 'server' // 5xx — usually transient
  | 'timeout' // request exceeded the client timeout
  | 'network' // fetch failed / connection error / cancelled
  | 'unknown' // anything else

export interface RateLimitInfo {
  /** `X-Ratelimit-Limit` header, if present. */
  readonly limit: number | undefined
  /** `X-Ratelimit-Remaining` header, if present. */
  readonly remaining: number | undefined
}

export interface UnsplashApiErrorOptions {
  readonly status?: number
  readonly rateLimit?: RateLimitInfo
  readonly cause?: unknown
}

/**
 * Error thrown by {@link UnsplashClient} for any failed request. Messages are
 * already secret-redacted by the client before construction.
 */
export class UnsplashApiError extends Error {
  readonly kind: UnsplashErrorKind
  readonly status: number | undefined
  readonly rateLimit: RateLimitInfo | undefined

  constructor(kind: UnsplashErrorKind, message: string, options: UnsplashApiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = 'UnsplashApiError'
    this.kind = kind
    this.status = options.status
    this.rateLimit = options.rateLimit
  }
}
