import type { Config } from '../config.js'
import { logger } from '../lib/logger.js'
import { createRedactor } from '../lib/redact.js'
import { USER_AGENT } from '../version.js'
import { type RateLimitInfo, UnsplashApiError, type UnsplashErrorKind } from './errors.js'

const DEFAULT_BASE_URL = 'https://api.unsplash.com'
const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RETRIES = 2
const BASE_BACKOFF_MS = 300
const MAX_BACKOFF_MS = 8_000
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504])

export interface UnsplashClientOptions {
  /** Injectable fetch implementation (defaults to the global `fetch`). */
  readonly fetch?: typeof fetch
  readonly baseUrl?: string
  readonly timeoutMs?: number
  readonly maxRetries?: number
  /** Injectable sleep (tests pass a no-op to avoid real backoff delays). */
  readonly sleep?: (ms: number) => Promise<void>
}

export type QueryValue = string | number | boolean | undefined
export type QueryParams = Record<string, QueryValue>

export interface RequestOptions {
  readonly params?: QueryParams
  /** Abort signal from the caller (e.g. MCP cancellation); aborts are not retried. */
  readonly signal?: AbortSignal
  /** Send `Authorization: Bearer <authToken>` instead of the app's `Client-ID`. */
  readonly authToken?: string
}

export type GetOptions = RequestOptions

export interface MutateOptions extends RequestOptions {
  /** JSON-serialized as the request body when present. */
  readonly body?: unknown
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

export interface UnsplashResponse<T = unknown> {
  /** Parsed JSON body. Callers validate the shape with a zod schema. */
  readonly data: T
  readonly rateLimit: RateLimitInfo
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Thin, compliant HTTP client for the Unsplash API. Sends the required headers,
 * enforces a timeout, retries transient failures with backoff, surfaces
 * rate-limit info, and maps failures to a typed {@link UnsplashApiError}.
 *
 * It performs no response validation — callers validate `data` with a zod
 * schema so upstream field changes degrade gracefully.
 */
export class UnsplashClient {
  readonly #accessKey: string
  readonly #fetch: typeof fetch
  readonly #baseUrl: string
  readonly #timeoutMs: number
  readonly #maxRetries: number
  readonly #sleep: (ms: number) => Promise<void>
  readonly #redact: (input: string) => string

  constructor(config: Config, options: UnsplashClientOptions = {}) {
    this.#accessKey = config.accessKey
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.#timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.#maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    this.#sleep = options.sleep ?? defaultSleep
    this.#redact = createRedactor(config.accessKey)
  }

  /** Perform an authenticated GET, retrying transient failures. */
  async get<T = unknown>(path: string, options: GetOptions = {}): Promise<UnsplashResponse<T>> {
    return this.#request<T>('GET', path, options)
  }

  /** Perform an authenticated POST (JSON body), retrying transient failures. */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<UnsplashResponse<T>> {
    return this.#request<T>('POST', path, { ...options, body })
  }

  /** Perform an authenticated PUT (JSON body), retrying transient failures. */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<UnsplashResponse<T>> {
    return this.#request<T>('PUT', path, { ...options, body })
  }

  /** Perform an authenticated DELETE, retrying transient failures. */
  async delete<T = unknown>(path: string, options: GetOptions = {}): Promise<UnsplashResponse<T>> {
    return this.#request<T>('DELETE', path, options)
  }

  async #request<T = unknown>(
    method: HttpMethod,
    path: string,
    options: MutateOptions,
  ): Promise<UnsplashResponse<T>> {
    const url = this.#buildUrl(path, options.params)
    let attempt = 0

    for (;;) {
      try {
        const response = await this.#fetchWithTimeout(method, url, options)
        const rateLimit = readRateLimit(response.headers)

        if (response.ok) {
          const data = await this.#readBody<T>(response)
          logger.debug(
            `${method} ${path} -> ${response.status} (remaining: ${rateLimit.remaining ?? '?'})`,
          )
          return { data, rateLimit }
        }

        if (RETRYABLE_STATUSES.has(response.status) && attempt < this.#maxRetries) {
          const delay = retryDelay(response, attempt)
          attempt += 1
          logger.warn(
            `${method} ${path} -> ${response.status}; retry ${attempt}/${this.#maxRetries} in ${delay}ms`,
          )
          await this.#sleep(delay)
          continue
        }

        throw await this.#mapErrorResponse(response, rateLimit)
      } catch (error) {
        if (error instanceof UnsplashApiError) throw error

        // A caller-initiated abort is never retried.
        if (options.signal?.aborted) {
          throw new UnsplashApiError('network', this.#redact('Request was cancelled'), {
            cause: error,
          })
        }

        const kind: UnsplashErrorKind = isTimeout(error) ? 'timeout' : 'network'
        if (attempt < this.#maxRetries) {
          const delay = backoff(attempt)
          attempt += 1
          logger.warn(
            `${method} ${path} failed (${kind}); retry ${attempt}/${this.#maxRetries} in ${delay}ms`,
          )
          await this.#sleep(delay)
          continue
        }

        const message =
          kind === 'timeout'
            ? `Unsplash request timed out after ${this.#timeoutMs}ms.`
            : 'Unsplash request failed: could not reach the Unsplash API.'
        throw new UnsplashApiError(kind, this.#redact(message), { cause: error })
      }
    }
  }

  #buildUrl(path: string, params?: QueryParams): string {
    const url = new URL(`${this.#baseUrl}${path.startsWith('/') ? path : `/${path}`}`)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
    }
    return url.toString()
  }

  #fetchWithTimeout(method: HttpMethod, url: string, options: MutateOptions): Promise<Response> {
    const timeout = AbortSignal.timeout(this.#timeoutMs)
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout
    const headers: Record<string, string> = {
      // Header form keeps the key/token out of loggable URLs.
      Authorization: options.authToken
        ? `Bearer ${options.authToken}`
        : `Client-ID ${this.#accessKey}`,
      'Accept-Version': 'v1',
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
    }
    const init: RequestInit = { method, headers, signal }
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(options.body)
    }
    return this.#fetch(url, init)
  }

  /** Parse a JSON body, tolerating the empty body that 204 (and some 200) responses send. */
  async #readBody<T>(response: Response): Promise<T> {
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  async #mapErrorResponse(response: Response, rateLimit: RateLimitInfo): Promise<UnsplashApiError> {
    const status = response.status
    const detail = await this.#extractDetail(response)
    const suffix = detail ? `: ${detail}` : ''

    let kind: UnsplashErrorKind
    let message: string

    if (status === 401) {
      kind = 'auth'
      message = `Unsplash rejected the access key (401). Check that UNSPLASH_ACCESS_KEY is valid${suffix}.`
    } else if (status === 403 && rateLimit.remaining === 0) {
      kind = 'rate_limit'
      message = `Unsplash hourly rate limit reached (403, remaining 0). Wait for the hourly window to reset before retrying.`
    } else if (status === 403) {
      kind = 'forbidden'
      message = `Unsplash returned 403 Forbidden${suffix}.`
    } else if (status === 404) {
      kind = 'not_found'
      message = `Unsplash resource not found (404)${suffix}.`
    } else if (status === 429) {
      kind = 'rate_limit'
      message = `Unsplash rate limit hit (429) after ${this.#maxRetries} retries. Try again shortly.`
    } else if (status === 400 || status === 422) {
      kind = 'bad_request'
      message = `Unsplash rejected the request (${status})${suffix}.`
    } else if (status >= 500) {
      kind = 'server'
      message = `Unsplash server error (${status})${suffix}. This is usually transient.`
    } else {
      kind = 'unknown'
      message = `Unsplash request failed (${status})${suffix}.`
    }

    return new UnsplashApiError(kind, this.#redact(message), { status, rateLimit })
  }

  /** Best-effort extraction of Unsplash's `{ "errors": [...] }` body, redacted. */
  async #extractDetail(response: Response): Promise<string> {
    let body: string
    try {
      body = await response.text()
    } catch {
      return ''
    }
    if (!body) return ''
    try {
      const parsed: unknown = JSON.parse(body)
      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'errors' in parsed &&
        Array.isArray((parsed as { errors: unknown }).errors)
      ) {
        const errors = (parsed as { errors: unknown[] }).errors
          .filter((e): e is string => typeof e === 'string')
          .join('; ')
        return this.#redact(errors)
      }
    } catch {
      // Not JSON — fall through to the raw (truncated) body.
    }
    return this.#redact(body.slice(0, 200))
  }
}

function readRateLimit(headers: Headers): RateLimitInfo {
  return {
    limit: parseHeaderInt(headers.get('x-ratelimit-limit')),
    remaining: parseHeaderInt(headers.get('x-ratelimit-remaining')),
  }
}

function parseHeaderInt(value: string | null): number | undefined {
  if (value === null) return undefined
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : undefined
}

function retryDelay(response: Response, attempt: number): number {
  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter !== null) {
      const seconds = Number(retryAfter)
      if (Number.isFinite(seconds) && seconds >= 0) {
        return Math.min(seconds * 1000, MAX_BACKOFF_MS)
      }
    }
  }
  return backoff(attempt)
}

function backoff(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
  const jitter = Math.floor(Math.random() * 100)
  return base + jitter
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError'
}
