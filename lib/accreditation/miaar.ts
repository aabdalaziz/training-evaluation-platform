// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م9 «أدلة مِعيار» — دمج نتائج الاختبار المعياري (عُبور · خريطة المنهج · جلسة التعويض · الإعادة) في «ملف الاعتماد الحيّ» (P48).
 *  - الجزء الصرف: `miaarEvidence(facts)` يحوّل حقائق مجمَّعة إلى أدلة مؤرَّخة تحت معاييرها الفرعية (PAS) — لا أسماء، مجاميع k ≥ 5 فقط، لا ذكاء.
 *  - الغراء: `collectMiaarEvidence(db, programId, classroomIds)` يجمع الحقائق عند الطلب من جداول مِعيار القائمة (لا نسخ · لا جدول جديد).
 *  القاعدة: لا دليل لم يعتمده إنسان — الأحكام النهائية فقط، والترقية الموقَّعة، والجلسات التي أنشأها مدرّب.
 */
import type { Evidence } from './registry';
import { K_MIN } from './registry';
import { effectFor, effectText, joinedEmails, beforeAfterRows } from '../miaar/remedial';
import type { Effect } from '../miaar/remedial';

export const MIAAR_EVIDENCE_TITLE = { ar: 'أدلة مِعيار', en: 'Miaar Evidence' } as const;
/** خرائط المعايير الفرعية (PAS) التي تخدمها أدلة مِعيار — معلَنة لتُقرأ في الوثائق والاختبارات */
export const MIAAR_CODES = {
  exit: ['2.5'], exit_promoted: ['3.3'], units: ['1.4', '1.6'], remedial: ['2.2', '2.1'], effect: ['2.5', '2.6'], retake: ['3.3', '3.1'], practice: ['2.2', '2.5', '3.3'] /* م10 */,
} as const;

export type ExitInviteFacts = { id: string; label: string; level: string; finals: number; passed: number; promoted: number; avg: number | null; last_at: string | null; weak_units: number };
export type RemedialFacts = { id: string; title_ar: string; starts_at: string; duration_min: number; units: string[]; joined: number; status: string };
export type MiaarFacts = {
  invites: ExitInviteFacts[];
  retakes: { n: number; passed_after: number; last_at: string | null };
  sessions: RemedialFacts[];
  effects: Array<{ session_id: string; title_ar: string; effect: Effect }>;
  linked_units: { program_units: number; level_units: number };
  practice?: PracticeFacts | null; /* م10 مِران */
};
export type PracticeFacts = { plans: number; placement?: number /* م11 */; approved: number; active: number; days_done: number; avg_delta: number | null; with_delta: number; retook: number; passed_after: number };
export const EMPTY_FACTS: MiaarFacts = { invites: [], retakes: { n: 0, passed_after: 0, last_at: null }, sessions: [], effects: [], linked_units: { program_units: 0, level_units: 0 }, practice: null };

const day = (iso: string | null | undefined) => (iso ? String(iso).slice(0, 10) : null);
const fmtDay = (iso: string) => { try { return new Date(iso).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }); } catch { return String(iso).slice(0, 10); } };

/** الحقائق → أدلة. k ≥ 5 للمجاميع التي تصف متعلّمين؛ الجلسة وربط الوحدات حقائق عن البرنامج لا عن أشخاص فتظهر من أول صفّ */
export function miaarEvidence(f: MiaarFacts, kMin = K_MIN): Evidence[] {
  const out: Evidence[] = [];
  for (const i of f.invites) {
    if (i.finals < kMin) continue;
    const codes = [...MIAAR_CODES.exit, ...(i.promoted > 0 ? MIAAR_CODES.exit_promoted : [])];
    out.push({ id: `miaar_exit:${i.id}`, kind: 'miaar_exit', codes, n: i.finals, at: day(i.last_at), href: `/admin/miaar/exit?invite=${i.id}`,
      label_ar: `اختبار نهاية المستوى ${i.level} — ${i.label}: ${i.finals} متعلّمًا بحكم نهائي · ${i.passed} اجتازوا${i.promoted ? ` · ${i.promoted} رُقّوا بتوقيع` : ''}${i.avg !== null ? ` · متوسط ${i.avg}%` : ''}${i.weak_units ? ` · ${i.weak_units} وحدة حمراء` : ''}` });
  }
  if (f.linked_units.program_units > 0) out.push({ id: 'miaar_units:1', kind: 'miaar_units', codes: [...MIAAR_CODES.units], n: f.linked_units.program_units, at: null, href: '/me/reports#diploma',
    label_ar: `خريطة المنهج: ${f.linked_units.program_units} وحدة برنامجية مربوطة بـ${f.linked_units.level_units} وحدة مستوى معتمدة (CEFR)` });
  for (const s of f.sessions) {
    if (s.status === 'cancelled') continue;
    out.push({ id: `miaar_remedial:${s.id}`, kind: 'miaar_remedial', codes: [...MIAAR_CODES.remedial], n: s.joined, at: day(s.starts_at), href: '/admin/live',
      label_ar: `جلسة تعويض من خريطة المنهج: ${s.units.join(' · ')} — ${fmtDay(s.starts_at)} · ${s.duration_min} د${s.joined >= kMin ? ` · انضمّ ${s.joined}` : ''}` });
  }
  for (const e of f.effects) {
    if (e.effect.n_retakes < kMin || e.effect.attended.delta === null) continue;
    out.push({ id: `miaar_effect:${e.session_id}:${e.effect.code}`, kind: 'miaar_effect', codes: [...MIAAR_CODES.effect], n: e.effect.n_retakes, at: null, href: '/admin/miaar/exit',
      label_ar: `أثر التعويض — ${effectText(e.effect, e.title_ar)}` });
  }
  if (f.retakes.n >= kMin) out.push({ id: 'miaar_retake:1', kind: 'miaar_retake', codes: [...MIAAR_CODES.retake], n: f.retakes.n, at: day(f.retakes.last_at), href: '/admin/miaar/exit',
    label_ar: `إعادة مهارة واحدة خلال 14 يومًا: ${f.retakes.n} إعادة · ${f.retakes.passed_after} أفضت إلى اجتياز` });
  /* م10 «مِران» + م11 «مِران البداية»: تدريب موجَّه بعد الحكم أو بعد التشخيص — k ≥ 5 خطّة معتمدة */
  const pr = f.practice; if (pr && pr.approved >= kMin) out.push({ id: 'miaar_practice:1', kind: 'miaar_practice', codes: [...MIAAR_CODES.practice], n: pr.approved, at: null, href: '/admin/miaar/exit#xb-practice',
    label_ar: practiceText(pr) });
  return out;
}

export function practiceText(pr: PracticeFacts): string {
  return `مِران — تدريب موجَّه بين الحكم والإعادة: ${pr.approved} خطّة اعتمدها مدرّب · ${pr.days_done} يوم تمرين مُنجَز${pr.with_delta >= 1 && pr.avg_delta !== null ? ` · متوسط تحسّن الوحدات ${pr.avg_delta > 0 ? '+' : ''}${pr.avg_delta} نقطة` : ''}${pr.retook ? ` · ${pr.retook} أعادوا بعد مِران و${pr.passed_after} اجتازوا` : ''}${pr.placement ? ` · منها ${pr.placement} «مِران البداية» بعد التشخيص (م11)` : ''}`;
}
/** ملخّص رقمي للتجميع المؤسسي (P48-ب) ولسطر البوابة */
export function miaarSummary(f: MiaarFacts, kMin = K_MIN) {
  const inv = f.invites.filter((i) => i.finals >= kMin); /* القاعدة نفسها: لا دعوة دون 5 أحكام */
  const exits = inv.length; const finals = inv.reduce((a, i) => a + i.finals, 0); const promoted = inv.reduce((a, i) => a + i.promoted, 0);
  const sessions = f.sessions.filter((s) => s.status !== 'cancelled').length;
  const deltas = f.effects.map((e) => e.effect.attended.delta).filter((d): d is number => typeof d === 'number');
  const avg_effect = deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null;
  return { exits, finals, promoted, sessions, retakes: f.retakes.n, avg_effect, practice_plans: f.practice?.approved || 0, practice_delta: f.practice?.avg_delta ?? null };
}

/* ───────── الغراء ───────── */
type Db = any;
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }

/** يجمع حقائق مِعيار لبرنامج: دعوات العبور المرتبطة به (مباشرة أو عبر قاعاته) · أحكامها · الإعادات · جلسات التعويض وأثرها · ربط وحدات البرنامج */
export async function collectMiaarEvidence(db: Db, programId: string, classroomIds: readonly string[], programUnits: ReadonlyArray<{ miaar_unit_codes?: string[] | null }>): Promise<{ evidence: Evidence[]; facts: MiaarFacts }> {
  try { return await collectInner(db, programId, classroomIds, programUnits); } catch { return { evidence: [], facts: EMPTY_FACTS }; } /* فشل مِعيار لا يُسقط ملف الاعتماد */
}
async function collectInner(db: Db, programId: string, classroomIds: readonly string[], programUnits: ReadonlyArray<{ miaar_unit_codes?: string[] | null }>): Promise<{ evidence: Evidence[]; facts: MiaarFacts }> {
  const pid = String(programId); const cids = classroomIds.map(String).filter(Boolean).slice(0, 100);
  const [byProg, byRoom] = await Promise.all([
    safe<any[]>(db.from('placement_invites').select('id, code, label_ar, classroom_id, level_target, created_at').eq('purpose', 'level_exit').eq('program_id', pid).limit(100), []),
    cids.length ? safe<any[]>(db.from('placement_invites').select('id, code, label_ar, classroom_id, level_target, created_at').eq('purpose', 'level_exit').in('classroom_id', cids).limit(100), []) : Promise.resolve([] as any[]),
  ]);
  const seen = new Set<string>(); const invites = [...byProg, ...byRoom].filter((i) => { const id = String(i.id); if (seen.has(id)) return false; seen.add(id); return true; });
  const linkedPU = programUnits.filter((u) => Array.isArray(u.miaar_unit_codes) && u.miaar_unit_codes.length); const levelCodes = new Set(linkedPU.flatMap((u) => u.miaar_unit_codes || []));
  const facts: MiaarFacts = { ...EMPTY_FACTS, invites: [], sessions: [], effects: [], retakes: { n: 0, passed_after: 0, last_at: null }, linked_units: { program_units: linkedPU.length, level_units: levelCodes.size } };
  if (!invites.length) return { evidence: miaarEvidence(facts), facts };
  const ids = invites.map((i) => String(i.id));
  const [reports, rooms, sessions] = await Promise.all([
    safe<any[]>(db.from('placement_reports').select('id, invite_id, report, created_at').in('invite_id', ids).limit(3000), []),
    cids.length ? safe<any[]>(db.from('classrooms').select('id, code, name, section_name').in('id', cids).limit(100), []) : Promise.resolve([] as any[]),
    safe<any[]>(db.from('portal_sessions').select('id, title_ar, starts_at, duration_min, status, miaar_unit_codes, source_invite_id').eq('kind', 'remedial').in('source_invite_id', ids).limit(200), []),
  ]);
  const roomLabel = new Map<string, string>(rooms.map((r) => [String(r.id), String(r.code || r.name || r.section_name || '')]));
  for (const inv of invites) {
    const reps = reports.filter((r) => String(r.invite_id) === String(inv.id)); const finals = reps.map((r) => r.report?.exit).filter((x: any) => x && x.الحالة === 'final');
    const passed = finals.filter((x: any) => x.النتيجة === 'passed').length; const promoted = finals.filter((x: any) => !!x.قرار_العبور).length;
    const tot = finals.map((x: any) => x.الكلي).filter((v: unknown) => typeof v === 'number') as number[]; const avg = tot.length ? Math.round(tot.reduce((a, b) => a + b, 0) / tot.length) : null;
    const weakSet = new Set<string>(); for (const x of finals) for (const u of (Array.isArray(x.وحدات_للمراجعة) ? x.وحدات_للمراجعة : []) as any[]) if (u?.الرمز && u.النسبة < 50) weakSet.add(String(u.الرمز));
    const last = reps.map((r) => String(r.created_at || '')).sort().pop() || null;
    facts.invites.push({ id: String(inv.id), label: roomLabel.get(String(inv.classroom_id || '')) || String(inv.code || inv.label_ar || ''), level: String(inv.level_target || ''), finals: finals.length, passed, promoted, avg, last_at: last, weak_units: weakSet.size });
  }
  /* الإعادات: دعوات retake_of لتقارير هذه الدعوات؛ «أفضت إلى اجتياز» = التقرير الأصلي صار passed وفيه كتلة الإعادة */
  const repIds = reports.map((r) => String(r.id));
  if (repIds.length) {
    const rts = await safe<any[]>(db.from('placement_invites').select('id, retake_of, created_at').in('retake_of', repIds.slice(0, 1000)).limit(1000), []);
    if (rts.length) { const byRep = new Map(reports.map((r) => [String(r.id), r])); let passedAfter = 0; for (const t of rts) { const o = byRep.get(String(t.retake_of)); if (o?.report?.exit?.الإعادة && o.report.exit.النتيجة === 'passed') passedAfter += 1; }
      facts.retakes = { n: rts.length, passed_after: passedAfter, last_at: rts.map((t) => String(t.created_at || '')).sort().pop() || null }; }
  }
  /* جلسات التعويض وأثرها */
  const live = sessions.filter((s) => String(s.status) !== 'cancelled');
  if (live.length) {
    const joined = await joinedEmails(db, live.map((s) => String(s.id)));
    for (const s of live) facts.sessions.push({ id: String(s.id), title_ar: String(s.title_ar || ''), starts_at: String(s.starts_at), duration_min: Number(s.duration_min) || 0, units: Array.isArray(s.miaar_unit_codes) ? s.miaar_unit_codes.map(String) : [], joined: joined.get(String(s.id))?.size || 0, status: String(s.status || 'scheduled') });
    const baCache = new Map<string, Awaited<ReturnType<typeof beforeAfterRows>>>();
    for (const s of live) {
      const invId = String(s.source_invite_id || ''); if (!invId) continue;
      if (!baCache.has(invId)) baCache.set(invId, await beforeAfterRows(db, invId));
      const rows = (baCache.get(invId) || []).map((r) => ({ email: r.email, before: r.before, after: r.after, attended: joined.get(String(s.id))?.has(r.email) || false }));
      const codes = Array.isArray(s.miaar_unit_codes) ? s.miaar_unit_codes.map(String) : [];
      for (const e of effectFor(rows, codes)) facts.effects.push({ session_id: String(s.id), title_ar: e.code, effect: e });
    }
  }
  /* م10: مجاميع مِران لتقارير هذه الدعوات (بلا أسماء) */
  try { const { practiceFactsForReports } = await import('../miaar/practice'); facts.practice = await practiceFactsForReports(db, reports.map((r) => ({ id: String(r.id), report: r.report }))); } catch { facts.practice = null; }
  return { evidence: miaarEvidence(facts), facts };
}
