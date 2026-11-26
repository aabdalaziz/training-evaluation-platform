'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P83 */
/**
 * «امسح إيصال التحويل» — صورة الإيصال → OCR على الجهاز (محرّك P82) → مبلغ/تاريخ/مرجع/بنك قابلة للتصحيح → مطابقة فورية بالفاتورة → «استخدم»
 *  <ReceiptScan invoice={…} iban={settings.iban} onUse={({ parsed, match, file }) => …} />
 *  القاعدة الذهبية: لا يُحفظ شيء قبل التأكيد؛ القراءة داخل المتصفّح. (إرفاق صورة الإيصال نفسها قرار المستخدم في النموذج الأصلي.)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { recognize, type OcrProgress } from '../../lib/ocr/engine';
import { parseReceipt, matchReceipt, VERDICT_AR, type ParsedReceipt, type ReceiptMatch, type InvoiceLike } from '../../lib/finance/receipt';

export type ReceiptUse = { parsed: ParsedReceipt; match: ReceiptMatch; file: File | null; rawText: string };
type Props = { invoice: InvoiceLike; iban?: string | null; onUse: (r: ReceiptUse) => void | Promise<void>; label?: string; lang?: 'ar' | 'en' };

export function ReceiptScan({ invoice, iban, onUse, label, lang = 'ar' }: Props) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="rs-btn" onClick={() => setOpen(true)}><Icon name="camera" size={16} /> {label || (lang === 'ar' ? 'امسح الإيصال بالكاميرا' : 'Scan receipt')}</button>
    {open && <Sheet invoice={invoice} iban={iban} lang={lang} onClose={() => setOpen(false)} onUse={async (r) => { await onUse(r); setOpen(false); }} />}
    <style>{RS_CSS}</style>
  </>;
}

function Sheet({ invoice, iban, lang, onClose, onUse }: Props & { onClose: () => void }) {
  const ar = lang !== 'en';
  const [step, setStep] = useState<'pick' | 'ocr' | 'review'>('pick'); const [prog, setProg] = useState<OcrProgress | null>(null); const [err, setErr] = useState('');
  const [file, setFile] = useState<File | null>(null); const [raw, setRaw] = useState(''); const [p, setP] = useState<ParsedReceipt | null>(null); const [showRaw, setShowRaw] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const match = useMemo(() => (p ? matchReceipt(p, invoice, { iban }) : null), [p, invoice, iban]);

  const run = async (f: File | null) => {
    if (!f) return; setErr(''); setFile(f); setStep('ocr');
    try { const r = await recognize(f, { onProgress: setProg }); setRaw(r.text); setP(parseReceipt(r.text)); setStep('review'); }
    catch (e: any) { setErr(e?.message || (ar ? 'تعذّرت القراءة' : 'Could not read')); setStep('pick'); }
  };
  const upd = (patch: Partial<ParsedReceipt>) => setP((x) => (x ? { ...x, ...patch, iban_tail: patch.iban !== undefined ? (patch.iban ? patch.iban.slice(-4) : null) : x.iban_tail } : x));
  const manual = () => { setP({ amount: null, currency: null, date: null, ref: null, bank: null, iban: null, iban_tail: null, sender: null, confidence: 0, amounts: [] }); setRaw(''); setStep('review'); };
  const tone = match?.verdict === 'match' ? 'ok' : match?.verdict === 'mismatch' ? 'bad' : 'warn';

  return (
    <div className="rs-back" role="dialog" aria-modal="true" aria-label={ar ? 'قراءة الإيصال' : 'Receipt reader'} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rs-sheet" dir={ar ? 'rtl' : 'ltr'}>
        <div className="rs-head"><b><Icon name="camera" size={18} /> {ar ? 'أَثَر يقرأ — إيصال التحويل' : 'Receipt reader'}</b><button type="button" className="rs-x" onClick={onClose} aria-label={ar ? 'إغلاق' : 'Close'}><Icon name="x" size={18} /></button></div>
        {step === 'pick' && <div className="rs-pick">
          <p>{ar ? <>صوّر إيصال التحويل أو اختر لقطة الشاشة من تطبيق البنك. تُقرأ الصورة <b>على جهازك</b>، ويُستخرج المبلغ والتاريخ ورقم المرجع لتراجعها قبل الإرسال.</> : <>Take a photo of the transfer receipt or pick the bank-app screenshot. It is read <b>on your device</b>; amount, date and reference are extracted for your review.</>}</p>
          <div className="rs-acts">
            <label className="rs-btn primary"><Icon name="camera" size={16} /> {ar ? 'صوّر / اختر صورة' : 'Photo / choose image'}<input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files?.[0] || null)} /></label>
            <button type="button" className="rs-btn" onClick={manual}><Icon name="edit" size={16} /> {ar ? 'أدخل البيانات يدويًّا' : 'Enter manually'}</button>
          </div>
          {err && <p className="rs-err" role="alert">{err}</p>}
        </div>}
        {step === 'ocr' && <div className="rs-prog" aria-live="polite"><div><Icon name="spinner" size={20} /> {prog?.label_ar || (ar ? 'تهيئة…' : 'Preparing…')}</div><div className="rs-bar"><span style={{ width: `${Math.round((prog?.progress || 0) * 100)}%` }} /></div><small>{ar ? 'كلّ شيء يجري داخل متصفّحك.' : 'Everything runs inside your browser.'}</small></div>}
        {step === 'review' && p && match && <>
          <div className={`rs-verdict ${tone}`}><b>{ar ? VERDICT_AR[match.verdict] : match.verdict}</b><span>{match.summary_ar}</span></div>
          <div className="rs-grid">
            <label>{ar ? 'المبلغ' : 'Amount'}<input dir="ltr" inputMode="decimal" value={p.amount ?? ''} onChange={(e) => upd({ amount: e.target.value === '' ? null : Number(e.target.value) })} />{p.amounts.length > 1 && <small>{ar ? 'قرأتُ أيضًا: ' : 'Also seen: '}{p.amounts.filter((a) => a !== p.amount).slice(0, 4).map((a) => <button key={a} type="button" className="rs-chip" onClick={() => upd({ amount: a })}>{a}</button>)}</small>}</label>
            <label>{ar ? 'التاريخ' : 'Date'}<input dir="ltr" type="date" value={p.date || ''} onChange={(e) => upd({ date: e.target.value || null })} /></label>
            <label>{ar ? 'رقم المرجع' : 'Reference'}<input dir="ltr" value={p.ref || ''} onChange={(e) => upd({ ref: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') || null })} /></label>
            <label>{ar ? 'البنك' : 'Bank'}<input value={p.bank || ''} onChange={(e) => upd({ bank: e.target.value || null })} /></label>
          </div>
          <ul className="rs-checks">{match.checks.map((c) => <li key={c.key} className={c.ok === true ? 'ok' : c.ok === false ? 'bad' : ''}><Icon name={c.ok === true ? 'check' : c.ok === false ? 'x' : 'question'} size={14} /> <b>{c.label_ar}</b> <span>{c.note_ar}</span></li>)}</ul>
          {raw && <button type="button" className="rs-link" onClick={() => setShowRaw(!showRaw)}>{showRaw ? (ar ? 'إخفاء النصّ الخام' : 'Hide raw text') : (ar ? 'النصّ الخام' : 'Raw text')}</button>}
          {showRaw && <textarea className="rs-raw" readOnly value={raw} rows={6} dir="auto" />}
          <div className="rs-acts">
            <button type="button" className="rs-btn primary" onClick={() => onUse({ parsed: p, match, file, rawText: raw })}><Icon name="check" size={16} /> {ar ? 'استخدم هذه البيانات' : 'Use these details'}</button>
            <button type="button" className="rs-btn" onClick={() => { setStep('pick'); setP(null); setFile(null); }}><Icon name="refresh" size={16} /> {ar ? 'صورة أخرى' : 'Another image'}</button>
          </div>
          <small className="rs-muted">{ar ? 'الاعتماد النهائي بيد الإدارة؛ الإيصال المطابق يُراجع أسرع.' : 'Final confirmation is by staff; matching receipts are processed faster.'}</small>
        </>}
      </div>
    </div>
  );
}

const RS_CSS = `
.rs-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;font-weight:700;cursor:pointer}
.rs-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff}.rs-btn:focus-visible{outline:3px solid #D9A866;outline-offset:2px}
.rs-back{position:fixed;inset:0;background:rgba(34,16,31,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center}
.rs-sheet{width:min(720px,100%);max-height:94vh;overflow:auto;background:#FBF4EE;border-radius:20px 20px 0 0;padding:14px 16px 18px;display:flex;flex-direction:column;gap:10px}
.rs-head{display:flex;justify-content:space-between;align-items:center}.rs-head b{display:flex;gap:6px;align-items:center;font-size:16px;color:#3A1F36}.rs-x{border:0;background:transparent;cursor:pointer;min-width:44px;min-height:44px}
.rs-pick p{font-size:14px;line-height:1.8;margin:0 0 8px}.rs-acts{display:flex;gap:8px;flex-wrap:wrap}.rs-err{color:#8b1e14;font-weight:700}
.rs-prog{display:flex;flex-direction:column;gap:8px;align-items:center;padding:20px;text-align:center}.rs-bar{width:100%;height:8px;background:#F6EBE0;border-radius:99px;overflow:hidden}.rs-bar span{display:block;height:100%;background:#D4614A;transition:width .3s}
.rs-verdict{border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px;font-size:13.5px}.rs-verdict.ok{background:#E6F3F1;color:#1F4F4A}.rs-verdict.warn{background:#F6ECD9;color:#6B4A12}.rs-verdict.bad{background:#F8D7D3;color:#8b1e14}
.rs-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.rs-grid label{display:flex;flex-direction:column;gap:3px;font-size:12.5px;font-weight:800;color:#5C4858}.rs-grid input{padding:8px 10px;border:1px solid #e6d5c6;border-radius:10px;font:inherit;font-size:15px;background:#fff}
.rs-chip{border:1px solid #e6d5c6;background:#fff;border-radius:999px;padding:1px 8px;font:inherit;font-size:12px;cursor:pointer;margin-inline-start:4px}
.rs-checks{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:13px}.rs-checks li{display:flex;gap:6px;align-items:center;color:#5C4858}.rs-checks li.ok{color:#1F4F4A}.rs-checks li.bad{color:#8b1e14}
.rs-link{border:0;background:transparent;color:#D4614A;font:inherit;font-weight:800;cursor:pointer;align-self:flex-start}.rs-raw{width:100%;font:12px/1.5 monospace;border:1px solid #e6d5c6;border-radius:10px;padding:8px;background:#fff}
.rs-muted{color:#8a7580;font-size:12px}
@media(max-width:560px){.rs-grid,.rs-checks{grid-template-columns:1fr}}
`;
