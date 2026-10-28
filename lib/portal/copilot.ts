// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — «الميسِّر الحي» (P13-ب): يجلس بجوار المدرب أثناء الجلسة المباشرة.
 *  يقرأ نبض الجلسة (الحضور، الاستجابات، آخر نشاط، الزمن المنقضي) ويقترح — لا يقرّر —: سؤال نبض، موقفًا قصيرًا، تأملًا، غرف نقاش، تذكيرًا للغائبين، تغيير إيقاع.
 *  بعد الجلسة يولّد «محضر الأثر»: ما حدث فعلًا (حضور، منحنى التفاعل، ما ظهر من الجدارات، الفجوات، الخطوة التالية) — ويعتمده المدرب قبل أن يراه المشاركون.
 *  القواعد محلية وشفافة؛ الذكاء الاصطناعي يحسّن سرد المحضر فقط. المبدأ: الآلة تقترح، والإنسان يقرّر.
 */
import { parseJsonLoose } from '../ai/prompts';
import { CASE_BANK } from './daily-case';
import { domainByCode } from './lexicon';

// ====================================================================== الأنواع
export type Pulse = {
  session_id: string; at: string; status: string;
  elapsed_min: number; total_min: number; fraction: number;
  registered: number; joined: number; join_rate: number;
  activities: number; open_activities: number; last_activity_min_ago: number | null;
  last_activity_answered: number; last_activity_rate: number;
  responses_total: number; responses_last10: number;
  reflections: number; notes: number; kinds: string[];
};
export type SuggestionKind = 'activity' | 'remind' | 'breakout' | 'pace' | 'close';
export type Suggestion = {
  code: string; kind: SuggestionKind; priority: 1 | 2 | 3;
  title_ar: string; why_ar: string; how_ar: string;
  activity?: { kind: 'mcq' | 'reflection' | 'self_rating'; prompt_ar: string; options?: string[]; correct?: number | null; skill_id?: string | null };
};
export type Note = { at: string; text: string; min: number };
export type SessionMemo = {
  title_ar: string; summary_ar: string;
  attendance: { registered: number; joined: number; rate: number };
  engagement: { min: number; responses: number }[];
  activities: { prompt_ar: string; kind: string; answered: number; avg_score: number | null }[];
  skills_ar: string[]; highlights_ar: string[]; gaps_ar: string[]; next_ar: string[]; moments_ar: string[];
  trainer_note_ar?: string; source: 'local' | 'ai' | 'human'; model?: string | null;
};
export type SkillRef = { id: string; name_ar: string; domain_code?: string | null };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const minsBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

// ====================================================================== النبض
export function computePulse(input: {
  session: { id: string; status: string; starts_at: string; duration_min: number };
  registered: number; joinedEvents: { user_id?: string | null; email?: string | null; created_at: string }[];
  activities: { id: string; kind: string; created_at?: string; active: boolean }[];
  responses: { activity_id: string; created_at?: string; score?: number | null }[];
  notes: number; now?: Date;
}): Pulse {
  const now = input.now || new Date(); const s = input.session; const start = new Date(s.starts_at);
  const total = Math.max(15, Number(s.duration_min) || 60);
  const elapsed = Math.max(0, minsBetween(start, now)); const fraction = clamp01(elapsed / total);
  const joinedSet = new Set(input.joinedEvents.map(e => e.user_id || e.email || Math.random().toString())); const joined = joinedSet.size;
  const acts = [...input.activities].sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const last = acts[acts.length - 1] || null;
  const lastAgo = last && last.created_at ? Math.max(0, minsBetween(new Date(last.created_at), now)) : null;
  const lastAnswered = last ? input.responses.filter(r => r.activity_id === last.id).length : 0;
  const audience = Math.max(joined, lastAnswered, 1);
  const last10 = input.responses.filter(r => r.created_at && minsBetween(new Date(r.created_at), now) <= 10).length;
  return {
    session_id: s.id, at: now.toISOString(), status: s.status, elapsed_min: elapsed, total_min: total, fraction,
    registered: input.registered, joined, join_rate: input.registered ? clamp01(joined / input.registered) : (joined ? 1 : 0),
    activities: acts.length, open_activities: acts.filter(a => a.active).length, last_activity_min_ago: lastAgo,
    last_activity_answered: lastAnswered, last_activity_rate: last ? clamp01(lastAnswered / audience) : 0,
    responses_total: input.responses.length, responses_last10: last10,
    reflections: acts.filter(a => a.kind === 'reflection').length, notes: input.notes, kinds: Array.from(new Set(acts.map(a => a.kind))),
  };
}

// ====================================================================== المقترحات (قواعد شفافة)
function caseFor(skills: SkillRef[]): { prompt: string } | null {
  const domains = new Set(skills.map(s => s.domain_code).filter(Boolean));
  const pool = CASE_BANK.filter(c => domains.has(c.domain_code)); const pick = (pool.length ? pool : CASE_BANK)[(skills.length + new Date().getUTCDate()) % Math.max(1, (pool.length ? pool : CASE_BANK).length)];
  if (!pick) return null;
  return { prompt: `موقف قصير (3 دقائق): ${pick.situation_ar.slice(0, 260)}${pick.situation_ar.length > 260 ? '…' : ''}\nاكتب في سطرين: ما أول شيء تفعله؟ ومع من تتحدث قبل أن تقرّر؟` };
}
export function suggest(p: Pulse, ctx: { title_ar: string; skills: SkillRef[]; dismissed?: string[]; accepted?: string[] }): Suggestion[] {
  const out: Suggestion[] = []; const skill = ctx.skills[0] || null; const sName = skill ? skill.name_ar : 'موضوع الجلسة';
  const done = new Set([...(ctx.accepted || [])]); const skip = new Set([...(ctx.dismissed || [])]);
  const push = (s: Suggestion) => { if (!done.has(s.code) && !skip.has(s.code)) out.push(s); };
  if (p.status !== 'live') {
    if (p.status === 'ended') push({ code: 'memo', kind: 'close', priority: 1, title_ar: 'أنشئ محضر الأثر', why_ar: 'انتهت الجلسة — المحضر يحوّلها من «حدث» إلى «شاهد».', how_ar: 'اضغط «أنشئ محضر الأثر»، راجعه، ثم اعتمده ليراه المشاركون.' });
    else push({ code: 'start', kind: 'pace', priority: 2, title_ar: 'ابدأ الجلسة من جدول المدرب', why_ar: 'الميسِّر يقرأ النبض فقط حين تكون الجلسة «جارية».', how_ar: 'من جدول المدرب اضغط «بدء» ثم عُد هنا.' });
    return out;
  }
  // 1) الافتتاح
  if (p.elapsed_min <= 7 && p.activities === 0) push({ code: 'open_rating', kind: 'activity', priority: 1, title_ar: 'افتتح بنبض ثقة', why_ar: 'لم يُطرح نشاط بعد؛ سؤال تقدير ذاتي في أول 5 دقائق يرفع التفاعل اللاحق ويمنحك خط الأساس.', how_ar: 'يُنشأ نشاط «تقدير ذاتي» فورًا ويظهر للمشاركين في صفحة الجلسة.', activity: { kind: 'self_rating', prompt_ar: `قبل أن نبدأ: ما مدى ثقتك اليوم في ${sName}؟ (1 = أتعلّم من الصفر · 5 = أستطيع تدريب غيري)`, skill_id: skill?.id || null } });
  // 2) الحضور
  if (p.elapsed_min >= 8 && p.elapsed_min <= 25 && p.registered >= 5 && p.join_rate < 0.5) push({ code: 'remind_absent', kind: 'remind', priority: 1, title_ar: `انضمّ ${p.joined} من ${p.registered} فقط`, why_ar: 'نصف المسجّلين لم يدخلوا بعد؛ تذكير فوري بالبريد يعيد جزءًا منهم خلال دقائق.', how_ar: 'يُرسل بريد تذكير لمن لم يدخل بعد (مرة واحدة).' });
  // 3) الصمت بعد نشاط
  if (p.last_activity_min_ago !== null && p.last_activity_min_ago >= 3 && p.last_activity_min_ago <= 12 && p.last_activity_rate < 0.4 && p.joined >= 3) push({ code: 'breakout_small', kind: 'breakout', priority: 1, title_ar: 'الصمت يعني شيئًا', why_ar: `أجاب ${p.last_activity_answered} فقط على آخر نشاط. السؤال غالبًا أكبر من اللحظة.`, how_ar: 'افتح غرفًا صغيرة (3 أشخاص · 4 دقائق) بسؤال واحد: «ما أصعب جزء في هذا؟» ثم اطلب من كل غرفة سطرًا واحدًا.' });
  // 4) نبض فهم في الربع الأول/الثاني
  if (p.fraction >= 0.2 && p.fraction <= 0.55 && (p.last_activity_min_ago === null || p.last_activity_min_ago >= 15) && !p.kinds.includes('mcq')) push({ code: 'pulse_mcq', kind: 'activity', priority: 2, title_ar: 'نبض فهم سريع', why_ar: 'مرّ وقت بلا قياس؛ سؤال واحد يكشف إن كان الشرح وصل قبل أن تبني عليه.', how_ar: 'يُنشأ سؤال اختيار من متعدد؛ عدّل الصياغة بعد الإنشاء إن شئت.', activity: { kind: 'mcq', prompt_ar: `أيّ العبارات أقرب إلى ما تعلّمناه حتى الآن عن ${sName}؟`, options: ['أستطيع شرحه لزميل بمثال من عملي', 'فهمت الفكرة لكن لا أعرف متى أستخدمها', 'ما زلت أحتاج مثالًا آخر', 'لم أفهم بعد — أعد من البداية'], correct: null, skill_id: skill?.id || null } });
  // 5) موقف قصير لتغيير الإيقاع
  if (p.fraction >= 0.35 && p.fraction <= 0.8 && p.responses_last10 === 0 && (p.last_activity_min_ago === null || p.last_activity_min_ago >= 18)) { const c = caseFor(ctx.skills); if (c) push({ code: 'mini_case', kind: 'activity', priority: 2, title_ar: 'غيّر الإيقاع بموقف', why_ar: 'لا استجابة خلال 10 دقائق؛ الموقف القصير يعيد الانتباه ويُظهر طريقة التفكير لا الحفظ.', how_ar: 'يُنشأ نشاط تأمل بموقف من بنك مواقف أَثَر المرتبط بمجال الجلسة.', activity: { kind: 'reflection', prompt_ar: c.prompt, skill_id: skill?.id || null } }); }
  // 6) الختام
  if (p.fraction >= 0.75 && p.reflections === 0) push({ code: 'close_reflection', kind: 'activity', priority: 1, title_ar: 'اختم بالتزام واحد', why_ar: 'الربع الأخير بلا تأمل؛ سؤال الالتزام يحوّل الحضور إلى شاهد تطبيق.', how_ar: 'يُنشأ نشاط تأمل ختامي؛ إجاباته تدخل المحضر وملفات المشاركين.', activity: { kind: 'reflection', prompt_ar: 'ما الشيء الواحد الذي ستطبّقه غدًا مما تعلّمته اليوم؟ ومن سيلاحظ أنك طبّقته؟', skill_id: skill?.id || null } });
  if (p.fraction >= 0.9) push({ code: 'wrap', kind: 'close', priority: 2, title_ar: 'أنهِ الجلسة وأنشئ المحضر', why_ar: 'اقترب الوقت من نهايته.', how_ar: 'اضغط «إنهاء» من جدول المدرب ثم «أنشئ محضر الأثر» هنا.' });
  // 7) زخم عالٍ: استثمره
  if (p.responses_last10 >= Math.max(5, Math.round(p.joined * 0.6)) && p.fraction < 0.75) push({ code: 'momentum', kind: 'pace', priority: 3, title_ar: 'الزخم مرتفع — ادفع أعمق', why_ar: `${p.responses_last10} استجابة في 10 دقائق. هذه لحظة للسؤال الصعب لا للملخص.`, how_ar: 'اطرح السؤال «لماذا يفشل هذا عمليًا؟» شفهيًا، واطلب مثالًا من عمل أحدهم.' });
  return out.sort((a, b) => a.priority - b.priority).slice(0, 4);
}

// ====================================================================== محضر الأثر
export function engagementCurve(responses: { created_at?: string }[], start: string, total: number, step = 10): { min: number; responses: number }[] {
  const s = new Date(start).getTime(); const buckets = Math.max(1, Math.ceil(total / step)); const out = Array.from({ length: buckets }, (_, i) => ({ min: i * step, responses: 0 }));
  for (const r of responses) { if (!r.created_at) continue; const m = (new Date(r.created_at).getTime() - s) / 60000; const i = Math.min(buckets - 1, Math.max(0, Math.floor(m / step))); out[i].responses++; }
  return out;
}
export function buildLocalMemo(input: {
  session: { title_ar: string; starts_at: string; duration_min: number; skills?: string[] };
  pulse: Pulse; activities: { id: string; kind: string; prompt_ar: string }[];
  responses: { activity_id: string; created_at?: string; score?: number | null; answer?: any }[];
  notes: Note[]; skills: SkillRef[]; accepted: string[];
}): SessionMemo {
  const { session: s, pulse: p } = input;
  const curve = engagementCurve(input.responses, s.starts_at, p.total_min);
  const acts = input.activities.map(a => { const rs = input.responses.filter(r => r.activity_id === a.id); const sc = rs.map(r => Number(r.score)).filter(n => Number.isFinite(n)); return { prompt_ar: a.prompt_ar.slice(0, 160), kind: a.kind, answered: rs.length, avg_score: sc.length ? Math.round(sc.reduce((x, y) => x + y, 0) / sc.length) : null }; });
  const peak = curve.reduce((b, c) => (c.responses > b.responses ? c : b), curve[0] || { min: 0, responses: 0 });
  const quiet = curve.filter(c => c.responses === 0).length;
  const reflections = input.activities.filter(a => a.kind === 'reflection'); const refTexts = input.responses.filter(r => reflections.some(a => a.id === r.activity_id)).map(r => String(r.answer?.text || r.answer?.value || '')).filter(t => t.length > 20);
  const skillsAr = input.skills.map(k => k.name_ar);
  const highlights: string[] = [];
  if (p.join_rate >= 0.7) highlights.push(`حضور قوي: انضمّ ${p.joined} من ${p.registered} مسجّلًا (${Math.round(p.join_rate * 100)}%).`);
  if (peak.responses > 0) highlights.push(`ذروة التفاعل في الدقيقة ${peak.min}–${peak.min + 10} (${peak.responses} استجابة).`);
  if (refTexts.length) highlights.push(`${refTexts.length} التزامًا مكتوبًا بالتطبيق — تدخل ملفات المشاركين شواهدَ.`);
  if (input.accepted.length) highlights.push(`المدرب استجاب لمقترحات الميسِّر (${input.accepted.length}) أثناء الجلسة — تيسير حيّ لا سيناريو جامد.`);
  const gaps: string[] = [];
  if (p.registered >= 5 && p.join_rate < 0.6) gaps.push(`غاب ${p.registered - p.joined} من المسجّلين — راجع التوقيت أو التذكير قبل 24 ساعة.`);
  if (acts.length === 0) gaps.push('لم يُطرح أي نشاط قياس؛ لا يمكن إثبات الفهم من الحضور وحده.');
  if (quiet >= Math.ceil(curve.length / 2)) gaps.push(`نصف الجلسة أو أكثر بلا استجابة مسجّلة (${quiet} من ${curve.length} فترات).`);
  const lowAct = acts.find(a => a.answered > 0 && a.answered < Math.max(2, Math.round(p.joined * 0.4))); if (lowAct) gaps.push(`نشاط «${lowAct.prompt_ar.slice(0, 50)}…» أجاب عنه ${lowAct.answered} فقط — السؤال أكبر من اللحظة أو غير واضح.`);
  if (!reflections.length) gaps.push('بلا تأمل ختامي؛ لم يُسجَّل التزام بالتطبيق.');
  const next: string[] = [];
  next.push(refTexts.length ? 'بعد 7 أيام: رسالة متابعة تسأل كل مشارك عن التزامه المكتوب — وتُوثَّق الإجابة شاهد تطبيق.' : 'في الجلسة القادمة: افتتح بسؤال «ماذا طبّقت؟» واطلب مثالًا واحدًا.');
  if (skillsAr.length) next.push(`حوّل ${skillsAr[0]} إلى مهمة من قلب العمل يصدّقها المشرف (/me/missions).`);
  if (p.registered - p.joined > 0) next.push('أرسل التسجيل والملخص للغائبين مع سؤال واحد يجيبون عنه كتابةً.');
  const summary = `جلسة «${s.title_ar}» (${p.total_min} دقيقة): حضر ${p.joined}${p.registered ? ` من ${p.registered}` : ''}، طُرح ${acts.length} نشاطًا وجُمعت ${input.responses.length} استجابة${peak.responses ? `، وبلغ التفاعل ذروته في الدقيقة ${peak.min}` : ''}. ${skillsAr.length ? `الجدارات المستهدفة: ${skillsAr.slice(0, 3).join('، ')}.` : ''} ${gaps.length ? 'أهم فجوة: ' + gaps[0] : 'لم تُرصد فجوات كبيرة في التيسير.'}`.replace(/\s+/g, ' ').trim();
  return { title_ar: `محضر الأثر — ${s.title_ar}`, summary_ar: summary, attendance: { registered: p.registered, joined: p.joined, rate: Math.round(p.join_rate * 100) }, engagement: curve, activities: acts, skills_ar: skillsAr, highlights_ar: highlights.slice(0, 4), gaps_ar: gaps.slice(0, 4), next_ar: next.slice(0, 3), moments_ar: input.notes.map(n => `د${n.min}: ${n.text}`).slice(0, 8), source: 'local', model: null };
}
export function buildMemoPrompt(local: SessionMemo, reflections: string[]): { system: string; user: string } {
  const system = 'أنت كاتب «محضر أثر» في بوابة أَثَر لجلسة تدريب مباشرة. اكتب للمدرب والمشاركين معًا: صادق، محدد، بلا مجاملة ولا وعظ، وبلغة مهنية عربية. لا تخترع أرقامًا؛ استعمل الأرقام المعطاة فقط. JSON فقط.';
  const schema = '{"summary_ar": string (4–6 جمل تروي ما حدث فعلًا وما ظهر من قدرة), "highlights_ar": string[2-4], "gaps_ar": string[1-3], "next_ar": string[2-3] (خطوات محددة بزمن ومسؤول)}';
  const user = `المحضر المحلي:\n${JSON.stringify({ summary: local.summary_ar, attendance: local.attendance, activities: local.activities, highlights: local.highlights_ar, gaps: local.gaps_ar, next: local.next_ar, moments: local.moments_ar, skills: local.skills_ar })}\n\nعيّنة من تأملات المشاركين (بلا أسماء):\n${reflections.slice(0, 8).map(t => `- ${t.slice(0, 220)}`).join('\n') || '- (لا تأملات)'}\n\nالمخطط:\n${schema}`;
  return { system, user };
}
const S = (v: unknown, max = 300): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
export function parseMemo(raw: any, local: SessionMemo): SessionMemo | null {
  const j = typeof raw === 'string' ? parseJsonLoose(raw) : raw; if (!j || typeof j !== 'object') return null;
  const summary = S(j.summary_ar, 1200); if (summary.length < 60) return null;
  const arr = (v: unknown, n: number) => Array.isArray(v) ? v.map(x => S(x, 260)).filter(Boolean).slice(0, n) : [];
  return { ...local, summary_ar: summary, highlights_ar: arr(j.highlights_ar, 4).length ? arr(j.highlights_ar, 4) : local.highlights_ar, gaps_ar: arr(j.gaps_ar, 3).length ? arr(j.gaps_ar, 3) : local.gaps_ar, next_ar: arr(j.next_ar, 3).length ? arr(j.next_ar, 3) : local.next_ar, source: 'ai' };
}
/** نص المحضر للمشاركة/البريد */
export function memoText(m: SessionMemo): string {
  return [m.title_ar, '', m.summary_ar, '', m.highlights_ar.length ? 'ما ظهر: ' + m.highlights_ar.join(' · ') : '', m.gaps_ar.length ? 'الفجوات: ' + m.gaps_ar.join(' · ') : '', m.next_ar.length ? 'الخطوة التالية: ' + m.next_ar.join(' · ') : ''].filter(Boolean).join('\n');
}
export const domainNameOf = (code?: string | null) => (code ? domainByCode(code as any)?.name.ar || '' : '');
