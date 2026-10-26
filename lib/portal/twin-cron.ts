// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * أَثَر — نبض الشهادة الحية للمشتركين (P11) — يعمل ضمن الكرون اليومي الموجود (/api/followups/send) بلا كرون جديد
 *  لكل مشترك نشط لم يُبلَّغ خلال 6 أيام: يُحسب نبض الشهادة الآن ويُقارن بآخر لقطة؛ إن تغيّر مستوى (≥0.1) أو حالة مهارة → بريد مجمّع واحد.
 *  أول مرة تُخزَّن اللقطة فقط (بلا بريد) لتجنّب الضجيج. لا محتوى شخصيًا في البريد سوى اسم صاحب الشهادة المعروض أصلًا على صفحة التحقق.
 */
import { buildLiving, diffSnapshots, STATUS_LABEL, fmtLevel } from './twin';
import type { LiveSnapshot, TwinStatus } from './twin';
import { sendViaResend } from '../email/resend';

const esc = (s: string) => String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
const stName = (s: TwinStatus | null) => (s ? STATUS_LABEL[s].ar : '—');

export function watchEmailHtml(p: { title: string; holder: string; code: string; url: string; token: string; changes: ReturnType<typeof diffSnapshots>; names: Record<string, string>; pulse: number | null }): string {
  const rows = p.changes.map(c => `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${esc(p.names[c.code] || c.code)}</td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${c.from === null ? '—' : fmtLevel(c.from)} ← <b>${fmtLevel(c.to)}</b></td><td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center">${stName(c.status_from)} ← <b style="color:${STATUS_LABEL[c.status_to].color}">${stName(c.status_to)}</b></td></tr>`).join('');
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.9;color:#0f172a"><h2 style="color:#0f2a4e;margin:0 0 6px">نبض الشهادة الحية</h2><p>تغيّرت الشهادة <b>«${esc(p.title)}»</b> (${esc(p.code)})${p.holder ? ` لصاحبها <b>${esc(p.holder)}</b>` : ''}${p.pulse !== null ? ` — النبض الآن <b>${p.pulse}%</b>` : ''}.</p><table style="border-collapse:collapse;width:100%;font-size:14px"><thead><tr style="background:#f1f5f9"><th style="padding:6px 10px;text-align:right">المهارة</th><th style="padding:6px 10px">المستوى</th><th style="padding:6px 10px">الحالة</th></tr></thead><tbody>${rows}</tbody></table><p><a href="${p.url}" style="background:#0f2a4e;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;display:inline-block;margin-top:10px">فتح الشهادة الحية</a></p><p style="color:#64748b;font-size:12px">تصلك هذه الرسالة لأنك مشترك في هذه الشهادة. <a href="${p.url}?unwatch=${p.token}">إلغاء الاشتراك</a><br/>أَثَر | التدريب ما بعد الذكاء الاصطناعي — نبني القدرة ونُثبت الأثر</p></div>`;
}

export async function runCredentialWatch(db: any, site: string, opts: { dry?: boolean; now?: Date } = {}) {
  const now = opts.now || new Date(); const cutoff = new Date(now.getTime() - 6 * 86400000).toISOString();
  const { data: ws, error } = await db.from('portal_credential_watchers').select('id,email,name,token,last_snapshot,last_notified_at,credential:portal_credentials(id,verify_code,title_ar,full_name,live,revoked_at)').is('unsubscribed_at', null).or(`last_notified_at.is.null,last_notified_at.lt.${cutoff}`).limit(500);
  if (error) return { ok: false, error: error.message };
  const watchers = ((ws || []) as any[]).filter(w => w.credential && !w.credential.revoked_at);
  const byCred = new Map<string, any[]>(); for (const w of watchers) { const k = w.credential.id; if (!byCred.has(k)) byCred.set(k, []); byCred.get(k)!.push(w); }
  let checked = 0, notified = 0, baselined = 0, unchanged = 0; const errors: string[] = []; const previews: any[] = [];
  for (const [, list] of byCred) {
    const cred = list[0].credential; checked++;
    let living: any; try { const { data } = await db.rpc('portal_living_credential', { p_code: cred.verify_code }); living = buildLiving(data, now); } catch (e: any) { errors.push(String(e?.message || e)); continue; }
    if (!living.ok || !living.live) continue;
    const cur: LiveSnapshot = living.snapshot || {}; const names: Record<string, string> = {}; for (const s of living.skills || []) names[s.code] = s.name_ar;
    const url = `${site}/credential/${encodeURIComponent(cred.verify_code)}`;
    for (const w of list) {
      if (!w.last_snapshot) { baselined++; if (!opts.dry) await db.from('portal_credential_watchers').update({ last_snapshot: cur, last_notified_at: now.toISOString() }).eq('id', w.id); continue; }
      const changes = diffSnapshots(w.last_snapshot, cur); if (!changes.length) { unchanged++; continue; }
      const html = watchEmailHtml({ title: cred.title_ar, holder: cred.full_name || '', code: cred.verify_code, url, token: w.token, changes, names, pulse: living.pulse });
      if (opts.dry) { previews.push({ email: w.email, code: cred.verify_code, changes }); notified++; continue; }
      try { await sendViaResend({ to: [w.email], subject: `أَثَر | تغيّر في الشهادة الحية ${cred.verify_code}`, html, tags: [{ name: 'kind', value: 'credential_pulse' }] }); notified++; await db.from('portal_credential_watchers').update({ last_snapshot: cur, last_notified_at: now.toISOString() }).eq('id', w.id); }
      catch (e: any) { errors.push(`${w.email}: ${String(e?.message || e)}`); }
    }
  }
  return { ok: true, checked, notified, baselined, unchanged, errors, previews: opts.dry ? previews : undefined };
}
