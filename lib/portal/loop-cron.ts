// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — الحلقة المغلقة (P15): طبقة قاعدة البيانات — دورة يومية تُولّد الاقتراحات والتوقّعات من الذاكرة (تُستدعى من الكرون الحالي وزر «شغّل الحلقة الآن»)
import { loadGraph, loadSources } from './evidence-cron';
import { programGaps, channelGaps, forecastSkills, orgSteps, monthlyLearning, learnedScore, slug } from './loop';
import type { Suggestion, Forecast } from './loop';
import type { LearningEventRow } from './profile';

const safe = async <T,>(q: PromiseLike<{ data: T | null; error: any }>, fb: T): Promise<T> => { try { const { data, error } = await q; return error || data == null ? fb : data; } catch { return fb; } };
export type SkillMeta = Map<string, { level: number; code: string; name_ar: string }>;
export async function skillMetaOf(db: any): Promise<SkillMeta> { const rows = await safe<any[]>(db.from('portal_skills').select('id,code,name_ar,level').limit(2000), []); return new Map(rows.map(s => [s.id, { level: Number(s.level) || 3, code: String(s.code || ''), name_ar: String(s.name_ar || '') }])); }

/** أحداث التعلّم لأعضاء جهة (مؤكَّدون) — بالمعرّف أو البريد */
export async function orgEvents(db: any, orgId: string, limit = 4000): Promise<{ events: LearningEventRow[]; members: number }> {
  const members = await safe<any[]>(db.from('portal_org_members').select('user_id,email').eq('organization_id', orgId).eq('status', 'confirmed').limit(2000), []);
  const ids = members.map(m => m.user_id).filter(Boolean); const emails = members.map(m => String(m.email || '').toLowerCase()).filter(Boolean);
  if (!ids.length && !emails.length) return { events: [], members: 0 };
  const [a, b] = await Promise.all([
    ids.length ? safe<any[]>(db.from('portal_learning_events').select('id,at,user_id,email,verb,object_type,object_id,skills,context').in('user_id', ids).order('at', { ascending: false }).limit(limit), []) : Promise.resolve([] as any[]),
    emails.length ? safe<any[]>(db.from('portal_learning_events').select('id,at,user_id,email,verb,object_type,object_id,skills,context').in('email', emails).order('at', { ascending: false }).limit(limit), []) : Promise.resolve([] as any[]),
  ]);
  const seen = new Set<string>(); const events: LearningEventRow[] = []; for (const e of [...a, ...b]) { const k = String(e.id); if (seen.has(k)) continue; seen.add(k); events.push(e); }
  return { events, members: members.length };
}

export async function forecastForOrg(db: any, orgId: string, today: string, meta?: SkillMeta): Promise<{ forecasts: Forecast[]; members: number; events: number }> {
  const m = meta || await skillMetaOf(db); const { events, members } = await orgEvents(db, orgId); return { forecasts: forecastSkills(events, m, today), members, events: events.length };
}

/** الدورة اليومية: اقتراحات جديدة (بلا تكرار) + انتهاء القديم + توقّعات الجهات + خطوات الجهات */
export async function runLoop(db: any, today: string, opts: { dry?: boolean } = {}): Promise<{ ok: boolean; proposed: number; expired: number; forecasts: number; orgs: number; error?: string; dry: boolean }> {
  const dry = !!opts.dry;
  try {
    const g = await loadGraph(db); if (!g.nodes.length) return { ok: true, proposed: 0, expired: 0, forecasts: 0, orgs: 0, dry, error: 'الذاكرة فارغة — ابنِ قاعدة الأدلة أولًا' };
    const monthStart = today.slice(0, 7) + '-01'; const decisions = await safe<any[]>(db.from('portal_loop_decisions').select('at,kind,action').gte('at', new Date(Date.parse(monthStart + 'T00:00:00Z') - 60 * 86400000).toISOString()).limit(2000), []);
    const learned = monthlyLearning(decisions, '1970-01-01').kinds;
    const cands: Suggestion[] = [...programGaps(g), ...channelGaps(g)];
    // توقّعات الجهات النشطة
    const orgs = await safe<any[]>(db.from('portal_organizations').select('id,name_ar').eq('active', true).limit(300), []); const meta = await skillMetaOf(db); let fcount = 0;
    for (const o of orgs) {
      const { forecasts, members } = await forecastForOrg(db, o.id, today, meta); if (!members || !forecasts.length) continue;
      if (!dry) { for (const f of forecasts) await db.from('portal_capability_forecasts').upsert({ organization_id: o.id, skill_id: f.skill_id, computed_at: new Date().toISOString(), horizon_days: 90, trend: f.trend, slope: f.slope, recent_weight: f.recent_weight, prior_weight: f.prior_weight, evidence: f.evidence, people: f.people, steps: f.steps }, { onConflict: 'organization_id,skill_id' }); }
      fcount += forecasts.length; cands.push(...orgSteps(o.id, o.name_ar, forecasts));
    }
    // إدراج ما ليس له بصمة سابقة (بأي حالة) — مع أولوية متعلَّمة
    const fps = cands.map(c => c.fingerprint); const existing = fps.length ? await safe<any[]>(db.from('portal_loop_suggestions').select('fingerprint').in('fingerprint', fps), []) : [];
    const have = new Set(existing.map(x => x.fingerprint)); let proposed = 0;
    for (const c of cands) {
      if (have.has(c.fingerprint)) continue; proposed++; if (dry) continue;
      const { data: ins } = await db.from('portal_loop_suggestions').insert({ kind: c.kind, fingerprint: c.fingerprint, title_ar: c.title_ar, why_ar: c.why_ar, evidence: c.evidence, target: c.target, score: learnedScore(c.score, c.kind, learned), status: 'draft' }).select('id').maybeSingle();
      await db.from('portal_loop_decisions').insert({ suggestion_id: (ins as any)?.id || null, kind: c.kind, action: 'proposed', meta: { title: c.title_ar, score: c.score } });
    }
    // انتهاء المسودات القديمة
    const old = await safe<any[]>(db.from('portal_loop_suggestions').select('id,kind').eq('status', 'draft').lt('expires_at', new Date().toISOString()).limit(200), []);
    if (!dry) for (const s of old) { await db.from('portal_loop_suggestions').update({ status: 'expired' }).eq('id', s.id); await db.from('portal_loop_decisions').insert({ suggestion_id: s.id, kind: s.kind, action: 'expired', meta: {} }); }
    return { ok: true, proposed, expired: old.length, forecasts: fcount, orgs: orgs.length, dry };
  } catch (e: any) { return { ok: false, proposed: 0, expired: 0, forecasts: 0, orgs: 0, dry, error: String(e?.message || e) }; }
}

/** بصمة مستقرة لاقتراح يدوي (اختبارات/أدوات) */
export const manualFingerprint = (kind: string, title: string) => `${kind}|manual|${slug(title)}`;
export { loadSources };
