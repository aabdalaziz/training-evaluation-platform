'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م13-ج «لوحة الإرث» — تبويب «التأسيسية» داخل محرّر بنك مِعيار
 *  عدّاد «رُوجع x/y» وجدول بالمستوى · قائمة البنود القديمة بمرشّح النتيجة (لم يُراجَع · بقي · طُوِّر · أُرشف) مع إحصاءات الميزان
 *  · أزرار نتيجة المراجعة للمحدَّد · «أرشفة ما لم يُراجَع» (للمديرين، بتأكيد نصّي) — لا شيء هنا آليّ.
 */
import { useEffect, useState } from 'react';
import { BANK_LEVEL_AR, skillLabel } from '../../../lib/miaar/registry';
import { HERITAGE_OUTCOME_AR } from '../../../lib/miaar/heritage';

type Sum = { total: number; reviewed: number; pending: number; by_outcome: Record<string, number>; by_status: Record<string, number>; dupes: number; levels: Array<{ level: string; total: number; reviewed: number; pending: number; approved: number; archived: number }> };
type Item = { id: string; item_code: string; level: string; skill: string; status: string; question_text: string; legacy_extra: any; stats: { n: number; p: number | null; rpb: number | null; flags: string[] } | null; latest_review_note?: string | null };
const STATUS_AR: Record<string, string> = { draft: 'مسودّة', in_review: 'قيد المراجعة', approved: 'معتمد', archived: 'مؤرشف' };
const FLAGS = ['legacy_recheck', 'kept', 'upgraded', 'retired'];

export default function BankHeritage({ auth, isAdmin, onChanged, onEdit }: { auth: () => Promise<Record<string, string>>; isAdmin: boolean; onChanged: () => void; onEdit?: (it: Item) => void }) {
  const [sum, setSum] = useState<Sum | null>(null); const [flag, setFlag] = useState('legacy_recheck'); const [level, setLevel] = useState(''); const [items, setItems] = useState<Item[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set()); const [note, setNote] = useState(''); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [confirmText, setConfirmText] = useState('');
  const LIMIT = 40;
  async function api(qs: string) { const j = await fetch(`/api/admin/miaar/bank${qs}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return null; } return j; }
  async function post(body: any) { setBusy(body.action); setErr(''); setMsg(''); try { const j = await fetch('/api/admin/miaar/bank', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } setMsg(j.note_ar || 'تمّ'); return j; } catch { setErr('تعذّر الاتصال'); return null; } finally { setBusy(''); } }
  async function load(off = 0) {
    const qs = new URLSearchParams({ batch: 'miaar-legacy', review_flag: flag, offset: String(off), limit: String(LIMIT) }); if (level) qs.set('level', level);
    const [j, h] = await Promise.all([api(`?${qs.toString()}`), api('?heritage=1')]); if (j) { setItems(j.items); setTotal(j.total); setOffset(off); setSel(new Set()); } if (h) setSum(h.heritage);
  }
  useEffect(() => { void load(0); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flag, level]);
  const mark = async (outcome: string) => { if (!sel.size) return; const j = await post({ action: 'heritage_mark', ids: [...sel], outcome, note }); if (j) { await load(offset); onChanged(); } };
  const archiveAll = async () => { if (confirmText !== 'أرشفة') { setErr('اكتب «أرشفة» في خانة التأكيد'); return; } if (!window.confirm(`ستُؤرشف ${sum?.pending || 0} بندًا لم يُراجَع من التأسيسية وتخرج من الاختبار الحيّ. متابعة؟`)) return; const j = await post({ action: 'heritage_archive_unreviewed', confirm: confirmText, note }); if (j) { setConfirmText(''); await load(0); onChanged(); } };
  const pct = sum && sum.total ? Math.round((100 * sum.reviewed) / sum.total) : 0;
  return <section className="bk-heritage" data-testid="bank-heritage">
    <div className="bk-studio"><b>الدفعة التأسيسية (miaar-legacy)</b><p>قرار المالك (م2-ب): البنك القديم <b>يُراجَع ويُطوَّر</b> ولا يُؤرشف آليًا. راجع كل بند ثم سجّل نتيجته: <b>بقي</b> (يستمرّ كما هو) · <b>طُوِّر</b> (أُعيدت كتابته في دفعة أَثَر) · <b>أُرشف</b> (يخرج من الاختبار). الاعتماد/الإعادة من تبويب «البنود».</p></div>
    {err && <p className="am-err" role="alert">{err}</p>}{msg && <p className="bk-ok" role="status">{msg}</p>}
    {sum && <div className="bk-her-sum" data-testid="her-sum">
      <div className="bk-her-counter"><b>رُوجع {sum.reviewed}/{sum.total}</b><div className="bk-her-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div><small>{sum.pending} لم يُراجَع · {sum.by_outcome.kept || 0} بقي · {sum.by_outcome.upgraded || 0} طُوِّر · {sum.by_outcome.retired || 0} أُرشف · مكرّرات {sum.dupes}</small></div>
      <table className="mm-t bk-her-t"><thead><tr><th>المستوى</th><th>المجموع</th><th>رُوجع</th><th>لم يُراجَع</th><th>معتمد</th><th>مؤرشف</th></tr></thead>
        <tbody>{sum.levels.map((l) => <tr key={l.level} className={level === l.level ? 'on' : ''} onClick={() => setLevel(level === l.level ? '' : l.level)} style={{ cursor: 'pointer' }}><td>{BANK_LEVEL_AR[l.level as keyof typeof BANK_LEVEL_AR] || l.level}</td><td>{l.total}</td><td>{l.reviewed}</td><td><b>{l.pending}</b></td><td>{l.approved}</td><td>{l.archived}</td></tr>)}</tbody></table>
    </div>}
    <div className="bk-filters">
      <select value={flag} onChange={(e) => setFlag(e.target.value)} aria-label="نتيجة المراجعة" data-testid="her-flag">{FLAGS.map((f) => <option key={f} value={f}>{HERITAGE_OUTCOME_AR[f]}</option>)}</select>
      <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="المستوى"><option value="">كل المستويات</option>{sum?.levels.map((l) => <option key={l.level} value={l.level}>{BANK_LEVEL_AR[l.level as keyof typeof BANK_LEVEL_AR] || l.level}</option>)}</select>
      <span className="bk-count"><b>{total}</b> بندًا</span>
      <span className="bk-pager"><button type="button" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - LIMIT))}>السابق</button><button type="button" disabled={offset + LIMIT >= total} onClick={() => void load(offset + LIMIT)}>التالي</button></span>
    </div>
    <div className="bk-row">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة (اختياري)" aria-label="ملاحظة" />
      <span>محدّد: <b>{sel.size}</b></span>
      <button type="button" className="bk-act ok" disabled={!sel.size || !!busy} onClick={() => void mark('kept')} data-testid="her-kept">بقي</button>
      <button type="button" className="bk-act" disabled={!sel.size || !!busy} onClick={() => void mark('upgraded')} data-testid="her-upgraded">طُوِّر</button>
      <button type="button" className="bk-act warn" disabled={!sel.size || !!busy} onClick={() => void mark('retired')} data-testid="her-retired">أُرشف</button>
    </div>
    <div className="bk-tablewrap"><table className="mm-t bk-t" data-testid="her-table"><thead><tr><th><input type="checkbox" aria-label="تحديد الكل" checked={!!items.length && sel.size === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th><th>الرمز</th><th>المستوى</th><th>المهارة</th><th>النص</th><th>الميزان</th><th>الحالة</th><th>النتيجة</th><th></th></tr></thead>
      <tbody>{items.map((it) => <tr key={it.id} className={it.legacy_extra?.duplicate_of ? 'dup' : ''}>
        <td><input type="checkbox" aria-label={it.item_code} checked={sel.has(it.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(it.id); else n.delete(it.id); setSel(n); }} /></td>
        <td><code>{it.item_code}</code></td><td>{BANK_LEVEL_AR[it.level as keyof typeof BANK_LEVEL_AR] || it.level}</td><td>{skillLabel(it.skill)}</td>
        <td className="bk-stem">{it.question_text.slice(0, 90)}{it.legacy_extra?.duplicate_of && <small className="bk-dup">مكرّر لـ {it.legacy_extra.duplicate_of}</small>}{it.latest_review_note && <small>{it.latest_review_note}</small>}</td>
        <td><StatChip stats={it.stats} /></td>
        <td><span className={`bk-st ${it.status}`}>{STATUS_AR[it.status] || it.status}</span></td>
        <td><small>{HERITAGE_OUTCOME_AR[it.legacy_extra?.review_flag || 'legacy_recheck']}</small></td>
        <td className="bk-acts">{onEdit && <button type="button" className="bk-act" onClick={() => onEdit(it)}>تعديل</button>}</td>
      </tr>)}
        {!items.length && <tr><td colSpan={9} className="am-empty">لا بنود مطابقة.</td></tr>}
      </tbody></table></div>
    {isAdmin && <div className="bk-her-danger" data-testid="her-archive-box">
      <b>إغلاق الملف — أرشفة ما لم يُراجَع ({sum?.pending || 0})</b>
      <p className="mm-note">يدويّ وبيد المدير فقط: يُخرج كل بند تأسيسي لم تُسجَّل له نتيجة من الاختبار الحيّ. اكتب «أرشفة» للتأكيد.</p>
      <div className="bk-row"><input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="أرشفة" aria-label="تأكيد الأرشفة" data-testid="her-confirm" /><button type="button" className="bk-act danger" disabled={!!busy || !sum?.pending} onClick={() => void archiveAll()} data-testid="her-archive-all">أرشفة ما لم يُراجَع</button></div>
    </div>}
  </section>;
}

/** شارة إحصاءات الميزان (م3): n · p · rpb · أعلام خارج النطاق — تُستعمل في تبويب البنود أيضًا */
export function StatChip({ stats }: { stats: { n: number; p: number | null; rpb: number | null; flags: string[] } | null }) {
  if (!stats || !stats.n) return <small className="bk-stat none" title="لا إجابات بعد — «تجربة صامتة» حتى 30 إجابة">—</small>;
  const flagged = stats.flags.length > 0; const low = stats.n < 30;
  return <small className={`bk-stat${flagged ? ' flag' : ''}${low ? ' low' : ''}`} dir="ltr" title={flagged ? `خارج النطاق: ${stats.flags.join(' · ')}` : low ? 'أقل من 30 إجابة — مؤقّت' : 'ضمن النطاق'} data-testid="bk-stat">
    n{stats.n} · p{stats.p == null ? '—' : stats.p.toFixed(2)} · r{stats.rpb == null ? '—' : stats.rpb.toFixed(2)}{flagged ? ' ⚑' : ''}
  </small>;
}
