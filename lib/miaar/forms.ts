// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68-ب «النموذج المثبَّت» — الورقة نفسها لكل المتقدّمين على الدعوة، يراها المشرف قبلهم
 *  · تثبيت: سحب واحد بقواعد السحب الحالية (توازن الوحدات · «ما دُرّس فقط» · استبعاد ورقة الدعوة السابقة لنفس القاعة ★5) يُحفظ ببنوده وترتيبه
 *    في question_bank_forms / question_bank_form_items (موجودان منذ م1) — رمز ATH-FM-XXXX-XXXX · إصدار · بصمة · توقيع Ed25519 (★2)
 *  · أربعة أفعال: معاينة (نسخة المشرف بالنصوص) · تبديل بند ببديل من الخليّة نفسها (إصدار جديد) · استبدال كامل (إصدار جديد يستبعد القديم) · سحب (بسبب)
 *  · ★ «القفل عند أول جلسة»: ما إن تبدأ جلسة واحدة على الدعوة يُمنع التبديل والاستبدال؛ يبقى السحب بسبب إلزامي وحدث في الدرع
 *  · «ميزان النموذج» (★1) يزن ولا يمنع · «أثر الورقة بعد الاختبار» (★3) k ≥ 5 · «نسخة المراقب» (★4) بلا أسئلة
 *  · نصّ السؤال لا يخرج إلا في نسخة المشرف (API الطاقم) — التحقّق العام يرى الرموز والأعداد والبصمة فقط
 *  · لا حذف: الإصدارات والمسحوب تبقى في السجلّ (frozen · superseded · withdrawn)
 */
import { randomBytes } from 'node:crypto';
import { signReceipt, sha256 } from '../vault/subject';
import { canonical } from '../shield/seal';
import { securityEvent } from '../shield/guard';
import { drawPlan, type Plan, type DrawOpts } from './blueprint';
import { loadApprovedPool } from './bank';
import { resolvePlan, drawOptsFor } from './engine';
import { listUnits, approvedFor } from './syllabus';
import { exitLevelOf } from './exitflow';
import { SKILLS, skillLabel, type PoolItem } from './registry';

type Db = any;
const K = 5;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const FM_PREFIX = 'ATH-FM';
export function fmCode(rand: (n: number) => Buffer = randomBytes): string { const b = rand(8); let s = ''; for (let i = 0; i < 8; i++) s += ALPHABET[b[i] % ALPHABET.length]; return `${FM_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`; }
export const isFmCode = (c: unknown) => /^ATH-FM-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(String(c || '').trim().toUpperCase());
const UUID = /^[0-9a-f-]{36}$/i;
const nowIso = () => new Date().toISOString();
const cleanReason = (v: unknown) => String(v ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);
const arr = <T = any>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);

export type FormItem = { code: string; level: string; skill: string; position: number };
export type FormRow = { id: string; code: string; version: number; status: 'frozen' | 'superseded' | 'withdrawn' | string; invite_id: string | null; blueprint_id: string | null; title: string; digest: string | null; body: any; seed: string | null; draw_meta: any; changes: any[]; frozen_by: string | null; frozen_at: string | null; superseded_by: string | null; withdrawn_at: string | null; withdrawn_by: string | null; withdraw_reason: string | null; requirements: Plan | null; duration_seconds: number | null; created_at: string };
export type Who = { id: string; email?: string | null };
export type Lock = { locked: boolean; sessions: number; finished: number };
export type Fail = { ok: false; error: string; status?: number };
const COLS = 'id,code,version,status,invite_id,blueprint_id,title,digest,body,seed,draw_meta,changes,frozen_by,frozen_at,superseded_by,withdrawn_at,withdrawn_by,withdraw_reason,requirements,duration_seconds,created_at';

/* ───────────── البصمة والتوقيع ───────────── */
/** بصمة الورقة = الرمز + الإصدار + رموز البنود بترتيبها (لا نصوص) — تُعاد حسابها عند التحقّق */
export function fmDigest(code: string, version: number, codes: readonly string[]): string { return 'sha256:' + sha256(canonical({ code, version, items: [...codes] })); }
export function cellCounts(items: readonly { level: string; skill: string }[]): Record<string, number> { const out: Record<string, number> = {}; for (const it of items) { const k = `${it.level}:${it.skill}`; out[k] = (out[k] || 0) + 1; } return out; }

/* ───────────── القفل ───────────── */
/** «القفل عند أول جلسة»: أي جلسة (نشطة أو منتهية) على الدعوة تقفل التبديل والاستبدال */
export async function lockState(db: Db, inviteId: string | null): Promise<Lock> {
  if (!inviteId) return { locked: false, sessions: 0, finished: 0 };
  const { data } = await db.from('placement_secure_sessions').select('id,status').eq('invite_id', inviteId).limit(1000);
  const s = arr<any>(data); return { locked: s.length > 0, sessions: s.length, finished: s.filter((x) => x.status === 'finished' || x.status === 'completed').length };
}

/* ───────────── قراءة ───────────── */
export async function formById(db: Db, id: unknown): Promise<FormRow | null> { if (typeof id !== 'string' || !UUID.test(id)) return null; const { data } = await db.from('question_bank_forms').select(COLS).eq('id', id).maybeSingle(); return (data as FormRow) || null; }
/** أحدث إصدار بالرمز (الحيّ إن وُجد، وإلا الأعلى رقمًا) */
export async function formByCode(db: Db, code: unknown): Promise<FormRow | null> {
  const c = String(code || '').trim().toUpperCase(); if (!isFmCode(c)) return null;
  const { data } = await db.from('question_bank_forms').select(COLS).eq('code', c).order('version', { ascending: false }).limit(10);
  const rows = arr<FormRow>(data); return rows.find((r) => r.status === 'frozen') || rows[0] || null;
}
export async function liveFormForInvite(db: Db, inviteId: string): Promise<FormRow | null> { const { data } = await db.from('question_bank_forms').select(COLS).eq('invite_id', inviteId).eq('status', 'frozen').limit(1); return arr<FormRow>(data)[0] || null; }
export async function formItems(db: Db, formId: string): Promise<FormItem[]> {
  const { data } = await db.from('question_bank_form_items').select('item_code,level,skill,position').eq('form_id', formId).order('position', { ascending: true }).limit(500);
  return arr<any>(data).map((x, i) => ({ code: String(x.item_code || ''), level: String(x.level || ''), skill: String(x.skill || ''), position: Number(x.position ?? i) })).filter((x) => x.code);
}
async function inviteOf(db: Db, inviteId: string): Promise<any | null> { if (!UUID.test(inviteId)) return null; const { data } = await db.from('placement_invites').select('*').eq('id', inviteId).maybeSingle(); return data || null; }

/* ───────────── ★5 «المثبَّت يتذكّر»: بنود ورقة سابقة لنفس القاعة/المجموعة تُستبعد من السحب الجديد ───────────── */
export async function priorFormCodes(db: Db, invite: any): Promise<Set<string>> {
  const out = new Set<string>(); if (!invite) return out;
  const keys: Array<[string, string]> = []; if (invite.classroom_id) keys.push(['classroom_id', String(invite.classroom_id)]); else if (invite.program_id && invite.org_id) keys.push(['program_id', String(invite.program_id)]);
  if (!keys.length) return out;
  const { data: invs } = await db.from('placement_invites').select('id').eq(keys[0][0], keys[0][1]).neq('id', invite.id).limit(50); const ids = arr<any>(invs).map((x) => String(x.id)); if (!ids.length) return out;
  const { data: forms } = await db.from('question_bank_forms').select('id').in('invite_id', ids).limit(50); const fids = arr<any>(forms).map((x) => String(x.id)); if (!fids.length) return out;
  const { data: items } = await db.from('question_bank_form_items').select('item_code').in('form_id', fids).limit(2000); for (const it of arr<any>(items)) if (it.item_code) out.add(String(it.item_code));
  return out;
}
/** بنود عُرضت في نماذج مثبَّتة خلال آخر 90 يومًا (لـ«الميزان» و«البدائل») */
export async function recentlyShown(db: Db, exceptFormId: string | null, days = 90): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: forms } = await db.from('question_bank_forms').select('id').gte('created_at', since).in('status', ['frozen', 'superseded']).limit(200);
  const fids = arr<any>(forms).map((x) => String(x.id)).filter((id) => id !== exceptFormId); const out = new Set<string>(); if (!fids.length) return out;
  const { data: items } = await db.from('question_bank_form_items').select('item_code').in('form_id', fids).limit(5000); for (const it of arr<any>(items)) if (it.item_code) out.add(String(it.item_code));
  return out;
}

/* ───────────── ★1 «ميزان النموذج» ───────────── */
export type Balance = { cells: Array<{ level: string; skill: string; skill_ar: string; need: number; have: number; ok: boolean }>; units: { approved: number; covered: number; missing: string[]; scoped: boolean } | null; seen_recent: number; descriptors: number; tone: 'ok' | 'warn'; notes_ar: string[] };
export function balanceOf(plan: Plan, items: readonly FormItem[], pool: readonly PoolItem[], opts: { units?: readonly { code: string }[]; scoped?: boolean; seen?: ReadonlySet<string> } = {}): Balance {
  const have = cellCounts(items); const cells: Balance['cells'] = [];
  for (const level of plan.levels) for (const skill of SKILLS) { const need = plan.counts[level]?.[skill] || 0; if (!need) continue; const h = have[`${level}:${skill}`] || 0; cells.push({ level, skill, skill_ar: skillLabel(skill), need, have: h, ok: h >= need }); }
  const byCode = new Map(pool.map((p) => [p.code, p])); const descriptors = new Set(items.map((i) => byCode.get(i.code)?.descriptor).filter(Boolean)).size;
  let units: Balance['units'] = null;
  if (opts.units?.length) { const covered = new Set<string>(); for (const i of items) for (const u of byCode.get(i.code)?.unitCodes || []) covered.add(u); const missing = opts.units.map((u) => u.code).filter((c) => !covered.has(c)); units = { approved: opts.units.length, covered: opts.units.length - missing.length, missing, scoped: !!opts.scoped }; }
  const seen_recent = opts.seen ? items.filter((i) => opts.seen!.has(i.code)).length : 0;
  const notes_ar: string[] = []; const shortCells = cells.filter((c) => !c.ok); if (shortCells.length) notes_ar.push(`خلايا ناقصة عن المخطَّط: ${shortCells.map((c) => `${c.level}/${c.skill_ar} ${c.have}/${c.need}`).join(' · ')}`);
  if (units?.missing.length) notes_ar.push(`وحدات معتمدة لم تظهر ببند: ${units.missing.join(' · ')}`); if (seen_recent) notes_ar.push(`${seen_recent} من البنود عُرضت في نماذج مثبَّتة أخرى خلال 90 يومًا`);
  if (!notes_ar.length) notes_ar.push('الورقة موزونة على المخطَّط — القرار لك');
  return { cells, units, seen_recent, descriptors, tone: shortCells.length || units?.missing.length ? 'warn' : 'ok', notes_ar };
}

/* ───────────── التثبيت ───────────── */
type DrawCtx = { plan: Plan; blueprintId: string | null; pool: PoolItem[]; opts: DrawOpts | undefined; units: { code: string }[]; scoped: boolean };
async function drawContext(db: Db, invite: any, extraExclude?: ReadonlySet<string>): Promise<DrawCtx | Fail> {
  const inv = { id: invite.id, label_ar: invite.label_ar, exam_mode: invite.exam_mode, blueprint_id: invite.blueprint_id || null, exit: invite.purpose === 'level_exit' || invite.purpose === 'exit', unit_scope: invite.unit_scope, form_id: null };
  const r = await resolvePlan(db, { candidate: null, examMode: invite.exam_mode, invite: inv }); if (!r.ok) return { ok: false, error: `تعذّر تحديد المخطَّط (${r.code})`, status: 409 };
  const plan = r.value.plan; let opts = await drawOptsFor(db, plan, inv, null);
  const prior = await priorFormCodes(db, invite); for (const c of extraExclude || []) prior.add(c); if (prior.size) opts = { ...(opts || {}), exclude: new Set([...(opts?.exclude || []), ...prior]) };
  const pool = await loadApprovedPool(db); const lvl = exitLevelOf(plan); let units: { code: string }[] = []; try { if (lvl) units = approvedFor(await listUnits(db), lvl).map((u) => ({ code: u.code })); } catch { units = []; }
  return { plan, blueprintId: r.value.blueprintId, pool, opts, units, scoped: !!opts?.only?.length };
}
async function insertVersion(db: Db, p: { invite: any; code: string; version: number; codes: string[]; ctx: DrawCtx; seed: string; by: Who; changes: any[]; drawMeta: any; env?: Record<string, string | undefined>; site?: string }): Promise<{ ok: true; row: FormRow; items: FormItem[] } | Fail> {
  const byCode = new Map(p.ctx.pool.map((i) => [i.code, i])); const items: FormItem[] = p.codes.map((c, i) => { const it = byCode.get(c)!; return { code: c, level: it.level, skill: it.skill, position: i }; });
  const digest = fmDigest(p.code, p.version, p.codes);
  const doc = { type: 'AtharFrozenForm', code: p.code, version: p.version, invite_code: String(p.invite.code || ''), invite_label: String(p.invite.label_ar || ''), blueprint: p.ctx.plan.code, n: p.codes.length, cells: cellCounts(items), duration_seconds: p.ctx.plan.durationSeconds, digest };
  const body = await signReceipt(doc, p.env || process.env, p.site);
  const ins = await db.from('question_bank_forms').insert({
    title: `${p.ctx.plan.name_ar} — ${String(p.invite.label_ar || '')}`.slice(0, 180), test_type: p.ctx.plan.type, blueprint_id: p.ctx.blueprintId, selection_mode: 'frozen', status: 'frozen', requirements: p.ctx.plan, generation_seed: p.seed,
    created_by: p.by.id, purpose: p.invite.purpose || 'placement', level: exitLevelOf(p.ctx.plan) || null, duration_seconds: p.ctx.plan.durationSeconds, published_at: nowIso(), is_active: true,
    code: p.code, version: p.version, invite_id: p.invite.id, digest, proof: (body as any).proof || null, body, seed: p.seed, draw_meta: p.drawMeta, changes: p.changes, frozen_by: p.by.id, frozen_at: nowIso(),
  }).select(COLS).single();
  if (ins?.error || !ins?.data) return { ok: false, error: String(ins?.error?.message || 'تعذّر حفظ النموذج').slice(0, 160), status: 500 };
  const row = ins.data as FormRow;
  const rows = items.map((it) => ({ form_id: row.id, item_id: byCode.get(it.code)!.id, item_code: it.code, level: it.level, skill: it.skill, position: it.position, is_anchor: false, scored: true }));
  const ii = await db.from('question_bank_form_items').insert(rows); if (ii?.error) { await db.from('question_bank_forms').update({ status: 'withdrawn', withdraw_reason: 'items_failed', withdrawn_at: nowIso() }).eq('id', row.id); return { ok: false, error: 'تعذّر حفظ بنود النموذج', status: 500 }; }
  return { ok: true, row, items };
}
export type FreezeOut = { ok: true; form: FormRow; items: FormItem[]; balance: Balance } | Fail;
/** «ثبّت النموذج»: سحب واحد → إصدار 1 بالرمز الجديد؛ الدعوة تشير إليه */
export async function freezeForm(db: Db, p: { invite_id: unknown; by: Who; env?: Record<string, string | undefined>; site?: string; rand?: (n: number) => Buffer }): Promise<FreezeOut> {
  const inviteId = String(p.invite_id || ''); const invite = await inviteOf(db, inviteId); if (!invite) return { ok: false, error: 'الدعوة غير موجودة', status: 404 };
  if (await liveFormForInvite(db, inviteId)) return { ok: false, error: 'للدعوة نموذج مثبَّت بالفعل — بدّل بندًا أو اسحب نموذجًا جديدًا أو ألغِ التثبيت', status: 409 };
  const lock = await lockState(db, inviteId); if (lock.locked) return { ok: false, error: `بدأت ${lock.sessions} جلسة على هذه الدعوة — لا يُثبَّت نموذج بعد أول جلسة (أنشئ دعوة جديدة)`, status: 409 };
  const ctx = await drawContext(db, invite); if ('ok' in ctx) return ctx;
  const code = fmCode(p.rand); const seed = `${code}:${(p.rand || randomBytes)(6).toString('hex')}`;
  const drawn = drawPlan(ctx.pool, seed, ctx.plan, ctx.opts); if (!drawn || !drawn.codes.length) return { ok: false, error: 'البنك المعتمد لا يكفي لهذا المخطَّط', status: 503 };
  const r = await insertVersion(db, { invite, code, version: 1, codes: drawn.codes, ctx, seed, by: p.by, changes: [], drawMeta: { short: drawn.short, units: drawn.units || null, excluded_prior: ctx.opts?.exclude?.size || 0 }, env: p.env, site: p.site }); if (!r.ok) return r;
  await db.from('placement_invites').update({ form_id: r.row.id }).eq('id', inviteId);
  await securityEvent(db, { severity: 'info', kind: 'miaar_form_frozen', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { code, version: 1, invite: invite.code, n: drawn.codes.length } }, p.env || process.env).catch(() => null);
  return { ok: true, form: r.row, items: r.items, balance: balanceOf(ctx.plan, r.items, ctx.pool, { units: ctx.units, scoped: ctx.scoped, seen: await recentlyShown(db, r.row.id) }) };
}
/** إصدار جديد بنفس الرمز (تبديل بند أو استبدال كامل): القديم → superseded ويشير إلى الجديد؛ الدعوة تتبع الجديد */
async function newVersion(db: Db, old: FormRow, invite: any, codes: string[], ctx: DrawCtx, change: any, by: Who, drawMeta: any, env?: Record<string, string | undefined>, site?: string): Promise<{ ok: true; row: FormRow; items: FormItem[] } | Fail> {
  const version = Number(old.version || 1) + 1; const seed = `${old.code}:v${version}:${randomBytes(6).toString('hex')}`;
  const r = await insertVersion(db, { invite, code: old.code, version, codes, ctx, seed, by, changes: [...arr(old.changes), change], drawMeta, env, site }); if (!r.ok) return r;
  await db.from('question_bank_forms').update({ status: 'superseded', superseded_by: r.row.id, is_active: false }).eq('id', old.id);
  await db.from('placement_invites').update({ form_id: r.row.id }).eq('id', invite.id);
  return r;
}
async function liveOrFail(db: Db, formId: unknown): Promise<{ form: FormRow; invite: any } | Fail> {
  const form = await formById(db, formId); if (!form) return { ok: false, error: 'النموذج غير موجود', status: 404 }; if (form.status !== 'frozen') return { ok: false, error: form.status === 'withdrawn' ? 'هذا النموذج مسحوب' : 'هذا إصدار قديم — افتح الإصدار الحيّ', status: 409 };
  const invite = form.invite_id ? await inviteOf(db, form.invite_id) : null; if (!invite) return { ok: false, error: 'دعوة النموذج غير موجودة', status: 404 };
  return { form, invite };
}
/** بدائل بند: الخليّة نفسها (المستوى × المهارة × الواصف إن وُجد) − بنود الورقة − المعروض في نماذج أخرى حديثًا — بالنصوص (للطاقم) */
export async function alternativesFor(db: Db, formId: unknown, itemCode: unknown, limit = 8): Promise<{ ok: true; item: { code: string; level: string; skill: string; text: string }; alternatives: Array<{ code: string; text: string; descriptor: string | null; same_descriptor: boolean; seen_recent: boolean; units: string[] }> } | Fail> {
  const form = await formById(db, formId); if (!form) return { ok: false, error: 'النموذج غير موجود', status: 404 };
  const items = await formItems(db, form.id); const code = String(itemCode || ''); if (!items.some((i) => i.code === code)) return { ok: false, error: 'البند ليس في هذا النموذج', status: 404 };
  const pool = await loadApprovedPool(db); const it = pool.find((p) => p.code === code); if (!it) return { ok: false, error: 'البند لم يعد معتمدًا', status: 409 };
  const inForm = new Set(items.map((i) => i.code)); const seen = await recentlyShown(db, form.id);
  const cands = pool.filter((p) => p.level === it.level && p.skill === it.skill && !inForm.has(p.code) && p.passageId === it.passageId)
    .map((p) => ({ code: p.code, text: p.questionText, descriptor: p.descriptor, same_descriptor: !!it.descriptor && p.descriptor === it.descriptor, seen_recent: seen.has(p.code), units: p.unitCodes || [] }))
    .sort((a, b) => Number(b.same_descriptor) - Number(a.same_descriptor) || Number(a.seen_recent) - Number(b.seen_recent) || a.code.localeCompare(b.code)).slice(0, limit);
  return { ok: true, item: { code: it.code, level: it.level, skill: it.skill, text: it.questionText }, alternatives: cands };
}
/** تبديل بند واحد ببديل من الخليّة نفسها — بسبب قصير — إصدار جديد */
export async function swapItem(db: Db, p: { form_id: unknown; from: unknown; to: unknown; reason: unknown; by: Who; env?: Record<string, string | undefined>; site?: string }): Promise<{ ok: true; form: FormRow; items: FormItem[] } | Fail> {
  const lf = await liveOrFail(db, p.form_id); if ('ok' in lf) return lf; const { form, invite } = lf;
  const lock = await lockState(db, invite.id); if (lock.locked) return { ok: false, error: `القفل عند أول جلسة: بدأت ${lock.sessions} جلسة — لا تبديل بعدها`, status: 423 };
  const reason = cleanReason(p.reason); if (reason.length < 3) return { ok: false, error: 'اكتب سبب التبديل (3 أحرف فأكثر)' };
  const from = String(p.from || ''); const to = String(p.to || ''); const items = await formItems(db, form.id); if (!items.some((i) => i.code === from)) return { ok: false, error: 'البند ليس في النموذج', status: 404 }; if (items.some((i) => i.code === to)) return { ok: false, error: 'البديل موجود في النموذج أصلًا' };
  const ctx = await drawContext(db, invite); if ('ok' in ctx) return ctx; const byCode = new Map(ctx.pool.map((i) => [i.code, i])); const a = byCode.get(from); const b = byCode.get(to); if (!a || !b) return { ok: false, error: 'البديل غير معتمد', status: 409 }; if (a.level !== b.level || a.skill !== b.skill) return { ok: false, error: 'البديل من خليّة مختلفة (المستوى × المهارة)' };
  const codes = items.map((i) => (i.code === from ? to : i.code));
  const r = await newVersion(db, form, invite, codes, ctx, { kind: 'swap', at: nowIso(), by: p.by.id, from, to, reason, version: Number(form.version || 1) + 1 }, p.by, form.draw_meta, p.env, p.site); if (!r.ok) return r;
  await securityEvent(db, { severity: 'info', kind: 'miaar_form_changed', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { code: form.code, version: r.row.version, kind: 'swap', from, to, reason } }, p.env || process.env).catch(() => null);
  return { ok: true, form: r.row, items: r.items };
}
/** استبدال كامل: سحب جديد يستبعد بنود الإصدار الحالي — إصدار جديد */
export async function redrawForm(db: Db, p: { form_id: unknown; reason?: unknown; by: Who; env?: Record<string, string | undefined>; site?: string }): Promise<{ ok: true; form: FormRow; items: FormItem[]; overlap: number } | Fail> {
  const lf = await liveOrFail(db, p.form_id); if ('ok' in lf) return lf; const { form, invite } = lf;
  const lock = await lockState(db, invite.id); if (lock.locked) return { ok: false, error: `القفل عند أول جلسة: بدأت ${lock.sessions} جلسة — لا استبدال بعدها`, status: 423 };
  const old = await formItems(db, form.id); const oldSet = new Set(old.map((i) => i.code));
  const ctx = await drawContext(db, invite, oldSet); if ('ok' in ctx) return ctx;
  const seed = `${form.code}:redraw:${randomBytes(6).toString('hex')}`; const drawn = drawPlan(ctx.pool, seed, ctx.plan, ctx.opts); if (!drawn || !drawn.codes.length) return { ok: false, error: 'البنك المعتمد لا يكفي لسحب جديد', status: 503 };
  const overlap = drawn.codes.filter((c) => oldSet.has(c)).length;
  const r = await newVersion(db, form, invite, drawn.codes, ctx, { kind: 'redraw', at: nowIso(), by: p.by.id, reason: cleanReason(p.reason) || null, overlap, version: Number(form.version || 1) + 1 }, p.by, { short: drawn.short, units: drawn.units || null, excluded_prior: ctx.opts?.exclude?.size || 0 }, p.env, p.site); if (!r.ok) return r;
  await securityEvent(db, { severity: 'info', kind: 'miaar_form_changed', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { code: form.code, version: r.row.version, kind: 'redraw', overlap } }, p.env || process.env).catch(() => null);
  return { ok: true, form: r.row, items: r.items, overlap };
}
/** «ألغِ التثبيت»: بسبب إلزامي — يعمل حتى بعد القفل (الجلسات التي بدأت تُكمل ورقتها المخزَّنة) — الدعوة تعود عشوائية */
export async function withdrawForm(db: Db, p: { form_id: unknown; reason: unknown; by: Who; env?: Record<string, string | undefined>; site?: string }): Promise<{ ok: true; form: FormRow; locked_sessions: number } | Fail> {
  const lf = await liveOrFail(db, p.form_id); if ('ok' in lf) return lf; const { form, invite } = lf;
  const reason = cleanReason(p.reason); if (reason.length < 5) return { ok: false, error: 'سبب السحب إلزامي (5 أحرف فأكثر)' };
  const lock = await lockState(db, invite.id);
  const up = await db.from('question_bank_forms').update({ status: 'withdrawn', is_active: false, withdrawn_at: nowIso(), withdrawn_by: p.by.id, withdraw_reason: reason }).eq('id', form.id).select(COLS).single(); if (up?.error) return { ok: false, error: 'تعذّر السحب', status: 500 };
  await db.from('placement_invites').update({ form_id: null }).eq('id', invite.id);
  await securityEvent(db, { severity: lock.locked ? 'warn' : 'info', kind: 'miaar_form_withdrawn', actor: p.by.email || p.by.id, user_id: p.by.id, meta: { code: form.code, version: form.version, invite: invite.code, reason, sessions_started: lock.sessions } }, p.env || process.env).catch(() => null);
  return { ok: true, form: up.data as FormRow, locked_sessions: lock.sessions };
}

/* ───────────── المعاينة (نسخة المشرف) · التحقّق · الأداء · نسخة المراقب ───────────── */
export type PreviewItem = FormItem & { no: number; skill_ar: string; text?: string; options?: Array<{ id: string; text: string; correct: boolean }>; descriptor?: string | null; passage?: { title: string; text: string } | null; units?: string[] };
export type Preview = { form: Omit<FormRow, 'body' | 'requirements'> & { plan_name_ar: string; plan_code: string; duration_minutes: number | null }; invite: { id: string; code: string; label_ar: string; status: string; lang: string } | null; lock: Lock; items: PreviewItem[]; balance: Balance | null; versions: Array<{ id: string; version: number; status: string; created_at: string }>; with_text: boolean; note_ar: string };
export async function previewForm(db: Db, idOrCode: unknown, opts: { withText?: boolean; site?: string } = {}): Promise<Preview | null> {
  const form = UUID.test(String(idOrCode || '')) ? await formById(db, idOrCode) : await formByCode(db, idOrCode); if (!form) return null;
  const [items, invite, lock, pool, vers] = await Promise.all([formItems(db, form.id), form.invite_id ? inviteOf(db, form.invite_id) : Promise.resolve(null), lockState(db, form.invite_id), opts.withText ? loadApprovedPool(db).catch(() => [] as PoolItem[]) : Promise.resolve([] as PoolItem[]), db.from('question_bank_forms').select('id,version,status,created_at').eq('code', form.code).order('version', { ascending: true }).limit(50)]);
  const plan = (form.requirements || null) as Plan | null; const byCode = new Map(pool.map((p) => [p.code, p]));
  let passages = new Map<string, { title: string; text: string }>();
  if (opts.withText) { const pids = [...new Set(items.map((i) => byCode.get(i.code)?.passageId).filter(Boolean))] as string[]; if (pids.length) { const { data } = await db.from('miaar_passages').select('id,title,text').in('id', pids).limit(100); passages = new Map(arr<any>(data).map((p) => [String(p.id), { title: String(p.title || ''), text: String(p.text || '') }])); } }
  const out: PreviewItem[] = items.map((it, i) => { const p = byCode.get(it.code); const base: PreviewItem = { ...it, no: i + 1, skill_ar: skillLabel(it.skill) }; if (!opts.withText || !p) return base; return { ...base, text: p.questionText, options: p.options.map((o) => ({ id: o.id, text: o.text, correct: o.id === p.correctOptionId })), descriptor: p.descriptor, passage: p.passageId ? passages.get(p.passageId) || null : null, units: p.unitCodes || [] }; });
  let balance: Balance | null = null;
  if (plan && opts.withText) { try { const lvl = exitLevelOf(plan); const units = lvl ? approvedFor(await listUnits(db), lvl).map((u) => ({ code: u.code })) : []; balance = balanceOf(plan, items, pool, { units, scoped: !!form.draw_meta?.units?.scoped, seen: await recentlyShown(db, form.id) }); } catch { balance = null; } }
  const { body: _b, requirements: _r, ...rest } = form; void _b; void _r;
  return { form: { ...rest, plan_name_ar: String(plan?.name_ar || form.title), plan_code: String(plan?.code || ''), duration_minutes: form.duration_seconds ? Math.round(form.duration_seconds / 60) : null }, invite: invite ? { id: invite.id, code: invite.code, label_ar: invite.label_ar, status: invite.status, lang: invite.lang } : null, lock, items: out, balance, versions: arr<any>(vers?.data).map((v) => ({ id: v.id, version: v.version, status: v.status, created_at: v.created_at })), with_text: !!opts.withText, note_ar: opts.withText ? 'نسخة المشرف: تحوي نصوص البنود والإجابات الصحيحة — لا تُسلَّم للمتقدّم ولا تُنشر.' : 'رموز البنود فقط.' };
}
/** ★2 التحقّق العام — بلا نصوص: الرمز · الإصدار · الحالة · عدد البنود وخلاياه · الدعوة (تسميتها) · البصمة وسلامتها · كم جلسة حُكمت بها */
export type VerifyForm = { valid: boolean; intact?: boolean; status?: string; live?: boolean; form?: { code: string; version: number; n: number; cells: Record<string, number>; frozen_at: string | null; withdrawn_at: string | null; invite_label: string; blueprint: string; duration_minutes: number | null; sessions: number; versions: number; signed: boolean } };
/** كم جلسة حُكمت بهذه الورقة تحديدًا (الرمز + الإصدار) — لا كل جلسات الدعوة */
export async function sessionsOnForm(db: Db, form: Pick<FormRow, 'code' | 'version' | 'invite_id'>): Promise<number> {
  if (!form.invite_id) return 0; const { data } = await db.from('placement_secure_sessions').select('id,candidate').eq('invite_id', form.invite_id).limit(2000);
  return arr<any>(data).filter((s) => s?.candidate?.frozenForm?.code === form.code && Number(s.candidate.frozenForm.version || 1) === Number(form.version || 1)).length;
}
export async function verifyForm(db: Db, code: unknown): Promise<VerifyForm> {
  const form = await formByCode(db, code); if (!form) return { valid: false };
  const [items, vers, onForm] = await Promise.all([formItems(db, form.id), db.from('question_bank_forms').select('id', { count: 'exact', head: true }).eq('code', form.code), sessionsOnForm(db, form)]);
  const lock = { sessions: onForm };
  const intact = fmDigest(form.code, Number(form.version || 1), items.map((i) => i.code)) === form.digest && String(form.body?.digest || '') === form.digest;
  return { valid: true, intact, status: form.status, live: form.status === 'frozen', form: { code: form.code, version: Number(form.version || 1), n: items.length, cells: cellCounts(items), frozen_at: form.frozen_at, withdrawn_at: form.withdrawn_at, invite_label: String(form.body?.invite_label || ''), blueprint: String(form.body?.blueprint || ''), duration_minutes: form.duration_seconds ? Math.round(form.duration_seconds / 60) : null, sessions: lock.sessions, versions: Number(vers?.count || 0), signed: !!form.body?.proof } };
}
/** ★3 «أثر الورقة بعد الاختبار»: لكل بند نسبة الصواب وتمييزه البسيط (أعلى ثلث − أدنى ثلث بالنسبة الكلّية) — k ≥ 5 تقارير */
export type ItemPerf = { code: string; level: string; skill: string; skill_ar: string; n: number; p: number; discrimination: number | null; flag: 'ok' | 'easy' | 'hard' | 'weak' };
export type Performance = { ok: boolean; reports: number; reason?: string; items: ItemPerf[]; review_suggested: string[] };
export function computePerformance(items: readonly FormItem[], reports: ReadonlyArray<{ items: ReadonlyArray<{ code: string; correct: boolean | null }> }>): Performance {
  if (reports.length < K) return { ok: false, reports: reports.length, reason: `يحتاج ${K} تقارير على الأقل (الآن ${reports.length})`, items: [], review_suggested: [] };
  const scored = reports.map((r) => { const tried = r.items.filter((x) => x.correct !== null); return { r, total: tried.length ? tried.filter((x) => x.correct).length / tried.length : 0 }; }).sort((a, b) => a.total - b.total);
  const third = Math.max(1, Math.floor(scored.length / 3)); const low = scored.slice(0, third); const high = scored.slice(-third);
  const pOf = (rs: typeof scored, code: string) => { const xs = rs.map((s) => s.r.items.find((x) => x.code === code)).filter((x): x is { code: string; correct: boolean | null } => !!x && x.correct !== null); return xs.length ? xs.filter((x) => x.correct).length / xs.length : null; };
  const out: ItemPerf[] = items.map((it) => { const all = scored.map((s) => s.r.items.find((x) => x.code === it.code)).filter((x): x is { code: string; correct: boolean | null } => !!x && x.correct !== null); const n = all.length; const p = n ? all.filter((x) => x.correct).length / n : 0; const ph = pOf(high, it.code); const pl = pOf(low, it.code); const d = ph !== null && pl !== null && scored.length >= 6 ? Math.round((ph - pl) * 100) / 100 : null; const flag: ItemPerf['flag'] = d !== null && d < 0.1 && n >= K ? 'weak' : p >= 0.95 && n >= K ? 'easy' : p <= 0.2 && n >= K ? 'hard' : 'ok'; return { code: it.code, level: it.level, skill: it.skill, skill_ar: skillLabel(it.skill), n, p: Math.round(p * 100) / 100, discrimination: d, flag }; });
  return { ok: true, reports: reports.length, items: out, review_suggested: out.filter((x) => x.flag === 'weak').map((x) => x.code) };
}
export async function performanceOf(db: Db, formId: unknown): Promise<Performance | null> {
  const form = await formById(db, formId); if (!form || !form.invite_id) return null; const items = await formItems(db, form.id);
  const { data } = await db.from('placement_reports').select('id,report,submission_id').eq('invite_id', form.invite_id).limit(500);
  const reports = arr<any>(data).map((r) => ({ items: arr<any>(r.report?.بنود_الجلسة).map((it) => ({ code: String(it.الرمز || ''), correct: it.النتيجة === 'صحيح' ? true : it.النتيجة === 'غير صحيح' || it.النتيجة === 'خطأ' ? false : null })) }));
  return computePerformance(items, reports);
}
/** ★4 «نسخة المراقب»: ورقة القاعة بلا أسئلة */
export async function proctorSheet(db: Db, formId: unknown, site: string): Promise<{ invite_code: string; invite_label: string; invite_url: string; form_code: string; version: number; n: number; duration_minutes: number | null; cells: Array<{ level: string; skill_ar: string; n: number }>; frozen_at: string | null; digest: string | null } | null> {
  const form = await formById(db, formId); if (!form || !form.invite_id) return null; const invite = await inviteOf(db, form.invite_id); if (!invite) return null; const items = await formItems(db, form.id);
  const cells = Object.entries(cellCounts(items)).map(([k, n]) => { const [level, skill] = k.split(':'); return { level, skill_ar: skillLabel(skill), n }; });
  return { invite_code: String(invite.code), invite_label: String(invite.label_ar || ''), invite_url: `${site.replace(/\/$/, '')}/miaar/d/${invite.code}`, form_code: form.code, version: Number(form.version || 1), n: items.length, duration_minutes: form.duration_seconds ? Math.round(form.duration_seconds / 60) : null, cells, frozen_at: form.frozen_at, digest: form.digest };
}
