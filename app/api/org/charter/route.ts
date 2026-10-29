// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/charter — «ميثاق الجهة» (P24)
 *  GET ?public=1                         → عام: الجهات الموقِّعة الفعّالة (اسم · تاريخ · رمز التحقق) + البنود — CORS · كاش 5 دقائق
 *  GET ?code=ATH-OC-…  | ?org_name=…     → عام: هل هذه الجهة موقِّعة؟ (للوكلاء والجهات الأخرى)
 *  GET ?org=ID                           → مدير الجهة/الطاقم: حالة ميثاق الجهة + البنود + سجل التوقيعات
 *  POST { action:'sign', org, accepted:[ids], confirm:true, signer_title? } → توقيع/تجديد (مدير جهة مؤكَّد أو طاقم نيابةً) → وثيقة Ed25519 + شارة عامة
 *  POST { action:'revoke', org, confirm:true }                              → سحب الميثاق (تختفي الشارة فورًا وتُلغى الوثيقة)
 */
import { NextResponse } from 'next/server';
import { orgCtx, svc, siteOf, isOrgAdmin } from '../../../../lib/org-impact/auth';
import { currentCharter, signCharter, revokeCharter, charterBadges } from '../../../../lib/org-impact/charter';
import { ORG_CHARTER_AR, ORG_CHARTER_VERSION, ORG_CHARTER_MONTHS, ORG_CHARTER_COLS, charterState, validateCharterSign } from '../../../../lib/org-impact/registry';
import type { OrgCharter } from '../../../../lib/org-impact/registry';
import { signerFromEnv } from '../../../../lib/portal/vc-server';
import { didWeb } from '../../../../lib/portal/vc';
import { randomCode } from '../../../../lib/portal/profile';
import { limitFor, tooMany, ipOf } from '../../../../lib/shield/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const PUB = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' };
const norm = (s: string) => String(s || '').toLowerCase().replace(/[\u064B-\u0652\u0640]/g, '').replace(/[إأآ]/g, 'ا').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

export async function GET(req: Request) {
  const u = new URL(req.url); const code = String(u.searchParams.get('code') || '').trim().toUpperCase(); const orgName = String(u.searchParams.get('org_name') || '').trim();
  if (u.searchParams.get('public') === '1' || code || orgName) {
    const db = svc(); if (!db) return NextResponse.json({ success: false, error: 'server' }, { status: 500 }); const site = siteOf(req);
    const badges = (await charterBadges(db)).map(b => ({ ...b, verify_url: b.code ? `${site}/verify/vc?code=${encodeURIComponent(b.code)}` : null }));
    if (code || orgName) {
      const hit = badges.find(b => (code && b.code === code) || (orgName && (norm(b.org_name) === norm(orgName) || norm(b.org_name).includes(norm(orgName)))));
      return NextResponse.json({ success: true, signed: !!hit, charter: hit || null, query: code || orgName, version: ORG_CHARTER_VERSION, note_ar: hit ? 'جهة موقِّعة على ميثاق الجهة في مجالس أَثَر — الوثيقة موقَّعة Ed25519 وقابلة للتحقق.' : 'لا ميثاق فعّالًا لهذه الجهة (أو الاسم غير مطابق). الجهات الموقِّعة تُعرض في /councils.' }, { headers: PUB });
    }
    return NextResponse.json({ success: true, version: ORG_CHARTER_VERSION, months: ORG_CHARTER_MONTHS, clauses: ORG_CHARTER_AR, orgs: badges, generated_at: new Date().toISOString() }, { headers: PUB });
  }
  const c = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in c) return c.error; const { db, org, site } = c;
  const cur = await currentCharter(db, org.id); const st = charterState(cur);
  const { data: hist } = await db.from('portal_org_charters').select(ORG_CHARTER_COLS).eq('organization_id', org.id).order('signed_at', { ascending: false }).limit(12);
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar }, state: st, charter: cur ? { ...cur, verify_url: cur.vc_code ? `${site}/verify/vc?code=${encodeURIComponent(cur.vc_code)}` : null } : null, history: ((hist || []) as OrgCharter[]).map(h => ({ id: h.id, version: h.version, signed_at: h.signed_at, expires_at: h.expires_at, status: h.status, signer_title: h.signer_title, vc_code: h.vc_code })), clauses: ORG_CHARTER_AR, version: ORG_CHARTER_VERSION, months: ORG_CHARTER_MONTHS, signing_ready: !!process.env.VC_SIGNING_KEY, public_page: `${site}/councils#orgs` }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: Request) {
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const c = await orgCtx(req, String(body.org || '')); if ('error' in c) return c.error; const { db, me, org, site } = c;
  { const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl); }
  const action = String(body.action || '');
  if (action === 'sign') {
    const err = validateCharterSign(body); if (err) return NextResponse.json({ success: false, error: err }, { status: 400 });
    const signer = signerFromEnv(process.env, site);
    const r = await signCharter(db, org, { id: me.id, email: me.email, name: me.name, title: body.signer_title ? String(body.signer_title).slice(0, 120) : null, staff: me.staff && !(await isOrgAdmin(db, org.id, me)) }, signer, site, didWeb(site), () => randomCode(4));
    if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 409 });
    return NextResponse.json({ success: true, charter: r.charter, verify_url: r.verify_url, signed_vc: r.signed_vc, message: r.signed_vc ? 'وُقِّع ميثاق الجهة وصدرت وثيقته الموقَّعة — شارتكم تظهر الآن في /councils ويرى منسوبوكم أن جهتهم وقّعت.' : 'سُجِّل الميثاق — وستصدر وثيقته الموقَّعة حين يُضبط مفتاح التوقيع.' });
  }
  if (action === 'revoke') {
    if (body.confirm !== true) return NextResponse.json({ success: false, error: 'يلزم تأكيد صريح' }, { status: 400 });
    const r = await revokeCharter(db, org.id, me); if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: 409 });
    return NextResponse.json({ success: true, message: 'سُحب الميثاق — اختفت الشارة وأُلغيت الوثيقة.' });
  }
  return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
}
