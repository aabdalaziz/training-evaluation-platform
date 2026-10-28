'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — «القناة الواحدة» (P13-ج): اكتب أو تكلّم أو صوّر — مكوّن إدخال واحد يُركَّب في كل تفاعل بالمنصة
//  ✍️ كتابة: مربع نص عادي · 🎙️ صوت: إملاء عربي فوري يتحول إلى نص (Web Speech API) · 🎥 فيديو: تسجيل 90 ثانية من الكاميرا
//  يُفرَّغ نصّه أثناء التسجيل ويُرفع (لمن سجّل الدخول) إلى مخزن خاص فيصبح «أداءً مُشاهَدًا» في التوأم المهاري. بلا أي اعتمادية خارجية.
import { useCallback, useEffect, useRef, useState } from 'react';
import { MEDIA_LIMITS, VIDEO_MIME_CANDIDATES, pickMime, fmtDuration } from '../../lib/portal/media';
import type { MediaContext } from '../../lib/portal/media';

export type ChannelMode = 'write' | 'voice' | 'video';
export type ChannelMedia = { id: string; url: string | null; duration_sec: number; score: { score: number; notes_ar: string[] } | null; evidence: boolean };
type Props = {
  lang: 'ar' | 'en'; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number; disabled?: boolean;
  tok?: string; context: { type: MediaContext; id?: string | null; skills?: string[]; title?: string; parties?: string[] };
  video?: boolean; voice?: boolean; compact?: boolean; className?: string; onMedia?: (m: ChannelMedia) => void; testId?: string;
};

const MicSvg = ({ on }: { on?: boolean }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" fill={on ? 'currentColor' : 'none'} /><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" /></svg>;
const CamSvg = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="m16 10 5-3v10l-5-3z" /></svg>;
const PenSvg = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
const SpeakerSvg = ({ on }: { on?: boolean }) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5 6 9H2v6h4l5 4z" fill={on ? 'currentColor' : 'none'} /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14" /></svg>;

function getSR(): any { if (typeof window === 'undefined') return null; return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null; }

export function Channel({ lang, value, onChange, placeholder, rows = 6, maxLength = 2500, disabled, tok, context, video = true, voice = true, compact, className, onMedia, testId }: Props) {
  const ar = lang === 'ar';
  const [mode, setMode] = useState<ChannelMode>('write'); const [canSR, setCanSR] = useState(false); const [canCam, setCanCam] = useState(false);
  const [listening, setListening] = useState(false); const [interim, setInterim] = useState('');
  const [rec, setRec] = useState<'idle' | 'live' | 'done'>('idle'); const [sec, setSec] = useState(0); const [blob, setBlob] = useState<Blob | null>(null); const [preview, setPreview] = useState<string>(''); const [mime, setMime] = useState('');
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState<ChannelMedia | null>(null); const [err, setErr] = useState('');
  const valueRef = useRef(value); valueRef.current = value;
  const srRef = useRef<any>(null); const recRef = useRef<MediaRecorder | null>(null); const streamRef = useRef<MediaStream | null>(null); const chunks = useRef<Blob[]>([]); const timer = useRef<any>(null); const videoRef = useRef<HTMLVideoElement | null>(null); const transcriptRef = useRef('');
  useEffect(() => { setCanSR(!!getSR()); setCanCam(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof (window as any).MediaRecorder !== 'undefined'); }, []);
  useEffect(() => () => { stopAll(); if (preview) URL.revokeObjectURL(preview); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const append = useCallback((chunk: string) => { const t = chunk.trim(); if (!t) return; const cur = valueRef.current; const next = (cur ? cur.replace(/\s+$/, '') + ' ' : '') + t; onChange(next.slice(0, maxLength)); }, [onChange, maxLength]);

  // ---------- 🎙️ إملاء
  function startSR(onFinal?: (t: string) => void) {
    const SR = getSR(); if (!SR) return null;
    try {
      const r = new SR(); r.lang = ar ? 'ar-SA' : 'en-US'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 1;
      r.onresult = (e: any) => { let fin = ''; let tmp = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const tr = e.results[i][0].transcript; if (e.results[i].isFinal) fin += tr + ' '; else tmp += tr; } setInterim(tmp); if (fin.trim()) { if (onFinal) onFinal(fin); else append(fin); } };
      r.onerror = (e: any) => { if (e?.error === 'not-allowed') setErr(ar ? 'الميكروفون محظور في المتصفح — اسمح به من إعدادات الموقع.' : 'Microphone blocked — allow it in site settings.'); setListening(false); };
      r.onend = () => { setListening(false); setInterim(''); };
      r.start(); return r;
    } catch { return null; }
  }
  function toggleVoice() { setErr(''); if (listening) { try { srRef.current?.stop(); } catch { /* ignore */ } setListening(false); return; } const r = startSR(); if (r) { srRef.current = r; setListening(true); } }

  // ---------- 🎥 فيديو
  async function startVideo() {
    setErr(''); setSaved(null); setBlob(null); if (preview) { URL.revokeObjectURL(preview); setPreview(''); }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: MEDIA_LIMITS.width }, height: { ideal: MEDIA_LIMITS.height }, facingMode: 'user' }, audio: true });
      streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.muted = true; videoRef.current.play().catch(() => { /* ignore */ }); }
      const m = pickMime(VIDEO_MIME_CANDIDATES, t => (window as any).MediaRecorder.isTypeSupported(t)) || ''; setMime(m);
      const mr = m ? new MediaRecorder(stream, { mimeType: m, videoBitsPerSecond: 650000, audioBitsPerSecond: 48000 }) : new MediaRecorder(stream); chunks.current = []; transcriptRef.current = '';
      mr.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size) chunks.current.push(e.data); };
      mr.onstop = () => { const b = new Blob(chunks.current, { type: m || 'video/webm' }); setBlob(b); const u = URL.createObjectURL(b); setPreview(u); if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current.muted = false; videoRef.current.src = u; } setRec('done'); if (transcriptRef.current.trim()) append(transcriptRef.current); };
      mr.start(1000); recRef.current = mr; setRec('live'); setSec(0);
      timer.current = setInterval(() => setSec(s => { if (s + 1 >= MEDIA_LIMITS.maxSeconds) { stopVideo(); return MEDIA_LIMITS.maxSeconds; } return s + 1; }), 1000);
      const r = startSR(t => { transcriptRef.current += t; }); if (r) { srRef.current = r; setListening(true); }
    } catch (e: any) { setErr(e?.name === 'NotAllowedError' ? (ar ? 'الكاميرا أو الميكروفون محظوران — اسمح بهما من إعدادات الموقع.' : 'Camera/microphone blocked — allow them in site settings.') : (ar ? 'تعذّر تشغيل الكاميرا على هذا الجهاز.' : 'Could not start the camera.')); setRec('idle'); }
  }
  function stopVideo() { if (timer.current) { clearInterval(timer.current); timer.current = null; } try { srRef.current?.stop(); } catch { /* ignore */ } setListening(false); try { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); } catch { /* ignore */ } streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  function stopAll() { stopVideo(); }
  function discard() { stopAll(); setBlob(null); setSaved(null); if (preview) URL.revokeObjectURL(preview); setPreview(''); setRec('idle'); setSec(0); if (videoRef.current) { videoRef.current.src = ''; videoRef.current.srcObject = null; } }
  async function upload() {
    if (!blob || !tok) return; setBusy(true); setErr('');
    try {
      const fd = new FormData(); fd.append('file', new File([blob], `performance.${(mime || 'video/webm').includes('mp4') ? 'mp4' : 'webm'}`, { type: (mime || 'video/webm').split(';')[0] }));
      fd.append('mime', (mime || 'video/webm').split(';')[0]); fd.append('duration_sec', String(sec)); fd.append('context_type', context.type); if (context.id) fd.append('context_id', String(context.id)); if (context.title) fd.append('title', context.title);
      if (context.skills?.length) fd.append('skill_ids', context.skills.join(',')); if (context.parties?.length) fd.append('parties', context.parties.join('|')); fd.append('transcript', (transcriptRef.current || valueRef.current || '').slice(0, 6000));
      const j = await fetch('/api/media', { method: 'POST', headers: { Authorization: `Bearer ${tok}` }, body: fd }).then(r => r.json());
      if (!j?.success) { setErr(j?.error || (ar ? 'تعذّر الحفظ' : 'Could not save')); } else { const m: ChannelMedia = { id: j.media.id, url: j.url || null, duration_sec: j.media.duration_sec, score: j.score || null, evidence: !!j.evidence }; setSaved(m); onMedia?.(m); }
    } catch { setErr(ar ? 'انقطع الاتصال أثناء الرفع' : 'Upload failed'); }
    setBusy(false);
  }
  const tabs: { k: ChannelMode; label: string; icon: JSX.Element; show: boolean }[] = [
    { k: 'write', label: ar ? 'اكتب' : 'Write', icon: <PenSvg />, show: true },
    { k: 'voice', label: ar ? 'تكلّم' : 'Speak', icon: <MicSvg on={listening && mode === 'voice'} />, show: voice },
    { k: 'video', label: ar ? 'صوّر' : 'Record', icon: <CamSvg />, show: video },
  ];
  function pick(k: ChannelMode) { if (k !== 'video' && rec === 'live') stopVideo(); if (k !== 'voice' && listening && mode === 'voice') { try { srRef.current?.stop(); } catch { /* ignore */ } } setMode(k); setErr(''); }
  return (
    <div className={`ch ${compact ? 'compact' : ''} ${className || ''}`} data-testid={testId || 'channel'} data-mode={mode}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ch-tabs" role="tablist">{tabs.filter(t => t.show).map(t => <button key={t.k} type="button" role="tab" aria-selected={mode === t.k} className={`ch-tab ${mode === t.k ? 'on' : ''}`} onClick={() => pick(t.k)} disabled={disabled}>{t.icon}<span>{t.label}</span></button>)}<span className="ch-count">{value.length}/{maxLength}</span></div>
      {mode !== 'video' && <textarea value={value} onChange={e => onChange(e.target.value.slice(0, maxLength))} rows={compact ? Math.min(rows, 3) : rows} maxLength={maxLength} placeholder={mode === 'voice' ? (listening ? (ar ? 'أسمعك… تكلّم بوضوح، وسيظهر كلامك هنا.' : 'Listening… your words appear here.') : (ar ? 'اضغط «ابدأ الإملاء» وتكلّم — أو اكتب مباشرة.' : 'Press “Start dictation” and speak — or type.')) : placeholder} disabled={disabled} dir={ar ? 'rtl' : 'ltr'} />}
      {mode === 'voice' && (
        <div className="ch-voice">
          {canSR ? <button type="button" className={`ch-act ${listening ? 'live' : ''}`} onClick={toggleVoice} disabled={disabled}><MicSvg on={listening} /> {listening ? (ar ? 'أوقف الإملاء' : 'Stop dictation') : (ar ? 'ابدأ الإملاء' : 'Start dictation')}</button>
            : <small className="ch-note">{ar ? 'الإملاء الصوتي غير متاح في هذا المتصفح — جرّب Chrome أو Edge أو Safari.' : 'Dictation is not available in this browser — try Chrome, Edge or Safari.'}</small>}
          {interim && <span className="ch-interim">{interim}</span>}
          <small className="ch-note">{ar ? 'كلامك يتحول إلى نص داخل المربع؛ راجعه وعدّله قبل الإرسال. لا يُحفظ الصوت نفسه.' : 'Your speech becomes text in the box; review it before sending. Audio itself is not stored.'}</small>
        </div>
      )}
      {mode === 'video' && (
        <div className="ch-video">
          {!canCam ? <small className="ch-note">{ar ? 'التسجيل بالكاميرا غير متاح هنا (iPhone: Safari 14.5+ أو أضف الموقع إلى الشاشة الرئيسية).' : 'Camera recording is not available here (iPhone: Safari 14.5+ or add to Home Screen).'}</small> : (
            <>
              <div className={`ch-stage ${rec}`}>
                <video ref={videoRef} playsInline autoPlay controls={rec === 'done'} />
                {rec === 'live' && <span className="ch-rec"><i /> {fmtDuration(sec)} / {fmtDuration(MEDIA_LIMITS.maxSeconds)}</span>}
                {rec === 'idle' && <div className="ch-idle"><CamSvg /><p>{ar ? `سجّل أداءك في ${MEDIA_LIMITS.maxSeconds} ثانية: ماذا تفعل أولًا، مع من، ولماذا. يُفرَّغ كلامك نصًّا تلقائيًا.` : `Record your performance in ${MEDIA_LIMITS.maxSeconds}s: what you do first, with whom, and why. Your words are transcribed automatically.`}</p></div>}
              </div>
              {listening && rec === 'live' && interim && <span className="ch-interim">{interim}</span>}
              <div className="ch-vacts">
                {rec === 'idle' && <button type="button" className="ch-act" onClick={startVideo} disabled={disabled}><CamSvg /> {ar ? 'ابدأ التسجيل' : 'Start recording'}</button>}
                {rec === 'live' && <button type="button" className="ch-act live" onClick={stopVideo}>■ {ar ? 'أوقف' : 'Stop'}</button>}
                {rec === 'done' && !saved && <>
                  {tok ? <button type="button" className="ch-act gold" onClick={upload} disabled={busy}>{busy ? (ar ? 'يُرفع…' : 'Uploading…') : (ar ? 'احفظه شاهدًا في ملفي' : 'Save as evidence')}</button> : <small className="ch-note">{ar ? 'نصّ تسجيلك أُضيف إلى ردّك. سجّل الدخول ليُحفظ الفيديو نفسه شاهدًا في ملفك المهني.' : 'Your transcript was added to your answer. Sign in to keep the video itself as evidence.'}</small>}
                  <button type="button" className="ch-act ghost" onClick={discard}>{ar ? 'أعد التسجيل' : 'Re-record'}</button>
                </>}
                {saved && <span className="ch-saved" data-testid="media-saved">✓ {ar ? `حُفظ (${fmtDuration(saved.duration_sec)})` : `Saved (${fmtDuration(saved.duration_sec)})`}{saved.evidence ? (ar ? ' — شاهد أداء مُشاهَد بانتظار المراجعة البشرية' : ' — observed-performance evidence awaiting human review') : ''}{saved.score ? ` · ${saved.score.score}/100` : ''}</span>}
              </div>
              <small className="ch-note">{ar ? 'يُحفظ في مخزن خاص لا يراه إلا أنت والمراجع؛ يُحذف تلقائيًا بعد 180 يومًا ما لم يُعتمد دليلًا.' : 'Stored privately (you and the reviewer only); auto-deleted after 180 days unless approved as evidence.'}</small>
            </>
          )}
        </div>
      )}
      {err && <div className="ch-err">{err}</div>}
    </div>
  );
}

/** زر «اقرأ لي» — يقرأ أي نص بصوت المتصفح (للمرآة والمحضر والردود) */
export function ReadAloud({ text, lang, label }: { text: string; lang: 'ar' | 'en'; label?: string }) {
  const ar = lang === 'ar'; const [on, setOn] = useState(false); const [can, setCan] = useState(false);
  useEffect(() => { setCan(typeof window !== 'undefined' && 'speechSynthesis' in window); return () => { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }; }, []);
  if (!can || !text) return null;
  function toggle() {
    try {
      if (on) { window.speechSynthesis.cancel(); setOn(false); return; }
      window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, '')); u.lang = ar ? 'ar-SA' : 'en-GB'; u.rate = 0.95;
      const v = window.speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith(ar ? 'ar' : 'en')); if (v) u.voice = v; u.onend = () => setOn(false); u.onerror = () => setOn(false); window.speechSynthesis.speak(u); setOn(true);
    } catch { setOn(false); }
  }
  return <button type="button" className={`ch-read ${on ? 'on' : ''}`} onClick={toggle} title={ar ? 'اقرأ لي' : 'Read aloud'}><style dangerouslySetInnerHTML={{ __html: CSS }} /><SpeakerSvg on={on} /> {label || (on ? (ar ? 'أوقف القراءة' : 'Stop') : (ar ? 'اقرأ لي' : 'Read aloud'))}</button>;
}

const CSS = `
.ch{display:flex;flex-direction:column;gap:8px}
.ch-tabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ch-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(15,42,78,.18);background:#fff;color:#0f2a4e;border-radius:999px;padding:5px 12px;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer}
.ch-tab.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.ch-tab:disabled{opacity:.5;cursor:default}
.ch-count{margin-inline-start:auto;font-size:.74rem;color:#64748b}
.ch textarea{width:100%;border:1px solid rgba(15,42,78,.18);border-radius:12px;padding:12px;font:inherit;font-size:.95rem;line-height:1.75;resize:vertical;background:#fff;color:#0f172a;min-height:72px}
.ch-voice,.ch-video{display:flex;flex-direction:column;gap:8px}
.ch-act{display:inline-flex;align-items:center;gap:8px;border:1px solid #0b8a83;background:#0b8a83;color:#fff;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;font-size:.88rem;cursor:pointer;width:fit-content}
.ch-act.live{background:#b91c1c;border-color:#b91c1c;animation:chpulse 1.2s infinite}
.ch-act.gold{background:#c9a24b;border-color:#c9a24b;color:#0f2a4e}
.ch-act.ghost{background:rgba(255,255,255,.92);color:#0f2a4e;border-color:rgba(15,42,78,.25)}
.ch-act:disabled{opacity:.6;cursor:default}
@keyframes chpulse{0%,100%{box-shadow:0 0 0 0 rgba(185,28,28,.5)}50%{box-shadow:0 0 0 8px rgba(185,28,28,0)}}
.ch-interim{font-size:.85rem;color:#0b8a83;font-style:italic}
.ch-note{font-size:.76rem;color:#64748b;line-height:1.6}
.ch-err{font-size:.82rem;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 10px}
.ch-stage{position:relative;background:#0b1526;border-radius:14px;overflow:hidden;aspect-ratio:4/3;max-height:300px;display:flex;align-items:center;justify-content:center}
.ch-stage video{width:100%;height:100%;object-fit:cover;background:#000}
.ch-stage.idle video{display:none}
.ch-idle{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#cbd5e1;padding:20px;text-align:center}
.ch-idle p{margin:0;font-size:.84rem;line-height:1.7;max-width:34ch}
.ch-rec{position:absolute;top:10px;inset-inline-start:10px;background:rgba(0,0,0,.55);color:#fff;border-radius:999px;padding:4px 10px;font-size:.78rem;font-weight:800;display:inline-flex;align-items:center;gap:6px;direction:ltr}
.ch-rec i{width:9px;height:9px;border-radius:50%;background:#ef4444;animation:chpulse 1.2s infinite}
.ch-vacts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ch-saved{font-size:.84rem;color:#0b8a83;font-weight:700}
.ch-read{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(15,42,78,.2);background:#fff;color:#0f2a4e;border-radius:999px;padding:4px 10px;font:inherit;font-size:.76rem;font-weight:700;cursor:pointer}
.ch-read.on{background:#0b8a83;border-color:#0b8a83;color:#fff}
.ch.compact .ch-tab{padding:3px 9px;font-size:.76rem}
`;

/** زر ميكروفون صغير لحقول الإدخال السطرية (المستشار، لحظة مهمة…) — يُملي النص في الحقل */
export function VoiceButton({ lang, onText, className }: { lang: 'ar' | 'en'; onText: (t: string) => void; className?: string }) {
  const ar = lang === 'ar'; const [on, setOn] = useState(false); const [can, setCan] = useState(false); const ref = useRef<any>(null);
  useEffect(() => { setCan(!!getSR()); return () => { try { ref.current?.stop(); } catch { /* ignore */ } }; }, []);
  if (!can) return null;
  function toggle() {
    if (on) { try { ref.current?.stop(); } catch { /* ignore */ } setOn(false); return; }
    const SR = getSR(); if (!SR) return;
    try { const r = new SR(); r.lang = ar ? 'ar-SA' : 'en-US'; r.continuous = false; r.interimResults = false; r.onresult = (e: any) => { const t = Array.from(e.results as any[]).map((x: any) => x[0].transcript).join(' ').trim(); if (t) onText(t); }; r.onend = () => setOn(false); r.onerror = () => setOn(false); r.start(); ref.current = r; setOn(true); } catch { setOn(false); }
  }
  return <button type="button" className={`ch-mic ${on ? 'on' : ''} ${className || ''}`} onClick={toggle} title={ar ? (on ? 'أسمعك…' : 'تكلّم بدل الكتابة') : (on ? 'Listening…' : 'Speak instead of typing')} aria-label={ar ? 'إملاء صوتي' : 'Voice dictation'}><style dangerouslySetInnerHTML={{ __html: CSS + MIC_CSS }} /><MicSvg on={on} /></button>;
}
const MIC_CSS = `.ch-mic{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;border:1px solid rgba(15,42,78,.2);background:#fff;color:#0f2a4e;cursor:pointer;flex:0 0 auto}.ch-mic.on{background:#b91c1c;border-color:#b91c1c;color:#fff;animation:chpulse 1.2s infinite}`;
