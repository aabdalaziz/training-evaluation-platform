// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/notify — الإبلاغ متعدد القنوات «نبض الوصول» (أَثَر · P16)
 *  GET ?view=health     (موظفون) → { channels, stats, learned, templates_count }   صحة القنوات + إحصاءات 7 أيام + ما تعلمناه عن القنوات
 *  GET ?view=log&status=&channel=&q=&limit= (موظفون) → { rows }                   سجل التسليم
 *  GET ?view=manual     (موظفون) → { rows, admin_phone }                           «قائمة اليد»: نسخ / افتح في واتساب / تم
 *  GET ?view=templates  (موظفون) → { templates }                                    نصوص قوالب واتساب كما تُقدَّم لاعتماد Meta
 *  GET ?reach=a@x,b@y   (موظفون) → { reach: [{email, level, label, why}] }        نبض الوصول قبل الإسناد
 *  GET ?view=prefs      (أي مستخدم) → { prefs }                                     تفضيلات التواصل للشخص نفسه
 *  POST { action:'prefs', phone, whatsapp_opt_in, preferred_channel, quiet_from, quiet_to, push_ok } (الشخص نفسه)
 *  POST { action:'test', channel?, to? } (موظفون)        → إرسال تجريبي إلى بريد/هاتف الموظف
 *  POST { action:'manual_done', id } (موظفون)             → تم التسليم يدويًا
 *  POST { action:'retry', id } (موظفون)                   → إعادة المحاولة الآن
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { channelEnv, notify, attempt, reachOf, channelEffect, normalizePhone, CHANNEL_AR, STATUS_AR, type Prefs, type LogRow, type Channel } from '../../../lib/portal/notify';
import { channelStats } from '../../../lib/portal/outreach-cron';
import { WA_TEMPLATES, kindLabel } from '../../../lib/portal/messages';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const LOG_COLS = 'id,kind,ref_id,to_email,to_phone,to_name,subject,channel,status,plan,attempts,errors,provider_id,payload,next_at,created_at,sent_at,delivered_at,read_at,manual_done_at,manual_by';

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const email = String(data.user.email || '').toLowerCase();
  return { db, user: { id: data.user.id, email, name: String((prof as any)?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) } };
}
const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const publicRow = (r: any) => ({ ...r, kind_ar: kindLabel(r.kind), channel_ar: CHANNEL_AR[r.channel as Channel] || r.channel, status_ar: STATUS_AR[r.status as keyof typeof STATUS_AR] || r.status, payload: { text: r.payload?.text || '', url: r.payload?.url || null, wa: r.payload?.wa || null } });

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url); const view = u.searchParams.get('view') || ''; const reach = u.searchParams.get('reach');
  if (view === 'prefs') { const { data } = await db.from('portal_contact_prefs').select('*').eq('email', user.email).maybeSingle(); return NextResponse.json({ success: true, prefs: data || { email: user.email, phone_e164: null, whatsapp_opt_in: false, preferred_channel: 'email', quiet_from: null, quiet_to: null, push_ok: true }, channels: pubEnv() }); }
  if (!user.staff) return bad('غير مصرّح', 403);
  const env = channelEnv();
  if (reach !== null) {
    const emails = Array.from(new Set(String(reach).split(/[\s,;،]+/).map(x => x.trim().toLowerCase()).filter(x => x.includes('@')))).slice(0, 50);
    if (!emails.length) return NextResponse.json({ success: true, reach: [] });
    const [{ data: prefs }, { data: logs }] = await Promise.all([db.from('portal_contact_prefs').select('*').in('email', emails), db.from('portal_message_log').select('to_email,status,channel').in('to_email', emails).gte('created_at', since(30)).limit(2000)]);
    const pm = new Map(((prefs || []) as Prefs[]).map(p => [p.email, p]));
    const out = emails.map(e => reachOf(e, pm.get(e), env, ((logs || []) as any[]).filter(l => l.to_email === e)));
    return NextResponse.json({ success: true, reach: out });
  }
  if (view === 'templates') return NextResponse.json({ success: true, templates: WA_TEMPLATES, lang: process.env.WHATSAPP_TEMPLATE_LANG || 'ar' });
  if (view === 'manual') { const { data } = await db.from('portal_message_log').select(LOG_COLS).eq('status', 'manual').order('created_at', { ascending: false }).limit(200); return NextResponse.json({ success: true, rows: ((data || []) as any[]).map(publicRow), admin_phone: env.adminPhone }); }
  if (view === 'log') {
    let q = db.from('portal_message_log').select(LOG_COLS).order('created_at', { ascending: false }).limit(Math.min(500, Number(u.searchParams.get('limit')) || 150));
    const st = u.searchParams.get('status'); const ch = u.searchParams.get('channel'); const s = String(u.searchParams.get('q') || '').trim().toLowerCase();
    if (st) q = q.eq('status', st); if (ch) q = q.eq('channel', ch);
    const { data } = await q; let rows = (data || []) as any[];
    if (s) rows = rows.filter(r => [r.to_email, r.to_name, r.subject, r.kind, r.to_phone].some(v => String(v || '').toLowerCase().includes(s)));
    return NextResponse.json({ success: true, rows: rows.map(publicRow) });
  }
  // health
  const [{ data: week }, { data: mlogs }, { count: manualCount }] = await Promise.all([
    db.from('portal_message_log').select('channel,status,sent_at,created_at').gte('created_at', since(7)).limit(5000),
    db.from('portal_message_log').select('kind,ref_id,channel,status').eq('kind', 'mission_assigned').gte('created_at', since(90)).limit(5000),
    db.from('portal_message_log').select('id', { count: 'exact', head: true }).eq('status', 'manual'),
  ]);
  const refs = Array.from(new Set(((mlogs || []) as any[]).map(l => l.ref_id).filter(Boolean))).slice(0, 1000);
  const { data: missions } = refs.length ? await db.from('portal_missions').select('id,status,submitted_at').in('id', refs) : { data: [] as any[] };
  const learned = channelEffect((mlogs || []) as any[], (missions || []) as any[]);
  return NextResponse.json({ success: true, channels: pubEnv(), stats: channelStats((week || []) as any[]), manual_count: manualCount || 0, learned, templates_count: WA_TEMPLATES.length });
}

function pubEnv() { const e = channelEnv(); return { whatsapp: e.whatsapp, email: e.email, email_test: e.emailTest, push: e.push, from: e.from, admin_phone: e.adminPhone, site: e.site }; }

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const body = await req.json().catch(() => ({})); const action = String(body?.action || '');
  if (action === 'prefs') {
    const phone = body.phone ? normalizePhone(String(body.phone)) : null; if (body.phone && !phone) return bad('رقم الهاتف غير صالح — اكتبه مثل 05xxxxxxxx أو +9665xxxxxxxx');
    const opt = !!body.whatsapp_opt_in && !!phone; const pref = ['whatsapp', 'email', 'push'].includes(String(body.preferred_channel)) ? String(body.preferred_channel) : 'email';
    const hm = (v: any) => /^\d{1,2}:\d{2}$/.test(String(v || '')) ? String(v) : null;
    const { data: cur } = await db.from('portal_contact_prefs').select('whatsapp_opt_in,whatsapp_opt_in_at').eq('email', user.email).maybeSingle();
    const row = { email: user.email, user_id: user.id, phone_e164: phone, whatsapp_opt_in: opt, whatsapp_opt_in_at: opt ? ((cur as any)?.whatsapp_opt_in ? (cur as any).whatsapp_opt_in_at : new Date().toISOString()) : null, preferred_channel: opt || pref !== 'whatsapp' ? pref : 'email', quiet_from: hm(body.quiet_from), quiet_to: hm(body.quiet_to), push_ok: body.push_ok !== false, updated_at: new Date().toISOString() };
    const { error } = await db.from('portal_contact_prefs').upsert(row, { onConflict: 'email' }); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, prefs: row });
  }
  if (!user.staff) return bad('غير مصرّح', 403);
  if (action === 'test') {
    const to = String(body.to || user.email).trim().toLowerCase(); const site = process.env.NEXT_PUBLIC_SITE_URL || '';
    const r = await notify(db, { kind: 'test', to: { email: to, name: user.name || null }, subject: 'إرسال تجريبي من أَثَر — نبض الوصول', html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p>هذه رسالة تجريبية من <b>أَثَر</b> للتحقق من قنوات الإبلاغ.</p><p><a href="${site}/admin/outreach">صفحة الإبلاغ متعدد القنوات</a></p></div>`, url: `${site}/admin/outreach` });
    return NextResponse.json({ success: true, delivery: r, channel_ar: CHANNEL_AR[r.channel], status_ar: STATUS_AR[r.status], message: r.channel === 'manual' ? `لم تنجح أي قناة آلية — سقطت في قائمة اليد (${r.error || ''})` : `أُرسلت عبر ${CHANNEL_AR[r.channel]}` });
  }
  const id = Number(body.id); if (!id) return bad('معرّف مفقود');
  if (action === 'manual_done') { const { error } = await db.from('portal_message_log').update({ status: 'done', manual_done_at: new Date().toISOString(), manual_by: user.email }).eq('id', id); if (error) return bad(error.message, 500); return NextResponse.json({ success: true }); }
  if (action === 'retry') {
    const { data } = await db.from('portal_message_log').select(LOG_COLS).eq('id', id).maybeSingle(); const row = data as LogRow | null; if (!row) return bad('غير موجود', 404);
    const env = channelEnv(); let prefs: Prefs | null = null; if (row.to_email) { const { data: p } = await db.from('portal_contact_prefs').select('*').eq('email', row.to_email).maybeSingle(); prefs = (p as Prefs) || null; }
    const r = await attempt(db, { ...row, errors: [] }, { prefs, subs: [], env, raw: process.env, fetchImpl: fetch, now: new Date() });
    return NextResponse.json({ success: true, delivery: r, message: r.status === 'sent' ? `أُرسلت عبر ${CHANNEL_AR[r.channel]}` : `ما زالت في قائمة اليد (${r.error || ''})` });
  }
  return bad('إجراء غير معروف');
}
