// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/** /gate/p/<code> — رابط التصريح من البريد: يضبط كعكة athar_gate على هذا الجهاز ثمّ يحوّل إلى المنتج (أو إلى صفحة البوّابة برسالة عند الخطأ). */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GATE_COOKIE, cookieAttrs, isCode, normalizeCode, payloadForPermits, signGate, findProduct, DEFAULT_PRODUCTS } from '../../../../lib/portal/gate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { code: string } }) {
  const origin = new URL(req.url).origin; const code = normalizeCode(params.code);
  const fail = (slug: string | null, why: string) => NextResponse.redirect(`${origin}/gate/${slug || 'iqra'}?code_error=${encodeURIComponent(why)}`, 303);
  if (!isCode(code)) return fail(null, 'bad');
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return fail(null, 'server');
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: p } = await db.from('portal_gate_permits').select('id, product, email, expires_at, revoked_at, uses').eq('code', code).maybeSingle();
  if (!p) return fail(null, 'notfound');
  const payload = payloadForPermits([p as any], String((p as any).email)); if (!payload) return fail(String((p as any).product), (p as any).revoked_at ? 'revoked' : 'expired');
  await db.from('portal_gate_permits').update({ uses: Number((p as any).uses || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', (p as any).id);
  const { data: prods } = await db.from('portal_gate_products').select('*'); const product = findProduct(String((p as any).product), Array.isArray(prods) && prods.length ? (prods as any) : DEFAULT_PRODUCTS);
  const res = NextResponse.redirect(`${origin}${product?.entry_path || '/'}`, 303);
  res.headers.append('Set-Cookie', `${GATE_COOKIE}=${encodeURIComponent(await signGate(payload, process.env as any))}; ${cookieAttrs(payload.e - Math.floor(Date.now() / 1000), true, !/^http:\/\/(localhost|127\.)/.test(origin))}`);
  return res;
}
