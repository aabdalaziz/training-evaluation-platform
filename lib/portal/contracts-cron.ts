// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — عقود الأثر (P12-ب) — خادم فقط: جمع حقائق الأثر، الحالة الحية، الإفراج عن الدفعات، ونبض العقود في الكرون اليومي
 *  الحقائق تُقرأ من بيانات موجودة أصلًا: شهادات الإتمام (التسليم)، مهمات P12-أ المؤكَّدة (أدلة الأثر)، أدلة الملف المهاري المؤرَّخة (الأثر المستدام).
 *  لا دفعة تُفرَج دون إنسان: الكرون يُشعر فقط («أصبحت مستحقة»)، والطاقم يعتمد بمذكرة إفراج مرقّمة مع لقطة من المؤشرات.
 */
import { sendViaResend } from '../email/resend';
import { computeState, pulseEvents, memoNo, releaseSnapshot, contractUrl, releaseMailHtml, pulseMailHtml, activationMailHtml, normalizeSplit, normalizeTargets, milestoneAmounts } from './contracts';
import type { Contract, Facts, PersonFacts, Release, ContractState, MilestoneKey } from './contracts';

export const CONTRACT_COLS = 'id,created_at,created_by,organization_id,program_id,title_ar,contact_email,contact_name,cohort,total_amount,currency,split,targets,status,token,start_at,delivered_at,flags,notes,updated_at';
export const RELEASE_COLS = 'id,contract_id,milestone,pct,amount,memo_no,released_at,released_by,released_by_name,note,snapshot';

export async function mail(to: string[], m: { subject: string; html: string }): Promise<boolean> {
  const rcpt = Array.from(new Set(to.map(x => String(x || '').trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x)))); if (!rcpt.length) return false;
  try { await sendViaResend({ to: rcpt, subject: m.subject, html: m.html, tags: [{ name: 'kind', value: 'contract' }] }); return true; } catch { return false; }
}
export const adminEmails = () => String(process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).filter(Boolean);

export function rowToContract(r: any): Contract {
  return { ...r, cohort: Array.isArray(r.cohort) ? r.cohort : [], total_amount: Number(r.total_amount) || 0, split: normalizeSplit(r.split), targets: normalizeTargets(r.targets), flags: r.flags && typeof r.flags === 'object' ? r.flags : {} };
}
const chunk = <T,>(a: T[], n = 200) => { const out: T[][] = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

/** حقائق الأثر لشريحة العقد */
export async function loadFacts(db: any, c: Contract): Promise<Facts> {
  const emails = Array.from(new Set(c.cohort.map(p => p.email.toLowerCase()))); const by = new Map<string, PersonFacts>(emails.map(e => [e, { email: e, completed: false, confirmed_missions: 0, submitted_missions: 0, evidence_at: [] }]));
  const userIds = new Map<string, string>();
  for (const part of chunk(emails)) {
    let q = db.from('portal_credentials').select('email,user_id,program_id,revoked_at').eq('kind', 'program_completion').is('revoked_at', null).in('email', part); if (c.program_id) q = q.eq('program_id', c.program_id);
    const { data: creds } = await q; for (const r of (creds || []) as any[]) { const p = by.get(String(r.email).toLowerCase()); if (p) p.completed = true; if (r.user_id) userIds.set(String(r.email).toLowerCase(), r.user_id); }
    let mq = db.from('portal_missions').select('email,user_id,status,program_id').in('email', part); if (c.program_id) mq = mq.eq('program_id', c.program_id);
    const { data: ms } = await mq; for (const r of (ms || []) as any[]) { const p = by.get(String(r.email).toLowerCase()); if (!p) continue; if (r.status === 'confirmed') p.confirmed_missions++; else if (r.status === 'submitted') p.submitted_missions++; if (r.user_id) userIds.set(String(r.email).toLowerCase(), r.user_id); }
    const { data: ens } = await db.from('portal_enrollments').select('email,user_id').in('email', part).not('user_id', 'is', null); for (const r of (ens || []) as any[]) userIds.set(String(r.email).toLowerCase(), r.user_id);
  }
  const ids = Array.from(new Set(userIds.values())); const emailOf = new Map<string, string[]>(); userIds.forEach((uid, em) => emailOf.set(uid, [...(emailOf.get(uid) || []), em]));
  for (const part of chunk(ids)) {
    const { data: lv } = await db.from('portal_skill_levels').select('user_id,evidence').in('user_id', part);
    for (const r of (lv || []) as any[]) { const ats = ((Array.isArray(r.evidence) ? r.evidence : []) as any[]).map(e => String(e.at || '')).filter(Boolean); for (const em of emailOf.get(r.user_id) || []) { const p = by.get(em); if (p) p.evidence_at.push(...ats); } }
  }
  const { data: rel } = await db.from('portal_contract_releases').select(RELEASE_COLS).eq('contract_id', c.id).order('released_at', { ascending: true });
  return { people: Array.from(by.values()), releases: ((rel || []) as Release[]).map(r => ({ ...r, amount: Number(r.amount), pct: Number(r.pct) })) };
}

export async function stateFor(db: any, c: Contract, now = new Date()): Promise<{ state: ContractState; facts: Facts }> { const facts = await loadFacts(db, c); return { state: computeState(c, facts, now), facts }; }

export async function nextMemoNo(db: any, year = new Date().getFullYear()): Promise<string> {
  const { count } = await db.from('portal_contract_releases').select('id', { count: 'exact', head: true }); let seq = (Number(count) || 0) + 1;
  for (let i = 0; i < 20; i++) { const no = memoNo(seq, year); const { data } = await db.from('portal_contract_releases').select('id').eq('memo_no', no).limit(1); if (!data || !data.length) return no; seq++; }
  return memoNo(seq + Math.floor(Math.random() * 1000), year);
}

/** الإفراج عن دفعة — قرار بشري. يُسمح فقط عندما تكون الدفعة «مستحقة» (أو «التسليم» بعد إثباته). */
export async function releaseMilestone(db: any, c: Contract, key: MilestoneKey, by: { id: string; name: string }, note: string | null, site: string, now = new Date()): Promise<{ release?: Release; state?: ContractState; error?: string; mailed?: boolean }> {
  if (c.status !== 'active') return { error: 'العقد ليس نشطًا' };
  const { state } = await stateFor(db, c, now); const m = state.milestones.find(x => x.key === key)!;
  if (m.status === 'released') return { error: 'سبق الإفراج عن هذه الدفعة' }; if (m.status !== 'due') return { error: key === 'delivery' ? 'أثبت التسليم أولًا' : key === 'evidence' ? `لم تبلغ أدلة الأثر الهدف بعد (${m.metric.ar})` : 'نافذة الأثر لم تُغلق بعد' };
  const memo = await nextMemoNo(db, now.getFullYear());
  const row = { contract_id: c.id, milestone: key, pct: m.pct, amount: m.payable, memo_no: memo, released_at: now.toISOString(), released_by: by.id, released_by_name: by.name || null, note: note || null, snapshot: releaseSnapshot(state) };
  const { data, error } = await db.from('portal_contract_releases').insert(row).select(RELEASE_COLS).single(); if (error) return { error: error.message };
  const release = { ...(data as Release), amount: Number((data as any).amount), pct: Number((data as any).pct) };
  const after = await stateFor(db, c, now); const settled = after.state.milestones.every(x => x.status === 'released');
  await db.from('portal_impact_contracts').update({ status: settled ? 'settled' : 'active', updated_at: now.toISOString() }).eq('id', c.id);
  const url = `${site}${contractUrl(c.token)}`; const mailed = await mail([c.contact_email || '', ...adminEmails()], releaseMailHtml(c, release, after.state, url));
  return { release, state: after.state, mailed };
}

export async function activateContract(db: any, c: Contract, site: string, now = new Date()): Promise<{ ok: boolean; mailed: boolean; error?: string }> {
  if (c.status !== 'draft') return { ok: false, mailed: false, error: 'العقد ليس مسودة' }; if (!c.cohort.length) return { ok: false, mailed: false, error: 'الشريحة فارغة' };
  const { error } = await db.from('portal_impact_contracts').update({ status: 'active', start_at: c.start_at || now.toISOString().slice(0, 10), updated_at: now.toISOString() }).eq('id', c.id); if (error) return { ok: false, mailed: false, error: error.message };
  const mailed = c.contact_email ? await mail([c.contact_email], activationMailHtml(c, `${site}${contractUrl(c.token)}`)) : false; return { ok: true, mailed };
}

/** نبض العقود — داخل الكرون اليومي: يُشعر عند استحقاق دفعة أو اقتراب إغلاق النافذة (مرة واحدة لكل حدث) ولا يُفرج عن شيء */
export async function runContractPulse(db: any, site: string, opts: { dry?: boolean; now?: Date } = {}): Promise<{ ok: boolean; checked: number; notified: number; previews: { contract: string; key: string; subject: string }[]; errors: string[] }> {
  const now = opts.now || new Date(); const out = { ok: true, checked: 0, notified: 0, previews: [] as { contract: string; key: string; subject: string }[], errors: [] as string[] };
  try {
    const { data: rows } = await db.from('portal_impact_contracts').select(CONTRACT_COLS).eq('status', 'active');
    for (const r of (rows || []) as any[]) {
      const c = rowToContract(r); out.checked++;
      try {
        const { state } = await stateFor(db, c, now); const events = pulseEvents(c, state, now); if (!events.length) continue;
        const flags = { ...c.flags }; const url = `${site}${contractUrl(c.token)}`;
        for (const ev of events) { out.previews.push({ contract: c.title_ar, key: ev.key, subject: ev.subject.ar }); if (opts.dry) continue; const ok = await mail([c.contact_email || '', ...adminEmails()], pulseMailHtml(c, ev, url)); flags[ev.key] = now.toISOString(); if (ok) out.notified++; }
        if (!opts.dry) await db.from('portal_impact_contracts').update({ flags, updated_at: now.toISOString() }).eq('id', c.id);
      } catch (e: any) { out.errors.push(`${c.title_ar}: ${String(e?.message || e).slice(0, 120)}`); }
    }
  } catch (e: any) { out.ok = false; out.errors.push(String(e?.message || e).slice(0, 160)); }
  return out;
}

/** للمحاسبة: جدول الدفعات المتوقعة */
export function schedule(c: Contract) { const a = milestoneAmounts(c.total_amount, c.split); return (['delivery', 'evidence', 'impact'] as MilestoneKey[]).map(k => ({ key: k, pct: c.split[k], amount: a[k] })); }
