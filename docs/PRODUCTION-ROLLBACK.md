# Production rollback (Align)

Two practical ways to recover from a bad deploy. **Database changes are not rolled back** by Git or Vercel alone — handle data separately if migrations ran.

---

## Method A — Vercel: promote a previous deployment

1. Open [Vercel Dashboard](https://vercel.com) → your project.
2. Go to **Deployments**.
3. Find a deployment that worked (same Git **commit** as your checkpoint, or an older green deploy).
4. Open the **⋯** menu on that deployment → **Promote to Production** (wording may vary; on some plans you **Instant Rollback** / promote the previous production deployment).

**Pros:** Fast, no Git ceremony. **Cons:** Requires that an older deployment still exists and is promotable.

---

## Method B — Git tag + redeploy

Checkpoints created by `scripts/checkpoint.ps1` add an annotated tag `prod-baseline-YYYY-MM-DD` (and sometimes `-1`, `-2`, … the same day).

### 1) List tags

```powershell
cd "C:\Projects\Aplicatie Chat"
git fetch --tags origin
git tag -l "prod-baseline-*" --sort=-creatordate
```

### 2) Check out the baseline (read-only / inspection)

```powershell
.\scripts\rollback.ps1
```

Or a specific tag:

```powershell
.\scripts\rollback.ps1 -Tag prod-baseline-2026-03-29
```

### 3) See the commit SHA

```powershell
git rev-parse HEAD
```

Use that SHA in Vercel: find the deployment for that commit and promote it, **or** create a branch from this tag and merge to `main` after review:

```powershell
git switch -c hotfix/revert-to-baseline
git push -u origin hotfix/revert-to-baseline
```

Then open a PR into `main` and merge; Vercel will build from the merged result.

### 4) Match “exact tree” of the tag on `main` (force-align branch)

Only if you intentionally want `main` to match the tag exactly (coordinate with the team; rewrites shared history if you force-push):

```powershell
git checkout main
git reset --hard prod-baseline-2026-03-29
git push origin main --force-with-lease
```

Use `--force-with-lease` only when you understand the impact on collaborators.

---

## Creating a new checkpoint

From repo root, on branch `main`:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\checkpoint.ps1
```

This runs `npx tsc --noEmit`, `npm run lint`, and `npm run build` inside `align-app/`, then commits (if needed), tags, creates `release/prod-baseline-…`, and pushes `main`, the tag, and the release branch to `origin`.
