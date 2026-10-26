// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — واجهة التوأم المهاري (P11)
 *  GET  (Bearer)                 → حزمة التوأم للمتعلم: مستويات المهارات بأدلتها + تعريف المهارات + خيارات المسار (برامج مفتوحة، محاكيات، جلسات) + شهاداته
 *  GET  ?admin=1[&org=ID] (STAFF أو مدير جهة) → صفوف المستويات لأعضاء الجهة (أو الجميع للموظفين) + المهارات + الجهات + مشتركو الشهادات
 *  POST (Bearer) { action:'export' }                → تصدير توأم المتعلم كاملًا (JSON) — حق المتعلم في بياناته
 *       { action:'forget', confirm:'امحُ توأمي' }   → محو أحداث التعلّم ومستويات المهارات (لا يمسّ الشهادات الصادرة)
 *       { action:'live', credential_id, enabled }   → تشغيل/إيقاف «الشهادة الحية» لشهادة يملكها
 *  الحساب كله يجري في المتصفح/الاختبارات بدوال lib/portal/twin.ts؛ هذا المسار يجمع البيانات فقط.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const SKILL_COLS = 'id,code,name_ar,name_en,domain,level,saqf_level,cefr_level,sdaia_code,active';
const LEVEL_COLS = 'user_id,skill_id,computed_level,confidence,evidence,approved_level,approved_at,updated_at';

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

/** خيارات المسار من الكتالوج: برامج مفتوحة (بمهاراتها)، محاكيات منشورة، جلسات عامة قادمة */
async function pathOptions(db: any) {
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: programs }, { data: links }, { data: scenarios }, { data: sessions }] = await Promise.all([
    db.from('programs').select('id,name_ar,name_en,start_date,end_date,fee,hours,registration_open,is_public,archived_at').eq('is_public', true).is('archived_at', null).gte('end_date', today).order('start_date').limit(60),
    db.from('portal_program_skills').select('program_id,skill_id,weight').limit(600),
    db.from('portal_scenarios').select('id,slug,title_ar,title_en,skills,minutes,status').eq('status', 'published').limit(60),
    db.from('portal_sessions').select('id,title_ar,title_en,starts_at,skills,access,status').eq('access', 'public').neq('status', 'cancelled').gte('starts_at', new Date().toISOString()).order('starts_at').limit(30),
  ]);
  const bySkill = new Map<string, { skill_id: string; weight: number }[]>();
  for (const l of (links || []) as any[]) { if (!bySkill.has(l.program_id)) bySkill.set(l.program_id, []); bySkill.get(l.program_id)!.push({ skill_id: l.skill_id, weight: Number(l.weight) || 1 }); }
  return {
    programs: ((programs || []) as any[]).map(p => ({ ...p, skills: bySkill.get(p.id) || [] })).filter(p => p.skills.length),
    scenarios: ((scenarios || []) as any[]).map(s => ({ id: s.id, slug: s.slug, title_ar: s.title_ar, title_en: s.title_en, skills: s.skills || [], minutes: Number(s.minutes) || 5 })),
    sessions: ((sessions || []) as any[]).map(s => ({ id: s.id, title_ar: s.title_ar, title_en: s.title_en, starts_at: s.starts_at, skills: s.skills || [] })),
  };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user, staff } = c;
  const url = new URL(req.url);
  if (url.searchParams.get('admin') === '1') {
    let org = String(url.searchParams.get('org') || '');
    if (!staff) { // مدير جهة: جهته فقط
      const { data: m } = await db.from('portal_org_members').select('organization_id').eq('user_id', user.id).eq('role', 'org_admin').eq('status', 'confirmed').limit(1).maybeSingle();
      if (!m) return bad('غير مصرّح', 403); org = String((m as any).organization_id);
    }
    let userIds: string[] | null = null;
    if (org) { const { data: ms } = await db.from('portal_org_members').select('user_id').eq('organization_id', org).eq('status', 'confirmed').limit(2000); userIds = ((ms || []) as any[]).map(x => x.user_id).filter(Boolean); }
    let q = db.from('portal_skill_levels').select(LEVEL_COLS).limit(5000); if (userIds) q = userIds.length ? q.in('user_id', userIds) : q.in('user_id', ['00000000-0000-0000-0000-000000000000']);
    const [{ data: levels }, { data: skills }, { data: orgs }, { data: watchers }] = await Promise.all([
      q, db.from('portal_skills').select(SKILL_COLS).limit(500), staff ? db.from('portal_organizations').select('id,name_ar,name_en,sector').eq('active', true).order('name_ar').limit(300) : Promise.resolve({ data: [] }),
      staff ? db.from('portal_credential_watchers').select('id,created_at,email,name,organization,last_notified_at,unsubscribed_at,credential:portal_credentials(verify_code,title_ar,full_name)').order('created_at', { ascending: false }).limit(300) : Promise.resolve({ data: [] }),
    ]);
    return NextResponse.json({ success: true, org, levels: levels || [], skills: skills || [], organizations: orgs || [], watchers: watchers || [], staff });
  }
  const [{ data: levels }, { data: creds }, opts] = await Promise.all([
    db.from('portal_skill_levels').select(LEVEL_COLS).eq('user_id', user.id).limit(300),
    db.from('portal_credentials').select('id,kind,title_ar,title_en,verify_code,issued_at,revoked_at,skills,live').eq('user_id', user.id).order('issued_at', { ascending: false }).limit(50),
    pathOptions(db),
  ]);
  const ids = Array.from(new Set([...((levels || []) as any[]).map(l => l.skill_id), ...opts.programs.flatMap(p => p.skills.map((s: any) => s.skill_id)), ...opts.scenarios.flatMap(s => s.skills), ...opts.sessions.flatMap(s => s.skills), ...((creds || []) as any[]).flatMap(c => c.skills || [])])).filter(Boolean);
  const { data: skills } = ids.length ? await db.from('portal_skills').select(SKILL_COLS).in('id', ids) : { data: [] };
  return NextResponse.json({ success: true, user: { id: user.id, name: user.name, email: user.email }, levels: levels || [], skills: skills || [], credentials: creds || [], ...opts, generated_at: new Date().toISOString() });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  if (action === 'export') {
    const [{ data: levels }, { data: events }, { data: creds }, { data: profile }] = await Promise.all([
      db.from('portal_skill_levels').select('*').eq('user_id', user.id).limit(500),
      db.from('portal_learning_events').select('id,at,verb,object_type,object_id,skills,context').eq('user_id', user.id).order('at', { ascending: false }).limit(5000),
      db.from('portal_credentials').select('id,kind,title_ar,title_en,verify_code,issued_at,valid_until,revoked_at,skills,level,hours,live').eq('user_id', user.id).limit(100),
      db.from('portal_profiles').select('public_id,display_name,headline,city,share_mode').eq('user_id', user.id).maybeSingle(),
    ]);
    await db.from('portal_twin_exports').insert({ user_id: user.id, action: 'export', events: (events || []).length, levels: (levels || []).length });
    return NextResponse.json({ success: true, twin: { exported_at: new Date().toISOString(), owner: { email: user.email, name: user.name }, profile: profile || null, levels: levels || [], events: events || [], credentials: creds || [], license: 'بيانات المتعلم ملكه؛ تُصدَّر بصيغة مفتوحة قابلة للنقل — أَثَر © 2026' } });
  }
  if (action === 'forget') {
    if (String(body.confirm || '').trim() !== 'امحُ توأمي') return bad('اكتب عبارة التأكيد كما هي: امحُ توأمي');
    const { count: ec } = await db.from('portal_learning_events').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: lc } = await db.from('portal_skill_levels').select('skill_id', { count: 'exact', head: true }).eq('user_id', user.id);
    const d1 = await db.from('portal_learning_events').delete().eq('user_id', user.id); if (d1.error) return bad(d1.error.message);
    const d2 = await db.from('portal_skill_levels').delete().eq('user_id', user.id); if (d2.error) return bad(d2.error.message);
    await db.from('portal_companion_memory').delete().eq('user_id', user.id);
    await db.from('portal_twin_exports').insert({ user_id: user.id, action: 'forget', events: ec || 0, levels: lc || 0 });
    return NextResponse.json({ success: true, events: ec || 0, levels: lc || 0 });
  }
  if (action === 'live') {
    const id = String(body.credential_id || ''); if (!id) return bad('معرّف الشهادة مطلوب');
    const { data, error } = await db.from('portal_credentials').update({ live: !!body.enabled }).eq('id', id).eq('user_id', user.id).select('id,live');
    if (error) return bad(error.message); if (!data || !data.length) return bad('الشهادة ليست لك', 403);
    return NextResponse.json({ success: true, credential: data[0] });
  }
  return bad('إجراء غير معروف');
}
