// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/oauth — شاشة الموافقة و«وكلائي» (P20 سفارة أَثَر) — كل النداءات بجلسة المستخدم (Bearer)
 *  GET                                   → تفويضاتي (العملاء، النطاقات، آخر استخدام) + آخر 30 نداءً شخصيًا من السجل
 *  POST { action:'describe', ...params } → يتحقق من معاملات التفويض ويعرّف العميل (DCR/CIMD) ويعيد النطاقات بلغة بشرية — قبل العرض
 *  POST { action:'approve', ...params }  → يُنشئ/يحدّث التفويض ويصدر كودًا (5 دقائق) ويعيد رابط إعادة التوجيه (مع state و iss)
 *  POST { action:'deny', ...params }     → رابط إعادة التوجيه بخطأ access_denied
 *  POST { action:'revoke', id }          → إبطال فوري (الرموز الحية ترفض عند أول نداء)
 */
import { NextResponse } from 'next/server';
import { normalizeSite } from '../../../lib/portal/open';
import { validateAuthorizeParams, redirectWith, sha256hex, PSCOPE_LABEL, CODE_TTL_S, AGO_AR } from '../../../lib/portal/oauth';
import { limitFor, ipOf, tooMany } from '../../../lib/shield/ratelimit';
import { securityEvent, burst } from '../../../lib/shield/guard';
import { readJson } from '../../../lib/shield/body';
import { svc, who, clientInfo, newCode } from '../../../lib/portal/oauth-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const TOOL_AR: Record<string, string> = { my_wallet: 'قرأ محفظتك', my_data_summary: 'قرأ موجز بياناتك (الخزنة)', my_daily: 'موقف اليوم', my_missions: 'قرأ مهامك', issue_snapshot: 'أصدر لقطة قدرة', discover_programs: 'استكشف البرامج', verify_credential: 'تحقق من شهادة', capability_trend: 'قرأ مؤشر الأداء' };

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401);
  const [{ data: dels }, { data: log }] = await Promise.all([
    db.from('portal_delegations').select('id,created_at,client_id,client_name,scopes,last_used_at,uses,revoked_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    db.from('portal_agent_log').select('at,tool,ok,meta').contains('meta', { transport: 'mcp', user: user.id }).order('at', { ascending: false }).limit(30),
  ]);
  const now = Date.now();
  return NextResponse.json({ success: true, delegations: ((dels || []) as any[]).map(d => ({ ...d, scope_labels: (d.scopes || []).map((s: string) => (PSCOPE_LABEL as any)[s]?.ar || s) })), log: ((log || []) as any[]).map(r => ({ at: r.at, tool: r.tool, ok: r.ok, client: r.meta?.client || '—', line: `${r.meta?.client || 'وكيل'} ${TOOL_AR[r.tool] || r.tool}${r.ok ? '' : ' — رُفض'} · ${AGO_AR(now - new Date(r.at).getTime())}` })) });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401);
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin); const ip = ipOf(req);
  const rj = await readJson(req, { maxBytes: 16 * 1024, allowEmpty: true }); if (!rj.ok) return bad(rj.error, rj.status); const body = rj.body || {}; const action = String(body?.action || '');
  if (action === 'describe') { const rl = await limitFor(db, 'oauth_describe_ip', ip); if (!rl.allowed) return tooMany(rl); }
  if (action === 'revoke') { const id = String(body?.id || ''); if (!id) return bad('معرّف ناقص'); const { error } = await db.from('portal_delegations').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id); if (error) return bad(error.message, 500); await securityEvent(db, { severity: 'info', kind: 'delegation_revoked', actor: id.slice(0, 8), ip, user_id: user.id, user_email: user.email }); return NextResponse.json({ success: true }); }
  const v = validateAuthorizeParams(body?.params || {}, site); if (!v.ok) return NextResponse.json({ success: false, error: v.error_description, oauth_error: v.error }, { status: 400 });
  const p = v.p; const ci = await clientInfo(db, p.client_id, p.redirect_uri); if (!ci.ok) { if (ci.error === 'invalid_request' || /redirect/i.test(ci.error_description || '')) await burst(db, `bad_redirect:${ip}`, 3600, 2, { severity: 'warn', kind: 'bad_redirect', actor: p.client_id, ip, user_id: user.id, meta: { redirect_uri: p.redirect_uri } }); return NextResponse.json({ success: false, error: ci.error_description, oauth_error: ci.error }, { status: 400 }); }
  const c = ci.c;
  if (action === 'describe') {
    const { data: prev } = await db.from('portal_delegations').select('id,scopes,created_at').eq('user_id', user.id).eq('client_id', p.client_id).is('revoked_at', null).maybeSingle();
    return NextResponse.json({ success: true, client: { id: c.client_id, name: c.client_name, uri: c.client_uri, logo: c.logo_uri, verified: c.source !== 'cimd-unverified', source: c.source, redirect_host: new URL(p.redirect_uri).hostname }, scopes: p.scopes.map(s => ({ key: s, ...PSCOPE_LABEL[s] })), user: { name: user.name, email: user.email }, previous: prev || null, resource: p.resource });
  }
  if (action === 'deny') return NextResponse.json({ success: true, redirect: redirectWith(p.redirect_uri, { error: 'access_denied', error_description: 'The user declined', state: p.state, iss: site }) });
  if (action === 'approve') {
    const { data: prev } = await db.from('portal_delegations').select('id').eq('user_id', user.id).eq('client_id', p.client_id).is('revoked_at', null).maybeSingle();
    let delegationId = (prev as any)?.id as string | undefined;
    if (delegationId) { const { error } = await db.from('portal_delegations').update({ scopes: p.scopes, client_name: c.client_name }).eq('id', delegationId); if (error) return bad(error.message, 500); }
    else { const { data: ins, error } = await db.from('portal_delegations').insert({ user_id: user.id, email: user.email, client_id: p.client_id, client_name: c.client_name, scopes: p.scopes }).select('id').maybeSingle(); if (error || !ins) return bad(error?.message || 'تعذّر الحفظ', 500); delegationId = (ins as any).id; }
    const code = newCode(); const { error: ce } = await db.from('portal_oauth_codes').insert({ code_hash: sha256hex(code), delegation_id: delegationId, client_id: p.client_id, redirect_uri: p.redirect_uri, code_challenge: p.code_challenge, resource: p.resource, scopes: p.scopes, expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString() }); if (ce) return bad(ce.message, 500);
    await securityEvent(db, { severity: 'info', kind: 'delegation_created', actor: c.client_name || p.client_id, ip, user_id: user.id, user_email: user.email, meta: { client: p.client_id, scopes: p.scopes, renewed: !!(prev as any)?.id } });
    return NextResponse.json({ success: true, redirect: redirectWith(p.redirect_uri, { code, state: p.state, iss: site }) });
  }
  return bad('إجراء غير معروف');
}
