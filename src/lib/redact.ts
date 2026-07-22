/**
 * Secret redaction for logs and error messages.
 *
 * The access key must never reach stderr or an error string a user might paste
 * publicly. These helpers strip a known secret from arbitrary text.
 */

const REDACTED = '[REDACTED]'

// Guard against redacting trivially short secrets, which would mangle unrelated
// text (e.g. a 1-char "secret" replacing every occurrence of that character).
const MIN_SECRET_LENGTH = 4

/** Replace every occurrence of `secret` in `input` with `[REDACTED]`. */
export function redactSecret(input: string, secret: string | undefined): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) return input
  return input.split(secret).join(REDACTED)
}

/** Bind a secret up front, returning a reusable redactor function. */
export function createRedactor(secret: string | undefined): (input: string) => string {
  return (input) => redactSecret(input, secret)
}
