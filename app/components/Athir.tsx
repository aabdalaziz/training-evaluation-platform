'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// «أثير» — المدرب الرفيق العائم (P10): تحية مبادِرة، حوار نصي وصوتي (Web Speech API)، ذاكرة شفافة يملكها المتعلم، إجراءات سريعة
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { useLang } from './PortalShell';

type Msg = { role: 'athir' | 'me'; text: string; links?: { label: string; href: string }[]; source?: string };
type Hello = { greeting: string; nudge: string; actions: { label: string; href: string }[] };

const MicSvg = ({ on }: { on: boolean }) => (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={on ? '#c9a24b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" /></svg>);
const Orb = ({ size = 22, pulse = false }: { size?: number; pulse?: boolean }) => (<span className={`at-orb ${pulse ? 'pulse' : ''}`} style={{ width: size, height: size }} aria-hidden="true" />);

export default function Athir() {
  const { lang } = useLang(); const ar = lang === 'ar'; const pathname = usePathname() || '/';
  const [open, setOpen] = useState(false); const [hello, setHello] = useState<Hello | null>(null); const [peek, setPeek] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState(true); const [voice, setVoice] = useState(false); const [listening, setListening] = useState(false); const [canListen, setCanListen] = useState(false);
  const [memory, setMemory] = useState<{ summary: string; goals: string[] } | null>(null); const [showMem, setShowMem] = useState(false); const [goal, setGoal] = useState('');
  const listRef = useRef<HTMLDivElement>(null); const recRef = useRef<any>(null); const helloDone = useRef(false);
  const hidden = pathname.startsWith('/admin') || pathname.startsWith('/verify');

  const token = useCallback(async () => { try { const { data } = await supabase().auth.getSession(); return data.session?.access_token || ''; } catch { return ''; } }, []);
  const call = useCallback(async (body: any) => { const tk = await token(); const r = await fetch('/api/athir', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tk ? { Authorization: `Bearer ${tk}` } : {}) }, body: JSON.stringify({ ...body, page: pathname, lang, simple: /\bsimple\b|\bread_hard\b/.test(document.documentElement.getAttribute('data-access') || '') }) }); return r.json(); }, [token, pathname, lang]);

  // تحية مبادِرة مرة واحدة في الجلسة
  useEffect(() => {
    if (helloDone.current) return; helloDone.current = true;
    try { setVoice(localStorage.getItem('athir_voice') === '1'); } catch { /* ignore */ }
    setCanListen(typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    const t = setTimeout(async () => {
      try {
        const j = await call({ action: 'hello' }); if (!j?.success) return; setHello(j.hello); setGuest(!!j.guest); if (j.memory) setMemory({ summary: j.memory.summary || '', goals: j.memory.goals || [] });
        setMsgs([{ role: 'athir', text: `${j.hello.greeting} ${j.hello.nudge}`.trim(), links: j.hello.actions, source: j.source }]);
        let seen = false; try { seen = sessionStorage.getItem('athir_hello') === '1'; sessionStorage.setItem('athir_hello', '1'); } catch { /* ignore */ }
        if (!seen) { setPeek(true); setTimeout(() => setPeek(false), 9000); }
      } catch { /* صامت */ }
    }, 1800);
    return () => clearTimeout(t);
  }, [call]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [msgs, open]);

  const speak = useCallback((s: string) => { try { if (!voice || typeof window === 'undefined' || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(s.replace(/[*_#`]/g, '')); u.lang = ar ? 'ar-SA' : 'en-GB'; u.rate = 0.95; const v = window.speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith(ar ? 'ar' : 'en')); if (v) u.voice = v; window.speechSynthesis.speak(u); } catch { /* ignore */ } }, [voice, ar]);

  async function send(raw?: string) {
    const q = (raw ?? text).trim(); if (q.length < 2 || busy) return; setText(''); setOpen(true);
    const history = msgs.slice(-8).map(m => ({ role: m.role, text: m.text })); setMsgs(m => [...m, { role: 'me', text: q }]); setBusy(true);
    try {
      const j = await call({ action: 'chat', text: q, history });
      const reply: Msg = j?.success ? { role: 'athir', text: j.answer + (j.handoff ? (ar ? '\n\nسأحوّل سؤالك إلى مستشار بشري — اترك بريدك في صفحة التواصل أو عبر «مستشارك» في الصفحة الرئيسية.' : '\n\nI will hand this to a human advisor — leave your email on the contact page.') : ''), links: j.links, source: j.source } : { role: 'athir', text: j?.error || (ar ? 'تعذّر الرد الآن.' : 'Could not answer now.') };
      setMsgs(m => [...m, reply]); if (j?.goals) setMemory(mm => ({ summary: mm?.summary || '', goals: j.goals })); speak(reply.text);
    } catch { setMsgs(m => [...m, { role: 'athir', text: ar ? 'انقطع الاتصال لحظة — جرّب مرة أخرى.' : 'Connection hiccup — try again.' }]); }
    setBusy(false);
  }
  function listen() {
    try {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; if (!SR) return;
      if (listening) { recRef.current?.stop(); setListening(false); return; }
      const rec = new SR(); rec.lang = ar ? 'ar-SA' : 'en-GB'; rec.interimResults = true; rec.maxAlternatives = 1; recRef.current = rec; setListening(true); setOpen(true);
      let finalText = ''; rec.onresult = (e: any) => { let s = ''; for (let i = e.resultIndex; i < e.results.length; i++) { s += e.results[i][0].transcript; if (e.results[i].isFinal) finalText += e.results[i][0].transcript; } setText(finalText || s); };
      rec.onend = () => { setListening(false); if (finalText.trim().length > 1) send(finalText.trim()); }; rec.onerror = () => setListening(false); rec.start();
    } catch { setListening(false); }
  }
  const toggleVoice = () => { const v = !voice; setVoice(v); try { localStorage.setItem('athir_voice', v ? '1' : '0'); } catch { /* ignore */ } if (!guest) call({ action: 'prefs', prefs: { voice: v } }).catch(() => {}); if (v) setTimeout(() => speak(ar ? 'تم تفعيل الصوت. أنا أثير، أسمعك.' : 'Voice on. I am Athir.'), 50); };
  async function addGoal() { const g = goal.trim(); if (g.length < 3) return; const j = await call({ action: 'goal', text: g }); if (j?.success) { setMemory(m => ({ summary: m?.summary || '', goals: j.goals })); setGoal(''); setMsgs(m => [...m, { role: 'athir', text: ar ? `سجّلت هدفك: «${g}». سأبني عليه ما أقترحه لك من محاكيات وجلسات.` : `Goal saved: “${g}”.` }]); } }
  async function forget() { if (!confirm(ar ? 'سيمسح أثير كل ما يتذكره عنك (الأهداف والملخص). متابعة؟' : 'Erase everything Athir remembers about you?')) return; const j = await call({ action: 'forget' }); if (j?.success) { setMemory({ summary: '', goals: [] }); setMsgs(m => [...m, { role: 'athir', text: ar ? 'مسحت ذاكرتي عنك بالكامل. نبدأ صفحة جديدة متى شئت.' : 'Memory erased.' }]); } }
  const quick = guest ? [ar ? 'ما البرامج المفتوحة الآن؟' : 'Which programs are open?', ar ? 'كيف أثبت مهاراتي بشهادة؟' : 'How do I prove my skills?', ar ? 'أريد تدريبًا لجهتي' : 'Training for my organization'] : [ar ? 'ما أضعف مهارة عندي ولماذا؟' : 'What is my weakest skill?', ar ? 'اقترح لي خطوة واحدة اليوم' : 'Suggest one step today', ar ? 'جهّزني لجلستي القادمة' : 'Prep me for my next session'];

  if (hidden) return null;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!open && peek && hello && (
        <div className="at-peek" role="status" onClick={() => { setOpen(true); setPeek(false); }}>
          <Orb size={18} pulse /><div><b>{ar ? 'أثير' : 'Athir'}</b><span>{hello.nudge || hello.greeting}</span></div>
        </div>
      )}
      <button type="button" className={`at-fab ${open ? 'on' : ''}`} onClick={() => { setOpen(o => !o); setPeek(false); }} aria-label={ar ? 'أثير — المدرب الرفيق' : 'Athir — AI companion'} aria-expanded={open}>
        <Orb size={26} pulse={!open} /><span>{ar ? 'أثير' : 'Athir'}</span>
      </button>
      {open && (
        <section className="at-panel" aria-label="Athir" dir={ar ? 'rtl' : 'ltr'}>
          <header className="at-head">
            <Orb size={30} pulse={busy} /><div><b>{ar ? 'أثير' : 'Athir'}</b><small>{guest ? (ar ? 'رفيقك في أَثَر · سجّل الدخول ليتذكّرك' : 'Your Athar companion · sign in to be remembered') : (ar ? 'يتذكّر أهدافك · يقترح ولا يقرّر' : 'Remembers your goals · suggests, never decides')}</small></div>
            <div className="at-tools">
              <button type="button" className={`at-ic ${voice ? 'on' : ''}`} onClick={toggleVoice} title={ar ? 'الصوت' : 'Voice'} aria-pressed={voice}><Icon name={voice ? 'pause' : 'play'} size={16} /></button>
              {!guest && <button type="button" className={`at-ic ${showMem ? 'on' : ''}`} onClick={() => setShowMem(s => !s)} title={ar ? 'الذاكرة' : 'Memory'}><Icon name="shield" size={16} /></button>}
              <button type="button" className="at-ic" onClick={() => setOpen(false)} aria-label="close"><Icon name="x" size={16} /></button>
            </div>
          </header>
          {showMem && !guest && (
            <div className="at-mem">
              <b>{ar ? 'ما يتذكّره أثير عنك' : 'What Athir remembers'}</b>
              <p>{memory?.summary || (ar ? 'لا ملخص بعد — سيتكوّن من حواراتنا.' : 'No summary yet.')}</p>
              {!!memory?.goals?.length && <ul>{memory!.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>}
              <div className="at-goal"><input value={goal} onChange={e => setGoal(e.target.value)} placeholder={ar ? 'أضف هدفًا لهذا الشهر…' : 'Add a goal…'} maxLength={140} onKeyDown={e => { if (e.key === 'Enter') addGoal(); }} /><button type="button" className="pt-btn small" onClick={addGoal}>{ar ? 'حفظ' : 'Save'}</button></div>
              <button type="button" className="at-forget" onClick={forget}>{ar ? 'امسح ذاكرتي بالكامل' : 'Erase my memory'}</button>
            </div>
          )}
          <div className="at-list" ref={listRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`at-msg ${m.role}`}>
                <div className="at-bubble">{m.text}</div>
                {!!m.links?.length && <div className="at-links">{m.links.map((l, k) => <Link key={k} href={l.href} className="pt-btn light small" onClick={() => setOpen(false)}>{l.label}</Link>)}</div>}
              </div>
            ))}
            {busy && <div className="at-msg athir"><div className="at-bubble at-typing"><i /><i /><i /></div></div>}
          </div>
          <div className="at-quick">{quick.map(q => <button key={q} type="button" onClick={() => send(q)} disabled={busy}>{q}</button>)}</div>
          <form className="at-form" onSubmit={e => { e.preventDefault(); send(); }}>
            {canListen && <button type="button" className={`at-ic mic ${listening ? 'on' : ''}`} onClick={listen} title={ar ? 'تحدّث' : 'Speak'} aria-pressed={listening}><MicSvg on={listening} /></button>}
            <input value={text} onChange={e => setText(e.target.value)} placeholder={listening ? (ar ? 'أسمعك…' : 'Listening…') : (ar ? 'اكتب أو تحدّث إلى أثير…' : 'Write or talk to Athir…')} maxLength={600} disabled={busy} />
            <button type="submit" className="at-send" disabled={busy || text.trim().length < 2} aria-label="send"><Icon name="send" size={16} /></button>
          </form>
          <div className="at-foot">{ar ? 'أثير مساعد ذكاء اصطناعي: يقترح ويذكّر، والقرار والاعتماد للإنسان.' : 'Athir is an AI assistant: it suggests and reminds; humans decide and approve.'}</div>
        </section>
      )}
    </>
  );
}

const CSS = `
.at-orb{display:inline-block;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fff 0,#7fd7cf 25%,#0b8a83 60%,#0f2a4e 100%);box-shadow:0 0 0 3px rgba(11,138,131,.18),0 0 18px rgba(11,138,131,.45);flex:none}
.at-orb.pulse{animation:atPulse 2.4s ease-in-out infinite}@keyframes atPulse{0%,100%{box-shadow:0 0 0 3px rgba(11,138,131,.18),0 0 14px rgba(11,138,131,.35)}50%{box-shadow:0 0 0 7px rgba(201,162,75,.18),0 0 26px rgba(11,138,131,.6)}}
.at-fab{position:fixed;bottom:18px;inset-inline-start:18px;z-index:60;display:flex;align-items:center;gap:9px;padding:9px 16px 9px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:linear-gradient(135deg,#0f2a4e,#123b6b);color:#fff;font:inherit;font-weight:800;font-size:14px;cursor:pointer;box-shadow:0 10px 30px rgba(15,42,78,.35)}
.at-fab.on{background:#0b8a83}
.at-peek{position:fixed;bottom:76px;inset-inline-start:18px;z-index:60;max-width:320px;display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #cfe9e6;border-radius:16px;padding:12px 14px;box-shadow:0 14px 40px rgba(15,42,78,.22);cursor:pointer;animation:atIn .5s ease}
@keyframes atIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.at-peek b{display:block;color:#0b8a83;font-size:12px}.at-peek span{display:block;font-size:13.5px;line-height:1.6;color:#0f172a}
.at-panel{position:fixed;bottom:76px;inset-inline-start:18px;z-index:61;width:min(400px,calc(100vw - 36px));max-height:min(640px,calc(100vh - 100px));display:flex;flex-direction:column;background:#fff;border:1px solid #dbe3ee;border-radius:20px;box-shadow:0 24px 60px rgba(15,42,78,.3);overflow:hidden;animation:atIn .35s ease}
.at-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:linear-gradient(135deg,#0f2a4e,#0b3d66);color:#fff}.at-head b{display:block;font-size:15px}.at-head small{display:block;font-size:11.5px;opacity:.8}.at-head>div:nth-child(2){flex:1;min-width:0}
.at-tools{display:flex;gap:4px}.at-ic{width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.at-ic.on{background:#c9a24b;color:#0f2a4e;border-color:#c9a24b}
.at-mem{padding:10px 14px;background:#f3fbfa;border-bottom:1px solid #cfe9e6;font-size:13px}.at-mem b{color:#0b8a83;font-size:12.5px}.at-mem p{margin:4px 0;color:#334155;line-height:1.6}.at-mem ul{margin:4px 0;padding-inline-start:18px;color:#0f2a4e}
.at-goal{display:flex;gap:6px;margin-top:6px}.at-goal input{flex:1;border:1px solid #cbd5e1;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}.at-forget{margin-top:8px;background:none;border:0;color:#b91c1c;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline}
.at-list{flex:1;overflow:auto;padding:14px;display:grid;gap:10px;align-content:start;background:#f8fafc}
.at-msg{display:grid;gap:6px;justify-items:start}.at-msg.me{justify-items:end}.at-bubble{max-width:88%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.75;white-space:pre-wrap;background:#fff;border:1px solid #e2e8f0;color:#0f172a}.at-msg.me .at-bubble{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.at-links{display:flex;gap:6px;flex-wrap:wrap}.at-typing{display:flex;gap:4px;padding:12px 14px}.at-typing i{width:7px;height:7px;border-radius:50%;background:#0b8a83;animation:atDot 1s infinite}.at-typing i:nth-child(2){animation-delay:.15s}.at-typing i:nth-child(3){animation-delay:.3s}@keyframes atDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
.at-quick{display:flex;gap:6px;flex-wrap:wrap;padding:8px 12px 0;background:#fff}.at-quick button{border:1px solid #cfe9e6;background:#f3fbfa;color:#0b8a83;border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;cursor:pointer}.at-quick button:hover{background:#0b8a83;color:#fff}
.at-form{display:flex;gap:6px;padding:10px 12px;background:#fff}.at-form input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px}.at-form .at-ic{border-color:#cbd5e1;color:#0f2a4e;width:40px;height:40px}.at-form .at-ic.mic.on{background:#0f2a4e;color:#c9a24b;animation:atPulse 1.2s infinite}
.at-send{width:40px;height:40px;border-radius:12px;border:0;background:#0b8a83;color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.at-send:disabled{opacity:.5;cursor:default}
.at-foot{padding:6px 14px 10px;font-size:11px;color:#64748b;background:#fff;border-top:1px solid #f1f5f9}
@media print{.at-fab,.at-panel,.at-peek{display:none}}
`;
