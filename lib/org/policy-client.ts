// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P67 — سياسة جهتي في المتصفح (نقي، بلا React): يقرأ /api/me/policy مرّة كل 5 دقائق (sessionStorage) ويُخفي ما أغلقته الجهة
 *  الخادم هو الحَكَم دائمًا (403) — هذا فقط حتى لا نُظهر زرًّا لن يعمل.
 */
export type ClientPolicy = { pseudonymous: boolean; code_login: boolean; public_faces_off: boolean; home_threads_off: boolean; voice_off: boolean; media_off: boolean; verify_minimal: boolean; kiosk_minutes: number };
export const EMPTY_POLICY: ClientPolicy = { pseudonymous: false, code_login: false, public_faces_off: false, home_threads_off: false, voice_off: false, media_off: false, verify_minimal: false, kiosk_minutes: 0 };
export const POLICY_CACHE_KEY = 'athar:policy'; export const KIOSK_KEY = 'athar:kiosk';
const TTL = 5 * 60 * 1000;

/** يعيد السياسة المخبّأة إن كانت حديثة، وإلا يجلبها (ويعيد الفارغة لغير المسجَّل) */
export async function fetchMyPolicy(token: string | null | undefined, now = Date.now()): Promise<ClientPolicy> {
  if (!token) return EMPTY_POLICY;
  try { const raw = sessionStorage.getItem(POLICY_CACHE_KEY); if (raw) { const c = JSON.parse(raw); if (c && c.at && now - c.at < TTL && c.policy) return { ...EMPTY_POLICY, ...c.policy }; } } catch { /* خاص */ }
  try {
    const r = await fetch('/api/me/policy', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }); if (!r.ok) return EMPTY_POLICY;
    const j = await r.json(); const policy = { ...EMPTY_POLICY, ...(j?.policy || {}) } as ClientPolicy;
    try { sessionStorage.setItem(POLICY_CACHE_KEY, JSON.stringify({ at: now, policy })); if (policy.kiosk_minutes) localStorage.setItem(KIOSK_KEY, String(policy.kiosk_minutes)); else localStorage.removeItem(KIOSK_KEY); } catch { /* خاص */ }
    return policy;
  } catch { return EMPTY_POLICY; }
}
export function clearPolicyCache() { try { sessionStorage.removeItem(POLICY_CACHE_KEY); localStorage.removeItem(KIOSK_KEY); } catch { /* خاص */ } }

/** وضع الكشك: مؤقّت خمول — أي حركة تعيده؛ عند انقضائه يُستدعى onIdle (خروج + عودة إلى باب الجهة). يعيد دالة إيقاف. */
export function kioskWatch(minutes: number, onIdle: () => void, win: Window = window): () => void {
  if (!minutes || minutes <= 0) return () => { /* لا كشك */ };
  let timer: ReturnType<typeof setTimeout> | null = null; const ms = minutes * 60000;
  const arm = () => { if (timer) clearTimeout(timer); timer = setTimeout(onIdle, ms); };
  const evs = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'] as const;
  for (const e of evs) win.addEventListener(e, arm, { passive: true }); arm();
  return () => { if (timer) clearTimeout(timer); for (const e of evs) win.removeEventListener(e, arm); };
}
