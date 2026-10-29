// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P20 — «سفارة أَثَر» (MCP): الرموز الموقّعة ومددها، PKCE، التحقق من معاملات التفويض،
//                 بيانات الاكتشاف (RFC 8414/9728)، تفاوض نسخ البروتوكول، طبقات الأدوات والموارد، المطالبات، و«مؤشر الأداء».
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ACCESS_TTL_S, CODE_TTL_S, DELEGATE_HEADER, DELEGATE_TTL_S, PERSONAL_DAILY_LIMIT, PERSONAL_SCOPES, PSCOPE_LABEL, REFRESH_TTL_S, asMetadata, b64u, delegateFromHeaders, isOauthToken, mcpResource, mintDelegate, parseScopes, pkceOk, prmMetadata, redirectOk, redirectWith, secretFromEnv, signToken, validateAuthorizeParams, verifyToken, wwwAuthenticate } from '../lib/portal/oauth';
import { ALL_MCP_TOOLS, MCP_LATEST, MCP_VERSIONS, META, PROMPTS, RESOURCES, cacheable, discoverResult, errResult, initializeResult, isNotification, mcpToolByName, okResult, parseRpc, promptMessages, resourcesFor, toolAllowed, toolsFor, toolsListResult, versionOf } from '../lib/portal/mcp';
import { WEATHER_LABEL, weatherOf } from '../lib/portal/observatory';

const SITE = 'https://athar-portal.vercel.app'; const ENV = { VC_SIGNING_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=' };
const NOW = Date.parse('2026-10-29T09:00:00Z');
const claims = (typ: 'at' | 'rt' | 'dg', exp: number) => ({ typ, sub: 'u1', email: 'a@b.sa', name: 'أحمد', del: 'd1', client: 'https://claude.ai/.well-known/oauth-client', client_name: 'Claude', scopes: ['wallet:read' as const], aud: mcpResource(SITE), iss: SITE, iat: Math.floor(NOW / 1000), exp });

test('P20 الرموز: توقيع HMAC وتحقق بالنوع والمدة، وأي عبث يُسقط الرمز', () => {
  const sec = secretFromEnv(ENV); const t = signToken(claims('at', Math.floor(NOW / 1000) + ACCESS_TTL_S), sec);
  assert.ok(isOauthToken(t), 'شكل الرمز athar_at.<payload>.<sig>');
  assert.ok(t.startsWith('athar_at.'), 'بادئة نوع الرمز');
  const c = verifyToken(t, sec, NOW + 1000, 'at'); assert.ok(c, 'يتحقق في المدة'); assert.equal(c!.email, 'a@b.sa', 'المطالبات تعود');
  assert.equal(verifyToken(t, sec, NOW + (ACCESS_TTL_S + 5) * 1000, 'at'), null, 'ينتهي بعد ساعة');
  assert.equal(verifyToken(t, sec, NOW, 'rt'), null, 'النوع الخطأ يُرفض');
  assert.equal(verifyToken(t.slice(0, -2) + 'xx', sec, NOW, 'at'), null, 'توقيع معدَّل يُرفض');
  assert.equal(verifyToken(t, secretFromEnv({ VC_SIGNING_KEY: 'CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg=' }), NOW, 'at'), null, 'سرّ مختلف يُرفض');
  assert.equal(ACCESS_TTL_S, 3600, 'وصول ساعة'); assert.equal(REFRESH_TTL_S, 30 * 86400, 'تجديد 30 يومًا'); assert.equal(CODE_TTL_S, 300, 'كود 5 دقائق'); assert.equal(DELEGATE_TTL_S, 60, 'تفويض داخلي 60 ث'); assert.equal(PERSONAL_DAILY_LIMIT, 500, 'حد شخصي 500/يوم');
});

test('P20 التفويض الداخلي: يُصك بمدة قصيرة ويُقرأ من الترويسة فقط حين يكون صالحًا', () => {
  const dg = mintDelegate({ sub: 'u1', email: 'a@b.sa', name: 'أحمد', del: 'd1', client: 'cid', client_name: 'Claude', scopes: ['wallet:read', 'daily:write'] }, SITE, ENV, NOW);
  const h = new Headers({ [DELEGATE_HEADER]: dg });
  const d = delegateFromHeaders(h, ENV, NOW + 5000); assert.ok(d, 'يُقرأ'); assert.equal(d!.client, 'Claude', 'اسم العميل للعرض'); assert.deepEqual(d!.scopes, ['wallet:read', 'daily:write'], 'النطاقات');
  assert.equal(delegateFromHeaders(h, ENV, NOW + 61_000), null, 'ينتهي بعد 60 ثانية');
  assert.equal(delegateFromHeaders(new Headers(), ENV, NOW), null, 'بلا ترويسة → لا تفويض');
  const at = signToken(claims('at', Math.floor(NOW / 1000) + 3600), secretFromEnv(ENV));
  assert.equal(delegateFromHeaders(new Headers({ [DELEGATE_HEADER]: at }), ENV, NOW), null, 'رمز الوصول لا يصلح كتفويض داخلي');
});

test('P20 PKCE S256 والنطاقات وروابط العودة', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'; const challenge = b64u(createHash('sha256').update(verifier).digest());
  assert.ok(pkceOk(verifier, challenge), 'التحدي يطابق'); assert.ok(!pkceOk(verifier + 'x', challenge), 'محقِّق مختلف يفشل');
  assert.deepEqual(parseScopes('wallet:read bogus daily:write wallet:read'), ['wallet:read', 'daily:write'], 'تصفية وإزالة تكرار');
  assert.deepEqual(parseScopes(''), [], 'فارغ'); assert.equal(PERSONAL_SCOPES.length, 5, 'خمسة نطاقات شخصية (P23: council:write)');
  for (const s of PERSONAL_SCOPES) assert.ok(PSCOPE_LABEL[s].ar.length > 3 && PSCOPE_LABEL[s].detail_ar.length > 10, `تسمية عربية وتفصيل: ${s}`);
  assert.equal(PSCOPE_LABEL['snapshot:issue'].risk, 'high', 'إصدار لقطة = خطورة عالية');
  assert.ok(redirectOk('https://claude.ai/api/mcp/auth_callback'), 'https مقبول'); assert.ok(redirectOk('http://localhost:3000/cb'), 'localhost مقبول'); assert.ok(redirectOk('http://127.0.0.1:8080/cb'), 'loopback مقبول');
  assert.ok(!redirectOk('http://evil.example/cb'), 'http غير محلي مرفوض'); assert.ok(!redirectOk('javascript:alert(1)'), 'مخطط غريب مرفوض');
  const u = redirectWith('https://x.y/cb?keep=1', { code: 'abc', state: 's t', iss: SITE, empty: null });
  assert.ok(u.includes('keep=1') && u.includes('code=abc') && u.includes('state=s+t') && u.includes('iss=') && !u.includes('empty'), 'المعاملات تُضاف مع الحفاظ على القديم');
});

test('P20 معاملات التفويض: كود + PKCE + نطاق + resource (RFC 8707)', () => {
  const good = { response_type: 'code', client_id: 'https://claude.ai/.well-known/oauth-client', redirect_uri: 'https://claude.ai/cb', scope: 'wallet:read missions:read', state: 'xyz', code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', code_challenge_method: 'S256', resource: `${SITE}/mcp` };
  const r = validateAuthorizeParams(good, SITE); assert.ok(r.ok, 'المعاملات الصحيحة تُقبل'); if (r.ok) { assert.deepEqual(r.p.scopes, ['wallet:read', 'missions:read'], 'النطاقات'); assert.equal(r.p.resource, `${SITE}/mcp`, 'المورد'); }
  assert.equal((validateAuthorizeParams({ ...good, code_challenge_method: 'plain' }, SITE) as any).error, 'invalid_request', 'PKCE plain مرفوض');
  assert.equal((validateAuthorizeParams({ ...good, code_challenge: undefined }, SITE) as any).error, 'invalid_request', 'بلا تحدٍ مرفوض');
  assert.equal((validateAuthorizeParams({ ...good, response_type: 'token' }, SITE) as any).error, 'unsupported_response_type', 'implicit مرفوض');
  assert.equal((validateAuthorizeParams({ ...good, scope: 'admin' }, SITE) as any).error, 'invalid_scope', 'نطاق غير معروف مرفوض');
  assert.equal((validateAuthorizeParams({ ...good, resource: 'https://other.example/mcp' }, SITE) as any).error, 'invalid_target', 'مورد غريب مرفوض');
  assert.ok(validateAuthorizeParams({ ...good, resource: undefined }, SITE).ok, 'بلا resource مقبول (توافق)');
});

test('P20 الاكتشاف: RFC 8414 + RFC 9728 + WWW-Authenticate', () => {
  const as = asMetadata(SITE); assert.equal(as.issuer, SITE, 'المُصدر = الموقع'); assert.equal(as.authorization_endpoint, `${SITE}/oauth/authorize`, 'نقطة التفويض'); assert.equal(as.token_endpoint, `${SITE}/oauth/token`, 'نقطة الرمز');
  assert.equal(as.registration_endpoint, `${SITE}/oauth/register`, 'التسجيل الديناميكي'); assert.ok(as.code_challenge_methods_supported.includes('S256'), 'S256'); assert.ok(as.grant_types_supported.includes('refresh_token'), 'التجديد');
  assert.ok((as as any).client_id_metadata_document_supported === true, 'CIMD معلَن'); assert.ok(as.scopes_supported.includes('daily:write'), 'النطاقات معلَنة');
  const prm = prmMetadata(SITE); assert.equal(prm.resource, `${SITE}/mcp`, 'المورد المحمي'); assert.deepEqual(prm.authorization_servers, [SITE], 'خادم التفويض = الموقع'); assert.ok(prm.bearer_methods_supported.includes('header'), 'Bearer في الترويسة');
  const wa = wwwAuthenticate(SITE, 'invalid_token', 'expired'); assert.ok(wa.startsWith('Bearer resource_metadata="') && wa.includes('/.well-known/oauth-protected-resource/mcp') && wa.includes('error="invalid_token"'), 'ترويسة WWW-Authenticate تدل على بيانات المورد');
  assert.ok(/^[\x00-\x7F]*$/.test(wa), 'ترويسة ASCII فقط');
});

test('P20 البروتوكول: تفاوض النسخ (2026-07-28 بلا جلسة؛ القديمة عبر initialize) وتحليل JSON-RPC', () => {
  assert.equal(MCP_LATEST, '2026-07-28', 'الأحدث'); assert.equal(MCP_VERSIONS.length, 4, 'أربع نسخ مدعومة');
  const v1 = versionOf({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: { _meta: { [META.version]: '2026-07-28' } } }, null); assert.equal(v1.negotiated, '2026-07-28', 'من _meta'); assert.equal(v1.stateless, true, 'بلا حالة');
  const v2 = versionOf({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } }, null); assert.equal(v2.negotiated, '2025-06-18', 'من initialize'); assert.equal(v2.stateless, false, 'قديمة = مصافحة');
  const v3 = versionOf({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, '2025-11-25'); assert.equal(v3.negotiated, '2025-11-25', 'من ترويسة MCP-Protocol-Version');
  const v4 = versionOf({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, null); assert.equal(v4.negotiated, '2025-06-18', 'الافتراضي للعملاء القدامى بلا ترويسة');
  const p = parseRpc({ jsonrpc: '2.0', id: 7, method: 'tools/list' }); assert.ok(p.ok && !p.batch && p.msgs.length === 1, 'رسالة واحدة');
  const b = parseRpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }]); assert.ok(b.ok && b.batch && b.msgs.length === 2, 'دفعة');
  assert.ok(b.ok && isNotification(b.msgs[1]) && !isNotification(b.msgs[0]), 'تمييز الإشعار');
  assert.ok(!parseRpc('x').ok && !parseRpc({ id: 1 }).ok && !parseRpc([]).ok, 'نصّ/بلا jsonrpc/دفعة فارغة مرفوضة');
  const ok = okResult(1, { tools: [] }, '2026-07-28', SITE); assert.equal(ok.result.resultType, 'complete', 'resultType إلزامي في 2026'); assert.equal(ok.result._meta[META.version], '2026-07-28', 'النسخة في _meta');
  const old = okResult(1, { tools: [] }, '2025-06-18', SITE); assert.equal(old.result.resultType, undefined, 'لا resultType للقديمة');
  const e = errResult(null, -32601, 'nope'); assert.equal(e.error.code, -32601, 'كود الخطأ'); assert.equal(e.id, null, 'id null');
  assert.deepEqual(cacheable('2026-07-28', 60000, 'public'), { ttlMs: 60000, cacheScope: 'public' }, 'ttl/cacheScope في الأحدث'); assert.deepEqual(cacheable('2025-06-18', 60000, 'public'), {}, 'لا شيء للقديمة');
  const d = discoverResult(SITE); assert.deepEqual(d.protocolVersions, [...MCP_VERSIONS], 'server/discover يعلن النسخ'); assert.equal(d.serverInfo.name, 'athar', 'الهوية');
  assert.equal(initializeResult('2025-03-26', SITE).protocolVersion, '2025-03-26', 'initialize يعيد النسخة المتفاوَض عليها');
});

test('P20 الطبقات: العام يرى الاكتشاف والتحقق فقط؛ الجهة ترى أدوات الجهة؛ الشخصي بحسب نطاقاته', () => {
  const anon = toolsFor('anon').map(t => t.name); assert.ok(anon.includes('verify_credential') && anon.includes('capability_trend'), 'العام: تحقق + مؤشر الأداء');
  assert.ok(!anon.includes('request_quote') && !anon.some(n => n.startsWith('my_')), 'العام: لا كتابة مؤسسية ولا أدوات «أنا»');
  const key = toolsFor('key').map(t => t.name); assert.ok(key.includes('request_quote') && key.includes('reserve_seats'), 'الجهة: الأدوات المؤسسية'); assert.ok(!key.some(n => n.startsWith('my_')), 'الجهة: لا أدوات «أنا»');
  const me = toolsFor('personal', ['wallet:read']).map(t => t.name); assert.ok(me.includes('my_wallet') && !me.includes('my_daily') && !me.includes('my_missions'), 'الشخصي: بحسب النطاق');
  const full = toolsFor('personal', ['wallet:read', 'daily:write', 'missions:read', 'snapshot:issue']).map(t => t.name); assert.ok(full.includes('my_daily') && full.includes('my_missions') && full.includes('issue_snapshot'), 'كل النطاقات → كل أدوات «أنا»');
  assert.ok(!full.includes('request_quote'), 'الشخصي لا يطلب عروضًا باسم جهة');
  const rq = mcpToolByName('request_quote')!; assert.equal(toolAllowed(rq, 'anon').ok, false, 'منع العام من الكتابة'); assert.equal(toolAllowed(rq, 'key').ok, true, 'الجهة تكتب (بانتظار اعتماد)');
  assert.equal((toolAllowed(mcpToolByName('my_wallet')!, 'personal', []) as any).reason_ar?.length > 5, true, 'سبب عربي عند نقص النطاق');
  for (const t of ALL_MCP_TOOLS) { assert.ok(t.annotations && typeof t.annotations.readOnlyHint === 'boolean', `تلميحات لكل أداة: ${t.name}`); assert.ok(t.inputSchema?.type === 'object', `مخطط مدخلات: ${t.name}`); assert.ok(t.description.length > 20, `وصف كافٍ: ${t.name}`); }
  assert.ok(ALL_MCP_TOOLS.filter(t => !t.annotations.readOnlyHint && t.kind !== 'personal').every(t => /human|إنسان|approval|اعتماد/i.test(t.description)), 'كل أداة كاتبة مؤسسية تصرّح بأن إنسانًا يعتمد');
  assert.ok(ALL_MCP_TOOLS.filter(t => !t.annotations.readOnlyHint && t.kind === 'personal').every(t => /المستخدم/.test(t.description)), 'أدوات «أنا» الكاتبة تُقيَّد بإرادة المستخدم الصريحة');
  const names = ALL_MCP_TOOLS.map(t => t.name); assert.equal(new Set(names).size, names.length, 'لا أسماء مكررة');
  const list = toolsListResult('anon', [], '2026-07-28'); assert.deepEqual(list.tools.map((t: any) => t.name), toolsListResult('anon', [], '2026-07-28').tools.map((t: any) => t.name), 'ترتيب حتمي بين النداءات'); assert.equal(list.tools[0].name, 'discover_programs', 'الاكتشاف أولًا'); assert.equal(list.cacheScope, 'public', 'قائمة العام عامة الكاش');
  assert.equal(toolsListResult('personal', ['wallet:read'], '2026-07-28').cacheScope, 'private', 'قائمة الشخصي خاصة الكاش');
});

test('P20 الموارد والمطالبات: athar:// بحسب الطبقة، ومطالبات عربية جاهزة', () => {
  const pub = resourcesFor('anon').map(r => r.uri); assert.ok(pub.includes('athar://observatory/latest') && pub.includes('athar://did') && pub.includes('athar://lexicon'), 'موارد عامة');
  assert.ok(!pub.includes('athar://me/wallet'), 'المحفظة ليست عامة'); assert.ok(resourcesFor('personal', ['wallet:read']).map(r => r.uri).includes('athar://me/wallet'), 'المحفظة للشخصي بنطاق');
  assert.ok(!resourcesFor('personal', []).map(r => r.uri).includes('athar://me/wallet'), 'بلا نطاق لا محفظة');
  for (const r of RESOURCES) assert.ok(r.uri.startsWith('athar://') && r.mimeType && r.title, `مورد مكتمل: ${r.uri}`);
  assert.ok(PROMPTS.length >= 4, 'أربع مطالبات على الأقل'); for (const p of PROMPTS) assert.ok(/[\u0600-\u06FF]/.test(p.title), `عنوان عربي: ${p.name}`);
  const pm = promptMessages('recommend_program', { skill: 'قيادة فرق', sector: 'الصحة' }); assert.ok(pm && pm.messages[0].content.text.includes('قيادة فرق') && pm.messages[0].content.text.includes('الصحة'), 'الوسائط تُدمج في النص');
  assert.equal(promptMessages('nope'), null, 'مطالبة مجهولة → null');
});

test('P20 المصطلح: «مؤشر الأداء» — صاعد/مستقر/متراجع بلا رموز طقس', () => {
  assert.equal(WEATHER_LABEL.rising.ar, 'صاعد', 'صاعد'); assert.equal(WEATHER_LABEL.stable.ar, 'مستقر', 'مستقر'); assert.equal(WEATHER_LABEL.cooling.ar, 'متراجع', 'متراجع (كان «يبرد»)');
  assert.equal(WEATHER_LABEL.cooling.en, 'Declining', 'Declining'); for (const k of Object.keys(WEATHER_LABEL) as (keyof typeof WEATHER_LABEL)[]) assert.ok(!/[☀⛅🌧]/.test(WEATHER_LABEL[k].icon), `لا رمز طقس: ${k}`);
  assert.equal(weatherOf(0.2, 20, 20), 'rising', 'الدلالة لم تتغير'); assert.equal(weatherOf(-0.2, 20, 20), 'cooling', 'متراجع'); assert.equal(weatherOf(0, 20, 20), 'stable', 'مستقر');
});
