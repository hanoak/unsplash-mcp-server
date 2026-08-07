# Security Policy

## Supported versions

The latest released version on npm receives security fixes. This project is pre-1.0; until then, only the most recent release is supported.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately via GitHub's [**"Report a vulnerability"**](https://github.com/hanoak/unsplash-mcp-server/security/advisories/new) (Security → Advisories → Report a vulnerability). Include:

- a description of the issue and its impact,
- steps to reproduce or a proof of concept,
- affected version(s).

We aim to acknowledge reports within a few days, and to release a fix (and a coordinated advisory) as quickly as is practical.

## Handling your Unsplash access key

This server reads your key **only** from the `UNSPLASH_ACCESS_KEY` environment variable and:

- sends it only to `api.unsplash.com`, in the `Authorization` header (never in a URL);
- never writes it to logs (all error output is redacted, and logs go to stderr, not the JSON-RPC stdout stream);
- never persists it anywhere.

If you believe your key was exposed, regenerate it from your [Unsplash app dashboard](https://unsplash.com/oauth/applications).

## Handling the OAuth user token

Running `login` (see the README's [OAuth sign-in](./README.md#oauth-sign-in-optional) section) persists a user access token to `~/.config/unsplash-mcp-server/credentials.json`, with owner-only file permissions (`0600`, directory `0700`). This is the one credential the server stores on disk — the access key and secret key never are. The token is redacted from all error output and logs, same as the access key.

Unsplash user access tokens don't expire on their own, and Unsplash's documentation doesn't describe a way to revoke an already-issued one. If you believe the token was exposed: run `logout` to delete the local copy immediately, and regenerate your app's **secret key** from the [Unsplash app dashboard](https://unsplash.com/oauth/applications) — this at minimum blocks any _new_ logins from succeeding with the old secret. Treat a leaked user token as seriously as a leaked password; if Unsplash later adds an account-level "revoke access" option, use it too.
