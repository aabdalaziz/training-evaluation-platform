// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P38 «الشهادة التي تكبر» — القراءة/الكتابة (Supabase بمفتاح الخدمة؛ البوابات في المسار)
 *  تسجيلاتي المكتملة ومحطاتها · الكتابة داخل النافذة فقط · الشاهد (دعوة ببريد → توقيع/اعتذار) · إظهار الفصل في الشهادة الحيّة
 *  · «ما قاله من تدرّب هنا» (k≥5) · سطر الجهة · وثيقة ATH-AF · فتح المحطات داخل كرون الرحلة القائم · مسودّة الميسِّر
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { notify } from '../portal/notify';
import { STATIONS, STATE_AR, STATION_AR, stationPhase, stationWindow, canWrite, canInviteWitness, canAnswerWitness, cleanWitnessText, docEligible, afterCode, programAfter, orgAfterLine, afterFactLine, addDays, AFTER_K } from './registry';
import type { Station, StationRow, AfterState, StationPhase } from './registry';
/* P39 «أصوات حول الشهادة» — الرسالة · البرنامج يردّ · محطة الجهة · القياس */
import { lettersOf, letterView, gradLettersOf, unsealLetters, openOffersFor, repliesOf, offerViewFor, adminOffers, orgWrittenCount, orgSaidFor, programOfferLine, programMeasure, measureFor } from './voices-load';
import { LETTER_DOC_LINE_AR, MEASURE_LEVEL_AR } from './voices';
import type { Measure } from './voices';

const COLS = 'id,enrollment_id,program_id,user_id,email,station,state,text_ar,may_publish,shown_on_credential,witness_email,witness_user_id,witness_status,witness_text,witness_at,notified_at,written_at,published_at,published_by,in_doc_measure';
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export type DoneEnrollment = { id: string; program_id: string; program_ar: string; end_day: string; user_id: string | null; email: string; full_name: string | null; organization_id: string | null; placement_level?: string | null };
export type StationView = { station: Station; label_ar: string; phase: StationPhase; opens: string; closes: string; due: string; row: StationRow | null };

/** تسجيلاتي المعتمَدة التي انتهى برنامجها (end_date ≤ اليوم) */
export async function doneEnrollments(db: any, me: { id: string; email: string }, now = new Date()): Promise<DoneEnrollment[]> {
  const ens = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,user_id,email,full_name,status,organization_id,placement_level').or(`user_id.eq.${me.id},email.eq.${lower(me.email)}`).eq('status', 'approved').limit(100), []);
  if (!ens.length) return [];
  const pids = Array.from(new Set(ens.map(e => String(e.program_id))));
  const progs = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').in('id', pids).limit(100), []);
  const today = ymd(now); const out: DoneEnrollment[] = [];
  for (const e of ens) { const p = progs.find(x => String(x.id) === String(e.program_id)); if (!p?.end_date || String(p.end_date).slice(0, 10) > today) continue; out.push({ id: String(e.id), program_id: String(e.program_id), program_ar: String(p.name_ar || 'برنامج'), end_day: String(p.end_date).slice(0, 10), user_id: e.user_id || null, email: lower(e.email), full_name: e.full_name || null, organization_id: e.organization_id || null, placement_level: e.placement_level || null }); }
  return out.sort((a, b) => b.end_day.localeCompare(a.end_day));
}
export async function stationsOf(db: any, enrollmentIds: string[]): Promise<StationRow[]> {
  if (!enrollmentIds.length) return []; return safe<StationRow[]>(db.from('portal_after_stations').select(COLS).in('enrollment_id', enrollmentIds).limit(500), []);
}
export function stationViews(e: DoneEnrollment, rows: StationRow[], now = new Date()): StationView[] {
  return STATIONS.map(st => { const row = rows.find(r => String(r.enrollment_id) === e.id && Number(r.station) === st) || null; const w = stationWindow(e.end_day, st); return { station: st, label_ar: STATION_AR[st], phase: stationPhase(e.end_day, st, row, now), opens: w.opens, closes: w.closes, due: w.due, row }; });
}
export async function myAfter(db: any, me: { id: string; email: string }, now = new Date()) {
  const ens = await doneEnrollments(db, me, now); const rows = await stationsOf(db, ens.map(e => e.id));
  const docs = await safe<any[]>(db.from('portal_vc_issuances').select('id,code,issued_at,vc').eq('kind', 'after').or(`user_id.eq.${me.id},email.eq.${lower(me.email)}`).is('revoked_at', null).limit(50), []);
  /* P39: الرسالة تُفتح مع محطة السنة (كسولًا هنا أيضًا) · عرض البرنامج · القياس */
  const letters0 = await lettersOf(db, ens.map(e => e.id)); const unsealed = await unsealLetters(db, ens.map(e => ({ e, row: letters0.find(l => String(l.enrollment_id) === e.id) || null })), String(process.env.NEXT_PUBLIC_SITE_URL || ''), now);
  const letters = unsealed ? await lettersOf(db, ens.map(e => e.id)) : letters0; const gradLetters = await gradLettersOf(db, me, Array.from(new Set(ens.map(e => e.program_id))), now); /* P63: باب موحَّد — الحالة من محرّك P62 */ const offers = await openOffersFor(db, Array.from(new Set(ens.map(e => e.program_id)))); const replies = await repliesOf(db, offers.map(o => o.id));
  const measures = new Map<string, Measure>(); for (const e of ens) if (stationPhase(e.end_day, 365, null, now) !== 'future') measures.set(e.id, await measureFor(db, e));
  const items = ens.map(e => { const mine = rows.filter(r => String(r.enrollment_id) === e.id); const el = docEligible(e.end_day, mine, now); const doc = docs.find(d => String(d.vc?._athar?.enrollment_id || '') === e.id) || null; const l365 = mine.find(r => Number(r.station) === 365) || null; return { ...e, stations: stationViews(e, mine, now), letter: letterView(e, letters.find(l => String(l.enrollment_id) === e.id) || null, now, gradLetters.get(e.program_id) || null), offer: offerViewFor(e, mine, offers, replies), measure: measures.get(e.id) || null, measure_in_doc: !!(l365 as any)?.in_doc_measure, doc_eligible: el.ok, doc_note_ar: el.ok ? null : el.error, written: el.written, doc: doc ? { code: doc.code, issued_at: doc.issued_at } : null }; });
  const invites = await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).eq('witness_email', lower(me.email)).eq('witness_status', 'invited').limit(50), []);
  const invitePrograms = invites.length ? await safe<any[]>(db.from('programs').select('id,name_ar').in('id', Array.from(new Set(invites.map(i => String(i.program_id))))).limit(50), []) : [];
  const inviteEnroll = invites.length ? await safe<any[]>(db.from('portal_enrollments').select('id,full_name').in('id', Array.from(new Set(invites.map(i => String(i.enrollment_id))))).limit(50), []) : [];
  return { items, invites: invites.map(i => ({ id: i.id, station: i.station, station_ar: STATION_AR[i.station], state_ar: i.state ? STATE_AR[i.state] : '', text_ar: i.text_ar, written_at: i.written_at, program_ar: String(invitePrograms.find(p => String(p.id) === String(i.program_id))?.name_ar || 'برنامج'), learner_ar: String(inviteEnroll.find(e => String(e.id) === String(i.enrollment_id))?.full_name || 'متدرّب') })), fact_line_ar: afterFactLine(rows) };
}
async function enrollmentOf(db: any, me: { id: string; email: string }, enrollmentId: string, now = new Date()): Promise<DoneEnrollment | null> { return (await doneEnrollments(db, me, now)).find(e => e.id === String(enrollmentId)) || null; }

/** كتابة المحطة — داخل نافذتها فقط، مرة واحدة */
export async function writeStation(db: any, me: { id: string; email: string }, enrollmentId: string, s: { station: Station; state: AfterState; text_ar: string; may_publish: boolean }, now = new Date()): Promise<{ ok: true; row: StationRow } | { ok: false; error: string }> {
  const e = await enrollmentOf(db, me, enrollmentId, now); if (!e) return { ok: false, error: 'لا تسجيل مكتملًا بهذا الرقم' };
  const existing = (await stationsOf(db, [e.id])).find(r => Number(r.station) === s.station) || null;
  const can = canWrite(e.end_day, s.station, existing, now); if (!can.ok) return can;
  const patch = { state: s.state, text_ar: s.text_ar, may_publish: s.may_publish, written_at: now.toISOString(), user_id: e.user_id || me.id };
  if (existing) { const { data, error } = await db.from('portal_after_stations').update(patch).eq('id', existing.id).select(COLS).single(); if (error) return { ok: false, error: error.message }; return { ok: true, row: data as StationRow }; }
  const { data, error } = await db.from('portal_after_stations').insert({ enrollment_id: e.id, program_id: e.program_id, email: e.email, station: s.station, ...patch }).select(COLS).single();
  if (error) return { ok: false, error: error.message }; return { ok: true, row: data as StationRow };
}
export async function setShown(db: any, me: { id: string; email: string }, id: string | number, shown: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await safe<StationRow | null>(db.from('portal_after_stations').select(COLS).eq('id', id).maybeSingle(), null); if (!row || !(row.user_id === me.id || lower(row.email) === lower(me.email))) return { ok: false, error: 'ليست محطتك' };
  if (!row.written_at) return { ok: false, error: 'اكتب المحطة أولًا' };
  await db.from('portal_after_stations').update({ shown_on_credential: shown }).eq('id', row.id); return { ok: true };
}
/** الشاهد */
export async function inviteWitness(db: any, me: { id: string; email: string; name: string }, id: string | number, email: string, site: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await safe<StationRow | null>(db.from('portal_after_stations').select(COLS).eq('id', id).maybeSingle(), null); if (!row || !(row.user_id === me.id || lower(row.email) === lower(me.email))) return { ok: false, error: 'ليست محطتك' };
  const can = canInviteWitness(row, email); if (!can.ok) return can;
  await db.from('portal_after_stations').update({ witness_email: lower(email), witness_status: 'invited', witness_user_id: null, witness_text: null, witness_at: null }).eq('id', row.id);
  try { await notify(db, { kind: 'after_witness', to: { email: lower(email), name: null }, ref: `after:witness:${row.id}`, subject: `${me.name || 'متدرّب'} يدعوك شاهدًا على ما فعله بعد برنامجه`, text: `${me.name || 'متدرّب'} كتب في أَثَر ما فعله بما تعلّم (${STATION_AR[row.station]}) ويدعوك لتشهد بجملة واحدة — أو تعتذر.\nافتح: ${site}/me/after#witness`, url: `${site}/me/after#witness` }); } catch { /* داخلي */ }
  return { ok: true };
}
export async function answerWitness(db: any, me: { id: string; email: string }, id: string | number, accept: boolean, text: unknown, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await safe<StationRow | null>(db.from('portal_after_stations').select(COLS).eq('id', id).maybeSingle(), null); if (!row) return { ok: false, error: 'لا محطة' };
  const can = canAnswerWitness(row, me.email); if (!can.ok) return can;
  const t = accept ? cleanWitnessText(text) : null; if (accept && (!t || t.length < 10)) return { ok: false, error: 'اكتب جملة شهادتك (10 أحرف فأكثر)' };
  await db.from('portal_after_stations').update({ witness_user_id: me.id, witness_status: accept ? 'signed' : 'declined', witness_text: t, witness_at: now.toISOString() }).eq('id', row.id);
  try { await notify(db, { kind: 'after_witnessed', to: { email: row.email, name: null }, ref: `after:witnessed:${row.id}`, subject: accept ? 'شهد مشرفك على محطتك' : 'اعتذر الشاهد', text: accept ? `وقّع شاهدك على محطة «${STATION_AR[row.station]}»: «${t}»` : 'اعتذر من دعوته للشهادة — يمكنك دعوة غيره.', url: null }); } catch { /* داخلي */ }
  return { ok: true };
}
/** فصول تُعرض في الشهادة الحيّة (ما أذن المتدرّب بإظهاره فقط) */
export async function chaptersForCredential(db: any, code: string): Promise<{ program_id: string | null; chapters: { station: Station; station_ar: string; state_ar: string; text_ar: string; witness_text: string | null; written_at: string }[] }> {
  const cred = await safe<any>(db.from('portal_credentials').select('id,user_id,email,program_id,kind').ilike('verify_code', code).maybeSingle(), null); if (!cred?.program_id) return { program_id: null, chapters: [] };
  const rows = await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).eq('program_id', cred.program_id).eq('shown_on_credential', true).or(`user_id.eq.${cred.user_id || '00000000-0000-0000-0000-000000000000'},email.eq.${lower(cred.email)}`).limit(10), []);
  return { program_id: String(cred.program_id), chapters: rows.filter(r => r.written_at && r.text_ar).sort((a, b) => Number(a.station) - Number(b.station)).map(r => ({ station: r.station, station_ar: STATION_AR[r.station], state_ar: STATE_AR[r.state as AfterState], text_ar: String(r.text_ar), witness_text: r.witness_status === 'signed' ? r.witness_text : null, written_at: String(r.written_at) })) };
}
/** «ما قاله من تدرّب هنا» — عام */
export async function programAfterOf(db: any, programId: string, now = new Date()) {
  const rows = await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).eq('program_id', programId).limit(2000), []);
  const base = programAfter(rows, AFTER_K, now);
  /* P39: أصوات حول الشهادة — سطر البرنامج (ردّ بورشة) · ما قالته الجهة (بإذنها) · سطر القياس (من خمسة) */
  const p = await safe<any>(db.from('programs').select('id,end_date').eq('id', programId).maybeSingle(), null);
  const [offer_line_ar, org_said, measure] = await Promise.all([programOfferLine(db, programId), orgSaidFor(db, programId), programMeasure(db, programId, p?.end_date ? String(p.end_date).slice(0, 10) : null)]);
  return { ...base, offer_line_ar, org_said, measure_line_ar: measure.shown ? measure.line_ar : null, measured_n: measure.n };
}
/** سطر الجهة — منسوبوها المؤكَّدون */
export async function orgAfterOf(db: any, orgId: string) {
  const mem = await safe<any[]>(db.from('portal_org_members').select('user_id,email').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000), []);
  const ids = mem.map(m => String(m.user_id || '')).filter(Boolean); const emails = mem.map(m => lower(m.email)).filter(Boolean);
  const byId = ids.length ? await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).in('user_id', ids).limit(5000), []) : [];
  const byMail = emails.length ? await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).in('email', emails).limit(5000), []) : [];
  const seen = new Set<string>(); const rows = [...byId, ...byMail].filter(r => { const k = String(r.id); if (seen.has(k)) return false; seen.add(k); return true; });
  return orgAfterLine(rows);
}
/** وثيقة «أثر بعد» ATH-AF */
export function buildAfterDoc(inp: { code: string; name: string; program_ar: string; enrollment_id: string; end_day: string; stations: { station: Station; state: AfterState; text_ar: string; witness: boolean }[]; site: string; did: string; now?: Date; statusIndex: number | null; letter?: boolean; measure?: Measure | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar — Training Impact Follow-up · أثر بعد البرنامج',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.name,
      achievement: { id: `${inp.site}/me/after`, type: ['Achievement'], name: `What I did with what I learned — ${inp.program_ar}`, achievementType: 'Badge',
        description: 'After the program ended, this learner returned at 30, 90 and 365 days and wrote, in their own words, what they did with what they learned — including when it did not help. Stations missed stay empty; nothing is back-filled. Witness lines were signed by people the learner invited. No ratings exist in Athar.',
        criteria: { narrative: 'At least two of the three stations written inside their ±14-day windows after the program end date recorded by the platform' } },
      result: [...inp.stations.map(s => ({ type: ['Result'], resultDescription: `station_${s.station}`, value: `${s.state}${s.witness ? ' · witnessed' : ''}` })), ...(inp.letter ? [{ type: ['Result'], resultDescription: 'letter_to_self', value: 'sealed at program end · opened after one year' }] : []), ...(inp.measure?.has_after ? [{ type: ['Result'], resultDescription: 'miaar_measure', value: `${inp.measure.entry_level || '?'} → ${inp.measure.after_level} (${String(inp.measure.after_at).slice(0, 10)})` }] : [])] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'after', code: inp.code, holder: inp.name, program_ar: inp.program_ar, enrollment_id: inp.enrollment_id, end_day: inp.end_day, stations: inp.stations.map(s => ({ station: s.station, station_ar: STATION_AR[s.station], state: s.state, state_ar: STATE_AR[s.state], text_ar: s.text_ar, witnessed: s.witness })), title_ar: `أثر بعد — ${inp.program_ar} — ${inp.name}`, verify_url: url, ...(inp.letter ? { letter_ar: LETTER_DOC_LINE_AR } : {}), ...(inp.measure?.has_after ? { measure: { entry_level: inp.measure.entry_level, entry_ar: inp.measure.entry_level ? MEASURE_LEVEL_AR[inp.measure.entry_level] : null, after_level: inp.measure.after_level, after_ar: inp.measure.after_ar, after_at: inp.measure.after_at, steps: inp.measure.steps, line_ar: inp.measure.line_ar } } : {}) },
  };
}
export async function issueAfterDoc(db: any, me: { id: string; email: string; name: string }, enrollmentId: string, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; code: string; verify_url: string } | { ok: false; error: string }> {
  const e = await enrollmentOf(db, me, enrollmentId, now); if (!e) return { ok: false, error: 'لا تسجيل مكتملًا بهذا الرقم' };
  const rows = (await stationsOf(db, [e.id])).filter(r => r.written_at); const el = docEligible(e.end_day, rows, now); if (!el.ok) return { ok: false, error: el.error };
  const prev = await safe<any[]>(db.from('portal_vc_issuances').select('id,code,vc').eq('kind', 'after').eq('user_id', me.id).is('revoked_at', null).limit(50), []);
  const same = prev.find(p => String(p.vc?._athar?.enrollment_id || '') === e.id); if (same) return { ok: true, code: same.code, verify_url: `${site}/verify/vc?code=${encodeURIComponent(same.code)}` };
  const code = afterCode(rnd); const url = `${site}/verify/vc?code=${encodeURIComponent(code)}`; if (!signer) return { ok: true, code, verify_url: url };
  const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'after', credential_id: null, user_id: me.id, email: lower(me.email), full_name: me.name, title_ar: `أثر بعد — ${e.program_ar} — ${me.name}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: null, issued_by: me.id }).select('id,status_index').single();
  if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
  const letter = (await lettersOf(db, [e.id]))[0] || null; const l365 = (await stationsOf(db, [e.id])).find(r => Number(r.station) === 365) as any; const measure = l365?.in_doc_measure ? await measureFor(db, e) : null;   /* P39: بخيار المتدرّب */
  const vc = await signDocument(buildAfterDoc({ code, name: me.name, program_ar: e.program_ar, enrollment_id: e.id, end_day: e.end_day, stations: rows.sort((a, b) => Number(a.station) - Number(b.station)).map(r => ({ station: r.station, state: r.state as AfterState, text_ar: String(r.text_ar), witness: r.witness_status === 'signed' })), site, did, now, statusIndex: Number((ins as any).status_index), letter: !!(letter && letter.opened_at && letter.in_doc), measure }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
  return { ok: true, code, verify_url: url };
}
/** فتح المحطات — داخل كرون الرحلة القائم: صفّ + إشعار داخلي مرة واحدة لكل محطة تدخل نافذتها */
export async function openStations(db: any, opts: { site: string; now?: Date; dry?: boolean }): Promise<{ opened: number; errors: string[] }> {
  const now = opts.now || new Date(); const today = ymd(now); const errors: string[] = []; let opened = 0;
  try {
    const progs = await safe<any[]>(db.from('programs').select('id,name_ar,end_date').gte('end_date', addDays(today, -(365 + 14))).lte('end_date', addDays(today, -(30 - 14))).limit(500), []);
    if (!progs.length) return { opened, errors };
    const ens = await safe<any[]>(db.from('portal_enrollments').select('id,program_id,user_id,email,full_name').in('program_id', progs.map(p => String(p.id))).eq('status', 'approved').limit(5000), []);
    const rows = ens.length ? await safe<StationRow[]>(db.from('portal_after_stations').select('id,enrollment_id,station,notified_at,written_at').in('enrollment_id', ens.map(e => String(e.id))).limit(20000), []) : [];
    const letters = ens.length ? await lettersOf(db, ens.map(e => String(e.id))) : [];   /* P39: الرسائل تُفتح مع محطة السنة */
    for (const e of ens) {
      const p = progs.find(x => String(x.id) === String(e.program_id)); if (!p?.end_date) continue; const endDay = String(p.end_date).slice(0, 10);
      const letter = letters.find(l => String(l.enrollment_id) === String(e.id)) || null;
      if (letter) opened += await unsealLetters(db, [{ e: { id: String(e.id), program_id: String(e.program_id), program_ar: String(p.name_ar || 'برنامج'), end_day: endDay, user_id: e.user_id || null, email: lower(e.email), full_name: e.full_name || null }, row: letter }], opts.site, now, !!opts.dry);
      for (const st of STATIONS) {
        const row = rows.find(r => String(r.enrollment_id) === String(e.id) && Number(r.station) === st); if (row) continue;
        if (stationPhase(endDay, st, null, now) !== 'open') continue;
        if (opts.dry) { opened++; continue; }
        try {
          await db.from('portal_after_stations').insert({ enrollment_id: e.id, program_id: e.program_id, user_id: e.user_id || null, email: lower(e.email), station: st, notified_at: now.toISOString() });
          await notify(db, { kind: 'after_station', to: { email: lower(e.email), name: e.full_name || null }, ref: `after:open:${e.id}:${st}`, subject: `${STATION_AR[st]} من «${p.name_ar}» — ما الذي فعلته بما تعلّمت؟`, text: `فُتحت محطة «${STATION_AR[st]}» لبرنامج «${p.name_ar}». اكتب بكلماتك ما فعلته بما تعلّمت — أو أن الفرصة لم تسنح، أو أنه لم ينفعك. النافذة حتى ${stationWindow(endDay, st).closes}.\nافتح: ${opts.site}/me/after`, url: `${opts.site}/me/after` });
          opened++;
        } catch (err: any) { errors.push(`after ${e.id}/${st}: ${err?.message || err}`); }
      }
    }
  } catch (err: any) { errors.push(`after: ${err?.message || err}`); }
  return { opened, errors };
}
/** للطاقم: المحطات لكل برنامج + ما ينتظر اعتماد النشر */
export async function adminAfter(db: any) {
  const rows = await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).order('created_at', { ascending: false }).limit(2000), []);
  const pids = Array.from(new Set(rows.map(r => String(r.program_id)))); const progs = pids.length ? await safe<any[]>(db.from('programs').select('id,name_ar,end_date').in('id', pids).limit(500), []) : [];
  const programs = pids.map(pid => { const mine = rows.filter(r => String(r.program_id) === pid); const w = mine.filter(r => r.written_at); const p = progs.find(x => String(x.id) === pid);
    return { program_id: pid, program_ar: String(p?.name_ar || 'برنامج'), end_day: p?.end_date ? String(p.end_date).slice(0, 10) : null, opened: mine.length, written: w.length, by_station: STATIONS.map(st => ({ station: st, written: w.filter(r => Number(r.station) === st).length })), states: w.reduce((acc, r) => { if (r.state) acc[r.state] = (acc[r.state] || 0) + 1; return acc; }, {} as Record<string, number>), witnessed: w.filter(r => r.witness_status === 'signed').length, public: programAfter(mine).shown, candidates: w.filter(r => r.may_publish && !r.published_at).map(r => ({ id: r.id, station: r.station, station_ar: STATION_AR[r.station], state_ar: STATE_AR[r.state as AfterState], text_ar: r.text_ar, witness_text: r.witness_status === 'signed' ? r.witness_text : null })), published: w.filter(r => r.published_at).map(r => ({ id: r.id, station: r.station, station_ar: STATION_AR[r.station], state_ar: STATE_AR[r.state as AfterState], text_ar: r.text_ar })) }; });
  /* P39: البرنامج يردّ (المُطلِق · العروض · الأعداد) · الجهة كتبت */
  const byProg = new Map<string, StationRow[]>(); for (const pid of pids) byProg.set(pid, rows.filter(r => String(r.program_id) === pid));
  const offers = await adminOffers(db, pids, byProg); const orgWritten = await orgWrittenCount(db, pids);
  const withVoices = programs.map(p => ({ ...p, voices: offers[p.program_id] || null, org_written: orgWritten[p.program_id] || 0 }));
  return { programs: withVoices.sort((a, b) => b.written - a.written), total_written: rows.filter(r => r.written_at).length, offers_open: Object.values(offers).reduce((n: number, v: any) => n + (v.offers || []).filter((o: any) => !o.closed_at).length, 0), triggers_ready: Object.values(offers).filter((v: any) => v.trigger?.ready && !(v.offers || []).length).length };
}
export async function setPublished(db: any, id: string | number, published: boolean, by: string, now = new Date()): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = await safe<StationRow | null>(db.from('portal_after_stations').select(COLS).eq('id', id).maybeSingle(), null); if (!row?.written_at) return { ok: false, error: 'لا محطة مكتوبة' };
  if (published && !row.may_publish) return { ok: false, error: 'لم يأذن صاحبها بالنشر' };
  await db.from('portal_after_stations').update({ published_at: published ? now.toISOString() : null, published_by: published ? by : null }).eq('id', row.id); return { ok: true };
}
/** نصوص مجهَّلة لمسودّة الميسِّر (من أذنوا بالنشر أو لا — الخلاصة داخلية للطاقم، بلا أسماء) */
export async function summaryTexts(db: any, programId: string): Promise<{ program_ar: string; texts: { station: Station; state: AfterState; text: string }[] }> {
  const p = await safe<any>(db.from('programs').select('id,name_ar').eq('id', programId).maybeSingle(), null);
  const rows = await safe<StationRow[]>(db.from('portal_after_stations').select(COLS).eq('program_id', programId).not('written_at', 'is', null).limit(300), []);
  return { program_ar: String(p?.name_ar || 'برنامج'), texts: rows.filter(r => r.text_ar && r.state).map(r => ({ station: r.station, state: r.state as AfterState, text: String(r.text_ar) })) };
}
export async function afterFacts(db: any, me: { id?: string | null; email: string }): Promise<string | null> {
  const q = db.from('portal_after_stations').select('id,written_at,witness_status'); const rows = await safe<StationRow[]>((me.id ? q.or(`user_id.eq.${me.id},email.eq.${lower(me.email)}`) : q.eq('email', lower(me.email))).limit(200), []); return afterFactLine(rows);
}
