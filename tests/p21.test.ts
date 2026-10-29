// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// اختبارات P21 — «درع أَثَر»: حدود المعدل (نافذة ثابتة + تراجع للذاكرة)، قراءة JSON الآمنة (حجم/عمق)، المقارنة بزمن ثابت وسرّ الكرون،
//                 تدوير مفتاح التوقيع بلا انقطاع (PREV)، فحص الترويسات وsecurity.txt، تسريب NEXT_PUBLIC_*، الأحداث والتنبيهات، والتمرين الذاتي بخادم وهمي.
import test from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit, limitFor, LIMITS, tooMany, _resetMem, ipOf } from '../lib/shield/ratelimit';
import { readJson, jsonDepth, safeEqual, cronAuthorized, honeypotTripped, HONEYPOT_FIELD, PUBLIC_MAX_BYTES, crossSiteBrowserWrite } from '../lib/shield/body';
import { securityEvent, burst, shieldSummary, KIND_AR, DEFAULT_SEVERITY, describeEvent } from '../lib/shield/guard';
import { headersCheck, securityTxtCheck, securityTxt, publicEnvLeak, runDrill, MANUAL_TODO_AR } from '../lib/shield/drill';
import { keyInfo, generateMasterKey, ROTATION_STEPS_AR, AGENT_KEY_GRACE_H } from '../lib/shield/keys';
import { secretFromEnv, secretsFromEnv, keyId, signToken, verifyToken, ACCESS_TTL_S } from '../lib/portal/oauth';

const NOW = Date.parse('2026-10-29T09:00:00Z');
const K1 = 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc='; const K2 = 'CAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAg=';

/** قاعدة وهمية: RPC shield_hit بنافذة ثابتة + جدول أحداث في الذاكرة */
function fakeDb(opts: { rpcFail?: boolean } = {}) {
  const buckets = new Map<string, number>(); const events: any[] = []; const sent: any[] = [];
  const db: any = {
    buckets, events, sent,
    rpc: async (name: string, args: any) => {
      if (opts.rpcFail) return { data: null, error: { message: 'down' } };
      if (name === 'shield_hit') { const slot = Math.floor(Date.now() / 1000 / args.p_window_s); const k = `${args.p_key}:${slot}`; const c = (buckets.get(k) || 0) + 1; buckets.set(k, c); return { data: { allowed: c <= args.p_limit, count: c, limit: args.p_limit, retry_after: c <= args.p_limit ? 0 : 7 }, error: null }; }
      if (name === 'shield_rls_report') return { data: [{ table_name: 'portal_security_events', rls_enabled: true, policy_count: 0 }, { table_name: 'portal_delegations', rls_enabled: true, policy_count: 2 }], error: null };
      if (name === 'shield_gc') return { data: { buckets: 0, events: 0 }, error: null };
      return { data: null, error: { message: 'unknown rpc' } };
    },
    from: (t: string) => {
      const q: any = { _t: t, _f: [] as any[], _order: null, _limit: 0, _single: false, _payload: null, _op: 'select' };
      const run = () => {
        if (t !== 'portal_security_events') return { data: q._single ? null : [], error: null };
        if (q._op === 'insert') { const row = { id: events.length + 1, at: new Date().toISOString(), handled_at: null, notified_at: null, ...q._payload }; events.push(row); return { data: q._single ? row : [row], error: null }; }
        let rows = events.filter(r => q._f.every((f: any) => f.op === 'eq' ? r[f.c] === f.v : f.op === 'gte' ? r[f.c] >= f.v : f.op === 'lt' ? r[f.c] < f.v : f.op === 'is' ? r[f.c] == null : true));
        if (q._op === 'update') { for (const r of rows) Object.assign(r, q._payload); return { data: null, error: null }; }
        if (q._order) rows = [...rows].sort((a, b) => (a[q._order.c] < b[q._order.c] ? 1 : -1) * (q._order.asc ? -1 : 1));
        if (q._limit) rows = rows.slice(0, q._limit);
        return { data: q._single ? rows[0] || null : rows, error: null };
      };
      q.select = () => q; q.eq = (c: string, v: any) => { q._f.push({ op: 'eq', c, v }); return q; }; q.gte = (c: string, v: any) => { q._f.push({ op: 'gte', c, v }); return q; }; q.lt = (c: string, v: any) => { q._f.push({ op: 'lt', c, v }); return q; }; q.is = (c: string) => { q._f.push({ op: 'is', c }); return q; }; q.in = (c: string, v: any[]) => { q._f.push({ op: 'in', c, v }); return q; };
      q.order = (c: string, o: any) => { q._order = { c, asc: !!o?.ascending }; return q; }; q.limit = (n: number) => { q._limit = n; return q; }; q.maybeSingle = () => { q._single = true; return q; }; q.single = q.maybeSingle;
      q.insert = (p: any) => { q._op = 'insert'; q._payload = p; return q; }; q.update = (p: any) => { q._op = 'update'; q._payload = p; return q; };
      q.then = (res: any, rej: any) => Promise.resolve(run()).then(res, rej);
      return q;
    },
  };
  return db;
}

test('P21 الصمّام: نافذة ثابتة عبر RPC، المسار السريع بعد الحد، وتراجع للذاكرة عند تعطّل القاعدة', async () => {
  _resetMem(); const db = fakeDb();
  const rs = []; for (let i = 0; i < 5; i++) rs.push(await rateLimit(db, 't:1.1.1.1', 60, 3));
  assert.deepEqual(rs.map(r => r.allowed), [true, true, true, false, false], '3 مسموحة ثم رفض');
  assert.equal(rs[3].fallback, false, 'الرفض من القاعدة'); assert.ok(rs[4].retryAfter >= 1, 'Retry-After موجب');
  const calls = db.buckets.size; await rateLimit(db, 't:1.1.1.1', 60, 3); assert.equal(db.buckets.size, calls, 'بعد تجاوز الحد لا نداء جديدًا للقاعدة (مسار سريع)');
  _resetMem(); const down = fakeDb({ rpcFail: true }); const a = await rateLimit(down, 'x', 60, 2); const b = await rateLimit(down, 'x', 60, 2); const c = await rateLimit(down, 'x', 60, 2);
  assert.deepEqual([a.allowed, b.allowed, c.allowed], [true, true, false], 'الذاكرة تحكم عند التعطّل'); assert.equal(c.fallback, true, 'يُعلَّم أنه تراجع');
  const r429 = tooMany(c); assert.equal(r429.status, 429, '429'); assert.ok(r429.headers.get('Retry-After'), 'ترويسة Retry-After'); assert.ok(r429.headers.get('X-Request-Id'), 'معرّف طلب للتتبع');
  const lf = await limitFor(fakeDb(), 'vuln_report_ip', '9.9.9.9'); assert.equal(lf.limit, LIMITS.vuln_report_ip.n, 'limitFor يقرأ الجدول');
  assert.ok(LIMITS.oauth_token_ip.n >= 10 && LIMITS.oauth_token_drill.n <= 5, 'حدود معقولة: الرموز ≥10/دقيقة والتمرين ≤5');
  assert.equal(ipOf(new Request('http://x', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })), '1.2.3.4', 'أول IP في السلسلة');
});

test('P21 قراءة JSON الآمنة: حجم معلن/فعلي، عمق، فارغ، غير صالح — وحقل الفخّ', async () => {
  const mk = (body: string, h: Record<string, string> = {}) => new Request('http://x/api', { method: 'POST', headers: { 'Content-Type': 'application/json', ...h }, body });
  const ok = await readJson(mk('{"a":1}')); assert.ok(ok.ok && ok.body.a === 1, 'يقرأ الطبيعي');
  const big = await readJson(mk('{}', { 'content-length': String(PUBLIC_MAX_BYTES + 1) })); assert.ok(!big.ok && big.status === 413, 'الطول المعلن الكبير → 413');
  const big2 = await readJson(mk(JSON.stringify({ p: 'x'.repeat(70 * 1024) }))); assert.ok(!big2.ok && big2.status === 413 && big2.reason === 'too_large', 'الجسم الفعلي الكبير → 413');
  const deep = await readJson(mk('['.repeat(20) + ']'.repeat(20))); assert.ok(!deep.ok && deep.status === 400 && deep.reason === 'too_deep', 'العمق المفرط → 400');
  assert.equal(jsonDepth({ a: { b: [1, { c: 1 }] } }), 4, 'حساب العمق'); assert.equal(jsonDepth(1), 0, 'القيمة البسيطة عمق 0');
  const empty = await readJson(mk('')); assert.ok(!empty.ok && empty.reason === 'empty', 'فارغ يُرفض افتراضيًا');
  const emptyOk = await readJson(mk(''), { allowEmpty: true }); assert.ok(emptyOk.ok && JSON.stringify(emptyOk.body) === '{}', 'فارغ مسموح عند الطلب');
  const bad = await readJson(mk('{nope')); assert.ok(!bad.ok && bad.reason === 'invalid', 'JSON مكسور → invalid');
  assert.equal(HONEYPOT_FIELD, 'website_url', 'اسم حقل الفخّ'); assert.ok(honeypotTripped({ website_url: 'http://spam' }), 'الروبوت يملأ الفخّ'); assert.ok(!honeypotTripped({ website_url: '' }), 'البشر يتركونه فارغًا');
  assert.ok(crossSiteBrowserWrite(new Request('http://athar.sa/api/x', { method: 'POST', headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' } })), 'إرسال نموذج عابر للموقع (CSRF) يُكتشف');
  assert.ok(!crossSiteBrowserWrite(new Request('http://athar.sa/api/x', { method: 'POST', headers: { 'sec-fetch-site': 'same-origin' } })), 'نفس الموقع لا يُعدّ عابرًا');
});

test('P21 المقارنة بزمن ثابت وسرّ الكرون (Bearer أو ?key=)', () => {
  assert.ok(safeEqual('abc', 'abc'), 'متساويان'); assert.ok(!safeEqual('abc', 'abd'), 'مختلفان'); assert.ok(!safeEqual('', 'x'), 'فارغ ≠ قيمة'); assert.ok(!safeEqual(null, null), 'null لا يساوي شيئًا');
  const env = { CRON_SECRET: 's3cr3t' } as any;
  assert.ok(cronAuthorized(new Request('http://x/api/c', { headers: { authorization: 'Bearer s3cr3t' } }), env), 'Bearer صحيح');
  assert.ok(cronAuthorized(new Request('http://x/api/c?key=s3cr3t'), env), '?key= صحيح');
  assert.ok(!cronAuthorized(new Request('http://x/api/c?key=wrong'), env), 'سرّ خاطئ'); assert.ok(!cronAuthorized(new Request('http://x/api/c?key=s3cr3t'), {} as any), 'بلا سرّ مضبوط → رفض دائمًا');
});

test('P21 المفاتيح: تدوير بلا انقطاع — الرموز القديمة تتحقق بـ PREV والجديدة بالأساسي، والبصمات لا تكشف السرّ', () => {
  const old = secretFromEnv({ VC_SIGNING_KEY: K1 }); const t = signToken({ typ: 'at', sub: 'u1', email: 'a@b.sa', name: '', del: 'd1', client: 'c', client_name: 'C', scopes: ['wallet:read'], aud: 'https://athar-portal.vercel.app/mcp', exp: Math.floor(NOW / 1000) + ACCESS_TTL_S } as any, old);
  const rotated = { VC_SIGNING_KEY: K2, TOKEN_SECRET_PREV: K1 }; const secrets = secretsFromEnv(rotated);
  assert.equal(secrets.length, 2, 'مفتاحان أثناء التدوير'); assert.ok(verifyToken(t, secrets, NOW, 'at'), 'الرمز القديم ما زال يتحقق'); assert.equal(verifyToken(t, secretsFromEnv({ VC_SIGNING_KEY: K2 }), NOW, 'at'), null, 'بلا PREV يسقط (تدوير صارم)');
  const t2 = signToken({ typ: 'at', sub: 'u1', email: 'a@b.sa', name: '', del: 'd1', client: 'c', client_name: 'C', scopes: [], aud: 'x', exp: Math.floor(NOW / 1000) + 100 } as any, secrets[0]); assert.ok(verifyToken(t2, secrets, NOW, 'at'), 'الجديد يتحقق');
  assert.equal(secretsFromEnv({ VC_SIGNING_KEY: K1, TOKEN_SECRET_PREV: K1 }).length, 1, 'PREV = الأساسي لا يُكرَّر');
  const ki = keyInfo(rotated); assert.ok(ki.master_set && ki.prev_set, 'الحالة تعكس التدوير'); assert.equal(ki.master_fingerprint!.length, 8, 'بصمة 8 أحرف'); assert.notEqual(ki.master_fingerprint, K2.slice(0, 8), 'البصمة ليست جزءًا من المفتاح'); assert.equal(ki.oauth_kid, keyId(secrets[0]), 'kid متسق');
  assert.ok(keyInfo({}).fallback_dev, 'بلا مفتاح = وضع تطوير مكشوف');
  const g = generateMasterKey(); assert.equal(Buffer.from(g, 'base64').length, 32, '32 بايت'); assert.notEqual(generateMasterKey(), g, 'عشوائي');
  assert.ok(ROTATION_STEPS_AR.length >= 4 && ROTATION_STEPS_AR.join(' ').includes('TOKEN_SECRET_PREV'), 'خطة التدوير تذكر PREV'); assert.equal(AGENT_KEY_GRACE_H, 24, 'سماح 24 ساعة لمفاتيح الجهات');
});

test('P21 الجدار: فحص الترويسات وsecurity.txt (RFC 9116) وتسريب NEXT_PUBLIC_*', () => {
  const good = new Headers({ 'strict-transport-security': 'max-age=63072000; includeSubDomains; preload', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(self), microphone=(self)', 'content-security-policy': "frame-ancestors 'none'" });
  assert.ok(headersCheck(good).ok, 'كاملة'); const miss = headersCheck(new Headers({ 'x-content-type-options': 'nosniff' })); assert.ok(!miss.ok && miss.missing.includes('HSTS'), 'ينقص HSTS');
  const txt = securityTxt({ NEXT_PUBLIC_SITE_URL: 'https://athar-portal.vercel.app', ADMIN_EMAILS: 'sec@athar.sa' }, new Date(NOW));
  assert.ok(txt.includes('Contact: https://athar-portal.vercel.app/security/report') && txt.includes('Contact: mailto:sec@athar.sa'), 'جهتا اتصال'); assert.ok(/Expires: 2027-09-30T23:59:59Z/.test(txt), 'Expires آخر يوم من الشهر بعد 11 شهرًا'); assert.ok(txt.includes('Preferred-Languages: ar, en') && txt.includes('Canonical:'), 'الحقول القياسية');
  assert.ok(securityTxtCheck(txt, NOW).ok, 'يجتاز فحصه'); assert.ok(!securityTxtCheck('Contact: x\nExpires: 2020-01-01T00:00:00Z\n', NOW).ok, 'منتهٍ يُرفض'); assert.ok(securityTxtCheck('Contact: x\nPreferred-Languages: ar\n', NOW).problems.includes('Expires مفقود'), 'Expires إلزامي');
  const leak = publicEnvLeak({ NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJ.anon', NEXT_PUBLIC_OOPS: 'sk_live_abcdef', SUPABASE_SERVICE_ROLE_KEY: 'svc', NEXT_PUBLIC_COPY: 'svc' });
  assert.deepEqual(leak.sort(), ['NEXT_PUBLIC_COPY', 'NEXT_PUBLIC_OOPS'], 'يكشف مفتاح sk_ والنسخة المطابقة لسرّ الخدمة'); assert.deepEqual(publicEnvLeak({ NEXT_PUBLIC_SITE_URL: 'https://a' }), [], 'نظيف');
});

test('P21 الحارس: الأحداث تُحفظ، الحرج يُنبّه الطاقم وصاحب الحساب، والدفقة تُسجَّل مرة واحدة', async () => {
  _resetMem(); const db = fakeDb(); const env = { ADMIN_EMAILS: 'a@athar.sa, b@athar.sa' } as any;
  const info = await securityEvent(db, { severity: 'info', kind: 'key_created', actor: 'k' }, env); assert.ok(info.id && !info.notified, 'معلومة تُحفظ بلا تنبيه');
  const crit = await securityEvent(db, { severity: 'critical', kind: 'token_reuse', actor: 'Claude', ip: '1.2.3.4', user_id: 'u1', user_email: 'x@y.sa' }, env);
  assert.ok(crit.id, 'حرج يُحفظ'); const saved = db.events.find((e: any) => e.id === crit.id); assert.equal(saved.severity, 'critical', 'الدرجة محفوظة'); assert.ok(saved.notified_at || !crit.notified, 'notified_at يتسق مع نتيجة الإرسال');
  assert.equal(DEFAULT_SEVERITY.token_reuse, 'critical', 'إعادة استخدام رمز = حرج'); assert.equal(DEFAULT_SEVERITY.csp_report, 'info', 'تقرير CSP = معلومة'); assert.ok(KIND_AR.vuln_report && KIND_AR.drill && KIND_AR.stale_critical, 'أسماء عربية لكل نوع');
  assert.ok(describeEvent({ severity: 'warn', kind: 'bad_redirect', actor: 'x', ip: '9.9.9.9' }).includes('رابط عودة'), 'وصف عربي');
  const fired = []; for (let i = 0; i < 6; i++) fired.push(await burst(db, 'b:1', 60, 3, { severity: 'warn', kind: 'mcp_401_burst', ip: '1.1.1.1' }, env));
  assert.deepEqual(fired, [false, false, false, true, false, false], 'حدث واحد عند تجاوز العتبة'); assert.equal(db.events.filter((e: any) => e.kind === 'mcp_401_burst').length, 1, 'لا تكرار');
  const s = await shieldSummary(db, 30); assert.equal(s.total, 3, 'ملخص 3 أحداث'); assert.equal(s.open_critical, 1, 'حرج واحد مفتوح'); assert.equal(s.by_kind.token_reuse, 1, 'حسب النوع');
});

test('P21 التمرين الذاتي: يشنّ 14 اختبارًا على خادم وهمي ويقرأ النتيجة بدقة (ناجح/فاشل)', async () => {
  _resetMem(); const db = fakeDb(); const env = { VC_SIGNING_KEY: K1, NEXT_PUBLIC_SITE_URL: 'https://t.example' } as any;
  const H = { 'strict-transport-security': 'max-age=63072000', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'permissions-policy': 'camera=(self)', 'content-security-policy': "frame-ancestors 'none'" };
  let tokenHits = 0;
  const goodServer: typeof fetch = async (input: any, init?: any) => {
    const u = new URL(String(input)); const p = u.pathname; const body = init?.body ? String(init.body) : '';
    if (p === '/') return new Response('ok', { headers: H });
    if (p === '/verify') return new Response('ok', { headers: { ...H, 'content-security-policy': 'frame-ancestors *' } });
    if (p === '/mcp') return new Response('{}', { status: 401, headers: { 'www-authenticate': 'Bearer resource_metadata="https://t.example/.well-known/oauth-protected-resource/mcp"' } });
    if (p === '/mcp/public') { if (body.length > 64 * 1024) return new Response('{}', { status: 413 }); if (body.startsWith('[[[[')) return new Response('{}', { status: 400 }); return new Response('{}'); }
    if (p === '/oauth/token') { tokenHits++; if (init?.headers?.['X-Athar-Drill'] && tokenHits > 5) return new Response('{}', { status: 429 }); return new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }); }
    if (p === '/oauth/register') return new Response('{}', { status: 400 });
    if (p === '/.well-known/security.txt') return new Response(securityTxt(env, new Date()));
    if (p === '/privacy') return new Response('<html>privacy</html>', { headers: H });
    if (p === '/.well-known/privacy.json') return new Response(JSON.stringify({ controller: { name: 'x' }, processing: new Array(12).fill({ id: 't' }) }));
    return new Response('nf', { status: 404 });
  };
  const r = await runDrill('https://t.example', env, db, goodServer);
  assert.equal(r.total, 14, '14 اختبارًا'); assert.equal(r.passed, 14, `كلها ناجحة: ${r.checks.filter(c => !c.ok).map(c => c.id + ':' + c.detail).join(' | ')}`);
  assert.ok(r.checks.find(c => c.id === 'rate_limit')!.detail.includes('429'), 'يذكر 429');
  const weakServer: typeof fetch = async (input: any, init?: any) => { const p = new URL(String(input)).pathname; if (p === '/') return new Response('ok'); if (p === '/mcp') return new Response('{}', { status: 200 }); if (p === '/oauth/token') return new Response('{}', { status: 400 }); return goodServer(input, init); };
  const w = await runDrill('https://t.example', { ...env, NEXT_PUBLIC_LEAK: 'sk_live_1234567890' }, db, weakServer);
  const failed = w.checks.filter(c => !c.ok).map(c => c.id);
  assert.ok(failed.includes('headers') && failed.includes('mcp_401') && failed.includes('rate_limit') && failed.includes('env_leak') && failed.includes('token_unknown_code'), `يكشف الضعف: ${failed.join(',')}`);
  assert.ok(MANUAL_TODO_AR.some(t => t.id === 'leaked_pw'), 'قائمة اليد البشرية تضم حماية كلمات المرور المسرّبة');
});
