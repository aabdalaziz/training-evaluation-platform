// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/profile — الحساب الموحّد والملف المهاري والشهادات الرقمية (بوابة أَثَر · P8-أ)
 *  POST { action: 'me' }                                   → مستخدم: ينشئ ملفه إن لم يوجد، يعيد حساب مستوياته من الأدلة، ويعيد (profile, levels, credentials)
 *  POST { action: 'share', share_mode, display_name?, headline?, city? } → مستخدم: إعدادات الملف والمشاركة
 *  POST { action: 'recompute', email }                     → موظف: إعادة حساب مستويات متعلم
 *  POST { action: 'approve', email, skill_id, level|null, note? } → موظف: اعتماد مستوى مهارة يدويًا
 *  POST { action: 'issue', form, recipients:[{email,full_name}] } → موظف: إصدار شهادات رقمية (Open Badges 3.0) + بريد + حدث issued
 *  POST { action: 'revoke', id, reason }                   → موظف: إلغاء شهادة
 *  POST { action: 'eligible', program_id }                 → موظف: المقبولون في برنامج مع نسبة حضورهم وهل صدرت لهم شهادة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from '../../../lib/email/resend';
import { computeSkillLevels, buildBadge, verifyCode, publicId, validateIssue, completionEligible } from '../../../lib/portal/profile';
import type { LearningEventRow, IssueForm } from '../../../lib/portal/profile';
import { buildCredentialDoc, didWeb } from '../../../lib/portal/vc';
import { ensureKeyRow, signAndStoreCredential, signerFromEnv } from '../../../lib/portal/vc-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const STAFF = [...WRITERS, 'QUALITY_ANALYST'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const siteUrl = (req: Request) => (process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin).replace(/\/$/, '');

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const role = String((prof as any)?.role || '').toUpperCase();
  return { user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '') }, staff: STAFF.includes(role), writer: WRITERS.includes(role), db: createClient(URL_, SERVICE) };
}

async function recompute(db: any, userId: string | null, email: string) {
  let q = db.from('portal_learning_events').select('id,at,user_id,email,verb,object_type,object_id,skills,context').order('at', { ascending: false }).limit(2000);
  q = userId ? q.or(`user_id.eq.${userId},email.ilike.${email}`) : q.ilike('email', email);
  const { data: evs } = await q; const events = ((evs || []) as LearningEventRow[]).filter(e => (e.skills || []).length);
  const ids = Array.from(new Set(events.flatMap(e => e.skills || []))); if (!ids.length || !userId) return [];
  const { data: sk } = await db.from('portal_skills').select('id,code,level').in('id', ids);
  const meta = new Map<string, { level: number; code: string }>(((sk || []) as any[]).map(s => [s.id, { level: s.level, code: s.code }]));
  const rows = computeSkillLevels(userId, events, meta);
  if (rows.length) await db.from('portal_skill_levels').upsert(rows.map(r => ({ user_id: r.user_id, skill_id: r.skill_id, computed_level: r.computed_level, confidence: r.confidence, evidence: r.evidence, updated_at: r.updated_at })), { onConflict: 'user_id,skill_id' });
  return rows;
}
async function ensureProfile(db: any, user: { id: string; email: string; name: string }) {
  const { data } = await db.from('portal_profiles').select('*').eq('user_id', user.id).maybeSingle(); if (data) return data;
  for (let i = 0; i < 5; i++) { const { data: ins, error } = await db.from('portal_profiles').insert({ user_id: user.id, public_id: publicId(), display_name: user.name || null }).select('*').single(); if (!error) return ins; }
  return null;
}
async function userIdByEmail(db: any, email: string): Promise<string | null> {
  const { data } = await db.from('portal_enrollments').select('user_id').ilike('email', email).not('user_id', 'is', null).limit(1); if ((data || [])[0]?.user_id) return data[0].user_id;
  const { data: p } = await db.from('portal_placements').select('user_id').ilike('email', email).not('user_id', 'is', null).limit(1); if ((p || [])[0]?.user_id) return p[0].user_id;
  const { data: c } = await db.from('portal_credentials').select('user_id').ilike('email', email).not('user_id', 'is', null).limit(1); return (c || [])[0]?.user_id || null;
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const site = siteUrl(req);
  let body: any = {}; try { body = await req.json(); } catch { /* فارغ */ }
  const action = String(body.action || '');

  if (action === 'me') {
    const profile = await ensureProfile(db, user); await recompute(db, user.id, user.email);
    const [{ data: levels }, { data: creds }] = await Promise.all([db.from('portal_skill_levels').select('*').eq('user_id', user.id), db.from('portal_credentials').select('*').or(`user_id.eq.${user.id},email.ilike.${user.email}`).order('issued_at', { ascending: false })]);
    return NextResponse.json({ success: true, profile, levels: levels || [], credentials: creds || [] });
  }
  if (action === 'share') {
    const mode = String(body.share_mode || 'private'); if (!['private', 'link', 'public'].includes(mode)) return bad('وضع مشاركة غير صالح');
    const profile = await ensureProfile(db, user); if (!profile) return bad('تعذّر إنشاء الملف', 500);
    const patch: any = { share_mode: mode, updated_at: new Date().toISOString() }; if (mode !== 'private' && !profile.share_enabled_at) patch.share_enabled_at = new Date().toISOString();
    for (const k of ['display_name', 'headline', 'city']) if (typeof body[k] === 'string') patch[k] = body[k].trim().slice(0, 120) || null;
    const { data, error } = await db.from('portal_profiles').update(patch).eq('user_id', user.id).select('*').single(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, profile: data });
  }

  if (!c.staff) return bad('غير مصرّح', 403);

  if (action === 'recompute') {
    const email = String(body.email || '').toLowerCase(); const uid = await userIdByEmail(db, email); if (!uid) return bad('لا حساب مرتبط بهذا البريد بعد (يُنشأ عند أول دخول للمتعلم)', 404);
    const rows = await recompute(db, uid, email); return NextResponse.json({ success: true, user_id: uid, levels: rows.length });
  }
  if (action === 'eligible') {
    const pid = String(body.program_id || ''); if (!pid) return bad('اختر البرنامج');
    const [{ data: ens }, { data: ses }, { data: issued }] = await Promise.all([db.from('portal_enrollments').select('id,email,full_name,user_id,status,classroom_id').eq('program_id', pid).eq('status', 'approved'), db.from('attendance_sessions').select('id').eq('program_id', pid), db.from('portal_credentials').select('email').eq('program_id', pid).eq('kind', 'program_completion').is('revoked_at', null)]);
    const sids = ((ses || []) as any[]).map(s => s.id); let recs: any[] = []; if (sids.length) { const { data } = await db.from('attendance_records').select('session_id,email,status').in('session_id', sids); recs = data || []; }
    const have = new Set(((issued || []) as any[]).map(x => String(x.email).toLowerCase()));
    const out = ((ens || []) as any[]).map(e => { const mine = recs.filter(r => String(r.email || '').toLowerCase() === String(e.email).toLowerCase() && ['present', 'late'].includes(r.status)); const att = { sessions: sids.length, present: new Set(mine.map(r => r.session_id)).size }; return { ...e, attendance: att, eligible: completionEligible(att), issued: have.has(String(e.email).toLowerCase()) }; });
    return NextResponse.json({ success: true, rows: out });
  }

  if (!c.writer) return bad('غير مصرّح', 403);

  if (action === 'approve') {
    const email = String(body.email || '').toLowerCase(); const uid = await userIdByEmail(db, email); if (!uid) return bad('لا حساب مرتبط بهذا البريد', 404);
    const level = body.level === null || body.level === '' ? null : Number(body.level); if (level !== null && !(level >= 1 && level <= 5)) return bad('المستوى بين 1 و5');
    const { error } = await db.from('portal_skill_levels').upsert({ user_id: uid, skill_id: body.skill_id, approved_level: level, approved_by: level === null ? null : user.id, approved_at: level === null ? null : new Date().toISOString(), approved_note: String(body.note || '').slice(0, 300) || null, updated_at: new Date().toISOString() }, { onConflict: 'user_id,skill_id' });
    if (error) return bad(error.message, 500); return NextResponse.json({ success: true });
  }
  if (action === 'revoke') {
    const { error } = await db.from('portal_credentials').update({ revoked_at: new Date().toISOString(), revoke_reason: String(body.reason || '').slice(0, 300) || null }).eq('id', String(body.id || '')); if (error) return bad(error.message, 500);
    // P17: الإلغاء يُعلَن في قائمة الحالة الموقَّعة
    await db.from('portal_vc_issuances').update({ revoked_at: new Date().toISOString(), revoke_reason: String(body.reason || '').slice(0, 300) || null }).eq('credential_id', String(body.id || '')).then(() => null, () => null);
    return NextResponse.json({ success: true });
  }
  if (action === 'issue') {
    const f = body.form as IssueForm; const recipients = (Array.isArray(body.recipients) ? body.recipients : []).map((r: any) => ({ email: String(r.email || '').trim().toLowerCase(), full_name: String(r.full_name || '').trim() || null })).filter((r: any) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email));
    const v = validateIssue(f, recipients.length); if (v) return bad(v);
    const { data: sk } = f.skills?.length ? await db.from('portal_skills').select('id,code,name_ar,name_en,saqf_level,cefr_level,sdaia_code').in('id', f.skills) : { data: [] as any[] };
    const validUntil = f.valid_years ? new Date(Date.now() + Number(f.valid_years) * 365.25 * 86400000).toISOString() : null; let issued = 0; let signedCount = 0; const errors: string[] = []; const notify = body.notify !== false;
    const signer = signerFromEnv(process.env, site); if (signer) await ensureKeyRow(db, signer);
    for (const r of recipients) {
      const base = { user_id: null as string | null, email: r.email, full_name: r.full_name, kind: f.kind, title_ar: f.title_ar.trim(), title_en: f.title_en.trim() || null, description_ar: f.description_ar.trim() || null, program_id: f.program_id || null, session_id: null, skills: f.skills || [], level: f.level || null, hours: f.hours ? Number(f.hours) : null, verify_code: verifyCode(), issued_at: new Date().toISOString(), valid_until: validUntil, revoked_at: null, revoke_reason: null, issued_by: user.id };
      const badge = buildBadge({ id: '', ...base }, (sk || []) as any[], site);
      const { data: ins, error } = await db.from('portal_credentials').insert({ ...base, badge }).select('id,user_id').single(); if (error) { errors.push(`${r.email}: ${error.message}`); continue; }
      issued++;
      // P17: توقيع تشفيري فوري (Ed25519) إن كان المفتاح مضبوطًا — وإلا تبقى قابلة للتوقيع لاحقًا من «المفتاح والتوقيع»
      if (signer) { try { const cred = { ...base, id: (ins as any).id, user_id: (ins as any).user_id || null }; await signAndStoreCredential(db, cred, signer, idx => buildCredentialDoc(cred as any, (sk || []) as any[], site, didWeb(site), idx), user.id); signedCount++; } catch (e: any) { errors.push(`${r.email}: توقيع — ${e?.message || e}`); } }
      await db.from('portal_learning_events').insert({ user_id: (ins as any).user_id || null, email: r.email, verb: 'issued', object_type: 'credential', object_id: (ins as any).id, skills: f.skills || [], context: { kind: f.kind, title: base.title_ar, level: f.level || null, program_id: f.program_id || null } });
      if ((ins as any).user_id) await recompute(db, (ins as any).user_id, r.email);
      if (notify) { const url = `${site}/credential/${base.verify_code}`; try { await sendViaResend({ to: [r.email], subject: `شهادتك الرقمية من أَثَر: ${base.title_ar}`, html: `<div dir="rtl" style="font-family:Tahoma,Arial;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden"><div style="background:#0f2a4e;color:#fff;padding:18px 22px"><div style="color:#c9a24b;font-size:12px;font-weight:bold">أَثَر — شهادة رقمية قابلة للتحقق</div><div style="font-size:18px;font-weight:bold;margin-top:4px">${base.title_ar}</div></div><div style="padding:20px 22px;font-size:14px;line-height:1.9;color:#0f172a"><p>مرحبًا ${r.full_name || ''}،</p><p>صدرت لك شهادة رقمية${base.level ? ` بمستوى <b>${base.level}</b>` : ''}. رمز التحقق: <b dir="ltr">${base.verify_code}</b></p><p><a href="${url}" style="display:inline-block;background:#0b8a83;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-weight:bold">عرض الشهادة والتحقق منها</a></p><p style="color:#64748b;font-size:12.5px">يمكنك مشاركة الرابط مع جهة العمل أو إضافته إلى LinkedIn، وستجد ملفك المهاري في ${site}/me/skills</p></div><div style="padding:12px 22px;background:#f8fafc;color:#64748b;font-size:11.5px">© 2026 د. أحمد محمد عبدالعزيز بدوي — أَثَر</div></div>`, tags: [{ name: 'kind', value: 'credential_issued' }] }); } catch (e: any) { errors.push(`${r.email}: بريد — ${e?.message || e}`); } }
    }
    return NextResponse.json({ success: true, issued, signed: signedCount, errors: errors.length ? errors.slice(0, 5) : undefined });
  }
  return bad('إجراء غير معروف');
}
