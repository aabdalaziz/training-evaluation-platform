/**
 * /api/impact/generate
 *  POST — توليد بنود أداة قياس الأثر بالذكاء الاصطناعي وفق أهداف ومحاور البرنامج (دفعة واحدة لكل طلب؛ المتصفح ينسّق الدفعات).
 *  GET  — فحص إعداد الذكاء الاصطناعي: هل المفتاح صالح؟ أي نموذج سيُستخدم؟ (للمشرفين)
 *
 * body: GenerateSpec (انظر lib/impact/generate.ts)
 * الحماية: Bearer <access_token> لمستخدم إداري.
 * المتغيرات (Vercel):
 *   AI_API_KEY  = مفتاح المزوّد (Gemini من aistudio.google.com/apikey يبدأ بـ AIza…)
 *   AI_PROVIDER = gemini | openai | anthropic   (اختياري — يُستنتج من شكل المفتاح، وإلا gemini)
 *   AI_MODEL    = اختياري — إن لم يُحدَّد يُكتشف أحدث نموذج Flash/Mini متاح للمفتاح تلقائيًا
 * بدون مفتاح صالح: يعمل المولّد المحلي (بنود تقدير ذاتي فقط).
 */
import { NextResponse } from 'next/server';
import { readKey, resolveModel, callWithFallback } from '../../../../lib/ai/provider';
import { createClient } from '@supabase/supabase-js';
import { buildPlan, buildPrompt, dedupeQuestions, normalizeSpec, offlineGenerate, orderByPlan, parseBatch, parseModelOutput, planTotal, splitBatches } from '../../../../lib/impact/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;


const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
function bad(error: string, status = 400) { return NextResponse.json({ success: false, error }, { status }); }

/* ---------------------------------------------------------------- المصادقة */
async function authorize(req: Request): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !ANON_KEY) return { ok: false, res: bad('إعدادات الخادم غير مكتملة', 500) };
  const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, res: bad('يرجى تسجيل الدخول أولاً', 401) };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: u, error: uErr } = await userClient.auth.getUser(token);
  if (uErr || !u?.user) return { ok: false, res: bad('جلسة المستخدم غير صالحة', 401) };
  const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).single();
  if (!ALLOWED_ROLES.includes(String((profile as any)?.role || '').toUpperCase())) return { ok: false, res: bad('غير مصرح', 403) };
  return { ok: true };
}
/* ---------------------------------------------------------------- GET: فحص الإعداد */
export async function GET(req: Request) {
  const a = await authorize(req); if (!a.ok) return a.res;
  const { key, provider } = readKey();
  if (!key) return NextResponse.json({ success: true, configured: false, provider, hint: 'لم يُضبط المتغير AI_API_KEY في Vercel — يعمل المولّد المحلي فقط.' });
  const masked = key.length > 10 ? `${key.slice(0, 6)}…${key.slice(-4)}` : '***';
  const looksGemini = /^AIza[0-9A-Za-z_\-]{30,}$/.test(key);
  try {
    const { model, candidates, discovered } = await resolveModel(provider, key);
    return NextResponse.json({ success: true, configured: true, valid: true, provider, model, candidates, discovered, key_masked: masked, key_length: key.length, model_env: (process.env.AI_MODEL || '').trim() || null, hint: discovered ? 'المفتاح صالح وسيُستخدم النموذج المذكور.' : 'المفتاح صالح لكن النموذج المحدد في AI_MODEL غير مُدرج ضمن نماذج المفتاح — سيُجرَّب ثم البدائل.' });
  } catch (e: any) {
    const msg = String(e?.message || e);
    const hint = provider === 'gemini' && !looksGemini
      ? `شكل المفتاح لا يطابق مفاتيح Gemini (تبدأ بـ AIza وطولها ≈39 حرفًا؛ المفتاح الحالي طوله ${key.length}). أنشئ مفتاحًا من aistudio.google.com/apikey وانسخه كاملًا بلا مسافات أو علامات اقتباس.`
      : /API key not valid|API_KEY_INVALID|invalid_api_key|authentication/i.test(msg)
        ? 'المزوّد رفض المفتاح: أعد إنشاء المفتاح من لوحة المزوّد، ثم في Vercel احذف المتغير AI_API_KEY وأضفه من جديد بالقيمة الجديدة (بلا مسافات) ثم Redeploy.'
        : /PERMISSION_DENIED|has not been used|disabled|SERVICE_DISABLED/i.test(msg)
          ? 'المفتاح صحيح لكن خدمة Generative Language API غير مفعّلة لمشروع Google Cloud المرتبط — فعّلها أو أنشئ المفتاح من AI Studio مباشرة.'
          : 'تحقق من المفتاح ومن متغير AI_PROVIDER.';
    return NextResponse.json({ success: true, configured: true, valid: false, provider, key_masked: masked, key_length: key.length, error: msg, hint });
  }
}

/* ---------------------------------------------------------------- POST: التوليد */
/**
 * body = GenerateSpec (+ اختياريًا batch: AxisPlan[] و batch_index و batch_count).
 *  - مع batch: يولّد هذه الدفعة فقط (المتصفح ينفّذ الدفعات تباعًا ويعرض التقدم ويعيد المحاولة عند 429).
 *  - بدون batch: يولّد الخطة كاملة تباعًا ضمن ميزانية الوقت (توافق مع الإصدار السابق).
 */
export async function POST(req: Request) {
  const started = Date.now(); const deadline = started + 52000;
  try {
    const a = await authorize(req); if (!a.ok) return a.res;
    const body = await req.json().catch(() => ({}));
    const spec = normalizeSpec(body);
    const plan = buildPlan(spec);
    const batch = parseBatch(body?.batch, spec.axes);
    const batchIndex = Math.max(0, Number(body?.batch_index) || 0), batchCount = Math.max(1, Number(body?.batch_count) || 1);
    const { key, provider } = readKey();
    if (!key || body.offline === true) {
      const r = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', plan, requested: planTotal(plan), ...r });
    }
    let candidates: string[];
    try { candidates = (await resolveModel(provider, key)).candidates; }
    catch (e: any) {
      const fallback = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', plan, requested: planTotal(plan), questions: fallback.questions, warnings: [`تعذر التحقق من مفتاح الذكاء الاصطناعي (${provider}): ${e?.message || e} — استخدم زر «فحص إعداد الذكاء الاصطناعي» لمعرفة السبب.`, ...fallback.warnings] });
    }
    const fixDomains = (qs: ReturnType<typeof parseModelOutput>['questions'], axes: string[]) => { for (const q of qs) { if (!axes.includes(q.domain_ar)) { const hit = axes.find(ax => q.domain_ar.includes(ax) || ax.includes(q.domain_ar)); q.domain_ar = hit || axes[0]; } } return qs; };

    // ---- دفعة واحدة (الوضع الافتراضي من الواجهة)
    if (batch) {
      const { system, user } = buildPrompt(spec, batch, batchIndex, batchCount);
      try {
        const { text, model } = await callWithFallback(provider, key, candidates, system, user, deadline);
        const parsed = parseModelOutput(text);
        const questions = fixDomains(parsed.questions, batch.map(b => b.axis));
        return NextResponse.json({ success: true, mode: 'ai', provider, model, batch_index: batchIndex, requested: planTotal(batch), questions, warnings: parsed.warnings.filter(w => !/لم يُنتج النموذج/.test(w)) });
      } catch (e: any) {
        const status = e?.retry_after ? 429 : 502;
        return NextResponse.json({ success: false, error: `${e?.message || e}`, retry_after: e?.retry_after || null, batch_index: batchIndex }, { status });
      }
    }

    // ---- الخطة كاملة في طلب واحد (توافق)
    const batches = splitBatches(plan);
    const warnings: string[] = []; const all: ReturnType<typeof parseModelOutput>['questions'] = []; let usedModel = candidates[0]; let failed = 0;
    for (let i = 0; i < batches.length; i++) {
      if (Date.now() > deadline - 12000) { warnings.push(`توقف التوليد عند الدفعة ${i}/${batches.length} بسبب حد وقت الخادم — استخدم الواجهة المحدّثة التي تولّد الدفعات تباعًا.`); failed += batches.length - i; break; }
      const { system, user } = buildPrompt(spec, batches[i], i, batches.length);
      try {
        const { text, model } = await callWithFallback(provider, key, candidates, system, user, deadline); usedModel = model;
        const parsed = parseModelOutput(text);
        all.push(...fixDomains(parsed.questions, batches[i].map(b => b.axis))); warnings.push(...parsed.warnings.filter(w => !/لم يُنتج النموذج/.test(w)));
        if (!parsed.questions.length) failed++;
      } catch (e: any) { failed++; warnings.push(`الدفعة ${i + 1}/${batches.length} (${batches[i].map(b => b.axis).join('، ')}): ${e?.message || e}`); }
    }
    if (!all.length) {
      const fallback = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', plan, requested: planTotal(plan), questions: fallback.questions, warnings: [`تعذر الاتصال بمزوّد الذكاء الاصطناعي (${provider}/${usedModel}).`, ...warnings, ...fallback.warnings] });
    }
    const dd = dedupeQuestions(all);
    if (dd.removed) warnings.push(`أُزيل ${dd.removed} بندًا مكررًا.`);
    const questions = orderByPlan(dd.questions, spec.axes);
    const requested = planTotal(plan);
    if (questions.length < requested) warnings.push(`أُنتج ${questions.length} بندًا من أصل ${requested} مطلوبًا${failed ? ` (تعذرت ${failed} دفعة)` : ''} — يمكنك إعادة التوليد وإضافة الناتج إلى البنود الحالية.`);
    return NextResponse.json({ success: true, mode: 'ai', provider, model: usedModel, batches: batches.length, plan, requested, questions, warnings });
  } catch (e: any) { return bad(e?.message || 'خطأ غير متوقع', 500); }
}
