'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — مشغّل المحاكاة (P10): حوار مع شخصية يحرّكها الذكاء الاصطناعي (نص + صوت)، مؤقّت، تقييم بمعيار معلن، مسار الخبير، وحالة الاعتماد البشري
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { AUDIENCE_LABEL, SIM_STATUS_LABEL, DEMO_SCENARIO, bandLabel, learnerTurns } from '../../../lib/portal/sim';
import type { Scenario, Turn, SimScore, SimRun } from '../../../lib/portal/sim';

export default function SimPlayerPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const params = useParams<{ id: string }>(); const key = String(params?.id || ''); const sp = useSearchParams(); const reviewId = sp?.get('run') || '';
  const db = useMemo(() => supabase(), []); const [tok, setTok] = useState(''); const [s, setS] = useState<Scenario | null>(null); const [missing, setMissing] = useState(false);
  const [run, setRun] = useState<{ id: string; status: SimRun['status']; stateless?: boolean } | null>(null); const [turns, setTurns] = useState<Turn[]>([]); const [score, setScore] = useState<SimScore | null>(null); const [scoreSrc, setScoreSrc] = useState('');
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [startedAt, setStartedAt] = useState<number | null>(null); const [now, setNow] = useState(Date.now());
  const [voice, setVoice] = useState(false); const [listening, setListening] = useState(false); const [canListen, setCanListen] = useState(false); const recRef = useRef<any>(null); const listRef = useRef<HTMLDivElement>(null);
  const hdr = () => ({ 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setTok(tk);
        setCanListen(typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)); try { setVoice(localStorage.getItem('athir_voice') === '1'); } catch { /* ignore */ }
        if (reviewId && tk) { const j = await fetch(`/api/sim?run=${encodeURIComponent(reviewId)}`, { headers: { Authorization: `Bearer ${tk}` } }).then(r => r.json()); if (j?.success) { setS(j.scenario || DEMO_SCENARIO); setRun({ id: j.run.id, status: j.run.status }); setTurns(j.run.turns || []); setScore(j.run.score || null); setScoreSrc(j.run.source || ''); return; } }
        const j = await fetch('/api/sim').then(r => r.json()); const found = (j?.scenarios || []).find((x: Scenario) => x.slug === key || x.id === key) || (key === 'demo' || key === DEMO_SCENARIO.slug ? DEMO_SCENARIO : null);
        if (found) setS(found); else setMissing(true);
      } catch { setMissing(true); }
    })();
  }, [db, key, reviewId]);
  useEffect(() => { if (!startedAt || score) return; const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, [startedAt, score]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [turns, score, busy]);

  const speak = (txt: string) => { try { if (!voice || !s || typeof window === 'undefined' || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(txt); u.lang = 'ar-SA'; u.rate = s.persona.voice === 'child' ? 1.05 : 0.95; u.pitch = s.persona.voice === 'child' ? 1.5 : 1; const v = window.speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith('ar')); if (v) u.voice = v; window.speechSynthesis.speak(u); } catch { /* ignore */ } };
  async function start() {
    if (!s) return; setErr(''); setScore(null); setBusy(true);
    try { const j = await fetch('/api/sim', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'start', scenario: s.slug }) }).then(r => r.json()); if (j?.success) { setRun({ id: j.run.id, status: 'running', stateless: !!j.stateless }); setTurns(j.run.turns); setStartedAt(Date.now()); speak(j.run.turns[0]?.text || ''); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
    setBusy(false);
  }
  async function send(raw?: string) {
    const v = (raw ?? text).trim(); if (!s || !run || v.length < 2 || busy) return; setText(''); setErr(''); setBusy(true); const mine: Turn[] = [...turns, { role: 'learner', text: v, at: new Date().toISOString() }]; setTurns(mine);
    try { const j = await fetch('/api/sim', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'turn', scenario: s.slug, run_id: run.id, turns, text: v }) }).then(r => r.json()); if (j?.success) { setTurns(j.turns); speak(j.reply); if (j.finished) { setScore(j.score); setScoreSrc(j.score_source || ''); setRun(r => r ? { ...r, status: 'scored' } : r); } } else { setErr(j?.error || 'x'); setTurns(turns); } } catch { setErr('x'); setTurns(turns); }
    setBusy(false);
  }
  async function finish() {
    if (!s || !run || busy) return; setBusy(true); setErr('');
    try { const j = await fetch('/api/sim', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'finish', scenario: s.slug, run_id: run.id, turns }) }).then(r => r.json()); if (j?.success) { setScore(j.score); setScoreSrc(j.score_source || ''); setRun(r => r ? { ...r, status: 'scored' } : r); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
    setBusy(false);
  }
  function listen() {
    try { const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SR) return; if (listening) { recRef.current?.stop(); setListening(false); return; }
      const rec = new SR(); rec.lang = 'ar-SA'; rec.interimResults = true; recRef.current = rec; setListening(true); let fin = '';
      rec.onresult = (e: any) => { let st = ''; for (let i = e.resultIndex; i < e.results.length; i++) { st += e.results[i][0].transcript; if (e.results[i].isFinal) fin += e.results[i][0].transcript; } setText(fin || st); };
      rec.onend = () => { setListening(false); if (fin.trim().length > 1) send(fin.trim()); }; rec.onerror = () => setListening(false); rec.start(); } catch { setListening(false); }
  }
  const toggleVoice = () => { const v = !voice; setVoice(v); try { localStorage.setItem('athir_voice', v ? '1' : '0'); } catch { /* ignore */ } };

  if (missing) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty"><p>{ar ? 'السيناريو غير موجود.' : 'Scenario not found.'}</p><Link href="/sim" className="pt-btn">{ar ? 'كل المحاكيات' : 'All simulators'}</Link></div></section></main>;
  if (!s) return <main className="pt-main"><section className="pt-sec"><div className="pt-wrap pt-empty">…</div></section></main>;
  const n = learnerTurns(turns); const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0; const over = elapsed > s.minutes * 60; const reviewing = !!reviewId && !!run && run.status !== 'running';
  return (
    <main className="pt-main">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="pt-pagehead sp-head">
        <div className="pt-wrap sp-headgrid">
          <div>
            <Link href="/sim" className="sp-back"><Icon name="arrow" size={14} /> {ar ? 'كل المحاكيات' : 'All simulators'}</Link>
            <span className="pt-kicker">{ar ? AUDIENCE_LABEL[s.audience].ar : AUDIENCE_LABEL[s.audience].en}{s.level ? ` · ${s.level}` : ''}</span>
            <h1>{(lang === 'en' && s.title_en) || s.title_ar}</h1>
            <p><b>{ar ? 'الموقف:' : 'Situation:'}</b> {s.situation_ar}</p>
            <p><b>{ar ? 'هدفك:' : 'Goal:'}</b> {s.goal_ar}</p>
          </div>
          <aside className="sp-persona">
            <i className={s.persona.voice === 'child' ? 'child' : ''}>{s.persona.name.slice(0, 1)}</i>
            <b>{s.persona.name}</b><small>{s.persona.role}</small>
            <div className="sp-traits">{s.persona.traits.map(tr => <span key={tr}>{tr}</span>)}</div>
            <div className="sp-rubric"><small>{ar ? 'معيار التقييم' : 'Rubric'}</small>{s.rubric.map(r => <div key={r.key} title={r.desc_ar}><span>{r.title_ar}</span><b>{r.weight}%</b></div>)}</div>
          </aside>
        </div>
      </section>
      <section className="pt-sec">
        <div className="pt-wrap sp-grid">
          <div className="sp-box">
            <div className="sp-bar">
              <div className="sp-steps">{Array.from({ length: s.max_turns }).map((_, k) => <i key={k} className={k < n ? 'done' : k === n && run && !score ? 'cur' : ''} />)}<span>{n}/{s.max_turns} {ar ? 'أدوار' : 'turns'}</span></div>
              <div className="sp-tools">{startedAt && !score && <span className={`sp-timer ${over ? 'over' : ''}`}><Icon name="clock" size={13} /> {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')} / {s.minutes}:00</span>}<button type="button" className={`sp-ic ${voice ? 'on' : ''}`} onClick={toggleVoice} title={ar ? 'صوت الشخصية' : 'Persona voice'} aria-pressed={voice}><Icon name={voice ? 'pause' : 'play'} size={15} /></button></div>
            </div>
            {!run && (
              <div className="sp-intro">
                <p>{ar ? `ستتحدث مع ${s.persona.name} في ${s.max_turns} أدوار كحد أقصى خلال ${s.minutes} دقائق. اكتب أو تحدّث كما لو كنت في الموقف فعلًا — لا توجد إجابة نموذجية واحدة، بل معيار معلن أعلاه.` : `You will talk to ${s.persona.name} for up to ${s.max_turns} turns in ${s.minutes} minutes. Write or speak as if you were really there — there is no single model answer, only the published rubric.`}</p>
                {!tok && <p className="sp-note">{s.demo ? (ar ? 'يمكنك التجربة بلا تسجيل؛ لن تُحفظ النتيجة. سجّل الدخول لتتحول إلى دليل في ملفك المهاري.' : 'You can try without signing in; the result will not be saved.') : (ar ? 'هذا السيناريو يتطلب تسجيل الدخول.' : 'This scenario requires sign‑in.')}</p>}
                <div className="pt-chips"><button type="button" className="pt-btn gold" onClick={start} disabled={busy || (!tok && !s.demo)}><Icon name="play" size={15} /> {ar ? 'ابدأ الآن' : 'Start now'}</button>{!tok && <Link href="/me" className="pt-btn light">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link>}</div>
              </div>
            )}
            {run && (
              <>
                <div className="sp-list" ref={listRef}>
                  {turns.map((tn, k) => <div key={k} className={`sp-turn ${tn.role}`}><small>{tn.role === 'persona' ? s.persona.name : (ar ? 'أنت' : 'You')}</small><div>{tn.text}</div></div>)}
                  {busy && !score && <div className="sp-turn persona"><small>{s.persona.name}</small><div className="sp-typing"><i /><i /><i /></div></div>}
                </div>
                {!score && !reviewing && (
                  <form className="sp-form" onSubmit={e => { e.preventDefault(); send(); }}>
                    {canListen && <button type="button" className={`sp-ic mic ${listening ? 'on' : ''}`} onClick={listen} title={ar ? 'تحدّث' : 'Speak'}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg></button>}
                    <input value={text} onChange={e => setText(e.target.value)} placeholder={listening ? (ar ? 'أسمعك…' : 'Listening…') : (ar ? `ردّك على ${s.persona.name}…` : 'Your reply…')} maxLength={600} disabled={busy} autoFocus />
                    <button type="submit" className="pt-btn gold" disabled={busy || text.trim().length < 2}><Icon name="send" size={15} /></button>
                    {n >= 1 && <button type="button" className="pt-btn outline small sp-finish" onClick={finish} disabled={busy}>{ar ? 'أنهِ وقيّم' : 'Finish & score'}</button>}
                  </form>
                )}
                {err && <div className="sp-err">{err === 'x' ? (ar ? 'تعذّر الاتصال.' : 'Connection failed.') : err}</div>}
              </>
            )}
          </div>
          <aside className="sp-side">
            {!score && <div className="sp-tip"><b>{ar ? 'تلميح الخبير' : 'Expert hint'}</b><p>{ar ? 'ابدأ بما يشعر به الطرف الآخر قبل ما تريد قوله أنت. ثم إجراء واحد ملموس. ثم تحقّق.' : 'Start with what the other person feels before what you want to say. Then one concrete action. Then check.'}</p><small>{ar ? 'الشخصية يحرّكها الذكاء الاصطناعي وتستجيب لما تفعله فعلًا؛ المجاملات لا ترفع الدرجة.' : 'The persona is AI‑driven and reacts to what you actually do; flattery does not raise the score.'}</small></div>}
            {score && (
              <div className="sp-score">
                <div className="sp-scorehead"><b>{score.total}<small>/100</small></b><div><span>{bandLabel(score.total, lang)}</span><small className={`sp-st ${run?.status || 'scored'}`}>{run?.stateless ? (ar ? 'تجربة بلا حفظ' : 'Unsaved trial') : (ar ? SIM_STATUS_LABEL[run?.status || 'scored'].ar : SIM_STATUS_LABEL[run?.status || 'scored'].en)}</small></div></div>
                <div className="sp-crit">{score.criteria.map(c => { const r = s.rubric.find(x => x.key === c.key); return <div key={c.key}><div className="sp-critrow"><span>{r?.title_ar || c.key} <em>{r?.weight}%</em></span><b>{c.score}</b></div><i><b style={{ width: `${c.score}%` }} /></i>{c.note && <small>{c.note}</small>}</div>; })}</div>
                {!!score.strengths.length && <div className="sp-list2 ok"><b>{ar ? 'ما أجدت فيه' : 'Strengths'}</b><ul>{score.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                {!!score.improve.length && <div className="sp-list2 imp"><b>{ar ? 'لتتحسن' : 'To improve'}</b><ul>{score.improve.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
                {score.expert_path && <div className="sp-expert"><b>{ar ? 'كيف كان سيتصرف خبير' : 'How an expert would act'}</b><p>{score.expert_path}</p></div>}
                {score.closing_ar && <p className="sp-closing">{score.closing_ar}</p>}
                <small className="sp-src">{scoreSrc === 'ai' ? (ar ? 'تقييم أولي بالذكاء الاصطناعي وفق المعيار' : 'Preliminary AI score against the rubric') : (ar ? 'تقدير محلي أولي' : 'Preliminary local estimate')} · {ar ? 'يعتمده مدرب بشري قبل أن يصبح دليلًا كامل الوزن' : 'A human trainer approves it before it becomes full‑weight evidence'}</small>
                <div className="pt-chips">{tok && !run?.stateless && <Link href="/me/skills" className="pt-btn small">{ar ? 'ملفي المهاري' : 'My skills'}</Link>}{!tok && <Link href="/me" className="pt-btn gold small">{ar ? 'سجّل الدخول لحفظ الدليل' : 'Sign in to save'}</Link>}<button type="button" className="pt-btn light small" onClick={() => { setRun(null); setTurns([]); setScore(null); setStartedAt(null); }}>{ar ? 'أعد المحاولة' : 'Try again'}</button><Link href="/sim" className="pt-btn outline small">{ar ? 'سيناريو آخر' : 'Another scenario'}</Link></div>
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

const CSS = `
.sp-head .pt-kicker{color:#c9a24b}.sp-headgrid{display:grid;grid-template-columns:1.3fr .7fr;gap:28px;align-items:start}.sp-head h1{font-size:30px}.sp-head p{margin:0 0 6px;font-size:14.5px;line-height:1.85;color:rgba(255,255,255,.9)}.sp-head p b{color:#c9a24b}
.sp-back{display:inline-flex;gap:4px;align-items:center;color:rgba(255,255,255,.75);text-decoration:none;font-size:12.5px;margin-bottom:8px}.sp-back:hover{color:#fff}
.sp-persona{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:18px;display:grid;gap:4px;justify-items:center;text-align:center}.sp-persona i{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#0b8a83,#0f2a4e);border:3px solid #c9a24b;color:#fff;font-style:normal;font-weight:900;font-size:26px;display:inline-flex;align-items:center;justify-content:center}.sp-persona i.child{background:linear-gradient(135deg,#c9a24b,#e2c37a);color:#0f2a4e}.sp-persona b{font-size:17px;margin-top:4px}.sp-persona>small{font-size:12px;opacity:.85;line-height:1.5}
.sp-traits{display:flex;gap:4px;flex-wrap:wrap;justify-content:center;margin-top:6px}.sp-traits span{font-size:11px;background:rgba(255,255,255,.14);border-radius:999px;padding:3px 9px}
.sp-rubric{width:100%;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(255,255,255,.2);display:grid;gap:4px;text-align:start}.sp-rubric>small{font-size:11px;color:#c9a24b;font-weight:900}.sp-rubric div{display:flex;justify-content:space-between;font-size:12.5px}.sp-rubric div b{color:#c9a24b}
.sp-grid{display:grid;grid-template-columns:1.25fr .75fr;gap:20px;align-items:start}
.sp-box{background:#fff;border:1px solid #e2e8f0;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;min-height:520px}
.sp-bar{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc}.sp-steps{display:flex;gap:5px;align-items:center}.sp-steps i{width:22px;height:8px;border-radius:4px;background:#e2e8f0}.sp-steps i.done{background:#0b8a83}.sp-steps i.cur{background:#c9a24b;animation:spBlink 1.2s infinite}@keyframes spBlink{50%{opacity:.4}}.sp-steps span{font-size:12px;color:#64748b;margin-inline-start:6px}
.sp-tools{display:flex;gap:8px;align-items:center}.sp-timer{display:inline-flex;gap:4px;align-items:center;font-size:12.5px;font-weight:800;color:#0f2a4e;font-variant-numeric:tabular-nums}.sp-timer.over{color:#b91c1c}
.sp-ic{width:34px;height:34px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#0f2a4e;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.sp-ic.on{background:#0f2a4e;color:#c9a24b;border-color:#0f2a4e}.sp-ic.mic.on{animation:spBlink 1s infinite}
.sp-intro{padding:26px;display:grid;gap:12px;font-size:15px;line-height:1.9;color:#1e293b}.sp-intro p{margin:0}.sp-note{font-size:13px;color:#9a6b00;background:#fdf6e3;border-radius:10px;padding:8px 12px}
.sp-list{flex:1;overflow:auto;max-height:520px;padding:18px;display:grid;gap:12px;align-content:start;background:#f8fafc}.sp-turn{display:grid;gap:3px;justify-items:start;max-width:88%}.sp-turn.learner{justify-self:end;justify-items:end}.sp-turn small{font-size:11px;color:#64748b;font-weight:800}.sp-turn>div{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:10px 14px;font-size:15px;line-height:1.8;color:#0f172a}.sp-turn.learner>div{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.sp-typing{display:flex;gap:4px;padding:12px 14px}.sp-typing i{width:7px;height:7px;border-radius:50%;background:#0b8a83;animation:spDot 1s infinite}.sp-typing i:nth-child(2){animation-delay:.15s}.sp-typing i:nth-child(3){animation-delay:.3s}@keyframes spDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
.sp-form{display:flex;gap:8px;align-items:center;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fff;flex-wrap:wrap}.sp-form input{flex:1;min-width:200px;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font:inherit;font-size:15px}.sp-finish{margin-inline-start:auto}.sp-err{padding:8px 16px;color:#b91c1c;font-size:13px}
.sp-side{display:grid;gap:12px}.sp-tip{background:#fdf6e3;border:1px solid #f1dfae;border-radius:18px;padding:18px}.sp-tip b{color:#9a6b00}.sp-tip p{margin:6px 0;font-size:14px;line-height:1.8;color:#0f172a}.sp-tip small{font-size:12px;color:#7c5a00;line-height:1.6;display:block}
.sp-score{background:#fff;border:1px solid #cfe9e6;border-radius:20px;padding:20px;display:grid;gap:14px;animation:spIn .5s ease}@keyframes spIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.sp-scorehead{display:flex;gap:14px;align-items:center}.sp-scorehead>b{font-size:46px;font-weight:900;color:#0b8a83;line-height:1}.sp-scorehead>b small{font-size:15px;color:#94a3b8}.sp-scorehead span{display:block;font-weight:900;color:#0f2a4e;font-size:16px}
.sp-st{display:inline-block;margin-top:4px;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;background:#fdf6e3;color:#9a6b00}.sp-st.approved{background:#e6f4f1;color:#0b8a83}.sp-st.rejected{background:#fee2e2;color:#b91c1c}
.sp-crit{display:grid;gap:10px}.sp-critrow{display:flex;justify-content:space-between;font-size:13.5px;color:#0f2a4e;font-weight:800}.sp-critrow em{font-style:normal;color:#94a3b8;font-weight:600;font-size:11.5px}.sp-crit i{display:block;height:9px;border-radius:5px;background:#e2e8f0;overflow:hidden;margin:4px 0}.sp-crit i b{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b);border-radius:5px;transition:width 1s ease}.sp-crit small{font-size:12px;color:#475569;line-height:1.6;display:block}
.sp-list2 b{font-size:13px}.sp-list2.ok b{color:#0b8a83}.sp-list2.imp b{color:#9a6b00}.sp-list2 ul{margin:4px 0 0;padding-inline-start:18px;font-size:13.5px;line-height:1.75;color:#1e293b}
.sp-expert{background:#f3fbfa;border-radius:12px;padding:12px 14px}.sp-expert b{font-size:13px;color:#0b8a83}.sp-expert p{margin:4px 0 0;font-size:13.5px;line-height:1.8;color:#0f172a}.sp-closing{margin:0;font-size:14px;color:#0f2a4e;font-weight:700}.sp-src{font-size:11.5px;color:#64748b;line-height:1.6}
@media (max-width:900px){.sp-headgrid,.sp-grid{grid-template-columns:1fr}}
`;
