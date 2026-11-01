'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * محرّر بنك مِعيار (م2-أ) — داخل /admin/miaar/bank
 *  بنود: تصفية (مستوى · مهارة · حالة · دفعة · نوع · بحث · مكرّرات) · تحرير بند (النص · الخيارات · المفتاح · الواصف · المجال · الصعوبة · المقطع · الصورة)
 *  · حالة بند/بنود · «مراجعة الدفعة» (اعتماد athar-m2a كلّها أو مستوىً واحدًا) · «أرشفة القديم» · إنشاء بند
 *  مقاطع: تحرير العنوان/النص/الحالة · رفع MP3 إلى الدلو · إنشاء مقطع · «استوديو مِعيار» (الصوت يُنتَج خارج الخادم ويُرفع هنا)
 *  القرار الأكاديمي بيد الطاقم.
 */
import { useEffect, useState } from 'react';
import { BANK_LEVEL_AR, skillLabel } from '../../../lib/miaar/registry';

type Opt = { id: string; text: string; image?: string | null; alt?: string | null };
type Item = { id: string; item_code: string; content_version: string; level: string; skill: string; passage_id: string | null; question_text: string; options: Opt[]; item_type: string; status: string; descriptor_code: string | null; domain: string | null; difficulty_est: number | null; media_path: string | null; media_alt: string | null; author_notes: any; legacy_extra: any; latest_review_note: string | null; correct: string | null; batch: string; passage: { id: string; title: string; skill: string; status: string; audio_public_path: string | null; audio_storage_path: string | null } | null };
type Passage = { id: string; level: string; skill: string; title: string; body: string; status: string; source: string; version: string | null; audio_public_path: string | null; audio_storage_path: string | null; meta: any };
type Desc = { code: string; level: string; mode: string; text_ar: string };
const LEVELS_ALL = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS_ALL = ['grammar_vocab', 'reading', 'listening'];
const STATUS_AR: Record<string, string> = { draft: 'مسودّة', in_review: 'قيد المراجعة', approved: 'معتمد', archived: 'مؤرشف' };
const TYPE_AR: Record<string, string> = { mcq: 'اختيار من متعدد', picture_choice: 'اختيار صورة', picture_label: 'تسمية صورة', true_false_notgiven: 'صواب/خطأ/غير مذكور' };
const DOMAIN_AR: Record<string, string> = { personal: 'شخصي', public: 'عام', educational: 'تعليمي', professional: 'مهني' };
const BATCH_AR: Record<string, string> = { 'athar-m2a': 'بنك مِعيار الجديد (م2-أ)', 'miaar-legacy': 'البنك القديم (مِعيار)', 'athar-staff': 'بنود الطاقم' };
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function BankEditor({ auth, byBatch, onChanged }: { auth: () => Promise<Record<string, string>>; byBatch: Record<string, Record<string, number>>; onChanged: () => void }) {
  const [view, setView] = useState<'items' | 'passages'>('items');
  const [f, setF] = useState({ level: '', skill: '', status: '', batch: 'athar-m2a', type: '', q: '', dupes: false });
  const [items, setItems] = useState<Item[]>([]); const [total, setTotal] = useState(0); const [offset, setOffset] = useState(0); const LIMIT = 40;
  const [sel, setSel] = useState<Set<string>>(new Set()); const [edit, setEdit] = useState<Item | null>(null); const [draft, setDraft] = useState<any>(null);
  const [descs, setDescs] = useState<Desc[]>([]); const [passages, setPassages] = useState<Passage[]>([]); const [pEdit, setPEdit] = useState<Passage | null>(null);
  const [busy, setBusy] = useState(''); const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [note, setNote] = useState(''); const [batchLevel, setBatchLevel] = useState('');
  const [creating, setCreating] = useState(false); const [newP, setNewP] = useState({ id: '', level: 'A1', skill: 'reading', title: '', body: '' });

  async function api(qs: string) { const j = await fetch(`/api/admin/miaar/bank${qs}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return null; } return j; }
  async function post(body: any) { setBusy(body.action); setErr(''); setMsg(''); try { const j = await fetch('/api/admin/miaar/bank', { method: 'POST', headers: await auth(), body: JSON.stringify(body) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر التنفيذ'); return null; } setMsg(j.note_ar || 'تم'); return j; } finally { setBusy(''); } }
  async function load(off = 0) {
    const qs = new URLSearchParams(); Object.entries(f).forEach(([k, v]) => { if (v && v !== true) qs.set(k, String(v)); }); if (f.dupes) qs.set('dupes', '1'); qs.set('offset', String(off)); qs.set('limit', String(LIMIT));
    const j = await api(`?${qs.toString()}`); if (j) { setItems(j.items); setTotal(j.total); setOffset(off); setSel(new Set()); }
  }
  async function loadPassages() { const j = await api('?passages=1'); if (j) setPassages(j.passages); }
  useEffect(() => { void load(0); if (!descs.length) void api('?descriptors=1').then((j) => j && setDescs(j.descriptors)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.level, f.skill, f.status, f.batch, f.type, f.dupes]);
  useEffect(() => { if (view === 'passages' && !passages.length) void loadPassages(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => { if (!edit) { setDraft(null); return; } setDraft({ question_text: edit.question_text, options: edit.options.map((o) => ({ ...o })), correct: edit.correct || 'a', descriptor_code: edit.descriptor_code || '', domain: edit.domain || '', difficulty_est: edit.difficulty_est || 3, passage_id: edit.passage_id || '', media_path: edit.media_path || '', media_alt: edit.media_alt || '', item_type: edit.item_type }); if (!passages.length) void loadPassages(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  const after = async (j: any) => { if (j) { await load(offset); onChanged(); } };
  const setStatus = (ids: string[], status: string) => post({ action: 'item_status', ids, status, note }).then(after);
  const batchAct = (batch: string, status: string) => { const lvl = batchLevel || ''; const what = status === 'approved' ? 'اعتماد' : status === 'archived' ? 'أرشفة' : 'إعادة'; if (!confirm(`${what} كل بنود «${BATCH_AR[batch] || batch}»${lvl ? ` في ${BANK_LEVEL_AR[lvl as keyof typeof BANK_LEVEL_AR] || lvl}` : ''}؟`)) return; void post({ action: 'batch_status', batch, status, level: lvl || undefined, note }).then(after); };
  const save = async () => { if (!edit || !draft) return; const j = await post({ action: edit.id === 'new' ? 'item_create' : 'item_update', id: edit.id, level: edit.level, skill: edit.skill, ...draft, note }); if (j) { setEdit(null); await load(offset); onChanged(); } };
  const startNew = () => { const level = f.level || 'A1'; const skill = f.skill || 'grammar_vocab'; setEdit({ id: 'new', item_code: 'جديد', content_version: 'athar-staff', level, skill, passage_id: null, question_text: '', options: [{ id: 'a', text: '' }, { id: 'b', text: '' }, { id: 'c', text: '' }, { id: 'd', text: '' }], item_type: 'mcq', status: 'draft', descriptor_code: null, domain: null, difficulty_est: 3, media_path: null, media_alt: null, author_notes: null, legacy_extra: null, latest_review_note: null, correct: 'a', batch: 'athar-staff', passage: null }); };
  const audioOf = (p: { audio_public_path: string | null; audio_storage_path: string | null } | null) => p?.audio_public_path || (p?.audio_storage_path ? `(دلو) ${p.audio_storage_path}` : '');
  const descFor = (level: string, skill: string) => descs.filter((d) => d.level === level && d.mode === (skill === 'reading' ? 'reading' : skill === 'listening' ? 'listening' : 'language_use'));
  const uploadAudio = async (p: Passage, file: File) => { if (file.size > 4 * 1024 * 1024) { setErr('الحدّ 4MB'); return; } const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); }); const j = await post({ action: 'audio_upload', passage_id: p.id, base64: b64 }); if (j) await loadPassages(); };
  const savePassage = async () => { if (!pEdit) return; const j = await post({ action: 'passage_update', id: pEdit.id, title: pEdit.title, body: pEdit.body, status: pEdit.status, audio_public_path: pEdit.audio_public_path || '' }); if (j) { setPEdit(null); await loadPassages(); onChanged(); } };
  const createPassage = async () => { const j = await post({ action: 'passage_create', ...newP }); if (j) { setCreating(false); setNewP({ id: '', level: 'A1', skill: 'reading', title: '', body: '' }); await loadPassages(); } };
  const m2a = byBatch['athar-m2a'] || {}; const legacy = byBatch['miaar-legacy'] || {};

  return <section className="am-card bk" data-testid="bank-editor">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="bk-head"><h3>محرّر البنك <small>البنود والمقاطع · المراجعة بيد الطاقم</small></h3>
      <div className="bk-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === 'items'} className={view === 'items' ? 'on' : ''} onClick={() => setView('items')}>البنود</button><button type="button" role="tab" aria-selected={view === 'passages'} className={view === 'passages' ? 'on' : ''} onClick={() => setView('passages')}>المقاطع والصوت</button></div></div>
    {err && <p className="am-err" role="alert">{err}</p>}{msg && <p className="bk-ok" role="status">{msg}</p>}

    <div className="bk-batch" data-testid="bank-batch">
      <div><b>مراجعة الدفعة</b><span>بنك مِعيار الجديد: <b>{m2a.in_review || 0}</b> قيد المراجعة · <b>{m2a.approved || 0}</b> معتمد · <b>{m2a.archived || 0}</b> مؤرشف</span><span>البنك القديم: <b>{legacy.approved || 0}</b> معتمد · <b>{legacy.in_review || 0}</b> قيد المراجعة · <b>{legacy.archived || 0}</b> مؤرشف</span></div>
      <div className="bk-row">
        <select value={batchLevel} onChange={(e) => setBatchLevel(e.target.value)} aria-label="مستوى الدفعة"><option value="">كل المستويات</option>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة (اختياري)" aria-label="ملاحظة المراجعة" />
        <button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => batchAct('athar-m2a', 'approved')} data-testid="bank-approve-batch">اعتماد الجديد</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('athar-m2a', 'in_review')}>إعادة الجديد للمراجعة</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('miaar-legacy', 'archived')}>أرشفة القديم</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('miaar-legacy', 'approved')}>إعادة اعتماد القديم</button>
      </div>
      <p className="mm-note">الترتيب المقترح: راجع الجديد مستوىً مستوى ← «اعتماد الجديد» ← حين تكتفي بالجديد «أرشفة القديم». الاختبار الحيّ يسحب من المعتمد فقط، فلا يتوقّف في أي لحظة.</p>
    </div>

    {view === 'items' && <>
      <div className="bk-filters">
        <select value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} aria-label="المستوى"><option value="">كل المستويات</option>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select>
        <select value={f.skill} onChange={(e) => setF({ ...f, skill: e.target.value })} aria-label="المهارة"><option value="">كل المهارات</option>{SKILLS_ALL.map((s) => <option key={s} value={s}>{skillLabel(s)}</option>)}</select>
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="الحالة"><option value="">كل الحالات</option>{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.batch} onChange={(e) => setF({ ...f, batch: e.target.value })} aria-label="الدفعة"><option value="">كل الدفعات</option>{Object.entries(BATCH_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="النوع"><option value="">كل الأنواع</option>{Object.entries(TYPE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void load(0); }} placeholder="بحث بالرمز أو النص" aria-label="بحث" />
        <label className="bk-chk"><input type="checkbox" checked={f.dupes} onChange={(e) => setF({ ...f, dupes: e.target.checked })} /> المكرّرات فقط</label>
        <button type="button" className="bk-soft" onClick={() => void load(0)}>بحث</button>
        <button type="button" className="mm-hbtn" onClick={startNew} data-testid="bank-new">+ بند جديد</button>
      </div>
      <div className="bk-bulk"><span><b>{total}</b> بندًا · المعروض {items.length ? offset + 1 : 0}–{offset + items.length}</span>
        {sel.size > 0 && <><span>محدّد: <b>{sel.size}</b></span><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'approved')}>اعتماد</button><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'in_review')}>للمراجعة</button><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'archived')}>أرشفة</button></>}
        <span className="bk-pager"><button type="button" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - LIMIT))}>السابق</button><button type="button" disabled={offset + LIMIT >= total} onClick={() => void load(offset + LIMIT)}>التالي</button></span></div>
      <div className="bk-tablewrap"><table className="mm-t bk-t"><thead><tr><th><input type="checkbox" aria-label="تحديد الكل" checked={!!items.length && sel.size === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th><th>الرمز</th><th>المستوى</th><th>المهارة</th><th>النوع</th><th>السؤال</th><th>الواصف</th><th>الحالة</th><th></th></tr></thead><tbody>
        {items.map((it) => <tr key={it.id} className={it.legacy_extra?.duplicate_of ? 'dup' : ''}><td><input type="checkbox" aria-label={it.item_code} checked={sel.has(it.id)} onChange={(e) => setSel((s) => { const c = new Set(s); e.target.checked ? c.add(it.id) : c.delete(it.id); return c; })} /></td>
          <td><code>{it.item_code}</code><br /><small>{BATCH_AR[it.batch] || it.batch}</small></td><td>{BANK_LEVEL_AR[it.level as keyof typeof BANK_LEVEL_AR] || it.level}</td><td>{skillLabel(it.skill)}</td><td>{TYPE_AR[it.item_type] || it.item_type}</td>
          <td className="bk-stem">{it.media_path && <img src={it.media_path} alt={it.media_alt || ''} />}{it.question_text.slice(0, 90)}{it.passage && <small>📄 {it.passage.title}</small>}{it.legacy_extra?.duplicate_of && <small className="bk-dup">مكرّر مع {it.legacy_extra.duplicate_of}</small>}</td>
          <td><small>{it.descriptor_code || '—'}</small></td><td><span className={`bk-st ${it.status}`}>{STATUS_AR[it.status] || it.status}</span></td>
          <td><button type="button" className="bk-soft" onClick={() => setEdit(it)} data-testid="bank-edit">تحرير</button></td></tr>)}
        {!items.length && <tr><td colSpan={9} className="am-empty">لا بنود مطابقة.</td></tr>}
      </tbody></table></div>

      {edit && draft && <div className="bk-edit" role="dialog" aria-label={`تحرير ${edit.item_code}`} data-testid="bank-edit-form">
        <div className="bk-eh"><h4>{edit.id === 'new' ? 'بند جديد' : `تحرير ${edit.item_code}`} <small>{BANK_LEVEL_AR[edit.level as keyof typeof BANK_LEVEL_AR]} · {skillLabel(edit.skill)} · {BATCH_AR[edit.batch] || edit.batch}</small></h4><button type="button" className="bk-soft" onClick={() => setEdit(null)}>إغلاق</button></div>
        <div className="bk-grid">
          <label>النوع<select value={draft.item_type} onChange={(e) => setDraft({ ...draft, item_type: e.target.value })}>{Object.entries(TYPE_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>الواصف<select value={draft.descriptor_code} onChange={(e) => setDraft({ ...draft, descriptor_code: e.target.value })}><option value="">—</option>{descFor(edit.level, edit.skill).map((d) => <option key={d.code} value={d.code}>{d.code} — {d.text_ar}</option>)}</select></label>
          <label>المجال<select value={draft.domain} onChange={(e) => setDraft({ ...draft, domain: e.target.value })}><option value="">—</option>{Object.entries(DOMAIN_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>الصعوبة (1–5)<input type="number" min={1} max={5} value={draft.difficulty_est} onChange={(e) => setDraft({ ...draft, difficulty_est: Number(e.target.value) })} /></label>
          {(edit.skill !== 'grammar_vocab') && <label>المقطع<select value={draft.passage_id} onChange={(e) => setDraft({ ...draft, passage_id: e.target.value })}><option value="">— بلا مقطع —</option>{passages.filter((p) => p.skill === edit.skill && p.level === edit.level).map((p) => <option key={p.id} value={p.id}>{p.id} — {p.title}</option>)}</select></label>}
          <label>صورة السؤال (مسار)<input value={draft.media_path} onChange={(e) => setDraft({ ...draft, media_path: e.target.value })} placeholder="/miaar/img/apple.svg" dir="ltr" /></label>
          <label>وصف الصورة<input value={draft.media_alt} onChange={(e) => setDraft({ ...draft, media_alt: e.target.value })} /></label>
        </div>
        <label className="bk-full">نص السؤال<textarea rows={3} value={draft.question_text} onChange={(e) => setDraft({ ...draft, question_text: e.target.value })} dir="rtl" lang="ar" /></label>
        <div className="bk-opts">{draft.options.map((o: Opt, i: number) => <div key={o.id} className={`bk-opt${draft.correct === o.id ? ' key' : ''}`}>
          <label className="bk-radio"><input type="radio" name="key" checked={draft.correct === o.id} onChange={() => setDraft({ ...draft, correct: o.id })} /> {o.id}</label>
          <input value={o.text} onChange={(e) => { const options = draft.options.slice(); options[i] = { ...o, text: e.target.value }; setDraft({ ...draft, options }); }} placeholder="نص الخيار" dir="rtl" lang="ar" />
          <input value={o.image || ''} onChange={(e) => { const options = draft.options.slice(); options[i] = { ...o, image: e.target.value || null }; setDraft({ ...draft, options }); }} placeholder="صورة (مسار)" dir="ltr" className="bk-img" />
          {o.image && <img src={o.image} alt={o.alt || ''} />}
          {edit.author_notes?.options?.[o.id] && <small className="bk-rat">{edit.author_notes.options[o.id]}</small>}
          <button type="button" className="bk-x" aria-label="حذف الخيار" disabled={draft.options.length <= 2} onClick={() => { const options = draft.options.filter((_: Opt, k: number) => k !== i).map((x: Opt, k: number) => ({ ...x, id: LETTERS[k] })); setDraft({ ...draft, options, correct: options.some((x: Opt) => x.id === draft.correct) ? draft.correct : 'a' }); }}>×</button>
        </div>)}
          {draft.options.length < 6 && <button type="button" className="bk-soft" onClick={() => setDraft({ ...draft, options: [...draft.options, { id: LETTERS[draft.options.length], text: '' }] })}>+ خيار</button>}</div>
        {edit.passage && <p className="mm-note">المقطع: <b>{edit.passage.title}</b> ({STATUS_AR[edit.passage.status]}) {edit.passage.skill === 'listening' && (edit.passage.audio_public_path ? <audio controls preload="none" src={edit.passage.audio_public_path} /> : <span>· الصوت في الدلو</span>)}</p>}
        {edit.latest_review_note && <p className="mm-note">آخر ملاحظة: {edit.latest_review_note}</p>}
        <div className="bk-row">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة" aria-label="ملاحظة" />
          <button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => void save()} data-testid="bank-save">حفظ</button>
          {edit.id !== 'new' && <>{edit.status !== 'approved' && <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'approved').then(() => setEdit(null))} data-testid="bank-approve">اعتماد</button>}
            {edit.status === 'approved' && <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'in_review').then(() => setEdit(null))}>إعادة للمراجعة</button>}
            <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'archived').then(() => setEdit(null))}>أرشفة</button></>}
        </div>
      </div>}
    </>}

    {view === 'passages' && <>
      <div className="bk-studio"><b>استوديو مِعيار</b><p>صوت الاستماع يُنتَج خارج الخادم بطاقم مِعيار الصوتي (حامد الراوي · زارية وتيم للحوار · شاكر وجمال وأمل للتنويع) ثم يُرفع هنا بصيغة MP3 — أو يوضع في <code>public/miaar/audio/&lt;المعرّف&gt;.mp3</code> في المستودع. الملف المرفوع يُقدَّم برابط موقَّع من الدلو الخاص.</p>
        <button type="button" className="mm-hbtn" onClick={() => setCreating(!creating)}>+ مقطع جديد</button></div>
      {creating && <div className="bk-edit"><div className="bk-grid">
        <label>المعرّف<input value={newP.id} onChange={(e) => setNewP({ ...newP, id: e.target.value })} placeholder="R-B1-10 أو L-A2-05" dir="ltr" /></label>
        <label>المستوى<select value={newP.level} onChange={(e) => setNewP({ ...newP, level: e.target.value })}>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select></label>
        <label>المهارة<select value={newP.skill} onChange={(e) => setNewP({ ...newP, skill: e.target.value })}><option value="reading">قراءة</option><option value="listening">استماع</option></select></label>
        <label>العنوان<input value={newP.title} onChange={(e) => setNewP({ ...newP, title: e.target.value })} /></label></div>
        <label className="bk-full">النص<textarea rows={6} value={newP.body} onChange={(e) => setNewP({ ...newP, body: e.target.value })} dir="rtl" lang="ar" /></label>
        <div className="bk-row"><button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => void createPassage()}>إنشاء</button><button type="button" className="bk-soft" onClick={() => setCreating(false)}>إلغاء</button></div></div>}
      <div className="bk-tablewrap"><table className="mm-t bk-t"><thead><tr><th>المعرّف</th><th>المستوى</th><th>المهارة</th><th>العنوان</th><th>الصوت</th><th>الحالة</th><th></th></tr></thead><tbody>
        {passages.map((p) => <tr key={p.id}><td><code>{p.id}</code><br /><small>{p.version || p.source}</small></td><td>{BANK_LEVEL_AR[p.level as keyof typeof BANK_LEVEL_AR] || p.level}</td><td>{p.skill === 'listening' ? 'استماع' : 'قراءة'}</td><td>{p.title}<br /><small>{p.body.split(/\s+/).length} كلمة{p.meta?.voices ? ` · ${(p.meta.voices as string[]).join(' + ')}` : ''}{p.meta?.twice ? ' · مرتين' : ''}</small></td>
          <td>{p.skill === 'listening' ? <>{p.audio_public_path ? <audio controls preload="none" src={p.audio_public_path} /> : <small>{audioOf(p) || 'لا صوت'}</small>}<label className="bk-up">رفع MP3<input type="file" accept="audio/mpeg,.mp3" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAudio(p, file); e.currentTarget.value = ''; }} /></label></> : '—'}</td>
          <td><span className={`bk-st ${p.status}`}>{STATUS_AR[p.status] || p.status}</span></td><td><button type="button" className="bk-soft" onClick={() => setPEdit({ ...p })}>تحرير</button></td></tr>)}
        {!passages.length && <tr><td colSpan={7} className="am-empty">لا مقاطع.</td></tr>}
      </tbody></table></div>
      {pEdit && <div className="bk-edit" role="dialog" aria-label={`تحرير ${pEdit.id}`}><div className="bk-eh"><h4>تحرير المقطع {pEdit.id}</h4><button type="button" className="bk-soft" onClick={() => setPEdit(null)}>إغلاق</button></div>
        <div className="bk-grid"><label>العنوان<input value={pEdit.title} onChange={(e) => setPEdit({ ...pEdit, title: e.target.value })} /></label>
          <label>الحالة<select value={pEdit.status} onChange={(e) => setPEdit({ ...pEdit, status: e.target.value })}>{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {pEdit.skill === 'listening' && <label>مسار الصوت العام<input value={pEdit.audio_public_path || ''} onChange={(e) => setPEdit({ ...pEdit, audio_public_path: e.target.value })} dir="ltr" placeholder="/miaar/audio/L-A1-01.mp3" /></label>}</div>
        <label className="bk-full">النص{pEdit.skill === 'listening' && ' (النصّ المقروء — يُعرض للطاقم فقط)'}<textarea rows={8} value={pEdit.body} onChange={(e) => setPEdit({ ...pEdit, body: e.target.value })} dir="rtl" lang="ar" /></label>
        <div className="bk-row"><button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => void savePassage()}>حفظ</button></div></div>}
    </>}
  </section>;
}
const CSS = `
.bk-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.bk-tabs{display:flex;gap:6px}.bk-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 14px;font-weight:800;cursor:pointer;min-height:36px}.bk-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.bk-ok{color:#0f5c57;font-weight:800;margin:6px 0}.bk-batch{border:1px solid #ead9a6;background:#fbf5e4;border-radius:14px;padding:12px 14px;margin:10px 0;display:grid;gap:8px}.bk-batch>div:first-child{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.bk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.bk-row input{flex:1;min-width:180px}.bk-soft{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;font-weight:800;cursor:pointer;min-height:36px}.bk-soft:disabled{opacity:.5;cursor:not-allowed}
.bk-filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.bk-filters input,.bk-filters select,.bk-row input,.bk-row select,.bk-grid input,.bk-grid select,.bk-full textarea,.bk-opt input{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;min-height:36px}.bk-chk{display:flex;align-items:center;gap:6px;font-size:13px}
.bk-bulk{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;margin:4px 0 8px}.bk-pager{margin-inline-start:auto;display:flex;gap:6px}.bk-pager button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:4px 10px;cursor:pointer}.bk-pager button:disabled{opacity:.4}
.bk-tablewrap{overflow:auto}.bk-t td{vertical-align:top;font-size:13px}.bk-t code{font-size:12px}.bk-stem{max-width:360px}.bk-stem img{width:34px;height:34px;vertical-align:middle;margin-inline-start:6px}.bk-stem small{display:block;color:#64748b}.bk-dup{color:#b45309!important}.bk-t tr.dup{background:#fff7ed}
.bk-st{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;background:#e2e8f0}.bk-st.approved{background:#d1fae5;color:#065f46}.bk-st.in_review{background:#fef3c7;color:#92400e}.bk-st.archived{background:#f1f5f9;color:#64748b}.bk-st.draft{background:#e0e7ff;color:#3730a3}
.bk-edit{border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-top:12px;background:#f8fafc;display:grid;gap:10px}.bk-eh{display:flex;justify-content:space-between;align-items:center}.bk-eh h4{margin:0}.bk-eh small{color:#64748b;font-weight:600;margin-inline-start:8px}
.bk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.bk-grid label,.bk-full{display:grid;gap:4px;font-size:13px;font-weight:800}.bk-full textarea{font-weight:500}
.bk-opts{display:grid;gap:6px}.bk-opt{display:grid;grid-template-columns:auto 1fr 180px auto auto;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px;background:#fff}.bk-opt.key{border-color:#0b8a83;background:#ecfdf5}.bk-opt img{width:40px;height:40px}.bk-radio{font-weight:800}.bk-rat{grid-column:2/-1;color:#64748b}.bk-x{border:none;background:transparent;font-size:18px;cursor:pointer;color:#94a3b8}
.bk-studio{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px dashed #0b8a83;border-radius:14px;padding:12px;margin:10px 0}.bk-studio p{margin:0;flex:1;font-size:13px}.bk-up{display:inline-block;border:1px solid #cbd5e1;border-radius:8px;padding:3px 8px;font-size:12px;cursor:pointer;margin-top:4px}.bk-up input{display:none}
audio{height:30px;max-width:200px;vertical-align:middle}
@media (max-width:720px){.bk-opt{grid-template-columns:auto 1fr auto}.bk-img{display:none}}
`;
