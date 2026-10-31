// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/seats — «مقاعد الجهة» وتوأمة المجالس + اعتماد شهادات الأقران مركزيًا (P24) — مدير الجهة المؤكَّد أو الطاقم
 *  GET ?org=ID → طلبات المقاعد · أين منسوبوكم في المجالس (توأمة: كم جهة أخرى معهم، بلا أسماء جهات) · شهادات أقران تنتظر اعتمادكم
 *  POST { action:'request', org, topic, people:[{email,full_name?}], note? } → طلب جماعي: كل منسوب يصبح «متقدمًا» لدى المُوفِّق (لا مجلس من جهة واحدة أبدًا)
 *  POST { action:'decide', org, id, approve:boolean, note? }               → اعتماد/رفض شهادة أقران لمنسوب (نفس قاعدة P23: مدير الجهة أولًا) → وزن 0.4 → 0.75
 *  POST { action:'close', org, id }                                        → إغلاق طلب مقاعد
 *  P32: priority_seats? (رقم فقط — مقاعد موجَّهة للفئات الأولى بالرعاية؛ لا أسماء) يُحفظ في meta.priority_seats
 */
import { NextResponse } from 'next/server';
import { orgCtx } from '../../../../lib/org-impact/auth';
import { SEAT_COLS, SEAT_STATUS_AR, validateSeatRequest, twinSummary } from '../../../../lib/org-impact/registry';
import type { SeatRequest } from '../../../../lib/org-impact/registry';
import { MEMBER_COLS, COUNCIL_COLS, ATTEST_COLS, THEMES_AR, lower } from '../../../../lib/councils/registry';
import type { Member, Council, Attestation } from '../../../../lib/councils/registry';
import { canDecide, decideAttestation } from '../../../../lib/councils/attest';
import { limitFor, tooMany, ipOf } from '../../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function orgEmails(db: any, orgId: string): Promise<Map<string, string | null>> {
  const { data } = await db.from('portal_org_members').select('email,full_name').eq('organization_id', orgId).eq('status', 'confirmed').limit(5000);
  return new Map(((data || []) as any[]).map(m => [lower(m.email), m.full_name || null]));
}

export async function GET(req: Request) {
  const u = new URL(req.url); const c = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in c) return c.error; const { db, me, org, site } = c;
  const emails = await orgEmails(db, org.id); const list = Array.from(emails.keys());
  const [{ data: reqs }, { data: mem }, atts] = await Promise.all([
    db.from('portal_org_seat_requests').select(SEAT_COLS).eq('organization_id', org.id).order('created_at', { ascending: false }).limit(50),
    db.from('portal_council_members').select(MEMBER_COLS).eq('organization_id', org.id).limit(2000),
    (async () => { const out: Attestation[] = []; for (let i = 0; i < list.length; i += 200) { const { data } = await db.from('portal_council_attestations').select(ATTEST_COLS).in('to_email', list.slice(i, i + 200)).eq('status', 'pending').order('created_at', { ascending: true }).limit(200); out.push(...((data || []) as Attestation[])); } return out; })(),
  ]);
  const members = (mem || []) as Member[]; const cids = Array.from(new Set(members.map(m => m.council_id).filter(Boolean))) as string[];
  const { data: cc } = cids.length ? await db.from('portal_councils').select(COUNCIL_COLS).in('id', cids) : { data: [] };
  const { data: allMem } = cids.length ? await db.from('portal_council_members').select('council_id,organization_id,status').in('council_id', cids).limit(5000) : { data: [] };
  const twins = twinSummary(org.id, (allMem || []) as any[], (cc || []) as Council[]);
  const applicants = members.filter(m => m.status === 'applied' && !m.council_id).map(m => ({ email: m.email, full_name: m.full_name, since: m.created_at, topic: m.meta?.domain || null }));
  // شهادات تنتظر اعتمادكم — مع اسم المهارة والمجلس؛ لا يعتمد المدير شهادة لنفسه
  const decidable: any[] = []; const skillIds = Array.from(new Set(atts.map(a => a.skill_id)));
  const { data: sk } = skillIds.length ? await db.from('portal_skills').select('id,name_ar').in('id', skillIds) : { data: [] }; const skName = new Map(((sk || []) as any[]).map(s => [s.id, s.name_ar]));
  for (const a of atts) { const role = await canDecide(db, a, me); if (role) decidable.push({ id: a.id, created_at: a.created_at, to_email: a.to_email, to_name: emails.get(lower(a.to_email)) || a.to_email.split('@')[0], from_hint: 'قرين في المجلس', skill_id: a.skill_id, skill_ar: skName.get(a.skill_id) || a.skill_id, evidence_ar: a.evidence_ar, council_id: a.council_id, as: role }); }
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar }, requests: ((reqs || []) as SeatRequest[]).map(r => ({ ...r, status_ar: SEAT_STATUS_AR[r.status] || r.status, seated: members.filter(m => m.council_id && m.status === 'active' && (r.people || []).some(p => lower(p.email) === lower(m.email))).length })), applicants, twins, pending_attestations: decidable, topics: THEMES_AR.map(t => ({ code: t.code, label: t.label })), members_total: emails.size, links: { councils: `${site}/councils`, hall: `${site}/me/council` } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const c = await orgCtx(req, String(body.org || '')); if ('error' in c) return c.error; const { db, me, org } = c;
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  const action = String(body.action || ''); const now = new Date().toISOString();
  if (action === 'request') {
    const emails = await orgEmails(db, org.id);
    const people = ((Array.isArray(body.people) ? body.people : []) as any[]).map(p => ({ email: lower(p?.email), full_name: String(p?.full_name || '').slice(0, 120) || null })).filter(p => EMAIL.test(p.email));
    const uniq = Array.from(new Map(people.map(p => [p.email, p])).values());
    const err = validateSeatRequest({ topic: body.topic, people: uniq, note: body.note }); if (err) return bad(err);
    const outsiders = uniq.filter(p => !emails.has(p.email)); if (outsiders.length) return bad(`${outsiders.length} ${outsiders.length === 1 ? 'بريد ليس' : 'بُرُد ليست'} من منسوبيكم المؤكَّدين (أكّدوا العضوية أولًا من تبويب المنسوبين): ${outsiders.slice(0, 3).map(o => o.email).join('، ')}`);
    const topic = String(body.topic).trim(); const theme = THEMES_AR.find(t => t.code === topic || t.label === topic); const domain = theme ? theme.code : null;
    const { data: row, error } = await db.from('portal_org_seat_requests').insert({ organization_id: org.id, requested_by: me.id, requested_email: me.email, topic: theme ? theme.label : topic.slice(0, 80), domain, seats: uniq.length, people: uniq, note: body.note ? String(body.note).slice(0, 600) : null, status: 'pending', meta: { ...(Number(body.priority_seats) > 0 ? { priority_seats: Math.min(Math.floor(Number(body.priority_seats)), uniq.length) } : {}) } }).select(SEAT_COLS).single();
    if (error || !row) return bad(error?.message || 'تعذّر الحفظ', 500);
    // كل منسوب يصبح متقدمًا لدى المُوفِّق (ما لم يكن متقدمًا أو عضوًا نشطًا الآن)
    const { data: existing } = await db.from('portal_council_members').select('email,status,council_id').in('email', uniq.map(p => p.email)).in('status', ['applied', 'active', 'invited']).limit(500);
    const busy = new Set(((existing || []) as any[]).map(m => lower(m.email)));
    const fresh = uniq.filter(p => !busy.has(p.email)).map(p => ({ council_id: null, user_id: null, email: p.email, full_name: p.full_name || emails.get(p.email) || null, organization_id: org.id, role: 'member', status: 'applied', note: `مقاعد الجهة · ${theme ? theme.label : topic.slice(0, 80)}`, meta: { domain, seat_request_id: (row as any).id, by_org: true } }));
    if (fresh.length) await db.from('portal_council_members').insert(fresh).then(() => null, () => null);
    return NextResponse.json({ success: true, request: row, applicants_added: fresh.length, already: uniq.length - fresh.length, message: `سُجِّل طلب ${uniq.length} مقاعد حول «${theme ? theme.label : topic}». المُوفِّق لا يشكّل مجلسًا من جهة واحدة — سيبحث عن جهة ثانية حول الموضوع نفسه (توأمة)، وتصل منسوبيكم دعوة لتوقيع الميثاق.` });
  }
  if (action === 'decide') {
    const id = Number(body.id || 0); if (!id) return bad('معرّف الشهادة مطلوب');
    const { data: a } = await db.from('portal_council_attestations').select(ATTEST_COLS).eq('id', id).maybeSingle(); if (!a) return bad('الشهادة غير موجودة', 404);
    const emails = await orgEmails(db, org.id); if (!emails.has(lower((a as Attestation).to_email))) return bad('المشهود له ليس من منسوبي هذه الجهة', 403);
    const role = await canDecide(db, a as Attestation, me); if (!role) return bad('لا يحق لك البتّ في هذه الشهادة', 403);
    const [{ data: sk }, { data: cn }] = await Promise.all([db.from('portal_skills').select('name_ar').eq('id', (a as any).skill_id).maybeSingle(), db.from('portal_councils').select('title_ar').eq('id', (a as any).council_id).maybeSingle()]);
    const r = await decideAttestation(db, id, { by: me, role, approve: body.approve === true, note: body.note ? String(body.note) : null }, { skill_name: (sk as any)?.name_ar || null, council_title: (cn as any)?.title_ar || null }); if (!r.ok) return bad(r.error || 'تعذّر', 409);
    return NextResponse.json({ success: true, attestation: r.row, message: body.approve === true ? 'اعتُمدت الشهادة — صار وزنها 0.75 في خيط أثر المنسوب (المستوى المعتمد قرار بشري منفصل).' : 'رُفضت الشهادة — بقيت في السجل بوزنها المنخفض مع ملاحظتكم.' });
  }
  if (action === 'close') {
    const id = Number(body.id || 0); const { error } = await db.from('portal_org_seat_requests').update({ status: 'closed', meta: { closed_at: now, closed_by: me.id } }).eq('id', id).eq('organization_id', org.id); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true });
  }
  return bad('إجراء غير معروف');
}
