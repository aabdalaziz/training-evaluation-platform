// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/after — «الشهادة التي تكبر» (P38 · متابعة أثر التدريب)
 *  GET ?meta=1                      (عام)   → المحطات والحالات والنافذة والشعار
 *  GET ?program=<id>                (عام)   → «ما قاله من تدرّب هنا» (k≥5؛ اقتباسات اعتمدها إنسان من بين ما أذن أصحابه)
 *  GET ?credential=<code>           (عام)   → «فصول بعد البرنامج» التي أظهرها صاحب الشهادة الحيّة
 *  GET ?org=<id>                    (منسوب/طاقم) → سطر الجهة (k≥5) — سطر لا رسم
 *  GET ?mine=1                      (مسجّل) → تسجيلاتي المكتملة ومحطاتها (النافذة · الحال) · دعوات الشهادة إليّ · وثائقي
 *  POST {action}
 *   write {enrollment_id, station, state, text_ar, may_publish}   داخل النافذة فقط، مرة واحدة
 *   shown {id, shown}                                              إظهار الفصل في الشهادة الحيّة أو إخفاؤه
 *   witness_invite {id, email} · witness_answer {id, accept, text_ar}
 *   doc {enrollment_id}                                            وثيقة ATH-AF عند محطة السنة إن كُتبت محطتان فأكثر
 *  لا يكتب الذكاء الاصطناعي هنا شيئًا. الإشعارات داخلية (البريد/واتساب مؤجَّلان بقرار المالك).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { P38_NAMES_AR, STATIONS, STATION_AR, STATION_EN, STATES, STATE_AR, STATE_EN, WINDOW_DAYS, TEXT_MIN, TEXT_MAX, WITNESS_MAX, AFTER_K, DOC_MIN_WRITTEN, QUESTION_AR, HONESTY_AR, TAGLINE_AR, PHASE_AR, cleanStation } from '../../../lib/after/registry';
import { myAfter, writeStation, setShown, inviteWitness, answerWitness, chaptersForCredential, programAfterOf, orgAfterOf, issueAfterDoc } from '../../../lib/after/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const UUID = /^[0-9a-z-]{1,40}$/i;

type Who = { id: string; email: string; name: string; staff: boolean };
async function who(req: Request, db: any): Promise<Who | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
async function memberOf(db: any, me: Who, orgId: string): Promise<boolean> {
  if (me.staff) return true; const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('status', 'confirmed').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(1); return !!(data || []).length;
}
const META = { names_ar: P38_NAMES_AR, tagline_ar: TAGLINE_AR, question_ar: QUESTION_AR, honesty_ar: HONESTY_AR, stations: STATIONS.map(s => ({ days: s, ar: STATION_AR[s], en: STATION_EN[s] })), states: STATES.map(s => ({ key: s, ar: STATE_AR[s], en: STATE_EN[s] })), phase_ar: PHASE_AR, window_days: WINDOW_DAYS, text_min: TEXT_MIN, text_max: TEXT_MAX, witness_max: WITNESS_MAX, k: AFTER_K, doc_min_written: DOC_MIN_WRITTEN, doc_prefix: 'ATH-AF' };

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const sp = new URL(req.url).searchParams; const now = new Date();
  if (sp.get('meta') === '1') return NextResponse.json({ success: true, ...META }, { headers: { 'Cache-Control': 'public, max-age=300' } });
  if (sp.get('program')) { const id = String(sp.get('program') || '').trim(); if (!UUID.test(id)) return bad('رقم البرنامج غير صالح'); const a = await programAfterOf(db, id, now); return NextResponse.json({ success: true, program_id: id, ...a, note_ar: a.shown ? 'من محطة الأشهر الثلاثة لخمسة متدرّبين مختلفين فأكثر — بالكلمات لا بالنسب؛ الاقتباسات اعتمدها إنسان من بين ما أذن أصحابه' : 'تتكلم الصفحة من خمسة متدرّبين' }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (sp.get('credential')) { const code = String(sp.get('credential') || '').trim().toUpperCase().slice(0, 40); const c = await chaptersForCredential(db, code); return NextResponse.json({ success: true, ...c }, { headers: { 'Cache-Control': 'no-store' } }); }
  const me = await who(req, db);
  if (sp.get('org')) { if (!me) return bad('سجّل الدخول', 401); const id = String(sp.get('org') || '').trim(); if (!UUID.test(id) || !(await memberOf(db, me, id))) return bad('ليست جهتك', 403); return NextResponse.json({ success: true, org_id: id, ...(await orgAfterOf(db, id)) }, { headers: { 'Cache-Control': 'no-store' } }); }
  if (sp.get('mine') === '1') { if (!me) return bad('سجّل الدخول', 401); const d = await myAfter(db, me, now); return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name }, ...d, meta: META }, { headers: { 'Cache-Control': 'no-store' } }); }
  return bad('طلب غير معروف');
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401);
  let b: any = {}; try { b = await req.json(); } catch { /* فارغ */ }
  const action = String(b.action || ''); const site = siteOf(req); const now = new Date();
  if (action === 'write') {
    const c = cleanStation(b); if (!c.ok) return bad(c.error); const eid = String(b.enrollment_id || ''); if (!UUID.test(eid)) return bad('رقم التسجيل غير صالح');
    const r = await writeStation(db, me, eid, c.s, now); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, row: r.row, note_ar: `كُتبت محطة «${STATION_AR[c.s.station]}» — ${STATE_AR[c.s.state]}. ${c.s.station === 365 ? 'يمكنك الآن طلب وثيقة «أثر بعد» إن كُتبت محطتان.' : 'ادعُ شاهدًا إن شئت، أو أظهرها في شهادتك الحيّة.'}` });
  }
  if (action === 'shown') { const r = await setShown(db, me, b.id, !!b.shown); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: b.shown ? 'صار الفصل ظاهرًا في شهادتك الحيّة.' : 'أُخفي الفصل من شهادتك الحيّة.' }); }
  if (action === 'witness_invite') { const r = await inviteWitness(db, me, b.id, String(b.email || ''), site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: 'دُعي الشاهد — يرى محطتك هذه وحدها، ويوقّع أو يعتذر.' }); }
  if (action === 'witness_answer') { const r = await answerWitness(db, me, b.id, !!b.accept, b.text_ar, now); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, note_ar: b.accept ? 'وُقّعت شهادتك.' : 'اعتذرت — أُبلغ صاحب المحطة.' }); }
  if (action === 'doc') {
    const eid = String(b.enrollment_id || ''); if (!UUID.test(eid)) return bad('رقم التسجيل غير صالح');
    const r = await issueAfterDoc(db, { id: me.id, email: me.email, name: me.name || 'متدرّب في أَثَر' }, eid, signerFromEnv(process.env, site), site, didWeb(site), () => randomCode(4), now); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, code: r.code, verify_url: r.verify_url, note_ar: `صدرت وثيقة «${P38_NAMES_AR.doc}» ${r.code} — موقَّعة إلى محفظتك.` });
  }
  return bad('إجراء غير معروف');
}
