'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/after — «الشهادة التي تكبر» في حسابي (P38 · متابعة أثر التدريب)
 *  لكل برنامج أتممته: ثلاث محطات (بعد شهر · بعد ثلاثة أشهر · بعد سنة). في نافذة المحطة أكتب بكلماتي «ما الذي فعلته بما تعلّمت؟»
 *  وأختار حالة واحدة بالكلمات — و«لم ينفعني» مرحَّب بها. ثم: شاهد يوقّع بجملة · إظهار الفصل في شهادتي الحيّة · وثيقة «أثر بعد» عند محطة السنة.
 *  #witness: دعوات الشهادة التي وصلتني من متدرّبين.
 *  P39 «أصوات حول الشهادة»: رسالة إلى نفسي بعد سنة (تُفتح فوق محطة السنة) · البرنامج يردّ (ورشة تطبيق) · قياسك في مِعيار — في Voices.tsx
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { P38_NAMES_AR, STATES, STATE_AR, STATE_EN, TEXT_MIN, TEXT_MAX, QUESTION_AR, HONESTY_AR, TAGLINE_AR, PHASE_AR } from '../../../lib/after/registry';
import type { AfterState } from '../../../lib/after/registry';
import { LetterBox, OfferBox, MeasureBox } from './Voices';
import { NeedFromStation } from '../../components/Needs';   // P44: من محطة «لم تسنح الفرصة/لم ينفعني» إلى حاجة معلَنة

const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium' }) : '—');

export default function MeAfterPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [open, setOpen] = useState<string>('');   // `${enrollment}:${station}`
  const [f, setF] = useState<{ state: AfterState | ''; text: string; may_publish: boolean }>({ state: '', text: '', may_publish: false });
  const [wit, setWit] = useState<Record<string, string>>({}); const [ans, setAns] = useState<Record<string, string>>({});
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const H = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }), [tok]);
  const load = useCallback(async () => { if (!tok) return; const j = await fetch('/api/after?mine=1', { headers: H(), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [tok, H]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d && window.location.hash === '#witness') document.getElementById('witness')?.scrollIntoView({ behavior: 'smooth' }); }, [d]);
  async function post(body: any) {
    setBusy(body.action); setErr(''); setOk('');
    try { const j = await fetch('/api/after', { method: 'POST', headers: H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); if (j.note_ar) setOk(j.note_ar); await load(); return j; } catch (e: any) { setErr(e.message || String(e)); return null; } finally { setBusy(''); }
  }
  if (tok === '') return <main className="pt-main oaf"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p>{ar ? 'سجّل الدخول لترى محطاتك. ' : 'Sign in to see your stations. '}<Link href="/login?next=/me/after" className="pt-btn">{ar ? 'دخول' : 'Sign in'}</Link></p></section></main>;
  if (!d) return <main className="pt-main oaf"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const items: any[] = d.items || []; const invites: any[] = d.invites || [];
  return <main className="pt-main oaf" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="oaf-h"><span className="pt-kicker"><Icon name="certificate" size={14} /> {ar ? P38_NAMES_AR.phase : 'The certificate that grows'}</span><h1>{ar ? P38_NAMES_AR.stations : 'My stations'}</h1>
      <p>{ar ? `${TAGLINE_AR} بعد شهر وثلاثة أشهر وسنة من كل برنامج أتممته تعود وتكتب — بكلماتك — ${QUESTION_AR} ${HONESTY_AR}` : 'A certificate is not sealed the day a program ends; it opens. At 30, 90 and 365 days you come back and write, in your own words, what you did with what you learned — including when it did not help.'}</p>
      {err && <p className="oaf-err" role="alert" data-testid="oaf-err">{err}</p>}{ok && <p className="oaf-ok" role="status" data-testid="oaf-ok">{ok}</p>}
      {d.fact_line_ar && <p className="oaf-fact" data-testid="oaf-fact"><Icon name="shield" size={13} /> {ar ? 'ما شهده أَثَر: ' : 'Athar witnessed: '}{d.fact_line_ar}</p>}
    </header>

    {items.length === 0 && <section className="pt-box" data-testid="oaf-empty"><p className="pt-muted">{ar ? 'لا برنامج أتممته بعد. حين ينتهي برنامج سجّلت فيه، تُفتح محطاته هنا وحدها.' : 'No completed program yet. Stations open here by themselves once a program you joined ends.'}</p><Link href="/programs" className="pt-btn ghost small">{ar ? 'البرامج' : 'Programs'}</Link></section>}

    {items.map(it => <section key={it.id} className="pt-box oaf-prog" data-testid="oaf-prog">
      <h2>{it.program_ar} <small className="pt-muted">{ar ? 'انتهى' : 'ended'} <bdi>{it.end_day}</bdi></small></h2>
      <LetterBox item={it} post={post} busy={busy} ar={ar} />
      <ol className="oaf-st" aria-label={ar ? 'المحطات' : 'Stations'}>
        {it.stations.map((s: any) => { const key = `${it.id}:${s.station}`; const r = s.row; const isOpen = open === key;
          return <li key={s.station} className={`oaf-s ${s.phase}`} data-testid={`oaf-st-${s.station}`} data-phase={s.phase}>
            <div className="oaf-shead"><b>{s.label_ar}</b><span className={`oaf-ph ${s.phase}`}>{PHASE_AR[s.phase as keyof typeof PHASE_AR]}</span><small className="pt-muted">{s.phase === 'future' ? `${ar ? 'تُفتح' : 'opens'} ${s.opens}` : s.phase === 'open' ? `${ar ? 'حتى' : 'until'} ${s.closes}` : s.phase === 'missed' ? `${s.opens} → ${s.closes}` : fmt(r?.written_at)}</small></div>
            {s.phase === 'written' && r && <div className="oaf-w">
              <p className="oaf-state" data-testid="oaf-state">{STATE_AR[r.state as AfterState]}</p><blockquote>{r.text_ar}</blockquote>
              {(r.state === 'no_chance' || r.state === 'not_useful') && <NeedFromStation stationId={r.id} text={r.text_ar} lang={lang} />}
              {r.witness_status === 'signed' && <p className="oaf-wit" data-testid="oaf-witnessed"><Icon name="check" size={13} /> {ar ? 'شهد' : 'Witnessed'}: «{r.witness_text}»</p>}
              {r.witness_status === 'invited' && <p className="pt-muted" data-testid="oaf-wit-invited">{ar ? `دُعي ${r.witness_email} شاهدًا — ينتظر` : `Witness invited: ${r.witness_email}`}</p>}
              {r.witness_status === 'declined' && <p className="pt-muted">{ar ? 'اعتذر الشاهد — يمكنك دعوة غيره' : 'Witness declined — invite someone else'}</p>}
              <div className="oaf-acts">
                {r.witness_status !== 'signed' && <form className="oaf-inl" onSubmit={e => { e.preventDefault(); post({ action: 'witness_invite', id: r.id, email: wit[key] || '' }); }}><label>{ar ? 'بريد الشاهد (مشرفك أو زميلك)' : 'Witness email'}<input type="email" value={wit[key] || ''} onChange={e => setWit(x => ({ ...x, [key]: e.target.value }))} data-testid="oaf-wit-email" /></label><button type="submit" className="pt-btn ghost small" disabled={busy === 'witness_invite'} data-testid="oaf-wit-invite">{ar ? (r.witness_status ? 'ادعُ شاهدًا آخر' : 'ادعُ شاهدًا') : 'Invite witness'}</button></form>}
                <label className="oaf-chk"><input type="checkbox" checked={!!r.shown_on_credential} onChange={e => post({ action: 'shown', id: r.id, shown: e.target.checked })} data-testid="oaf-shown" /> {ar ? 'أظهر هذا الفصل في شهادتي الحيّة' : 'Show this chapter on my living credential'}</label>
                {r.may_publish && <small className="pt-muted">{ar ? 'أذنت بنشره مجهولًا على صفحة البرنامج' : 'You allowed anonymous publication'}{r.published_at ? (ar ? ' — اعتمده الطاقم' : ' — published') : ''}</small>}
              </div>
            </div>}
            {s.phase === 'open' && !isOpen && <button type="button" className="pt-btn" onClick={() => { setOpen(key); setF({ state: '', text: '', may_publish: false }); }} data-testid="oaf-write">{ar ? 'اكتب هذه المحطة' : 'Write this station'}</button>}
            {s.phase === 'open' && isOpen && <form className="oaf-form" onSubmit={e => { e.preventDefault(); post({ action: 'write', enrollment_id: it.id, station: s.station, state: f.state, text_ar: f.text, may_publish: f.may_publish }).then(j => { if (j) setOpen(''); }); }} data-testid="oaf-form">
              <fieldset><legend>{ar ? 'بعد هذه المدة، أين صار ما تعلّمته؟' : 'Where is what you learned now?'}</legend>
                <div className="oaf-states" role="radiogroup">{STATES.map(st => <label key={st} className={f.state === st ? 'on' : ''}><input type="radio" name={`st-${key}`} value={st} checked={f.state === st} onChange={() => setF(x => ({ ...x, state: st }))} data-testid={`oaf-state-${st}`} /> {ar ? STATE_AR[st] : STATE_EN[st]}</label>)}</div>
              </fieldset>
              <label>{QUESTION_AR} <small className="pt-muted">({f.text.length}/{TEXT_MAX} · {ar ? `من ${TEXT_MIN} حرفًا` : `min ${TEXT_MIN}`})</small><textarea rows={5} maxLength={TEXT_MAX} value={f.text} onChange={e => setF(x => ({ ...x, text: e.target.value }))} placeholder={ar ? 'بكلماتك: موقف واحد حقيقي يكفي. لا تُذكر أسماء.' : 'In your words. No names.'} data-testid="oaf-text" required /></label>
              <label className="oaf-chk"><input type="checkbox" checked={f.may_publish} onChange={e => setF(x => ({ ...x, may_publish: e.target.checked }))} data-testid="oaf-may-publish" /> {ar ? 'يجوز نشر كلماتي مجهولةً على صفحة البرنامج (إن اختارها الطاقم، ومن بين خمسة فأكثر)' : 'My words may be published anonymously on the program page (staff-chosen, five or more)'}</label>
              <p className="pt-muted">{HONESTY_AR}</p>
              <div className="oaf-acts"><button type="submit" className="pt-btn" disabled={busy === 'write' || !f.state || f.text.trim().length < TEXT_MIN} data-testid="oaf-send">{ar ? 'احفظ المحطة — لا تُعدَّل بعدها' : 'Save — cannot be edited later'}</button><button type="button" className="pt-btn ghost" onClick={() => setOpen('')}>{ar ? 'ليس الآن' : 'Not now'}</button></div>
            </form>}
            {s.phase === 'missed' && <p className="pt-muted oaf-missed">{ar ? 'فاتت نافذتها — تبقى فارغة؛ هذا جزء من صدق الدفتر.' : 'Its window passed — it stays empty; that is part of the honesty.'}</p>}
          </li>; })}
      </ol>
      <OfferBox item={it} post={post} busy={busy} ar={ar} />
      <MeasureBox item={it} post={post} busy={busy} ar={ar} />
      <div className="oaf-doc" data-testid="oaf-doc">
        {it.doc ? <p><Icon name="shield" size={14} /> {ar ? 'وثيقة «أثر بعد»' : 'After document'}: <bdi>{it.doc.code}</bdi> · <a href={`/verify/vc?code=${encodeURIComponent(it.doc.code)}`} target="_blank" rel="noreferrer">{ar ? 'تحقّق' : 'Verify'}</a></p>
          : it.doc_eligible ? <button type="button" className="pt-btn light" onClick={() => post({ action: 'doc', enrollment_id: it.id })} disabled={busy === 'doc'} data-testid="oaf-doc-btn">{ar ? `أصدر وثيقة «${P38_NAMES_AR.doc}» (ATH-AF)` : 'Issue the ATH-AF document'}</button>
          : <small className="pt-muted">{ar ? `وثيقة «${P38_NAMES_AR.doc}»: ${it.doc_note_ar}` : it.doc_note_ar}</small>}
      </div>
    </section>)}

    <section className="pt-box oaf-inv" id="witness" data-testid="oaf-invites">
      <h2><Icon name="users" size={18} /> {ar ? 'دعوات الشهادة إليّ' : 'Witness invitations to me'} {invites.length ? <i>{invites.length}</i> : null}</h2>
      {invites.length === 0 && <p className="pt-muted">{ar ? 'حين يدعوك متدرّب شاهدًا على محطة كتبها، تراها هنا وحدها — لا محطاته الأخرى.' : 'When a learner invites you to witness a station, it appears here alone.'}</p>}
      {invites.map(i => <div key={i.id} className="oaf-invite" data-testid="oaf-invite">
        <p><b>{i.learner_ar}</b> · {i.program_ar} · {i.station_ar} · <span className="oaf-state">{i.state_ar}</span></p><blockquote>{i.text_ar}</blockquote>
        <label>{ar ? 'جملة شهادتك (ما رأيته أنت)' : 'Your one-sentence witness'}<input value={ans[i.id] || ''} onChange={e => setAns(x => ({ ...x, [i.id]: e.target.value }))} maxLength={300} data-testid="oaf-ans-text" /></label>
        <div className="oaf-acts"><button type="button" className="pt-btn" disabled={busy === 'witness_answer'} onClick={() => post({ action: 'witness_answer', id: i.id, accept: true, text_ar: ans[i.id] || '' })} data-testid="oaf-ans-sign">{ar ? 'أشهد وأوقّع' : 'Sign'}</button><button type="button" className="pt-btn ghost" disabled={busy === 'witness_answer'} onClick={() => post({ action: 'witness_answer', id: i.id, accept: false })} data-testid="oaf-ans-decline">{ar ? 'أعتذر' : 'Decline'}</button></div>
      </div>)}
    </section>
    <p className="pt-muted oaf-foot">{ar ? 'ما تكتبه هنا لك: خاص افتراضيًا، يظهر في شهادتك الحيّة بقرارك، ويُنشر مجهولًا على صفحة البرنامج بإذنك واعتماد إنسان ومن بين خمسة فأكثر. لا نجوم في أَثَر.' : 'Private by default; shown on your living credential by your decision; published anonymously only with your consent, a human approval, and five or more.'} <Link href="/me/data">{ar ? 'ذاكرتي' : 'My data'}</Link></p>
  </main>;
}
const CSS = `
.oaf{max-width:900px;margin:0 auto;padding:28px 18px 60px}.oaf-h h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}.oaf-h p{color:#334155;line-height:1.9;margin:0 0 10px;font-size:16px}
.oaf-err{color:#b91c1c;font-weight:800;margin:6px 0}.oaf-ok{color:#0b6f69;font-weight:800;margin:6px 0}.oaf-fact{color:#0f2a4e;font-weight:700;background:#f1f5f9;border-radius:10px;padding:8px 12px;display:inline-flex;gap:6px;align-items:center}
.oaf-prog{margin-top:16px}.oaf-prog h2{margin:0 0 12px;font-size:20px;color:#0f2a4e;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.oaf-prog h2 small{font-size:12px;font-weight:600}
.oaf-st{list-style:none;margin:0;padding:0;display:grid;gap:10px}.oaf-s{border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#fff}.oaf-s.open{border-color:#0b8a83;background:#f0fdfa}.oaf-s.written{border-color:#c9a24b}.oaf-s.missed{background:#f8fafc;border-style:dashed}
.oaf-shead{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.oaf-shead b{font-size:16px;color:#0f2a4e}.oaf-ph{font-size:11px;font-weight:800;border-radius:999px;padding:2px 10px;background:#e2e8f0;color:#334155}.oaf-ph.open{background:#0b8a83;color:#fff}.oaf-ph.written{background:#c9a24b;color:#1f2937}.oaf-ph.missed{background:#f1f5f9;color:#64748b}
.oaf-w{margin-top:8px}.oaf-state{display:inline-block;font-weight:900;color:#0f2a4e;background:#fef3c7;border-radius:8px;padding:2px 10px;margin:0 0 6px}.oaf-w blockquote,.oaf-invite blockquote{margin:6px 0;padding:8px 12px;border-inline-start:3px solid #c9a24b;color:#1f2937;line-height:1.9;background:#fffbeb;border-radius:8px}
.oaf-wit{color:#065f46;font-weight:700;display:flex;gap:6px;align-items:center}.oaf-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:8px}.oaf-inl{display:flex;gap:8px;align-items:end;flex-wrap:wrap}.oaf-inl label{display:grid;gap:4px;font-size:12px;color:#475569}
.oaf input,.oaf textarea{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;min-height:44px;width:100%;box-sizing:border-box}.oaf textarea{min-height:120px;line-height:1.8}.oaf input[type=checkbox],.oaf input[type=radio]{width:20px;height:20px;min-height:0;margin:0}
.oaf-chk{display:flex;gap:8px;align-items:center;font-size:14px;color:#1f2937;min-height:44px}.oaf-form{display:grid;gap:12px;margin-top:10px}.oaf-form fieldset{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.oaf-form legend{font-weight:800;color:#0f2a4e;padding:0 6px}
.oaf-states{display:flex;gap:8px;flex-wrap:wrap}.oaf-states label{display:flex;gap:6px;align-items:center;border:1.5px solid #cbd5e1;border-radius:999px;padding:8px 14px;cursor:pointer;min-height:44px;font-weight:700}.oaf-states label.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.oaf-form>label{display:grid;gap:6px;font-weight:700;color:#0f2a4e}.oaf-missed{margin:6px 0 0;font-size:13px}.oaf-doc{margin-top:12px;padding-top:10px;border-top:1px dashed #e2e8f0}.oaf-doc p{margin:0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.oaf-inv{margin-top:18px}.oaf-inv h2{margin:0 0 8px;font-size:18px;color:#0f2a4e;display:flex;gap:8px;align-items:center}.oaf-inv h2 i{font-style:normal;background:#c9a24b;color:#1f2937;border-radius:999px;padding:0 8px;font-size:12px}.oaf-invite{border:1.5px solid #e2e8f0;border-radius:14px;padding:12px;margin-top:8px;display:grid;gap:6px}.oaf-invite label{display:grid;gap:4px;font-size:13px;color:#475569}
.oaf-foot{margin-top:14px;font-size:13px;line-height:1.8}
.oaf :focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.oaf *{transition:none!important}}
`;
