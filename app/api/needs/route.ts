// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/needs — P44 «البرنامج الذي لم يُكتب بعد» (الاحتياج التدريبي المعلَن)
 *  GET  ?meta=1                 → الأسماء · القطاعات · الحدود (عام)
 *  GET                          → اللوحة: العامة ترى المعلَنة (≥5)؛ المسجَّل يرى البذور أيضًا + حاجاته + هل هو عضو هيئة (يحقّ له التبنّي)
 *  GET  ?program=<id>           → سطر الميلاد + المقاعد الأولى (عام؛ + am_priority عند تسجيل الدخول)
 *  GET  ?org=<id>               → حاجات الجهة (منسوب/طاقم) + can_write (مدير الجهة/طاقم)
 *  GET  ?admin=1                → الطاقم: كل الحاجات بالبريد والمسودّة
 *  POST create {sector, text_ar, source?, source_ref?}   → حاجة (بذرة) — source=station يتحقّق أن المحطة لكاتبها
 *  POST org_create {org_id, sector, text_ar, org_named}   → «جهة تحتاج» (مدير الجهة/طاقم) — تُعلَن مباشرة
 *  POST support {id} · withdraw {id} · revive {id} · adopt {id, pitch_ar} · abandon {id} · merge {from, into} (طاقم) · delete {id} (طاقم)
 *  لا يكتب الذكاء الاصطناعي هنا شيئًا؛ لا أسماء في أي استجابة عامة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { P44_NAMES_AR, NEED_MIN, NEED_MAX, NEED_K, FOLD_DAYS, PRIORITY_HOURS, PITCH_MAX, QUESTION_AR, HINT_AR, STATUS_AR, SOURCE_AR, cleanNeed, cleanPitch, boardSummaryAr } from '../../../lib/needs/registry';
import { SECTOR_CODES, SECTOR_OPTIONS, board, createNeed, supportNeed, withdrawNeed, reviveNeed, adoptNeed, abandonNeed, programBorn, amPriority, orgNeeds, adminNeeds, mergeNeeds, deleteNeed, isFaculty } from '../../../lib/needs/load';
import type { Me } from '../../../lib/needs/load';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const UUID = /^[0-9a-z-]{1,40}$/i;

async function who(req: Request, db: any): Promise<Me | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name,role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
async function memberOf(db: any, me: Me, orgId: string): Promise<boolean> { if (me.staff) return true; const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('status', 'confirmed').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(1); return !!(data || []).length; }
async function orgAdminOf(db: any, me: Me, orgId: string): Promise<boolean> { if (me.staff) return true; const { data } = await db.from('portal_org_members').select('id').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${me.id},email.eq.${me.email}`).limit(1); return !!(data || []).length; }

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const sp = new URL(req.url).searchParams; const site = siteOf(req);
  if (sp.get('meta')) return NextResponse.json({ success: true, names_ar: P44_NAMES_AR, sectors: SECTOR_OPTIONS, k: NEED_K, min: NEED_MIN, max: NEED_MAX, pitch_max: PITCH_MAX, fold_days: FOLD_DAYS, priority_hours: PRIORITY_HOURS, question_ar: QUESTION_AR, hint_ar: HINT_AR, status_ar: STATUS_AR, source_ar: SOURCE_AR });
  const me = await who(req, db);
  if (sp.get('program')) { const id = String(sp.get('program') || '').trim(); if (!UUID.test(id)) return bad('معرّف غير صالح'); const b = await programBorn(db, id, site); const am = b && me ? await amPriority(db, b.need_id, me) : false; return NextResponse.json({ success: true, born: b, am_priority: am }); }
  if (sp.get('org')) { if (!me) return bad('سجّل الدخول', 401); const id = String(sp.get('org') || '').trim(); if (!UUID.test(id) || !(await memberOf(db, me, id))) return bad('ليست جهتك', 403); return NextResponse.json({ success: true, items: await orgNeeds(db, id, me), can_write: await orgAdminOf(db, me, id), sectors: SECTOR_OPTIONS }); }
  if (sp.get('admin')) { if (!me?.staff) return bad('غير مصرّح', 403); return NextResponse.json({ success: true, items: await adminNeeds(db), status_ar: STATUS_AR }); }
  const faculty = me ? (me.staff ? true : await isFaculty(db, me)) : false; const m = me ? { ...me, faculty } : null;
  const b = await board(db, m, site);
  return NextResponse.json({ success: true, items: b.items, mine: b.mine, summary_ar: boardSummaryAr(b.summary_rows), me: me ? { faculty, staff: me.staff } : null, sectors: SECTOR_OPTIONS, k: NEED_K, question_ar: QUESTION_AR, hint_ar: HINT_AR, names_ar: P44_NAMES_AR });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const me = await who(req, db); if (!me) return bad('سجّل الدخول', 401); const site = siteOf(req);
  let body: any = {}; try { body = await req.json(); } catch { return bad('طلب غير صالح'); } const action = String(body.action || ''); const id = String(body.id || '').trim();
  if (action === 'create') {
    const c = cleanNeed(body, SECTOR_CODES); if (!c.ok) return bad(c.error);
    let source: any = 'practitioner'; let ref: string | null = null;
    if (body.source === 'station' && body.source_ref) {
      const sid = String(body.source_ref); const { data: st } = await db.from('portal_after_stations').select('id,user_id,email,state,written_at').eq('id', sid).maybeSingle();
      if (!st || !((st as any).user_id === me.id || lower((st as any).email) === me.email)) return bad('ليست محطتك'); if (!['no_chance', 'not_useful'].includes(String((st as any).state)) || !(st as any).written_at) return bad('تُحوَّل إلى حاجة محطة «لم تسنح الفرصة» أو «لم ينفعني» فقط');
      source = 'station'; ref = sid;
    }
    const r = await createNeed(db, me, { ...c.n, source, source_ref: ref }, site); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, id: r.need.id, status: r.need.status, note_ar: `حُفظت. ستبقى بين المسجَّلين حتى يقول ${NEED_K} غيرك «وأنا أيضًا» — شارك رابط الصفحة مع زملائك.` });
  }
  if (action === 'org_create') {
    const orgId = String(body.org_id || '').trim(); if (!UUID.test(orgId)) return bad('معرّف الجهة غير صالح'); if (!(await orgAdminOf(db, me, orgId))) return bad('مدير الجهة فقط', 403);
    const c = cleanNeed(body, SECTOR_CODES); if (!c.ok) return bad(c.error);
    const r = await createNeed(db, me, { ...c.n, source: 'org', organization_id: orgId, org_named: !!body.org_named }, site); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, id: r.need.id, note_ar: 'أُعلنت حاجة جهتكم — بلا أسماء أفراد، وباسم الجهة إن أذنتم.' });
  }
  if (!UUID.test(id) && action !== 'merge') return bad('معرّف غير صالح');
  if (action === 'support') { const r = await supportNeed(db, me, id, site); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, supports: r.need.supports, status: r.need.status, opened: r.opened, note_ar: r.opened ? 'بك صارت خمسة — أُعلنت الحاجة للعالم.' : 'شكرًا — حُسبت معها.' }); }
  if (action === 'withdraw') { const r = await withdrawNeed(db, me, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'revive') { const r = await reviveNeed(db, me, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'adopt') { const r = await adoptNeed(db, me, id, cleanPitch(body.pitch_ar), site); if (!r.ok) return bad(r.error, r.error.includes('هيئة') ? 403 : 400); return NextResponse.json({ success: true, draft_id: r.draft_id, note_ar: me.staff ? 'صارت مسودّة في هندسة البرامج التدريبية.' : 'شكرًا — صارت مسودّة في هندسة البرامج؛ يكملها الطاقم معك ويعتمدها إنسان، ويُبلَّغ المؤيّدون حين يولد البرنامج.' }); }
  if (action === 'abandon') { const r = await abandonNeed(db, me, id); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true }); }
  if (action === 'merge') { if (!me.staff) return bad('غير مصرّح', 403); const from = String(body.from || ''); const into = String(body.into || ''); if (!UUID.test(from) || !UUID.test(into)) return bad('معرّف غير صالح'); const r = await mergeNeeds(db, from, into); if (!r.ok) return bad(r.error); return NextResponse.json({ success: true, supports: r.supports }); }
  if (action === 'delete') { if (!me.staff) return bad('غير مصرّح', 403); return NextResponse.json({ success: await deleteNeed(db, id) }); }
  return bad('إجراء غير معروف');
}
