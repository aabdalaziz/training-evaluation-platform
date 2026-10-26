/**
 * مزوّد الذكاء الاصطناعي المشترك (Gemini | OpenAI | Anthropic) — اكتشاف النموذج تلقائيًا، بدائل، إعادة محاولة
 * يُستخدم من: /api/impact/generate (مولّد الأسئلة) و /api/reports/digest (الملخص التنفيذي) — خادم فقط
 * المتغيرات: AI_API_KEY (أو GEMINI_API_KEY/OPENAI_API_KEY/ANTHROPIC_API_KEY) · AI_PROVIDER (اختياري) · AI_MODEL (اختياري)
 */
export type Provider = 'gemini' | 'openai' | 'anthropic';

export function detectProvider(key: string, explicit?: string): Provider {
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
export function scoreModel(provider: Provider, id: string): number {
  const l = id.toLowerCase(); if (EXCLUDE.test(l)) return -1;
  const v = verOf(l); let s = v * 100;
  if (provider === 'gemini') { if (!/^gemini-/.test(l)) return -1; if (/flash-lite/.test(l)) s += 20; else if (/flash/.test(l)) s += 30; else if (/pro/.test(l)) s += 10; else s += 5; if (/latest/.test(l)) s -= 1; if (/-\d{3}$/.test(l)) s -= 2; }
  if (provider === 'openai') { if (!/^gpt-|^chatgpt/.test(l)) return -1; if (/mini/.test(l)) s += 30; else if (/nano/.test(l)) s += 20; else s += 10; if (/\d{4}-\d{2}-\d{2}/.test(l)) s -= 2; if (/chat-latest/.test(l)) s -= 5; }
  if (provider === 'anthropic') { if (!/^claude/.test(l)) return -1; if (/haiku/.test(l)) s += 30; else if (/sonnet/.test(l)) s += 20; else s += 10; if (/\d{8}$/.test(l)) s -= 2; }
  return s;
}
const cache = new Map<string, { at: number; models: string[] }>();
export async function listModels(provider: Provider, key: string): Promise<string[]> {
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
export async function resolveModel(provider: Provider, key: string): Promise<{ model: string; candidates: string[]; discovered: boolean }> {
  const explicit = (process.env.AI_MODEL || '').trim();
  const ids = await listModels(provider, key); // يتحقق أيضًا من صلاحية المفتاح
  const ranked = ids.map(id => ({ id, s: scoreModel(provider, id) })).filter(x => x.s >= 0).sort((a, b) => b.s - a.s).map(x => x.id);
  if (explicit) return { model: explicit, candidates: [explicit, ...ranked.filter(x => x !== explicit)].slice(0, 4), discovered: ids.includes(explicit) };
  const fallback = provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'openai' ? 'gpt-4.1-mini' : 'claude-haiku-4-5';
  return { model: ranked[0] || fallback, candidates: (ranked.length ? ranked : [fallback]).slice(0, 4), discovered: ranked.length > 0 };
}

/* ---------------------------------------------------------------- استدعاء النموذج */
export type CallOpts = { fast?: boolean };
/** fast: للمهام التفاعلية (شخصية محاكاة، مستشار، رفيق) — يعطّل «التفكير» في نماذج Gemini Flash لتقليل زمن الاستجابة؛ وإن رفض النموذج الإعداد يُعاد الطلب بدونه */
export async function callModel(provider: Provider, key: string, model: string, system: string, user: string, deadline: number, opts: CallOpts = {}): Promise<string> {
  // في الوضع السريع تُحدَّد مهلة كل محاولة بـ 9 ثوانٍ كحدّ أقصى حتى لا يستهلك طلبٌ معلّق الميزانية كلها، وينتقل التنفيذ إلى النموذج التالي
  const perCall = opts.fast ? Math.min(Math.max(3000, deadline - Date.now()), 9000) : Math.max(5000, deadline - Date.now());
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), perCall);
  try {
    if (provider === 'gemini') {
      const fast = !!opts.fast && /flash/i.test(model);
      const body: any = { systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: user }] }], generationConfig: { temperature: 0.7, responseMimeType: 'application/json', ...(fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}) } };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal, body: JSON.stringify(body) });
      const j: any = await r.json().catch(() => ({}));
      if (!r.ok && fast && r.status === 400 && /thinking|budget/i.test(String(j?.error?.message || ''))) { clearTimeout(t); return callModel(provider, key, model, system, user, deadline, { fast: false }); }
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
function isAborted(e: any): boolean { return !!e && (e.name === 'AbortError' || /aborted/i.test(String(e?.message || ''))); }
export async function callWithFallback(provider: Provider, key: string, candidates: string[], system: string, user: string, deadline: number, opts: CallOpts = {}): Promise<{ text: string; model: string }> {
  let lastErr: any; const dead = new Set<string>();
  for (let attempt = 0; attempt < 3; attempt++) {
    let busyErr: any = null;
    for (const model of candidates) {
      if (dead.has(model)) continue;
      try { return { text: await callModel(provider, key, model, system, user, deadline, opts), model }; }
      catch (e: any) { lastErr = e; if (isModelGone(e)) { dead.add(model); continue; } if (isBusy(e) || (opts.fast && isAborted(e))) { busyErr = busyErr || e; continue; } throw e; }
    }
    if (!busyErr) break;
    const wait = isAborted(busyErr) ? 0 : retryAfterOf(busyErr);
    if (Date.now() + wait * 1000 + (opts.fast ? 4000 : 15000) > deadline) throw Object.assign(new Error(busyErr.message), { status: isAborted(busyErr) ? 504 : 429, retry_after: wait });
    await sleep(wait * 1000);
  }
  throw Object.assign(lastErr || new Error('no model'), { retry_after: isBusy(lastErr) ? retryAfterOf(lastErr) : undefined });
}

export function readKey() {
  const key = (process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '').trim().replace(/^["']|["']$/g, '');
  const provider = detectProvider(key, process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : process.env.ANTHROPIC_API_KEY ? 'anthropic' : ''));
  return { key, provider };
}
