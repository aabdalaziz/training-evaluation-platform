// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/shield/access — منارة الوصول الإداري (P65): AdminShell يرسل المسار عند فتح صفحة إدارية تحمل بيانات شخصية.
 *  الخادم يتحقّق من الجلسة والدور، ويرفض ما ليس في قائمة PII_PATHS، ويسجّل صفًّا واحدًا لكل (مستخدم × مسار × يوم). 204 دائمًا للمتصفح.
 *  POST { path, subject_email? } — subject_email اختياري من صفحات تفتح ملفًّا بعينه (يُخزَّن بصمةً).
 */
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../lib/shield/body';
import { ipOf } from '../../../../lib/shield/ratelimit';
import { recordAccess } from '../../../../lib/shield/access';
import { isPiiPath } from '../../../../lib/shield/paths';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: Request) {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const A = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!U || !A || !K) return new Response(null, { status: 204 });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return new Response(null, { status: 401 });
  const r = await readJson(req, { maxBytes: 4 * 1024 }); if (!r.ok) return new Response(null, { status: 204 });
  const path = String(r.body?.path || ''); if (!isPiiPath(path)) return new Response(null, { status: 204 });
  const { data } = await createClient(U, A, { global: { headers: { Authorization: `Bearer ${token}` } } }).auth.getUser(token); if (!data?.user) return new Response(null, { status: 401 });
  const db = createClient(U, K, { auth: { persistSession: false } });
  const { data: prof } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  await recordAccess(db, { user_id: data.user.id, role: String((prof as any)?.role || ''), path, subject_email: r.body?.subject_email ? String(r.body.subject_email).slice(0, 200) : null, ip: ipOf(req) });
  return new Response(null, { status: 204 });
}
