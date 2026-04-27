# WPS Hub v3 — School Management Platform

Live: https://wps.carnivaltiming.com (custom domain on `wps-hub-v3` Cloudflare Worker)

A single-file PWA + Cloudflare Worker + D1 backend. iDoceo-style classroom management for primary schools, designed to be onboarded school-by-school.

## What's in here

| File | Role |
|---|---|
| `index.html` | The whole frontend. ~71 KB, vanilla JS, no framework, registers a service worker. All API calls are relative (`/api/*`) so it works on any domain. |
| `worker.js` | Cloudflare Worker. Serves `index.html` at any non-`/api/*` path; handles `/api/*` against D1 (`WPS_DB`) and a secret PIN (`WPS_ADMIN_PIN`). |
| `wrangler.toml` | CF deploy config. Binding: D1 `wps-hub-db` (uuid `d89d5e1b-a9b0-49ad-800d-0cee8f2925b3`). Secret is set out-of-band. |
| `docs/github-actions-deploy.yml` | Template GH Actions workflow. To enable auto-deploy, copy to `.github/workflows/deploy.yml` from a token with `workflow` scope, or connect this repo via the Cloudflare dashboard → Workers → wps-hub-v3 → Settings → Build (CF Workers Builds, no PAT needed). |

## Architecture

```
                  wps.carnivaltiming.com
                          │
                  ┌───────▼────────┐
                  │  CF Worker     │
                  │  wps-hub-v3    │
                  │  ─────────────  │
                  │  / → index.html │  (single-file PWA)
                  │  /api/* → routes│
                  └───────┬────────┘
                          │
                  ┌───────▼────────┐
                  │  D1: wps-hub-db │
                  │  ─────────────  │
                  │  users          │  ← admin auth list
                  │  bell_times     │  ← school timetable framework
                  │  timetable      │  ← per-class slots
                  │  notices        │  ← school-wide notices
                  │  school_events  │  ← carnivals, etc
                  │  admin_log      │  ← audit
                  └─────────────────┘
```

Per-teacher data (rolls, gradebook, student notes) is intentionally kept client-side in `localStorage` for student-PII reasons — see the data-locality discussion in [the parent product handover](https://drive.google.com/) (Drive: `🏰 ASGARD/01 Products/WPS Staff Hub/WPS-STAFF-HUB-HANDOVER-EOD.md`).

## API surface

All responses are JSON with envelope `{ok: bool, data?, error?}`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | open | `{ok, version, has_db}` |
| `POST` | `/api/auth/verify-admin` | `{pin, email}` | Verify admin (PIN matches `WPS_ADMIN_PIN` AND email is in `users` with `role='admin'`) |
| `GET` | `/api/bells` | open | Bell schedule |
| `GET` | `/api/notices` | open | All notices, newest first |
| `POST` | `/api/notices` | open | `{text, priority?, from_name?, from_email?, expires_at?}` |
| `DELETE` | `/api/notices/:id` | open | Delete |
| `GET` | `/api/timetable` | open | All timetable slots |
| `GET` | `/api/timetable/all` | open | Same |
| `POST` | `/api/timetable` | `X-Admin-Email` + `X-Admin-PIN` | Bulk upsert; `{rows:[…], replace:bool}` or array body |
| `DELETE` | `/api/timetable/:id` | admin | Delete row |
| `DELETE` | `/api/timetable/all` | admin | Clear all |
| `GET` | `/api/users` | open | List of users (no PIN data) |
| `GET` | `/api/events` | open | School events |
| `GET` | `/api/admin/log` | admin | Audit trail |

## Deployment

```bash
# One-off (or first time)
echo "$CF_API_TOKEN" | wrangler login   # or set CLOUDFLARE_API_TOKEN env
wrangler deploy
# Set the secret (only needed once, or to rotate)
echo "9999" | wrangler secret put WPS_ADMIN_PIN
```

Auto-deploy is **not yet wired** — see the deploy section below.

To bind a custom domain: CF dash → Workers → `wps-hub-v3` → Triggers → Add Custom Domain.



### Wiring auto-deploy

Two paths, pick one:

**Option A — Cloudflare Workers Builds** (simplest, no GitHub PAT scope needed)
1. CF dash → Workers & Pages → `wps-hub-v3` → Settings → **Builds**
2. Connect GitHub → authorise `LuckDragonAsgard/wps-hub`
3. Build command: leave blank. Deploy command: `wrangler deploy`. Branch: `main`.
4. Save. Every push triggers a build.

**Option B — GitHub Actions** (needs a PAT with `workflow` scope)
1. Create a fine-grained PAT with `Actions: Read+Write` and `Contents: Read+Write` for this repo.
2. Add it as repo secret `CF_API_TOKEN`.
3. `cp docs/github-actions-deploy.yml .github/workflows/deploy.yml` from a clone, push.
4. Every push triggers a build.

Until either is wired, deploy manually with `wrangler deploy` from a checkout.

## Recovery history

- **2026-04-20** — built original v3 (worker code + D1 + admin PIN + frontend) in a Claude session.
- **2026-04-27 06:46 UTC** — Vercel→CF migration accidentally overwrote the worker, stripping all bindings. Production broke for ~4 hours.
- **2026-04-27 10:33 UTC** — restored. v3 worker code rebuilt from scratch (original v5 source unrecoverable from CF version-history with the available token); D1 data fully intact and reused; new worker deployed as `wps-hub-v3`; custom domain re-bound.
- **2026-04-27 10:5x UTC** — moved source from Drive into this repo as the new source-of-truth.

Pre-recovery snapshot of the broken state (worker version metadata, the broken HTML) is attached to the GitHub Release `pre-recovery-2026-04-27`.
