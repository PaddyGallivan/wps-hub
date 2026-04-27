// WPS Hub v3 — Restored 2026-04-27 from frontend API surface + D1 schema.
// Original v5 source unrecoverable from CF version history with current token.
// This rebuild matches every fetch() call observed in
// https://github.com/LuckDragonAsgard/wps-hub/blob/main/index.html.

const cors = (extra = {}) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Email,X-Admin-PIN',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(extra) });

const ok = (data) => json({ ok: true, data });
const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

async function isAdmin(env, email, pin) {
  if (!email || !pin) return false;
  if (env.WPS_ADMIN_PIN && pin !== env.WPS_ADMIN_PIN) return false;
  const u = await env.WPS_DB
    .prepare("SELECT role FROM users WHERE email = ? AND role = 'admin'")
    .bind(email.toLowerCase())
    .first();
  return !!u;
}

async function requireAdmin(req, env) {
  const email = req.headers.get('X-Admin-Email') || '';
  const pin = req.headers.get('X-Admin-PIN') || '';
  return await isAdmin(env, email, pin);
}

async function logAdmin(env, action, email, detail = '') {
  try {
    await env.WPS_DB
      .prepare('INSERT INTO admin_log (action, by_email, detail) VALUES (?, ?, ?)')
      .bind(action, email, detail)
      .run();
  } catch (_) {}
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const m = req.method;

    // CORS preflight
    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

    try {
      // ---------- Health ----------
      if (p === '/api/health') {
        return json({ ok: true, version: 'v3-restored-2026-04-27', has_db: !!env.WPS_DB });
      }

      // ---------- Admin auth ----------
      if (p === '/api/auth/verify-admin' && m === 'POST') {
        const { pin = '', email = '' } = await req.json().catch(() => ({}));
        const allowed = await isAdmin(env, email, pin);
        if (allowed) {
          await logAdmin(env, 'verify-admin', email, 'success');
          return json({ ok: true, role: 'admin' });
        }
        return json({ ok: false, error: 'invalid' }, 401);
      }

      // ---------- Bells ----------
      if (p === '/api/bells' && m === 'GET') {
        const r = await env.WPS_DB.prepare(
          "SELECT id, label, time_start, time_end, type FROM bell_times ORDER BY time_start"
        ).all();
        return ok(r.results || []);
      }

      // ---------- Notices ----------
      if (p === '/api/notices' && m === 'GET') {
        const r = await env.WPS_DB.prepare(
          "SELECT id, text, priority, from_name, from_email, expires_at, created_at FROM notices ORDER BY created_at DESC"
        ).all();
        return ok(r.results || []);
      }

      if (p === '/api/notices' && m === 'POST') {
        const d = await req.json().catch(() => ({}));
        if (!d.text) return err('text required');
        const id = d.id || `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        await env.WPS_DB
          .prepare(
            "INSERT INTO notices (id, text, priority, from_name, from_email, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
          )
          .bind(
            id,
            d.text,
            d.priority || 'general',
            d.from_name || 'Staff',
            d.from_email || '',
            d.expires_at || null
          )
          .run();
        return ok({ id });
      }

      const noticeMatch = p.match(/^\/api\/notices\/([^\/]+)$/);
      if (noticeMatch && m === 'DELETE') {
        await env.WPS_DB
          .prepare('DELETE FROM notices WHERE id = ?')
          .bind(noticeMatch[1])
          .run();
        return ok({ deleted: noticeMatch[1] });
      }

      // ---------- Timetable ----------
      if (p === '/api/timetable' && m === 'GET') {
        // Caller's own classes only? Frontend uses /timetable/all separately, so this returns
        // either everything or filtered by ?email=. We'll return all rows; frontend filters client-side.
        const r = await env.WPS_DB.prepare(
          "SELECT * FROM timetable ORDER BY day, time_start"
        ).all();
        return ok(r.results || []);
      }

      if (p === '/api/timetable/all' && m === 'GET') {
        const r = await env.WPS_DB.prepare(
          "SELECT * FROM timetable ORDER BY day, time_start"
        ).all();
        return ok(r.results || []);
      }

      if (p === '/api/timetable' && m === 'POST') {
        if (!(await requireAdmin(req, env))) return err('admin required', 403);
        const email = req.headers.get('X-Admin-Email') || '';
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows : [body];
        const replace = body.replace === true;

        if (replace) {
          await env.WPS_DB.prepare('DELETE FROM timetable').run();
        }

        const stmt = env.WPS_DB.prepare(`
          INSERT OR REPLACE INTO timetable
          (id, class_name, teacher_email, teacher_name, day, period, time_start, time_end, subject, room, year_level, week_type, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
        `);

        let n = 0;
        for (const r of rows) {
          if (!r || !r.class_name || !r.day) continue;
          const id = r.id || `t_${Date.now()}_${n}_${Math.random().toString(36).slice(2, 6)}`;
          await stmt
            .bind(
              id,
              r.class_name,
              r.teacher_email || '',
              r.teacher_name || '',
              r.day,
              r.period || '',
              r.time_start || '',
              r.time_end || '',
              r.subject || '',
              r.room || '',
              r.year_level || '',
              r.week_type || 'all',
              email
            )
            .run();
          n++;
        }
        await logAdmin(env, 'timetable-write', email, `rows=${n}, replace=${replace}`);
        return ok({ written: n, replaced: replace });
      }

      const ttMatch = p.match(/^\/api\/timetable\/([^\/]+)$/);
      if (ttMatch && m === 'DELETE' && ttMatch[1] !== 'all') {
        if (!(await requireAdmin(req, env))) return err('admin required', 403);
        await env.WPS_DB
          .prepare('DELETE FROM timetable WHERE id = ?')
          .bind(ttMatch[1])
          .run();
        await logAdmin(env, 'timetable-delete', req.headers.get('X-Admin-Email') || '', ttMatch[1]);
        return ok({ deleted: ttMatch[1] });
      }

      if (p === '/api/timetable/all' && m === 'DELETE') {
        if (!(await requireAdmin(req, env))) return err('admin required', 403);
        await env.WPS_DB.prepare('DELETE FROM timetable').run();
        await logAdmin(env, 'timetable-clear-all', req.headers.get('X-Admin-Email') || '');
        return ok({ cleared: true });
      }

      // ---------- Users (read-only listing for admin convenience) ----------
      if (p === '/api/users' && m === 'GET') {
        const r = await env.WPS_DB
          .prepare('SELECT id, name, email, role, created_at FROM users ORDER BY name')
          .all();
        return ok(r.results || []);
      }

      // ---------- School events (bonus, schema exists) ----------
      if (p === '/api/events' && m === 'GET') {
        const r = await env.WPS_DB
          .prepare('SELECT * FROM school_events ORDER BY date')
          .all();
        return ok(r.results || []);
      }

      // ---------- Admin log ----------
      if (p === '/api/admin/log' && m === 'GET') {
        if (!(await requireAdmin(req, env))) return err('admin required', 403);
        const r = await env.WPS_DB
          .prepare('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 200')
          .all();
        return ok(r.results || []);
      }

      // ---------- Default: serve frontend ----------
      // Static assets are bound separately on the deployed worker (has_assets:true).
      // If a static-asset bundle is attached, CF serves those automatically and this handler
      // only sees /api/* paths. If not, return 404 JSON for unmatched API paths so the
      // frontend's failure mode is "JSON error" instead of "HTML in JSON.parse".
      if (p.startsWith('/api/')) return err('not found', 404);

      // Fall-through (no asset binding): return a 404 for non-API paths.
      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return json({ ok: false, error: String(e), stack: e.stack }, 500);
    }
  },
};
