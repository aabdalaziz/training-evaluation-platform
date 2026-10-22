/**
 * POST /api/impact/generate
 * توليد بنود أداة قياس الأثر بالذكاء الاصطناعي وفق أهداف ومحاور البرنامج.
 *
 * body: GenerateSpec (انظر lib/impact/generate.ts)
 * الحماية: Bearer <access_token> لمستخدم إداري.
 * المتغيرات (Vercel):
 *   AI_PROVIDER = gemini | openai | anthropic   (افتراضي: يُستنتج من شكل المفتاح، وإلا gemini)
 *   AI_API_KEY  = مفتاح المزوّد
 *   AI_MODEL    = اختياري (افتراضي: gemini-2.0-flash / gpt-4o-mini / claude-3-5-haiku-latest)
 * بدون مفتاح: يعمل المولّد المحلي (بنود تقدير ذاتي فقط).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildPrompt, normalizeSpec, offlineGenerate, parseModelOutput } from '../../../../lib/impact/generate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ALLOWED_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
function bad(error: string, status = 400) { return NextResponse.json({ success: false, error }, { status }); }

function detectProvider(key: string, explicit?: string): 'gemini' | 'openai' | 'anthropic' {
  const p = (explicit || '').toLowerCase();
  if (p === 'gemini' || p === 'google') return 'gemini';
  if (p === 'openai') return 'openai';
  if (p === 'anthropic' || p === 'claude') return 'anthropic';
  if (key.startsWith('sk-ant-')) return 'anthropic';
  if (key.startsWith('sk-')) return 'openai';
  return 'gemini';
}

async function callModel(provider: 'gemini' | 'openai' | 'anthropic', key: string, model: string, system: string, user: string): Promise<string> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 50000);
  try {
    if (provider === 'gemini') {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens: 8192 } }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `Gemini HTTP ${r.status}`);
      return (j?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
    }
    if (provider === 'openai') {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, signal: ctl.signal,
        body: JSON.stringify({ model, temperature: 0.4, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `OpenAI HTTP ${r.status}`);
      return j?.choices?.[0]?.message?.content || '';
    }
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: ctl.signal,
      body: JSON.stringify({ model, max_tokens: 8192, temperature: 0.4, system, messages: [{ role: 'user', content: user }] }),
    });
    const j: any = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `Anthropic HTTP ${r.status}`);
    return (j?.content || []).map((c: any) => c.text || '').join('');
  } finally { clearTimeout(t); }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !ANON_KEY) return bad('إعدادات الخادم غير مكتملة', 500);
    const auth = req.headers.get('authorization') || ''; const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return bad('يرجى تسجيل الدخول أولاً', 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) return bad('جلسة المستخدم غير صالحة', 401);
    const { data: profile } = await userClient.from('profiles').select('role').eq('id', u.user.id).single();
    if (!ALLOWED_ROLES.includes(String(profile?.role || '').toUpperCase())) return bad('غير مصرح', 403);

    const spec = normalizeSpec(body);
    const key = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim();
    if (!key || body.offline === true) {
      const r = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', ...r });
    }
    const provider = detectProvider(key, process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : ''));
    const model = (process.env.AI_MODEL || '').trim() || (provider === 'gemini' ? 'gemini-2.0-flash' : provider === 'openai' ? 'gpt-4o-mini' : 'claude-3-5-haiku-latest');
    const { system, user } = buildPrompt(spec);
    let text = '';
    try { text = await callModel(provider, key, model, system, user); }
    catch (e: any) {
      const fallback = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', questions: fallback.questions, warnings: [`تعذر الاتصال بمزوّد الذكاء الاصطناعي (${provider}/${model}): ${e?.message || e}`, ...fallback.warnings] });
    }
    const parsed = parseModelOutput(text);
    if (!parsed.questions.length) {
      const fallback = offlineGenerate(spec);
      return NextResponse.json({ success: true, mode: 'offline', questions: fallback.questions, warnings: [...parsed.warnings, ...fallback.warnings] });
    }
    return NextResponse.json({ success: true, mode: 'ai', provider, model, ...parsed });
  } catch (e: any) { return bad(e?.message || 'خطأ غير متوقع', 500); }
}
