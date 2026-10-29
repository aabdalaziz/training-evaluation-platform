// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مرصد القدرة البشرية (P18) — واجهة البيانات المفتوحة + غرفة التحرير + اشتراك الجهات
 *  GET  (عام)  /api/observatory                      → آخر لقطة (JSON، CC BY 4.0، s-maxage)
 *  GET  (عام)  ?format=csv                            → اللقطة نفسها CSV
 *  GET  (عام)  ?issues=1                              → قائمة الأعداد الربعية المنشورة
 *  GET  (عام)  ?issue=2026-Q4[&format=csv|vc]         → عدد منشور (بياناته المجمَّدة + افتتاحيته + وثيقته الموقَّعة)
 *  GET  (دخول) ?view=org&org=<uuid>                   → موقع الجهة مقابل قطاعها (مدير جهة مؤكَّد أو طاقم) + حالة اشتراكها
 *  GET  (طاقم) ?view=admin                            → غرفة التحرير: آخر لقطة + سجل الكتم + المسودة الحالية + قائمة فحص الخصوصية + الأعداد
 *  POST (طاقم) { action:'refresh' }                   → حساب لقطة جديدة الآن
 *  POST (طاقم) { action:'draft', quarter, editorial_ar, suppressed[] } → حفظ مسودة العدد (من آخر لقطة)
 *  POST (طاقم) { action:'publish', quarter }          → اعتماد ونشر: تجميد البيانات + توقيع VC (إن وُجد المفتاح) + تسجيل في portal_vc_issuances (kind=dataset)
 *  POST (مدير جهة) { action:'org_prefs', org, watch?, public? } → «أبلغني حين يتغيّر مؤشر أداء قطاعي» / «مساهم في المرصد»
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { computeSnapshot, orgPosition, applySuppression, buildIssueDoc, issueCode, quarterOf, snapshotCsv, K_PERSONS, K_ORGS } from '../../../lib/portal/observatory';
import type { Snapshot } from '../../../lib/portal/observatory';
import { loadObsInput, latestSnapshot, runObservatory } from '../../../lib/portal/observatory-cron';
import { didWeb, documentDigest } from '../../../lib/portal/vc';
import { ensureKeyRow, sha256, signDocument, signerFromEnv } from '../../../lib/portal/vc-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QTR = /^\d{4}-Q[1-4]$/;
const OPEN = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=86400', 'X-License': 'CC-BY-4.0 Athar Human Capability Observatory' };
const ISSUE_COLS = 'id,quarter,status,editorial_ar,data,suppressed,vc,vc_code,prev_issue_id,published_at,created_at,updated_at';

function service() { const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!URL_ || !SERVICE) return null; return createClient(URL_, SERVICE, { auth: { persistSession: false } }); }
async function who(req: Request, db: any): Promise<{ id: string; email: string; staff: boolean } | null> {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !URL_ || !ANON) return null; const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function isOrgAdmin(db: any, user: { id: string; email: string }, orgId: string) {
  const { data } = await db.from('portal_org_members').select('id,role').eq('organization_id', orgId).eq('status', 'confirmed').or(`user_id.eq.${user.id},email.ilike.${user.email}`).limit(5);
  return ((data || []) as any[]).some(m => m.role === 'org_admin');
}
async function snapshotOrCompute(db: any): Promise<{ snap: Snapshot; stored: boolean; computed_at: string }> {
  const last = await latestSnapshot(db); if (last?.data?.sectors) return { snap: last.data, stored: true, computed_at: last.computed_at };
  const snap = computeSnapshot(await loadObsInput(db)); return { snap, stored: false, computed_at: snap.computed_at };
}
const csvResponse = (csv: string, name: string) => new NextResponse(csv, { status: 200, headers: { ...OPEN, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` } });
/** قائمة فحص الخصوصية — تُحسب آليًا على اللقطة قبل النشر */
function privacyChecks(s: Snapshot) {
  const txt = JSON.stringify(s); const cells = [...s.sectors.filter(x => x.cell), ...s.domains.filter(x => x.cell)];
  return [
    { key: 'k_persons', ok: s.sectors.every(x => !x.cell || x.cell.people !== undefined), ar: `كل خلية منشورة تمثل ${K_PERSONS} أشخاص فأكثر (شرائح فقط)` },
    { key: 'k_orgs', ok: s.sectors.every(x => !x.cell || x.cell.orgs !== undefined), ar: `كل خلية قطاعية تمثل ${K_ORGS} جهة فأكثر` },
    { key: 'no_ids', ok: !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(txt.replace(/"skill_id":"[^"]*"/g, '')), ar: 'لا معرّفات أشخاص أو جهات في البيانات' },
    { key: 'no_email', ok: !/@[a-z0-9.-]+\.[a-z]{2,}/i.test(txt), ar: 'لا عناوين بريد في البيانات' },
    { key: 'rounded', ok: cells.every(x => x.cell!.index % 5 === 0), ar: 'كل المؤشرات مقرَّبة إلى أقرب 5' },
    { key: 'logged', ok: true, ar: `كل كتم مسجَّل بسببه (${s.suppressed_log.length} سجل)` },
  ];
}

export async function GET(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const u = new URL(req.url); const site = siteOf(req);
  const view = u.searchParams.get('view') || ''; const format = u.searchParams.get('format') || 'json'; const issue = u.searchParams.get('issue'); const issues = u.searchParams.get('issues');

  // ---- أعداد منشورة (عام)
  if (issues) { const { data } = await db.from('portal_observatory_issues').select('quarter,editorial_ar,vc_code,published_at,prev_issue_id').eq('status', 'published').order('published_at', { ascending: false }).limit(40); return NextResponse.json({ success: true, issues: data || [], license: 'CC BY 4.0' }, { headers: OPEN }); }
  if (issue) {
    if (!QTR.test(issue)) return bad('رمز العدد غير صالح'); const { data } = await db.from('portal_observatory_issues').select(ISSUE_COLS).eq('quarter', issue).eq('status', 'published').maybeSingle(); if (!data) return bad('لا عدد منشور بهذا الرمز', 404);
    const row = data as any; if (format === 'csv') return csvResponse(snapshotCsv(row.data), `athar-observatory-${issue}.csv`); if (format === 'vc') return NextResponse.json(row.vc || { error: 'unsigned' }, { headers: OPEN });
    return NextResponse.json({ success: true, issue: { quarter: row.quarter, editorial_ar: row.editorial_ar, data: row.data, suppressed: row.suppressed, signed: !!row.vc, vc_code: row.vc_code, verify_url: row.vc_code ? `${site}/verify/vc?code=${encodeURIComponent(row.vc_code)}` : null, published_at: row.published_at, prev_issue_id: row.prev_issue_id }, license: 'CC BY 4.0' }, { headers: OPEN });
  }
  // ---- موقع الجهة (مدير جهة مؤكَّد أو طاقم)
  if (view === 'org') {
    const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401); const org = u.searchParams.get('org') || ''; if (!UUID.test(org)) return bad('معرّف غير صالح');
    if (!user.staff && !(await isOrgAdmin(db, user, org))) return bad('هذه الصفحة لمدير الجهة المؤكَّد', 403);
    const [inp, last, { data: o }] = await Promise.all([loadObsInput(db), latestSnapshot(db), db.from('portal_organizations').select('id,name_ar,sector,observatory_public,observatory_watch,contact_email').eq('id', org).maybeSingle()]);
    const snap = last?.data?.sectors ? last.data : computeSnapshot(inp); const pos = orgPosition(org, inp, snap);
    return NextResponse.json({ success: true, position: pos, org: { id: org, name_ar: (o as any)?.name_ar || '', sector: (o as any)?.sector || null, observatory_public: !!(o as any)?.observatory_public, observatory_watch: !!(o as any)?.observatory_watch, has_contact: !!(o as any)?.contact_email }, computed_at: snap.computed_at }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // ---- غرفة التحرير (طاقم)
  if (view === 'admin') {
    const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401); if (!user.staff) return bad('غير مصرّح', 403);
    const [{ snap, stored, computed_at }, { data: issuesRows }, { data: contributors }] = await Promise.all([snapshotOrCompute(db), db.from('portal_observatory_issues').select(ISSUE_COLS).order('created_at', { ascending: false }).limit(40), db.from('portal_organizations').select('id,name_ar,sector').eq('observatory_public', true).limit(200)]);
    const q = quarterOf(); const draft = ((issuesRows || []) as any[]).find(i => i.quarter === q && i.status === 'draft') || null;
    return NextResponse.json({ success: true, snapshot: snap, stored, computed_at, quarter: q, draft, issues: issuesRows || [], checks: privacyChecks(snap), contributors: contributors || [], signing: !!process.env.VC_SIGNING_KEY }, { headers: { 'Cache-Control': 'no-store' } });
  }
  // ---- اللقطة الأخيرة (عام)
  const { snap, computed_at } = await snapshotOrCompute(db);
  if (format === 'csv') return csvResponse(snapshotCsv(snap), `athar-observatory-${computed_at.slice(0, 10)}.csv`);
  const { data: contributors } = await db.from('portal_organizations').select('name_ar,sector').eq('observatory_public', true).limit(200);
  return NextResponse.json({ success: true, snapshot: snap, computed_at, contributors: contributors || [], license: 'CC BY 4.0', attribution: 'مرصد أَثَر للقدرة البشرية — © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi', api: `${site}/api/observatory`, csv: `${site}/api/observatory?format=csv` }, { headers: OPEN });
}

export async function POST(req: Request) {
  const db = service(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500); const user = await who(req, db); if (!user) return bad('سجّل الدخول', 401);
  const body = await req.json().catch(() => ({})); const action = String(body.action || ''); const site = siteOf(req);

  if (action === 'org_prefs') {
    const org = String(body.org || ''); if (!UUID.test(org)) return bad('معرّف غير صالح'); if (!user.staff && !(await isOrgAdmin(db, user, org))) return bad('هذا الإعداد لمدير الجهة المؤكَّد', 403);
    const patch: any = {}; if (typeof body.watch === 'boolean') patch.observatory_watch = body.watch; if (typeof body.public === 'boolean') patch.observatory_public = body.public; if (!Object.keys(patch).length) return bad('لا تغيير');
    const { error } = await db.from('portal_organizations').update(patch).eq('id', org); if (error) return bad(error.message, 500);
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'updated', object_type: 'organization', object_id: org, skills: [], context: { kind: 'observatory_prefs', ...patch } }).then(() => null, () => null);
    return NextResponse.json({ success: true, ...patch });
  }
  if (!user.staff) return bad('غير مصرّح', 403);

  if (action === 'refresh') { const r = await runObservatory(db, { now: new Date(), site }); if (!r.ok) return bad(r.error || 'تعذّر الحساب', 500); const last = await latestSnapshot(db); return NextResponse.json({ success: true, result: r, snapshot: last?.data || null, computed_at: last?.computed_at || null }); }

  if (action === 'draft') {
    const quarter = String(body.quarter || quarterOf()); if (!QTR.test(quarter)) return bad('رمز الربع غير صالح (مثل 2026-Q4)');
    const { data: ex } = await db.from('portal_observatory_issues').select('id,status').eq('quarter', quarter).maybeSingle(); if ((ex as any)?.status === 'published') return bad('هذا العدد منشور — التصحيح يكون بعدد جديد يشير إليه');
    const suppressed = Array.isArray(body.suppressed) ? body.suppressed.map(String).slice(0, 50) : []; const editorial = String(body.editorial_ar || '').slice(0, 4000);
    const { snap } = await snapshotOrCompute(db); const data = applySuppression(snap, suppressed);
    const row = { quarter, status: 'draft', editorial_ar: editorial, data, suppressed, updated_at: new Date().toISOString() };
    const r = ex ? await db.from('portal_observatory_issues').update(row).eq('id', (ex as any).id).select(ISSUE_COLS).single() : await db.from('portal_observatory_issues').insert(row).select(ISSUE_COLS).single();
    if (r.error) return bad(r.error.message, 500); return NextResponse.json({ success: true, draft: r.data, checks: privacyChecks(data) });
  }
  if (action === 'publish') {
    const quarter = String(body.quarter || ''); if (!QTR.test(quarter)) return bad('رمز الربع غير صالح');
    const { data: d } = await db.from('portal_observatory_issues').select(ISSUE_COLS).eq('quarter', quarter).maybeSingle(); if (!d) return bad('احفظ المسودة أولًا', 404); const draft = d as any; if (draft.status === 'published') return bad('منشور مسبقًا');
    const checks = privacyChecks(draft.data); if (checks.some(c => !c.ok)) return bad('قائمة فحص الخصوصية غير مكتملة: ' + checks.filter(c => !c.ok).map(c => c.ar).join('؛ '));
    const { data: prevRows } = await db.from('portal_observatory_issues').select('id,vc_code').eq('status', 'published').order('published_at', { ascending: false }).limit(1); const prev = ((prevRows || []) as any[])[0] || null;
    const now = new Date(); const code = issueCode(quarter); const digest = await documentDigest(draft.data, sha256); const did = didWeb(site);
    const signer = signerFromEnv(process.env, site); let vc: any = null; let warning: string | null = null;
    if (signer) {
      await ensureKeyRow(db, signer);
      const { data: exIss } = await db.from('portal_vc_issuances').select('id,status_index').eq('code', code).maybeSingle(); let iss = exIss as any;
      if (!iss) { const ins = await db.from('portal_vc_issuances').insert({ code, kind: 'dataset', credential_id: null, user_id: null, email: null, full_name: null, title_ar: `مرصد القدرة البشرية — العدد ${quarter}`, kid: signer.kid, vc: {}, digest: '', issued_at: now.toISOString(), issued_by: user.id }).select('id,status_index').single(); if (ins.error) return bad(ins.error.message, 500); iss = ins.data; }
      vc = await signDocument(buildIssueDoc({ quarter, snapshot: draft.data, editorial_ar: draft.editorial_ar, digest, site, did, now, statusIndex: iss.status_index ?? null, prev_code: prev?.vc_code || null }), signer, now);
      const vdig = await documentDigest(vc, sha256); const up = await db.from('portal_vc_issuances').update({ vc, digest: vdig, kid: signer.kid, issued_at: now.toISOString() }).eq('id', iss.id); if (up.error) return bad(up.error.message, 500);
    } else warning = 'نُشر العدد بلا توقيع — مفتاح VC_SIGNING_KEY غير مضبوط؛ يمكن إعادة النشر موقَّعًا بعدد لاحق.';
    const { error } = await db.from('portal_observatory_issues').update({ status: 'published', vc, vc_code: vc ? code : null, prev_issue_id: prev?.id || null, published_at: now.toISOString(), published_by: user.id, updated_at: now.toISOString() }).eq('id', draft.id); if (error) return bad(error.message, 500);
    await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'issued', object_type: 'observatory_issue', object_id: draft.id, skills: [], context: { quarter, code: vc ? code : null, signed: !!vc, sectors_published: draft.data?.totals?.sectors_published } }).then(() => null, () => null);
    return NextResponse.json({ success: true, quarter, signed: !!vc, code: vc ? code : null, verify_url: vc ? `${site}/verify/vc?code=${encodeURIComponent(code)}` : null, public_url: `${site}/observatory?issue=${encodeURIComponent(quarter)}`, warning });
  }
  return bad('إجراء غير معروف');
}
