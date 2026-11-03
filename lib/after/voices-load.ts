// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P39 «أصوات حول الشهادة» — القراءة/الكتابة (Supabase بمفتاح الخدمة؛ البوابات في المسار)
 *  الرسالة (كتابة داخل نافذتها · فتح مع محطة السنة · سطر الوثيقة) · البرنامج يردّ (المُطلِق · العرض · الإجابة · الأعداد للطاقم)
 *  · محطة الجهة (الأهلية بخمسة منسوبين · الكتابة مرة · النشر بإذن الجهة) · القياس في مِعيار (الالتحاق ↔ بعد البرنامج · خيار الوثيقة · سطر البرنامج من خمسة)
 */
import { notify } from '../portal/notify';
import { attemptsByEmail } from '../miaar/growth';
import { STATION_AR, stationWindow, stationPhase } from './registry';
import type { StationRow } from './registry';
import { letterWindow, canWriteLetter, shouldUnseal, offerTrigger, noChancePeople, canWriteOrgStation, orgStationPhase, measureOf, programMeasureLine, ORG_STATE_AR, OFFER_LINE_AR, P39_NAMES_AR } from './voices';
import type { LetterRow, LetterPhase, OfferRow, OfferReply, OrgStationRow, OrgState, OrgSaid, Measure } from './voices';
import { letterPhase } from './voices';

const LCOLS = 'id,enrollment_id,program_id,user_id,email,text_ar,sealed_at,opened_at,in_doc';
const OCOLS = 'id,program_id,title_ar,text_ar,link,created_by,created_at,closed_at';
const GCOLS = 'id,program_id,organization_id,state,text_ar,public,written_by,written_at,notified_at';
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
type Enr = { id: string; program_id: string; program_ar: string; end_day: string; user_id: string | null; email: string; full_name?: string | null; organization_id?: string | null; placement_level?: string | null };

/* ───────── 1) الرسالة ───────── */
export async function lettersOf(db: any, enrollmentIds: string[]): Promise<LetterRow[]> { if (!enrollmentIds.length) return []; return safe<LetterRow[]>(db.from('portal_after_letters').select(LCOLS).in('enrollment_id', enrollmentIds).limit(200), []); }
export type LetterView = { phase: LetterPhase; opens: string; closes: string; unseals: string; sealed_at: string | null; opened_at: string | null; text_ar: string | null; in_doc: boolean; id: number | string | null };
export function letterView(e: Enr, row: LetterRow | null, now = new Date()): LetterView {
  const w = letterWindow(e.end_day); const ph = letterPhase(e.end_day, row, now);
  return { phase: ph, opens: w.opens, closes: w.closes, unseals: w.unseals, sealed_at: row?.sealed_at || null, opened_at: row?.opened_at || null, text_ar: ph === 'opened' ? String(row?.text_ar || '') : null, in_doc: !!row?.in_doc, id: row?.id ?? null };
}
export async function writeLetter(db: any, me: { id: string; email: string }, e: Enr, text_ar: string, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const existing = (await lettersOf(db, [e.id]))[0] || null; const can = canWriteLetter(e.end_day, existing, now); if (!can.ok) return can;
  const { error } = await db.from('portal_after_letters').insert({ enrollment_id: e.id, program_id: e.program_id, user_id: e.user_id || me.id, email: e.email, text_ar, sealed_at: now.toISOString() });
  if (error) return { ok: false, error: error.message }; return { ok: true };
}
/** فتح الرسائل التي حانت محطة سنتها — تُستدعى من openStations (الكرون القائم) ومن زيارة المتدرّب؛ مرة واحدة لكل رسالة */
export async function unsealLetters(db: any, items: { e: Enr; row: LetterRow | null }[], site: string, now = new Date(), dry = false): Promise<number> {
  let n = 0;
  for (const { e, row } of items) {
    if (!row || !shouldUnseal(e.end_day, row, now)) continue; n++; if (dry) continue;
    try {
      await db.from('portal_after_letters').update({ opened_at: now.toISOString() }).eq('id', row.id).is('opened_at', null);
      await notify(db, { kind: 'after_letter', to: { email: lower(row.email), name: e.full_name || null }, ref: `after:letter:${row.id}`, subject: `رسالتك من قبل سنة وصلت — «${e.program_ar}»`, text: `يوم أتممتَ «${e.program_ar}» كتبتَ رسالة إلى نفسك بعد سنة. فُتحت اليوم مع محطة السنة — اقرأها ثم اكتب ما فعلته فعلًا.\nافتح: ${site}/me/after`, url: `${site}/me/after` });
    } catch { /* لا تُعطّل البقية */ }
  }
  return n;
}
export async function setLetterInDoc(db: any, me: { id: string; email: string }, id: string | number, on: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await safe<LetterRow | null>(db.from('portal_after_letters').select(LCOLS).eq('id', id).maybeSingle(), null); if (!row || !(row.user_id === me.id || lower(row.email) === lower(me.email))) return { ok: false, error: 'ليست رسالتك' };
  if (!row.opened_at) return { ok: false, error: 'الرسالة مختومة بعد' };
  await db.from('portal_after_letters').update({ in_doc: on }).eq('id', row.id); return { ok: true };
}

/* ───────── 2) البرنامج يردّ ───────── */
export async function openOffersFor(db: any, programIds: string[]): Promise<OfferRow[]> { if (!programIds.length) return []; return safe<OfferRow[]>(db.from('portal_after_offers').select(OCOLS).in('program_id', programIds).is('closed_at', null).order('created_at', { ascending: false }).limit(100), []); }
export async function allOffersFor(db: any, programIds: string[]): Promise<OfferRow[]> { if (!programIds.length) return []; return safe<OfferRow[]>(db.from('portal_after_offers').select(OCOLS).in('program_id', programIds).order('created_at', { ascending: false }).limit(200), []); }
export async function repliesOf(db: any, offerIds: (string | number)[]): Promise<{ offer_id: number | string; enrollment_id: string; reply: OfferReply; at: string }[]> { if (!offerIds.length) return []; return safe<any[]>(db.from('portal_after_offer_replies').select('offer_id,enrollment_id,user_id,email,reply,at').in('offer_id', offerIds).limit(5000), []); }
export type OfferView = { id: number | string; title_ar: string; text_ar: string; link: string | null; created_at: string; my_reply: OfferReply | null };
/** ما يراه المتدرّب: عرض مفتوح لبرنامجه إن كان ممّن كتبوا «لم تسنح الفرصة» */
export function offerViewFor(e: Enr, stations: StationRow[], offers: OfferRow[], replies: { offer_id: number | string; enrollment_id: string; reply: OfferReply }[]): OfferView | null {
  const mine = stations.some(r => String(r.enrollment_id) === e.id && r.written_at && r.state === 'no_chance'); if (!mine) return null;
  const o = offers.find(x => String(x.program_id) === e.program_id && !x.closed_at); if (!o) return null;
  const r = replies.find(x => String(x.offer_id) === String(o.id) && String(x.enrollment_id) === e.id) || null;
  return { id: o.id, title_ar: o.title_ar, text_ar: o.text_ar, link: o.link, created_at: o.created_at, my_reply: r?.reply || null };
}
export async function replyOffer(db: any, me: { id: string; email: string }, ens: Enr[], stations: StationRow[], offerId: unknown, reply: OfferReply, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const o = await safe<OfferRow | null>(db.from('portal_after_offers').select(OCOLS).eq('id', offerId).maybeSingle(), null); if (!o || o.closed_at) return { ok: false, error: 'لا عرض قائمًا' };
  const e = ens.find(x => x.program_id === String(o.program_id)); if (!e) return { ok: false, error: 'العرض ليس لبرنامج أتممته' };
  if (!stations.some(r => String(r.enrollment_id) === e.id && r.written_at && r.state === 'no_chance')) return { ok: false, error: 'العرض لمن كتبوا «لم تسنح الفرصة»' };
  const prev = (await repliesOf(db, [o.id])).find(r => String(r.enrollment_id) === e.id);
  if (prev) await db.from('portal_after_offer_replies').update({ reply, at: now.toISOString() }).eq('offer_id', o.id).eq('enrollment_id', e.id);
  else { const { error } = await db.from('portal_after_offer_replies').insert({ offer_id: o.id, enrollment_id: e.id, user_id: e.user_id || me.id, email: e.email, reply, at: now.toISOString() }); if (error) return { ok: false, error: error.message }; }
  return { ok: true };
}
export async function createOffer(db: any, programId: string, o: { title_ar: string; text_ar: string; link: string | null }, by: string, stations: StationRow[], now = new Date()): Promise<{ ok: true; id: number | string } | { ok: false; error: string }> {
  const t = offerTrigger(stations.filter(r => String(r.program_id) === programId)); if (!t.ready) return { ok: false, error: t.line_ar };
  const open = await openOffersFor(db, [programId]); if (open.length) return { ok: false, error: 'للبرنامج عرض قائم — أغلقه أولًا' };
  const { data, error } = await db.from('portal_after_offers').insert({ program_id: programId, title_ar: o.title_ar, text_ar: o.text_ar, link: o.link, created_by: by, created_at: now.toISOString() }).select('id').single();
  if (error || !data) return { ok: false, error: error?.message || 'تعذّر حفظ العرض' };
  /* إشعار داخلي لأصحاب «لم تسنح» في هذا البرنامج — مرة واحدة */
  const people = new Map<string, string | null>(); for (const r of stations) if (String(r.program_id) === programId && r.written_at && r.state === 'no_chance' && r.email) people.set(lower(r.email), null);
  for (const email of Array.from(people.keys())) { try { await notify(db, { kind: 'after_offer', to: { email, name: null }, ref: `after:offer:${(data as any).id}:${email}`, subject: `${P39_NAMES_AR.offer}: ${o.title_ar}`, text: `${o.text_ar}\nأجب بـ«أرغب» أو «لا، شكرًا» من محطاتك.`, url: null }); } catch { /* تجاهل */ } }
  return { ok: true, id: (data as any).id };
}
export async function closeOffer(db: any, id: unknown, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const o = await safe<OfferRow | null>(db.from('portal_after_offers').select(OCOLS).eq('id', id).maybeSingle(), null); if (!o) return { ok: false, error: 'لا عرض' };
  await db.from('portal_after_offers').update({ closed_at: now.toISOString() }).eq('id', o.id); return { ok: true };
}
/** للطاقم: لكل برنامج — المُطلِق والعروض بأعداد الإجابات */
export async function adminOffers(db: any, programIds: string[], stationsByProgram: Map<string, StationRow[]>) {
  const offers = await allOffersFor(db, programIds); const replies = await repliesOf(db, offers.map(o => o.id)); const out: Record<string, any> = {};
  for (const pid of programIds) {
    const st = stationsByProgram.get(pid) || []; const trig = offerTrigger(st);
    out[pid] = { trigger: trig, no_chance_texts: st.filter(r => r.written_at && r.state === 'no_chance' && r.text_ar).map(r => String(r.text_ar)), offers: offers.filter(o => String(o.program_id) === pid).map(o => ({ ...o, want: replies.filter(r => String(r.offer_id) === String(o.id) && r.reply === 'want').length, no: replies.filter(r => String(r.offer_id) === String(o.id) && r.reply === 'no').length })) };
  }
  return out;
}
export async function programOfferLine(db: any, programId: string): Promise<string | null> { const all = await allOffersFor(db, [programId]); return all.length ? OFFER_LINE_AR : null; }

/* ───────── 3) محطة الجهة ───────── */
export type OrgStationView = { program_id: string; program_ar: string; end_day: string; members: number; phase: ReturnType<typeof orgStationPhase>; opens: string; closes: string; row: OrgStationRow | null; eligible: boolean };
/** برامج انتهت وفيها ≥ k من منسوبي الجهة المؤكَّدين بتسجيل مقبول — ومحطة الجهة لكل منها */
export async function orgStationsOf(db: any, orgId: string, now = new Date(), k = 5): Promise<OrgStationView[]> {
  const mem = await safe<any[]>(db.from('portal_org_members').select('user_id,email').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000), []);
  const emails = new Set(mem.map(m => lower(m.email)).filter(Boolean)); const ids = new Set(mem.map(m => String(m.user_id || '')).filter(Boolean));
  if (!emails.size && !ids.size) return [];
  const ens = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,user_id,email').eq('status', 'approved').limit(10000), []);
  const byProg = new Map<string, Set<string>>();
  for (const e of ens) { const em = lower(e.email); const uid = String(e.user_id || ''); if (!(emails.has(em) || (uid && ids.has(uid)))) continue; const pid = String(e.program_id); if (!byProg.has(pid)) byProg.set(pid, new Set()); byProg.get(pid)!.add(em || uid); }
  const pids = Array.from(byProg.keys()); if (!pids.length) return [];
  const today = now.toISOString().slice(0, 10);
  const progs = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').in('id', pids).limit(200), []);
  const rows = await safe<OrgStationRow[]>(db.from('portal_after_org_stations').select(GCOLS).eq('organization_id', orgId).in('program_id', pids).limit(200), []);
  const out: OrgStationView[] = [];
  for (const p of progs) { if (!p?.end_date || String(p.end_date).slice(0, 10) > today) continue; const pid = String(p.id); const end_day = String(p.end_date).slice(0, 10); const members = byProg.get(pid)?.size || 0; const row = rows.find(r => String(r.program_id) === pid) || null; const w = stationWindow(end_day, 365);
    out.push({ program_id: pid, program_ar: String(p.name_ar || 'برنامج'), end_day, members, phase: orgStationPhase(end_day, row, now), opens: w.opens, closes: w.closes, row, eligible: members >= k }); }
  return out.filter(v => v.eligible || v.row).sort((a, b) => b.end_day.localeCompare(a.end_day));
}
export async function writeOrgStation(db: any, orgId: string, programId: string, by: string, s: { state: OrgState; text_ar: string; public: boolean }, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = (await orgStationsOf(db, orgId, now)).find(x => x.program_id === programId); if (!v) return { ok: false, error: 'لا برنامج بهذا الرقم فيه خمسة من منسوبيكم' };
  const can = canWriteOrgStation(v.end_day, v.members, v.row, now); if (!can.ok) return can;
  const patch = { state: s.state, text_ar: s.text_ar, public: s.public, written_by: by, written_at: now.toISOString() };
  if (v.row) { const { error } = await db.from('portal_after_org_stations').update(patch).eq('id', v.row.id); if (error) return { ok: false, error: error.message }; return { ok: true }; }
  const { error } = await db.from('portal_after_org_stations').insert({ program_id: programId, organization_id: orgId, ...patch }); if (error) return { ok: false, error: error.message }; return { ok: true };
}
/** ما قالته الجهات علنًا عن برنامج — باسم الجهة إن أذنت بالنشر (النشر إذن باسمها)، لا k هنا: قول مؤسسي */
export async function orgSaidFor(db: any, programId: string): Promise<OrgSaid[]> {
  const rows = await safe<OrgStationRow[]>(db.from('portal_after_org_stations').select(GCOLS).eq('program_id', programId).eq('public', true).not('written_at', 'is', null).limit(20), []);
  if (!rows.length) return []; const orgs = await safe<any[]>(db.from('portal_organizations').select('id,name_ar').in('id', rows.map(r => String(r.organization_id))).limit(20), []);
  return rows.map(r => ({ org_ar: String(orgs.find(o => String(o.id) === String(r.organization_id))?.name_ar || 'جهة'), state: r.state as OrgState, state_ar: ORG_STATE_AR[r.state as OrgState], text_ar: String(r.text_ar), written_at: String(r.written_at) }));
}
export async function orgWrittenCount(db: any, programIds: string[]): Promise<Record<string, number>> {
  if (!programIds.length) return {}; const rows = await safe<any[]>(db.from('portal_after_org_stations').select('program_id,written_at').in('program_id', programIds).not('written_at', 'is', null).limit(500), []);
  const out: Record<string, number> = {}; for (const r of rows) out[String(r.program_id)] = (out[String(r.program_id)] || 0) + 1; return out;
}
/** فصول «قالت بعد سنة» لرحلة الجهة (P26) */
export async function orgAfterChapterRows(db: any, orgId: string): Promise<{ program_ar: string; written_at: string; state: OrgState }[]> {
  const rows = await safe<OrgStationRow[]>(db.from('portal_after_org_stations').select(GCOLS).eq('organization_id', orgId).not('written_at', 'is', null).limit(50), []); if (!rows.length) return [];
  const progs = await safe<any[]>(db.from('programs').select('id,name_ar').in('id', rows.map(r => String(r.program_id))).limit(50), []);
  return rows.map(r => ({ program_ar: String(progs.find(p => String(p.id) === String(r.program_id))?.name_ar || 'برنامج'), written_at: String(r.written_at), state: r.state as OrgState }));
}

/* ───────── 4) القياس في مِعيار ───────── */
/** مستوى الالتحاق (لقطة التسجيل أو آخر محاولة قبل نهاية البرنامج) ↔ أول محاولة بعد نهاية البرنامج */
export async function measureFor(db: any, e: Enr): Promise<Measure> {
  const attempts = (await attemptsByEmail(db, e.email)).filter(a => !a.archived); const endIso = `${e.end_day}T23:59:59.999Z`;
  const before = [...attempts].reverse().find(a => a.taken_at <= endIso) || null; const after = attempts.find(a => a.taken_at > endIso) || null;
  const entry = e.placement_level || before?.entry || before?.demonstrated || null;
  return measureOf(entry, after ? { level: after.demonstrated, at: after.taken_at, code: after.code } : null);
}
export async function setMeasureInDoc(db: any, e: Enr, on: boolean, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const m = await measureFor(db, e); if (on && !m.has_after) return { ok: false, error: 'لا قياس بعد البرنامج بعد — قِس مستواك في مِعيار أولًا' };
  const row = await safe<any>(db.from('portal_after_stations').select('id').eq('enrollment_id', e.id).eq('station', 365).maybeSingle(), null);
  if (row) await db.from('portal_after_stations').update({ in_doc_measure: on }).eq('id', row.id);
  else { const { error } = await db.from('portal_after_stations').insert({ enrollment_id: e.id, program_id: e.program_id, user_id: e.user_id || null, email: e.email, station: 365, in_doc_measure: on, notified_at: now.toISOString() }); if (error) return { ok: false, error: error.message }; }
  return { ok: true };
}
/** سطر البرنامج العام: من خمسة قاسوا بعد البرنامج (شرائح بالكلمات) */
export async function programMeasure(db: any, programId: string, endDay: string | null): Promise<{ shown: boolean; n: number; line_ar: string | null }> {
  if (!endDay) return { shown: false, n: 0, line_ar: null };
  const ens = await safe<any[]>(db.from('portal_enrollments').select('id,email,placement_level').eq('program_id', programId).eq('status', 'approved').limit(500), []);
  const steps: number[] = []; const seen = new Set<string>();
  for (const e of ens.slice(0, 200)) { const em = lower(e.email); if (!em || seen.has(em)) continue; seen.add(em); const m = await measureFor(db, { id: String(e.id), program_id: programId, program_ar: '', end_day: endDay, user_id: null, email: em, placement_level: e.placement_level || null }); if (m.has_after && m.steps !== null) steps.push(m.steps); }
  return programMeasureLine(steps);
}
export const stationLabel = (st: 30 | 90 | 365) => STATION_AR[st];
export { noChancePeople, stationPhase };
