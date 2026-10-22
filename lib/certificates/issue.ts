/**
 * إصدار الشهادات (جانب المتصفح): إدراج في قاعدة البيانات → رسم → PDF / بريد.
 * مشترك بين صفحة الشهادات وصفحة تكريم المدربين.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderCertificate, canvasToJpeg, jpegsToPdf, bytesToBase64, cleanFilename, DEFAULT_SETTINGS, KIND_LABEL, W, H, fmtDate } from './render';
import type { CertData, CertKind, CertSettings } from './render';
import { buildCertificateEmailHtml, certificateSubject } from '../email/certificate-mail';

export type CertRow = {
  id: string; serial: string; verify_code: string; kind: CertKind; recipient_name: string; recipient_name_en: string | null; recipient_email: string | null;
  program_id: string | null; program_name: string | null; classroom_id: string | null; classroom_code: string | null; trainer_id: string | null; trainer_name: string | null;
  start_date: string | null; end_date: string | null; hours: number | null; award_title: string | null; issued_at: string; issued_by_name: string | null;
  sent_at: string | null; sent_to: string | null; revoked_at: string | null; revoke_reason: string | null; organization_id: string | null; meta: any; created_at: string;
};
export type IssueInput = {
  kind: CertKind; recipient_name: string; recipient_name_en?: string | null; recipient_email?: string | null; recipient_phone?: string | null;
  program_id?: string | null; program_name: string; classroom_id?: string | null; classroom_code?: string | null; trainer_id?: string | null; trainer_name?: string | null;
  start_date?: string | null; end_date?: string | null; hours?: number | null; award_title?: string | null; organization_id?: string | null; meta?: Record<string, unknown>;
};

export const SETTINGS_FIELDS = Object.keys(DEFAULT_SETTINGS) as (keyof CertSettings)[];

export async function loadSettings(db: SupabaseClient, orgId: string | null): Promise<CertSettings> {
  try {
    let q = db.from('certificate_settings').select('*');
    q = orgId ? q.eq('organization_id', orgId) : q.is('organization_id', null);
    const { data } = await q.maybeSingle();
    if (!data) return { ...DEFAULT_SETTINGS };
    const out: any = { ...DEFAULT_SETTINGS };
    for (const k of SETTINGS_FIELDS) if ((data as any)[k] !== null && (data as any)[k] !== undefined) out[k] = (data as any)[k];
    return out as CertSettings;
  } catch { return { ...DEFAULT_SETTINGS }; }
}
export async function saveSettings(db: SupabaseClient, orgId: string | null, s: CertSettings, userId: string): Promise<string | null> {
  const row: any = { ...s, organization_id: orgId, updated_by: userId, updated_at: new Date().toISOString() };
  const { error } = await db.from('certificate_settings').upsert(row, { onConflict: 'organization_id' });
  return error ? error.message : null;
}

export function verifyUrl(code: string): string {
  const base = (typeof window !== 'undefined' ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || '')).replace(/\/$/, '');
  return `${base}/verify/${encodeURIComponent(code)}`;
}
export function rowToData(r: CertRow): CertData {
  return {
    kind: r.kind, recipient_name: r.recipient_name, recipient_name_en: r.recipient_name_en, program_ar: r.program_name || '', program_en: (r.meta && r.meta.program_en) || null,
    classroom: r.classroom_code, trainer: r.trainer_name, start: r.start_date, end: r.end_date, hours: r.hours, issued_at: r.issued_at, serial: r.serial,
    verify_url: verifyUrl(r.verify_code), award_title: r.award_title,
  };
}
export function previewData(i: IssueInput, programEn?: string | null): CertData {
  return {
    kind: i.kind, recipient_name: i.recipient_name || 'اسم المتدرب', recipient_name_en: i.recipient_name_en || null, program_ar: i.program_name || 'اسم البرنامج', program_en: programEn || null,
    classroom: i.classroom_code || null, trainer: i.trainer_name || null, start: i.start_date || null, end: i.end_date || null, hours: i.hours || null,
    issued_at: new Date().toISOString().slice(0, 10), serial: 'UPM-2026-000000', verify_url: verifyUrl('PREVIEW'), award_title: i.award_title || null,
  };
}

/** إدراج الشهادات وإرجاع الصفوف مع الرقم التسلسلي ورمز التحقق */
export async function insertCertificates(db: SupabaseClient, inputs: IssueInput[]): Promise<{ rows: CertRow[]; error: string | null }> {
  const payload = inputs.map(i => ({
    kind: i.kind, recipient_name: i.recipient_name.trim(), recipient_name_en: i.recipient_name_en || null, recipient_email: i.recipient_email?.trim().toLowerCase() || null, recipient_phone: i.recipient_phone || null,
    program_id: i.program_id || null, program_name: i.program_name, classroom_id: i.classroom_id || null, classroom_code: i.classroom_code || null, trainer_id: i.trainer_id || null, trainer_name: i.trainer_name || null,
    start_date: i.start_date || null, end_date: i.end_date || null, hours: i.hours ?? null, award_title: i.award_title || null, organization_id: i.organization_id || null, meta: i.meta || {},
  }));
  const { data, error } = await db.from('certificates').insert(payload).select('*');
  return { rows: (data || []) as CertRow[], error: error ? error.message : null };
}

/** رسم مجموعة شهادات إلى صور JPEG (canvas مخفي) */
export async function renderRows(rows: CertRow[], settings: CertSettings, onProgress?: (done: number, total: number) => void): Promise<{ row: CertRow; jpeg: Uint8Array; w: number; h: number }[]> {
  const canvas = document.createElement('canvas');
  const out: { row: CertRow; jpeg: Uint8Array; w: number; h: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    await renderCertificate(canvas, rowToData(rows[i]), settings);
    out.push({ row: rows[i], jpeg: canvasToJpeg(canvas, 0.88), w: W, h: H });
    onProgress?.(i + 1, rows.length);
    await new Promise(r => setTimeout(r, 0));
  }
  return out;
}
export function pdfFilename(r: CertRow): string { return `${cleanFilename(`${KIND_LABEL[r.kind].ar}-${r.recipient_name}-${r.serial}`)}.pdf`; }

/** إرسال شهادات بالبريد عبر /api/certificates/send على دفعات */
export async function emailRendered(db: SupabaseClient, items: { row: CertRow; jpeg: Uint8Array; w: number; h: number }[], settings: CertSettings, note: string, onProgress?: (done: number, total: number) => void) {
  const session = (await db.auth.getSession()).data.session;
  if (!session) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', session.user.id).single();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
  const withMail = items.filter(x => x.row.recipient_email);
  const results: { certificateId: string; to: string; ok: boolean; error?: string }[] = [];
  const BATCH = 5;
  for (let i = 0; i < withMail.length; i += BATCH) {
    const chunk = withMail.slice(i, i + BATCH).map(x => {
      const pdf = jpegsToPdf([{ jpeg: x.jpeg, w: x.w, h: x.h }], `${KIND_LABEL[x.row.kind].ar} — ${x.row.recipient_name}`);
      const input = { recipientName: x.row.recipient_name, kindLabel: KIND_LABEL[x.row.kind].ar, programName: x.row.program_name || '', serial: x.row.serial, verifyUrl: verifyUrl(x.row.verify_code), issuedAt: fmtDate(x.row.issued_at), issuer: settings.issuer_ar, unit: settings.unit_ar, hours: x.row.hours, awardTitle: x.row.award_title, note: note || null, senderName: prof?.full_name || null };
      return { certificateId: x.row.id, to: x.row.recipient_email!, filename: pdfFilename(x.row), pdfBase64: bytesToBase64(pdf), subject: certificateSubject(input), html: buildCertificateEmailHtml(input) };
    });
    const res = await fetch('/api/certificates/send', { method: 'POST', headers, body: JSON.stringify({ items: chunk }) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok && !j.results) throw new Error(j.error || `HTTP ${res.status}`);
    results.push(...(j.results || []));
    onProgress?.(Math.min(i + BATCH, withMail.length), withMail.length);
  }
  return { results, skipped: items.length - withMail.length };
}
