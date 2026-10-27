// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مهمات في قلب العمل (P12-أ) — واجهة المتدرب والطاقم (تسجيل دخول)
 *  GET                        → مهماتي + إحصاء أدلتي من قلب العمل
 *  GET ?admin=1               → (STAFF) القوالب + المهمات (آخر 400) + البرامج + المهارات + الإحصاءات
 *  GET ?admin=1&completers=PID&template=TID → (STAFF) مُتمّو البرنامج (شهادة إتمام) الذين لم تُسند لهم هذه المهمة
 *  POST (STAFF): template_save | template_delete | suggest {program_id} | assign {template_id, emails[]} | decide {id, decision, note} | remind {id} | cycle {dry}
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { normalizeSite } from '../../../lib/portal/open';
import { MISSION_COLS, assignMission, decideMission, runMissionCycle, mail } from '../../../lib/portal/missions-cron';
import { transferStats, starterFor, suggestPrompt, parseSuggest, templatePayload, validateTemplate, reminderMailHtml, missionUrl } from '../../../lib/portal/missions';
import type { Mission, MissionTemplate, TemplateForm } from '../../../lib/portal/missions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, role, staff: STAFF.includes(role) };
}
const strip = (m: Mission) => { const { confirm_token: _c, ...rest } = m; return rest; };

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, staff } = c;
  const u = new URL(req.url);
  if (u.searchParams.get('admin') === '1') {
    if (!staff) return bad('غير مصرّح', 403);
    const completers = u.searchParams.get('completers');
    if (completers) {
      const tpl = u.searchParams.get('template');
      const { data: creds } = await db.from('portal_credentials').select('email,full_name,user_id,issued_at').eq('kind', 'program_completion').eq('program_id', completers).is('revoked_at', null).order('issued_at', { ascending: false }).limit(500);
      const have = new Set<string>(); if (tpl) { const { data: done } = await db.from('portal_missions').select('email').eq('template_id', tpl); for (const x of (done || []) as any[]) have.add(String(x.email).toLowerCase()); }
      const seen = new Set<string>(); const people = ((creds || []) as any[]).filter(x => { const e = String(x.email || '').toLowerCase(); if (!e || seen.has(e)) return false; seen.add(e); return true; }).map(x => ({ email: String(x.email).toLowerCase(), full_name: x.full_name, user_id: x.user_id, issued_at: x.issued_at, assigned: have.has(String(x.email).toLowerCase()) }));
      return NextResponse.json({ success: true, people });
    }
    const [{ data: tpls }, { data: ms }, { data: programs }, { data: skills }] = await Promise.all([
      db.from('portal_mission_templates').select('*').order('created_at', { ascending: false }),
      db.from('portal_missions').select(MISSION_COLS).order('created_at', { ascending: false }).limit(400),
      db.from('programs').select('id,name_ar').order('name_ar'),
      db.from('portal_skills').select('id,code,name_ar,name_en,domain').eq('active', true).order('code'),
    ]);
    return NextResponse.json({ success: true, templates: tpls || [], missions: (ms || []), programs: programs || [], skills: skills || [], stats: transferStats((ms || []) as Mission[]) });
  }
  const { data: ms } = await db.from('portal_missions').select(MISSION_COLS).or(`user_id.eq.${user.id},email.ilike.${user.email}`).order('created_at', { ascending: false }).limit(100);
  const rows = ((ms || []) as Mission[]).map(strip); const ids = Array.from(new Set(rows.flatMap(m => m.skills || [])));
  const { data: skills } = ids.length ? await db.from('portal_skills').select('id,code,name_ar,name_en,domain').in('id', ids) : { data: [] as any[] };
  return NextResponse.json({ success: true, missions: rows, skills: skills || [], stats: transferStats(ms || []) });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, role, staff } = c;
  if (!staff) return bad('غير مصرّح', 403);
  const body = await req.json().catch(() => ({})); const action = String(body.action || '');
  if (action === 'template_save') {
    const f = body.form as TemplateForm; const why = validateTemplate(f); if (why) return bad(why);
    const payload = { ...templatePayload(f), created_by: user.id };
    if (body.id) { const { data, error } = await db.from('portal_mission_templates').update(payload).eq('id', body.id).select('*').single(); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, template: data }); }
    const { data, error } = await db.from('portal_mission_templates').insert(payload).select('*').single(); if (error) return bad(error.message, 500); return NextResponse.json({ success: true, template: data });
  }
  if (action === 'template_delete') { const { error } = await db.from('portal_mission_templates').delete().eq('id', String(body.id || '')); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  if (action === 'suggest') {
    const pid = String(body.program_id || ''); const { data: p } = pid ? await db.from('programs').select('id,name_ar,description').eq('id', pid).maybeSingle() : { data: null as any };
    let skills: any[] = []; if (pid) { const { data: ps } = await db.from('portal_program_skills').select('skill_id').eq('program_id', pid); const ids = ((ps || []) as any[]).map(x => x.skill_id); if (ids.length) { const { data: sk } = await db.from('portal_skills').select('id,name_ar,domain').in('id', ids); skills = sk || []; } }
    const domains = Array.from(new Set(skills.map(s => s.domain))); const local = () => starterFor(domains);
    if (!p) return NextResponse.json({ success: true, templates: local(), source: 'local', skill_ids: [] });
    const { system, user: prompt } = suggestPrompt(p as any, skills);
    const r = await runAi({ system, user: prompt, parse: parseSuggest, local, budgetMs: 25000, fast: true });
    await logAi(db, { user_id: user.id, email: user.email, role, purpose: 'mission_suggest' as any, result: r, context: { program_id: pid } });
    return NextResponse.json({ success: true, templates: r.data, source: r.source, skill_ids: skills.map(s => s.id) });
  }
  if (action === 'assign') {
    const { data: tpl } = await db.from('portal_mission_templates').select('*').eq('id', String(body.template_id || '')).maybeSingle(); if (!tpl) return bad('القالب غير موجود', 404);
    const emails = Array.isArray(body.emails) ? body.emails.map((e: any) => String(e || '').toLowerCase().trim()).filter((e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)).slice(0, 200) : [];
    if (!emails.length) return bad('لا توجد عناوين بريد صالحة');
    const names: Record<string, { full_name?: string | null; user_id?: string | null }> = {};
    const { data: creds } = await db.from('portal_credentials').select('email,full_name,user_id').in('email', emails); for (const x of (creds || []) as any[]) names[String(x.email).toLowerCase()] = x;
    const { data: pg } = (tpl as MissionTemplate).program_id ? await db.from('programs').select('name_ar').eq('id', (tpl as MissionTemplate).program_id).maybeSingle() : { data: null as any };
    let created = 0, skipped = 0; for (const e of emails) { const m = await assignMission(db, tpl as MissionTemplate, { email: e, full_name: names[e]?.full_name || body.names?.[e] || null, user_id: names[e]?.user_id || null }, site(), { programName: (pg as any)?.name_ar || null }); if (m) created++; else skipped++; }
    return NextResponse.json({ success: true, created, skipped });
  }
  if (action === 'decide') {
    const { data: m } = await db.from('portal_missions').select(MISSION_COLS).eq('id', String(body.id || '')).maybeSingle(); if (!m) return bad('المهمة غير موجودة', 404);
    if ((m as Mission).status !== 'submitted') return bad('لا يوجد دليل مُرسل بانتظار القرار');
    const decision = body.decision === 'returned' ? 'returned' : 'confirmed'; const note = String(body.note || '').slice(0, 600);
    if (decision === 'returned' && note.length < 5) return bad('اكتب ملاحظة للمتدرب عند الإعادة');
    const r = await decideMission(db, m as Mission, decision, { name: user.name || user.email, note }, site());
    return NextResponse.json({ success: true, mission: strip(r) });
  }
  if (action === 'remind') {
    const { data: m } = await db.from('portal_missions').select(MISSION_COLS).eq('id', String(body.id || '')).maybeSingle(); if (!m) return bad('المهمة غير موجودة', 404);
    const ok = await mail((m as Mission).email, reminderMailHtml(m as Mission, missionUrl(site(), (m as Mission).token))); if (ok) await db.from('portal_missions').update({ reminders: ((m as Mission).reminders || 0) + 1, sent_at: (m as Mission).sent_at || new Date().toISOString() }).eq('id', (m as Mission).id);
    return NextResponse.json({ success: true, mailed: ok, url: missionUrl(site(), (m as Mission).token) });
  }
  if (action === 'cycle') { const r = await runMissionCycle(db, site(), { dry: body.dry !== false }); return NextResponse.json({ success: true, ...r }); }
  return bad('إجراء غير معروف');
}
