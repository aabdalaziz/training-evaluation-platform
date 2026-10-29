// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/shield/csp — مستقبِل تقارير CSP (Report-Only أولًا) — درع أَثَر P21
 *  يقبل application/csp-report و application/reports+json؛ يحفظ حدثًا مجهّلًا (المصدر المحظور + الموجّه) بحد 30/دقيقة لكل IP،
 *  ويتجاهل ضوضاء الإضافات (chrome-extension:, moz-extension:, about:, data: inline في الإضافات).
 */
import { readJson } from '../../../../lib/shield/body';
import { limitFor, ipOf } from '../../../../lib/shield/ratelimit';
import { securityEvent } from '../../../../lib/shield/guard';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;
const NOISE = /^(chrome|moz|safari|ms-browser)-extension:|^about:|^eval$|^inline$|^wasm-eval$|^data$/i;

export async function POST(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !K) return new Response(null, { status: 204 });
  const db = createClient(U, K, { auth: { persistSession: false } }); const ip = ipOf(req);
  const rl = await limitFor(db, 'csp_ip', ip); if (!rl.allowed) return new Response(null, { status: 204 });
  const r = await readJson(req, { maxBytes: 16 * 1024 }); if (!r.ok) return new Response(null, { status: 204 });
  const items: any[] = Array.isArray(r.body) ? r.body : [r.body];
  let saved = 0;
  for (const it of items.slice(0, 5)) {
    const b = it?.['csp-report'] || it?.body || it || {};
    const blocked = String(b['blocked-uri'] || b.blockedURL || b.blockedURI || '').slice(0, 200); const directive = String(b['violated-directive'] || b.effectiveDirective || b['effective-directive'] || '').slice(0, 80);
    const doc = String(b['document-uri'] || b.documentURL || '').replace(/[?#].*$/, '').slice(0, 200); const disposition = String(b.disposition || 'report');
    if (!directive || NOISE.test(blocked)) continue;
    await securityEvent(db, { severity: 'info', kind: 'csp_report', actor: directive, ip, meta: { blocked, directive, document: doc, disposition, ua: String(req.headers.get('user-agent') || '').slice(0, 120) } });
    saved++;
  }
  return new Response(null, { status: 204, headers: { 'X-Saved': String(saved) } });
}
export async function OPTIONS() { return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } }); }
