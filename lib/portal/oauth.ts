// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — التفويض الشخصي للوكلاء (سفارة أَثَر · P20): خادم تفويض OAuth 2.1 صغير داخل أَثَر — بلا خدمة خارجية وبلا اعتماديات
 *  • المتعلم يمنح مساعده الذكي نطاقات محددة على بياناته هو (محفظتي · موقف يومي · مهامي · إصدار لقطة) من شاشة موافقة عربية، ويبطلها متى شاء.
 *  • PKCE S256 إلزامي · resource (RFC 8707) = رابط /mcp · iss في الرد (RFC 9207) · عملاء عامّون (token_endpoint_auth_method = none)
 *  • الرموز: athar_at.<payload>.<hmac> (ساعة) · athar_rt (30 يومًا، يُستبدل عند كل تجديد) · athar_dg (60 ثانية — تفويض داخلي بين خادم MCP وواجهات أَثَر)
 *  • المفتاح مشتق من VC_SIGNING_KEY (أو CRON_SECRET) — لا متغير بيئة جديد. الحالة الدائمة (التفويضات والأكواد) في Supabase لا في الرمز.
 */
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';

export type PScope = 'wallet:read' | 'daily:write' | 'missions:read' | 'snapshot:issue';
export const PERSONAL_SCOPES: PScope[] = ['wallet:read', 'daily:write', 'missions:read', 'snapshot:issue'];
export const PSCOPE_LABEL: Record<PScope, { ar: string; en: string; detail_ar: string; risk: 'low' | 'medium' | 'high' }> = {
  'wallet:read': { ar: 'قراءة محفظتي', en: 'Read my wallet', detail_ar: 'مستوياتي المعتمدة، شهاداتي، وآخر لقطة قدرة — للقراءة فقط', risk: 'low' },
  'daily:write': { ar: 'موقف اليوم معي', en: 'Daily case with me', detail_ar: 'قراءة موقف اليوم وإرسال ردّي باسمي (مرة واحدة يوميًا، يُقيَّم بمرآة الأداء)', risk: 'medium' },
  'missions:read': { ar: 'قراءة مهامي', en: 'Read my missions', detail_ar: 'مهامي المفتوحة في قلب العمل ومواعيدها وما ينقصها من أدلة', risk: 'low' },
  'snapshot:issue': { ar: 'إصدار لقطة قدرة باسمي', en: 'Issue a capability snapshot', detail_ar: 'يُصدر لقطة قدرة موقَّعة (90 يومًا) قابلة للتحقق — أعلى صلاحية؛ امنحها لمساعد تثق به فقط', risk: 'high' },
};
export const ACCESS_TTL_S = 3600; export const REFRESH_TTL_S = 30 * 86400; export const CODE_TTL_S = 300; export const DELEGATE_TTL_S = 60; export const PERSONAL_DAILY_LIMIT = 500;

export function parseScopes(s: unknown): PScope[] {
  const raw = Array.isArray(s) ? s.map(String) : String(s || '').split(/[\s,]+/);
  const out: PScope[] = []; for (const x of raw) { const k = x.trim() as PScope; if ((PERSONAL_SCOPES as string[]).includes(k) && !out.includes(k)) out.push(k); }
  return out;
}

// ---------------------------------------------------------------- الترميز والمفتاح
export const b64u = (b: Buffer | Uint8Array | string) => Buffer.from(b as any).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64uDecode = (s: string) => Buffer.from(String(s || '').replace(/-/g, '+').replace(/_/g, '/'), 'base64');
export const sha256hex = (s: string) => createHash('sha256').update(s).digest('hex');
export function secretFromEnv(env: Record<string, string | undefined>): Buffer {
  const base = env.VC_SIGNING_KEY || env.CRON_SECRET || 'athar-dev-only'; return createHmac('sha256', base).update('athar-oauth-v1').digest();
}

export type TokenTyp = 'at' | 'rt' | 'dg';
export type TokenClaims = { typ: TokenTyp; sub: string; email: string; name?: string; del: string; client: string; client_name?: string; scopes: PScope[]; aud: string; iss: string; iat: number; exp: number; jti?: string };
export function signToken(c: TokenClaims, secret: Buffer): string {
  const payload = b64u(JSON.stringify(c)); const sig = b64u(createHmac('sha256', secret).update(`${c.typ}.${payload}`).digest());
  return `athar_${c.typ}.${payload}.${sig}`;
}
export const isOauthToken = (s: unknown) => /^athar_(at|rt|dg)\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(String(s || ''));
export function verifyToken(token: string, secret: Buffer, nowMs = Date.now(), expectTyp?: TokenTyp): TokenClaims | null {
  try {
    const m = /^athar_(at|rt|dg)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(token || '')); if (!m) return null;
    const [, typ, payload, sig] = m; const want = b64u(createHmac('sha256', secret).update(`${typ}.${payload}`).digest());
    const a = Buffer.from(sig); const b = Buffer.from(want); if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const c = JSON.parse(b64uDecode(payload).toString('utf8')) as TokenClaims; if (c.typ !== typ) return null; if (expectTyp && c.typ !== expectTyp) return null;
    if (!c.exp || c.exp * 1000 < nowMs) return null; if (!c.sub || !c.del) return null; c.scopes = parseScopes(c.scopes); return c;
  } catch { return null; }
}

// ---------------------------------------------------------------- PKCE والأكواد
export function pkceOk(verifier: string, challenge: string): boolean {
  const v = String(verifier || ''); if (v.length < 43 || v.length > 128 || !/^[A-Za-z0-9._~-]+$/.test(v)) return false;
  const want = b64u(createHash('sha256').update(v).digest()); const a = Buffer.from(want); const b = Buffer.from(String(challenge || '')); return a.length === b.length && timingSafeEqual(a, b);
}
export const newSecret = (bytes = 32) => b64u(randomBytes(bytes));

// ---------------------------------------------------------------- عناوين
export const mcpResource = (site: string) => `${site.replace(/\/+$/, '')}/mcp`;
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();
export function redirectOk(uri: string): boolean {
  try { const u = new URL(uri); if (u.hash) return false; if (u.protocol === 'https:') return true; if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]')) return true; if (u.protocol !== 'http:' && /^[a-z][a-z0-9+.-]*:$/.test(u.protocol) && u.protocol !== 'javascript:' && u.protocol !== 'data:') return u.hostname !== '' || u.pathname !== ''; return false; } catch { return false; }
}
export const isCimd = (clientId: string) => { try { const u = new URL(clientId); return u.protocol === 'https:' && u.pathname !== '/' && u.pathname !== ''; } catch { return false; } };
/** لعملاء CIMD بلا وثيقة قابلة للجلب: مضيف إعادة التوجيه يجب أن يطابق مضيف client_id (أو localhost للتطوير) */
export function clientHostOk(clientId: string, redirectUri: string): boolean {
  try { const c = new URL(clientId); const r = new URL(redirectUri); if (r.hostname === 'localhost' || r.hostname === '127.0.0.1') return true; return r.hostname === c.hostname || r.hostname.endsWith(`.${c.hostname}`); } catch { return false; }
}

export type AuthorizeParams = { client_id: string; redirect_uri: string; scopes: PScope[]; state: string; code_challenge: string; resource: string | null };
export function validateAuthorizeParams(q: Record<string, string | undefined>, site: string): { ok: true; p: AuthorizeParams } | { ok: false; error: string; error_description: string } {
  const g = (k: string) => String(q[k] || '').trim();
  if (g('response_type') !== 'code') return { ok: false, error: 'unsupported_response_type', error_description: 'response_type must be "code"' };
  const client_id = g('client_id'); if (!client_id || client_id.length > 400) return { ok: false, error: 'invalid_request', error_description: 'client_id is required' };
  const redirect_uri = g('redirect_uri'); if (!redirect_uri || !redirectOk(redirect_uri)) return { ok: false, error: 'invalid_request', error_description: 'redirect_uri must be an absolute https URL (or http://localhost)' };
  if (g('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9_-]{43}$/.test(g('code_challenge'))) return { ok: false, error: 'invalid_request', error_description: 'PKCE with code_challenge_method=S256 is required' };
  const scopes = parseScopes(g('scope')); if (!scopes.length) return { ok: false, error: 'invalid_scope', error_description: `scope must include at least one of: ${PERSONAL_SCOPES.join(' ')}` };
  const resource = g('resource') || null; if (resource && !sameUrl(resource, mcpResource(site))) return { ok: false, error: 'invalid_target', error_description: `resource must be ${mcpResource(site)}` };
  return { ok: true, p: { client_id, redirect_uri, scopes, state: g('state').slice(0, 512), code_challenge: g('code_challenge'), resource } };
}
export function redirectWith(redirectUri: string, params: Record<string, string | null | undefined>): string {
  const u = new URL(redirectUri); for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') u.searchParams.set(k, v); return u.toString();
}

// ---------------------------------------------------------------- وثائق الاكتشاف
export function asMetadata(site: string) {
  const s = site.replace(/\/+$/, '');
  return {
    issuer: s, authorization_endpoint: `${s}/oauth/authorize`, token_endpoint: `${s}/oauth/token`, registration_endpoint: `${s}/oauth/register`,
    scopes_supported: PERSONAL_SCOPES, response_types_supported: ['code'], response_modes_supported: ['query'], grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'], code_challenge_methods_supported: ['S256'], authorization_response_iss_parameter_supported: true,
    client_id_metadata_document_supported: true, resource_indicators_supported: true, service_documentation: `${s}/agents`, ui_locales_supported: ['ar', 'en'],
  };
}
export function prmMetadata(site: string) {
  const s = site.replace(/\/+$/, '');
  return { resource: `${s}/mcp`, authorization_servers: [s], scopes_supported: PERSONAL_SCOPES, bearer_methods_supported: ['header'], resource_name: 'أَثَر — Athar MCP', resource_documentation: `${s}/agents`, resource_policy_uri: `${s}/agents` };
}
export const wwwAuthenticate = (site: string, error?: string, desc?: string) => `Bearer resource_metadata="${site.replace(/\/+$/, '')}/.well-known/oauth-protected-resource/mcp"${error ? `, error="${error}"` : ''}${desc ? `, error_description="${desc.replace(/"/g, '')}"` : ''}`;

// ---------------------------------------------------------------- عرض
export const scopeLine = (scopes: PScope[]) => scopes.map(s => PSCOPE_LABEL[s]?.ar || s).join(' · ');
export function clientDisplayName(clientId: string, name?: string | null): string { if (name) return name; try { return new URL(clientId).hostname; } catch { return clientId.slice(0, 24); } }
export const AGO_AR = (ms: number) => { const m = Math.max(1, Math.round(ms / 60000)); if (m < 60) return `قبل ${m} دقيقة`; const h = Math.round(m / 60); if (h < 24) return `قبل ${h} ساعة`; return `قبل ${Math.round(h / 24)} يومًا`; };

// ---------------------------------------------------------------- التفويض الداخلي (خادم MCP ← واجهات أَثَر)
export type Delegate = { id: string; email: string; name: string; del: string; client: string; scopes: PScope[] };
export const DELEGATE_HEADER = 'x-athar-delegate';
export function delegateFromHeaders(headers: Headers, env: Record<string, string | undefined>, nowMs = Date.now()): Delegate | null {
  const h = headers.get(DELEGATE_HEADER) || ''; if (!h) return null; const c = verifyToken(h, secretFromEnv(env), nowMs, 'dg'); if (!c) return null;
  return { id: c.sub, email: c.email, name: c.name || '', del: c.del, client: c.client_name || c.client, scopes: c.scopes };
}
export function mintDelegate(d: { sub: string; email: string; name?: string; del: string; client: string; client_name?: string; scopes: PScope[] }, site: string, env: Record<string, string | undefined>, nowMs = Date.now()): string {
  const iat = Math.floor(nowMs / 1000); return signToken({ typ: 'dg', sub: d.sub, email: d.email, name: d.name, del: d.del, client: d.client, client_name: d.client_name, scopes: d.scopes, aud: site, iss: site, iat, exp: iat + DELEGATE_TTL_S }, secretFromEnv(env));
}
