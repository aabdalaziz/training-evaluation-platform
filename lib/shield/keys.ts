// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — «المفاتيح»: حالة المفاتيح وخطة التدوير بلا انقطاع.
 *  - رموز OAuth تُوقَّع بمفتاح مشتق (HMAC(VC_SIGNING_KEY, 'athar-oauth-v1')) — لا بالمفتاح الخام؛ التحقق يقبل أيضًا TOKEN_SECRET_PREV أثناء التدوير.
 *  - مفتاح Ed25519 (P17) مشتق من VC_SIGNING_KEY نفسه؛ عند التدوير يبقى المفتاح القديم في did.json (retired) للتحقق من الشهادات السابقة.
 *  - مفاتيح الجهات atk_: تدوير = مفتاح جديد بالصلاحيات نفسها + القديم يعمل 24 ساعة ثم يُبطل آليًا (expires_at).
 */
import { randomBytes, createHash } from 'crypto';
import { keyId, secretsFromEnv } from '../portal/oauth';

export const AGENT_KEY_GRACE_H = 24;

export function keyInfo(env: Record<string, string | undefined> = process.env) {
  const secrets = secretsFromEnv(env);
  const master = String(env.VC_SIGNING_KEY || '').trim(); const prev = String(env.TOKEN_SECRET_PREV || '').trim();
  return {
    master_set: !!master, master_fingerprint: master ? createHash('sha256').update(master).digest('hex').slice(0, 8) : null,
    oauth_kid: keyId(secrets[0]), prev_set: !!prev && prev !== master, prev_kid: secrets[1] ? keyId(secrets[1]) : null,
    derived: true, fallback_dev: !master && !env.CRON_SECRET,
  };
}

/** مفتاح رئيسي جديد (32 بايت base64) — يُعرض للمشرف لينسخه إلى Vercel؛ لا يُخزَّن */
export const generateMasterKey = () => randomBytes(32).toString('base64');

/** خطة التدوير خطوة بخطوة (نصّ للوحة) */
export const ROTATION_STEPS_AR = [
  'أنشئ مفتاحًا جديدًا بالزر «توليد مفتاح» (أو openssl rand -base64 32) وانسخه.',
  'في Vercel → Settings → Environment Variables: ضع القيمة القديمة لـ VC_SIGNING_KEY في متغير جديد TOKEN_SECRET_PREV، ثم استبدل VC_SIGNING_KEY بالمفتاح الجديد.',
  'أعد النشر (أي commit). رموز الوصول والتجديد القديمة تبقى صالحة للتحقق حتى انقضائها (ساعة / 30 يومًا)؛ الشهادات القديمة تتحقق بالمفتاح المتقاعد في did.json.',
  'بعد 30 يومًا احذف TOKEN_SECRET_PREV. للتدوير الصارم (اشتباه تسريب): لا تضع PREV أصلًا — تُبطل كل الرموز فورًا ويعيد المستخدمون التفويض.',
];

/** مفتاح جهة جديد مع بادئة العرض وتجزئته */
export function newAgentKey() {
  const key = 'atk_' + randomBytes(24).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 32).padEnd(32, 'x');
  return { key, prefix: key.slice(0, 12), hash: createHash('sha256').update(key).digest('hex') };
}
