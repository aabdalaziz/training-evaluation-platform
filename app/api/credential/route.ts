// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — الشهادة الحية (P11) — عامة بالرمز
 *  GET  ?code=ATH-XXXX-XXXX → بيانات الشهادة + «النبض»: المستوى الحالي والطزاجة وحالة كل مهارة (إن كانت live)، سلسلة الأدلة (نوع/تاريخ/وسم فقط)، عدد المشتركين
 *  POST { action:'watch', code, email, name?, organization? } → اشتراك جهة في تغيّرات الشهادة (بريد ترحيبي + رابط إلغاء)
 *       { action:'unwatch', token }                          → إلغاء الاشتراك بلا تسجيل دخول
 *  لا بيانات اتصال لصاحب الشهادة تُعرض؛ التفعيل/الإيقاف بيد صاحبها عبر /api/twin {action:'live'}.
 */
import { NextResponse } from 'next/server';
import { limitFor, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { createClient } from '@supabase/supabase-js';
import { buildLiving } from '../../../lib/portal/twin';
import { randomCode } from '../../../lib/portal/profile';
import { normalizeSite } from '../../../lib/portal/open';
import { sendViaResend } from '../../../lib/email/resend';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const S = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

function service() {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SERVICE) return null; return createClient(URL_, SERVICE, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const code = S(new URL(req.url).searchParams.get('code'), 40).toUpperCase(); if (!code) return bad('رمز الشهادة مطلوب');
  const { data, error } = await db.rpc('portal_living_credential', { p_code: code }); if (error) return bad(error.message, 500);
  return NextResponse.json({ success: true, ...buildLiving(data) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');
  if (action === 'unwatch') {
    const token = S(body.token, 64); if (!token) return bad('الرمز مطلوب');
    const { data, error } = await db.from('portal_credential_watchers').update({ unsubscribed_at: new Date().toISOString() }).eq('token', token).is('unsubscribed_at', null).select('id');
    if (error) return bad(error.message); return NextResponse.json({ success: true, removed: (data || []).length });
  }
  if (action === 'watch') {
    { const rl = await limitFor(db, 'credential_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
    const code = S(body.code, 40).toUpperCase(); const email = S(body.email, 160).toLowerCase(); const name = S(body.name, 120); const organization = S(body.organization, 160);
    if (!code) return bad('رمز الشهادة مطلوب'); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('أدخل بريدًا صالحًا');
    const { data: cred } = await db.from('portal_credentials').select('id,verify_code,title_ar,full_name,live,revoked_at').ilike('verify_code', code).maybeSingle();
    if (!cred) return bad('الشهادة غير موجودة', 404); if ((cred as any).revoked_at) return bad('الشهادة ملغاة');
    const token = `${randomCode(8)}${randomCode(8)}`.toLowerCase();
    const { error } = await db.from('portal_credential_watchers').insert({ credential_id: (cred as any).id, email, name: name || null, organization: organization || null, token, confirmed_at: new Date().toISOString() });
    if (error && !/duplicate|unique/i.test(error.message)) return bad(error.message);
    const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL); const url = `${site}/credential/${encodeURIComponent((cred as any).verify_code)}`;
    if (!error && process.env.RESEND_API_KEY) {
      try {
        await sendViaResend({ to: [email], subject: `أَثَر | اشتراكك في الشهادة الحية ${(cred as any).verify_code}`, tags: [{ name: 'kind', value: 'credential_watch' }],
          html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#0f172a"><h2 style="color:#0f2a4e;margin:0 0 8px">الشهادة الحية — أَثَر</h2><p>${name ? `أهلًا ${esc(name)}،` : 'أهلًا،'} اشتركت في متابعة الشهادة <b>«${esc(String((cred as any).title_ar || ''))}»</b> (${esc(String((cred as any).verify_code))})${(cred as any).full_name ? ` لصاحبها <b>${esc(String((cred as any).full_name))}</b>` : ''}.</p><p>ستصلك رسالة مجمّعة (أسبوعيًا على الأكثر) عندما يتغيّر مستوى مهارة أو حالتها (متوهّجة/تخفت/صدئة) — الشهادة في أَثَر علاقة مستمرة لا وثيقة جامدة.</p><p><a href="${url}" style="background:#0f2a4e;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;display:inline-block">فتح الشهادة الحية</a></p><p style="color:#64748b;font-size:12px">لإلغاء الاشتراك: <a href="${url}?unwatch=${token}">اضغط هنا</a>.<br/>أَثَر | التدريب ما بعد الذكاء الاصطناعي — نبني القدرة ونُثبت الأثر</p></div>` });
      } catch { /* البريد اختياري */ }
    }
    return NextResponse.json({ success: true, already: !!error });
  }
  return bad('إجراء غير معروف');
}
