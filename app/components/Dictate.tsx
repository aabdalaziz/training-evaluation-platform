'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-ب */
/**
 * «قُل بدل أن تكتب»:
 *  <MicButton kind="phone" onText={(v) => setPhone(v)} />      زرّ ميكروفون بجانب أيّ حقل: يستمع (Web Speech API، عربي/إنجليزي) → يحوّل بحسب نوع الحقل → يعرض النتيجة للتأكيد → onText
 *  <VoiceFill fields={[…]} onFill={(vals) => …} />              «املأ النموذج بالكلام»: يسأل حقلًا حقلًا (نطق السؤال بـ speechSynthesis كما في «اقرأ لي الصفحة» P32)، يعرض ما سمعه، أوامر: التالي · أعد · رجوع · تخطّ · أرسل
 *  لا يُخزَّن صوت؛ النصّ فقط وبعد تأكيد المستخدم. يختفي الزرّ إن لم يدعم المتصفّح التعرّف (Safari/Chrome يدعمان؛ Firefox لا).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { fromSpeech, voiceCommand, type FieldKind } from '../../lib/voice/dictate';

const SR = () => (typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null);
export const canDictate = () => !!SR();

/** يستمع مرّة واحدة ويعيد النصّ النهائي (أو '' عند الصمت/الرفض). */
export function listenOnce(lang = 'ar-SA', onInterim?: (s: string) => void, maxMs = 12000): Promise<{ text: string; error: string | null }> {
  return new Promise((res) => {
    const C = SR(); if (!C) { res({ text: '', error: 'unsupported' }); return; }
    const rec = new C(); rec.lang = lang; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
    let final = ''; let done = false; const finish = (error: string | null) => { if (done) return; done = true; try { rec.stop(); } catch { /* لا شيء */ } res({ text: final.trim(), error }); };
    rec.onresult = (e: any) => { let interim = ''; for (let i = e.resultIndex; i < e.results.length; i++) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t + ' '; else interim += t; } onInterim?.((final + interim).trim()); };
    rec.onerror = (e: any) => finish(e?.error === 'not-allowed' ? 'not-allowed' : e?.error === 'no-speech' ? 'no-speech' : String(e?.error || 'error'));
    rec.onend = () => finish(null);
    try { rec.start(); } catch { finish('error'); }
    window.setTimeout(() => finish(null), maxMs);
  });
}
const ERR_AR: Record<string, string> = { unsupported: 'المتصفّح لا يدعم الإملاء الصوتي', 'not-allowed': 'لم يُسمح بالميكروفون', 'no-speech': 'لم أسمع شيئًا — حاول مجدّدًا', error: 'تعذّر الاستماع' };

export function MicButton({ kind = 'text', onText, lang = 'ar-SA', label = 'أملِ بالصوت', confirm = true, className = '' }: { kind?: FieldKind; onText: (v: string) => void; lang?: string; label?: string; confirm?: boolean; className?: string }) {
  const [sup, setSup] = useState(false); const [st, setSt] = useState<'idle' | 'on' | 'ask'>('idle'); const [heard, setHeard] = useState(''); const [val, setVal] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { setSup(canDictate()); }, []);
  const go = async () => {
    if (st === 'on') return; setErr(''); setHeard(''); setSt('on');
    const r = await listenOnce(lang, setHeard); if (r.error && r.error !== 'no-speech' && !r.text) { setErr(ERR_AR[r.error] || ERR_AR.error); setSt('idle'); return; }
    if (!r.text) { setErr(ERR_AR['no-speech']); setSt('idle'); return; }
    const v = fromSpeech(kind, r.text); setHeard(r.text); setVal(v);
    if (confirm) setSt('ask'); else { onText(v); setSt('idle'); }
  };
  if (!sup) return null;
  return <span className={`dc-wrap ${className}`}>
    <button type="button" className={`dc-mic ${st === 'on' ? 'on' : ''}`} onClick={go} aria-label={label} title={label} aria-pressed={st === 'on'}><Icon name="mic" size={16} />{st === 'on' && <span className="dc-dot" aria-hidden="true" />}</button>
    {st === 'on' && <span className="dc-live" aria-live="polite">{heard || 'أستمع…'}</span>}
    {st === 'ask' && <span className="dc-ask" role="group" aria-label="تأكيد ما سُمع"><code dir="auto">{val || '—'}</code><button type="button" className="dc-ok" onClick={() => { onText(val); setSt('idle'); }}><Icon name="check" size={14} /> استخدم</button><button type="button" className="dc-no" onClick={go}><Icon name="refresh" size={14} /> أعد</button><button type="button" className="dc-no" onClick={() => setSt('idle')} aria-label="إلغاء"><Icon name="x" size={14} /></button></span>}
    {err && <span className="dc-err" role="alert">{err}</span>}
    <style>{DC_CSS}</style>
  </span>;
}

export type VoiceField = { key: string; label: string; kind?: FieldKind; required?: boolean; hint?: string };
export function VoiceFill({ fields, onFill, lang = 'ar-SA', speak = true, title = 'املأ النموذج بالكلام' }: { fields: VoiceField[]; onFill: (vals: Record<string, string>) => void; lang?: string; speak?: boolean; title?: string }) {
  const [open, setOpen] = useState(false); const [sup, setSup] = useState(false);
  useEffect(() => { setSup(canDictate()); }, []);
  if (!sup || !fields.length) return null;
  return <>
    <button type="button" className="dc-fill" onClick={() => setOpen(true)}><Icon name="mic" size={16} /> {title}</button>
    {open && <VoiceFillSheet fields={fields} lang={lang} speak={speak} title={title} onClose={() => setOpen(false)} onFill={(v) => { onFill(v); setOpen(false); }} />}
    <style>{DC_CSS}</style>
  </>;
}
function say(text: string, lang: string): Promise<void> {
  return new Promise((res) => { try { if (!('speechSynthesis' in window)) { res(); return; } window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = lang; u.rate = 0.95; u.onend = () => res(); u.onerror = () => res(); window.speechSynthesis.speak(u); window.setTimeout(res, 6000); } catch { res(); } });
}
function VoiceFillSheet({ fields, lang, speak, title, onClose, onFill }: { fields: VoiceField[]; lang: string; speak: boolean; title: string; onClose: () => void; onFill: (v: Record<string, string>) => void }) {
  const [i, setI] = useState(0); const [vals, setVals] = useState<Record<string, string>>({}); const [heard, setHeard] = useState(''); const [cand, setCand] = useState<string | null>(null); const [st, setSt] = useState<'idle' | 'asking' | 'listening' | 'confirm' | 'review'>('idle'); const [note, setNote] = useState('');
  const alive = useRef(true); useEffect(() => () => { alive.current = false; try { window.speechSynthesis?.cancel(); } catch { /* لا شيء */ } }, []);
  const f = fields[i];
  const ask = useCallback(async (idx: number) => {
    const fld = fields[idx]; if (!fld) { setSt('review'); if (speak) await say('هذا ما سمعته. قل «أرسل» للإرسال أو «رجوع» للتعديل.', lang); return; }
    setSt('asking'); setCand(null); setHeard(''); setNote('');
    if (speak) await say(`${fld.label}${fld.hint ? '. ' + fld.hint : ''}`, lang); if (!alive.current) return;
    setSt('listening'); const r = await listenOnce(lang, setHeard); if (!alive.current) return;
    if (!r.text) { setNote(ERR_AR[r.error || 'no-speech'] || ERR_AR['no-speech']); setSt('idle'); return; }
    const cmd = voiceCommand(r.text);
    if (cmd === 'skip' && !fld.required) { setI(idx + 1); ask(idx + 1); return; }
    if (cmd === 'back' && idx > 0) { setI(idx - 1); ask(idx - 1); return; }
    if (cmd === 'cancel') { onClose(); return; }
    const v = fromSpeech(fld.kind || 'text', r.text); setCand(v); setSt('confirm');
    if (speak) await say(`سمعت: ${fld.kind === 'phone' || fld.kind === 'number' ? v.split('').join(' ') : v}. قل «التالي» للتأكيد أو «أعد».`, lang); if (!alive.current) return;
    const c = await listenOnce(lang, undefined, 8000); if (!alive.current) return; const k = voiceCommand(c.text);
    if (k === 'next') { accept(idx, v); } else if (k === 'repeat') { ask(idx); } else if (k === 'cancel') { onClose(); } else { setNote('قل «التالي» أو «أعد» — أو استخدم الأزرار'); setSt('confirm'); }
  }, [fields, lang, speak, onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  const accept = (idx: number, v: string) => { const nv = { ...vals, [fields[idx].key]: v }; setVals(nv); setI(idx + 1); ask(idx + 1); };
  useEffect(() => { ask(0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="dc-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dc-sheet" dir="rtl">
        <div className="dc-head"><b><Icon name="mic" size={18} /> {title}</b><button type="button" className="dc-x" onClick={onClose} aria-label="إغلاق"><Icon name="x" size={18} /></button></div>
        {st !== 'review' && f && <>
          <div className="dc-step">الحقل {i + 1} من {fields.length}</div>
          <div className="dc-q">{f.label}{f.required ? ' *' : ''}</div>
          {f.hint && <div className="dc-hint">{f.hint}</div>}
          <div className={`dc-box ${st === 'listening' ? 'on' : ''}`} aria-live="polite">{st === 'asking' ? '…' : st === 'listening' ? (heard || 'أستمع…') : cand !== null ? <code dir="auto">{cand || '—'}</code> : (note || 'اضغط «أعد» للاستماع')}</div>
          <div className="dc-acts">
            {st === 'confirm' && cand !== null && <button type="button" className="dc-ok big" onClick={() => accept(i, cand)}><Icon name="check" size={16} /> التالي</button>}
            {st !== 'listening' && st !== 'asking' && <button type="button" className="dc-no big" onClick={() => ask(i)}><Icon name="refresh" size={16} /> أعد</button>}
            {i > 0 && st !== 'listening' && <button type="button" className="dc-no big" onClick={() => { setI(i - 1); ask(i - 1); }}>رجوع</button>}
            {!f.required && st !== 'listening' && <button type="button" className="dc-no big" onClick={() => { setI(i + 1); ask(i + 1); }}>تخطّ</button>}
          </div>
        </>}
        {st === 'review' && <>
          <div className="dc-q">راجع قبل التعبئة</div>
          <table className="dc-tab"><tbody>{fields.map((x) => <tr key={x.key}><th>{x.label}</th><td dir="auto">{vals[x.key] || <span className="dc-muted">—</span>}</td></tr>)}</tbody></table>
          <div className="dc-acts"><button type="button" className="dc-ok big" onClick={() => onFill(vals)}><Icon name="check" size={16} /> املأ النموذج</button><button type="button" className="dc-no big" onClick={() => { setI(0); ask(0); }}>من البداية</button></div>
        </>}
        <p className="dc-foot">يُعرض كلّ ما يُسمع لتأكيده · لا يُسجَّل الصوت ولا يُحفظ شيء قبل ضغطك «إرسال» في النموذج.</p>
      </div>
    </div>
  );
}

const DC_CSS = `
.dc-wrap{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;vertical-align:middle}
.dc-mic{position:relative;min-width:44px;min-height:44px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
.dc-mic.on{background:#D4614A;border-color:#D4614A;color:#fff}.dc-mic:focus-visible{outline:3px solid #D9A866;outline-offset:2px}
.dc-dot{position:absolute;top:6px;inset-inline-end:6px;width:8px;height:8px;border-radius:50%;background:#fff;animation:dcp 1s infinite}@keyframes dcp{50%{opacity:.2}}
.dc-live{font-size:13px;color:#6b5560}.dc-err{font-size:12px;color:#b3261e}
.dc-ask{display:inline-flex;align-items:center;gap:6px;background:#F6EBE0;border-radius:12px;padding:4px 6px}.dc-ask code{font-size:14px;padding:4px 8px;background:#fff;border-radius:8px;max-width:260px;overflow:hidden;text-overflow:ellipsis}
.dc-ok,.dc-no{display:inline-flex;align-items:center;gap:4px;min-height:36px;padding:4px 10px;border-radius:10px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;font-weight:700;cursor:pointer}
.dc-ok{background:#2e7d6f;border-color:#2e7d6f;color:#fff}.dc-ok.big,.dc-no.big{min-height:44px;padding:8px 16px}
.dc-fill{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:12px;border:1px dashed #D4614A;background:#fff;color:#D4614A;font:inherit;font-weight:700;cursor:pointer}
.dc-back{position:fixed;inset:0;background:rgba(34,16,31,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center}
.dc-sheet{width:min(520px,100%);max-height:94vh;overflow:auto;background:#FBF4EE;border-radius:20px 20px 0 0;padding:14px 16px 18px}
@media(min-width:720px){.dc-back{align-items:center;padding:20px}.dc-sheet{border-radius:20px}}
.dc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.dc-head b{display:inline-flex;gap:6px;align-items:center;font-size:17px;color:#3A1F36}
.dc-x{min-width:44px;min-height:44px;border:0;background:transparent;color:#3A1F36;cursor:pointer;border-radius:12px}
.dc-step{font-size:12px;color:#8a7580}.dc-q{font-size:22px;font-weight:800;color:#22101F;margin:4px 0}.dc-hint{font-size:13px;color:#6b5560}
.dc-box{min-height:64px;display:flex;align-items:center;justify-content:center;background:#fff;border:2px solid #e6d5c6;border-radius:14px;padding:12px;margin:12px 0;font-size:18px;text-align:center}.dc-box.on{border-color:#D4614A}
.dc-box code{font-size:20px;word-break:break-all}
.dc-acts{display:flex;flex-wrap:wrap;gap:8px}.dc-tab{width:100%;border-collapse:collapse;margin:8px 0}.dc-tab th{text-align:right;padding:8px;color:#6b5560;font-weight:600;width:38%}.dc-tab td{padding:8px;font-size:16px}
.dc-muted{color:#8a7580}.dc-foot{font-size:12px;color:#8a7580;margin:12px 0 0}
`;
