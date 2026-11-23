// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «بَيْتُ بَيان» (هـ-6-و) — ما يجري في الكرون اليومي القائم (followups) بلا كرون جديد:
 *  1) محو «قالَ لِلُؤلُؤ» الذي بلغ purge_after (90 يومًا) — محوٌ فعليّ لا أرشفة.
 *  2) إطفاء الأمانات المنتهية: صفّ إلحاقيّ granted=false باسم وليّ الأمر نفسه، فيبقى السجلّ صادقًا لا ضمنيًّا.
 *  3) رسالة لؤلؤ الأسبوعية: أوّل تشغيل بعد بداية الأسبوع (السبت) يكتب رسالة الأسبوع الماضي لكلّ طفل غير مؤرشَف
 *     (قالبيّة من البيانات — لا نموذج لغويّ؛ النصّ المسموع يدخلها بإذن save_text فقط). مرّة لكلّ (طفل، أسبوع).
 */
import { effectiveConsents, luluLetter, weekStart, type ConsentRow } from './parent';
import { getSession } from './sessions';

export type KidsCronResult = { ok: true; dry: boolean; purged: number; expired: number; letters: number; week: string } | { ok: false; error: string };

export async function runKids(db: any, opts: { dry?: boolean; now?: Date } = {}): Promise<KidsCronResult> {
  const dry = !!opts.dry; const now = opts.now || new Date(); const nowIso = now.toISOString();
  let purged = 0, expired = 0, letters = 0;
  const week = weekStart(now);                                  // أسبوع الرسالة = الأسبوع المنقضي
  const lastWeek = new Date(Date.parse(week + 'T00:00:00Z') - 7 * 86400000).toISOString().slice(0, 10);
  try {
    // (1) المحو بعد المهلة
    const { data: old } = await db.from('kids_talks').select('id').lt('purge_after', nowIso).limit(2000);
    purged = (old || []).length;
    if (purged && !dry) { const { error } = await db.from('kids_talks').delete().lt('purge_after', nowIso); if (error) throw new Error(error.message); }

    // (2) الأمانات المنتهية
    const { data: kids } = await db.from('kids_children').select('id,parent_id,nick,gender').is('archived_at', null).limit(5000);
    const ids = ((kids || []) as any[]).map(k => k.id);
    if (!ids.length) return { ok: true, dry, purged, expired, letters, week: lastWeek };
    const { data: crows } = await db.from('kids_consents').select('child_id,kind,granted,granted_at,expires_at,text_version').in('child_id', ids).order('granted_at').limit(20000);
    const byChild = new Map<string, any[]>(); for (const r of (crows || []) as any[]) { const a = byChild.get(r.child_id) || []; a.push(r); byChild.set(r.child_id, a); }
    const expiryRows: any[] = [];
    for (const k of (kids || []) as any[]) {
      const rows = byChild.get(k.id) || []; const latest = new Map<string, any>(); for (const r of rows) latest.set(r.kind, r);
      for (const r of latest.values()) if (r.granted && r.expires_at && Date.parse(r.expires_at) <= now.getTime()) expiryRows.push({ child_id: k.id, kind: r.kind, granted: false, granted_by: k.parent_id, granted_at: nowIso, expires_at: null, text_version: r.text_version });
    }
    expired = expiryRows.length;
    if (expired && !dry) { const { error } = await db.from('kids_consents').insert(expiryRows); if (error) throw new Error(error.message); }

    // (3) رسالة الأسبوع الماضي — مرّة لكلّ طفل
    const { data: have } = await db.from('kids_letters').select('child_id').eq('week_start', lastWeek).in('child_id', ids).limit(5000);
    const done = new Set(((have || []) as any[]).map(h => h.child_id));
    const from = lastWeek + 'T00:00:00Z', to = week + 'T00:00:00Z';
    const [{ data: prog }, { data: talks }] = await Promise.all([
      db.from('kids_progress').select('child_id,session_slug,started_at,badge,self_check,home_task_done_at').in('child_id', ids).gte('started_at', from).lt('started_at', to).order('started_at').limit(10000),
      db.from('kids_talks').select('child_id,results,at').in('child_id', ids).gte('at', from).lt('at', to).limit(10000),
    ]);
    const letterRows: any[] = [];
    for (const k of (kids || []) as any[]) {
      if (done.has(k.id)) continue;
      const eff = effectiveConsents(((byChild.get(k.id) || []) as ConsentRow[]), now);
      const mine = ((prog || []) as any[]).filter(p => p.child_id === k.id);
      const myTalks = ((talks || []) as any[]).filter(t => t.child_id === k.id);
      const sessions = mine.map(p => { const S = getSession(p.session_slug); const t1 = S?.talk?.turns[0]; return { world: S?.meta.world || p.session_slug, badge: p.badge, self: p.self_check, homeTaskDone: !!p.home_task_done_at, homeTask: S?.athari.homeTask, supportQ: S?.athari.parentCard.support[0], weekSentence: t1?.model.text }; });
      const said = eff.save_text ? myTalks.flatMap(t => ((t.results || []) as any[]).map(r => r.heard).filter(Boolean)) : [];
      const L = luluLetter({ nick: k.nick, gender: k.gender, sessions, said, talkCount: myTalks.length });
      letterRows.push({ child_id: k.id, week_start: lastWeek, body_ar: L.body, sentence_ar: L.sentence });
    }
    letters = letterRows.length;
    if (letters && !dry) { const { error } = await db.from('kids_letters').upsert(letterRows, { onConflict: 'child_id,week_start', ignoreDuplicates: true }); if (error) throw new Error(error.message); }
    return { ok: true, dry, purged, expired, letters, week: lastWeek };
  } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
}
