// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P70 «بكلماتي عبر المستوى» (الاسم الرسمي: صفحة المستوى — بكلمات المتدرّب)
 *  GET  /api/me/level?level=<enrollment:level_no>  → مستوياتي المفتوحة · الصفحة (البطاقات من كلماتي · الأعداد · السطر · الختم · سطر الشعبة k ≥ 5)
 *  GET  /api/me/level?echo=1                        → «الكلمة التي تعبر» (أول أسبوع في المستوى التالي) + كلمة العبور من الأستاذ (P70-ب) + تذكير الصفحة المفتوحة — لصاحبها وحده
 *  POST /api/me/level { action, level }
 *       line   { line_ar }                  → «سطر المستوى» (≤ 200) · الصوت ≤ 30 ث عبر /api/me/level/voice (يبقى مع صاحبه)
 *       keep   { key, on }                   → أُبقي/أُخفي بطاقة
 *       public { public_keys?, live_public? }→ الوجه العام (خاصّ افتراضيًا؛ السطر والأعداد فقط حين يُفتح)
 *       seal                                 → رمز ATH-LV + بصمة (الختم الجديد يُبطل السابق)
 *       revoke                               → إبطال فوري ومعلَن · delete → حذف فوري
 *  المبدأ: ما كتبه المتدرّب بيده وقاله بصوته فقط؛ لا درجة ولا نسبة ولا تقييم؛ لا ذكاء اصطناعي. المصادقة: Bearer · الحدّ: 30 عملية كتابة/ساعة
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, tooMany } from '../../../../lib/shield/ratelimit';
import { loadLevelPage, learnerEchoView, saveLine, setKeep, setPublic, sealLevel, revokeLevel, deleteLevel } from '../../../../lib/level/store';
import { P70_NAMES_AR, LEVEL_LIMITS, LEVEL_FOOT_AR, LINE_PROMPT_AR, CARD_AR, PUBLIC_AR, PUBLIC_KEYS } from '../../../../lib/level/registry';
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
const audit = async (db: any, user: { id: string; email: string }, meta: Record<string, unknown>) => { try { await db.from('audit_logs').insert({ actor_id: user.id, actor_email: user.email, actor_role: 'LEARNER', action: 'level_page', entity_type: 'portal_level_pages', entity_id: null, meta }); } catch { /* السجل اختياري */ } };

async function payload(db: any, user: { id: string; email: string; name?: string }, key: string | null, now: Date) {
  const { levels, view, section_line_ar } = await loadLevelPage(db, user, key, now);
  return { levels, view, section_line_ar, names: P70_NAMES_AR, limits: LEVEL_LIMITS, foot_ar: LEVEL_FOOT_AR, prompt_ar: LINE_PROMPT_AR, card_ar: CARD_AR, public_ar: PUBLIC_AR, public_keys_all: PUBLIC_KEYS, now: now.toISOString() };
}

export async function GET(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const u = new URL(req.url);
  if (u.searchParams.get('echo') === '1') { const v = await learnerEchoView(db, user, new Date()); return NextResponse.json({ success: true, echo: v.own, word: v.word, open: v.open }, { headers: NO }); } /* P70-ب: + كلمة العبور من الأستاذ + تذكير الصفحة المفتوحة */
  return NextResponse.json({ success: true, ...(await payload(db, user, u.searchParams.get('level'), new Date())) }, { headers: NO });
}

export async function POST(req: Request) {
  const c = await ctx(req); if ('error' in c) return c.error; const { db, user } = c;
  const fz = await freezeGate(db, user); if (fz) return fz; /* P65: جهة مجمَّدة = قراءة فقط */
  let body: any; try { body = await req.json(); } catch { return bad('JSON غير صالح'); }
  const action = String(body.action || ''); const now = new Date(); const key = String(body.level || ''); if (!key) return bad('حدّد المستوى');
  const rl = await rateLimit(db, `level:${user.id}`, 3600, 30); if (!rl.allowed) return tooMany(rl);
  if (action === 'line') { const r = await saveLine(db, user, key, { line_ar: body.line_ar }, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'line', level: key }); return NextResponse.json({ success: true, message: 'حُفظ سطر مستواك — بكلماتك.', ...(await payload(db, user, key, now)) }, { headers: NO }); }
  if (action === 'keep') { const r = await setKeep(db, user, key, String(body.key || ''), body.on !== false, now); if (!r.ok) return bad(r.error, r.status); return NextResponse.json({ success: true, keep: r.keep, ...(await payload(db, user, key, now)) }, { headers: NO }); }
  if (action === 'public') { const r = await setPublic(db, user, key, { public_keys: body.public_keys, live_public: body.live_public }, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'public', level: key, live: r.live_public, keys: r.public_keys }); return NextResponse.json({ success: true, message: r.live_public ? 'فُتح الوجه العام بما اخترتَه أنت.' : 'الوجه العام مغلق — صفحتك لك وحدك.', ...(await payload(db, user, key, now)) }, { headers: NO }); }
  if (action === 'seal') { const r = await sealLevel(db, user, key, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'seal', level: key, code: r.code }); return NextResponse.json({ success: true, code: r.code, digest: r.digest, message: `خُتمت صفحة مستواك — رمزها ${r.code}. كلمتك تعبر معك.`, ...(await payload(db, user, key, now)) }, { headers: NO }); }
  if (action === 'revoke') { const r = await revokeLevel(db, user, key, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'revoke', level: key }); return NextResponse.json({ success: true, message: 'أُبطل الختم فورًا — وصار الإبطال معلَنًا لمن يتحقّق.', ...(await payload(db, user, key, now)) }, { headers: NO }); }
  if (action === 'delete') { const r = await deleteLevel(db, user, key, now); if (!r.ok) return bad(r.error, r.status); await audit(db, user, { action: 'delete', level: key }); return NextResponse.json({ success: true, message: 'حُذفت صفحتك فورًا — السطر والصوت والختم.', ...(await payload(db, user, key, now)) }, { headers: NO }); }
  return bad('إجراء غير معروف');
}
