// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /oauth/token — نقطة الرموز (OAuth 2.1 · P20 سفارة أَثَر)
 *  POST (x-www-form-urlencoded أو JSON) grant_type=authorization_code { code, code_verifier, redirect_uri, client_id, resource? } → { access_token, token_type, expires_in, refresh_token, scope }
 *  POST grant_type=refresh_token { refresh_token, client_id } → رموز جديدة (رمز التجديد يُستبدل؛ القديم يبطل)
 *  عملاء عامّون (PKCE إلزامي) · الأخطاء بصيغة RFC 6749 · Cache-Control: no-store
 */
import { NextResponse } from 'next/server';
import { normalizeSite } from '../../../lib/portal/open';
import { pkceOk, sha256hex, verifyToken, secretFromEnv, mcpResource } from '../../../lib/portal/oauth';
import { svc, issueTokens } from '../../../lib/portal/oauth-server';
import type { DelegationRow } from '../../../lib/portal/oauth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store', Pragma: 'no-cache' };
const fail = (error: string, error_description: string, status = 400) => NextResponse.json({ error, error_description }, { status, headers: H });
const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '').toLowerCase() === b.replace(/\/+$/, '').toLowerCase();

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: H }); }
export async function POST(req: Request) {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin); const db = svc(); if (!db) return fail('server_error', 'Server not configured', 500);
  let p: Record<string, string> = {}; const ct = req.headers.get('content-type') || '';
  try { if (ct.includes('application/json')) { const j = await req.json(); for (const [k, v] of Object.entries(j || {})) p[k] = String(v ?? ''); } else { const t = await req.text(); p = Object.fromEntries(new URLSearchParams(t).entries()); } } catch { return fail('invalid_request', 'Malformed body'); }
  if (p.client_secret) return fail('invalid_client', 'Public clients only — do not send client_secret', 401);
  const grant = p.grant_type || '';
  if (grant === 'authorization_code') {
    const code = String(p.code || ''); if (!code || !p.code_verifier || !p.redirect_uri) return fail('invalid_request', 'code, code_verifier and redirect_uri are required');
    const { data: row } = await db.from('portal_oauth_codes').select('code_hash,delegation_id,client_id,redirect_uri,code_challenge,resource,scopes,expires_at,used_at').eq('code_hash', sha256hex(code)).maybeSingle(); const c = row as any;
    if (!c) return fail('invalid_grant', 'Unknown code'); if (c.used_at) { await db.from('portal_delegations').update({ revoked_at: new Date().toISOString() }).eq('id', c.delegation_id); return fail('invalid_grant', 'Code already used — authorization revoked as a precaution'); }
    if (new Date(c.expires_at).getTime() < Date.now()) return fail('invalid_grant', 'Code expired');
    if (p.client_id && p.client_id !== c.client_id) return fail('invalid_grant', 'client_id mismatch'); if (c.redirect_uri !== p.redirect_uri) return fail('invalid_grant', 'redirect_uri mismatch');
    if (!pkceOk(p.code_verifier, c.code_challenge)) return fail('invalid_grant', 'PKCE verification failed');
    if (p.resource && !sameUrl(p.resource, mcpResource(site))) return fail('invalid_target', `resource must be ${mcpResource(site)}`);
    await db.from('portal_oauth_codes').update({ used_at: new Date().toISOString() }).eq('code_hash', c.code_hash);
    const { data: d } = await db.from('portal_delegations').select('id,user_id,email,client_id,client_name,scopes,revoked_at,refresh_hash,refresh_expires_at').eq('id', c.delegation_id).maybeSingle(); if (!d || (d as any).revoked_at) return fail('invalid_grant', 'Authorization not found or revoked');
    const { data: prof } = await db.from('profiles').select('full_name').eq('id', (d as any).user_id).maybeSingle();
    return NextResponse.json(await issueTokens(db, d as DelegationRow, site, String((prof as any)?.full_name || '')), { headers: H });
  }
  if (grant === 'refresh_token') {
    const rt = String(p.refresh_token || ''); const claims = verifyToken(rt, secretFromEnv(process.env), Date.now(), 'rt'); if (!claims) return fail('invalid_grant', 'Invalid or expired refresh token');
    if (p.client_id && p.client_id !== claims.client) return fail('invalid_grant', 'client_id mismatch');
    const { data: d } = await db.from('portal_delegations').select('id,user_id,email,client_id,client_name,scopes,revoked_at,refresh_hash,refresh_expires_at').eq('id', claims.del).maybeSingle(); const dd = d as DelegationRow | null;
    if (!dd || dd.revoked_at) return fail('invalid_grant', 'Authorization revoked');
    if (dd.refresh_hash !== sha256hex(rt)) { await db.from('portal_delegations').update({ revoked_at: new Date().toISOString() }).eq('id', dd.id); return fail('invalid_grant', 'Refresh token reuse detected — authorization revoked'); }
    return NextResponse.json(await issueTokens(db, dd, site, claims.name || ''), { headers: H });
  }
  return fail('unsupported_grant_type', 'Use authorization_code or refresh_token');
}
