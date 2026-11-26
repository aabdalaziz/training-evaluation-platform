// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P84 */
/**
 * POST /api/reports/live-send { to: string[], doc: LiveDoc } — يرسل قالب «التقرير الحيّ» بالهوية (HTML) إلى الجهة/المدرّب. للطاقم فقط.
 *  الخادم يعيد بناء HTML من المستند (templateHtml) — لا يقبل HTML خامًا من العميل. يُسجَّل في audit_logs (source reports).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { sendEmailRaw } from '../../../../lib/portal/notify';
import { normalizeSite } from '../../../../lib/portal/open';
import { templateHtml, TEMPLATES, type LiveDoc } from '../../../../lib/reports/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const isEmail = (s: unknown): s is string => typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 160;

export async function POST(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return bad('إعدادات الخادم غير مكتملة', 500);
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return bad('يلزم تسجيل الدخول', 401);
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return bad('جلسة غير صالحة', 401);
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return bad('غير مصرّح', 403);
  const rj = await readJson(req, { maxBytes: 400_000 }); if (!rj.ok) return bad(rj.error, rj.status);
  const body = rj.body as { to?: unknown; doc?: LiveDoc };
  const to = Array.isArray(body.to) ? body.to.filter(isEmail).slice(0, 10) : []; if (!to.length) return bad('لا بريد صالحًا');
  const doc = body.doc; if (!doc || typeof doc !== 'object' || !(doc.kind in TEMPLATES) || !Array.isArray(doc.sections) || doc.sections.length > 20) return bad('مستند غير صالح');
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
  const html = templateHtml(doc, site); const subject = `${TEMPLATES[doc.kind].ar} — ${String(doc.program || '').slice(0, 80)} | أَثَر`;
  try { await sendEmailRaw({ to, subject, html, replyTo: 'info@athar-portal.com', tags: [{ name: 'kind', value: 'live_report' }] }); } catch (e: any) { return bad(`تعذّر الإرسال: ${e?.message || 'Resend'}`, 502); }
  try { const db = createClient(URL_, SERVICE, { auth: { persistSession: false } }); await db.from('audit_logs').insert({ actor_id: data.user.id, actor_email: String(data.user.email || '').toLowerCase(), action: 'live_report_sent', entity_type: 'program', entity_id: String(doc.program || '').slice(0, 120), source: 'reports', metadata: { kind: doc.kind, to } }); } catch { /* السجلّ ثانوي */ }
  return NextResponse.json({ success: true, sent: to.length });
}
