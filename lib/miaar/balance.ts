// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — من أَثَر · م3 «ميزان مِعيار» — طبقة البيانات (خادم فقط، بصلاحية الخدمة)
 *  reweigh(db): يجمع الجلسات المنتهية (حتى 3000) وإجاباتها ومفاتيح البنود → تحليل البنود + موثوقية كل كتلة مستوى ونموذج + معايرة راش
 *               → يكتب question_bank_item_stats (بالرمز) و miaar_reliability (بالنطاق). لا اسم ولا بريد في أي صف.
 *  reweighIfDue(db): بعد كل 25 جلسة مكتملة منذ آخر وزن (يُستدعى من finishSession داخل try — لا يُفشل الاختبار أبدًا).
 *  balanceSummary(db): ما تعرضه شاشة «الميزان» · trustSummary(db): ما تعرضه /miaar/trust (أضواء المستويات فقط).
 *  inviteReport(db, inviteId): «الميزان في الدعوة» — كيف أدّى الاختبار على مجموعة واحدة (مجمّع، بلا أسماء).
 *  الاقتراحات (نقل بند لمستوى آخر) تبقى اقتراحات حتى يعتمدها المعدّ: acceptMove/dismissSuggestion/setAnchor.
 */
import { itemStats, formReliability, rasch, bandMap, suggestLevel, MIN_N_CALIB, MIN_N_ITEM, FLAG_AR, FLAG_SEVERITY, LIGHT_AR, type Response, type ItemStat, type FormReliability, type Light } from './psychometrics';
import { planFromSession } from './blueprint';
import { PASS_PERCENT } from './registry';

export const REWEIGH_EVERY = 25; export const MAX_SESSIONS = 3000;
const nowIso = () => new Date().toISOString();
const chunk = <T,>(a: T[], n: number): T[][] => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

type SessionRow = { id: string; candidate: any; started_at: string; status: string; plan: unknown; invite_id: string | null; exam_mode: string; finished_at: string | null };
type ItemRow = { id: string; item_code: string; level: string; skill: string; status: string; options: any; is_anchor?: boolean | null; content_version: string; item_type: string; question_text: string };

/** يجمع المادة الخام: الاستجابات (بالرمز) + مفاتيح + صفوف البنود + خطط الجلسات */
export async function collect(db: any, opts: { maxSessions?: number; inviteId?: string | null } = {}) {
  let q = db.from('placement_secure_sessions').select('id, candidate, started_at, status, plan, invite_id, exam_mode, finished_at').in('status', ['completed', 'expired']).order('started_at', { ascending: false }).limit(opts.maxSessions || MAX_SESSIONS);
  if (opts.inviteId) q = q.eq('invite_id', opts.inviteId);
  const { data: sessions, error } = await q; if (error) throw new Error('sessions_unavailable');
  const S = (sessions || []) as SessionRow[]; const ids = S.map((s) => s.id);
  const answers: { session_id: string; question_id: string; selected_option_id: string; submitted_at: string }[] = [];
  for (const part of chunk(ids, 150)) { const { data } = await db.from('placement_secure_answers').select('session_id, question_id, selected_option_id, submitted_at').in('session_id', part).limit(20000); for (const a of (data || []) as any[]) answers.push(a); }
  const [items, keys] = await Promise.all([
    db.from('question_bank_items').select('id, item_code, level, skill, status, options, is_anchor, content_version, item_type, question_text').limit(3000),
    db.from('question_bank_answer_keys').select('item_id, correct_option_id').limit(5000),
  ]);
  const rows = ((items.data || []) as ItemRow[]); const keyById = new Map<string, string>(((keys.data || []) as any[]).map((k) => [k.item_id, k.correct_option_id]));
  /* الرمز → صف واحد (المعتمد أولًا) */
  const byCode = new Map<string, ItemRow>(); for (const r of rows) { const prev = byCode.get(r.item_code); if (!prev || (prev.status !== 'approved' && r.status === 'approved')) byCode.set(r.item_code, r); }
  const keyByCode = new Map<string, string>(); for (const [code, r] of byCode) { const k = keyById.get(r.id); if (k) keyByCode.set(code, k); }
  /* الاستجابات مع زمن الإجابة = الفرق عن الإجابة السابقة في الجلسة نفسها (الأولى عن بداية الجلسة)، بسقف 10 دقائق */
  const bySession = new Map<string, typeof answers>(); for (const a of answers) { const l = bySession.get(a.session_id) || []; l.push(a); bySession.set(a.session_id, l); }
  const responses: Response[] = []; const exposure = new Map<string, number>(); const sessionOf = new Map<string, SessionRow>(S.map((s) => [s.id, s]));
  for (const s of S) {
    const codes: string[] = Array.isArray(s.candidate?.assignedItemCodes) ? s.candidate.assignedItemCodes.filter((c: unknown) => typeof c === 'string') : [];
    for (const c of codes) exposure.set(c, (exposure.get(c) || 0) + 1);
    const list = (bySession.get(s.id) || []).slice().sort((a, b) => a.submitted_at.localeCompare(b.submitted_at)); let prev = new Date(s.started_at).getTime();
    for (const a of list) {
      const row = byCode.get(a.question_id); const key = keyByCode.get(a.question_id); if (!row || !key) continue;
      const t = new Date(a.submitted_at).getTime(); const ms = Number.isFinite(t) && Number.isFinite(prev) ? Math.min(600000, Math.max(0, t - prev)) : null; prev = Number.isFinite(t) ? t : prev;
      responses.push({ session: s.id, item: a.question_id, correct: a.selected_option_id === key ? 1 : 0, selected: a.selected_option_id, level: row.level, ms });
    }
  }
  return { sessions: S, sessionOf, responses, byCode, keyByCode, exposure, rows };
}

export type ReweighResult = { sessions: number; responses: number; items: number; calibrated: number; suggestions: number; scopes: number; ms: number };
/** الوزن الكامل: يكتب الجداول ويعيد ملخّصًا */
export async function reweigh(db: any): Promise<ReweighResult> {
  const t0 = Date.now(); const C = await collect(db);
  const stats = itemStats(C.responses, C.keyByCode);
  const R = rasch(C.responses, MIN_N_ITEM); const rb = new Map(R.items.map((i) => [i.item, i]));
  const calibrated = R.items.filter((i) => i.n >= MIN_N_CALIB && C.byCode.get(i.item)?.status === 'approved').map((i) => ({ item: i.item, level: C.byCode.get(i.item)!.level, b: i.b }));
  const map = bandMap(calibrated);
  /* الاقتراحات السابقة المرفوضة لا تعود */
  const { data: prevRows } = await db.from('question_bank_item_stats').select('item_code, dismissed_level').limit(3000);
  const dismissed = new Map<string, string>(((prevRows || []) as any[]).filter((r) => r.dismissed_level).map((r) => [r.item_code, String(r.dismissed_level)]));
  const now = nowIso(); const statRows: any[] = []; let suggestions = 0;
  for (const s of stats) {
    const row = C.byCode.get(s.item); const r = rb.get(s.item);
    const canCalib = !!r && r.n >= MIN_N_CALIB; const sug = canCalib && row?.status === 'approved' ? suggestLevel(row.level, r!.b, map) : null;
    const keep = sug && dismissed.get(s.item) === sug ? null : sug; if (keep) suggestions += 1;
    statRows.push({ item_code: s.item, item_id: row?.id || null, level: s.level, skill: row?.skill || null, n: s.n, p: s.p, rpb: s.rpb, distractors: s.distractors, median_ms: s.median_ms, exposure: C.exposure.get(s.item) || s.n, flags: s.flags,
      b: r ? r.b : null, se: r ? r.se : null, infit: r ? r.infit : null, outfit: r ? r.outfit : null, calib_n: r ? r.n : 0, suggest_level: keep, dismissed_level: dismissed.get(s.item) || null, computed_at: now });
  }
  for (const part of chunk(statRows, 200)) { const { error } = await db.from('question_bank_item_stats').upsert(part, { onConflict: 'item_code' }); if (error) throw new Error('stats_write_failed: ' + error.message); }
  /* موثوقية كل كتلة مستوى (عبر كل الجلسات) + كل نموذج (بالرمز) */
  const scopes: FormReliability[] = []; const levels = [...new Set(C.responses.map((r) => r.level))];
  const perSession = new Map<string, Map<string, { item: string; correct: 0 | 1 }[]>>();
  for (const r of C.responses) { const m = perSession.get(r.session) || new Map(); const l = m.get(r.level) || []; l.push({ item: r.item, correct: r.correct }); m.set(r.level, l); perSession.set(r.session, m); }
  for (const L of levels) { const rows = [...perSession.values()].map((m) => ({ items: m.get(L) || [] })).filter((x) => x.items.length >= 2); if (rows.length) scopes.push(formReliability(`level:${L}`, rows, PASS_PERCENT)); }
  const byPlan = new Map<string, { cut: number; rows: { items: { item: string; correct: 0 | 1 }[] }[] }>();
  for (const s of C.sessions) { const p = planFromSession(s.plan); if (!p) continue; const m = perSession.get(s.id); if (!m) continue; const items = [...m.values()].flat(); if (items.length < 2) continue; const g = byPlan.get(p.code) || { cut: p.cut, rows: [] }; g.rows.push({ items }); byPlan.set(p.code, g); }
  for (const [code, g] of byPlan) scopes.push(formReliability(`form:${code}`, g.rows, g.cut));
  const relRows = scopes.map((s) => ({ scope: s.scope, n: s.n, k: s.k, method: s.method, rel: s.rel, mean: s.mean, sd: s.sd, sem: s.sem, cut: s.cut, pass_rate: s.pass_rate, livingston: s.livingston, light: s.light, advice: s.advice, computed_at: now }));
  relRows.push({ scope: 'meta', n: C.sessions.length, k: statRows.length, method: 'kr21', rel: 0, mean: 0, sd: 0, sem: 0, cut: 0, pass_rate: 0, livingston: 0, light: 'gray', advice: JSON.stringify({ rasch: { persons: R.persons, iterations: R.iterations, converged: R.converged, calibrated: calibrated.length }, bands: map }), computed_at: now });
  if (relRows.length) { const { error } = await db.from('miaar_reliability').upsert(relRows, { onConflict: 'scope' }); if (error) throw new Error('reliability_write_failed: ' + error.message); }
  return { sessions: C.sessions.length, responses: C.responses.length, items: statRows.length, calibrated: calibrated.length, suggestions, scopes: scopes.length, ms: Date.now() - t0 };
}

/** تلقائي: كل REWEIGH_EVERY جلسة منتهية منذ آخر وزن. لا يرمي. */
export async function reweighIfDue(db: any): Promise<ReweighResult | null> {
  try {
    const [{ data: meta }, { count }] = await Promise.all([db.from('miaar_reliability').select('n').eq('scope', 'meta').maybeSingle(), db.from('placement_secure_sessions').select('id', { count: 'exact', head: true }).in('status', ['completed', 'expired'])]);
    const last = Number(meta?.n || 0); const total = Number(count || 0);
    if (total - last < REWEIGH_EVERY) return null; return await reweigh(db);
  } catch { return null; }
}

/* ───────────── القراءة ───────────── */
export type ItemStatRow = ItemStat & { item_id: string | null; skill: string | null; exposure: number; b: number | null; se: number | null; infit: number | null; outfit: number | null; calib_n: number; suggest_level: string | null; dismissed_at: string | null; computed_at: string; is_anchor: boolean; status: string; question_text: string; flags_ar: string[]; severity: number };
export async function balanceSummary(db: any) {
  const [{ data: st }, { data: rel }, { data: items }] = await Promise.all([
    db.from('question_bank_item_stats').select('*').order('n', { ascending: false }).limit(3000),
    db.from('miaar_reliability').select('*').order('scope'),
    db.from('question_bank_items').select('item_code, status, is_anchor, question_text, level, skill').limit(3000),
  ]);
  const info = new Map<string, any>(); for (const r of (items || []) as any[]) { const prev = info.get(r.item_code); if (!prev || (prev.status !== 'approved' && r.status === 'approved')) info.set(r.item_code, r); }
  const rows: ItemStatRow[] = ((st || []) as any[]).map((r) => { const i = info.get(r.item_code) || {}; const flags: string[] = Array.isArray(r.flags) ? r.flags : []; return { item: r.item_code, item_id: r.item_id, level: r.level, skill: r.skill, n: r.n, p: Number(r.p), rpb: Number(r.rpb), distractors: r.distractors || {}, median_ms: r.median_ms, exposure: r.exposure, flags, flags_ar: flags.map((f) => (FLAG_AR as any)[f] || f), severity: Math.max(0, ...flags.map((f) => (FLAG_SEVERITY as any)[f] || 0)), b: r.b == null ? null : Number(r.b), se: r.se == null ? null : Number(r.se), infit: r.infit == null ? null : Number(r.infit), outfit: r.outfit == null ? null : Number(r.outfit), calib_n: r.calib_n || 0, suggest_level: r.suggest_level || null, dismissed_at: r.dismissed_at || null, computed_at: r.computed_at, is_anchor: !!i.is_anchor, status: i.status || 'unknown', question_text: String(i.question_text || '').slice(0, 140) }; });
  const meta = ((rel || []) as any[]).find((r) => r.scope === 'meta'); let metaInfo: any = null; try { metaInfo = meta ? JSON.parse(meta.advice) : null; } catch { metaInfo = null; }
  const scopes = ((rel || []) as any[]).filter((r) => r.scope !== 'meta').map((r) => ({ ...r, rel: Number(r.rel), light_ar: LIGHT_AR[r.light as Light] || r.light }));
  const attention = rows.filter((r) => r.severity >= 2 || r.suggest_level).sort((a, b) => b.severity - a.severity || b.n - a.n).slice(0, 60);
  const overexposed = rows.filter((r) => r.exposure >= 400 && r.status === 'approved').sort((a, b) => b.exposure - a.exposure).slice(0, 20);
  return { computed_at: meta?.computed_at || null, sessions: Number(meta?.n || 0), items: rows.length, scopes, rows, attention, overexposed, rasch: metaInfo?.rasch || null, bands: metaInfo?.bands || null, thresholds: { min_n_item: MIN_N_ITEM, min_n_calib: MIN_N_CALIB, reweigh_every: REWEIGH_EVERY } };
}

/** للعلن: أضواء المستويات فقط (لا بنود، لا أشخاص) */
export async function trustSummary(db: any) {
  const { data } = await db.from('miaar_reliability').select('scope, n, k, rel, sem, livingston, light, computed_at, method').like('scope', 'level:%').order('scope');
  const levels = ((data || []) as any[]).map((r) => ({ level: String(r.scope).slice(6), n: r.n, k: r.k, rel: Number(r.rel), sem: Number(r.sem), decision: Number(r.livingston), light: r.light as Light, light_ar: LIGHT_AR[r.light as Light] || r.light, method: r.method }));
  const [{ data: meta }, { data: fr }, { data: bps }] = await Promise.all([
    db.from('miaar_reliability').select('n, computed_at').eq('scope', 'meta').maybeSingle(),
    db.from('miaar_reliability').select('scope, n, k, rel, sem, livingston, light, method').like('scope', 'form:%').order('n', { ascending: false }),
    db.from('question_bank_blueprints').select('code, name_ar, test_type').limit(200),
  ]);
  const nameOf = new Map<string, { name_ar: string; test_type: string }>(((bps || []) as any[]).map((b) => [b.code, { name_ar: b.name_ar, test_type: b.test_type }]));
  const forms = ((fr || []) as any[]).map((r) => { const code = String(r.scope).slice(5); const b = nameOf.get(code); return { code, name_ar: b?.name_ar || code, test_type: b?.test_type || null, n: r.n, k: r.k, rel: Number(r.rel), sem: Number(r.sem), decision: Number(r.livingston), light: r.light as Light, light_ar: LIGHT_AR[r.light as Light] || r.light, method: r.method }; });
  return { levels, forms, sessions: Number(meta?.n || 0), computed_at: meta?.computed_at || null };
}

/** سطر الموثوقية في بطاقة النتيجة.
 *  المرجع الصحيح قياسيًّا هو «النموذج» الذي خاضه المتقدّم كاملًا (form:<code>) — فقرار التسكين يُبنى على كل بنوده (نحو 50) لا على كتلة مستوى واحدة (6–8 بنود)
 *  التي تكون موثوقيتها أدنى بطبيعتها. الكتل تبقى للطاقم في «الميزان». جلسة قديمة بلا مخطّط → أفضل ضوء بين كتلها، وإلا رمادي. */
export async function trustLine(db: any, levels: string[], formCode?: string | null): Promise<{ light: Light; text: string } | null> {
  const text = (l: Light) => l === 'green' ? 'هذه النتيجة من نموذج موثوقيته معتمدة' : l === 'yellow' ? 'هذه النتيجة من نموذج موثوقيته مقبولة' : l === 'red' ? 'هذا النموذج تحت المراجعة — النتيجة إرشادية' : 'هذا النموذج ما زال يُعايَر — النتيجة إرشادية';
  if (formCode) {
    const { data: f } = await db.from('miaar_reliability').select('light').eq('scope', `form:${formCode}`).maybeSingle();
    if (f?.light) return { light: f.light as Light, text: text(f.light as Light) };
    return { light: 'gray', text: text('gray') };
  }
  if (!levels.length) return null;
  const { data } = await db.from('miaar_reliability').select('scope, light').in('scope', levels.map((l) => `level:${l}`));
  const lights = ((data || []) as any[]).map((r) => r.light as Light); if (!lights.length) return { light: 'gray', text: text('gray') };
  const order: Light[] = ['green', 'yellow', 'red', 'gray']; const best = order.find((l) => lights.includes(l)) || 'gray';
  return { light: best, text: text(best) };
}

/** «الميزان في الدعوة»: توزيع المستويات المثبتة · الزمن · أكثر البنود إرباكًا لهذه المجموعة (مجمّع، k ≥ 5) */
export async function inviteReport(db: any, inviteId: string) {
  const C = await collect(db, { inviteId, maxSessions: 1000 });
  if (C.sessions.length < 5) return { ok: false as const, reason: 'يظهر التقرير بعد 5 جلسات منتهية على الأقل (حماية الخصوصية)', sessions: C.sessions.length };
  const { data: reports } = await db.from('placement_reports').select('report').eq('invite_id', inviteId).limit(1000);
  const dist: Record<string, number> = {}; for (const r of (reports || []) as any[]) { const L = String(r.report?.ملخص_التسكين?.المستوى_المثبت || r.report?.ملخص_التسكين?.المستوى || '—'); dist[L] = (dist[L] || 0) + 1; }
  const durations = C.sessions.filter((s) => s.finished_at).map((s) => (new Date(s.finished_at as string).getTime() - new Date(s.started_at).getTime()) / 60000).filter((m) => m > 0 && m < 300);
  const st = itemStats(C.responses, C.keyByCode).filter((s) => s.n >= 5);
  const confusing = st.sort((a, b) => a.p - b.p).slice(0, 5).map((s) => ({ item: s.item, level: s.level, p: s.p, n: s.n, text: String(C.byCode.get(s.item)?.question_text || '').slice(0, 90) }));
  const easiest = [...st].sort((a, b) => b.p - a.p).slice(0, 3).map((s) => ({ item: s.item, level: s.level, p: s.p, n: s.n }));
  const med = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); };
  return { ok: true as const, sessions: C.sessions.length, responses: C.responses.length, distribution: dist, median_minutes: med(durations), confusing, easiest, overall_p: st.length ? Math.round((st.reduce((s, x) => s + x.p * x.n, 0) / st.reduce((s, x) => s + x.n, 0)) * 100) : null };
}

/* ───────────── القرارات البشرية ───────────── */
export async function acceptMove(db: any, itemCode: string, toLevel: string, userId: string): Promise<{ ok: boolean; error?: string }> {
  const { data: st } = await db.from('question_bank_item_stats').select('suggest_level, item_id').eq('item_code', itemCode).maybeSingle();
  if (!st?.suggest_level || st.suggest_level !== toLevel) return { ok: false, error: 'لا اقتراح قائمًا بهذا المستوى لهذا البند' };
  const { data: rows } = await db.from('question_bank_items').select('id, level').eq('item_code', itemCode).limit(5); const from = (rows || [])[0]?.level || '—';
  const upd = await db.from('question_bank_items').update({ level: toLevel, sub_band: null, updated_at: nowIso() }).eq('item_code', itemCode); if (upd.error) return { ok: false, error: upd.error.message };
  for (const r of (rows || []) as any[]) await db.from('question_bank_review_events').insert({ item_id: r.id, review_status: 'level_moved', academic_note: `ميزان مِعيار: نُقل من ${from} إلى ${toLevel} بقرار بشري بعد المعايرة`, reviewed_by: userId });
  await db.from('question_bank_item_stats').update({ suggest_level: null, level: toLevel, dismissed_level: null, dismissed_at: null }).eq('item_code', itemCode);
  return { ok: true };
}
export async function dismissSuggestion(db: any, itemCode: string): Promise<boolean> {
  const { data: st } = await db.from('question_bank_item_stats').select('suggest_level').eq('item_code', itemCode).maybeSingle(); if (!st?.suggest_level) return false;
  const r = await db.from('question_bank_item_stats').update({ dismissed_level: st.suggest_level, suggest_level: null, dismissed_at: nowIso() }).eq('item_code', itemCode); return !r.error;
}
export async function setAnchor(db: any, itemCode: string, anchor: boolean): Promise<boolean> { const r = await db.from('question_bank_items').update({ is_anchor: anchor, updated_at: nowIso() }).eq('item_code', itemCode); return !r.error; }
