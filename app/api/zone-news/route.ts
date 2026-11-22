// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/zone-news — «شريط أخبار المنطقة» (هـ-1/4)
 *  GET ?zone=miaar|iqra|programs|org|experts|staff|portal   → { items } = أخبار الطاقم المنشورة + أخبار آلية خفيفة (أعداد بلا بيانات شخصية)
 *                                                           عامّ · مخبّأ ٦٠ ثانية على الحافّة
 *  GET ?zone=…&all=1 (طاقم)                                 → كلّ أخبار المنطقة للإدارة (منشورة وغير منشورة)
 *  POST { action: 'upsert', item } | { action: 'delete', id } (طاقم) → عبر RPC (الصلاحية في قاعدة البيانات)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 15;
const ZONES = ['miaar', 'iqra', 'programs', 'org', 'experts', 'staff', 'portal'] as const;
type Zone = typeof ZONES[number];
export type ZoneItem = { id: string; kind: 'news' | 'auto'; zone: string; title: string; body: string; href: string | null; tone: string; pinned: boolean; at: string };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const PUB = { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' };
const NO = { 'Cache-Control': 'private, no-store' };
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const n = (x: any) => Number(x) || 0;
const arN = (x: number) => new Intl.NumberFormat('ar-EG').format(x);

/** أخبار آلية لكلّ منطقة — أعداد فقط، لا أسماء ولا نتائج */
const AT0 = '2026-01-01T00:00:00.000Z';
const F = (zone: Zone, id: string, title: string, body: string, href: string, tone: string): ZoneItem => ({ id: `fallback:${id}`, kind: 'auto', zone, title, body, href, tone, pinned: false, at: AT0 });
const FALLBACK: Record<Zone, ZoneItem[]> = {
  miaar: [F('miaar', 'm1', 'مِعيار يحدّد مستواك في ٣ دقائق', 'تقييم عربي على الإطار الأوروبي المرجعي — مجّانًا وبلا تسجيل.', '/miaar', 'coral')],
  iqra: [F('iqra', 'i1', 'تجربة ٧ أيام مجّانًا — بلا بطاقة', 'بعد تحديد مستواك في مِعيار، يفتح اقْرَأْ كاملًا سبعة أيام.', '/iqra/start', 'sand')],
  programs: [F('programs', 'p1', 'برامج أَثَر تُقاس بأثرها لا بساعاتها', 'تصفّح الدليل — كل برنامج له «شهادة تكبر» بعد التدريب.', '/programs', 'plum')],
  org: [F('org', 'o1', 'بوّابة الجهات: قِس أثر التدريب في مؤسستك', 'خريطة قدرات · تقارير أثر · عقود أثر.', '/org', 'sea')],
  experts: [F('experts', 'e1', 'انضمّ إلى هيئة أَثَر', 'مدرّبون وخبراء مُصدِّقون — اعتماد السير من الطاقم.', '/experts', 'plum')],
  staff: [F('staff', 's1', 'مركز القيادة', 'كلّ غرفة بابها بصفتك.', '/dashboard', 'plum')],
  portal: [F('portal', 'g1', 'الآن في أَثَر', 'مِعيار يحدّد مستواك · اقْرَأْ يعلّمك عليه · البرامج تُقاس بأثرها.', '/', 'plum')],
};
async function autoItems(db: any, zone: Zone): Promise<ZoneItem[]> {
  const out: ZoneItem[] = []; const now = new Date(); const week = new Date(now.getTime() - 7 * 86400000).toISOString();
  const push = (id: string, title: string, body: string, href: string | null, tone = 'plum') => out.push({ id: `auto:${id}`, kind: 'auto', zone, title, body, href, tone, pinned: false, at: now.toISOString() });
  try {
    if (zone === 'miaar') {
      const { count } = await db.from('placement_reports').select('id', { count: 'exact', head: true }).gte('created_at', week);
      if (n(count) >= 3) push('placed', `${arN(n(count))} متعلّمًا حدّدوا مستواهم هذا الأسبوع`, 'قيّم نفسك في ثلاث دقائق وانضمّ إليهم.', '/miaar', 'coral');
      const { count: inv } = await db.from('placement_invites').select('id', { count: 'exact', head: true }).eq('status', 'open');
      if (n(inv) > 0) push('invites', 'دعوات تقييم مفتوحة الآن', 'لديك رمز دعوة من جهتك؟ أدخله من صفحة مِعيار.', '/miaar', 'sand');
    }
    if (zone === 'iqra') {
      const { count } = await db.from('iqra_lessons').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('reviewed_at', week);
      if (n(count) > 0) push('lessons', `${arN(n(count))} حلقة جديدة اعتُمدت هذا الأسبوع`, 'تظهر في مستواها فور الاعتماد.', '/iqra', 'coral');
      const { data: plans } = await db.from('service_plans').select('code, name_ar, price').eq('service', 'iqra').eq('active', true).eq('code', 'trial').limit(1);
      if (Array.isArray(plans) && plans[0]) push('trial', 'تجربة ٧ أيام مجّانًا — بلا بطاقة', 'بعد تحديد مستواك في مِعيار، يفتح اقْرَأْ كاملًا سبعة أيام.', '/iqra/start', 'sand');
    }
    if (zone === 'programs' || zone === 'portal') {
      const { data: s } = await db.from('portal_sessions').select('id, title_ar, starts_at, kind').gte('starts_at', now.toISOString()).neq('status', 'cancelled').eq('access', 'public').order('starts_at').limit(2);
      for (const x of (s || []) as any[]) push(`s:${x.id}`, x.title_ar, `جلسة عامّة · ${new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' }).format(new Date(x.starts_at))}`, `/live/${x.id}`, 'plum');
    }
    if (zone === 'staff') {
      const { count } = await db.from('placement_decisions').select('report_id', { count: 'exact', head: true }).in('decision_status', ['pending', 'review']);
      if (n(count) > 0) push('pending', `${arN(n(count))} قرار تسكين ينتظر الاعتماد`, 'من مكتب المدير في مِعيار.', '/admin/miaar', 'coral');
    }
  } catch { /* الأخبار الآلية لا تُفشل الشريط */ }
  return out;
}

async function staff(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SVC) return null;
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return null;
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return STAFF.includes(String((prof as any)?.role || '').toUpperCase()) ? { userDb, db } : null;
}

export async function GET(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SVC) return bad('server_not_configured', 500);
  const u = new URL(req.url); const zone = String(u.searchParams.get('zone') || 'portal') as Zone;
  if (!ZONES.includes(zone)) return bad('bad_zone');
  const db = createClient(URL_, SVC, { auth: { persistSession: false } });
  if (u.searchParams.get('all') === '1') {
    const s = await staff(req); if (!s) return bad('forbidden', 403);
    /* هـ-1/4ب: قائمة الطاقم تشمل كلّ المناطق (أو منطقة واحدة إن طُلبت) وتُعاد باسم items */
    let qb = db.from('zone_news').select('*').order('pinned', { ascending: false }).order('starts_at', { ascending: false }).limit(200); if (u.searchParams.get('zone')) qb = qb.eq('zone', zone);
    const { data } = await qb;
    return NextResponse.json({ ok: true, items: data || [], rows: data || [] }, { headers: NO });
  }
  const nowIso = new Date().toISOString();
  const { data } = await db.from('zone_news').select('id, zone, title_ar, body_ar, href, tone, pinned, starts_at').eq('zone', zone).eq('published', true).lte('starts_at', nowIso).or(`ends_at.is.null,ends_at.gt.${nowIso}`).order('pinned', { ascending: false }).order('starts_at', { ascending: false }).limit(6);
  const news: ZoneItem[] = ((data || []) as any[]).map((r) => ({ id: r.id, kind: 'news', zone: r.zone, title: r.title_ar, body: r.body_ar || '', href: r.href || null, tone: r.tone || 'plum', pinned: !!r.pinned, at: r.starts_at }));
  const auto = await autoItems(db, zone);
  const items = [...news, ...auto]; if (!items.length) items.push(...FALLBACK[zone]); /* هـ-1/4ب: الشريط لا يختفي — خبر ثابت لكلّ منطقة حين لا جديد */
  return NextResponse.json({ ok: true, zone, items: items.slice(0, 8) }, { headers: PUB });
}

export async function POST(req: Request) {
  const s = await staff(req); if (!s) return bad('forbidden', 403);
  let b: any; try { b = await req.json(); } catch { return bad('invalid_json'); }
  if (b?.action === 'delete') { const { data, error } = await s.userDb.rpc('portal_zone_news_delete', { p_id: String(b.id || '') }); if (error) return bad(error.message); return NextResponse.json({ ok: true, deleted: !!data }, { headers: NO }); }
  if (b?.action === 'upsert') {
    const it = b.item || {};
    const { data, error } = await s.userDb.rpc('portal_zone_news_upsert', { p_id: it.id || null, p_zone: String(it.zone || ''), p_title: String(it.title_ar || '').slice(0, 140), p_body: String(it.body_ar || '').slice(0, 400), p_href: it.href ? String(it.href).slice(0, 200) : null, p_tone: String(it.tone || 'plum'), p_pinned: !!it.pinned, p_starts: it.starts_at || null, p_ends: it.ends_at || null, p_published: it.published !== false });
    if (error) return bad(error.message.includes('forbidden') ? 'forbidden' : error.message);
    return NextResponse.json({ ok: true, id: data }, { headers: NO });
  }
  return bad('unknown_action');
}
