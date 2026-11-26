// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * /api/reader/card — «بطاقة أَثَر الرقمية»
 *  GET  (Bearer المستخدم)              → { token, name, expires_at } رمز QR موقَّع للمستخدم نفسه (لا يحمل بيانات شخصية)
 *  POST { token } (Bearer طاقم التسجيل) → يحلّ الرمز: { name, email, phone, org } لتعبئة نموذج الحضور/التسجيل — يُسجَّل كلّ حلّ في audit_logs (source reader)
 *  الأدوار المخوَّلة بالحلّ: PASS_READERS (lib/reader/card.ts). لا صور، لا تخزين للرمز.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { PASS_READERS, signPass, verifyPass } from '../../../../lib/reader/card';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });

async function who(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle();
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role: String((prof as any)?.role || '').toUpperCase(), name: String((prof as any)?.full_name || '') } };
}

export async function GET(req: Request) {
  const c = await who(req); if ('error' in c) return c.error;
  const token = await signPass(c.user.id, process.env as Record<string, string | undefined>);
  const exp = Number(JSON.parse(Buffer.from(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).e) * 1000;
  return NextResponse.json({ success: true, token, name: c.user.name || c.user.email, expires_at: new Date(exp).toISOString() }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: Request) {
  const c = await who(req); if ('error' in c) return c.error;
  if (!PASS_READERS.includes(c.user.role)) return bad('غير مصرّح — لطاقم التسجيل والحضور', 403);
  const rj = await readJson(req); if (!rj.ok) return bad(rj.error, rj.status); const token = String((rj.body as any)?.token || '').trim();
  const p = await verifyPass(token, process.env as Record<string, string | undefined>); if (!p) return bad('بطاقة غير صالحة أو منتهية', 422);
  const { data: prof } = await c.db.from('profiles').select('id,full_name,email,phone,organization_id').eq('id', p.u).maybeSingle();
  if (!prof) return bad('صاحب البطاقة غير موجود', 404);
  let org: string | null = null;
  if ((prof as any).organization_id) { /* الجهة قد تعيش في portal_organizations أو الجدول القديم organizations */
    const { data: a } = await c.db.from('portal_organizations').select('name_ar').eq('id', (prof as any).organization_id).maybeSingle(); org = (a as any)?.name_ar || null;
    if (!org) { const { data: b } = await c.db.from('organizations').select('*').eq('id', (prof as any).organization_id).maybeSingle(); org = (b as any)?.name_ar || (b as any)?.name || null; }
  }
  try { await c.db.from('audit_logs').insert({ actor_id: c.user.id, actor_email: c.user.email, action: 'pass_resolve', entity_type: 'profile', entity_id: String((prof as any).id), source: 'reader', metadata: { role: c.user.role } }); } catch { /* السجلّ ثانوي */ }
  return NextResponse.json({ success: true, person: { id: (prof as any).id, name: (prof as any).full_name || '', email: (prof as any).email || '', phone: (prof as any).phone || '', org } });
}
