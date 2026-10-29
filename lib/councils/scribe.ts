// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «كاتب المجلس» (P23) — بعد كل مرحلة من القضية: ملخص · الالتزامات · الأسئلة التي غيّرت المسار · ما لم يُقل · أنماط (وسوم من قائمة ثابتة)
 *  يمرّ بـ runAi القائم (بلا أسماء ولا بُرُد: المتداولون «عضو ١، عضو ٢…»)، ويعود إلى بديل محلي صريح عند التعثّر. لا يقيّم شخصًا ولا يصدر شهادة.
 */
import { runAi, logAi } from '../ai/athar';
import { THEMES_AR, localThemes, lower } from './registry';
import type { Case, Post, Scribe } from './registry';

export type ScribeOut = Pick<Scribe, 'summary_ar' | 'commitments' | 'pivotal_questions' | 'unsaid_ar' | 'patterns'>;
const PHASE_AR: Record<Scribe['phase'], string> = { deliberation: 'المداولة', commitment: 'الالتزام', return: 'العودة' };

/** تجهيل المداولة: كل بريد يصبح «عضو n» بترتيب الظهور، وصاحب القضية «صاحب القضية» */
export function anonymizeThread(c: Pick<Case, 'author_email' | 'title_ar' | 'body_ar' | 'commitment_ar' | 'return_ar' | 'return_outcome'>, posts: Pick<Post, 'email' | 'kind' | 'body_ar' | 'created_at'>[]) {
  const names = new Map<string, string>([[lower(c.author_email), 'صاحب القضية']]); let n = 0;
  const who = (e: string) => { const k = lower(e); if (!names.has(k)) names.set(k, `عضو ${++n}`); return names.get(k)!; };
  const lines = posts.slice().sort((a, b) => a.created_at < b.created_at ? -1 : 1).map(p => `[${who(p.email)} · ${p.kind === 'question' ? 'سؤال' : p.kind === 'advice' ? 'نصيحة' : p.kind === 'evidence' ? 'دليل' : 'ملاحظة'}] ${String(p.body_ar || '').replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[بريد]').slice(0, 700)}`);
  return { text: `القضية: ${c.title_ar}\n${String(c.body_ar || '').slice(0, 2500)}\n\nالمداولة (${posts.length} مداخلة):\n${lines.join('\n')}${c.commitment_ar ? `\n\nالالتزام المعلن: ${c.commitment_ar}` : ''}${c.return_ar ? `\n\nالعودة (${c.return_outcome || ''}): ${c.return_ar}` : ''}`, participants: n };
}

export function scribePrompt(phase: Scribe['phase']) {
  return {
    system: `أنت «كاتب المجلس» في مجالس أَثَر — مجالس أقران مهنيين. مهمتك التوثيق لا الحكم: لا تقيّم أحدًا، لا تمدح ولا تنتقد شخصًا، لا تذكر أسماء أو جهات. أعد JSON فقط بالمفاتيح: summary_ar (≤ 120 كلمة، ماذا كانت القضية وأين وصل المجلس في مرحلة ${PHASE_AR[phase]})، commitments (مصفوفة نصوص: التزامات قابلة للعودة بصيغة «سأ… خلال…»؛ فارغة إن لم تُعلن)، pivotal_questions (حتى 3 أسئلة من المداولة غيّرت مسار التفكير، بنصها)، unsaid_ar (جملة واحدة: ما لم يُطرح وكان يستحق — أو null)، patterns (حتى 3 رموز من: ${THEMES_AR.map(t => `${t.code}=${t.label}`).join(' · ')}).`,
    parse: (raw: string): ScribeOut | null => {
      try { const m = raw.match(/\{[\s\S]*\}/); const j = JSON.parse(m ? m[0] : raw); if (!j || typeof j.summary_ar !== 'string') return null; const codes = new Set(THEMES_AR.map(t => t.code));
        return { summary_ar: j.summary_ar.slice(0, 1200), commitments: Array.isArray(j.commitments) ? j.commitments.map(String).slice(0, 5) : [], pivotal_questions: Array.isArray(j.pivotal_questions) ? j.pivotal_questions.map(String).slice(0, 3) : [], unsaid_ar: j.unsaid_ar ? String(j.unsaid_ar).slice(0, 300) : null, patterns: Array.isArray(j.patterns) ? j.patterns.map(String).filter((p: string) => codes.has(p)).slice(0, 3) : [] };
      } catch { return null; }
    },
  };
}

/** البديل المحلي — صريح وصادق: يعدّ ويقتبس ولا يخترع */
export function localScribe(c: Pick<Case, 'title_ar' | 'body_ar' | 'commitment_ar' | 'return_ar' | 'return_outcome' | 'status'>, posts: Pick<Post, 'kind' | 'body_ar' | 'created_at'>[], phase: Scribe['phase']): ScribeOut {
  const q = posts.filter(p => p.kind === 'question'); const a = posts.filter(p => p.kind === 'advice'); const e = posts.filter(p => p.kind === 'evidence');
  const pivotal = q.slice().sort((x, y) => y.body_ar.length - x.body_ar.length).slice(0, 3).map(p => p.body_ar.slice(0, 220));
  const summary = `قضية «${c.title_ar.slice(0, 80)}». تداول المجلس في ${posts.length} مداخلة: ${q.length} سؤالًا، ${a.length} نصيحة، ${e.length} دليلًا.${c.commitment_ar ? ` أعلن صاحبها التزامًا.` : ''}${c.return_ar ? ` وعاد بالنتيجة: ${c.return_outcome === 'succeeded' ? 'نجح' : c.return_outcome === 'struggled' ? 'تعثّر' : 'تغيّر فهمه'}.` : ''} (ملخص آلي محلي — بلا تحليل لغوي)`;
  const unsaid = q.length === 0 && a.length > 0 ? 'نُصح صاحب القضية قبل أن يُسأل — لم يُطرح سؤال واحد.' : e.length === 0 && posts.length >= 3 ? 'لم يستشهد أحد بدليل أو تجربة موثَّقة.' : null;
  return { summary_ar: summary, commitments: c.commitment_ar ? [c.commitment_ar.slice(0, 300)] : [], pivotal_questions: pivotal, unsaid_ar: phase === 'deliberation' ? unsaid : null, patterns: localThemes(`${c.title_ar} ${c.body_ar} ${posts.map(p => p.body_ar).join(' ')}`) };
}

/** يكتب (أو يعيد كتابة) مخرجات المرحلة ويحدّث وسم القضية — يُستدعى بصلاحية الخدمة بعد الالتزام/العودة/الإغلاق */
export async function runScribe(db: any, c: Case, posts: Post[], phase: Scribe['phase'], actor?: { id: string; email: string; staff?: boolean }): Promise<Scribe> {
  const thread = anonymizeThread(c, posts); const p = scribePrompt(phase);
  const res = await runAi<ScribeOut>({ system: p.system, user: thread.text, parse: p.parse, local: () => localScribe(c, posts, phase), budgetMs: 25000 });
  const row: Scribe = { case_id: c.id, council_id: c.council_id, phase, ...res.data, source: res.source, model: res.model };
  const { data: old } = await db.from('portal_council_scribe').select('id').eq('case_id', c.id).eq('phase', phase).limit(1);
  if ((old || []).length) await db.from('portal_council_scribe').update({ summary_ar: row.summary_ar, commitments: row.commitments, pivotal_questions: row.pivotal_questions, unsaid_ar: row.unsaid_ar, patterns: row.patterns, source: row.source, model: row.model }).eq('id', old[0].id);
  else await db.from('portal_council_scribe').insert(row);
  if (row.patterns.length && !c.theme) await db.from('portal_council_cases').update({ theme: row.patterns[0] }).eq('id', c.id).then(() => null, () => null);
  if (actor) await logAi(db, { user_id: actor.id, email: actor.email, role: actor.staff ? 'staff' : 'member', purpose: 'council_scribe', result: res, context: { case_id: c.id, phase, participants: thread.participants } });
  return row;
}
