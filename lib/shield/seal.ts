// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر — الطبقة الثانية (P65) ★2 «شهادة الدرع» الشهرية — ATH-SH-XXXX-XXXX
 *  نتائج التمرين اليومي (أحداث drill) تُختم شهريًا وثيقةً موقَّعة (نمط إيصالات الخزنة P22/رسالة الشهر P52) تُعرض في /security
 *  ويتحقّق منها أيّ أحد في /verify/shield بالرمز — بلا أسرار: الشهر · أيام التمرين · أيام النجاح الكامل · الاختبارات التي أخفقت وكم مرّة.
 *  تصدر داخل الكرون اليومي الموجود عند أول تشغيل بعد انتهاء الشهر؛ ويمكن للطاقم إصدار ختم «جزئي» للشهر الجاري (يُستبدل عند اكتماله).
 */
import { randomBytes } from 'crypto';
import { signReceipt, sha256 } from '../vault/subject';
import { securityEvent } from './guard';

export const SEAL_PREFIX = 'ATH-SH';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function sealCode(rand: (n: number) => Buffer = randomBytes): string {
  const b = rand(8); let s = ''; for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return `${SEAL_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`;
}
export const isSealCode = (c: string) => /^ATH-SH-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c || '').trim().toUpperCase());

const riyadhYmd = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600000).toISOString().slice(0, 10);
export const monthOf = (d: Date) => new Date(d.getTime() + 3 * 3600000).toISOString().slice(0, 7);
export function prevMonth(d: Date): string { const [y, m] = monthOf(d).split('-').map(Number); const pm = m === 1 ? 12 : m - 1; return `${m === 1 ? y - 1 : y}-${String(pm).padStart(2, '0')}`; }
export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const monthAr = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${MONTHS_AR[(m || 1) - 1]} ${y}`; };

export type DrillEvent = { at: string; meta?: { passed?: number; total?: number; checks?: { id: string; ok: boolean; title_ar?: string }[] } | null };
export type SealStats = { month: string; total_days: number; passed_days: number; checks_total: number; failed: { id: string; title_ar: string; days: number }[]; score: number };

/** إحصاء نقي: اليوم يُحسب ناجحًا إذا نجح آخر تمرين فيه كاملًا */
export function sealStats(drills: DrillEvent[], month: string): SealStats {
  const byDay = new Map<string, DrillEvent>();
  for (const d of drills) { const ymd = riyadhYmd(d.at); if (!ymd.startsWith(month)) continue; const cur = byDay.get(ymd); if (!cur || d.at > cur.at) byDay.set(ymd, d); }
  let passed_days = 0; let checks_total = 0; const failed = new Map<string, { title_ar: string; days: number }>();
  for (const d of byDay.values()) {
    const p = Number(d.meta?.passed || 0); const t = Number(d.meta?.total || 0); checks_total = Math.max(checks_total, t); if (t && p === t) passed_days += 1;
    for (const c of d.meta?.checks || []) if (!c.ok) { const f = failed.get(c.id) || { title_ar: c.title_ar || c.id, days: 0 }; f.days += 1; failed.set(c.id, f); }
  }
  const total_days = byDay.size;
  return { month, total_days, passed_days, checks_total, failed: [...failed.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.days - a.days), score: total_days ? Math.round(passed_days * 100 / total_days) : 0 };
}

export type Seal = { id?: number; month: string; code: string; issued_at: string; passed_days: number; total_days: number; checks_total: number; digest?: string; body: any };

/** إصدار (أو تحديث) ختم شهر — يُعيد null إن لم يكن ثمة تمرين في ذلك الشهر */
export async function issueSeal(db: any, opts: { month: string; partial?: boolean; env?: Record<string, string | undefined>; site?: string; actor?: string }): Promise<Seal | null> {
  const env = opts.env || process.env; const since = `${opts.month}-01T00:00:00+03:00`;
  const [y, m] = opts.month.split('-').map(Number); const until = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - 3 * 3600000).toISOString();
  const { data } = await db.from('portal_security_events').select('at,meta').eq('kind', 'drill').gte('at', new Date(since).toISOString()).lt('at', until).order('at', { ascending: true }).limit(400);
  const stats = sealStats((data || []) as DrillEvent[], opts.month); if (!stats.total_days) return null;
  const { data: existing } = await db.from('portal_shield_seals').select('id,code,body').eq('month', opts.month).maybeSingle();
  if (existing && !existing.body?.partial) return { ...(existing as any), month: opts.month, issued_at: existing.body?.issued_at || '', passed_days: stats.passed_days, total_days: stats.total_days, checks_total: stats.checks_total } as Seal; // ختم مكتمل لا يُعاد
  const code = existing?.code || sealCode();
  const body = await signReceipt({ type: 'AtharShieldSeal', kind: 'shield_seal', code, month: opts.month, month_ar: monthAr(opts.month), partial: !!opts.partial, total_days: stats.total_days, passed_days: stats.passed_days, checks_total: stats.checks_total, score: stats.score, failed: stats.failed, statement_ar: sealStatementAr(stats, !!opts.partial) }, env, opts.site || '');
  const row = { month: opts.month, code, issued_at: new Date().toISOString(), passed_days: stats.passed_days, total_days: stats.total_days, checks_total: stats.checks_total, digest: sealDigest(body), body };
  const { error } = await db.from('portal_shield_seals').upsert(row, { onConflict: 'month' }); if (error) return null;
  await securityEvent(db, { severity: 'info', kind: 'shield_seal', actor: opts.actor || 'cron', meta: { code, month: opts.month, passed_days: stats.passed_days, total_days: stats.total_days, partial: !!opts.partial } }, env);
  return row;
}

/** داخل الكرون: إن لم يكن للشهر الماضي ختم مكتمل → أصدره */
export async function sealLastMonthIfDue(db: any, now = new Date(), env?: Record<string, string | undefined>, site?: string): Promise<Seal | null> {
  const month = prevMonth(now);
  const { data } = await db.from('portal_shield_seals').select('id,body').eq('month', month).maybeSingle();
  if (data && !data.body?.partial) return null;
  return issueSeal(db, { month, partial: false, env, site, actor: 'cron' });
}

export function sealStatementAr(s: SealStats, partial: boolean): string {
  const d = s.total_days === 1 ? 'يوم واحد' : s.total_days === 2 ? 'يومين' : s.total_days <= 10 ? `${s.total_days} أيام` : `${s.total_days} يومًا`;
  return `${partial ? 'ختم جزئي لشهر' : 'شهادة درع أَثَر لشهر'} ${monthAr(s.month)}: جرى التمرين الذاتي (${s.checks_total} اختبارًا) في ${d}، ونجح كاملًا في ${s.passed_days} منها (${s.score}%).${s.failed.length ? ` الاختبارات التي أخفقت: ${s.failed.map(f => `${f.title_ar} (${f.days})`).join('، ')}.` : ' لم يخفق اختبار واحد.'}`;
}

/** بصمة قياسية (مفاتيح مرتّبة) — لأن jsonb في القاعدة لا يحفظ ترتيب المفاتيح */
export function canonical(v: any): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
export function sealDigest(body: any): string { const { proof: _p, hash: _h, ...base } = body || {}; void _p; void _h; return 'sha256:' + sha256(canonical(base)); }
/** تحقّق عام: الرمز موجود؟ والبصمة المخزَّنة تطابق الوثيقة؟ */
export function verifySealBody(body: any, digest: string): boolean { return !!body && typeof body === 'object' && !!digest && sealDigest(body) === digest; }
export async function findSeal(db: any, code: string): Promise<{ valid: boolean; intact?: boolean; seal?: Omit<Seal, 'id'> & { signed: boolean } }> {
  const c = String(code || '').trim().toUpperCase(); if (!isSealCode(c)) return { valid: false };
  const { data } = await db.from('portal_shield_seals').select('month,code,issued_at,passed_days,total_days,checks_total,digest,body').eq('code', c).maybeSingle();
  if (!data) return { valid: false };
  return { valid: true, intact: verifySealBody(data.body, String(data.digest || '')), seal: { ...(data as any), signed: !!data.body?.proof } };
}
export async function latestSeal(db: any): Promise<(Omit<Seal, 'id' | 'body'> & { statement_ar: string; partial: boolean; signed: boolean }) | null> {
  const { data } = await db.from('portal_shield_seals').select('month,code,issued_at,passed_days,total_days,checks_total,body').order('month', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null; const { body, ...rest } = data as any;
  return { ...rest, statement_ar: String(body?.statement_ar || ''), partial: !!body?.partial, signed: !!body?.proof };
}
