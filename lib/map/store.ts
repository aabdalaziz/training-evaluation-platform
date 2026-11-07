// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 «خريطة أثرك» — طبقة الخادم: تحميل الوقائع + قرارات المتعلّم، وحفظ الخيوط، واللقطة السنوية الموقَّعة (رمز + بصمة)، والتحقّق العام
 *  • المصدر الوحيد للوقائع: lib/journey/load (loadJourneyInput) + ✋ من portal_word_replies (chip = need_help)
 *  • القرارات: portal_map_threads (kept/declined/manual) — المبقى يحتاج «لأن…» ≤ 120 حرفًا
 *  • اللقطة: portal_map_snapshots — واحدة نافذة لكل سنة؛ إعادة التوقيع تُبطل السابقة؛ الرابط العام اختياري؛ الإبطال فوري
 *  • لا ذكاء اصطناعي · لا بريد · لا تخزين وسائط · لا يدخل في أي تقييم
 */
import { createHash, randomBytes } from 'node:crypto';
import { loadJourneyInput } from '../journey/load';
import { jcs } from '../portal/vc';
import { buildMap, snapshotBody, validateNote, isStationKey, threadKey, RULE_AR, CODE_RE, snapshotTitle, MAP_OFFICIAL } from './registry';
import type { AtharMap, Decision, MapInput, RuleKey, SnapshotBody } from './registry';

type Db = any; type Me = { id: string; email: string };
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: string) => String(s || '').trim().toLowerCase();
export const DEC_COLS = 'from_key,to_key,rule,status,note_ar,decided_at';
export const SNAP_COLS = 'id,created_at,year,code,digest,is_public,revoked_at';

export async function loadHands(db: Db, me: Me): Promise<MapInput['hands']> {
  const { data } = await db.from('portal_word_replies').select('notice_id,created_at,chip').eq('learner_email', lower(me.email)).eq('chip', 'need_help').order('created_at', { ascending: true }).limit(200);
  return arr<any>(data).map((r) => ({ at: String(r.created_at), notice_id: String(r.notice_id) }));
}
export async function loadDecisions(db: Db, me: Me): Promise<Decision[]> {
  const { data } = await db.from('portal_map_threads').select(DEC_COLS).eq('email', lower(me.email)).limit(500);
  return arr<any>(data).map((r) => ({ from_key: String(r.from_key), to_key: String(r.to_key), rule: String(r.rule || 'manual'), status: r.status === 'declined' ? 'declined' : 'kept', note_ar: r.note_ar || null, decided_at: String(r.decided_at || '') }));
}
export async function loadMap(db: Db, me: Me): Promise<AtharMap> {
  const [inp, hands, decisions] = await Promise.all([loadJourneyInput(db, me), loadHands(db, me), loadDecisions(db, me)]);
  return buildMap({ ...inp, hands } as MapInput, decisions);
}

/** الإبقاء على خيط (مقترَح أو يدوي) مع «لأن…» */
export async function keepThread(db: Db, me: Me, body: { from: string; to: string; rule?: string; note: string }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isStationKey(body.from) || !isStationKey(body.to) || body.from === body.to) return { ok: false, error: 'محطتان غير صالحتين', status: 400 };
  const v = validateNote(body.note); if (!v.ok) return { ok: false, error: v.error, status: 400 };
  const map = await loadMap(db, me); const keys = new Set(map.stations.map((s) => s.key));
  if (!keys.has(body.from) || !keys.has(body.to)) return { ok: false, error: 'إحدى المحطتين ليست في خريطتك', status: 404 };
  const proposed = map.threads.find((t) => t.from === body.from && t.to === body.to);
  const rule: RuleKey = proposed ? proposed.rule : 'manual';
  const row = { user_id: me.id, email: lower(me.email), from_key: body.from, to_key: body.to, rule, status: 'kept', note_ar: v.note, decided_at: new Date().toISOString() };
  const { error } = await db.from('portal_map_threads').upsert(row, { onConflict: 'email,from_key,to_key' });
  if (error) return { ok: false, error: 'تعذّر حفظ الخيط', status: 500 };
  return { ok: true };
}
/** استبعاد خيط مقترَح — لا يُقترح مجددًا */
export async function declineThread(db: Db, me: Me, body: { from: string; to: string }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isStationKey(body.from) || !isStationKey(body.to)) return { ok: false, error: 'محطتان غير صالحتين', status: 400 };
  const map = await loadMap(db, me); const t = map.threads.find((x) => x.from === body.from && x.to === body.to);
  if (!t) return { ok: false, error: 'هذا الخيط ليس في خريطتك', status: 404 };
  const row = { user_id: me.id, email: lower(me.email), from_key: body.from, to_key: body.to, rule: t.rule, status: 'declined', note_ar: null, decided_at: new Date().toISOString() };
  const { error } = await db.from('portal_map_threads').upsert(row, { onConflict: 'email,from_key,to_key' });
  if (error) return { ok: false, error: 'تعذّر الحفظ', status: 500 };
  return { ok: true };
}
/** حذف قرار (خيط مبقى أو مستبعَد) فورًا — يعود الخيط مقترَحًا إن كانت له قاعدة */
export async function removeThread(db: Db, me: Me, body: { from: string; to: string }): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!isStationKey(body.from) || !isStationKey(body.to)) return { ok: false, error: 'محطتان غير صالحتين', status: 400 };
  const { error } = await db.from('portal_map_threads').delete().eq('email', lower(me.email)).eq('from_key', body.from).eq('to_key', body.to);
  if (error) return { ok: false, error: 'تعذّر الحذف', status: 500 };
  return { ok: true };
}

// ——— اللقطة السنوية ———
export function mapCode(): string { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const b = randomBytes(8); const s = Array.from(b).map((x) => A[x % A.length]).join(''); return `ATH-MP-${s.slice(0, 4)}-${s.slice(4, 8)}`; }
export const digestOf = (doc: unknown): string => createHash('sha256').update(jcs(doc)).digest('hex');
export type Snap = { id: string; created_at: string; year: number; code: string; digest: string; is_public: boolean; revoked_at: string | null; title_ar: string; verify_path: string; public_path: string | null };
const snapOut = (r: any): Snap => ({ id: String(r.id), created_at: String(r.created_at), year: Number(r.year), code: String(r.code), digest: String(r.digest), is_public: !!r.is_public, revoked_at: r.revoked_at || null, title_ar: snapshotTitle(Number(r.year)), verify_path: `/verify/map?code=${encodeURIComponent(String(r.code))}`, public_path: r.is_public && !r.revoked_at ? `/verify/map?code=${encodeURIComponent(String(r.code))}&view=1` : null });
export async function mySnapshots(db: Db, me: Me): Promise<Snap[]> {
  const { data } = await db.from('portal_map_snapshots').select(SNAP_COLS).eq('email', lower(me.email)).order('year', { ascending: false }).order('created_at', { ascending: false }).limit(20);
  return arr<any>(data).map(snapOut);
}
export const yearOf = (now = new Date()) => Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Riyadh' }).format(now));
/** توقيع «خريطة أثري <سنة>» — يُبطل لقطة السنة السابقة إن وُجدت (واحدة نافذة لكل سنة) */
export async function signSnapshot(db: Db, me: Me, opts: { year?: number; is_public?: boolean; now?: Date } = {}): Promise<{ ok: true; snap: Snap; body: SnapshotBody } | { ok: false; error: string; status: number }> {
  const now = opts.now || new Date(); const year = opts.year || yearOf(now); if (year > yearOf(now)) return { ok: false, error: 'لا توقيع لسنة لم تأتِ بعد', status: 400 };
  const map = await loadMap(db, me); if (!map.counts.kept) return { ok: false, error: 'أبقِ خيطًا واحدًا على الأقل قبل توقيع خريطتك', status: 409 };
  const body = snapshotBody(map, year); if (!body.threads.length) return { ok: false, error: `لا خيوط مبقاة حتى نهاية ${year}`, status: 409 };
  await db.from('portal_map_snapshots').update({ revoked_at: now.toISOString(), meta: { reason: 'resigned' } }).eq('email', lower(me.email)).eq('year', year).is('revoked_at', null);
  const digest = digestOf(body); let last: any = null;
  for (let i = 0; i < 3; i++) {
    const row = { user_id: me.id, email: lower(me.email), year, code: mapCode(), digest, body, is_public: !!opts.is_public, created_at: now.toISOString() };
    const { data, error } = await db.from('portal_map_snapshots').insert(row).select(SNAP_COLS).maybeSingle(); last = error; if (!error && data) return { ok: true, snap: snapOut(data), body };
    if (!String(error?.message || '').includes('code')) break;
  }
  return { ok: false, error: last?.message ? 'تعذّر حفظ اللقطة' : 'تعذّر حفظ اللقطة', status: 500 };
}
export async function setSnapshotPublic(db: Db, me: Me, id: string, is_public: boolean): Promise<{ ok: boolean }> {
  const { error } = await db.from('portal_map_snapshots').update({ is_public }).eq('email', lower(me.email)).eq('id', id).is('revoked_at', null); return { ok: !error };
}
export async function revokeSnapshot(db: Db, me: Me, id: string): Promise<{ ok: boolean }> {
  const { error } = await db.from('portal_map_snapshots').update({ revoked_at: new Date().toISOString(), is_public: false, meta: { reason: 'revoked_by_owner' } }).eq('email', lower(me.email)).eq('id', id).is('revoked_at', null); return { ok: !error };
}
/** التحقّق العام: صحّة الرمز + سلامة البصمة + حالة الإبطال — والجسم العام فقط إن كانت اللقطة عامة */
export type VerifyOut = { valid: boolean; revoked?: boolean; intact?: boolean; year?: number; title_ar?: string; signed_at?: string; digest?: string; counts?: SnapshotBody['counts']; is_public?: boolean; body?: SnapshotBody; type_ar?: string };
export async function verifyMap(db: Db, code: string): Promise<VerifyOut> {
  const c = String(code || '').trim().toUpperCase(); if (!CODE_RE.test(c)) return { valid: false };
  const { data: r } = await db.from('portal_map_snapshots').select('id,created_at,year,code,digest,body,is_public,revoked_at').eq('code', c).maybeSingle(); if (!r) return { valid: false };
  const intact = digestOf(r.body) === r.digest; const revoked = !!r.revoked_at;
  const out: VerifyOut = { valid: true, revoked, intact, year: Number(r.year), title_ar: snapshotTitle(Number(r.year)), signed_at: String(r.created_at), digest: String(r.digest), type_ar: MAP_OFFICIAL.ar, is_public: !!r.is_public && !revoked };
  if (!revoked) { out.counts = (r.body as SnapshotBody).counts; if (r.is_public) out.body = r.body as SnapshotBody; }
  return out;
}
export { RULE_AR, threadKey };
