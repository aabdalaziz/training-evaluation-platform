// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/rooms — غرف أَثَر الصغيرة: فيديو من داخل المنصة حتى 6 أشخاص (أَثَر · P13-ج)
 *  التنسيق (signaling) يجري في المتصفح عبر قناة Supabase الفورية `room:<code>`؛ هذا المسار يدير دورة حياة الغرفة فقط.
 *  GET  ?code=<ABC234>                                      → بيانات الغرفة (مسجّل دخول)
 *  GET  ?session=<id>                                       → غرف جلسة حية (مسجّل دخول)
 *  POST { action:'create', kind:'dialogue'|'consult'|'support', title?, prompt?, minutes? }            → غرفة واحدة (أي مستخدم مسجّل · 3 غرف مفتوحة كحد أقصى)
 *  POST { action:'breakouts', session_id, count?, prompt?, minutes? }                        → غرف صغيرة لجلسة (موظف/مدرب الجلسة/منشئها)
 *  POST { action:'note', code, text }                                                        → سطر الغرفة الذي تعود به إلى الجلسة (يظهر في الميسِّر والمحضر)
 *  POST { action:'close', code }                                                             → إغلاق (المنشئ/موظف)
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { roomCode, isRoomCode, roomCountFor, ROOM_DEFAULT_PROMPT } from '../../../lib/portal/media';
import type { RoomKind } from '../../../lib/portal/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { error: bad('سجّل الدخول للانضمام إلى الغرفة', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const user = { id: data.user.id, email: String(data.user.email || '').toLowerCase(), name: String((prof as any)?.full_name || data.user.user_metadata?.full_name || '').trim(), staff: STAFF.includes(String((prof as any)?.role || '').toUpperCase()) };
  return { db, user };
}
async function uniqueCode(db: any): Promise<string> { for (let i = 0; i < 6; i++) { const c = roomCode(); const { data } = await db.from('portal_rooms').select('id').eq('code', c).limit(1); if (!(data || []).length) return c; } return roomCode() + roomCode().slice(0, 2); }
async function canRunSession(db: any, user: { id: string; email: string; staff: boolean }, sessionId: string) {
  const { data: s } = await db.from('portal_sessions').select('id,title_ar,trainer_id,created_by,status').eq('id', sessionId).maybeSingle(); if (!s) return { error: bad('الجلسة غير موجودة', 404) };
  if (user.staff || (s as any).created_by === user.id) return { s };
  const { data: tr } = await db.from('trainers').select('id').ilike('email', user.email); if (((tr || []) as any[]).some(t => t.id === (s as any).trainer_id)) return { s };
  return { error: bad('هذه الجلسة ليست من جلساتك', 403) };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c; const url = new URL(req.url);
  const code = String(url.searchParams.get('code') || '').toUpperCase(); const session = url.searchParams.get('session');
  if (code) {
    if (!isRoomCode(code)) return bad('رمز غرفة غير صالح');
    const { data: r } = await db.from('portal_rooms').select('*').eq('code', code).maybeSingle(); if (!r) return bad('الغرفة غير موجودة', 404);
    return NextResponse.json({ success: true, room: r, me: { id: user.id, name: user.name || user.email.split('@')[0] }, realtime: { url: process.env.NEXT_PUBLIC_SUPABASE_URL, channel: `room:${code}` } });
  }
  if (session) {
    if (!UUID.test(session)) return bad('معرّف غير صالح');
    const { data } = await db.from('portal_rooms').select('*').eq('session_id', session).order('created_at', { ascending: true });
    return NextResponse.json({ success: true, rooms: data || [] });
  }
  const { data } = await db.from('portal_rooms').select('*').eq('created_by', user.id).eq('status', 'open').order('created_at', { ascending: false }).limit(10);
  return NextResponse.json({ success: true, rooms: data || [] });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || '');
  if (action === 'create') {
    const kind = (['dialogue', 'consult', 'support'].includes(String(body.kind)) ? String(body.kind) : 'dialogue') as RoomKind;
    const { count } = await db.from('portal_rooms').select('id', { count: 'exact', head: true }).eq('created_by', user.id).eq('status', 'open').gte('created_at', new Date(Date.now() - 6 * 3600000).toISOString());
    if ((count || 0) >= 3 && !user.staff) return bad('لديك 3 غرف مفتوحة بالفعل — أغلق واحدة أولًا.', 429);
    const code = await uniqueCode(db); const minutes = Math.max(5, Math.min(60, Number(body.minutes) || 15));
    const row = { code, title: String(body.title || '').slice(0, 120) || (kind === 'consult' ? 'غرفة استشارة' : 'غرفة حوار'), kind, created_by: user.id, prompt: String(body.prompt || '').slice(0, 400) || ROOM_DEFAULT_PROMPT[kind], max_peers: Math.max(2, Math.min(6, Number(body.max_peers) || 6)), minutes, status: 'open', notes: [] };
    const { data, error } = await db.from('portal_rooms').insert(row).select('*').maybeSingle(); if (error) return bad(error.message, 500);
    return NextResponse.json({ success: true, room: data || row });
  }
  if (action === 'breakouts') {
    const sid = String(body.session_id || ''); if (!UUID.test(sid)) return bad('معرّف الجلسة غير صالح');
    const ok = await canRunSession(db, user, sid); if ('error' in ok) return ok.error;
    const { count: joined } = await db.from('portal_learning_events').select('id', { count: 'exact', head: true }).eq('verb', 'joined').eq('object_type', 'session').eq('object_id', sid);
    const n = Math.max(1, Math.min(12, Number(body.count) || roomCountFor(joined || 0))); const minutes = Math.max(3, Math.min(30, Number(body.minutes) || 5)); const prompt = String(body.prompt || '').slice(0, 400) || ROOM_DEFAULT_PROMPT.breakout;
    // أغلق الغرف السابقة المفتوحة لهذه الجلسة
    await db.from('portal_rooms').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('session_id', sid).eq('status', 'open');
    const rows = [] as any[]; for (let i = 0; i < n; i++) rows.push({ code: await uniqueCode(db), title: `غرفة ${i + 1} · ${String((ok.s as any).title_ar || '').slice(0, 60)}`, kind: 'breakout', session_id: sid, created_by: user.id, prompt, max_peers: 6, minutes, status: 'open', notes: [] });
    const { data, error } = await db.from('portal_rooms').insert(rows).select('*'); if (error) return bad(error.message, 500);
    try { await db.from('portal_copilot_log').insert({ session_id: sid, user_id: user.id, kind: 'accepted', code: 'breakout_rooms', payload: { count: n, minutes, prompt, codes: rows.map(r => r.code) } }); } catch { /* ignore */ }
    return NextResponse.json({ success: true, rooms: data || rows });
  }
  if (action === 'note') {
    const code = String(body.code || '').toUpperCase(); const text = String(body.text || '').trim().slice(0, 500); if (!isRoomCode(code) || text.length < 3) return bad('اكتب سطرًا واحدًا على الأقل');
    const { data: r } = await db.from('portal_rooms').select('id,notes,session_id').eq('code', code).maybeSingle(); if (!r) return bad('الغرفة غير موجودة', 404);
    const notes = [...(((r as any).notes || []) as any[]), { by: user.id, name: user.name || user.email.split('@')[0], text, at: new Date().toISOString() }].slice(-30);
    const { error } = await db.from('portal_rooms').update({ notes }).eq('id', (r as any).id); if (error) return bad(error.message, 500);
    if ((r as any).session_id) { try { await db.from('portal_copilot_log').insert({ session_id: (r as any).session_id, user_id: user.id, kind: 'note', code: `room:${code}`, payload: { text: `[${code}] ${text}`, room: code, by: user.name || user.email } }); } catch { /* ignore */ } }
    return NextResponse.json({ success: true, notes });
  }
  if (action === 'close') {
    const code = String(body.code || '').toUpperCase(); if (!isRoomCode(code)) return bad('رمز غير صالح');
    const { data: r } = await db.from('portal_rooms').select('id,created_by').eq('code', code).maybeSingle(); if (!r) return bad('الغرفة غير موجودة', 404);
    if ((r as any).created_by !== user.id && !user.staff) return bad('غير مصرّح', 403);
    await db.from('portal_rooms').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', (r as any).id);
    return NextResponse.json({ success: true });
  }
  return bad('إجراء غير معروف');
}
