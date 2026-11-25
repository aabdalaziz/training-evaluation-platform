// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/**
 * وسيط «تصاريح الدخول» (P79) — يعمل على مسارات المنتجات فقط (انظر config.matcher) ولا يمسّ بقيّة الموقع ولا /api.
 *  1) حالة المنتج من portal_gate_products (REST بمفتاح anon، مخبّأة 60 ثانية في الذاكرة؛ وعند التعذّر: الافتراضيات في lib/portal/gate.ts).
 *  2) كعكة athar_gate (طاقم أو تصريح) تفتح دائمًا · open يمرّ · closed يُحوَّل · permit: تجربة سارية تمرّ، وإلا /gate/<المنتج>.
 *  لا جلسات Supabase هنا — الهويّة تُترجم إلى كعكة موقّعة من /api/gate (unlock/redeem/trial).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_PRODUCTS, GATE_COOKIE, TRIAL_COOKIE, TRIAL_DONE_COOKIE, decide, findProduct, parseTrialDone, productOfPath, verifyGate, type GateProduct } from './lib/portal/gate';

export const config = { matcher: ['/iqra/:path*', '/kids/:path*', '/sim/:path*', '/live/:path*', '/on-air/:path*'] };

let cache: { at: number; list: GateProduct[] } | null = null;
async function products(): Promise<GateProduct[]> {
  const now = Date.now(); if (cache && now - cache.at < 60_000) return cache.list;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return DEFAULT_PRODUCTS;
  try {
    const r = await fetch(`${url.replace(/\/+$/, '')}/rest/v1/portal_gate_products?select=slug,name_ar,name_en,mode,trial_seconds,entry_path,trial_path,message_ar,sort`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const list = (await r.json()) as GateProduct[]; if (!Array.isArray(list) || !list.length) throw new Error('empty');
    cache = { at: now, list }; return list;
  } catch { cache = { at: now - 45_000, list: cache?.list || DEFAULT_PRODUCTS }; return cache.list; } // إعادة المحاولة بعد 15 ثانية
}

export async function middleware(req: NextRequest) {
  const slug = productOfPath(req.nextUrl.pathname); if (!slug) return NextResponse.next();
  const product = findProduct(slug, await products()); if (!product) return NextResponse.next();
  if (product.mode === 'open' && !req.cookies.get(TRIAL_COOKIE)) return NextResponse.next(); // الطريق السريع
  const env = process.env as Record<string, string | undefined>;
  const gate = await verifyGate(req.cookies.get(GATE_COOKIE)?.value, env);
  const trial = await verifyGate(req.cookies.get(TRIAL_COOKIE)?.value, env);
  const d = decide({ product, gate, trial, trialDone: parseTrialDone(req.cookies.get(TRIAL_DONE_COOKIE)?.value), pathname: req.nextUrl.pathname });
  if (d.allow) { const res = NextResponse.next(); res.headers.set('x-athar-gate', d.via); return res; }
  const to = req.nextUrl.clone(); const [path, qs] = d.redirect.split('?'); to.pathname = path; to.search = qs ? `?${qs}` : '';
  const res = NextResponse.redirect(to, 307);
  if (d.reason === 'trial_expired' || (d.reason === 'permit' && trial && trial.p.includes(slug))) res.cookies.set(TRIAL_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
