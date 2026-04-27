-- WPS Hub D1 schema (wps-hub-db, uuid d89d5e1b-a9b0-49ad-800d-0cee8f2925b3)
-- Multi-tenant version applied 2026-04-27.
-- Original v3 created the tables without school_id; the migration below adds tenancy.

CREATE TABLE IF NOT EXISTS schools (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  domain        TEXT,                          -- hostname → school resolution
  settings_json TEXT,                          -- per-school config blob
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  role         TEXT DEFAULT 'teacher',         -- 'teacher' | 'admin'
  school_id    TEXT NOT NULL DEFAULT 'wps',    -- FK → schools.id
  super_admin  INTEGER NOT NULL DEFAULT 0,     -- can manage cross-school resources
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school_id);

CREATE TABLE IF NOT EXISTS bell_times (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL DEFAULT 'wps',
  label       TEXT NOT NULL,
  time_start  TEXT NOT NULL,
  time_end    TEXT NOT NULL,
  type        TEXT DEFAULT 'lesson'             -- 'lesson' | 'break' | 'other'
);
CREATE INDEX IF NOT EXISTS idx_bells_school ON bell_times(school_id);

CREATE TABLE IF NOT EXISTS notices (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL DEFAULT 'wps',
  text        TEXT NOT NULL,
  priority    TEXT DEFAULT 'general',           -- 'general' | 'info' | 'urgent'
  from_name   TEXT,
  from_email  TEXT,
  expires_at  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notices_school ON notices(school_id);

CREATE TABLE IF NOT EXISTS timetable (
  id            TEXT PRIMARY KEY,
  school_id     TEXT NOT NULL DEFAULT 'wps',
  class_name    TEXT NOT NULL,
  teacher_email TEXT,
  teacher_name  TEXT,
  day           TEXT NOT NULL,                  -- 'Mon' .. 'Fri'
  period        TEXT,                           -- 'P1' .. 'P6'
  time_start    TEXT,
  time_end      TEXT,
  subject       TEXT,
  room          TEXT,
  year_level    TEXT,
  week_type     TEXT DEFAULT 'all',             -- 'all' | 'A' | 'B'
  updated_at    TEXT DEFAULT (datetime('now')),
  updated_by    TEXT
);
CREATE INDEX IF NOT EXISTS idx_tt_school ON timetable(school_id);

CREATE TABLE IF NOT EXISTS school_events (
  id          TEXT PRIMARY KEY,
  school_id   TEXT NOT NULL DEFAULT 'wps',
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,
  type        TEXT DEFAULT 'event',
  notes       TEXT,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_school ON school_events(school_id);

CREATE TABLE IF NOT EXISTS admin_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  action      TEXT,                            -- "verb@school_id" e.g. "timetable-write@wps"
  by_email    TEXT,
  detail      TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Initial seed (only if not present)
INSERT OR IGNORE INTO schools (id, name, slug, domain) VALUES
  ('wps', 'Williamstown Primary School', 'wps', 'wps.carnivaltiming.com');
