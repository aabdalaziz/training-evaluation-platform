// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — مهمات في قلب العمل (P12-أ) — المسار العام بالرمز (بلا تسجيل دخول)
 *  GET  ?token=T         → المهمة لصاحبها (بلا رموز التأكيد) + رابط موقّع قصير للملف إن وُجد
 *  GET  ?confirm=C       → المهمة للمشرف: الدليل + الفحص الأولي + المعيار
 *  POST multipart {action:'upload', token, file} → يرفع الملف إلى المخزن الخاص (≤ 4 MB) ويعيد المسار
 *  POST {action:'submit', token, evidence, supervisor_email?, supervisor_name?} → فحص أولي فوري + حدث تعلم + بريد للمشرف
 *  POST {action:'confirm'|'return', confirm_token, name, note?} → قرار إنسان يرفع وزن الدليل ويعيد حساب التوأم
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeSite } from '../../../lib/portal/open';
import { MISSION_COLS, submitMission, decideMission } from '../../../lib/portal/missions-cron';
import { publicMission, evidenceReady, fileExt, evidencePath, MAX_UPLOAD } from '../../../lib/portal/missions';
import type { Mission, MissionEvidence } from '../../../lib/portal/missions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BUCKET = 'portal-missions';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];

function svc() {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !SERVICE) return null; return createClient(URL_, SERVICE, { auth: { persistSession: false } });
}
const site = () => normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);
const clean = (s: unknown, n: number) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, n);
async function byToken(db: any, col: 'token' | 'confirm_token', v: string): Promise<Mission | null> {
  const tok = clean(v, 40); if (!/^[A-Za-z0-9]{16,40}$/.test(tok)) return null;
  const { data } = await db.from('portal_missions').select(MISSION_COLS).eq(col, tok).maybeSingle(); return (data as Mission) || null;
}
async function signed(db: any, path?: string | null): Promise<string | null> {
  if (!path) return null; try { const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 300); return data?.signedUrl || null; } catch { return null; }
}
async function skillsOf(db: any, ids: string[]) { if (!ids.length) return []; const { data } = await db.from('portal_skills').select('id,code,name_ar,name_en,domain').in('id', ids); return data || []; }
async function programName(db: any, id?: string | null) { if (!id) return null; const { data } = await db.from('programs').select('name_ar').eq('id', id).maybeSingle(); return (data as any)?.name_ar || null; }

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const u = new URL(req.url); const token = u.searchParams.get('token'); const confirm = u.searchParams.get('confirm');
  if (token) {
    const m = await byToken(db, 'token', token); if (!m) return NextResponse.json({ success: true, ok: false });
    return NextResponse.json({ success: true, ok: true, mission: publicMission(m), file_url: await signed(db, m.evidence?.file_path), skills: await skillsOf(db, m.skills || []), program: await programName(db, m.program_id), has_supervisor: !!m.supervisor_email });
  }
  if (confirm) {
    const m = await byToken(db, 'confirm_token', confirm); if (!m) return NextResponse.json({ success: true, ok: false });
    const { token: _t, confirm_token: _c, supervisor_email: _s, ...rest } = m;
    return NextResponse.json({ success: true, ok: true, mission: rest, file_url: await signed(db, m.evidence?.file_path), skills: await skillsOf(db, m.skills || []), program: await programName(db, m.program_id) });
  }
  return bad('token مطلوب');
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('إعدادات الخادم غير مكتملة', 500);
  const ct = req.headers.get('content-type') || '';
  // ---- رفع ملف
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData(); const token = String(fd.get('token') || ''); const file = fd.get('file');
    const m = await byToken(db, 'token', token); if (!m) return bad('رابط غير صالح', 404);
    if (!(file instanceof File)) return bad('لا يوجد ملف');
    if (file.size > MAX_UPLOAD) return bad('الملف أكبر من 4 ميجابايت — صغّر الصورة أو قصّر التسجيل');
    const type = String(file.type || '').split(';')[0].toLowerCase(); if (!ALLOWED.includes(type)) return bad('نوع الملف غير مدعوم (صور JPEG/PNG/WebP أو صوت WebM/OGG/MP4)');
    const path = evidencePath(m.id, fileExt(file.name || '', type)); const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: type, upsert: false }); if (error) return bad(`تعذّر الرفع: ${error.message}`, 500);
    return NextResponse.json({ success: true, file_path: path, file_type: type, file_name: clean(file.name, 120), size: file.size });
  }
  const body = await req.json().catch(() => ({})); const action = String(body.action || '');
  if (action === 'submit') {
    const m = await byToken(db, 'token', String(body.token || '')); if (!m) return bad('رابط غير صالح', 404);
    if (m.status === 'confirmed') return bad('هذه المهمة مؤكَّدة بالفعل');
    const e = body.evidence || {};
    const ev: MissionEvidence = { text: clean(e.text, 4000) || undefined, transcript: clean(e.transcript, 4000) || undefined, caption: clean(e.caption, 1000) || undefined, link: clean(e.link, 500) || undefined, file_path: e.file_path && String(e.file_path).startsWith(`${m.id}/`) ? String(e.file_path) : undefined, file_type: clean(e.file_type, 60) || undefined, file_name: clean(e.file_name, 120) || undefined, duration_s: Number.isFinite(Number(e.duration_s)) ? Math.max(0, Math.min(600, Math.round(Number(e.duration_s)))) : undefined, size: Number(e.size) || undefined };
    const why = evidenceReady(m.evidence_mode, ev); if (why) return bad(why);
    const supEmail = clean(body.supervisor_email, 160).toLowerCase(); if (supEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supEmail)) return bad('بريد المشرف غير صالح');
    if (supEmail && supEmail === m.email.toLowerCase()) return bad('بريد المشرف لا يمكن أن يكون بريدك');
    const r = await submitMission(db, m, ev, { email: supEmail || null, name: clean(body.supervisor_name, 120) || null }, site());
    return NextResponse.json({ success: true, mission: publicMission(r.mission), ai: r.ai, supervisor_mailed: r.supervisor_mailed, confirm_url: `${site()}/m/confirm/${m.confirm_token}` });
  }
  if (action === 'confirm' || action === 'return') {
    const m = await byToken(db, 'confirm_token', String(body.confirm_token || '')); if (!m) return bad('رابط غير صالح', 404);
    if (m.status !== 'submitted') return bad(m.status === 'confirmed' ? 'سبق تأكيد هذه المهمة' : 'لا يوجد دليل مُرسل بعد');
    const name = clean(body.name, 120); if (name.length < 2) return bad('اكتب اسمك');
    const note = clean(body.note, 600); if (action === 'return' && note.length < 5) return bad('اكتب ملاحظة قصيرة للمتدرب عند الإعادة');
    const r = await decideMission(db, m, action === 'confirm' ? 'confirmed' : 'returned', { name, note }, site());
    const { token: _t, confirm_token: _c, supervisor_email: _s, ...rest } = r;
    return NextResponse.json({ success: true, mission: rest });
  }
  return bad('إجراء غير معروف');
}
