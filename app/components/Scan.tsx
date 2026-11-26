'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * «أَثَر يقرأ» — زرّ مسح + لوحة كاميرا داخل الصفحة (بلا تطبيق خارجي):
 *  <ScanButton onHit={(hit) => …} accept={['verify','pass']} label="امسح" />
 *  - الكاميرا الخلفية (facingMode: environment) · قراءة ~8 إطارات/ث بـ BarcodeDetector أو jsQR المُضمَّن · مصباح إن توفّر
 *  - بديل بلا كاميرا: «اختر صورة» (ملفّ/لقطة) يُقرأ محليًّا
 *  - القاعدة الذهبية: تظهر النتيجة أولًا (النوع + النصّ) وزرّا «استخدم» / «امسح مجدّدًا» — لا حفظ ولا تنقّل قبل التأكيد
 *  - لا تُرسل الصور ولا تُخزَّن؛ تُغلق المسارات عند الإغلاق. Escape يغلق · aria-modal · أهداف ≥ 44px
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { createDetector, loadImage, type Detector } from '../../lib/reader/detect';
import { parseScan, fmtIban, mrzSummaryAr, type ScanHit, type ScanKind } from '../../lib/reader/parse';

export type { ScanHit, ScanKind };
type Props = { onHit: (hit: ScanHit) => void | Promise<void>; accept?: ScanKind[]; label?: string; title?: string; hint?: string; className?: string; compact?: boolean; autoConfirm?: boolean };

export function ScanButton({ onHit, accept, label = 'امسح بالكاميرا', title = 'أَثَر يقرأ', hint, className = '', compact = false, autoConfirm = false }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className={`sc-btn ${className}`} onClick={() => setOpen(true)} aria-haspopup="dialog" title={label}><Icon name="camera" size={16} /> {!compact && label}</button>
    {open && <ScanSheet title={title} hint={hint} accept={accept} autoConfirm={autoConfirm} onClose={() => setOpen(false)} onHit={async (h) => { await onHit(h); setOpen(false); }} />}
    <style>{SC_CSS}</style>
  </>;
}

export function ScanSheet({ onHit, onClose, accept, title, hint, autoConfirm }: { onHit: (h: ScanHit) => void | Promise<void>; onClose: () => void; accept?: ScanKind[]; title: string; hint?: string; autoConfirm?: boolean }) {
  const video = useRef<HTMLVideoElement>(null); const stream = useRef<MediaStream | null>(null); const det = useRef<Detector | null>(null); const timer = useRef<number | null>(null); const busy = useRef(false);
  const [phase, setPhase] = useState<'init' | 'live' | 'nocam' | 'hit'>('init'); const [err, setErr] = useState(''); const [hit, setHit] = useState<ScanHit | null>(null); const [engine, setEngine] = useState(''); const [torch, setTorch] = useState<boolean | null>(null);
  const site = typeof location !== 'undefined' ? location.origin : '';
  const accepted = useCallback((h: ScanHit) => !accept || accept.includes(h.kind), [accept]);

  const stop = useCallback(() => { if (timer.current) { window.clearInterval(timer.current); timer.current = null; } try { stream.current?.getTracks().forEach((t) => t.stop()); } catch { /* لا شيء */ } stream.current = null; }, []);
  const found = useCallback(async (raw: string) => { const h = parseScan(raw, site); setHit(h); setPhase('hit'); stop(); if (autoConfirm && accepted(h)) await onHit(h); }, [site, stop, autoConfirm, accepted, onHit]);

  const start = useCallback(async () => {
    setErr(''); setHit(null); setPhase('init');
    try { det.current = det.current || await createDetector(); setEngine(det.current.engine === 'native' ? 'قارئ المتصفّح' : 'قارئ أَثَر المحلّي'); } catch { setErr('تعذّر تهيئة القارئ'); setPhase('nocam'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setPhase('nocam'); return; }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      stream.current = s; const v = video.current; if (!v) { stop(); return; } v.srcObject = s; await v.play().catch(() => undefined); setPhase('live');
      const track = s.getVideoTracks()[0]; const caps: any = track.getCapabilities ? track.getCapabilities() : {}; setTorch(caps && 'torch' in caps ? false : null);
      timer.current = window.setInterval(async () => { if (busy.current || !video.current || video.current.readyState < 2) return; busy.current = true; try { const raw = await det.current!.detect(video.current); if (raw) await found(raw); } finally { busy.current = false; } }, 125);
    } catch (e: any) { setErr(e?.name === 'NotAllowedError' ? 'لم يُسمح بالكاميرا — يمكنك اختيار صورة بدلًا من ذلك' : 'تعذّر فتح الكاميرا — اختر صورة'); setPhase('nocam'); }
  }, [found, stop]);

  useEffect(() => { start(); return stop; }, [start, stop]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { stop(); onClose(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, stop]);

  const toggleTorch = async () => { const t = stream.current?.getVideoTracks()[0]; if (!t) return; try { await t.applyConstraints({ advanced: [{ torch: !torch } as any] }); setTorch(!torch); } catch { setTorch(null); } };
  const fromFile = async (f: File | null) => { if (!f) return; setErr(''); try { det.current = det.current || await createDetector(); const img = await loadImage(f); const raw = await det.current.detect(img); if (raw) await found(raw); else setErr('لم يُعثر على رمز في الصورة — قرّب الرمز وأعد المحاولة'); } catch { setErr('تعذّرت قراءة الصورة'); } };
  const ok = hit ? accepted(hit) : false;

  return (
    <div className="sc-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget) { stop(); onClose(); } }}>
      <div className="sc-sheet" dir="rtl">
        <div className="sc-head"><b><Icon name="qr" size={18} /> {title}</b><button type="button" className="sc-x" onClick={() => { stop(); onClose(); }} aria-label="إغلاق"><Icon name="x" size={18} /></button></div>
        {phase !== 'hit' && <div className="sc-view">
          <video ref={video} playsInline muted className={phase === 'live' ? '' : 'hide'} aria-label="معاينة الكاميرا" />
          {phase === 'live' && <div className="sc-frame" aria-hidden="true" />}
          {phase === 'init' && <div className="sc-msg"><Icon name="spinner" size={20} /> جارٍ فتح الكاميرا…</div>}
          {phase === 'nocam' && <div className="sc-msg"><Icon name="camera" size={22} /><span>{err || 'لا كاميرا متاحة'}</span></div>}
        </div>}
        {phase === 'live' && <p className="sc-hint">{hint || 'وجّه الكاميرا إلى رمز QR أو الباركود — تُقرأ على جهازك ولا تُرسل الصورة'}{engine ? ` · ${engine}` : ''}</p>}
        {phase === 'hit' && hit && <div className="sc-result" aria-live="polite">
          <div className={`sc-kind ${ok ? 'ok' : 'no'}`}>{hit.label_ar}{!ok && ' — ليس المطلوب هنا'}</div>
          {hit.kind === 'mrz' && hit.mrz ? <table className="sc-tab"><tbody>{mrzSummaryAr(hit.mrz).map((r) => <tr key={r.k}><th>{r.k}</th><td dir="ltr">{r.v}</td></tr>)}</tbody></table>
            : <code className="sc-raw" dir="ltr">{hit.kind === 'iban' && hit.iban ? fmtIban(hit.iban) : hit.kind === 'pass' ? 'بطاقة موقَّعة (تُحلّ على الخادم)' : hit.code || hit.raw}</code>}
          <div className="sc-acts">
            {ok && <button type="button" className="sc-btn primary" onClick={() => onHit(hit)}><Icon name="check" size={16} /> استخدم</button>}
            <button type="button" className="sc-btn" onClick={start}><Icon name="refresh" size={16} /> امسح مجدّدًا</button>
          </div>
        </div>}
        {phase !== 'hit' && <div className="sc-acts">
          <label className="sc-btn"><Icon name="upload" size={16} /> اختر صورة<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => fromFile(e.target.files?.[0] || null)} /></label>
          {phase === 'live' && torch !== null && <button type="button" className="sc-btn" onClick={toggleTorch}>{torch ? 'أطفئ المصباح' : 'أضئ المصباح'}</button>}
          {phase === 'nocam' && <button type="button" className="sc-btn" onClick={start}><Icon name="refresh" size={16} /> أعد المحاولة</button>}
        </div>}
        {err && phase !== 'nocam' && <p className="sc-err" role="alert">{err}</p>}
        <p className="sc-foot">القاعدة: ما يُقرأ يُعرض لك أوّلًا ولا يُحفظ إلا بتأكيدك · لا تُخزَّن الصور.</p>
      </div>
    </div>
  );
}

const SC_CSS = `
.sc-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;font-weight:700;cursor:pointer}
.sc-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff}.sc-btn:focus-visible{outline:3px solid #D9A866;outline-offset:2px}
.sc-back{position:fixed;inset:0;background:rgba(34,16,31,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:0}
.sc-sheet{width:min(560px,100%);max-height:94vh;overflow:auto;background:#FBF4EE;border-radius:20px 20px 0 0;padding:14px 16px 18px;box-shadow:0 -8px 40px rgba(0,0,0,.3)}
@media(min-width:720px){.sc-back{align-items:center;padding:20px}.sc-sheet{border-radius:20px}}
.sc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.sc-head b{display:inline-flex;gap:6px;align-items:center;font-size:17px;color:#3A1F36}
.sc-x{min-width:44px;min-height:44px;border:0;background:transparent;color:#3A1F36;cursor:pointer;border-radius:12px}
.sc-view{position:relative;background:#22101F;border-radius:14px;aspect-ratio:4/3;overflow:hidden;display:flex;align-items:center;justify-content:center}
.sc-view video{width:100%;height:100%;object-fit:cover}.sc-view video.hide{display:none}
.sc-frame{position:absolute;inset:14% 18%;border:3px solid #F1D9A8;border-radius:16px;box-shadow:0 0 0 999px rgba(0,0,0,.28)}
.sc-msg{color:#F6EBE0;display:flex;flex-direction:column;gap:8px;align-items:center;padding:20px;text-align:center}
.sc-hint{font-size:13px;color:#6b5560;margin:8px 0}
.sc-result{background:#fff;border:1px solid #e6d5c6;border-radius:14px;padding:12px}
.sc-kind{font-weight:800;margin-bottom:8px}.sc-kind.ok{color:#2e7d6f}.sc-kind.no{color:#b3261e}
.sc-raw{display:block;background:#F6EBE0;padding:10px;border-radius:10px;word-break:break-all;font-size:14px}
.sc-tab{width:100%;border-collapse:collapse;font-size:14px}.sc-tab th{text-align:right;padding:6px;color:#6b5560;font-weight:600;width:40%}.sc-tab td{padding:6px;font-family:monospace}
.sc-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
.sc-err{color:#b3261e;font-size:13px}.sc-foot{font-size:12px;color:#8a7580;margin:10px 0 0}
`;
