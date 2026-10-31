// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** هيئة أَثَر (P31) — طبقة القراءة: السيرة · القوائم العامة · «ما شهده أَثَر» من جداول الأحداث القائمة · مدرب منصة التقييم · عقود التعاون. كل استعلام محميّ: الفشل = لا شيء. */
import { PROFILE_COLS, ENGAGEMENT_COLS, EMPTY_WITNESS, engagementFacts, lower } from './registry';
import type { Profile, Engagement, WitnessFacts } from './registry';
import { domainLabel } from '../portal/skills';

const safe = async <T,>(p: PromiseLike<{ data: T | null; error?: any }>, fb: T): Promise<T> => { try { const r = await p; return (r && !r.error && r.data != null ? r.data : fb) as T; } catch { return fb; } };
const rows = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);
const pick = (email: string, userId?: string | null) => (q: any) => (userId ? q.or(`user_id.eq.${userId},email.ilike.${email}`) : q.ilike('email', email));

export async function loadMyProfile(db: any, me: { id?: string | null; email: string }): Promise<Profile | null> {
  const list = rows<Profile>(await safe(pick(lower(me.email), me.id)(db.from('portal_directory_profiles').select(PROFILE_COLS)).order('created_at', { ascending: true }).limit(2), []));
  return list.find(p => p.user_id && p.user_id === me.id) || list.find(p => lower(p.email) === lower(me.email)) || list[0] || null;
}
export const loadProfileById = (db: any, id: string) => safe<Profile | null>(db.from('portal_directory_profiles').select(PROFILE_COLS).eq('id', id).maybeSingle(), null);
export const loadProfileBySlug = (db: any, slug: string) => safe<Profile | null>(db.from('portal_directory_profiles').select(PROFILE_COLS).eq('slug', slug).maybeSingle(), null);
/** المعتمدون المدرجون (التصفية الدقيقة في الذاكرة عبر registry.matches) */
export const loadPublicProfiles = (db: any) => safe<Profile[]>(db.from('portal_directory_profiles').select(PROFILE_COLS).eq('status', 'approved').eq('listed', true).order('updated_at', { ascending: false }).limit(2000), []).then(rows);
export const loadAllProfiles = (db: any) => safe<Profile[]>(db.from('portal_directory_profiles').select(PROFILE_COLS).order('updated_at', { ascending: false }).limit(2000), []).then(rows);

export type Meta = { skills: { id: string; code: string; name_ar: string; domain: string; domain_ar: string }[]; sectors: { code: string; name_ar: string }[] };
export async function loadMeta(db: any): Promise<Meta> {
  const [skills, sectors] = await Promise.all([
    safe<any[]>(db.from('portal_skills').select('id,code,name_ar,domain').order('domain', { ascending: true }).limit(500), []),
    safe<any[]>(db.from('portal_sectors').select('code,name_ar,sort').eq('active', true).order('sort', { ascending: true }).limit(100), []),
  ]);
  return { skills: rows(skills).map(s => ({ id: String(s.id), code: String(s.code || ''), name_ar: String(s.name_ar || ''), domain: String(s.domain || ''), domain_ar: domainLabel(String(s.domain || ''), 'ar') })), sectors: rows(sectors).map(s => ({ code: String(s.code), name_ar: String(s.name_ar || '') })) };
}
/** أسماء المهارات والقطاعات المختارة — تُخزَّن للبحث */
export async function resolveNames(db: any, skillIds: string[], sectorCodes: string[]): Promise<{ skill_names: string[]; sector_names: string[]; valid_skill_ids: string[]; valid_sectors: string[] }> {
  const m = await loadMeta(db); const sk = m.skills.filter(s => skillIds.includes(s.id)); const sc = m.sectors.filter(s => sectorCodes.includes(s.code));
  return { skill_names: sk.map(s => s.name_ar), sector_names: sc.map(s => s.name_ar), valid_skill_ids: sk.map(s => s.id), valid_sectors: sc.map(s => s.code) };
}

export type LegacyTrainer = { id: string; name: string | null; email: string | null };
/** مدرب منصة التقييم القائمة بالبريد نفسه */
export async function legacyTrainer(db: any, email: string): Promise<LegacyTrainer | null> {
  const t = rows<any>(await safe(db.from('trainers').select('id,name,email').ilike('email', lower(email)).limit(1), []))[0]; return t ? { id: String(t.id), name: t.name ?? null, email: t.email ?? null } : null;
}

/** «ما شهده أَثَر» — من الجداول القائمة فقط: شُعب المدرب وبرامجه · رئاسة المجالس · شهادات الأقران والمستويات التي اعتمدها · مهام أكّدها مشرفًا · عقود منجَزة · ميثاق جهته */
export async function witnessFacts(db: any, me: { id?: string | null; email: string }, legacy: LegacyTrainer | null, engagements?: Engagement[]): Promise<WitnessFacts> {
  const email = lower(me.email); const f: WitnessFacts = { ...EMPTY_WITNESS };
  const [classrooms, chairs, atts, levels, missions, memberships] = await Promise.all([
    legacy ? safe<any[]>(db.from('classrooms').select('id,program_id').eq('trainer_id', legacy.id).limit(2000), []) : Promise.resolve([] as any[]),
    safe<any[]>(db.from('portal_council_members').select('council_id,role,status').ilike('email', email).eq('role', 'chair').limit(500), []),
    me.id ? safe<any[]>(db.from('portal_council_attestations').select('id,status,approved_by').eq('approved_by', me.id).eq('status', 'approved').limit(2000), []) : Promise.resolve([] as any[]),
    me.id ? safe<any[]>(db.from('portal_skill_levels').select('user_id,approved_by,approved_at').eq('approved_by', me.id).not('approved_at', 'is', null).limit(5000), []) : Promise.resolve([] as any[]),
    safe<any[]>(db.from('portal_missions').select('id,status,confirmed_by').ilike('confirmed_by', email).eq('status', 'confirmed').limit(5000), []),
    me.id ? safe<any[]>(db.from('portal_org_members').select('organization_id,role,status').eq('role', 'org_admin').eq('status', 'confirmed').or(`user_id.eq.${me.id},email.ilike.${email}`).limit(10), []) : safe<any[]>(db.from('portal_org_members').select('organization_id,role,status').eq('role', 'org_admin').eq('status', 'confirmed').ilike('email', email).limit(10), []),
  ]);
  const cls = rows(classrooms); f.classrooms = cls.length; const pids = Array.from(new Set(cls.map(c => c.program_id).filter(Boolean)));
  if (pids.length) { const progs = rows<any>(await safe(db.from('programs').select('id,start_date,end_date').in('id', pids).limit(2000), [])); f.programs = pids.length; const ys = progs.map(p => String(p.start_date || p.end_date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)).sort(); if (ys.length) f.program_years = [ys[0], ys[ys.length - 1]]; }
  f.councils_chaired = new Set(rows(chairs).filter(c => c.status === 'active' || c.status === 'left').map(c => c.council_id)).size;
  f.attestations_approved = rows(atts).length; f.levels_approved = rows(levels).length; f.missions_confirmed = rows(missions).length;
  const orgId = rows(memberships)[0]?.organization_id;
  if (orgId) { const ch = rows<any>(await safe(db.from('portal_org_charters').select('status,organization_id').eq('organization_id', orgId).eq('status', 'active').limit(1), []))[0]; if (ch) { const org = await safe<any>(db.from('portal_organizations').select('name_ar').eq('id', orgId).maybeSingle(), null); f.org_charter = String(org?.name_ar || 'جهته'); } }
  Object.assign(f, engagementFacts(engagements || []));
  try { const { onAirFacts } = await import('../onair/load'); const oa = await onAirFacts(db, me.id); f.on_air_hours = oa.hours; f.on_air_meetings = oa.meetings; } catch { /* قبل تنفيذ SQL */ }
  return f;
}

export const loadEngagements = (db: any, profileId: string) => safe<Engagement[]>(db.from('portal_directory_engagements').select(ENGAGEMENT_COLS).eq('profile_id', profileId).order('created_at', { ascending: false }).limit(200), []).then(rows);
export const loadEngagement = (db: any, id: string) => safe<Engagement | null>(db.from('portal_directory_engagements').select(ENGAGEMENT_COLS).eq('id', id).maybeSingle(), null);
export const loadAllEngagements = (db: any) => safe<Engagement[]>(db.from('portal_directory_engagements').select(ENGAGEMENT_COLS).order('created_at', { ascending: false }).limit(1000), []).then(rows);
