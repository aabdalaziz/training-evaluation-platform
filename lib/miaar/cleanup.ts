// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P77 «المكنسة» — تنظيف مِعيار بتحكّم بسيط: حذف الدعوات القديمة/التجريبية بكل ما تعلّق بها، ومسح الجلسات المعلّقة والنتائج اليتيمة.
 *  المبدأ: «اعرض البصمة ثم احذف» — لا حذف أعمى: كل دعوة تُعرض معها (مستلمون · جلسات · نتائج) ويُطلب كتابة العدد عند حذف أكثر من واحدة.
 *  حذف النتائج يمرّ عبر deleteReports (السجلّ 07) حتى تُزال الوسائط والشهود والقرارات والتسكين معًا — مسار واحد للحذف النهائي.
 *  الحذف لمدير النظام فقط (DELETE_ROLES)؛ ويُسجَّل في audit_logs.
 */
import { deleteReports, DELETE_ROLES, bulkConfirmOk, type Actor } from './ledger';
import type { InviteRow } from './invites';

export const TEST_RE = /تجريب|تجربة|اختبار داخلي|داخلي|demo|test|trial|sandbox|essai|dummy/i;
/** هل تبدو الدعوة تجريبية؟ (الاسم أو الغرض أو الملاحظة) */
export const isTestInvite = (i: Pick<InviteRow, 'label_ar' | 'purpose' | 'note'>) => TEST_RE.test(`${i.label_ar || ''} ${i.purpose || ''} ${i.note || ''}`);

export type Footprint = { id: string; code: string; label_ar: string; kind: string; status: string; expires_at: string | null; created_at: string; test: boolean; recipients: number; sessions: number; active_sessions: number; reports: number; orders: number };
export type Suggestions = { test: string[]; stale: string[]; orphan_sessions: number; orphan_reports: number };

const idList = (ids: unknown): string[] => (Array.isArray(ids) ? ids : typeof ids === 'string' ? [ids] : []).map((x) => String(x || '').trim()).filter((x) => /^[0-9a-zA-Z-]{2,40}$/.test(x)).slice(0, 200);
const count = (rows: any[] | null | undefined, k: string, id: string) => ((rows || []) as any[]).filter((r) => r[k] === id);

/** بصمة الدعوات: ما الذي سيُحذف معها؟ */
export async function inviteFootprint(db: any, ids: unknown): Promise<Footprint[]> {
  const list = idList(ids); if (!list.length) return [];
  const { data: inv } = await db.from('placement_invites').select('id, code, label_ar, kind, status, purpose, note, expires_at, created_at').in('id', list);
  const rows = (inv || []) as any[]; if (!rows.length) return [];
  const [{ data: rec }, { data: ses }, { data: rep }, { data: ord }] = await Promise.all([
    db.from('placement_invite_recipients').select('invite_id').in('invite_id', list),
    db.from('placement_secure_sessions').select('invite_id, status').in('invite_id', list),
    db.from('placement_reports').select('invite_id').in('invite_id', list),
    db.from('miaar_service_orders').select('invite_id').in('invite_id', list),
  ]);
  return rows.map((r) => ({ id: r.id, code: r.code, label_ar: r.label_ar, kind: r.kind, status: r.status, expires_at: r.expires_at || null, created_at: r.created_at, test: isTestInvite(r),
    recipients: count(rec, 'invite_id', r.id).length, sessions: count(ses, 'invite_id', r.id).length, active_sessions: count(ses, 'invite_id', r.id).filter((s) => s.status === 'active').length, reports: count(rep, 'invite_id', r.id).length, orders: count(ord, 'invite_id', r.id).length }));
}

/** اقتراحات: الدعوات التجريبية · الدعوات المغلقة/المنتهية (أقدم من staleDays) بلا نتائج · الجلسات المعلّقة اليتيمة · النتائج بلا دعوة (قديمة) */
export async function cleanupSuggestions(db: any, opts: { now?: Date; staleDays?: number; orphanDays?: number } = {}): Promise<Suggestions> {
  const now = opts.now || new Date(); const staleBefore = new Date(now.getTime() - (opts.staleDays ?? 14) * 86400000).toISOString(); const orphanBefore = new Date(now.getTime() - (opts.orphanDays ?? 30) * 86400000).toISOString();
  const { data: inv } = await db.from('placement_invites').select('id, label_ar, purpose, note, status, expires_at, created_at').limit(500); const rows = (inv || []) as any[];
  const ids = rows.map((r) => r.id);
  const { data: rep } = ids.length ? await db.from('placement_reports').select('invite_id').in('invite_id', ids) : { data: [] };
  const withReports = new Set(((rep || []) as any[]).map((r) => r.invite_id));
  const test = rows.filter((r) => isTestInvite(r)).map((r) => r.id);
  const stale = rows.filter((r) => !withReports.has(r.id) && !isTestInvite(r) && (r.status === 'closed' || (r.expires_at && r.expires_at < staleBefore)) && r.created_at < staleBefore).map((r) => r.id);
  const { count: os } = await db.from('placement_secure_sessions').select('id', { count: 'exact', head: true }).neq('status', 'completed').lt('created_at', orphanBefore);
  const { count: orp } = await db.from('placement_reports').select('id', { count: 'exact', head: true }).is('invite_id', null).lt('created_at', orphanBefore);
  return { test, stale, orphan_sessions: Number(os) || 0, orphan_reports: Number(orp) || 0 };
}

/** حذف جلسات بعينها (بلا نتيجة) مع إجاباتها ووسائطها وشهودها */
async function purgeSessions(db: any, sessionIds: string[]): Promise<number> {
  let n = 0;
  for (const sid of sessionIds) {
    try {
      try { const { data: perf } = await db.from('miaar_performances').select('media_path').eq('session_id', sid); const paths = ((perf || []) as any[]).map((p) => p.media_path).filter(Boolean); if (paths.length) { const { MEDIA_BUCKET } = await import('./bank'); try { await db.storage.from(MEDIA_BUCKET).remove(paths); } catch { /* المخزن قد يكون فارغًا */ } } await db.from('miaar_performances').delete().eq('session_id', sid); } catch { /* ignore */ }
      try { const { deleteWitness } = await import('./witness'); await deleteWitness(db, sid); } catch { /* لا شهود */ }
      await db.from('placement_secure_answers').delete().eq('session_id', sid);
      const r = await db.from('placement_secure_sessions').delete().eq('id', sid); if (r.error) throw new Error(r.error.message);
      n += 1;
    } catch { /* نكمل */ }
  }
  return n;
}

async function audit(db: any, actor: Actor, action: string, entity_id: string, label: string, metadata: Record<string, unknown> = {}) {
  try { await db.from('audit_logs').insert({ actor_id: actor.id, actor_email: actor.email, actor_role: actor.role, action, entity_type: 'miaar_invite', entity_id, entity_label: label, source: 'miaar-cleanup', metadata }); } catch { /* الأثر لا يوقف الإجراء */ }
}

export type PurgeResult = { ok: true; deleted: number; reports: number; sessions: number; skipped: Array<{ code: string; reason: string }>; note_ar: string } | { ok: false; error: string };

/** حذف دعوات نهائيًّا بكل ما تعلّق بها. with_results=false ⇒ تُتخطّى الدعوات التي لها نتائج (حماية). */
export async function purgeInvites(db: any, ids: unknown, actor: Actor, opts: { with_results?: boolean; confirm?: unknown } = {}): Promise<PurgeResult> {
  if (!DELETE_ROLES.includes(actor.role)) return { ok: false, error: 'الحذف لمدير النظام فقط — يمكنك إغلاق الدعوة' };
  const fps = await inviteFootprint(db, ids); if (!fps.length) return { ok: false, error: 'لا دعوات محدّدة' };
  if (fps.length > 1 && !bulkConfirmOk(fps.length, opts.confirm)) return { ok: false, error: `للتأكيد اكتب العدد ${fps.length}` };
  const skipped: Array<{ code: string; reason: string }> = []; let deleted = 0, reports = 0, sessions = 0;
  for (const f of fps) {
    if (f.reports && !opts.with_results) { skipped.push({ code: f.code, reason: `لها ${f.reports} نتيجة — فعّل «مع النتائج»` }); continue; }
    try {
      if (f.reports) { const { data: rep } = await db.from('placement_reports').select('id').eq('invite_id', f.id); const rids = ((rep || []) as any[]).map((r) => r.id); const r = await deleteReports(db, rids, actor, String(rids.length)); if (r.ok) reports += r.n; }
      const { data: ses } = await db.from('placement_secure_sessions').select('id').eq('invite_id', f.id); sessions += await purgeSessions(db, ((ses || []) as any[]).map((s) => s.id));
      await db.from('test_retake_approvals').update({ invite_id: null }).eq('invite_id', f.id).then(() => null, () => null);
      await db.from('portal_sessions').update({ source_invite_id: null }).eq('source_invite_id', f.id).then(() => null, () => null);
      await db.from('miaar_witness_events').delete().eq('invite_id', f.id).then(() => null, () => null);
      const d = await db.from('placement_invites').delete().eq('id', f.id); if (d.error) throw new Error(d.error.message);
      deleted += 1;
      await audit(db, actor, 'miaar_invite_delete', f.id, `حذف دعوة ${f.code} — ${f.label_ar}`, { code: f.code, kind: f.kind, recipients: f.recipients, sessions: f.sessions, reports: f.reports, with_results: !!opts.with_results, bulk: fps.length });
    } catch (e: any) { skipped.push({ code: f.code, reason: String(e?.message || e) }); }
  }
  const parts = [`حُذفت ${deleted} دعوة`]; if (reports) parts.push(`${reports} نتيجة`); if (sessions) parts.push(`${sessions} جلسة`); if (skipped.length) parts.push(`تُخطّيت ${skipped.length}`);
  return { ok: true, deleted, reports, sessions, skipped, note_ar: parts.join(' · ') };
}

/** مسح الجلسات المعلّقة (غير المكتملة) الأقدم من N يومًا — لا تمسّ أي نتيجة */
export async function purgeOrphanSessions(db: any, actor: Actor, days = 30, now = new Date()): Promise<{ ok: true; n: number; note_ar: string } | { ok: false; error: string }> {
  if (!DELETE_ROLES.includes(actor.role)) return { ok: false, error: 'الحذف لمدير النظام فقط' };
  const d = Math.max(1, Math.min(365, Number(days) || 30)); const before = new Date(now.getTime() - d * 86400000).toISOString();
  const { data } = await db.from('placement_secure_sessions').select('id').neq('status', 'completed').lt('created_at', before).limit(500);
  const n = await purgeSessions(db, ((data || []) as any[]).map((s) => s.id));
  if (n) await audit(db, actor, 'miaar_sessions_purge', 'sessions', `مسح ${n} جلسة معلّقة أقدم من ${d} يومًا`, { days: d, n });
  return { ok: true, n, note_ar: n ? `مُسحت ${n} جلسة معلّقة أقدم من ${d} يومًا` : 'لا جلسات معلّقة قديمة' };
}

/** حذف النتائج اليتيمة (بلا دعوة) الأقدم من N يومًا — عبر deleteReports */
export async function purgeOrphanReports(db: any, actor: Actor, days = 30, confirm: unknown, now = new Date()): Promise<{ ok: true; n: number; note_ar: string } | { ok: false; error: string }> {
  if (!DELETE_ROLES.includes(actor.role)) return { ok: false, error: 'الحذف لمدير النظام فقط' };
  const d = Math.max(1, Math.min(3650, Number(days) || 30)); const before = new Date(now.getTime() - d * 86400000).toISOString();
  const { data } = await db.from('placement_reports').select('id').is('invite_id', null).lt('created_at', before).limit(300); const ids = ((data || []) as any[]).map((r) => r.id);
  if (!ids.length) return { ok: true, n: 0, note_ar: 'لا نتائج يتيمة قديمة' };
  if (!bulkConfirmOk(ids.length, confirm)) return { ok: false, error: `للتأكيد اكتب العدد ${ids.length}` };
  const r = await deleteReports(db, ids, actor, String(ids.length)); if (!r.ok) return r;
  return { ok: true, n: r.n, note_ar: `حُذفت ${r.n} نتيجة بلا دعوة أقدم من ${d} يومًا` };
}
