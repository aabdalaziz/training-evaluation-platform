// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P62 «رسالة إلى نفسي بعد سنة» — الطبعة الثانية (الاسم الرسمي: الرسالة المؤجَّلة للمتدرّب)
 *  GET  /api/me/letter                      → رسائلي (النصّ محجوب حتى الفتح) · ظرف الدفعة · برامجي · الآفاق · بذرة اليوم · الحدود
 *  POST /api/me/letter { action }
 *       write  { body_ar?, media_id?, horizon?, program_id?, prompt_key?, context_key?, chain_of? } → ختم
 *       open   { id }                        → فتح (في موعدها أو قبله موسومًا) + مرآة «ما حدث فعلًا»
 *       reply  { id, reply_ar?, media_id? }  → ردّ على نفسك القديمة
 *       delete { id }                        → حذف فوري (النصّ + الصوت + الردّ)
 *       cohort_write { program_id, body_ar } · cohort_delete { id }
 *  المبدأ: لا يقرؤها أحد غير صاحبها — ولا الخادم يعيدها قبل موعدها. الصوت عبر /api/media (المالك فقط). لا ذكاء اصطناعي. لا أثر على أي تقييم.
 *  المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 20 عملية كتابة/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { myLetters, myPrograms, writeLetter, openLetter, replyLetter, deleteLetter, cohortFor, writeCohortLine, deleteCohortLine } from '../../../../lib/letters/store';
import { legacyLetters } from '../../../../lib/letters/legacy'; /* P63: رسائل P39 القديمة — قراءة فقط */
import { P62_NAMES_AR, HORIZONS, PROMPTS, promptOfDay, LETTER_LIMITS, LETTER_FOOT_AR, chainOf } from '../../../../lib/letters/self';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO = { 'Cache-Control': 'private, no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ success: false, error }, { status, headers: NO });
const noStore: typeof fetch = (i, init) => fetch(i, { ...(init || {}), cache: 'no-store' });

async function ctx(req: Request) {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !ANON || !SERVICE) return { error: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''; if (!token) return { error: bad('سجّل الدخول', 401) };
  const userDb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${token}` } } }); const { data } = await userDb.auth.getUser(token); if (!data?.user?.email) return { error: bad('جلسة الدخول غير صالحة', 401) };
  const db = createClient(URL_, SERVICE, { auth: { persistSession: false }, global: { fetch: noStore } });
  const name = String((data.user.user_metadata as any)?.full_name || (data.user.user_metadata as any)?.name || '').trim();
  return { db, user: { id: data.user.id, email: String(data.user.email).toLowerCase(), name: name || undefined } };
}
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'self_letter', entity_type: 'portal_time_capsules', entity_id: null, meta }); } catch { /* السجل اختياري */ } };

async function payload(db: any, user: { id: string; email: string; name?: string }, now: Date) {
  const [letters, cohort, programs, legacy] = await Promise.all([myLetters(db, user, now), cohortFor(db, user, now), myPrograms(db, user), legacyLetters(db, user)]);
  return { legacy, letters, chain: chainOf(letters), cohort, programs, horizons: HORIZONS, prompts: PROMPTS, prompt_today: promptOfDay(now), limits: LETTER_LIMITS, names: P62_NAMES_AR, foot_ar: LETTER_FOOT_AR, sealed: letters.filter((l) => l.state !== 'opened').length, now: now.toISOString() };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  return NextResponse.json({ success: true, ...(await payload(db, user, new Date())) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const now = new Date(); const id = Number(body.id || 0);
  if (['write', 'reply', 'cohort_write'].includes(action)) { const rl = await rateLimit(db, `letter:${user.id}`, 3600, 20); if (!rl.allowed) return tooMany(rl); }
  if (action === 'write') {
    const r = await writeLetter(db, user, { body_ar: body.body_ar, media_id: body.media_id || null, horizon: body.horizon || '1y', program_id: body.program_id || null, prompt_key: body.prompt_key || null, context_key: body.context_key || 'free', chain_of: body.chain_of ? Number(body.chain_of) : null }, now); if (!r.ok) return bad(r.error, r.status);
    await audit(db, user, { action: 'write', id: r.letter.id, horizon: r.letter.horizon, has_media: r.letter.has_media, chain_of: r.letter.chain_of });
    return NextResponse.json({ success: true, letter: r.letter, message: `خُتمت رسالتك — تُفتح ${r.letter.opens_ar} الساعة ${r.letter.open_hour_ar}، في ساعة كتابتها نفسها.`, ...(await payload(db, user, now)) }, { headers: NO });
  }
  if (action === 'open') {
    const r = await openLetter(db, user, id, now); if (!r.ok) return bad(r.error, r.status);
    await audit(db, user, { action: r.early ? 'open_early' : 'open', id });
    return NextResponse.json({ success: true, letter: r.letter, mirror: r.mirror, early: r.early, ...(await payload(db, user, now)) }, { headers: NO });
  }
  if (action === 'reply') {
    const r = await replyLetter(db, user, id, { reply_ar: body.reply_ar, media_id: body.media_id || null }, now); if (!r.ok) return bad(r.error, r.status);
    await audit(db, user, { action: 'reply', id });
    return NextResponse.json({ success: true, letter: r.letter, message: 'وصل ردّك إلى نفسك القديمة — وبقي معك.', ...(await payload(db, user, now)) }, { headers: NO });
  }
  if (action === 'delete') {
    const r = await deleteLetter(db, user, id); if (!r.ok) return bad(r.error, r.status);
    await audit(db, user, { action: 'delete', id });
    return NextResponse.json({ success: true, message: 'حُذفت الرسالة فورًا — نصًّا وصوتًا.', ...(await payload(db, user, now)) }, { headers: NO });
  }
  if (action === 'cohort_write') {
    const r = await writeCohortLine(db, user, String(body.program_id || ''), String(body.body_ar || ''), now); if (!r.ok) return bad(r.error, r.status);
    await audit(db, user, { action: 'cohort_write', id: r.id, program_id: String(body.program_id || '') });
    return NextResponse.json({ success: true, id: r.id, message: 'خُتم سطرك في ظرف الدفعة — يُفتح للخرّيجين بعد سنة من نهاية البرنامج، بلا اسمك.', ...(await payload(db, user, now)) }, { headers: NO });
  }
  if (action === 'cohort_delete') {
    const r = await deleteCohortLine(db, user, id); if (!r.ok) return bad(r.error, r.status);
    return NextResponse.json({ success: true, message: 'حُذف سطرك من ظرف الدفعة.', ...(await payload(db, user, now)) }, { headers: NO });
  }
  return bad('إجراء غير معروف');
}
