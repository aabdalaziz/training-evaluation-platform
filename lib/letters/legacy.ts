// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P63 — رسائل «أصوات حول الشهادة» القديمة (P39 · جدول portal_after_letters) تُقرأ هنا فقط لتظهر في مكتب «رسالة إلى نفسي» (P62) تحت «سلسلة سنواتي».
 *  لا ترحيل ولا حذف ولا كتابة: النصّ لا يُعاد قبل فتحها (opened_at يضعه كرون محطة السنة في P39). الباب الجديد للكتابة واحد: /me/letter?door=grad&program=<id>.
 */
import { fmtDayAr } from './self';
type Db = any;
const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
const lower = (s: unknown) => String(s || '').trim().toLowerCase();
export type LegacyLetter = { id: number | string; program_id: string; program_ar: string; sealed_at: string; sealed_ar: string; opened_at: string | null; opened_ar: string; unseals_ar: string; text_ar: string | null };
export async function legacyLetters(db: Db, me: { id: string; email: string }): Promise<LegacyLetter[]> {
  try {
    const { data } = await db.from('portal_after_letters').select('id,program_id,text_ar,sealed_at,opened_at').or(`user_id.eq.${me.id},email.eq.${lower(me.email)}`).order('sealed_at', { ascending: false }).limit(20);
    const rows = arr<any>(data); if (!rows.length) return [];
    const pids = [...new Set(rows.map((r) => String(r.program_id || '')).filter(Boolean))];
    const { data: ps } = pids.length ? await db.from('programs').select('id,name_ar,end_date').in('id', pids).limit(20) : { data: [] };
    const progs = arr<any>(ps);
    return rows.map((r) => { const p = progs.find((x) => String(x.id) === String(r.program_id)); const end = p?.end_date ? String(p.end_date).slice(0, 10) : null; const unseals = end ? new Date(new Date(`${end}T00:00:00Z`).getTime() + 365 * 86400000).toISOString() : null;
      return { id: r.id, program_id: String(r.program_id || ''), program_ar: String(p?.name_ar || 'برنامج'), sealed_at: String(r.sealed_at || ''), sealed_ar: r.sealed_at ? fmtDayAr(String(r.sealed_at)) : '—', opened_at: r.opened_at || null, opened_ar: r.opened_at ? fmtDayAr(String(r.opened_at)) : '', unseals_ar: unseals ? fmtDayAr(unseals) : '—', text_ar: r.opened_at ? String(r.text_ar || '') : null }; });
  } catch { return []; }
}
