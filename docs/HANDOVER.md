# WPS Staff Hub — Single Source of Truth Handover

**Date created:** 2026-04-27 (recovered from scattered references)
**Last recovery:** 2026-04-27 10:33 UTC — v3 hub restored from scratch after migration overwrote it
**Source-of-truth (since 2026-04-27 10:54 UTC):** [`LuckDragonAsgard/wps-hub/docs/HANDOVER.md`](https://github.com/LuckDragonAsgard/wps-hub/blob/main/docs/HANDOVER.md). The Drive copy at `G:\My Drive\🏰 ASGARD\01 Products\WPS Staff Hub\WPS-STAFF-HUB-HANDOVER-EOD.md` is now a redirect stub.
**Project alias used in Cowork:** "WPS Hub"

---

## ✅ RECOVERY COMPLETE — wps.carnivaltiming.com is back online (2026-04-27 10:33 UTC)

The migration broke the v3 hub at 06:46 UTC. Recovered four hours later. Full report at the bottom of this doc.

| Endpoint | Before recovery | After recovery |
|---|---|---|
| `https://wps.carnivaltiming.com/` | 200 — wrong product, broken images | **200 — WPS Hub v3, correct frontend** |
| `https://wps.carnivaltiming.com/api/health` | 200 with HTML body (broken) | **200 `{"ok":true,"version":"v3-restored-2026-04-27","has_db":true}`** |
| `https://wps.carnivaltiming.com/api/bells` | 200 with HTML body | **200 — 10 bell times, all preserved** |
| `https://wps.carnivaltiming.com/api/users` | 200 with HTML body | **200 — Mat + Paddy, both admins, preserved** |
| `POST /api/auth/verify-admin` | non-functional | **works — PIN 9999 + admin email** |
| `POST /api/timetable` (admin) | non-functional | **works — round-trip insert/delete confirmed** |
| `POST /api/notices` | non-functional | **works — round-trip confirmed** |

**Nothing in D1 was lost.** The Vercel→CF migration only stripped the worker's binding to the database, not the database itself. Bell times (10 rows) and admin users (2 rows) read back identical to what was seeded on 2026-04-20.

---

> ⚠️ **Two different products are both called "WPS Hub" / "WPS Staff Hub".** Always confirm which one the conversation is about.

## Two products, both called "WPS Hub"

| | **A. WPS Staff Hub** (CRT/Absence app) | **B. WPS Hub v3** (school management — Paddy's growth product) |
|---|---|---|
| Repo | `LuckDragonAsgard/wps-staff-hub` | `LuckDragonAsgard/wps-hub` |
| Created | 2026-03-25 | 2026-04-21 |
| Last push | **2026-04-27** (security fix — Turso token strip) | **2026-04-27** (full source migration from Drive) |
| Stack | Express + Turso + Twilio + SendGrid (Node, Railway-ready) | Single 71KB HTML PWA + CF Worker w/ D1 backend |
| Purpose | Staff submit absences → system books CRTs over SMS/email | Full iDoceo replacement — classes, roll, gradebook, random picker, lesson planner, school-wide timetable + notices via D1 |
| Hosting timeline | Render → Vercel → snapshot to CF Worker | CF Worker `wps-staff-hub` v3-v5 → overwritten by migration on 2026-04-27 → restored on 2026-04-27 as new worker `wps-hub-v3` |
| **Current live status** | **Parked.** Worker `wps-staff-hub` still serves the broken frontend snapshot at its `*.workers.dev` URL only — no custom domain, no API. Repo HEAD has the leaked token stripped but git history still contains it (Turso dashboard rotation pending). | **✅ LIVE at `wps.carnivaltiming.com`** via `wps-hub-v3` worker. Full API, D1 wired (`wps-hub-db`, uuid `d89d5e1b-...`), admin PIN secret bound. Mat + Paddy are seeded admins. |
| Asgard Project Hub D1 row | id=21, status=parked | id=51, status=live |

---

## Live URLs (working as of 2026-04-27 10:33 UTC, post-recovery)

| URL | Bound to worker | What it serves | Status |
|---|---|---|---|
| **https://wps.carnivaltiming.com/** | `wps-hub-v3` | **Product B v3 — full school management hub w/ working API + D1** | ✅ 200, restored |
| **https://wps-hub-v3.pgallivan.workers.dev/** | `wps-hub-v3` | Same as above (workers.dev mirror) | ✅ 200 |
| **https://wps-staff-hub.pgallivan.workers.dev/** | `wps-staff-hub` (orphaned) | Product A's broken frontend snapshot — kept as backup, no custom domain bound | 200 but broken (use only for reference) |

The backend caveat from earlier is **resolved**. `/api/health`, `/api/bells`, `/api/notices`, `/api/timetable`, `/api/users`, `/api/events`, `/api/auth/verify-admin`, `POST /api/notices`, `POST /api/timetable` (admin) all return JSON, all read+write the live D1.

---

## Where the code lives

### Product B (WPS Hub v3 — live)

| File | Path | Notes |
|---|---|---|
| **Frontend** | [`index.html`](https://github.com/LuckDragonAsgard/wps-hub/blob/main/index.html) — 71 KB | Single-file PWA, vanilla JS, 🏫 emoji logo, no external assets. All `/api/*` calls relative. |
| **Worker (API)** | [`worker.js`](https://github.com/LuckDragonAsgard/wps-hub/blob/main/worker.js) — 8.8 KB | Reconstructed v3 worker. Routes `/api/*` against D1, serves `index.html` for everything else. |
| **Deploy config** | [`wrangler.toml`](https://github.com/LuckDragonAsgard/wps-hub/blob/main/wrangler.toml) | Binding: D1 `wps-hub-db` uuid `d89d5e1b-...`. PIN secret set out-of-band. |
| **CI template** | [`docs/github-actions-deploy.yml`](https://github.com/LuckDragonAsgard/wps-hub/blob/main/docs/github-actions-deploy.yml) | Auto-deploy template. Not yet wired (needs PAT with `workflow` scope, or use CF Workers Builds in dashboard). |
| **Pre-recovery snapshot** | [Release `pre-recovery-2026-04-27`](https://github.com/LuckDragonAsgard/wps-hub/releases/tag/pre-recovery-2026-04-27) | Pinned: broken-snapshot HTML, Product A's static assets, all 6 worker version metadata blobs. |

### Product A (WPS Staff Hub CRT — parked)

| Layer | Location | Notes |
|---|---|---|
| **Repo** | https://github.com/LuckDragonAsgard/wps-staff-hub | Public, default branch `main`, last push 2026-04-27 (security fix). |
| **Frontend** | `public/index.html` (310 KB single file) + `public/sw.js`, `manifest.json`, icons | Vanilla JS PWA. Mammoth.js loaded for .docx ingest. |
| **Backend** | `server.js` (181 KB) | Node 18 Express. 40+ `/api/*` routes (login, login/crt, staff CRUD, etc.). |
| **DB schema** | `schema.sql` | Tables: `users`, `crts`, `crt_preferences`, `crt_unavailable`, `absences`, `notifications`, `sms_log`, `email_log`. |
| **Container** | `Dockerfile` (Node 18 slim) + `railway.json` | Wired for Railway. Not currently deployed. |

**Old repo path:** `https://github.com/PaddyGallivan/wps-staff-hub` — 301-redirects to LuckDragonAsgard.

---

## Database — Turso (libSQL) cloud

```
TURSO_URL = libsql://wps-staff-hub-paddygallivan.aws-us-east-1.turso.io
```

🚨 **CREDENTIAL LEAK — partially mitigated 2026-04-27 10:41 UTC.** A Turso JWT token was hardcoded as a default in `server.js` line ~17 of the **public** GitHub repo. **HEAD has been patched** (commit [`90c9148`](https://github.com/LuckDragonAsgard/wps-staff-hub/commit/90c9148329747f6d45057851ec305ab3374f503f)). The token is **still present in git history**. **Full mitigation requires rotating the token on the Turso dashboard** — manual action.

The CF Worker has **no** Turso secret bound, so the Turso DB is currently orphaned from anything live.

---

## Cloudflare resources

```
Account:   Luck Dragon (Main)  a6f47c17811ee2f8b6caeb8f38768c20

Workers:
  wps-hub-v3      bindings WPS_DB (D1) + WPS_ADMIN_PIN (secret)
                  bound to: wps.carnivaltiming.com + wps-hub-v3.pgallivan.workers.dev
                  source-of-truth: github.com/LuckDragonAsgard/wps-hub
  wps-staff-hub   bindings none — broken Product-A snapshot
                  bound to: wps-staff-hub.pgallivan.workers.dev only

D1:
  wps-hub-db      uuid d89d5e1b-a9b0-49ad-800d-0cee8f2925b3
                  6 user tables (admin_log, bell_times, notices, school_events, timetable, users)
                  + sqlite_sequence + _cf_KV (CF internal)
                  10 bell_times rows + 2 admin users seeded

Custom domains:
  wps.carnivaltiming.com → wps-hub-v3   cert id 4285582d-5ffe-4af0-ad10-0b76d388b0ae
```

---

## 🚨 RESOLVED — The migration overwrote the v3 hub (diagnosed + fixed 2026-04-27)

> Historical record. Resolution: see the "RECOVERY COMPLETE" banner at the top of this doc and the "Recovery log" section below.

**Worker version history of `wps-staff-hub`** (one worker, two completely different products):

| Version | When | Bindings | What it was |
|---|---|---|---|
| v1 | 2026-04-20 11:37 UTC | none | Initial v3 frame |
| v2 | 2026-04-20 12:47 UTC | none | Iteration |
| v3 | 2026-04-20 13:22 UTC | **WPS_DB** (D1 `d89d5e1b-...`) | D1 wired |
| v4 | 2026-04-20 14:51 UTC | WPS_DB | More API routes |
| v5 | 2026-04-20 14:53 UTC | WPS_DB + **WPS_ADMIN_PIN** (secret) | **Full v3 with admin PIN — the working build** |
| v6 | **2026-04-27 06:46 UTC** | **none — bindings stripped** | Vercel→CF migration replaced everything with a 310KB static snapshot of the OLDER CRT/absence app's `public/index.html`. **This was the bug.** |

---

## ✅ RESOLVED — Images not loading (diagnosed + fixed 2026-04-27)

> Historical record. No longer applies — `wps.carnivaltiming.com` now serves Product B (v3 hub), which references zero local images (uses 🏫 emoji as logo).

---

## Open / outstanding work

**For Product B (the v3 hub now live at `wps.carnivaltiming.com`) — no urgent items, only product growth:**

1. **Wire auto-deploy.** Either (a) connect this repo via CF dashboard → Workers → wps-hub-v3 → Settings → Builds (no PAT needed), or (b) `cp docs/github-actions-deploy.yml .github/workflows/deploy.yml` from a clone with a PAT that has `workflow` scope.
2. **Get Mat using it.** v3 PWA login + admin PIN (9999) work. Schedule a 10-min walkthrough.
3. **Rotate the WPS_ADMIN_PIN** from `9999` to a stronger value once Mat has the new PIN. PUT to `/accounts/{acc}/workers/scripts/wps-hub-v3/secrets`.
4. **Move off `wps.carnivaltiming.com`** to a school-neutral domain (`staffhub.com.au`, `schoolstaffhub.com.au`, etc.) before pitching to other schools.
5. **CSV class import flow.** Frontend has the UI; verify it persists to D1 (or stays client-side for student-PII reasons).
6. **Per-school onboarding.** D1 has hardcoded WPS bell times + WPS admins. To sell to other schools, add a `schools` table + per-school scoping.

**For Product A (the CRT/absence app — currently parked):**

1. **Rotate the Turso token** on the Turso dashboard.
2. **Decide: resurrect or retire?** Resurrect = Railway via existing `Dockerfile` + `railway.json`. Retire = archive the repo and delete the `wps-staff-hub` Cloudflare Worker.
3. **End-user docs:** the Product A staff guides are referenced in `docs/README.md` (Drive). Stay in Drive folder `1Vw8wpgqOAwZYmBn6_bK1nhIbqSu_IzaO` until Product A's status is decided.

---

## 📜 Recovery log — 2026-04-27

### Phase 1: Restore wps.carnivaltiming.com (10:24 → 10:33 UTC)

1. **Backed up everything first** to a Drive folder, then later pinned to GitHub release `pre-recovery-2026-04-27`.
2. **Tried six methods to recover v5 worker source** from CF version history. All failed (token scope too narrow). Conclusion: rebuild from scratch.
3. **Deployed `wps-hub-probe`** with the D1 binding to confirm the database wasn't deleted. Found 10 bell times + 2 admins intact.
4. **Reconstructed v3 worker code** by reverse-engineering API surface from `LuckDragonAsgard/wps-hub/index.html` and the D1 schema.
5. **Embedded the v3 frontend HTML** with relative `/api/*` URLs.
6. **Deployed as new worker `wps-hub-v3`** with WPS_DB + WPS_ADMIN_PIN bindings. Kept old `wps-staff-hub` worker as backup.
7. **Repointed `wps.carnivaltiming.com`** → `wps-hub-v3`. New SSL cert auto-issued.
8. **Smoke-tested everything**, including write round-trips. Cleaned up probe worker.

### Phase 2: Source migration off Drive (10:42 → 10:55 UTC)

9. **Moved the staff guide pointer doc** to `01 Products/WPS Staff Hub/docs/README.md`.
10. **Stripped the leaked Turso default token** from `LuckDragonAsgard/wps-staff-hub/server.js` HEAD. (Git history still has it; Turso dashboard rotation pending.)
11. **Updated Asgard Project Hub D1**: row #21 (Product A) marked parked, new row #51 (Product B v3) inserted with current state.
12. **Pushed Product B source to repo** `LuckDragonAsgard/wps-hub`: replaced index.html with relative-URLs version, added worker.js, wrangler.toml, README.md, .gitignore, docs/github-actions-deploy.yml. Removed obsolete vercel.json.
13. **Pinned pre-recovery backup** as GitHub release `pre-recovery-2026-04-27` with three asset attachments (broken HTML snapshot, Product A static assets, worker version metadata).
14. **Canonicalised this handover** into the repo at `docs/HANDOVER.md`. Drive copy is now a redirect stub.

**What was preserved vs lost:**

| | Status |
|---|---|
| D1 database `wps-hub-db` | ✅ Preserved 100% |
| All 6 D1 tables and their contents | ✅ Preserved |
| 10 seeded bell times | ✅ Preserved |
| Mat + Paddy admin users | ✅ Preserved |
| v3 frontend HTML | ✅ In repo (`index.html`) |
| v3 worker code | ⚠️ Original v5 unrecoverable; rebuilt from API surface. Behaviour matches frontend's expectations. |
| Admin PIN | ✅ `9999` (original from Apr 20). Rotate via Workers secrets API. |
| Custom domain SSL cert | ✅ New cert auto-issued during rebind |
| Static assets from Product A | ✅ Pinned in GitHub release `pre-recovery-2026-04-27` |
| Worker version history (Product B v1-v6 metadata) | ✅ Pinned in same GitHub release |
| Broken-HTML snapshot from the bad migration | ✅ Pinned in same GitHub release |
| Drive backup folder | 🗑 Safe to delete (everything pinned to GitHub release) |
| Drive `worker-v3-restored-2026-04-27` folder | 🗑 Safe to delete (in repo as `worker.js`, `index.html`, `wrangler.toml`) |

---

## Quick verification commands

```bash
# Token + account
export CF_TOKEN=cfut_REDACTED
export CF_ACC=a6f47c17811ee2f8b6caeb8f38768c20

# Worker exists & latest deployment
curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACC/workers/services/wps-hub-v3/environments/production" | jq '.result.script | {modified_on, has_modules, handlers}'

# Custom domain bindings
curl -s -H "Authorization: Bearer $CF_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CF_ACC/workers/domains?service=wps-hub-v3" | jq '.result[] | {hostname, enabled}'

# Repo head
curl -s "https://api.github.com/repos/LuckDragonAsgard/wps-hub" | jq '{pushed_at, size, default_branch}'

# Live HTTP
for u in https://wps.carnivaltiming.com/ https://wps.carnivaltiming.com/api/health https://wps-hub-v3.pgallivan.workers.dev/api/bells; do
  echo -n "$u → "; curl -s -o /dev/null -w "%{http_code}\n" --max-time 5 "$u"
done
```
