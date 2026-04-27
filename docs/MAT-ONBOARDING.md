# WPS Hub — Mat's quick start

Hi Mat — this is the staff hub Paddy's been building for the school. It's live now and ready to test.

## Login

**URL:** https://wps.carnivaltiming.com (later: https://schoolstaffhub.com.au)

1. Tap "Sign in"
2. Enter your name + your `@education.vic.gov.au` email
3. The app stores your sign-in locally on your device. No password yet.

## Becoming an admin

You're already pre-loaded as an admin (alongside Paddy). To unlock admin features:

1. Sign in (as above)
2. Tap "Admin mode" in the More menu
3. Enter PIN: **9999**
4. The PIN sticks for the session. You can change it any time — Paddy will help.

After admin unlock you can:
- Post school-wide notices (urgent / info / general)
- Edit the school timetable (admin → Timetable tab)
- Bulk-clear or replace timetable
- See the admin audit log

Without admin unlock you can still:
- View bell times
- View posted notices (if any)
- View the timetable
- Use everything in the per-teacher tabs (rolls, gradebook, random picker, classes) — these stay local on your device for student-PII reasons.

## What's already in the system

- 10 bell times (Periods 1–6 + recess + lunch + before/after school) — already loaded
- 0 notices, 0 timetable rows — empty so you can start fresh
- 2 admins: you + Paddy

## What's expected of you in week 1

Just kick the tyres. Specifically:

1. **Sign in once** (lets us know it actually loads on your phone/iPad)
2. **Post a test notice** ("Welcome to the new staff hub") — confirms admin auth works for you
3. **Add 1–2 timetable rows** (e.g. your own Period 1 class) — confirms write flow works
4. **Note anything weird** in the More menu's "Send feedback" or text Paddy

Don't worry about importing the full school timetable yet — we'll bulk-import via CSV once the flow is verified.

## Privacy / data

- Per-teacher data (class rolls, marks, student notes) lives **only on your device** in browser storage. Nothing student-related leaves your phone or iPad.
- Shared data (notices, timetable, bell times, school events) lives in a Cloudflare D1 database in Australia (Sydney/Melbourne region).
- No Compass integration, no DET/edu.vic API calls — everything is school-internal.

## Help

- App not loading: hard-refresh (Ctrl-F5 / pull down on iOS) or clear site data.
- Forgotten PIN: ask Paddy. Easy reset.
- Stuck in admin mode: Sign out → sign back in → don't enter PIN.
- Bug or weird behaviour: text Paddy with a screenshot if possible.

## What this isn't (yet)

- No SMS / email notifications
- No CSV class roster import (coming after we verify the basics work)
- No multi-school setup visible to you (the system supports it under the hood, but you only see WPS data)
- No mobile app — it's a web app that installs to your home screen via "Add to Home Screen"
