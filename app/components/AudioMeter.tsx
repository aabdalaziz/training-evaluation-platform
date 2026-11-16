'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P72-أ «ضبط الصوت» — عدّاد مستوى حيّ + قراءة ما بعد التسجيل + فحص ميكروفون (3 ث) — كلّه في جهاز المتعلّم (Web Audio)، لا يُرسَل صوت ولا قياس إلى الخادم إلا رقمين اختياريين.
 *  useAudioMeter(): attach(stream) أثناء التسجيل → level (0..1) + hint · finish(sec) → TakeQuality · detach()
 *  <LevelBar>  شريط المستوى + التنبيه الحيّ (data-testid: am-bar[data-level] am-hint)
 *  <QualityNote> قراءة لطيفة بعد التسجيل مع زرّ «أعد التسجيل» (am-quality[data-verdict] am-quality-redo) — اقتراح لا منع
 *  <MicCheck>  فحص 3 ثوانٍ مرّة واحدة لكل جهاز (localStorage) (am-check am-check-start am-check-result[data-level] am-check-skip)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { meterFrame, bytesToSamples, levelHint, levelBar, takeQuality, LEVEL_AR, LEVEL_EN, MIC_CHECK, type Frame, type Level, type TakeQuality } from '../../lib/portal/audio-meter';

export function useAudioMeter() {
  const [level, setLevel] = useState(0); const [lvl, setLvl] = useState<Level>('ok'); const frames = useRef<Frame[]>([]); const ctx = useRef<AudioContext | null>(null); const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const detach = useCallback(() => { if (tick.current) clearInterval(tick.current); tick.current = null; try { void ctx.current?.close(); } catch { /* ignore */ } ctx.current = null; }, []);
  const attach = useCallback((stream: MediaStream) => {
    detach(); frames.current = []; setLevel(0); setLvl('ok');
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext; if (!AC) return false;
      const c: AudioContext = new AC(); ctx.current = c; const src = c.createMediaStreamSource(stream); const an = c.createAnalyser(); an.fftSize = 2048; src.connect(an); const buf = new Uint8Array(an.fftSize);
      tick.current = setInterval(() => { an.getByteTimeDomainData(buf); const f = meterFrame(bytesToSamples(buf)); frames.current.push(f); setLevel(levelBar(f.rms)); const recent = frames.current.slice(-8); const r = recent.reduce((s, x) => s + x.rms, 0) / recent.length; const p = Math.max(...recent.map((x) => x.peak)); setLvl(recent.length >= 5 ? levelHint(r, p) : 'ok'); }, 100);
      return true;
    } catch { return false; }
  }, [detach]);
  const finish = useCallback((sec: number): TakeQuality => { detach(); return takeQuality(frames.current, sec); }, [detach]);
  useEffect(() => () => detach(), [detach]);
  return { level, lvl, attach, detach, finish };
}

export function LevelBar({ level, lvl, ar, testid = 'am' }: { level: number; lvl: Level; ar: boolean; testid?: string }) {
  const hint = ar ? LEVEL_AR[lvl] : LEVEL_EN[lvl];
  return <div className="am-wrap" data-testid={`${testid}-bar`} data-level={lvl}><div className="am-track" aria-hidden="true"><div className={`am-fill am-${lvl}`} style={{ width: `${Math.round(level * 100)}%` }} /></div>{hint && <small className="am-hint" role="status" data-testid={`${testid}-hint`}>{hint}</small>}</div>;
}

export function QualityNote({ q, ar, onRedo, testid = 'am' }: { q: TakeQuality | null; ar: boolean; onRedo?: () => void; testid?: string }) {
  if (!q || q.verdict === 'unknown') return null; const hint = ar ? q.hint_ar : q.hint_en;
  return <div className={`am-quality ${q.suggest_redo ? 'warn' : 'ok'}`} data-testid={`${testid}-quality`} data-verdict={q.verdict}>
    <small>{q.suggest_redo ? hint : (ar ? `الصوت واضح — المسموع ${q.voiced_sec} ث` : `Clear audio — ${q.voiced_sec}s audible`)}</small>
    {q.suggest_redo && onRedo && <button type="button" className="am-redo" onClick={onRedo} data-testid={`${testid}-quality-redo`}>{ar ? 'أعد التسجيل' : 'Record again'}</button>}
  </div>;
}

export const micChecked = () => { try { return typeof window !== 'undefined' && localStorage.getItem(MIC_CHECK.storageKey) === '1'; } catch { return false; } };
export const markMicChecked = () => { try { localStorage.setItem(MIC_CHECK.storageKey, '1'); } catch { /* ignore */ } };

/** فحص الميكروفون: 3 ثوانٍ يتكلّم فيها المتعلّم، ثم قراءة. يُعرض مرّة واحدة لكل جهاز؛ «تجاوز» دائمًا متاح */
export function MicCheck({ ar, onDone, testid = 'am' }: { ar: boolean; onDone: () => void; testid?: string }) {
  const m = useAudioMeter(); const [state, setState] = useState<'idle' | 'run' | 'done' | 'nomic'>('idle'); const [left, setLeft] = useState<number>(MIC_CHECK.seconds); const [q, setQ] = useState<TakeQuality | null>(null); const stream = useRef<MediaStream | null>(null);
  useEffect(() => () => { stream.current?.getTracks().forEach((t) => t.stop()); }, []);
  async function run() {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); stream.current = s; m.attach(s); setState('run'); setLeft(MIC_CHECK.seconds); let n = MIC_CHECK.seconds;
      const id = setInterval(() => { n -= 1; setLeft(n); if (n <= 0) { clearInterval(id); const r = m.finish(MIC_CHECK.seconds); s.getTracks().forEach((t) => t.stop()); stream.current = null; setQ(r); setState('done'); markMicChecked(); } }, 1000);
    } catch { setState('nomic'); }
  }
  const good = q && (q.verdict === 'ok' || q.verdict === 'quiet');
  return <div className="am-check" data-testid={`${testid}-check`} data-state={state}>
    {state === 'idle' && <><p><b>{ar ? 'فحص الميكروفون (3 ثوانٍ)' : 'Mic check (3 seconds)'}</b> <span>{ar ? '— قل أي جملة بصوتك المعتاد حتى نتأكّد أن صوتك يصل.' : '— say any sentence in your normal voice so we know it reaches us.'}</span></p>
      <div className="am-line"><button type="button" className="am-btn" onClick={() => void run()} data-testid={`${testid}-check-start`}>🎙 {ar ? 'ابدأ الفحص' : 'Start check'}</button><button type="button" className="am-link" onClick={() => { markMicChecked(); onDone(); }} data-testid={`${testid}-check-skip`}>{ar ? 'تجاوز' : 'Skip'}</button></div></>}
    {state === 'run' && <><p aria-live="polite"><b>{ar ? `تكلّم الآن… ${left}` : `Speak now… ${left}`}</b></p><LevelBar level={m.level} lvl={m.lvl} ar={ar} testid={`${testid}-check`} /></>}
    {state === 'done' && q && <><p className={good ? 'ok' : 'warn'} data-testid={`${testid}-check-result`} data-level={q.level}>{good ? (ar ? '✓ صوتك يصل بوضوح.' : '✓ Your voice comes through clearly.') : (ar ? q.hint_ar : q.hint_en)}</p>
      <div className="am-line"><button type="button" className="am-btn" onClick={onDone} data-testid={`${testid}-check-done`}>{ar ? 'متابعة' : 'Continue'}</button>{!good && <button type="button" className="am-link" onClick={() => { setQ(null); setState('idle'); }}>{ar ? 'أعد الفحص' : 'Check again'}</button>}</div></>}
    {state === 'nomic' && <><p className="warn">{ar ? 'لم نصل إلى الميكروفون — اسمح به من المتصفّح.' : 'Microphone unavailable — allow it in the browser.'}</p><div className="am-line"><button type="button" className="am-link" onClick={() => { markMicChecked(); onDone(); }}>{ar ? 'متابعة بلا فحص' : 'Continue without check'}</button></div></>}
  </div>;
}

export const AUDIO_METER_CSS = `.am-wrap{display:grid;gap:3px;min-width:120px;flex:1}.am-track{height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}.am-fill{height:100%;border-radius:999px;background:#0f766e;transition:width .1s linear}.am-fill.am-quiet{background:#d97706}.am-fill.am-silent{background:#94a3b8}.am-fill.am-loud{background:#b91c1c}.am-hint{color:#b45309;font-size:11.5px;font-weight:800}
.am-quality{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-radius:8px;padding:5px 8px;font-size:12px}.am-quality.ok{background:#f0fdf4;color:#166534}.am-quality.warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a}.am-quality small{font-weight:800}.am-redo{border:1.5px solid #92400e;background:#fff;color:#92400e;border-radius:999px;padding:3px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
.am-check{background:#f8fafc;border:1px dashed #99f6e4;border-radius:10px;padding:10px 12px;display:grid;gap:8px;font-size:13px}.am-check p{margin:0}.am-check p.ok{color:#166534;font-weight:800}.am-check p.warn{color:#92400e;font-weight:800}.am-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.am-btn{border:1.5px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:6px 12px;font:inherit;font-weight:800;cursor:pointer;min-height:34px}.am-link{border:0;background:none;color:#0f766e;font:inherit;font-size:12px;font-weight:800;cursor:pointer;text-decoration:underline}@media (prefers-reduced-motion:reduce){.am-fill{transition:none}}`;
