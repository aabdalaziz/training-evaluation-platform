// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P44 «البرنامج الذي لم يُكتب بعد» — القراءة/الكتابة (Supabase بمفتاح الخدمة؛ البوابات في المسار)
 *  الحاجة (إنشاء · «وأنا أيضًا» · الإعلان عند خمسة · السحب · الطيّ الهادئ · الإحياء · الضمّ) · التبنّي (عضو هيئة/طاقم → مسودّة في هندسة البرامج)
 *  · الميلاد (من نشر المسودّة في /api/factory) · المقاعد الأولى (72 ساعة من فتح التسجيل، كسولًا عند أول زيارة لصفحة البرنامج) · جهة تحتاج · حاجة من ورشة تطبيق
 */
import { notify } from '../portal/notify';
import { SECTORS_2062, sectorByCode } from '../portal/lexicon';
import { EMPTY_NEED, draftTitle, localForesight, DRAFT_COLS } from '../portal/factory';
import type { Need as FactoryNeed } from '../portal/factory';
import { loadMyProfile } from '../directory/load';
import { NEED_COLS, NEED_K, PRIORITY_HOURS, P44_NAMES_AR, needView, visibleTo, isMine, canSupport, canAdopt, canWithdraw, canRevive, shouldFold, sortNeeds, addHours, bornLineAr, priorityState, needFromOfferText } from './registry';
import type { NeedRow, NeedView, NeedSource } from './registry';

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
const nowIso = () => new Date().toISOString();
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
export type Me = { id: string; email: string; name: string; staff: boolean; faculty?: boolean };
export const SECTOR_CODES: readonly string[] = SECTORS_2062.map(s => s.code);
export const sectorAr = (c: string) => sectorByCode(c)?.name.ar || c;
export const SECTOR_OPTIONS = SECTORS_2062.map(s => ({ code: s.code, ar: s.name.ar }));

/** عضو معتمَد في هيئة أَثَر (مدرّب/خبير) — يحقّ له التبنّي */
export async function isFaculty(db: any, me: { id: string; email: string }): Promise<boolean> { const p = await loadMyProfile(db, me).catch(() => null); return !!p && p.status === 'approved'; }

/* ───────── القراءة ───────── */
export async function needById(db: any, id: string): Promise<NeedRow | null> { return safe<NeedRow | null>(db.from('portal_needs').select(NEED_COLS).eq('id', id).maybeSingle(), null); }
async function supportsOf(db: any, needIds: string[], me: { id?: string | null; email?: string } | null): Promise<Set<string>> {
  if (!me || !needIds.length) return new Set(); const rows = await safe<any[]>(db.from('portal_need_supports').select('need_id,user_id,email').in('need_id', needIds).limit(5000), []);
  return new Set(rows.filter(r => (me.id && r.user_id === me.id) || lower(r.email) === lower(me.email)).map(r => String(r.need_id)));
}
async function orgNames(db: any, ids: string[]): Promise<Map<string, string>> { if (!ids.length) return new Map(); const rows = await safe<any[]>(db.from('portal_organizations').select('id,name_ar').in('id', ids).limit(200), []); return new Map(rows.map(r => [String(r.id), String(r.name_ar || '')])); }
async function toViews(db: any, rows: NeedRow[], me: Me | null): Promise<NeedView[]> {
  const sup = await supportsOf(db, rows.map(r => r.id), me); const orgs = await orgNames(db, Array.from(new Set(rows.map(r => r.organization_id).filter(Boolean) as string[])));
  return rows.map(n => needView(n, { me, supported: sup.has(n.id), sectorAr, orgName: n.organization_id ? orgs.get(n.organization_id) || null : null }));
}
/** اللوحة: العامة ترى المعلَنة؛ المسجَّل يرى البذور أيضًا وحاجاته كلها؛ مع الطيّ الهادئ الكسول */
export async function board(db: any, me: Me | null, site: string): Promise<{ items: NeedView[]; mine: NeedView[]; summary_rows: NeedRow[] }> {
  let rows = sortNeeds(await safe<NeedRow[]>(db.from('portal_needs').select(NEED_COLS).neq('status', 'merged').order('created_at', { ascending: false }).limit(500), []));
  rows = await foldStale(db, rows, site);
  const visible = rows.filter(n => visibleTo(n, me) && n.status !== 'withdrawn' && !(n.status === 'folded' && !(me && (me.staff || isMine(n, me)))));
  const views = await toViews(db, visible, me);
  const mine = me ? views.filter(v => v.mine) : [];
  return { items: views.filter(v => !v.mine || v.status !== 'folded'), mine, summary_rows: rows };
}
/** الطيّ الهادئ — بلا كرون: عند كل تحميل للوحة */
export async function foldStale(db: any, rows: NeedRow[], site: string, now = new Date()): Promise<NeedRow[]> {
  const out: NeedRow[] = [];
  for (const n of rows) {
    if (!shouldFold(n, now)) { out.push(n); continue; }
    const { error } = await db.from('portal_needs').update({ status: 'folded', folded_at: now.toISOString() }).eq('id', n.id).in('status', ['seed', 'open']);
    if (!error) { try { await notify(db, { kind: 'need_folded', to: { email: n.email }, ref: `need:folded:${n.id}`, subject: `حاجتك «${P44_NAMES_AR.waiting}»`, text: `مرّت تسعون يومًا على حاجتك «${n.text_ar}» ولم تجد كاتبها بعد، فطُويت بهدوء. تستطيع إحياءها بضغطة متى شئت.`, url: `${site}/needs` }); } catch { /* داخلي */ } out.push({ ...n, status: 'folded', folded_at: now.toISOString() }); }
    else out.push(n);
  }
  return out;
}

/* ───────── الكتابة ───────── */
export async function createNeed(db: any, me: Me, n: { sector: string; text_ar: string; source?: NeedSource; source_ref?: string | null; organization_id?: string | null; org_named?: boolean }, site: string): Promise<{ ok: true; need: NeedRow } | { ok: false; error: string }> {
  if (n.source === 'station' && n.source_ref) { const dup = await safe<any[]>(db.from('portal_needs').select('id').eq('source', 'station').eq('source_ref', n.source_ref).limit(1), []); if (dup.length) return { ok: false, error: 'حوّلت هذه المحطة إلى حاجة من قبل' }; }
  const open = n.source === 'org';   // صوت الجهة مؤسسي: يُعلَن مباشرة
  const row = { user_id: me.id, email: me.email, sector: n.sector, text_ar: n.text_ar, source: n.source || 'practitioner', source_ref: n.source_ref || null, organization_id: n.organization_id || null, org_named: !!n.org_named, status: open ? 'open' : 'seed', opened_at: open ? nowIso() : null };
  const { data, error } = await db.from('portal_needs').insert(row).select(NEED_COLS).single(); if (error) return { ok: false, error: `تعذّر الحفظ: ${error.message}` };
  void site; return { ok: true, need: data as NeedRow };
}
export async function supportNeed(db: any, me: Me, id: string, site: string): Promise<{ ok: true; need: NeedRow; opened: boolean } | { ok: false; error: string }> {
  const n = await needById(db, id); if (!n || !visibleTo(n, me)) return { ok: false, error: 'الحاجة غير موجودة' };
  const already = (await supportsOf(db, [id], me)).has(id); const c = canSupport(n, me, already); if (!c.ok) return c;
  const { error } = await db.from('portal_need_supports').insert({ need_id: id, user_id: me.id, email: me.email }); if (error) return { ok: false, error: 'أيّدتها من قبل' };
  const count = (await safe<any[]>(db.from('portal_need_supports').select('id').eq('need_id', id).limit(5000), [])).length;
  const opens = n.status === 'seed' && count >= NEED_K;
  const patch: any = { supports: count }; if (opens) { patch.status = 'open'; patch.opened_at = nowIso(); }
  await db.from('portal_needs').update(patch).eq('id', id);
  if (opens) { try { await notify(db, { kind: 'need_open', to: { email: n.email }, ref: `need:open:${id}`, subject: 'حاجتك أُعلنت', text: `قال خمسة غيرك «وأنا أيضًا» لحاجتك «${n.text_ar}» — صارت معلَنة للعالم بلا اسمك، وتنتظر كاتبها من هيئة أَثَر.`, url: `${site}/needs` }); } catch { /* داخلي */ } }
  return { ok: true, need: { ...n, ...patch }, opened: opens };
}
export async function withdrawNeed(db: any, me: Me, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = await needById(db, id); if (!n) return { ok: false, error: 'الحاجة غير موجودة' }; const c = canWithdraw(n, me); if (!c.ok) return c;
  const { error } = await db.from('portal_needs').update({ status: 'withdrawn', withdrawn_at: nowIso() }).eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
export async function reviveNeed(db: any, me: Me, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = await needById(db, id); if (!n) return { ok: false, error: 'الحاجة غير موجودة' }; const c = canRevive(n, me); if (!c.ok) return c;
  const status = n.supports >= NEED_K ? 'open' : 'seed';
  const { error } = await db.from('portal_needs').update({ status, revived_at: nowIso(), folded_at: null }).eq('id', id); return error ? { ok: false, error: error.message } : { ok: true };
}
/** المؤيّدون + الكاتب (للإشعارات) */
async function peopleOf(db: any, n: NeedRow): Promise<string[]> { const rows = await safe<any[]>(db.from('portal_need_supports').select('email').eq('need_id', n.id).limit(5000), []); return Array.from(new Set([lower(n.email), ...rows.map(r => lower(r.email))].filter(e => e && !e.endsWith('@athar.internal')))); }

/** التبنّي: عضو هيئة معتمَد أو طاقم → مسودّة في هندسة البرامج (استشراف محلي؛ الطاقم يعيده بالذكاء الاصطناعي إن شاء) */
export async function adoptNeed(db: any, me: Me, id: string, pitch_ar: string, site: string): Promise<{ ok: true; need: NeedRow; draft_id: string } | { ok: false; error: string }> {
  const n = await needById(db, id); if (!n || !visibleTo(n, me)) return { ok: false, error: 'الحاجة غير موجودة' };
  const prof: any = me.staff ? null : await loadMyProfile(db, me).catch(() => null); const faculty = !!prof && prof.status === 'approved'; const c = canAdopt(n, { faculty, staff: me.staff }); if (!c.ok) return c;
  const myName = me.name || String(prof?.name_ar || '');   // عضو الهيئة قد لا يملك صفًّا في profiles — اسمه من سيرته في الهيئة
  const fneed: FactoryNeed & { need_id?: string } = { ...EMPTY_NEED, sector: SECTOR_CODES.includes(n.sector) ? n.sector : EMPTY_NEED.sector, gap_ar: n.text_ar, audience_ar: n.source === 'org' ? 'منسوبو جهة أعلنت الحاجة' : 'ممارسون أعلنوا هذه الحاجة', org_name: null, need_id: n.id };
  const draft = { created_by: me.id, title_ar: draftTitle(fneed), need: fneed, stage: 'foresight', foresight: localForesight(fneed), notes: pitch_ar ? `تبنّاها ${myName || me.email}: ${pitch_ar}` : `تبنّاها ${myName || me.email}`, log: [{ at: nowIso(), by: myName || me.email, action: 'adopt', source: `need:${n.id}` }] };
  const { data: d, error } = await db.from('portal_program_drafts').insert(draft).select(DRAFT_COLS).single(); if (error) return { ok: false, error: `تعذّر إنشاء المسودّة: ${error.message}` };
  const patch = { status: 'adopted', adopter_user_id: me.id, adopter_email: me.email, adopter_kind: me.staff ? 'staff' : 'faculty', adopter_name_ar: myName || null, pitch_ar: pitch_ar || null, adopted_at: nowIso(), draft_id: String((d as any).id) };
  await db.from('portal_needs').update(patch).eq('id', id);
  for (const email of await peopleOf(db, n)) { try { await notify(db, { kind: 'need_adopted', to: { email }, ref: `need:adopted:${id}:${email}`, subject: `حاجة أعلنتها أو أيّدتها وجدت كاتبها`, text: `تبنّى ${myName || 'عضو في هيئة أَثَر'} الحاجة «${n.text_ar}» وبدأ تصميمها في هندسة البرامج. حين يولد البرنامج ستكون المقاعد الأولى لكم.`, url: `${site}/needs` }); } catch { /* داخلي */ } }
  return { ok: true, need: { ...n, ...(patch as any) }, draft_id: String((d as any).id) };
}
export async function abandonNeed(db: any, me: Me, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = await needById(db, id); if (!n) return { ok: false, error: 'الحاجة غير موجودة' };
  if (n.status !== 'adopted') return { ok: false, error: 'ليست متبنّاة' }; if (!me.staff && n.adopter_user_id !== me.id && lower(n.adopter_email) !== me.email) return { ok: false, error: 'لست متبنّيها' };
  const { error } = await db.from('portal_needs').update({ status: n.supports >= NEED_K ? 'open' : 'seed', adopter_user_id: null, adopter_email: null, adopter_kind: null, adopter_name_ar: null, pitch_ar: null, adopted_at: null }).eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}
/** الميلاد — من نشر المسودّة في /api/factory: سطر على البرنامج + إشعار للمؤيّدين */
export async function bornFromDraft(db: any, draftNeed: any, programId: string, programAr: string, site: string): Promise<boolean> {
  const id = String(draftNeed?.need_id || ''); if (!id) return false; const n = await needById(db, id); if (!n) return false;
  await db.from('programs').update({ born_from_need_id: id }).eq('id', programId);
  await db.from('portal_needs').update({ status: 'born', program_id: programId, born_at: nowIso() }).eq('id', id);
  for (const email of await peopleOf(db, n)) { try { await notify(db, { kind: 'need_born', to: { email }, ref: `need:born:${id}:${email}`, subject: `وُلد البرنامج الذي طلبتموه: «${programAr}»`, text: `من الحاجة «${n.text_ar}» وُلد برنامج «${programAr}». حين يُفتح التسجيل تكون المقاعد الأولى لكم ${PRIORITY_HOURS} ساعة.`, url: `${site}/programs/${programId}` }); } catch { /* داخلي */ } }
  return true;
}
/** صفحة البرنامج العامة: سطر الميلاد + المقاعد الأولى (تبدأ كسولًا حين يكون التسجيل مفتوحًا) */
export async function programBorn(db: any, programId: string, site: string, now = new Date()): Promise<{ line_ar: string; need_id: string; sector_ar: string; priority: { active: boolean; until: string | null } } | null> {
  const p = await safe<any>(db.from('programs').select('id,name_ar,born_from_need_id,registration_open').eq('id', programId).maybeSingle(), null); if (!p?.born_from_need_id) return null;
  let n = await needById(db, String(p.born_from_need_id)); if (!n) return null;
  if (p.registration_open && !n.priority_until) {
    const until = addHours(now, PRIORITY_HOURS); const { error } = await db.from('portal_needs').update({ priority_until: until }).eq('id', n.id).is('priority_until', null);
    if (!error) { n = { ...n, priority_until: until }; for (const email of await peopleOf(db, n)) { try { await notify(db, { kind: 'need_priority', to: { email }, ref: `need:priority:${n.id}:${email}`, subject: `فُتح التسجيل — المقاعد الأولى لكم ${PRIORITY_HOURS} ساعة`, text: `فُتح التسجيل في «${p.name_ar}» الذي وُلد من حاجتكم. المقاعد الأولى لكم حتى ${until.slice(0, 16).replace('T', ' ')}.`, url: `${site}/programs/${programId}` }); } catch { /* داخلي */ } } }
  }
  return { line_ar: bornLineAr(n.supports, sectorAr(n.sector)), need_id: n.id, sector_ar: sectorAr(n.sector), priority: priorityState(n, now) };
}
/** هل أنا من أصحاب المقاعد الأولى؟ (لصفحة البرنامج عند تسجيل الدخول) */
export async function amPriority(db: any, needId: string, me: { id: string; email: string }): Promise<boolean> { const n = await needById(db, needId); if (!n) return false; if (isMine(n, me)) return true; return (await supportsOf(db, [needId], me)).has(needId); }

/* ───────── جهة تحتاج ───────── */
export async function orgNeeds(db: any, orgId: string, me: Me | null): Promise<NeedView[]> {
  const rows = sortNeeds(await safe<NeedRow[]>(db.from('portal_needs').select(NEED_COLS).eq('organization_id', orgId).neq('status', 'withdrawn').neq('status', 'merged').limit(100), []));
  return toViews(db, rows, me);
}
/* ───────── حاجة من ورشة تطبيق (P39): خمسة «أرغب» → حاجة معلَنة باسم البرنامج ───────── */
export async function needFromOffer(db: any, offer: { id: string | number; program_id: string; title_ar: string; created_by: string | null }, programAr: string, wantEmails: string[], sector: string | null): Promise<boolean> {
  if (wantEmails.length < NEED_K) return false; const ref = `offer:${offer.id}`;
  const dup = await safe<any[]>(db.from('portal_needs').select('id').eq('source', 'offer').eq('source_ref', ref).limit(1), []); if (dup.length) return false;
  const { data, error } = await db.from('portal_needs').insert({ user_id: offer.created_by, email: 'offer@athar.internal', sector: sector && SECTOR_CODES.includes(sector) ? sector : 'training', text_ar: needFromOfferText(programAr, offer.title_ar), source: 'offer', source_ref: ref, status: 'open', opened_at: nowIso(), supports: wantEmails.length }).select('id').single();
  if (error || !data) return false;
  await db.from('portal_need_supports').insert(wantEmails.map(email => ({ need_id: (data as any).id, user_id: null, email: lower(email) })));
  return true;
}

/* ───────── الإدارة ───────── */
export async function adminNeeds(db: any): Promise<(NeedRow & { sector_ar: string; org_ar: string | null })[]> {
  const rows = sortNeeds(await safe<NeedRow[]>(db.from('portal_needs').select(NEED_COLS).order('created_at', { ascending: false }).limit(1000), []));
  const orgs = await orgNames(db, Array.from(new Set(rows.map(r => r.organization_id).filter(Boolean) as string[])));
  return rows.map(n => ({ ...n, sector_ar: sectorAr(n.sector), org_ar: n.organization_id ? orgs.get(n.organization_id) || null : null }));
}
export async function mergeNeeds(db: any, fromId: string, intoId: string): Promise<{ ok: true; supports: number } | { ok: false; error: string }> {
  if (fromId === intoId) return { ok: false, error: 'الحاجة نفسها' }; const a = await needById(db, fromId); const b = await needById(db, intoId); if (!a || !b) return { ok: false, error: 'الحاجة غير موجودة' };
  if (!['seed', 'open', 'folded'].includes(a.status) || !['seed', 'open', 'adopted'].includes(b.status)) return { ok: false, error: 'لا تُضمّ إلا حاجة مفتوحة إلى حاجة مفتوحة أو متبنّاة' };
  const from = await safe<any[]>(db.from('portal_need_supports').select('user_id,email').eq('need_id', fromId).limit(5000), []); const people = [{ user_id: a.user_id, email: a.email }, ...from];
  for (const p of people) { if (lower(p.email) === lower(b.email)) continue; await db.from('portal_need_supports').insert({ need_id: intoId, user_id: p.user_id || null, email: lower(p.email) }); }   // المكرَّر يُرفض بالفهرس الفريد
  const count = (await safe<any[]>(db.from('portal_need_supports').select('id').eq('need_id', intoId).limit(5000), [])).length;
  const patch: any = { supports: count }; if (b.status === 'seed' && count >= NEED_K) { patch.status = 'open'; patch.opened_at = nowIso(); }
  await db.from('portal_needs').update(patch).eq('id', intoId); await db.from('portal_needs').update({ status: 'merged', merged_into: intoId }).eq('id', fromId);
  return { ok: true, supports: count };
}
export async function deleteNeed(db: any, id: string): Promise<boolean> { const { error } = await db.from('portal_needs').delete().eq('id', id); return !error; }
