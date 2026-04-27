// WPS Hub v3 — Multi-tenant build (2026-04-27)
// Backward-compatible: existing /api/* endpoints work but are now scoped to a school.
// School resolved from (1) X-School-Id header, (2) ?school= query, (3) hostname → schools.domain, (4) fallback 'wps'.

const cors = (extra = {}) => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Admin-Email,X-Admin-PIN,X-School-Id,X-Super-Admin-Email,X-Super-Admin-PIN',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
});

const json = (body, status = 200, extra = {}) =>
  new Response(JSON.stringify(body), { status, headers: cors(extra) });

const ok = (data) => json({ ok: true, data });
const err = (msg, status = 400) => json({ ok: false, error: msg }, status);

async function resolveSchool(req, env) {
  const url = new URL(req.url);
  const headerId = req.headers.get('X-School-Id');
  const queryId = url.searchParams.get('school');
  const candidate = headerId || queryId;
  if (candidate) {
    const r = await env.WPS_DB.prepare('SELECT * FROM schools WHERE id = ? OR slug = ?').bind(candidate, candidate).first();
    if (r) return r;
  }
  const host = url.hostname;
  const byDomain = await env.WPS_DB.prepare('SELECT * FROM schools WHERE domain = ?').bind(host).first();
  if (byDomain) return byDomain;
  // Last-resort fallback: WPS (so existing live URL keeps working even if domain row is removed)
  const wps = await env.WPS_DB.prepare("SELECT * FROM schools WHERE id = 'wps'").first();
  return wps;
}

async function isSchoolAdmin(env, schoolId, email, pin) {
  if (!email || !pin) return false;
  if (env.WPS_ADMIN_PIN && pin !== env.WPS_ADMIN_PIN) return false;
  const u = await env.WPS_DB
    .prepare("SELECT role FROM users WHERE email = ? AND school_id = ? AND role = 'admin'")
    .bind(email.toLowerCase(), schoolId).first();
  return !!u;
}

async function isSuperAdmin(env, email, pin) {
  if (!email || !pin) return false;
  if (env.WPS_ADMIN_PIN && pin !== env.WPS_ADMIN_PIN) return false;
  const u = await env.WPS_DB
    .prepare("SELECT super_admin FROM users WHERE email = ? AND super_admin = 1")
    .bind(email.toLowerCase()).first();
  return !!u;
}

async function logAdmin(env, schoolId, action, email, detail = '') {
  try {
    await env.WPS_DB.prepare('INSERT INTO admin_log (action, by_email, detail) VALUES (?, ?, ?)')
      .bind(`${action}@${schoolId}`, email, detail).run();
  } catch (_) {}
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const p = url.pathname;
    const m = req.method;
    if (m === 'OPTIONS') return new Response(null, { status: 204, headers: cors() });

    try {
      if (p === '/api/health') {
        const school = await resolveSchool(req, env);
        return json({ ok: true, version: 'v4-multitenant-2026-04-27', has_db: !!env.WPS_DB, school: school?.id || null, school_name: school?.name || null });
      }

      // ---------- Super-admin (cross-school) ----------
      if (p === '/api/_super/schools' && m === 'GET') {
        if (!(await isSuperAdmin(env, req.headers.get('X-Super-Admin-Email'), req.headers.get('X-Super-Admin-PIN'))))
          return err('super-admin required', 403);
        const r = await env.WPS_DB.prepare('SELECT * FROM schools ORDER BY created_at').all();
        return ok(r.results || []);
      }
      if (p === '/api/_super/schools' && m === 'POST') {
        if (!(await isSuperAdmin(env, req.headers.get('X-Super-Admin-Email'), req.headers.get('X-Super-Admin-PIN'))))
          return err('super-admin required', 403);
        const d = await req.json().catch(() => ({}));
        if (!d.id || !d.name) return err('id + name required');
        await env.WPS_DB.prepare('INSERT INTO schools (id, name, slug, domain, settings_json) VALUES (?,?,?,?,?)')
          .bind(d.id, d.name, d.slug || d.id, d.domain || null, d.settings_json || null).run();
        return ok({ created: d.id });
      }
      if (p === '/api/_super/promote-admin' && m === 'POST') {
        if (!(await isSuperAdmin(env, req.headers.get('X-Super-Admin-Email'), req.headers.get('X-Super-Admin-PIN'))))
          return err('super-admin required', 403);
        const { school_id, email, name = email } = await req.json().catch(() => ({}));
        if (!school_id || !email) return err('school_id + email required');
        const id = `u_${school_id}_${Date.now()}`;
        await env.WPS_DB.prepare("INSERT OR REPLACE INTO users (id, name, email, role, school_id) VALUES (?,?,?,'admin',?)")
          .bind(id, name, email.toLowerCase(), school_id).run();
        return ok({ promoted: email, school_id });
      }

      // ---------- Resolve current school ----------
      const school = await resolveSchool(req, env);
      if (!school) return err('school not configured for this host', 404);
      const sid = school.id;

      // ---------- Admin auth ----------
      if (p === '/api/auth/verify-admin' && m === 'POST') {
        const { pin = '', email = '' } = await req.json().catch(() => ({}));
        const allowed = await isSchoolAdmin(env, sid, email, pin);
        const isSuper = await isSuperAdmin(env, email, pin);
        if (allowed) {
          await logAdmin(env, sid, 'verify-admin', email, isSuper ? 'super+admin' : 'admin');
          return json({ ok: true, role: 'admin', super_admin: isSuper, school: school });
        }
        return json({ ok: false, error: 'invalid' }, 401);
      }

      // ---------- School-scoped reads ----------
      if (p === '/api/bells' && m === 'GET') {
        const r = await env.WPS_DB.prepare("SELECT id,label,time_start,time_end,type FROM bell_times WHERE school_id=? ORDER BY time_start").bind(sid).all();
        return ok(r.results || []);
      }
      if (p === '/api/notices' && m === 'GET') {
        const r = await env.WPS_DB.prepare("SELECT id,text,priority,from_name,from_email,expires_at,created_at FROM notices WHERE school_id=? ORDER BY created_at DESC").bind(sid).all();
        return ok(r.results || []);
      }
      if ((p === '/api/timetable' || p === '/api/timetable/all') && m === 'GET') {
        const r = await env.WPS_DB.prepare('SELECT * FROM timetable WHERE school_id=? ORDER BY day, time_start').bind(sid).all();
        return ok(r.results || []);
      }
      if (p === '/api/users' && m === 'GET') {
        const r = await env.WPS_DB.prepare('SELECT id,name,email,role,super_admin,created_at FROM users WHERE school_id=? ORDER BY name').bind(sid).all();
        return ok(r.results || []);
      }
      if (p === '/api/events' && m === 'GET') {
        const r = await env.WPS_DB.prepare('SELECT * FROM school_events WHERE school_id=? ORDER BY date').bind(sid).all();
        return ok(r.results || []);
      }
      if (p === '/api/school' && m === 'GET') {
        return ok(school);
      }

      // ---------- Notices write ----------
      if (p === '/api/notices' && m === 'POST') {
        const d = await req.json().catch(() => ({}));
        if (!d.text) return err('text required');
        const id = d.id || `n_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        await env.WPS_DB.prepare(
          "INSERT INTO notices (id, school_id, text, priority, from_name, from_email, expires_at) VALUES (?,?,?,?,?,?,?)"
        ).bind(id, sid, d.text, d.priority || 'general', d.from_name || 'Staff', d.from_email || '', d.expires_at || null).run();
        return ok({ id });
      }
      const noticeMatch = p.match(/^\/api\/notices\/([^\/]+)$/);
      if (noticeMatch && m === 'DELETE') {
        await env.WPS_DB.prepare('DELETE FROM notices WHERE id=? AND school_id=?').bind(noticeMatch[1], sid).run();
        return ok({ deleted: noticeMatch[1] });
      }

      // ---------- Timetable write ----------
      const adminEmail = req.headers.get('X-Admin-Email') || '';
      const adminPin = req.headers.get('X-Admin-PIN') || '';

      if (p === '/api/timetable' && m === 'POST') {
        if (!(await isSchoolAdmin(env, sid, adminEmail, adminPin))) return err('admin required', 403);
        const body = await req.json().catch(() => ({}));
        const rows = Array.isArray(body) ? body : Array.isArray(body.rows) ? body.rows : [body];
        const replace = body.replace === true;
        if (replace) await env.WPS_DB.prepare('DELETE FROM timetable WHERE school_id=?').bind(sid).run();
        const stmt = env.WPS_DB.prepare(`
          INSERT OR REPLACE INTO timetable
          (id, school_id, class_name, teacher_email, teacher_name, day, period, time_start, time_end, subject, room, year_level, week_type, updated_at, updated_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'),?)
        `);
        let n = 0;
        for (const r of rows) {
          if (!r || !r.class_name || !r.day) continue;
          const id = r.id || `t_${Date.now()}_${n}_${Math.random().toString(36).slice(2,6)}`;
          await stmt.bind(
            id, sid, r.class_name, r.teacher_email || '', r.teacher_name || '',
            r.day, r.period || '', r.time_start || '', r.time_end || '',
            r.subject || '', r.room || '', r.year_level || '', r.week_type || 'all', adminEmail
          ).run();
          n++;
        }
        await logAdmin(env, sid, 'timetable-write', adminEmail, `rows=${n}, replace=${replace}`);
        return ok({ written: n, replaced: replace });
      }

      const ttMatch = p.match(/^\/api\/timetable\/([^\/]+)$/);
      if (ttMatch && m === 'DELETE' && ttMatch[1] !== 'all') {
        if (!(await isSchoolAdmin(env, sid, adminEmail, adminPin))) return err('admin required', 403);
        await env.WPS_DB.prepare('DELETE FROM timetable WHERE id=? AND school_id=?').bind(ttMatch[1], sid).run();
        await logAdmin(env, sid, 'timetable-delete', adminEmail, ttMatch[1]);
        return ok({ deleted: ttMatch[1] });
      }
      if (p === '/api/timetable/all' && m === 'DELETE') {
        if (!(await isSchoolAdmin(env, sid, adminEmail, adminPin))) return err('admin required', 403);
        await env.WPS_DB.prepare('DELETE FROM timetable WHERE school_id=?').bind(sid).run();
        await logAdmin(env, sid, 'timetable-clear-all', adminEmail);
        return ok({ cleared: true });
      }

      if (p === '/api/admin/log' && m === 'GET') {
        if (!(await isSchoolAdmin(env, sid, adminEmail, adminPin))) return err('admin required', 403);
        const r = await env.WPS_DB.prepare('SELECT * FROM admin_log ORDER BY created_at DESC LIMIT 200').all();
        return ok(r.results || []);
      }

      if (p.startsWith('/api/')) return err('not found', 404);

      // Frontend served below by injection — fall through marker
      return new Response('FRONTEND_INJECT_HERE', { status: 200 });
    } catch (e) {
      return json({ ok: false, error: String(e), stack: e.stack }, 500);
    }
  },
};
