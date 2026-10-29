// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/agent — واجهة الوكلاء المفوَّضين (أَثَر للوكلاء · P14-ب) — الواجهة التي تتعامل معها الآلات
 *  GET  /api/agent                 → وصف الأدوات (manifest) + طريقة التفويض — عام، CORS
 *  GET  /api/agent?log=1           → آخر 10 تعاملات عامة مجهّلة («المكتب الزجاجي») — عام
 *  POST { tool, args }             → تنفيذ أداة. التفويض: X-Agent-Key: atk_… (أو Authorization: Bearer atk_…)
 *                                    بلا مفتاح: discover_programs و verify_credential فقط بحد يومي أدنى (حسب IP)
 *                                    طاقم أَثَر (Bearer JWT) + { sandbox:true } → «جرّب كوكيل» بكل الصلاحيات، والطلبات تُعلَّم sandbox
 *  القاعدة: كل كتابة (عرض سعر/حجز/غرفة) = طلب ينتظر اعتماد إنسان؛ لا التزام مالي آلي. كل نداء يُسجَّل في portal_agent_log.
 */
import { NextResponse } from 'next/server';
import { readJson } from '../../../lib/shield/body';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { AGENT_TOOLS, toolByName, isAgentKey, allowCall, validateArgs, fitPrograms, findSkillNode, indicativeQuote, pluginManifest, publicLogLine, ANON_SCOPES, ANON_DAILY_LIMIT, ALL_SCOPES } from '../../../lib/portal/agents';
import type { KeyRow } from '../../../lib/portal/agents';
import { loadGraph } from '../../../lib/portal/evidence-cron';
import { TEMPLATES } from '../../../lib/portal/evidence';
import { roomCode, ROOM_DEFAULT_PROMPT } from '../../../lib/portal/media';
import { normalizeSite } from '../../../lib/portal/open';
import { sendViaResend } from '../../../lib/email/resend';
import { delegateFromHeaders, PERSONAL_DAILY_LIMIT } from '../../../lib/portal/oauth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const safeDecode = (s: string | null) => { if (!s) return null; try { return decodeURIComponent(s).slice(0, 120); } catch { return s.slice(0, 120); } };
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Key', 'Cache-Control': 'no-store' };
const json = (body: any, status = 200) => NextResponse.json(body, { status, headers: H });
const fail = (error_ar: string, error_en: string, status = 400) => json({ success: false, error: error_ar, error_en }, status);
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app');
const todayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: H }); }

export async function GET(req: Request) {
  const u = new URL(req.url); const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (u.searchParams.get('log')) {
    if (!URL_ || !SERVICE) return json({ success: true, lines: [] });
    const db = createClient(URL_, SERVICE, { auth: { persistSession: false } }); const { data } = await db.from('portal_agent_log').select('at,tool,ok,meta').order('at', { ascending: false }).limit(10);
    const now = Date.now(); return json({ success: true, lines: ((data || []) as any[]).map(r => publicLogLine(r, now)), count_24h: (await db.from('portal_agent_log').select('id', { count: 'exact', head: true }).gte('at', new Date(now - 86400000).toISOString())).count || 0 });
  }
  return NextResponse.json(pluginManifest(site()), { headers: { ...H, 'Cache-Control': 'public, s-maxage=3600' } });
}

type Actor = { kind: 'key'; key: KeyRow & { org_name?: string | null; org_sector?: string | null } } | { kind: 'anon'; ip: string } | { kind: 'sandbox'; userId: string; email: string };

async function resolveActor(req: Request, db: any, body: any): Promise<{ actor: Actor } | { error: NextResponse }> {
  const hdr = req.headers.get('x-agent-key') || ''; const auth = req.headers.get('authorization') || ''; const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const key = isAgentKey(hdr) ? hdr : isAgentKey(bearer) ? bearer : '';
  if (key) {
    const { data } = await db.from('portal_agent_keys').select('id,organization_id,name,scopes,daily_limit,expires_at,revoked_at,created_by').eq('key_hash', sha256(key)).maybeSingle(); if (!data) return { error: fail('مفتاح غير معروف', 'Unknown key', 401) };
    let org_name: string | null = null, org_sector: string | null = null; if ((data as any).organization_id) { const { data: o } = await db.from('portal_organizations').select('name_ar,sector').eq('id', (data as any).organization_id).maybeSingle(); org_name = (o as any)?.name_ar || null; org_sector = (o as any)?.sector || null; if (org_sector) { const { data: sec } = await db.from('portal_sectors').select('name_ar').eq('code', org_sector).maybeSingle(); org_sector = (sec as any)?.name_ar || org_sector; } }
    return { actor: { kind: 'key', key: { ...(data as any), org_name, org_sector } } };
  }
  if (bearer && body?.sandbox) {
    const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${bearer}` } } }); const { data } = await userDb.auth.getUser(bearer);
    if (data?.user) { const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle(); if (STAFF.includes(String((prof as any)?.role || '').toUpperCase())) return { actor: { kind: 'sandbox', userId: data.user.id, email: String(data.user.email || '') } }; }
    return { error: fail('وضع التجربة للطاقم فقط', 'Sandbox is staff-only', 403) };
  }
  // P20: نداء من خادم MCP بتفويض شخصي → الأدوات العامة فقط، والحد اليومي يُحسب على التفويض لا على عنوان IP المشترك
  const dg = delegateFromHeaders(req.headers, process.env); if (dg) return { actor: { kind: 'anon', ip: `dg:${dg.del}` } };
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'; return { actor: { kind: 'anon', ip } };
}

export async function POST(req: Request) {
  const t0 = Date.now(); const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return fail('إعدادات الخادم غير مكتملة', 'Server not configured', 500);
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } }); const rj = await readJson(req, { allowEmpty: true }); if (!rj.ok) return NextResponse.json({ success: false, error: rj.error, error_en: rj.error_en }, { status: rj.status, headers: H }); const body = rj.body || {};
  const tool = toolByName(String(body?.tool || '')); if (!tool) return json({ success: false, error: 'أداة غير معروفة', error_en: 'Unknown tool', tools: AGENT_TOOLS.map(t => t.name) }, 400);
  const r = await resolveActor(req, db, body); if ('error' in r) return r.error; const actor = r.actor; const nowIso = new Date().toISOString();
  const logMeta: Record<string, unknown> = { key: actor.kind === 'key' ? actor.key.id : null, org: actor.kind === 'key' ? actor.key.organization_id : null, org_sector: actor.kind === 'key' ? actor.key.org_sector : null, sandbox: actor.kind === 'sandbox', anon: actor.kind === 'anon', transport: req.headers.get('x-athar-transport') || 'http', proto: req.headers.get('x-athar-proto') || null, client: safeDecode(req.headers.get('x-athar-client')) };
  const log = async (ok: boolean, extra: Record<string, unknown> = {}) => { try { await db.from('portal_agent_log').insert({ key_id: actor.kind === 'key' ? actor.key.id : null, tool: tool.name, ok, ms: Date.now() - t0, meta: { ...logMeta, ...extra } }); } catch { /* تجاهل */ } };
  // التفويض والحدود
  if (actor.kind === 'key') {
    const { count } = await db.from('portal_agent_log').select('id', { count: 'exact', head: true }).eq('key_id', actor.key.id).gte('at', todayStart()); const chk = allowCall(actor.key, tool.scope, count || 0, nowIso);
    if (!chk.ok) { await log(false, { denied: chk.error_en }); return fail(chk.error_ar, chk.error_en, chk.status); }
    await db.from('portal_agent_keys').update({ last_used_at: nowIso, uses: (count || 0) + 1 }).eq('id', actor.key.id);
  } else if (actor.kind === 'anon') {
    if (!ANON_SCOPES.includes(tool.scope)) { await log(false, { denied: 'key_required' }); return fail('هذه الأداة تحتاج مفتاح وكيل مفوَّض — اطلبه عبر /agents', 'This tool requires an authorized agent key — see /agents', 401); }
    const { count } = await db.from('portal_agent_log').select('id', { count: 'exact', head: true }).is('key_id', null).contains('meta', { anon: true, ip: actor.ip }).gte('at', todayStart()); logMeta.ip = actor.ip;
    if ((count || 0) >= (actor.ip.startsWith('dg:') ? PERSONAL_DAILY_LIMIT : ANON_DAILY_LIMIT)) { await log(false, { denied: 'anon_limit' }); return fail('تجاوزت حد الاستخدام بلا مفتاح', 'Anonymous daily limit reached', 429); }
  }
  const v = validateArgs(tool, body?.args); if (!v.ok) { await log(false, { invalid: v.error_en }); return fail(v.error_ar, v.error_en, 422); }
  const a = v.args; const S = site(); const orgId = actor.kind === 'key' ? actor.key.organization_id || null : null; const keyId = actor.kind === 'key' ? actor.key.id : null; const sandbox = actor.kind === 'sandbox';
  const envelope = (result: any, human = false, notice?: { ar: string; en: string }) => json({ success: true, tool: tool.name, result, human_in_the_loop: human, notice: notice || (human ? { ar: 'هذا طلب ينتظر اعتماد إنسان في أَثَر — لا يُعدّ التزامًا حتى يُعتمد.', en: 'This request awaits human approval at Athar — not a commitment until approved.' } : undefined), sandbox: sandbox || undefined });

  try {
    if (tool.name === 'discover_programs') {
      let q = db.from('programs').select('id,name_ar,name_en,program_type,delivery_mode,start_date,end_date,fee,currency,seats,registration_open,cefr_level').eq('is_public', true).is('archived_at', null).order('start_date', { ascending: false }).limit(a.limit || 10);
      if (a.sector) q = q.eq('sector', a.sector); const { data, error } = await q; let rows = (data || []) as any[]; if (error && /sector/i.test(error.message || '')) { const r2 = await db.from('programs').select('id,name_ar,name_en,program_type,delivery_mode,start_date,end_date,fee,currency,seats,registration_open,cefr_level').eq('is_public', true).is('archived_at', null).order('start_date', { ascending: false }).limit(a.limit || 10); rows = (r2.data || []) as any[]; }
      if (a.q) { const lq = String(a.q).toLowerCase(); rows = rows.filter(p => `${p.name_ar} ${p.name_en || ''}`.toLowerCase().includes(lq)); }
      await log(true, { n: rows.length }); return envelope({ programs: rows.map(p => ({ id: p.id, name_ar: p.name_ar, name_en: p.name_en, type: p.program_type, delivery: p.delivery_mode, start_date: p.start_date, end_date: p.end_date, fee: p.fee, currency: p.currency || 'SAR', seats: p.seats, registration_open: !!p.registration_open, cefr_level: p.cefr_level, url: `${S}/programs/${p.id}` })), catalog_jsonld: `${S}/api/catalog?format=jsonld` });
    }
    if (tool.name === 'skill_fit') {
      const g = await loadGraph(db); const sid = findSkillNode(g, a.skill); if (!sid) { await log(true, { skill: a.skill, found: false }); return envelope({ skill: null, programs: [], message_ar: 'لم أجد مهارة بهذا الاسم في إطار أَثَر — جرّب الاسم العربي أو الرمز ATH-…', message_en: 'No such skill in the Athar framework — try the Arabic name or ATH- code.' }); }
      const node = g.nodes.find(n => n.id === sid)!; const fits = fitPrograms(g, sid); const chan = TEMPLATES.find(t => t.id === 'top_channel')!.run(g, { skill: node.ref_id || sid.slice(6) });
      await log(true, { skill: node.label_ar, n: fits.length }); return envelope({ skill: { id: node.ref_id, name_ar: node.label_ar, name_en: node.label_en, code: (node.meta as any)?.code || null, people_with_evidence: node.people }, programs: fits.map(f => ({ ...f, url: `${S}/programs/${f.program_id}` })), best_channel_ar: chan.rows[0]?.label || null, basis_ar: 'من قاعدة الأدلة المؤسسية: أدلة تعلّم موزونة يعتمدها بشر — لا من وصف الكتالوج.', basis_en: 'From the institutional evidence base — weighted, human-approved learning evidence, not catalog copy.' }, false, fits.length ? undefined : { ar: 'لا برنامج يحمل دليلًا على هذه المهارة بعد؛ يمكن طلب تصميم برنامج عبر open_dialogue_room.', en: 'No program carries evidence on this skill yet; ask for a designed program via open_dialogue_room.' });
    }
    if (tool.name === 'request_quote' || tool.name === 'reserve_seats') {
      const { data: p } = await db.from('programs').select('id,name_ar,fee,currency,seats,registration_open').eq('id', a.program_id).eq('is_public', true).maybeSingle(); if (!p) { await log(false, { program: a.program_id, missing: true }); return fail('البرنامج غير موجود أو غير عام', 'Program not found or not public', 404); }
      const seats = tool.name === 'request_quote' ? a.seats : (a.participants as any[]).length; const quote = indicativeQuote(p as any, seats);
      const payload = { program_id: (p as any).id, program_name: (p as any).name_ar, seats, contact_email: a.contact_email, notes: a.notes || null, participants: a.participants || null, indicative: quote, sandbox: sandbox || undefined, org_name: actor.kind === 'key' ? actor.key.org_name : null };
      const { data: reqRow, error } = await db.from('portal_agent_requests').insert({ key_id: keyId, organization_id: orgId, kind: tool.name === 'request_quote' ? 'quote' : 'reserve', payload, status: 'pending' }).select('id,created_at').maybeSingle(); if (error) throw error;
      await notifyStaff(`طلب وكيل: ${tool.name === 'request_quote' ? 'عرض سعر' : 'حجز مقاعد'} — ${(p as any).name_ar} (${seats})`, `<p>وصل طلب من وكيل${actor.kind === 'key' ? ` لجهة «${actor.key.org_name || actor.key.name}»` : sandbox ? ' تجريبي' : ''}: <b>${(p as any).name_ar}</b> · ${seats} مقعدًا · ${a.contact_email}</p><p><a href="${S}/admin/agents">اعتمد أو ارفض من /admin/agents</a></p>`);
      await log(true, { request: (reqRow as any)?.id, seats }); return envelope({ request_id: (reqRow as any)?.id, status: 'pending_human_approval', program: { id: (p as any).id, name_ar: (p as any).name_ar, url: `${S}/programs/${(p as any).id}` }, seats, indicative_quote: quote, expected_human_response: 'within 1 business day', status_url: `${S}/api/agent (request_status)` }, true);
    }
    if (tool.name === 'verify_credential') {
      const code = String(a.code).toUpperCase(); const { data: c } = await db.from('portal_credentials').select('verify_code,title_ar,title_en,kind,issued_at,valid_until,revoked_at,live,hours,level').ilike('verify_code', code).maybeSingle();
      await log(true, { found: !!c }); if (!c) return envelope({ valid: false, code, message_ar: 'لا شهادة بهذا الرمز', message_en: 'No credential with this code' });
      const cc = c as any; const expired = cc.valid_until && cc.valid_until < nowIso.slice(0, 10); return envelope({ valid: !cc.revoked_at && !expired, code: cc.verify_code, title_ar: cc.title_ar, title_en: cc.title_en, kind: cc.kind, issued_at: cc.issued_at, valid_until: cc.valid_until, revoked: !!cc.revoked_at, live: !!cc.live, hours: cc.hours, level: cc.level, url: `${S}/credential/${encodeURIComponent(cc.verify_code)}`, holder: 'see public credential page (holder consent governs visibility)' });
    }
    if (tool.name === 'impact_report') {
      const g = await loadGraph(db); const year = a.year || null;
      if (orgId) { const t = TEMPLATES.find(x => x.id === 'org_year')!.run(g, { org: orgId, year }); await log(true, { org: orgId }); return envelope({ scope: 'organization', organization: actor.kind === 'key' ? actor.key.org_name : null, year, headline_ar: t.answer_ar, chain: t.chain, rows: t.rows.map(r => ({ label: r.label, value: r.value, sub: r.sub })), confidence: t.confidence, anonymized: true }); }
      const t = TEMPLATES.find(x => x.id === 'year_summary')!.run(g, { year }); await log(true, { org: null }); return envelope({ scope: 'platform', year, headline_ar: t.people >= 5 ? t.answer_ar : 'لا تجمّعات كافية للنشر بعد (≥ 5 أشخاص)', chain: t.people >= 5 ? t.chain : [], rows: t.people >= 5 ? t.rows.slice(0, 5).map(r => ({ label: r.label, value: r.value })) : [], confidence: t.confidence, anonymized: true, note_ar: 'لتقرير جهتك اطلب مفتاحًا مرتبطًا بها.' });
    }
    if (tool.name === 'open_dialogue_room') {
      const createdBy = actor.kind === 'key' ? actor.key.created_by || null : actor.kind === 'sandbox' ? actor.userId : null; let code = roomCode(); for (let i = 0; i < 5; i++) { const { data: ex } = await db.from('portal_rooms').select('id').eq('code', code).limit(1); if (!(ex || []).length) break; code = roomCode(); }
      const { data: room, error } = await db.from('portal_rooms').insert({ code, title: `حوار مع مستشار: ${String(a.topic).slice(0, 80)}`, kind: 'consult', created_by: createdBy, prompt: ROOM_DEFAULT_PROMPT.consult, max_peers: 4, minutes: 20, status: 'open', notes: [] }).select('code').maybeSingle(); if (error) throw error;
      const url = `${S}/room/${(room as any).code}`; const { data: reqRow } = await db.from('portal_agent_requests').insert({ key_id: keyId, organization_id: orgId, kind: 'dialogue', payload: { topic: a.topic, contact_email: a.contact_email, room: (room as any).code, url, sandbox: sandbox || undefined }, status: 'pending' }).select('id').maybeSingle();
      await notifyStaff(`وكيل فتح غرفة حوار: ${String(a.topic).slice(0, 60)}`, `<p>ممثل جهة (${a.contact_email}) ينتظر مستشارًا في غرفة أَثَر: <a href="${url}">${url}</a></p><p>الموضوع: ${a.topic}</p>`);
      await log(true, { room: (room as any).code }); return envelope({ request_id: (reqRow as any)?.id, room_code: (room as any).code, url, max_peers: 4, minutes: 20, instructions_ar: 'افتح الرابط في متصفح حديث واسمح بالكاميرا؛ سيُبلَّغ مستشار أَثَر ليلتحق.', instructions_en: 'Open the link in a modern browser and allow the camera; an Athar advisor is notified to join.' }, true, { ar: 'الغرفة مفتوحة الآن؛ التحاق المستشار يعتمد على توافره.', en: 'The room is open now; advisor attendance depends on availability.' });
    }
    if (tool.name === 'request_status') {
      let q = db.from('portal_agent_requests').select('id,kind,status,created_at,decided_at,note,response,payload').eq('id', a.request_id); if (keyId) q = q.eq('key_id', keyId); else if (!sandbox) q = q.is('key_id', null);
      const { data: rq } = await q.maybeSingle(); await log(true, { found: !!rq }); if (!rq) return envelope({ found: false });
      const x = rq as any; return envelope({ found: true, id: x.id, kind: x.kind, status: x.status, created_at: x.created_at, decided_at: x.decided_at, note: x.note, response: x.response, program: x.payload?.program_name || null, seats: x.payload?.seats || null }, x.status === 'pending');
    }
    return fail('أداة غير مدعومة', 'Unsupported tool', 400);
  } catch (e: any) { await log(false, { error: String(e?.message || e).slice(0, 160) }); return fail('تعذّر تنفيذ الأداة', 'Tool failed', 500); }
}

async function notifyStaff(subject: string, html: string) {
  const to = String(process.env.NOTIFY_EMAILS || process.env.ADMIN_EMAILS || '').split(/[,;\s]+/).filter(Boolean); if (!to.length || !process.env.RESEND_API_KEY) return;
  try { await sendViaResend({ to, subject: `أَثَر | ${subject}`, html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#0f172a">${html}</div>`, tags: [{ name: 'kind', value: 'agent_request' }] }); } catch { /* تجاهل */ }
}
