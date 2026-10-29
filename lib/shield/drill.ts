// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — «التمرين»: الدرع يختبر نفسه — 12 اختبارًا آمنًا يشنّها الخادم على موقعه هو ويعرض ✓/✗.
 *  لا يترك أثرًا: لا تفويضات ولا مفاتيح؛ يستخدم أكوادًا ورموزًا وهمية صالحة الشكل فقط.
 *  تُستدعى من /admin/shield (زر) ومن المسح اليومي الموجود؛ النتيجة تُحفظ حدثًا `drill` وتُعرض مجهّلة في /security.
 */
import { keyInfo } from './keys';

export type DrillCheck = { id: string; title_ar: string; ok: boolean; detail: string; manual?: boolean };
export type DrillResult = { at: string; passed: number; total: number; checks: DrillCheck[]; ms: number };

export const REQUIRED_HEADERS: { name: string; test: (v: string) => boolean; title_ar: string }[] = [
  { name: 'strict-transport-security', test: v => /max-age=\d{7,}/.test(v), title_ar: 'HSTS' },
  { name: 'x-content-type-options', test: v => /nosniff/i.test(v), title_ar: 'nosniff' },
  { name: 'referrer-policy', test: v => /strict-origin|no-referrer/i.test(v), title_ar: 'Referrer-Policy' },
  { name: 'permissions-policy', test: v => v.length > 10, title_ar: 'Permissions-Policy' },
  { name: 'content-security-policy', test: v => /frame-ancestors/i.test(v), title_ar: 'frame-ancestors' },
];

/** يحلّل ترويسات ردّ ويقرّر */
export function headersCheck(h: Headers | Record<string, string>): { ok: boolean; missing: string[] } {
  const get = (k: string) => (h instanceof Headers ? h.get(k) : (h[k] ?? h[k.toLowerCase()])) || '';
  const missing = REQUIRED_HEADERS.filter(r => !r.test(get(r.name))).map(r => r.title_ar);
  return { ok: missing.length === 0, missing };
}

/** نصّ security.txt (RFC 9116) — Expires آلي */
export function securityTxt(env: Record<string, string | undefined>, now = new Date()): string {
  const S = (env.NEXT_PUBLIC_SITE_URL || 'https://athar-portal.vercel.app').replace(/\/+$/, '');
  const mail = String(env.SECURITY_CONTACT || (env.NOTIFY_EMAILS || env.ADMIN_EMAILS || '').split(/[,;\s]+/)[0] || '').trim();
  const exp = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 0, 23, 59, 59)); // آخر يوم من الشهر بعد 11 شهرًا
  return [
    '# أَثَر · TRACE — سياسة الإفصاح المسؤول (RFC 9116)',
    `Contact: ${S}/security/report`,
    ...(mail ? [`Contact: mailto:${mail}`] : []),
    `Expires: ${exp.toISOString().replace(/\.\d{3}Z$/, 'Z')}`,
    'Preferred-Languages: ar, en',
    `Canonical: ${S}/.well-known/security.txt`,
    `Policy: ${S}/security`,
    `Acknowledgments: ${S}/security#thanks`,
    '',
  ].join('\n');
}

/** يتحقق من security.txt وفق RFC 9116 (الحقول الإلزامية + عدم الانتهاء) */
export function securityTxtCheck(text: string, now = Date.now()): { ok: boolean; problems: string[] } {
  const p: string[] = []; const get = (k: string) => (text.match(new RegExp(`^${k}:\\s*(.+)$`, 'mi')) || [])[1]?.trim();
  if (!get('Contact')) p.push('Contact مفقود'); const exp = get('Expires'); if (!exp) p.push('Expires مفقود'); else { const t = Date.parse(exp); if (!t) p.push('Expires غير صالح'); else if (t < now) p.push('Expires منتهٍ'); else if (t - now > 366 * 86400000) p.push('Expires أبعد من سنة'); }
  if (!/^Preferred-Languages:/mi.test(text)) p.push('Preferred-Languages مفقود');
  return { ok: p.length === 0, problems: p };
}

/** هل تسرّب سرّ إلى متغيرات NEXT_PUBLIC_*؟ (أي قيمة تشبه مفتاح خدمة أو سرًّا) */
export function publicEnvLeak(env: Record<string, string | undefined>): string[] {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith('NEXT_PUBLIC_') || !v) continue;
    if (k === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' || k === 'NEXT_PUBLIC_MOYASAR_PUBLISHABLE_KEY') { if (/service_role/.test(v) || /^sk_/.test(v)) bad.push(k); continue; }
    if (/service_role|^sk_(live|test)_|^re_[A-Za-z0-9]{20,}|^AIza[0-9A-Za-z_-]{30,}|^eyJ[A-Za-z0-9_-]{80,}/.test(v)) bad.push(k);
    if (v === env.SUPABASE_SERVICE_ROLE_KEY || v === env.CRON_SECRET || v === env.VC_SIGNING_KEY) bad.push(k);
  }
  return bad;
}

const withTimeout = async (p: Promise<Response>, ms = 8000): Promise<Response | null> => { try { return await Promise.race([p, new Promise<null>(r => setTimeout(() => r(null), ms))]); } catch { return null; } };

export async function runDrill(site: string, env: Record<string, string | undefined>, db: any, fetchImpl: typeof fetch = fetch): Promise<DrillResult> {
  const t0 = Date.now(); const S = site.replace(/\/+$/, ''); const checks: DrillCheck[] = [];
  const f = (path: string, init?: RequestInit) => withTimeout(fetchImpl(S + path, { ...init, cache: 'no-store', redirect: 'manual' } as any));
  const add = (id: string, title_ar: string, ok: boolean, detail: string, manual = false) => checks.push({ id, title_ar, ok, detail, manual });
  // 1 الترويسات
  const home = await f('/'); const hc = home ? headersCheck(home.headers) : { ok: false, missing: ['لا استجابة'] }; add('headers', 'ترويسات الأمان على الصفحات', hc.ok, hc.ok ? 'HSTS · nosniff · Referrer · Permissions · frame-ancestors' : `ناقص: ${hc.missing.join(' · ')}`);
  // 2 /verify قابلة للتضمين (استثناء مقصود) — frame-ancestors * لا DENY
  const ver = await f('/verify'); const fa = ver?.headers.get('content-security-policy') || ''; add('verify_embed', 'صفحات التحقق قابلة للتضمين في بوابات الجهات', !!ver && /frame-ancestors\s+\*/i.test(fa) && !ver.headers.get('x-frame-options'), ver ? (fa.slice(0, 80) || 'بلا CSP') : 'لا استجابة');
  // 3 /mcp بلا رمز → 401 + WWW-Authenticate
  const m401 = await f('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }); add('mcp_401', '/mcp يرفض بلا تفويض ويدل على بيانات المورد', !!m401 && m401.status === 401 && /resource_metadata=/.test(m401.headers.get('www-authenticate') || ''), m401 ? `HTTP ${m401.status}` : 'لا استجابة');
  // 4 رمز وهمي/منتهٍ يُرفض
  const bogus = 'athar_at.' + Buffer.from(JSON.stringify({ typ: 'at', sub: 'x', del: 'y', exp: 1 })).toString('base64url') + '.AAAA'; const mb = await f('/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bogus}` }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }); add('bad_token', 'رمز وصول مزوَّر يُرفض', !!mb && mb.status === 401, mb ? `HTTP ${mb.status}` : 'لا استجابة');
  // 5 كود مجهول يُرفض
  const tk = await f('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=authorization_code&code=drill-nope&code_verifier=drill-verifier-drill-verifier-drill-verifier-123&redirect_uri=https%3A%2F%2Fexample.org%2Fcb&client_id=drill' }); let tkj: any = null; try { tkj = tk ? await tk.json() : null; } catch { /* */ } add('token_unknown_code', 'كود تفويض مجهول يُرفض (invalid_grant)', !!tk && tk.status === 400 && tkj?.error === 'invalid_grant', tk ? `HTTP ${tk.status} ${tkj?.error || ''}` : 'لا استجابة');
  // 6 redirect غريب يُرفض في التسجيل
  const rg = await f('/oauth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_name: 'drill', redirect_uris: ['http://evil.example/cb'] }) }); add('bad_redirect', 'رابط عودة غير آمن يُرفض عند التسجيل', !!rg && rg.status === 400, rg ? `HTTP ${rg.status}` : 'لا استجابة');
  // 7 جسم ضخم يُرفض (413) — نعلن الطول فقط
  const big = await f('/mcp/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(96 * 1024) } }) }); add('body_size', 'جسم طلب ضخم (> 64 KB) يُرفض', !!big && big.status === 413, big ? `HTTP ${big.status}` : 'لا استجابة');
  // 8 JSON عميق يُرفض
  const deep = '['.repeat(40) + ']'.repeat(40); const dp = await f('/mcp/public', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: deep }); add('body_depth', 'JSON متداخل بعمق مفرط يُرفض', !!dp && dp.status === 400, dp ? `HTTP ${dp.status}` : 'لا استجابة');
  // 9 حد المعدل يعمل فعلًا (قصف /oauth/token بأكواد مجهولة حتى 429) — 25 طلبًا كحد أقصى
  let got429 = false; let n = 0; for (; n < 8 && !got429; n++) { const r = await f('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Athar-Drill': '1' }, body: 'grant_type=authorization_code&code=drill-' + n + '&code_verifier=drill-verifier-drill-verifier-drill-verifier-123&redirect_uri=https%3A%2F%2Fexample.org%2Fcb&client_id=drill' }); if (r && r.status === 429) got429 = true; } add('rate_limit', 'حد المعدل يوقف القصف على /oauth/token', got429, got429 ? `429 بعد ${n} طلبًا` : `لا 429 بعد ${n} طلبًا`);
  // 10 لا تسريب أسرار إلى NEXT_PUBLIC_*
  const leak = publicEnvLeak(env); add('env_leak', 'لا أسرار في متغيرات المتصفح (NEXT_PUBLIC_*)', leak.length === 0, leak.length ? `مشبوه: ${leak.join(', ')}` : 'نظيف');
  // 11 RLS على كل جداول portal_*
  let rlsOk = false; let rlsDetail = 'RPC غير متاح — نفّذ SQL 725'; try { const { data, error } = await db.rpc('shield_rls_report'); if (!error && Array.isArray(data)) { const off = (data as any[]).filter(r => String(r.table_name).startsWith('portal_') && !r.rls_enabled).map(r => r.table_name); rlsOk = off.length === 0; rlsDetail = off.length ? `بلا RLS: ${off.join(', ')}` : `${(data as any[]).filter(r => String(r.table_name).startsWith('portal_')).length} جدول portal_* كلها بـ RLS`; } } catch { /* */ } add('rls', 'RLS مفعَّل على كل جداول البوابة', rlsOk, rlsDetail);
  // 12 security.txt صالح
  const st = await f('/.well-known/security.txt'); const stt = st ? await st.text().catch(() => '') : ''; const sc = securityTxtCheck(stt); add('security_txt', 'security.txt صالح (RFC 9116)', !!st && st.status === 200 && sc.ok, st ? (sc.ok ? 'صالح' : sc.problems.join(' · ')) : 'لا استجابة');
  // 13 حالة المفاتيح (معلومة)
  const ki = keyInfo(env); add('keys', 'مفاتيح التوقيع مضبوطة (لا مفتاح تطوير)', ki.master_set && !ki.fallback_dev, ki.master_set ? `kid ${ki.oauth_kid}${ki.prev_set ? ` · prev ${ki.prev_kid}` : ''}` : 'VC_SIGNING_KEY غير مضبوط');
  const passed = checks.filter(c => c.ok).length;
  return { at: new Date().toISOString(), passed, total: checks.length, checks, ms: Date.now() - t0 };
}

/** قائمة «تحتاج يدًا بشرية» (إعدادات لوحة لا يصل إليها الكود) */
export const MANUAL_TODO_AR = [
  { id: 'leaked_pw', title: 'تفعيل Leaked Password Protection في Supabase', how: 'Supabase → Authentication → Attack Protection → Leaked password protection → On' },
  { id: 'captcha', title: 'CAPTCHA على الدخول (اختياري)', how: 'Supabase → Authentication → Attack Protection → Enable CAPTCHA (Turnstile) — يحتاج مفتاح موقع في صفحة الدخول' },
  { id: 'mfa_admins', title: 'التحقق بخطوتين لحسابات الطاقم', how: 'GitHub وVercel وSupabase: فعّل 2FA لكل حساب طاقم' },
  { id: 'csp_enforce', title: 'تفعيل CSP الصارمة بعد أسبوع نظيف من التقارير', how: 'راجع تقارير csp_report هنا؛ إن لم تُسجَّل انتهاكات حقيقية، حوّل الترويسة من Report-Only إلى Content-Security-Policy في next.config.js (P21-ب)' },
];
