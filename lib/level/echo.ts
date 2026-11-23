// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P70-ب «رجع الصدى» — الاسم الرسمي: «صدى المستوى للأستاذ — موجز الشعبة بلا أسماء» / Level Echo — Anonymous Section Digest for the Instructor
 *  - في الأسبوع الأول من مستوى ≥ 2 يرى أستاذ المحاضرة، داخل «الممرّ»، ما قالته الشعبة عبر المستوى الماضي كلّه: أعداد وعبارات مجمَّعة (k ≥ 5)
 *    من كلمات المشاركين وحدها (سطور P66 · التزاماتهم · ما كتبوه عن عبورهم في صفحة المستوى P70). لا أسماء · لا درجات · لا قراءة من سجلّات مِعيار.
 *  - يردّ بـ «كلمة العبور» (آلية «كلمة المدرّب» P51/P55 بعلامة echo) فتصل كلَّ مشارك في «سطري» تحت «الكلمة التي تعبر»؛ يردّ عليها المشارك بلمسات P53.
 *  - «صدى الصدى»: بعد الإرسال يرى الأستاذ الوصول واللمسات — ليعرف أثر كلمته قبل أن يكتب التالية.
 *  - يُحسب عند الفتح ولا يُخزَّن. صفر جداول جديدة · صفر كرون · صفر ذكاء اصطناعي.
 *  الجزء الصرف: echoPhase · buildInstructorEcho · echoWordTitleAr · echoDedupeKey · ECHO_LIMITS — الغراء: instructorEcho · learnerEchoWord · echoReach · levelEvidence
 */
import { fieldSummaryOf, arN } from '../calendar/registry';
import type { FieldLine } from '../calendar/registry';
import type { LevelSpan } from '../diploma/registry';
import { addDaysKey } from './registry';

type Db = any;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
async function safe<X>(q: PromiseLike<{ data: any; error: any }>, fb: X): Promise<X> { try { const { data, error } = await q; return error || data === null || data === undefined ? fb : (data as X); } catch { return fb; } }
const ENROLLED = ['approved', 'placed', 'active', 'completed'];

export const ECHO_LIMITS = { k: 5, show: 3, blockersShow: 2, weekDays: 7, wordMax: 300, voiceSec: 20 } as const;
export const ECHO_NAMES_AR = { narrative: 'رجع الصدى', official: 'صدى المستوى للأستاذ — موجز الشعبة بلا أسماء', word: 'كلمة العبور', evidence: 'عبروا بكلماتهم' } as const;
export const ECHO_PATH = '/me/day#echo';

/* ───────── النافذة ───────── */
export type EchoPhase = 'none' | 'week' | 'later';
/** هل نحن داخل مستوى له مستوى قبله؟ week = أول 7 أيام (الموجز + الكلمة) · later = بقية المستوى (الوصول فقط إن أُرسلت كلمة) */
export function echoPhase(spans: LevelSpan[], levelNo: number, today: string): { phase: EchoPhase; cur: LevelSpan | null; prev: LevelSpan | null } {
  const ss = spans.filter((s) => s.from_day && s.to_day).sort((a, b) => a.level_no - b.level_no);
  const i = ss.findIndex((s) => s.level_no === levelNo); if (i <= 0) return { phase: 'none', cur: i === 0 ? ss[0] : null, prev: null };
  const cur = ss[i]; const prev = ss[i - 1];
  if (today < cur.from_day || today > cur.to_day) return { phase: 'none', cur, prev };
  return { phase: today < addDaysKey(cur.from_day, ECHO_LIMITS.weekDays) ? 'week' : 'later', cur, prev };
}

/* ───────── الموجز (صرف) ───────── */
export type EchoWord = { text_ar: string | null; voice_sec: number | null; at: string; sent: number; reach: { replies: number; chips: Record<string, number> } };
export type EchoInput = { prev_level_no: number; level_no: number; roster: number; sealed: number; lines: FieldLine[]; commits: { authors: number; total: number; done: number }; crossed: string[]; seed: string; phase: Exclude<EchoPhase, 'none'>; word: EchoWord | null; can_write: boolean };
export type InstructorEcho = {
  title_ar: string; phase: Exclude<EchoPhase, 'none'>; prev_level_no: number; level_no: number; roster: number; people: number; k: number; shown: boolean;
  sealed_ar: string; lines: string[]; lines_ar: string | null; blockers: string[]; blockers_ar: string | null; commits_ar: string | null; crossed_ar: string | null;
  word: EchoWord | null; can_write: boolean; silent_ar: string | null;
};
const topOf = (xs: string[]): { text: string; n: number } | null => { const m = new Map<string, number>(); for (const x of xs) { const t = String(x || '').trim(); if (t) m.set(t, (m.get(t) || 0) + 1); } let best: { text: string; n: number } | null = null; for (const [text, n] of m) if (!best || n > best.n) best = { text, n }; return best; };
/** حارس: نصّ العبور كلمات ورموز مستويات (A2 · B1) — أي نسبة أو رقم من خانتين (درجة) لا يُعرض أبدًا */
const hasDigit = (s: string) => /%|[0-9٠-٩]{2,}|\b[0-9٠-٩]\b/.test(s);
export function buildInstructorEcho(p: EchoInput): InstructorEcho {
  const k = ECHO_LIMITS.k; const seed = `echo:${p.seed}:${p.prev_level_no}`;
  const s = fieldSummaryOf(p.lines, { k, show: ECHO_LIMITS.show, seed, roster: p.roster });
  const of = (n: number) => (p.roster ? `${n} من ${p.roster}` : `${n}`);
  const sealed_ar = p.sealed >= k ? `ختم صفحةَ مستواهم ${of(p.sealed)}.` : p.sealed ? `ختم صفحةَ مستواهم ${arN(p.sealed, 'واحد', 'اثنان', 'منهم', 'منهم')}؛ يظهر الصدى حين يكتملون خمسة.` : 'لم يختم أحد صفحة مستواه بعد.';
  const lines_ar = s.shown ? `قالت الشعبة عبر المستوى ${p.prev_level_no} (${of(s.people)} — ${arN(s.lines, 'سطر واحد', 'سطران', 'سطور', 'سطرًا')}):` : null;
  const blockers = s.blockers.slice(0, ECHO_LIMITS.blockersShow);
  const blockers_ar = blockers.length ? `أكثر ما عاقهم في التطبيق (${s.blockers_people}):` : null;
  const commits_ar = p.commits.authors >= k && p.commits.total ? `التزاماتهم: أوفوا بـ ${p.commits.done} من ${p.commits.total}.` : null;
  const crossedClean = p.crossed.map((x) => String(x || '').trim()).filter((x) => x && !hasDigit(x));
  const top = topOf(crossedClean);
  const crossed_ar = p.sealed >= k && top ? `كتب ${arN(crossedClean.length, 'واحد', 'اثنان', 'منهم', 'منهم')} عن عبورهم بكلماتهم — أكثرها: «${top.text}».` : null;
  const shown = s.shown || p.sealed >= k;
  const silent_ar = shown ? null : `حين يكتمل خمسةٌ ممّن كتبوا أو ختموا يظهر صدى المستوى ${p.prev_level_no} هنا — بلا أسماء.`;
  return { title_ar: `🔁 ${ECHO_NAMES_AR.narrative} — المستوى ${p.prev_level_no}`, phase: p.phase, prev_level_no: p.prev_level_no, level_no: p.level_no, roster: p.roster, people: s.people, k, shown, sealed_ar, lines: s.applied, lines_ar, blockers, blockers_ar, commits_ar, crossed_ar, word: p.word, can_write: p.can_write, silent_ar };
}
export const echoWordTitleAr = (trainerName: string | null | undefined, levelNo: number) => `🔁 ${ECHO_NAMES_AR.word} من أستاذك${trainerName ? ` ${trainerName}` : ''} — المستوى ${levelNo}`;
/** المفتاح يحمل الأستاذ أيضًا كي تعمل ردود P53 (parseWordNotice) وتصل لمساته إلى دفتر اليوم */
export const echoDedupeKey = (classroomId: string, levelNo: number, trainerId: string, email: string) => `echo_word:${classroomId}:${levelNo}:${trainerId}:${email}`;
export const echoDedupePrefix = (classroomId: string, levelNo: number) => `echo_word:${classroomId}:${levelNo}:`;
export const echoReachAr = (w: EchoWord): string => { const parts = [`وصلت كلمة العبور إلى ${w.sent}`]; if (w.reach.replies) parts.push(`ردّ ${w.reach.replies}`); for (const [c, n] of Object.entries(w.reach.chips)) if (n) parts.push(`${c} ${n}`); return parts.join(' · '); };

/* ───────── الغراء ───────── */
export type EchoCtx = { program_id: string; classroom_id: string; level_no: number; trainer_name?: string | null; can_write: boolean };
/** يُحسب عند الفتح — سطور الشعبة عبر مدى المستوى السابق كاملًا (حتى أول يوم في المستوى الحالي)، صفحات المستوى المختومة، التزاماتهم */
export async function instructorEcho(db: Db, ctx: EchoCtx, spans: LevelSpan[], today: string): Promise<InstructorEcho | null> {
  const ph = echoPhase(spans, ctx.level_no, today); if (ph.phase === 'none' || !ph.prev || !ph.cur) return null;
  const prev = ph.prev; const cur = ph.cur;
  const [roster, pages, lines, commits] = await Promise.all([
    safe<any[]>(db.from('portal_enrollments').select('id').eq('classroom_id', ctx.classroom_id).in('status', ENROLLED).limit(500), []),
    safe<any[]>(db.from('portal_level_pages').select('id,body').eq('classroom_id', ctx.classroom_id).eq('level_no', prev.level_no).not('sealed_at', 'is', null).is('revoked_at', null).limit(500), []),
    safe<any[]>(db.from('portal_learning_lines').select('user_id,body_ar,blocker_ar,day,kind').eq('classroom_id', ctx.classroom_id).in('kind', ['learn', 'apply']).gte('day', prev.from_day).lt('day', cur.from_day).limit(3000), []),
    safe<any[]>(db.from('portal_learning_lines').select('user_id,done').eq('classroom_id', ctx.classroom_id).eq('kind', 'commit').gte('day', prev.from_day).lt('day', cur.from_day).limit(1000), []),
  ]);
  const crossed = pages.map((r) => { const cards = arr<any>(r.body && (r.body as any).cards); const c = cards.find((x) => x && x.key === 'crossed'); return c ? String(c.text_ar || '') : ''; }).filter(Boolean);
  const word = await echoReach(db, ctx.classroom_id, cur.level_no);
  return buildInstructorEcho({ prev_level_no: prev.level_no, level_no: cur.level_no, roster: roster.length, sealed: pages.length, lines: lines.map((l) => ({ user_id: String(l.user_id), body_ar: String(l.body_ar || ''), blocker_ar: l.blocker_ar || null, day: String(l.day) })), commits: { authors: new Set(commits.map((c) => String(c.user_id))).size, total: commits.length, done: commits.filter((c) => c.done === 'yes').length }, crossed, seed: ctx.classroom_id, phase: ph.phase, word, can_write: ctx.can_write && ph.phase === 'week' });
}
/** «صدى الصدى»: كلمة العبور المرسلة لهذه الشعبة في هذا المستوى + الوصول واللمسات (أعداد فقط) */
export async function echoReach(db: Db, classroomId: string, levelNo: number): Promise<EchoWord | null> {
  const ns = await safe<any[]>(db.from('portal_learner_notices').select('id,body_ar,created_at,meta').eq('kind', 'trainer_word').like('dedupe_key', `${echoDedupePrefix(classroomId, levelNo)}%`).limit(500), []);
  if (!ns.length) return null;
  const ids = ns.map((n) => String(n.id)); const first = [...ns].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  const replies = await safe<any[]>(db.from('portal_word_replies').select('chip').in('notice_id', ids).limit(1000), []);
  const chips: Record<string, number> = {}; for (const r of replies) { const c = r.chip === 'got_it' ? '🌱' : r.chip === 'need_help' ? '✋' : r.chip === 'will_attend' ? '🕐' : null; if (c) chips[c] = (chips[c] || 0) + 1; }
  const v = first.meta && (first.meta as any).voice; const voice_sec = v && typeof v.sec === 'number' ? Number(v.sec) : null;
  return { text_ar: voice_sec && !String(first.body_ar || '').trim() ? null : String(first.body_ar || ''), voice_sec, at: String(first.created_at || ''), sent: ns.length, reach: { replies: replies.length, chips } };
}
/** للمشارك في «سطري»: كلمة العبور التي وصلته في مستواه الحالي (إن وُجدت) — له وحده */
export async function learnerEchoWord(db: Db, email: string, classroomId: string, levelNo: number): Promise<{ notice_id: string; title_ar: string; text_ar: string; voice_sec: number | null; at: string; level_no: number } | null> {
  const em = String(email || '').trim().toLowerCase();
  const rows = await safe<any[]>(db.from('portal_learner_notices').select('id,title_ar,body_ar,created_at,meta,dedupe_key').eq('email', em).eq('kind', 'trainer_word').like('dedupe_key', `${echoDedupePrefix(classroomId, levelNo)}%`).limit(10), []);
  const n = rows.filter((r) => String(r.dedupe_key || '').endsWith(`:${em}`)).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]; if (!n) return null; const v = n.meta && (n.meta as any).voice;
  return { notice_id: String(n.id), title_ar: String(n.title_ar || ''), text_ar: String(n.body_ar || ''), voice_sec: v && typeof v.sec === 'number' ? Number(v.sec) : null, at: String(n.created_at || ''), level_no: levelNo };
}
/* ───────── الاعتماد (P61 · 3.5) ───────── */
export const levelEvidenceLineAr = (n: number, levels: number): string | null => n < ECHO_LIMITS.k ? null : `${ECHO_NAMES_AR.evidence}: صفحات المستوى التي ختمها المشاركون بأيديهم ${n} (عبر ${arN(levels, 'مستوى واحد', 'مستويين', 'مستويات', 'مستوى')}) — عدد فقط، بلا محتوى.`;
export async function levelEvidence(db: Db, programId: string): Promise<Array<{ id: string; kind: 'level'; codes: string[]; label_ar: string; at: null; href: null; n: number }>> {
  const rows = await safe<any[]>(db.from('portal_level_pages').select('level_no').eq('program_id', programId).not('sealed_at', 'is', null).is('revoked_at', null).limit(2000), []);
  const line = levelEvidenceLineAr(rows.length, new Set(rows.map((r) => Number(r.level_no))).size); if (!line) return [];
  return [{ id: 'level:pages', kind: 'level', codes: ['3.5'], label_ar: line, at: null, href: null, n: rows.length }];
}
