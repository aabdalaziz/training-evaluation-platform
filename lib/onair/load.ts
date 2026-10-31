// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P33 «أَثَر معك — على الهواء» — القراءة والكتابة (بمفتاح الخدمة عبر /api/onair و/api/admin/onair فقط):
 *  الحضور · الأشخاص (من هيئة أَثَر) · النوافذ · الطلبات والصفّ · الرسائل · الساعات · شهادة ATH-OA · الإحصاءات العامة · النداء.
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { notify } from '../portal/notify';
import { FACE_AR, CERT_HOURS, CERT_MEETINGS, GRADE_LABEL, certCode, hoursFrom, isOnAir, publicPresence, publicStats, avgResponseMin, matchReceivers, quickExpired, quickClosed, QUICK_CLOSE_MIN, goldenState, liveMap, isBottle, BOTTLE_AR, STATS_K, holdReleased, whisperOver, WHISPER_MINUTES, seasonState, seasonPhraseAr, slotOccursAt, seasonLine, seasonCode, seasonDocTitle, seasonDocNarrative, SEASON_K, echoBackStep, echoBackLine, ECHO_BACK_STEPS, whenGrid, PRESENCE_LOG_DAYS, WHEN_WEEKS, cityKey, isWhisper, whisperEndsAt, CITY_POINTS } from './registry';
import type { Presence, Request, Win, Grade, Face, Hours, Golden, EchoDraft, Season, SeasonSlot } from './registry';

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
const PRESENCE_COLS = 'user_id,email,face,receives,domains,alt_link,on_air_until,grounded_at,grounded_note,meta,updated_at,text_only,mentor_user_id,mentor_status,shadow_left,reverse_left,reverse_user_id';
const REQ_COLS = 'id,kind,status,asker_user_id,asker_email,asker_alias,domain,text_ar,receiver_user_id,room_code,taken_at,done_at,outcome,what_changed_ar,duration_min,meta,created_at,org_id,org_hold_until';

export type Person = { user_id: string; name_ar: string; slug: string | null; photo_url: string | null; title_ar: string | null; faces: string[]; email: string; status: string; listed: boolean };
/** أعضاء الهيئة المعتمَدون لمجموعة معرّفات (الاسم والصورة العامة والوجوه) */
export async function loadPeople(db: any, userIds: string[], publicUrl: (p: string) => string, withProfiles = false): Promise<Record<string, Person>> {
  const ids = Array.from(new Set(userIds.filter(Boolean))); if (!ids.length) return {};
  const rows = await safe<any[]>(db.from('portal_directory_profiles').select('user_id,email,name_ar,slug,photo_public_path,title_ar,faces,status,listed').in('user_id', ids).limit(500), []);
  const out: Record<string, Person> = {};
  for (const r of rows) out[String(r.user_id)] = { user_id: String(r.user_id), name_ar: String(r.name_ar || ''), slug: r.slug || null, photo_url: r.photo_public_path && r.status === 'approved' ? publicUrl(r.photo_public_path) : null, title_ar: r.title_ar || null, faces: Array.isArray(r.faces) ? r.faces : [], email: lower(r.email), status: String(r.status || ''), listed: r.listed !== false };
  // P34 «ميراث الهواء» فقط (withProfiles): المرافِق/المرافَق بلا ملف في «هيئة أَثَر» يظهر باسمه من الملف الشخصي — بلا صورة ولا رابط؛ على الهواء العام يبقى «طاقم أَثَر»
  const missing = withProfiles ? ids.filter(id => !out[id]) : []; if (missing.length) {
    const prof = await safe<any[]>(db.from('profiles').select('id,full_name').in('id', missing).limit(500), []);
    for (const p of prof) out[String(p.id)] = { user_id: String(p.id), name_ar: String(p.full_name || ''), slug: null, photo_url: null, title_ar: null, faces: [], email: '', status: 'none', listed: false };
  }
  return out;
}
export async function directoryFacesOf(db: any, userId: string): Promise<string[]> {
  const r = await safe<any>(db.from('portal_directory_profiles').select('faces,status').eq('user_id', userId).maybeSingle(), null);
  return r && r.status === 'approved' ? (Array.isArray(r.faces) ? r.faces : []) : [];
}

/** الحاضرون الآن */
export async function presentNow(db: any, now = new Date()): Promise<Presence[]> {
  const rows = await safe<Presence[]>(db.from('portal_onair_presence').select(PRESENCE_COLS).gt('on_air_until', now.toISOString()).is('grounded_at', null).order('on_air_until', { ascending: true }).limit(200), []);
  return rows.filter(p => isOnAir(p, now.getTime()));
}
export const myPresence = (db: any, uid: string) => safe<Presence | null>(db.from('portal_onair_presence').select(PRESENCE_COLS).eq('user_id', uid).maybeSingle(), null);
export async function upsertPresence(db: any, row: Partial<Presence> & { user_id: string; email: string }): Promise<Presence | null> {
  const { data, error } = await db.from('portal_onair_presence').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select(PRESENCE_COLS).single();
  if (error) throw new Error(error.message); return data as Presence;
}

/** النوافذ */
export const windowsOf = (db: any, uid?: string) => { let q = db.from('portal_onair_windows').select('id,user_id,weekday,from_min,to_min,note_ar').order('weekday').order('from_min').limit(500); if (uid) q = q.eq('user_id', uid); return safe<Win[]>(q, []); };

/** الطلبات */
export const getRequest = (db: any, id: string | number) => safe<Request | null>(db.from('portal_onair_requests').select(REQ_COLS).eq('id', id).maybeSingle(), null);
export const openRequests = (db: any) => safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).eq('status', 'open').order('created_at', { ascending: true }).limit(200), []);
export const activeFor = (db: any, uid: string) => safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).eq('receiver_user_id', uid).eq('status', 'taken').limit(20), []);
export const askedBy = (db: any, uid: string) => safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).eq('asker_user_id', uid).order('created_at', { ascending: false }).limit(50), []);
export const doneBy = (db: any, uid: string) => safe<Request[]>(db.from('portal_onair_requests').select('id,kind,status,duration_min,created_at,taken_at,done_at,what_changed_ar,domain').eq('receiver_user_id', uid).in('status', ['done', 'escalated']).order('done_at', { ascending: false }).limit(500), []);
export const countOpenBy = async (db: any, uid: string | null, ipHash: string | null): Promise<number> => {
  const rows = uid ? await safe<any[]>(db.from('portal_onair_requests').select('id').eq('asker_user_id', uid).in('status', ['open', 'taken']).limit(10), [])
    : ipHash ? await safe<any[]>(db.from('portal_onair_requests').select('id').eq('ip_hash', ipHash).in('status', ['open', 'taken']).limit(10), []) : [];
  return rows.length;
};
export async function insertRequest(db: any, row: Record<string, any>): Promise<Request> {
  const { data, error } = await db.from('portal_onair_requests').insert(row).select(REQ_COLS).single(); if (error) throw new Error(error.message); return data as Request;
}
export async function patchRequest(db: any, id: string | number, patch: Record<string, any>): Promise<Request | null> {
  const { data, error } = await db.from('portal_onair_requests').update(patch).eq('id', id).select(REQ_COLS).maybeSingle(); if (error) throw new Error(error.message); return (data || null) as Request | null;
}
/** انتهاء العون السريع بلا ردّ / إغلاقه بعد 15 دقيقة — يُحسب عند القراءة (لا كرون) */
export async function settleStale(db: any, rows: Request[], now = Date.now()): Promise<Request[]> {
  const out: Request[] = [];
  for (const r of rows) {
    if (quickExpired(r, now)) { out.push((await patchRequest(db, r.id, { status: 'expired' })) || { ...r, status: 'expired' }); continue; }
    if (quickClosed(r, now)) { out.push((await patchRequest(db, r.id, { status: 'done', outcome: r.outcome || 'solved', done_at: new Date(now).toISOString(), duration_min: QUICK_CLOSE_MIN })) || { ...r, status: 'done' }); continue; }
    // P35 همسة المترجم: تنتهي وحدها بعد 10 دقائق → لقاء مكتمل
    if (whisperOver(r, now)) { out.push((await patchRequest(db, r.id, { status: 'done', outcome: 'solved', done_at: new Date(now).toISOString(), duration_min: WHISPER_MINUTES })) || { ...r, status: 'done' }); continue; }
    // P35 أمانة إلى جهة: انقضت عهدة الجهة → تنتقل إلى الهواء العام (مرة واحدة، مع رسالة نظام)
    if (r.status === 'open' && holdReleased(r, now) && !r.meta?.released_at) {
      const fresh = await getRequest(db, r.id);   // نسخة قد تكون قديمة في قائمة أخرى من الطلب نفسه → لا رسالة مكرّرة
      if (fresh?.meta?.released_at) { out.push(fresh); continue; }
      const patched = await patchRequest(db, r.id, { meta: { ...(fresh?.meta || r.meta || {}), released_at: new Date(now).toISOString() } }).catch(() => null);
      await postMessage(db, r.id, 'system', 'انقضت عهدة الجهة (24 ساعة) — انتقلت الأمانة إلى الهواء العام، وسيجدها أول من يصعد.').catch(() => null);
      out.push(patched || { ...r, meta: { ...(r.meta || {}), released_at: new Date(now).toISOString() } }); continue;
    }
    out.push(r);
  }
  return out;
}

/** الرسائل */
export const messagesOf = (db: any, requestId: string | number) => safe<{ id: number | string; from_role: string; text_ar: string; created_at: string }[]>(db.from('portal_onair_messages').select('id,from_role,text_ar,created_at').eq('request_id', requestId).order('id', { ascending: true }).limit(300), []);
export async function postMessage(db: any, requestId: string | number, from_role: 'asker' | 'receiver' | 'system', text_ar: string) {
  const { data: r } = await db.from('portal_onair_requests').select('asker_user_id,asker_email').eq('id', requestId).maybeSingle();
  const { data, error } = await db.from('portal_onair_messages').insert({ request_id: requestId, from_role, text_ar, asker_user_id: r?.asker_user_id || null, asker_email: r?.asker_email || null }).select('id,from_role,text_ar,created_at').single(); if (error) throw new Error(error.message); return data;
}

/** الساعات من اللقاءات الفعلية */
export async function hoursFor(db: any, uid: string): Promise<Hours> { return hoursFrom(await doneBy(db, uid)); }

/** «شهادة حضور على الهواء» ATH-OA — وثيقة موقَّعة (مرة واحدة؛ تتجدّد سنويًا بحدّ أعلى جديد) */
export async function existingCert(db: any, uid: string) { return safe<any>(db.from('portal_vc_issuances').select('id,code,issued_at,vc').eq('user_id', uid).eq('kind', 'on_air').is('revoked_at', null).order('issued_at', { ascending: false }).limit(1).maybeSingle(), null); }
export function buildOnAirDoc(inp: { code: string; name: string; face: Face; hours: Hours; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar on Air — Presence Certificate · شهادة حضور على الهواء',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.name,
      achievement: { id: `${inp.site}/on-air`, type: ['Achievement'], name: `On air for Athar — ${inp.hours.hours} h · ${inp.hours.meetings} meetings`, achievementType: 'Badge',
        description: 'This member of the Athar Faculty went on air by their own choice and received real people — quick help, support sessions, consultations — for the hours stated. Hours are derived from completed meetings recorded by the platform, never from a toggle. No ratings exist in Athar.',
        criteria: { narrative: `≥ ${CERT_HOURS} hours and ≥ ${CERT_MEETINGS} completed meetings on air, derived from platform records` } },
      result: [{ type: ['Result'], resultDescription: 'hours', value: String(inp.hours.hours) }, { type: ['Result'], resultDescription: 'meetings', value: String(inp.hours.meetings) }, { type: ['Result'], resultDescription: 'face', value: inp.face }] },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'on_air', code: inp.code, holder: inp.name, face: inp.face, face_ar: FACE_AR[inp.face], hours: inp.hours.hours, meetings: inp.hours.meetings, by_kind: inp.hours.by_kind, title_ar: `شهادة حضور على الهواء — ${inp.name}`, verify_url: url },
  };
}
export async function issueOnAirCert(db: any, me: { id: string; email: string; name: string; face: Face }, hours: Hours, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; code: string; verify_url: string } | { ok: false; error: string }> {
  if (!hours.eligible) return { ok: false, error: `تبقّى ${hours.remaining_hours} ساعة و${hours.remaining_meetings} لقاءً` };
  const code = certCode(rnd); const url = `${site}/verify/vc?code=${encodeURIComponent(code)}`;
  if (!signer) return { ok: true, code, verify_url: url };
  const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'on_air', credential_id: null, user_id: me.id, email: lower(me.email), full_name: me.name, title_ar: `شهادة حضور على الهواء — ${me.name}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: null, issued_by: me.id }).select('id,status_index').single();
  if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الشهادة' };
  const vc = await signDocument(buildOnAirDoc({ code, name: me.name, face: me.face, hours, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
  return { ok: true, code, verify_url: url };
}

/** أرقام عامة */
export async function loadPublicStats(db: any, now = new Date()) {
  const present = await presentNow(db, now); const faces: Partial<Record<Face, number>> = {}; for (const p of present) faces[p.face] = (faces[p.face] || 0) + 1;
  const since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const month = await safe<any[]>(db.from('portal_onair_requests').select('id,status,asker_user_id,asker_email,ip_hash,created_at,taken_at').gte('created_at', since).limit(2000), []);
  const done = month.filter(r => r.status === 'done'); const askers = new Set(month.map(r => r.asker_user_id || r.ip_hash || r.asker_email).filter(Boolean));
  return { ...publicStats({ present: present.length, faces, month_done: done.length, askers_month: askers.size, avg_response_min: avgResponseMin(month.filter(r => r.taken_at)) }) };
}
export function presentView(present: Presence[], people: Record<string, Person>, now = Date.now()) { return present.map(p => publicPresence(p, people[p.user_id] ? { name_ar: people[p.user_id].name_ar, slug: people[p.user_id].slug, photo_url: people[p.user_id].photo_url, title_ar: people[p.user_id].title_ar } : null, now)); }

/** النداء: إشعار داخل التطبيق/دفع لأقرب 5 حاضرين (بريد/واتساب مؤجَّلان بقرار المالك) */
export async function callReceivers(db: any, r: Request, present: Presence[], site: string): Promise<number> {
  const orgSet = r.org_id ? await orgMemberIds(db, r.org_id) : undefined;
  const targets = matchReceivers(present, r, Date.now(), orgSet).slice(0, 5); let n = 0;
  for (const p of targets) {
    try { await notify(db, { kind: 'onair_ask', to: { email: p.email, name: null }, ref: `onair:ask:${r.id}:${p.user_id}`, subject: `على الهواء: ${GRADE_LABEL[r.kind].ar} في الصفّ`, text: `${r.asker_alias} يطلب ${GRADE_LABEL[r.kind].ar}${r.domain ? ` في «${r.domain}»` : ''}${isBottle(r) ? ` (${BOTTLE_AR})` : ''}${r.org_id ? ' — داخل جهتك' : ''}:\n«${r.text_ar.slice(0, 160)}»\nافتح: ${site}/me/onair`, url: `${site}/me/onair` }); n++; } catch { /* يتابع */ }
  }
  return n;
}
/** سطر «ما شهده أَثَر» للعضو */
export async function onAirFacts(db: any, uid: string | null | undefined) { if (!uid) return { meetings: 0, hours: 0, legacy: 0 }; const h = await hoursFor(db, uid); const legacy = await legacyCompleteCount(db, uid); return { meetings: h.meetings, hours: h.hours, legacy }; }
export type { Grade };

// ───────────────────────────── P34 «الهواء يتّسع» ─────────────────────────────
/** 5) هواء الجهة: جهات العضو المؤكَّدة · منسوبو جهة */
export async function orgsOf(db: any, me: { id: string; email: string }): Promise<{ id: string; name_ar: string; role: string }[]> {
  const mem = await safe<any[]>(db.from('portal_org_members').select('organization_id,role').or(`user_id.eq.${me.id},email.eq.${lower(me.email)}`).eq('status', 'confirmed').limit(5), []);
  const ids = Array.from(new Set(mem.map(m => String(m.organization_id)))); if (!ids.length) return [];
  const orgs = await safe<any[]>(db.from('portal_organizations').select('id,name_ar').in('id', ids).limit(5), []);
  return orgs.map(o => ({ id: String(o.id), name_ar: String(o.name_ar || 'جهتي'), role: String(mem.find(m => String(m.organization_id) === String(o.id))?.role || 'member') }));
}
export async function orgMemberIds(db: any, orgId: string): Promise<Set<string>> {
  const rows = await safe<any[]>(db.from('portal_org_members').select('user_id').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000), []);
  return new Set(rows.map(r => String(r.user_id || '')).filter(Boolean));
}
/** ساعات الهواء للجهة: ما قدّمه منسوبوها (كمُستقبِلين) وما طلبوه (k≥5) */
export async function orgAirStats(db: any, orgId: string) {
  const ids = Array.from(await orgMemberIds(db, orgId)); if (!ids.length) return { hours_given: 0, meetings_given: 0, hours_received: 0, askers: 0, internal: 0, k: STATS_K };
  const given = await safe<any[]>(db.from('portal_onair_requests').select('kind,status,duration_min,receiver_user_id,asker_user_id,org_id').in('receiver_user_id', ids.slice(0, 1000)).eq('status', 'done').limit(5000), []);
  const asked = await safe<any[]>(db.from('portal_onair_requests').select('asker_user_id,status,duration_min,org_id,kind').in('asker_user_id', ids.slice(0, 1000)).limit(5000), []);
  const g = hoursFrom(given); const askers = new Set(asked.map(r => r.asker_user_id)).size; const internal = asked.filter(r => String(r.org_id || '') === String(orgId)).length;
  const recv = hoursFrom(asked.filter(r => r.status === 'done'));
  return { hours_given: g.hours, meetings_given: g.meetings, hours_received: recv.hours, askers: askers >= STATS_K ? askers : 0, internal: internal >= STATS_K ? internal : 0, k: STATS_K };
}

/** 1) ساعة الهواء الذهبية */
export const goldenList = (db: any) => safe<Golden[]>(db.from('portal_onair_golden').select('id,title_ar,weekday,from_min,duration_min,active').eq('active', true).order('id').limit(5), []);
export async function goldenNow(db: any, me: { id: string } | null, now = new Date()) {
  const list = await goldenList(db); if (!list.length) return null;
  const g = list[0]; const st = goldenState(g, now);
  const pledges = await safe<any[]>(db.from('portal_onair_golden_pledges').select('user_id').eq('golden_id', g.id).eq('week_key', st.week_key).limit(500), []);
  return { ...g, ...st, pledged: pledges.length, pledged_ids: pledges.map(p => String(p.user_id)), mine: !!me && pledges.some(p => String(p.user_id) === me.id) };
}
export async function pledgeGolden(db: any, goldenId: string | number, me: { id: string; email: string }, weekKey: string, on: boolean) {
  if (!on) { await db.from('portal_onair_golden_pledges').delete().eq('golden_id', goldenId).eq('user_id', me.id).eq('week_key', weekKey); return; }
  const { error } = await db.from('portal_onair_golden_pledges').upsert({ golden_id: goldenId, user_id: me.id, email: lower(me.email), week_key: weekKey }, { onConflict: 'golden_id,user_id,week_key' }); if (error && !/duplicate|unique/i.test(String(error.message))) throw new Error(error.message);
}
/** تذكير المتعهّدين قبل الساعة بـ60 دقيقة — يُستدعى من كرون الهيئة القائم (لا كرون جديد) */
export async function remindGolden(db: any, site: string, now = new Date(), dry = false): Promise<number> {
  const list = await goldenList(db); let n = 0;
  for (const g of list) {
    const st = goldenState(g, now); if (st.live || st.minutes_to > 60) continue;
    const ps = await safe<any[]>(db.from('portal_onair_golden_pledges').select('id,user_id,email').eq('golden_id', g.id).eq('week_key', st.week_key).is('reminded_at', null).limit(500), []);
    for (const p of ps) {
      if (dry) { n++; continue; }
      try { await notify(db, { kind: 'onair_golden', to: { email: p.email, name: null }, ref: `onair:golden:${g.id}:${st.week_key}:${p.user_id}`, subject: `${g.title_ar} بعد ${st.minutes_to} دقيقة`, text: `تعهّدت بالحضور. اصعد على الهواء من: ${site}/me/onair`, url: `${site}/me/onair` }); await db.from('portal_onair_golden_pledges').update({ reminded_at: now.toISOString() }).eq('id', p.id); n++; } catch { /* يتابع */ }
    }
  }
  return n;
}

/** 6) خريطة الحضور الحيّة — المدينة من الملف العام المعتمَد في الهيئة (أعداد بلا أسماء) */
export async function liveMapOf(db: any, present: Presence[]) {
  const ids = present.map(p => p.user_id); if (!ids.length) return liveMap([], {});
  const rows = await safe<any[]>(db.from('portal_directory_profiles').select('user_id,city,status').in('user_id', ids).limit(500), []);
  const cityOf: Record<string, string | null> = {}; for (const r of rows) if (r.status === 'approved') cityOf[String(r.user_id)] = r.city || null;
  return liveMap(present, cityOf);
}

/** 8) أمانة الهواء: الأمانات المفتوحة — أول من يصعد يجدها */
export const bottlesOpen = async (db: any): Promise<Request[]> => (await openRequests(db)).filter(isBottle);

/** 4) ميراث الهواء */
export const menteesOf = (db: any, mentorId: string) => safe<Presence[]>(db.from('portal_onair_presence').select(PRESENCE_COLS).eq('mentor_user_id', mentorId).limit(20), []);
export const shadowedFor = (db: any, mentorId: string) => safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).contains('meta', { shadow_user_id: mentorId }).order('created_at', { ascending: false }).limit(20), []);

/** 3) صدى السؤال */
export const echoOf = (db: any, requestId: string | number) => safe<any>(db.from('portal_onair_echoes').select('id,request_id,status,day,draft,model,created_at').eq('request_id', requestId).maybeSingle(), null);
export const echoCandidates = (db: any) => safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).eq('status', 'done').contains('meta', { echo_ok: true }).order('done_at', { ascending: false }).limit(50), []);
export const echoList = (db: any) => safe<any[]>(db.from('portal_onair_echoes').select('id,request_id,status,day,draft,model,created_at').order('id', { ascending: false }).limit(100), []);
export async function saveEcho(db: any, requestId: string | number, draft: EchoDraft, model: string | null, by: string) {
  const { data, error } = await db.from('portal_onair_echoes').upsert({ request_id: requestId, status: 'draft', draft, model, created_by: by }, { onConflict: 'request_id' }).select('id,request_id,status,day,draft').single(); if (error) throw new Error(error.message); return data;
}
export async function setEcho(db: any, id: string | number, patch: { status?: string; day?: string | null; draft?: EchoDraft }) {
  const { data, error } = await db.from('portal_onair_echoes').update(patch).eq('id', id).select('id,request_id,status,day,draft').maybeSingle(); if (error) throw new Error(error.message); return data;
}
/** الصدى المعتمد ليومٍ ما — يفضّله /api/daily على التوليد */
export const echoForDay = (db: any, day: string) => safe<any>(db.from('portal_onair_echoes').select('id,draft,request_id').eq('day', day).in('status', ['approved', 'published']).limit(1).maybeSingle(), null);

// ───────────────────────────── P35 «موسم الهواء» ─────────────────────────────
/** 1) موسم الهواء: الموسم النشط (واحد) · ساعات الجهات · خريطة الموسم · وثيقة الموسم ATH-OS */
export const seasonActive = (db: any) => safe<Season | null>(db.from('portal_onair_seasons').select('id,title_ar,invite_ar,from_day,to_day,active').eq('active', true).order('id', { ascending: false }).limit(1).maybeSingle(), null);
export const seasonSlots = (db: any, seasonId: string | number) => safe<SeasonSlot[]>(db.from('portal_onair_season_slots').select('id,season_id,org_id,weekday,from_min,duration_min,public_name').eq('season_id', seasonId).order('weekday').limit(500), []);
/** لقاءات الموسم التي استقبلها منسوبو جهة داخل أيامه */
export async function seasonMeetings(db: any, season: Pick<Season, 'from_day' | 'to_day'>, orgId: string): Promise<number> {
  const ids = Array.from(await orgMemberIds(db, orgId)); if (!ids.length) return 0;
  const from = new Date(Date.parse(season.from_day) - 3 * 3600000).toISOString(), to = new Date(Date.parse(season.to_day) + 86400000 - 3 * 3600000).toISOString();
  const rows = await safe<any[]>(db.from('portal_onair_requests').select('id,done_at').in('receiver_user_id', ids.slice(0, 1000)).eq('status', 'done').gte('done_at', from).lt('done_at', to).limit(5000), []);
  return rows.length;
}
/** العرض العام للموسم: الحالة · عدد الجهات · ساعات الجهات (الاسم بإذن) · نقاط الخريطة من مدن الجهات (أعداد فقط) */
export async function seasonView(db: any, now = new Date()) {
  const s = await seasonActive(db); if (!s) return null;
  const st = seasonState(s, now); const slots = await seasonSlots(db, s.id);
  const orgIds = Array.from(new Set(slots.map(x => String(x.org_id))));
  const orgs = orgIds.length ? await safe<any[]>(db.from('portal_organizations').select('id,name_ar,city').in('id', orgIds).limit(500), []) : [];
  const orgOf: Record<string, any> = {}; for (const o of orgs) orgOf[String(o.id)] = o;
  const map: Record<string, { key: string; ar: string; x: number; y: number; n: number }> = {};
  for (const o of orgs) { const k = cityKey(o.city); if (!k || !CITY_POINTS[k]) continue; map[k] = map[k] || { key: k, ar: CITY_POINTS[k].ar, x: CITY_POINTS[k].x, y: CITY_POINTS[k].y, n: 0 }; map[k].n++; }
  let meetings = 0; if (st.phase === 'after') for (const id of orgIds.slice(0, 50)) meetings += await seasonMeetings(db, s, id);
  return {
    ...s, ...st, phrase: seasonPhraseAr(st), orgs: orgIds.length, meetings_public: meetings >= SEASON_K ? meetings : 0, line: seasonLine({ orgs: orgIds.length, meetings, phase: st.phase }),
    slots: slots.map(x => ({ id: x.id, org_id: x.public_name ? String(x.org_id) : null, org_name_ar: x.public_name ? String(orgOf[String(x.org_id)]?.name_ar || 'جهة') : null, weekday: x.weekday, from_min: x.from_min, duration_min: x.duration_min, at: slotOccursAt(x, s) })),
    map: Object.values(map),
  };
}
export async function upsertSeasonSlot(db: any, seasonId: string | number, orgId: string, slot: Pick<SeasonSlot, 'weekday' | 'from_min' | 'duration_min' | 'public_name'>, by: string) {
  const { data, error } = await db.from('portal_onair_season_slots').upsert({ season_id: seasonId, org_id: orgId, ...slot, created_by: by }, { onConflict: 'season_id,org_id' }).select('id,season_id,org_id,weekday,from_min,duration_min,public_name').single();
  if (error) throw new Error(error.message); return data as SeasonSlot;
}
export const removeSeasonSlot = (db: any, seasonId: string | number, orgId: string) => db.from('portal_onair_season_slots').delete().eq('season_id', seasonId).eq('org_id', orgId);
export const mySeasonSlot = async (db: any, seasonId: string | number, orgId: string): Promise<SeasonSlot | null> => safe<SeasonSlot | null>(db.from('portal_onair_season_slots').select('id,season_id,org_id,weekday,from_min,duration_min,public_name').eq('season_id', seasonId).eq('org_id', orgId).maybeSingle(), null);
export async function setSeason(db: any, s: Omit<Season, 'id' | 'active'>, by: string): Promise<Season> {
  await db.from('portal_onair_seasons').update({ active: false }).eq('active', true);
  const { data, error } = await db.from('portal_onair_seasons').insert({ ...s, active: true, created_by: by }).select('id,title_ar,invite_ar,from_day,to_day,active').single(); if (error) throw new Error(error.message); return data as Season;
}
export const offSeason = (db: any, id: string | number) => db.from('portal_onair_seasons').update({ active: false }).eq('id', id);
/** وثيقة الموسم للجهة — بعد انتهاء الموسم، مرة واحدة لكل موسم */
export const existingSeasonDoc = (db: any, seasonId: string | number, orgId: string) => safe<any>(db.from('portal_vc_issuances').select('id,code,issued_at').eq('kind', 'on_air_season').is('revoked_at', null).contains('vc', { _athar: { season_id: String(seasonId), org_id: String(orgId) } }).limit(1).maybeSingle(), null);
export function buildSeasonDoc(inp: { code: string; org: { id: string; name_ar: string }; season: Season; meetings: number; site: string; did: string; now?: Date; statusIndex: number | null }) {
  const now = inp.now || new Date(); const url = `${inp.site}/verify/vc?code=${encodeURIComponent(inp.code)}`; const shown = inp.meetings >= SEASON_K ? inp.meetings : null;
  return {
    '@context': VC_CONTEXTS, id: url, type: ['VerifiableCredential', 'OpenBadgeCredential'], name: 'Athar on Air — Season Document · وثيقة موسم الهواء',
    issuer: issuerBlock(inp.did, inp.site), validFrom: now.toISOString(),
    credentialSubject: { type: ['AchievementSubject'], name: inp.org.name_ar,
      achievement: { id: `${inp.site}/on-air#season`, type: ['Achievement'], name: `Athar on Air Season — ${inp.season.title_ar} (${inp.season.from_day} → ${inp.season.to_day})`, achievementType: 'Badge',
        description: 'This organization announced a golden on-air hour during an Athar on Air season. Its members went on air by their own choice and received real people. Meeting counts, when shown, come from completed meetings recorded by the platform (shown only from five). No ratings exist in Athar.',
        criteria: { narrative: 'An announced season hour by the organization admin; completed meetings derived from platform records' } },
      ...(shown !== null ? { result: [{ type: ['Result'], resultDescription: 'meetings', value: String(shown) }] } : {}) },
    ...(inp.statusIndex !== null ? { credentialStatus: statusEntry(inp.site, inp.statusIndex) } : {}),
    _athar: { kind: 'on_air_season', code: inp.code, holder: inp.org.name_ar, org_id: inp.org.id, season_id: String(inp.season.id), season_title_ar: inp.season.title_ar, from_day: inp.season.from_day, to_day: inp.season.to_day, meetings: shown, title_ar: seasonDocTitle(inp.org.name_ar, inp.season), narrative_ar: seasonDocNarrative(inp.org.name_ar, inp.season, inp.meetings), verify_url: url },
  };
}
export async function issueSeasonDoc(db: any, org: { id: string; name_ar: string }, season: Season, who: { id: string; email: string }, signer: Signer | null, site: string, did: string, rnd: () => string, now = new Date()): Promise<{ ok: true; code: string; verify_url: string } | { ok: false; error: string }> {
  if (seasonState(season, now).phase !== 'after') return { ok: false, error: 'تُصدر الوثيقة بعد انتهاء الموسم' };
  const slot = await mySeasonSlot(db, season.id, org.id); if (!slot) return { ok: false, error: 'لم تعلن الجهة ساعتها في هذا الموسم' };
  const old = await existingSeasonDoc(db, season.id, org.id); if (old) return { ok: true, code: String(old.code), verify_url: `${site}/verify/vc?code=${encodeURIComponent(String(old.code))}` };
  const meetings = await seasonMeetings(db, season, org.id); const code = seasonCode(rnd); const url = `${site}/verify/vc?code=${encodeURIComponent(code)}`;
  if (!signer) return { ok: true, code, verify_url: url };
  const { data: ins, error } = await db.from('portal_vc_issuances').insert({ code, kind: 'on_air_season', credential_id: null, user_id: null, email: null, full_name: org.name_ar, title_ar: seasonDocTitle(org.name_ar, season), kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), expires_at: null, issued_by: who.id }).select('id,status_index').single();
  if (error || !ins) return { ok: false, error: error?.message || 'تعذّر إصدار الوثيقة' };
  const vc = await signDocument(buildSeasonDoc({ code, org, season, meetings, site, did, now, statusIndex: Number((ins as any).status_index) }), signer, now);
  await db.from('portal_vc_issuances').update({ vc, digest: await documentDigest(vc, sha256) }).eq('id', (ins as any).id);
  return { ok: true, code, verify_url: url };
}
/** تذكير منسوبي الجهة الصاعدين على الهواء قبل ساعة جهتهم بـ60 دقيقة (من كرون الهيئة القائم) */
export async function remindSeason(db: any, site: string, now = new Date(), dry = false): Promise<number> {
  const s = await seasonActive(db); if (!s || seasonState(s, now).phase === 'after') return 0;
  const slots = await seasonSlots(db, s.id); let n = 0;
  for (const x of slots) {
    const at = slotOccursAt(x, s); if (!at) continue; const mins = (Date.parse(at) - now.getTime()) / 60000; if (mins <= 0 || mins > 60) continue;
    const ids = Array.from(await orgMemberIds(db, x.org_id)); if (!ids.length) continue;
    const ps = await safe<any[]>(db.from('portal_onair_presence').select('user_id,email,meta').in('user_id', ids.slice(0, 1000)).limit(500), []);
    for (const p of ps) {
      if (p.meta?.season_reminded === `${s.id}:${x.id}`) continue; if (dry) { n++; continue; }
      try { await notify(db, { kind: 'onair_season', to: { email: p.email, name: null }, ref: `onair:season:${s.id}:${x.id}:${p.user_id}`, subject: `ساعة جهتك في ${s.title_ar} بعد ${Math.ceil(mins)} دقيقة`, text: `أعلنت جهتك ساعتها في الموسم. اصعد على الهواء من: ${site}/me/onair`, url: `${site}/me/onair` }); await db.from('portal_onair_presence').update({ meta: { ...(p.meta || {}), season_reminded: `${s.id}:${x.id}` } }).eq('user_id', p.user_id); n++; } catch { /* يتابع */ }
    }
  }
  return n;
}

/** 2) صدى يعود: كم شخصًا تدرّب على «مهارة اليوم» المولودة من سؤالك/حلّك */
export async function echoReturns(db: any, echo: { day: string | null }): Promise<number> {
  if (!echo.day) return 0; const rows = await safe<any[]>(db.from('portal_daily_case_responses').select('id').eq('day', echo.day).limit(5000), []); return rows.length;
}
export async function echoBackFor(db: any, uid: string): Promise<{ request_id: string; role: 'receiver' | 'asker'; n: number; line: string; day: string }[]> {
  const echoes = await safe<any[]>(db.from('portal_onair_echoes').select('id,request_id,status,day').eq('status', 'published').order('id', { ascending: false }).limit(50), []); if (!echoes.length) return [];
  const reqs = await safe<Request[]>(db.from('portal_onair_requests').select('id,asker_user_id,receiver_user_id').in('id', echoes.map(e => e.request_id)).limit(50), []);
  const out: { request_id: string; role: 'receiver' | 'asker'; n: number; line: string; day: string }[] = [];
  for (const e of echoes) {
    const r = reqs.find(q => String(q.id) === String(e.request_id)); if (!r) continue; const role: 'receiver' | 'asker' | null = String(r.receiver_user_id) === uid ? 'receiver' : String(r.asker_user_id) === uid ? 'asker' : null; if (!role) continue;
    const n = await echoReturns(db, e); const line = echoBackLine(n, role); if (line) out.push({ request_id: String(e.request_id), role, n, line, day: String(e.day) });
  }
  return out;
}
/** إشعار «صدى يعود» عند 5 · 25 · 100 (من كرون الهيئة القائم؛ البريد للسائل المعروف والمُستقبِل) */
export async function notifyEchoBack(db: any, site: string, dry = false): Promise<number> {
  const echoes = await safe<any[]>(db.from('portal_onair_echoes').select('id,request_id,day,back_notified').eq('status', 'published').limit(100), []); let n = 0;
  for (const e of echoes) {
    const cnt = await echoReturns(db, e); const step = echoBackStep(cnt); if (step <= Number(e.back_notified || 0)) continue;
    if (dry) { n++; continue; }
    const r = await getRequest(db, e.request_id); if (!r) continue;
    const to = [{ email: r.asker_email, role: 'asker' as const }, { email: r.receiver_user_id ? await emailOf(db, r.receiver_user_id) : null, role: 'receiver' as const }].filter(x => x.email);
    for (const t of to) { try { await notify(db, { kind: 'onair_echo_back', to: { email: String(t.email), name: null }, ref: `onair:echo_back:${e.id}:${step}:${t.role}`, subject: `صدى يعود — ${echoBackLine(cnt, t.role)}`, text: `${echoBackLine(cnt, t.role)} · ${site}/me/onair`, url: `${site}/me/onair` }); } catch { /* يتابع */ } }
    await db.from('portal_onair_echoes').update({ back_notified: step }).eq('id', e.id).then(() => null, () => null); n++;
  }
  return n;
}
async function emailOf(db: any, uid: string): Promise<string | null> { const p = await safe<any>(db.from('portal_onair_presence').select('email').eq('user_id', uid).maybeSingle(), null); return p?.email || null; }

/** 3) أمانة إلى جهة: أمانات في عهدة الجهة الآن */
export const heldBottlesOf = async (db: any, orgId: string, now = Date.now()): Promise<Request[]> => (await openRequests(db)).filter(r => isBottle(r) && String(r.org_id || '') === String(orgId) && !holdReleased(r, now));

/** 4) ميراث متبادل */
export async function legacyCompleteCount(db: any, uid: string): Promise<number> {
  const p = await myPresence(db, uid); const mine: string[] = Array.isArray(p?.meta?.legacy_complete) ? p!.meta.legacy_complete : [];
  const asMentee = await safe<any[]>(db.from('portal_onair_presence').select('user_id').contains('meta', { legacy_complete: [uid] }).limit(20), []);
  return new Set([...mine, ...asMentee.map(x => String(x.user_id))]).size;
}
export async function markLegacyComplete(db: any, menteeId: string, mentorId: string) {
  const m = await myPresence(db, menteeId); if (!m) return; const done: string[] = Array.isArray(m.meta?.legacy_complete) ? m.meta.legacy_complete : [];
  await db.from('portal_onair_presence').update({ meta: { ...(m.meta || {}), legacy_complete: Array.from(new Set([...done, mentorId])), legacy_complete_at: new Date().toISOString() } }).eq('user_id', menteeId).then(() => null, () => null);
}
/** من ينتظر دوره المعكوس معي؟ (المرافَق الذي أُعطي الدور) */
export const reversePendingFor = (db: any, menteeId: string) => safe<Presence[]>(db.from('portal_onair_presence').select(PRESENCE_COLS).eq('reverse_user_id', menteeId).limit(5), []);

/** 5) الهواء على الخريطة بالزمن: سجلّ خفيف عند الصعود/النزول · الشبكة · التنظيف */
export async function logPresenceOn(db: any, uid: string, until: string, now = new Date()) {
  const prof = await safe<any>(db.from('portal_directory_profiles').select('city,status').eq('user_id', uid).maybeSingle(), null); const key = prof?.status === 'approved' ? cityKey(prof.city) : null;
  await db.from('portal_onair_presence_log').update({ ended_at: now.toISOString() }).eq('user_id', uid).gt('ended_at', now.toISOString()).then(() => null, () => null);   // أغلق أي حضور ما زال مفتوحًا
  await db.from('portal_onair_presence_log').insert({ user_id: uid, city_key: key, started_at: now.toISOString(), ended_at: until }).then(() => null, () => null);
}
export const logPresenceOff = (db: any, uid: string, now = new Date()) => db.from('portal_onair_presence_log').update({ ended_at: now.toISOString() }).eq('user_id', uid).gt('ended_at', now.toISOString()).then(() => null, () => null);
export async function whenGridOf(db: any, now = new Date()) {
  const since = new Date(now.getTime() - WHEN_WEEKS * 7 * 86400000).toISOString();
  const rows = await safe<any[]>(db.from('portal_onair_presence_log').select('user_id,city_key,started_at,ended_at').gte('started_at', since).limit(20000), []);
  return whenGrid(rows, now);
}
export async function cleanPresenceLog(db: any, now = new Date(), dry = false): Promise<number> {
  const before = new Date(now.getTime() - PRESENCE_LOG_DAYS * 86400000).toISOString();
  const old = await safe<any[]>(db.from('portal_onair_presence_log').select('id').lt('started_at', before).limit(5000), []); if (!old.length || dry) return old.length;
  await db.from('portal_onair_presence_log').delete().lt('started_at', before).then(() => null, () => null); return old.length;
}

/** 6) همسة المترجم: الهمسة الجارية الآن (عامة) · آخر همسة للمترجم */
export async function whisperNow(db: any, now = Date.now()) {
  const rows = await safe<Request[]>(db.from('portal_onair_requests').select(REQ_COLS).eq('status', 'taken').contains('meta', { whisper: true }).order('taken_at', { ascending: false }).limit(3), []);
  const live = (await settleStale(db, rows, now)).find(r => r.status === 'taken' && isWhisper(r)); if (!live) return null;
  return { request_id: String(live.id), room_code: live.room_code, title_ar: live.text_ar, started_at: live.taken_at, ends_at: whisperEndsAt(String(live.taken_at)), interpreter_user_id: live.receiver_user_id };
}
export const lastWhisperOf = async (db: any, uid: string): Promise<string | null> => { const r = await safe<any>(db.from('portal_onair_requests').select('taken_at').eq('receiver_user_id', uid).contains('meta', { whisper: true }).order('taken_at', { ascending: false }).limit(1).maybeSingle(), null); return r?.taken_at || null; };
export async function dailyTitleToday(db: any, now = new Date()): Promise<string> {
  const day = new Date(now.getTime() + 3 * 3600000).toISOString().slice(0, 10);
  const c = await safe<any>(db.from('portal_daily_cases').select('title_ar').eq('day', day).limit(1).maybeSingle(), null); return c?.title_ar ? `مهارة اليوم بالإشارة — ${c.title_ar}` : 'مهارة اليوم بالإشارة';
}
export { ECHO_BACK_STEPS };
