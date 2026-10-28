// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/media — تسجيلات الأداء (فيديو/صوت) من «القناة الواحدة» (أَثَر · P13-ج)
 *  POST multipart: file + kind + context_type + context_id? + transcript? + duration_sec + skill_ids? + title?
 *       → رفع إلى مخزن athar-media الخاص + صف في portal_media + حدث تعلّم «أداء مُشاهَد» (وزن 0.6) في التوأم المهاري
 *  GET  ?id=<media>                      → رابط موقّع (5 دقائق) + بيانات التسجيل (صاحبه أو موظف)
 *  GET  ?mine=1                          → تسجيلاتي
 *  GET  ?pending=1  (موظف)               → ما ينتظر المراجعة البشرية (+ روابط موقّعة)
 *  PATCH { id, action:'approve'|'reject', note? } (موظف) → يرفع وزن الدليل إلى 0.85 أو يستبعده — الآلة تقدّر، الإنسان يعتمد
 *  DELETE ?id=                           → حذف تسجيلي (صاحبه) من المخزن والسجل
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateMedia, mediaPath, mediaEvidenceEvent, transcriptScore, MEDIA_LIMITS } from '../../../lib/portal/media';
import type { MediaRow, MediaContext } from '../../../lib/portal/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const BUCKET = 'athar-media';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول لحفظ التسجيل', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const user = { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || ''), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
  return { db, user };
}
async function signed(db: any, path: string): Promise<string | null> { try { const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 300); return data?.signedUrl || null; } catch { return null; } }
async function upsertEvent(db: any, m: MediaRow, score: number | null) {
  const ev = mediaEvidenceEvent(m, score);
  const { data: old } = await db.from('portal_learning_events').select('id').eq('object_type', 'media').eq('object_id', m.id).limit(1);
  if ((old || []).length) await db.from('portal_learning_events').update({ context: ev.context, at: ev.at }).eq('id', old[0].id); else await db.from('portal_learning_events').insert(ev);
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let fd: FormData; try { fd = await req.formData(); } catch { return bad('الطلب ليس multipart/form-data'); }
  const file = fd.get('file'); if (!(file instanceof Blob)) return bad('لا يوجد ملف');
  const mime = String(fd.get('mime') || (file as any).type || ''); const duration = Math.round(Number(fd.get('duration_sec') || 0));
  const context_type = String(fd.get('context_type') || 'free') as MediaContext; const context_id = String(fd.get('context_id') || '').slice(0, 120) || null;
  const transcript = String(fd.get('transcript') || '').slice(0, 6000) || null; const title = String(fd.get('title') || '').slice(0, 200) || null;
  const skill_ids = String(fd.get('skill_ids') || '').split(',').map(s => s.trim()).filter(s => UUID.test(s)).slice(0, 12);
  const parties = String(fd.get('parties') || '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 8);
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateMedia({ mime, bytes: buf.length, duration_sec: duration, context_type }); if (!v.ok) return bad(v.error_ar);
  // حد يومي لطيف: 12 تسجيلًا لكل مستخدم
  const since = new Date(Date.now() - 86400000).toISOString(); const { count } = await db.from('portal_media').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', since);
  if ((count || 0) >= 12) return bad('بلغت حد 12 تسجيلًا في 24 ساعة — عد غدًا.', 429);
  const id = (globalThis.crypto as any)?.randomUUID ? (globalThis.crypto as any).randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const path = mediaPath(user.id, id, v.ext);
  const { error: ue } = await db.storage.from(BUCKET).upload(path, buf, { contentType: v.mime, upsert: false }); if (ue) return bad(`تعذّر الرفع: ${ue.message}`, 500);
  const row: any = { id, user_id: user.id, email: user.email, kind: v.kind, path, mime: v.mime, bytes: buf.length, duration_sec: Math.min(duration, MEDIA_LIMITS.maxSeconds), transcript, context_type, context_id, skill_ids, title, status: 'uploaded' };
  const { data: saved, error } = await db.from('portal_media').insert(row).select('*').maybeSingle(); if (error) { await db.storage.from(BUCKET).remove([path]); return bad(`تعذّر الحفظ: ${error.message}`, 500); }
  const m = (saved || row) as MediaRow; const ts = transcript ? transcriptScore(transcript, parties) : null;
  if (skill_ids.length) await upsertEvent(db, m, ts ? ts.score : null);
  if (context_type === 'daily_case' && context_id) { try { await db.from('portal_daily_case_responses').update({ media_id: id }).eq('user_id', user.id).eq('day', context_id); } catch { /* ignore */ } }
  return NextResponse.json({ success: true, media: { id, kind: v.kind, duration_sec: row.duration_sec, status: 'uploaded', context_type, context_id, created_at: (saved as any)?.created_at || new Date().toISOString() }, score: ts, url: await signed(db, path), evidence: skill_ids.length > 0 });
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (id) {
    if (!UUID.test(id)) return bad('معرّف غير صالح');
    const { data: m } = await db.from('portal_media').select('*').eq('id', id).maybeSingle(); if (!m) return bad('غير موجود', 404);
    if ((m as any).user_id !== user.id && !user.staff) return bad('غير مصرّح', 403);
    return NextResponse.json({ success: true, media: m, url: await signed(db, (m as any).path) });
  }
  if (url.searchParams.get('pending') === '1') {
    if (!user.staff) return bad('غير مصرّح', 403);
    const { data } = await db.from('portal_media').select('*').eq('status', 'uploaded').order('created_at', { ascending: false }).limit(60);
    const items = [] as any[]; for (const m of (data || []) as any[]) items.push({ ...m, url: await signed(db, m.path) });
    const { count: approved } = await db.from('portal_media').select('id', { count: 'exact', head: true }).eq('status', 'approved');
    return NextResponse.json({ success: true, items, stats: { pending: items.length, approved: approved || 0 } });
  }
  const { data } = await db.from('portal_media').select('id,kind,duration_sec,context_type,context_id,title,status,created_at,transcript').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30);
  return NextResponse.json({ success: true, items: data || [] });
}

export async function PATCH(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; if (!user.staff) return bad('غير مصرّح', 403);
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const id = String(body.id || ''); const action = String(body.action || ''); if (!UUID.test(id) || !['approve', 'reject'].includes(action)) return bad('طلب غير مكتمل');
  const { data: m } = await db.from('portal_media').select('*').eq('id', id).maybeSingle(); if (!m) return bad('غير موجود', 404);
  const status = action === 'approve' ? 'approved' : 'rejected'; const note = String(body.note || '').slice(0, 500) || null;
  const { error } = await db.from('portal_media').update({ status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note }).eq('id', id); if (error) return bad(error.message, 500);
  const row = { ...(m as any), status } as MediaRow; const score = Number.isFinite(Number(body.score)) ? Math.max(0, Math.min(100, Number(body.score))) : (row.transcript ? transcriptScore(row.transcript).score : null);
  if ((row.skill_ids || []).length) await upsertEvent(db, row, score);
  return NextResponse.json({ success: true, id, status });
}

export async function DELETE(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const id = new URL(req.url).searchParams.get('id') || '';
  if (!UUID.test(id)) return bad('معرّف غير صالح');
  const { data: m } = await db.from('portal_media').select('id,user_id,path').eq('id', id).maybeSingle(); if (!m) return bad('غير موجود', 404);
  if ((m as any).user_id !== user.id && !user.staff) return bad('غير مصرّح', 403);
  await db.storage.from(BUCKET).remove([(m as any).path]); await db.from('portal_learning_events').delete().eq('object_type', 'media').eq('object_id', id); await db.from('portal_media').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
