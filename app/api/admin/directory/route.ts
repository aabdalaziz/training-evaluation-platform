// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/admin/directory — هيئة أَثَر للطاقم (P31)
 *  GET → السير كلها (مع حقول الطاقم وصورة خاصة موقَّعة) · العقود كلها (بالأجر) · الطلبات الممهورة بأعضاء الهيئة · الإحصاءات · meta
 *  POST { action }
 *   approve{id,confirm}        → اعتماد: نسخ الصورة إلى المخزن العام (بموافقة مؤرَّخة) · إصدار شهادة توثيق لكل وجه (ATH-EX/ATH-TR) · الإدراج · إشعار
 *   changes{id,note_ar}        → طلب تعديلات (ملاحظة للعضو) · إشعار
 *   review_done{id}            → مراجعة تعديلات عضو معتمد (ينشر صورته الجديدة إن تغيّرت) ويطفئ علم المراجعة
 *   suspend{id,note_ar,confirm}→ إيقاف: إخفاء + حذف الصورة العامة + سحب الشهادات · إشعار        reinstate{id,confirm} → إعادة الاعتماد: نشر الصورة وإصدار شهادات جديدة
 *   staff_note{id,availability?,notes?} → حقول الطاقم فقط (لا تظهر للعضو ولا للعامة)
 *   engagement_new{profile_id,kind,title_ar,scope_ar,deliverables[],start_at,end_at,mode,fee_amount,currency,terms_ar,consulting_request_id?} → عقد مقترح · إشعار العضو
 *   engagement{id,op:update|complete|settle|cancel,...,confirm} → تعديل المقترح (يعود «بانتظار توقيعك») · إنجاز · تسوية · إلغاء (يسحب الوثيقة)
 *   invite{dry}                → تشغيل دعوات المدربين القائمين والتذكير السنوي الآن (نفس منطق الكرون)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../../lib/portal/open';
import { randomCode } from '../../../../lib/portal/profile';
import { signerFromEnv } from '../../../../lib/portal/vc-server';
import { didWeb } from '../../../../lib/portal/vc';
import { notify } from '../../../../lib/portal/notify';
import { FACES, FACE_AR, SERVICE_AR, MODE_AR, STATUS_AR, ENGAGEMENT_STATUS_AR, ENGAGEMENT_KIND_AR, PROFILE_COLS, PRIVATE_BUCKET, PUBLIC_BUCKET, lower, profileIssues, publicPhotoPath, mimeOfPath, sanitizeEngagementInput, engagementIssues, staffTransition } from '../../../../lib/directory/registry';
import type { Profile, Engagement, Face } from '../../../../lib/directory/registry';
import { loadAllProfiles, loadProfileById, loadMeta, legacyTrainer, witnessFacts, loadEngagements, loadAllEngagements, loadEngagement } from '../../../../lib/directory/load';
import { issueCard, revokeCards, revokeEngagementDoc } from '../../../../lib/directory/card';
import { runDirectory } from '../../../../lib/directory/cron';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || '') } };
}
const signedPrivate = async (db: any, path: string | null) => { if (!path) return null; try { const { data } = await db.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 600); return data?.signedUrl || null; } catch { return null; } };
const publicUrl = (db: any, path: string | null) => { if (!path) return null; try { return String(db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl); } catch { return null; } };
/** نسخ صورة العضو من المخزن الخاص إلى العام باسم الـ slug (تُستبدل عند كل اعتماد) */
async function publishPhoto(db: any, p: Profile): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  if (!p.photo_path || !p.photo_consent_at) return { ok: false, error: 'لا صورة بموافقة مؤرَّخة' };
  const { data, error } = await db.storage.from(PRIVATE_BUCKET).download(p.photo_path); if (error || !data) return { ok: false, error: `تعذّر قراءة الصورة: ${error?.message || 'فارغة'}` };
  const bytes = Buffer.from(await (data as Blob).arrayBuffer()); const mime = mimeOfPath(p.photo_path); const path = publicPhotoPath(p.slug || p.id, mime);
  const up = await db.storage.from(PUBLIC_BUCKET).upload(path, bytes, { contentType: mime, upsert: true }); if (up.error) return { ok: false, error: `تعذّر نشر الصورة: ${up.error.message}` };
  return { ok: true, path };
}
const tell = (db: any, p: Profile, subject: string, text: string, url: string, now: Date, kind: string) => notify(db, { kind, to: { email: lower(p.email), name: p.name_ar }, ref: `directory:${kind}:${p.id}:${now.toISOString().slice(0, 10)}`, subject, text, url }, { now }).catch(() => null);

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c; const site = siteOf(req);
  const [profiles, engagements, meta, reqs] = await Promise.all([loadAllProfiles(db), loadAllEngagements(db), loadMeta(db), db.from('portal_consulting_requests').select('id,created_at,full_name,email,organization,title,details,status,expert_profile_id,kind').not('expert_profile_id', 'is', null).order('created_at', { ascending: false }).limit(200).then((r: any) => (r.data || []) as any[], () => [] as any[])]);
  const items = await Promise.all(profiles.map(async p => ({ ...p, photo_private_url: await signedPrivate(db, p.photo_path), photo_public_url: publicUrl(db, p.photo_public_path), issues: profileIssues(p), status_ar: STATUS_AR[p.status], review_pending: !!p.meta?.review_pending, engagements: engagements.filter(e => e.profile_id === p.id).length, public_url: p.slug ? `${site}/${(p.faces[0] || 'expert') === 'trainer' ? 'trainers' : 'experts'}/${p.slug}` : null })));
  const stats = { total: profiles.length, submitted: profiles.filter(p => p.status === 'submitted').length, approved: profiles.filter(p => p.status === 'approved').length, review_pending: profiles.filter(p => p.status === 'approved' && p.meta?.review_pending).length, suspended: profiles.filter(p => p.status === 'suspended').length, engagements_active: engagements.filter(e => e.status === 'active').length, engagements_proposed: engagements.filter(e => e.status === 'proposed' || e.status === 'changes_requested').length, requests_new: reqs.filter(r => r.status === 'new').length };
  return NextResponse.json({ success: true, profiles: items, engagements: engagements.map(e => ({ ...e, status_ar: ENGAGEMENT_STATUS_AR[e.status], kind_ar: ENGAGEMENT_KIND_AR[e.kind], verify_url: e.code && e.vc_issuance_id ? `${site}/verify/vc?code=${encodeURIComponent(e.code)}` : null })), requests: reqs, stats, ...meta, faces_ar: FACE_AR, services_ar: SERVICE_AR, modes_ar: MODE_AR });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteOf(req); const now = new Date(); const iso = now.toISOString(); const rnd = () => randomCode(4);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(body?.action || '');
  if (action === 'invite') { const r = await runDirectory(db, { dry: body.dry !== false, site, now }); return NextResponse.json({ success: true, result: r }); }
  if (action === 'engagement_new') {
    const p = await loadProfileById(db, String(body.profile_id || '')); if (!p) return bad('السيرة غير موجودة', 404); if (p.status !== 'approved') return bad('العقود لأعضاء الهيئة المعتمدين فقط', 409);
    const inp = sanitizeEngagementInput(body); const why = engagementIssues(inp); if (why) return bad(why);
    const { data, error } = await db.from('portal_directory_engagements').insert({ ...inp, profile_id: p.id, user_id: p.user_id, email: lower(p.email), status: 'proposed', token: `${randomCode(6)}${randomCode(6)}`, created_by: user.id, created_at: iso, updated_at: iso }).select('*').single(); if (error || !data) return bad(error?.message || 'تعذّر إنشاء العقد', 500);
    await tell(db, p, `عقد تعاون مقترح من أَثَر — ${inp.title_ar}`, `${p.name_ar}،\nيقترح أَثَر عليك عقد تعاون على مهمة: «${inp.title_ar}» (${ENGAGEMENT_KIND_AR[inp.kind]}).\nاقرأ النطاق والمدة والأجر، ثم وقّع أو اطلب تعديلًا واحدًا أو اعتذر: ${site}/me/directory\n— أَثَر`, `${site}/me/directory`, now, 'directory_engagement');
    return NextResponse.json({ success: true, engagement: data, message_ar: 'أُرسل العقد المقترح إلى العضو.' });
  }
  if (action === 'engagement') {
    const e = await loadEngagement(db, String(body.id || '')); if (!e) return bad('العقد غير موجود', 404); const op = String(body.op || '') as 'update' | 'complete' | 'settle' | 'cancel';
    if (!['update', 'complete', 'settle', 'cancel'].includes(op)) return bad('إجراء غير معروف'); const why = staffTransition(e, op); if (why) return bad(why, 409); if (op !== 'update' && body.confirm !== true) return bad('أكّد الإجراء (confirm:true)');
    const p = await loadProfileById(db, e.profile_id);
    let patch: Record<string, any>;
    if (op === 'update') { const inp = sanitizeEngagementInput({ ...e, ...body }); const bad1 = engagementIssues(inp); if (bad1) return bad(bad1); patch = { ...inp, status: 'proposed', change_note_ar: null }; }
    else if (op === 'complete') patch = { status: 'completed', completed_at: iso };
    else if (op === 'settle') patch = { status: 'settled', settled_at: iso };
    else { patch = { status: 'cancelled', meta: { ...(e.meta || {}), cancelled_by: user.id, cancel_note_ar: String(body.note_ar || '').slice(0, 600) } }; await revokeEngagementDoc(db, e, now); }
    const { data, error } = await db.from('portal_directory_engagements').update({ ...patch, updated_at: iso }).eq('id', e.id).select('*').single(); if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
    if (p) { const msg: Record<string, [string, string]> = { update: ['نسخة معدَّلة من عقد التعاون', 'عُدّل العقد المقترح كما طلبت أو كما رأى أَثَر — راجعه ووقّع أو اعتذر.'], complete: ['أُنجزت مهمتك مع أَثَر', 'سجّل أَثَر إنجاز المهمة — وأصبحت ضمن «ما شهده أَثَر» في سيرتك.'], settle: ['سُوّيت مستحقات مهمتك', 'سُوّيت مستحقات المهمة وفق ما اتُّفق عليه. شكرًا لك.'], cancel: ['أُلغي عقد التعاون', 'ألغى أَثَر عقد التعاون على هذه المهمة. تواصل معنا إن كان لديك سؤال.'] }; const [s, t] = msg[op]; await tell(db, p, `${s} — ${e.title_ar}`, `${p.name_ar}،\n${t}\n${site}/me/directory\n— أَثَر`, `${site}/me/directory`, now, `directory_engagement_${op}`); }
    return NextResponse.json({ success: true, engagement: data });
  }
  const p = await loadProfileById(db, String(body.id || '')); if (!p) return bad('السيرة غير موجودة', 404);
  const save = async (patch: Record<string, any>) => { const { data, error } = await db.from('portal_directory_profiles').update({ ...patch, updated_at: iso }).eq('id', p.id).select(PROFILE_COLS).single(); if (error || !data) throw new Error(error?.message || 'تعذّر الحفظ'); return data as Profile; };
  const issueAll = async (prof: Profile, onlyMissing: boolean) => {
    const legacy = prof.legacy_trainer_id ? { id: prof.legacy_trainer_id, name: null, email: prof.email } : await legacyTrainer(db, prof.email);
    const facts = await witnessFacts(db, { id: prof.user_id, email: prof.email }, legacy, await loadEngagements(db, prof.id)); const signer = signerFromEnv(process.env, site); const did = didWeb(site); const patch: Record<string, any> = {};
    for (const face of FACES) { const col = face === 'expert' ? 'card_expert' : 'card_trainer'; if (!prof.faces.includes(face)) continue; if (onlyMissing && prof[col]) continue; const r = await issueCard(db, prof, face as Face, facts, signer, site, did, rnd, user.id, now); if (!r.ok) throw new Error(r.error); patch[col] = r.card; }
    return patch;
  };
  try {
    switch (action) {
      case 'approve': {
        if (body.confirm !== true) return bad('أكّد الاعتماد (confirm:true)'); if (!['submitted', 'changes_requested', 'draft'].includes(p.status)) return bad(`السيرة «${STATUS_AR[p.status]}» — لا تُعتمد من هذه الحالة`, 409);
        const issues = profileIssues(p); if (issues.length) return NextResponse.json({ success: false, error: `السيرة غير مكتملة: ${issues[0]}`, issues }, { status: 409 });
        const ph = await publishPhoto(db, p); if (!ph.ok) return bad(ph.error, 500);
        const cards = await issueAll({ ...p, status: 'approved' }, false);
        const saved = await save({ status: 'approved', approved_at: iso, approved_by: user.id, listed: true, suspended_at: null, staff_note_ar: null, photo_public_path: ph.path, ...cards, meta: { ...(p.meta || {}), review_pending: false, photo_published_path: p.photo_path } });
        const url = `${site}/${(saved.faces[0] || 'expert') === 'trainer' ? 'trainers' : 'experts'}/${saved.slug}`;
        await tell(db, saved, 'اعتُمدت سيرتك — أهلًا بك في هيئة أَثَر', `${saved.name_ar}،\nاعتمد طاقم أَثَر سيرتك، وصدرت شهادة توثيقك${saved.faces.map(f => ` (${FACE_AR[f]})`).join('')} موقَّعة إلكترونيًّا.\nصفحتك العامة: ${url}\nسيرتك وشهادتك من حسابك: ${site}/me/directory\n— أَثَر`, url, now, 'directory_approved');
        return NextResponse.json({ success: true, profile: saved, public_url: url });
      }
      case 'changes': { const note = String(body.note_ar || '').trim().slice(0, 1000); if (note.length < 10) return bad('اكتب للعضو ما يلزم تعديله (10 أحرف فأكثر)'); if (p.status === 'approved') { const saved = await save({ staff_note_ar: note, meta: { ...(p.meta || {}), review_pending: true } }); await tell(db, saved, 'ملاحظة من أَثَر على سيرتك', `${saved.name_ar}،\n${note}\nحدّث سيرتك من: ${site}/me/directory\n— أَثَر`, `${site}/me/directory`, now, 'directory_changes'); return NextResponse.json({ success: true, profile: saved }); }
        const saved = await save({ status: 'changes_requested', staff_note_ar: note }); await tell(db, saved, 'سيرتك تحتاج لمسة قبل الاعتماد', `${saved.name_ar}،\nراجع طاقم أَثَر سيرتك ويطلب:\n${note}\nعدّل وأعد الإرسال من: ${site}/me/directory\n— أَثَر`, `${site}/me/directory`, now, 'directory_changes'); return NextResponse.json({ success: true, profile: saved }); }
      case 'review_done': {
        if (p.status !== 'approved') return bad('للسير المعتمدة فقط', 409); const patch: Record<string, any> = { meta: { ...(p.meta || {}), review_pending: false, reviewed_at: iso, reviewed_by: user.id }, staff_note_ar: null };
        if (p.photo_path && p.photo_consent_at && p.photo_path !== p.meta?.photo_published_path) { const ph = await publishPhoto(db, p); if (!ph.ok) return bad(ph.error, 500); patch.photo_public_path = ph.path; patch.meta.photo_published_path = p.photo_path; }
        const cards = await issueAll(p, true); const saved = await save({ ...patch, ...cards }); return NextResponse.json({ success: true, profile: saved });
      }
      case 'suspend': { if (body.confirm !== true) return bad('أكّد الإيقاف (confirm:true)'); if (p.status !== 'approved') return bad('الإيقاف لسيرة معتمدة فقط', 409); const note = String(body.note_ar || '').trim().slice(0, 1000); await revokeCards(db, p, now);
        if (p.photo_public_path) { try { await db.storage.from(PUBLIC_BUCKET).remove([p.photo_public_path]); } catch { /* أفضل جهد */ } }
        const saved = await save({ status: 'suspended', suspended_at: iso, listed: false, staff_note_ar: note || null, card_expert: null, card_trainer: null, photo_public_path: null, meta: { ...(p.meta || {}), suspended_by: user.id } }); await tell(db, saved, 'أُوقفت عضويتك في هيئة أَثَر', `${saved.name_ar}،\nأوقف أَثَر عضويتك في الهيئة وسُحبت شهادة التوثيق.${note ? `\n${note}` : ''}\nللاستفسار تواصل مع أَثَر.\n— أَثَر`, `${site}/me/directory`, now, 'directory_suspended'); return NextResponse.json({ success: true, profile: saved }); }
      case 'reinstate': { if (body.confirm !== true) return bad('أكّد (confirm:true)'); if (p.status !== 'suspended') return bad('الإعادة لسيرة موقوفة فقط', 409); const cards = await issueAll({ ...p, card_expert: null, card_trainer: null }, false); const ph = await publishPhoto(db, p); if (!ph.ok) return bad(ph.error, 500);
        const saved = await save({ status: 'approved', suspended_at: null, listed: true, approved_at: iso, approved_by: user.id, staff_note_ar: null, photo_public_path: ph.path, ...cards, meta: { ...(p.meta || {}), photo_published_path: p.photo_path } }); await tell(db, saved, 'عادت عضويتك في هيئة أَثَر', `${saved.name_ar}،\nأعاد أَثَر اعتماد سيرتك وأصدر شهادة توثيق جديدة.\n${site}/me/directory\n— أَثَر`, `${site}/me/directory`, now, 'directory_reinstated'); return NextResponse.json({ success: true, profile: saved }); }
      case 'staff_note': { const so = { ...(p.staff_only || {}) }; if (typeof body.availability === 'string') so.availability = body.availability.slice(0, 300); if (typeof body.notes === 'string') so.notes = body.notes.slice(0, 3000); const saved = await save({ staff_only: so }); return NextResponse.json({ success: true, profile: saved }); }
      default: return bad('إجراء غير معروف');
    }
  } catch (e: any) { return bad(e?.message || 'خطأ غير متوقع', 500); }
}
