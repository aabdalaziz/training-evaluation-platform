// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «مرآة المجلس» (P23) — في نهاية الدورة (وفي أي وقت) يرى العضو مرآته: كم سأل مقابل كم نصح · كم استشهد بدليل · كم عاد بالتزامه (وفي موعده)
 *  مقارنة بنفسه (الدورة السابقة) لا بالآخرين. تُحسب عبر RPC council_mirror أو من الصفوف مباشرة.
 */
import { lower } from './registry';
import type { Case, Post, Attestation } from './registry';

export type Mirror = { questions: number; advice: number; evidence: number; cases: number; commitments: number; returns: number; returns_late: number; given: number; received: number };
export const EMPTY_MIRROR: Mirror = { questions: 0, advice: 0, evidence: 0, cases: 0, commitments: 0, returns: 0, returns_late: 0, given: 0, received: 0 };

export function mirrorFromRows(email: string, cases: Case[], posts: Post[], atts: Attestation[], cycle: number | null = null): Mirror {
  const me = lower(email); const inCycle = (n: number) => cycle === null || n === cycle; const cycleOf = new Map(cases.map(c => [c.id, c.cycle_no]));
  const mine = posts.filter(p => lower(p.email) === me && inCycle(cycleOf.get(p.case_id) ?? 0));
  const myCases = cases.filter(c => lower(c.author_email) === me && inCycle(c.cycle_no));
  return {
    questions: mine.filter(p => p.kind === 'question').length, advice: mine.filter(p => p.kind === 'advice').length, evidence: mine.filter(p => p.kind === 'evidence').length,
    cases: myCases.length, commitments: myCases.filter(c => c.committed_at).length, returns: myCases.filter(c => c.returned_at).length,
    returns_late: myCases.filter(c => c.returned_at && c.return_due_at && c.returned_at > c.return_due_at).length,
    given: atts.filter(a => lower(a.from_email) === me && inCycle(a.cycle_no)).length, received: atts.filter(a => lower(a.to_email) === me && a.status === 'approved' && inCycle(a.cycle_no)).length,
  };
}

export async function mirrorFor(db: any, email: string, councilId: string, cycle: number | null): Promise<Mirror> {
  try { const { data, error } = await db.rpc('council_mirror', { p_email: lower(email), p_council: councilId, p_cycle: cycle }); if (!error && data && typeof data === 'object' && !Array.isArray(data)) return { ...EMPTY_MIRROR, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Number(v) || 0])) } as Mirror; } catch { /* fallback */ }
  const [{ data: cases }, { data: posts }, { data: atts }] = await Promise.all([
    db.from('portal_council_cases').select('id,cycle_no,author_email,committed_at,returned_at,return_due_at').eq('council_id', councilId).limit(500),
    db.from('portal_council_posts').select('case_id,email,kind').eq('council_id', councilId).limit(5000),
    db.from('portal_council_attestations').select('from_email,to_email,status,cycle_no').eq('council_id', councilId).limit(2000),
  ]);
  return mirrorFromRows(email, (cases || []) as Case[], (posts || []) as Post[], (atts || []) as Attestation[], cycle);
}

/** سطور المرآة بلغة بشرية — تصف السلوك ولا تحكم على الشخص؛ وتقارن بالدورة السابقة إن وُجدت */
export function mirrorLines(m: Mirror, prev: Mirror | null): { key: string; text: string; tone: 'good' | 'note' | 'neutral' }[] {
  const out: { key: string; text: string; tone: 'good' | 'note' | 'neutral' }[] = []; const total = m.questions + m.advice;
  const ratio = total ? Math.round((m.questions / total) * 100) : null;
  if (total === 0) out.push({ key: 'voice', text: 'لم تدخل المداولة بعد هذه الدورة — سؤال واحد يكفي لتبدأ.', tone: 'neutral' });
  else out.push({ key: 'ratio', text: `سألت ${m.questions} وأشرت بـ ${m.advice} — ${ratio}% من مداخلاتك أسئلة${ratio! >= 50 ? '؛ تسأل قبل أن تنصح.' : '؛ ميثاق المجلس يقول: اسأل أولًا.'}`, tone: ratio! >= 50 ? 'good' : 'note' });
  if (m.evidence) out.push({ key: 'evidence', text: `استشهدت بدليل أو تجربة موثَّقة ${m.evidence} ${m.evidence === 1 ? 'مرة' : m.evidence === 2 ? 'مرتين' : 'مرات'}.`, tone: 'good' }); else if (total >= 3) out.push({ key: 'evidence', text: 'لم تستشهد بدليل بعد — تجربة موثَّقة واحدة تزن أكثر من نصائح كثيرة.', tone: 'note' });
  if (m.commitments) out.push({ key: 'returns', text: `أعلنت ${m.commitments} التزامًا وعدت بـ ${m.returns}${m.returns_late ? ` (منها ${m.returns_late} بعد الموعد)` : ''}.`, tone: m.returns >= m.commitments ? 'good' : 'note' });
  if (m.given || m.received) out.push({ key: 'attest', text: `شهدت لأقرانك ${m.given} مرة، وشهد لك أقرانك ${m.received} شهادة معتمدة.`, tone: 'neutral' });
  if (prev) { const d = (m.questions + m.evidence) - (prev.questions + prev.evidence); if (d > 0) out.push({ key: 'trend', text: `مقارنة بدورتك السابقة: أسئلتك وأدلتك زادت بـ ${d}.`, tone: 'good' }); else if (d < 0) out.push({ key: 'trend', text: `مقارنة بدورتك السابقة: أسئلتك وأدلتك أقل بـ ${-d}.`, tone: 'note' }); }
  return out;
}
