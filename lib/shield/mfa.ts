// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P80 */
/**
 * درع أَثَر — التوثيق الثنائي للطاقم (P80-ب)
 *  • Supabase MFA (TOTP): المستخدم يسجّل تطبيق مصادقة من /security/mfa، وعند الدخول يُطلب رمز من 6 أرقام (aal2).
 *  • السياسة: أدوار الطاقم الإدارية (MFA_ROLES) تُلزَم بعد تاريخ MFA_REQUIRED_FROM (متغيّر بيئة عام)؛ قبله تنبيه فقط.
 *  • الخادم: requireMfa() — إن كانت الجلسة aal1 وللمستخدم عامل موثَّق → 403 (MFA_REQUIRED). لا يُقفل من لم يسجّل عاملًا بعد
 *    إلا بعد تاريخ الإلزام (enrol) — حتى لا يُحبس أحد خارج النظام فجأة.
 *  القرار خالص في mfaDecision() وقابل للاختبار.
 */

export type Aal = 'aal1' | 'aal2';
export type MfaDecision = 'ok' | 'challenge' | 'enrol' | 'enrol_soft';
export const MFA_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER'];

/** يفكّ حمولة JWT بلا تحقّق (تلميح فقط — الحكم الفعلي عند Supabase). */
export function jwtPayload(token: string | null | undefined): any | null {
  try { const p = String(token || '').split('.')[1]; if (!p) return null; const b = p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4); const s = typeof atob === 'function' ? atob(b) : Buffer.from(b, 'base64').toString('binary'); return JSON.parse(decodeURIComponent(Array.from(s, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))); } catch { return null; }
}
export const aalOf = (token: string | null | undefined): Aal => (jwtPayload(token)?.aal === 'aal2' ? 'aal2' : 'aal1');

export function requiredFrom(env: Record<string, string | undefined>): Date | null { const v = env.NEXT_PUBLIC_MFA_REQUIRED_FROM; if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }

export function mfaDecision(i: { role: string; aal: Aal; verifiedFactors: number; requiredFrom: Date | null; now?: Date }): MfaDecision {
  const role = String(i.role || '').toUpperCase(); const now = i.now || new Date();
  if (i.verifiedFactors > 0) return i.aal === 'aal2' ? 'ok' : 'challenge'; // من سجّل عاملًا يُطالَب به دائمًا، أيًّا كان دوره
  if (!MFA_ROLES.includes(role)) return 'ok';
  if (i.requiredFrom && now.getTime() >= i.requiredFrom.getTime()) return 'enrol';
  return 'enrol_soft';
}

export type MfaCheck = { ok: true; decision: MfaDecision } | { ok: false; status: number; error: string; code: 'MFA_REQUIRED' | 'MFA_ENROL_REQUIRED' };
/** للخادم: userDb عميل بمفتاح anon + رمز المستخدم. يُستدعى بعد التحقّق من الدور. */
export async function requireMfa(userDb: { auth: { mfa: { listFactors: () => Promise<any> } } }, token: string, role: string, env: Record<string, string | undefined> = process.env as any): Promise<MfaCheck> {
  const aal = aalOf(token); let verified = 0;
  if (aal !== 'aal2') { try { const { data } = await userDb.auth.mfa.listFactors(); verified = ((data?.totp || []) as any[]).filter((f) => f.status === 'verified').length; } catch { verified = 0; } }
  const d = mfaDecision({ role, aal, verifiedFactors: aal === 'aal2' ? 1 : verified, requiredFrom: requiredFrom(env) });
  if (d === 'challenge') return { ok: false, status: 403, error: 'يلزم رمز التوثيق الثنائي — أعد الدخول وأدخل رمز تطبيق المصادقة', code: 'MFA_REQUIRED' };
  if (d === 'enrol') return { ok: false, status: 403, error: 'التوثيق الثنائي إلزامي لدورك — فعّله من /security/mfa', code: 'MFA_ENROL_REQUIRED' };
  return { ok: true, decision: d };
}

/** رابط otpauth لعرض QR محليًّا (بلا خدمة خارجية). */
export function otpauthUri(i: { secret: string; email: string; issuer?: string }): string { const iss = encodeURIComponent(i.issuer || 'Athar'); return `otpauth://totp/${iss}:${encodeURIComponent(i.email)}?secret=${encodeURIComponent(i.secret)}&issuer=${iss}&algorithm=SHA1&digits=6&period=30`; }
export const isTotpCode = (s: unknown) => /^\d{6}$/.test(String(s || '').replace(/\s/g, ''));
