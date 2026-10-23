/**
 * /api/admin/health — صحة المنصة
 *  GET  — تقرير الفحص الكامل (Bearer لمستخدم إداري) + مزامنة تنبيهات الجرس (system_health)
 *  POST { action: 'test_email' | 'test_ai' } — اختبارات فورية
 * يحتاج SUPABASE_SERVICE_ROLE_KEY للفحص الكامل؛ بدونه يعمل فحصًا جزئيًا بصلاحيات المستخدم
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { collectHealth, syncHealthAlerts } from '../../../../lib/health/collect';
import { evaluateHealth, healthAlerts, overall } from '../../../../lib/health/model';
import { sendViaResend } from '../../../../lib/email/resend';
import { readKey, resolveModel, callWithFallback } from '../../../../lib/ai/provider';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function authorize(req: Request) {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: profile } = await userClient.from('profiles').select('role,full_name').eq('id', u.user.id).single();
  const role = String((profile as any)?.role || '').toUpperCase();
  if (!ALLOWED.includes(role)) return { error: bad('غير مصرح — صفحة صحة المنصة للإدارة ومحلل الجودة', 403) };
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const db = service ? createClient(SUPABASE_URL, service) : userClient;
  return { user: u.user, role, db, hasService: !!service };
}

export async function GET(req: Request) {
  const a = await authorize(req); if ('error' in a) return a.error;
  try {
    const raw = await collectHealth(a.db);
    const checks = evaluateHealth(raw);
    let alerts: { inserted: number; resolved: number } | null = null;
    if (a.hasService) alerts = await syncHealthAlerts(a.db, healthAlerts(checks));
    return NextResponse.json({ success: true, generatedAt: raw.now, partial: !a.hasService, summary: overall(checks), checks, raw: { counts: raw.counts, crons: raw.crons, mail7d: raw.mail7d, db: raw.db, ai: raw.ai }, alerts });
  } catch (e: any) { return bad(e?.message || 'تعذر تنفيذ الفحص', 500); }
}

export async function POST(req: Request) {
  const a = await authorize(req); if ('error' in a) return a.error;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || '');
  const t0 = Date.now();
  if (action === 'test_email') {
    const to = String(a.user.email || '').toLowerCase();
    if (!to) return bad('لا يوجد بريد لحسابك');
    try {
      const r = await sendViaResend({ to: [to], subject: 'اختبار البريد — منصة التقويم', html: `<div dir="rtl" style="font-family:Tahoma,Arial;padding:16px"><h2 style="color:#0f2a4e;margin:0 0 8px">البريد يعمل ✅</h2><p>هذه رسالة اختبار من صفحة صحة المنصة. أُرسلت في <bdi>${new Date().toISOString()}</bdi>.</p></div>`, tags: [{ name: 'type', value: 'health_test' }] });
      if (a.hasService) { try { await a.db.from('audit_logs').insert({ actor_id: a.user.id, actor_email: to, actor_role: a.role, action: 'health_test_email', entity_type: 'system', entity_label: to, source: 'app', metadata: { id: r?.id || null } }); } catch { /* اختياري */ } }
      return NextResponse.json({ success: true, action, to, ms: Date.now() - t0, id: r?.id || null });
    } catch (e: any) { return NextResponse.json({ success: false, action, to, ms: Date.now() - t0, error: e?.message || String(e) }); }
  }
  if (action === 'test_ai') {
    const { key, provider } = readKey();
    if (!key) return NextResponse.json({ success: false, action, error: 'AI_API_KEY غير مضبوط — يعمل البديل المحلي فقط' });
    try {
      const { candidates } = await resolveModel(provider, key);
      const r = await callWithFallback(provider, key, candidates, 'أنت مساعد اختبار. أجب بصيغة JSON فقط.', 'أعد الكائن التالي حرفيًا: {"ok":true,"msg":"جاهز"}', Date.now() + 25000);
      let ok = false; try { ok = !!JSON.parse(r.text.slice(r.text.indexOf('{'), r.text.lastIndexOf('}') + 1)).ok; } catch { ok = /ok/i.test(r.text); }
      if (a.hasService) { try { await a.db.from('audit_logs').insert({ actor_id: a.user.id, actor_email: a.user.email || null, actor_role: a.role, action: 'health_test_ai', entity_type: 'ai', entity_label: r.model, source: 'app', metadata: { provider, ok, ms: Date.now() - t0 } }); } catch { /* اختياري */ } }
      return NextResponse.json({ success: ok, action, provider, model: r.model, candidates: candidates.slice(0, 5), ms: Date.now() - t0, sample: r.text.slice(0, 200), error: ok ? undefined : 'النموذج استجاب لكن بصيغة غير متوقعة' });
    } catch (e: any) { return NextResponse.json({ success: false, action, provider, ms: Date.now() - t0, error: e?.message || String(e) }); }
  }
  return bad('إجراء غير معروف');
}
