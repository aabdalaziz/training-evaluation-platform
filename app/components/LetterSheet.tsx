'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P52 «رسالة الشهر» — ورقة الرسالة كما تصل إلى الجهة (A4 واحدة · تُطبع) — تُستخدم في مكتب التوقيع (معاينة) وفي بوابة الجهات (الأرشيف)
 *  testids: ls-root[data-status] ls-lines ls-pulse[data-k] ls-pulse-line ls-pulse-mirror ls-pulse-say ls-threads ls-line ls-promise ls-ask ls-sign ls-code ls-reply
 *  P57 «نبض الشهر»: قسم رابع من body.pulse (محسوب مع المسوَّدة · متجمّد مع التوقيع) — سطر أرقام + مرآة + 🔊.
 */
import type { LetterBody } from '../../lib/org-impact/letter';
import { pulseSpeech } from '../../lib/org-impact/pulse';
import { EchoSay } from './EchoSay';

export type LetterView = { id?: string; month: string; status: 'draft' | 'signed'; body: LetterBody; line_ar?: string | null; promise_ar?: string | null; ask_ar?: string | null; signed_name?: string | null; signed_title?: string | null; signed_at?: string | null; code?: string | null; digest?: string | null; verify_url?: string | null; reply_ar?: string | null; reply_by?: string | null; reply_at?: string | null };
const fmt = (iso?: string | null) => { if (!iso) return ''; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };

export function LetterSheet({ l, draftLine, draftPromise, draftAsk, compact }: { l: LetterView; draftLine?: string; draftPromise?: string; draftAsk?: string; compact?: boolean }) {
  const b = l.body; const line = l.status === 'signed' ? l.line_ar : (draftLine ?? l.line_ar); const promise = l.status === 'signed' ? l.promise_ar : (draftPromise ?? l.promise_ar); const ask = l.status === 'signed' ? l.ask_ar : (draftAsk ?? l.ask_ar ?? b.ask_suggested_ar);
  return <article className={`ls ${compact ? 'compact' : ''}`} dir="rtl" data-testid="ls-root" data-status={l.status} data-month={l.month}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="ls-head"><div><p className="ls-kicker">رسالة الشهر من أَثَر · {b.month_ar}</p><h2>{b.org.name_ar}</h2><small>التقرير الشهري لأثر الجهة · لا تحوي الرسالة أسماء منسوبين · ما دون خمسة لا يُذكر رقمًا</small></div><div className="ls-logo" aria-hidden="true">أَثَر</div></header>
    {l.status === 'draft' && <p className="ls-draft">مسوَّدة — تُرسل بعد سطر الإنسان والتوقيع</p>}
    <section className="ls-sec" data-testid="ls-lines"><h3>ثلاثة أرقام تكفي</h3><ol>{b.lines_ar.map((x, i) => <li key={i}>{x}</li>)}</ol></section>
    {b.pulse && <section className="ls-sec ls-pulse" data-testid="ls-pulse" data-k={b.pulse.k ? 1 : 0} data-hands-open={b.pulse.hands_open}><h3>نبض الشهر 🫀</h3>{b.pulse.line_ar && <p className="ls-pulse-line" data-testid="ls-pulse-line">{b.pulse.line_ar}</p>}<p className="ls-pulse-mirror" data-testid="ls-pulse-mirror">{b.pulse.mirror_ar}</p>{b.pulse.thread_ar && <p className="ls-pulse-thread" data-testid="ls-pulse-thread">🧶 {b.pulse.thread_ar}</p>}<EchoSay text={pulseSpeech(b.pulse)} ar testid="ls-pulse-say" /><small className="ls-muted">حوار المدرّبين مع منسوبيكم — بلا أسماء، ولا يدخل في أي تقييم.</small></section>}
    <section className="ls-sec" data-testid="ls-threads"><h3>خيوط الشهر</h3>{b.threads.length ? <ul className="ls-threads">{b.threads.map((t, i) => <li key={i}><b>{t.label_ar}</b><small>{t.people} منسوبين تداولوه</small></li>)}</ul> : <p className="ls-muted">لم يبلغ أيّ خيط خمسة منسوبين هذا الشهر — نحفظ الخصوصية.</p>}</section>
    <section className="ls-sec ls-human" data-testid="ls-line"><h3>سطر من أَثَر</h3><p className="ls-quote">{line ? `«${line}»` : <span className="ls-muted">— يكتبه مدير البرامج قبل التوقيع —</span>}</p></section>
    <div className="ls-two">
      <section className="ls-sec" data-testid="ls-promise"><h3>وعدنا للشهر القادم</h3><p>{promise || <span className="ls-muted">— يُختار قبل التوقيع —</span>}</p></section>
      <section className="ls-sec" data-testid="ls-ask"><h3>ما نحتاجه منكم</h3><p>{ask || <span className="ls-muted">لا شيء هذا الشهر — شكرًا.</span>}</p></section>
    </div>
    <footer className="ls-foot" data-testid="ls-sign">
      <div>{l.status === 'signed' ? <><b>{l.signed_name}</b> · {l.signed_title} · {fmt(l.signed_at)}</> : <span className="ls-muted">بلا توقيع لا تُرسل الرسالة</span>}</div>
      {l.status === 'signed' && l.code && <div className="ls-code" data-testid="ls-code"><span>رمز الرسالة <b>{l.code}</b></span>{l.verify_url && <a href={l.verify_url} target="_blank" rel="noopener noreferrer">تحقّق</a>}{l.digest && <small>بصمة {l.digest.slice(0, 12)}…</small>}</div>}
    </footer>
    {l.reply_ar && <section className="ls-reply" data-testid="ls-reply"><h3>ردّ الجهة</h3><p>«{l.reply_ar}»</p><small>{l.reply_by} · {fmt(l.reply_at)}</small></section>}
    <p className="ls-copy">© 2026 د. أحمد محمد عبدالعزيز بدوي — أَثَر · التعلّم والتدريب والتطوير</p>
  </article>;
}

const CSS = `
.ls{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:22px 24px;max-width:820px;margin:0 auto;color:#0f2a4e;font-size:15px;line-height:1.75}
.ls-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #c9a24b;padding-bottom:12px;margin-bottom:12px}.ls-kicker{margin:0;color:#b45309;font-weight:800;font-size:13px}.ls h2{margin:2px 0;font-size:24px}.ls-head small{color:#64748b;font-size:12px}
.ls-logo{font-weight:900;font-size:22px;color:#0f2a4e;border:2px solid #0f2a4e;border-radius:12px;padding:4px 12px}
.ls-draft{background:#fffbeb;border:1px dashed #c9a24b;border-radius:10px;padding:6px 12px;color:#92400e;font-weight:800;margin:0 0 10px}
.ls-sec{margin:10px 0}.ls-sec h3{margin:0 0 6px;font-size:15px;color:#b45309}.ls-sec ol{margin:0;padding-inline-start:20px}.ls-sec ol li{margin:4px 0}.ls-sec p{margin:0}
.ls-threads{list-style:none;margin:0;padding:0;display:flex;gap:8px;flex-wrap:wrap}.ls-threads li{border:1px solid #e5e9f0;border-radius:999px;padding:6px 12px}.ls-threads li b{margin-inline-end:6px}.ls-threads small{color:#64748b}
.ls-pulse{background:#fdf4ff;border:1px solid #e9d5ff;border-radius:12px;padding:10px 14px}.ls-pulse h3{color:#6d28d9}.ls-pulse-line{font-weight:800;margin:0 0 4px}.ls-pulse-thread{margin:0 0 6px;color:#92400e;font-weight:700}.ls-pulse-mirror{margin:0 0 6px;border-inline-start:3px solid #c4b5fd;padding-inline-start:8px}.ls-pulse small{display:block;margin-top:6px;font-size:12px}
.ls-pulse .nt-echo-say{border:1.5px solid #7c3aed;background:#fff;color:#6d28d9;border-radius:999px;padding:3px 10px;font-weight:800;font-size:13px;cursor:pointer}.ls-pulse .nt-echo-say.on{background:#6d28d9;color:#fff}
@media print{.ls-pulse .nt-echo-say{display:none}}
.ls-human{background:#f8fafc;border-radius:12px;padding:12px 14px}.ls-quote{font-size:17px;font-weight:700;margin:0}.ls-muted{color:#64748b;font-weight:400}
.ls-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ls-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;border-top:1px solid #e5e9f0;margin-top:12px;padding-top:10px}.ls-code{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13px}.ls-code a{color:#0f2a4e;font-weight:800}
.ls-reply{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin-top:10px}.ls-reply h3{margin:0 0 4px;font-size:14px;color:#047857}.ls-reply p{margin:0}.ls-reply small{color:#047857}
.ls-copy{margin:10px 0 0;font-size:11.5px;color:#94a3b8;text-align:center}.ls.compact{padding:14px 16px;font-size:14px}
@media (max-width:640px){.ls-two{grid-template-columns:1fr}.ls{padding:14px}}
@media print{.ls{border:none;max-width:none;box-shadow:none}}
`;
