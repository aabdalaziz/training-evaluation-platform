// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P59 «نسيج الشعبة» — طبقة الخادم: شُعب المدرّب → قوائم المنسوبين → خرائط P58 لكل متعلّم (بالتوازي، على دفعات) → weave()
 *  • الشُّعب والمنسوبون من «دفتر اليوم» نفسه (collectDayBook: classrooms + التسجيلات المعتمدة ∪ سجلّات الحضور) — مصدر واحد للحقيقة
 *  • «لأن…» المأذونة فقط: portal_map_threads.share_trainer = true و status = kept
 *  • ذاكرة قصيرة داخل النسخة (5 دقائق) لأن تجميع 40 خريطة يكلّف ثوانيَ — لا تُخزَّن في قاعدة البيانات
 *  • زملاء الخيط للمتعلّم: صفوف الخيوط المبقاة لزملاء شُعبه (استعلام واحد) → peersOf
 */
import { loadMap } from './store';
import { weave, peersOf, WEAVE_LIMITS } from './weave';
import type { Weave, LearnerMap, SharedNote } from './weave';
import type { AtharMap } from './registry';

type Db = any;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: string) => String(s || '').trim().toLowerCase();
const NIL = '00000000-0000-0000-0000-000000000000';
export type WeaveRoom = { id: string; code: string; section_name: string | null; roster: number };

/** قائمة المنسوبين = قائمة «دفتر اليوم» نفسها (التسجيلات المعتمدة ∪ سجلّات الحضور) — تُمرَّر من الواجهة؛ هنا نربطها بمعرّفات الحسابات */
export async function rosterOf(db: Db, emailsIn: string[]): Promise<{ email: string; user_id: string }[]> {
  const emails = [...new Set(emailsIn.map(lower).filter(Boolean))].slice(0, WEAVE_LIMITS.maxRoster);
  if (!emails.length) return [];
  const { data: prof } = await db.from('profiles').select('id, email').in('email', emails).limit(500);
  const idOf = new Map(arr<any>(prof).map((p) => [lower(p.email), String(p.id)]));
  return emails.map((email) => ({ email, user_id: idOf.get(email) || NIL }));
}

/** خرائط المنسوبين على دفعات من 6 */
async function mapsOf(db: Db, roster: { email: string; user_id: string }[]): Promise<LearnerMap[]> {
  const out: LearnerMap[] = [];
  for (let i = 0; i < roster.length; i += 6) {
    const part = roster.slice(i, i + 6);
    const maps = await Promise.all(part.map(async (l): Promise<LearnerMap> => { try { const m: AtharMap = await loadMap(db, { id: l.user_id, email: l.email }); return { email: l.email, map: { stations: m.stations, threads: m.threads } }; } catch { return { email: l.email, map: { stations: [], threads: [] } }; } }));
    out.push(...maps);
  }
  return out;
}

async function sharedNotes(db: Db, emails: string[]): Promise<SharedNote[]> {
  if (!emails.length) return [];
  const { data } = await db.from('portal_map_threads').select('email, from_key, to_key, rule, note_ar').in('email', emails).eq('status', 'kept').eq('share_trainer', true).limit(2000);
  return arr<any>(data).filter((r) => r.note_ar).map((r) => ({ email: lower(r.email), from_key: String(r.from_key), to_key: String(r.to_key), rule: String(r.rule || 'manual'), note_ar: String(r.note_ar) }));
}

const CACHE = new Map<string, { at: number; roster: number; maps: LearnerMap[] }>(); const TTL = 5 * 60 * 1000;
/** نسيج شعبة — الخرائط (الجزء الثقيل) في ذاكرة قصيرة؛ «لأن…» المأذونة تُقرأ طازجة كل مرة حتى يكون سحب الإذن فوريًا (fresh=true يتجاوز الذاكرة كلها) */
export async function loadWeave(db: Db, classroomId: string, emails: string[], opts: { now?: Date; fresh?: boolean } = {}): Promise<Weave> {
  const now = opts.now || new Date(); const hit = CACHE.get(classroomId);
  const roster = await rosterOf(db, emails);
  const fresh = opts.fresh || !hit || now.getTime() - hit.at >= TTL || hit.roster !== roster.length;
  const [maps, shared] = await Promise.all([fresh ? mapsOf(db, roster) : Promise.resolve(hit!.maps), sharedNotes(db, roster.map((r) => r.email))]);
  if (fresh) { CACHE.set(classroomId, { at: now.getTime(), roster: roster.length, maps }); if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value as string); }
  return weave(maps, shared, { now, roster: roster.length });
}
export const forgetWeave = (classroomId?: string) => { if (classroomId) CACHE.delete(classroomId); else CACHE.clear(); };

/** للمتعلّم: «خيطك نسجه معك N من زملائك» — زملاء شُعبه المعتمدة · k ≥ 5 · بلا أسماء */
export async function peersForLearner(db: Db, email: string, mine: Array<{ from: string; to: string }>): Promise<Record<string, number>> {
  if (!mine.length) return {};
  const { data: my } = await db.from('portal_enrollments').select('classroom_id').eq('email', lower(email)).eq('status', 'approved').limit(20);
  const cids = [...new Set(arr<any>(my).map((r) => String(r.classroom_id)))]; if (!cids.length) return {};
  const { data: en } = await db.from('portal_enrollments').select('email').in('classroom_id', cids).eq('status', 'approved').limit(3000);
  const peers = [...new Set(arr<any>(en).map((r) => lower(r.email)))].filter((e) => e && e !== lower(email)).slice(0, 300); if (!peers.length) return {};
  const { data: rows } = await db.from('portal_map_threads').select('email, from_key, to_key').in('email', peers).eq('status', 'kept').limit(5000);
  return peersOf(mine, arr<any>(rows).map((r) => ({ email: String(r.email), from_key: String(r.from_key), to_key: String(r.to_key) })), email);
}
