// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — واجهة «أَثَر في الجيب» (P19)
 *  GET  ?view=bundle   (مستخدم)  → حزمة الجيب: الاسم، أعلى المستويات، إصدارات المحفظة، آخر لقطة، did، بصمة المفتاح — تُخزَّن محليًا بواسطة sw.js
 *  GET  ?view=pulse    (طاقم)    → نبض الجيب: تثبيتات، مزامنات (ومتأخرة)، مرفوضات، تفاعل الإشعارات، إصدارات عامل الخدمة
 *  POST {action:'sync', items:[{id, kind, captured_at, payload}]} → مزامنة صندوق الأدلة الميداني:
 *        kind=daily   (مستخدم) {day, response}  → تقويم ردّ موقف يومٍ مضى (الموقف من جدول الأيام) + حدث تعلّم — idempotent بمعرّف العنصر؛ ردّ واحد لكل يوم
 *        kind=mission (عام برمز المهمة) {token, evidence, supervisor_email?, supervisor_name?, file_b64?, file_type?, file_name?} → رفع الملف ثم submitMission
 *  POST {action:'installed'|'activated'|'push_action'} → أحداث نبض (بلا هوية عند عدم وجود جلسة؛ push_action يُعرَّف بعنوان الاشتراك)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runAi, logAi } from '../../../lib/ai/athar';
import { normalizeSite } from '../../../lib/portal/open';
import { didWeb, keyFingerprint } from '../../../lib/portal/vc';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { localEvaluate, buildEvalPrompt, parseEval, MIN_RESPONSE_CHARS, MAX_RESPONSE_CHARS } from '../../../lib/portal/daily-case';
import type { DailyCase, CaseEvaluation } from '../../../lib/portal/daily-case';
import { submitMission, MISSION_COLS } from '../../../lib/portal/missions-cron';
import { evidencePath, fileExt, MAX_UPLOAD } from '../../../lib/portal/missions';
import type { Mission, MissionEvidence } from '../../../lib/portal/missions';
import { LIMITS, pulseOf, type SyncResult } from '../../../lib/portal/pocket';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const BUCKET = 'portal-missions';
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const ISS_COLS = 'id,code,kind,credential_id,user_id,email,full_name,title_ar,kid,status_index,issued_at,expires_at,revoked_at,created_at';

function svc() { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; if (!U || !S) return null; return createClient(U, S, { auth: { persistSession: false } }); }
async function who(req: Request, db: any): Promise<{ id: string; email: string; name: string; staff: boolean } | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
}
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const ymd = (s: any) => String(s || '').slice(0, 10);

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const u = new URL(req.url); const view = u.searchParams.get('view') || 'bundle'; const site = siteOf(req); const did = didWeb(site);
  const user = await who(req, db); if (!user) return bad('سجّل الدخول أولًا', 401);
  if (view === 'pulse') {
    if (!user.staff) return bad('غير مصرّح', 403);
    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const [{ data }, { count: reached }, { count: subs }] = await Promise.all([
      db.from('portal_learning_events').select('verb,object_type,at,context').in('object_type', ['pwa', 'pocket', 'push']).gte('at', since).order('at', { ascending: false }).limit(5000),
      db.from('portal_push_subscriptions').select('id', { count: 'exact', head: true }).eq('active', true).gte('last_sent_at', since),
      db.from('portal_push_subscriptions').select('id', { count: 'exact', head: true }).eq('active', true),
    ]);
    const pulse = pulseOf([...((data || []) as any[]), { verb: 'sent', object_type: 'push', at: since, context: { count: Number(reached || 0) } }]);
    return NextResponse.json({ success: true, since, pulse, push_subscriptions: Number(subs || 0) });
  }
  const signer = signerFromEnv(process.env, site);
  const [{ data: iss }, { data: lv }, { data: creds }] = await Promise.all([
    db.from('portal_vc_issuances').select(ISS_COLS).or(`user_id.eq.${user.id},email.ilike.${user.email}`).order('issued_at', { ascending: false }).limit(100),
    db.from('portal_skill_levels').select('skill_id,computed_level,approved_level,confidence').eq('user_id', user.id).limit(200),
    db.from('portal_credentials').select('id,title_ar,title_en,verify_code,issued_at,revoked_at').or(`user_id.eq.${user.id},email.ilike.${user.email}`).is('revoked_at', null).order('issued_at', { ascending: false }).limit(50),
  ]);
  const ids = Array.from(new Set(((lv || []) as any[]).map(r => r.skill_id).filter(Boolean)));
  const { data: sk } = ids.length ? await db.from('portal_skills').select('id,code,name_ar,name_en').in('id', ids) : { data: [] as any[] };
  const byId = new Map(((sk || []) as any[]).map(s => [s.id, s]));
  const levels = ((lv || []) as any[]).map(r => { const s = byId.get(r.skill_id); const approved = r.approved_level !== null && r.approved_level !== undefined; const level = Number(approved ? r.approved_level : r.computed_level || 0); return s && level > 0 ? { skill_id: r.skill_id, code: s.code, name_ar: s.name_ar, name_en: s.name_en || null, level, approved, confidence: Number(r.confidence || 0) } : null; }).filter(Boolean)
    .sort((a: any, b: any) => Number(b.approved) - Number(a.approved) || b.level - a.level);
  const issuances = (iss || []) as any[]; const snapshot = issuances.find(r => r.kind === 'snapshot' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())) || null;
  return NextResponse.json({ success: true, generated_at: new Date().toISOString(), site, did, did_url: `${site}/.well-known/did.json`, configured: !!signer, fingerprint: signer ? keyFingerprint(signer.multibase) : null,
    profile: { name: user.name, email: user.email, staff: user.staff }, levels, credentials: creds || [], issuances, snapshot: snapshot ? { code: snapshot.code, issued_at: snapshot.issued_at, expires_at: snapshot.expires_at } : null, version: LIMITS });
}

/* ---------- مزامنة الصندوق ---------- */
function rowToCase(r: any): DailyCase {
  return { id: r.id, day: ymd(r.day), slug: r.slug, title_ar: r.title_ar, scene_ar: r.scene_ar || '', role_ar: r.role_ar || '', situation_ar: r.situation_ar, twist_ar: r.twist_ar || '', ask_ar: r.ask_ar || '', parties_ar: Array.isArray(r.parties_ar) ? r.parties_ar : [], domain_code: r.domain_code, family: r.family || 'judgment_accountability', horizon: (r.horizon || 2035) as any, skill_codes: Array.isArray(r.skill_codes) ? r.skill_codes : [], skill_ids: Array.isArray(r.skill_ids) ? r.skill_ids : [], event_code: r.event_code || null, event_name_ar: r.event_name_ar || null, rubric: Array.isArray(r.rubric) ? r.rubric : [], source: r.source || 'local', model: r.model || null };
}
async function alreadySynced(db: any, id: string): Promise<boolean> { const { data } = await db.from('portal_learning_events').select('id').eq('object_type', 'pocket').eq('object_id', id).limit(1); return !!(data && (data as any[]).length); }
async function markSynced(db: any, it: any, user: { id: string; email: string } | null, verb: 'synced' | 'rejected', extra: Record<string, any>) {
  await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb, object_type: 'pocket', object_id: String(it.id), skills: [], context: { kind: it.kind, captured_at: it.captured_at || null, ...extra } });
}
async function syncDaily(db: any, it: any, user: { id: string; email: string } | null): Promise<SyncResult> {
  if (!user) return { id: it.id, ok: false, retry: false, error: 'ردّ موقف اليوم يحتاج تسجيل الدخول' };
  const p = it.payload || {}; const day = ymd(p.day); const response = String(p.response || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { id: it.id, ok: false, retry: false, error: 'يوم غير صالح' };
  if (response.length < MIN_RESPONSE_CHARS || response.length > MAX_RESPONSE_CHARS) return { id: it.id, ok: false, retry: false, error: `طول الردّ خارج الحدود (${MIN_RESPONSE_CHARS}–${MAX_RESPONSE_CHARS} حرفًا)` };
  if (await alreadySynced(db, it.id)) return { id: it.id, ok: true, duplicate: true };
  const { data: row } = await db.from('portal_daily_cases').select('*').eq('day', day).maybeSingle();
  if (!row) return { id: it.id, ok: false, retry: false, error: `لا موقف مسجَّل ليوم ${day}` };
  const { data: prev } = await db.from('portal_daily_case_responses').select('id').eq('user_id', user.id).eq('day', day).maybeSingle();
  if (prev) { await markSynced(db, it, user, 'synced', { day, duplicate: true }); return { id: it.id, ok: true, duplicate: true }; }
  const cs = rowToCase(row); const local = localEvaluate(cs, response); let evaluation: CaseEvaluation = local;
  const pr = buildEvalPrompt(cs, response);
  const res = await runAi<CaseEvaluation>({ system: pr.system, user: pr.user, parse: raw => parseEval(raw, local), local: () => local, budgetMs: 20000 });
  evaluation = { ...res.data, model: res.model };
  await logAi(db, { user_id: user.id, email: user.email, role: 'user', purpose: 'daily_case_eval', result: res, context: { day, slug: cs.slug, chars: response.length, pocket: true } });
  const captured = it.captured_at && !Number.isNaN(new Date(it.captured_at).getTime()) ? new Date(it.captured_at).toISOString() : null;
  const { error } = await db.from('portal_daily_case_responses').insert({ case_id: cs.id, day, user_id: user.id, email: user.email, response, evaluation: { ...evaluation, captured_at: captured, pocket: true }, band: evaluation.band, score: evaluation.score, source: evaluation.source, model: evaluation.model || null, chars: response.length, ...(captured ? { created_at: captured } : {}) });
  if (error) return { id: it.id, ok: false, retry: true, error: error.message };
  if (cs.skill_ids && cs.skill_ids.length) await db.from('portal_learning_events').insert({ user_id: user.id, email: user.email, verb: 'assessed', object_type: 'daily_case', object_id: day, skills: cs.skill_ids, context: { score: evaluation.score, band: evaluation.band, day, title: cs.title_ar, domain_code: cs.domain_code, event_code: cs.event_code || null, pocket: true, captured_at: captured } });
  await markSynced(db, it, user, 'synced', { day, score: evaluation.score, band: evaluation.band });
  return { id: it.id, ok: true };
}
async function syncMission(db: any, it: any, user: { id: string; email: string } | null, site: string): Promise<SyncResult> {
  const p = it.payload || {}; const token = String(p.token || ''); if (!token) return { id: it.id, ok: false, retry: false, error: 'رمز المهمة مفقود' };
  if (await alreadySynced(db, it.id)) return { id: it.id, ok: true, duplicate: true };
  const { data: m } = await db.from('portal_missions').select(MISSION_COLS).eq('token', token).maybeSingle(); if (!m) return { id: it.id, ok: false, retry: false, error: 'رابط المهمة غير صالح' };
  const mission = m as Mission; if (mission.status === 'confirmed') { await markSynced(db, it, user, 'synced', { mission_id: mission.id, duplicate: true }); return { id: it.id, ok: true, duplicate: true }; }
  if (mission.status === 'submitted' && !p.allow_resubmit) { await markSynced(db, it, user, 'synced', { mission_id: mission.id, duplicate: true }); return { id: it.id, ok: true, duplicate: true }; }
  const e = p.evidence || {}; const ev: MissionEvidence = { text: e.text ? String(e.text).slice(0, 4000) : undefined, transcript: e.transcript ? String(e.transcript).slice(0, 4000) : undefined, caption: e.caption ? String(e.caption).slice(0, 1000) : undefined, link: e.link ? String(e.link).slice(0, 500) : undefined, duration_s: e.duration_s ? Number(e.duration_s) : undefined };
  if (p.file_b64) {
    const type = String(p.file_type || ''); if (!ALLOWED.includes(type)) return { id: it.id, ok: false, retry: false, error: 'نوع الملف غير مدعوم' };
    let bytes: Buffer; try { bytes = Buffer.from(String(p.file_b64), 'base64'); } catch { return { id: it.id, ok: false, retry: false, error: 'ملف تالف' }; }
    if (!bytes.length || bytes.length > MAX_UPLOAD) return { id: it.id, ok: false, retry: false, error: 'حجم الملف خارج الحد (4 ميجابايت)' };
    const path = evidencePath(mission.id, fileExt(String(p.file_name || 'evidence'), type));
    const { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: type, upsert: false });
    if (error) return { id: it.id, ok: false, retry: true, error: `تعذّر رفع الملف: ${error.message}` };
    ev.file_path = path; ev.file_type = type; ev.file_name = String(p.file_name || 'evidence').slice(0, 120); ev.size = bytes.length;
  }
  try {
    const sup = { email: String(p.supervisor_email || '').toLowerCase() || null, name: String(p.supervisor_name || '').slice(0, 120) || null };
    if (sup.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sup.email)) sup.email = null;
    const captured = it.captured_at ? new Date(it.captured_at) : new Date(); const now = Number.isNaN(captured.getTime()) ? new Date() : captured;
    const r = await submitMission(db, mission, ev, sup, site, now);
    await markSynced(db, it, user, 'synced', { mission_id: mission.id, score: r.ai?.score ?? null });
    return { id: it.id, ok: true };
  } catch (err: any) {
    const msg = String(err?.message || err || 'خطأ'); const final = /دليل|غير صالح|مؤكَّدة|على الأقل/.test(msg);
    if (final) await markSynced(db, it, user, 'rejected', { mission_id: mission.id, error: msg });
    return { id: it.id, ok: false, retry: !final, error: msg };
  }
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(body.action || ''); const user = await who(req, db); const site = siteOf(req);
  if (action === 'sync') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 20) : []; const results: SyncResult[] = [];
    for (const it of items) {
      if (!it || typeof it.id !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(it.id)) { results.push({ id: String(it?.id || ''), ok: false, retry: false, error: 'معرّف غير صالح' }); continue; }
      try {
        if (it.kind === 'daily') results.push(await syncDaily(db, it, user));
        else if (it.kind === 'mission') results.push(await syncMission(db, it, user, site));
        else results.push({ id: it.id, ok: false, retry: false, error: 'نوع غير معروف' });
      } catch (e: any) { results.push({ id: it.id, ok: false, retry: true, error: String(e?.message || e) }); }
    }
    return NextResponse.json({ success: true, results, synced_at: new Date().toISOString() });
  }
  if (action === 'installed' || action === 'activated') {
    await db.from('portal_learning_events').insert({ user_id: user?.id || null, email: user?.email || null, verb: action, object_type: 'pwa', object_id: String(body.version || 'athar-sw-v2').slice(0, 40), skills: [], context: { version: String(body.version || '').slice(0, 40), platform: String(body.platform || '').slice(0, 40), standalone: !!body.standalone } });
    return NextResponse.json({ success: true });
  }
  if (action === 'push_action') {
    const endpoint = String(body.endpoint || ''); if (!endpoint.startsWith('https://')) return bad('اشتراك غير صالح');
    const { data: sub } = await db.from('portal_push_subscriptions').select('id,user_id,email').eq('endpoint', endpoint).maybeSingle();
    await db.from('portal_learning_events').insert({ user_id: (sub as any)?.user_id || null, email: (sub as any)?.email || null, verb: 'acted', object_type: 'push', object_id: String(body.tag || 'athar').slice(0, 40), skills: [], context: { act: String(body.act || 'open').slice(0, 20), sub_id: (sub as any)?.id || null } });
    return NextResponse.json({ success: true, known: !!sub });
  }
  return bad('إجراء غير معروف');
}
