// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P58 — 🧭 «خيط جديد ينتظر كلمتك»: إشعار داخل أَثَر من الدورة اليومية الموجودة (لا cron جديد · لا بريد)
 *  • لمن تحرّكت رحلتهم خلال آخر 48 ساعة فقط (حدث تعلّم جديد) — فلا نحمّل الخادم بخرائط الجميع
 *  • إشعار واحد في اليوم للمتعلّم على الأكثر، وخيط واحد لا يُنبَّه عليه مرتين (dedupe على مفتاح الخيط)
 *  • لا يُرسل شيء إن لم يكن هناك خيط مقترَح جديد — الصمت أفضل من إشعار فارغ
 */
import { loadMap } from './store';
import { RULE_AR, threadKey } from './registry';

type Db = any;
export const MAP_NOTICE_KIND = 'map_thread' as const;
export const NUDGE_WINDOW_H = 48;
export const NUDGE_MAX_LEARNERS = 80;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: string) => String(s || '').trim().toLowerCase();
export const dayKey = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** نصّ الإشعار — بلا أسماء، بلا حكم */
export function nudgeText(n: number, ruleTitle: string): { title_ar: string; body_ar: string; url: string } {
  const title_ar = n === 1 ? 'خيط جديد ينتظر كلمتك' : n === 2 ? 'خيطان جديدان ينتظران كلمتك' : `${n} خيوط جديدة تنتظر كلمتك`;
  return { title_ar, body_ar: `${ruleTitle} — هل هذا خيط؟ قل «نعم — لأن…» أو «ليس خيطًا». خريطة أثرك تُرسم بكلماتك أنت.`, url: '/me/athar-map' };
}

export async function runMapNudges(db: Db, opts: { now?: Date; dry?: boolean; emails?: string[] } = {}): Promise<{ scanned: number; sent: number; errors: string[] }> {
  const now = opts.now || new Date(); const s = { scanned: 0, sent: 0, errors: [] as string[] };
  try {
    const since = new Date(now.getTime() - NUDGE_WINDOW_H * 3600000).toISOString();
    const { data } = await db.from('portal_learning_events').select('email,user_id').gte('at', since).order('at', { ascending: false }).limit(1000);
    const idOf = new Map<string, string>(); for (const r of arr<any>(data)) { const e = lower(r.email); if (e && r.user_id && !idOf.has(e)) idOf.set(e, String(r.user_id)); }
    const emails = (opts.emails?.length ? opts.emails.map(lower) : Array.from(idOf.keys())).filter((e) => idOf.has(e)).slice(0, NUDGE_MAX_LEARNERS);
    const { pushNotice } = await import('../portal/notices'); const day = dayKey(now);
    for (const email of emails) {
      s.scanned += 1;
      try {
        const map = await loadMap(db, { id: idOf.get(email)!, email }); const proposed = map.threads.filter((t) => t.status === 'proposed'); if (!proposed.length) continue;
        /* الخيوط التي نُبِّه عليها من قبل لا تُحسب جديدة */
        const keys = proposed.map((t) => `${MAP_NOTICE_KIND}:${email}:${threadKey(t.from, t.to)}`);
        const { data: seen } = await db.from('portal_learner_notices').select('dedupe_key').eq('email', email).eq('kind', MAP_NOTICE_KIND).in('dedupe_key', keys).limit(200);
        const seenSet = new Set(arr<any>(seen).map((r) => String(r.dedupe_key))); const fresh = proposed.filter((t) => !seenSet.has(`${MAP_NOTICE_KIND}:${email}:${threadKey(t.from, t.to)}`)); if (!fresh.length) continue;
        /* ≤ 1 في اليوم: إشعار اليوم يحمل مفتاح الخيط الأحدث؛ باقي الخيوط الجديدة تُسجَّل كمُنبَّه عليها بصمت (بلا دفع) حتى لا تتراكم */
        const { data: today } = await db.from('portal_learner_notices').select('id').eq('email', email).eq('kind', MAP_NOTICE_KIND).gte('created_at', `${day}T00:00:00+03:00`).limit(1);
        if (arr(today).length) continue;
        const atOf = (k: string) => map.stations.find((x) => x.key === k)?.at || ''; const newest = [...fresh].sort((a, b) => atOf(a.to).localeCompare(atOf(b.to)))[fresh.length - 1]; const t = nudgeText(fresh.length, RULE_AR[newest.rule].title);
        const r = await pushNotice(db, { email, user_id: null, report_id: null, kind: MAP_NOTICE_KIND, ...t, ref_id: null, dedupe_key: `${MAP_NOTICE_KIND}:${email}:${threadKey(newest.from, newest.to)}`, push: true }, { dry: !!opts.dry });
        if (r.inserted) s.sent += 1;
      } catch (e: any) { s.errors.push(`${email}: ${e?.message || String(e)}`); }
    }
  } catch (e: any) { s.errors.push(e?.message || String(e)); }
  return s;
}
