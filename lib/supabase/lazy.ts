// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
'use client';
/**
 * «خِفّة أَثَر» (P40) — عميل Supabase كسول للمتصفح.
 *  مكتبة Supabase (≈ 68 KB مضغوطة) كانت تُحمَّل في كل صفحة عامة عبر القشرة والجيب والتنقّل.
 *  هنا: لا تُستورد إلا عند الحاجة الفعلية (جلسة مخزَّنة، أو فعل من المستخدم مثل تسجيل الخروج).
 *  - hasStoredSession(): يكشف وجود جلسة من كعكات sb-<ref>-auth-token أو localStorage بلا تحميل المكتبة.
 *  - sbLazy(): يستورد lib/supabase/client ديناميكيًا مرة واحدة ويعيد العميل نفسه دائمًا.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

let pending: Promise<SupabaseClient> | null = null;
export function sbLazy(): Promise<SupabaseClient> {
  if (!pending) pending = import('./client').then((m) => m.supabase() as unknown as SupabaseClient);
  return pending;
}
export function hasStoredSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (document.cookie.split(';').some((c) => { const k = c.split('=')[0].trim(); return k.startsWith('sb-') && k.includes('-auth-token') && !k.includes('code-verifier'); })) return true;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ''; if (k.startsWith('sb-') && k.endsWith('-auth-token')) return true; }
  } catch { /* ignore */ }
  return false;
}
/** يؤجّل عملًا غير عاجل إلى ما بعد التحميل (requestIdleCallback أو مهلة قصيرة) */
export function whenIdle(fn: () => void, timeout = 1500): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
  if (w.requestIdleCallback) { const id = w.requestIdleCallback(fn, { timeout }); return () => w.cancelIdleCallback?.(id); }
  const id = setTimeout(fn, 300); return () => clearTimeout(id);
}
