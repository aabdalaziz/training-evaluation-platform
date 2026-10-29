// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — خادم MCP «سفارة أَثَر» (P20): معالج HTTP المشترك لـ /mcp (مفوَّض) و /mcp/public (عام)
 *  • POST رسالة JSON-RPC واحدة (أو دفعة قديمة) → رد JSON. GET/DELETE → 405 (لا بثّ طويل؛ البروتوكول بلا جلسات منذ 2026-07-28)
 *  • الهوية: Bearer athar_at (تفويض شخصي OAuth) · atk_/X-Agent-Key (مفتاح جهة) · رمز جلسة أَثَر (المستخدم نفسه بكل النطاقات) · لا شيء (عام)
 *  • التنفيذ يعيد استخدام واجهات أَثَر نفسها داخل العملية (بلا شبكة): /api/agent · /api/pocket · /api/daily · /api/missions · /api/vc · /api/observatory
 *    الأدوات الشخصية تمرّ بترويسة تفويض داخلية موقَّعة (60 ثانية) تقرأها تلك الواجهات كأنها جلسة المستخدم — بنطاقاته فقط.
 *  • كل نداء يُسجَّل في portal_agent_log (meta.transport = 'mcp') ليظهر في المكتب الزجاجي و«السفارة» و«وكلائي».
 */
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { normalizeSite } from './open';
import { isAgentKey } from './agents';
import { ERR, MCP_LATEST, MCP_VERSIONS, META, discoverResult, initializeResult, okResult, errResult, parseRpc, isNotification, versionOf, toolsListResult, mcpToolByName, toolAllowed, toolContent, summarize, resourcesFor, RESOURCES, LEXICON_MD, PROMPTS, promptMessages, cacheable } from './mcp';
import type { Tier, McpVersion, Rpc } from './mcp';
import { verifyToken, secretsFromEnv, mcpResource, wwwAuthenticate, mintDelegate, PERSONAL_DAILY_LIMIT, DELEGATE_HEADER } from './oauth';
import type { PScope, TokenClaims } from './oauth';
import { readJson, PUBLIC_MAX_BYTES } from '../shield/body';
import { rateLimit, limitFor, tooMany, LIMITS } from '../shield/ratelimit';
import { burst } from '../shield/guard';
import { POST as agentPOST } from '../../app/api/agent/route';
import { GET as pocketGET } from '../../app/api/pocket/route';
import { GET as vaultGET } from '../../app/api/vault/route';
import { GET as councilGET, POST as councilPOST } from '../../app/api/councils/route';
import { GET as dailyGET, POST as dailyPOST } from '../../app/api/daily/route';
import { GET as missionsGET } from '../../app/api/missions/route';
import { POST as vcPOST } from '../../app/api/vc/route';
import { GET as obsGET } from '../../app/api/observatory/route';
import { GET as charterGET } from '../../app/api/org/charter/route';
import { GET as journeyGET } from '../../app/api/journey/route';
import { GET as didGET } from '../../app/.well-known/did.json/route';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-Agent-Key, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Session-Id', 'Access-Control-Expose-Headers': 'MCP-Protocol-Version, WWW-Authenticate', 'Cache-Control': 'no-store' };
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app');
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const todayStart = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); };
const TREND_AR: Record<string, string> = { rising: 'صاعد', stable: 'مستقر', cooling: 'متراجع', unknown: 'لا دليل كافٍ' };
const TREND_EN: Record<string, string> = { rising: 'rising', stable: 'stable', cooling: 'declining', unknown: 'insufficient evidence' };

type Actor = { tier: 'anon'; ip: string } | { tier: 'key'; key: string; scopes: string[]; name: string } | { tier: 'personal'; user: { id: string; email: string; name: string }; del: string; client: string; client_name: string; scopes: PScope[]; direct: boolean };
type Ctx = { db: any; site: string; actor: Actor; v: McpVersion; ip: string; t0: number };

function jsonRes(body: any, status = 200, extra: Record<string, string> = {}) { return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS, ...extra } }); }

async function resolveActor(req: Request, db: any, mode: 'auth' | 'public', S: string): Promise<{ actor: Actor } | { res: Response }> {
  const auth = req.headers.get('authorization') || ''; const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''; const xkey = req.headers.get('x-agent-key') || '';
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const key = isAgentKey(xkey) ? xkey : isAgentKey(bearer) ? bearer : '';
  if (key) { const { data } = await db.from('portal_agent_keys').select('id,name,scopes,revoked_at,expires_at').eq('key_hash', sha256(key)).maybeSingle(); if (!data || (data as any).revoked_at) return { res: unauthorized(S, 'invalid_token', 'Unknown or revoked agent key') }; return { actor: { tier: 'key', key, scopes: (data as any).scopes || [], name: (data as any).name } }; }
  if (bearer.startsWith('athar_')) {
    const c = verifyToken(bearer, secretsFromEnv(process.env), Date.now(), 'at'); if (!c || c.aud.replace(/\/+$/, '') !== mcpResource(S)) return { res: unauthorized(S, 'invalid_token', 'Expired or invalid access token') };
    const { data: d } = await db.from('portal_delegations').select('id,user_id,email,client_id,client_name,scopes,revoked_at').eq('id', c.del).maybeSingle(); if (!d || (d as any).revoked_at) return { res: unauthorized(S, 'invalid_token', 'Authorization was revoked by the user') };
    return { actor: { tier: 'personal', user: { id: c.sub, email: c.email, name: c.name || '' }, del: c.del, client: c.client, client_name: (d as any).client_name || c.client_name || c.client, scopes: ((d as any).scopes || []) as PScope[], direct: false } };
  }
  if (bearer) {
    const U = process.env.NEXT_PUBLIC_SUPABASE_URL!; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${bearer}` } } }); const { data } = await userDb.auth.getUser(bearer);
    if (!data?.user) return { res: unauthorized(S, 'invalid_token', 'Invalid token') };
    const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
    return { actor: { tier: 'personal', user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, del: 'direct', client: 'direct', client_name: 'جلسة المستخدم مباشرة', scopes: ['wallet:read', 'daily:write', 'missions:read', 'snapshot:issue', 'council:write'], direct: true } };
  }
  if (mode === 'auth') return { res: unauthorized(S) };
  return { actor: { tier: 'anon', ip } };
}
function unauthorized(S: string, error?: string, desc?: string) { return jsonRes(errResult(null, -32001, desc || 'Authorization required — see WWW-Authenticate / /.well-known/oauth-protected-resource/mcp', { resource_metadata: `${S}/.well-known/oauth-protected-resource/mcp`, public_endpoint: `${S}/mcp/public` }), 401, { 'WWW-Authenticate': wwwAuthenticate(S, error, desc) }); }
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export async function handleMcp(req: Request, mode: 'auth' | 'public'): Promise<Response> {
  const S = site();
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return jsonRes({ error: 'Use POST with a JSON-RPC 2.0 message (MCP Streamable HTTP; JSON responses, no SSE stream).', endpoint: mode === 'auth' ? `${S}/mcp` : `${S}/mcp/public`, public_endpoint: `${S}/mcp/public`, docs: `${S}/agents`, protocolVersions: MCP_VERSIONS }, 405, { Allow: 'POST, OPTIONS' });
  const db = svc(); if (!db) return jsonRes(errResult(null, ERR.INTERNAL, 'Server not configured'), 500);
  const ip0 = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const rj = await readJson(req, { maxBytes: PUBLIC_MAX_BYTES }); if (!rj.ok) { if (rj.reason !== 'invalid') await burst(db, `body:${ip0}`, 3600, 5, { severity: 'info', kind: 'body_rejected', actor: '/mcp', ip: ip0, meta: { reason: rj.reason } }); return jsonRes(errResult(null, rj.reason === 'too_large' ? ERR.INVALID_REQUEST : ERR.PARSE, rj.error_en), rj.status); } const body: unknown = rj.body;
  const parsed = parseRpc(body); if (!parsed.ok) return jsonRes(errResult(null, parsed.code, parsed.message), 400);
  const header = req.headers.get('mcp-protocol-version');
  const a = await resolveActor(req, db, mode, S);
  if ('res' in a) { if (a.res.status === 401) { const b401 = await rateLimit(db, `mcp_401_ip:${ip0}`, LIMITS.mcp_401_ip.w, LIMITS.mcp_401_ip.n); if (!b401.allowed) { await burst(db, `mcp401:${ip0}`, 3600, 0, { severity: 'warn', kind: 'mcp_401_burst', actor: mode === 'auth' ? '/mcp' : '/mcp/public', ip: ip0, meta: { count: b401.count } }); return tooMany(b401, 'محاولات كثيرة بلا تفويض'); } } return a.res; }
  if (a.actor.tier === 'anon') { const rlp = await limitFor(db, 'mcp_public_ip', ip0); if (!rlp.allowed) return tooMany(rlp, 'تجاوزت حد الاستخدام المجهول لهذه الساعة — سجّل مفتاح جهة أو فوّض حسابك'); }
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const out: Rpc[] = []; let negotiated: McpVersion = MCP_LATEST;
  for (const m of parsed.msgs) {
    if (isNotification(m)) continue;
    if (m.method === undefined) continue; // ردود عملاء لا نطلبها (لا نرسل طلبات من الخادم)
    const ver = versionOf(m, header); negotiated = ver.negotiated;
    const metaV = m.params?._meta?.[META.version]; if (metaV && !(MCP_VERSIONS as readonly string[]).includes(String(metaV))) { out.push(errResult(m.id, ERR.UNSUPPORTED_VERSION, 'Unsupported protocol version', { requested: metaV, supportedVersions: MCP_VERSIONS })); continue; }
    if (!metaV && header && !(MCP_VERSIONS as readonly string[]).includes(header) && m.method !== 'initialize') return jsonRes(errResult(m.id, ERR.UNSUPPORTED_VERSION, 'Unsupported MCP-Protocol-Version header', { requested: header, supportedVersions: MCP_VERSIONS }), 400);
    const ctx: Ctx = { db, site: S, actor: a.actor, v: ver.negotiated, ip, t0: Date.now() };
    try { out.push(await dispatch(m, ctx)); } catch (e: any) { out.push(errResult(m.id, ERR.INTERNAL, 'Internal error', { message: String(e?.message || e).slice(0, 200) })); }
  }
  if (!out.length) return new Response(null, { status: 202, headers: { ...CORS, 'MCP-Protocol-Version': negotiated } });
  return jsonRes(parsed.batch ? out : out[0], 200, { 'MCP-Protocol-Version': negotiated });
}

async function dispatch(m: Rpc, c: Ctx): Promise<Rpc> {
  const tier: Tier = c.actor.tier; const scopes: string[] = c.actor.tier === 'personal' ? c.actor.scopes : c.actor.tier === 'key' ? c.actor.scopes : [];
  const ok = (r: any) => okResult(m.id, r, c.v, c.site);
  switch (m.method) {
    case 'server/discover': return ok(discoverResult(c.site));
    case 'initialize': return ok(initializeResult(c.v, c.site));
    case 'ping': return ok({});
    case 'tools/list': return ok(toolsListResult(tier, scopes, c.v));
    case 'tools/call': return ok(await callTool(m, c, tier, scopes));
    case 'resources/list': return ok({ resources: resourcesFor(tier, scopes).map(r => ({ uri: r.uri, name: r.name, title: r.title, description: r.description, mimeType: r.mimeType })), ...cacheable(c.v, 600000, tier === 'anon' ? 'public' : 'private') });
    case 'resources/templates/list': return ok({ resourceTemplates: [], ...cacheable(c.v, 3600000, 'public') });
    case 'resources/read': {
      const uri = String(m.params?.uri || ''); const r = RESOURCES.find(x => x.uri === uri); if (!r) return errResult(m.id, ERR.INVALID_PARAMS, 'Resource not found', { uri });
      if (!r.tiers.includes(tier) || (r.pscope && !scopes.includes(r.pscope))) return errResult(m.id, ERR.INVALID_PARAMS, 'Resource not available at this authorization level', { uri });
      const text = await readResource(uri, c); return ok({ contents: [{ uri, mimeType: r.mimeType, text }], ...cacheable(c.v, 300000, r.pscope ? 'private' : 'public') });
    }
    case 'prompts/list': return ok({ prompts: PROMPTS, ...cacheable(c.v, 3600000, 'public') });
    case 'prompts/get': { const p = promptMessages(String(m.params?.name || ''), m.params?.arguments || {}); if (!p) return errResult(m.id, ERR.INVALID_PARAMS, 'Unknown prompt', { name: m.params?.name }); return ok(p); }
    default: return errResult(m.id, ERR.METHOD_NOT_FOUND, `Method not found: ${m.method}`);
  }
}

async function log(c: Ctx, tool: string, okFlag: boolean, extra: Record<string, unknown> = {}) {
  const meta: Record<string, unknown> = { transport: 'mcp', proto: c.v, tier: c.actor.tier, ip: c.ip, ...extra };
  if (c.actor.tier === 'personal') { meta.delegation = c.actor.del; meta.client = c.actor.client_name; meta.user = c.actor.user.id; } if (c.actor.tier === 'key') meta.key_name = c.actor.name;
  try { await c.db.from('portal_agent_log').insert({ key_id: null, tool, ok: okFlag, ms: Date.now() - c.t0, meta }); } catch { /* تجاهل */ }
}
async function personalQuota(c: Ctx): Promise<boolean> {
  if (c.actor.tier !== 'personal') return true; const { count } = await c.db.from('portal_agent_log').select('id', { count: 'exact', head: true }).contains('meta', { transport: 'mcp', delegation: c.actor.del }).gte('at', todayStart());
  if ((count || 0) < PERSONAL_DAILY_LIMIT) { if (!c.actor.direct) await c.db.from('portal_delegations').update({ last_used_at: new Date().toISOString(), uses: (count || 0) + 1 }).eq('id', c.actor.del); return true; } return false;
}
const delegateHeader = (c: Ctx) => c.actor.tier === 'personal' ? mintDelegate({ sub: c.actor.user.id, email: c.actor.user.email, name: c.actor.user.name, del: c.actor.del, client: c.actor.client, client_name: c.actor.client_name, scopes: c.actor.scopes }, c.site, process.env) : '';
const internal = (c: Ctx, path: string, init: { method?: string; body?: any } = {}) => {
  const h: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': c.ip, 'x-athar-transport': 'mcp', 'x-athar-proto': c.v };
  if (c.actor.tier === 'personal') { h[DELEGATE_HEADER] = delegateHeader(c); h['x-athar-client'] = encodeURIComponent(c.actor.client_name || '').slice(0, 200); /* ترويسات HTTP لا تقبل غير ASCII */ } if (c.actor.tier === 'key') h['x-agent-key'] = c.actor.key;
  return new Request(`${c.site}${path}`, { method: init.method || 'GET', headers: h, body: init.body !== undefined ? JSON.stringify(init.body) : undefined });
};
const asJson = async (res: Response | undefined) => { if (!res) return { success: false, error: 'no response' }; try { return await res.json(); } catch { return { success: false, error: `HTTP ${res.status}` }; } };

async function callTool(m: Rpc, c: Ctx, tier: Tier, scopes: string[]) {
  const name = String(m.params?.name || ''); const args = (m.params?.arguments && typeof m.params.arguments === 'object') ? m.params.arguments : {};
  const t = mcpToolByName(name); if (!t) return toolContent(`أداة غير معروفة: ${name} | Unknown tool`, { error: 'unknown_tool', name }, true);
  const allow = toolAllowed(t, tier, scopes); if (!allow.ok) { await log(c, name, false, { denied: allow.reason_en }); return toolContent(`${allow.reason_ar}\n${allow.reason_en}`, { error: 'not_authorized', reason: allow.reason_en }, true); }
  if (!(await personalQuota(c))) { await log(c, name, false, { denied: 'personal_limit' }); return toolContent('تجاوز التفويض حدّه اليومي | Daily limit for this authorization reached', { error: 'rate_limited' }, true); }
  if (t.kind === 'agent') {
    const j = await asJson(await agentPOST(internal(c, '/api/agent', { method: 'POST', body: { tool: name, args } })));
    if (!j?.success) return toolContent(`${j?.error || 'تعذّر التنفيذ'}${j?.error_en ? ` | ${j.error_en}` : ''}`, { error: j?.error_en || j?.error || 'failed' }, true);
    const human = !!j.human_in_the_loop; const notice = j.notice ? `${j.notice.ar}\n${j.notice.en}\n\n` : '';
    return toolContent(`${notice}${summarize(j.result)}`, { result: j.result, human_in_the_loop: human, notice: j.notice || null });
  }
  if (name === 'capability_trend') {
    const j = await asJson(await obsGET(internal(c, '/api/observatory'))); const snap = j?.snapshot; if (!snap) { await log(c, name, false); return toolContent('المرصد غير متاح الآن | Observatory unavailable', { error: 'unavailable' }, true); }
    const q = String(args.sector || '').trim().toLowerCase(); const dq = String(args.domain || '').trim().toLowerCase();
    const pick = (s: any) => ({ code: s.code, name_ar: s.name_ar, name_en: s.name_en, performance_index: { key: s.weather, ar: TREND_AR[s.weather] || s.weather, en: TREND_EN[s.weather] || s.weather }, delta_level: s.delta, activity_ratio: s.activity, capability_index: s.cell?.index ?? null, level: s.cell?.level ?? null, confidence: s.cell?.confidence ?? null, people_band: s.cell?.people ?? null, orgs_band: s.cell?.orgs ?? null, rising: (s.rising || []).map((g: any) => ({ skill: g.name_ar, code: g.code, delta: g.delta, why_ar: g.why_ar, why_en: g.why_en })), cooling: (s.cooling || []).map((g: any) => ({ skill: g.name_ar, code: g.code, delta: g.delta, why_ar: g.why_ar, why_en: g.why_en })), claim_vs_evidence: s.gap || null, suppressed: s.suppressed || [] });
    let sectors = (snap.sectors || []) as any[]; if (q) sectors = sectors.filter(s => String(s.code).toLowerCase() === q || String(s.name_ar || '').toLowerCase().includes(q) || String(s.name_en || '').toLowerCase().includes(q));
    let domains = (snap.domains || []) as any[]; if (dq) domains = domains.filter(d => String(d.domain || '').toLowerCase().includes(dq));
    const result = { computed_at: snap.computed_at, window: snap.window, totals: snap.totals, sectors: sectors.map(pick), domains: dq || !q ? domains.map(d => ({ domain: d.domain, performance_index: { key: d.weather, ar: TREND_AR[d.weather] || d.weather, en: TREND_EN[d.weather] || d.weather }, delta_level: d.delta, capability_index: d.cell?.index ?? null })) : [], method_ar: snap.method_ar, license: 'CC BY 4.0 — مرصد أَثَر للقدرة البشرية', page: `${c.site}/observatory` };
    await log(c, name, true, { sector: q || null, n: sectors.length }); if (q && !sectors.length) return toolContent(`لا قطاع بهذا الاسم «${args.sector}» — القطاعات المتاحة: ${(snap.sectors || []).map((s: any) => `${s.code} (${s.name_ar})`).join('، ')}`, { error: 'sector_not_found', available: (snap.sectors || []).map((s: any) => s.code) }, true);
    return toolContent(summarize(result), result);
  }
  if (name === 'org_charter_verify') {
    const q = new URLSearchParams(); if (args.code) q.set('code', String(args.code)); else if (args.org_name) q.set('org_name', String(args.org_name)); else q.set('public', '1');
    const j = await asJson(await charterGET(internal(c, `/api/org/charter?${q.toString()}`))); if (!j?.success) { await log(c, name, false); return toolContent('تعذّر القراءة | Unavailable', { error: 'unavailable' }, true); }
    const result = args.code || args.org_name ? { query: j.query, signed: !!j.signed, charter: j.charter, note_ar: j.note_ar, pledge_en: 'Time inside working hours · confidentiality (Chatham House) · council mirrors/deliberations never used in appraisal · no names requested', page: `${c.site}/councils#orgs` } : { version: j.version, signatories: (j.orgs || []).map((o: any) => ({ org_name: o.org_name, signed_at: o.signed_at, expires_at: o.expires_at, verify_url: o.verify_url })), clauses_ar: (j.clauses || []).map((x: any) => x.title), page: `${c.site}/councils#orgs` };
    await log(c, name, true, { q: String(args.code || args.org_name || 'all').slice(0, 80) }); return toolContent(summarize(result), result);
  }
  if (c.actor.tier !== 'personal') return toolContent('تحتاج تفويضًا شخصيًا', { error: 'not_authorized' }, true);
  if (name === 'my_wallet') {
    const j = await asJson(await pocketGET(internal(c, '/api/pocket?view=bundle'))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر قراءة المحفظة', { error: 'failed' }, true); }
    const result = { holder: { name: j.profile?.name, email: j.profile?.email }, issuer_did: j.did, did_document: j.did_url, levels: (j.levels || []).map((l: any) => ({ skill: l.name_ar, code: l.code, level: l.level, level_name_ar: ['', 'مبتدئ', 'متقدم مبتدئ', 'كفء', 'متمكن', 'خبير'][Math.round(l.level)] || null, approved: !!l.approved })), credentials: (j.credentials || []).map((x: any) => ({ title: x.title_ar, code: x.verify_code, issued_at: x.issued_at, url: `${c.site}/credential/${encodeURIComponent(x.verify_code)}` })), snapshot: j.snapshot ? { code: j.snapshot.code, issued_at: j.snapshot.issued_at, expires_at: j.snapshot.expires_at, verify_url: `${c.site}/verify/vc?code=${encodeURIComponent(j.snapshot.code)}` } : null, card_url: `${c.site}/me/card`, generated_at: j.generated_at };
    await log(c, name, true); return toolContent(summarize(result), result);
  }
  if (name === 'my_data_summary') {
    const j = await asJson(await vaultGET(internal(c, '/api/vault?view=summary'))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر قراءة الخزنة', { error: 'failed' }, true); }
    const result = { ...j.summary, note_ar: 'للتصدير أو التصحيح أو النسيان: صاحب الحساب من /me/data — الوكيل يقرأ فقط.' };
    await log(c, name, true); return toolContent(summarize(result), result);
  }
  if (name === 'my_journey') {
    const j = await asJson(await journeyGET(internal(c, '/api/journey?view=summary'))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر قراءة الرحلة', { error: 'failed' }, true); }
    const result = { ...j.summary, note_ar: 'الفصول مشتقة من أحداث مسجَّلة فقط. المشاركة والكتابة لصاحب الرحلة من /me/journey — الوكيل يقرأ فقط.' };
    await log(c, name, true); return toolContent(summarize(result), result);
  }
  if (name === 'my_council') {
    const j = await asJson(await councilGET(internal(c, '/api/councils?view=summary'))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر قراءة المجلس', { error: 'failed' }, true); }
    const result = { ...j.summary, confidentiality_ar: 'ما يُقال في المجلس يبقى فيه — لا تنقل محتواه إلى غير المستخدم.' };
    await log(c, name, true); return toolContent(summarize(result), result);
  }
  if (name === 'council_commit') {
    if (args.confirm !== true) return toolContent('يلزم تأكيد صريح من المستخدم (confirm: true) | Explicit user confirmation required', { error: 'confirm_required' }, true);
    const s = await asJson(await councilGET(internal(c, '/api/councils?view=summary'))); const cur = ((s?.summary?.councils || []) as any[]).find(h => h.current_case?.can_commit)?.current_case; 
    const hall = ((s?.summary?.councils || []) as any[]).find(h => h.current_case?.can_commit); if (!cur || !hall) { await log(c, name, false, { write: true }); return toolContent('لا قضية جارية من فتحك في طور المداولة | No open case authored by the user', { error: 'no_open_case' }, true); }
    const full = await asJson(await councilGET(internal(c, '/api/councils'))); const caseId = ((full?.halls || []) as any[]).find(h => h.council?.title_ar === hall.title_ar)?.current?.id; if (!caseId) { await log(c, name, false, { write: true }); return toolContent('تعذّر تحديد القضية', { error: 'failed' }, true); }
    const j = await asJson(await councilPOST(internal(c, '/api/councils', { method: 'POST', body: { action: 'commit', case_id: caseId, commitment: String(args.commitment || ''), confirm: true } })));
    if (!j?.success) { await log(c, name, false, { write: true }); return toolContent(j?.error || 'تعذّر', { error: j?.error || 'failed' }, true); }
    const result = { committed: true, case_title: cur.title_ar, commitment: j.case?.commitment_ar, return_due_at: j.return_due_at, scribe_summary: j.scribe?.summary_ar || null, page: `${c.site}/me/council` };
    await log(c, name, true, { write: true }); return toolContent(summarize(result), result);
  }
  if (name === 'my_daily') {
    const response = String(args.response || '').trim();
    const j = response ? await asJson(await dailyPOST(internal(c, '/api/daily', { method: 'POST', body: { response }}))) : await asJson(await dailyGET(internal(c, '/api/daily')));
    if (!j?.success) { await log(c, name, false, { write: !!response }); return toolContent(j?.error || 'تعذّر', { error: j?.error || 'failed' }, true); }
    const result = response ? { submitted: !!j.saved, already_answered_today: !!j.already, evaluation: j.evaluation, case: j.case, streak: j.streak, page: `${c.site}/daily` } : { day: j.day, case: j.case, event: j.event || null, answered_today: !!j.mine, my_response: j.mine?.response || null, my_evaluation: j.mine?.evaluation || null, streak: j.streak || 0, crowd_line: j.crowd_line || null, page: `${c.site}/daily` };
    await log(c, name, true, { write: !!response }); return toolContent(summarize(result), result);
  }
  if (name === 'my_missions') {
    const j = await asJson(await missionsGET(internal(c, '/api/missions'))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر', { error: 'failed' }, true); }
    const skills = new Map(((j.skills || []) as any[]).map(s => [s.id, s.name_ar]));
    const result = { missions: ((j.missions || []) as any[]).map(x => ({ id: x.id, title: x.title_ar, brief: x.brief_ar, status: x.status, due_at: x.due_at, submitted_at: x.submitted_at, confirmed_at: x.confirmed_at, evidence_mode: x.evidence_mode, skills: (x.skills || []).map((id: string) => skills.get(id) || id), supervisor: x.supervisor_name || null, url: x.token ? `${c.site}/m/${x.token}` : null })), stats: j.stats || null, page: `${c.site}/missions` };
    await log(c, name, true, { n: result.missions.length }); return toolContent(summarize(result), result);
  }
  if (name === 'issue_snapshot') {
    if (args.confirm !== true) return toolContent('يلزم تأكيد صريح من المستخدم (confirm: true) | Explicit user confirmation required', { error: 'confirm_required' }, true);
    const j = await asJson(await vcPOST(internal(c, '/api/vc', { method: 'POST', body: { action: 'snapshot' }}))); if (!j?.success) { await log(c, name, false); return toolContent(j?.error || 'تعذّر الإصدار', { error: j?.error || 'failed' }, true); }
    const code = j.code || j.issuance?.code || j.snapshot?.code || null; const result = { issued: true, code, verify_url: code ? `${c.site}/verify/vc?code=${encodeURIComponent(code)}` : null, document_url: code ? `${c.site}/api/vc?code=${encodeURIComponent(code)}` : null, valid_days: 90, card_url: `${c.site}/me/card` };
    await log(c, name, true, { code }); return toolContent(summarize(result), result);
  }
  return toolContent('أداة غير مدعومة', { error: 'unsupported' }, true);
}

async function readResource(uri: string, c: Ctx): Promise<string> {
  if (uri === 'athar://lexicon') return LEXICON_MD;
  if (uri === 'athar://observatory/latest') { const j = await asJson(await obsGET(internal(c, '/api/observatory'))); return JSON.stringify({ computed_at: j?.computed_at, snapshot: j?.snapshot, license: j?.license, attribution: j?.attribution }); }
  if (uri === 'athar://programs/open') { const j = await asJson(await agentPOST(internal(c, '/api/agent', { method: 'POST', body: { tool: 'discover_programs', args: { limit: 20 } } }))); return JSON.stringify(j?.result || { programs: [] }); }
  if (uri === 'athar://did') { const r = await didGET(internal(c, '/.well-known/did.json')); return await r.text(); }
  if (uri === 'athar://me/wallet') { const j = await asJson(await pocketGET(internal(c, '/api/pocket?view=bundle'))); return JSON.stringify(j); }
  return '{}';
}
