// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — الشخص: خريطة بياناته (عدّ لكل جدول) · «نسختي» (JSON قابل للنقل + HTML مقروء) · «من لمس بياناتي» · إيصال موقَّع.
 */
import { createHash } from 'node:crypto';
import { REGISTRY, personalTables, countsSpec, CATEGORY_AR, BASIS_AR, POLICY_AR, ACCESS_AR, NOTICE_VERSION } from './registry';
import type { RegistryEntry } from './registry';
import { signerFromEnv, signDocument } from '../portal/vc-server';

export type Subject = { id: string | null; email: string; name?: string | null };
export type TableCount = { table: string; label_ar: string; category: string; category_ar: string; purpose_ar: string; basis_ar: string; policy: string; policy_ar: string; retention_ar: string; access_ar: string[]; count: number | null };

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export const retentionText = (r: RegistryEntry) => r.policy === 'retain_legal' ? (r.retainNote_ar || 'مدة نظامية') : r.retentionDays ? (r.retentionDays >= 365 ? `${Math.round(r.retentionDays / 365)} سنوات ثم ${r.policy === 'delete' ? 'حذف' : 'تجهيل'} تلقائي` : `${r.retentionDays} يومًا ثم ${r.policy === 'delete' ? 'حذف' : 'تجهيل'} تلقائي`) : 'ما دام حسابك قائمًا (يُزال عند النسيان)';

/** فلتر صفوف الشخص في جدول: user_id أو email (أيهما متاح) */
function orFilter(r: RegistryEntry, s: Subject): string | null {
  const parts: string[] = [];
  if (r.userCol && s.id) parts.push(`${r.userCol}.eq.${s.id}`);
  if (r.emailCol && s.email) parts.push(`${r.emailCol}.ilike.${s.email.replace(/[,()]/g, '')}`);
  return parts.length ? parts.join(',') : null;
}

/** عدّ صفوف الشخص في كل جدول مسجَّل — RPC واحد (SQL 761) وإلا عدّ جدولًا جدولًا */
export async function subjectCounts(db: any, s: Subject): Promise<TableCount[]> {
  let counts: Record<string, number | null> = {};
  try { const { data, error } = await db.rpc('vault_subject_counts', { p_user: s.id, p_email: s.email, p_tables: countsSpec() }); if (!error && data && typeof data === 'object') counts = data as any; } catch { /* fallback */ }
  const out: TableCount[] = [];
  for (const r of personalTables()) {
    let n: number | null = Object.prototype.hasOwnProperty.call(counts, r.table) ? counts[r.table] : null;
    if (n === null && !Object.keys(counts).length) {
      const f = orFilter(r, s);
      if (f) { try { const { count, error } = await db.from(r.table).select('*', { count: 'exact', head: true }).or(f); n = error ? null : (count ?? 0); } catch { n = null; } } else n = 0;
    }
    out.push({ table: r.table, label_ar: r.label_ar, category: r.category, category_ar: CATEGORY_AR[r.category], purpose_ar: r.purpose_ar, basis_ar: BASIS_AR[r.basis], policy: r.policy, policy_ar: POLICY_AR[r.policy], retention_ar: retentionText(r), access_ar: r.access.map(a => ACCESS_AR[a]), count: n });
  }
  return out;
}

/** نسخة قابلة للنقل: كل صفوف الشخص من كل جدول (بحدّ 500 صف للجدول) — JSON مفتوح بلا صيغة خاصة */
export async function exportSubject(db: any, s: Subject, opts: { perTable?: number } = {}) {
  const lim = opts.perTable || 500; const tables: Record<string, { label_ar: string; label_en: string; purpose_ar: string; rows: any[]; truncated: boolean; error?: string }> = {};
  for (const r of personalTables()) {
    const f = orFilter(r, s); if (!f) continue;
    try {
      const { data, error } = await db.from(r.table).select(r.exportSelect || '*').or(f).limit(lim + 1);
      if (error) { tables[r.table] = { label_ar: r.label_ar, label_en: r.label_en, purpose_ar: r.purpose_ar, rows: [], truncated: false, error: 'غير متاح' }; continue; }
      const rows = (data || []) as any[]; if (!rows.length) continue;
      tables[r.table] = { label_ar: r.label_ar, label_en: r.label_en, purpose_ar: r.purpose_ar, rows: rows.slice(0, lim).map(scrubRow), truncated: rows.length > lim };
    } catch { tables[r.table] = { label_ar: r.label_ar, label_en: r.label_en, purpose_ar: r.purpose_ar, rows: [], truncated: false, error: 'غير متاح' }; }
  }
  const generated_at = new Date().toISOString();
  const doc = { '@context': 'https://athar-portal.vercel.app/privacy#export', type: 'AtharPersonalDataExport', notice_version: NOTICE_VERSION, generated_at, subject: { id: s.id, email: s.email, name: s.name || null }, tables };
  return { ...doc, hash: 'sha256:' + sha256(JSON.stringify(doc)) };
}
/** لا نصدّر أسرار الآخرين/النظام حتى في نسخة الشخص */
const SECRET_KEYS = /^(token|token_hash|secret|p256dh|auth|key_hash|password|password_hash|code_hash|refresh_hash|access_hash)$/i;
function scrubRow(row: any) { const o: any = {}; for (const k of Object.keys(row || {})) o[k] = SECRET_KEYS.test(k) ? '[محجوب]' : row[k]; return o; }

/** نسخة مقروءة (HTML عربي) من التصدير */
export function renderExportHtml(x: Awaited<ReturnType<typeof exportSubject>>): string {
  const secs = Object.entries(x.tables).map(([t, v]) => {
    const keys = Array.from(new Set(v.rows.flatMap(r => Object.keys(r)))).slice(0, 14);
    const rows = v.rows.slice(0, 200).map(r => `<tr>${keys.map(k => `<td>${esc(typeof r[k] === 'object' && r[k] !== null ? JSON.stringify(r[k]).slice(0, 160) : String(r[k] ?? '')).slice(0, 200)}</td>`).join('')}</tr>`).join('');
    return `<section><h2>${esc(v.label_ar)} <small>${esc(t)} · ${v.rows.length}${v.truncated ? '+' : ''} صف</small></h2><p>${esc(v.purpose_ar)}</p>${v.error ? `<p class="e">${esc(v.error)}</p>` : `<div class="w"><table><thead><tr>${keys.map(k => `<th>${esc(k)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`}</section>`;
  }).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>نسختي من أَثَر</title><style>body{font-family:Tahoma,Arial,sans-serif;margin:24px;color:#0f2a4e;background:#fff}h1{margin:0 0 4px}h2{font-size:16px;margin:22px 0 4px;border-bottom:2px solid #c9a24b;padding-bottom:4px}h2 small{color:#64748b;font-weight:400;font-size:12px}p{color:#334155;font-size:13px;margin:4px 0}.w{overflow:auto}table{border-collapse:collapse;font-size:12px;min-width:100%}th,td{border:1px solid #e5e9f0;padding:4px 6px;text-align:start;vertical-align:top;max-width:280px;word-break:break-word}th{background:#f6f8fb}.m{color:#64748b;font-size:12px}.e{color:#b91c1c}</style></head><body><h1>نسختي من أَثَر</h1><p class="m">${esc(x.subject.email)} · أُنشئت ${esc(x.generated_at)} · إصدار الإشعار ${esc(x.notice_version)} · البصمة ${esc(x.hash)}</p><p>هذه نسخة كاملة من بياناتك الشخصية لدى بوابة أَثَر كما هي في لحظة الإنشاء. الملف المرافق بصيغة JSON مفتوحة قابلة للنقل إلى أي جهة. ${Object.keys(x.tables).length ? '' : 'لا توجد بيانات شخصية مسجَّلة باسمك حاليًا.'}</p>${secs}</body></html>`;
}

export type Touch = { at: string; who: string; what: string; kind: 'agent' | 'ai' | 'message' | 'staff' | 'security' | 'org' };
/** «من لمس بياناتي» — آخر 90 يومًا: وكلاء مفوَّضون · ذكاء اصطناعي · رسائل · طاقم (سجل التدقيق) · أمن */
export async function touches(db: any, s: Subject, days = 90): Promise<Touch[]> {
  const since = new Date(Date.now() - days * 864e5).toISOString(); const out: Touch[] = [];
  const safe = async (p: Promise<any>) => { try { const { data } = await p; return (data || []) as any[]; } catch { return []; } };
  const dels = await safe(db.from('portal_delegations').select('client_name,client_id,scopes,last_used_at,uses,revoked_at').or([s.id ? `user_id.eq.${s.id}` : '', `email.ilike.${s.email}`].filter(Boolean).join(',')).limit(50));
  for (const d of dels) if (d.last_used_at && d.last_used_at >= since) out.push({ at: d.last_used_at, who: `وكيل: ${d.client_name || d.client_id || 'مجهول'}`, what: `قرأ عبر سفارة أَثَر (${(d.scopes || []).join(' · ')}) · ${d.uses || 0} مرة${d.revoked_at ? ' · التفويض مُلغى' : ''}`, kind: 'agent' });
  const ai = await safe(db.from('portal_ai_log').select('created_at,purpose,provider,ok').or([s.id ? `user_id.eq.${s.id}` : '', `email.ilike.${s.email}`].filter(Boolean).join(',')).gte('created_at', since).order('created_at', { ascending: false }).limit(40));
  const byPurpose: Record<string, { n: number; at: string; provider: string }> = {};
  for (const a of ai) { const k = a.purpose || 'ai'; byPurpose[k] = byPurpose[k] || { n: 0, at: a.created_at, provider: a.provider || '' }; byPurpose[k].n++; }
  for (const [p, v] of Object.entries(byPurpose)) out.push({ at: v.at, who: `ذكاء اصطناعي (${v.provider || 'المزوّد المضبوط'})`, what: `عالج نصوصك لغرض «${p}» ${v.n} مرة — بلا اسمك أو بريدك`, kind: 'ai' });
  const msgs = await safe(db.from('portal_message_log').select('created_at,kind,channel,status').ilike('to_email', s.email).gte('created_at', since).order('created_at', { ascending: false }).limit(20));
  for (const m of msgs) out.push({ at: m.created_at, who: 'أَثَر (رسالة)', what: `${m.kind} عبر ${m.channel} · ${m.status}`, kind: 'message' });
  if (s.id) {
    const au = await safe(db.from('audit_logs').select('created_at,action,entity_type,actor_role').eq('entity_id', s.id).gte('created_at', since).order('created_at', { ascending: false }).limit(20));
    for (const a of au) out.push({ at: a.created_at, who: `طاقم أَثَر (${a.actor_role || 'نظام'})`, what: `${a.action} على ${a.entity_type}`, kind: 'staff' });
    const se = await safe(db.from('portal_security_events').select('at,kind,severity').eq('user_id', s.id).gte('at', since).order('at', { ascending: false }).limit(10));
    for (const e of se) out.push({ at: e.at, who: 'درع أَثَر', what: `حدث ${e.kind} (${e.severity})`, kind: 'security' });
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 80);
}

/** إيصال موقَّع (Ed25519 — مفتاح أَثَر نفسه الذي يوقّع الشهادات) لأي عملية في الخزنة */
export async function signReceipt(doc: Record<string, any>, env: Record<string, string | undefined> = process.env, site = '') {
  const S = (site || env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  const base = { '@context': `${S}/privacy#receipt`, type: 'AtharVaultReceipt', issuer: S ? `did:web:${new URL(S).host}` : 'athar', issued_at: new Date().toISOString(), ...doc };
  const signer = signerFromEnv(env as NodeJS.ProcessEnv, S);
  if (!signer) return { ...base, proof: null, hash: 'sha256:' + sha256(JSON.stringify(base)) };
  try { const signed = await signDocument(base, signer); return { ...signed, hash: 'sha256:' + sha256(JSON.stringify(base)) }; } catch { return { ...base, proof: null, hash: 'sha256:' + sha256(JSON.stringify(base)) }; }
}

/** الموافقات الحيّة من مصادرها الفعلية (لا من الدفتر فقط) */
export async function liveConsents(db: any, s: Subject) {
  const safe = async (p: Promise<any>) => { try { const { data } = await p; return data; } catch { return null; } };
  const prefs = await safe(db.from('portal_contact_prefs').select('whatsapp_opt_in,push_ok,preferred_channel').ilike('email', s.email).maybeSingle());
  const push = s.id ? await safe(db.from('portal_push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', s.id).eq('active', true)) : null;
  const prof = s.id ? await safe(db.from('portal_profiles').select('share_mode').eq('user_id', s.id).maybeSingle()) : null;
  const dels = (await safe(db.from('portal_delegations').select('id,client_name,client_id,scopes,created_at,revoked_at,refresh_expires_at').or([s.id ? `user_id.eq.${s.id}` : '', `email.ilike.${s.email}`].filter(Boolean).join(',')).is('revoked_at', null).limit(30))) || [];
  const ledger = (await safe(db.from('portal_consents').select('scope,granted_at,withdrawn_at,source,created_at').ilike('email', s.email).order('created_at', { ascending: false }).limit(60))) || [];
  const pushCount = Number((push as any)?.count ?? 0);
  return {
    items: [
      { scope: 'whatsapp', label_ar: 'رسائل واتساب', on: !!prefs?.whatsapp_opt_in, how_ar: 'تفضيلات التواصل في «أَثَر في الجيب»' },
      { scope: 'push', label_ar: 'تنبيهات المتصفح', on: pushCount > 0 || !!prefs?.push_ok, how_ar: `${pushCount} جهاز مشترك` },
      { scope: 'share_profile', label_ar: 'مشاركة ملفي المهاري', on: !!prof?.share_mode && prof.share_mode !== 'private', how_ar: `الوضع الحالي: ${prof?.share_mode || 'private'}` },
      ...(dels as any[]).map(d => ({ scope: `agent:${d.id}`, label_ar: `تفويض وكيل: ${d.client_name || d.client_id}`, on: true, how_ar: `النطاقات: ${(d.scopes || []).join(' · ')}${d.refresh_expires_at ? ` · ينتهي ${String(d.refresh_expires_at).slice(0, 10)}` : ''}` })),
    ],
    ledger,
  };
}
