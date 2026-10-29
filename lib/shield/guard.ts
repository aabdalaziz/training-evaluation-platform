// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — «الحارس»: الأحداث الأمنية وقواعد الإبلاغ.
 *  securityEvent(db, ev)  → يسجّل الحدث في portal_security_events؛ critical → إبلاغ الطاقم فورًا (P16: أي قناة متاحة/قائمة اليد)
 *                          وإبلاغ صاحب الحساب المتأثر إن عُرف بريده — بلا أسرار في النص.
 *  شذوذ متكرر (مثل 401 متتابعة على /mcp من عنوان واحد) يُحوَّل إلى حدث واحد لكل نافذة — لا طوفان أحداث.
 *  كل شيء هنا «أفضل جهد»: فشل التسجيل لا يُسقط الطلب الأصلي أبدًا.
 */
import { notify } from '../portal/notify';
import { rateLimit } from './ratelimit';

export type Severity = 'info' | 'warn' | 'critical';
export type SecurityEvent = { severity: Severity; kind: string; actor?: string | null; ip?: string | null; user_id?: string | null; user_email?: string | null; meta?: Record<string, unknown> };

export const KIND_AR: Record<string, string> = {
  token_reuse: 'إعادة استخدام رمز تجديد (هجوم محتمل)', code_reuse: 'إعادة استخدام كود تفويض', pkce_fail: 'فشل تحقق PKCE', bad_redirect: 'رابط عودة غير مسجَّل',
  mcp_401_burst: 'محاولات متكررة بلا تفويض على /mcp', rate_limited: 'تجاوز حد المعدل', delegation_created: 'تفويض شخصي جديد', delegation_revoked: 'إبطال تفويض',
  key_created: 'مفتاح جهة جديد', key_rotated: 'تدوير مفتاح جهة', key_revoked: 'إبطال مفتاح جهة', client_registered: 'تسجيل عميل OAuth', csp_report: 'تقرير CSP',
  scope_escalation: 'محاولة استخدام نطاق غير ممنوح', vuln_report: 'بلاغ ثغرة من باحث', drill: 'تمرين الدرع', stale_critical: 'أحداث حرجة بلا معالجة منذ أكثر من يوم', body_rejected: 'جسم طلب مرفوض (حجم/عمق)', cron_bad_secret: 'سرّ كرون خاطئ',
};
export const SEVERITY_AR: Record<Severity, string> = { info: 'معلومة', warn: 'تحذير', critical: 'حرج' };

/** القاعدة: ما الذي يُعدّ حرجًا تلقائيًا */
export const DEFAULT_SEVERITY: Record<string, Severity> = {
  token_reuse: 'critical', code_reuse: 'critical', vuln_report: 'critical', cron_bad_secret: 'warn', pkce_fail: 'warn', bad_redirect: 'warn', mcp_401_burst: 'warn',
  scope_escalation: 'warn', rate_limited: 'info', delegation_created: 'info', delegation_revoked: 'info', key_created: 'info', key_rotated: 'info', key_revoked: 'info',
  client_registered: 'info', csp_report: 'info', drill: 'info', body_rejected: 'info', stale_critical: 'critical',
};

const staffEmails = (env: Record<string, string | undefined>) => String(env.NOTIFY_EMAILS || env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/** نصّ عربي موجز للحدث (للرسائل واللوحة) — لا يضم أسرارًا */
export function describeEvent(ev: SecurityEvent): string {
  const base = KIND_AR[ev.kind] || ev.kind; const who = ev.actor ? ` · ${ev.actor}` : ''; const ip = ev.ip && ev.ip !== 'unknown' ? ` · ${ev.ip}` : '';
  return `${base}${who}${ip}`;
}

export async function securityEvent(db: any, ev: SecurityEvent, env: Record<string, string | undefined> = process.env): Promise<{ id: number | null; notified: boolean }> {
  const severity = ev.severity || DEFAULT_SEVERITY[ev.kind] || 'info';
  let id: number | null = null;
  try {
    const { data } = await db.from('portal_security_events').insert({ severity, kind: ev.kind, actor: ev.actor ? String(ev.actor).slice(0, 160) : null, ip: ev.ip ? String(ev.ip).slice(0, 64) : null, user_id: ev.user_id || null, meta: { ...(ev.meta || {}), user_email: ev.user_email ? String(ev.user_email).toLowerCase() : undefined } }).select('id').maybeSingle();
    id = (data as any)?.id ?? null;
  } catch { /* الحدث لا يُسقط الطلب */ }
  let notified = false;
  if (severity === 'critical') {
    const site = String(env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
    const text = describeEvent({ ...ev, severity });
    // الطاقم
    for (const to of staffEmails(env)) {
      try { const d = await notify(db, { kind: 'security_alert', to: { email: to, name: 'طاقم أَثَر' }, subject: `درع أَثَر — حدث حرج: ${KIND_AR[ev.kind] || ev.kind}`, text: `${text}\n${site}/admin/shield`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p><b>درع أَثَر</b> رصد حدثًا حرجًا:</p><p>${esc(text)}</p><p><a href="${site}/admin/shield">افتح لوحة الدرع</a></p></div>`, url: `${site}/admin/shield`, ref: id ? `sec-${id}` : null }, { env: env as NodeJS.ProcessEnv }); if (d.ok) notified = true; } catch { /* قناة غير متاحة */ }
    }
    // صاحب الحساب المتأثر
    if (ev.user_email && (ev.kind === 'token_reuse' || ev.kind === 'code_reuse')) {
      const client = String((ev.meta as any)?.client_name || 'مساعدك');
      try { await notify(db, { kind: 'security_user_alert', to: { email: ev.user_email }, subject: 'أَثَر أبطل تفويضًا لحمايتك', text: `أُبطل تفويض «${client}» لأن رمزًا أُعيد استخدامه. إن لم تكن أنت، غيّر كلمة مرورك وراجع «وكلائي»: ${site}/me/agents`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p>أبطل <b>درع أَثَر</b> تفويض «${esc(client)}» لأن رمز تجديد أو كود تفويض أُعيد استخدامه — وهذا لا يحدث في الاستخدام الطبيعي.</p><p>إن كنت أنت من أعاد الربط فلا شيء يلزمك سوى إعادة التفويض من مساعدك. وإن لم تكن أنت: غيّر كلمة مرورك الآن وراجع <a href="${site}/me/agents">وكلائي</a>.</p></div>`, url: `${site}/me/agents`, ref: id ? `sec-${id}-user` : null }, { env: env as NodeJS.ProcessEnv }); } catch { /* */ }
    }
    if (id) { try { await db.from('portal_security_events').update({ notified_at: new Date().toISOString() }).eq('id', id); } catch { /* */ } }
  }
  return { id, notified };
}

/** شذوذ متكرر: يسجّل حدثًا واحدًا حين يتجاوز المفتاح حدّه في النافذة (مثل 401 على /mcp من IP) */
export async function burst(db: any, key: string, windowS: number, threshold: number, ev: SecurityEvent, env: Record<string, string | undefined> = process.env): Promise<boolean> {
  try { const r = await rateLimit(db, `burst:${key}`, windowS, threshold); if (r.count === threshold + 1) { await securityEvent(db, { ...ev, meta: { ...(ev.meta || {}), count: r.count, window_s: windowS } }, env); return true; } } catch { /* */ }
  return false;
}

/** ملخص للوحة والعامة (مجهّل) */
export async function shieldSummary(db: any, days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [{ data: rows }, { data: lastDrill }] = await Promise.all([
    db.from('portal_security_events').select('severity,kind,handled_at').gte('at', since).limit(5000),
    db.from('portal_security_events').select('at,meta').eq('kind', 'drill').order('at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const r = (rows || []) as any[]; const by = (f: (x: any) => string) => { const m: Record<string, number> = {}; for (const x of r) { const k = f(x); m[k] = (m[k] || 0) + 1; } return m; };
  const drill = (lastDrill as any) || null; const dm = drill?.meta || {};
  return { days, total: r.length, by_severity: by(x => x.severity), by_kind: by(x => x.kind), open_critical: r.filter(x => x.severity === 'critical' && !x.handled_at).length,
    drill: drill ? { at: drill.at, passed: Number(dm.passed || 0), total: Number(dm.total || 0), ok: Number(dm.passed || 0) === Number(dm.total || 0) && Number(dm.total || 0) > 0 } : null };
}
