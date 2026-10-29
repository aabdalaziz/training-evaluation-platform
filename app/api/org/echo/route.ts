// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/org/echo — «صدى الجهة» (P24) — مدير الجهة المؤكَّد أو الطاقم
 *  GET ?org=ID            → الخيوط المجهولة (k ≥ 5) + مرآة الجهة (مقابل ربعها السابق) + الإحاطة المحلية
 *  GET ?org=ID&brief=ai   → الإحاطة بالذكاء الاصطناعي على أرقام ونصوص مجهولة فقط (وبدونه محلية)
 *  لا أسماء ولا بُرُد ولا نص قضية يغادر هذا المسار. no-store.
 */
import { NextResponse } from 'next/server';
import { orgCtx } from '../../../../lib/org-impact/auth';
import { orgEcho, orgBrief } from '../../../../lib/org-impact/echo';
import { localBrief, ECHO_DAYS, MIRROR_DAYS, K_ORG } from '../../../../lib/org-impact/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const u = new URL(req.url); const c = await orgCtx(req, String(u.searchParams.get('org') || '')); if ('error' in c) return c.error;
  const { db, me, org } = c; const now = Date.now();
  const echo = await orgEcho(db, org.id, now);
  const brief = u.searchParams.get('brief') === 'ai' ? await orgBrief(db, org.name_ar, echo, me) : { text: localBrief(org.name_ar, echo), source: 'local' as const, model: null, seconds: 0 };
  if (!brief.seconds) brief.seconds = Math.round(brief.text.split(/\s+/).length / 2.1);
  return NextResponse.json({ success: true, org: { id: org.id, name_ar: org.name_ar }, echo, brief, rules: { k: K_ORG, echo_days: ECHO_DAYS, mirror_days: MIRROR_DAYS } }, { headers: { 'Cache-Control': 'no-store' } });
}
