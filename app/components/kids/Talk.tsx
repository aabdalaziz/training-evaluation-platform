'use client';
/* «حَديثٌ مَعَ لُؤْلُؤ» — ت1 (kids/curriculum/LULU-TALK-SCRIPT-T1.md)
 * الوضع الافتراضي (ب): تأكيد وليّ الأمر — لا يغادر الجهاز أيّ صوت.
 * الوضع (أ) اختياري: تعرّف المتصفّح على الكلام (قد يُرسَل الصوت لمزوّد المتصفّح) — يفعّله وليّ الأمر من شاشة الاسم.
 * التسجيل: MediaRecorder مقطع لكلّ دورة في الذاكرة فقط؛ يُمحى بمغادرة الصفحة؛ يُحفَظ النصّ والوجه فقط. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ActCtx } from './activities';
import { TALK_COMMON, judge, speechRecognitionCtor, type TalkResult, type TalkScript, type SpeechRecognitionLike } from '../../../lib/kids/talk';

type Step = 'hello' | 0 | 1 | 2 | 'final' | 'replay' | 'rate' | 'done';
type Clip = { lulu: string; child: Blob | null; reply: string };
const MAX_SEC = 8;

export const TALK_RECOG_KEY = 'bayan_demo_talk_recog';
export const talkRecogEnabled = () => { try { return localStorage.getItem(TALK_RECOG_KEY) === '1'; } catch { return false; } };

export type TalkOutcome = { results: TalkResult[]; selfVoice: string | null };
/** recogAllowed: من أمانة «التعرّف على الصوت» في بَيْتُ بَيان؛ إن لم تُمرَّر (العرض العامّ) فمن مفتاح العرض المحلّي */
export function Talk({ p, T, onDone, recogAllowed }: { p: ActCtx; T: TalkScript; onDone: (o?: TalkOutcome) => void; recogAllowed?: boolean }) {
  const [step, setStep] = useState<Step>('hello');
  const [attempt, setAttempt] = useState<1 | 2>(1);
  const [rec, setRec] = useState(false);
  const [ring, setRing] = useState(0);              // 0..1 حلقة تفرغ
  const [needParent, setNeedParent] = useState(false);
  const [model, setModel] = useState<string | null>(null);
  const [recog] = useState<boolean>(() => (recogAllowed ?? talkRecogEnabled()) && !!speechRecognitionCtor());
  const [results, setResults] = useState<TalkResult[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [face, setFace] = useState<string | null>(null);
  const [replayAt, setReplayAt] = useState(-1);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const heardRef = useRef('');
  const sr = useRef<SpeechRecognitionLike | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false);

  const say = useCallback((L: { text: string; audio: string }, pose: Parameters<ActCtx['luluSay']>[2] = 'wave', onEnd?: () => void) => {
    p.luluSay(L.text.replace('يا بَطَلْ', p.name ? `يا ${p.name}` : 'يا بَطَلْ'), L.audio, pose, onEnd);
  }, [p]);
  const turn = typeof step === 'number' ? T.turns[step] : null;

  const root = useRef<HTMLDivElement | null>(null);
  // فتح المحطّة: التمرير إلى البطاقة ثمّ النداء
  useEffect(() => { root.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); const t = setTimeout(() => say(TALK_COMMON.call, 'wave', p.awaitAnswer), 600); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  // سؤال كلّ دورة
  useEffect(() => { if (!turn) return; setModel(null); setAttempt(1); const t = setTimeout(() => say(turn.q, 'think', p.awaitAnswer), 500); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [step]);
  // تنظيف: إغلاق الميك ومحو المقاطع
  useEffect(() => () => { stream.current?.getTracks().forEach(t => t.stop()); sr.current?.abort(); if (timer.current) clearInterval(timer.current); }, []);

  const ensureMic = async (): Promise<boolean> => {
    if (stream.current) return true;
    try { stream.current = await navigator.mediaDevices.getUserMedia({ audio: true }); return true; } catch { return false; }
  };

  /** بدء الاستماع: تسجيل محلّي + (اختياريًّا) تعرّف المتصفّح */
  const startRec = async () => {
    if (rec || busy.current) return;
    p.stopWaiting();
    const ok = await ensureMic();
    if (!ok) { setNeedParent(true); say(TALK_COMMON.parent, 'point'); return; }
    heardRef.current = ''; chunks.current = [];
    try {
      const mr = new MediaRecorder(stream.current!);
      mr.ondataavailable = e => { if (e.data.size) chunks.current.push(e.data); };
      mr.start(); recorder.current = mr;
    } catch { recorder.current = null; }
    if (recog) {
      const Ctor = speechRecognitionCtor()!; const r = new Ctor();
      r.lang = 'ar-SA'; r.interimResults = false; r.maxAlternatives = 3; r.continuous = false;
      r.onresult = e => { heardRef.current = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript || '').join(' '); };
      r.onerror = () => { /* يسقط إلى تأكيد وليّ الأمر */ };
      r.onend = () => { if (rec) stopRec(); };
      try { r.start(); sr.current = r; } catch { sr.current = null; }
    }
    setRec(true); setRing(1); p.setLstate('listen'); p.setPose('think');
    const t0 = Date.now();
    timer.current = setInterval(() => { const left = 1 - (Date.now() - t0) / (MAX_SEC * 1000); setRing(Math.max(0, left)); if (left <= 0) stopRec(); }, 100);
  };

  const stopRec = () => {
    if (timer.current) { clearInterval(timer.current); timer.current = null; }
    setRec(false); setRing(0);
    const mr = recorder.current; recorder.current = null;
    const finish = (blob: Blob | null) => { try { sr.current?.stop(); } catch { /* ignore */ } sr.current = null; setTimeout(() => evaluate(blob), recog ? 700 : 100); };
    if (mr && mr.state !== 'inactive') { mr.onstop = () => finish(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })); mr.stop(); }
    else finish(null);
  };

  /** الحكم بعد المحاولة */
  const evaluate = (blob: Blob | null) => {
    if (busy.current) return; busy.current = true; p.setLstate('think');
    const heard = heardRef.current;
    if (!recog) { setNeedParent(true); busy.current = false; pendingBlob.current = blob; say(TALK_COMMON.parent, 'point', p.awaitAnswer); return; }
    const m = step === 'hello' ? judge({ role: 'hello', accept: [] }, heard) : judge(turn!, heard);
    decide(m, heard, blob);
  };
  const pendingBlob = useRef<Blob | null>(null);
  /** وضع (ب): وليّ الأمر يحكم */
  const parentSays = (said: boolean) => { setNeedParent(false); p.stopWaiting(); busy.current = true; decide(said ? 'yes' : 'no', '', pendingBlob.current); pendingBlob.current = null; };

  const decide = (m: ReturnType<typeof judge>, heard: string, blob: Blob | null) => {
    const free = () => { busy.current = false; };
    const advance = (reply: { text: string; audio: string }) => {
      const lulu = step === 'hello' ? TALK_COMMON.call.text : turn!.q.text;
      setClips(c => [...c, { lulu, child: blob, reply: reply.text }]);
      if (typeof step === 'number') setResults(r => [...r, { role: turn!.role, heard, matched: m, attempts: attempt }]);
      const nextStep: Step = step === 'hello' ? 0 : step === 2 ? 'final' : ((step as number) + 1) as Step;
      say(reply, 'cheer', () => { free(); setStep(nextStep); });
    };
    if (step === 'hello') { if (m === 'silent' && attempt === 1) { setAttempt(2); say(TALK_COMMON.nohear, 'point', () => { free(); p.awaitAnswer(); }); return; } advance(TALK_COMMON.helloOk); return; }
    const t = turn!;
    if (m === 'yes') return advance(t.yes);
    if (m === 'alt' && t.alt) return advance(t.alt.reply);
    if (attempt === 1) {
      setAttempt(2);
      if (m === 'silent') { say(TALK_COMMON.nohear, 'point', () => { free(); p.awaitAnswer(); }); }
      else { setModel(t.model.text); say(TALK_COMMON.close, 'point', () => p.luluSay(t.model.text, t.model.audio, 'point', () => { free(); p.awaitAnswer(); })); }
      return;
    }
    // المحاولة الثانية: مهما كانت → ننتقل
    if (m === 'silent') { setModel(t.model.text); p.luluSay(t.model.text, t.model.audio, 'point', () => { free(); setResults(r => [...r, { role: t.role, heard, matched: m, attempts: 2 }]); setStep(step === 2 ? 'final' : ((step as number) + 1) as Step); }); return; }
    advance(TALK_COMMON.heard);
  };

  // الختم → عرض إعادة الاستماع
  useEffect(() => {
    if (step !== 'final') return;
    try { localStorage.setItem(`bayan_demo_talk_${p.S.slug}`, JSON.stringify({ at: new Date().toISOString(), results })); } catch { /* ignore */ }
    const t = setTimeout(() => say(T.final, 'dance', () => { const has = clips.some(c => c.child); if (has) { setStep('replay'); say(TALK_COMMON.listenQ, 'think', p.awaitAnswer); } else { setStep('done'); say(TALK_COMMON.bye, 'wave'); } }), 400);
    return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [step]);

  /** إعادة الاستماع: سؤال لؤلؤ ← صوت الطفل ← ردّ لؤلؤ، لكلّ دورة */
  const replayAll = async () => {
    p.stopWaiting();
    const audioKeys = ['common:t-call', ...T.turns.map(t => t.q.audio)];
    for (let i = 0; i < clips.length; i++) {
      const c = clips[i]; setReplayAt(i);
      await new Promise<void>(res => p.luluSay(c.lulu, audioKeys[i] || audioKeys[0], 'wave', res));
      if (c.child) await new Promise<void>(res => { const url = URL.createObjectURL(c.child!); const a = new Audio(url); p.setLstate('listen'); a.onended = () => { URL.revokeObjectURL(url); res(); }; a.onerror = () => res(); void a.play().catch(() => res()); });
    }
    setReplayAt(-1); setStep('rate'); say(TALK_COMMON.self, 'think', p.awaitAnswer);
  };
  const rate = (k: string) => { setFace(k); p.stopWaiting(); try { localStorage.setItem(`bayan_demo_talk_self_${p.S.slug}`, k); } catch { /* ignore */ } setStep('done'); say(TALK_COMMON.bye, 'cheer'); };
  const skip = () => { p.stopWaiting(); sr.current?.abort(); say(TALK_COMMON.tomorrow, 'wave', onDone); };

  const steps = useMemo(() => ['التحيّة', 'أجب', 'أخبرني', 'صحّح لي', 'اِسْمَعْ حَديثَكْ'], []);
  const at = step === 'hello' ? 0 : typeof step === 'number' ? step + 1 : 4;
  const canTalk = step === 'hello' || typeof step === 'number';
  const atBar = step === 'rate' ? 4 : at;

  return (
    <div className="tk" ref={root}>
      <h2 className="by-h2">حَديثٌ مَعَ لُؤْلُؤ 🎙️</h2>
      <div className="ac-bar">{steps.map((s, i) => <span key={s} className={i === atBar ? 'on' : i < atBar ? 'ok' : ''}>{i < atBar ? '★ ' : ''}{s}</span>)}</div>
      {canTalk && !needParent && (
        <div className="tk-mic">
          <button className={`tk-btn ${rec ? 'rec' : ''}`} onClick={rec ? stopRec : startRec} aria-label={rec ? 'انتهيت' : 'تكلّم'} style={{ ['--ring' as string]: ring }}>
            <span className="tk-ring" /><span className="tk-ic">{rec ? '⏹' : '🎙️'}</span>
          </button>
          <p className="by-sub">{rec ? 'لُؤْلُؤ تَسْمَعُكْ… اِضْغَطْ عِنْدَما تَنْتَهي' : attempt === 2 ? 'مَرَّةً أُخْرى… اِضْغَطْ وَتَكَلَّمْ' : 'اِضْغَطْ… ثُمَّ تَكَلَّمْ'}</p>
          {model && <p className="tk-model" dir="rtl">قُلْ مَعي: <b>{model}</b></p>}
        </div>
      )}
      {needParent && (
        <div className="by-choices row">
          <p className="by-q">{TALK_COMMON.parent.text}{turn && <> <small>(«{turn.model.text}» أو ما يشبهها)</small></>}</p>
          <button className="by-opt good" onClick={() => parentSays(true)}>قالَها ✓</button>
          <button className="by-opt" onClick={() => parentSays(false)}>نُعيدُها 🔁</button>
          {!stream.current && <p className="by-parent">لم يُفتح الميكروفون — يمكن المتابعة بتأكيد وليّ الأمر فقط.</p>}
        </div>
      )}
      {step === 'replay' && (
        <div className="by-choices row">
          {replayAt < 0 ? <>
            <button className="by-big" onClick={replayAll}>اِسْمَعْ حَديثَكْ 🔊</button>
            <button className="by-ghost" onClick={() => rate('skip')}>لا، شُكْرًا</button>
          </> : <p className="by-sub">▶ الدَّوْرَةُ {replayAt + 1} مِنْ {clips.length}…</p>}
        </div>
      )}
      {step === 'rate' && face === null && (
        <div className="tk-faces">
          <p className="by-q">{TALK_COMMON.self.text}</p>
          {[{ k: 'clear', e: '😄', t: 'قُلْتُها واضِحَةْ' }, { k: 'near', e: '🙂', t: 'قَريبْ' }, { k: 'again', e: '😌', t: 'أُعيدُها غَدًا' }].map(f => <button key={f.k} className="by-face" onClick={() => rate(f.k)}><span>{f.e}</span>{f.t}</button>)}
        </div>
      )}
      {step === 'done' && <div className="by-center"><p className="by-sub">{TALK_COMMON.bye.text}</p><button className="by-big" onClick={() => onDone({ results, selfVoice: face })}>التّالي ◀</button></div>}
      {step !== 'done' && <button className="by-ghost tk-skip" onClick={skip}>غَدًا 😌</button>}
      <p className="by-parent">🔒 {recog ? 'التعرّف على الكلام عبر خدمة المتصفّح (قد يُرسَل الصوت لمزوّد المتصفّح لتحويله إلى نصّ).' : 'لا يغادر الجهاز أيّ صوت: التسجيل محلّيّ ويُمحى عند مغادرة الصفحة.'} يُحفَظ النصّ والتقييم فقط لبطاقة وليّ الأمر.</p>
    </div>
  );
}

export const TALK_CSS = `
.by-toggle{display:flex;gap:8px;align-items:flex-start;max-width:560px;text-align:right;font-size:14px;color:#6b5a66;background:#fff;border:2px solid #F1D9A8;border-radius:14px;padding:10px 12px}.by-toggle input{width:20px;height:20px;margin-top:2px}.by-toggle small{display:block;color:#8E7F8A}
.by-talk{width:100%;background:#fff;border:3px solid #F1D9A8;border-radius:24px;padding:16px;margin:8px 0}
.tk{display:grid;gap:12px;justify-items:center;scroll-margin-top:96px}
.tk-mic{display:grid;justify-items:center;gap:8px}
.tk-btn{position:relative;width:132px;height:132px;border-radius:50%;border:0;background:#E8795C;box-shadow:0 8px 0 #b9544a;cursor:pointer;display:grid;place-items:center}
.tk-btn .tk-ic{font-size:58px;position:relative;z-index:1}
.tk-btn.rec{background:#5EA8A0;box-shadow:0 8px 0 #3f7f78;animation:tk-pulse 1.1s infinite}
.tk-ring{position:absolute;inset:-10px;border-radius:50%;background:conic-gradient(#F1D9A8 calc(var(--ring,0)*360deg),transparent 0);mask:radial-gradient(circle,transparent 62px,#000 63px);-webkit-mask:radial-gradient(circle,transparent 62px,#000 63px)}
@keyframes tk-pulse{0%{transform:scale(1)}50%{transform:scale(1.05)}100%{transform:scale(1)}}
.tk-model{font-size:30px;color:#3A1F36;background:#fff;border:3px solid #F1D9A8;border-radius:20px;padding:10px 22px}.tk-model b{color:#E8795C}
.tk-faces{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;width:100%}.tk-faces .by-q{width:100%}
.tk-skip{opacity:.8}
`;
