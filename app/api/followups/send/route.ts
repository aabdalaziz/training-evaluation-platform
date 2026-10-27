/**
 * /api/followups/send — إرسال روابط متابعة الأثر السلوكي (كيركباتريك 3)
 *  POST { followup_id, mode: 'send'|'remind'|'test', test_email? }  — من لوحة الإدارة (Bearer <access_token> لمستخدم إداري)
 *  GET  ?key=<CRON_SECRET>  — التشغيل التلقائي اليومي (vercel.json): يرسل الحملات التي بلغ موعدها، ويذكّر بعد remind_after_days،
 *                            ثم يشغّل فحص مركز الإشعارات (notifications_scan) ويراسل الإدارة بالجديد،
 *                            ثم بريد المتدربين التلقائي (فتح التقييم النهائي · إصدار الشهادة) — TRAINEE_MAIL=0 للتعطيل
 *                            ثم تذكيرات جلسات البث المباشر لبوابة أَثَر (خلال 30 ساعة)
 *                            ثم نبض «الشهادة الحية» للمشتركين (أَثَر · P11): بريد مجمّع عند تغيّر مستوى/حالة مهارة (أسبوعيًا على الأكثر)
 * يحتاج: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, (للـ Cron) CRON_SECRET, (اختياري) NEXT_PUBLIC_SITE_URL
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchFollowup } from '../../../../lib/behavior/mail';
import { runNotificationScan } from '../../../../lib/notifications/scan';
import { runTraineeMail } from '../../../../lib/notifications/trainee-mail';
import { cronHeartbeat } from '../../../../lib/health/collect';
import { runLiveReminders } from '../../../../lib/portal/live-cron';
import { runCredentialWatch } from '../../../../lib/portal/twin-cron';
import { runMissionCycle } from '../../../../lib/portal/missions-cron';
import { runContractPulse } from '../../../../lib/portal/contracts-cron';
import { syncPlacements, miaarClient } from '../../../../lib/portal/placement-sync';
import type { BehaviorFollowup } from '../../../../lib/behavior/model';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}
function siteOf(req: Request) { const u = new URL(req.url); return (process.env.NEXT_PUBLIC_SITE_URL || `${u.protocol}//${u.host}`).replace(/\/$/, ''); }

export async function POST(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) return bad('إعدادات الخادم غير مكتملة', 500);
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).single();
  if (!ALLOWED.includes(String((profile as any)?.role || '').toUpperCase())) return bad('غير مصرح', 403);

  const body = await req.json().catch(() => ({}));
  const mode = body.mode === 'remind' ? 'remind' : body.mode === 'test' ? 'test' : 'send';
  if (!body.followup_id) return bad('followup_id مطلوب');
  if (mode === 'test' && !body.test_email) return bad('test_email مطلوب');
  if (!process.env.RESEND_API_KEY) return bad('RESEND_API_KEY غير مضبوط في Vercel', 500);

  const db = serviceDb() || userClient;
  const { data: f, error } = await db.from('behavior_followups').select('*').eq('id', body.followup_id).maybeSingle();
  if (error || !f) return bad(error?.message || 'الحملة غير موجودة', 404);
  const result = await dispatchFollowup(db, f as BehaviorFollowup, siteOf(req), mode, body.test_email);
  return NextResponse.json({ success: true, ...result });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || url.searchParams.get('key') || '';
  if (!secret || given !== secret) return bad('unauthorized', 401);
  const db = serviceDb();
  if (!db) return bad('SUPABASE_SERVICE_ROLE_KEY مطلوب', 500);
  const dry = url.searchParams.get('dry') === '1';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const { data, error } = await db.from('behavior_followups').select('*').eq('status', 'open').eq('auto_send', true);
  if (error) return bad(error.message, 500);
  const site = siteOf(req);
  const out: any[] = [];
  for (const f of (data || []) as BehaviorFollowup[]) {
    const recipients = Array.isArray(f.recipients) ? f.recipients.length : 0;
    if (!recipients) continue;
    if (!f.sent_at && f.open_at && f.open_at <= today) {
      out.push(dry ? { followup_id: f.id, mode: 'send', recipients, dry: true } : await dispatchFollowup(db, f, site, 'send'));
      continue;
    }
    if (f.sent_at && !f.reminded_at && f.remind_after_days > 0) {
      const due = new Date(new Date(f.sent_at).getTime() + f.remind_after_days * 86400000);
      if (due <= new Date()) out.push(dry ? { followup_id: f.id, mode: 'remind', recipients, dry: true } : await dispatchFollowup(db, f, site, 'remind'));
    }
  }
  // فحص الإشعارات اليومي (نفس الـ Cron — بلا حاجة لمهمة Cron إضافية)
  let notifications: any = null;
  if (!dry) { try { notifications = await runNotificationScan(db, { source: 'cron', site, email: url.searchParams.get('email') !== '0' }); } catch (e: any) { notifications = { ok: false, error: e?.message || String(e) }; } }
  // بريد المتدربين التلقائي: فتح التقييم النهائي · إصدار الشهادة (TRAINEE_MAIL=0 للتعطيل · dry=1 للمعاينة)
  let trainee_mail: any = null;
  try { trainee_mail = await runTraineeMail(db, site, { dry }); } catch (e: any) { trainee_mail = { ok: false, error: e?.message || String(e) }; }
  // تذكيرات جلسات البث المباشر (أَثَر · P6): الجلسات خلال 30 ساعة القادمة التي لم تُذكَّر بعد
  let live_reminders: any = null;
  try { live_reminders = await runLiveReminders(db, site, { dry }); } catch (e: any) { live_reminders = { ok: false, error: e?.message || String(e) }; }
  // نبض الشهادة الحية للمشتركين (أَثَر · P11)
  let credential_pulse: any = null;
  try { credential_pulse = await runCredentialWatch(db, site, { dry }); } catch (e: any) { credential_pulse = { ok: false, error: e?.message || String(e) }; }
  // مهمات في قلب العمل: إسناد بعد شهادة الإتمام، تذكير، انتهاء (أَثَر · P12-أ)
  let missions: any = null;
  try { missions = await runMissionCycle(db, site, { dry }); } catch (e: any) { missions = { ok: false, error: e?.message || String(e) }; }
  // نبض عقود الأثر: إشعار عند استحقاق دفعة أو اقتراب إغلاق نافذة الأثر — بلا إفراج آلي (أَثَر · P12-ب)
  let contracts: any = null;
  try { contracts = await runContractPulse(db, site, { dry }); } catch (e: any) { contracts = { ok: false, error: e?.message || String(e) }; }
  // مزامنة نتائج مِعيار اليومية (أَثَر · P7) — تعمل فقط إن كانت MIAAR_* مضبوطة
  let placements: any = null;
  try { if (!dry && miaarClient()) placements = await syncPlacements(db, { limit: 300 }); } catch (e: any) { placements = { ok: false, error: e?.message || String(e) }; }
  // نبضة الكرون اليومي (لصفحة صحة المنصة)
  if (!dry) await cronHeartbeat(db, 'followups', { processed: out.length, notifications: notifications?.inserted ?? null, trainee_mail: trainee_mail?.sent ?? null });
  return NextResponse.json({ success: true, today, processed: out.length, results: out, notifications, trainee_mail, live_reminders, credential_pulse, missions, contracts, placements });
}
