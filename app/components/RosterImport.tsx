'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-ج */
/**
 * «استيراد كشف ورقي» — صوّر كشف الحضور/الأسماء (صورة أو أكثر) → OCR على الجهاز → جدول قابل للتصحيح مع مطابقة بالأسماء المعروفة → تأكيد → onImport
 *  <RosterImport known={[…]} onImport={async (rows) => …} />      و     <OcrContactButton onContact={(c) => …} />  لبطاقة العمل
 *  القاعدة الذهبية: لا يُحفظ شيء قبل مراجعة الجدول والضغط على «استورد»؛ الصور لا تغادر المتصفّح ولا تُخزَّن.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { recognize, type OcrProgress } from '../../lib/ocr/engine';
import { parseRoster, extractContact, matchRow, type Known, type Match, type Contact } from '../../lib/ocr/roster';

export type ImportRow = { name: string; email: string | null; phone: string | null; national_id: string | null; match: Match | null; use_match: boolean; include: boolean; flags: string[] };

export function RosterImport({ known, onImport, label = 'استيراد كشف ورقي', title = 'أَثَر يقرأ — كشف ورقي' }: { known: Known[]; onImport: (rows: ImportRow[]) => Promise<{ ok: number; failed: number } | void>; label?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="ri-btn" onClick={() => setOpen(true)}><Icon name="camera" size={16} /> {label}</button>
    {open && <RosterSheet known={known} title={title} onClose={() => setOpen(false)} onImport={onImport} />}
    <style>{RI_CSS}</style>
  </>;
}

function RosterSheet({ known, title, onClose, onImport }: { known: Known[]; title: string; onClose: () => void; onImport: (rows: ImportRow[]) => Promise<{ ok: number; failed: number } | void> }) {
  const [step, setStep] = useState<'pick' | 'ocr' | 'table' | 'done'>('pick'); const [prog, setProg] = useState<OcrProgress | null>(null); const [imgN, setImgN] = useState({ i: 0, n: 0 });
  const [rawText, setRawText] = useState(''); const [rows, setRows] = useState<ImportRow[]>([]); const [err, setErr] = useState(''); const [showRaw, setShowRaw] = useState(false); const [busy, setBusy] = useState(false); const [result, setResult] = useState<{ ok: number; failed: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose, busy]);

  const toRows = (text: string): ImportRow[] => parseRoster(text).map((r) => { const m = r.name ? matchRow(r, known) : null; return { name: r.name, email: r.email, phone: r.phone, national_id: r.national_id, match: m, use_match: !!m && m.score >= 0.85, include: !!r.name && !r.flags.includes('مكرّر'), flags: r.flags }; });
  const run = async (files: FileList | null) => {
    if (!files || !files.length) return; setErr(''); setStep('ocr'); let all = '';
    try {
      for (let i = 0; i < files.length; i++) { setImgN({ i: i + 1, n: files.length }); const r = await recognize(files[i], { onProgress: setProg }); all += (all ? '\n' : '') + r.text; }
      setRawText(all); const rs = toRows(all); setRows(rs); setStep('table'); if (!rs.length) setErr('لم أتعرّف على أسماء — جرّب صورة أوضح (إضاءة جيّدة، الورقة مستوية، بلا ظلّ) أو حرّر النصّ الخام.');
    } catch (e: any) { setErr(e?.message || 'تعذّرت القراءة'); setStep('pick'); }
  };
  const upd = (i: number, patch: Partial<ImportRow>) => setRows((l) => l.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const rematch = (i: number) => setRows((l) => l.map((r, k) => { if (k !== i) return r; const m = matchRow(r, known); return { ...r, match: m, use_match: !!m && m.score >= 0.85 }; }));
  const addRow = () => setRows((l) => [...l, { name: '', email: null, phone: null, national_id: null, match: null, use_match: false, include: true, flags: ['يدوي'] }]);
  const selected = useMemo(() => rows.filter((r) => r.include && r.name.trim().length >= 2), [rows]);
  const go = async () => { setBusy(true); setErr(''); try { const r = await onImport(selected); setResult(r ? { ok: r.ok, failed: r.failed } : { ok: selected.length, failed: 0 }); setStep('done'); } catch (e: any) { setErr(e?.message || 'تعذّر الاستيراد'); } finally { setBusy(false); } };

  return (
    <div className="ri-back" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="ri-sheet" dir="rtl">
        <div className="ri-head"><b><Icon name="table" size={18} /> {title}</b><button type="button" className="ri-x" onClick={onClose} aria-label="إغلاق" disabled={busy}><Icon name="x" size={18} /></button></div>
        {step === 'pick' && <div className="ri-pick">
          <p>صوّر كشف الأسماء (أو اختر صورًا من الجهاز). تُقرأ الصورة <b>على جهازك</b> ولا تُرسل. أوّل مرّة تحمّل محرّك القراءة (≈ 6 م.ب) ثمّ يصبح سريعًا.</p>
          <ul className="ri-tips"><li>إضاءة جيّدة وورقة مستوية بلا ظلّ</li><li>سطر لكلّ شخص: الاسم ثمّ الجوال/البريد إن وُجد</li><li>يمكن تصوير صفحات عدّة متتالية</li></ul>
          <div className="ri-acts"><label className="ri-btn primary"><Icon name="camera" size={16} /> صوّر / اختر صورًا<input ref={fileRef} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => run(e.target.files)} /></label></div>
          {err && <p className="ri-err" role="alert">{err}</p>}
        </div>}
        {step === 'ocr' && <div className="ri-prog" aria-live="polite">
          <div><Icon name="spinner" size={20} /> صورة {imgN.i} من {imgN.n} — {prog?.label_ar || 'تهيئة…'}</div>
          <div className="ri-bar"><span style={{ width: `${Math.round((prog?.progress || 0) * 100)}%` }} /></div>
          <small>كلّ شيء يجري داخل متصفّحك.</small>
        </div>}
        {step === 'table' && <>
          <div className="ri-sum">قرأت <b>{rows.length}</b> صفًّا · سيُستورد <b>{selected.length}</b> · مطابَق بسجلّ معروف <b>{rows.filter((r) => r.match).length}</b> <button type="button" className="ri-link" onClick={() => setShowRaw(!showRaw)}>{showRaw ? 'إخفاء النصّ الخام' : 'النصّ الخام'}</button></div>
          {showRaw && <div className="ri-raw"><textarea value={rawText} onChange={(e) => setRawText(e.target.value)} rows={8} dir="auto" aria-label="النصّ الخام" /><button type="button" className="ri-btn" onClick={() => setRows(toRows(rawText))}><Icon name="refresh" size={14} /> أعد التحليل من النصّ</button></div>}
          <div className="ri-tabwrap"><table className="ri-tab">
            <thead><tr><th><span className="sr">استيراد</span>✓</th><th>الاسم</th><th>الجوال</th><th>البريد</th><th>مطابقة</th><th></th></tr></thead>
            <tbody>{rows.map((r, i) => <tr key={i} className={r.include ? '' : 'off'}>
              <td><input type="checkbox" checked={r.include} onChange={(e) => upd(i, { include: e.target.checked })} aria-label={`استيراد ${r.name || 'الصفّ ' + (i + 1)}`} /></td>
              <td><input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} onBlur={() => rematch(i)} aria-label="الاسم" />{r.flags.length > 0 && <small className="ri-flag">{r.flags.join(' · ')}</small>}</td>
              <td><input dir="ltr" value={r.phone || ''} onChange={(e) => upd(i, { phone: e.target.value || null })} aria-label="الجوال" /></td>
              <td><input dir="ltr" value={r.email || ''} onChange={(e) => upd(i, { email: e.target.value || null })} aria-label="البريد" /></td>
              <td>{r.match ? <label className="ri-match"><input type="checkbox" checked={r.use_match} onChange={(e) => upd(i, { use_match: e.target.checked })} /> {r.match.name} <small>({Math.round(r.match.score * 100)}٪{r.match.by !== 'name' ? ' · ' + (r.match.by === 'email' ? 'بريد' : 'جوال') : ''})</small></label> : <small className="ri-muted">جديد</small>}</td>
              <td><button type="button" className="ri-x" onClick={() => setRows((l) => l.filter((_, k) => k !== i))} aria-label="حذف الصفّ"><Icon name="trash" size={14} /></button></td>
            </tr>)}</tbody>
          </table></div>
          <div className="ri-acts">
            <button type="button" className="ri-btn primary" onClick={go} disabled={busy || !selected.length}>{busy ? <Icon name="spinner" size={16} /> : <Icon name="check" size={16} />} استورد {selected.length}</button>
            <button type="button" className="ri-btn" onClick={addRow}><Icon name="plus" size={16} /> صفّ</button>
            <label className="ri-btn"><Icon name="camera" size={16} /> صورة أخرى<input type="file" accept="image/*" multiple capture="environment" hidden onChange={async (e) => { const f = e.target.files; if (!f?.length) return; setStep('ocr'); let add = ''; try { for (let i = 0; i < f.length; i++) { setImgN({ i: i + 1, n: f.length }); const r = await recognize(f[i], { onProgress: setProg }); add += '\n' + r.text; } const t = rawText + add; setRawText(t); setRows((l) => [...l, ...toRows(add)]); } catch (x: any) { setErr(x?.message || 'تعذّرت القراءة'); } setStep('table'); }} /></label>
            <button type="button" className="ri-btn" onClick={() => { setRows([]); setRawText(''); setStep('pick'); }}>من البداية</button>
          </div>
          {err && <p className="ri-err" role="alert">{err}</p>}
        </>}
        {step === 'done' && <div className="ri-pick"><p className="ri-ok"><Icon name="check" size={18} /> استُورد {result?.ok ?? 0}{result?.failed ? ` · تعذّر ${result.failed} (مكرّر غالبًا)` : ''}</p><div className="ri-acts"><button type="button" className="ri-btn primary" onClick={onClose}>إغلاق</button><button type="button" className="ri-btn" onClick={() => { setRows([]); setRawText(''); setStep('pick'); }}>كشف آخر</button></div></div>}
        <p className="ri-foot">القاعدة الذهبية: ما يُقرأ يُعرض للمراجعة ولا يُحفظ قبل «استورد» · لا تُخزَّن الصور.</p>
      </div>
    </div>
  );
}

/** زرّ «صوّر بطاقة عمل» → اسم/بريد/جوال/جهة للتأكيد. */
export function OcrContactButton({ onContact, label = 'صوّر بطاقة عمل', compact = false }: { onContact: (c: Contact) => void; label?: string; compact?: boolean }) {
  const [st, setSt] = useState<'idle' | 'ocr' | 'ask'>('idle'); const [prog, setProg] = useState<OcrProgress | null>(null); const [c, setC] = useState<Contact | null>(null); const [err, setErr] = useState('');
  const run = async (f: File | null) => { if (!f) return; setErr(''); setSt('ocr'); try { const r = await recognize(f, { onProgress: setProg }); const ct = extractContact(r.text); setC(ct); setSt('ask'); } catch (e: any) { setErr(e?.message || 'تعذّرت القراءة'); setSt('idle'); } };
  return <span className="ri-inline">
    <label className="ri-btn" title={label}><Icon name="camera" size={16} /> {!compact && label}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => run(e.target.files?.[0] || null)} /></label>
    {st === 'ocr' && <small aria-live="polite"><Icon name="spinner" size={14} /> {prog?.label_ar || '…'}</small>}
    {st === 'ask' && c && <span className="ri-card" role="group" aria-label="تأكيد بطاقة العمل">
      <div><b>{c.name || '—'}</b>{c.title ? ` · ${c.title}` : ''}{c.org ? ` · ${c.org}` : ''}</div><div dir="ltr">{[c.phone, c.email].filter(Boolean).join(' · ') || '—'}</div>
      <div className="ri-acts"><button type="button" className="ri-btn primary" onClick={() => { onContact(c); setSt('idle'); }}><Icon name="check" size={14} /> استخدم</button><button type="button" className="ri-btn" onClick={() => setSt('idle')}>إلغاء</button></div>
    </span>}
    {err && <small className="ri-err" role="alert">{err}</small>}
    <style>{RI_CSS}</style>
  </span>;
}

const RI_CSS = `
.ri-btn{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:8px 14px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;font-weight:700;cursor:pointer}
.ri-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff}.ri-btn:disabled{opacity:.5;cursor:default}.ri-btn:focus-visible{outline:3px solid #D9A866;outline-offset:2px}
.ri-inline{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;vertical-align:middle}
.ri-card{display:block;background:#F6EBE0;border-radius:12px;padding:8px 10px;font-size:14px;line-height:1.7}
.ri-back{position:fixed;inset:0;background:rgba(34,16,31,.72);z-index:1200;display:flex;align-items:flex-end;justify-content:center}
.ri-sheet{width:min(860px,100%);max-height:94vh;overflow:auto;background:#FBF4EE;border-radius:20px 20px 0 0;padding:14px 16px 18px}
@media(min-width:720px){.ri-back{align-items:center;padding:20px}.ri-sheet{border-radius:20px}}
.ri-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ri-head b{display:inline-flex;gap:6px;align-items:center;font-size:17px;color:#3A1F36}
.ri-x{min-width:40px;min-height:40px;border:0;background:transparent;color:#3A1F36;cursor:pointer;border-radius:10px}
.ri-pick p{line-height:1.9}.ri-tips{color:#6b5560;font-size:14px;line-height:1.9;padding-inline-start:18px}
.ri-prog{padding:20px 6px;line-height:2}.ri-bar{height:10px;background:#F6EBE0;border-radius:6px;overflow:hidden}.ri-bar span{display:block;height:100%;background:#D4614A;transition:width .3s}
.ri-sum{font-size:14px;color:#3A1F36;margin:6px 0}.ri-link{border:0;background:transparent;color:#D4614A;font:inherit;cursor:pointer;text-decoration:underline;margin-inline-start:8px}
.ri-raw textarea{width:100%;font:13px/1.6 monospace;border:1px solid #e6d5c6;border-radius:10px;padding:8px;margin:6px 0}
.ri-tabwrap{overflow:auto;max-height:52vh;border:1px solid #e6d5c6;border-radius:12px;background:#fff}
.ri-tab{width:100%;border-collapse:collapse;font-size:14px}.ri-tab th{position:sticky;top:0;background:#F6EBE0;padding:8px;text-align:right;font-weight:700}.ri-tab td{padding:6px;border-top:1px solid #f0e4d8;vertical-align:top}
.ri-tab input[type=text],.ri-tab input:not([type]){width:100%;min-width:120px;border:1px solid #e6d5c6;border-radius:8px;padding:6px 8px;font:inherit}.ri-tab tr.off td{opacity:.45}
.ri-flag{display:block;color:#b3261e;font-size:11px}.ri-match{font-size:13px;display:inline-flex;gap:4px;align-items:center}.ri-muted{color:#8a7580}
.ri-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.ri-err{color:#b3261e;font-size:13px}.ri-ok{color:#2e7d6f;font-weight:800;display:flex;gap:6px;align-items:center}
.ri-foot{font-size:12px;color:#8a7580;margin:10px 0 0}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
`;
