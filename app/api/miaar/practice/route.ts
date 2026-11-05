// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /api/miaar/practice — م10 «مِران»: واجهة المتعلّم برمز نتيجته (بلا حساب · بلا بريد في الردّ)
 *  GET  ?code=ML-XXXX-XXXX                                  → الخطّة (الأيام · بطاقة اليوم المفتوح · المرآة · الجاهزية) أو 404 إن لا خطّة معتمدة
 *  POST {action:'answer', code, day, item, option}          → تصحيح على الخادم + تغذية راجعة (ويُسجَّل البند «مكشوفًا» لهذا البريد)
 *  POST {action:'text',   code, day, text}                  → مرآة النصّ المحلية (بلا درجة) · «تمرين مزدوج»
 *  POST {action:'ai_feedback', code, day}                   → تعليق ذكاء اصطناعي اختياري على نصّ اليوم (بموافقة صريحة · ميزانية يومية · محلي بلا مفتاح)
 *  الرمز سرّ حامله: حدّ 60 طلبًا/ساعة لكل IP كما بطاقة النتيجة. لا درجة رسمية هنا إطلاقًا.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { readJson, crossSiteBrowserWrite } from '../../../../lib/shield/body';
import { rateLimit, ipOf, tooMany } from '../../../../lib/shield/ratelimit';
import { isResultCode } from '../../../../lib/miaar/registry';
import { learnerView, answerItem, submitText, textMirror, PRACTICE_TITLE } from '../../../../lib/miaar/practice';
import { runAi, aiUsage, logAi } from '../../../../lib/ai/athar';

export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const maxDuration = 30;
const NO = { 'Cache-Control': 'no-store' };
const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: NO });
const svc = () => { const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const K = process.env.SUPABASE_SERVICE_ROLE_KEY; return U && K ? createClient(U, K, { auth: { persistSession: false } }) : null; };
async function repByCode(db: any, code: string) { const { data } = await db.from('placement_reports').select('id, candidate_email, access_code, report, invite_id').eq('access_code', code).maybeSingle(); return data || null; }

export async function GET(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  const code = String(new URL(req.url).searchParams.get('code') || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
  const rl = await rateLimit(db, `miaar_result:${ipOf(req)}`, 3600, 60); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const rep = await repByCode(db, code); if (!rep) return bad('not_found', 404);
  const v = await learnerView(db, rep).catch(() => null); if (!v) return bad('no_plan', 404);
  return NextResponse.json({ ok: true, code, name: String(rep.report?.بيانات_المتقدم?.الاسم || '').split(/\s+/)[0] || '—', title: PRACTICE_TITLE, ...v }, { headers: NO });
}

export async function POST(req: Request) {
  const db = svc(); if (!db) return bad('server_not_configured', 500);
  if (crossSiteBrowserWrite(req)) return bad('origin_not_allowed', 403);
  const j = await readJson(req, { maxBytes: 64 * 1024 }); if (!j.ok) return bad('invalid_json', 400); const b = j.body as Record<string, unknown>;
  const code = String(b.code || '').toUpperCase(); if (!isResultCode(code)) return bad('invalid_code', 400);
  const rl = await rateLimit(db, `miaar_practice:${ipOf(req)}`, 3600, 300); if (!rl.allowed) return tooMany(rl, 'محاولات كثيرة');
  const rep = await repByCode(db, code); if (!rep) return bad('not_found', 404);
  const action = String(b.action || '');
  /* 404 لا خطّة فعّالة · 409 حالة (أُجيب/أُغلق اليوم/خارج النافذة) · 400 مدخلات */
  const codeOf = (e: string) => (e === 'no_active_plan' ? 404 : e === 'already_answered' || e === 'day_closed' || e === 'plan_window' ? 409 : 400);
  if (action === 'answer') { const r = await answerItem(db, rep, { day: b.day, item: b.item, option: b.option }); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  if (action === 'text') { const r = await submitText(db, rep, { day: b.day, text: b.text }); return r.ok ? NextResponse.json(r, { headers: NO }) : bad(r.error, codeOf(r.error)); }
  if (action === 'ai_feedback') {
    if (b.consent !== true) return bad('consent_required', 400);
    const text = String(b.text || '').slice(0, 1500); if (!/[\u0600-\u06FF]/.test(text) || text.length < 10) return bad('text_too_short', 400);
    const v = await learnerView(db, rep).catch(() => null); if (!v || !v.بطاقة_اليوم) return bad('no_active_plan', 404);
    const planId = String((await db.from('miaar_practice_plans').select('id').eq('report_id', rep.id).maybeSingle()).data?.id || ''); if (!planId) return bad('no_active_plan', 404);
    const usage = await aiUsage(db, planId, 'miaar_practice_feedback'); if (!usage.allowed) return bad('ai_budget', 429);
    const local = () => ({ notes_ar: textMirror(text).notes_ar, rewrite_ar: null as string | null });
    const r = await runAi<{ notes_ar: string[]; rewrite_ar: string | null }>({
      system: 'أنت معلّم عربية للناطقين بغيرها (CEFR). علّق على نصّ متعلّم تعليقًا تكوينيًا قصيرًا بالعربية البسيطة: ثلاث ملاحظات محدّدة (ما أحسن فيه · خطأ واحد يصلحه · اقتراح) — بلا درجة ولا مستوى ولا حكم. ثم أعد كتابة جملة واحدة من نصّه بصيغة أصحّ. أجب بـ JSON فقط: {"notes_ar":["…","…","…"],"rewrite_ar":"…"}',
      user: `المستوى ${v.المستوى} · الوحدة: ${v.بطاقة_اليوم.unit_title} — ${v.بطاقة_اليوم.focus_ar}\nالنصّ:\n${text}`,
      parse: (raw) => { const m = raw.match(/\{[\s\S]*\}/); if (!m) return null; try { const o = JSON.parse(m[0]); const notes = Array.isArray(o.notes_ar) ? o.notes_ar.map(String).slice(0, 4) : []; if (!notes.length) return null; return { notes_ar: notes, rewrite_ar: typeof o.rewrite_ar === 'string' ? o.rewrite_ar.slice(0, 300) : null }; } catch { return null; } },
      local, budgetMs: 20000, json: true,
    });
    await logAi(db, { user_id: planId, email: '-', role: 'learner', purpose: 'miaar_practice_feedback', result: r, context: { code: code.slice(0, 7) + '…', day: v.بطاقة_اليوم.d } });
    return NextResponse.json({ ok: true, source: r.source, ...r.data }, { headers: NO });
  }
  return bad('unknown_action', 400);
}
