---
'@hanoak/unsplash-mcp-server': minor
---

Add the 8 OAuth tier-2 (write/`me`) tools, plus a `login`/`logout` CLI command to authorize them.

- New tools: `unsplash_get_my_profile`, `unsplash_update_my_profile`, `unsplash_create_collection`, `unsplash_update_collection`, `unsplash_delete_collection`, `unsplash_add_photo_to_collection`, `unsplash_remove_photo_from_collection`, `unsplash_update_photo`.
- `npx @hanoak/unsplash-mcp-server login` runs a local OAuth authorization-code flow (opens the consent screen, captures the redirect on a short-lived loopback server, exchanges the code) and persists the resulting user access token to `~/.config/unsplash-mcp-server/credentials.json` with owner-only permissions. `logout` removes it. Unsplash user access tokens don't expire, so this is a one-time step.
- New env vars `UNSPLASH_SECRET_KEY` and `UNSPLASH_OAUTH_REDIRECT_URI`, only needed to run `login`.
- The 21 existing read-only tools, and everyone who doesn't run `login`, are unaffected.
