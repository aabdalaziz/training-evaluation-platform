// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /.well-known/did.json — وثيقة هوية المُصدِر did:web:<host> (أَثَر · P17 «محفظة القدرة السيادية»)
 * تنشر المفاتيح العامة (Multikey / Ed25519) الحالية والمتقاعدة؛ بها يتحقق أي طرف من توقيع شهادات أَثَر دون الرجوع إلينا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { didDocument, didWeb } from '../../../lib/portal/vc';
import { ensureKeyRow, signerFromEnv } from '../../../lib/portal/vc-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEADERS = { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600', 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/did+json; charset=utf-8' };
export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: { ...HEADERS, 'Access-Control-Allow-Methods': 'GET, OPTIONS' } }); }
export async function GET(req: Request) {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin); const did = didWeb(site);
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keys: { kid: string; publicKeyMultibase: string; retired_at?: string | null }[] = [];
  const signer = signerFromEnv(process.env, site); if (signer) keys.push({ kid: signer.kid, publicKeyMultibase: signer.multibase });
  if (URL_ && SERVICE) {
    try { const db = createClient(URL_, SERVICE, { auth: { persistSession: false } }); if (signer) await ensureKeyRow(db, signer); const { data } = await db.from('portal_signing_keys').select('kid,public_key_multibase,retired_at').order('created_at', { ascending: false }).limit(50);
      for (const r of (data || []) as any[]) if (!keys.some(k => k.kid === r.kid)) keys.push({ kid: r.kid, publicKeyMultibase: r.public_key_multibase, retired_at: r.retired_at }); } catch { /* نكتفي بمفتاح البيئة */ }
  }
  return new NextResponse(JSON.stringify(didDocument(did, keys, site), null, 2), { headers: HEADERS });
}
