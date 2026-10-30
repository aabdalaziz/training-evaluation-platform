// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هيئة أَثَر (P31) — ما يجري في الكرون اليومي القائم (followups) بلا كرون جديد:
 *  1) دعوة مدربي منصة التقييم القائمة الذين لا سيرة لهم بعد (مرة واحدة لكل بريد — ref `directory:invite:<email>`؛ حدّ 25 يوميًّا).
 *  2) تذكير سنوي لأعضاء الهيئة المعتمدين الذين لم يحدّثوا سيرتهم منذ 365 يومًا (مرة في السنة — meta.reminded_at).
 */
import { notify } from '../portal/notify';
import { UPDATE_REMINDER_DAYS, TAGLINE_AR, lower } from './registry';
import type { Profile } from './registry';

const INVITE_BATCH = 25;
export type DirectoryCronResult = { ok: true; dry: boolean; invited: number; reminded: number; skipped_invites: number } | { ok: false; error: string };

export async function runDirectory(db: any, opts: { dry?: boolean; site: string; now?: Date } = { site: '' }): Promise<DirectoryCronResult> {
  const dry = !!opts.dry; const now = opts.now || new Date(); const site = opts.site.replace(/\/+$/, '');
  let invited = 0, reminded = 0, skipped = 0;
  try {
    // (1) دعوات المدربين القائمين
    const { data: trainers } = await db.from('trainers').select('id,name,email').not('email', 'is', null).limit(2000);
    const { data: profiles } = await db.from('portal_directory_profiles').select('id,email,status,updated_at,user_id,name_ar,meta').limit(5000);
    const have = new Set(((profiles || []) as any[]).map(p => lower(p.email)));
    const { data: logs } = await db.from('portal_message_log').select('ref_id').eq('kind', 'directory_invite').limit(5000);
    const sent = new Set(((logs || []) as any[]).map(l => String(l.ref_id || '')));
    for (const t of (trainers || []) as any[]) {
      if (invited >= INVITE_BATCH) break;
      const email = lower(t.email); if (!email || !email.includes('@')) continue;
      const ref = `directory:invite:${email}`; if (have.has(email) || sent.has(ref)) { skipped++; continue; }
      invited++; if (dry) continue;
      await notify(db, { kind: 'directory_invite', to: { email, name: t.name || null }, ref, subject: 'دعوتك إلى هيئة أَثَر — سيرتك بكلماتك وشهادتها من أَثَر',
        text: `${t.name ? `أستاذنا ${t.name}،` : 'أستاذنا الفاضل،'}\nأنت من مدربي أَثَر، وبرامجك مسجَّلة عندنا. فتحنا «هيئة أَثَر»: دليلًا عامًّا للخبراء والمدربين، ${TAGLINE_AR}.\nسيرتك تكتبها أنت، وما شهدته المنصة من برامجك يُعرض تلقائيًّا بجانبها من سجلّاتنا — لا نضيف كلمة من عندنا. بعد اعتماد الطاقم تحصل على شهادة توثيق موقَّعة ويمكن للجهات طلبك عبر أَثَر.\nابدأ من هنا: ${site}/me/directory\n— أَثَر`, url: `${site}/me/directory` }, { now });
    }
    // (2) التذكير السنوي
    const cutoff = now.getTime() - UPDATE_REMINDER_DAYS * 864e5;
    for (const p of (profiles || []) as Profile[]) {
      if (p.status !== 'approved') continue;
      const last = Date.parse(p.updated_at || '') || 0; const rem = Date.parse(p.meta?.reminded_at || '') || 0;
      if (last > cutoff || rem > cutoff) continue;
      reminded++; if (dry) continue;
      await notify(db, { kind: 'directory_reminder', to: { email: lower(p.email), name: p.name_ar }, ref: `directory:reminder:${p.id}:${now.toISOString().slice(0, 10)}`, subject: 'سنة على سيرتك في هيئة أَثَر — هل من جديد؟',
        text: `${p.name_ar}،\nمضت سنة منذ آخر تحديث لسيرتك في هيئة أَثَر. ما شهدته المنصة لك يتحدّث تلقائيًّا، أمّا كلماتك وإنجازاتك فأنت وحدك من يكتبها.\nراجع سيرتك وحدّث ما تشاء — ولو سطرًا: ${site}/me/directory\n— أَثَر`, url: `${site}/me/directory` }, { now });
      await db.from('portal_directory_profiles').update({ meta: { ...(p.meta || {}), reminded_at: now.toISOString() } }).eq('id', p.id);
    }
    return { ok: true, dry, invited, reminded, skipped_invites: skipped };
  } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
}
