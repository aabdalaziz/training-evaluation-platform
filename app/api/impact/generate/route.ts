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
import { createClient } from '@supabase/supabase-js';
import { buildPlan, buildPrompt, dedupeQuestions, normalizeSpec, offlineGenerate, orderByPlan, parseBatch, parseModelOutput, planTotal, splitBatches } from '../../../../lib/impact/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type Provider = 'gemini' | 'openai' | 'anthropic';
const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
function bad(error: string, status = 400) { return NextResponse.json({ success: false, error }, { status }); }

function detectProvider(key: string, explicit?: string): Provider {
  const p = (explicit || '').toLowerCase();
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'openai') return 'openai';
  if (p === 'anthropic' || p === 'claude') return 'anthropic';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return 'gemini';
}

/* ---------------------------------------------------------------- اكتشاف النموذج */
const EXCLUDE = /(embedding|embed|tts|audio|live|image|imagen|veo|vision|realtime|transcribe|whisper|search|moderation|codex|computer-use|robotics|aqa|learnlm|gemma|nano-banana|thinking-exp|-exp\b|experimental|preview|instruct|dall-e|davinci|babbage|o\d)/i;
const verOf = (id: string) => { const m = id.match(/(\d+)(?:\.(\d+))?/); return m ? Number(m[1]) + Number(m[2] || 0) / 10 : 0; };
/** درجة تفضيل: نماذج Flash/Mini/Haiku الحديثة أولًا (أسرع وأرخص وغالبًا ضمن الحد المجاني) */
function scoreModel(provider: Provider, id: string): number {
  const l = id.toLowerCase(); if (EXCLUDE.test(l)) return -1;
  const v = verOf(l); let s = v * 100;
  if (provider === 'gemini') { if (!/^gemini-/.test(l)) return -1; if (/flash-lite/.test(l)) s += 20; else if (/flash/.test(l)) s += 30; else if (/pro/.test(l)) s += 10; else s += 5; if (/latest/.test(l)) s -= 1; if (/-\d{3}$/.test(l)) s -= 2; }
  if (provider === 'openai') { if (!/^gpt-|^chatgpt/.test(l)) return -1; if (/mini/.test(l)) s += 30; else if (/nano/.test(l)) s += 20; else s += 10; if (/\d{4}-\d{2}-\d{2}/.test(l)) s -= 2; if (/chat-latest/.test(l)) s -= 5; }
  if (provider === 'anthropic') { if (!/^claude/.test(l)) return -1; if (/haiku/.test(l)) s += 30; else if (/sonnet/.test(l)) s += 20; else s += 10; if (/\d{8}$/.test(l)) s -= 2; }
  return s;
}
const cache = new Map<string, { at: number; models: string[] }>();
async function listModels(provider: Provider, key: string): Promise<string[]> {
  const ck = `${provider}:${key.slice(-8)}`; const c = cache.get(ck); if (c && Date.now() - c.at < 3600_000) return c.models;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
  try {
    let ids: string[] = [];
    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { signal: ctl.signal });
      const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error?.message || `Gemini HTTP ${r.status}`);
      ids = (j?.models || []).filter((m: any) => (m?.supportedGenerationMethods || []).includes('generateContent')).map((m: any) => String(m.name || '').replace(/^models\//, ''));
    } else if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` }, signal: ctl.signal });
      const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error?.message || `OpenAI HTTP ${r.status}`);
      ids = (j?.data || []).map((m: any) => String(m.id || ''));
    } else {
      const r = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: ctl.signal });
      const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error?.message || `Anthropic HTTP ${r.status}`);
      ids = (j?.data || []).map((m: any) => String(m.id || ''));
    }
    cache.set(ck, { at: Date.now(), models: ids });
    return ids;
  } finally { clearTimeout(t); }
}
async function resolveModel(provider: Provider, key: string): Promise<{ model: string; candidates: string[]; discovered: boolean }> {
  const explicit = (process.env.AI_MODEL || '').trim();
  const ids = await listModels(provider, key); // يتحقق أيضًا من صلاحية المفتاح
  const ranked = ids.map(id => ({ id, s: scoreModel(provider, id) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.id);
  if (explicit) return { model: explicit, candidates: [explicit, ...ranked.filter(x => x !== explicit)].slice(0, 4), discovered: ids.includes(explicit) };
  const fallback = provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4.1-mini' : 'claude-haiku-4-5';
  return { model: ranked[0] || fallback, candidates: (ranked.length ? ranked : [fallback]).slice(0, 4), discovered: ranked.length > 0 };
}

/* ---------------------------------------------------------------- استدعاء النموذج */
async function callModel(provider: Provider, key: string, model: string, system: string, user: string, deadline: number): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), Math.max(5000, deadline - Date.now()));
  try {
    if (provider === 'gemini') {
      const body: any = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json' } };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify(body) });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Gemini HTTP ${r.status}`), { status: r.status });
      const fin = j?.candidates?.[0]?.finishReason; const text = (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
      if (!text && fin) throw new Error(`Gemini finishReason=${fin}`);
      return text;
    }
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: ctl.signal,
        body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(j?.error?.message || `OpenAI HTTP ${r.status}`), { status: r.status });
      return j?.choices?.[0]?.message?.content || '';
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: ctl.signal,
      body: JSON.stringify({ model, max_tokens: 16000, temperature: 0.7, system, messages: [{ role: 'user', content: user }] }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j?.error?.message || `Anthropic HTTP ${r.status}`), { status: r.status });
    return (j?.content || []).map((c: any) => c.text || '').join('');
  } finally { clearTimeout(t); }
}
const RETRY_RE = /retry (?:in|after) ([\d.]+)\s*s/i;
const retryAfterOf = (e: any): number => { const m = String(e?.message || '').match(RETRY_RE); const v = m ? Math.ceil(Number(m[1])) : 0; return Math.min(90, Math.max(5, v || 15)); };
const isModelGone = (e: any) => e?.status === 404 || /not found|not supported|deprecated|retired|does not exist|unsupported|invalid model/i.test(String(e?.message || ''));
const isBusy = (e: any) => e?.status === 429 || e?.status === 503 || e?.status === 500 || /quota|rate|high demand|overloaded|try again|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(String(e?.message || ''));
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
/**
 * يجرّب النموذج المرشّح ثم البدائل: نموذج غير متاح → التالي؛ ضغط/حصة (429/503) → النموذج التالي، وإن نفدت كلها
 * ينتظر المدة المقترحة إن سمحت ميزانية الوقت ثم يعيد المحاولة؛ وإلا يرمي خطأ يحمل retry_after ليعيد المتصفح المحاولة.
 */
async function callWithFallback(provider: Provider, key: string, candidates: string[], system: string, user: string, deadline: number): Promise<{ text: string; model: string }> {
  let lastErr: any; const dead = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    let busyErr: any = null;
    for (const model of candidates) {
      if (dead.has(model)) continue;
      try { return { text: await callModel(provider, key, model, system, user, deadline), model }; }
      catch (e: any) { lastErr = e; if (isModelGone(e)) { dead.add(model); continue; } if (isBusy(e)) { busyErr = busyErr || e; continue; } throw e; }
    }
    if (!busyErr) break;
    const wait = retryAfterOf(busyErr);
    if (Date.now() + wait * 1000 + 15000 > deadline) throw Object.assign(new Error(busyErr.message), { status: 429, retry_after: wait });
    await sleep(wait * 1000);
  }
  throw Object.assign(lastErr || new Error('no model'), { retry_after: isBusy(lastErr) ? retryAfterOf(lastErr) : undefined });
}

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
function readKey() {
  const key = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  const provider = detectProvider(key, process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : ''));
  return { key, provider };
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
