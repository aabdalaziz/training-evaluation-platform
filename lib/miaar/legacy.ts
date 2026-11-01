// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * الاستيراد من مشروع مِعيار القديم (Supabase المستقل) إلى جداول أَثَر — بالمعرّفات نفسها، idempotent، على دفعات.
 *  يستعمل متغيّري P7 القائمين MIAAR_SUPABASE_URL / MIAAR_SERVICE_ROLE_KEY (لا متغيّر جديد). الأعمدة غير المعروفة تُحفظ في legacy_extra.
 *  يُستدعى من /api/admin/miaar (action import) — جدولًا واحدًا في كل طلب ليبقى ضمن مهلة الخادم؛ اللوحة تمرّ على القائمة بالترتيب.
 *  الصوت الخاص للمقاطع (question-bank-audio/in-review/*.mp3) يُنسخ إلى miaar-media بالمسار نفسه.
 */
import { createClient } from '@supabase/supabase-js';
import { MEDIA_BUCKET } from './bank';

export const LEGACY_ORDER = ['question_bank_import_batches', 'question_bank_items', 'question_bank_answer_keys', 'question_bank_review_events', 'question_bank_import_errors', 'question_bank_blueprints', 'question_bank_forms', 'question_bank_form_items', 'placement_secure_sessions', 'placement_secure_answers', 'placement_reports', 'placement_decisions', 'placement_decision_events', 'test_retake_approvals', 'audio'] as const;
export type LegacyTable = (typeof LEGACY_ORDER)[number];
export const LEGACY_LABEL_AR: Record<LegacyTable, string> = {
  question_bank_import_batches: 'دفعات الاستيراد', question_bank_items: 'بنود البنك', question_bank_answer_keys: 'مفاتيح الإجابة', question_bank_review_events: 'أحداث المراجعة', question_bank_import_errors: 'أخطاء الاستيراد',
  question_bank_blueprints: 'المخطّطات', question_bank_forms: 'النماذج', question_bank_form_items: 'بنود النماذج', placement_secure_sessions: 'الجلسات', placement_secure_answers: 'الإجابات', placement_reports: 'التقارير',
  placement_decisions: 'قرارات التسكين', placement_decision_events: 'أحداث القرارات', test_retake_approvals: 'موافقات إعادة الاختبار', audio: 'صوت المقاطع (التخزين)',
};
/** الأعمدة المعروفة في أَثَر لكل جدول (ما عداها → legacy_extra حيث يوجد، وإلا يُهمل) */
const COLUMNS: Record<Exclude<LegacyTable, 'audio'>, string[]> = {
  question_bank_import_batches: ['id', 'source_format', 'file_name', 'content_version', 'initial_status', 'file_sha256', 'created_by', 'status', 'total_rows', 'valid_rows', 'imported_rows', 'rejected_rows', 'validation_summary', 'created_at', 'completed_at'],
  question_bank_items: ['id', 'item_code', 'content_version', 'level', 'skill', 'passage_id', 'question_text', 'options', 'cefr_descriptor', 'domain', 'status', 'source_kind', 'latest_review_note', 'latest_review_references', 'reviewed_by', 'reviewed_at', 'import_batch_id', 'created_by', 'created_at', 'updated_at'],
  question_bank_answer_keys: ['item_id', 'correct_option_id', 'updated_at'],
  question_bank_review_events: ['id', 'item_id', 'review_status', 'academic_note', 'academic_references', 'reviewed_by', 'created_at'],
  question_bank_import_errors: ['id', 'batch_id', 'source_row_number', 'item_code', 'field_name', 'error_code', 'error_message', 'created_at'],
  question_bank_blueprints: ['id', 'code', 'name_ar', 'description_ar', 'test_type', 'requirements', 'duration_minutes', 'is_system', 'created_by', 'created_at', 'updated_at'],
  question_bank_forms: ['id', 'title', 'test_type', 'blueprint_id', 'selection_mode', 'status', 'requirements', 'generation_seed', 'created_by', 'created_at', 'updated_at'],
  question_bank_form_items: ['form_id', 'item_id', 'position'],
  placement_secure_sessions: ['id', 'token_hash', 'candidate', 'content_version', 'exam_mode', 'status', 'current_level_index', 'started_at', 'expires_at', 'finished_at', 'finish_reason', 'report', 'created_at', 'updated_at'],
  placement_secure_answers: ['session_id', 'question_id', 'selected_option_id', 'submitted_at'],
  placement_reports: ['id', 'submission_id', 'test_version', 'candidate_email', 'report', 'created_at'],
  placement_decisions: ['id', 'report_id', 'recommended_level', 'assigned_level', 'decision_status', 'program_track', 'cohort_name', 'academic_term', 'academic_note', 'decided_by', 'decided_at', 'created_at', 'updated_at'],
  placement_decision_events: ['id', 'decision_id', 'report_id', 'event_type', 'payload', 'actor', 'created_at'],
  test_retake_approvals: ['id', 'email', 'approved_by', 'note', 'created_at', 'used_at'],
};
const EXTRA_OK = new Set(['question_bank_items', 'placement_secure_sessions', 'placement_reports']);
const KEY: Partial<Record<LegacyTable, string>> = { question_bank_answer_keys: 'item_id', question_bank_form_items: 'form_id,item_id', placement_secure_answers: 'session_id,question_id' };
const ORDER_COL: Partial<Record<LegacyTable, string>> = { question_bank_answer_keys: 'item_id', question_bank_form_items: 'form_id', placement_secure_answers: 'session_id' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function legacyClient() {
  const url = process.env.MIAAR_SUPABASE_URL; const key = process.env.MIAAR_SERVICE_ROLE_KEY; if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export const isLegacyTable = (v: unknown): v is LegacyTable => typeof v === 'string' && (LEGACY_ORDER as readonly string[]).includes(v);

/** تشكيل صفّ قديم إلى أعمدة أَثَر (+ legacy_extra). المعرّفات غير الصالحة تُستبعد. */
export function shapeRow(table: Exclude<LegacyTable, 'audio'>, row: Record<string, unknown>): Record<string, unknown> | null {
  const cols = COLUMNS[table]; const out: Record<string, unknown> = {}; const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) { if (cols.includes(k)) out[k] = v; else if (v !== null && v !== undefined) extra[k] = v; }
  if (EXTRA_OK.has(table) && Object.keys(extra).length) out.legacy_extra = extra;
  if (typeof out.id === 'string' && !UUID.test(out.id) && table !== 'question_bank_import_errors' && table !== 'placement_decision_events') return null;
  if (table === 'placement_decisions' && !['approved', 'review', 'retest', 'hold', 'pending'].includes(String(out.decision_status))) out.decision_status = 'review';
  if (table === 'placement_secure_sessions') { if (!['completed', 'expired', 'abandoned'].includes(String(out.status))) out.status = 'expired'; }  /* الجلسات القديمة لا تُستأنف في أَثَر */
  if (table === 'question_bank_items') { out.item_type = 'mcq'; if (!out.source_kind) out.source_kind = 'imported'; }
  if (table === 'placement_reports' && out.candidate_email == null) { const r = out.report as any; out.candidate_email = String(r?.بيانات_المتقدم?.البريد_الإلكتروني || '').toLowerCase() || null; }
  return out;
}

export type ImportResult = { table: LegacyTable; fetched: number; imported: number; skipped: number; errors: string[]; done: boolean; next_offset: number };
/** استيراد جدول واحد (حتى 500 صف من offset) — on conflict do nothing عبر upsert ignoreDuplicates */
export async function importTable(db: any, table: LegacyTable, offset = 0, pageSize = 500): Promise<ImportResult> {
  const legacy = legacyClient(); const base: ImportResult = { table, fetched: 0, imported: 0, skipped: 0, errors: [], done: true, next_offset: offset };
  if (!legacy) return { ...base, errors: ['MIAAR_SUPABASE_URL / MIAAR_SERVICE_ROLE_KEY غير مضبوطين'] };
  if (table === 'audio') return importAudio(db, legacy, base);
  const orderCol = ORDER_COL[table] || 'created_at';
  const { data, error } = await legacy.from(table).select('*').order(orderCol, { ascending: true }).range(offset, offset + pageSize - 1);
  if (error) return { ...base, errors: [`القديم (${table}): ${error.message}`] };
  const rows = (data || []) as Record<string, unknown>[]; base.fetched = rows.length;
  const shaped = rows.map((r) => shapeRow(table, r)).filter((r): r is Record<string, unknown> => !!r); base.skipped += rows.length - shaped.length;
  for (let i = 0; i < shaped.length; i += 100) {
    const chunk = shaped.slice(i, i + 100);
    const r = await db.from(table).upsert(chunk, { onConflict: KEY[table] || 'id', ignoreDuplicates: true }).select(table === 'question_bank_form_items' ? 'form_id' : table === 'placement_secure_answers' ? 'session_id' : table === 'question_bank_answer_keys' ? 'item_id' : 'id');
    if (r.error) { base.errors.push(`أَثَر (${table}): ${r.error.message}`); base.skipped += chunk.length; continue; }
    const n = (r.data || []).length; base.imported += n; base.skipped += chunk.length - n;
  }
  base.done = rows.length < pageSize; base.next_offset = offset + rows.length;
  return base;
}
async function importAudio(db: any, legacy: any, base: ImportResult): Promise<ImportResult> {
  const { data: passages } = await db.from('miaar_passages').select('id, audio_storage_path').not('audio_storage_path', 'is', null);
  const paths = ((passages || []) as any[]).map((p) => String(p.audio_storage_path)); base.fetched = paths.length;
  for (const path of paths) {
    const head = await db.storage.from(MEDIA_BUCKET).list(path.split('/').slice(0, -1).join('/'), { search: path.split('/').pop() });
    if (!head.error && (head.data || []).some((f: any) => f.name === path.split('/').pop())) { base.skipped += 1; continue; }
    const dl = await legacy.storage.from('question-bank-audio').download(path);
    if (dl.error || !dl.data) { base.errors.push(`صوت ${path}: ${dl.error?.message || 'غير موجود'}`); base.skipped += 1; continue; }
    const buf = Buffer.from(await dl.data.arrayBuffer());
    const up = await db.storage.from(MEDIA_BUCKET).upload(path, buf, { contentType: 'audio/mpeg', upsert: true });
    if (up.error) { base.errors.push(`رفع ${path}: ${up.error.message}`); base.skipped += 1; } else base.imported += 1;
  }
  return base;
}
/** أعداد سريعة من القديم (للمقارنة في اللوحة) */
export async function legacyCounts(): Promise<Record<string, number | null> | null> {
  const legacy = legacyClient(); if (!legacy) return null; const out: Record<string, number | null> = {};
  for (const t of LEGACY_ORDER) { if (t === 'audio') continue; const { count, error } = await legacy.from(t).select('*', { count: 'exact', head: true }); out[t] = error ? null : (count ?? 0); }
  return out;
}
