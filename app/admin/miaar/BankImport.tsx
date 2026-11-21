'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م13-ج «المستورِد» — تبويب «استيراد» داخل محرّر بنك مِعيار
 *  ملف أو لصق JSON بصيغة miaar-pack-1 → «فحص» (تشغيل جافّ: بنية + قاعدة، لا يكتب شيئًا) → «استيراد» (كل البنود قيد المراجعة؛ المستورِد = المؤلّف).
 *  أسفل: آخر الدفعات المستورَدة من question_bank_import_batches. لا اعتماد هنا — الاعتماد من تبويب «البنود» بيد مراجع غير المستورِد.
 */
import { useEffect, useState } from 'react';

type Res = { success: boolean; error?: string; problems?: Array<{ at: string; msg: string }>; warnings?: Array<{ at: string; msg: string }>; summary?: any; report?: any; note_ar?: string };
type Batch = { id: string; source: string; content_version: string; status: string; total: number; imported: number; rejected: number; created_at: string };
const LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const TYPE_AR: Record<string, string> = { mcq: 'اختيار من متعدد', picture_choice: 'اختيار صورة', picture_label: 'تسمية صورة', true_false_notgiven: 'صواب/خطأ/غير مذكور', writing_task: 'مهمة كتابة', speaking_task: 'مهمة تحدّث' };
const EXAMPLE = '{"version":"miaar-pack-1","source":"athar-m13a-A1-1","content_version":"athar-m13a","passages":[…],"items":[{"item_code":"AR-LU-A1-M13-001","level":"A1","skill":"grammar_vocab","item_type":"mcq","question_text":"…","options":[{"id":"a","text":"…"}],"correct":"a","descriptor_code":"LU-A1-01","unit_codes":["A1-U01"],"rationale":{"a":"…"}}]}';

export default function BankImport({ auth, onChanged }: { auth: () => Promise<Record<string, string>>; onChanged: () => void }) {
  const [text, setText] = useState(''); const [fileName, setFileName] = useState(''); const [res, setRes] = useState<Res | null>(null); const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [batches, setBatches] = useState<Batch[]>([]);
  async function loadBatches() { const j = await fetch('/api/admin/miaar/bank?imports=1', { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setBatches(j.imports); }
  useEffect(() => { void loadBatches(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const parse = () => { try { const p = JSON.parse(text); setErr(''); return p; } catch { setErr('JSON غير صالح'); return null; } };
  const onFile = (f: File | null) => { if (!f) return; setFileName(f.name); const r = new FileReader(); r.onload = () => { setText(String(r.result || '')); setRes(null); setChecked(false); }; r.readAsText(f); };
  async function run(action: 'pack_validate' | 'pack_import') {
    const pack = parse(); if (!pack) return; setBusy(action); setErr('');
    try { const j: Res = await fetch('/api/admin/miaar/bank', { method: 'POST', headers: await auth(), body: JSON.stringify({ action, pack, file_name: fileName || undefined }) }).then((r) => r.json()); setRes(j); if (j.success && action === 'pack_validate') setChecked(true); if (j.success && action === 'pack_import') { setChecked(false); onChanged(); void loadBatches(); } }
    catch { setErr('تعذّر الاتصال'); } finally { setBusy(''); }
  }
  const s = res?.summary; const r = res?.report; const canImport = checked && res?.success && (r?.items_created > 0 || r?.tasks_created > 0);
  return <section className="bk-import" data-testid="bank-import">
    <div className="bk-studio"><b>استيراد دفعة بنود</b><p>صيغة <code>miaar-pack-1</code>: مقاطع + بنود (الأنواع الحيّة الأربعة) + مهام اختيارية. تدخل البنود كلّها <b>قيد المراجعة</b> باسم دفعتها، ولا يُمَسّ بند قائم ولا مقطع قائم. من يستورد لا يعتمد ما استورده — الاعتماد من تبويب «البنود» بيد مراجع آخر.</p></div>
    <div className="bk-row">
      <input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0] || null)} aria-label="ملف الحزمة" data-testid="imp-file" />
      <button type="button" className="bk-soft" disabled={!text || !!busy} onClick={() => void run('pack_validate')} data-testid="imp-validate">{busy === 'pack_validate' ? 'يفحص…' : 'فحص (تشغيل جافّ)'}</button>
      <button type="button" className="bk-primary" disabled={!canImport || !!busy} title={!checked ? 'افحص أولًا' : ''} onClick={() => { if (window.confirm(`استيراد ${r?.items_created || 0} بندًا و${r?.tasks_created || 0} مهمة و${r?.passages_created || 0} مقطعًا إلى الدفعة ${s?.content_version} قيد المراجعة؟`)) void run('pack_import'); }} data-testid="imp-import">{busy === 'pack_import' ? 'يستورد…' : 'استيراد'}</button>
    </div>
    <textarea value={text} onChange={(e) => { setText(e.target.value); setRes(null); setChecked(false); }} placeholder={`أو الصق JSON هنا: ${EXAMPLE}`} aria-label="محتوى الحزمة" className="bk-imp-text" rows={6} data-testid="imp-text" />
    {err && <p className="am-err" role="alert">{err}</p>}
    {res && <div className="bk-imp-res" data-testid="imp-res">
      {res.success ? <>
        <p className="bk-ok" role="status">{res.note_ar}</p>
        <div className="bk-imp-grid">
          <div><b>الحزمة</b> {s.source} → <code>{s.content_version}</code> · {s.items} بندًا · {s.tasks} مهمة · {s.passages} مقطعًا</div>
          <div><b>بالمستوى:</b> {LEVELS.filter((l) => s.by_level[l]).map((l) => `${l} ${s.by_level[l]}`).join(' · ') || '—'}</div>
          <div><b>بالنوع:</b> {Object.entries(s.by_type as Record<string, number>).map(([k, v]) => `${TYPE_AR[k] || k} ${v}`).join(' · ') || '—'}</div>
          {r && <div><b>{r.dry_run ? 'سيحدث عند الاستيراد' : 'النتيجة'}:</b> بنود {r.items_created} · مهام {r.tasks_created} · مقاطع جديدة {r.passages_created}{r.passages_existing?.length ? ` · مقاطع قائمة تُركت ${r.passages_existing.length}` : ''}{r.skipped_existing?.length ? ` · رموز موجودة تُخُطّيت ${r.skipped_existing.length}` : ''}{r.rejected?.length ? ` · مرفوض ${r.rejected.length}` : ''}{r.possible_duplicates?.length ? ` · تكرار محتمل ${r.possible_duplicates.length}` : ''}{r.batch_id ? ` · رقم الدفعة ${String(r.batch_id).slice(0, 8)}` : ''}</div>}
        </div>
        {r?.rejected?.length > 0 && <ul className="bk-imp-warn" data-testid="imp-rejected">{r.rejected.slice(0, 40).map((x: any, i: number) => <li key={i}><code>{x.item_code}</code> — {x.msg}</li>)}</ul>}
        {r?.possible_duplicates?.length > 0 && <ul className="bk-imp-note" data-testid="imp-dupes">{r.possible_duplicates.slice(0, 40).map((x: any, i: number) => <li key={i}><code>{x.item_code}</code> يشبه <code>{x.of}</code> — يُستورد ويُعلَّم في ملاحظات المؤلّف</li>)}</ul>}
        {s.warnings?.length > 0 && <details className="bk-imp-details"><summary>تحذيرات غير مانعة ({s.warnings.length})</summary><ul className="bk-imp-warn">{s.warnings.map((w: any, i: number) => <li key={i}>{w.at}: {w.msg}</li>)}</ul></details>}
      </> : <>
        <p className="am-err" role="alert">{res.error}</p>
        {res.problems && <ul className="bk-imp-warn" data-testid="imp-problems">{res.problems.map((p, i) => <li key={i}>{p.at}: {p.msg}</li>)}</ul>}
      </>}
    </div>}
    <h4 className="bk-imp-h">آخر الدفعات المستورَدة</h4>
    {!batches.length ? <p className="am-empty" data-testid="imp-empty">لا دفعات مستورَدة بعد.</p>
      : <div className="bk-tablewrap"><table className="mm-t bk-t" data-testid="imp-batches"><thead><tr><th>المصدر</th><th>الدفعة</th><th>الحالة</th><th>الصفوف</th><th>أُدخل</th><th>رُفض</th><th>التاريخ</th></tr></thead>
        <tbody>{batches.map((b) => <tr key={b.id}><td>{b.source}</td><td><code>{b.content_version}</code></td><td>{b.status === 'completed' ? 'مكتملة' : b.status}</td><td>{b.total}</td><td>{b.imported}</td><td>{b.rejected}</td><td><small dir="ltr">{String(b.created_at).slice(0, 16).replace('T', ' ')}</small></td></tr>)}</tbody></table></div>}
  </section>;
}
