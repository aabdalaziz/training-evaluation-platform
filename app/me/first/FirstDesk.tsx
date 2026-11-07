'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P64 «أول يوم — قال من سبقك» — مكتب اليوم الأول (يُحمَّل ديناميكيًا بلا SSR)
 *  0) «شكر وتقدير وأمنيات» — كلمة أَثَر نفسها أولًا (نصّ إنساني ثابت، موقَّع «— أَثَر»، يُخصَّص بالاسم الأول واسم البرنامج)
 *  1) الرأس: البرنامج · التاريخ · «اليوم يومك الأول» إن كان اليوم · اختيار برنامج آخر بدأ
 *  2) «قال من سبقك»: ≤ 7 سطور تخرّج من خرّيجي هذا البرنامج (k ≥ 5 أشخاص؛ بلا أسماء؛ خلط يومي) + «وقالوا بعد أشهر» (P38)
 *  3) «كلمة الاستقبال من مدرّبك» إن كتبها (P51 بعلامة welcome) · «شعبتك» أعداد فقط (k ≥ 5)
 *  4) «لماذا جئتُ»: سطر 10–160 يُختم إلى يوم التخرّج (محرّك P62) — في الأسبوع الأول فقط · مرة واحدة
 *  5) «ما ينتظرك في أَثَر»: خارطة طريق ثابتة بروابط
 *  testids: fd-root[data-phase] fd-err fd-ok fd-athar fd-prog fd-today fd-said fd-said-line fd-said-below fd-after fd-welcome fd-mates fd-why fd-why-ta fd-why-save fd-why-sealed fd-why-open fd-why-closed fd-road fd-foot fd-empty
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import { fmtDayAr } from '../../../lib/first/registry';
import type { FirstProgram, FirstView } from '../../../lib/first/store';

type Data = { programs: FirstProgram[]; view: FirstView | null; names: Record<string, string>; limits: { k: number; show: number; whyMin: number; whyMax: number; windowDays: number }; foot_ar: string; prompt_ar: string; now: string };
const qs = (k: string) => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get(k) : null);
const PHASE_AR: Record<string, string> = { first: 'اليوم يومك الأول', week: 'أسبوعك الأول', later: 'في أثناء البرنامج', before: 'قبل البداية' };

export default function FirstDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [pid, setPid] = useState<string>(''); const [why, setWhy] = useState('');
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); setPid(qs('program') || ''); }, [db]);
  const load = useCallback(async (t: string, p: string) => {
    const j = await fetch(`/api/me/first${p ? `?program=${encodeURIComponent(p)}` : ''}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); if (j.view && !p) setPid(j.view.program.id); } else setErr(j?.error || 'تعذّر فتح الصفحة');
  }, []);
  useEffect(() => { if (tok) load(tok, pid); }, [tok, pid, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 8000); };
  async function saveWhy() {
    if (!confirm('يُختم سطرك الآن ولا يُقرأ — حتى يوم تخرّجك. سطر واحد لكل برنامج. نتابع؟')) return;
    setBusy(true); const j = await fetch('/api/me/first', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'why', program_id: pid, body_ar: why }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setD(j); setErr(''); setWhy(''); if (j.message) flash(j.message); } else setErr(j?.error || 'تعذّر الختم');
  }
  const v = d?.view; const whyOk = !!d && why.trim().length >= d.limits.whyMin && why.trim().length <= d.limits.whyMax;
  return <main className="fd" dir="rtl" data-testid="fd-root" data-phase={v?.program.phase || ''}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="fd-nav" aria-label="تنقّل"><Link href="/me" className="fd-link"><Icon name="arrow" size={14} /> ملفّي</Link><Link href="/me/letter" className="fd-link"><Icon name="mail" size={14} /> رسالة إلى نفسي</Link><Link href="/me/grad" className="fd-link"><Icon name="award" size={14} /> يوم تخرّجي</Link><Link href="/" className="fd-link"><Icon name="home" size={14} /> الرئيسية</Link></nav>
    <header className="fd-head"><span className="pt-kicker"><Icon name="spark" size={14} /> {d?.names.official_ar || 'صفحة اليوم الأول للمتدرّب'}</span><h1>🌅 {d?.names.title || 'أول يوم'} <small>{d?.names.sub || 'قال من سبقك'}</small></h1>
      <p>يوم يبدأ برنامجك يُفتح لك هذا الباب مرة واحدة: كلمة من أَثَر، وسطور تركها لك خرّيجو هذا البرنامج يوم تخرّجهم — بلا أسماء — ثم سطرٌ تكتبه أنت ويُفتح لك يوم تخرّجك. لا درجة، لا تقييم، لا ذكاء اصطناعي.</p></header>
    {err && <p className="fd-err" role="alert" data-testid="fd-err">{err}</p>}
    {msg && <p className="fd-ok" role="status" data-testid="fd-ok">{msg}</p>}
    {!tok && tok !== null && <section className="pt-box"><p>سجّل الدخول لتفتح يومك الأول. <Link href="/me">مساحتي</Link></p></section>}
    {d && !v && <section className="pt-box fd-empty" data-testid="fd-empty"><b>لم يبدأ لك برنامج بعد.</b><p className="fd-muted">تُفتح هذه الصفحة يوم start_date لكل برنامج قُبلتَ فيه، وتبقى مفتوحة حتى نهايته. حين يبدأ برنامجك يصلك إشعار «اليوم يومك الأول».</p></section>}
    {d && v && <>
      {/* 0) أَثَر يقول — أولًا */}
      <section className="fd-athar" data-testid="fd-athar" aria-labelledby="fd-athar-h">
        <h2 id="fd-athar-h"><Icon name="star" size={16} /> {d.names.athar}</h2>
        <p className="fd-athar-thanks">{v.athar.thanks_ar}</p>
        <p>{v.athar.appreciation_ar}</p>
        <p>{v.athar.wishes_ar}</p>
        <p className="fd-athar-sign">{v.athar.signed_ar}</p>
      </section>

      <section className="fd-prog" data-testid="fd-prog">
        <div><b>{v.program.name_ar}</b><p className="fd-muted">{fmtDayAr(v.program.start_date)}{v.program.end_date ? ` ← ${fmtDayAr(v.program.end_date)}` : ''} · {PHASE_AR[v.program.phase]}{v.trainer_ar ? ` · مدرّبك ${v.trainer_ar}` : ''}</p></div>
        {d.programs.length > 1 && <select className="fd-select" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="برنامج آخر">{d.programs.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>}
      </section>
      {v.program.phase === 'first' && <section className="fd-today" data-testid="fd-today"><b>اليوم يومك الأول 🌅</b> — بدأ برنامجك اليوم. من سبقك ترك لك كلمة؛ وأنت ستترك سطرك لمن يأتي بعدك — يوم تخرّجك.</section>}

      {/* 2) قال من سبقك */}
      <section className="fd-box fd-said" data-testid="fd-said" data-shown={v.said.shown ? 1 : 0} data-n={v.said.n}>
        <h2><Icon name="chat" size={16} /> {d.names.said} {v.said.head_ar && <small className="fd-muted">{v.said.head_ar}</small>}</h2>
        {v.said.shown ? <ul className="fd-lines">{v.said.lines.map((l, i) => <li key={i} data-testid="fd-said-line"><span>«{l}»</span></li>)}</ul> : <p className="fd-muted fd-below" data-testid="fd-said-below">{v.said.below_ar}</p>}
        {(v.after.line_ar || v.after.excerpts.length > 0) && <div className="fd-after" data-testid="fd-after"><h3>{d.names.after}</h3>{v.after.line_ar && <p className="fd-muted">{v.after.line_ar}</p>}
          {v.after.excerpts.map((x, i) => <blockquote key={i}><small>{x.station === 30 ? 'بعد شهر' : x.station === 90 ? 'بعد ثلاثة أشهر' : 'بعد سنة'}</small>{x.text_ar}</blockquote>)}</div>}
        <p className="fd-muted">سطور التخرّج كتبها خرّيجون بأيديهم في «يوم تخرّجي — بكلماتي» واختاروا إظهارها. لا تظهر إلا من خمسة أشخاص على الأقل، وبلا أسماء — ولا يُطلب منهم شيء.</p>
      </section>

      {/* 3) كلمة الاستقبال · شعبتك */}
      {v.welcome && <section className="fd-box fd-welcome" data-testid="fd-welcome"><h2><Icon name="users" size={16} /> {d.names.welcome}{v.welcome.trainer_ar ? ` ${v.welcome.trainer_ar}` : ''}</h2>
        <p className="fd-welcome-text">{v.welcome.text_ar}</p>{v.welcome.voice_sec ? <p className="fd-muted">🎙️ ومعها كلمة صوتية ({v.welcome.voice_sec} ث) — تجدها في «دفتر اليوم» على ملفّك.</p> : null}<p className="fd-muted">تبقى هذه الكلمة في صفحة تخرّجك.</p></section>}
      {(v.mates_ar || v.why_count_ar) && <p className="fd-mates" data-testid="fd-mates">{v.mates_ar && <span>👥 {v.mates_ar}</span>}{v.why_count_ar && <span>✍️ {v.why_count_ar}</span>}</p>}

      {/* 4) لماذا جئتُ */}
      <section className="fd-box fd-why" id="fd-why" data-testid="fd-why" data-state={v.why ? v.why.state : v.can_write ? 'open' : 'closed'}>
        <h2><Icon name="edit" size={16} /> {d.names.why} <small className="fd-muted">{d.limits.whyMin}–{d.limits.whyMax} حرفًا · يُختم إلى يوم تخرّجك</small></h2>
        {v.why ? <div data-testid="fd-why-sealed">
          {v.why.state === 'opened' && v.why.body_ar ? <p className="fd-why-text">«{v.why.body_ar}»</p> : <p className="fd-why-text">🔏 كتبتَ سطرك {new Date(v.why.written_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' })} — مختوم، يُفتح {v.why.opens_ar} الساعة {v.why.open_hour_ar}.</p>}
          <p className="fd-muted">تجده في <Link href={`/me/letter#letter-${v.why.id}`}>«رسالة إلى نفسي»</Link>، ويظهر في صفحة تخرّجك بطاقةً باسم «ما كتبتُه أول يوم». لا يُحسب ضمن رسائلك الثلاث.</p>
        </div> : v.can_write ? <div data-testid="fd-why-open">
          <p className="fd-prompt">{d.prompt_ar}</p>
          <textarea className="fd-ta" value={why} onChange={(e) => setWhy(e.target.value.slice(0, d.limits.whyMax))} maxLength={d.limits.whyMax} rows={2} placeholder="جئتُ لأن…" data-testid="fd-why-ta" />
          <div className="fd-acts"><button type="button" className="pt-btn gold small" disabled={!whyOk || busy} onClick={saveWhy} data-testid="fd-why-save">🔏 اختم سطري إلى يوم تخرّجي</button><span className="fd-muted">{why.trim().length}/{d.limits.whyMax} · الباب مفتوح حتى {fmtDayAr(v.window_until)}</span></div>
        </div> : <p className="fd-muted" data-testid="fd-why-closed">باب «{d.names.why}» يُفتح في الأسبوع الأول من البرنامج فقط (حتى {fmtDayAr(v.window_until)}) — وقد مضى. تستطيع دائمًا أن تكتب <Link href="/me/letter">رسالة إلى نفسك</Link>.</p>}
      </section>

      {/* 5) ما ينتظرك */}
      <section className="fd-box fd-road" data-testid="fd-road"><h2><Icon name="compass" size={16} /> {d.names.road}</h2>
        <ol>{v.road.map((s, i) => <li key={i}><b>{s.when_ar}</b><Link href={s.href}>{s.what_ar}</Link></li>)}</ol></section>
      <p className="fd-foot" data-testid="fd-foot">{d.foot_ar}</p>
    </>}
  </main>;
}

const CSS = `
.fd{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:960px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.fd *{box-sizing:border-box}
.fd-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:8px}.fd-link{color:#0f2a4e;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:5px;font-size:14px}.fd-link:hover{text-decoration:underline}
.fd-head h1{margin:4px 0 6px;font-size:32px;color:#0f2a4e}.fd-head h1 small{display:block;font-size:15px;color:#b45309;font-weight:800;margin-top:2px}.fd-head p{margin:0 0 14px;color:#475569;line-height:1.9;max-width:760px}
.fd-muted{color:#64748b;font-size:13px;line-height:1.8;margin:4px 0}.fd-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.fd-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.fd-athar{background:linear-gradient(160deg,#0f2a4e,#1e3a5f);color:#fff;border-radius:20px;padding:20px 22px;margin:0 0 12px;line-height:2;font-size:16px;box-shadow:0 10px 30px rgba(15,42,78,.18)}.fd-athar h2{margin:0 0 8px;font-size:15px;color:#fcd34d;display:flex;align-items:center;gap:8px;letter-spacing:.3px}.fd-athar p{margin:0 0 6px}.fd-athar-thanks{font-size:20px;font-weight:800}.fd-athar-sign{text-align:left;color:#fcd34d;font-weight:800;margin-top:6px}
.fd-prog{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:12px 16px;margin:0 0 12px}.fd-prog b{font-size:18px;color:#0f2a4e}.fd-select{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;background:#fff}
.fd-today{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fcd34d;border-radius:16px;padding:14px 18px;margin:0 0 12px;font-size:16px;line-height:1.9;color:#78350f}
.fd-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px 18px;margin:0 0 12px}.fd-box h2{margin:0 0 8px;font-size:18px;color:#0f2a4e;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.fd-box h2 small{font-weight:600;font-size:12px}.fd-box h3{margin:12px 0 4px;font-size:14px;color:#9a3412}
.fd-lines{list-style:none;padding:0;margin:6px 0;display:grid;gap:8px}.fd-lines li{background:linear-gradient(160deg,#fffbeb,#fff);border:1px solid #fde68a;border-radius:14px;padding:10px 14px;font-size:17px;line-height:1.9;color:#3b1d0e;font-weight:600}.fd-below{font-size:15px;color:#475569}
.fd-after blockquote{margin:6px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:8px 12px;font-size:14px;line-height:1.8}.fd-after blockquote small{display:block;color:#94a3b8;font-size:11px}
.fd-welcome{background:linear-gradient(160deg,#fffbeb,#fff);border-color:#fcd34d}.fd-welcome-text{margin:4px 0;font-size:17px;line-height:1.9;color:#3b1d0e;font-weight:600;white-space:pre-wrap}
.fd-mates{display:flex;gap:14px;flex-wrap:wrap;margin:0 0 12px;color:#475569;font-size:13px;font-weight:700}
.fd-why{border-color:#fde68a}.fd-prompt{margin:0 0 6px;color:#9a3412;font-weight:800;font-size:15px}.fd-ta{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:17px;line-height:1.8;resize:vertical;min-height:64px}.fd-acts{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px}.fd-why-text{margin:4px 0;font-size:16px;line-height:1.9;color:#0f2a4e;font-weight:700}
.fd-road ol{margin:0;padding:0 18px 0 0;line-height:2}.fd-road li{display:flex;gap:10px;flex-wrap:wrap;align-items:baseline}.fd-road li b{color:#b45309;min-width:140px;font-size:13px}.fd-road li a{color:#0f2a4e;font-weight:700;text-decoration:none}.fd-road li a:hover{text-decoration:underline}
.fd-foot{color:#94a3b8;font-size:12px;line-height:1.8;border-top:1px dashed #e2e8f0;padding-top:10px}
@media (max-width:640px){.fd-head h1{font-size:26px}.fd-athar{padding:16px}.fd-athar-thanks{font-size:18px}.fd-road li b{min-width:100%}}
`;
