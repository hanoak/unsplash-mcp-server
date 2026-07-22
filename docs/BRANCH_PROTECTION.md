# Branch Protection Setup

One-time GitHub configuration to make `main` protected and force every change
through a pull request with green CI. This is a **repo setting** — it can't be
committed as code; a maintainer with admin access applies it in the GitHub UI.

> Our workflow: work accumulates on the long-lived `feature` branch and is merged
> into `main` periodically via a pull request. Branch protection makes CI + the
> secret scan the authoritative, non-bypassable gate for that merge.

## Required status checks

Add **all** of these as required checks. They appear in the picker only because
the workflows have already run at least once — the names must match exactly, so
if a CI job is renamed later, update this list too.

From the **CI** workflow (`.github/workflows/ci.yml`):

- `Lint, typecheck & format`
- `Test & build (Node 20 / ubuntu-latest)`
- `Test & build (Node 22 / ubuntu-latest)`
- `Test & build (Node 20 / macos-latest)`
- `Test & build (Node 22 / macos-latest)`
- `Test & build (Node 20 / windows-latest)`
- `Test & build (Node 22 / windows-latest)`

From the **Secret scan** workflow (`.github/workflows/secret-scan.yml`):

- `gitleaks`

## Classic branch protection (step by step)

1. Open the repo: `https://github.com/hanoak/unsplash-mcp-server`
2. **Settings** → left sidebar **Branches** (under "Code and automation").
3. Under "Branch protection rules", click **Add rule**.
4. **Branch name pattern:** `main`
5. Enable:
   - **Require a pull request before merging**
     - Require approvals: `0` for a solo maintainer (raise to `1` when others join).
     - Dismiss stale approvals when new commits are pushed (if using approvals).
   - **Require status checks to pass before merging**
     - **Require branches to be up to date before merging**
     - Add every check listed in [Required status checks](#required-status-checks).
   - **Require conversation resolution before merging** (optional).
   - **Require linear history** (optional; pairs well with squash-merge).
   - **Block force pushes** (keep "Allow force pushes" off).
   - **Restrict deletions** (optional).
6. **Do not allow bypassing the above settings**: leave **unchecked** for a solo
   maintainer (so you can admin-merge or hotfix); check it to enforce strictly on
   everyone including admins.
7. Click **Create** / **Save changes**.

## Modern alternative: Rulesets

GitHub also offers **Settings → Rules → Rulesets → New branch ruleset**, which
supersedes classic rules. The toggles map 1:1 to the list above. Set:

- **Target branches:** include `main`
- **Enforcement status:** `Active`
- **Rules:** Require a pull request, Require status checks to pass (add the checks
  above), Block force pushes, Restrict deletions.

## After enabling

- Merging `feature` → `main` now happens via a **pull request**; the merge button
  stays disabled until CI and the secret scan are green.
- Direct pushes to `main` are rejected (this backs the local `pre-commit` guard
  that already refuses commits on `main`).
