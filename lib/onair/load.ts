// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P33 «أَثَر معك — على الهواء» — القراءة والكتابة (بمفتاح الخدمة عبر /api/onair و/api/admin/onair فقط):
 *  الحضور · الأشخاص (من هيئة أَثَر) · النوافذ · الطلبات والصفّ · الرسائل · الساعات · شهادة ATH-OA · الإحصاءات العامة · النداء.
 */
import { VC_CONTEXTS, issuerBlock, statusEntry, documentDigest } from '../portal/vc';
import { signDocument, sha256 } from '../portal/vc-server';
import type { Signer } from '../portal/vc-server';
import { notify } from '../portal/notify';
import { FACE_AR, CERT_HOURS, CERT_MEETINGS, GRADE_LABEL, certCode, hoursFrom, isOnAir, publicPresence, publicStats, avgResponseMin, matchReceivers, quickExpired, quickClosed, QUICK_CLOSE_MIN, goldenState, liveMap, isBottle, BOTTLE_AR, STATS_K } from './registry';
import type { Presence, Request, Win, Grade, Face, Hours, Golden, EchoDraft } from './registry';

const lower = (s: unknown) => String(s || '').trim().toLowerCase();
async function safe<T>(q: PromiseLike<{ data: any; error: any }>, fb: T): Promise<T> { try { const { data, error } = await q; if (error) return fb; return (data ?? fb) as T; } catch { return fb; } }
const PRESENCE_COLS = 'user_id,email,face,receives,domains,alt_link,on_air_until,grounded_at,grounded_note,meta,updated_at,text_only,mentor_user_id,mentor_status,shadow_left';
const REQ_COLS = 'id,kind,status,asker_user_id,asker_email,asker_alias,domain,text_ar,receiver_user_id,room_code,taken_at,done_at,outcome,what_changed_ar,duration_min,meta,created_at,org_id';

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
export async function onAirFacts(db: any, uid: string | null | undefined) { if (!uid) return { meetings: 0, hours: 0 }; const h = await hoursFor(db, uid); return { meetings: h.meetings, hours: h.hours }; }
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

/** 8) رسالة في زجاجة: الزجاجات المفتوحة — أول من يصعد يجدها */
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
