// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /oauth/register — تسجيل العملاء ديناميكيًا (RFC 7591) — للتوافق مع العملاء التي لم تنتقل بعد إلى Client ID Metadata Documents (P20)
 *  POST { client_name, redirect_uris[], client_uri?, logo_uri?, software_id? } → 201 { client_id, … } — عملاء عامّون فقط (بلا سر)
 */
import { NextResponse } from 'next/server';
import { redirectOk } from '../../../lib/portal/oauth';
import { svc, newClientId } from '../../../lib/portal/oauth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const H = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
const fail = (error: string, error_description: string, status = 400) => NextResponse.json({ error, error_description }, { status, headers: H });

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: H }); }
export async function POST(req: Request) {
  const db = svc(); if (!db) return fail('server_error', 'Server not configured', 500);
  const b = await req.json().catch(() => null); if (!b || typeof b !== 'object') return fail('invalid_client_metadata', 'JSON body required');
  const uris = (Array.isArray(b.redirect_uris) ? b.redirect_uris : []).map(String).slice(0, 10); if (!uris.length || !uris.every(redirectOk)) return fail('invalid_redirect_uri', 'redirect_uris must be absolute https URLs (or http://localhost)');
  if (b.token_endpoint_auth_method && b.token_endpoint_auth_method !== 'none') return fail('invalid_client_metadata', 'Only public clients (token_endpoint_auth_method=none) are supported');
  const name = String(b.client_name || '').trim().slice(0, 120) || new URL(uris[0]).hostname;
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const { count } = await db.from('portal_oauth_clients').select('id', { count: 'exact', head: true }).eq('source', 'dcr').gte('created_at', new Date(Date.now() - 3600000).toISOString()); if ((count || 0) >= 60) return fail('temporarily_unavailable', 'Registration rate limit — try later', 429);
  const id = newClientId(); const row = { id, client_name: name, client_uri: b.client_uri ? String(b.client_uri).slice(0, 300) : null, logo_uri: b.logo_uri ? String(b.logo_uri).slice(0, 300) : null, redirect_uris: uris, source: 'dcr', software_id: b.software_id ? String(b.software_id).slice(0, 200) : `ip:${ip}`, last_seen_at: new Date().toISOString() };
  const { error } = await db.from('portal_oauth_clients').insert(row); if (error) return fail('server_error', error.message, 500);
  return NextResponse.json({ client_id: id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: name, redirect_uris: uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], application_type: b.application_type || 'web', client_uri: row.client_uri, logo_uri: row.logo_uri }, { status: 201, headers: H });
}
