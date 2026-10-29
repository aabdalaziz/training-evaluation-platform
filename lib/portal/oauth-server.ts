// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — خادم التفويض (P20): الطبقة التي تلمس قاعدة البيانات — العملاء (DCR / CIMD) · التفويضات · الأكواد · إصدار الرموز وتجديدها
 *  الجداول: portal_oauth_clients · portal_delegations · portal_oauth_codes (688)
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { signToken, secretFromEnv, sha256hex, newSecret, isCimd, clientHostOk, redirectOk, mcpResource, ACCESS_TTL_S, REFRESH_TTL_S } from './oauth';
import type { PScope } from './oauth';

export const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
export async function who(req: Request, db: any): Promise<{ id: string; email: string; name: string } | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') };
}

export type ClientInfo = { client_id: string; client_name: string; client_uri: string | null; logo_uri: string | null; redirect_uris: string[]; source: 'dcr' | 'cimd' | 'manual' | 'cimd-unverified'; registered: boolean };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** يعرّف العميل: مسجَّل (DCR) أو وثيقة بيانات عميل (CIMD: client_id = رابط https لوثيقة JSON) — مع تحقق إعادة التوجيه */
export async function clientInfo(db: any, clientId: string, redirectUri?: string): Promise<{ ok: true; c: ClientInfo } | { ok: false; error: string; error_description: string }> {
  if (UUID.test(clientId)) {
    const { data } = await db.from('portal_oauth_clients').select('id,client_name,client_uri,logo_uri,redirect_uris,source').eq('id', clientId).maybeSingle(); if (!data) return { ok: false, error: 'invalid_client', error_description: 'Unknown client_id' };
    const c: ClientInfo = { client_id: clientId, client_name: (data as any).client_name, client_uri: (data as any).client_uri || null, logo_uri: (data as any).logo_uri || null, redirect_uris: (data as any).redirect_uris || [], source: (data as any).source || 'dcr', registered: true };
    if (redirectUri && !c.redirect_uris.includes(redirectUri)) return { ok: false, error: 'invalid_request', error_description: 'redirect_uri is not registered for this client' };
    return { ok: true, c };
  }
  if (isCimd(clientId)) {
    let doc: any = null; try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3500); const r = await fetch(clientId, { headers: { Accept: 'application/json' }, signal: ctrl.signal, cache: 'no-store' }); clearTimeout(t); if (r.ok) doc = await r.json(); } catch { doc = null; }
    if (doc && String(doc.client_id || '') === clientId) {
      const uris = (Array.isArray(doc.redirect_uris) ? doc.redirect_uris : []).map(String).filter(redirectOk);
      if (redirectUri && !uris.includes(redirectUri)) return { ok: false, error: 'invalid_request', error_description: 'redirect_uri is not listed in the client metadata document' };
      const c: ClientInfo = { client_id: clientId, client_name: String(doc.client_name || new URL(clientId).hostname).slice(0, 120), client_uri: doc.client_uri ? String(doc.client_uri).slice(0, 300) : null, logo_uri: doc.logo_uri ? String(doc.logo_uri).slice(0, 300) : null, redirect_uris: uris, source: 'cimd', registered: false };
      try { await db.from('portal_oauth_clients').upsert({ id: idFor(clientId), client_name: c.client_name, client_uri: c.client_uri, logo_uri: c.logo_uri, redirect_uris: uris, source: 'cimd', software_id: clientId, last_seen_at: new Date().toISOString() }, { onConflict: 'id' }); } catch { /* تجاهل */ }
      return { ok: true, c };
    }
    if (redirectUri && !clientHostOk(clientId, redirectUri)) return { ok: false, error: 'invalid_request', error_description: 'Could not fetch client metadata; redirect_uri host must match client_id host' };
    return { ok: true, c: { client_id: clientId, client_name: new URL(clientId).hostname, client_uri: null, logo_uri: null, redirect_uris: redirectUri ? [redirectUri] : [], source: 'cimd-unverified', registered: false } };
  }
  return { ok: false, error: 'invalid_client', error_description: 'client_id must be a registered id (POST /oauth/register) or an https client metadata URL' };
}
/** معرّف ثابت لعميل CIMD (UUID v5-شكلًا من تجزئة الرابط) — للتخزين فقط */
export function idFor(clientId: string): string { const h = sha256hex(clientId).slice(0, 32); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; }

export type DelegationRow = { id: string; user_id: string; email: string; client_id: string; client_name: string; scopes: PScope[]; revoked_at: string | null; refresh_hash: string | null; refresh_expires_at: string | null };
export async function issueTokens(db: any, d: DelegationRow, site: string, name: string, nowMs = Date.now()) {
  const iat = Math.floor(nowMs / 1000); const secret = secretFromEnv(process.env); const jti = randomUUID();
  const access_token = signToken({ typ: 'at', sub: d.user_id, email: d.email, name, del: d.id, client: d.client_id, client_name: d.client_name, scopes: d.scopes, aud: mcpResource(site), iss: site, iat, exp: iat + ACCESS_TTL_S }, secret);
  const refresh_token = signToken({ typ: 'rt', sub: d.user_id, email: d.email, name, del: d.id, client: d.client_id, client_name: d.client_name, scopes: d.scopes, aud: mcpResource(site), iss: site, iat, exp: iat + REFRESH_TTL_S, jti }, secret);
  await db.from('portal_delegations').update({ refresh_hash: sha256hex(refresh_token), refresh_expires_at: new Date((iat + REFRESH_TTL_S) * 1000).toISOString() }).eq('id', d.id);
  return { access_token, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token, scope: d.scopes.join(' ') };
}
export const newClientId = () => randomUUID();
export const newCode = () => newSecret(32);
