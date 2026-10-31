// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** عهد الممارس وجهته — المهام اليومية داخل followups/send (لا cron جديد): انقضاء الطلبات والمهل · «خطوة جهتك/منسوبكم وقعت» · منتصف السنة · فتح المراجعة · طيّ ما لم يُراجَع */
import { notify } from '../portal/notify';
import { ORG_PAIR_COLS, ORG_PAIR_INVITE_DAYS, ORG_PAIR_PROPOSE_DAYS, ORG_PAIR_MIDYEAR_DAY, ORG_PAIR_REVIEW_WINDOW_DAYS, addDays, memberName, orgName, jointDecision } from './registry';
import { orgPairPaths, orgAdmins } from './load';
import { moreTimeEmails, rowFactor } from '../inclusion/load';
import { orgInviteExpired } from './registry';
import type { OrgPair } from './registry';

export type OrgPairCronResult = { ok: boolean; expired: number; step_notices: number; nudged: number; opened: number; closed: number; renewed: number; errors: string[] };

export async function runOrgPair(db: any, opts: { dry?: boolean; site: string; now?: Date }): Promise<OrgPairCronResult> {
  const now = opts.now || new Date(); const dry = !!opts.dry; const site = opts.site.replace(/\/+$/, ''); const mUrl = `${site}/me/pair`; const errors: string[] = [];
  let expired = 0, step_notices = 0, nudged = 0, opened = 0, closed = 0, renewed = 0;
  const oUrl = (p: OrgPair) => `${site}/org?tab=horizon&org=${p.organization_id}`;
  const tellMember = (p: OrgPair, kind: string, subject: string, text: string, ref: string) => notify(db, { kind, to: { email: p.member_email, name: p.member_name }, subject, text: `${text}\n\n${mUrl}`, url: mUrl, ref }, { now }).then(() => null, () => null);
  const tellOrg = async (p: OrgPair, kind: string, subject: string, text: string, ref: string) => { for (const a of await orgAdmins(db, p.organization_id)) await notify(db, { kind, to: { email: a.email, name: a.name }, subject, text: `${text}\n\n${oUrl(p)}`, url: oUrl(p), ref: `${ref}:${a.email}` }, { now }).then(() => null, () => null); };
  // 1) انقضاء بصمت: طلب بلا ردّ 14 يومًا · قبول بلا توقيعين 14 يومًا
  try {
    const [{ data: inv }, { data: prop }] = await Promise.all([
      db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).eq('status', 'invited').lte('invited_at', addDays(now, -ORG_PAIR_INVITE_DAYS)).limit(200),
      db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).eq('status', 'proposing').lte('accepted_at', addDays(now, -ORG_PAIR_PROPOSE_DAYS)).limit(200),
    ]);
    const cands = [...(inv || []), ...(prop || [])] as OrgPair[]; const moreTime = await moreTimeEmails(db, cands.map(p => p.member_email));
    for (const p of cands) {
      if (!orgInviteExpired(p, now.getTime(), rowFactor(moreTime, [p.member_email]))) continue; // P32: «وقتًا أطول» → المهلة × 1.5
      if (dry) { expired++; continue; }
      await db.from('portal_org_pair_pledges').update({ status: 'expired', updated_at: now.toISOString(), meta: { ...(p.meta || {}), expired_at: now.toISOString() } }).eq('id', p.id);
      if (p.status === 'proposing') { await tellMember(p, 'org_pair_expired', 'انقضت مهلة العهد مع جهتك', 'انقضت أربعة عشر يومًا دون أن يكتمل التوقيعان — طُوي بصمت، ويمكن البدء من جديد متى شئتما.', `org_pair:${p.id}:expired:m`); await tellOrg(p, 'org_pair_expired', `انقضت مهلة العهد مع ${memberName(p)}`, 'انقضت أربعة عشر يومًا دون أن يكتمل التوقيعان — طُوي بصمت.', `org_pair:${p.id}:expired:o`); }
      expired++;
    }
  } catch (e: any) { errors.push(`expire: ${e?.message || e}`); }
  // 2) العهود النشطة: «خطوة … وقعت» · منتصف السنة · فتح المراجعة
  try {
    const { data } = await db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).eq('status', 'active').not('signed_at', 'is', null).limit(150);
    for (const p of ((data || []) as OrgPair[])) {
      try {
        const meta = { ...(p.meta || {}) }; let dirty = false;
        if (!meta.member_done_notified || !meta.org_done_notified) {
          const paths = await orgPairPaths(db, p, now.getTime());
          if (!meta.member_done_notified && paths.member_state?.complete) { if (!dry) { await tellOrg(p, 'org_pair_step_done', `خطوة ${memberName(p)} وقعت`, `الخطوة التي طلبتموها من ${memberName(p)} — «${p.member_step!.title_ar}» — وقعت. لا يُطلب منكم إلا أن تعرفوا.`, `org_pair:${p.id}:done:m`); meta.member_done_notified = now.toISOString(); dirty = true; } step_notices++; }
          if (!meta.org_done_notified && paths.org_state?.complete) { if (!dry) { await tellMember(p, 'org_pair_step_done', `خطوة ${orgName(p)} لك وقعت`, `${p.member_name ? `${p.member_name}، ` : ''}ما طلبتَه من جهتك — «${p.org_step!.title_ar}» — وقع.`, `org_pair:${p.id}:done:o`); meta.org_done_notified = now.toISOString(); dirty = true; } step_notices++; }
        }
        if (p.review_at && new Date(p.review_at).getTime() <= now.getTime()) {
          if (!dry) {
            await tellMember(p, 'org_pair_review', 'سنة على عهدك مع جهتك — ما وعدنا بعضَنا / ما وقع', `${p.member_name ? `${p.member_name}، ` : ''}مرّت سنة على عهدك مع ${orgName(p)}. اكتب ما تغيّر فيك — ولن تقرأه الجهة حتى تكتب ما تغيّر فيها. ثلاثون يومًا للمراجعة.`, `org_pair:${p.id}:review:m`);
            await tellOrg(p, 'org_pair_review', `سنة على عهدكم مع ${memberName(p)}`, `مرّت سنة على عهد الجهة مع ${memberName(p)}. اكتبوا باسم الجهة ما تغيّر فيكم — ثلاثون يومًا للمراجعة.`, `org_pair:${p.id}:review:o`);
            await db.from('portal_org_pair_pledges').update({ status: 'review', updated_at: now.toISOString(), meta: { ...meta, review_opened_at: now.toISOString() } }).eq('id', p.id); dirty = false;
          }
          opened++;
        } else if (p.signed_at && !meta.nudged_at && new Date(p.signed_at).getTime() + ORG_PAIR_MIDYEAR_DAY * 864e5 <= now.getTime()) {
          if (!dry) { await tellMember(p, 'org_pair_midyear', 'نصف سنة على عهدك مع جهتك', `${p.member_name ? `${p.member_name}، ` : ''}مرّ نصف السنة على عهدك مع ${orgName(p)}: «${p.member_step?.title_ar || ''}». لا حكم هنا — النصف الثاني مفتوح.`, `org_pair:${p.id}:midyear:m`); await tellOrg(p, 'org_pair_midyear', `نصف سنة على عهدكم مع ${memberName(p)}`, `مرّ نصف السنة على عهد الجهة مع ${memberName(p)}: «${p.org_step?.title_ar || ''}». تذكير واحد لا غير.`, `org_pair:${p.id}:midyear:o`); meta.nudged_at = now.toISOString(); dirty = true; }
          nudged++;
        }
        if (dirty && !dry) await db.from('portal_org_pair_pledges').update({ meta, updated_at: now.toISOString() }).eq('id', p.id);
      } catch (e: any) { errors.push(`active ${p.id}: ${e?.message || e}`); }
    }
  } catch (e: any) { errors.push(`actives: ${e?.message || e}`); }
  // 3) طيّ المراجعات بعد 30 يومًا: من لم يكتب عُدّ قراره «نطوي»
  try {
    const { data } = await db.from('portal_org_pair_pledges').select(ORG_PAIR_COLS).eq('status', 'review').lte('review_at', addDays(now, -ORG_PAIR_REVIEW_WINDOW_DAYS)).limit(100);
    for (const p of ((data || []) as OrgPair[])) {
      if (dry) { closed++; continue; }
      const d = jointDecision(p.member_decision || 'close', p.org_decision || 'close');
      await db.from('portal_org_pair_pledges').update({ status: d === 'renew' ? 'renewed' : 'closed', reviewed_at: now.toISOString(), updated_at: now.toISOString(), meta: { ...(p.meta || {}), auto_closed_at: now.toISOString() } }).eq('id', p.id);
      if (d === 'renew') renewed++; else closed++;
    }
  } catch (e: any) { errors.push(`close: ${e?.message || e}`); }
  return { ok: errors.length === 0, expired, step_notices, nudged, opened, closed, renewed, errors };
}
