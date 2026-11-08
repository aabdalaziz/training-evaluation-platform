// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P52 «رسالة الشهر» — التقرير الشهري لأثر الجهة (Monthly Organization Impact Letter)
 *  P57: قسم «نبض الشهر» (body.pulse — lib/org-impact/pulse.ts) يُحسب مع المسوَّدة ويتجمّد مع التوقيع.
 *  رسالة من صفحة واحدة تصل إلى مدير الجهة أول كل شهر: ثلاثة أرقام بكلمات (مع الفرق عن الشهر الماضي) · خيوط الشهر (k ≥ 5) ·
 *  «سطر الإنسان» يكتبه مدير البرامج ويوقّعه · «وعد الشهر القادم» · «ما نحتاجه منكم» · رمز وبصمة للتحقّق بلا محتوى.
 *  القاعدة: الأرقام تُصاغ آليًّا، والإنسان يكتب سطره ويوقّع — وبلا توقيع لا تُرسل. لا أسماء منسوبين أبدًا؛ ما دون خمسة يُكتب «أقلّ من خمسة».
 *  النقي أعلى الملف (قابل للاختبار بلا قاعدة) ثم الغراء (قاعدة البيانات) أسفله.
 */
import { createHash, randomBytes } from 'node:crypto';
import { jcs } from '../portal/vc';
import { K_ORG } from './registry';
import { orgPulse } from './pulse';
import type { OrgPulse } from './pulse';

export const LETTER_TITLE = { ar: 'رسالة الشهر', en: 'Monthly letter' };
export const LETTER_OFFICIAL = { ar: 'التقرير الشهري لأثر الجهة', en: 'Monthly Organization Impact Letter' };
export const DRAFT_DAY = 3;            /* تُنشأ المسوَّدات في اليوم الثالث من الشهر — حتى تستقرّ أرقام آخر أيامه */
export const LINE_MAX = 280;           /* «سطر الإنسان» */
export const REPLY_MAX = 280;          /* «ردّ الجهة» */
export const REMIND_DAYS = 7;          /* تذكير الموقِّعين مرّة واحدة */
export const MIN_MEMBERS = K_ORG;      /* لا رسالة لجهة دون خمسة منسوبين مؤكَّدين */
export const WRITER_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
export const PROMISES: { key: string; text_ar: string }[] = [
  { key: 'remedial', text_ar: 'جلسة تعويض لكل منسوب غاب جلستين متتاليتين.' },
  { key: 'practice', text_ar: 'خطّة مِران لكل من لم يجتز اختبار المستوى — خلال أسبوع من الحكم.' },
  { key: 'call', text_ar: 'اتصال من مدير البرنامج بكل منسوب توقّف عن الحضور ثلاثة أسابيع.' },
  { key: 'report', text_ar: 'تقرير تعلّم أسبوعي موقَّع لكل شعبة من شُعبكم.' },
  { key: 'visit', text_ar: 'زيارة أو لقاء افتراضي مع إدارة التدريب لديكم لمراجعة الربع.' },
];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const TZ_MS = 3 * 3600 * 1000; /* الرياض UTC+3 */

export type LetterStatus = 'draft' | 'signed';
export type LetterThread = { label_ar: string; people: number };
export type LetterBody = {
  v: 1; month: string; prev_month: string; month_ar: string; prev_month_ar: string;
  org: { id: string; name_ar: string };
  people: { members: number; pending: number; active: number | null; active_prev: number | null; active_raw: number };
  attendance: { pct: number | null; pct_prev: number | null; sessions: number; people: number };
  miaar: { exits_passed: number | null; placements: number | null; certificates: number | null };
  threads: LetterThread[];
  pulse?: OrgPulse | null;            /* P57 «نبض الشهر» — اختياري حتى تبقى رسائل ما قبله كما هي */
  lines_ar: string[];                 /* «ثلاثة أرقام تكفي» — ثلاث جُمَل */
  ask_suggested_ar: string | null;    /* «ما نحتاجه منكم» المقترَح */
  generated_at: string;
};
export type LetterRow = { id: string; organization_id: string; month: string; status: LetterStatus; body: LetterBody; line_ar: string | null; promise_ar: string | null; ask_ar: string | null; signed_by: string | null; signed_email: string | null; signed_name: string | null; signed_title: string | null; signed_at: string | null; code: string | null; digest: string | null; reply_ar: string | null; reply_by: string | null; reply_at: string | null; reply_seen_at: string | null; reminded_at: string | null; created_at: string; updated_at: string };

/* ============================ النقي ============================ */
const pad = (n: number) => String(n).padStart(2, '0');
/** شهر تاريخٍ ما بتوقيت الرياض: 'YYYY-MM' */
export function monthOf(d: Date): string { const r = new Date(d.getTime() + TZ_MS); return `${r.getUTCFullYear()}-${pad(r.getUTCMonth() + 1)}`; }
export function riyadhDay(d: Date): number { return new Date(d.getTime() + TZ_MS).getUTCDate(); }
export function prevMonth(m: string): string { const [y, mo] = m.split('-').map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${pad(mo - 1)}`; }
export function nextMonth(m: string): string { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${pad(mo + 1)}`; }
export const isMonth = (m: unknown): m is string => typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
/** حدود الشهر بتوقيت الرياض (ISO) + حدود التاريخ النصّي للجداول التي تخزّن 'YYYY-MM-DD' */
export function monthRange(m: string): { from: string; to: string; day_from: string; day_to: string } {
  const [y, mo] = m.split('-').map(Number); const from = new Date(Date.UTC(y, mo - 1, 1) - TZ_MS); const to = new Date(Date.UTC(y, mo, 1) - TZ_MS);
  return { from: from.toISOString(), to: to.toISOString(), day_from: `${m}-01`, day_to: `${nextMonth(m)}-01` };
}
export function monthLabelAr(m: string): string { const [y, mo] = m.split('-').map(Number); return `${MONTHS_AR[(mo - 1) % 12]} ${y}`; }
/** قاعدة الخصوصية: ما دون k لا يُذكر رقمًا */
export const kSafe = (n: number, k = K_ORG): number | null => (n >= k ? n : null);
/** عدد + اسم بتصريف عربي مبسَّط: 1 → «منسوب واحد» · 2 → «منسوبان» · 3–10 → «5 منسوبين» · 11+ → «42 منسوبًا» */
export function countAr(n: number, f: { one: string; two: string; few: string; many: string }): string {
  if (n === 1) return `${f.one} واحد`; if (n === 2) return f.two; if (n >= 3 && n <= 10) return `${n} ${f.few}`; return `${n} ${f.many}`;
}
const PERSON = { one: 'منسوب', two: 'منسوبان', few: 'منسوبين', many: 'منسوبًا' };
const SESSION = { one: 'جلسة', two: 'جلستين', few: 'جلسات', many: 'جلسة' }; /* مجرورة بعد «عبر» */
const EXAM = { one: 'اختبار', two: 'اختباران', few: 'اختبارات', many: 'اختبارًا' };
const CERT = { one: 'شهادة', two: 'شهادتان', few: 'شهادات', many: 'شهادة' };
/** الفرق عن الشهر الماضي بكلمات */
export function deltaAr(now: number | null, prev: number | null, prevLabel: string, unit = ''): string {
  if (now === null || prev === null) return ''; const d = now - prev; const u = unit ? ` ${unit}` : '';
  if (d > 0) return `، بزيادة ${d}${u} عن ${prevLabel}`; if (d < 0) return `، بنقص ${-d}${u} عن ${prevLabel}`; return `، كما في ${prevLabel}`;
}
/** «ثلاثة أرقام تكفي» — ثلاث جُمَل من الأرقام (بلا أسماء · ما دون خمسة يُقال صراحة) */
export function composeLines(b: Omit<LetterBody, 'lines_ar' | 'ask_suggested_ar' | 'generated_at' | 'v'>): string[] {
  const L: string[] = []; const pl = b.prev_month_ar;
  if (b.people.active === null) L.push(b.people.active_raw === 0 ? `لم يُسجَّل تعلّم لمنسوبيكم في ${b.month_ar} — نبدأ معكم من هنا.` : `أقلّ من خمسة منسوبين تعلّموا في ${b.month_ar} — نحفظ خصوصيتهم ونذكر العدد حين يبلغ خمسة.`);
  else L.push(`${countAr(b.people.active, PERSON)} تعلّموا في ${b.month_ar} (حضور أو مِران أو اختبار) من أصل ${b.people.members}${deltaAr(b.people.active, b.people.active_prev, pl)}.`);
  if (b.attendance.pct === null) L.push(b.attendance.sessions ? `عُقدت ${countAr(b.attendance.sessions, SESSION)} لمنسوبيكم، والحضور يُذكر رقمًا حين يبلغ المسجَّلون خمسة.` : `لم تُعقد جلسات حضور مسجَّلة لمنسوبيكم هذا الشهر.`);
  else L.push(`حضور الجلسات ${b.attendance.pct}% عبر ${countAr(b.attendance.sessions, SESSION)}${b.attendance.pct_prev !== null ? ` (كان ${b.attendance.pct_prev}% في ${pl})` : ''}.`);
  const parts: string[] = []; const m = b.miaar;
  if (m.exits_passed !== null) parts.push(`اجتاز ${countAr(m.exits_passed, PERSON)} اختبار المستوى`); if (m.placements !== null) parts.push(`أدّى ${countAr(m.placements, PERSON)} اختبار تحديد المستوى`); if (m.certificates !== null) parts.push(`صدرت ${countAr(m.certificates, CERT)}`);
  L.push(parts.length ? `${parts.join('، و')}.` : 'الاختبارات والشهادات هذا الشهر دون خمسة — نحفظ الخصوصية ونذكرها حين تبلغ العدد.');
  return L;
}
/** «ما نحتاجه منكم» — طلب واحد مقترَح من الواقع */
export function suggestAsk(b: { people: { members: number; pending: number; active_raw: number }; pulse?: OrgPulse | null }): string | null {
  if (b.people.pending > 0) { const n = b.people.pending; const v = n === 1 ? 'ينتظر' : n === 2 ? 'ينتظران' : 'ينتظرون'; const h = n === 1 ? 'تأكيده يفتح له' : n === 2 ? 'تأكيدهما يفتح لهما' : 'تأكيدهم يفتح لهم'; return `${countAr(n, PERSON)} من نطاق بريدكم ${v} تأكيدكم في بوابة الجهات — ${h} التعلّم.`; }
  if (b.people.members >= MIN_MEMBERS && b.people.active_raw < b.people.members / 2) return 'كلمة من إدارتكم لمنسوبيكم عن أهمّية الحضور — نصف المقيَّدين لم يتعلّموا هذا الشهر.';
  if (b.pulse?.ask_ar) return b.pulse.ask_ar; /* P57: ردّ دون 30٪ على كلمات المدرّبين */
  return null;
}
/** تنقية نصّ بشري قصير: لا وسوم ولا روابط ولا بريد — ولا أسماء نضمنها بالقاعدة لا بالآلة */
export function cleanLine(v: unknown, max = LINE_MAX): string { return String(v ?? '').replace(/<[^>]*>/g, '').replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, max); }
export function letterCode(): string { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(8); const s = Array.from(b).map((x) => A[x % A.length]).join(''); return `ATH-ML-${s.slice(0, 4)}-${s.slice(4, 8)}`; }
/** الوثيقة المجمَّدة التي تُحسب منها البصمة — بلا معرّفات داخلية */
export function frozenDoc(l: { organization_id: string; month: string; body: LetterBody; line_ar: string | null; promise_ar: string | null; ask_ar: string | null; signed_name: string | null; signed_title: string | null; signed_at: string | null; code: string | null }) {
  return { v: 1, type: LETTER_OFFICIAL.en, org: l.body.org.name_ar, org_id: l.organization_id, month: l.month, body: l.body, line_ar: l.line_ar, promise_ar: l.promise_ar, ask_ar: l.ask_ar, signed_name: l.signed_name, signed_title: l.signed_title, signed_at: l.signed_at, code: l.code };
}
export const digestOf = (doc: unknown): string => createHash('sha256').update(jcs(doc)).digest('hex');
/** نصّ إشعار الجهة */
export function orgNoticeText(month: string, orgName: string): { title_ar: string; body_ar: string; url: string } {
  return { title_ar: `وصلت رسالة شهر ${monthLabelAr(month)} من أَثَر`, body_ar: `${orgName}: ثلاثة أرقام، خيوط الشهر، سطر موقَّع، ووعد للشهر القادم — افتحوها من بوابة الجهات.`, url: '/org?tab=letters' };
}

/* ============================ الغراء ============================ */
type Db = any;
const arr = <T = any>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const chunk = <T,>(a: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };
async function safe<T>(p: Promise<T>, fb: T): Promise<T> { try { return await p; } catch { return fb; } }

async function monthStats(db: Db, members: Set<string>, month: string) { return rangeStats(db, members, monthRange(month)); }
/** P68: الإحصاء نفسه لأي مدى (تقرير القيادة يقرأ ربعًا أو فصلًا) — r.from/to بتوقيت ISO وr.day_from/day_to أيام */
export async function rangeStats(db: Db, members: Set<string>, r: { from: string; to: string; day_from: string; day_to: string }) {
  const mem = [...members];
  /* جلسات الحضور في الشهر + سجلاتها لمنسوبينا */
  const { data: ses } = await db.from('attendance_sessions').select('id, classroom_id').gte('session_date', r.day_from).lt('session_date', r.day_to).limit(2000);
  const sessions = arr(ses); const sids = sessions.map((s) => String(s.id)); const recs: any[] = [];
  for (const part of chunk(sids, 100)) { const { data } = await db.from('attendance_records').select('session_id, email, status').in('session_id', part).in('status', ['present', 'late']).limit(5000); recs.push(...arr(data)); }
  const attended = recs.filter((x) => members.has(lower(x.email)));
  /* الروستر: المقيَّدون المعتمدون في شُعب تلك الجلسات ∩ منسوبينا — وإن خلت الشعبة من قيود فمن سُجّل حضوره فيها */
  const cids = [...new Set(sessions.map((s) => String(s.classroom_id || '')).filter(Boolean))]; const roster = new Map<string, Set<string>>();
  for (const part of chunk(cids, 100)) { const { data } = await db.from('portal_enrollments').select('classroom_id, email').in('classroom_id', part).eq('status', 'approved').limit(5000); for (const e of arr(data)) { const em = lower(e.email); if (!members.has(em)) continue; const k = String(e.classroom_id); if (!roster.has(k)) roster.set(k, new Set()); roster.get(k)!.add(em); } }
  const byCls = new Map<string, Set<string>>(); for (const s of sessions) { const k = String(s.classroom_id || ''); if (!byCls.has(k)) byCls.set(k, new Set()); }
  for (const a of attended) { const s = sessions.find((x) => String(x.id) === String(a.session_id)); const k = String(s?.classroom_id || ''); byCls.get(k)?.add(lower(a.email)); }
  let expected = 0; let present = 0; const rosterPeople = new Set<string>();
  for (const s of sessions) { const k = String(s.classroom_id || ''); const ro = (roster.get(k)?.size ? roster.get(k) : byCls.get(k)) || new Set<string>(); expected += ro.size; ro.forEach((e) => rosterPeople.add(e)); present += attended.filter((a) => String(a.session_id) === String(s.id) && ro.has(lower(a.email))).length; }
  /* مِران + مِعيار + شهادات */
  const practice: string[] = []; const reports: any[] = []; const creds: string[] = [];
  for (const part of chunk(mem)) {
    const [{ data: pa }, { data: pr }, { data: cr }] = await Promise.all([
      db.from('miaar_practice_attempts').select('email').in('email', part).gte('created_at', r.from).lt('created_at', r.to).limit(5000),
      db.from('placement_reports').select('candidate_email, report, created_at').in('candidate_email', part).gte('created_at', r.from).lt('created_at', r.to).is('archived_at', null).limit(2000),
      db.from('portal_credentials').select('email').in('email', part).gte('issued_at', r.from).lt('issued_at', r.to).is('revoked_at', null).limit(2000),
    ]);
    practice.push(...arr(pa).map((x) => lower(x.email))); reports.push(...arr(pr)); creds.push(...arr(cr).map((x) => lower(x.email)));
  }
  const exits = reports.filter((x) => x.report?.exit); const exitsPassed = exits.filter((x) => x.report.exit['الحالة'] === 'final' && x.report.exit['النتيجة'] === 'passed').length; const placements = reports.length - exits.length;
  const active = new Set<string>([...attended.map((a) => lower(a.email)), ...practice, ...reports.map((x) => lower(x.candidate_email))]);
  return { active: active.size, sessions: sessions.length, pct: expected && rosterPeople.size >= K_ORG ? Math.round((present / expected) * 100) : null, roster_people: rosterPeople.size, exits_passed: exitsPassed, placements, certificates: creds.length };
}

/** بناء جسد الرسالة لجهة وشهر — بلا أسماء، بقاعدة k ≥ 5 */
export async function buildLetterBody(db: Db, org: { id: string; name_ar: string }, month: string): Promise<LetterBody> {
  const { data: mem } = await db.from('portal_org_members').select('email, status').eq('organization_id', org.id).in('status', ['confirmed', 'pending']).limit(5000);
  const members = new Set<string>(arr(mem).filter((m) => m.status === 'confirmed').map((m) => lower(m.email)).filter(Boolean)); const pending = arr(mem).filter((m) => m.status === 'pending').length;
  const pm = prevMonth(month); const [cur, prev, pulse] = await Promise.all([monthStats(db, members, month), safe(monthStats(db, members, pm), null as any), safe(orgPulse(db, members, monthRange(month)), null as OrgPulse | null)]);
  let threads: LetterThread[] = [];
  try { const { orgEcho } = await import('./echo'); const e = await orgEcho(db, org.id, new Date(monthRange(month).to).getTime() - 1); threads = (e.threads || []).slice(0, 3).map((t: any) => ({ label_ar: String(t.label_ar), people: Number(t.people) || 0 })); } catch { threads = []; }
  const base = { month, prev_month: pm, month_ar: monthLabelAr(month), prev_month_ar: monthLabelAr(pm), org: { id: org.id, name_ar: org.name_ar },
    people: { members: members.size, pending, active: kSafe(cur.active), active_prev: prev ? kSafe(prev.active) : null, active_raw: cur.active },
    attendance: { pct: cur.pct, pct_prev: prev?.pct ?? null, sessions: cur.sessions, people: cur.roster_people },
    miaar: { exits_passed: kSafe(cur.exits_passed), placements: kSafe(cur.placements), certificates: kSafe(cur.certificates) }, threads, pulse };
  return { v: 1, ...base, lines_ar: composeLines(base), ask_suggested_ar: suggestAsk(base), generated_at: new Date().toISOString() };
}

/** الجهات المؤهَّلة: ≥ 5 منسوبين مؤكَّدين */
export async function eligibleOrgs(db: Db): Promise<{ id: string; name_ar: string; members: number }[]> {
  const { data: orgs } = await db.from('portal_organizations').select('id, name_ar').limit(500); const { data: mem } = await db.from('portal_org_members').select('organization_id').eq('status', 'confirmed').limit(20000);
  const n = new Map<string, number>(); for (const m of arr(mem)) { const k = String(m.organization_id); n.set(k, (n.get(k) || 0) + 1); }
  return arr(orgs).map((o) => ({ id: String(o.id), name_ar: String(o.name_ar || ''), members: n.get(String(o.id)) || 0 })).filter((o) => o.members >= MIN_MEMBERS);
}

/** إنشاء/تحديث مسوَّدة لجهة وشهر (لا تمسّ الموقَّعة) */
export async function ensureDraft(db: Db, org: { id: string; name_ar: string }, month: string, opts: { force?: boolean } = {}): Promise<{ row: LetterRow | null; created: boolean; reason?: string }> {
  const { data: ex } = await db.from('portal_org_letters').select('*').eq('organization_id', org.id).eq('month', month).maybeSingle();
  if (ex && ex.status === 'signed') return { row: ex as LetterRow, created: false, reason: 'signed' };
  if (ex && !opts.force) return { row: ex as LetterRow, created: false, reason: 'exists' };
  const body = await buildLetterBody(db, org, month); const now = new Date().toISOString();
  if (ex) { const { data } = await db.from('portal_org_letters').update({ body, updated_at: now }).eq('id', ex.id).select('*').single(); return { row: (data as LetterRow) || null, created: false, reason: 'refreshed' }; }
  const { data, error } = await db.from('portal_org_letters').insert({ organization_id: org.id, month, status: 'draft', body }).select('*').single(); if (error) throw new Error(error.message);
  return { row: data as LetterRow, created: true };
}

async function writerEmails(db: Db): Promise<{ id: string; email: string }[]> { const { data } = await db.from('profiles').select('id, email, role').in('role', WRITER_ROLES).limit(100); return arr(data).filter((p) => p.email).map((p) => ({ id: String(p.id), email: lower(p.email) })); }

/** الكرون اليومي: من اليوم الثالث من الشهر — مسوَّدة لكل جهة مؤهَّلة عن الشهر المنصرم · تذكير الموقِّعين بعد 7 أيام (مرّة) */
export async function runOrgLetters(db: Db, opts: { site?: string; dry?: boolean; now?: Date } = {}): Promise<{ month: string; due: boolean; orgs: number; created: number; reminded: number; errors: string[] }> {
  const now = opts.now || new Date(); const month = prevMonth(monthOf(now)); const s = { month, due: riyadhDay(now) >= DRAFT_DAY, orgs: 0, created: 0, reminded: 0, errors: [] as string[] };
  try {
    if (s.due) { const orgs = await eligibleOrgs(db); s.orgs = orgs.length;
      for (const o of orgs) { try { if (opts.dry) { const { data: ex } = await db.from('portal_org_letters').select('id').eq('organization_id', o.id).eq('month', month).maybeSingle(); if (!ex) s.created += 1; continue; } const r = await ensureDraft(db, o, month); if (r.created) s.created += 1; } catch (e: any) { s.errors.push(`${o.id}: ${e?.message || e}`); } } }
    /* تذكير: مسوَّدات عمرها ≥ 7 أيام بلا تذكير */
    const cut = new Date(now.getTime() - REMIND_DAYS * 86400000).toISOString();
    const { data: old } = await db.from('portal_org_letters').select('id, month, organization_id, created_at').eq('status', 'draft').is('reminded_at', null).lte('created_at', cut).limit(50);
    const stale = arr(old); if (stale.length) { const { pushNotice } = await import('../portal/notices'); const writers = await writerEmails(db); const day = now.toISOString().slice(0, 10);
      for (const w of writers) { const r = await pushNotice(db, { email: w.email, user_id: w.id, report_id: null, kind: 'org_letter_due', title_ar: `${countAr(stale.length, { one: 'رسالة شهر', two: 'رسالتا شهر', few: 'رسائل شهر', many: 'رسالة شهر' })} تنتظر سطرك وتوقيعك منذ أسبوع`, body_ar: 'الجهات تنتظر رسالتها — سطر واحد منك وتوقيع، ثم تصل.', url: '/admin/org/letters', ref_id: null, dedupe_key: `org_letter_due:${w.email}:${day}`, push: false }, { dry: !!opts.dry }); if (r.inserted) s.reminded += 1; }
      if (!opts.dry) await db.from('portal_org_letters').update({ reminded_at: now.toISOString() }).in('id', stale.map((x) => x.id)); }
  } catch (e: any) { s.errors.push(String(e?.message || e)); }
  return s;
}

/** التوقيع: يكتب الإنسان سطره، نجمّد، نحسب الرمز والبصمة، ونُخبر مديري الجهة */
export async function signLetter(db: Db, id: string, who: { id: string; email: string; name: string }, input: { line_ar?: unknown; promise_ar?: unknown; ask_ar?: unknown; signed_title?: unknown }, opts: { now?: Date; dry?: boolean } = {}): Promise<{ row: LetterRow; notified: number } | { error: string; status: number }> {
  const { data: ex } = await db.from('portal_org_letters').select('*').eq('id', id).maybeSingle(); if (!ex) return { error: 'الرسالة غير موجودة', status: 404 }; if (ex.status === 'signed') return { error: 'الرسالة موقَّعة من قبل ولا تُعدَّل', status: 409 };
  const line = cleanLine(input.line_ar); if (line.length < 10) return { error: 'اكتب «سطر الإنسان» (10 أحرف على الأقل) — بلا سطر لا تُرسل الرسالة', status: 400 };
  const promise = cleanLine(input.promise_ar, 200); if (!promise) return { error: 'اختر «وعد الشهر القادم» أو اكتبه', status: 400 };
  const ask = cleanLine(input.ask_ar, 200) || null; const title = cleanLine(input.signed_title, 80) || 'مدير البرامج'; const now = (opts.now || new Date()).toISOString();
  let code = letterCode(); for (let i = 0; i < 3; i++) { const { data: dup } = await db.from('portal_org_letters').select('id').eq('code', code).maybeSingle(); if (!dup) break; code = letterCode(); }
  const frozen = { organization_id: String(ex.organization_id), month: String(ex.month), body: ex.body as LetterBody, line_ar: line, promise_ar: promise, ask_ar: ask, signed_name: who.name || who.email, signed_title: title, signed_at: now, code };
  const digest = digestOf(frozenDoc(frozen));
  if (opts.dry) return { row: { ...ex, ...frozen, status: 'signed', digest } as LetterRow, notified: 0 };
  const { data: row, error } = await db.from('portal_org_letters').update({ status: 'signed', line_ar: line, promise_ar: promise, ask_ar: ask, signed_by: who.id, signed_email: who.email, signed_name: frozen.signed_name, signed_title: title, signed_at: now, code, digest, updated_at: now }).eq('id', id).eq('status', 'draft').select('*').single();
  if (error || !row) return { error: error?.message || 'تعذّر التوقيع', status: 500 };
  const { pushNotice } = await import('../portal/notices'); const t = orgNoticeText(String(ex.month), (ex.body as LetterBody)?.org?.name_ar || '');
  const { data: admins } = await db.from('portal_org_members').select('email, user_id').eq('organization_id', ex.organization_id).eq('role', 'org_admin').eq('status', 'confirmed').limit(50); let notified = 0;
  for (const a of arr(admins)) { try { const r = await pushNotice(db, { email: lower(a.email), user_id: a.user_id || null, report_id: null, kind: 'org_letter', ...t, ref_id: String(row.id), dedupe_key: `org_letter:${row.id}:${lower(a.email)}`, push: true }, {}); if (r.inserted) notified += 1; } catch { /* تجاهل */ } }
  return { row: row as LetterRow, notified };
}

/** «ردّ الجهة» — سطر واحد يصل إلى الموقِّع */
export async function replyLetter(db: Db, id: string, who: { email: string; name?: string }, text: unknown, opts: { now?: Date } = {}): Promise<{ row: LetterRow } | { error: string; status: number }> {
  const { data: ex } = await db.from('portal_org_letters').select('*').eq('id', id).maybeSingle(); if (!ex) return { error: 'الرسالة غير موجودة', status: 404 }; if (ex.status !== 'signed') return { error: 'لا ردّ على مسوَّدة', status: 409 };
  const reply = cleanLine(text, REPLY_MAX); if (reply.length < 2) return { error: 'اكتب ردًّا', status: 400 }; const now = (opts.now || new Date()).toISOString();
  const { data: row, error } = await db.from('portal_org_letters').update({ reply_ar: reply, reply_by: who.name || who.email, reply_at: now, reply_seen_at: null, updated_at: now }).eq('id', id).select('*').single(); if (error || !row) return { error: error?.message || 'تعذّر الحفظ', status: 500 };
  if (ex.signed_email) { try { const { pushNotice } = await import('../portal/notices'); await pushNotice(db, { email: lower(ex.signed_email), user_id: ex.signed_by || null, report_id: null, kind: 'org_letter_reply', title_ar: `ردّت ${(ex.body as LetterBody)?.org?.name_ar || 'الجهة'} على رسالة ${monthLabelAr(String(ex.month))}`, body_ar: reply.slice(0, 140), url: `/admin/org/letters?id=${encodeURIComponent(String(id))}`, ref_id: String(id), dedupe_key: `org_letter_reply:${id}:${now}`, push: true }, {}); } catch { /* تجاهل */ } }
  return { row: row as LetterRow };
}

/** التحقّق العام بالرمز: صحّة التوقيع والبصمة والتاريخ — بلا محتوى */
export async function verifyLetter(db: Db, code: string): Promise<{ valid: boolean; org_name?: string; month?: string; month_ar?: string; signed_at?: string; signed_title?: string; digest?: string; intact?: boolean }> {
  const c = String(code || '').trim().toUpperCase(); if (!/^ATH-ML-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c)) return { valid: false };
  const { data: l } = await db.from('portal_org_letters').select('*').eq('code', c).eq('status', 'signed').maybeSingle(); if (!l) return { valid: false };
  const recomputed = digestOf(frozenDoc({ organization_id: String(l.organization_id), month: String(l.month), body: l.body, line_ar: l.line_ar, promise_ar: l.promise_ar, ask_ar: l.ask_ar, signed_name: l.signed_name, signed_title: l.signed_title, signed_at: l.signed_at, code: l.code }));
  return { valid: true, org_name: (l.body as LetterBody)?.org?.name_ar, month: String(l.month), month_ar: monthLabelAr(String(l.month)), signed_at: l.signed_at, signed_title: l.signed_title, digest: String(l.digest || ''), intact: recomputed === l.digest };
}

/** عدد المسوَّدات (لمجموعة «توقيعي») */
export async function draftCount(db: Db): Promise<{ count: number; oldest_at: string | null }> { const { data } = await db.from('portal_org_letters').select('created_at').eq('status', 'draft').order('created_at', { ascending: true }).limit(200); const a = arr(data); return { count: a.length, oldest_at: a[0]?.created_at || null }; }
