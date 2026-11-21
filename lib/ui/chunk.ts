// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* م17-أ: خطأ تحميل حزمة (بعد نشر جديد والصفحة مفتوحة من قبله) — يُشفى بإعادة تحميل واحدة تلقائية، لا ببطاقة خطأ */
export const isChunkError = (e: { name?: string; message?: string } | null | undefined) => {
  const t = `${e?.name || ''} ${e?.message || ''}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|Importing a module script failed|text\/html.*module/i.test(t);
};
const RELOAD_KEY = 'athar:chunk-reload-at';
export function autoRecoverChunk(error: { name?: string; message?: string }): boolean {
  if (typeof window === 'undefined' || !isChunkError(error)) return false;
  try { const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0); if (Date.now() - last < 60_000) return false; sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch { /* ignore */ }
  try { const u = new URL(window.location.href); u.searchParams.set('_r', String(Date.now() % 100000)); window.location.replace(u.toString()); } catch { window.location.reload(); }
  return true;
}

