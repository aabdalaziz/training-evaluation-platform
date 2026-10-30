// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** العهد المتقابل — المهام اليومية داخل followups/send (لا cron جديد): انقضاء الدعوات والمهل · «خطوة صاحبك وقعت» · منتصف السنة · فتح المراجعة المشتركة · طيّ ما لم يُراجَع */
import { notify } from '../portal/notify';
import { PAIR_COLS, PAIR_INVITE_DAYS, PAIR_PROPOSE_DAYS, PAIR_MIDYEAR_DAY, PAIR_REVIEW_WINDOW_DAYS, addDays, nameFor, stepFor, jointDecision } from './registry';
import { partnerState } from './load';
import type { Pair, Side } from './registry';

export type PairCronResult = { ok: boolean; expired: number; step_notices: number; nudged: number; opened: number; closed: number; renewed: number; errors: string[] };
const who = (p: Pair, s: Side) => (s === 'a' ? { email: p.a_email, name: p.a_name } : { email: p.b_email, name: p.b_name });

export async function runPair(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<PairCronResult> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const url = `${site}/me/pair`; const errors: string[] = [];
  let expired = 0, step_notices = 0, nudged = 0, opened = 0, closed = 0, renewed = 0;
  // 1) انقضاء بصمت: دعوة بلا ردّ 14 يومًا · قبول بلا توقيعين 14 يومًا
  try {
    const [{ data: inv }, { data: prop }] = await Promise.all([
      db.from('portal_pair_pledges').select(PAIR_COLS).eq('status', 'invited').lte('invited_at', addDays(now, -PAIR_INVITE_DAYS)).limit(200),
      db.from('portal_pair_pledges').select(PAIR_COLS).eq('status', 'proposing').lte('accepted_at', addDays(now, -PAIR_PROPOSE_DAYS)).limit(200),
    ]);
    for (const p of ([...(inv || []), ...(prop || [])] as Pair[])) {
      if (dry) { expired++; continue; }
      await db.from('portal_pair_pledges').update({ status: 'expired', updated_at: now.toISOString(), meta: { ...(p.meta || {}), expired_at: now.toISOString() } }).eq('id', p.id);
      if (p.status === 'proposing') for (const s of ['a', 'b'] as Side[]) { const w = who(p, s); await notify(db, { kind: 'pair_expired', to: w, subject: 'انقضت مهلة العهد المتقابل', text: `انقضت أربعة عشر يومًا دون أن يكتمل التوقيعان — طُوي بصمت، ويمكنكما البدء من جديد متى شئتما.\n\n${url}`, url, ref: `pair:${p.id}:expired:${s}` }, { now }).then(() => null, () => null); }
      expired++;
    }
  } catch (e: any) { errors.push(`expire: ${e?.message || e}`); }
  // 2) العهود النشطة: «خطوة صاحبك وقعت» · منتصف السنة · فتح المراجعة
  try {
    const { data } = await db.from('portal_pair_pledges').select(PAIR_COLS).eq('status', 'active').not('signed_at', 'is', null).limit(150);
    for (const p of ((data || []) as Pair[])) {
      try {
        const meta = { ...(p.meta || {}) }; let dirty = false;
        for (const s of ['a', 'b'] as Side[]) {
          if (meta[`${s}_done_notified`] || !stepFor(p, s)) continue;
          const st = await partnerState(db, p, s, now.getTime()); if (!st.complete) continue;
          const o: Side = s === 'a' ? 'b' : 'a'; const w = who(p, o);
          if (!dry) { await notify(db, { kind: 'pair_step_done', to: w, subject: `خطوة ${nameFor(p, s)} وقعت`, text: `${w.name ? `${w.name}، ` : ''}الخطوة التي طلبتَها من ${nameFor(p, s)} — «${stepFor(p, s)!.title_ar}» — وقعت. لا تُطلب منك إلا أن تعرف.\n\n${url}`, url, ref: `pair:${p.id}:done:${s}` }, { now }); meta[`${s}_done_notified`] = now.toISOString(); dirty = true; }
          step_notices++;
        }
        if (p.review_at && new Date(p.review_at).getTime() <= now.getTime()) {
          if (!dry) {
            for (const s of ['a', 'b'] as Side[]) { const w = who(p, s); await notify(db, { kind: 'pair_review', to: w, subject: 'سنة على عهدكما — ما وعدنا بعضَنا / ما وقع', text: `${w.name ? `${w.name}، ` : ''}مرّت سنة على عهدك مع ${nameFor(p, s === 'a' ? 'b' : 'a')}. اكتب ما تغيّر فيك بسبب صاحبك — ولن يقرأه حتى يكتب ما تغيّر فيه بسببك. ثلاثون يومًا للمراجعة.\n\n${url}`, url, ref: `pair:${p.id}:review:${s}` }, { now }).then(() => null, () => null); }
            await db.from('portal_pair_pledges').update({ status: 'review', updated_at: now.toISOString(), meta: { ...meta, review_opened_at: now.toISOString() } }).eq('id', p.id); dirty = false;
          }
          opened++;
        } else if (p.signed_at && !meta.nudged_at && new Date(p.signed_at).getTime() + PAIR_MIDYEAR_DAY * 864e5 <= now.getTime()) {
          if (!dry) { for (const s of ['a', 'b'] as Side[]) { const w = who(p, s); await notify(db, { kind: 'pair_midyear', to: w, subject: 'نصف سنة على عهدكما', text: `${w.name ? `${w.name}، ` : ''}مرّ نصف السنة على عهدك مع ${nameFor(p, s === 'a' ? 'b' : 'a')}: «${stepFor(p, s)?.title_ar || ''}». لا حكم هنا — فقط تذكير بأن النصف الثاني مفتوح لكما.\n\n${url}`, url, ref: `pair:${p.id}:midyear:${s}` }, { now }).then(() => null, () => null); } meta.nudged_at = now.toISOString(); dirty = true; }
          nudged++;
        }
        if (dirty && !dry) await db.from('portal_pair_pledges').update({ meta, updated_at: now.toISOString() }).eq('id', p.id);
      } catch (e: any) { errors.push(`active ${p.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`actives: ${e?.message || e}`); }
  // 3) طيّ المراجعات بعد 30 يومًا: من لم يكتب عُدّ قراره «نطوي»
  try {
    const { data } = await db.from('portal_pair_pledges').select(PAIR_COLS).eq('status', 'review').lte('review_at', addDays(now, -PAIR_REVIEW_WINDOW_DAYS)).limit(100);
    for (const p of ((data || []) as Pair[])) {
      if (dry) { closed++; continue; }
      const d = jointDecision(p.a_decision || 'close', p.b_decision || 'close');
      await db.from('portal_pair_pledges').update({ status: d === 'renew' ? 'renewed' : 'closed', reviewed_at: now.toISOString(), updated_at: now.toISOString(), meta: { ...(p.meta || {}), auto_closed_at: now.toISOString() } }).eq('id', p.id);
      if (d === 'renew') renewed++; else closed++;
    }
  } catch (e: any) { errors.push(`close: ${e?.message || e}`); }
  return { ok: errors.length === 0, expired, step_notices, nudged, opened, closed, renewed, errors };
}
