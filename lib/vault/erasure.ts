// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * خزنة أَثَر — «أن تُنسى»: خطة شفافة من السجل → حجر 7 أيام برابط تراجع → تنفيذ آلي (حذف/تجهيل/إبقاء نظامي) → حذف حساب الدخول → إيصال موقَّع → تجزئة البريد في الخزنة نفسها.
 */
import { randomBytes } from 'node:crypto';
import { REGISTRY, erasurePlan, ERASURE_HOLD_DAYS } from './registry';
import { sha256, signReceipt } from './subject';
import { createDsr } from './dsr';
import { notify } from '../portal/notify';

export type QueueRow = { id: number; created_at: string; user_id: string; email: string; full_name: string | null; token_hash: string; execute_after: string; cancelled_at: string | null; executed_at: string | null; plan: any; receipt: any; dsr_id: number | null };
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
export const hashEmail = (e: string) => 'sha256:' + sha256(e.toLowerCase()).slice(0, 32);

export async function erasureStatus(db: any, userId: string | null, email: string): Promise<QueueRow | null> {
  const { data } = await db.from('portal_erasure_queue').select('*').or([userId ? `user_id.eq.${userId}` : '', `email.ilike.${email}`].filter(Boolean).join(',')).is('executed_at', null).is('cancelled_at', null).order('created_at', { ascending: false }).limit(1);
  return (data?.[0] as QueueRow) || null;
}

/** طلب النسيان: يفتح DSR (erasure) + صفّ حجر برمز تراجع، ويرسل رسالة بالرابط وبالخطة */
export async function requestErasure(db: any, s: { id: string; email: string; name?: string | null }, site: string, env: Record<string, string | undefined> = process.env) {
  const existing = await erasureStatus(db, s.id, s.email);
  if (existing) return { ok: true, duplicate: true, queue: existing, plan: existing.plan };
  const token = randomBytes(24).toString('base64url'); const token_hash = sha256(token);
  const plan = erasurePlan();
  const dsr = await createDsr(db, { user_id: s.id, email: s.email, full_name: s.name || null, kind: 'erasure', details: { hold_days: ERASURE_HOLD_DAYS } });
  const execute_after = new Date(Date.now() + ERASURE_HOLD_DAYS * 864e5).toISOString();
  const { data, error } = await db.from('portal_erasure_queue').insert({ user_id: s.id, email: s.email.toLowerCase(), full_name: s.name || null, token_hash, execute_after, plan, dsr_id: dsr.row?.id || null }).select('*').maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || 'تعذّر تسجيل الطلب' };
  const undo = `${site}/api/vault/confirm?t=${token}&a=undo`;
  const when = new Date(execute_after).toLocaleString('ar-SA', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Riyadh' });
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9;color:#0f2a4e"><h2 style="margin:0 0 8px">طلب النسيان وصل</h2><p>سيُنفَّذ تلقائيًا في <b>${esc(when)}</b> ما لم تتراجع قبلها.</p><p><b>ما سيُحذف:</b> ${plan.delete.map(x => esc(x.label_ar)).join(' · ')}</p><p><b>ما سيُجهَّل (يبقى رقمًا في الإحصاءات بلا هويتك):</b> ${plan.anonymize.map(x => esc(x.label_ar)).join(' · ')}</p><p><b>ما يبقى نظامًا لمدة محددة:</b> ${plan.retain.map(x => esc(x.label_ar)).join(' · ')}</p><p>كما سيُحذف حساب الدخول نفسه، وستصلك رسالة أخيرة تحمل إيصال النسيان الموقَّع.</p><p style="margin-top:14px"><a href="${undo}" style="background:#0f2a4e;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">غيّرت رأيي — أوقف النسيان</a></p><p style="color:#64748b;font-size:12px">الرابط صالح حتى موعد التنفيذ. إن لم تكن أنت من طلب هذا فاضغط الزر فورًا وراسلنا.</p></div>`;
  try { await notify(db, { kind: 'erasure_confirm', to: { email: s.email, name: s.name || null }, subject: 'طلب النسيان من أَثَر — رابط التراجع', html, text: `طلب النسيان سيُنفَّذ في ${when}. للتراجع: ${undo}`, url: undo, ref: `erasure:${(data as any).id}` }); } catch { /* الرسالة لا تُسقط الطلب */ }
  return { ok: true, duplicate: false, queue: data as QueueRow, plan, execute_after, undo_preview: env.NODE_ENV === 'test' ? undo : undefined };
}

export async function undoErasure(db: any, token: string): Promise<{ ok: boolean; error?: string; email?: string }> {
  if (!token) return { ok: false, error: 'رمز ناقص' };
  const { data } = await db.from('portal_erasure_queue').select('*').eq('token_hash', sha256(token)).is('executed_at', null).maybeSingle();
  if (!data) return { ok: false, error: 'الرابط غير صالح أو نُفِّذ الطلب' };
  if ((data as any).cancelled_at) return { ok: true, email: (data as any).email };
  await db.from('portal_erasure_queue').update({ cancelled_at: new Date().toISOString() }).eq('id', (data as any).id);
  if ((data as any).dsr_id) await db.from('portal_dsr_requests').update({ status: 'cancelled', closed_at: new Date().toISOString(), result: { by: 'subject', via: 'undo_link' } }).eq('id', (data as any).dsr_id);
  return { ok: true, email: (data as any).email };
}

export async function cancelOwnErasure(db: any, userId: string, email: string) {
  const q = await erasureStatus(db, userId, email); if (!q) return false;
  await db.from('portal_erasure_queue').update({ cancelled_at: new Date().toISOString() }).eq('id', q.id);
  if (q.dsr_id) await db.from('portal_dsr_requests').update({ status: 'cancelled', closed_at: new Date().toISOString(), result: { by: 'subject', via: 'me_data' } }).eq('id', q.dsr_id);
  return true;
}

/** التنفيذ الفعلي — يُستدعى من الكرون بعد انتهاء الحجر أو يدويًا من غرفة الطلبات */
export async function executeErasure(db: any, q: QueueRow, site: string, env: Record<string, string | undefined> = process.env, authAdmin?: { deleteUser: (id: string) => Promise<{ error: any }> }) {
  const counts: Record<string, { action: string; rows: number | null; note?: string }> = {}; const at = new Date().toISOString();
  q = { ...q }; const email = q.email.toLowerCase();
  for (const r of REGISTRY) {
    if (r.policy === 'none') continue;
    if (r.policy === 'retain_legal') { counts[r.table] = { action: 'retain', rows: null, note: r.retainNote_ar || '' }; continue; }
    if (!r.userCol && !r.emailCol) continue;
    try {
      if (r.policy === 'delete') { const { data, error } = await db.rpc('vault_delete', { p_table: r.table, p_user: r.userCol ? q.user_id : null, p_email: r.emailCol ? q.email : null, p_user_col: r.userCol, p_email_col: r.emailCol }); counts[r.table] = { action: 'delete', rows: error ? null : Number(data ?? 0), note: error ? 'تعذّر' : undefined }; }
      else { const { data, error } = await db.rpc('vault_anonymize', { p_table: r.table, p_user: r.userCol ? q.user_id : null, p_email: r.emailCol ? q.email : null, p_user_col: r.userCol, p_email_col: r.emailCol, p_null_cols: r.piiCols }); counts[r.table] = { action: 'anonymize', rows: error ? null : Number(data ?? 0), note: error ? 'تعذّر' : undefined }; }
    } catch { counts[r.table] = { action: r.policy, rows: null, note: 'تعذّر' }; }
  }
  // الشهادات الصادرة تبقى (نظامًا) لكن نُجهِّل البريد في سجل الإصدار إن لم تعد صالحة — لا نلمس الصالحة لأن التحقق يحتاجها
  try { await db.rpc('vault_scrub_audit', { p_user: q.user_id, p_email: q.email }); } catch { /* */ }
  // حساب الدخول
  let authDeleted = false;
  try { if (authAdmin) { const { error } = await authAdmin.deleteUser(q.user_id); authDeleted = !error; } else if (db?.auth?.admin?.deleteUser) { const { error } = await db.auth.admin.deleteUser(q.user_id); authDeleted = !error; } } catch { authDeleted = false; }
  const receipt = await signReceipt({ kind: 'erasure', subject_hash: hashEmail(q.email), requested_at: q.created_at, executed_at: at, hold_days: ERASURE_HOLD_DAYS, auth_account_deleted: authDeleted, tables: counts }, env, site);
  // الرسالة الأخيرة (قبل تجزئة البريد)
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9;color:#0f2a4e"><h2 style="margin:0 0 8px">نُفِّذ النسيان</h2><p>حُذفت بياناتك الشخصية من أَثَر أو جُهِّلت، وحُذف حساب الدخول${authDeleted ? '' : ' (سيُستكمل حذف حساب الدخول يدويًا خلال أيام)'}. ما بقي هو ما يلزمنا نظامًا لمدة محددة (شهادات صادرة، فواتير) وإيصال هذا النسيان ببصمة لا باسم.</p><p>بصمة الإيصال: <code>${esc(receipt.hash)}</code>${receipt.proof ? ' — موقَّع بمفتاح أَثَر ويمكن التحقق منه لاحقًا.' : ''}</p><p>شكرًا لأنك كنت جزءًا من الأثر.</p></div>`;
  try { await notify(db, { kind: 'erasure_receipt', to: { email: q.email, name: q.full_name }, subject: 'إيصال النسيان — أَثَر', html, text: `نُفِّذ النسيان. بصمة الإيصال: ${receipt.hash}`, ref: `erasure:${q.id}` }); } catch { /* */ }
  // تجزئة البريد في الخزنة نفسها (الدفتر · الطلبات · الحجر · سجل الرسائل الخاص بالإيصال)
  const h = hashEmail(q.email);
  await db.from('portal_erasure_queue').update({ executed_at: at, receipt, email: h, full_name: null, token_hash: 'used' }).eq('id', q.id);
  await db.from('portal_dsr_requests').update({ email: h, full_name: null, details: {} }).ilike('email', email).then(() => null, () => null);
  await db.from('portal_consents').update({ email: h }).ilike('email', email).then(() => null, () => null);
  await db.from('portal_message_log').update({ to_email: h, to_name: null, to_phone: null }).ilike('to_email', email).then(() => null, () => null);
  if (q.dsr_id) await db.from('portal_dsr_requests').update({ status: 'done', closed_at: at, result: { receipt_hash: receipt.hash, auth_deleted: authDeleted } }).eq('id', q.dsr_id).then(() => null, () => null);
  return { ok: true, receipt, counts, authDeleted };
}

/** ما حان موعده في الحجر */
export async function dueErasures(db: any, now = new Date()): Promise<QueueRow[]> {
  const { data } = await db.from('portal_erasure_queue').select('*').is('executed_at', null).is('cancelled_at', null).lte('execute_after', now.toISOString()).order('execute_after', { ascending: true }).limit(20);
  return (data || []) as QueueRow[];
}
export async function queueList(db: any, limit = 100): Promise<QueueRow[]> { const { data } = await db.from('portal_erasure_queue').select('*').order('created_at', { ascending: false }).limit(limit); return (data || []) as QueueRow[]; }
