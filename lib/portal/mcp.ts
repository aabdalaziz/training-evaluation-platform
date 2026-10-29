// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — خادم MCP «سفارة أَثَر» (P20): نواة البروتوكول — دوال نقية قابلة للاختبار (بلا شبكة ولا قاعدة بيانات)
 *  • JSON-RPC 2.0 عبر Streamable HTTP (POST واحد لكل رسالة، الرد JSON) — بلا جلسات
 *  • المراجعة الحالية 2026-07-28: server/discover · النسخة في _meta · resultType · ttlMs/cacheScope · ترتيب ثابت للأدوات
 *  • توافق خلفي: initialize/ping/MCP-Protocol-Version للعملاء على 2025-03-26 … 2025-11-25
 *  • ثلاث طبقات: anon (اكتشاف/تحقق/مؤشر الأداء) · key (مفتاح جهة atk_) · personal (تفويض OAuth بنطاقات)
 */
import { AGENT_TOOLS } from './agents';
import type { AgentTool } from './agents';
import type { PScope } from './oauth';

export const MCP_VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'] as const;
export type McpVersion = typeof MCP_VERSIONS[number];
export const MCP_LATEST: McpVersion = '2026-07-28';
export const MCP_LEGACY_DEFAULT: McpVersion = '2025-06-18';
export const META = { version: 'io.modelcontextprotocol/protocolVersion', clientCaps: 'io.modelcontextprotocol/clientCapabilities', clientInfo: 'io.modelcontextprotocol/clientInfo', serverInfo: 'io.modelcontextprotocol/serverInfo' } as const;
export const SERVER_VERSION = '20.0.0';
export const serverInfo = (site: string) => ({ name: 'athar', title: 'أَثَر · Athar (TRACE)', version: SERVER_VERSION, websiteUrl: site });
export const ERR = { PARSE: -32700, INVALID_REQUEST: -32600, METHOD_NOT_FOUND: -32601, INVALID_PARAMS: -32602, INTERNAL: -32603, UNSUPPORTED_VERSION: -32600 } as const;

export type Tier = 'anon' | 'key' | 'personal';
export type McpTool = { name: string; title: string; description: string; inputSchema: any; outputSchema?: any; annotations: { title?: string; readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean; openWorldHint: boolean }; tiers: Tier[]; scope?: string; pscope?: PScope; kind: 'agent' | 'native' | 'personal' };

const ANON_AGENT = ['discover_programs', 'verify_credential'];
const prop = (type: string, description: string, extra: Record<string, any> = {}) => ({ type, description, ...extra });
function agentTool(t: AgentTool): McpTool {
  const properties: Record<string, any> = {}; for (const p of t.params) properties[p.name] = p.type === 'array' ? prop('array', `${p.desc_en} — ${p.desc_ar}`, { items: { type: 'object' } }) : prop(p.type, `${p.desc_en} — ${p.desc_ar}`);
  const tiers: Tier[] = ANON_AGENT.includes(t.name) ? ['anon', 'key', 'personal'] : ['key'];
  return { name: t.name, title: t.title_en, description: `${t.desc_en}\n${t.desc_ar}${t.writes ? '\nWrites create a request that a human at Athar must approve — never a binding commitment. | كل كتابة = طلب ينتظر اعتماد إنسان.' : ''}`, inputSchema: { type: 'object', properties, required: t.params.filter(p => p.required).map(p => p.name), additionalProperties: false }, annotations: { title: t.title_en, readOnlyHint: !t.writes, destructiveHint: false, idempotentHint: !t.writes, openWorldHint: false }, tiers, scope: t.scope, kind: 'agent' };
}
export const NATIVE_TOOLS: McpTool[] = [
  { name: 'capability_trend', title: 'Sector performance index', description: 'مؤشر الأداء لقطاع أو مجال من مرصد أَثَر للقدرة البشرية: الاتجاه (صاعد/مستقر/متراجع)، مؤشر أَثَر للقدرة 0–100، الإشارات المبكرة — من أدلة أداء حقيقية مجهولة الهوية (k ≥ 5 أشخاص و≥ 2 جهة).\nPerformance index of a sector/domain from the Athar Human Capability Observatory: trend (rising/stable/declining), capability index 0–100, early signals — anonymized real performance evidence.', inputSchema: { type: 'object', properties: { sector: prop('string', 'Sector code or Arabic/English name (e.g. gov, health, edu_higher). Omit for all sectors. — رمز القطاع أو اسمه'), domain: prop('string', 'Skill domain name — اسم المجال (اختياري)') }, additionalProperties: false }, annotations: { title: 'Sector performance index', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, tiers: ['anon', 'key', 'personal'], kind: 'native' },
];
export const PERSONAL_TOOLS: McpTool[] = [
  { name: 'my_wallet', title: 'My sovereign wallet', description: 'محفظتي السيادية: مستوياتي المعتمدة، شهاداتي، آخر لقطة قدرة موقَّعة ورابط تحققها، وهوية المُصدِر (did:web).\nThe user’s own wallet: approved skill levels, credentials, latest signed capability snapshot with verify URL, issuer DID.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { title: 'My wallet', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, tiers: ['personal'], pscope: 'wallet:read', kind: 'personal' },
  { name: 'my_daily', title: 'Today’s case with me', description: 'موقف اليوم (كل يوم بناء): بلا response يعيد الموقف وسؤاله وهل أجبتُ؛ مع response يرسل ردّي باسمي (مرة واحدة يوميًا) ويعيد مرآة الأداء. اكتب الرد كما يصوغه المستخدم نفسه — لا تختلق عنه.\nToday’s situation: without `response` returns the case and whether the user already answered; with `response` submits the user’s own answer (once per day) and returns the performance mirror. Submit only what the user actually wrote.', inputSchema: { type: 'object', properties: { response: prop('string', 'The user’s own handling of the situation (≥ 40 chars). Omit to read only. — ردّ المستخدم بنصه', { minLength: 1, maxLength: 4000 }) }, additionalProperties: false }, annotations: { title: 'Today’s case', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }, tiers: ['personal'], pscope: 'daily:write', kind: 'personal' },
  { name: 'my_missions', title: 'My workflow missions', description: 'مهامي في قلب العمل: المفتوحة ومواعيدها وما ينقصها من أدلة، والمنجزة ونتيجتها.\nThe user’s workflow missions: open ones with due dates and missing evidence, and completed ones with outcome.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { title: 'My missions', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, tiers: ['personal'], pscope: 'missions:read', kind: 'personal' },
  { name: 'issue_snapshot', title: 'Issue a signed capability snapshot', description: 'يُصدر لقطة قدرة موقَّعة Ed25519 بمستويات المستخدم اليوم (صالحة 90 يومًا) ويعيد رمزها ورابط التحقق. استخدمه فقط حين يطلب المستخدم ذلك صراحة.\nIssues a signed (Ed25519) capability snapshot of the user’s current levels (valid 90 days) and returns its code and verify URL. Only when the user explicitly asks.', inputSchema: { type: 'object', properties: { confirm: prop('boolean', 'Must be true — the user explicitly asked to issue a snapshot. — تأكيد صريح') }, required: ['confirm'], additionalProperties: false }, annotations: { title: 'Issue snapshot', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }, tiers: ['personal'], pscope: 'snapshot:issue', kind: 'personal' },
];
/** كل الأدوات بترتيب ثابت (لصالح ذاكرة النموذج وذاكرة العملاء) */
export const ALL_MCP_TOOLS: McpTool[] = [...AGENT_TOOLS.map(agentTool), ...NATIVE_TOOLS, ...PERSONAL_TOOLS];
export const mcpToolByName = (name: string) => ALL_MCP_TOOLS.find(t => t.name === name) || null;
export function toolsFor(tier: Tier, scopes: string[] = []): McpTool[] {
  return ALL_MCP_TOOLS.filter(t => { if (!t.tiers.includes(tier)) return false; if (tier === 'personal' && t.pscope) return scopes.includes(t.pscope); return true; });
}
export function toolAllowed(t: McpTool, tier: Tier, scopes: string[] = []): { ok: true } | { ok: false; reason_ar: string; reason_en: string } {
  if (!t.tiers.includes(tier)) {
    if (t.kind === 'personal') return { ok: false, reason_ar: 'هذه أداة شخصية — تحتاج تفويضًا من المستخدم عبر OAuth (انظر /.well-known/oauth-protected-resource/mcp)', reason_en: 'Personal tool — requires user authorization via OAuth (see /.well-known/oauth-protected-resource/mcp)' };
    return { ok: false, reason_ar: 'هذه الأداة تحتاج مفتاح وكيل جهة (atk_…) — اطلبه عبر /agents', reason_en: 'This tool requires an organization agent key (atk_…) — see /agents' };
  }
  if (tier === 'personal' && t.pscope && !scopes.includes(t.pscope)) return { ok: false, reason_ar: `التفويض لا يشمل «${t.pscope}» — اطلب من المستخدم إعادة التفويض بهذا النطاق`, reason_en: `Grant lacks scope "${t.pscope}" — ask the user to re-authorize with it` };
  return { ok: true };
}

// ---------------------------------------------------------------- الموارد والمطالبات
export type McpResource = { uri: string; name: string; title: string; description: string; mimeType: string; tiers: Tier[]; pscope?: PScope };
export const RESOURCES: McpResource[] = [
  { uri: 'athar://observatory/latest', name: 'observatory_latest', title: 'مرصد القدرة البشرية — آخر لقطة', description: 'Latest anonymized observatory snapshot (sectors, performance index, signals). CC BY 4.0.', mimeType: 'application/json', tiers: ['anon', 'key', 'personal'] },
  { uri: 'athar://programs/open', name: 'programs_open', title: 'البرامج المفتوحة للتسجيل', description: 'Public programs currently open for registration.', mimeType: 'application/json', tiers: ['anon', 'key', 'personal'] },
  { uri: 'athar://did', name: 'issuer_did', title: 'هوية المُصدِر did:web', description: 'Athar issuer DID document (Ed25519 verification keys).', mimeType: 'application/json', tiers: ['anon', 'key', 'personal'] },
  { uri: 'athar://lexicon', name: 'lexicon', title: 'معجم أَثَر', description: 'Official vs narrative terms used across Athar (Arabic).', mimeType: 'text/markdown', tiers: ['anon', 'key', 'personal'] },
  { uri: 'athar://me/wallet', name: 'my_wallet', title: 'محفظتي — نسخة للقراءة', description: 'The authorized user’s wallet bundle (same as my_wallet tool).', mimeType: 'application/json', tiers: ['personal'], pscope: 'wallet:read' },
];
export const resourcesFor = (tier: Tier, scopes: string[] = []) => RESOURCES.filter(r => r.tiers.includes(tier) && (!r.pscope || scopes.includes(r.pscope)));
export const LEXICON_MD = `# معجم أَثَر (مختصر للوكلاء)
- **أَثَر (Athar · TRACE)**: بوابة التعليم والتدريب والتطوير — التدريب ما بعد الذكاء الاصطناعي: نبني القدرة ونثبت الأثر.
- **الذاكرة الحية**: قاعدة الأدلة المؤسسية؛ كل إجابة عن «أي برنامج أثبت رفع مهارة» تأتي منها لا من الكتالوج.
- **محفظة القدرة السيادية**: شهادات OB 3.0 / VC 2.0 موقَّعة Ed25519 (eddsa-jcs-2022)، هوية المُصدِر did:web، تحقق مستقل في /verify/vc.
- **لقطة قدرة**: وثيقة موقَّعة بمستويات الشخص اليوم، صالحة 90 يومًا، رمزها ATH-S-XXXX-XXXX.
- **مرصد أَثَر للقدرة البشرية**: اتجاه القدرة في القطاعات من أدلة حقيقية مجهولة الهوية؛ **مؤشر الأداء** (صاعد/مستقر/متراجع) و**مؤشر أَثَر للقدرة** 0–100؛ قاعدة k ≥ 5 أشخاص و≥ 2 جهة.
- **موقف اليوم (كل يوم بناء)**: موقف مهني واحد يوميًا؛ المستخدم يكتب كيف يتصرّف؛ «مرآة الأداء» تصف أداءه ولا تحكم على شخصه.
- **مهمات في قلب العمل**: أدلة نقل حقيقية من مكان العمل يؤكدها مدير/زميل.
- **القاعدة الذهبية**: الذكاء الاصطناعي يقترح، والإنسان يعتمد — لا التزام مالي أو مقعد دون توقيع إنسان.
`;

export type McpPrompt = { name: string; title: string; description: string; arguments: { name: string; description: string; required?: boolean }[] };
export const PROMPTS: McpPrompt[] = [
  { name: 'recommend_program', title: 'رشّح لي برنامجًا بدليل أثر', description: 'Evidence-based program recommendation for a skill (uses skill_fit + discover_programs).', arguments: [{ name: 'skill', description: 'المهارة المطلوبة', required: true }, { name: 'sector', description: 'القطاع (اختياري)' }] },
  { name: 'verify_before_hiring', title: 'تحقق من شهادة قبل التوظيف', description: 'Verify an Athar credential or snapshot code and explain what it proves.', arguments: [{ name: 'code', description: 'رمز الشهادة أو اللقطة ATH-…', required: true }] },
  { name: 'sector_brief', title: 'موجز مؤشر الأداء لمجلس الإدارة', description: 'Board-ready brief on a sector’s performance index from the observatory.', arguments: [{ name: 'sector', description: 'رمز القطاع أو اسمه', required: true }] },
  { name: 'daily_coach', title: 'درّبني على موقف اليوم', description: 'Coach the user through today’s case without answering for them (personal: daily:write).', arguments: [] },
];
export function promptMessages(name: string, args: Record<string, string> = {}): { description: string; messages: { role: 'user'; content: { type: 'text'; text: string } }[] } | null {
  const a = (k: string) => String(args[k] || '').trim();
  if (name === 'recommend_program') return { description: 'ترشيح بدليل', messages: [{ role: 'user', content: { type: 'text', text: `أريد رفع مهارة «${a('skill') || '…'}»${a('sector') ? ` في قطاع ${a('sector')}` : ''}. استخدم أداة skill_fit أولًا لتعرف أي برنامج في أَثَر أثبت رفع هذه المهارة بالأدلة (عدد الأدلة والأشخاص ونسبة النقل إلى العمل)، ثم discover_programs لمعرفة المفتوح للتسجيل الآن. قدّم توصية واحدة مع سبب مبني على الدليل لا على الوصف، واذكر صراحة إن كان الدليل ضعيفًا.` } }] };
  if (name === 'verify_before_hiring') return { description: 'تحقق', messages: [{ role: 'user', content: { type: 'text', text: `تحقق من الرمز ${a('code') || 'ATH-…'} بأداة verify_credential. اشرح لي: هل هي سارية؟ ما الذي تثبته بالضبط (مهارات/مستويات/ساعات)؟ وما الذي لا تثبته؟ وأين أتحقق مستقلًا من التوقيع (/verify/vc).` } }] };
  if (name === 'sector_brief') return { description: 'موجز', messages: [{ role: 'user', content: { type: 'text', text: `استخدم capability_trend للقطاع «${a('sector') || '…'}» واكتب موجزًا من 5 أسطر لمجلس الإدارة: الاتجاه (مؤشر الأداء)، مؤشر أَثَر للقدرة، أهم إشارتين مبكرتين مع «لماذا»، وتحفّظ واحد عن حدود البيانات (قاعدة k والتجهيل).` } }] };
  if (name === 'daily_coach') return { description: 'تدريب', messages: [{ role: 'user', content: { type: 'text', text: `اقرأ موقف اليوم بأداة my_daily (بلا response). لا تجب عني. اطرح عليّ سؤالين يساعدانني على التفكير، ثم حين أكتب تصرّفي بنصي أرسله كما هو عبر my_daily مع response، واشرح لي مرآة الأداء بلغة بشرية: ما ظهر، ما لم يظهر، وخطوة اليوم.` } }] };
  return null;
}

// ---------------------------------------------------------------- JSON-RPC
export type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method?: string; params?: any; result?: any; error?: any };
export function parseRpc(body: unknown): { ok: true; msgs: Rpc[]; batch: boolean } | { ok: false; code: number; message: string } {
  const arr = Array.isArray(body) ? body : [body]; if (!arr.length) return { ok: false, code: ERR.INVALID_REQUEST, message: 'Empty batch' };
  const msgs: Rpc[] = [];
  for (const m of arr) { if (!m || typeof m !== 'object' || (m as any).jsonrpc !== '2.0') return { ok: false, code: ERR.INVALID_REQUEST, message: 'Expected JSON-RPC 2.0 message' }; const x = m as Rpc; if (x.method !== undefined && typeof x.method !== 'string') return { ok: false, code: ERR.INVALID_REQUEST, message: 'method must be a string' }; if (x.id !== undefined && x.id !== null && typeof x.id !== 'string' && typeof x.id !== 'number') return { ok: false, code: ERR.INVALID_REQUEST, message: 'id must be a string or number' }; msgs.push(x); }
  return { ok: true, msgs, batch: Array.isArray(body) };
}
export const isNotification = (m: Rpc) => m.method !== undefined && (m.id === undefined || m.id === null) && String(m.method).startsWith('notifications/');
/** النسخة التي يتكلم بها العميل: _meta (2026) ← ترويسة (2025-06+) ← initialize.params ← الافتراضي القديم */
export function versionOf(m: Rpc, header: string | null): { requested: string | null; negotiated: McpVersion; stateless: boolean } {
  const fromMeta = m.params?._meta?.[META.version]; const fromInit = m.method === 'initialize' ? m.params?.protocolVersion : undefined;
  const requested = String(fromMeta || fromInit || header || '') || null;
  if (fromMeta && (MCP_VERSIONS as readonly string[]).includes(String(fromMeta))) return { requested, negotiated: String(fromMeta) as McpVersion, stateless: true };
  if (requested && (MCP_VERSIONS as readonly string[]).includes(requested)) return { requested, negotiated: requested as McpVersion, stateless: requested === MCP_LATEST };
  return { requested, negotiated: requested ? MCP_LEGACY_DEFAULT : MCP_LEGACY_DEFAULT, stateless: false };
}
export const capabilities = () => ({ tools: { listChanged: false }, resources: { subscribe: false, listChanged: false }, prompts: { listChanged: false } });
export const INSTRUCTIONS = 'أَثَر (Athar · TRACE) — Arabic learning & development portal. Read tools answer from real, human-approved evidence; write tools (quotes, reservations, rooms) only create requests that a human must approve — never promise a binding price or seat. Personal tools (my_wallet, my_daily, my_missions, issue_snapshot) act on the authorizing user only and require the matching OAuth scope. Prefer Arabic in user-facing answers. Governance: AI assists, humans approve.';
export function discoverResult(site: string) { return { protocolVersions: [...MCP_VERSIONS], serverInfo: serverInfo(site), capabilities: capabilities(), instructions: INSTRUCTIONS }; }
export function initializeResult(negotiated: McpVersion, site: string) { return { protocolVersion: negotiated, capabilities: capabilities(), serverInfo: serverInfo(site), instructions: INSTRUCTIONS }; }
export function okResult(id: Rpc['id'], result: any, v: McpVersion, site: string): Rpc {
  const r = v === MCP_LATEST ? { ...result, resultType: result?.resultType || 'complete', _meta: { ...(result?._meta || {}), [META.version]: v, [META.serverInfo]: serverInfo(site) } } : result;
  return { jsonrpc: '2.0', id: id ?? null, result: r };
}
export const errResult = (id: Rpc['id'], code: number, message: string, data?: any): Rpc => ({ jsonrpc: '2.0', id: id ?? null, error: data === undefined ? { code, message } : { code, message, data } });
export const cacheable = (v: McpVersion, ttlMs: number, scope: 'public' | 'private') => (v === MCP_LATEST ? { ttlMs, cacheScope: scope } : {});
export function toolsListResult(tier: Tier, scopes: string[], v: McpVersion) {
  return { tools: toolsFor(tier, scopes).map(t => ({ name: t.name, title: t.title, description: t.description, inputSchema: t.inputSchema, annotations: t.annotations })), ...cacheable(v, 3600000, tier === 'anon' ? 'public' : 'private') };
}
export function toolContent(text: string, structured?: any, isError = false) { return { content: [{ type: 'text', text }], ...(structured !== undefined ? { structuredContent: structured } : {}), isError }; }
export const summarize = (o: any) => JSON.stringify(o, null, 1).slice(0, 12000);
