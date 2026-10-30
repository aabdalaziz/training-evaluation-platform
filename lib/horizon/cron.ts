// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أفق الممارس — الحارس الزمني (ضمن الكرون اليومي الحالي، لا كرون جديد):
 *  1) فتح المراجعة السنوية حين يحين اليوم 365 (active → review) + رسالة «ما وعدتُ / ما وقع» بالقنوات القائمة
 *  2) تذكير لطيف واحد في منتصف السنة (اليوم 182) — مرة واحدة
 *  3) طيّ المراجعة التي لم تُغلق خلال 30 يومًا (review → archived) — «ما لم يُراجَع ليس فشلًا»
 */
import { notify } from '../portal/notify';
import { loadJourneyInput } from '../journey/load';
import { buildChapters } from '../journey/registry';
import { HORIZON_COLS, PLEDGE_COLS, MIDYEAR_DAY, REVIEW_WINDOW_DAYS, addDays, buildPath, reviewText } from './registry';
import type { Horizon, Pledge } from './registry';

export async function runHorizon(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<{ ok: boolean; opened: number; nudged: number; archived: number; errors: string[] }> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const errors: string[] = []; let opened = 0, nudged = 0, archived = 0;
  const pledgeOf = async (h: Horizon): Promise<Pledge | null> => { const { data } = await db.from('portal_horizon_pledges').select(PLEDGE_COLS).eq('horizon_id', h.id).eq('status', 'active').limit(1); return ((data || []) as Pledge[])[0] || null; };
  // 1) فتح المراجعة
  try {
    const { data } = await db.from('portal_horizons').select(HORIZON_COLS).eq('status', 'active').lte('review_at', now.toISOString()).limit(50);
    for (const h of ((data || []) as Horizon[])) {
      try {
        const p = await pledgeOf(h); if (!p) { if (!dry) await db.from('portal_horizons').update({ status: 'draft', review_at: null, updated_at: now.toISOString() }).eq('id', h.id); continue; }
        const inp = await loadJourneyInput(db, { id: h.user_id, email: h.email }); const path = buildPath(p, inp, now.getTime()); const chNow = buildChapters(inp).length;
        const text = reviewText(h.full_name || '', p, path, Number(h.meta?.chapters_then ?? 0), chNow); const url = `${site}/me/horizon`;
        if (dry) { opened++; continue; }
        const d = await notify(db, { kind: 'horizon_review', to: { email: h.email, name: h.full_name }, subject: 'سنة على عهدك — ما وعدتَ / ما وقع', text: `${text}\n\n${url}`, url, ref: `horizon:${h.id}` }, { now });
        await db.from('portal_horizons').update({ status: 'review', updated_at: now.toISOString(), meta: { ...(h.meta || {}), review_text: text, review_opened_at: now.toISOString(), path_at_review: path, chapters_now: chNow, message_log_id: (d as any)?.id ?? null } }).eq('id', h.id);
        await db.from('portal_learning_events').insert({ user_id: h.user_id, email: h.email, verb: 'review_opened', object_type: 'horizon', object_id: h.id, skills: [], context: { complete: path.complete, steps: path.steps.filter(s => s.done).length } }).then(() => null, () => null);
        opened++;
      } catch (e: any) { errors.push(`review ${h.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`reviews: ${e?.message || e}`); }
  // 2) تذكير منتصف السنة
  try {
    const { data } = await db.from('portal_horizons').select(HORIZON_COLS).eq('status', 'active').lte('activated_at', addDays(now, -MIDYEAR_DAY)).gt('review_at', now.toISOString()).limit(100);
    for (const h of ((data || []) as Horizon[])) {
      if (h.meta?.nudged_at) continue;
      try {
        const p = await pledgeOf(h); if (!p) continue;
        if (dry) { nudged++; continue; }
        const inp = await loadJourneyInput(db, { id: h.user_id, email: h.email }); const path = buildPath(p, inp, now.getTime());
        await notify(db, { kind: 'horizon_midyear', to: { email: h.email, name: h.full_name }, subject: 'نصف سنة على عهدك', text: `${h.full_name ? `${h.full_name}، ` : ''}مرّ نصف السنة على عهدك: «${p.title_ar}». ${path.read_ar} لا حكم هنا — فقط تذكير بأن النصف الثاني مفتوح.\n\n${site}/me/horizon`, url: `${site}/me/horizon`, ref: `horizon_mid:${h.id}` }, { now });
        await db.from('portal_horizons').update({ meta: { ...(h.meta || {}), nudged_at: now.toISOString() }, updated_at: now.toISOString() }).eq('id', h.id);
        nudged++;
      } catch (e: any) { errors.push(`nudge ${h.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`nudges: ${e?.message || e}`); }
  // 3) طيّ المراجعات المفتوحة بلا قرار
  try {
    const { data } = await db.from('portal_horizons').select(HORIZON_COLS).eq('status', 'review').lte('review_at', addDays(now, -REVIEW_WINDOW_DAYS)).limit(100);
    for (const h of ((data || []) as Horizon[])) {
      if (dry) { archived++; continue; }
      await db.from('portal_horizons').update({ status: 'archived', decision: 'archive', updated_at: now.toISOString(), meta: { ...(h.meta || {}), auto_archived_at: now.toISOString() } }).eq('id', h.id);
      await db.from('portal_horizon_pledges').update({ status: 'expired' }).eq('horizon_id', h.id).eq('status', 'active').then(() => null, () => null);
      archived++;
    }
  } catch (e: any) { errors.push(`archive: ${e?.message || e}`); }
  return { ok: errors.length === 0, opened, nudged, archived, errors };
}
