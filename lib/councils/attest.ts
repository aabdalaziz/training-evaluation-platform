// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «شهادة الأقران» (P23) — عضو شهد الدورة يشهد بدليل محدد على مهارة محددة لقرين؛ لا تقدير رقمي عام.
 *  تصبح حدث تعلّم موزونًا في خيط الأثر فور إنشائها (وزن منخفض) ويرتفع وزنها باعتماد إنسان: مدير جهة المشهود له أولًا، والطاقم عند غياب الجهة.
 *  لا تمسّ المستوى المعتمد (approved_level) — ذلك قرار بشري منفصل (مبدأ P8).
 */
import { ATTEST_MIN_CHARS, lower } from './registry';
import type { Attestation, Member } from './registry';
import { recomputeSkills } from '../portal/missions-cron';

export const PEER_WEIGHT = 0.4; export const PEER_APPROVED_WEIGHT = 0.75;

export function peerEvent(a: Pick<Attestation, 'id' | 'to_user_id' | 'to_email' | 'skill_id' | 'evidence_ar' | 'council_id' | 'case_id'>, approved: boolean, extra: { skill_name?: string | null; council_title?: string | null } = {}) {
  return { user_id: a.to_user_id || null, email: lower(a.to_email), verb: 'attested', object_type: 'council', object_id: String(a.id), skills: [a.skill_id], context: { approved, title: extra.skill_name || 'شهادة أقران', council: extra.council_title || null, case_id: a.case_id, evidence: String(a.evidence_ar || '').slice(0, 240), peer: true } };
}

export type AttestInput = { council_id: string; case_id: string | null; cycle_no: number; from: { id: string | null; email: string }; to_email: string; skill_id: string; evidence_ar: string };
export function validateAttestation(inp: AttestInput, members: Member[], councilSkills: string[]): string | null {
  const from = lower(inp.from.email); const to = lower(inp.to_email);
  if (!to || from === to) return 'لا تشهد لنفسك — الشهادة لقرين';
  const act = members.filter(m => m.status === 'active' && m.council_id === inp.council_id);
  if (!act.some(m => lower(m.email) === from)) return 'الشاهد ليس عضوًا نشطًا في هذا المجلس';
  if (!act.some(m => lower(m.email) === to)) return 'المشهود له ليس عضوًا نشطًا في هذا المجلس';
  if (!inp.skill_id) return 'حدّد المهارة'; if (councilSkills.length && !councilSkills.includes(inp.skill_id)) return 'المهارة ليست من مهارات هذا المجلس';
  if (String(inp.evidence_ar || '').trim().length < ATTEST_MIN_CHARS) return `اكتب الدليل المحدد (ما رأيته يفعله) في ${ATTEST_MIN_CHARS} حرفًا على الأقل`;
  return null;
}

export async function createAttestation(db: any, inp: AttestInput, members: Member[], councilSkills: string[], extra: { skill_name?: string | null; council_title?: string | null } = {}): Promise<{ ok: true; row: Attestation; duplicate: boolean } | { ok: false; error: string }> {
  const err = validateAttestation(inp, members, councilSkills); if (err) return { ok: false, error: err };
  const toM = members.find(m => lower(m.email) === lower(inp.to_email))!;
  const { data: dup } = await db.from('portal_council_attestations').select('id,created_at,council_id,case_id,cycle_no,from_user_id,from_email,to_user_id,to_email,skill_id,evidence_ar,status,approver_role,approved_by,decided_at,decision_note,event_id,reminded_at').eq('council_id', inp.council_id).eq('cycle_no', inp.cycle_no).eq('skill_id', inp.skill_id).ilike('from_email', lower(inp.from.email)).ilike('to_email', lower(inp.to_email)).limit(1);
  if ((dup || []).length) return { ok: true, row: dup[0] as Attestation, duplicate: true };
  const { data: row, error } = await db.from('portal_council_attestations').insert({ council_id: inp.council_id, case_id: inp.case_id, cycle_no: inp.cycle_no, from_user_id: inp.from.id, from_email: lower(inp.from.email), to_user_id: toM.user_id || null, to_email: lower(inp.to_email), skill_id: inp.skill_id, evidence_ar: String(inp.evidence_ar).trim().slice(0, 1200), status: 'pending' }).select('*').single();
  if (error || !row) return { ok: false, error: error?.message || 'تعذّر الحفظ' };
  // حدث تعلّم بوزن منخفض فورًا (الشهادة موجودة لكن لم يعتمدها إنسان بعد)
  const { data: ev } = await db.from('portal_learning_events').insert(peerEvent(row as Attestation, false, extra)).select('id').maybeSingle().then((r: any) => r, () => ({ data: null }));
  if (ev?.id) await db.from('portal_council_attestations').update({ event_id: ev.id }).eq('id', (row as any).id);
  return { ok: true, row: { ...(row as Attestation), event_id: ev?.id ?? null }, duplicate: false };
}

/** من يعتمد؟ مدير جهة المشهود له (مؤكَّد) إن وُجد، وإلا الطاقم */
export async function approversFor(db: any, a: Pick<Attestation, 'to_email' | 'to_user_id'>): Promise<{ role: 'org_admin' | 'staff'; emails: string[]; organization_id: string | null }> {
  const { data: mem } = await db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').or(`email.ilike.${lower(a.to_email)}${a.to_user_id ? `,user_id.eq.${a.to_user_id}` : ''}`).limit(3);
  const orgId = ((mem || []) as any[]).find(m => m.organization_id)?.organization_id || null;
  if (orgId) { const { data: adm } = await db.from('portal_org_members').select('email').eq('organization_id', orgId).eq('role', 'org_admin').eq('status', 'confirmed').limit(10); const emails = ((adm || []) as any[]).map(x => lower(x.email)).filter(e => e && e !== lower(a.to_email)); if (emails.length) return { role: 'org_admin', emails, organization_id: orgId }; }
  return { role: 'staff', emails: [], organization_id: orgId };
}

/** هل يحق لهذا الشخص اعتماد هذه الشهادة؟ طاقم دائمًا؛ مدير جهة إن كان مدير جهة المشهود له (ولا يعتمد شهادة لنفسه) */
export async function canDecide(db: any, a: Pick<Attestation, 'to_email' | 'to_user_id' | 'from_email'>, who: { id: string; email: string; staff: boolean }): Promise<'staff' | 'org_admin' | null> {
  if (lower(who.email) === lower(a.to_email)) return null;
  const ap = await approversFor(db, a); if (ap.role === 'org_admin' && ap.emails.includes(lower(who.email))) return 'org_admin';
  return who.staff ? 'staff' : null;
}

export async function decideAttestation(db: any, id: number, d: { by: { id: string; email: string }; role: 'staff' | 'org_admin'; approve: boolean; note?: string | null }, extra: { skill_name?: string | null; council_title?: string | null } = {}): Promise<{ ok: boolean; row?: Attestation; error?: string }> {
  const { data: a } = await db.from('portal_council_attestations').select('*').eq('id', id).maybeSingle(); if (!a) return { ok: false, error: 'الشهادة غير موجودة' };
  if ((a as any).status !== 'pending') return { ok: false, error: 'سبق البتّ في هذه الشهادة' };
  const patch = { status: d.approve ? 'approved' : 'declined', approver_role: d.role, approved_by: d.by.id, decided_at: new Date().toISOString(), decision_note: d.note ? String(d.note).slice(0, 400) : null };
  const { data: row, error } = await db.from('portal_council_attestations').update(patch).eq('id', id).select('*').maybeSingle(); if (error) return { ok: false, error: error.message };
  const att = { ...(a as Attestation), ...patch } as Attestation;
  if (d.approve) {
    const ev = peerEvent(att, true, extra);
    if (att.event_id) await db.from('portal_learning_events').update({ context: ev.context, at: new Date().toISOString() }).eq('id', att.event_id); else await db.from('portal_learning_events').insert(ev);
    try { await recomputeSkills(db, att.to_user_id || null, lower(att.to_email)); } catch { /* */ }
  } else if (att.event_id) {
    await db.from('portal_learning_events').update({ context: { ...peerEvent(att, false, extra).context, declined: true } }).eq('id', att.event_id).then(() => null, () => null);
  }
  return { ok: true, row: (row as Attestation) || att };
}
