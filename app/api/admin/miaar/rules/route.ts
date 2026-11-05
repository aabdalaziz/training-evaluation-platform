// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «تعليمات الاختبار وإقرار الممتحن» (م8-ج) — للطاقم
 *  GET                → النصّ الحالي (عربي/إنجليزي) · الإصدار · آخر تعديل · هل يحقّ لي التحرير
 *  POST save {ar, en} → إصدار جديد (مديرون فقط) — كل ممتحن بعده يقرّ بالإصدار الجديد
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson } from '../../../../../lib/shield/body';
import { getRules, setRules, parseRules, countPoints, RULES_TITLE, RULES_MAX, FACTORY_RULES } from '../../../../../lib/miaar/rules';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 60;
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status });
const NO = { 'Cache-Control': 'no-store' };
async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('يلزم تسجيل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user) return { error: bad('جلسة غير صالحة', 401) };
  const { data: prof } = await userDb.from('profiles').select('role,full_name').eq('id', data.user.id).maybeSingle(); const role = String((prof as any)?.role || '').toUpperCase();
  if (!STAFF.includes(role)) return { error: bad('غير مصرّح — للطاقم فقط', 403) };
  return { db, user: { id: data.user.id, email: String(data.user.email || '').toLowerCase(), role, name: String((prof as any)?.full_name || '') } };
}
async function audit(db: any, user: { id: string; email: string; role: string }, action: string, entityId: string, label: string, metadata: Record<string, unknown>) {
  try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: user.role, action, entity_type: 'miaar_rules', entity_id: entityId, entity_label: label, source: 'admin', metadata }); } catch { /* تحسيني */ }
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db } = c;
  const rules = await getRules(db);
  return NextResponse.json({ success: true, rules, title: RULES_TITLE, max: RULES_MAX, points: { ar: countPoints(rules.ar), en: countPoints(rules.en) }, blocks: { ar: parseRules(rules.ar), en: parseRules(rules.en) }, factory: { ar: FACTORY_RULES.ar, en: FACTORY_RULES.en }, me: { can_edit: ADMINS.includes(c.user.role) } }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad(j.error, j.status); const b = j.body as Record<string, unknown>;
  if (String(b.action || '') !== 'save') return bad('إجراء غير معروف');
  if (!ADMINS.includes(user.role)) return bad('تحرير التعليمات للمديرين فقط', 403);
  const r = await setRules(db, { ar: b.ar, en: b.en }, user.email || user.id); if (!r.ok) return bad(r.error);
  await audit(db, user, 'miaar_rules_update', String(r.rules.version), `تعليمات الاختبار — الإصدار ${r.rules.version}`, { version: r.rules.version, ar_len: r.rules.ar.length, en_len: r.rules.en.length });
  return NextResponse.json({ success: true, rules: r.rules }, { headers: NO });
}
