// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/catalog — الكتالوج المفتوح لبوابة أَثَر (P8-ج) — عام، للقراءة فقط، بمفتاح anon (يخضع لسياسات RLS العامة)
 *  GET /api/catalog                      → JSON: البرامج العامة + الجلسات العامة القادمة + الحقائب العامة + القطاعات + المهارات
 *  GET /api/catalog?format=jsonld        → schema.org ItemList (Course + Event)
 *  GET /api/catalog?type=programs|sessions|resources|skills|sectors → قسم واحد
 *  GET /api/catalog?sector=education&skill=ATH-PD-001&lang=ar      → ترشيح
 * يُخزَّن مؤقتًا 5 دقائق على حافة Vercel (s-maxage) ويدعم CORS للوكلاء ومحركات البحث.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite, catalogEnvelope, catalogProgram, catalogSession, catalogResource, courseJsonLd, eventJsonLd, catalogItemList } from '../../../lib/portal/open';
import type { ProgramWithSector, SessionLite, ResourceLite, SkillLite, SectorLite } from '../../../lib/portal/open';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const PROGRAM_SELECT = 'id,name_ar,name_en,status,delivery_mode,start_date,end_date,archived_at,cefr_level,intro_ar,intro_en,objectives_ar,objectives_en,outcomes_ar,outcomes_en,audience_ar,audience_en,fee,currency,seats,program_type,is_public,registration_open,registration_deadline,location_ar,location_en,hours,sector';
const PROGRAM_SELECT_NOSECTOR = PROGRAM_SELECT.replace(',sector', '');

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: HEADERS }); }

export async function GET(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL_ || !ANON) return NextResponse.json({ error: 'catalog unavailable' }, { status: 503, headers: HEADERS });
  const u = new URL(req.url); const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || u.origin);
  const format = (u.searchParams.get('format') || 'json').toLowerCase(); const type = (u.searchParams.get('type') || '').toLowerCase();
  const fSector = (u.searchParams.get('sector') || '').trim().toLowerCase(); const fSkill = (u.searchParams.get('skill') || '').trim().toUpperCase();
  const today = new Date().toISOString().slice(0, 10); const nowIso = new Date().toISOString();
  let db: ReturnType<typeof createClient>; try { db = createClient(URL_, ANON, { auth: { persistSession: false } }); } catch { return NextResponse.json({ error: 'catalog unavailable' }, { status: 503, headers: HEADERS }); }

  try {
    // البرامج (مع احتياط إن لم يُطبَّق عمود sector بعد)
    let progRes = await db.from('programs').select(PROGRAM_SELECT).eq('is_public', true).is('archived_at', null).order('start_date', { ascending: false }).limit(300);
    if (progRes.error && /sector/i.test(progRes.error.message || '')) progRes = await db.from('programs').select(PROGRAM_SELECT_NOSECTOR).eq('is_public', true).is('archived_at', null).order('start_date', { ascending: false }).limit(300);
    if (progRes.error) throw new Error(progRes.error.message);
    const programs = (progRes.data || []) as unknown as ProgramWithSector[];
    const [{ data: sk }, { data: sec }, { data: ps }, { data: ss }, { data: rs }, { data: cnt }] = await Promise.all([
      db.from('portal_skills').select('id,code,name_ar,name_en,domain,saqf_level,cefr_level,sdaia_code').eq('active', true).order('code'),
      db.from('portal_sectors').select('code,name_ar,name_en').eq('active', true).order('sort'),
      db.from('portal_program_skills').select('program_id,skill_id'),
      db.from('portal_sessions').select('id,kind,title_ar,title_en,description_ar,description_en,speaker_name,starts_at,duration_min,provider,access,status,skills,sector,program_id,capacity,lang,recording_url').eq('access', 'public').neq('status', 'cancelled').gte('starts_at', new Date(Date.now() - 86400000).toISOString()).order('starts_at').limit(100),
      db.from('portal_resources').select('id,slug,title_ar,title_en,summary_ar,summary_en,type,level,lang,sector,skills,ai_ready,published_at,downloads,views').eq('status', 'published').eq('access', 'public').order('published_at', { ascending: false }).limit(200),
      db.rpc('portal_enrollment_counts'),
    ]);
    const skills = (sk || []) as unknown as SkillLite[]; const sectors = (sec || []) as unknown as SectorLite[]; const skillById = new Map(skills.map(s => [s.id, s])); const skillByCode = new Map(skills.map(s => [s.code.toUpperCase(), s]));
    const progSkills = new Map<string, SkillLite[]>(); for (const r of (ps || []) as { program_id: string; skill_id: string }[]) { const s = skillById.get(r.skill_id); if (!s) continue; if (!progSkills.has(r.program_id)) progSkills.set(r.program_id, []); progSkills.get(r.program_id)!.push(s); }
    const counts = new Map(((cnt || []) as { program_id: string; approved: number }[]).map(c => [c.program_id, { approved: Number(c.approved) || 0 }]));
    const wantSkill = fSkill ? skillByCode.get(fSkill) : null;
    const keepP = (p: ProgramWithSector) => (!fSector || (p.sector || '').toLowerCase() === fSector) && (!wantSkill || (progSkills.get(p.id) || []).some(s => s.id === wantSkill.id));
    const sessions = ((ss || []) as unknown as SessionLite[]).filter(s => (!fSector || (s.sector || '').toLowerCase() === fSector) && (!wantSkill || (s.skills || []).includes(wantSkill.id)) && new Date(s.starts_at).getTime() + (s.duration_min || 0) * 60000 >= Date.parse(nowIso) - 86400000);
    const resources = ((rs || []) as unknown as ResourceLite[]).filter(r => (!fSector || (r.sector || '').toLowerCase() === fSector) && (!wantSkill || (r.skills || []).includes(wantSkill.id)));
    const progs = programs.filter(keepP); const skillsOf = (ids?: string[]) => (ids || []).map(id => skillById.get(id)).filter(Boolean) as SkillLite[];

    if (format === 'jsonld') {
      const items = [...progs.map(p => courseJsonLd(p, site, today, progSkills.get(p.id) || [], counts.get(p.id))), ...sessions.map(s => eventJsonLd(s, site, progs.find(p => p.id === s.program_id) || null, skillsOf(s.skills)))];
      return NextResponse.json(catalogItemList(site, items as Record<string, unknown>[]), { headers: { ...HEADERS, 'Content-Type': 'application/ld+json; charset=utf-8' } });
    }
    const data = { programs: progs.map(p => catalogProgram(p, site, today, progSkills.get(p.id) || [], sectors, counts.get(p.id))), sessions: sessions.map(s => catalogSession(s, site, skillsOf(s.skills))), resources: resources.map(r => catalogResource(r, site, skillsOf(r.skills))), sectors, skills };
    if (type === 'programs' || type === 'sessions' || type === 'resources') return NextResponse.json({ site, generated_at: nowIso, count: (data as any)[type].length, [type]: (data as any)[type] }, { headers: HEADERS });
    if (type === 'skills') return NextResponse.json({ site, generated_at: nowIso, count: skills.length, skills: skills.map(s => ({ code: s.code, name: { ar: s.name_ar, en: s.name_en }, domain: s.domain, saqf_level: s.saqf_level, cefr_level: s.cefr_level, sdaia_code: s.sdaia_code })) }, { headers: HEADERS });
    if (type === 'sectors') return NextResponse.json({ site, generated_at: nowIso, count: sectors.length, sectors: sectors.map(s => ({ code: s.code, name: { ar: s.name_ar, en: s.name_en } })) }, { headers: HEADERS });
    return NextResponse.json(catalogEnvelope(site, data, nowIso), { headers: HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500, headers: { ...HEADERS, 'Cache-Control': 'no-store' } });
  }
}
