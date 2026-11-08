// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 «يوم تخرّجي — بكلماتي» (الاسم الرسمي: صفحة التخرّج الذاتية للمتدرّب)
 *  GET  /api/me/grad?program=<id>           → برامجي المنتهية · الصفحة (البطاقات من كلماتي · الأعداد · السطر · الختم · «منذ ذلك اليوم» · سطر الدفعة k ≥ 5)
 *  POST /api/me/grad { action, program_id }
 *       line   { line_ar }                  → «سطر التخرّج» (≤ 160) · الصوت ≤ 15 ث عبر /api/me/grad/voice (يبقى مع صاحبه)
 *       keep   { key, on }                   → أُبقي/أُخفي بطاقة
 *       public { public_keys?, live_public? }→ الوجه العام (خاصّ افتراضيًا؛ السطر والأعداد فقط حين يُفتح)
 *       seal                                 → رمز ATH-GD + بصمة (الختم الجديد يُبطل السابق)
 *       revoke                               → إبطال فوري ومعلَن · delete → حذف فوري
 *  المبدأ: ما كتبه المتدرّب بيده فقط؛ لا درجة ولا تقييم؛ لا ذكاء اصطناعي. المصادقة: Bearer (المتعلّم بنفسه) · الحدّ: 30 عملية كتابة/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { loadGradPage, saveLine, setKeep, setPublic, sealGrad, revokeGrad, deleteGrad } from '../../../../lib/grad/store';
import { P63_NAMES_AR, GRAD_LIMITS, GRAD_FOOT_AR, LINE_PROMPT_AR, CARD_AR, PUBLIC_AR, PUBLIC_KEYS, sinceLinesAr } from '../../../../lib/grad/registry';
import { freezeGate } from '../../../../lib/shield/freeze';

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
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'grad_page', entity_type: 'portal_grad_pages', entity_id: null, meta }); } catch { /* السجل اختياري */ } };

async function payload(db: any, user: { id: string; email: string; name?: string }, programId: string | null, now: Date) {
  const { programs, view } = await loadGradPage(db, user, programId, now);
  return { programs, view, since_ar: view ? sinceLinesAr(view.since) : [], names: P63_NAMES_AR, limits: GRAD_LIMITS, foot_ar: GRAD_FOOT_AR, prompt_ar: LINE_PROMPT_AR, card_ar: CARD_AR, public_ar: PUBLIC_AR, public_keys_all: PUBLIC_KEYS, now: now.toISOString() };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const pid = new URL(req.url).searchParams.get('program');
  return NextResponse.json({ success: true, ...(await payload(db, user, pid, new Date())) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const fz = await freezeGate(db, user); if (fz) return fz; /* P65 ★3 زرّ التجميد: جهة مجمَّدة = قراءة فقط */
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const now = new Date(); const pid = String(body.program_id || ''); if (!pid) return bad('حدّد البرنامج');
  const rl = await rateLimit(db, `grad:${user.id}`, 3600, 30); if (!rl.allowed) return tooMany(rl);
  if (action === 'line') { const r = await saveLine(db, user, pid, { line_ar: body.line_ar }, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'line', program_id: pid }); return NextResponse.json({ success: true, message: 'حُفظ سطر تخرّجك — بكلماتك.', ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  if (action === 'keep') { const r = await setKeep(db, user, pid, String(body.key || ''), body.on !== false, now); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, keep: r.keep, ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  if (action === 'public') { const r = await setPublic(db, user, pid, { public_keys: body.public_keys, live_public: body.live_public }, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'public', program_id: pid, live: r.live_public, keys: r.public_keys }); return NextResponse.json({ success: true, message: r.live_public ? 'صار لصفحتك وجه عام — بما اخترتَه أنت فقط.' : 'صفحتك خاصّة الآن.', ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  if (action === 'seal') { const r = await sealGrad(db, user, pid, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'seal', program_id: pid, code: r.code }); return NextResponse.json({ success: true, code: r.code, digest: r.digest, message: `خُتمت صفحة تخرّجك — رمزها ${r.code}. ما خُتم لا يتغيّر؛ وما يأتي بعده يُحسب حيًّا في «منذ ذلك اليوم».`, ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  if (action === 'revoke') { const r = await revokeGrad(db, user, pid, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'revoke', program_id: pid }); return NextResponse.json({ success: true, message: 'أُبطل الختم فورًا — وصار الإبطال معلَنًا لمن يتحقّق.', ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  if (action === 'delete') { const r = await deleteGrad(db, user, pid); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'delete', program_id: pid }); return NextResponse.json({ success: true, message: 'حُذفت صفحتك فورًا — السطر والصوت والختم.', ...(await payload(db, user, pid, now)) }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
