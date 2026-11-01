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
      const j: any = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j?.error?.message 
