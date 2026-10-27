// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مهمات في قلب العمل (P12-أ) — خادم فقط: الإسناد والإرسال والفحص والتأكيد ودورة الكرون
 *  يعمل ضمن الكرون اليومي الموجود (/api/followups/send) بلا كرون جديد:
 *   1) إسناد تلقائي: لكل قالب نشط مرتبط ببرنامج، كل من صدرت له شهادة إتمام لذلك البرنامج قبل days_after يومًا (ونافذة 60 يومًا) ولم تُسند له المهمة → تُنشأ وتُرسل.
 *   2) تذكير واحد قبل انتهاء المهلة بيومين (أو عند تجاوزها) · 3) انتهاء المهلة بعد 7 أيام من الاستحقاق.
 *  الفحص: ذكاء اصطناعي نصي (fast) أو البديل المحلي — والمشرف/الطاقم يعتمد. لا قرار يرفع وزن الدليل دون إنسان.
 */
import { runAi, logAi } from '../ai/athar';
import { sendViaResend } from '../email/resend';
import { computeSkillLevels } from './profile';
import type { LearningEventRow } from './profile';
import { aiCheckPrompt, parseAiCheck, localCheck, missionEvent, missionToken, dueAt, scheduleWindow, missionUrl, confirmUrl, missionMailHtml, reminderMailHtml, supervisorMailHtml, confirmedMailHtml, daysLeft, addDays } from './missions';
import type { Mission, MissionTemplate, MissionEvidence, AiCheck } from './missions';

export const MISSION_COLS = 'id,created_at,template_id,user_id,email,full_name,program_id,skills,title_ar,brief_ar,evidence_mode,rubric,token,confirm_token,status,due_at,sent_at,submitted_at,evidence,ai,supervisor_email,supervisor_name,confirmed_at,confirmed_by,confirm_note,reminders';

export async function mail(to: string, m: { subject: string; html: string }): Promise<boolean> {
  try { await sendViaResend({ to: [to], subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'mission' }] }); return true; } catch { return false; }
}

/** إعادة حساب مستويات المهارات لمستخدم (نفس منطق /api/profile) — تُستدعى بعد إدخال/تأكيد دليل مهمة */
export async function recomputeSkills(db: any, userId: string | null, email: string): Promise<number> {
  if (!userId) return 0;
  const { data: evs } = await db.from('portal_learning_events').select('id,at,user_id,email,verb,object_type,object_id,skills,context').or(`user_id.eq.${userId},email.ilike.${email}`).order('at', { ascending: false }).limit(2000);
  const events = ((evs || []) as LearningEventRow[]).filter(e => (e.skills || []).length); const ids = Array.from(new Set(events.flatMap(e => e.skills || []))); if (!ids.length) return 0;
  const { data: sk } = await db.from('portal_skills').select('id,code,level').in('id', ids);
  const meta = new Map<string, { level: number; code: string }>(((sk || []) as any[]).map(s => [s.id, { level: s.level, code: s.code }]));
  const rows = computeSkillLevels(userId, events, meta);
  if (rows.length) await db.from('portal_skill_levels').upsert(rows.map(r => ({ user_id: r.user_id, skill_id: r.skill_id, computed_level: r.computed_level, confidence: r.confidence, evidence: r.evidence, updated_at: r.updated_at })), { onConflict: 'user_id,skill_id' });
  return rows.length;
}

export async function userIdByEmail(db: any, email: string): Promise<string | null> {
  for (const t of ['portal_enrollments', 'portal_credentials', 'portal_placements']) { const { data } = await db.from(t).select('user_id').ilike('email', email).not('user_id', 'is', null).limit(1); if ((data || [])[0]?.user_id) return data[0].user_id; }
  return null;
}

export type Person = { email: string; full_name?: string | null; user_id?: string | null };
/** إنشاء مهمة من قالب لشخص وإرسالها (إن لم تكن dry) — يعيد null إن كانت مُسندة سابقًا */
export async function assignMission(db: any, tpl: MissionTemplate, person: Person, site: string, opts: { dry?: boolean; now?: Date; programName?: string | null; send?: boolean } = {}): Promise<Mission | null> {
  const now = opts.now || new Date(); const email = person.email.toLowerCase();
  const { data: ex } = await db.from('portal_missions').select('id').eq('template_id', tpl.id).ilike('email', email).limit(1); if ((ex || []).length) return null;
  const row = { template_id: tpl.id, user_id: person.user_id || await userIdByEmail(db, email), email, full_name: person.full_name || null, program_id: tpl.program_id || null, skills: tpl.skills || [], title_ar: tpl.title_ar, brief_ar: tpl.brief_ar, evidence_mode: tpl.evidence_mode, rubric: tpl.rubric || [], token: missionToken(), confirm_token: missionToken(), status: 'assigned', due_at: dueAt(now, tpl.due_days), sent_at: null as string | null, reminders: 0 };
  if (opts.dry) return { ...row, id: 'dry', created_at: now.toISOString() } as Mission;
  const { data: ins, error } = await db.from('portal_missions').insert(row).select(MISSION_COLS).single(); if (error || !ins) return null;
  if (opts.send !== false) { const ok = await mail(email, missionMailHtml(ins, missionUrl(site, ins.token), opts.programName)); if (ok) await db.from('portal_missions').update({ sent_at: now.toISOString() }).eq('id', ins.id); return { ...ins, sent_at: ok ? now.toISOString() : null }; }
  return ins;
}

/** الفحص الأولي للدليل: ذكاء اصطناعي نصي سريع أو محلي — يُسجَّل حوكميًا بلا محتوى شخصي */
export async function checkEvidence(db: any, m: Mission, ev: MissionEvidence, budgetMs = 20000): Promise<AiCheck> {
  const { system, user } = aiCheckPrompt(m, ev);
  const r = await runAi<AiCheck>({ system, user, parse: raw => parseAiCheck(raw, m.rubric || []), local: () => localCheck(m, ev), budgetMs, fast: true });
  await logAi(db, { user_id: m.user_id || '00000000-0000-0000-0000-000000000000', email: m.email, role: 'TRAINEE', purpose: 'mission_check' as any, result: r, context: { mission: m.id, mode: m.evidence_mode } });
  return { ...r.data, source: r.source, model: r.model };
}

/** تسليم الدليل: يحفظ، يفحص، يُدخل حدث تعلم (غير مؤكد)، يراسل المشرف إن وُجد */
export async function submitMission(db: any, m: Mission, ev: MissionEvidence, sup: { email?: string | null; name?: string | null }, site: string, now = new Date()): Promise<{ mission: Mission; ai: AiCheck; supervisor_mailed: boolean }> {
  const ai = await checkEvidence(db, m, ev);
  const patch: Partial<Mission> = { status: 'submitted', submitted_at: now.toISOString(), evidence: ev, ai, supervisor_email: sup.email ? String(sup.email).toLowerCase() : m.supervisor_email || null, supervisor_name: sup.name || m.supervisor_name || null, confirmed_at: null, confirmed_by: null, confirm_note: null };
  await db.from('portal_missions').update(patch).eq('id', m.id);
  // حدث التعلم: واحد لكل مهمة (يُحدَّث عند إعادة الإرسال)
  const { data: old } = await db.from('portal_learning_events').select('id').eq('object_type', 'mission').eq('object_id', m.id).limit(1);
  const evRow = missionEvent(m, ai.score, false);
  if ((old || []).length) await db.from('portal_learning_events').update({ context: evRow.context, at: now.toISOString() }).eq('id', old[0].id); else await db.from('portal_learning_events').insert(evRow);
  await recomputeSkills(db, m.user_id || null, m.email);
  let supervisor_mailed = false;
  if (patch.supervisor_email) supervisor_mailed = await mail(patch.supervisor_email, supervisorMailHtml({ ...m, ...patch }, ai, confirmUrl(site, m.confirm_token)));
  return { mission: { ...m, ...patch } as Mission, ai, supervisor_mailed };
}

/** تأكيد/إعادة المهمة بضغطة إنسان (مشرف بالرمز أو موظف) — يرفع وزن الدليل ويعيد حساب التوأم */
export async function decideMission(db: any, m: Mission, decision: 'confirmed' | 'returned', by: { name: string; note?: string | null }, site: string, now = new Date()): Promise<Mission> {
  const patch = { status: decision, confirmed_at: now.toISOString(), confirmed_by: by.name.slice(0, 120), confirm_note: (by.note || '').slice(0, 600) || null };
  await db.from('portal_missions').update(patch).eq('id', m.id);
  const { data: old } = await db.from('portal_learning_events').select('id,context').eq('object_type', 'mission').eq('object_id', m.id).limit(1);
  const ctx = { ...((old || [])[0]?.context || missionEvent(m, m.ai?.score ?? 0, false).context), confirmed: decision === 'confirmed', returned: decision === 'returned' };
  if ((old || []).length) await db.from('portal_learning_events').update({ context: ctx }).eq('id', old[0].id); else await db.from('portal_learning_events').insert({ ...missionEvent(m, m.ai?.score ?? 0, decision === 'confirmed'), context: ctx });
  await recomputeSkills(db, m.user_id || null, m.email);
  await mail(m.email, confirmedMailHtml({ ...m, confirmed_by: by.name }, `${site}/me/twin`, decision === 'returned', by.note));
  return { ...m, ...patch } as Mission;
}

/** دورة الكرون اليومية */
export async function runMissionCycle(db: any, site: string, opts: { dry?: boolean; now?: Date } = {}) {
  const now = opts.now || new Date(); const dry = !!opts.dry; const out = { ok: true, assigned: 0, reminded: 0, expired: 0, skipped: 0, errors: [] as string[], previews: [] as any[] };
  try {
    const { data: tpls } = await db.from('portal_mission_templates').select('*').eq('active', true).not('program_id', 'is', null);
    const programs = new Map<string, string>(); const pids = Array.from(new Set(((tpls || []) as MissionTemplate[]).map(t => t.program_id!)));
    if (pids.length) { const { data: pg } = await db.from('programs').select('id,name_ar').in('id', pids); for (const p of (pg || []) as any[]) programs.set(p.id, p.name_ar); }
    for (const tpl of (tpls || []) as MissionTemplate[]) {
      const { data: creds } = await db.from('portal_credentials').select('email,full_name,user_id,issued_at').eq('kind', 'program_completion').eq('program_id', tpl.program_id).is('revoked_at', null).gte('issued_at', addDays(now, -(tpl.days_after + 60))).limit(500);
      const { data: done } = await db.from('portal_missions').select('email').eq('template_id', tpl.id); const have = new Set(((done || []) as any[]).map(x => String(x.email).toLowerCase()));
      const seen = new Set<string>();
      for (const c of (creds || []) as any[]) {
        const email = String(c.email || '').toLowerCase(); if (!email || have.has(email) || seen.has(email)) continue; seen.add(email);
        const w = scheduleWindow(tpl, c.issued_at, now); if (w !== 'send') { out.skipped++; continue; }
        const m = await assignMission(db, tpl, { email, full_name: c.full_name, user_id: c.user_id }, site, { dry, now, programName: programs.get(tpl.program_id!) || null });
        if (m) { out.assigned++; if (dry) out.previews.push({ email, title: tpl.title_ar }); }
      }
    }
    // تذكير واحد قبل يومين من المهلة أو بعد تجاوزها
    const { data: due } = await db.from('portal_missions').select(MISSION_COLS).eq('status', 'assigned').lt('reminders', 1).lte('due_at', addDays(now, 2)).limit(300);
    for (const m of (due || []) as Mission[]) { if (daysLeft(m.due_at, now) < -7) continue; if (!dry) { await mail(m.email, reminderMailHtml(m, missionUrl(site, m.token))); await db.from('portal_missions').update({ reminders: (m.reminders || 0) + 1 }).eq('id', m.id); } out.reminded++; }
    // انتهاء المهلة بعد 7 أيام
    const { data: late } = await db.from('portal_missions').select('id').eq('status', 'assigned').lt('due_at', addDays(now, -7)).limit(500);
    if ((late || []).length && !dry) await db.from('portal_missions').update({ status: 'expired' }).in('id', (late as any[]).map(x => x.id));
    out.expired = (late || []).length;
  } catch (e: any) { out.ok = false; out.errors.push(String(e?.message || e).slice(0, 200)); }
  return out;
}
