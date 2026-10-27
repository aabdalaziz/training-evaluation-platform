// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/push — إشعارات الويب (P13-ب · بداية المسار المحمول)
 *  GET                                   → { enabled, publicKey, subscribed } (subscribed للمستخدم المسجّل: عدد اشتراكاته النشطة)
 *  GET ?gen=1                            → موظف: توليد زوج مفاتيح VAPID جديد (لمرة واحدة؛ يُنسخ إلى متغيرات البيئة في Vercel)
 *  POST { action:'subscribe', subscription, lang?, topics? } → حفظ/تحديث اشتراك (بالمستخدم إن وُجد Bearer، وإلا مجهول)
 *  POST { action:'unsubscribe', endpoint }                   → تعطيل اشتراك
 *  POST { action:'test' }                                    → مستخدم مسجّل: إشعار تجريبي فوري إلى اشتراكاته
 *  الإرسال اليومي لـ«موقف اليوم» يتم داخل سلسلة Cron القائمة (/api/followups/send) — بلا مهمة Cron جديدة.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { vapidFromEnv, generateVapidKeys, validateSubscription, sendPush } from '../../../lib/portal/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  let user: null | { id: string; email: string; staff: boolean } = null;
  if (token) {
    const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data } = await userDb.auth.getUser(token);
    if (data?.user) { const { data: prof } = await userDb.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); user = { id: data.user.id, email: String(data.user.email || '').toLowerCase(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) }; }
  }
  return { db, user };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const url = new URL(req.url); const keys = vapidFromEnv();
  if (url.searchParams.get('gen') === '1') {
    if (!user?.staff) return bad('غير مصرّح', 403);
    const k = generateVapidKeys();
    return NextResponse.json({ success: true, keys: { VAPID_PUBLIC_KEY: k.publicKey, VAPID_PRIVATE_KEY: k.privateKey, VAPID_SUBJECT: 'mailto:' + (user.email || 'admin@example.com') }, note: 'انسخ القيم الثلاث إلى Vercel → Settings → Environment Variables ثم Redeploy. لا تشارك المفتاح الخاص.' });
  }
  let subscribed = 0;
  if (user) { const { count } = await db.from('portal_push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('active', true); subscribed = count || 0; }
  return NextResponse.json({ success: true, enabled: !!keys, publicKey: keys?.publicKey || null, subscribed });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || 'subscribe'); const keys = vapidFromEnv();
  if (action === 'subscribe') {
    if (!keys) return bad('الإشعارات غير مفعّلة على الخادم بعد (VAPID)', 503);
    const sub = validateSubscription(body.subscription); if (!sub) return bad('اشتراك غير صالح');
    const topics = Array.isArray(body.topics) && body.topics.length ? body.topics.map((t: unknown) => String(t).slice(0, 24)).slice(0, 6) : ['daily'];
    const row = { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, user_id: user?.id || null, email: user?.email || null, lang: body.lang === 'en' ? 'en' : 'ar', topics, ua: String(req.headers.get('user-agent') || '').slice(0, 200), active: true, failures: 0, last_error: null };
    const { error } = await db.from('portal_push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) return bad('تعذّر حفظ الاشتراك: ' + error.message, 500);
    return NextResponse.json({ success: true, subscribed: true });
  }
  if (action === 'unsubscribe') {
    const endpoint = String(body.endpoint || ''); if (!endpoint) return bad('endpoint مطلوب');
    await db.from('portal_push_subscriptions').update({ active: false }).eq('endpoint', endpoint);
    return NextResponse.json({ success: true, subscribed: false });
  }
  if (action === 'test') {
    if (!user) return bad('سجّل الدخول', 401); if (!keys) return bad('الإشعارات غير مفعّلة على الخادم بعد (VAPID)', 503);
    const { data } = await db.from('portal_push_subscriptions').select('id,endpoint,p256dh,auth,lang').eq('user_id', user.id).eq('active', true).limit(5);
    const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const out: { id: string; ok: boolean; status: number }[] = [];
    for (const s of (data || []) as any[]) {
      const r = await sendPush(s, { title: 'أَثَر — الإشعارات تعمل', body: 'ستصلك دعوة «موقف اليوم» كل صباح. اضغط لتفتح موقف اليوم.', url: `${site}/#daily`, tag: 'test', icon: `${site}/icons/icon-192.png` }, keys, { ttl: 600, urgency: 'high' });
      out.push({ id: s.id, ok: r.ok, status: r.status });
      if (r.gone) await db.from('portal_push_subscriptions').update({ active: false, last_error: 'gone' }).eq('id', s.id);
    }
    return NextResponse.json({ success: true, sent: out.filter(o => o.ok).length, results: out });
  }
  return bad('إجراء غير معروف');
}
