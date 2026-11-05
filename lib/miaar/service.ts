// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م7 «عُبور للجهات»: خدمة الاختبار المعياري (CEFR) لمجموعات من خارج البرامج.
 *  الاسم الرسمي: «خدمة الاختبار المعياري للجهات» / Level Exit Examination — Institutional Service.
 *  الاختبار نفسه (SYS-EXIT-<L>) لا يتغيّر حرفًا — ما يتغيّر هو «الوعاء»: دعوة مرتبطة بـ«طلب خدمة» له جهة طالبة ومراقب وتقرير وسجلّ.
 *  - الجزء الصرف (بلا قاعدة بيانات): clientReport · benchmarkOf · maskEmail · SERVICE_STATUS · normalizePin
 *  - الغراء: createServiceInvite · listOrders · setOrderStatus · rotateClientToken · revokeClientToken · signProctor · clientBoard · verifyPin
 *  لا يقرّر الذكاء الاصطناعي هنا شيئًا؛ لا مدفوعات داخل المنصّة (قرار قائم) — العدّاد يكفي للفوترة اليدوية.
 */
import { createHash, randomBytes } from 'node:crypto';
import { createInvite, inviteUrl } from './invites';
import { boardFor } from './exitflow';
import { sessionsWithEffect } from './remedial'; /* م9: جلسات التعويض وأثرها للجهة */
import { INTEGRITY_AR } from './witness'; /* م8: الجهة ترى الحكم لا الصور */
import { EXIT_TITLE, EXIT_SKILLS, SKILL_NAMES, exitBlueprintCode, isExitLevel, nextLevel, specTable, boardSummary } from './exit';
import type { ExitLevel, ExitSkill, BoardRow } from './exit';

type Db = any;
const nowIso = () => new Date().toISOString();
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const SERVICE_TITLE = { ar: 'خدمة الاختبار المعياري للجهات', en: 'Level Exit Examination — Institutional Service' } as const;
export const SERVICE_STATUS = ['prepared', 'open', 'rating', 'delivered', 'invoiced', 'cancelled'] as const;
export type ServiceStatus = (typeof SERVICE_STATUS)[number];
export const SERVICE_STATUS_AR: Record<ServiceStatus, string> = { prepared: 'مُعدّ', open: 'مفتوح', rating: 'قيد التصحيح', delivered: 'سُلِّم', invoiced: 'مُفوتَر', cancelled: 'أُلغي' };
export const isServiceStatus = (v: unknown): v is ServiceStatus => typeof v === 'string' && (SERVICE_STATUS as readonly string[]).includes(v);
export const BENCHMARK_MIN_N = 30;
export const CLIENT_PATH = '/miaar/client/';
export const clientUrl = (site: string, token: string) => `${site.replace(/\/$/, '')}${CLIENT_PATH}${encodeURIComponent(token)}`;

/* ---------- صرف ---------- */
/** رمز القاعة: 4–8 أرقام/أحرف لاتينية كبيرة (يُعلن شفهيًّا؛ لا صفر/حرف O لتجنّب اللبس) */
export function normalizePin(v: unknown): string | null {
  if (typeof v !== 'string') return null; const p = v.trim().toUpperCase().replace(/\s+/g, '');
  return /^[1-9A-NP-Z]{4,8}$/.test(p) ? p : null;
}
export function randomPin(len = 6): string { const A = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; const b = randomBytes(len); let s = ''; for (let i = 0; i < len; i += 1) s += A[b[i] % A.length]; return s; }
export function maskEmail(e: string): string { const [u, d] = String(e || '').split('@'); if (!d) return '—'; return `${u.slice(0, 2)}***@${d}`; }
export function serviceLabel(clientName: string, level: ExitLevel): string { return `${EXIT_TITLE.ar} ${level} — ${clientName}`.slice(0, 120); }

/** «المعيار المرجعي»: متوسط أَثَر المجهّل للمستوى نفسه — لا يظهر إلا إذا كانت العيّنة ≥ 30 */
export function benchmarkOf(reports: ReadonlyArray<{ report?: Record<string, any> | null; source?: string | null }>, level: ExitLevel, minN = BENCHMARK_MIN_N): { n: number; avg: number | null; pass_rate: number | null; skills: Record<ExitSkill, number | null>; shown: boolean } {
  const fin = reports.map((r) => r.report?.exit).filter((x: any) => x && x.الحالة === 'final' && x.المستوى === level && typeof x.الكلي === 'number');
  const n = fin.length; const skills = {} as Record<ExitSkill, number | null>;
  for (const s of EXIT_SKILLS) { const v = fin.map((x: any) => x.المهارات?.[s]?.النسبة).filter((p: unknown) => typeof p === 'number') as number[]; skills[s] = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; }
  const shown = n >= minN;
  return { n, shown, avg: shown ? Math.round(fin.reduce((a: number, x: any) => a + x.الكلي, 0) / n) : null, pass_rate: shown ? Math.round((fin.filter((x: any) => x.النتيجة === 'passed').length / n) * 100) : null, skills: shown ? skills : ({ listening: null, reading: null, grammar_vocab: null, writing: null, speaking: null } as Record<ExitSkill, number | null>) };
}

export type ClientReport = ReturnType<typeof clientReport>;
/** «تقرير الجهة»: توزيع الأحكام · متوسط كل مهارة · أضعف مهارتين · مقارنة بالمعيار المرجعي · توصية تدريبية مختصرة */
export function clientReport(level: ExitLevel, rows: readonly BoardRow[], bench: ReturnType<typeof benchmarkOf> | null) {
  const summary = boardSummary(rows);
  const finals = rows.map((r) => r.exit).filter((x: any) => x && x.الحالة === 'final') as any[];
  const skills = EXIT_SKILLS.map((s) => {
    const v = finals.map((x) => x.المهارات?.[s]?.النسبة).filter((p: unknown) => typeof p === 'number') as number[];
    const avg = v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null; const below = finals.filter((x) => typeof x.المهارات?.[s]?.النسبة === 'number' && x.المهارات[s].النسبة < 50).length;
    const b = bench?.shown ? bench.skills[s] : null;
    return { skill: s, name_ar: SKILL_NAMES[s].ar, name_en: SKILL_NAMES[s].en, avg, below, n: v.length, benchmark: b, delta: avg !== null && b !== null ? avg - b : null };
  });
  const ranked = skills.filter((s) => s.avg !== null).sort((a, b) => (a.avg as number) - (b.avg as number)); const weakest = ranked.slice(0, 2);
  const grades: Record<string, number> = {}; for (const x of finals) { const g = String(x.تقدير_ar || '—'); grades[g] = (grades[g] || 0) + 1; }
  const rec_ar: string[] = [];
  if (weakest.length) rec_ar.push(`أضعف محورين في المجموعة: ${weakest.map((w) => `${w.name_ar} (${w.avg}%)`).join(' و')} — يُقترح تركيز 3–4 أسابيع عليهما قبل الانتقال إلى ${nextLevel(level) || 'المستوى التالي'}.`);
  if (summary.conditional) rec_ar.push(`${summary.conditional} متعلّمًا اجتياز مشروط — تتاح لهم إعادة مهارة واحدة خلال 14 يومًا بقرار المشرف.`);
  if (summary.failed) rec_ar.push(`${summary.failed} لم يجتازوا — تُنصح الجهة بإعادة الاختبار كاملًا بعد 7 أيام على الأقل.`);
  if (bench?.shown && summary.avg !== null && bench.avg !== null) rec_ar.push(summary.avg >= bench.avg ? `متوسط المجموعة (${summary.avg}%) أعلى من المعيار المرجعي لأَثَر للمستوى ${level} (${bench.avg}%).` : `متوسط المجموعة (${summary.avg}%) دون المعيار المرجعي لأَثَر للمستوى ${level} (${bench.avg}%) بفارق ${bench.avg - summary.avg} نقطة.`);
  if (!finals.length) rec_ar.push('لم يكتمل التصحيح بعد — يكتمل التقرير حين تصدر الأحكام النهائية.');
  return { level, official: EXIT_TITLE, spec: specTable(level), summary, finals: finals.length, skills, weakest: weakest.map((w) => w.skill), grades, benchmark: bench && bench.shown ? { n: bench.n, avg: bench.avg, pass_rate: bench.pass_rate } : { n: bench?.n || 0, avg: null, pass_rate: null }, recommendations_ar: rec_ar, generated_at: nowIso() };
}

/* ---------- الغراء ---------- */
export type ServiceInput = { /* م8 */ proctor_mode?: 'room' | 'camera' | 'remote' | null; witness_interval?: number | null; /* م8-ب */ location?: string | null; client_name: string; client_contact?: string | null; level: ExitLevel; opens_at?: string | null; expires_at?: string | null; max_seats?: number | null; lang?: string; identity_mode?: 'email' | 'email_id'; pin?: string | null; note?: string | null };
export async function createServiceInvite(db: Db, input: ServiceInput, actorId: string | null, site: string): Promise<{ ok: true; invite: any; order: any; url: string; client_url: string; client_token: string; pin: string | null } | { ok: false; error: string }> {
  const client_name = String(input.client_name || '').trim().replace(/\s+/g, ' ').slice(0, 120); if (client_name.length < 2) return { ok: false, error: 'اسم الجهة الطالبة من حرفين على الأقل (أو «أفراد»)' };
  if (!isExitLevel(input.level)) return { ok: false, error: 'حدّد المستوى (A1–C1)' };
  const { data: bp } = await db.from('question_bank_blueprints').select('id, code, status').eq('code', exitBlueprintCode(input.level)).maybeSingle();
  if (!bp?.id || bp.status !== 'active') return { ok: false, error: 'blueprint_missing' };
  const pin = input.pin === undefined ? null : input.pin === null || input.pin === '' ? null : normalizePin(input.pin); if (input.pin && !pin) return { ok: false, error: 'رمز القاعة: 4–8 أرقام/أحرف لاتينية بلا صفر أو O' };
  const token = randomBytes(18).toString('base64url');
  const r = await createInvite(db, {
    kind: 'group', label_ar: serviceLabel(client_name, input.level), lang: input.lang || 'ar', exam_mode: 'comprehensive', purpose: 'level_exit', blueprint_id: bp.id,
    opens_at: input.opens_at || null, expires_at: input.expires_at || null, max_seats: input.max_seats || null, level_target: input.level, note: input.note || null,
    /* م8 «شاهِد»: الافتراضي لخدمة الجهات «قاعة + شاهِد» (قرار المالك أ) */ proctor_mode: input.proctor_mode === 'room' || input.proctor_mode === 'remote' || input.proctor_mode === 'camera' ? input.proctor_mode : null /* م8-ب: null = الافتراضي العام (قاعة + شاهِد) */, ...(input.witness_interval ? { witness_interval: input.witness_interval } : {}), ...(input.location ? { location: input.location } : {}),
    client_name, client_contact: input.client_contact ? String(input.client_contact).trim().slice(0, 160) : null, service_mode: 'external', proctor_pin_hash: pin ? hashToken(pin) : null, client_token_hash: hashToken(token), identity_mode: input.identity_mode === 'email_id' ? 'email_id' : 'email',
  } as any, actorId || '', site);
  if (!r.ok) return { ok: false, error: r.error };
  const ord = await db.from('miaar_service_orders').insert({ invite_id: r.invite.id, client_name, client_contact: input.client_contact || null, level: input.level, seats: input.max_seats || null, status: 'open', note: input.note || null, created_by: actorId, events: [{ at: nowIso(), type: 'created', by: actorId }] }).select('*').single();
  if (ord.error) return { ok: false, error: `أُنشئت الدعوة لكن تعذّر فتح سجلّ الخدمة: ${ord.error.message}` };
  return { ok: true, invite: r.invite, order: ord.data, url: r.url, client_url: clientUrl(site, token), client_token: token, pin };
}

export async function listOrders(db: Db, site: string) {
  const { data } = await db.from('miaar_service_orders').select('*').order('created_at', { ascending: false }).limit(200);
  const orders: any[] = Array.isArray(data) ? data : []; if (!orders.length) return [];
  const ids = orders.map((o) => o.invite_id);
  const [{ data: invs }, { data: reps }, { data: sess }] = await Promise.all([
    db.from('placement_invites').select('id, code, status, opens_at, expires_at, max_seats, client_token_hash, proctor_pin_hash').in('id', ids),
    db.from('placement_reports').select('invite_id, report').in('invite_id', ids),
    db.from('placement_secure_sessions').select('invite_id').in('invite_id', ids),
  ]);
  return orders.map((o) => {
    const inv = (Array.isArray(invs) ? invs : []).find((i: any) => i.id === o.invite_id) || null;
    const rp = (Array.isArray(reps) ? reps : []).filter((r: any) => r.invite_id === o.invite_id); const st = (Array.isArray(sess) ? sess : []).filter((s: any) => s.invite_id === o.invite_id).length;
    const fin = rp.filter((r: any) => r.report?.exit?.الحالة === 'final').length; const passed = rp.filter((r: any) => r.report?.exit?.النتيجة === 'passed').length;
    return { ...o, status_ar: SERVICE_STATUS_AR[o.status as ServiceStatus] || o.status, invite: inv ? { ...inv, url: inviteUrl(site, inv.code), has_client_link: !!inv.client_token_hash, has_pin: !!inv.proctor_pin_hash, client_token_hash: undefined, proctor_pin_hash: undefined } : null, started: st, finished: rp.length, final: fin, passed, seats_used: Math.max(Number(o.seats_used) || 0, st) };
  });
}

async function orderById(db: Db, id: string) { const { data } = await db.from('miaar_service_orders').select('*').eq('id', id).maybeSingle(); return data || null; }
async function pushEvent(db: Db, order: any, ev: Record<string, unknown>, patch: Record<string, unknown> = {}) {
  const events = Array.isArray(order.events) ? [...order.events, { at: nowIso(), ...ev }] : [{ at: nowIso(), ...ev }];
  const r = await db.from('miaar_service_orders').update({ ...patch, events, updated_at: nowIso() }).eq('id', order.id).select('*').single(); return r.error ? null : r.data;
}
/** انتقالات الحالة بتوقيع بشري: open → rating → delivered → invoiced (و cancelled من أي حالة غير مفوترة) */
export async function setOrderStatus(db: Db, orderId: string, status: unknown, actorId: string | null): Promise<{ ok: true; order: any } | { ok: false; error: string }> {
  if (!isServiceStatus(status)) return { ok: false, error: 'حالة غير معروفة' };
  const o = await orderById(db, orderId); if (!o) return { ok: false, error: 'طلب الخدمة غير موجود' };
  if (o.status === 'invoiced' && status !== 'invoiced') return { ok: false, error: 'طلب مُفوتَر — لا يتغيّر' };
  const patch: Record<string, unknown> = { status }; if (status === 'delivered') patch.delivered_at = nowIso(); if (status === 'invoiced') patch.invoiced_at = nowIso();
  if (status === 'delivered' || status === 'cancelled') { await db.from('placement_invites').update({ status: 'closed', updated_at: nowIso() }).eq('id', o.invite_id); }
  const up = await pushEvent(db, o, { type: 'status', to: status, by: actorId }, patch); return up ? { ok: true, order: up } : { ok: false, error: 'تعذّر التحديث' };
}
/** رابط بوابة الجهة: يُولَّد من جديد (يُبطل القديم) — يُعرض مرة واحدة */
export async function rotateClientToken(db: Db, orderId: string, actorId: string | null, site: string): Promise<{ ok: true; client_url: string } | { ok: false; error: string }> {
  const o = await orderById(db, orderId); if (!o) return { ok: false, error: 'طلب الخدمة غير موجود' };
  const token = randomBytes(18).toString('base64url');
  const r = await db.from('placement_invites').update({ client_token_hash: hashToken(token), updated_at: nowIso() }).eq('id', o.invite_id); if (r.error) return { ok: false, error: r.error.message };
  await pushEvent(db, o, { type: 'client_link_rotated', by: actorId }); return { ok: true, client_url: clientUrl(site, token) };
}
export async function revokeClientToken(db: Db, orderId: string, actorId: string | null): Promise<boolean> {
  const o = await orderById(db, orderId); if (!o) return false;
  const r = await db.from('placement_invites').update({ client_token_hash: null, updated_at: nowIso() }).eq('id', o.invite_id); if (r.error) return false;
  await pushEvent(db, o, { type: 'client_link_revoked', by: actorId }); return true;
}
/** «ختم المراقب»: توقيع كشف الحضور (من المشرف أو من منسّق الجهة عبر بوابته) */
export async function signProctor(db: Db, orderId: string, name: unknown, by: string): Promise<{ ok: true; order: any } | { ok: false; error: string }> {
  const n = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, 120) : ''; if (n.length < 3) return { ok: false, error: 'اسم المراقب من ثلاثة أحرف على الأقل' };
  const o = await orderById(db, orderId); if (!o) return { ok: false, error: 'طلب الخدمة غير موجود' };
  if (o.proctor_signed_at) return { ok: false, error: 'وُقّع كشف الحضور من قبل' };
  const up = await pushEvent(db, o, { type: 'proctor_signed', name: n, by }, { proctor_name: n, proctor_signed_at: nowIso(), proctor_signed_by: by }); return up ? { ok: true, order: up } : { ok: false, error: 'تعذّر التوقيع' };
}
/** رمز القاعة عند البدء: الدعوة الخارجية ذات الرمز لا تبدأ بدونه */
export function verifyPin(row: { proctor_pin_hash?: string | null } | null | undefined, pin: unknown): 'ok' | 'required' | 'wrong' {
  if (!row?.proctor_pin_hash) return 'ok'; const p = normalizePin(pin); if (!p) return 'required'; return hashToken(p) === row.proctor_pin_hash ? 'ok' : 'wrong';
}
/** المعيار المرجعي من قاعدة البيانات (آخر 1000 حكم نهائي للمستوى) */
export async function benchmarkFromDb(db: Db, level: ExitLevel) {
  const { data } = await db.from('placement_reports').select('report, source').order('created_at', { ascending: false }).limit(1000);
  return benchmarkOf(Array.isArray(data) ? data : [], level);
}
/** بوابة الجهة: برابط سرّي — قراءة فقط · نتائج طلابها فقط · لا بنود ولا مفاتيح */
/** م9: ما تراه الجهة عن الوحدات — خريطة حرارة المجموعة (بلا أسماء) + جلسات التعويض وأثرها (مجاميع فقط) */
export function clientUnitsView(heat: readonly any[], sessions: readonly any[], scope: readonly string[] | null | undefined) {
  const units = heat.map((h) => ({ code: String(h.code), title_ar: String(h.title_ar || ''), percent: Number(h.percent) || 0, state: String(h.state || 'ok'), state_ar: String(h.state_ar || ''), n_students: Number(h.n_students) || 0 }));
  const weak = units.filter((u) => u.state === 'weak').slice(0, 3);
  const sess = sessions.filter((x) => x && x.status !== 'cancelled').map((x) => ({ id: String(x.id), title_ar: String(x.title_ar || ''), starts_at: String(x.starts_at || ''), duration_min: Number(x.duration_min) || 0, provider: String(x.provider || ''), status: String(x.status || ''), units: Array.isArray(x.miaar_unit_codes) ? x.miaar_unit_codes.map(String) : [], joined: Number(x.joined) || 0,
    effect: (Array.isArray(x.effect) ? x.effect : []).map((e: any) => ({ code: String(e.code), title_ar: String(e.title_ar || e.code), n_retakes: Number(e.n_retakes) || 0, attended: e.attended, others: e.others, text: String(e.text || '') })) }));
  const deltas = sess.flatMap((x) => x.effect.map((e: any) => e.attended?.delta)).filter((d: unknown): d is number => typeof d === 'number');
  return { units, weak, scoped: Array.isArray(scope) && scope.length > 0, scope: Array.isArray(scope) ? scope.map(String) : [], sessions: sess, effect_avg: deltas.length ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length) : null,
    note_ar: 'نسب الوحدات للمجموعة كلّها بلا أسماء · الوحدات لا تظهر على الشهادة الرسمية · أثر التعويض = فرق نسبة الوحدة بين الاختبار الأصلي وإعادة المهارة' };
}
export async function clientBoard(db: Db, token: unknown, site: string) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 64) return null;
  const { data: inv } = await db.from('placement_invites').select('id, code, status, client_name, client_contact, level_target, opens_at, expires_at, max_seats, identity_mode, proctor_pin_hash').eq('client_token_hash', hashToken(token)).maybeSingle(); if (!inv) return null;
  const b = await boardFor(db, inv.id); if (!b) return null;
  const { data: order } = await db.from('miaar_service_orders').select('id, client_name, level, seats, status, proctor_name, proctor_signed_at, delivered_at, created_at').eq('invite_id', inv.id).maybeSingle();
  const level = isExitLevel(inv.level_target) ? inv.level_target : 'A1';
  const bench = await benchmarkFromDb(db, level).catch(() => null);
  const rows = b.rows.map((r: any) => ({ name: r.name, email: r.email, status: r.status, started_at: r.started_at, finished_at: r.finished_at, answered: r.answered, total: r.total, report_code: r.report_code, integrity: (r as any).integrity || null, integrity_ar: (r as any).integrity ? (INTEGRITY_AR as any)[(r as any).integrity] || (r as any).integrity : null, exit: r.exit ? { الحالة: r.exit.الحالة, النتيجة: r.exit.النتيجة, الكلي: r.exit.الكلي, تقدير_ar: r.exit.تقدير_ar, grade_en: r.exit.grade_en, المهارات: r.exit.المهارات, مهارة_الإعادة: r.exit.مهارة_الإعادة, الوحدات: Array.isArray(r.exit.الوحدات) ? r.exit.الوحدات : [], وحدات_للمراجعة: Array.isArray(r.exit.وحدات_للمراجعة) ? r.exit.وحدات_للمراجعة : [] } : null, certificate_url: r.exit?.الحالة === 'final' && r.exit?.النتيجة === 'passed' && (r as any).integrity !== 'invalid' && r.report_code ? `${site.replace(/\/$/, '')}/miaar/certificate/${encodeURIComponent(r.report_code)}` : null }));
  /* م9: الوحدات + جلسات التعويض للجهة (مجاميع · بلا أسماء) */
  const heat: any[] = Array.isArray((b as any).units) ? (b as any).units : [];
  const sessions = heat.length ? await sessionsWithEffect(db, String(inv.id), new Map(heat.map((h: any) => [String(h.code), String(h.title_ar || h.code)]))).catch(() => []) : [];
  const units = clientUnitsView(heat, sessions, (b as any).unit_scope);
  /* م10 «مِران»: سطر واحد للجهة — كم طالبًا يتدرّب ومتوسط التحسّن (مجاميع بلا أسماء) */
  let practice: any = null; try { const { practiceFactsForReports } = await import('./practice'); const ids = b.rows.map((r: any) => (r as any).report_id).filter(Boolean) as string[];
    if (ids.length) { const { data: reps } = await db.from('placement_reports').select('id, report').in('id', ids.slice(0, 400)); const f = await practiceFactsForReports(db, (Array.isArray(reps) ? reps : []).map((r: any) => ({ id: String(r.id), report: r.report }))); if (f.plans) practice = { ...f, text_ar: `مِران: ${f.approved} من ${b.rows.length} طالبًا لهم خطّة تمرين معتمدة${f.active ? ` · ${f.active} يتدرّبون الآن` : ''}${f.with_delta && f.avg_delta !== null ? ` · متوسط التحسّن ${f.avg_delta > 0 ? '+' : ''}${f.avg_delta}` : ''}` }; } } catch { practice = null; }
  return { practice, invite: { code: inv.code, status: inv.status, client_name: inv.client_name, level, opens_at: inv.opens_at, expires_at: inv.expires_at, max_seats: inv.max_seats, has_pin: !!inv.proctor_pin_hash, url: inviteUrl(site, inv.code) }, order: order ? { ...order, status_ar: SERVICE_STATUS_AR[order.status as ServiceStatus] || order.status } : null, window: b.window, rows, summary: b.summary, report: clientReport(level, b.rows, bench), units, official: EXIT_TITLE, service: SERVICE_TITLE, at: nowIso() };
}
/** ما تحتاجه الشهادة وبطاقة النتيجة عن الجهة (بلا رموز) */
export async function serviceFactsForInvite(db: Db, inviteId: string | null): Promise<{ external: boolean; client_name: string | null; proctor_signed: boolean; proctor_name: string | null } | null> {
  if (!inviteId) return null;
  const { data: inv } = await db.from('placement_invites').select('id, service_mode, client_name').eq('id', inviteId).maybeSingle(); if (!inv || inv.service_mode !== 'external') return null;
  const { data: o } = await db.from('miaar_service_orders').select('proctor_name, proctor_signed_at').eq('invite_id', inviteId).maybeSingle();
  return { external: true, client_name: inv.client_name || null, proctor_signed: !!o?.proctor_signed_at, proctor_name: o?.proctor_name || null };
}
