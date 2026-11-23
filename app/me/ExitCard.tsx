'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «لو خرجت اليوم تحمل معك: …» (هـ-1/5) — بطاقة المشارك في دبلومه
 *  · مستويات الدبلوم كسلّم: المكتمل بلون ذهبي، الجاري بنبض، المتبقّي باهت · الساعات والمقرّرات
 *  · «أحتاج أن أخرج» → سؤال واحد اختياري «لماذا؟» → شهادات ما أتمّ + سجلّ إنجاز موقَّع · «أعود» خلال المهلة
 *  · لا تظهر إن لم يكن للمشارك قيد في دبلوم
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { REASONS, RETURN_MONTHS, LEVEL_WORD } from '../../lib/diploma/exit';

const arN = (n: number) => new Intl.NumberFormat('ar-EG').format(n);
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '—');

export default function ExitCard() {
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState(''); const [d, setD] = useState<any>(null); const [ask, setAsk] = useState<string | null>(null); const [code, setCode] = useState(''); const [why, setWhy] = useState(''); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const H = (t = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });
  async function load(t = tok) { const j = await fetch('/api/diploma/exit?mine=1', { headers: H(t), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setD(j); }
  useEffect(() => { (async () => { const { data } = await db.auth.getSession(); const t = data.session?.access_token || ''; if (!t) return; setTok(t); await load(t); })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function act(action: 'exit' | 'return', enrollment_id: string) {
    setBusy(true); setMsg('');
    const j = await fetch('/api/diploma/exit', { method: 'POST', headers: H(), body: JSON.stringify({ action, enrollment_id, reason_code: code || null, reason: why || null }) }).then((r) => r.json()).catch(() => null);
    setBusy(false); if (!j?.success) { setMsg(j?.error || 'تعذّر'); return; }
    setMsg(action === 'exit' ? `سُجّل خروجك — وأُصدرت ${j.issued === 1 ? 'وثيقة واحدة' : `${arN(j.issued)} وثائق`} إلى شهاداتك. بابك مفتوح للعودة ${arN(RETURN_MONTHS)} شهرًا.` : 'أهلًا بعودتك — تستأنف من حيث توقّفت.'); setAsk(null); setCode(''); setWhy(''); await load();
  }
  if (!d || !d.diplomas?.length) return null;
  return (
    <section className="xc" data-testid="exit-card" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {d.diplomas.map((p: any) => {
        const c = p.carry; const levels = c.levels.filter((l: any) => l.level_no > 0); const exited = p.state === 'exited';
        return <article key={p.enrollment_id} className={`xc-card ${exited ? 'exited' : ''}`} data-testid="exit-diploma" data-state={p.state}>
          <header><span className="xc-k"><Icon name="award" size={14} /> {p.program_name}</span><b className={`xc-state ${p.state}`}>{{ enrolled: 'مسجَّل', active: 'نشط', exited: 'خارج — بابك مفتوح', returned: 'عائد', graduate: 'خرّيج' }[p.state as string]}</b></header>
          <ol className="xc-ladder" aria-label="مستويات الدبلوم">{levels.map((l: any) => <li key={l.level_no} className={l.complete ? 'done' : l.done > 0 ? 'now' : ''} title={`${l.title}: ${arN(l.done)}/${arN(l.total)}`}><i>{arN(l.level_no)}</i><span>{l.title}</span><small>{arN(l.done)}/{arN(l.total)}</small></li>)}</ol>
          <p className="xc-line" data-testid="exit-line">{c.line_ar}</p>
          {exited ? <div className="xc-exit">
            <p>خرجت يوم {fmt(p.exit.exited_at)} بعد {c.afterLevel ? `المستوى ${LEVEL_WORD[c.afterLevel]}` : 'البداية'} — تحمل {p.exit.credential_ids?.length ? arN(p.exit.credential_ids.length) : '٠'} وثيقة موقَّعة{p.exit.record_code && <> · <a href={`/credential/${p.exit.record_code}`}>سجلّ الإنجاز</a></>}.</p>
            <p>يمكنك العودة من حيث توقّفت حتى <b>{fmt(p.exit.return_by)}</b>.</p>
            <button type="button" className="xc-btn" disabled={busy} onClick={() => act('return', p.enrollment_id)} data-testid="exit-return">أعود الآن</button>
          </div> : p.state !== 'graduate' && (ask === p.enrollment_id ? <div className="xc-ask" data-testid="exit-ask">
            <b>قبل أن تخرج — سؤال واحد اختياري: لماذا؟</b>
            <div className="xc-reasons">{REASONS.map((r) => <button key={r.code} type="button" className={code === r.code ? 'on' : ''} onClick={() => setCode(code === r.code ? '' : r.code)}>{r.ar}</button>)}</div>
            <textarea value={why} onChange={(e) => setWhy(e.target.value.slice(0, 300))} rows={2} placeholder="كلمة (اختياري)…" />
            <div className="xc-acts"><button type="button" className="xc-btn danger" disabled={busy} onClick={() => act('exit', p.enrollment_id)} data-testid="exit-confirm">{busy ? 'نُصدر وثائقك…' : 'أخرج وأحمل ما أتممت'}</button><button type="button" className="xc-btn ghost" onClick={() => setAsk(null)}>بقيتُ</button></div>
          </div> : <button type="button" className="xc-link" onClick={() => setAsk(p.enrollment_id)} data-testid="exit-open">أحتاج أن أخرج الآن…</button>)}
          {msg && <p className="xc-msg" role="status">{msg}</p>}
        </article>;
      })}
    </section>
  );
}

const CSS = `
.xc{display:grid;gap:12px;margin-bottom:12px}
.xc-card{background:linear-gradient(135deg,#FBF4EE,#F6EBE0);border:1px solid #EADFD6;border-radius:18px;padding:16px 18px;box-shadow:0 10px 28px rgba(42,22,38,.06)}
.xc-card.exited{background:linear-gradient(135deg,#3A1F36,#6A3350);color:#FBF4EE;border-color:transparent}
.xc-card header{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}.xc-k{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#8A5A1E}.xc-card.exited .xc-k{color:#F1D9A8}
.xc-state{font-size:11.5px;font-weight:900;border-radius:999px;padding:3px 10px;background:#fff;color:#3A1F36}.xc-state.exited{background:#D9A866;color:#2A1626}.xc-state.graduate{background:#3A1F36;color:#FBF4EE}
.xc-ladder{list-style:none;margin:0 0 10px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.xc-ladder li{flex:1;min-width:92px;display:grid;grid-template-columns:26px 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;padding:8px 10px;border-radius:12px;background:rgba(255,255,255,.6);border:1px solid #EADFD6;opacity:.65}
.xc-ladder li i{grid-row:1/3;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:900;font-size:12px;background:#F1D9A8;color:#5C4858}.xc-ladder li span{font-size:12px;font-weight:800;color:#2A1626}.xc-ladder li small{font-size:11px;color:#8E7F8A}
.xc-ladder li.done{opacity:1;border-color:#D9A866;background:#fff}.xc-ladder li.done i{background:#D9A866;color:#2A1626}.xc-ladder li.now{opacity:1;border-color:#D4614A}.xc-ladder li.now i{background:#D4614A;color:#fff;animation:xcPulse 1.8s infinite}
.xc-card.exited .xc-ladder li{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)}.xc-card.exited .xc-ladder li span{color:#FBF4EE}.xc-card.exited .xc-ladder li small{color:rgba(251,244,238,.7)}
.xc-line{margin:0 0 8px;font-size:13.5px;font-weight:700;line-height:1.7;color:#2A1626}.xc-card.exited .xc-line{color:#FBF4EE}
.xc-link{background:none;border:0;color:#8E7F8A;font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline;text-underline-offset:3px;padding:0}
.xc-ask{margin-top:8px;padding:12px;border-radius:14px;background:#fff;border:1px solid #EADFD6;display:grid;gap:8px}.xc-ask b{font-size:13px;color:#3A1F36}
.xc-reasons{display:flex;flex-wrap:wrap;gap:6px}.xc-reasons button{border:1px solid #EADFD6;background:#FBF4EE;border-radius:999px;padding:4px 11px;font:inherit;font-size:12.5px;font-weight:700;color:#5C4858;cursor:pointer}.xc-reasons button.on{background:#3A1F36;color:#FBF4EE;border-color:#3A1F36}
.xc-ask textarea{border:1px solid #EADFD6;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;resize:vertical}
.xc-acts{display:flex;gap:8px;flex-wrap:wrap}.xc-btn{border:0;border-radius:999px;padding:9px 18px;font:inherit;font-weight:900;font-size:13px;cursor:pointer;background:#D9A866;color:#2A1626}.xc-btn.danger{background:#D4614A;color:#fff}.xc-btn.ghost{background:transparent;color:#5C4858;border:1px solid #EADFD6}.xc-btn:disabled{opacity:.6}
.xc-exit p{margin:0 0 6px;font-size:13px;line-height:1.7}.xc-exit a{color:#F1D9A8}
.xc-msg{margin:8px 0 0;font-size:13px;font-weight:800;color:#1F4F4A}.xc-card.exited .xc-msg{color:#F1D9A8}
@keyframes xcPulse{0%{box-shadow:0 0 0 0 rgba(212,97,74,.5)}100%{box-shadow:0 0 0 10px rgba(212,97,74,0)}}
@media(prefers-reduced-motion:reduce){.xc-ladder li.now i{animation:none}}
`;
