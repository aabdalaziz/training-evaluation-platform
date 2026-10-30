// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/directory — هيئة أَثَر (P31 · «سيرتك توثّقها بنفسك، وشهادة توثيقها أَثَر»)
 *  GET  ?meta=1                                   (عام)  → مهارات أَثَر · القطاعات · الخدمات · الأنماط · الحدود
 *  GET  ?q=&face=&skill=&sector=&service=&mode=&city=&page= (عام) → بحث في المعتمدين المدرجين فقط (≤ 60/صفحة · ترتيب: آخر تحديث ثم الاسم · لا نجوم ولا ترتيب تفضيلي)
 *  GET  ?slug=<slug>                              (عام)  → صفحة العضو العامة + «ما شهده أَثَر» (مشتق من السجلات؛ لا يُكتب باليد)
 *  GET  ?mine=1                                   (مسجّل) → سيرتي كاملة (بلا حقول الطاقم) · «ما شهده أَثَر» · عقودي · تعبئة مسبقة لمدرب منصة التقييم · meta
 *  POST (مسجّل) { action }  save{...fields} · photo{file_b64,file_type} · photo_consent{consent:true} · submit · withdraw · relist · engagement{id, op:sign|change|decline, note_ar?, confirm}
 *  POST (عام)   { action:'request', slug, kind, full_name, email, phone?, organization?, title, details } → طلب عبر أَثَر (لا بريد العضو ولا هاتفه يظهران لأحد)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { randomCode } from '../../../lib/portal/profile';
import { signerFromEnv } from '../../../lib/portal/vc-server';
import { didWeb } from '../../../lib/portal/vc';
import { notify } from '../../../lib/portal/notify';
import { limitFor, tooMany, ipOf } from '../../../lib/shield/ratelimit';
import { DIRECTORY_VERSION, TAGLINE_AR, FACE_AR, FACE_TITLE_AR, STATUS_AR, SERVICES, SERVICE_AR, MODES, MODE_AR, LANG_AR, SECTIONS, SECTION_AR, DEFAULT_VISIBILITY, SUMMARY_MIN, SUMMARY_MAX, ACHIEVEMENTS_MAX, ACHIEVEMENT_LEN, SKILLS_MAX, SECTORS_MAX, PHOTO_MAX_BYTES, PHOTO_TYPES, SEARCH_PAGE, SEARCH_Q_MAX, PRIVATE_BUCKET, PUBLIC_BUCKET, PROFILE_COLS, lower, sanitizeProfileInput, profileIssues, canSubmit, isPublic, publicView, cardView, ownerView, searchPlain, search, witnessLines, WITNESS_EMPTY_AR, memberCode, slugFor, privatePhotoPath, memberTransition, engagementMemberView, prefillFromLegacyTrainer, summaryOf } from '../../../lib/directory/registry';
import type { Profile, Engagement, Face } from '../../../lib/directory/registry';
import { loadMyProfile, loadProfileBySlug, loadPublicProfiles, loadMeta, resolveNames, legacyTrainer, witnessFacts, loadEngagements, loadEngagement } from '../../../lib/directory/load';
import { signEngagement } from '../../../lib/directory/card';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && S ? createClient(U, S, { auth: { persistSession: false } }) : null; };
const siteOf = (req: Request) => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin);
const signedPrivate = async (db: any, path: string) => { try { const { data } = await db.storage.from(PRIVATE_BUCKET).createSignedUrl(path, 600); return (data?.signedUrl as string) || null; } catch { return null; } };
const publicUrlOf = (db: any) => (path: string) => { try { return String(db.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl); } catch { return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${PUBLIC_BUCKET}/${path}`; } };
type Who = { id: string; email: string; name: string };
async function who(req: Request, db: any): Promise<Who | null> {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !U || !A) return null; const userDb = createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return null;
  const { data: prof } = await db.from('profiles').select('full_name').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, email: lower(data.user.email), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') };
}
const RULES = { version: DIRECTORY_VERSION, tagline_ar: TAGLINE_AR, faces_ar: FACE_AR, face_titles_ar: FACE_TITLE_AR, status_ar: STATUS_AR, services: SERVICES.map(s => ({ code: s, name_ar: SERVICE_AR[s] })), modes: MODES.map(m => ({ code: m, name_ar: MODE_AR[m] })), languages: Object.entries(LANG_AR).map(([code, name_ar]) => ({ code, name_ar })), sections: SECTIONS.map(s => ({ code: s, name_ar: SECTION_AR[s], default: DEFAULT_VISIBILITY[s] })), summary_min: SUMMARY_MIN, summary_max: SUMMARY_MAX, achievements_max: ACHIEVEMENTS_MAX, achievement_len: ACHIEVEMENT_LEN, skills_max: SKILLS_MAX, sectors_max: SECTORS_MAX, photo_max_bytes: PHOTO_MAX_BYTES, photo_types: PHOTO_TYPES, page: SEARCH_PAGE };
const PRIVACY_AR = 'لا يظهر بريدك ولا هاتفك لأحد؛ الطلبات تصل عبر أَثَر وحده. كل قسم من سيرتك له مفتاح ظهور بيدك، و«ما شهده أَثَر» يُشتقّ من سجلات المنصة ولا يُكتب باليد.';

async function witnessOf(db: any, p: Profile, engagements?: Engagement[]) {
  const legacy = p.legacy_trainer_id ? { id: p.legacy_trainer_id, name: null, email: p.email } : await legacyTrainer(db, p.email);
  const facts = await witnessFacts(db, { id: p.user_id, email: p.email }, legacy, engagements || await loadEngagements(db, p.id));
  const lines = witnessLines(facts); return { facts, lines, empty_ar: lines.length ? null : WITNESS_EMPTY_AR };
}

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const u = new URL(req.url); const site = siteOf(req); const pub = publicUrlOf(db);
  if (u.searchParams.get('meta') === '1') { const meta = await loadMeta(db); return NextResponse.json({ success: true, ...meta, rules: RULES, privacy_ar: PRIVACY_AR }); }
  if (u.searchParams.get('mine') === '1') {
    const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
    const [p, legacy, meta] = await Promise.all([loadMyProfile(db, me), legacyTrainer(db, me.email), loadMeta(db)]);
    const engagements = p ? await loadEngagements(db, p.id) : [];
    const facts = await witnessFacts(db, me, legacy, engagements); const lines = witnessLines(facts);
    const prefill = !p ? { name_ar: me.name, ...(legacy ? prefillFromLegacyTrainer(legacy, facts) : {}) } : null;
    return NextResponse.json({ success: true, summary: summaryOf(p, !!legacy), profile: p ? ownerView(p) : null, prefill, witness: { facts, lines, empty_ar: lines.length ? null : WITNESS_EMPTY_AR }, engagements: engagements.map(e => engagementMemberView(e, site)), photo_url: p?.photo_public_path ? pub(p.photo_public_path) : null, photo_preview_url: p?.photo_path ? await signedPrivate(db, p.photo_path) : null, ...meta, rules: RULES, privacy_ar: PRIVACY_AR, public_url: p && isPublic(p) ? `${site}/${(p.faces[0] || 'expert') === 'trainer' ? 'trainers' : 'experts'}/${p.slug}` : null });
  }
  const slug = String(u.searchParams.get('slug') || '').trim().slice(0, 80);
  if (slug) {
    const p = await loadProfileBySlug(db, slug); if (!p || !isPublic(p)) return bad('لا صفحة بهذا العنوان', 404);
    const w = p.witness_hidden ? null : await witnessOf(db, p);
    return NextResponse.json({ success: true, profile: publicView(p, pub), witness: w, rules: RULES, request_hint_ar: 'الطلب يصل إلى أَثَر، وأَثَر ينسّق معه ومعك — بلا بريد مباشر.' });
  }
  const rl = await limitFor(db, 'vc_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl);
  const faceQ = String(u.searchParams.get('face') || ''); const face: Face | null = faceQ === 'expert' || faceQ === 'trainer' ? faceQ : null;
  const f = { q: String(u.searchParams.get('q') || '').slice(0, SEARCH_Q_MAX), face, skill: String(u.searchParams.get('skill') || '').slice(0, 60) || undefined, sector: String(u.searchParams.get('sector') || '').slice(0, 40) || undefined, service: String(u.searchParams.get('service') || '').slice(0, 40) || undefined, mode: String(u.searchParams.get('mode') || '').slice(0, 10) || undefined, city: String(u.searchParams.get('city') || '').slice(0, 60) || undefined };
  const page = Math.max(1, Math.min(200, Number(u.searchParams.get('page') || 1) || 1));
  const all = (await loadPublicProfiles(db)).filter(isPublic); const r = search(all, f, page);
  return NextResponse.json({ success: true, items: r.items.map(p => cardView(p, pub)), total: r.total, page: r.page, pages: r.pages, filters: f, rules: RULES });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  let body: any = {}; try { body = await req.json(); } catch { return bad('جسم الطلب غير صالح'); }
  const action = String(body?.action || ''); const site = siteOf(req); const now = new Date(); const iso = now.toISOString(); const pub = publicUrlOf(db);
  // ── طلب عام عبر أَثَر ──
  if (action === 'request') {
    const rl = await limitFor(db, 'council_write_ip', ipOf(req)); if (!rl.allowed) return tooMany(rl);
    const p = await loadProfileBySlug(db, String(body.slug || '').slice(0, 80)); if (!p || !isPublic(p)) return bad('لا صفحة بهذا العنوان', 404);
    const kind = body.kind === 'train' ? 'train' : 'consult'; const full_name = String(body.full_name || '').trim().slice(0, 120); const email = lower(body.email); const title = String(body.title || '').trim().slice(0, 160); const details = String(body.details || '').trim().slice(0, 3000);
    if (!full_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !title || details.length < 20) return bad('الاسم والبريد وعنوان الطلب وتفاصيله (20 حرفًا فأكثر) مطلوبة');
    const me = await who(req, db).catch(() => null);
    const { data: r, error } = await db.from('portal_consulting_requests').insert({ user_id: me?.id || null, full_name, email, phone: String(body.phone || '').trim().slice(0, 30) || null, organization: String(body.organization || '').trim().slice(0, 160) || null, sector: null, area: 'management', title: `[${kind === 'train' ? 'تدريب' : 'استشارة'} · ${p.name_ar}] ${title}`, details, lang: 'ar', status: 'new', expert_profile_id: p.id, kind }).select('id').single();
    if (error) return bad(error.message || 'تعذّر إرسال الطلب', 500);
    const admins = String(process.env.NOTIFY_EMAILS || '').split(/[,;\s]+/).filter(Boolean);
    for (const a of admins.slice(0, 3)) await notify(db, { kind: 'directory_request', to: { email: a }, ref: `directory:request:${(r as any).id}`, subject: `طلب عبر هيئة أَثَر — ${p.name_ar}`, text: `طلب ${kind === 'train' ? 'تدريب' : 'استشارة'} باسم عضو الهيئة ${p.name_ar}\nمن: ${full_name} <${email}>\n${title}\n${details.slice(0, 500)}\n${site}/admin/directory`, url: `${site}/admin/directory` }, { now }).catch(() => null);
    return NextResponse.json({ success: true, id: (r as any).id, message_ar: 'وصل طلبك إلى أَثَر. سننسّق مع العضو ونعود إليك عبر بريدك.' });
  }
  const me = await who(req, db); if (!me) return bad('سجّل الدخول أولًا', 401);
  const rnd = () => randomCode(4);
  let p = await loadMyProfile(db, me);
  const patchMine = async (patch: Record<string, any>) => { const { data, error } = await db.from('portal_directory_profiles').update({ ...patch, updated_at: iso }).eq('id', p!.id).select(PROFILE_COLS).single(); if (error || !data) throw new Error(error?.message || 'تعذّر الحفظ'); return data as Profile; };
  const reviewFlag = (prof: Profile | null, patch: Record<string, any>) => (prof?.status === 'approved' ? { ...patch, meta: { ...(prof.meta || {}), review_pending: true, review_pending_at: iso } } : patch);
  try {
    switch (action) {
      case 'save': {
        if (p?.status === 'suspended') return bad('السيرة موقوفة — تواصل مع أَثَر', 409);
        const inp = sanitizeProfileInput(body); const names = await resolveNames(db, inp.skill_ids || [], inp.sectors || []);
        inp.skill_ids = names.valid_skill_ids; inp.sectors = names.valid_sectors; (inp as any).skill_names = names.skill_names;
        const legacy = await legacyTrainer(db, me.email);
        const base = { ...inp, search_plain: searchPlain({ ...(p || {}), ...inp }, names.skill_names, names.sector_names), legacy_trainer_id: p?.legacy_trainer_id || legacy?.id || null };
        if (!p) {
          const code = memberCode(rnd); const slug = slugFor({ name_en: inp.name_en || null, code }, rnd);
          const { data, error } = await db.from('portal_directory_profiles').insert({ ...base, user_id: me.id, email: me.email, status: 'draft', listed: true, code, slug, created_at: iso, updated_at: iso }).select(PROFILE_COLS).single();
          if (error || !data) return bad(error?.message || 'تعذّر إنشاء السيرة', 500); p = data as Profile;
        } else { const patch: Record<string, any> = { ...base }; if (p.status === 'changes_requested') patch.status = 'draft'; p = await patchMine(reviewFlag(p, patch)); }
        return NextResponse.json({ success: true, profile: ownerView(p), message_ar: p.status === 'approved' ? 'حُفظت التعديلات — سيراجعها الطاقم وتبقى صفحتك المعتمدة ظاهرة.' : 'حُفظت المسودة.' });
      }
      case 'photo': {
        if (!p) return bad('احفظ سيرتك أولًا ثم ارفع الصورة');
        const type = String(body.file_type || ''); if (!PHOTO_TYPES.includes(type)) return bad('الصورة JPEG أو PNG أو WebP فقط');
        let bytes: Buffer; try { bytes = Buffer.from(String(body.file_b64 || ''), 'base64'); } catch { return bad('ملف تالف'); }
        if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) return bad('حجم الصورة حتى 2 ميجابايت');
        const path = privatePhotoPath(me.id, type); const { error } = await db.storage.from(PRIVATE_BUCKET).upload(path, bytes, { contentType: type, upsert: true }); if (error) return bad(`تعذّر رفع الصورة: ${error.message}`, 500);
        p = await patchMine(reviewFlag(p, { photo_path: path, photo_consent_at: body.consent === true ? iso : null }));
        return NextResponse.json({ success: true, profile: ownerView(p), message_ar: body.consent === true ? 'رُفعت الصورة وسُجّلت موافقتك بتاريخ اليوم.' : 'رُفعت الصورة — بقيت الموافقة على ظهورها.' });
      }
      case 'photo_consent': {
        if (!p?.photo_path) return bad('ارفع صورة أولًا'); if (body.consent !== true) return bad('الموافقة الصريحة مطلوبة (consent:true)');
        p = await patchMine({ photo_consent_at: iso }); return NextResponse.json({ success: true, profile: ownerView(p), message_ar: `سُجّلت موافقتك على ظهور صورتك بتاريخ ${iso.slice(0, 10)}.` });
      }
      case 'submit': {
        if (!p) return bad('احفظ سيرتك أولًا'); if (p.status === 'approved') return bad('سيرتك معتمدة أصلًا — التعديلات تذهب للمراجعة تلقائيًّا', 409); if (p.status === 'submitted') return bad('سيرتك بانتظار الاعتماد', 409); if (p.status === 'suspended') return bad('السيرة موقوفة', 409);
        const issues = profileIssues(p); if (!canSubmit(p)) return NextResponse.json({ success: false, error: issues[0], issues }, { status: 400 });
        p = await patchMine({ status: 'submitted', submitted_at: iso, staff_note_ar: null }); return NextResponse.json({ success: true, profile: ownerView(p), message_ar: 'أُرسلت سيرتك للاعتماد. يراجعها طاقم أَثَر — ولا يُنشر منها حرف قبل اعتمادها.' });
      }
      case 'withdraw': case 'relist': {
        if (!p || p.status !== 'approved') return bad('الإدراج/السحب لسيرة معتمدة فقط', 409);
        p = await patchMine({ listed: action === 'relist' }); return NextResponse.json({ success: true, profile: ownerView(p), message_ar: action === 'relist' ? 'عادت صفحتك إلى الدليل.' : 'سُحبت صفحتك من الدليل — سيرتك وشهادتك باقيتان، وتعود متى شئت.' });
      }
      case 'engagement': {
        if (!p) return bad('لا سيرة لك', 404); const e = await loadEngagement(db, String(body.id || '')); if (!e || e.profile_id !== p.id) return bad('العقد غير موجود', 404);
        const op = String(body.op || ''); if (!['sign', 'change', 'decline'].includes(op)) return bad('إجراء غير معروف'); if (body.confirm !== true) return bad('أكّد الإجراء (confirm:true)');
        const why = memberTransition(e, op as any); if (why) return bad(why, 409);
        if (op === 'sign') {
          const r = await signEngagement(db, e, p, signerFromEnv(process.env, site), site, didWeb(site), rnd, now); if (!r.ok) return bad(r.error, 500);
          return NextResponse.json({ success: true, engagement: engagementMemberView(r.engagement, site), verify_url: r.verify_url, message_ar: 'وقّعتَ، ووقّع أَثَر بصفته — عقد التعاون جارٍ ووثيقته موقَّعة.' });
        }
        const note = String(body.note_ar || '').trim().slice(0, 600); if (op === 'change' && note.length < 10) return bad('اكتب ما تريد تعديله (10 أحرف فأكثر)');
        const patch = op === 'change' ? { status: 'changes_requested', change_note_ar: note, meta: { ...(e.meta || {}), changes: Number(e.meta?.changes || 0) + 1 } } : { status: 'declined', change_note_ar: note || null };
        const { data, error } = await db.from('portal_directory_engagements').update({ ...patch, updated_at: iso }).eq('id', e.id).select('*').single(); if (error || !data) return bad(error?.message || 'تعذّر الحفظ', 500);
        return NextResponse.json({ success: true, engagement: engagementMemberView(data as Engagement, site), message_ar: op === 'change' ? 'وصل طلب التعديل إلى أَثَر — ستصلك نسخة معدَّلة لتوقيعها.' : 'سُجّل اعتذارك — شكرًا لوضوحك.' });
      }
      default: return bad('إجراء غير معروف');
    }
  } catch (e: any) { return bad(e?.message || 'خطأ غير متوقع', 500); }
}
