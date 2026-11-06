// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/org/letters — P52 «رسالة الشهر» (مكتب التوقيع · الطاقم)
 *  GET  ?id=<uuid>                      → رسالة واحدة (مسوَّدة أو موقَّعة) + قائمة الوعود
 *  GET  [?months=12]                    → المسوَّدات + الموقَّعة حديثًا + الجهات المؤهَّلة بلا مسوَّدة للشهر المنصرم
 *  POST {action:'draft', org_id, month?}            → إنشاء مسوَّدة (أو تحديث أرقامها إن كانت مسوَّدة) — الكتّاب
 *  POST {action:'sign', id, line_ar, promise_ar, ask_ar?, signed_title?} → توقيع وإرسال (يجمّد · رمز · بصمة · إشعار مديري الجهة) — الكتّاب
 *  POST {action:'seen_reply', id}                   → تعليم الردّ مقروءًا
 *  القراءة: الطاقم (STAFF) · الكتابة: WRITER_ROLES (PLATFORM_ADMIN/SUPER_ADMIN/ADMIN/PROGRAM_MANAGER)
 */
import { NextResponse } from 'next/server';
import { readJson } from '../../../../../lib/shield/body';
import { rateLimit, tooMany } from '../../../../../lib/shield/ratelimit';
import { who, svc } from '../../../../../lib/org-impact/auth';
import { ensureDraft, signLetter, eligibleOrgs, isMonth, monthOf, prevMonth, PROMISES, LETTER_TITLE, LETTER_OFFICIAL, LINE_MAX } from '../../../../../lib/org-impact/letter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => NextResponse.json({ success: false, error, ...extra }, { status });

async function ctx(req: Request) {
  const db = svc(); if (!db) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const me = await who(req, db); if (!me) return { error: bad('سجّل الدخول أولًا', 401) }; if (!me.staff) return { error: bad('«رسالة الشهر» للطاقم', 403) };
  return { db, me };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c; const u = new URL(req.url);
  const rl = await rateLimit(db, `orgletters:${me.id}`, 120, 60); if (!rl.allowed) return tooMany(rl);
  const id = u.searchParams.get('id');
  if (id) { const { data } = await db.from('portal_org_letters').select('*').eq('id', id).maybeSingle(); if (!data) return bad('الرسالة غير موجودة', 404); return NextResponse.json({ success: true, letter: data, promises: PROMISES, line_max: LINE_MAX, writer: me.writer }); }
  const months = Math.min(24, Math.max(1, Number(u.searchParams.get('months') || 12)));
  const since = (() => { let m = monthOf(new Date()); for (let i = 0; i < months; i++) m = prevMonth(m); return m; })();
  const [{ data: drafts }, { data: signed }, orgs] = await Promise.all([
    db.from('portal_org_letters').select('*').eq('status', 'draft').order('created_at', { ascending: true }).limit(200),
    db.from('portal_org_letters').select('*').eq('status', 'signed').gte('month', since).order('signed_at', { ascending: false }).limit(200),
    eligibleOrgs(db),
  ]);
  const target = prevMonth(monthOf(new Date())); const have = new Set([...(drafts || []), ...(signed || [])].filter((l: any) => l.month === target).map((l: any) => String(l.organization_id)));
  const missing = orgs.filter((o) => !have.has(o.id));
  return NextResponse.json({ success: true, title: LETTER_TITLE, official: LETTER_OFFICIAL, target_month: target, drafts: drafts || [], signed: signed || [], missing, promises: PROMISES, line_max: LINE_MAX, writer: me.writer, unread_replies: (signed || []).filter((l: any) => l.reply_at && !l.reply_seen_at).length });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, me } = c;
  if (!me.writer) return bad('التوقيع لأدوار الكتابة (مدير البرامج فأعلى)', 403);
  const rl = await rateLimit(db, `orgletters:w:${me.id}`, 3600, 60); if (!rl.allowed) return tooMany(rl);
  const j = await readJson(req, { maxBytes: 16 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>; const action = String(b.action || '');
  if (action === 'draft') {
    const orgId = String(b.org_id || ''); if (!/^[0-9a-f-]{36}$/i.test(orgId)) return bad('معرّف الجهة مطلوب');
    const month = b.month ? String(b.month) : prevMonth(monthOf(new Date())); if (!isMonth(month) || month >= monthOf(new Date())) return bad('الشهر غير صالح — رسالة الشهر تُكتب عن شهر منصرم');
    const { data: org } = await db.from('portal_organizations').select('id, name_ar').eq('id', orgId).maybeSingle(); if (!org) return bad('الجهة غير موجودة', 404);
    const r = await ensureDraft(db, { id: String(org.id), name_ar: String(org.name_ar || '') }, month, { force: true }); if (r.reason === 'signed') return bad('رسالة هذا الشهر موقَّعة من قبل', 409);
    try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: 'STAFF', action: 'org_letter_draft', entity_type: 'portal_org_letters', entity_id: r.row?.id || null, entity_label: `${org.name_ar} · ${month}`, source: 'portal', metadata: { month, created: r.created, reason: r.reason || null } }); } catch { /* تجاهل */ }
    return NextResponse.json({ success: true, letter: r.row, created: r.created, refreshed: r.reason === 'refreshed' });
  }
  if (action === 'sign') {
    const id = String(b.id || ''); if (!id) return bad('معرّف الرسالة مطلوب');
    const r = await signLetter(db, id, { id: me.id, email: me.email, name: me.name }, { line_ar: b.line_ar, promise_ar: b.promise_ar, ask_ar: b.ask_ar, signed_title: b.signed_title }); if ('error' in r) return bad(r.error, r.status);
    try { await db.from('audit_logs').insert({ actor_id: me.id, actor_email: me.email, actor_role: 'STAFF', action: 'org_letter_sign', entity_type: 'portal_org_letters', entity_id: r.row.id, entity_label: `${r.row.body?.org?.name_ar || ''} · ${r.row.month}`, source: 'portal', metadata: { code: r.row.code, digest: r.row.digest, notified: r.notified } }); } catch { /* تجاهل */ }
    try { const { invalidateSignCache } = await import('../../../../../lib/portal/sign'); invalidateSignCache(); } catch { /* تجاهل */ }
    return NextResponse.json({ success: true, letter: r.row, notified: r.notified, message: r.notified ? `وُقِّعت الرسالة وأُرسلت إلى ${r.notified} من مديري الجهة · الرمز ${r.row.code}` : `وُقِّعت الرسالة · الرمز ${r.row.code} — لا مدير جهة مؤكَّدًا ليُخبَر بعد؛ ستظهر في بوابة الجهة حين يُؤكَّد مديرها` });
  }
  if (action === 'seen_reply') { const id = String(b.id || ''); if (!id) return bad('معرّف الرسالة مطلوب'); await db.from('portal_org_letters').update({ reply_seen_at: new Date().toISOString() }).eq('id', id); return NextResponse.json({ success: true }); }
  return bad('إجراء غير معروف');
}
