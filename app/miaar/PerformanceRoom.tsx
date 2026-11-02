'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* مِعيار — م4-ب «غرفة الأداء» (تُحمَّل عند الحاجة فقط — ميزانية P40):
   الكتابة: محرّر بعدّاد كلمات ومؤقّت وحفظ تلقائي للمسودّة كل 20 ث · التحدّث: تحضير مؤقّت ثم تسجيل MediaRecorder (≤ 90 ث) مع إعادة واحدة واستماع قبل الإرسال.
   «أَثَر للجميع»: بديل كتابي للتحدّث وبديل صوتي للكتابة (تيسير مُعلَن في البطاقة) · كل مهمة يمكن تخطّيها بصدق («لم تُقدَّم»).
   موافقة الذكاء الاصطناعي افتراضيًا مُطفأة — وحتى مع تفعيلها لا تُنشر درجة قبل اعتماد إنسان. أثناء المؤقّت يُقفل «الطريق» حتى لا يغادر المتقدّم سهوًا. */
import { useEffect, useRef, useState } from 'react';
import { setWayLock } from '../components/WayBar';

type Task = { code: string; level: string; skill: 'writing' | 'speaking'; prompt: string; prompt_en: string | null; tips_ar: string[]; genre: string; media: string | null; mediaAlt: string | null; min_words?: number; max_words?: number; time_seconds?: number; min_seconds?: number; max_seconds?: number; prep_seconds?: number; retakes?: number };
export type RoomData = { tasks: Task[]; level: string; drafts: Record<string, string>; done: string[]; skipped: string[] };
type Props = { room: RoomData; lang: string; post: (body: any) => Promise<any>; onUpdate: (productive: any, room: RoomData) => void; onExit: () => void };

const S = {
  ar: { title: 'غرفة الأداء', sub: 'مهمّتان قصيرتان بمستواك — يقرؤهما ويسمعهما إنسان', writing: 'الكتابة', speaking: 'التحدّث', level: 'مستوى المهمة', words: 'كلمة', wordsRange: 'المطلوب {a}–{b} كلمة', timeLeft: 'الوقت المتبقي', start: 'ابدأ', submit: 'أرسل', skip: 'تخطَّ هذه المهمة', skipped: 'لم تُقدَّم', done: 'تم الإرسال — قيد التصحيح', back: 'عودة إلى البطاقة',
    tips: 'إرشادات', prep: 'وقت التحضير', record: 'ابدأ التسجيل', stop: 'أوقف التسجيل', retake: 'أعد التسجيل (مرة واحدة)', listen: 'استمع لتسجيلك', secRange: 'المطلوب {a}–{b} ثانية', noMic: 'لم يُسمح بالميكروفون أو غير متاح — يمكنك الكتابة بدلًا من التحدّث (تيسير)', typedInstead: 'أكتب بدل أن أتحدّث (تيسير)', spokenInstead: 'أتحدّث بدل أن أكتب (تيسير)',
    consent: 'أسمح بأن يساعد الذكاء الاصطناعي المصحّح باقتراح أولي (لا يرى اسمي، والقرار للإنسان دائمًا)', privacy: 'يُحفظ تسجيلك في مخزن خاص 180 يومًا ثم يُحذف. لا يُنشر شيء قبل اعتماد مصحّح.', promise: 'تكتمل بطاقتك على الرمز نفسه خلال 48 ساعة.',
    draftSaved: 'حُفظت المسودّة', tooShort: 'قصير — واصل قليلًا', tooLong: 'تجاوزت الحد — اختصر', errNet: 'تعذّر الإرسال — حاول مرة أخرى', confirmSkip: 'تخطّي المهمة؟ ستظهر في بطاقتك «لم تُقدَّم».', recording: 'يسجّل…', seconds: 'ث', sent: 'أُرسل', autoStop: 'توقّف التسجيل تلقائيًا عند السقف', all: 'اكتملت الغرفة — شكرًا لك' },
  en: { title: 'Performance room', sub: 'Two short tasks at your level — read and heard by a human', writing: 'Writing', speaking: 'Speaking', level: 'Task level', words: 'words', wordsRange: 'Aim for {a}–{b} words', timeLeft: 'Time left', start: 'Start', submit: 'Submit', skip: 'Skip this task', skipped: 'Not submitted', done: 'Submitted — being rated', back: 'Back to the card',
    tips: 'Tips', prep: 'Preparation time', record: 'Start recording', stop: 'Stop recording', retake: 'Record again (once)', listen: 'Listen to your recording', secRange: 'Aim for {a}–{b} seconds', noMic: 'Microphone not allowed/available — you can type instead (accommodation)', typedInstead: 'Type instead of speaking (accommodation)', spokenInstead: 'Speak instead of writing (accommodation)',
    consent: 'Let AI give the rater a first suggestion (it never sees my name; a human always decides)', privacy: 'Your recording is kept privately for 180 days, then deleted. Nothing is published before a rater approves.', promise: 'Your card completes on the same code within 48 hours.',
    draftSaved: 'Draft saved', tooShort: 'Short — keep going', tooLong: 'Over the limit — shorten', errNet: 'Could not submit — try again', confirmSkip: 'Skip this task? Your card will show “Not submitted”.', recording: 'Recording…', seconds: 's', sent: 'Sent', autoStop: 'Recording stopped at the limit', all: 'Room complete — thank you' },
};
const fmt = (s: string, v: Record<string, unknown>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));
const clock = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const countWords = (t: string) => (t.replace(/[\u064B-\u0652\u0640]/g, '').match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || []).length;

export default function PerformanceRoom({ room, lang, post, onUpdate, onExit }: Props) {
  const L = lang === 'ar' ? S.ar : S.en; const ar = lang === 'ar';
  const [cur, setCur] = useState<number>(() => Math.max(0, room.tasks.findIndex((t) => !room.done.includes(t.skill) && !room.skipped.includes(t.skill))));
  const [state, setState] = useState<RoomData>(room); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [consent, setConsent] = useState(false);
  const task = state.tasks[cur]; const finished = state.tasks.every((t) => state.done.includes(t.skill) || state.skipped.includes(t.skill));
  useEffect(() => () => setWayLock(false), []);
  const apply = (r: any) => { if (r?.room) { setState(r.room); onUpdate(r.productive ?? null, r.room); } };
  const skip = async () => { if (!task) return; if (!window.confirm(L.confirmSkip)) return; setBusy(true); const r = await post({ action: 'room_skip', skill: task.skill }); setBusy(false); if (r?.ok) { apply(r); setWayLock(false); } else setMsg(L.errNet); };
  const goNext = () => { const i = state.tasks.findIndex((t, k) => k !== cur && !state.done.includes(t.skill) && !state.skipped.includes(t.skill)); if (i >= 0) setCur(i); };
  useEffect(() => { if (task && (state.done.includes(task.skill) || state.skipped.includes(task.skill))) goNext(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [state]);

  return <section className="mi-room" data-testid="mi-room" dir={ar ? 'rtl' : 'ltr'}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="rm-head"><div><p className="mi-kicker gold">{L.title}</p><h2>{L.sub}</h2></div><button type="button" className="mi-defer" onClick={onExit} data-testid="room-exit">{L.back}</button></header>
    <ol className="rm-steps" aria-label={L.title}>{state.tasks.map((t, i) => { const st = state.done.includes(t.skill) ? 'done' : state.skipped.includes(t.skill) ? 'skipped' : i === cur ? 'now' : ''; return <li key={t.skill} className={st} data-testid={`room-step-${t.skill}`}><button type="button" onClick={() => setCur(i)} disabled={busy}><b>{i + 1}</b>{L[t.skill]}<small>{st === 'done' ? L.done : st === 'skipped' ? L.skipped : `${L.level} ${t.level === 'PRE_A1' ? (ar ? 'ما قبل A1' : 'Pre-A1') : t.level}`}</small></button></li>; })}</ol>
    {finished && <div className="mi-rec teal" data-testid="room-complete"><span>{L.all}</span><p>{L.promise}</p><button type="button" className="mi-next" onClick={onExit}>{L.back}</button></div>}
    {!finished && task && !state.done.includes(task.skill) && !state.skipped.includes(task.skill) && (task.skill === 'writing'
      ? <WritingTask key={task.code} task={task} L={L} ar={ar} draft={state.drafts?.writing || ''} consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} post={post} apply={apply} skip={skip} setMsg={setMsg} />
      : <SpeakingTask key={task.code} task={task} L={L} ar={ar} consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} post={post} apply={apply} skip={skip} setMsg={setMsg} />)}
    {msg && <p className="rm-msg" role="status" data-testid="room-msg">{msg}</p>}
    <p className="mi-note rm-priv">{L.privacy} {L.promise}</p>
  </section>;
}

function TaskCard({ task, L, ar, children }: { task: Task; L: typeof S.ar; ar: boolean; children: React.ReactNode }) {
  return <article className="rm-card">
    <div className="mi-tags"><span className={`mi-skilltag ${task.skill === 'writing' ? 'write' : 'speak'}`}>{L[task.skill]}</span><span className="mi-lvltag">{task.level === 'PRE_A1' ? (ar ? 'ما قبل A1' : 'Pre-A1') : task.level}</span><span className="mi-lvltag soft">{task.genre.replace(/_/g, ' ')}</span></div>
    {task.media && <img className="mi-stim" src={task.media} alt={task.mediaAlt || ''} />}
    <h3 className="mi-qtext" dir="rtl" lang="ar" data-voice-read="1">{task.prompt}</h3>
    {!ar && task.prompt_en && <p className="mi-muted" dir="ltr">{task.prompt_en}</p>}
    {task.tips_ar?.length > 0 && <details className="rm-tips"><summary>{L.tips}</summary><ul>{task.tips_ar.map((t, i) => <li key={i}>{t}</li>)}</ul></details>}
    {children}
  </article>;
}
function Consent({ L, consent, setConsent }: { L: typeof S.ar; consent: boolean; setConsent: (v: boolean) => void }) {
  return <label className="rm-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} data-testid="room-consent" /><span>{L.consent}</span></label>;
}

function WritingTask({ task, L, ar, draft, consent, setConsent, busy, setBusy, post, apply, skip, setMsg }: { task: Task; L: typeof S.ar; ar: boolean; draft: string; consent: boolean; setConsent: (v: boolean) => void; busy: boolean; setBusy: (v: boolean) => void; post: Props['post']; apply: (r: any) => void; skip: () => void; setMsg: (m: string) => void }) {
  const [text, setText] = useState(draft); const [started, setStarted] = useState(!!draft); const [left, setLeft] = useState(task.time_seconds || 600); const [saved, setSaved] = useState(''); const [spoken, setSpoken] = useState(false);
  const words = countWords(text); const min = task.min_words || 1; const max = task.max_words || 400; const status = words < min ? 'short' : words > max ? 'long' : 'ok';
  const dirty = useRef(false);
  useEffect(() => { if (!started) return; setWayLock(true); const id = setInterval(() => setLeft((n) => (n > 0 ? n - 1 : 0)), 1000); return () => { clearInterval(id); setWayLock(false); }; }, [started]);
  useEffect(() => { if (!started) return; const id = setInterval(async () => { if (!dirty.current) return; dirty.current = false; const r = await post({ action: 'room_draft', skill: 'writing', text }); if (r?.ok) setSaved(L.draftSaved); }, 20000); return () => clearInterval(id); }, [started, text, post, L.draftSaved]);
  const submit = async () => {
    if (spoken) return; if (!text.trim()) return; setBusy(true); setMsg('');
    const r = await post({ action: 'room_submit', skill: 'writing', text, ai_consent: consent }); setBusy(false);
    if (r?.ok) { apply(r); setWayLock(false); } else setMsg(r?.error === 'writing_over_limit' ? L.tooLong : r?.error === 'writing_not_arabic' ? (ar ? 'النص ليس عربيًا' : 'Text is not Arabic') : L.errNet);
  };
  return <TaskCard task={task} L={L} ar={ar}>
    {!started && <div className="rm-start"><p>{fmt(L.wordsRange, { a: min, b: max })} · {L.timeLeft} {clock(left)}</p><button type="button" className="mi-next" onClick={() => setStarted(true)} data-testid="room-start-writing">{L.start}</button></div>}
    {started && !spoken && <>
      <div className="rm-bar"><span data-testid="room-words">{words} {L.words}</span><span className={`rm-len ${status}`}>{status === 'short' ? L.tooShort : status === 'long' ? L.tooLong : fmt(L.wordsRange, { a: min, b: max })}</span><span className={`mi-tpill${left < 60 ? ' low' : ''}`} aria-live="polite" data-voice-time="1">{L.timeLeft} {clock(left)}</span></div>
      <textarea className="rm-editor" dir="rtl" lang="ar" value={text} onChange={(e) => { setText(e.target.value); dirty.current = true; setSaved(''); }} rows={10} placeholder={ar ? 'اكتب هنا…' : 'Write here…'} spellCheck={false} data-testid="room-editor" disabled={left === 0} />
      <div className="rm-foot"><small>{saved}</small><Consent L={L} consent={consent} setConsent={setConsent} /></div>
      <div className="mi-actions"><button type="button" className="mi-defer" onClick={skip} disabled={busy}>{L.skip}</button><button type="button" className="mi-link" onClick={() => setSpoken(true)}>{L.spokenInstead}</button><button type="button" className="mi-next" onClick={submit} disabled={busy || !text.trim()} data-testid="room-submit-writing">{L.submit}</button></div>
    </>}
    {spoken && <Recorder task={task} L={L} ar={ar} skillToSend="writing" accommodation="spoken_instead_of_writing" consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} post={post} apply={apply} skip={skip} setMsg={setMsg} onNoMic={() => setSpoken(false)} />}
  </TaskCard>;
}

function SpeakingTask({ task, L, ar, consent, setConsent, busy, setBusy, post, apply, skip, setMsg }: { task: Task; L: typeof S.ar; ar: boolean; consent: boolean; setConsent: (v: boolean) => void; busy: boolean; setBusy: (v: boolean) => void; post: Props['post']; apply: (r: any) => void; skip: () => void; setMsg: (m: string) => void }) {
  const [typed, setTyped] = useState(false); const [text, setText] = useState('');
  const submitTyped = async () => { if (!text.trim()) return; setBusy(true); const r = await post({ action: 'room_submit', skill: 'speaking', text, ai_consent: consent, accommodation: 'typed_instead_of_speaking' }); setBusy(false); if (r?.ok) { apply(r); setWayLock(false); } else setMsg(L.errNet); };
  return <TaskCard task={task} L={L} ar={ar}>
    {!typed && <Recorder task={task} L={L} ar={ar} skillToSend="speaking" accommodation={null} consent={consent} setConsent={setConsent} busy={busy} setBusy={setBusy} post={post} apply={apply} skip={skip} setMsg={setMsg} onNoMic={() => setTyped(true)} onTyped={() => setTyped(true)} />}
    {typed && <>
      <p className="mi-simple">{L.typedInstead}</p>
      <textarea className="rm-editor" dir="rtl" lang="ar" value={text} onChange={(e) => setText(e.target.value)} rows={8} data-testid="room-typed" />
      <div className="rm-foot"><small /><Consent L={L} consent={consent} setConsent={setConsent} /></div>
      <div className="mi-actions"><button type="button" className="mi-defer" onClick={skip} disabled={busy}>{L.skip}</button><button type="button" className="mi-next" onClick={submitTyped} disabled={busy || !text.trim()} data-testid="room-submit-typed">{L.submit}</button></div>
    </>}
  </TaskCard>;
}

/** المسجّل: تحضير → تسجيل (سقف max_seconds، إيقاف تلقائي) → استماع → إرسال؛ إعادة واحدة */
function Recorder({ task, L, ar, skillToSend, accommodation, consent, setConsent, busy, setBusy, post, apply, skip, setMsg, onNoMic, onTyped }: { task: Task; L: typeof S.ar; ar: boolean; skillToSend: 'writing' | 'speaking'; accommodation: string | null; consent: boolean; setConsent: (v: boolean) => void; busy: boolean; setBusy: (v: boolean) => void; post: Props['post']; apply: (r: any) => void; skip: () => void; setMsg: (m: string) => void; onNoMic: () => void; onTyped?: () => void }) {
  const prepTotal = task.prep_seconds ?? 30; const maxS = task.max_seconds || 90; const minS = task.min_seconds || 10;
  const [phase, setPhase] = useState<'idle' | 'prep' | 'rec' | 'review'>('idle'); const [prep, setPrep] = useState(prepTotal); const [sec, setSec] = useState(0); const [blob, setBlob] = useState<Blob | null>(null); const [url, setUrl] = useState(''); const [takes, setTakes] = useState(0); const [noMic, setNoMic] = useState(false);
  const rec = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const stream = useRef<MediaStream | null>(null); const secRef = useRef(0);
  const canRecord = typeof window !== 'undefined' && !!(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== 'undefined';
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); if (url) URL.revokeObjectURL(url); setWayLock(false); }, [url]);
  useEffect(() => { if (phase !== 'prep') return; setWayLock(true); if (prep <= 0) { void startRec(); return; } const id = setTimeout(() => setPrep((p) => p - 1), 1000); return () => clearTimeout(id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phase, prep]);
  async function startRec() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = s;
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const r = new MediaRecorder(s, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : undefined); chunks.current = []; secRef.current = 0; setSec(0);
      r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      r.onstop = () => { const b = new Blob(chunks.current, { type: r.mimeType || mime || 'audio/webm' }); setBlob(b); setUrl(URL.createObjectURL(b)); s.getTracks().forEach((t) => t.stop()); setPhase('review'); setWayLock(false); };
      r.start(1000); rec.current = r; setPhase('rec');
      const tick = setInterval(() => { secRef.current += 1; setSec(secRef.current); if (secRef.current >= maxS) { clearInterval(tick); setMsg(L.autoStop); stopRec(); } }, 1000); (r as any).__tick = tick;
    } catch { setNoMic(true); setPhase('idle'); setWayLock(false); }
  }
  function stopRec() { const r = rec.current; if (!r) return; clearInterval((r as any).__tick); if (r.state !== 'inactive') r.stop(); rec.current = null; }
  const retake = () => { if (takes >= (task.retakes ?? 1)) return; setTakes((t) => t + 1); setBlob(null); if (url) URL.revokeObjectURL(url); setUrl(''); setMsg(''); setPrep(0); setPhase('prep'); };
  const submit = async () => {
    if (!blob) return; setBusy(true); setMsg('');
    const b64 = await new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result || '')); fr.readAsDataURL(blob); });
    const r = await post({ action: 'room_submit', skill: skillToSend, audio: b64, mime: blob.type, duration_sec: secRef.current || sec, ai_consent: consent, accommodation }); setBusy(false);
    if (r?.ok) apply(r); else setMsg(r?.error === 'speaking_over_limit' ? L.tooLong : r?.error === 'payload_too_large' || r?.error === 'speaking_too_big' ? (ar ? 'التسجيل كبير — أعد التسجيل أقصر' : 'Recording too large — record a shorter one') : L.errNet);
  };
  if (!canRecord || noMic) return <div className="rm-start"><p className="mi-simple">{L.noMic}</p><div className="mi-actions"><button type="button" className="mi-defer" onClick={skip} disabled={busy}>{L.skip}</button><button type="button" className="mi-next" onClick={onNoMic} data-testid="room-typed-instead">{L.typedInstead}</button></div></div>;
  return <>
    {phase === 'idle' && <div className="rm-start"><p>{L.prep}: {prepTotal} {L.seconds} · {fmt(L.secRange, { a: minS, b: maxS })}</p><div className="mi-actions"><button type="button" className="mi-defer" onClick={skip} disabled={busy}>{L.skip}</button>{onTyped && <button type="button" className="mi-link" onClick={onTyped} data-testid="room-typed-link">{L.typedInstead}</button>}<button type="button" className="mi-next" onClick={() => { setPrep(prepTotal); setPhase('prep'); }} data-testid="room-start-speaking">{L.start}</button></div></div>}
    {phase === 'prep' && <div className="rm-prep" aria-live="polite" data-testid="room-prep"><b>{prep}</b><span>{L.prep}</span><button type="button" className="mi-link" onClick={() => setPrep(0)}>{L.record}</button></div>}
    {phase === 'rec' && <div className="rm-rec" aria-live="polite"><span className="rm-dot" aria-hidden="true" /><b>{L.recording} {clock(sec)} / {clock(maxS)}</b><button type="button" className="mi-next" onClick={stopRec} data-testid="room-stop">{L.stop}</button></div>}
    {phase === 'review' && <div className="rm-review">
      <p>{L.listen} · {sec} {L.seconds} {sec < minS && <em className="rm-len short">({L.tooShort})</em>}</p>
      {url && <audio controls src={url} preload="metadata" />}
      <div className="rm-foot"><small /><Consent L={L} consent={consent} setConsent={setConsent} /></div>
      <div className="mi-actions"><button type="button" className="mi-defer" onClick={skip} disabled={busy}>{L.skip}</button>{takes < (task.retakes ?? 1) && <button type="button" className="mi-defer" onClick={retake} disabled={busy}>{L.retake}</button>}<button type="button" className="mi-next" onClick={submit} disabled={busy || !blob} data-testid="room-submit-speaking">{L.submit}</button></div>
    </div>}
  </>;
}

const CSS = `
.mi-room{max-width:980px;margin:0 auto;padding:18px 5vw 40px}
.rm-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.rm-head h2{font-size:22px;color:var(--navy,#0f2a4e)}
.rm-steps{list-style:none;margin:0 0 16px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.rm-steps button{width:100%;display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 12px;font:inherit;font-weight:900;color:#0f2a4e;cursor:pointer;text-align:start;min-height:56px}
.rm-steps b{width:30px;height:30px;border-radius:50%;background:#f1f5f9;display:inline-flex;align-items:center;justify-content:center;flex:none}.rm-steps small{display:block;font-weight:700;color:#64748b;font-size:12px}
.rm-steps li.now button{border-color:#0b8a83;box-shadow:0 0 0 3px #e6f4f3}.rm-steps li.done b{background:#0b8a83;color:#fff}.rm-steps li.skipped b{background:#e2e8f0}.rm-steps li.done small{color:#0b8a83}
.rm-card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:20px 22px;box-shadow:0 10px 30px rgba(15,42,78,.06)}
.mi-skilltag.write{background:#fbf5e4;color:#8a6a1f}.mi-skilltag.speak{background:#e6f4f3;color:#0f5c57}.mi-lvltag.soft{opacity:.7}
.rm-tips{margin:8px 0 12px;color:#334155}.rm-tips summary{cursor:pointer;font-weight:800;color:#0b8a83}.rm-tips ul{margin:6px 0 0;padding-inline-start:20px;line-height:1.8}
.rm-start{display:flex;flex-direction:column;gap:10px;align-items:flex-start;margin-top:10px}.rm-start p{margin:0;color:#334155;font-weight:700}
.rm-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;margin:10px 0;font-weight:800;color:#0f2a4e;font-size:14px}
.rm-len.short{color:#b45309}.rm-len.long{color:#b91c1c}.rm-len.ok{color:#0b8a83}
.rm-editor{width:100%;border:1px solid #cbd5e1;border-radius:14px;padding:14px;font:inherit;font-size:18px;line-height:1.9;min-height:220px;resize:vertical}.rm-editor:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.rm-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:10px 0;flex-wrap:wrap}.rm-foot small{color:#0b8a83;font-weight:800}
.rm-consent{display:flex;align-items:flex-start;gap:8px;font-size:13px;color:#334155;line-height:1.6;max-width:560px}.rm-consent input{margin-top:4px;width:18px;height:18px}
.rm-prep{display:flex;align-items:center;gap:14px;margin-top:12px;background:#fbf5e4;border:1px solid #ead9a6;border-radius:14px;padding:12px 16px}.rm-prep b{font-size:34px;color:#0f2a4e;min-width:48px;text-align:center}
.rm-rec{display:flex;align-items:center;gap:14px;margin-top:12px;background:#fff1f2;border:1px solid #fecdd3;border-radius:14px;padding:12px 16px;flex-wrap:wrap}.rm-rec b{color:#9f1239}
.rm-dot{width:14px;height:14px;border-radius:50%;background:#e11d48;animation:rm-pulse 1s infinite}@keyframes rm-pulse{0%{box-shadow:0 0 0 0 rgba(225,29,72,.5)}100%{box-shadow:0 0 0 12px rgba(225,29,72,0)}}
@media(prefers-reduced-motion:reduce){.rm-dot{animation:none}}
.rm-review{margin-top:12px}.rm-review audio{width:100%;margin:8px 0}.rm-review p{margin:0;font-weight:800;color:#0f2a4e}
.rm-msg{margin:12px 0 0;background:#fff8e6;border:1px solid #f1deab;border-radius:10px;padding:8px 12px;font-weight:800;color:#0f2a4e}
.rm-priv{margin-top:14px}
.mi-link{border:0;background:transparent;color:#0b8a83;font:inherit;font-weight:800;cursor:pointer;text-decoration:underline;padding:6px 8px}
@media(max-width:640px){.rm-head{flex-direction:column}.rm-card{padding:16px}}
`;
