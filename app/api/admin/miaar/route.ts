// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/miaar — «مِعيار — من أَثَر» للطاقم (م1 · مستقل تمامًا عن أي مشروع خارجي منذ «الفصل» 2026-11-02)
 *  GET → تغطية البنك (مستوى×مهارة×نوع مقابل الخطة) · الدعوات بعدّاداتها · آخر التقارير (أعداد القديم إن كان مضبوطًا)
 *  POST {action}
 *   invite_create {kind, label_ar, lang, exam_mode, purpose?, expires_at?, max_seats?, org_id?, program_id?, note?, recipients?}  → الدعوة + الرابط (+ روابط شخصية)
 *   invite_status {id, status: open|closed}
 *   retake_approve {email, note?} → موافقة إعادة اختبار
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { normalizeSite } from '../../../../lib/portal/open';
import { MIAAR_NAMES_AR } from '../../../../lib/miaar/registry';
import { bankCoverage } from '../../../../lib/miaar/bank';
import { createInvite, listInvites, setInviteStatus, shareText } from '../../../../lib/miaar/invites';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role } };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const site = siteOf(req);
  const u = new URL(req.url);
  const [coverage, invites, reports, sessions] = await Promise.all([
    bankCoverage(db).catch(() => null), listInvites(db, site).catch(() => []),
    db.from('placement_reports').select('id, candidate_email, created_at, access_code, invite_id, report').order('created_at', { ascending: false }).limit(50),
    db.from('placement_secure_sessions').select('id, status', { count: 'exact', head: true }),
  ]);
  const latest = ((reports.data || []) as any[]).map((r) => ({ id: r.id, email: r.candidate_email, name: String(r.report?.بيانات_المتقدم?.الاسم || '—'), taken_at: r.created_at, code: r.access_code, demonstrated: r.report?.ملخص_التسكين?.المستوى_المثبت || r.report?.المستوى_العام || '—', entry: r.report?.ملخص_التسكين?.مستوى_الالتحاق_المقترح || '—', confidence: r.report?.ميزان_الثقة?.الرمز || null, confidence_ar: r.report?.ميزان_الثقة?.الدرجة || '—', percent: r.report?.النسبة_العامة ?? null, invite_id: r.invite_id, url: r.access_code ? `${site}/miaar/result/${r.access_code}` : null, legacy: !r.access_code }));
  return NextResponse.json({ success: true, names_ar: MIAAR_NAMES_AR, site, coverage, invites, latest, sessions: sessions.count || 0 }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req);
  const j = await readJson(req, { maxBytes: 1024 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  const action = String(b.action || '');
  if (action === 'invite_create') {
    const r = await createInvite(db, b, user.id, site); if (!r.ok) return bad(r.error);
    return NextResponse.json({ success: true, invite: r.invite, url: r.url, links: r.links, share_text: shareText(r.invite, r.url), note_ar: r.invite.kind === 'personal' ? `أُنشئت ${r.links.length} دعوة شخصية — انسخ الروابط الآن؛ لا تُعرض الرموز مرة أخرى.` : 'أُنشئت الدعوة — انسخ الرابط أو نزّل الباركود أو اطبع الملصق.' });
  }
  if (action === 'invite_status') { const ok = await setInviteStatus(db, b.id, b.status); return ok ? NextResponse.json({ success: true }) : bad('تعذّر تغيير حالة الدعوة'); }
  if (action === 'retake_approve') {
    const email = String(b.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad('بريد غير صالح');
    const r = await db.from('test_retake_approvals').insert({ email, approved_by: user.id, note: String(b.note || '').slice(0, 300) || null }); if (r.error) return bad(r.error.message);
    return NextResponse.json({ success: true, note_ar: `أُذن لـ ${email} بإعادة الاختبار مرة واحدة.` });
  }
  return bad('إجراء غير معروف');
}
