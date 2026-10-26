// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — منفّذ الذكاء الاصطناعي المسؤول (P9-أ) — خادم فقط
 *  يستدعي المزوّد المشترك (Gemini | OpenAI | Anthropic باكتشاف تلقائي للنموذج) مع مهلة، ويحلّل الناتج، ويعود للبديل المحلي عند أي تعثّر،
 *  ويسجّل كل استدعاء في portal_ai_log (بلا محتوى شخصي) ويطبّق حدود الاستخدام لكل مستخدم/غرض خلال 24 ساعة.
 */
import { readKey, resolveModel, callWithFallback } from './provider';
import { AI_LIMITS } from './prompts';
import type { AiPurpose } from './prompts';

export type AiSource = 'ai' | 'local';
export type AiResult<T> = { data: T; source: AiSource; provider: string | null; model: string | null; ms: number; input_chars: number; output_chars: number; error: string | null };

/** هل الذكاء الاصطناعي مفعّل في هذه البيئة؟ (بلا كشف المفتاح) */
export function aiStatus(): { enabled: boolean; provider: string | null } {
  const { key, provider } = readKey(); return { enabled: !!key, provider: key ? provider : null };
}

/**
 * ينفّذ مطالبة ويحلّل الناتج؛ عند غياب المفتاح أو فشل الاستدعاء/التحليل يعود للبديل المحلي — لا يرمي أبدًا.
 * budgetMs: ميزانية الوقت الكلية (ضمن maxDuration للمسار). fast: وضع تفاعلي (افتراضيًا حين تكون الميزانية < 30 ثانية) يعطّل «التفكير» في نماذج Flash لتقليل زمن الاستجابة.
 */
export async function runAi<T>(p: { system: string; user: string; parse: (raw: string) => T | null; local: () => T; budgetMs?: number; fast?: boolean }): Promise<AiResult<T>> {
  const t0 = Date.now(); const { key, provider } = readKey(); const input_chars = p.system.length + p.user.length;
  if (!key) return { data: p.local(), source: 'local', provider: null, model: null, ms: Date.now() - t0, input_chars, output_chars: 0, error: null };
  const deadline = t0 + (p.budgetMs ?? 40000);
  try {
    const { candidates } = await resolveModel(provider, key);
    const fast = p.fast ?? ((p.budgetMs ?? 40000) < 30000);
    const r = await Promise.race([callWithFallback(provider, key, candidates, p.system, p.user, deadline, { fast }), new Promise<never>((_, rej) => setTimeout(() => rej(new Error('ai_timeout')), Math.max(5000, deadline - Date.now())))]);
    const parsed = p.parse(r.text);
    if (!parsed) return { data: p.local(), source: 'local', provider, model: r.model, ms: Date.now() - t0, input_chars, output_chars: r.text.length, error: 'unparseable' };
    return { data: parsed, source: 'ai', provider, model: r.model, ms: Date.now() - t0, input_chars, output_chars: r.text.length, error: null };
  } catch (e: any) {
    return { data: p.local(), source: 'local', provider, model: null, ms: Date.now() - t0, input_chars, output_chars: 0, error: String(e?.message || e).slice(0, 300) };
  }
}

/** الاستخدام خلال 24 ساعة والحد المسموح — بصلاحية الخدمة */
export async function aiUsage(db: any, userId: string, purpose: AiPurpose): Promise<{ used: number; limit: number; allowed: boolean }> {
  const limit = AI_LIMITS[purpose]; let used = 0;
  try { const { data } = await db.rpc('portal_ai_usage', { p_user: userId, p_purpose: purpose }); used = Number(data) || 0; } catch { used = 0; }
  return { used, limit, allowed: used < limit };
}

/** تسجيل حوكمي — لا يُفشل الطلب إن تعذّر */
export async function logAi(db: any, row: { user_id: string; email: string; role: string; purpose: AiPurpose; result: AiResult<unknown>; context?: Record<string, unknown> }): Promise<void> {
  try {
    await db.from('portal_ai_log').insert({
      user_id: row.user_id, email: row.email, role: row.role, purpose: row.purpose, source: row.result.source, provider: row.result.provider, model: row.result.model,
      input_chars: row.result.input_chars, output_chars: row.result.output_chars, duration_ms: row.result.ms, ok: true, error: row.result.error, context: row.context || {},
    });
  } catch { /* تجاهل */ }
}
