'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* «نادِ» — اللوحة: تستمع داخل المتصفح (Web Speech API بالعربية؛ لا يُرسل صوت إلى خوادم أَثَر ولا يُحفظ شيء)،
   أو تقرأ طلبًا مكتوبًا حين لا يتوفّر الميكروفون/التعرّف. المحرّك واحد: نصّ → نيّة (lib/portal/voice) → تنفيذ مع مهلة تراجع 1.4 ث للتنقّل.
   داخل اختبار مِعيار (سمة data-voice-exam على الصفحة) يُقفل التنقّل ويبقى: اقرأ · التالي · كم بقي · كبّر الخط. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { parseCommand, describeIntent, EXAMPLES, LAST_KEY, ZOOM_KEY } from '../../lib/portal/voice';
import type { Intent } from '../../lib/portal/voice';
import { crumbsFor, parentOf, hasWayHistory } from '../../lib/portal/way';

type Rec = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onend: (() => void) | null; onerror: ((e: any) => void) | null };
const recCtor = (): (new () => Rec) | null => { if (typeof window === 'undefined') return null; const w = window as any; return w.SpeechRecognition || w.webkitSpeechRecognition || null; };
const UNDO_MS = 1400;

function speak(text: string) {
  try { if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = 1; window.speechSynthesis.speak(u); } catch { /* صامت */ }
}
const textOf = (sel: string) => Array.from(document.querySelectorAll<HTMLElement>(sel)).map((e) => e.innerText.trim()).filter(Boolean).join('. ');
/** حجم الخط العام (−2 … +3 درجات) — يُحفظ محليًا ويُطبَّق من الجذر */
export function applyZoom(step: number): number {
  let z = 0; try { z = Number(localStorage.getItem(ZOOM_KEY) || 0) || 0; } catch { /* */ }
  z = Math.max(-2, Math.min(3, z + step)); try { localStorage.setItem(ZOOM_KEY, String(z)); } catch { /* */ }
  document.documentElement.style.fontSize = z === 0 ? '' : `${100 + z * 10}%`; return z;
}

export default function NadiPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter(); const pathname = usePathname() || '/';
  const [heard, setHeard] = useState(''); const [interim, setInterim] = useState(''); const [status, setStatus] = useState<'idle' | 'listening' | 'typed' | 'nomic'>('idle');
  const [reply, setReply] = useState(''); const [pending, setPending] = useState<{ intent: Intent; label: string } | null>(null); const [typed, setTyped] = useState('');
  const recRef = useRef<Rec | null>(null); const timer = useRef<ReturnType<typeof setTimeout> | null>(null); const inputRef = useRef<HTMLInputElement | null>(null); const boxRef = useRef<HTMLDivElement | null>(null);
  const admin = pathname.startsWith('/admin') || pathname.startsWith('/dashboard');
  const inExam = () => !!document.querySelector('[data-voice-exam]') || !!(window as any).__wayLock;

  const stopRec = useCallback(() => { try { recRef.current?.abort(); } catch { /* */ } recRef.current = null; }, []);
  const close = useCallback(() => { stopRec(); if (timer.current) clearTimeout(timer.current); try { window.speechSynthesis?.cancel(); } catch { /* */ } onClose(); }, [onClose, stopRec]);

  /** تنفيذ النيّة (بعد مهلة التراجع للتنقّل) */
  const perform = useCallback((i: Intent) => {
    switch (i.kind) {
      case 'go': router.push(i.href); break;
      case 'home': router.push('/'); break;
      case 'back': { if (hasWayHistory()) router.back(); else router.push(parentOf(pathname)); break; }
      case 'resume_last': { let last = ''; try { last = localStorage.getItem(LAST_KEY) || ''; } catch { /* */ } if (last && last !== pathname) router.push(last); else { setReply('لا توجد صفحة سابقة محفوظة'); speak('لا توجد صفحة سابقة محفوظة'); } break; }
      case 'search': window.dispatchEvent(new CustomEvent('athar:guide', { detail: { query: i.q } })); onClose(); break;
      default: break;
    }
  }, [router, pathname, onClose]);

  const handle = useCallback((text: string) => {
    const t = text.trim(); if (!t) return; setHeard(t); setInterim('');
    const exam = inExam(); const i = parseCommand(t, { admin, inExam: exam });
    const navKinds = new Set(['go', 'home', 'back', 'resume_last', 'search']);
    if (exam && navKinds.has(i.kind)) { const m = 'التنقّل مقفل أثناء الاختبار — قل: اقرأ السؤال، التالي، كم بقي'; setReply(m); speak(m); return; }
    const label = describeIntent(i);
    if (navKinds.has(i.kind)) { setReply(label); speak(label); setPending({ intent: i, label }); timer.current = setTimeout(() => { setPending(null); perform(i); }, UNDO_MS); return; }
    setPending(null);
    switch (i.kind) {
      case 'where': { const path = crumbsFor(pathname).map((c) => c.label).join('، ثم '); const m = `أنت في: ${path}`; setReply(m); speak(m); break; }
      case 'scroll': { const h = window.innerHeight * 0.8; if (i.dir === 'top') window.scrollTo({ top: 0, behavior: 'smooth' }); else if (i.dir === 'bottom') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); else window.scrollBy({ top: i.dir === 'up' ? -h : h, behavior: 'smooth' }); setReply(label); break; }
      case 'zoom': { const z = applyZoom(i.dir === 'in' ? 1 : -1); const m = z === 0 ? 'الخط بحجمه الأصلي' : `${label} (${z > 0 ? '+' : ''}${z})`; setReply(m); break; }
      case 'read': { const txt = textOf('[data-voice-read]') || textOf('main h1, main h2') || textOf('h1'); if (!txt) { setReply('لا نصّ لأقرأه هنا'); break; } setReply(`أقرأ: ${txt.slice(0, 160)}${txt.length > 160 ? '…' : ''}`); speak(txt.slice(0, 1200)); break; }
      case 'next': { const b = document.querySelector<HTMLButtonElement>('[data-voice-next]'); if (b && !b.disabled) { b.click(); setReply('التالي'); } else { setReply('لا يوجد «التالي» في هذه الصفحة'); } break; }
      case 'time': { const txt = textOf('[data-voice-time]'); const m = txt || 'لا مؤقّت في هذه الصفحة'; setReply(m); speak(m); break; }
      case 'stop': { try { window.speechSynthesis?.cancel(); } catch { /* */ } stopRec(); setStatus('typed'); setReply('توقّفت'); break; }
      case 'help': setReply('أمثلة: ' + EXAMPLES({ admin, inExam: exam }).join(' · ')); break;
      default: { const m = `لم أفهم «${t}» — جرّب: ${EXAMPLES({ admin, inExam: exam }).slice(0, 3).join('، ')}`; setReply(m); speak('لم أفهم، جرّب مرة أخرى'); }
    }
  }, [admin, pathname, perform, stopRec]);

  const undo = () => { if (timer.current) clearTimeout(timer.current); setPending(null); setReply('تراجعتُ'); inputRef.current?.focus(); };

  /* بدء الاستماع عند الفتح (إن توفّر التعرّف) وإلا الوضع الكتابي */
  useEffect(() => {
    const C = recCtor();
    if (!C || !navigator.mediaDevices) { setStatus('nomic'); setTimeout(() => inputRef.current?.focus(), 50); return; }
    let r: Rec; try { r = new C(); } catch { setStatus('nomic'); return; }
    r.lang = 'ar-SA'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    r.onresult = (e: any) => { let fin = ''; let tmp = ''; for (let k = e.resultIndex; k < e.results.length; k += 1) { const s = e.results[k][0]?.transcript || ''; if (e.results[k].isFinal) fin += s; else tmp += s; } if (tmp) setInterim(tmp); if (fin) handle(fin); };
    r.onerror = (e: any) => { const code = String(e?.error || ''); setStatus(code === 'not-allowed' || code === 'service-not-allowed' ? 'nomic' : 'typed'); if (code === 'not-allowed') setReply('لم يُسمح بالميكروفون — اكتب طلبك هنا'); if (code === 'no-speech') setReply('لم أسمع شيئًا — اضغط الميكروفون وتحدّث، أو اكتب'); setTimeout(() => inputRef.current?.focus(), 50); };
    r.onend = () => { setStatus((s) => (s === 'listening' ? 'typed' : s)); recRef.current = null; };
    try { r.start(); recRef.current = r; setStatus('listening'); } catch { setStatus('nomic'); }
    return () => { try { r.abort(); } catch { /* */ } };
  }, [handle]);
  const relisten = () => { if (recRef.current) return; const C = recCtor(); if (!C) return; try { const r = new C(); r.lang = 'ar-SA'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1; r.onresult = (e: any) => { const last = e.results[e.results.length - 1]; if (last?.isFinal) handle(last[0].transcript); else setInterim(last?.[0]?.transcript || ''); }; r.onend = () => { recRef.current = null; setStatus('typed'); }; r.onerror = () => { recRef.current = null; setStatus('typed'); }; r.start(); recRef.current = r; setStatus('listening'); setReply(''); } catch { setStatus('typed'); } };
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(); } }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [close]);
  useEffect(() => { boxRef.current?.focus(); }, []);

  const examples = EXAMPLES({ admin, inExam: typeof document !== 'undefined' && inExam() });
  return (
    <div className="nd-wrap" role="dialog" aria-modal="false" aria-labelledby="nadi-title" id="speak-panel" data-testid="nadi-panel" dir="rtl" ref={boxRef} tabIndex={-1}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="nd-head">
        <div><strong id="nadi-title">نادِ</strong><span className="nd-sub">تحدّث أو اطلب — وأَثَر يأخذك</span></div>
        <button type="button" className="nd-x" onClick={close} aria-label="إغلاق">×</button>
      </div>
      <button type="button" className={`nd-mic ${status}`} onClick={status === 'listening' ? () => { stopRec(); setStatus('typed'); } : relisten} disabled={status === 'nomic'} aria-pressed={status === 'listening'} data-testid="nadi-mic">
        <span className="nd-dot" aria-hidden="true" />
        {status === 'listening' ? 'أسمعك… تكلّم' : status === 'nomic' ? 'الميكروفون غير متاح هنا — اكتب طلبك' : 'اضغط وتحدّث'}
      </button>
      {(interim || heard) && <p className="nd-heard" data-testid="nadi-heard" aria-live="polite">{interim ? <em>{interim}</em> : <>سمعتُ: <b>{heard}</b></>}</p>}
      {reply && <p className="nd-reply" role="status" data-testid="nadi-reply">{reply}{pending && <button type="button" className="nd-undo" onClick={undo} data-testid="nadi-undo">تراجع</button>}</p>}
      <form className="nd-form" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { handle(typed); setTyped(''); } }}>
        <label htmlFor="nadi-input" className="sr">اكتب طلبك</label>
        <input id="nadi-input" ref={inputRef} className="nd-in" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="أو اكتب: افتح مِعيار · أين أنا؟ · ارجع" autoComplete="off" data-testid="nadi-input" />
        <button type="submit" className="nd-go" aria-label="نفّذ">نفّذ</button>
      </form>
      <div className="nd-ex" aria-label="أمثلة">{examples.map((x) => <button key={x} type="button" className="nd-chip" onClick={() => handle(x)}>{x}</button>)}</div>
      <p className="nd-priv">التعرّف على الصوت يتم داخل متصفحك — لا يُرسَل صوتك إلى أَثَر ولا يُحفَظ. Alt+M يفتح «نادِ» في أي وقت.</p>
    </div>
  );
}

const CSS = `
.nd-wrap{position:fixed;bottom:130px;inset-inline-end:18px;z-index:9060;width:min(380px,calc(100vw - 28px));background:#fff;color:#0f2a4e;border:1px solid #d6dde6;border-radius:18px;box-shadow:0 18px 50px rgba(15,42,78,.28);padding:14px 14px 10px;font-family:inherit;outline:none}
.nd-wrap:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.nd-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:10px}.nd-head strong{font-size:20px;font-weight:900;display:block;line-height:1.1}.nd-sub{font-size:12px;color:#5b6b7f;font-weight:700}
.nd-x{border:0;background:#f1f5f9;color:#0f2a4e;width:32px;height:32px;border-radius:10px;font-size:20px;cursor:pointer;line-height:1}.nd-x:focus-visible,.nd-mic:focus-visible,.nd-go:focus-visible,.nd-in:focus-visible,.nd-chip:focus-visible,.nd-undo:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.nd-mic{width:100%;display:flex;align-items:center;gap:10px;border:1px solid #cfd8e3;background:#f8fafc;border-radius:12px;padding:10px 12px;font:inherit;font-weight:800;font-size:14px;color:#0f2a4e;cursor:pointer;min-height:44px}
.nd-mic.listening{border-color:#0b8a83;background:#ecfdf5}.nd-mic:disabled{cursor:default;color:#64748b}
.nd-dot{width:12px;height:12px;border-radius:50%;background:#94a3b8;flex:none}.nd-mic.listening .nd-dot{background:#0b8a83;animation:nd-pulse 1s infinite}
@keyframes nd-pulse{0%{box-shadow:0 0 0 0 rgba(11,138,131,.5)}100%{box-shadow:0 0 0 10px rgba(11,138,131,0)}}
@media(prefers-reduced-motion:reduce){.nd-mic.listening .nd-dot{animation:none}}
.nd-heard{margin:10px 2px 0;font-size:14px;color:#334155}.nd-heard em{color:#64748b}
.nd-reply{margin:8px 0 0;background:#fff8e6;border:1px solid #f1deab;border-radius:10px;padding:8px 10px;font-size:14px;font-weight:800;display:flex;align-items:center;justify-content:space-between;gap:8px}
.nd-undo{border:0;background:#0f2a4e;color:#fff;border-radius:8px;padding:6px 10px;font:inherit;font-weight:800;font-size:13px;cursor:pointer;min-height:32px}
.nd-form{display:flex;gap:6px;margin-top:10px}.nd-in{flex:1;border:1px solid #cfd8e3;border-radius:10px;padding:9px 10px;font:inherit;font-size:14px;min-height:40px}
.nd-go{border:0;background:#0b8a83;color:#fff;border-radius:10px;padding:0 14px;font:inherit;font-weight:900;cursor:pointer;min-height:40px}
.nd-ex{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}.nd-chip{border:1px solid #d6dde6;background:#fff;color:#0f2a4e;border-radius:999px;padding:5px 10px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;min-height:30px}.nd-chip:hover{border-color:#0b8a83;color:#0b8a83}
.nd-priv{margin:10px 2px 0;font-size:11px;color:#64748b;line-height:1.6}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(max-width:760px){.nd-wrap{bottom:0;inset-inline-end:0;inset-inline-start:0;width:auto;border-radius:18px 18px 0 0;padding-bottom:max(10px,env(safe-area-inset-bottom))}}
`;
