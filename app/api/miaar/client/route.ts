// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/miaar/client — م7 «عُبور للجهات»: بوابة الجهة الطالبة (رابط سرّي، بلا حساب، قراءة فقط)
 *  GET  ?t=<token>            → لوحة طلاب الجهة (العدّادات · الصفوف · تقرير الجهة · المعيار المرجعي) — لا بنود ولا مفاتيح
 *  GET  ?t=<token>&csv=1      → CSV
 *  POST {t, action:'sign', name} → «ختم المراقب» من منسّق الجهة (مرة واحدة)
 *  الرابط يُبطل من لوحة الطاقم بضغطة. حدّ 120 طلبًا/ساعة لكل IP.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { normalizeSite } from '../../../../lib/portal/open';
import { clientBoard, signProctor } from '../../../../lib/miaar/service';
import { SKILL_NAMES, EXIT_SKILLS } from '../../../../lib/miaar/exit';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const NO = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO });
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
function dbOf() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; return URL_ && SERVICE ? createClient(URL_, SERVICE, { auth: { persistSession: false } }) : null; }
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const db = dbOf(); if (!db) return bad('server_config', 500);
  const rl = await rateLimit(db, `miaar_client:${ipOf(req)}`, 3600, 120); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const u = new URL(req.url); const t = u.searchParams.get('t') || '';
  const b = await clientBoard(db, t, siteOf(req)); if (!b) return bad('not_found', 404);
  if (u.searchParams.get('csv')) {
    const head = ['الاسم', 'البريد', 'الحالة', 'الكلّي', 'الحكم', 'التقدير', ...EXIT_SKILLS.map((s) => SKILL_NAMES[s].ar), 'رمز النتيجة', 'رابط الشهادة'];
    const lines = b.rows.map((r: any) => [r.name, r.email, r.status, r.exit?.الكلي ?? '', r.exit?.النتيجة ?? '', r.exit?.تقدير_ar ?? '', ...EXIT_SKILLS.map((s) => r.exit?.المهارات?.[s]?.النسبة ?? ''), r.report_code ?? '', r.certificate_url ?? ''].map(csvCell).join(','));
    const csv = '\uFEFF' + [head.map(csvCell).join(','), ...lines].join('\r\n');
    return new NextResponse(csv, { headers: { ...NO, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="miaar-exit-${b.invite.code}.csv"` } });
  }
  return NextResponse.json({ ok: true, ...b }, { headers: NO });
}
export async function POST(req: Request) {
  const db = dbOf(); if (!db) return bad('server_config', 500);
  const rl = await rateLimit(db, `miaar_client:${ipOf(req)}`, 3600, 120); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const j = await readJson(req, { maxBytes: 16 * 1024 }); if (!j.ok) return bad(j.error, j.status); const body = j.body as Record<string, unknown>;
  const b = await clientBoard(db, body.t, siteOf(req)); if (!b || !b.order) return bad('not_found', 404);
  if (body.action === 'sign') { const r = await signProctor(db, b.order.id, body.name, `client:${ipOf(req)}`); return r.ok ? NextResponse.json({ ok: true, order: r.order }, { headers: NO }) : bad(r.error); }
  return bad('unknown_action');
}
