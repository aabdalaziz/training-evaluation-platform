// P32 «أَثَر للجميع» — تحميل وحفظ ملف «أَثَر يلبّي احتياجاتي» · مُضاعِف الوقت · إحصاءات k≥5 · «نسخة أبسط» · أحداث الشمول للجهة
import { runAi } from '../ai/athar';
import type { AiResult } from '../ai/athar';
import { parseJsonLoose } from '../ai/prompts';
import type { OrgPathInput } from '../org-horizon/registry';
import { ACCESS_K, ACCESS_TIME_FACTOR, NEEDS, REPORT_COLS, SIMPLE_COLS, buildSimplifyPrompt, cleanNeeds, kAnon, localSimplify, parseSimplify, textHash, timeFactor, cleanFeatures } from './registry';
import type { AccessReport, Need, SimpleSource, SimpleText } from './registry';

export type AccessProfile = { user_id: string; email: string; needs: Need[]; helps_ar: string | null; share_staff: boolean; created_at: string; updated_at: string };
export const PROFILE_COLS = 'user_id,email,needs,helps_ar,share_staff,created_at,updated_at';
const lower = (s: string | null | undefined) => String(s || '').trim().toLowerCase();
const safe = <T,>(p: PromiseLike<{ data: T | null; error?: any }>): Promise<T | null> => Promise.resolve(p).then(r => (r && !r.error ? r.data : null), () => null);

/** ملف صاحب الطلب — بعميل المستخدم (RLS: صاحبه فقط) */
export async function loadAccessProfile(userDb: any, userId: string): Promise<AccessProfile | null> {
  const row = await safe<any>(userDb.from('portal_access_profiles').select(PROFILE_COLS).eq('user_id', userId).maybeSingle());
  return row ? { ...row, needs: cleanNeeds(row.needs) } : null;
}
/** حفظ — upsert بصاحبه؛ الاحتياجات تُنظَّف إلى الرموز المعروفة فقط */
export async function saveAccessProfile(userDb: any, me: { id: string; email: string }, b: { needs?: unknown; helps_ar?: unknown; share_staff?: unknown }): Promise<{ profile: AccessProfile | null; error: string | null }> {
  const needs = cleanNeeds(b.needs); const helps = typeof b.helps_ar === 'string' ? b.helps_ar.trim().slice(0, 400) : null; const share = b.share_staff === true;
  const { data, error } = await userDb.from('portal_access_profiles').upsert({ user_id: me.id, email: lower(me.email), needs, helps_ar: helps || null, share_staff: share, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }).select(PROFILE_COLS).single();
  if (error) return { profile: null, error: error.message || 'تعذّر الحفظ' };
  return { profile: { ...data, needs: cleanNeeds(data.needs) }, error: null };
}
export async function deleteAccessProfile(userDb: any, userId: string): Promise<boolean> {
  const { error } = await userDb.from('portal_access_profiles').delete().eq('user_id', userId); return !error;
}

/** من بين هذه البُرُد: من أعلن «وقتًا أطول»؟ — بالخدمة؛ النتيجة لا تُعاد للعميل أبدًا، تُستعمل للمُهل فقط */
export async function moreTimeEmails(db: any, emails: (string | null | undefined)[]): Promise<Set<string>> {
  const list = Array.from(new Set(emails.map(lower).filter(Boolean))).slice(0, 200); if (!list.length) return new Set();
  const rows = await safe<any[]>(db.from('portal_access_profiles').select('email,needs').in('email', list).limit(200));
  return new Set((rows || []).filter(r => Array.isArray(r.needs) && r.needs.includes('more_time')).map(r => lower(r.email)));
}
/** مُضاعِف مهلة عهد/دعوة: 1.5 إن كان أحد الطرفين قد أعلن «وقتًا أطول» وإلا 1 */
export async function pairTimeFactor(db: any, emails: (string | null | undefined)[]): Promise<number> {
  const set = await moreTimeEmails(db, emails); return timeFactor(emails.some(e => set.has(lower(e))));
}
/** للمهام الدورية: مجموعة بُرُد «وقتًا أطول» من صفوف كثيرة دفعةً واحدة */
export async function moreTimeSetFor(db: any, rows: { emails: (string | null | undefined)[] }[]): Promise<Set<string>> {
  return moreTimeEmails(db, rows.flatMap(r => r.emails));
}
export const rowFactor = (set: Set<string>, emails: (string | null | undefined)[]) => (emails.some(e => set.has(lower(e))) ? ACCESS_TIME_FACTOR : 1);

/** إحصاءات عامة مجمَّعة — بالخدمة؛ لا رقم أقل من k */
export type AccessStats = { people: number | null; needs: { key: Need; n: number }[]; reports: { open: number; fixed: number; wontfix: number }; simple_approved: number; programs_ready: number; k: number };
export async function accessStats(db: any): Promise<AccessStats> {
  const [profiles, reports, texts, programs] = await Promise.all([
    safe<any[]>(db.from('portal_access_profiles').select('needs').limit(5000)),
    safe<any[]>(db.from('portal_access_reports').select('status').limit(5000)),
    safe<any[]>(db.from('portal_access_texts').select('status').eq('status', 'approved').limit(5000)),
    safe<any[]>(db.from('programs').select('id,access_features').limit(500)),
  ]);
  const counts = Object.fromEntries(NEEDS.map(n => [n, 0])) as Record<Need, number>;
  for (const p of profiles || []) for (const n of cleanNeeds(p.needs)) counts[n]++;
  const k = kAnon(counts, ACCESS_K); const people = (profiles || []).length;
  const rep = { open: 0, fixed: 0, wontfix: 0 }; for (const r of reports || []) if (r.status in rep) (rep as any)[r.status]++;
  return { people: people >= ACCESS_K ? people : null, needs: k.items, reports: rep, simple_approved: (texts || []).length, programs_ready: (programs || []).filter(p => cleanFeatures(p.access_features).length > 0).length, k: ACCESS_K };
}

/** الطاقم فقط: الملفات التي سمح أصحابها بالمشاركة من بين بُرُد بعينها (تنسيق برنامج) — بالخدمة */
export async function sharedNeedsFor(db: any, emails: string[]): Promise<{ email: string; needs: Need[]; helps_ar: string | null }[]> {
  const list = Array.from(new Set(emails.map(lower).filter(Boolean))).slice(0, 300); if (!list.length) return [];
  const rows = await safe<any[]>(db.from('portal_access_profiles').select('email,needs,helps_ar,share_staff').in('email', list).eq('share_staff', true).limit(300));
  return (rows || []).map(r => ({ email: lower(r.email), needs: cleanNeeds(r.needs), helps_ar: r.helps_ar || null }));
}

/** النص الأصلي لمصدر «نسخة أبسط» — الخادم يحمّله بنفسه (لا نصّ حرًّا من العميل) */
export async function loadSourceText(db: any, source: SimpleSource, sourceId: string): Promise<string | null> {
  if (source === 'program_intro' || source === 'program_objectives') {
    const p = await safe<any>(db.from('programs').select('id,intro_ar,objectives_ar,is_public').eq('id', sourceId).maybeSingle());
    if (!p) return null; const t = source === 'program_intro' ? p.intro_ar : p.objectives_ar; return t && String(t).trim().length >= 10 ? String(t) : null;
  }
  if (source === 'daily_case') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sourceId)) return null;
    const c = await safe<any>(db.from('portal_daily_cases').select('id,day,scene_ar,role_ar,situation_ar,ask_ar').eq('day', sourceId).maybeSingle());
    if (!c) return null;
    return [c.scene_ar, c.role_ar, c.situation_ar, c.ask_ar].filter(Boolean).join('\n');
  }
  return null;
}
export async function getSimpleText(db: any, source: SimpleSource, sourceId: string): Promise<SimpleText | null> {
  return safe<SimpleText>(db.from('portal_access_texts').select(SIMPLE_COLS).eq('source', source).eq('source_id', sourceId).maybeSingle());
}
/** طلب «نسخة أبسط»: إن وُجدت نسخة لهذا الأصل تُعاد؛ وإلا تُولَّد وتُحفظ pending حتى يعتمدها الطاقم */
export async function requestSimpleText(db: any, who: { id: string }, source: SimpleSource, sourceId: string): Promise<{ text: SimpleText | null; created: boolean; source: 'ai' | 'local' | 'cache'; error: string | null; model: string | null; ai: AiResult<{ simple_ar: string }> | null }> {
  const original = await loadSourceText(db, source, sourceId); if (!original) return { text: null, created: false, source: 'cache', error: 'لا نصّ لهذا المصدر', model: null, ai: null };
  const hash = textHash(original); const existing = await getSimpleText(db, source, sourceId);
  if (existing && existing.original_hash === hash) return { text: existing, created: false, source: 'cache', error: null, model: existing.model, ai: null };
  const p = buildSimplifyPrompt(original);
  const res = await runAi<{ simple_ar: string }>({ system: p.system, user: p.user, parse: raw => parseSimplify(parseJsonLoose(raw)), local: () => ({ simple_ar: localSimplify(original) }), budgetMs: 20000, fast: true });
  const simple = res.data.simple_ar.slice(0, 6000); if (simple.length < 10) return { text: null, created: false, source: res.source as any, error: 'تعذّر التبسيط', model: res.model, ai: res };
  const row = { source, source_id: sourceId, original_hash: hash, simple_ar: simple, status: 'pending', requested_by: who.id, approved_by: null, approved_at: null, model: res.source === 'ai' ? res.model : 'local', updated_at: new Date().toISOString() };
  const { data, error } = await db.from('portal_access_texts').upsert(row, { onConflict: 'source,source_id' }).select(SIMPLE_COLS).single();
  if (error) return { text: null, created: false, source: res.source as any, error: error.message, model: res.model, ai: res };
  return { text: data as SimpleText, created: true, source: res.source as any, error: null, model: res.model, ai: res };
}

/** بلاغات الوصول — بالخدمة */
export async function listReports(db: any, status: string | null, limit = 100): Promise<AccessReport[]> {
  let q = db.from('portal_access_reports').select(REPORT_COLS).order('created_at', { ascending: false }).limit(limit); if (status) q = q.eq('status', status);
  return (await safe<AccessReport[]>(q)) || [];
}

/** أحداث الشمول لدرب الجهة: منسوب مؤكَّد قُبل في برنامج مهيَّأ للجميع (له access_features) — الشخص = بريد، لا يُنشر */
export async function inclusionEvents(db: any, members: string[]): Promise<{ person: string; at: string }[]> {
  const mem = Array.from(new Set(members.map(lower).filter(Boolean))); if (!mem.length) return [];
  const programs = await safe<any[]>(db.from('programs').select('id,access_features').limit(500));
  const ready = new Set((programs || []).filter(p => cleanFeatures(p.access_features).length > 0).map(p => p.id)); if (!ready.size) return [];
  const out: { person: string; at: string }[] = [];
  for (let i = 0; i < mem.length; i += 100) {
    const part = mem.slice(i, i + 100);
    const rows = await safe<any[]>(db.from('portal_enrollments').select('email,program_id,status,decided_at,created_at').in('email', part).eq('status', 'approved').limit(5000));
    for (const r of rows || []) if (ready.has(r.program_id)) out.push({ person: lower(r.email), at: r.decided_at || r.created_at });
  }
  return out;
}
/** كم برنامجًا مهيَّأً للجميع الآن — لعرض خيار «تعهّد الشمول» فقط حين يكون ممكنًا */
export async function readyProgramsCount(db: any): Promise<number> {
  const programs = await safe<any[]>(db.from('programs').select('id,access_features,is_public').limit(500));
  return (programs || []).filter(p => cleanFeatures(p.access_features).length > 0).length;
}
export const withInclusion = (inp: OrgPathInput, events: { person: string; at: string }[]): OrgPathInput => ({ ...inp, inclusion: events });
