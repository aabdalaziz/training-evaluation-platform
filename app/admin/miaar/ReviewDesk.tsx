'use client';
/**
 * مِعيار — م15 «مكتب المراجعة»: المراجع يحلّ البند كما يراه المتقدّم، ثمّ يكشف المفتاح، ثمّ يقرّر — بندًا بندًا.
 *  · الطابور: GET ?review=1 (in_review) بالمرشّحات (دفعة · مستوى · مهارة · نوع)
 *  · العرض بمكوّنات المتقدّم نفسها (Matcher/Orderer/Cloze) + أزرار mcq/tfng/الصور
 *  · فحص آلي (reviewChecklist) + المفتاح المقروء (keyText) + المبرّرات
 *  · القرارات: اعتماد A · تعديل E · إرجاع مسودّة R · أرشفة X · تخطٍّ S — والقفل: المستورِد لا يعتمد بنوده (استثناء موثّق للمديرين)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BANK_LEVEL_AR, skillLabel, isCompositeType, ITEM_TYPE_AR } from '../../../lib/miaar/registry';
import { Matcher, Orderer, Cloze, COMPOSITE_CSS, COMP_LABELS_AR } from '../../miaar/Composite';
import { reviewChecklist, keyText, canApprove, APPROVE_REASON_AR, APPROVER_ADMINS } from '../../../lib/miaar/review';

type Opt = { id: string; text: string; image?: string | null; alt?: string | null };
export type QueueItem = {
  id: string; item_code: string; level: string; skill: string; item_type: string; question_text: string; options: Opt[]; status: string;
  descriptor_code: string | null; domain: string | null; difficulty_est: number | null; stimulus: any; media_path: string | null; media_alt: string | null;
  author_notes: any; legacy_extra: any; latest_review_note: string | null; created_by: string | null; created_at?: string; passage_id: string | null;
  correct: string | null; accepted: any; rationale: Record<string, string> | null; batch: string; mine: boolean;
  passage: { id: string; title: string; skill: string; status: string; body: string; audio_public_path: string | null; audio_storage_path: string | null; audio_url: string | null } | null;
};
type Summary = Record<string, { total: Record<string, number>; levels: Record<string, Record<string, number>> }>;

export const BATCH_LABEL: Record<string, string> = { 'athar-m14': 'الفراغات والتسلسل (م14)', 'athar-m13b': 'المطابقة والترتيب (م13-ب)', 'athar-m13a': 'توسعة البنك (م13-أ)', 'athar-m2a': 'بنك مِعيار الجديد (م2-أ)', 'athar-staff': 'بنود الطاقم', 'miaar-legacy': 'التأسيسية' };
const LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS = ['grammar_vocab', 'reading', 'listening'];
const TFNG_AR: Record<string, string> = { a: 'صواب', b: 'خطأ', c: 'غير مذكور' };
const LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

export default function ReviewDesk({ auth, role, onEdit, onChanged }: { auth: () => Promise<Record<string, string>>; role?: string; onEdit: (it: QueueItem) => void; onChanged: () => void }) {
  const [f, setF] = useState({ batch: 'athar-m14', level: '', skill: '', type: '' });
  const [queue, setQueue] = useState<QueueItem[]>([]); const [idx, setIdx] = useState(0); const [loading, setLoading] = useState(false); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null); const [me, setMe] = useState('');
  const [answer, setAnswer] = useState<string | null>(null); const [revealed, setRevealed] = useState(false); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [selfOk, setSelfOk] = useState(false);
  const [session, setSession] = useState({ seen: 0, approved: 0, returned: 0, archived: 0, skipped: 0, matched: 0, solved: 0, started: Date.now() });
  const noteRef = useRef<HTMLInputElement>(null);
  const cur = queue[idx] || null;

  const api = useCallback(async (qs: string) => { const j = await fetch(`/api/admin/miaar/bank${qs}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return null; } return j; }, [auth]);
  const post = useCallback(async (body: Record<string, unknown>) => { setBusy(true); setErr(''); const j = await fetch('/api/admin/miaar/bank', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await auth()) }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => null); setBusy(false); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } return j; }, [auth]);

  const loadSummary = useCallback(async () => { const j = await api('?review_summary=1'); if (j) { setSummary(j.summary); setMe(j.me); } }, [api]);
  useEffect(() => { void loadSummary(); }, [loadSummary]);

  const start = useCallback(async () => {
    setLoading(true); setErr(''); setMsg('');
    const qs = `?review=1&limit=50${f.batch ? `&batch=${f.batch}` : ''}${f.level ? `&level=${f.level}` : ''}${f.skill ? `&skill=${f.skill}` : ''}${f.type ? `&type=${f.type}` : ''}`;
    const j = await api(qs); setLoading(false); if (!j) return;
    setQueue(j.queue); setIdx(0); setAnswer(null); setRevealed(false); setNote(''); setSelfOk(false);
    if (!j.queue.length) setMsg('لا بنود قيد المراجعة بهذه المرشّحات — جرّب دفعة أو مستوى آخر.');
  }, [api, f]);

  const advance = useCallback((kind: 'approved' | 'returned' | 'archived' | 'skipped') => {
    setSession((s) => ({ ...s, seen: s.seen + 1, [kind]: (s as any)[kind] + 1 }));
    setQueue((q) => kind === 'skipped' ? q : q.filter((_, i) => i !== idx)); if (kind === 'skipped') setIdx((i) => i + 1);
    setAnswer(null); setRevealed(false); setNote(''); setSelfOk(false);
  }, [idx]);

  const verdict = useMemo(() => (cur ? canApprove(cur, { id: me, role }, { selfApprove: selfOk, note }) : null), [cur, me, role, selfOk, note]);
  const checks = useMemo(() => (cur ? reviewChecklist(cur) : []), [cur]);
  const amber = checks.filter((c) => !c.ok).length;
  const matched = cur && answer != null && cur.correct != null && answer === cur.correct;

  const reveal = useCallback(() => { if (!cur || revealed) return; setRevealed(true); if (answer != null) setSession((s) => ({ ...s, solved: s.solved + 1, matched: s.matched + (answer === cur.correct ? 1 : 0) })); }, [cur, revealed, answer]);
  const decide = useCallback(async (status: 'approved' | 'draft' | 'archived') => {
    if (!cur || busy) return;
    if (status !== 'approved' && note.trim().length < 3) { setErr('الإرجاع والأرشفة يلزمهما ملاحظة للمؤلّف (3 أحرف فأكثر).'); noteRef.current?.focus(); return; }
    if (status === 'approved' && verdict && !verdict.ok) { setErr(APPROVE_REASON_AR[verdict.reason]); return; }
    const j = await post({ action: 'item_status', ids: [cur.id], status, note: note.trim() || (status === 'approved' ? `مكتب المراجعة — ${revealed ? (matched ? 'حللتُه وطابق المفتاح' : 'راجعتُ المفتاح') : 'اعتماد'}` : ''), self_approve: selfOk || undefined });
    if (!j) return; setMsg(j.note_ar || ''); advance(status === 'approved' ? 'approved' : status === 'draft' ? 'returned' : 'archived'); onChanged(); void loadSummary();
  }, [cur, busy, note, verdict, post, revealed, matched, selfOk, advance, onChanged, loadSummary]);

  useEffect(() => { /* اختصارات: A اعتماد · E تعديل · R إرجاع · X أرشفة · S تخطٍّ · K كشف */
    const h = (e: KeyboardEvent) => { if (!cur) return; const t = e.target as HTMLElement; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return; const k = e.key.toLowerCase();
      if (k === 'a') void decide('approved'); else if (k === 'r') { if (note.trim().length >= 3) void decide('draft'); else noteRef.current?.focus(); } else if (k === 'x') { if (note.trim().length >= 3) void decide('archived'); else noteRef.current?.focus(); } else if (k === 's') advance('skipped'); else if (k === 'e') onEdit(cur); else if (k === 'k') reveal(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [cur, decide, advance, onEdit, reveal, note]);

  const mins = Math.max(1, Math.round((Date.now() - session.started) / 60000));
  const total = summary ? Object.values(summary).reduce((a, b) => a + (b.total.in_review || 0), 0) : null;

  return <div className="rd" data-testid="review-desk"><style>{CSS}{COMPOSITE_CSS}</style>
    <div className="rd-top">
      <div className="rd-intro"><b>مكتب المراجعة</b><p>حُلّ البند كما يراه المتقدّم، ثمّ اكشف المفتاح، ثمّ قرّر. المستورِد لا يعتمد بنوده — الاعتماد بيد مراجع آخر. اختصارات: <kbd>A</kbd> اعتماد · <kbd>K</kbd> كشف · <kbd>E</kbd> تعديل · <kbd>R</kbd> إرجاع · <kbd>X</kbd> أرشفة · <kbd>S</kbd> تخطٍّ.</p></div>
      <div className="rd-session" aria-live="polite"><span>الجلسة</span><b>{session.seen}</b> بندًا · اعتُمد <b>{session.approved}</b> · أُعيد <b>{session.returned}</b> · أُرشف <b>{session.archived}</b> · تخطّيت <b>{session.skipped}</b> · {session.solved ? <>حللتَ {session.solved} طابق منها <b>{session.matched}</b> · </> : null}{mins} د</div>
    </div>

    {summary && <div className="rd-board" data-testid="review-board">
      <div className="rd-board-h"><b>قيد المراجعة الآن: {total}</b><small>لكلّ دفعة: قيد المراجعة / معتمد — انقر مستوىً لبدء طابوره</small></div>
      <table><thead><tr><th>الدفعة</th>{LEVELS.map((l) => <th key={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR] || l}</th>)}<th>المجموع</th></tr></thead>
        <tbody>{Object.entries(summary).filter(([b]) => b !== 'miaar-legacy').sort(([a], [b]) => (BATCH_ORDER[a] ?? 9) - (BATCH_ORDER[b] ?? 9)).map(([b, v]) => <tr key={b}><td><b>{BATCH_LABEL[b] || b}</b></td>
          {LEVELS.map((l) => { const c = v.levels[l] || {}; const ir = c.in_review || 0; const ap = c.approved || 0; return <td key={l} className={ir ? 'has' : ''}>{ir || ap ? <button type="button" className="rd-cell" disabled={!ir} onClick={() => { setF({ ...f, batch: b, level: l }); setTimeout(() => void start(), 0); }} title={`قيد المراجعة ${ir} · معتمد ${ap}`}><b>{ir}</b><span>/{ap}</span></button> : '—'}</td>; })}
          <td><b>{v.total.in_review || 0}</b><span className="rd-dim">/{v.total.approved || 0}</span></td></tr>)}</tbody></table>
    </div>}

    <div className="rd-filters">
      <select value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} aria-label="الدفعة"><option value="">كل الدفعات</option>{Object.entries(BATCH_LABEL).filter(([k]) => k !== 'miaar-legacy').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} aria-label="المستوى"><option value="">كل المستويات</option>{LEVELS.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR] || l}</option>)}</select>
      <select value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} aria-label="المهارة"><option value="">كل المهارات</option>{SKILLS.map((s) => <option key={s} value={s}>{skillLabel(s)}</option>)}</select>
      <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="النوع"><option value="">كل الأنواع</option>{Object.entries(ITEM_TYPE_AR).filter(([k]) => !['writing_task', 'speaking_task', 'word_tap', 'short_dictation'].includes(k)).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <button type="button" className="mm-hbtn" disabled={loading} onClick={() => void start()} data-testid="review-start">{loading ? '…' : queue.length ? 'تحديث الطابور' : 'ابدأ المراجعة'}</button>
      {queue.length > 0 && <span className="rd-count">المتبقّي في الطابور: <b>{queue.length - idx}</b></span>}
    </div>
    {err && <p className="am-err" role="alert">{err}</p>}{msg && !err && <p className="bk-ok" role="status">{msg}</p>}

    {cur && <div className="rd-card" data-testid="review-card">
      <div className="rd-meta">
        <code>{cur.item_code}</code><span>{BANK_LEVEL_AR[cur.level as keyof typeof BANK_LEVEL_AR] || cur.level}</span><span>{skillLabel(cur.skill)}</span><span className="rd-type">{ITEM_TYPE_AR[cur.item_type as keyof typeof ITEM_TYPE_AR] || cur.item_type}</span>
        {cur.descriptor_code && <span>الواصف {cur.descriptor_code}</span>}<span>{BATCH_LABEL[cur.batch] || cur.batch}</span>
        {cur.mine && <span className="rd-mine" data-testid="review-mine">أنت المستورِد — لا تعتمد بندك</span>}
        {cur.latest_review_note && <span className="rd-prev" title="آخر ملاحظة مراجعة">📝 {cur.latest_review_note}</span>}
      </div>

      <div className="rd-body">
        <div className="rd-stage" dir="rtl" lang="ar">
          {cur.passage && <div className="rd-passage"><b>{cur.passage.title}</b>{cur.passage.status !== 'approved' && <em> ({cur.passage.status})</em>}
            {cur.passage.skill === 'listening' && (cur.passage.audio_url ? <audio controls preload="none" src={cur.passage.audio_url} /> : <em className="rd-warn"> بلا صوت</em>)}
            <details open={cur.passage.skill === 'reading'}><summary>{cur.passage.skill === 'listening' ? 'نصّ المقطع (للمراجع فقط)' : 'النصّ'}</summary><p className="rd-ptext">{cur.passage.body}</p></details></div>}
          {cur.stimulus?.image && <img className="rd-stim" src={cur.stimulus.image} alt={cur.stimulus.alt || cur.media_alt || ''} />}
          {cur.item_type !== 'cloze_bank' && <h3 className="rd-stem">{cur.question_text}</h3>}
          {cur.item_type === 'matching' && <Matcher key={cur.id} left={cur.stimulus?.left || []} options={cur.options} value={answer} disabled={revealed} onComplete={setAnswer} labels={COMP_LABELS_AR} />}
          {(cur.item_type === 'ordering' || cur.item_type === 'picture_sequence') && <Orderer key={cur.id} options={cur.options} value={answer} disabled={revealed} onComplete={setAnswer} labels={COMP_LABELS_AR} pictures={cur.item_type === 'picture_sequence'} />}
          {cur.item_type === 'cloze_bank' && <Cloze key={cur.id} text={cur.question_text} options={cur.options} value={answer} disabled={revealed} onComplete={setAnswer} labels={COMP_LABELS_AR} />}
          {!isCompositeType(cur.item_type) && <div className="rd-opts" role="radiogroup">{cur.options.map((o, i) => <button key={o.id} type="button" role="radio" aria-checked={answer === o.id} disabled={revealed} className={`mi-opt${answer === o.id ? ' on' : ''}${revealed && cur.correct === o.id ? ' key' : ''}`} onClick={() => setAnswer(o.id)} data-testid="review-opt">
            <span className="mi-letter">{LETTERS[i]}</span>{o.image ? <img src={o.image} alt={o.alt || o.text || ''} /> : <span>{cur.item_type === 'true_false_notgiven' ? TFNG_AR[o.id] || o.text : o.text}</span>}<span className="mi-check" aria-hidden="true">{revealed && cur.correct === o.id ? '★' : answer === o.id ? '✓' : ''}</span>
          </button>)}</div>}
          <div className="rd-reveal">
            {!revealed ? <button type="button" className="mm-hbtn" onClick={reveal} data-testid="review-reveal">{answer != null ? 'كشف المفتاح ومقارنة إجابتي' : 'كشف المفتاح بلا حلّ'} <kbd>K</kbd></button>
              : <div className={`rd-verdict ${answer == null ? 'na' : matched ? 'ok' : 'bad'}`} data-testid="review-verdict">
                {answer == null ? 'كُشف المفتاح بلا حلّ' : matched ? '✓ إجابتك تطابق المفتاح' : `✗ إجابتك (${answer}) تختلف عن المفتاح — من المخطئ: أنت أم البند؟`}
                <div className="rd-key"><b>المفتاح:</b> <code>{cur.correct || '—'}</code> — {keyText(cur)}</div>
                {cur.rationale && <ul className="rd-rat">{Object.entries(cur.rationale).map(([k, v]) => <li key={k}><b>{k}</b> {String(v)}</li>)}</ul>}
              </div>}
          </div>
        </div>

        <aside className="rd-side">
          <div className="rd-checks" data-testid="review-checks"><b>الفحص الآلي {amber ? <span className="rd-amber">{amber} يستحقّ نظرة</span> : <span className="rd-green">كلّه أخضر</span>}</b>
            <ul>{checks.map((c) => <li key={c.code} className={c.ok ? 'ok' : 'warn'}>{c.ok ? '●' : '▲'} {c.msg}</li>)}</ul>
          </div>
          <div className="rd-human"><b>عين المراجع</b><ol><li>حلّ واحد لا غير (لا يصلح مشتّت ولا تتبادل كلمتان).</li><li>اللغة سليمة والمستوى مناسب للواصف.</li><li>المبرّر يشرح لماذا هذا وليس ذاك.</li><li>القراءة/الاستماع: الجواب من المقطع فعلًا.</li></ol></div>
          <label className="rd-note">ملاحظة للمؤلّف <small>(إلزامية للإرجاع/الأرشفة)</small><input ref={noteRef} value={note} onChange={(e) => setNote(e.target.value)} placeholder="مثال: الفراغ 2 يقبل أيضًا «على» — بدّل المشتّت" /></label>
          {cur.mine && APPROVER_ADMINS.includes(String(role || '').toUpperCase()) && <label className="rd-self"><input type="checkbox" checked={selfOk} onChange={(e) => setSelfOk(e.target.checked)} /> اعتماد ذاتي استثنائي (مدير) — يُسجَّل في التدقيق ويلزمه ملاحظة</label>}
          <div className="rd-actions">
            <button type="button" className="bk-act ok" disabled={busy || !!(verdict && !verdict.ok)} title={verdict && !verdict.ok ? APPROVE_REASON_AR[verdict.reason] : 'اعتماد (A)'} onClick={() => void decide('approved')} data-testid="review-approve">اعتماد <kbd>A</kbd></button>
            <button type="button" className="bk-act" disabled={busy} onClick={() => onEdit(cur)} data-testid="review-edit">تعديل <kbd>E</kbd></button>
            <button type="button" className="bk-act" disabled={busy} onClick={() => void decide('draft')} data-testid="review-return">إرجاع مسودّة <kbd>R</kbd></button>
            <button type="button" className="bk-act danger" disabled={busy} onClick={() => void decide('archived')} data-testid="review-archive">أرشفة <kbd>X</kbd></button>
            <button type="button" className="bk-soft" disabled={busy} onClick={() => advance('skipped')} data-testid="review-skip">تخطٍّ <kbd>S</kbd></button>
          </div>
          {verdict && !verdict.ok && <p className="rd-lock" data-testid="review-lock">🔒 {APPROVE_REASON_AR[verdict.reason]}</p>}
        </aside>
      </div>
    </div>}
    {!cur && queue.length > 0 && idx >= queue.length && <p className="bk-ok">انتهى الطابور (تخطّيت {session.skipped}). «تحديث الطابور» يعيد ما تخطّيته.</p>}
  </div>;
}

const BATCH_ORDER: Record<string, number> = { 'athar-m14': 0, 'athar-m13b': 1, 'athar-m13a': 2, 'athar-m2a': 3, 'athar-staff': 4 };

const CSS = `
.rd{display:grid;gap:12px}.rd kbd{font:600 11px/1 ui-monospace,monospace;border:1px solid #cbd5e1;border-bottom-width:2px;border-radius:4px;padding:1px 5px;background:#f8fafc;color:#475569;margin-inline-start:4px}
.rd-top{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.rd-intro{border:1px dashed #c9a24b;background:#fffbea;border-radius:12px;padding:10px 12px;max-width:760px}.rd-intro p{margin:4px 0 0;font-size:13px;color:#475569}
.rd-session{font-size:13px;color:#475569;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;background:#fff}.rd-session span{font-weight:800;margin-inline-end:6px;color:#0f172a}
.rd-board{border:1px solid #e2e8f0;border-radius:12px;background:#fff;padding:8px 10px;overflow:auto}.rd-board-h{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px}.rd-board-h small{color:#64748b}
.rd-board table{border-collapse:collapse;width:100%;font-size:13px}.rd-board th,.rd-board td{padding:4px 6px;text-align:center;border-bottom:1px solid #f1f5f9;white-space:nowrap}.rd-board td:first-child{text-align:start}.rd-board td.has{background:#fffbea}
.rd-cell{border:1px solid #e2e8f0;border-radius:8px;background:#fff;padding:3px 8px;cursor:pointer;font:inherit}.rd-cell:disabled{cursor:default;opacity:.6}.rd-cell b{color:#b45309}.rd-cell span,.rd-dim{color:#94a3b8;font-size:11px}
.rd-filters{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.rd-filters select{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;background:#fff}.rd-count{font-size:13px;color:#475569}
.rd-card{border:1px solid #c9a24b;border-radius:14px;background:#fff;overflow:hidden}.rd-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:8px 12px;background:#fffbea;border-bottom:1px solid #f1e3b3;font-size:13px}.rd-meta code{font-weight:800}.rd-meta span{color:#475569}.rd-type{border:1px solid #c9a24b;border-radius:999px;padding:1px 8px;color:#8a6d1f!important;font-weight:700}
.rd-mine{background:#fee2e2;color:#991b1b!important;border-radius:999px;padding:1px 8px;font-weight:800}.rd-prev{color:#0f766e!important}
.rd-body{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:0}@media (max-width:900px){.rd-body{grid-template-columns:1fr}}
.rd-stage{padding:14px 16px;display:grid;gap:12px;font-family:var(--font-read),"Noto Naskh Arabic",serif;font-size:17px;line-height:1.9;color:#0f172a}
.rd-passage{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc}.rd-passage audio{display:block;width:100%;margin:6px 0}.rd-passage summary{cursor:pointer;font-size:13px;color:#475569}.rd-ptext{white-space:pre-wrap;margin:6px 0 0;font-size:16px}.rd-warn{color:#b91c1c}
.rd-stim{max-width:260px;max-height:200px;object-fit:contain}.rd-stem{margin:0;font-size:1.15em;font-weight:700}
.rd-opts{display:grid;gap:8px}.rd-stage .mi-opt{display:flex;align-items:center;gap:12px;width:100%;text-align:start;border:2px solid #cbd5e1;border-radius:12px;background:#fff;padding:10px 14px;font:inherit;cursor:pointer;min-height:48px}.rd-stage .mi-opt.on{border-color:#0b8a83;background:#ecfdf5}.rd-stage .mi-opt.key{border-color:#b45309;background:#fff7ed}.rd-stage .mi-opt:disabled{cursor:default}
.rd-stage .mi-opt img{width:72px;height:72px;object-fit:contain}.rd-stage .mi-letter{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#e2e8f0;font-weight:800;font-size:14px;flex:none}.rd-stage .mi-check{margin-inline-start:auto;color:#0b8a83;font-weight:800}.rd-stage .mi-muted{color:#64748b;font-size:.9em;margin:0}
.rd-reveal{margin-top:4px}.rd-verdict{border-radius:12px;padding:10px 12px;font-weight:700}.rd-verdict.ok{background:#ecfdf5;color:#065f46}.rd-verdict.bad{background:#fef2f2;color:#991b1b}.rd-verdict.na{background:#f1f5f9;color:#334155}
.rd-key{font-weight:400;margin-top:6px;color:#0f172a}.rd-rat{margin:6px 0 0;padding-inline-start:18px;font-weight:400;font-size:.95em;color:#334155}.rd-rat li b{margin-inline-end:4px;color:#8a6d1f}
.rd-side{border-inline-start:1px solid #f1f5f9;padding:12px;display:grid;gap:10px;align-content:start;background:#fcfcfd;font-size:13px}
.rd-checks ul,.rd-human ol{margin:6px 0 0;padding-inline-start:16px}.rd-checks li{list-style:none;margin-inline-start:-16px}.rd-checks li.ok{color:#047857}.rd-checks li.warn{color:#b45309;font-weight:700}.rd-amber{color:#b45309;margin-inline-start:6px}.rd-green{color:#047857;margin-inline-start:6px}
.rd-human{color:#475569}.rd-human li{margin:2px 0}
.rd-note{display:grid;gap:4px}.rd-note input{border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:inherit}.rd-note small{color:#94a3b8}
.rd-self{display:flex;gap:6px;align-items:flex-start;color:#991b1b;font-weight:700}
.rd-actions{display:flex;flex-wrap:wrap;gap:6px}.rd-actions .bk-act.danger{border-color:#fca5a5;color:#991b1b}.rd-lock{margin:0;color:#991b1b;font-weight:700}
`;
