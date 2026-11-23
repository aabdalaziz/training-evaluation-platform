'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P55 «مسجّل الصوت» — مكوّن واحد للجهتين: أمانة المتعلّم (P54 ≤ 15 ث) وكلمة المدرّب الصوتية (P55 ≤ 20 ث)
 *  تسجيل على الجهاز (MediaRecorder) → معاينة (أعِد/أرسل) → يسلّم Blob + المدّة + نصًّا تقريبيًّا اختياريًّا من تعرّف المتصفّح (إن وُجد، ويُحذف بلمسة).
 *  لا يرفع شيئًا بنفسه — المستدعي يقرّر المسار. يُخفى الميكروفون إن لم يُدعم (canRecord). prefers-reduced-motion يوقف النبضة.
 *  testids (بادئة قابلة للتخصيص، الافتراضي nt-voice): -box[data-state] -start -cancel -timer -stop -preview -tr -tr-del -send -redo
 *  P72-أ «ضبط الصوت»: شريط مستوى حيّ أثناء التسجيل (<prefix>-bar[data-level] / -hint) وقراءة بعد التسجيل (<prefix>-quality[data-verdict]) — اقتراح لا منع؛ VoiceTake.quality اختياري
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AUDIO_MIME_CANDIDATES, pickMime } from '../../lib/portal/media';
import { useAudioMeter, LevelBar, QualityNote, AUDIO_METER_CSS } from './AudioMeter';
import type { TakeQuality } from '../../lib/portal/audio-meter';

export const TRANSCRIPT_MAX = 300;
export const canRecord = () => typeof window !== 'undefined' && typeof (window as any).MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
export const getSR = (): any => typeof window === 'undefined' ? null : ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null);
export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
export const voiceFileName = (blob: Blob) => `voice.${blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`;

export type VoiceTake = { blob: Blob; sec: number; transcript: string | null; quality?: TakeQuality | null /* P72-أ */ };
type Props = { ar: boolean; maxSec: number; onSend: (take: VoiceTake) => Promise<string | null>; onCancel: () => void; hint: string; sendLabel?: string; testid?: string; className?: string; transcriptLabel?: string };

export default function VoiceRecorder({ ar, maxSec, onSend, onCancel, hint, sendLabel, testid = 'nt-voice', className = '', transcriptLabel }: Props) {
  const [state, setState] = useState<'idle' | 'rec' | 'ready' | 'sending'>('idle'); const [sec, setSec] = useState(0); const [blob, setBlob] = useState<Blob | null>(null); const [url, setUrl] = useState<string | null>(null); const [tr, setTr] = useState<string | null>(null); const [err, setErr] = useState(''); const [q, setQ] = useState<TakeQuality | null>(null); const meter = useAudioMeter(); const meterDetach = meter.detach;
  const rec = useRef<MediaRecorder | null>(null); const stream = useRef<MediaStream | null>(null); const chunks = useRef<Blob[]>([]); const tick = useRef<ReturnType<typeof setInterval> | null>(null); const sr = useRef<any>(null); const startedAt = useRef(0); const trRef = useRef('');
  const cleanup = useCallback(() => { if (tick.current) clearInterval(tick.current); tick.current = null; try { sr.current?.stop(); } catch { /* ignore */ } sr.current = null; stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; meterDetach(); }, [meterDetach]);
  useEffect(() => () => { cleanup(); if (url) URL.revokeObjectURL(url); }, [cleanup, url]);
  function stop() { if (tick.current) clearInterval(tick.current); tick.current = null; try { if (rec.current && rec.current.state !== 'inactive') rec.current.stop(); else meter.detach(); } catch { /* ignore */ } }
  async function start() {
    setErr(''); try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = s; meter.attach(s); setQ(null); const m = pickMime(AUDIO_MIME_CANDIDATES, (t) => (window as any).MediaRecorder.isTypeSupported(t)) || ''; const mr = m ? new MediaRecorder(s, { mimeType: m, audioBitsPerSecond: 32000 }) : new MediaRecorder(s); chunks.current = []; rec.current = mr;
      mr.ondataavailable = (e) => { if (e.data?.size) chunks.current.push(e.data); };
      mr.onstop = () => { const b = new Blob(chunks.current, { type: (mr.mimeType || m || 'audio/webm').split(';')[0] }); setBlob(b); setUrl((u) => { if (u) URL.revokeObjectURL(u); return URL.createObjectURL(b); }); const secs = Math.max(1, Math.min(maxSec, Math.round((Date.now() - startedAt.current) / 1000))); setSec(secs); setQ(meter.finish(secs)); setState('ready'); cleanup(); };
      const SR = getSR(); if (SR) { try { const r = new SR(); r.lang = ar ? 'ar-SA' : 'en-US'; r.continuous = true; r.interimResults = false; trRef.current = ''; r.onresult = (ev: any) => { let t = ''; for (let i = 0; i < ev.results.length; i += 1) t += ev.results[i][0]?.transcript || ' '; trRef.current = t.replace(/\s+/g, ' ').trim().slice(0, TRANSCRIPT_MAX); setTr(trRef.current || null); }; r.onerror = () => { /* النصّ اختياري */ }; r.start(); sr.current = r; } catch { sr.current = null; } }
      startedAt.current = Date.now(); mr.start(250); setState('rec'); setSec(0); tick.current = setInterval(() => { const el = (Date.now() - startedAt.current) / 1000; setSec(Math.min(maxSec, el)); if (el >= maxSec) stop(); }, 200);
    } catch { setErr(ar ? 'لم نصل إلى الميكروفون — اسمح به من المتصفّح ثم أعِد المحاولة' : 'Microphone unavailable — allow it in the browser and retry'); cleanup(); }
  }
  function redo() { if (url) URL.revokeObjectURL(url); setUrl(null); setBlob(null); setTr(null); setQ(null); setSec(0); setState('idle'); }
  async function send() { if (!blob || state === 'sending') return; setState('sending'); setErr(''); const e = await onSend({ blob, sec, transcript: tr, quality: q }); if (e) { setErr(e); setState('ready'); } }
  const left = Math.max(0, maxSec - sec); const T = (s: string) => `${testid}${s}`;
  return <div className={`nt-reply nt-voice ${className}`} data-testid={T('-box')} data-state={state}>
    {state === 'idle' && <div className="nt-line"><button type="button" className="nt-send nt-rec" onClick={() => void start()} data-testid={T('-start')}>🎙️ {ar ? 'ابدأ التسجيل' : 'Start recording'}</button><button type="button" className="nt-link" onClick={() => { cleanup(); onCancel(); }} data-testid={T('-cancel')}>{ar ? 'إلغاء' : 'Cancel'}</button></div>}
    {state === 'rec' && <div className="nt-line"><span className="nt-rec-dot" aria-hidden="true" /><b className="nt-rec-time" aria-live="polite" data-testid={T('-timer')}>{fmtSec(sec)} · {ar ? `بقي ${Math.ceil(left)} ث` : `${Math.ceil(left)}s left`}</b><button type="button" className="nt-send" onClick={stop} data-testid={T('-stop')}>■ {ar ? 'أوقف' : 'Stop'}</button></div>}
    {state === 'rec' && <LevelBar level={meter.level} lvl={meter.lvl} ar={ar} testid={testid} />}
    {(state === 'ready' || state === 'sending') && url && <div className="nt-voice-ready">
      <div className="nt-line"><audio controls src={url} preload="metadata" aria-label={ar ? 'معاينة التسجيل' : 'Recording preview'} data-testid={T('-preview')} /><span className="nt-rec-time">{fmtSec(sec)}</span></div>
      <QualityNote q={q} ar={ar} onRedo={redo} testid={testid} />
      {tr !== null && <div className="nt-voice-tr" data-testid={T('-tr')}><small>{transcriptLabel || (ar ? 'نصّ تقريبي (من جهازك — يظهر مع الصوت):' : 'Rough transcript (on-device — shown with the audio):')}</small><p>{tr}</p><button type="button" className="nt-link" onClick={() => setTr(null)} data-testid={T('-tr-del')}>{ar ? 'احذف النصّ' : 'Remove transcript'}</button></div>}
      <div className="nt-line"><button type="button" className="nt-send" onClick={() => void send()} disabled={state === 'sending'} data-testid={T('-send')}>{state === 'sending' ? (ar ? 'يُرسل…' : 'Sending…') : (sendLabel || (ar ? 'إرسال' : 'Send'))}</button><button type="button" className="nt-chip" onClick={redo} disabled={state === 'sending'} data-testid={T('-redo')}>{ar ? 'أعِد' : 'Redo'}</button><button type="button" className="nt-link" onClick={() => { cleanup(); onCancel(); }}>{ar ? 'إلغاء' : 'Cancel'}</button></div>
    </div>}
    <small className="nt-reply-hint">{hint}</small>
    {err && <small className="nt-reply-err" role="alert" data-testid="nt-reply-err">{err}</small>}
  </div>;
}

/** الأنماط المشتركة للمسجّل — تُحقن مرّة من المستدعي (Notices يحملها أصلًا؛ DayBook يضيفها) */
export const VOICE_RECORDER_CSS = `.nt-reply{margin-top:8px;display:grid;gap:6px}.nt-line{display:flex;gap:6px;align-items:center}.nt-send{border:1.5px solid #3A1F36;background:#3A1F36;color:#fff;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer;min-height:34px}.nt-send:disabled{opacity:.5;cursor:not-allowed}.nt-chip{border:1.5px solid #D9CBC2;background:#fff;color:#3A1F36;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;min-height:34px}.nt-link{border:0;background:none;color:#B9544A;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline}.nt-reply-hint{color:#8E7F8A;font-size:11.5px}.nt-reply-err{color:#B9544A;font-weight:800}
.nt-voice{background:#FBF4EE;border:1px dashed #BFE1DC;border-radius:10px;padding:8px 10px}.nt-rec{background:#B9544A;border-color:#B9544A}.nt-rec-dot{width:10px;height:10px;border-radius:50%;background:#D4614A;align-self:center;animation:nt-pulse 1s infinite}@keyframes nt-pulse{0%,100%{opacity:1}50%{opacity:.3}}.nt-rec-time{font-variant-numeric:tabular-nums;align-self:center;color:#3A1F36;font-size:13px}.nt-voice-ready{display:grid;gap:6px}.nt-voice-ready audio{flex:1;min-width:0;height:34px}.nt-voice-tr{background:#fff;border-radius:8px;padding:6px 8px;border:1px solid #EADFD6}.nt-voice-tr p{margin:4px 0;color:#5C4858;font-size:12.5px}@media (prefers-reduced-motion:reduce){.nt-rec-dot{animation:none}}\n${AUDIO_METER_CSS}`;
