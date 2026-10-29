// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «أثر الجهة» (P24) — الثوابت والأنواع والدوال النقية (بلا شبكة)
 *  المبدأ الحاكم: لا لوحة جديدة ولا تقرير جديد — ما تراه الجهة من مجالسها ومنسوبيها بلا كسر السرية:
 *   أ) «صدى الجهة»: خيوط مجهولة (k ≥ 5 أشخاص) + «إحاطة 90 ثانية» + «مرآة الجهة» (تقارن الجهة بذاتها فقط، لا بغيرها أبدًا)
 *   ب) «دفعة العودة» في عقود الأثر — محرّكها في lib/portal/contracts.ts (المفتاح return)
 *   ج) «مقاعد الجهة»: طلب جماعي → متقدمون لدى المُوفِّق (لا مجلس من جهة واحدة أبدًا → توأمة) + اعتماد شهادات الأقران مركزيًا من /org
 *   د) «ميثاق الجهة»: تعهّد سنوي موقَّع Ed25519 (وثيقة قابلة للتحقق من /verify/vc) وشارة عامة في /councils
 */
import { THEMES_AR, themeLabel, lower } from '../councils/registry';

export const K_ORG = 5;                  // لا خيط من أقل من 5 أشخاص — دائمًا، حتى للجهات الصغيرة (ترى «لم يكتمل النصاب» بصدق)
export const ECHO_DAYS = 28;             // نافذة الصدى (أربعة أسابيع — «ما يصارعه منسوبوكم الآن»)
export const MIRROR_DAYS = 90;           // ربع للمقارنة بالذات
export const ECHO_THREADS = 3;           // ثلاثة خيوط فقط
export const BRIEF_SECONDS = 90;
export const ORG_CHARTER_VERSION = '2026-10';
export const ORG_CHARTER_MONTHS = 12;    // سنوي — يُجدَّد بتوقيع جديد
export const SEATS_MIN = 2; export const SEATS_MAX = 40;
export const CHARTER_CODE_PREFIX = 'ATH-OC';

/** بنود ميثاق الجهة — ما تتعهد به الجهة (لا الفرد) تجاه منسوبيها في مجالس أَثَر */
export const ORG_CHARTER_AR: { id: string; title: string; body: string }[] = [
  { id: 'time', title: 'نمنح وقتًا', body: 'نعدّ مشاركة منسوبينا في مجالس أَثَر عملًا لا تطوعًا خارج الدوام: ساعة أسبوعيًا على الأقل في أثناء الدورة، ولا تُحتسب غيابًا.' },
  { id: 'confidentiality', title: 'نحترم السرية', body: 'ما يُقال في المجلس يبقى فيه. لا نسأل منسوبينا عمّا قيل، ولا نطلب محاضر، ولا نحاول معرفة من قال ماذا (قاعدة تشاتام هاوس).' },
  { id: 'no_appraisal', title: 'لا نستعمل المرآة ولا المداولات في التقييم الوظيفي', body: 'مرآة المجلس، وعدد الأسئلة والنصائح، والعودات، وشهادات الأقران — أدوات تعلّم لصاحبها، ولا تدخل في تقييم الأداء أو الترقية أو الجزاء بأي صورة.' },
  { id: 'no_names', title: 'لا نطلب أسماء', body: 'نكتفي بما يصلنا من «صدى الجهة» مجهولًا (خمسة أشخاص فأكثر)، ولا نطلب من أَثَر ولا من المنسوبين كشف هوية صاحب قضية أو رأي.' },
];

export type OrgCharterStatus = 'active' | 'revoked' | 'expired';
export type OrgCharter = { id: string; created_at: string; organization_id: string; version: string; clauses: { id: string; title: string }[]; signer_user_id: string | null; signer_email: string; signer_name: string | null; signer_title: string | null; signed_at: string; expires_at: string; status: OrgCharterStatus; revoked_at: string | null; revoked_by: string | null; vc_code: string | null; vc_issuance_id: string | null; meta?: Record<string, any> };
export const ORG_CHARTER_COLS = 'id,created_at,organization_id,version,clauses,signer_user_id,signer_email,signer_name,signer_title,signed_at,expires_at,status,revoked_at,revoked_by,vc_code,vc_issuance_id,meta';
export type SeatRequestStatus = 'pending' | 'matched' | 'closed';
export type SeatRequest = { id: number; created_at: string; organization_id: string; requested_by: string | null; requested_email: string; topic: string; domain: string | null; seats: number; people: { email: string; full_name?: string | null }[]; note: string | null; status: SeatRequestStatus; matched_council_id: string | null; meta?: Record<string, any> };
export const SEAT_COLS = 'id,created_at,organization_id,requested_by,requested_email,topic,domain,seats,people,note,status,matched_council_id,meta';
export const SEAT_STATUS_AR: Record<SeatRequestStatus, string> = { pending: 'لدى المُوفِّق', matched: 'جرت التوأمة', closed: 'مغلق' };

// ---------- الصدى: مدخلات مجهولة (بلا نصوص قضايا) ----------
export type EchoCase = { id: string; author_email: string; created_at: string; theme: string | null; status: string; committed_at: string | null; return_due_at: string | null; returned_at: string | null; return_outcome: string | null };
export type EchoPost = { case_id: string; email: string; kind: string; created_at: string };
export type EchoScribe = { case_id: string; pivotal_questions: string[]; unsaid_ar: string | null; patterns: string[] };
export type EchoAttestation = { to_email: string; status: string; created_at: string; decided_at: string | null };
export type EchoInput = { members: string[]; cases: EchoCase[]; posts: EchoPost[]; scribes: EchoScribe[]; attestations: EchoAttestation[]; daily_people?: number; daily_people_prev?: number };
export type EchoThread = { theme: string; label_ar: string; people: number; cases: number; questions: number; advice: number; returns: number; pivotal_question: string | null; unsaid: string | null };
export type MirrorStat = { key: 'active' | 'ask_ratio' | 'returns_on_time' | 'attestations' | 'daily'; label_ar: string; now: number; prev: number | null; unit: '%' | 'n'; delta: number | null; read_ar: string };
export type OrgEcho = { window_days: number; k: number; people_total: number; people_active: number; threads: EchoThread[]; below_k: { theme: string; label_ar: string; people: number }[]; quorum_ok: boolean; mirror: MirrorStat[]; privacy_ar: string[]; generated_at: string };

const inWin = (iso: string | null | undefined, from: number, to: number) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= from && t < to; };

/** خيوط الصدى: لكل موضوع، مَن من منسوبي الجهة لمسه (صاحب قضية أو متداول) خلال النافذة — يظهر فقط إن بلغ k */
export function buildThreads(inp: EchoInput, now = Date.now(), k = K_ORG, days = ECHO_DAYS): { threads: EchoThread[]; below: { theme: string; label_ar: string; people: number }[] } {
  const from = now - days * 864e5; const mem = new Set(inp.members.map(lower));
  const cases = inp.cases.filter(c => inWin(c.created_at, from, now + 864e5) || inWin(c.returned_at, from, now + 864e5));
  const byTheme = new Map<string, { people: Set<string>; cases: Set<string>; questions: number; advice: number; returns: number; pivotal: string[]; unsaid: string[] }>();
  const get = (t: string) => { let x = byTheme.get(t); if (!x) { x = { people: new Set(), cases: new Set(), questions: 0, advice: 0, returns: 0, pivotal: [], unsaid: [] }; byTheme.set(t, x); } return x; };
  const caseTheme = new Map<string, string>();
  for (const c of cases) { const th = c.theme || 'other'; caseTheme.set(c.id, th); const x = get(th); if (mem.has(lower(c.author_email))) { x.people.add(lower(c.author_email)); x.cases.add(c.id); if (c.returned_at) x.returns++; } }
  for (const p of inp.posts) { const th = caseTheme.get(p.case_id); if (!th || !mem.has(lower(p.email)) || !inWin(p.created_at, from, now + 864e5)) continue; const x = get(th); x.people.add(lower(p.email)); if (p.kind === 'question') x.questions++; else if (p.kind === 'advice') x.advice++; }
  for (const s of inp.scribes) { const th = caseTheme.get(s.case_id); if (!th) continue; const x = get(th); for (const q of s.pivotal_questions || []) if (q && q.length <= 220) x.pivotal.push(q); if (s.unsaid_ar) x.unsaid.push(s.unsaid_ar); }
  const all = Array.from(byTheme.entries()).filter(([t]) => t !== 'other' || byTheme.size === 1).map(([theme, x]) => ({ theme, label_ar: theme === 'other' ? 'مواقف متفرقة' : themeLabel(theme), people: x.people.size, cases: x.cases.size, questions: x.questions, advice: x.advice, returns: x.returns, pivotal_question: x.pivotal[0] || null, unsaid: x.unsaid[0] || null }));
  all.sort((a, b) => b.people - a.people || b.cases - a.cases);
  const threads = all.filter(t => t.people >= k).slice(0, ECHO_THREADS);
  const below = all.filter(t => t.people < k && t.people > 0).map(t => ({ theme: t.theme, label_ar: t.label_ar, people: t.people }));
  return { threads, below };
}

/** مرآة الجهة — تقارن الجهة بذاتها (الربع السابق) ولا تقارن بجهة أخرى أبدًا */
export function buildMirror(inp: EchoInput, now = Date.now(), days = MIRROR_DAYS): MirrorStat[] {
  const mem = new Set(inp.members.map(lower)); const cur = [now - days * 864e5, now + 864e5] as const; const prev = [now - 2 * days * 864e5, now - days * 864e5] as const;
  const period = (w: readonly [number, number]) => {
    const posts = inp.posts.filter(p => mem.has(lower(p.email)) && inWin(p.created_at, w[0], w[1])); const cases = inp.cases.filter(c => mem.has(lower(c.author_email)) && inWin(c.created_at, w[0], w[1]));
    const active = new Set([...posts.map(p => lower(p.email)), ...cases.map(c => lower(c.author_email))]).size;
    const q = posts.filter(p => p.kind === 'question').length, a = posts.filter(p => p.kind === 'advice').length;
    const returned = inp.cases.filter(c => mem.has(lower(c.author_email)) && inWin(c.returned_at, w[0], w[1])); const onTime = returned.filter(c => !c.return_due_at || new Date(c.returned_at!).getTime() <= new Date(c.return_due_at).getTime() + 864e5).length;
    const atts = inp.attestations.filter(x => mem.has(lower(x.to_email)) && x.status === 'approved' && inWin(x.decided_at || x.created_at, w[0], w[1])).length;
    return { active, ask: q + a ? Math.round((q / (q + a)) * 100) : null, onTime: returned.length ? Math.round((onTime / returned.length) * 100) : null, returned: returned.length, atts };
  };
  const c = period(cur), p = period(prev);
  const d = (a: number | null, b: number | null) => a === null || b === null ? null : a - b;
  const read = (key: MirrorStat['key'], nowV: number | null, delta: number | null): string => {
    if (nowV === null) return 'لا بيانات كافية بعد في هذا الربع.';
    if (delta === null) return 'أول ربع يُقاس — المقارنة تبدأ الربع القادم.';
    const dir = delta > 0 ? 'أعلى' : delta < 0 ? 'أدنى' : 'مثل';
    if (key === 'ask_ratio') return delta >= 0 ? `منسوبوكم يسألون قبل أن ينصحوا ${dir === 'مثل' ? 'بالنسبة نفسها' : `بنسبة ${dir} من الربع السابق`} — هذا ما يصنع مجلسًا.` : 'مالوا إلى النصيحة قبل السؤال أكثر من الربع السابق — المرآة تُعرض لهم لا لكم.';
    if (key === 'returns_on_time') return delta >= 0 ? 'العودة في موعدها ثابتة أو تتحسّن — العودة أثمن لحظة تعلّم.' : 'تأخّرت بعض العودات عن موعدها — وقت المجلس داخل الدوام (بند الميثاق الأول) يعالج هذا غالبًا.';
    return `${dir === 'مثل' ? 'مثل الربع السابق' : `${dir} من الربع السابق بـ${Math.abs(delta)}`}.`;
  };
  const out: MirrorStat[] = [
    { key: 'active', label_ar: 'منسوبون فاعلون في المجالس', now: c.active, prev: p.active, unit: 'n', delta: d(c.active, p.active), read_ar: read('active', c.active, d(c.active, p.active)) },
    { key: 'ask_ratio', label_ar: 'الأسئلة من مجموع المداخلات', now: c.ask ?? 0, prev: p.ask, unit: '%', delta: d(c.ask, p.ask), read_ar: read('ask_ratio', c.ask, d(c.ask, p.ask)) },
    { key: 'returns_on_time', label_ar: 'العودات في موعدها', now: c.onTime ?? 0, prev: p.onTime, unit: '%', delta: d(c.onTime, p.onTime), read_ar: read('returns_on_time', c.onTime, d(c.onTime, p.onTime)) },
    { key: 'attestations', label_ar: 'شهادات أقران معتمدة', now: c.atts, prev: p.atts, unit: 'n', delta: d(c.atts, p.atts), read_ar: read('attestations', c.atts, d(c.atts, p.atts)) },
  ];
  if (inp.daily_people !== undefined) out.push({ key: 'daily', label_ar: 'واجهوا «موقف اليوم»', now: inp.daily_people, prev: inp.daily_people_prev ?? null, unit: 'n', delta: d(inp.daily_people, inp.daily_people_prev ?? null), read_ar: read('daily', inp.daily_people, d(inp.daily_people, inp.daily_people_prev ?? null)) });
  return out;
}

export const PRIVACY_AR = ['لا خيط من أقل من 5 أشخاص', 'لا أسماء ولا بُرُد', 'لا نص قضية ولا مداولة', 'الجهة لا ترى مرآة فرد', 'الجهة تُقارن بذاتها لا بغيرها'];

export function buildEcho(inp: EchoInput, now = Date.now(), k = K_ORG): OrgEcho {
  const { threads, below } = buildThreads(inp, now, k); const mirror = buildMirror(inp, now);
  const mem = new Set(inp.members.map(lower)); const from = now - ECHO_DAYS * 864e5;
  const active = new Set([...inp.posts.filter(p => inWin(p.created_at, from, now + 864e5)).map(p => lower(p.email)), ...inp.cases.filter(c => inWin(c.created_at, from, now + 864e5)).map(c => lower(c.author_email))].filter(e => mem.has(e))).size;
  return { window_days: ECHO_DAYS, k, people_total: mem.size, people_active: active, threads, below_k: below, quorum_ok: threads.length > 0, mirror, privacy_ar: PRIVACY_AR, generated_at: new Date(now).toISOString() };
}

/** «إحاطة 90 ثانية» — البديل المحلي الصادق (≈ 180 كلمة تُقرأ صوتًا) */
export function localBrief(orgName: string, e: OrgEcho): string {
  const p: string[] = [];
  p.push(`إحاطة ${orgName}: صدى المجالس في آخر ${e.window_days} يومًا.`);
  if (!e.quorum_ok) { p.push(`لم يكتمل النصاب بعد: ${e.people_active} من منسوبيكم فاعلون في المجالس، والخيط لا يظهر إلا حين يلمسه خمسة أشخاص على الأقل${e.below_k.length ? ` — أقرب موضوع إلى الظهور: «${e.below_k[0].label_ar}» (${e.below_k[0].people} من 5)` : ''}. مقعد أو مقعدان إضافيان يكملان الصورة.`); }
  else { p.push(`${e.people_active} من منسوبيكم فاعلون. ما يصارعونه الآن: ${e.threads.map((t, i) => `${['أولًا', 'ثانيًا', 'ثالثًا'][i]} «${t.label_ar}» — ${t.people} أشخاص و${t.cases} ${t.cases === 1 ? 'قضية' : 'قضايا'}${t.returns ? ` و${t.returns} ${t.returns === 1 ? 'عودة' : 'عودات'}` : ''}`).join('؛ ')}.`); const q = e.threads.find(t => t.pivotal_question); if (q) p.push(`السؤال الذي غيّر مسار مداولة: «${q.pivotal_question}».`); const u = e.threads.find(t => t.unsaid); if (u) p.push(`وما لم يُقل: ${u.unsaid}`); }
  const m = e.mirror; const ask = m.find(x => x.key === 'ask_ratio'); const rt = m.find(x => x.key === 'returns_on_time'); const at = m.find(x => x.key === 'attestations');
  p.push(`مرآة الجهة مقابل الربع السابق: ${ask ? `الأسئلة ${ask.now}% من المداخلات${ask.delta !== null ? ` (${ask.delta >= 0 ? '+' : ''}${ask.delta})` : ''}` : ''}${rt && rt.prev !== null ? `، العودة في موعدها ${rt.now}%` : ''}${at ? `، ${at.now} ${at.now === 1 ? 'شهادة أقران معتمدة' : 'شهادات أقران معتمدة'}` : ''}.`);
  p.push('ما نطلبه منكم: وقت داخل الدوام، وألا تدخل هذه الأرقام في أي تقييم وظيفي — كما في ميثاق الجهة. (إحاطة محلية بلا ذكاء اصطناعي)');
  return p.join(' ');
}

// ---------- ميثاق الجهة ----------
export const addMonths = (iso: string | Date, m: number) => { const d = new Date(iso); d.setUTCMonth(d.getUTCMonth() + m); return d.toISOString(); };
export function charterState(c: OrgCharter | null, now = Date.now()): { signed: boolean; status: OrgCharterStatus | 'none'; days_left: number | null; renew_soon: boolean } {
  if (!c) return { signed: false, status: 'none', days_left: null, renew_soon: false };
  const left = Math.ceil((new Date(c.expires_at).getTime() - now) / 864e5);
  if (c.status === 'revoked') return { signed: false, status: 'revoked', days_left: null, renew_soon: false };
  if (left <= 0) return { signed: false, status: 'expired', days_left: 0, renew_soon: false };
  return { signed: true, status: 'active', days_left: left, renew_soon: left <= 30 };
}
export function validateCharterSign(b: { confirm?: unknown; accepted?: unknown; signer_title?: unknown }): string | null {
  if (b.confirm !== true) return 'يلزم تأكيد صريح';
  const acc = Array.isArray(b.accepted) ? b.accepted.map(String) : []; const missing = ORG_CHARTER_AR.filter(c => !acc.includes(c.id));
  if (missing.length) return `أقرّوا بكل البنود أولًا (ينقص: ${missing.map(m => m.title).join('، ')})`;
  if (b.signer_title !== undefined && String(b.signer_title).length > 120) return 'الصفة طويلة';
  return null;
}
export const charterCode = (rnd: () => string) => `${CHARTER_CODE_PREFIX}-${rnd()}-${rnd()}`;
/** الشكل العام للشارة: اسم الجهة وتاريخ التوقيع ورمز التحقق — لا أشخاص */
export function publicCharter(c: OrgCharter, orgName: string) { return { organization_id: c.organization_id, org_name: orgName, version: c.version, signed_at: c.signed_at, expires_at: c.expires_at, code: c.vc_code, clauses: c.clauses.length }; }

// ---------- مقاعد الجهة ----------
export function validateSeatRequest(b: { topic?: unknown; people?: { email: string }[]; note?: unknown }): string | null {
  const topic = String(b.topic || '').trim(); if (topic.length < 3) return 'اكتب موضوع المقاعد (مثال: قيادة التغيير)';
  if (!THEMES_AR.some(t => t.code === topic) && topic.length > 80) return 'الموضوع طويل';
  const n = (b.people || []).length; if (n < SEATS_MIN) return `أقل طلب ${SEATS_MIN} مقاعد — ليتسنّى للمُوفِّق تنويع المجلس بين جهتين`;
  if (n > SEATS_MAX) return `أقصى طلب ${SEATS_MAX} مقعدًا`;
  if (b.note !== undefined && String(b.note).length > 600) return 'الملاحظة طويلة';
  return null;
}
/** ماذا يرى مدير الجهة عن توأمة مجالس منسوبيه: المجلس · كم من منسوبيه فيه · كم جهة أخرى — بلا أسماء الجهات الأخرى */
export function twinSummary(orgId: string, members: { council_id: string | null; organization_id: string | null; status: string }[], councils: { id: string; title_ar: string; status: string; cycle_no: number; cycle_ends_at: string | null }[]) {
  return councils.map(c => { const act = members.filter(m => m.council_id === c.id && m.status === 'active'); const mine = act.filter(m => m.organization_id === orgId).length; if (!mine) return null; return { council_id: c.id, title_ar: c.title_ar, status: c.status, cycle_no: c.cycle_no, cycle_ends_at: c.cycle_ends_at, mine, others: act.length - mine, other_orgs: new Set(act.filter(m => m.organization_id !== orgId).map(m => m.organization_id || 'none')).size }; }).filter(Boolean) as { council_id: string; title_ar: string; status: string; cycle_no: number; cycle_ends_at: string | null; mine: number; others: number; other_orgs: number }[];
}
