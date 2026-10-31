// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هيئة أَثَر (P31) — ما يجري في الكرون اليومي القائم (followups) بلا كرون جديد:
 *  1) دعوة مدربي منصة التقييم القائمة الذين لا سيرة لهم بعد (مرة واحدة لكل بريد — ref `directory:invite:<email>`؛ حدّ 25 يوميًّا).
 *  2) تذكير سنوي لأعضاء الهيئة المعتمدين الذين لم يحدّثوا سيرتهم منذ 365 يومًا (مرة في السنة — meta.reminded_at).
 *  3) P33 «أَثَر معك»: تذكير صاحب النافذة المعلنة إن كانت تبدأ خلال 24 ساعة (مرة لكل نافذة ويوم — ref `onair:window:<id>:<date>`).
 *  4) P34 «ساعة الهواء الذهبية»: تذكير المتعهّدين قبل 60 دقيقة (مرة لكل تعهّد — reminded_at).
 */
import { notify } from '../portal/notify';
import { UPDATE_REMINDER_DAYS, TAGLINE_AR, lower } from './registry';
import type { Profile } from './registry';

const INVITE_BATCH = 25;
export type DirectoryCronResult = { ok: true; dry: boolean; invited: number; reminded: number; skipped_invites: number; windows_reminded?: number; golden_reminded?: number } | { ok: false; error: string };

export async function runDirectory(db: any, opts: { dry?: boolean; site: string; now?: Date } = { site: '' }): Promise<DirectoryCronResult> {
  const dry = !!opts.dry; const now = opts.now || new Date(); const site = opts.site.replace(/\/+$/, '');
  let invited = 0, reminded = 0, skipped = 0, windows = 0;
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
    // (3) P33 نوافذ «أَثَر معك» التي تبدأ خلال 24 ساعة
    try {
      const { nextWindowAt, hhmm, WEEKDAY_AR } = await import('../onair/registry');
      const { data: wins } = await db.from('portal_onair_windows').select('id,user_id,weekday,from_min,to_min,note_ar').limit(2000);
      const uids = Array.from(new Set(((wins || []) as any[]).map(w => String(w.user_id))));
      const { data: pres } = uids.length ? await db.from('portal_onair_presence').select('user_id,email').in('user_id', uids).limit(2000) : { data: [] };
      const emailOf = new Map(((pres || []) as any[]).map(p => [String(p.user_id), String(p.email || '')]));
      const { data: wlogs } = await db.from('portal_message_log').select('ref_id').eq('kind', 'onair_window').limit(5000);
      const wsent = new Set(((wlogs || []) as any[]).map(l => String(l.ref_id || '')));
      for (const w of (wins || []) as any[]) {
        const at = nextWindowAt(w, now); const diff = at.getTime() - now.getTime(); if (diff < 0 || diff > 24 * 36e5) continue;
        const email = emailOf.get(String(w.user_id)) || ''; if (!email.includes('@')) continue;
        const ref = `onair:window:${w.id}:${at.toISOString().slice(0, 10)}`; if (wsent.has(ref)) continue;
        windows++; if (dry) continue;
        await notify(db, { kind: 'onair_window', to: { email, name: null }, ref, subject: `نافذتك على الهواء ${WEEKDAY_AR[w.weekday]} ${hhmm(w.from_min)}`,
          text: `أعلنتَ نافذة «أَثَر معك» ${WEEKDAY_AR[w.weekday]} من ${hhmm(w.from_min)} إلى ${hhmm(w.to_min)}${w.note_ar ? ` (${w.note_ar})` : ''}. حين يحين الوقت اضغط «أستقبل» من ${site}/me/onair — الصعود بيدك، ولا يصعد أحد عنك.`, url: `${site}/me/onair` });
      }
    } catch { /* قبل تنفيذ SQL الخاص بـ P33 */ }
    let golden = 0; try { const { remindGolden } = await import('../onair/load'); golden = await remindGolden(db, site, now, dry); } catch { /* قبل SQL P34 */ }
    return { ok: true, dry, invited, reminded, skipped_invites: skipped, windows_reminded: windows, golden_reminded: golden };
  } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
}
