// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/councils — قاعة المجلس للعضو (P23 مجالس أَثَر)
 *  GET                      → مجالسي (الأعضاء · القضية الجارية ومداولاتها · كاتب المجلس · مرآتي · شهادات الأقران · الميثاق) + طلبي إن كنت متقدمًا + شهادة عضو مجلس
 *  GET ?view=summary        → موجز للوكلاء (أداة MCP my_council): مجلسي · القضية الجارية · التزاماتي وموعد عودتي
 *  POST { action:'apply', domain?, sector?, note? }                         → طلب مقعد في مجلس (المُوفِّق يراه)
 *  POST { action:'sign_charter', council_id }                               → توقيع ميثاق المجلس (شرط المشاركة)
 *  POST { action:'open_case', council_id, title, body, media_id?, kind? }   → قضية (موقف عمل حقيقي) — قضية واحدة مفتوحة في المجلس في آن
 *  POST { action:'post', case_id, kind:'question'|'advice'|'evidence', body, media_id? } → مداخلة
 *  POST { action:'commit', case_id, commitment }                            → صاحب القضية يلتزم (عودة خلال 14 يومًا) — كاتب المجلس يوثّق
 *  POST { action:'return', case_id, text, outcome }                         → العودة بما حدث فعلًا — كاتب المجلس يوثّق
 *  POST { action:'close_case', case_id }                                    → الكرسي/صاحب القضية يغلق — كاتب المجلس يلخّص المداولة
 *  POST { action:'attest', council_id, case_id?, to_email, skill_id, evidence } → شهادة أقران (pending حتى يعتمدها مدير الجهة/الطاقم)
 *  POST { action:'decide_attestation', id, approve, note? }                 → مدير الجهة يعتمد/يرفض شهادة لعضو جهته (الطاقم من /api/councils/admin)
 *  POST { action:'request_badge' }                                          → شهادة عضو مجلس موقَّعة إن استُحقت
 *  الوكيل المفوَّض (council:write): يقرأ، ويلتزم باسم المستخدم (commit) بعد تأكيد صريح — ولا يفتح قضية ولا يشهد.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { delegateFromHeaders } from '../../../lib/portal/oauth';
import { notify } from '../../../lib/portal/notify';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { charterForPerson } from '../../../lib/org-impact/charter';
import { randomCode } from '../../../lib/portal/profile';
import { limitFor, tooMany } from '../../../lib/shield/ratelimit';
import { COUNCIL_COLS, MEMBER_COLS, CASE_COLS, POST_COLS, ATTEST_COLS, CHARTER_AR, CHARTER_VERSION, CASE_MIN_CHARS, POST_MIN_CHARS, RETURN_DAYS, quorum, activeMembers, returnDue, lower, feedFromPosts, themeLabel, STATUS_AR, CASE_STATUS_AR } from '../../../lib/councils/registry';
import type { Council, Member, Case, Post, Attestation, PostKind, ReturnOutcome } from '../../../lib/councils/registry';
import { runScribe } from '../../../lib/councils/scribe';
import { mirrorFor, mirrorLines } from '../../../lib/councils/mirror';
import { createAttestation, decideAttestation, canDecide, approversFor } from '../../../lib/councils/attest';
import { badgeStats, badgeEligibility, issueBadge } from '../../../lib/councils/badge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const site = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/+$/, '');
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S) : null; };
const ipOf = (req: Request) => (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';

type Who = { id: string; email: string; name: string; staff: boolean; delegate: boolean; client?: string };
async function who(req: Request, db: any): Promise<Who | null> {
  const dg = delegateFromHeaders(req.headers, process.env); if (dg && (dg.scopes as string[]).includes('council:write')) return { id: dg.id, email: lower(dg.email), name: dg.name, staff: false, delegate: true, client: dg.client };
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()), delegate: false };
}

async function myMemberships(db: any, me: Who): Promise<Member[]> {
  const { data } = await db.from('portal_council_members').select(MEMBER_COLS).or(`email.ilike.${me.email},user_id.eq.${me.id}`).order('created_at', { ascending: false }).limit(50); return (data || []) as Member[];
}
async function loadCouncil(db: any, id: string) {
  const [{ data: c }, { data: ms }, { data: cs }] = await Promise.all([db.from('portal_councils').select(COUNCIL_COLS).eq('id', id).maybeSingle(), db.from('portal_council_members').select(MEMBER_COLS).eq('council_id', id).order('created_at', { ascending: true }), db.from('portal_council_cases').select(CASE_COLS).eq('council_id', id).order('created_at', { ascending: false }).limit(100)]);
  return { council: c as Council | null, members: (ms || []) as Member[], cases: (cs || []) as Case[] };
}
const isMember = (ms: Member[], me: Who) => ms.find(m => m.status === 'active' && (lower(m.email) === me.email || (m.user_id && m.user_id === me.id))) || null;
const memberName = (ms: Member[], email: string) => ms.find(m => lower(m.email) === lower(email))?.full_name || null;
async function skillNames(db: any, ids: string[]) { if (!ids.length) return new Map<string, string>(); const { data } = await db.from('portal_skills').select('id,name_ar').in('id', ids); return new Map<string, string>(((data || []) as any[]).map(s => [s.id, s.name_ar])); }
async function orgNames(db: any, ids: (string | null)[]) { const u = Array.from(new Set(ids.filter(Boolean))) as string[]; if (!u.length) return new Map<string, string>(); const { data } = await db.from('portal_organizations').select('id,name_ar').in('id', u); return new Map<string, string>(((data || []) as any[]).map(o => [o.id, o.name_ar])); }

async function hall(db: any, me: Who, m: Member, S: string) {
  const { council, members, cases } = await loadCouncil(db, m.council_id!); if (!council) return null;
  const current = cases.find(c => c.status === 'open' || c.status === 'committed') || cases.find(c => c.status === 'returned') || null;
  const [{ data: posts }, { data: scribe }, { data: atts }, sk, orgs] = await Promise.all([
    current ? db.from('portal_council_posts').select(POST_COLS).eq('case_id', current.id).order('created_at', { ascending: true }).limit(500) : Promise.resolve({ data: [] }),
    db.from('portal_council_scribe').select('case_id,phase,summary_ar,commitments,pivotal_questions,unsaid_ar,patterns,source,created_at').eq('council_id', council.id).order('created_at', { ascending: false }).limit(60),
    db.from('portal_council_attestations').select(ATTEST_COLS).eq('council_id', council.id).order('created_at', { ascending: false }).limit(300),
    skillNames(db, council.skill_ids || []), orgNames(db, members.map(x => x.organization_id)),
  ]);
  const { data: allPosts } = await db.from('portal_council_posts').select('case_id,kind,email,created_at').eq('council_id', council.id).limit(5000);
  const feed = feedFromPosts((allPosts || []) as any[]);
  const [mirror, prev] = await Promise.all([mirrorFor(db, me.email, council.id, council.cycle_no), council.cycle_no > 1 ? mirrorFor(db, me.email, council.id, council.cycle_no - 1) : Promise.resolve(null)]);
  const att = (atts || []) as Attestation[]; const toDecide: Attestation[] = [];
  for (const a of att.filter(x => x.status === 'pending' && lower(x.to_email) !== me.email && lower(x.from_email) !== me.email)) { if (await canDecide(db, a, me)) toDecide.push(a); }
  const name = (e: string) => memberName(members, e) || e.split('@')[0];
  return {
    council: { ...council, status_ar: STATUS_AR[council.status], skills: (council.skill_ids || []).map(id => ({ id, name_ar: sk.get(id) || id })) },
    me: { ...m, is_chair: m.role === 'chair' || lower(council.chair_email) === me.email, signed: !!m.charter_signed_at },
    members: activeMembers(members).map(x => ({ email: x.email, full_name: x.full_name || x.email.split('@')[0], role: x.role, organization_id: x.organization_id, org_name: orgs.get(x.organization_id || '') || null, signed: !!x.charter_signed_at, cycles_completed: x.cycles_completed, is_me: lower(x.email) === me.email })),
    quorum: quorum(members),
    cases: cases.map(c => ({ id: c.id, title_ar: c.title_ar, status: c.status, status_ar: CASE_STATUS_AR[c.status], cycle_no: c.cycle_no, created_at: c.created_at, author: name(c.author_email), mine: lower(c.author_email) === me.email, theme_ar: themeLabel(c.theme), return_due_at: c.return_due_at, returned_at: c.returned_at, pulse: feed[c.id] || null })),
    current: current ? { ...current, author: name(current.author_email), mine: lower(current.author_email) === me.email, status_ar: CASE_STATUS_AR[current.status], theme_ar: themeLabel(current.theme), posts: ((posts || []) as Post[]).map(p => ({ ...p, author: name(p.email), mine: lower(p.email) === me.email })), scribe: ((scribe || []) as any[]).filter(s => s.case_id === current.id), pulse: feed[current.id] || null } : null,
    scribe_history: ((scribe || []) as any[]).filter(s => !current || s.case_id !== current.id).slice(0, 12),
    mirror: { now: mirror, prev, lines: mirrorLines(mirror, prev) },
    attestations: { received: att.filter(a => lower(a.to_email) === me.email).map(a => ({ ...a, from: name(a.from_email), skill_ar: sk.get(a.skill_id) || a.skill_id })), given: att.filter(a => lower(a.from_email) === me.email).map(a => ({ ...a, to: name(a.to_email), skill_ar: sk.get(a.skill_id) || a.skill_id })), to_decide: toDecide.map(a => ({ ...a, from: name(a.from_email), to: name(a.to_email), skill_ar: sk.get(a.skill_id) || a.skill_id })) },
    my_commitments: cases.filter(c => lower(c.author_email) === me.email && c.committed_at).map(c => ({ case_id: c.id, title_ar: c.title_ar, commitment_ar: c.commitment_ar, return_due_at: c.return_due_at, returned_at: c.returned_at, outcome: c.return_outcome })),
    links: { hall: `${S}/me/council`, public: `${S}/councils` },
  };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
  const S = site(req); const u = new URL(req.url); const view = u.searchParams.get('view') || 'full';
  const mem = await myMemberships(db, me); const active = mem.filter(m => m.status === 'active' && m.council_id); const applied = mem.find(m => m.status === 'applied') || null; const invited = mem.filter(m => m.status === 'invited' && m.council_id);
  const halls = (await Promise.all(active.map(m => hall(db, me, m, S)))).filter(Boolean) as any[];
  if (view === 'summary') {
    return NextResponse.json({ success: true, summary: { councils: halls.map(h => ({ title_ar: h.council.title_ar, status: h.council.status_ar, cycle_no: h.council.cycle_no, cycle_ends_at: h.council.cycle_ends_at, chair: h.me.is_chair, members: h.members.length, current_case: h.current ? { title_ar: h.current.title_ar, status: h.current.status_ar, mine: h.current.mine, opened_at: h.current.created_at, questions: h.current.pulse?.questions || 0, advice: h.current.pulse?.advice || 0, commitment: h.current.commitment_ar, return_due_at: h.current.return_due_at, can_commit: h.current.mine && h.current.status === 'open' } : null, my_commitments: h.my_commitments.filter((c: any) => !c.returned_at), mirror_lines: h.mirror.lines.map((l: any) => l.text), pending_attestations_for_me: h.attestations.received.filter((a: any) => a.status === 'pending').length })), applied: applied ? { since: applied.created_at, note: applied.note } : null, invitations: invited.length, page: `${S}/me/council` } });
  }
  // شهادة عضو مجلس
  const [{ data: allCases }, { data: allAtts }, { data: badge }] = await Promise.all([db.from('portal_council_cases').select('id,author_email,returned_at,cycle_no').ilike('author_email', me.email).limit(500), db.from('portal_council_attestations').select('from_email,to_email,status,cycle_no').or(`from_email.ilike.${me.email},to_email.ilike.${me.email}`).limit(1000), db.from('portal_vc_issuances').select('code,issued_at').eq('kind', 'council_badge').ilike('email', me.email).is('revoked_at', null).limit(1)]);
  const stats = badgeStats(me.email, mem, (allCases || []) as Case[], (allAtts || []) as Attestation[]);
  const orgCharter = await charterForPerson(db, me).catch(() => null); // P24 — هل وقّعت جهتي ميثاق الجهة؟
  const invitedView = await Promise.all(invited.map(async m => { const { data: c } = await db.from('portal_councils').select('id,title_ar,domain,cycle_weeks,status').eq('id', m.council_id).maybeSingle(); return c ? { member_id: m.id, council: c } : null; }));
  return NextResponse.json({ success: true, me: { id: me.id, email: me.email, name: me.name, staff: me.staff, delegate: me.delegate }, halls, applied, invitations: invitedView.filter(Boolean), badge: { stats, eligibility: badgeEligibility(stats), issued: (badge || [])[0] ? { code: badge![0].code, issued_at: badge![0].issued_at, verify_url: `${S}/verify/vc?code=${encodeURIComponent(badge![0].code)}` } : null }, charter: { version: CHARTER_VERSION, clauses: CHARTER_AR }, org_charter: orgCharter, constants: { return_days: RETURN_DAYS } }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
  let body: any = {}; try { body = await req.json(); } catch { /* */ }
  const action = String(body?.action || ''); const S = site(req); const now = new Date().toISOString();
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  if (me.delegate && action !== 'commit') return bad('الوكيل المفوَّض يقرأ ويلتزم باسمك فقط؛ بقية الأفعال لصاحب الحساب من قاعة المجلس', 403);

  if (action === 'apply') {
    const mem = await myMemberships(db, me); if (mem.some(m => m.status === 'applied')) return NextResponse.json({ success: true, duplicate: true, message: 'طلبك قائم — المُوفِّق يراه عند التشكيل التالي' });
    if (mem.some(m => m.status === 'active' && m.council_id)) return NextResponse.json({ success: true, duplicate: true, in_council: true, message: 'أنت عضو في مجلس منعقد الآن — مقعد ثانٍ يُطلب بعد انتهاء دورتك' });
    const { data: om } = await db.from('portal_org_members').select('organization_id,full_name').eq('status', 'confirmed').or(`email.ilike.${me.email},user_id.eq.${me.id}`).limit(1);
    const note = [body.domain ? `المجال: ${String(body.domain).slice(0, 60)}` : '', body.sector ? `القطاع: ${String(body.sector).slice(0, 60)}` : '', body.note ? String(body.note).slice(0, 600) : ''].filter(Boolean).join(' · ');
    const { data: row, error } = await db.from('portal_council_members').insert({ council_id: null, user_id: me.id, email: me.email, full_name: me.name || (om || [])[0]?.full_name || null, organization_id: (om || [])[0]?.organization_id || null, role: 'member', status: 'applied', note, meta: { domain: body.domain || null, sector: body.sector || null } }).select(MEMBER_COLS).single();
    if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, applied: row, message: 'سُجّل طلبك — حين يكتمل مجلس يناسب مستواك وجهتك ستصلك دعوة لتوقيع الميثاق' });
  }
  if (action === 'sign_charter') {
    const id = String(body.council_id || ''); const { data: m } = await db.from('portal_council_members').select(MEMBER_COLS).eq('council_id', id).or(`email.ilike.${me.email},user_id.eq.${me.id}`).limit(1);
    const row = (m || [])[0] as Member | undefined; if (!row) return bad('لست مدعوًّا إلى هذا المجلس', 404);
    if (row.charter_signed_at) return NextResponse.json({ success: true, duplicate: true });
    await db.from('portal_council_members').update({ charter_signed_at: now, status: 'active', joined_at: row.joined_at || now, user_id: row.user_id || me.id, full_name: row.full_name || me.name || null, meta: { ...(row.meta || {}), charter_version: CHARTER_VERSION } }).eq('id', row.id);
    return NextResponse.json({ success: true, message: 'وقّعت الميثاق — أهلًا بك في المجلس' });
  }
  if (action === 'open_case') {
    const id = String(body.council_id || ''); const { council, members, cases } = await loadCouncil(db, id); if (!council) return bad('المجلس غير موجود', 404);
    const m = isMember(members, me); if (!m || !m.charter_signed_at) return bad('وقّع الميثاق أولًا', 403); if (council.status !== 'active') return bad('المجلس غير منعقد الآن', 409);
    if (cases.some(c => c.status === 'open' || c.status === 'committed')) return bad('في المجلس قضية جارية — تُغلق أولًا ثم تُفتح التالية (قضية واحدة في آن تحفظ عمق المداولة)', 409);
    const title = String(body.title || '').trim().slice(0, 160); const text = String(body.body || '').trim();
    if (title.length < 6) return bad('اكتب عنوانًا للقضية'); if (text.length < CASE_MIN_CHARS) return bad(`صف الموقف في ${CASE_MIN_CHARS} حرفًا على الأقل: ما الذي تواجهه؟ ما خياراتك؟ ما الذي تخشاه؟`);
    const kind = ['text', 'audio', 'video'].includes(String(body.kind)) ? String(body.kind) : 'text';
    const { data: row, error } = await db.from('portal_council_cases').insert({ council_id: id, cycle_no: council.cycle_no, author_user_id: me.id, author_email: me.email, title_ar: title, body_ar: text.slice(0, 6000), kind, media_id: body.media_id || null, status: 'open' }).select(CASE_COLS).single();
    if (error) return bad(error.message, 500);
    for (const x of activeMembers(members)) { if (lower(x.email) === me.email) continue; try { await notify(db, { kind: 'council_case_opened', to: { email: x.email, name: x.full_name }, subject: `قضية جديدة في مجلس «${council.title_ar}»`, text: `فُتحت قضية: «${title}». اسأل قبل أن تنصح — المداولة من قاعة المجلس: ${S}/me/council`, url: `${S}/me/council`, ref: `council_case:${(row as any).id}` }); } catch { /* */ } }
    return NextResponse.json({ success: true, case: row });
  }
  if (action === 'post') {
    const cid = String(body.case_id || ''); const { data: c } = await db.from('portal_council_cases').select(CASE_COLS).eq('id', cid).maybeSingle(); if (!c) return bad('القضية غير موجودة', 404);
    const cs = c as Case; if (cs.status === 'closed') return bad('القضية مغلقة', 409);
    const { members } = await loadCouncil(db, cs.council_id); const m = isMember(members, me); if (!m || !m.charter_signed_at) return bad('وقّع الميثاق أولًا', 403);
    const kind = (['question', 'advice', 'evidence'].includes(String(body.kind)) ? String(body.kind) : 'question') as PostKind; const text = String(body.body || '').trim();
    if (text.length < POST_MIN_CHARS) return bad('اكتب مداخلتك');
    if (kind === 'advice' && lower(cs.author_email) !== me.email) { const { data: mineQ } = await db.from('portal_council_posts').select('id').eq('case_id', cid).ilike('email', me.email).eq('kind', 'question').limit(1); const { data: anyQ } = await db.from('portal_council_posts').select('id').eq('case_id', cid).eq('kind', 'question').limit(1); if (!(mineQ || []).length && !(anyQ || []).length) return bad('ميثاق المجلس: يُطرح سؤال واحد على الأقل قبل أول نصيحة', 409); }
    const { data: row, error } = await db.from('portal_council_posts').insert({ case_id: cid, council_id: cs.council_id, user_id: me.id, email: me.email, kind, body_ar: text.slice(0, 3000), media_id: body.media_id || null }).select(POST_COLS).single();
    if (error) return bad(error.message, 500);
    await db.from('portal_council_members').update({ last_seen_at: now }).eq('id', m.id).then(() => null, () => null);
    return NextResponse.json({ success: true, post: row });
  }
  if (action === 'commit' || action === 'return' || action === 'close_case') {
    const cid = String(body.case_id || ''); const { data: c } = await db.from('portal_council_cases').select(CASE_COLS).eq('id', cid).maybeSingle(); if (!c) return bad('القضية غير موجودة', 404);
    const cs = c as Case; const { council, members } = await loadCouncil(db, cs.council_id); if (!council) return bad('المجلس غير موجود', 404);
    const m = isMember(members, me); if (!m) return bad('لست عضوًا في هذا المجلس', 403);
    const mine = lower(cs.author_email) === me.email; const chair = m.role === 'chair' || lower(council.chair_email) === me.email;
    const { data: ps } = await db.from('portal_council_posts').select(POST_COLS).eq('case_id', cid).order('created_at', { ascending: true }).limit(500); const posts = (ps || []) as Post[];
    if (action === 'commit') {
      if (!mine) return bad('الالتزام لصاحب القضية وحده', 403); if (cs.status !== 'open') return bad('القضية ليست في طور المداولة', 409);
      if (me.delegate && body.confirm !== true) return bad('يلزم تأكيد صريح من المستخدم (confirm: true) لصياغة التزام باسمه', 400);
      const text = String(body.commitment || '').trim(); if (text.length < 15) return bad('صُغ التزامك: ماذا ستفعل، ومتى؟');
      const patch = { status: 'committed', commitment_ar: text.slice(0, 1500), committed_at: now, return_due_at: returnDue(now), meta: { ...(cs.meta || {}), committed_via: me.delegate ? `agent:${me.client}` : 'hall' } };
      await db.from('portal_council_cases').update(patch).eq('id', cid);
      const scribe = await runScribe(db, { ...cs, ...patch } as Case, posts, 'commitment', me).catch(() => null);
      return NextResponse.json({ success: true, case: { ...cs, ...patch }, scribe, return_due_at: patch.return_due_at });
    }
    if (action === 'return') {
      if (!mine) return bad('العودة لصاحب القضية وحده', 403); if (cs.status !== 'committed') return bad('لا التزام معلن بعد', 409);
      const text = String(body.text || '').trim(); const outcome = (['succeeded', 'struggled', 'reframed'].includes(String(body.outcome)) ? String(body.outcome) : 'reframed') as ReturnOutcome;
      if (text.length < 20) return bad('عُد بما حدث فعلًا — في عشرين حرفًا على الأقل');
      const patch = { status: 'returned', return_ar: text.slice(0, 3000), return_outcome: outcome, returned_at: now };
      await db.from('portal_council_cases').update(patch).eq('id', cid);
      await db.from('portal_council_posts').insert({ case_id: cid, council_id: cs.council_id, user_id: me.id, email: me.email, kind: 'return_note', body_ar: text.slice(0, 3000) }).then(() => null, () => null);
      const scribe = await runScribe(db, { ...cs, ...patch } as Case, posts, 'return', me).catch(() => null);
      for (const x of activeMembers(members)) { if (lower(x.email) === me.email) continue; try { await notify(db, { kind: 'council_returned', to: { email: x.email, name: x.full_name }, subject: `عاد صاحب القضية «${cs.title_ar.slice(0, 60)}» — اشهد لما رأيت`, text: `عاد بالنتيجة: ${outcome === 'succeeded' ? 'نجح' : outcome === 'struggled' ? 'تعثّر' : 'تغيّر فهمه'}. إن رأيت مهارة محددة ظهرت في هذه الدورة اشهد لها بدليل من قاعة المجلس: ${S}/me/council`, url: `${S}/me/council`, ref: `council_returned:${cid}` }); } catch { /* */ } }
      return NextResponse.json({ success: true, case: { ...cs, ...patch }, scribe });
    }
    // close_case
    if (!mine && !chair && !me.staff) return bad('يغلق القضية صاحبها أو كرسي المجلس', 403); if (cs.status === 'closed') return bad('مغلقة بالفعل', 409);
    if (cs.status === 'committed' && !me.staff) return bad('القضية في انتظار العودة — تُغلق بعد أن يعود صاحبها', 409);
    const patch = { status: 'closed', closed_at: now }; await db.from('portal_council_cases').update(patch).eq('id', cid);
    const scribe = await runScribe(db, { ...cs, ...patch } as Case, posts, 'deliberation', me).catch(() => null);
    return NextResponse.json({ success: true, case: { ...cs, ...patch }, scribe });
  }
  if (action === 'attest') {
    const id = String(body.council_id || ''); const { council, members } = await loadCouncil(db, id); if (!council) return bad('المجلس غير موجود', 404);
    const sk = await skillNames(db, council.skill_ids || []);
    const r = await createAttestation(db, { council_id: id, case_id: body.case_id ? String(body.case_id) : null, cycle_no: council.cycle_no, from: { id: me.id, email: me.email }, to_email: lower(body.to_email), skill_id: String(body.skill_id || ''), evidence_ar: String(body.evidence || '') }, members, council.skill_ids || [], { skill_name: sk.get(String(body.skill_id)) || null, council_title: council.title_ar });
    if (!r.ok) return bad(r.error);
    if (!r.duplicate) {
      const ap = await approversFor(db, r.row); const to = ap.role === 'org_admin' ? ap.emails : String(process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
      for (const e of to) { try { await notify(db, { kind: 'council_attestation_requested', to: { email: e }, subject: `شهادة أقران تنتظر اعتمادك — ${sk.get(r.row.skill_id) || 'مهارة'}`, text: `شهد ${me.name || me.email} لـ ${memberName(members, r.row.to_email) || r.row.to_email} في مجلس «${council.title_ar}»: «${r.row.evidence_ar.slice(0, 200)}». ${ap.role === 'org_admin' ? `بصفتك مدير الجهة: ${S}/me/council` : `الطاقم: ${S}/admin/councils`}`, url: ap.role === 'org_admin' ? `${S}/me/council` : `${S}/admin/councils`, ref: `council_att:${r.row.id}` }); } catch { /* */ } }
      try { await notify(db, { kind: 'council_attested', to: { email: r.row.to_email, name: memberName(members, r.row.to_email) }, subject: 'شهد لك قرين في المجلس', text: `شهادة أقران جديدة على «${sk.get(r.row.skill_id) || 'مهارة'}» — ستُعتمد من ${ap.role === 'org_admin' ? 'مدير جهتك' : 'طاقم أَثَر'} ثم ترتفع في خيط أثرك: ${S}/me/council`, url: `${S}/me/council`, ref: `council_att_to:${r.row.id}` }); } catch { /* */ }
    }
    return NextResponse.json({ success: true, attestation: r.row, duplicate: r.duplicate, approver: (await approversFor(db, r.row)).role });
  }
  if (action === 'decide_attestation') {
    const id = Number(body.id); const { data: a } = await db.from('portal_council_attestations').select(ATTEST_COLS).eq('id', id).maybeSingle(); if (!a) return bad('الشهادة غير موجودة', 404);
    const role = await canDecide(db, a as Attestation, me); if (!role) return bad('الاعتماد لمدير جهة المشهود له أو لطاقم أَثَر', 403);
    const { data: c } = await db.from('portal_councils').select('title_ar,skill_ids').eq('id', (a as any).council_id).maybeSingle(); const sk = await skillNames(db, (c as any)?.skill_ids || []);
    const r = await decideAttestation(db, id, { by: { id: me.id, email: me.email }, role, approve: body.approve !== false, note: body.note }, { skill_name: sk.get((a as any).skill_id) || null, council_title: (c as any)?.title_ar || null });
    if (!r.ok) return bad(r.error || 'تعذّر');
    try { await notify(db, { kind: 'council_attestation_decided', to: { email: (a as any).to_email }, subject: body.approve !== false ? 'اعتُمدت شهادة أقران لك' : 'لم تُعتمد شهادة أقران', text: `${body.approve !== false ? 'اعتُمدت' : 'رُفضت'} شهادة «${sk.get((a as any).skill_id) || ''}» من ${role === 'staff' ? 'طاقم أَثَر' : 'مدير جهتك'}${body.note ? ` — ${String(body.note).slice(0, 200)}` : ''}. ${S}/me/skills`, url: `${S}/me/skills`, ref: `council_att_decided:${id}` }); } catch { /* */ }
    return NextResponse.json({ success: true, attestation: r.row });
  }
  if (action === 'request_badge') {
    const mem = await myMemberships(db, me);
    const [{ data: allCases }, { data: allAtts }] = await Promise.all([db.from('portal_council_cases').select('id,author_email,returned_at,cycle_no').ilike('author_email', me.email).limit(500), db.from('portal_council_attestations').select('from_email,to_email,status,cycle_no').or(`from_email.ilike.${me.email},to_email.ilike.${me.email}`).limit(1000)]);
    const stats = badgeStats(me.email, mem, (allCases || []) as Case[], (allAtts || []) as Attestation[]); const el = badgeEligibility(stats);
    if (!el.ok) return NextResponse.json({ success: false, error: `لم تستحق بعد — ينقصك: ${el.missing_ar.join(' · ')}`, stats, missing: el.missing_ar }, { status: 409 });
    const signer = signerFromEnv(process.env, S); if (!signer) return bad('مفتاح التوقيع غير مضبوط بعد — اطلب من الإدارة ضبط VC_SIGNING_KEY', 409);
    const r = await issueBadge(db, { id: me.id, email: me.email, name: me.name }, stats, signer, S, didWeb(S), () => randomCode(4)); if (!r.ok) return bad(r.error, 500);
    return NextResponse.json({ success: true, code: r.code, existing: r.existing, verify_url: `${S}/verify/vc?code=${encodeURIComponent(r.code)}`, document_url: `${S}/api/vc?code=${encodeURIComponent(r.code)}`, stats });
  }
  return bad('إجراء غير معروف');
}
