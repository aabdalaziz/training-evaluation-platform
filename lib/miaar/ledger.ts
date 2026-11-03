// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «سجلّ مِعيار» (م5-أ) — إدارة النتائج وقرار التسكين وإذن الإعادة.
 *  · القائمة المصفّاة (مدّة · دعوة · وسم · مستوى · حالة · قرار · بريد) + CSV
 *  · أرشفة/إلغاء أرشفة: البطاقة العلنية تبقى تعمل بشارة «نتيجة مؤرشفة»
 *  · حذف فوري بلا سلّة (قرار المالك 2026-11-03): التقرير والجلسة والإجابات والأداءات (مع الصوت في المخزن) وصفّ التسكين الموحّد — مع قيدٍ في درع أَثَر لكل حذف
 *  · إذن الإعادة لفرد أو مجموعة: يُربط بالمحاولة السابقة (previous_report_id) ليولد «تقرير المقارنة» في م5-ب، وله صلاحية وسبب
 *  · قرار التسكين: مستوى (Pre-A1…C2) + برنامج اختياري → تسجيل معتمد + شعبة عبر portal_place_enrollment (آلية P7 نفسها) — لفرد أو مجموعة («كلٌّ بحسب نتيجته» أو مستوى موحّد)
 *  · التسكين التلقائي الكسول: بعد مهلة الدعوة (48 ساعة افتراضًا) بلا تدخّل إنسان، تُسكَّن النتيجة على توصيتها — إلا «المنطقة الرمادية» (ميزان الثقة على الحدّ · ضوء موثوقية أحمر · انتهاء وقت/انسحاب) فتبقى «قرار يحتاج إنسانًا»
 *  القاعدة: الذكاء الاصطناعي لا يقرّر هنا شيئًا؛ القرار الآلي قاعدةٌ معلنة لا نموذج.
 */
import { MEDIA_BUCKET } from './bank';
import { reasonLabel } from './registry';

export const LEDGER_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type LedgerLevel = typeof LEDGER_LEVELS[number];
export const LEVEL_AR: Record<LedgerLevel, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
export const DEFAULT_DEADLINE_HOURS = 48;
export const DELETE_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
export const MAX_BULK = 500;
export const isLedgerLevel = (v: unknown): v is LedgerLevel => typeof v === 'string' && (LEDGER_LEVELS as readonly string[]).includes(v);
const nowIso = () => new Date().toISOString();
const lower = (v: unknown) => String(v || '').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ====================================================================== منطق خالص (يُختبر وحده)
export type ReportLevels = { demonstrated: LedgerLevel; entry: LedgerLevel; percent: number | null; confidence: string; name: string; form_code: string | null; finish: string };
/** مستويات التقرير بمفاتيحه العربية — «دون A1» تصبح PRE_A1 */
export function reportLevels(report: any): ReportLevels {
  const r = report || {}; const sum = r.ملخص_التسكين || {};
  const demo = sum.دون_A1 ? 'PRE_A1' : (isLedgerLevel(sum.المستوى_المثبت) ? sum.المستوى_المثبت : isLedgerLevel(r.المستوى_العام) ? r.المستوى_العام : 'A1');
  const entry = sum.دون_A1 ? 'PRE_A1' : (isLedgerLevel(sum.مستوى_الالتحاق_المقترح) ? sum.مستوى_الالتحاق_المقترح : demo);
  const pct = Number(r.النسبة_العامة); const name = String(r.بيانات_المتقدم?.الاسم || '—');
  return { demonstrated: demo as LedgerLevel, entry: entry as LedgerLevel, percent: Number.isFinite(pct) ? Math.round(pct) : null, confidence: String(r.ميزان_الثقة?.الرمز || 'medium'), name, form_code: r.النموذج?.الرمز ? String(r.النموذج.الرمز) : null, finish: String(r.سبب_الانتهاء || '') };
}
/** «المنطقة الرمادية»: متى لا يُسكِّن النظام تلقائيًا بل يترك القرار لإنسان — يعيد السبب بالعربية أو null */
export function grayZone(report: any): string | null {
  const r = report || {};
  if (r.ميزان_الثقة?.الرمز === 'border') return 'ميزان الثقة على الحدّ — النتيجة على مسافة أقل من 10 نقاط من عتبة الانتقال';
  if (r.الموثوقية?.الضوء === 'red') return 'ضوء موثوقية النموذج أحمر — القياس غير مستقرّ بعد';
  const fin = String(r.سبب_الانتهاء || ''); if (fin && (fin === reasonLabel('time') || fin === reasonLabel('quit'))) return 'الاختبار لم يكتمل (' + fin + ')';
  return null;
}
export const deadlineFor = (createdAt: string, hours: number | null | undefined): string | null => { if (hours === null || hours === undefined) return null; const h = Number(hours); const hh = Number.isFinite(h) ? Math.max(1, Math.min(720, h)) : DEFAULT_DEADLINE_HOURS; return new Date(new Date(createdAt).getTime() + hh * 3600_000).toISOString(); };
export const isDue = (deadline: string | null, now = nowIso()) => !!deadline && deadline <= now;
/** رقم المحاولة لكل تقرير داخل مجموعة تقارير (الأقدم = 1) */
export function attemptNumbers(rows: { id: string; email: string; taken_at: string }[]): Map<string, number> {
  const by = new Map<string, { id: string; taken_at: string }[]>(); for (const r of rows) { const k = lower(r.email); if (!by.has(k)) by.set(k, []); by.get(k)!.push(r); }
  const out = new Map<string, number>(); for (const list of by.values()) list.sort((a, b) => a.taken_at.localeCompare(b.taken_at)).forEach((r, i) => out.set(r.id, i + 1)); return out;
}
/** عبارة التأكيد للحذف الجماعي: يكتب الطاقم العدد نفسه */
export const bulkConfirmOk = (n: number, typed: unknown) => n > 0 && String(typed ?? '').trim() === String(n);
export type LedgerRow = {
  id: string; email: string; name: string; taken_at: string; code: string | null; demonstrated: LedgerLevel; entry: LedgerLevel; percent: number | null; confidence: string; form_code: string | null;
  invite_id: string | null; invite_label: string | null; group_tag: string | null; archived_at: string | null; previous_report_id: string | null; attempt: number; gray: string | null;
  decision: { level: LedgerLevel | null; status: string; source: string; program_id: string | null; program_name: string | null; classroom: string | null; decided_at: string | null; deadline_at: string | null; gray_reason: string | null; note: string | null } | null;
  deadline_at: string | null; retake_open: boolean;
};
const csvCell = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export function ledgerCsv(rows: LedgerRow[]): string {
  const head = ['التاريخ', 'الاسم', 'البريد', 'المحاولة', 'المستوى المثبت', 'مستوى الالتحاق', 'النسبة', 'الثقة', 'النموذج', 'الدعوة', 'الوسم', 'الرمز', 'الحالة', 'قرار التسكين', 'مصدر القرار', 'البرنامج', 'الشعبة', 'تاريخ القرار'];
  const lines = rows.map((r) => [r.taken_at, r.name, r.email, r.attempt, LEVEL_AR[r.demonstrated], LEVEL_AR[r.entry], r.percent ?? '', r.confidence, r.form_code || '', r.invite_label || '', r.group_tag || '', r.code || '', r.archived_at ? 'مؤرشفة' : 'نشطة',
    r.decision?.level ? LEVEL_AR[r.decision.level] : (r.decision?.status === 'review' ? 'يحتاج إنسانًا' : ''), r.decision ? (r.decision.source === 'auto' ? 'تلقائي' : 'إنسان') : '', r.decision?.program_name || '', r.decision?.classroom || '', r.decision?.decided_at || ''].map(csvCell).join(','));
  return '\uFEFF' + [head.join(','), ...lines].join('\r\n');
}

// ====================================================================== القائمة
export type LedgerFilter = { from?: string | null; to?: string | null; invite_id?: string | null; tag?: string | null; level?: string | null; status?: 'active' | 'archived' | 'all'; decision?: 'all' | 'none' | 'review' | 'approved' | 'auto'; q?: string | null; form?: string | null; limit?: number };
const uuidish = (v: unknown) => (typeof v === 'string' && /^[0-9a-zA-Z-]{2,40}$/.test(v) ? v : null);
const dayIso = (v: unknown, end = false) => { const s = String(v || '').trim(); if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null; const d = new Date(s.slice(0, 10) + (end ? 'T23:59:59.999Z' : 'T00:00:00.000Z')); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };
export function parseFilter(q: URLSearchParams | Record<string, unknown>): LedgerFilter {
  const g = (k: string) => (q instanceof URLSearchParams ? q.get(k) : (q as any)[k]) as unknown;
  const status = g('status'); const decision = g('decision'); const limit = Number(g('limit'));
  return { from: dayIso(g('from')), to: dayIso(g('to'), true), invite_id: uuidish(g('invite')), tag: String(g('tag') || '').trim().slice(0, 60) || null, level: isLedgerLevel(g('level')) ? String(g('level')) : null,
    status: status === 'archived' || status === 'all' ? status : 'active', decision: ['none', 'review', 'approved', 'auto'].includes(String(decision)) ? (decision as any) : 'all',
    q: String(g('q') || '').trim().toLowerCase().replace(/[%,()\\]/g, '').slice(0, 80) || null, form: String(g('form') || '').trim().slice(0, 40) || null, limit: Number.isInteger(limit) && limit > 0 && limit <= 2000 ? limit : 500 };
}
async function programsMap(db: any, ids: string[]): Promise<Map<string, string>> { if (!ids.length) return new Map(); const { data } = await db.from('programs').select('id,name_ar').in('id', ids); return new Map(((data || []) as any[]).map((p) => [String(p.id), String(p.name_ar || '')])); }
async function classroomsMap(db: any, ids: string[]): Promise<Map<string, string>> { if (!ids.length) return new Map(); const { data } = await db.from('classrooms').select('id,code,section_name').in('id', ids); return new Map(((data || []) as any[]).map((c) => [String(c.id), String(c.section_name || c.code || '')])); }
export async function ledgerList(db: any, f: LedgerFilter): Promise<{ rows: LedgerRow[]; counts: { active: number; archived: number; review: number; undecided: number; due: number } }> {
  let q = db.from('placement_reports').select('id,candidate_email,created_at,access_code,invite_id,report,archived_at,previous_report_id,group_tag').order('created_at', { ascending: false }).limit(f.limit || 500);
  if (f.from) q = q.gte('created_at', f.from); if (f.to) q = q.lte('created_at', f.to); if (f.invite_id) q = q.eq('invite_id', f.invite_id); if (f.tag) q = q.eq('group_tag', f.tag); if (f.q) q = q.ilike('candidate_email', `%${f.q}%`);
  if (f.status === 'active') q = q.is('archived_at', null); else if (f.status === 'archived') q = q.not('archived_at', 'is', null);
  const { data, error } = await q; if (error) throw new Error(error.message);
  let reps = (data || []) as any[];
  if (f.level) reps = reps.filter((r) => reportLevels(r.report).entry === f.level); if (f.form) reps = reps.filter((r) => reportLevels(r.report).form_code === f.form);
  const ids = reps.map((r) => String(r.id)); const emails = [...new Set(reps.map((r) => lower(r.candidate_email)).filter(Boolean))];
  const [dec, inv, grants, all, counts] = await Promise.all([
    ids.length ? db.from('placement_decisions').select('report_id,assigned_level,decision_status,source,program_id,classroom_id,decided_at,deadline_at,gray_reason,note').in('report_id', ids) : { data: [] },
    db.from('placement_invites').select('id,label_ar,decision_deadline_hours').limit(1000),
    emails.length ? db.from('test_retake_approvals').select('email').in('email', emails).is('used_at', null).is('revoked_at', null) : { data: [] },
    emails.length ? db.from('placement_reports').select('id,candidate_email,created_at').in('candidate_email', emails).limit(5000) : { data: [] },
    Promise.all([db.from('placement_reports').select('id', { count: 'exact', head: true }).is('archived_at', null), db.from('placement_reports').select('id', { count: 'exact', head: true }).not('archived_at', 'is', null), db.from('placement_decisions').select('id', { count: 'exact', head: true }).eq('decision_status', 'review')]),
  ]);
  const decBy = new Map(((dec.data || []) as any[]).map((d) => [String(d.report_id), d])); const invBy = new Map(((inv.data || []) as any[]).map((i) => [String(i.id), i]));
  const openGrants = new Set(((grants.data || []) as any[]).map((g) => lower(g.email)));
  const attempts = attemptNumbers(((all.data || []) as any[]).map((r) => ({ id: String(r.id), email: lower(r.candidate_email), taken_at: String(r.created_at) })));
  const pm = await programsMap(db, [...new Set(((dec.data || []) as any[]).map((d) => d.program_id).filter(Boolean) as string[])]); const cm = await classroomsMap(db, [...new Set(((dec.data || []) as any[]).map((d) => d.classroom_id).filter(Boolean) as string[])]);
  let undecided = 0, due = 0; const now = nowIso();
  let rows: LedgerRow[] = reps.map((r) => {
    const L = reportLevels(r.report); const d = decBy.get(String(r.id)) || null; const invite = r.invite_id ? invBy.get(String(r.invite_id)) : null;
    const hours = invite ? (invite.decision_deadline_hours === null ? null : Number(invite.decision_deadline_hours || DEFAULT_DEADLINE_HOURS)) : DEFAULT_DEADLINE_HOURS; const deadline = d ? null : deadlineFor(String(r.created_at), hours);
    if (!d && !r.archived_at) { undecided += 1; if (isDue(deadline, now)) due += 1; }
    return { id: String(r.id), email: lower(r.candidate_email), name: L.name, taken_at: String(r.created_at), code: r.access_code || null, demonstrated: L.demonstrated, entry: L.entry, percent: L.percent, confidence: L.confidence, form_code: L.form_code,
      invite_id: r.invite_id || null, invite_label: invite ? String(invite.label_ar || '') : null, group_tag: r.group_tag || null, archived_at: r.archived_at || null, previous_report_id: r.previous_report_id || null, attempt: attempts.get(String(r.id)) || 1, gray: grayZone(r.report),
      decision: d ? { level: isLedgerLevel(d.assigned_level) ? d.assigned_level : null, status: String(d.decision_status), source: String(d.source || 'staff'), program_id: d.program_id || null, program_name: d.program_id ? pm.get(String(d.program_id)) || null : null, classroom: d.classroom_id ? cm.get(String(d.classroom_id)) || null : null, decided_at: d.decided_at || null, deadline_at: d.deadline_at || null, gray_reason: d.gray_reason || null, note: d.note || null } : null,
      deadline_at: deadline, retake_open: openGrants.has(lower(r.candidate_email)) };
  });
  if (f.decision === 'none') rows = rows.filter((r) => !r.decision); else if (f.decision === 'review') rows = rows.filter((r) => r.decision?.status === 'review'); else if (f.decision === 'approved') rows = rows.filter((r) => r.decision?.status === 'approved'); else if (f.decision === 'auto') rows = rows.filter((r) => r.decision?.source === 'auto');
  const [ac, arc, rv] = counts as any[];
  return { rows, counts: { active: ac?.count || 0, archived: arc?.count || 0, review: rv?.count || 0, undecided, due } };
}

// ====================================================================== درع أَثَر
export type Actor = { id: string; email: string; role: string };
async function audit(db: any, actor: Actor | null, action: string, entity_id: string, label: string, metadata: Record<string, unknown> = {}) {
  try { await db.from('audit_logs').insert({ actor_id: actor?.id || null, actor_email: actor?.email || null, actor_role: actor?.role || (actor ? 'STAFF' : 'system'), action, entity_type: 'miaar_report', entity_id, entity_label: label, source: actor ? 'miaar-ledger' : 'miaar-auto', metadata }); } catch { /* الأثر لا يوقف الإجراء */ }
}
const idList = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map((x) => (typeof x === 'string' ? x.trim() : '')).filter((x) => /^[0-9a-zA-Z-]{2,40}$/.test(x)).slice(0, MAX_BULK);

// ====================================================================== الأرشفة
export async function archiveReports(db: any, ids: unknown, actor: Actor, note: unknown, undo = false): Promise<{ ok: true; n: number } | { ok: false; error: string }> {
  const list = idList(ids); if (!list.length) return { ok: false, error: 'لا نتائج محدّدة' };
  const patch = undo ? { archived_at: null, archived_by: null, archive_note: null } : { archived_at: nowIso(), archived_by: actor.id, archive_note: String(note || '').trim().slice(0, 300) || null };
  const r = await db.from('placement_reports').update(patch).in('id', list); if (r.error) return { ok: false, error: r.error.message };
  for (const id of list) await audit(db, actor, undo ? 'miaar_unarchive' : 'miaar_archive', id, 'نتيجة مِعيار', { note: patch.archive_note || null, bulk: list.length });
  return { ok: true, n: list.length };
}
/** أرشفة مدّة أو دعوة كاملة: تُستخرج المعرّفات بالمرشّح نفسه ثم تمرّ على archiveReports */
export async function idsByFilter(db: any, f: LedgerFilter): Promise<string[]> { const { rows } = await ledgerList(db, { ...f, limit: 2000 }); return rows.map((r) => r.id); }

// ====================================================================== الحذف الفوري
export async function deleteReports(db: any, ids: unknown, actor: Actor, confirm: unknown): Promise<{ ok: true; n: number; failed: string[] } | { ok: false; error: string }> {
  if (!DELETE_ROLES.includes(actor.role)) return { ok: false, error: 'الحذف لمدير النظام فقط — يمكنك الأرشفة' };
  const list = idList(ids); if (!list.length) return { ok: false, error: 'لا نتائج محدّدة' };
  if (list.length > 1 && !bulkConfirmOk(list.length, confirm)) return { ok: false, error: `للتأكيد اكتب العدد ${list.length}` };
  const { data } = await db.from('placement_reports').select('id,submission_id,candidate_email,access_code,created_at').in('id', list); const reps = (data || []) as any[]; const failed: string[] = [];
  for (const rep of reps) {
    try {
      const sid = rep.submission_id ? String(rep.submission_id) : null;
      if (sid) {
        const { data: perf } = await db.from('miaar_performances').select('media_path').eq('session_id', sid); const paths = ((perf || []) as any[]).map((p) => p.media_path).filter(Boolean);
        if (paths.length) { try { await db.storage.from(MEDIA_BUCKET).remove(paths); } catch { /* المخزن قد يكون فارغًا */ } }
        await db.from('miaar_performances').delete().eq('session_id', sid);
        await db.from('placement_secure_answers').delete().eq('session_id', sid);
      }
      await db.from('placement_decisions').delete().eq('report_id', rep.id);
      await db.from('placement_invite_recipients').update({ report_id: null }).eq('report_id', rep.id);
      await db.from('placement_reports').update({ previous_report_id: null }).eq('previous_report_id', rep.id);
      await db.from('test_retake_approvals').update({ previous_report_id: null }).eq('previous_report_id', rep.id);
      await db.from('portal_enrollments').update({ placement_id: null }).eq('placement_id', rep.id);
      await db.from('portal_placements').delete().eq('external_id', String(rep.id));
      const r = await db.from('placement_reports').delete().eq('id', rep.id); if (r.error) throw new Error(r.error.message);
      if (sid) await db.from('placement_secure_sessions').delete().eq('id', sid);
      await audit(db, actor, 'miaar_delete', String(rep.id), 'حذف نتيجة مِعيار', { email_hash: hashEmail(rep.candidate_email), code: rep.access_code || null, taken_at: rep.created_at, bulk: list.length });
    } catch { failed.push(String(rep.id)); }
  }
  return { ok: true, n: reps.length - failed.length, failed };
}
function hashEmail(e: unknown): string { let h = 0; const s = lower(e); for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return 'h' + (h >>> 0).toString(16); }

// ====================================================================== إذن الإعادة
export type GrantInput = { emails?: unknown; report_ids?: unknown; reason?: unknown; days?: unknown; invite_id?: unknown; program_id?: unknown; kind?: unknown };
export async function grantRetake(db: any, input: GrantInput, actor: Actor | null): Promise<{ ok: true; n: number; emails: string[] } | { ok: false; error: string }> {
  let emails = (Array.isArray(input.emails) ? input.emails : typeof input.emails === 'string' ? input.emails.split(/[\s,;]+/) : []).map(lower).filter((e) => EMAIL_RE.test(e));
  const rids = idList(input.report_ids); const prevBy = new Map<string, string>();
  if (rids.length) { const { data } = await db.from('placement_reports').select('id,candidate_email').in('id', rids); for (const r of (data || []) as any[]) { const e = lower(r.candidate_email); if (EMAIL_RE.test(e)) { emails.push(e); prevBy.set(e, String(r.id)); } } }
  emails = [...new Set(emails)].slice(0, MAX_BULK); if (!emails.length) return { ok: false, error: 'لا بريد صالحًا' };
  const days = Number(input.days); const expires_at = Number.isFinite(days) && days > 0 ? new Date(Date.now() + Math.min(365, days) * 86400_000).toISOString() : null;
  const kind = input.kind === 'program_end' ? 'program_end' : emails.length > 1 ? 'group' : 'staff'; const reason = String(input.reason || '').trim().slice(0, 300) || null;
  /* المحاولة السابقة = أحدث تقرير للبريد (ليُبنى عليه تقرير المقارنة) */
  const missing = emails.filter((e) => !prevBy.has(e));
  if (missing.length) { const { data } = await db.from('placement_reports').select('id,candidate_email,created_at').in('candidate_email', missing).order('created_at', { ascending: false }).limit(5000); for (const r of (data || []) as any[]) { const e = lower(r.candidate_email); if (!prevBy.has(e)) prevBy.set(e, String(r.id)); } }
  /* لا تُكرَّر الأذون المفتوحة */
  const { data: open } = await db.from('test_retake_approvals').select('email,expires_at').in('email', emails).is('used_at', null).is('revoked_at', null); const now = nowIso(); const already = new Set(((open || []) as any[]).filter((g) => !g.expires_at || String(g.expires_at) > now).map((g) => lower(g.email)));
  const rows = emails.filter((e) => !already.has(e)).map((email) => ({ email, approved_by: actor?.id || null, note: reason, reason, kind, expires_at, invite_id: uuidish(input.invite_id), program_id: uuidish(input.program_id), previous_report_id: prevBy.get(email) || null }));
  if (rows.length) { const r = await db.from('test_retake_approvals').insert(rows); if (r.error) return { ok: false, error: r.error.message }; }
  for (const row of rows) await audit(db, actor, 'miaar_retake_grant', row.previous_report_id || row.email, 'إذن إعادة اختبار', { kind, expires_at, reason, invite_id: row.invite_id });
  return { ok: true, n: rows.length, emails: rows.map((r) => r.email) };
}
export async function revokeRetake(db: any, email: unknown, actor: Actor): Promise<boolean> {
  const e = lower(email); if (!EMAIL_RE.test(e)) return false;
  const r = await db.from('test_retake_approvals').update({ revoked_at: nowIso() }).ilike('email', e).is('used_at', null).is('revoked_at', null); if (r.error) return false;
  await audit(db, actor, 'miaar_retake_revoke', e, 'سحب إذن إعادة'); return true;
}
/** الإذن المفتوح الصالح لهذا البريد (يستعمله محرّك البدء): يتجاهل المنتهي والمسحوب */
export async function openGrant(db: any, email: string): Promise<{ id: string; previous_report_id: string | null; invite_id: string | null } | null> {
  const { data, error } = await db.from('test_retake_approvals').select('id,previous_report_id,invite_id,expires_at,revoked_at').ilike('email', email).is('used_at', null).order('created_at', { ascending: false }).limit(5);
  if (error) throw new Error(error.message);
  const now = nowIso(); const g = ((data || []) as any[]).find((x) => !x.revoked_at && (!x.expires_at || String(x.expires_at) > now));
  return g ? { id: String(g.id), previous_report_id: g.previous_report_id || null, invite_id: g.invite_id || null } : null;
}

// ====================================================================== قرار التسكين
export type DecideInput = { report_ids?: unknown; level?: unknown; program_id?: unknown; note?: unknown };
type RepLite = { id: string; candidate_email: string; created_at: string; report: any; invite_id: string | null; archived_at: string | null; user_id: string | null };
async function enrollAndPlace(db: any, rep: RepLite, level: LedgerLevel, programId: string, actor: Actor | null): Promise<{ enrollment_id: string | null; classroom_id: string | null }> {
  const email = lower(rep.candidate_email); const name = reportLevels(rep.report).name;
  const { data: ex } = await db.from('portal_enrollments').select('id,status,classroom_id').eq('program_id', programId).ilike('email', email).maybeSingle();
  let enrollmentId: string | null = ex?.id ? String(ex.id) : null;
  if (enrollmentId) { await db.from('portal_enrollments').update({ status: 'approved', placement_level: level, placement_id: null, decided_by: actor?.id || null, decided_at: nowIso(), decision_note: 'تسكين مِعيار', updated_at: nowIso() }).eq('id', enrollmentId); }
  else {
    const { data: ins, error } = await db.from('portal_enrollments').insert({ program_id: programId, email, full_name: name === '—' ? email.split('@')[0] : name, user_id: rep.user_id || null, lang: 'ar', source: 'miaar', status: 'approved', placement_level: level, decided_by: actor?.id || null, decided_at: nowIso(), decision_note: 'تسكين مِعيار' }).select('id').single();
    if (error || !ins) return { enrollment_id: null, classroom_id: null }; enrollmentId = String(ins.id);
  }
  /* صفّ التسكين الموحّد (P7) يُربط بالتسجيل حتى يراه «أنا» و«التسكين» */
  try { const { data: pl } = await db.from('portal_placements').select('id').eq('external_id', String(rep.id)).maybeSingle(); if (pl?.id) await db.from('portal_enrollments').update({ placement_id: pl.id }).eq('id', enrollmentId); } catch { /* اختياري */ }
  let classroomId: string | null = ex?.classroom_id ? String(ex.classroom_id) : null;
  if (!classroomId) { try { const { data: room } = await db.rpc('portal_place_enrollment', { p_enrollment: enrollmentId }); classroomId = room ? String(room) : null; } catch { classroomId = null; } }
  return { enrollment_id: enrollmentId, classroom_id: classroomId };
}
async function upsertDecision(db: any, rep: RepLite, d: { level: LedgerLevel | null; status: 'approved' | 'review'; program_id: string | null; note: string | null; source: 'staff' | 'auto'; gray_reason: string | null; deadline_at: string | null }, actor: Actor | null): Promise<{ classroom_id: string | null; program_id: string | null }> {
  const L = reportLevels(rep.report); let placed = { enrollment_id: null as string | null, classroom_id: null as string | null };
  if (d.status === 'approved' && d.level && d.program_id) placed = await enrollAndPlace(db, rep, d.level, d.program_id, actor);
  const row = { report_id: rep.id, recommended_level: L.entry, assigned_level: d.level || L.entry, decision_status: d.status, program_id: d.program_id, enrollment_id: placed.enrollment_id, classroom_id: placed.classroom_id, source: d.source, note: d.note, decided_by: actor?.id || null, decided_at: nowIso(), gray_reason: d.gray_reason, deadline_at: d.deadline_at, updated_at: nowIso() };
  const r = await db.from('placement_decisions').upsert(row, { onConflict: 'report_id' }); if (r.error) throw new Error(r.error.message);
  await audit(db, actor, d.status === 'review' ? 'miaar_decision_review' : 'miaar_decision', rep.id, 'قرار تسكين', { level: d.level, recommended: L.entry, program_id: d.program_id, classroom_id: placed.classroom_id, source: d.source, gray: d.gray_reason });
  return { classroom_id: placed.classroom_id, program_id: d.program_id };
}
/** قرار الإنسان لفرد أو مجموعة: level = 'each' (كلٌّ بحسب نتيجته) أو مستوى موحّد؛ program_id اختياري (null = قرار مستوى بلا تسجيل) */
export async function decidePlacement(db: any, input: DecideInput, actor: Actor): Promise<{ ok: true; n: number; placed: number; overrides: number } | { ok: false; error: string }> {
  const ids = idList(input.report_ids); if (!ids.length) return { ok: false, error: 'لا نتائج محدّدة' };
  const each = input.level === 'each' || input.level === undefined || input.level === null || input.level === ''; if (!each && !isLedgerLevel(input.level)) return { ok: false, error: 'مستوى غير صالح' };
  const programId = uuidish(input.program_id); const note = String(input.note || '').trim().slice(0, 300) || null;
  if (programId) { const { data: p } = await db.from('programs').select('id,archived_at').eq('id', programId).maybeSingle(); if (!p || p.archived_at) return { ok: false, error: 'البرنامج غير متاح' }; }
  const { data } = await db.from('placement_reports').select('id,candidate_email,created_at,report,invite_id,archived_at,user_id').in('id', ids); const reps = (data || []) as RepLite[];
  let placed = 0, overrides = 0;
  for (const rep of reps) {
    const L = reportLevels(rep.report); const level = (each ? L.entry : input.level) as LedgerLevel; if (level !== L.entry) overrides += 1;
    const r = await upsertDecision(db, rep, { level, status: 'approved', program_id: programId, note: note || (level !== L.entry ? `تسكين يدوي: ${LEVEL_AR[level]} بدل ${LEVEL_AR[L.entry]}` : null), source: 'staff', gray_reason: null, deadline_at: null }, actor);
    if (r.classroom_id) placed += 1;
    void notifyDecision(db, rep, level, programId);
  }
  return { ok: true, n: reps.length, placed, overrides };
}
/** إعادة القرار إلى «بلا قرار» (مثلًا بعد خطأ) — لا يلغي التسجيل؛ ذلك من شاشة التسجيلات */
export async function clearDecision(db: any, reportId: unknown, actor: Actor): Promise<boolean> { const id = uuidish(reportId); if (!id) return false; const r = await db.from('placement_decisions').delete().eq('report_id', id); if (r.error) return false; await audit(db, actor, 'miaar_decision_clear', id, 'إلغاء قرار تسكين'); return true; }
async function notifyDecision(db: any, rep: RepLite, level: LedgerLevel, programId: string | null) {
  try {
    const { notify } = await import('../portal/notify'); const name = reportLevels(rep.report).name; let program = '';
    if (programId) { const { data: p } = await db.from('programs').select('name_ar').eq('id', programId).maybeSingle(); program = p?.name_ar ? ` — وسُجّلت في برنامج «${p.name_ar}»` : ''; }
    await notify(db, { kind: 'miaar_placement', to: { email: lower(rep.candidate_email), name: name === '—' ? null : name }, subject: `مِعيار: قرار تسكينك — ${LEVEL_AR[level]}`, text: `اعتُمد مستوى التحاقك: ${LEVEL_AR[level]}${program}. تفاصيل بطاقتك في حسابك على أَثَر.`, url: '/me', ref: rep.id });
  } catch { /* الإشعار تحسيني */ }
}
/** البرنامج الافتراضي لمستوى: خريطة الدعوة ثم برنامج الدعوة ثم أول برنامج عامّ مفتوح بمستوى CEFR مطابق */
async function defaultProgramFor(db: any, level: LedgerLevel, invite: any | null): Promise<string | null> {
  if (invite) { const map = (invite.level_programs || {}) as Record<string, string>; if (uuidish(map[level])) return map[level]; if (invite.program_id) return String(invite.program_id); }
  try { const { data } = await db.from('programs').select('id,start_date').eq('cefr_level', level).is('archived_at', null).eq('registration_open', true).order('start_date', { ascending: true }).limit(1); return data?.[0]?.id ? String(data[0].id) : null; } catch { return null; }
}
/** التسكين التلقائي الكسول — يُستدعى عند فتح السجلّ أو عرض بطاقة واحدة؛ بلا كرون */
export async function autoPlaceDue(db: any, opts: { reportId?: string | null; limit?: number } = {}): Promise<{ placed: number; review: number }> {
  const out = { placed: 0, review: 0 }; const now = nowIso(); const limit = Math.min(200, Math.max(1, opts.limit || 50));
  let q = db.from('placement_reports').select('id,candidate_email,created_at,report,invite_id,archived_at,user_id').is('archived_at', null).lte('created_at', new Date(Date.now() - 3600_000).toISOString()).order('created_at', { ascending: true }).limit(limit);
  if (opts.reportId) q = db.from('placement_reports').select('id,candidate_email,created_at,report,invite_id,archived_at,user_id').eq('id', opts.reportId).is('archived_at', null).limit(1);
  const { data } = await q; const reps = (data || []) as RepLite[]; if (!reps.length) return out;
  const { data: dec } = await db.from('placement_decisions').select('report_id').in('report_id', reps.map((r) => r.id)); const has = new Set(((dec || []) as any[]).map((d) => String(d.report_id)));
  const pending = reps.filter((r) => !has.has(String(r.id))); if (!pending.length) return out;
  const invIds = [...new Set(pending.map((r) => r.invite_id).filter(Boolean) as string[])]; const { data: inv } = invIds.length ? await db.from('placement_invites').select('id,program_id,level_programs,decision_deadline_hours').in('id', invIds) : { data: [] };
  const invBy = new Map(((inv || []) as any[]).map((i) => [String(i.id), i]));
  for (const rep of pending) {
    const invite = rep.invite_id ? invBy.get(String(rep.invite_id)) || null : null;
    const hours = invite ? (invite.decision_deadline_hours === null ? null : Number(invite.decision_deadline_hours || DEFAULT_DEADLINE_HOURS)) : DEFAULT_DEADLINE_HOURS;
    const deadline = deadlineFor(rep.created_at, hours); if (!isDue(deadline, now)) continue;
    const L = reportLevels(rep.report); const gray = grayZone(rep.report);
    try {
      if (gray) { await upsertDecision(db, rep, { level: null, status: 'review', program_id: null, note: null, source: 'auto', gray_reason: gray, deadline_at: deadline }, null); out.review += 1; continue; }
      const programId = await defaultProgramFor(db, L.entry, invite);
      await upsertDecision(db, rep, { level: L.entry, status: 'approved', program_id: programId, note: 'تسكين تلقائي بعد انقضاء المهلة بلا تدخّل', source: 'auto', gray_reason: null, deadline_at: deadline }, null); out.placed += 1;
      void notifyDecision(db, rep, L.entry, programId);
    } catch { /* نتيجة واحدة لا توقف البقية */ }
  }
  return out;
}

// ====================================================================== سجلّ المتقدّم · البرامج · توزيع الشُّعب
export async function candidateHistory(db: any, email: unknown) {
  const e = lower(email); if (!EMAIL_RE.test(e)) return null;
  const [reps, grants, enr] = await Promise.all([
    db.from('placement_reports').select('id,created_at,access_code,report,archived_at,previous_report_id,invite_id,group_tag').ilike('candidate_email', e).order('created_at', { ascending: true }).limit(50),
    db.from('test_retake_approvals').select('id,created_at,used_at,expires_at,revoked_at,reason,kind,previous_report_id').ilike('email', e).order('created_at', { ascending: false }).limit(20),
    db.from('portal_enrollments').select('id,program_id,status,placement_level,classroom_id,created_at,source').ilike('email', e).order('created_at', { ascending: false }).limit(20),
  ]);
  const ids = ((reps.data || []) as any[]).map((r) => String(r.id)); const { data: dec } = ids.length ? await db.from('placement_decisions').select('report_id,assigned_level,decision_status,source,program_id,classroom_id,decided_at,gray_reason').in('report_id', ids) : { data: [] };
  const decBy = new Map(((dec || []) as any[]).map((d) => [String(d.report_id), d]));
  const pids = [...new Set([...((enr.data || []) as any[]).map((x) => x.program_id), ...((dec || []) as any[]).map((d) => d.program_id)].filter(Boolean) as string[])]; const pm = await programsMap(db, pids);
  const cids = [...new Set([...((enr.data || []) as any[]).map((x) => x.classroom_id), ...((dec || []) as any[]).map((d) => d.classroom_id)].filter(Boolean) as string[])]; const cm = await classroomsMap(db, cids);
  const attempts = ((reps.data || []) as any[]).map((r, i) => { const L = reportLevels(r.report); const d = decBy.get(String(r.id)); return { id: String(r.id), attempt: i + 1, taken_at: String(r.created_at), code: r.access_code || null, demonstrated: L.demonstrated, entry: L.entry, percent: L.percent, confidence: L.confidence, form_code: L.form_code, archived_at: r.archived_at || null, previous_report_id: r.previous_report_id || null, group_tag: r.group_tag || null,
    decision: d ? { level: d.assigned_level || null, status: String(d.decision_status), source: String(d.source || 'staff'), program: d.program_id ? pm.get(String(d.program_id)) || null : null, classroom: d.classroom_id ? cm.get(String(d.classroom_id)) || null : null, decided_at: d.decided_at || null, gray_reason: d.gray_reason || null } : null }; });
  return { email: e, name: attempts.length ? reportLevels(((reps.data || []) as any[])[attempts.length - 1].report).name : '—', attempts,
    grants: ((grants.data || []) as any[]).map((g) => ({ id: String(g.id), created_at: g.created_at, used_at: g.used_at, expires_at: g.expires_at, revoked_at: g.revoked_at, reason: g.reason, kind: g.kind, open: !g.used_at && !g.revoked_at && (!g.expires_at || String(g.expires_at) > nowIso()) })),
    enrollments: ((enr.data || []) as any[]).map((x) => ({ id: String(x.id), program: pm.get(String(x.program_id)) || '—', status: x.status, level: x.placement_level || null, classroom: x.classroom_id ? cm.get(String(x.classroom_id)) || null : null, created_at: x.created_at, source: x.source })) };
}
/** البرامج لقائمة الاختيار: غير مؤرشفة · مع المقاعد المتبقية (المقاعد − المقبولون) ومستوى CEFR إن ضُبط */
export async function programsForPicker(db: any) {
  const { data } = await db.from('programs').select('id,name_ar,cefr_level,seats,start_date,status,registration_open').is('archived_at', null).order('start_date', { ascending: false }).limit(300);
  const progs = ((data || []) as any[]).filter((p) => String(p.status || '').toUpperCase() !== 'COMPLETED');
  const ids = progs.map((p) => String(p.id)); const { data: en } = ids.length ? await db.from('portal_enrollments').select('program_id').in('program_id', ids).eq('status', 'approved').limit(20000) : { data: [] };
  const cnt = new Map<string, number>(); for (const e of (en || []) as any[]) cnt.set(String(e.program_id), (cnt.get(String(e.program_id)) || 0) + 1);
  return progs.map((p) => ({ id: String(p.id), name_ar: String(p.name_ar || ''), cefr_level: p.cefr_level || null, seats: p.seats ?? null, approved: cnt.get(String(p.id)) || 0, remaining: p.seats === null || p.seats === undefined ? null : Math.max(0, Number(p.seats) - (cnt.get(String(p.id)) || 0)), start_date: p.start_date || null, open: p.registration_open !== false }));
}
/** «توزيع الشُّعب»: كل شعبة مفتوحة مع مستواها وسعتها ومن فيها — ليرى المشرف أين تذهب القرارات قبل أن يضغط */
export async function sectionsPanel(db: any) {
  const progs = await programsForPicker(db); const ids = progs.map((p) => p.id); if (!ids.length) return [];
  const [{ data: rooms }, { data: en }] = await Promise.all([db.from('classrooms').select('id,program_id,code,section_name,cefr_level,capacity,placement_open').in('program_id', ids).limit(2000), db.from('portal_enrollments').select('classroom_id').in('program_id', ids).eq('status', 'approved').not('classroom_id', 'is', null).limit(20000)]);
  const cnt = new Map<string, number>(); for (const e of (en || []) as any[]) cnt.set(String(e.classroom_id), (cnt.get(String(e.classroom_id)) || 0) + 1); const pm = new Map(progs.map((p) => [p.id, p.name_ar]));
  return ((rooms || []) as any[]).filter((c) => c.placement_open !== false).map((c) => ({ id: String(c.id), program_id: String(c.program_id), program: pm.get(String(c.program_id)) || '—', code: String(c.code || ''), name: String(c.section_name || c.code || ''), level: c.cefr_level || null, capacity: Number(c.capacity || 30), filled: cnt.get(String(c.id)) || 0 })).sort((a, b) => a.program.localeCompare(b.program, 'ar') || a.code.localeCompare(b.code));
}
/** ملخّص البطاقة العلنية: شارة الأرشفة + قرار التسكين (بلا بيانات شخصية) */
export async function publicLedgerBadge(db: any, reportId: string): Promise<{ مؤرشفة: boolean; قرار: { المستوى: string; البرنامج: string | null; الشعبة: string | null; المصدر: 'إنسان' | 'تلقائي'; التاريخ: string } | null; يحتاج_إنسانًا: boolean }> {
  try { await autoPlaceDue(db, { reportId }); } catch { /* كسول */ }
  const [{ data: rep }, { data: d }] = await Promise.all([db.from('placement_reports').select('archived_at').eq('id', reportId).maybeSingle(), db.from('placement_decisions').select('assigned_level,decision_status,source,program_id,classroom_id,decided_at').eq('report_id', reportId).maybeSingle()]);
  let program: string | null = null, classroom: string | null = null;
  if (d?.program_id) program = (await programsMap(db, [String(d.program_id)])).get(String(d.program_id)) || null; if (d?.classroom_id) classroom = (await classroomsMap(db, [String(d.classroom_id)])).get(String(d.classroom_id)) || null;
  return { مؤرشفة: !!rep?.archived_at, قرار: d && d.decision_status === 'approved' && isLedgerLevel(d.assigned_level) ? { المستوى: LEVEL_AR[d.assigned_level as LedgerLevel], البرنامج: program, الشعبة: classroom, المصدر: d.source === 'auto' ? 'تلقائي' : 'إنسان', التاريخ: String(d.decided_at || '') } : null, يحتاج_إنسانًا: d?.decision_status === 'review' };
}
