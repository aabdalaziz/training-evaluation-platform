// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/shield/report — «الباب المعلن»: استقبال بلاغات الثغرات من الباحثين (P21)
 *  POST { title, detail, severity?, contact?, website_url? (فخّ للروبوتات — يجب أن يبقى فارغًا) }
 *  → حدث حرج فوري + تنبيه الطاقم بالبريد (إن كان مفعَّلًا) + رقم مرجعي للباحث. 3 بلاغات/ساعة لكل IP. لا تسجيل دخول مطلوب.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, honeypotTripped } from '../../../../lib/shield/body';
import { limitFor, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { securityEvent } from '../../../../lib/shield/guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

export async function POST(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !K) return bad('غير مهيأ', 500);
  const db = createClient(U, K, { auth: { persistSession: false } }); const ip = ipOf(req);
  const rl = await limitFor(db, 'vuln_report_ip', ip); if (!rl.allowed) return tooMany(rl, 'وصلنا ما يكفي من هذا العنوان الآن — شكرًا، سنراجع ونعود إليك');
  const r = await readJson(req, { maxBytes: 32 * 1024 }); if (!r.ok) return bad(r.error, r.status); const b = r.body || {};
  if (honeypotTripped(b)) return NextResponse.json({ success: true, ref: 'ATH-SEC-0000' }); // روبوت: نجيب بصمت ولا نحفظ
  const title = String(b.title || '').trim().slice(0, 160); const detail = String(b.detail || '').trim().slice(0, 6000); const contact = String(b.contact || '').trim().slice(0, 160);
  const severity = ['low', 'medium', 'high', 'critical'].includes(String(b.severity)) ? String(b.severity) : 'unknown';
  if (title.length < 5 || detail.length < 20) return bad('اكتب عنوانًا ووصفًا كافيين (خطوات إعادة الإنتاج تساعدنا كثيرًا)');
  const { id } = await securityEvent(db, { severity: 'critical', kind: 'vuln_report', actor: contact || 'باحث مجهول', ip, meta: { title, detail, reporter_severity: severity, contact, ua: String(req.headers.get('user-agent') || '').slice(0, 160) } });
  const ref = `ATH-SEC-${String(id || Date.now() % 100000).padStart(4, '0')}`;
  return NextResponse.json({ success: true, ref, message: 'شكرًا — وصل بلاغك إلى طاقم أَثَر. سنردّ خلال 5 أيام عمل على وسيلة التواصل التي ذكرتها.', policy: `${(process.env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app').replace(/\/+$/, '')}/security` });
}
