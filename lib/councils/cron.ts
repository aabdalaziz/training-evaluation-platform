// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مجالس أَثَر — يعمل ضمن الكرون اليومي الحالي (لا كرون جديد):
 *  1) تذكير صاحب القضية قبل موعد العودة بـ 3 أيام (مرة) وبعد فواته (مرة)
 *  2) إغلاق الدورة حين ينتهي أجلها: احتساب الدورة لمن شارك · دوران الكرسي · دورة جديدة · إشعار «مرآتك جاهزة»
 *  3) تذكير المعتمدين بشهادات أقران معلّقة > 5 أيام (مدير الجهة أولًا ثم الطاقم)
 *  4) إصدار «شهادة عضو مجلس» لمن استحقها (إن كان مفتاح التوقيع مضبوطًا)
 */
import { notify } from '../portal/notify';
import { signerFromEnv } from '../portal/vc-server';
import { didWeb } from '../portal/vc';
import { randomCode } from '../portal/profile';
import { COUNCIL_COLS, MEMBER_COLS, CASE_COLS, ATTEST_COLS, activeMembers, nextChair, cycleEnd, lower, daysLeft } from './registry';
import type { Council, Member, Case, Attestation } from './registry';
import { approversFor } from './attest';
import { badgeStats, badgeEligibility, issueBadge } from './badge';

const staffEmails = (env: Record<string, string | undefined>) => String(env.NOTIFY_EMAILS || env.ADMIN_EMAILS || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** إغلاق دورة مجلس: يُحتسب العضو إن وقّع الميثاق وشارك بمداخلة أو قضية خلال الدورة */
export async function closeCycle(db: any, c: Council, now = new Date(), site = ''): Promise<{ counted: string[]; chair: string | null; next_cycle: number }> {
  const { data: ms } = await db.from('portal_council_members').select(MEMBER_COLS).eq('council_id', c.id); const members = (ms || []) as Member[];
  const { data: cs } = await db.from('portal_council_cases').select('id,author_email,cycle_no').eq('council_id', c.id).eq('cycle_no', c.cycle_no);
  const { data: ps } = await db.from('portal_council_posts').select('email,case_id').eq('council_id', c.id).in('case_id', ((cs || []) as any[]).map(x => x.id).concat(['00000000-0000-4000-8000-000000000000']));
  const active = new Set<string>([...((cs || []) as any[]).map(x => lower(x.author_email)), ...((ps || []) as any[]).map(x => lower(x.email))]);
  const counted: string[] = [];
  for (const m of activeMembers(members)) { if (!m.charter_signed_at || !active.has(lower(m.email))) continue; counted.push(lower(m.email)); const chaired = m.role === 'chair' ? [...(m.meta?.chaired_cycles || []), c.cycle_no] : (m.meta?.chaired_cycles || []); await db.from('portal_council_members').update({ cycles_completed: (m.cycles_completed || 0) + 1, meta: { ...(m.meta || {}), chaired_cycles: chaired } }).eq('id', m.id); }
  const nc = nextChair(members.map(m => counted.includes(lower(m.email)) && m.role === 'chair' ? { ...m, meta: { ...(m.meta || {}), chaired_cycles: [...(m.meta?.chaired_cycles || []), c.cycle_no] } } : m), c.chair_email);
  await db.from('portal_council_members').update({ role: 'member' }).eq('council_id', c.id).eq('role', 'chair');
  if (nc) await db.from('portal_council_members').update({ role: 'chair' }).eq('id', nc.id);
  const next = c.cycle_no + 1;
  await db.from('portal_councils').update({ cycle_no: next, cycle_started_at: now.toISOString(), cycle_ends_at: cycleEnd(now, c.cycle_weeks), chair_email: nc ? lower(nc.email) : null, meta: { ...(c.meta || {}), last_cycle_closed_at: now.toISOString(), last_cycle_counted: counted.length } }).eq('id', c.id);
  // المرآة جاهزة — لكل عضو نشط
  for (const m of activeMembers(members)) { try { await notify(db, { kind: 'council_mirror_ready', to: { email: m.email, name: m.full_name }, subject: `مرآتك من مجلس «${c.title_ar}» — الدورة ${c.cycle_no}`, text: `انتهت الدورة ${c.cycle_no}. مرآتك (كم سألت مقابل كم نصحت، كم عدت بالتزامك) جاهزة: ${site}/me/council${nc && lower(nc.email) === lower(m.email) ? '\n\nوالكرسي في الدورة الجديدة لك: افتح القضية الأولى وأغلقها.' : ''}`, url: `${site}/me/council`, ref: `council_mirror:${c.id}:${c.cycle_no}` }); } catch { /* */ } }
  return { counted, chair: nc ? lower(nc.email) : null, next_cycle: next };
}

export async function runCouncils(db: any, opts: { dry?: boolean; site: string; env?: Record<string, string | undefined>; now?: Date }) {
  const env = opts.env || process.env; const dry = !!opts.dry; const now = opts.now || new Date(); const site = opts.site.replace(/\/+$/, '');
  const out: any = { dry, return_reminders: 0, cycles_closed: 0, attestation_reminders: 0, badges_issued: 0, errors: [] as string[] };
  // 1) مواعيد العودة
  try {
    const { data: cs } = await db.from('portal_council_cases').select(CASE_COLS).eq('status', 'committed').lte('return_due_at', new Date(now.getTime() + 3 * 864e5).toISOString()).limit(200);
    for (const c of (cs || []) as Case[]) {
      const left = daysLeft(c.return_due_at, now.getTime()) ?? 0; const stage = left >= 0 ? 'soon' : 'late'; const last = c.meta?.reminded_stage;
      if (last === stage) continue; if (dry) { out.return_reminders++; continue; }
      const { data: cc } = await db.from('portal_councils').select('title_ar').eq('id', c.council_id).maybeSingle();
      try { await notify(db, { kind: 'council_return_due', to: { email: c.author_email }, subject: stage === 'soon' ? `موعد عودتك إلى المجلس بعد ${Math.max(0, left)} ${left === 1 ? 'يوم' : 'أيام'}` : `مجلسك ينتظر عودتك — فات الموعد بـ ${-left} ${-left === 1 ? 'يوم' : 'أيام'}`, text: `قضيتك «${c.title_ar}» في مجلس «${(cc as any)?.title_ar || ''}»: التزمتَ بـ «${c.commitment_ar || ''}». عُد بما حدث فعلًا (نجح/تعثّر/تغيّر الفهم): ${site}/me/council`, url: `${site}/me/council`, ref: `council_return:${c.id}:${stage}` }); } catch { /* */ }
      await db.from('portal_council_cases').update({ reminded_at: now.toISOString(), meta: { ...(c.meta || {}), reminded_stage: stage } }).eq('id', c.id); out.return_reminders++;
    }
  } catch (e: any) { out.errors.push('returns: ' + (e?.message || e)); }
  // 2) نهاية الدورات
  try {
    const { data: cc } = await db.from('portal_councils').select(COUNCIL_COLS).eq('status', 'active').lte('cycle_ends_at', now.toISOString()).limit(50);
    for (const c of (cc || []) as Council[]) { if (dry) { out.cycles_closed++; continue; } await closeCycle(db, c, now, site); out.cycles_closed++; }
  } catch (e: any) { out.errors.push('cycles: ' + (e?.message || e)); }
  // 3) شهادات معلّقة
  try {
    const { data: pend } = await db.from('portal_council_attestations').select(ATTEST_COLS).eq('status', 'pending').lte('created_at', new Date(now.getTime() - 5 * 864e5).toISOString()).limit(200);
    const fresh = ((pend || []) as Attestation[]).filter(a => !a.reminded_at || now.getTime() - new Date(a.reminded_at).getTime() > 5 * 864e5);
    const byApprover = new Map<string, Attestation[]>();
    for (const a of fresh) { const ap = await approversFor(db, a); const emails = ap.role === 'org_admin' ? ap.emails : staffEmails(env); for (const e of emails) byApprover.set(e, [...(byApprover.get(e) || []), a]); }
    if (!dry) {
      for (const [to, list] of byApprover) { try { await notify(db, { kind: 'council_attestation_pending', to: { email: to }, subject: `${list.length} شهادة أقران تنتظر اعتمادك`, text: `شهادات أقران من مجالس أَثَر تنتظر البتّ (اعتماد/رفض) — الاعتماد يرفع وزن الدليل في خيط أثر صاحبها:\n${list.map(a => `• لـ ${a.to_email} — «${a.evidence_ar.slice(0, 80)}»`).join('\n')}\n\n${site}/me/council (مدير الجهة) · ${site}/admin/councils (الطاقم)`, url: `${site}/me/council`, ref: `council_att_pending:${ymd(now)}` }); } catch { /* */ } }
      if (fresh.length) await db.from('portal_council_attestations').update({ reminded_at: now.toISOString() }).in('id', fresh.map(a => a.id));
    }
    out.attestation_reminders = fresh.length;
  } catch (e: any) { out.errors.push('attestations: ' + (e?.message || e)); }
  // 4) شهادات عضو مجلس
  try {
    const signer = signerFromEnv(env as NodeJS.ProcessEnv, site);
    if (signer) {
      const { data: ms } = await db.from('portal_council_members').select(MEMBER_COLS).gte('cycles_completed', 1).limit(1000); const members = (ms || []) as Member[];
      const emails = Array.from(new Set(members.map(m => lower(m.email))));
      if (emails.length) {
        const [{ data: cases }, { data: atts }] = await Promise.all([db.from('portal_council_cases').select('id,author_email,returned_at,cycle_no').limit(5000), db.from('portal_council_attestations').select('from_email,to_email,status,cycle_no').limit(5000)]);
        for (const e of emails) {
          const st = badgeStats(e, members, (cases || []) as Case[], (atts || []) as Attestation[]); if (!badgeEligibility(st).ok) continue;
          const m = members.find(x => lower(x.email) === e)!; if (!m.user_id) continue; if (dry) { out.badges_issued++; continue; }
          const r = await issueBadge(db, { id: m.user_id, email: e, name: m.full_name || e }, st, signer, site, didWeb(site), () => randomCode(4));
          if (r.ok && !r.existing) { out.badges_issued++; try { await notify(db, { kind: 'council_badge_issued', to: { email: e, name: m.full_name }, subject: 'صدرت شهادتك: عضو مجلس أَثَر', text: `أكملت ${st.cycles} دورات وشهد لك أقرانك ${st.attestations_received} شهادات معتمدة. شهادتك الموقَّعة قابلة للتحقق: ${site}/verify/vc?code=${encodeURIComponent(r.code)}`, url: `${site}/verify/vc?code=${encodeURIComponent(r.code)}`, ref: `council_badge:${r.code}` }); } catch { /* */ } }
        }
      }
    }
  } catch (e: any) { out.errors.push('badges: ' + (e?.message || e)); }
  return out;
}
