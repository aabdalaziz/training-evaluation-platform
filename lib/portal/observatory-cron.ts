// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — مرصد القدرة البشرية (P18): طبقة قاعدة البيانات — تحميل مجهول الهوية → حساب اللقطة → تخزينها → إبلاغ الجهات المشتركة حين يتغيّر طقس قطاعها
// تُستدعى من السلسلة اليومية الحالية (/api/followups/send) — لا كرون جديد — ومن غرفة التحرير («حدّث الآن»)
import { computeSnapshot, weatherChanges, WEATHER_LABEL } from './observatory';
import type { ObsInput, Snapshot, Person, PersonLevel, Claim, SkillLite, SectorLite } from './observatory';
import { SECTORS_FALLBACK } from './skills';
import { notify } from './notify';

const safe = async <T,>(q: PromiseLike<{ data: T | null; error: any }>, fb: T): Promise<T> => { try { const { data, error } = await q; return error || data == null ? fb : data; } catch { return fb; } };

/** يحمّل المدخلات مجهولة الهوية: لا أسماء ولا بريد يغادر هذه الدالة — user_id يُستخدم للعدّ ثم يُهمل */
export async function loadObsInput(db: any): Promise<ObsInput> {
  const [orgs, members, levels, skills, sectorsDb, events] = await Promise.all([
    safe<any[]>(db.from('portal_organizations').select('id,sector').limit(2000), []),
    safe<any[]>(db.from('portal_org_members').select('organization_id,user_id,email').eq('status', 'confirmed').limit(20000), []),
    safe<any[]>(db.from('portal_skill_levels').select('user_id,skill_id,computed_level,approved_level,confidence,evidence').limit(50000), []),
    safe<any[]>(db.from('portal_skills').select('id,code,name_ar,name_en,domain').limit(3000), []),
    safe<any[]>(db.from('portal_sectors').select('code,name_ar,name_en').eq('active', true).limit(200), []),
    safe<any[]>(db.from('portal_learning_events').select('user_id,email,at,skills,context').eq('verb', 'assessed').eq('object_type', 'activity').order('at', { ascending: false }).limit(20000), []),
  ]);
  const orgSector = new Map<string, string | null>(orgs.map(o => [o.id, o.sector || null]));
  // الشخص → جهته الأولى المؤكَّدة (بالمعرّف أو البريد)
  const byUser = new Map<string, Person>(); const byEmail = new Map<string, string>();
  for (const m of members) { const org = m.organization_id; const sec = orgSector.get(org) ?? null; if (m.user_id && !byUser.has(m.user_id)) byUser.set(m.user_id, { user_id: m.user_id, org_id: org, sector: sec }); if (m.email) byEmail.set(String(m.email).toLowerCase(), m.user_id || `e:${String(m.email).toLowerCase()}`); }
  for (const m of members) { const k = m.user_id || (m.email ? `e:${String(m.email).toLowerCase()}` : null); if (k && !byUser.has(k)) byUser.set(k, { user_id: k, org_id: m.organization_id, sector: orgSector.get(m.organization_id) ?? null }); }
  const persons: Person[] = []; const seen = new Set<string>();
  for (const l of levels) if (!seen.has(l.user_id)) { seen.add(l.user_id); persons.push(byUser.get(l.user_id) || { user_id: l.user_id, org_id: null, sector: null }); }
  const lv: PersonLevel[] = levels.map(l => ({ user_id: l.user_id, skill_id: l.skill_id, level: Number(l.approved_level ?? l.computed_level) || 0, confidence: Number(l.confidence) || 0, approved: l.approved_level != null, evidence: Array.isArray(l.evidence) ? l.evidence.map((e: any) => ({ kind: String(e.kind || e.verb || 'other'), level: Number(e.level) || 0, at: String(e.at || '') })).filter((e: any) => e.level >= 1 && e.at) : [] }));
  const claims: Claim[] = [];
  for (const e of events) { const c = e.context || {}; if (c.kind !== 'self_rating') continue; const score = Number(c.score); if (!(score >= 20)) continue; const uid = e.user_id || (e.email ? byEmail.get(String(e.email).toLowerCase()) : null); if (!uid) continue; for (const sid of (e.skills || [])) claims.push({ user_id: uid, skill_id: sid, level: Math.max(1, Math.min(5, Math.round(score / 20))), at: String(e.at || '') }); }
  const sk: SkillLite[] = skills.map(s => ({ id: s.id, code: s.code, name_ar: s.name_ar, name_en: s.name_en || null, domain: s.domain || 'other' }));
  const sectors: SectorLite[] = (sectorsDb.length ? sectorsDb : SECTORS_FALLBACK).map((s: any) => ({ code: s.code, name_ar: s.name_ar, name_en: s.name_en }));
  return { persons, levels: lv, skills: sk, claims, sectors };
}

export async function latestSnapshot(db: any): Promise<{ id: string; computed_at: string; data: Snapshot } | null> {
  const rows = await safe<any[]>(db.from('portal_observatory_snapshots').select('id,computed_at,data').order('computed_at', { ascending: false }).limit(1), []); return rows[0] || null;
}

/** الدورة: لقطة جديدة + إبلاغ الجهات المشتركة بتغيّر الطقس (مرة لكل تغيّر، عبر P16 بالقنوات المتاحة) */
export async function runObservatory(db: any, opts: { dry?: boolean; now?: Date; env?: NodeJS.ProcessEnv; site?: string } = {}): Promise<{ ok: boolean; sectors: number; published: number; suppressed: number; changes: number; notified: number; dry: boolean; error?: string }> {
  const dry = !!opts.dry;
  try {
    const inp = await loadObsInput(db); const now = opts.now || new Date(); const snap = computeSnapshot({ ...inp, now });
    const prev = await latestSnapshot(db); const changes = weatherChanges(prev?.data || null, snap);
    const base = { ok: true, sectors: snap.sectors.length, published: snap.totals.sectors_published, suppressed: snap.totals.sectors_suppressed, changes: changes.length, notified: 0, dry };
    if (dry) return base;
    const { error } = await db.from('portal_observatory_snapshots').insert({ computed_at: now.toISOString(), period_end: now.toISOString().slice(0, 10), data: snap, stats: { persons: inp.persons.length, levels: inp.levels.length, claims: inp.claims.length, changes } });
    if (error) return { ...base, ok: false, error: error.message };
    // تنظيف: نُبقي آخر 60 لقطة
    const all = await safe<any[]>(db.from('portal_observatory_snapshots').select('id').order('computed_at', { ascending: false }).limit(500), []); const old = all.slice(60);
    if (old.length) await db.from('portal_observatory_snapshots').delete().in('id', old.map(o => o.id));
    let notified = 0;
    if (changes.length) {
      const site = opts.site || String((opts.env || process.env).NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
      const orgs = await safe<any[]>(db.from('portal_organizations').select('id,name_ar,sector,contact_email,observatory_watch').eq('observatory_watch', true).limit(500), []);
      for (const o of orgs) {
        const ch = changes.find(c => c.code === o.sector); if (!ch || !o.contact_email) continue;
        const ref = `obs:${o.id}:${ch.code}:${now.toISOString().slice(0, 10)}`;
        const subject = `طقس قطاعكم تغيّر: ${ch.name_ar} ${WEATHER_LABEL[ch.from].icon} → ${WEATHER_LABEL[ch.to].icon} ${WEATHER_LABEL[ch.to].ar}`;
        const html = `<div dir="rtl" style="font-family:Tahoma,Arial;line-height:1.9"><p>مرصد أَثَر للقدرة البشرية رصد تغيّرًا في طقس قطاع «${ch.name_ar}»: من <b>${WEATHER_LABEL[ch.from].ar}</b> إلى <b>${WEATHER_LABEL[ch.to].ar}</b>.</p><p>موقع جهتكم مقابل القطاع في بوابة الجهة → تبويب «المرصد».</p><p><a href="${site}/org">${site}/org</a> · <a href="${site}/observatory">المرصد العام</a></p><p style="color:#64748b;font-size:12px">لا أسماء ولا بيانات فردية في المرصد — خلايا مكتومة دون 5 أشخاص أو جهتين. لإيقاف هذه الرسائل: بوابة الجهة → المرصد → «أبلغني».</p></div>`;
        try { const d = await notify(db, { kind: 'observatory_weather', to: { email: o.contact_email, name: o.name_ar }, subject, html, url: `${site}/org`, ref, params: { sector: ch.name_ar, to: WEATHER_LABEL[ch.to].ar } }, { env: opts.env, now }); if (d.ok && !d.duplicate) notified++; } catch { /* قناة غير متاحة — تبقى في قائمة اليد */ }
      }
    }
    return { ...base, notified };
  } catch (e: any) { return { ok: false, sectors: 0, published: 0, suppressed: 0, changes: 0, notified: 0, dry, error: e?.message || String(e) }; }
}
