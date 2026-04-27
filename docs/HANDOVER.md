# WPS Hub — Handover

**Live:** https://wps.carnivaltiming.com (will move to https://schoolstaffhub.com.au once Mat-friendly domain is registered)
**Worker:** `wps-hub-v3` on Cloudflare (Luck Dragon Main account `a6f47c17811ee2f8b6caeb8f38768c20`)
**D1:** `wps-hub-db` uuid `d89d5e1b-a9b0-49ad-800d-0cee8f2925b3`
**Repo (source-of-truth):** https://github.com/LuckDragonAsgard/wps-hub
**Drive footprint:** zero

---

## What the product is

A school management PWA — iDoceo replacement for primary schools. Two layers:

- **Per-school shared (D1):** bell times, notices, school events, school timetable, admin user list. Synced via the Worker's `/api/*` endpoints.
- **Per-teacher local (browser storage only):** class rolls, gradebook marks, student notes, random picker, lesson planner. Never leaves the device — student-PII safe.

Sell-to-schools positioning: each school gets its own row in the `schools` D1 table, isolated data, optional own subdomain.

---

## Architecture

```
                                                 ┌─────────────────────┐
        wps.carnivaltiming.com  ─────────┐       │   Cloudflare D1     │
        schoolstaffhub.com.au   ─────────┤       │   wps-hub-db        │
        (per-school subdomain)  ─────────┤       │   ──────────────    │
                                         ▼       │   schools           │
                          ┌──────────────────┐   │   users             │
                          │  CF Worker       │   │   bell_times        │
                          │  wps-hub-v3      │ ──→   notices           │
                          │  ──────────────  │   │   timetable         │
                          │  resolveSchool() │   │   school_events     │
                          │  /api/* routes   │   │   admin_log         │
                          │  serves index.html │  │   (all school_id)   │
                          └──────────────────┘   └─────────────────────┘
                                         │
                                         ▼
                          ┌──────────────────┐
                          │  PWA frontend    │
                          │  (single 71KB    │
                          │   HTML, vanilla  │
                          │   JS, embedded   │
                          │   in worker)     │
                          └──────────────────┘
```

School resolution priority (in `worker.js` → `resolveSchool`):
1. `X-School-Id` header (admin/dev override)
2. `?school=` query param
3. Hostname → `schools.domain` lookup
4. Fallback to school `wps`

---

## What got done in this session (2026-04-27)

### Phase 1 — Recovery (06:46 broke → 10:33 restored)
The Vercel→CF migration overwrote the v5 worker (which was running Product B v3 with D1 + secret bindings) with a static snapshot of Product A's frontend. Restored by:
- Backing up everything pre-touch
- Verifying D1 was intact via a probe worker
- Reconstructing the v3 worker code from the API surface in the v3 frontend HTML
- Deploying as new worker `wps-hub-v3` with the D1 + PIN bindings rewired
- Repointing `wps.carnivaltiming.com` to it

### Phase 2 — Source migration off Drive (10:42 → 12:00)
- Pushed Product B source to `LuckDragonAsgard/wps-hub` (worker.js, index.html, wrangler.toml, README.md, .gitignore)
- Pinned pre-recovery backup as GitHub release `pre-recovery-2026-04-27` with 3 attachments
- Pushed Product A staff guides into `LuckDragonAsgard/wps-staff-hub/docs/`
- Stripped the leaked Turso default token from public Product A repo HEAD (commit 90c9148)
- Updated Asgard Project Hub D1 (rows #21 + #51)
- **Deleted entire `🏰 ASGARD/01 Products/WPS Staff Hub/` Drive folder**

### Phase 3 — Multi-tenancy + domain (12:14 → )
- D1 migration: added `schools` table, `school_id` columns on every per-school table, `super_admin` flag on users, indexes
- Seeded WPS as the first school; backfilled all existing rows
- Promoted Paddy to super_admin
- Rewrote worker.js as multi-tenant — every query now scoped by school resolved from hostname/header
- Added super-admin endpoints: `GET/POST /api/_super/schools`, `POST /api/_super/promote-admin`
- Verified isolation: created a `demo` school, confirmed reads/writes don't leak across schools, confirmed Mat (non-super) is rejected from super endpoints
- Pre-staged `schoolstaffhub.com.au`: zone added in CF, NS pair issued, apex+www bound to the worker, schools row updated
- Pushed updated worker + new `SCHEMA.sql` to repo

---

## What you (Paddy) still need to do manually

### 1. Register `schoolstaffhub.com.au` (5 min)

Per the standing playbook for `.com.au` domains — VentraIP via vipcontrol.com.au:

1. Log into https://vipcontrol.com.au
2. Domains → Register new → `schoolstaffhub.com.au` (~$20/yr)
3. Once registered: Manage → DNS / Nameservers → Custom nameservers → set:
   - `coraline.ns.cloudflare.com`
   - `renan.ns.cloudflare.com`
4. Wait 5–60 min for NS propagation. CF zone activates automatically.
5. Verify: `dig +short NS schoolstaffhub.com.au @1.1.1.1` should return the CF NS pair, then `https://schoolstaffhub.com.au/` will serve the hub.

The worker is already bound. SSL cert will auto-issue. **Nothing else to do once NS swap completes.**

### 2. Wire CF Workers Builds for auto-deploy (3 min)

The dashboard step that needs your hands (CF API doesn't expose this):

1. https://dash.cloudflare.com → Workers & Pages → `wps-hub-v3`
2. Settings tab → **Build** section
3. "Connect to Git" → authorise GitHub for the Cloudflare app on `LuckDragonAsgard/wps-hub`
4. Branch: `main`. Build command: leave blank. Deploy command: `wrangler deploy`. Root: leave blank.
5. Save. Future pushes to `main` deploy automatically.

### 3. Rotate `WPS_ADMIN_PIN` (1 min) — when Mat is ready for a real PIN

```bash
# Replace 9999 with the new PIN
curl -X PUT \
  -H "Authorization: Bearer <CF_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"WPS_ADMIN_PIN","text":"<NEW_PIN>","type":"secret_text"}' \
  "https://api.cloudflare.com/client/v4/accounts/a6f47c17811ee2f8b6caeb8f38768c20/workers/scripts/wps-hub-v3/secrets"
```

Or via dashboard: Workers → wps-hub-v3 → Settings → Variables and Secrets → edit `WPS_ADMIN_PIN`.

### 4. Walk Mat through the onboarding pack (10 min)

[`docs/MAT-ONBOARDING.md`](MAT-ONBOARDING.md) covers what he needs.

---

## API surface (multi-tenant v4)

All responses are JSON envelope `{ok, data?, error?}`. School resolved per request from hostname (or `X-School-Id` header for testing/admin override).

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/api/health` | open | `{ok, version, has_db, school, school_name}` |
| `GET`  | `/api/school` | open | Current school resolution |
| `POST` | `/api/auth/verify-admin` | `{pin, email}` | Returns `{ok, role, super_admin, school}` |
| `GET`  | `/api/bells` / `/api/notices` / `/api/timetable` / `/api/timetable/all` / `/api/users` / `/api/events` | open (school-scoped) | List |
| `POST` | `/api/notices` | open | Create notice |
| `DELETE` | `/api/notices/:id` | open | Delete notice |
| `POST` | `/api/timetable` | `X-Admin-Email` + `X-Admin-PIN` | Bulk upsert (`{rows:[…], replace:bool}` or array) |
| `DELETE` | `/api/timetable/:id` | admin | Delete row |
| `DELETE` | `/api/timetable/all` | admin | Clear all (school-scoped) |
| `GET`  | `/api/admin/log` | admin | Audit trail |
| `GET`  | `/api/_super/schools` | super-admin (`X-Super-Admin-Email` + `X-Super-Admin-PIN`) | List all schools |
| `POST` | `/api/_super/schools` | super-admin | Create new school `{id, name, slug?, domain?}` |
| `POST` | `/api/_super/promote-admin` | super-admin | Promote user to admin in a school `{school_id, email, name?}` |

---

## Schools state

| id | name | domain | created |
|---|---|---|---|
| `wps` | Williamstown Primary School | schoolstaffhub.com.au | 2026-04-20 |
| `demo` | Demo Primary School | demo.wps.carnivaltiming.com | 2026-04-27 |

(`wps` data: 10 bell times + 2 admin users + the rest empty. `demo` data: 0 across the board, kept for testing isolation.)

---

## Repo files

| File | Purpose |
|---|---|
| `index.html` | 71 KB single-file PWA frontend |
| `worker.js` | CF Worker — multi-tenant routing + API |
| `wrangler.toml` | Deploy config (D1 binding) |
| `SCHEMA.sql` | Authoritative D1 schema for `wps-hub-db` |
| `README.md` | Setup + API + deployment guide |
| `docs/HANDOVER.md` | This file |
| `docs/MAT-ONBOARDING.md` | What Mat needs to know |
| `docs/github-actions-deploy.yml` | Template GH Actions workflow (not yet wired — see CF Workers Builds path above) |
| `.gitignore` | Standard ignores |
| Release `pre-recovery-2026-04-27` | Pinned snapshot of broken state for reference |

---

## Open / next

- Get Mat using it this week. Watch what he hits and what he finds confusing.
- After 1–2 weeks of WPS use, build the per-school onboarding flow (currently new schools require a `POST /api/_super/schools` from a super-admin — needs a UI).
- CSV class roster import — frontend has the UI, verify it persists where intended (probably client-side to keep student PII off D1).
- Marketing/landing page — when ready, host at `schoolstaffhub.com.au/about` or similar.

---

## Quick verification

```bash
# Live
curl -s https://wps.carnivaltiming.com/api/health | jq
curl -s https://wps.carnivaltiming.com/api/users | jq '.data | length'
# Admin auth
curl -s -X POST -H "Content-Type: application/json" \
  -d '{"pin":"9999","email":"paddy.gallivan@education.vic.gov.au"}' \
  https://wps.carnivaltiming.com/api/auth/verify-admin | jq

# After NS swap on schoolstaffhub.com.au:
curl -s https://schoolstaffhub.com.au/api/health | jq
```
