'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * محرّر بنك مِعيار (م2-أ) — داخل /admin/miaar/bank
 *  بنود: تصفية (مستوى · مهارة · حالة · دفعة · نوع · بحث · مكرّرات) · تحرير بند (النص · الخيارات · المفتاح · الواصف · المجال · الصعوبة · المقطع · الصورة)
 *  · حالة بند/بنود · «مراجعة الدفعة» (اعتماد athar-m2a كلّها أو مستوىً واحدًا) · «أرشفة التأسيسية» · إنشاء بند
 *  مقاطع: تحرير العنوان/النص/الحالة · رفع MP3 إلى الدلو · إنشاء مقطع · «استوديو مِعيار» (الصوت يُنتَج خارج الخادم ويُرفع هنا)
 *  م4-أ «صوتك وقلمك»: تبويب «المهام الإنتاجية» — مهام الكتابة والتحدّث (تصفية · تحرير النصّ والحدود والإرشادات والإجابة النموذجية · معاينة كما يراها المتقدّم · سُلّم التقدير بجوار المحرّر · اعتماد الدفعة athar-m4a)
 *  القرار الأكاديمي بيد الطاقم.
 */
import { useEffect, useState } from 'react';
import { BANK_LEVEL_AR, skillLabel } from '../../../lib/miaar/registry';
import { RUBRIC_DIMENSIONS, DIMENSION_AR, WRITING_LIMITS, SPEAKING_LIMITS, validateTask, countWords } from '../../../lib/miaar/rubric';

type Opt = { id: string; text: string; image?: string | null; alt?: string | null };
type Item = { id: string; item_code: string; content_version: string; level: string; skill: string; passage_id: string | null; question_text: string; options: Opt[]; item_type: string; status: string; task?: any; descriptor_code: string | null; domain: string | null; difficulty_est: number | null; media_path: string | null; media_alt: string | null; author_notes: any; legacy_extra: any; latest_review_note: string | null; correct: string | null; batch: string; passage: { id: string; title: string; skill: string; status: string; audio_public_path: string | null; audio_storage_path: string | null } | null };
type Passage = { id: string; level: string; skill: string; title: string; body: string; status: string; source: string; version: string | null; audio_public_path: string | null; audio_storage_path: string | null; meta: any };
type Desc = { code: string; level: string; mode: string; text_ar: string };
const LEVELS_ALL = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const SKILLS_ALL = ['grammar_vocab', 'reading', 'listening'];
const STATUS_AR: Record<string, string> = { draft: 'مسودّة', in_review: 'قيد المراجعة', approved: 'معتمد', archived: 'مؤرشف' };
const TYPE_AR: Record<string, string> = { mcq: 'اختيار من متعدد', picture_choice: 'اختيار صورة', picture_label: 'تسمية صورة', true_false_notgiven: 'صواب/خطأ/غير مذكور' };
const DOMAIN_AR: Record<string, string> = { personal: 'شخصي', public: 'عام', educational: 'تعليمي', professional: 'مهني' };
const BATCH_AR: Record<string, string> = { 'athar-m2a': 'بنك مِعيار الجديد (م2-أ)', 'miaar-legacy': 'الدفعة التأسيسية (295 بندًا — ملك أَثَر)', 'athar-staff': 'بنود الطاقم', 'athar-m4a': 'صوتك وقلمك (م4-أ)' };
type Band = { skill: string; dimension: string; dimension_ar: string; score: number; text_ar: string };
const GENRE_AR: Record<string, string> = { copy: 'نسخ', form: 'نموذج', self_intro: 'تعريف بالنفس', card: 'بطاقة', message: 'رسالة', diary: 'مذكّرات', description: 'وصف', note: 'ملاحظة', request: 'طلب', article: 'مقال قصير', blog: 'تدوينة', narrative: 'سرد', opinion: 'رأي', formal_email: 'بريد رسمي', essay: 'مقال', report: 'تقرير', summary: 'تلخيص', formal_letter: 'خطاب رسمي', proposal: 'مقترح', review: 'مراجعة', adapt: 'تكييف السجلّ', position_paper: 'ورقة موقف', critique: 'نقد', style: 'أسلوب', greet: 'تحيّة', numbers: 'أعداد', name_picture: 'تسمية صورة', questions: 'أسئلة', answer: 'إجابة', routine: 'روتين', family: 'عائلة', service: 'موقف خدمة', plans: 'خطط', situation: 'موقف', spontaneous: 'ارتجال', interaction: 'تفاعل', presentation: 'عرض', debate: 'نقاش', fluent_talk: 'حديث متدفّق', professional_setting: 'سياق مهني', complex_presentation: 'عرض معقّد', effortless: 'حديث حرّ', nuance: 'فروق دقيقة', repair: 'تدارك' };
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

export default function BankEditor({ auth, byBatch, onChanged }: { auth: () => Promise<Record<string, string>>; byBatch: Record<string, Record<string, number>>; onChanged: () => void }) {
  const [view, setView] = useState<'items' | 'passages' | 'tasks'>('items');
  /* م4-أ: المهام الإنتاجية */
  const [tf, setTf] = useState({ level: '', skill: '', status: '', q: '' }); const [tasks, setTasks] = useState<Item[]>([]); const [tTotal, setTTotal] = useState(0);
  const [tEdit, setTEdit] = useState<Item | null>(null); const [tDraft, setTDraft] = useState<any>(null); const [bands, setBands] = useState<Band[]>([]); const [preview, setPreview] = useState(false);
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
  async function loadTasks() { const qs = new URLSearchParams({ productive: '1', limit: '100' }); if (tf.level) qs.set('level', tf.level); if (tf.skill) qs.set('skill', tf.skill); if (tf.status) qs.set('status', tf.status); if (tf.q) qs.set('q', tf.q); const j = await api(`?${qs.toString()}`); if (j) { setTasks(j.items); setTTotal(j.total); } }
  useEffect(() => { if (view !== 'tasks') return; void loadTasks(); if (!bands.length) void api('?rubric=1').then((j) => j && setBands(j.bands)); if (!descs.length) void api('?descriptors=1').then((j) => j && setDescs(j.descriptors)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, tf.level, tf.skill, tf.status]);
  useEffect(() => { if (!tEdit) { setTDraft(null); setPreview(false); return; } const t = tEdit.task || {}; const d = tEdit.skill === 'writing' ? WRITING_LIMITS[tEdit.level as keyof typeof WRITING_LIMITS] : SPEAKING_LIMITS[tEdit.level as keyof typeof SPEAKING_LIMITS];
    setTDraft({ question_text: tEdit.question_text, descriptor_code: tEdit.descriptor_code || '', domain: tEdit.domain || '', media_path: tEdit.media_path || '', media_alt: tEdit.media_alt || '', task: { genre: t.genre || 'message', prompt_en: t.prompt_en || '', tips_ar: [...(t.tips_ar || []), '', '', ''].slice(0, 3), sample_ar: t.sample_ar || '', ...d, ...Object.fromEntries(Object.entries(t).filter(([k]) => /^(min_|max_|time_|prep_|retakes)/.test(k))) } });
  }, [tEdit]);
  const saveTask = async () => { if (!tEdit || !tDraft) return; const task = { ...tDraft.task, tips_ar: (tDraft.task.tips_ar as string[]).filter((x) => x && x.trim()) }; const v = validateTask(tEdit.skill as 'writing' | 'speaking', tEdit.level, task); if (!v.task) { setErr(v.errors.join(' · ')); return; }
    const j = await post({ action: tEdit.id === 'new' ? 'task_create' : 'task_update', id: tEdit.id, level: tEdit.level, skill: tEdit.skill, question_text: tDraft.question_text, descriptor_code: tDraft.descriptor_code, domain: tDraft.domain, media_path: tDraft.media_path, media_alt: tDraft.media_alt, task: v.task, note }); if (j) { setTEdit(null); await loadTasks(); onChanged(); } };
  const startNewTask = () => { const level = tf.level || 'A1'; const skill = (tf.skill || 'writing') as string; setTEdit({ id: 'new', item_code: 'جديدة', content_version: 'athar-staff', level, skill, passage_id: null, question_text: '', options: [], item_type: `${skill}_task`, status: 'draft', descriptor_code: null, domain: null, difficulty_est: null, media_path: null, media_alt: null, task: {} } as any); };
  const taskStatus = (ids: string[], status: string) => post({ action: 'item_status', ids, status, note }).then(async (j) => { if (j) { await loadTasks(); onChanged(); } });
  const bandsFor = (skill: string) => RUBRIC_DIMENSIONS[(skill === 'speaking' ? 'speaking' : 'writing') as 'writing' | 'speaking'].map((dim) => ({ dim, rows: bands.filter((b) => b.skill === skill && b.dimension === dim).sort((a, b) => b.score - a.score) }));
  useEffect(() => { void load(0); if (!descs.length) void api('?descriptors=1').then((j) => j && setDescs(j.descriptors)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.level, f.skill, f.status, f.batch, f.type, f.dupes]);
  useEffect(() => { if (view === 'passages' && !passages.length) void loadPassages(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);
  useEffect(() => { if (!edit && !pEdit && !tEdit) return; const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setEdit(null); setPEdit(null); setTEdit(null); } }; window.addEventListener('keydown', onKey); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; }; }, [edit, pEdit, tEdit]);
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
  const m2a = byBatch['athar-m2a'] || {}; const legacy = byBatch['miaar-legacy'] || {}; const m4a = byBatch['athar-m4a'] || {};

  return <section className="am-card bk" data-testid="bank-editor">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="bk-head"><h3>محرّر البنك <small>البنود والمقاطع · المراجعة بيد الطاقم</small></h3>
      <div className="bk-tabs" role="tablist"><button type="button" role="tab" aria-selected={view === 'items'} className={view === 'items' ? 'on' : ''} onClick={() => setView('items')}>البنود</button><button type="button" role="tab" aria-selected={view === 'tasks'} className={view === 'tasks' ? 'on' : ''} onClick={() => setView('tasks')} data-testid="bank-tab-tasks">المهام الإنتاجية <small>صوتك وقلمك</small></button><button type="button" role="tab" aria-selected={view === 'passages'} className={view === 'passages' ? 'on' : ''} onClick={() => setView('passages')}>المقاطع والصوت</button></div></div>
    {err && <p className="am-err" role="alert">{err}</p>}{msg && <p className="bk-ok" role="status">{msg}</p>}

    <div className="bk-batch" data-testid="bank-batch">
      <div><b>مراجعة الدفعة</b><span>بنك مِعيار الجديد: <b>{m2a.in_review || 0}</b> قيد المراجعة · <b>{m2a.approved || 0}</b> معتمد · <b>{m2a.archived || 0}</b> مؤرشف</span><span>صوتك وقلمك (م4-أ): <b>{m4a.in_review || 0}</b> قيد المراجعة · <b>{m4a.approved || 0}</b> معتمد</span><span>الدفعة التأسيسية: <b>{legacy.approved || 0}</b> معتمد · <b>{legacy.in_review || 0}</b> قيد المراجعة · <b>{legacy.archived || 0}</b> مؤرشف</span></div>
      <div className="bk-row">
        <select value={batchLevel} onChange={(e) => setBatchLevel(e.target.value)} aria-label="مستوى الدفعة"><option value="">كل المستويات</option>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة (اختياري)" aria-label="ملاحظة المراجعة" />
        <button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => batchAct('athar-m2a', 'approved')} data-testid="bank-approve-batch">اعتماد الجديد</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('athar-m2a', 'in_review')}>إعادة الجديد للمراجعة</button>
        <button type="button" className="mm-hbtn" disabled={!!busy} onClick={() => batchAct('athar-m4a', 'approved')} data-testid="bank-approve-m4a">اعتماد مهام صوتك وقلمك</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('miaar-legacy', 'archived')}>أرشفة التأسيسية</button>
        <button type="button" className="bk-soft" disabled={!!busy} onClick={() => batchAct('miaar-legacy', 'approved')}>إعادة اعتماد التأسيسية</button>
      </div>
      <p className="mm-note">الترتيب المقترح: راجع الجديد مستوىً مستوى ← «اعتماد الجديد» ← حين تكتفي بالجديد «أرشفة التأسيسية» (الدفعة التأسيسية ملك أَثَر الكامل ولا صلة لها بأي مشروع خارجي). الاختبار الحيّ يسحب من المعتمد فقط، فلا يتوقّف في أي لحظة.</p>
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
        <button type="button" className="bk-primary" onClick={startNew} data-testid="bank-new"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"/></svg>إضافة بند جديد</button>
      </div>
      <div className="bk-bulk"><span><b>{total}</b> بندًا · المعروض {items.length ? offset + 1 : 0}–{offset + items.length}</span>
        {sel.size > 0 && <><span>محدّد: <b>{sel.size}</b></span><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'approved')}>اعتماد</button><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'in_review')}>للمراجعة</button><button type="button" className="bk-soft" onClick={() => void setStatus([...sel], 'archived')}>أرشفة</button></>}
        <span className="bk-pager"><button type="button" disabled={offset === 0} onClick={() => void load(Math.max(0, offset - LIMIT))}>السابق</button><button type="button" disabled={offset + LIMIT >= total} onClick={() => void load(offset + LIMIT)}>التالي</button></span></div>
      <div className="bk-tablewrap"><table className="mm-t bk-t"><thead><tr><th><input type="checkbox" aria-label="تحديد الكل" checked={!!items.length && sel.size === items.length} onChange={(e) => setSel(e.target.checked ? new Set(items.map((i) => i.id)) : new Set())} /></th><th>الرمز</th><th>المستوى</th><th>المهارة</th><th>النوع</th><th>السؤال</th><th>الواصف</th><th>الحالة</th><th></th></tr></thead><tbody>
        {items.map((it) => <tr key={it.id} className={it.legacy_extra?.duplicate_of ? 'dup' : ''}><td><input type="checkbox" aria-label={it.item_code} checked={sel.has(it.id)} onChange={(e) => setSel((s) => { const c = new Set(s); e.target.checked ? c.add(it.id) : c.delete(it.id); return c; })} /></td>
          <td><code>{it.item_code}</code><br /><small>{BATCH_AR[it.batch] || it.batch}</small></td><td>{BANK_LEVEL_AR[it.level as keyof typeof BANK_LEVEL_AR] || it.level}</td><td>{skillLabel(it.skill)}</td><td>{TYPE_AR[it.item_type] || it.item_type}</td>
          <td className="bk-stem">{it.media_path && <img src={it.media_path} alt={it.media_alt || ''} />}{it.question_text.slice(0, 90)}{it.passage && <small>📄 {it.passage.title}</small>}{it.legacy_extra?.duplicate_of && <small className="bk-dup">مكرّر مع {it.legacy_extra.duplicate_of}</small>}</td>
          <td><small>{it.descriptor_code || '—'}</small></td><td><span className={`bk-st ${it.status}`}>{STATUS_AR[it.status] || it.status}</span></td>
          <td className="bk-acts"><button type="button" className="bk-act" onClick={() => setEdit(it)} data-testid="bank-edit">تعديل</button>
            {it.status === 'in_review' ? <button type="button" className="bk-act ok" disabled={!!busy} onClick={() => void setStatus([it.id], 'approved')} data-testid="bank-row-approve">اعتماد</button>
              : it.status === 'approved' ? <button type="button" className="bk-act" disabled={!!busy} onClick={() => void setStatus([it.id], 'in_review')} data-testid="bank-row-review">إعادة للمراجعة</button>
              : <button type="button" className="bk-act" disabled={!!busy} onClick={() => void setStatus([it.id], 'in_review')} data-testid="bank-row-review">مراجعة</button>}
            {it.status === 'archived' ? <button type="button" className="bk-act warn" disabled={!!busy} onClick={() => void setStatus([it.id], 'draft')} data-testid="bank-row-restore">استرجاع</button>
              : <button type="button" className="bk-act warn" disabled={!!busy} onClick={() => void setStatus([it.id], 'archived')} data-testid="bank-row-archive">أرشفة</button>}
            <button type="button" className="bk-act danger" disabled={!!busy || it.status === 'approved'} title={it.status === 'approved' ? 'بند معتمد لا يُحذف — أرشِفه' : 'حذف نهائي (لبند لم يُجب عنه أحد)'} onClick={() => { if (confirm(`حذف البند ${it.item_code} نهائيًا؟ لا رجعة.`)) void post({ action: 'item_delete', id: it.id }).then(after); }} data-testid="bank-row-delete">حذف</button></td></tr>)}
        {!items.length && <tr><td colSpan={9} className="am-empty">لا بنود مطابقة.</td></tr>}
      </tbody></table></div>

      {edit && draft && <div className="bk-backdrop" onClick={() => setEdit(null)}><div className="bk-edit" role="dialog" aria-modal="true" aria-label={edit.id === 'new' ? 'بند جديد' : `تحرير ${edit.item_code}`} data-testid="bank-edit-form" onClick={(e) => e.stopPropagation()}>
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
          <button type="button" className="bk-primary" disabled={!!busy} onClick={() => void save()} data-testid="bank-save">حفظ البند</button>
          {edit.id !== 'new' && <>{edit.status !== 'approved' && <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'approved').then(() => setEdit(null))} data-testid="bank-approve">اعتماد</button>}
            {edit.status === 'approved' && <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'in_review').then(() => setEdit(null))}>إعادة للمراجعة</button>}
            <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void setStatus([edit.id], 'archived').then(() => setEdit(null))}>أرشفة</button></>}
        </div>
      </div></div>}
    </>}

    {view === 'tasks' && <>
      <div className="bk-studio bk-prodintro"><b>صوتك وقلمك</b><p>مهام الكتابة والتحدّث تُقدَّر بـ«سُلّم التقدير» (أربعة أبعاد × 0–5) لا بمفتاح. كل مهمة تحمل حدودها وإرشاداتها وإجابة نموذجية لا تغادر الخادم. القاعدة: الآلة تقترح درجة، والإنسان يعتمدها (م4-ج). لا مهمة تصل إلى متقدّم قبل اعتمادك.</p>
        <button type="button" className="bk-primary" onClick={startNewTask} data-testid="task-new"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"/></svg>مهمة جديدة</button></div>
      <div className="bk-filters">
        <select value={tf.level} onChange={(e) => setTf({ ...tf, level: e.target.value })} aria-label="المستوى"><option value="">كل المستويات</option>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select>
        <select value={tf.skill} onChange={(e) => setTf({ ...tf, skill: e.target.value })} aria-label="المهارة" data-testid="task-skill"><option value="">كتابة وتحدّث</option><option value="writing">الكتابة</option><option value="speaking">التحدّث</option></select>
        <select value={tf.status} onChange={(e) => setTf({ ...tf, status: e.target.value })} aria-label="الحالة"><option value="">كل الحالات</option>{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input value={tf.q} onChange={(e) => setTf({ ...tf, q: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') void loadTasks(); }} placeholder="بحث بالرمز أو النصّ" aria-label="بحث" />
        <button type="button" className="bk-soft" onClick={() => void loadTasks()}>بحث</button>
        <span className="bk-count" data-testid="task-total"><b>{tTotal}</b> مهمة</span>
      </div>
      <div className="bk-tablewrap"><table className="mm-t bk-t" data-testid="task-table"><thead><tr><th>الرمز</th><th>المستوى</th><th>المهارة</th><th>النوع</th><th>المهمة</th><th>الحدود</th><th>الواصف</th><th>الحالة</th><th></th></tr></thead><tbody>
        {tasks.map((it) => <tr key={it.id}><td><code>{it.item_code}</code><br /><small>{BATCH_AR[(it as any).batch] || (it as any).batch}</small></td><td>{BANK_LEVEL_AR[it.level as keyof typeof BANK_LEVEL_AR] || it.level}</td><td>{skillLabel(it.skill)}</td><td>{GENRE_AR[it.task?.genre] || it.task?.genre || '—'}</td>
          <td className="bk-stem">{it.media_path && <img src={it.media_path} alt={it.media_alt || ''} />}{it.question_text.slice(0, 110)}{it.question_text.length > 110 ? '…' : ''}</td>
          <td><small dir="ltr">{it.skill === 'writing' ? `${it.task?.min_words ?? '—'}–${it.task?.max_words ?? '—'} كلمة · ${Math.round((it.task?.time_seconds || 0) / 60)} د` : `${it.task?.min_seconds ?? '—'}–${it.task?.max_seconds ?? '—'} ث · تحضير ${it.task?.prep_seconds ?? '—'} ث`}</small></td>
          <td><small>{it.descriptor_code || '—'}</small></td><td><span className={`bk-st ${it.status}`}>{STATUS_AR[it.status] || it.status}</span></td>
          <td className="bk-acts"><button type="button" className="bk-act" onClick={() => setTEdit(it)} data-testid="task-edit">تعديل</button>
            {it.status !== 'approved' ? <button type="button" className="bk-act ok" disabled={!!busy} onClick={() => void taskStatus([it.id], 'approved')} data-testid="task-row-approve">اعتماد</button> : <button type="button" className="bk-act" disabled={!!busy} onClick={() => void taskStatus([it.id], 'in_review')} data-testid="task-row-review">إعادة للمراجعة</button>}
            {it.status !== 'archived' && <button type="button" className="bk-act warn" disabled={!!busy} onClick={() => void taskStatus([it.id], 'archived')}>أرشفة</button>}</td></tr>)}
        {!tasks.length && <tr><td colSpan={9} className="am-empty">لا مهام مطابقة.</td></tr>}
      </tbody></table></div>

      {tEdit && tDraft && <div className="bk-backdrop" onClick={() => setTEdit(null)}><div className="bk-edit bk-task" role="dialog" aria-modal="true" aria-label={tEdit.id === 'new' ? 'مهمة جديدة' : `تحرير ${tEdit.item_code}`} data-testid="task-edit-form" onClick={(e) => e.stopPropagation()}>
        <div className="bk-eh"><h4>{tEdit.id === 'new' ? 'مهمة جديدة' : `تحرير ${tEdit.item_code}`} <small>{BANK_LEVEL_AR[tEdit.level as keyof typeof BANK_LEVEL_AR]} · {skillLabel(tEdit.skill)}</small></h4>
          <div className="bk-row"><button type="button" className={`bk-soft${preview ? ' on' : ''}`} onClick={() => setPreview(!preview)} aria-pressed={preview} data-testid="task-preview">معاينة كما يراها المتقدّم</button><button type="button" className="bk-soft" onClick={() => setTEdit(null)}>إغلاق</button></div></div>
        {preview ? <div className="tk-preview" data-testid="task-preview-card">
            <span className="tk-chip">{tEdit.skill === 'writing' ? 'مهمة كتابة' : 'مهمة تحدّث'} · {BANK_LEVEL_AR[tEdit.level as keyof typeof BANK_LEVEL_AR]}</span>
            {tDraft.media_path && <img src={tDraft.media_path} alt={tDraft.media_alt || ''} className="tk-img" />}
            <p className="tk-prompt">{tDraft.question_text || '…'}</p>
            {tDraft.task.prompt_en && <p className="tk-en" dir="ltr">{tDraft.task.prompt_en}</p>}
            <ul className="tk-tips">{(tDraft.task.tips_ar as string[]).filter(Boolean).map((t, i) => <li key={i}>{t}</li>)}</ul>
            <div className="tk-limits">{tEdit.skill === 'writing' ? <><span>{tDraft.task.min_words}–{tDraft.task.max_words} كلمة</span><span>{Math.round(tDraft.task.time_seconds / 60)} دقيقة</span><span>عدّاد الكلمات يظهر أثناء الكتابة</span></> : <><span>تحضير {tDraft.task.prep_seconds} ث</span><span>تسجيل {tDraft.task.min_seconds}–{tDraft.task.max_seconds} ث</span><span>إعادة {tDraft.task.retakes} مرّة</span></>}</div>
            <p className="mm-note">هكذا تظهر في «غرفة الأداء» (م4-ب) — بلا الإجابة النموذجية ولا السُلّم.</p>
          </div>
        : <div className="tk-grid">
          <div className="tk-form">
            <label className="bk-full">نصّ المهمة (كما يقرؤه المتقدّم)<textarea rows={4} value={tDraft.question_text} onChange={(e) => setTDraft({ ...tDraft, question_text: e.target.value })} dir="rtl" lang="ar" data-testid="task-text" /></label>
            <div className="bk-grid">
              <label>النوع (genre)<input value={tDraft.task.genre} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, genre: e.target.value.toLowerCase().replace(/[^a-z_]/g, '') } })} dir="ltr" list="tk-genres" /><datalist id="tk-genres">{Object.keys(GENRE_AR).map((g) => <option key={g} value={g}>{GENRE_AR[g]}</option>)}</datalist></label>
              <label>الواصف<select value={tDraft.descriptor_code} onChange={(e) => setTDraft({ ...tDraft, descriptor_code: e.target.value })}><option value="">—</option>{descs.filter((d) => d.level === tEdit.level && d.mode === tEdit.skill).map((d) => <option key={d.code} value={d.code}>{d.code} — {d.text_ar}</option>)}</select></label>
              <label>المجال<select value={tDraft.domain} onChange={(e) => setTDraft({ ...tDraft, domain: e.target.value })}><option value="">—</option>{Object.entries(DOMAIN_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              {tEdit.skill === 'writing' ? <>
                <label>أقلّ كلمات<input type="number" min={1} max={600} value={tDraft.task.min_words} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, min_words: Number(e.target.value) } })} /></label>
                <label>أكثر كلمات<input type="number" min={1} max={800} value={tDraft.task.max_words} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, max_words: Number(e.target.value) } })} /></label>
                <label>الزمن (ثانية)<input type="number" min={60} max={3600} step={60} value={tDraft.task.time_seconds} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, time_seconds: Number(e.target.value) } })} /></label>
              </> : <>
                <label>أقلّ ثوانٍ<input type="number" min={3} max={90} value={tDraft.task.min_seconds} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, min_seconds: Number(e.target.value) } })} /></label>
                <label>أكثر ثوانٍ (≤90)<input type="number" min={5} max={90} value={tDraft.task.max_seconds} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, max_seconds: Number(e.target.value) } })} /></label>
                <label>تحضير (ثانية)<input type="number" min={0} max={120} value={tDraft.task.prep_seconds} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, prep_seconds: Number(e.target.value) } })} /></label>
                <label>إعادات مسموحة<input type="number" min={0} max={2} value={tDraft.task.retakes} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, retakes: Number(e.target.value) } })} /></label>
              </>}
              <label>صورة تحفيز (مسار)<input value={tDraft.media_path} onChange={(e) => setTDraft({ ...tDraft, media_path: e.target.value })} placeholder="/miaar/img/book.svg" dir="ltr" /></label>
              <label>وصف الصورة<input value={tDraft.media_alt} onChange={(e) => setTDraft({ ...tDraft, media_alt: e.target.value })} /></label>
            </div>
            <label className="bk-full">ترجمة التعليمات (تظهر بلغة واجهة المتقدّم إن لم تكن العربية)<input value={tDraft.task.prompt_en} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, prompt_en: e.target.value } })} dir="ltr" /></label>
            <div className="bk-grid">{[0, 1, 2].map((i) => <label key={i}>إرشاد {i + 1}<input value={tDraft.task.tips_ar[i] || ''} onChange={(e) => { const tips_ar = [...tDraft.task.tips_ar]; tips_ar[i] = e.target.value; setTDraft({ ...tDraft, task: { ...tDraft.task, tips_ar } }); }} dir="rtl" /></label>)}</div>
            <label className="bk-full">الإجابة النموذجية / المخطّط (للطاقم والمصحّح فقط — لا تغادر الخادم)<textarea rows={4} value={tDraft.task.sample_ar} onChange={(e) => setTDraft({ ...tDraft, task: { ...tDraft.task, sample_ar: e.target.value } })} dir="rtl" lang="ar" />{tEdit.skill === 'writing' && !!tDraft.task.sample_ar && <small className="tk-wc">{countWords(tDraft.task.sample_ar)} كلمة في النموذج</small>}</label>
            {tEdit.latest_review_note && <p className="mm-note">آخر ملاحظة: {tEdit.latest_review_note}</p>}
            <div className="bk-row"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="ملاحظة المراجعة" aria-label="ملاحظة" />
              <button type="button" className="bk-primary" disabled={!!busy} onClick={() => void saveTask()} data-testid="task-save">حفظ المهمة</button>
              {tEdit.id !== 'new' && tEdit.status !== 'approved' && <button type="button" className="bk-soft" disabled={!!busy} onClick={() => void taskStatus([tEdit.id], 'approved').then(() => setTEdit(null))} data-testid="task-approve">اعتماد</button>}</div>
          </div>
          <aside className="tk-rubric" aria-label="سُلّم التقدير" data-testid="task-rubric"><h5>سُلّم التقدير — {skillLabel(tEdit.skill)} <small>نسبةً إلى مستوى المهمة</small></h5>
            {bandsFor(tEdit.skill).map(({ dim, rows }) => <details key={dim} open={dim === 'task'}><summary>{DIMENSION_AR[dim] || dim}</summary><ol reversed>{rows.map((b) => <li key={b.score} value={b.score}><b>{b.score}</b> {b.text_ar}</li>)}</ol></details>)}
            {!bands.length && <p className="mm-note">السُلّم غير محمّل — نفّذ SQL م4-أ.</p>}
          </aside>
        </div>}
      </div></div>}
    </>}

    {view === 'passages' && <>
      <div className="bk-studio"><b>استوديو مِعيار</b><p>صوت الاستماع يُنتَج خارج الخادم بطاقم مِعيار الصوتي (حامد الراوي · زارية وتيم للحوار · شاكر وجمال وأمل للتنويع) ثم يُرفع هنا بصيغة MP3 — أو يوضع في <code>public/miaar/audio/&lt;المعرّف&gt;.mp3</code> في المستودع. الملف المرفوع يُقدَّم برابط موقَّع من الدلو الخاص.</p>
        <button type="button" className="bk-primary" onClick={() => setCreating(!creating)} aria-expanded={creating}><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" fill="none"/></svg>إضافة مقطع جديد</button></div>
      {creating && <div className="bk-edit bk-inline"><div className="bk-grid">
        <label>المعرّف<input value={newP.id} onChange={(e) => setNewP({ ...newP, id: e.target.value })} placeholder="R-B1-10 أو L-A2-05" dir="ltr" /></label>
        <label>المستوى<select value={newP.level} onChange={(e) => setNewP({ ...newP, level: e.target.value })}>{LEVELS_ALL.map((l) => <option key={l} value={l}>{BANK_LEVEL_AR[l as keyof typeof BANK_LEVEL_AR]}</option>)}</select></label>
        <label>المهارة<select value={newP.skill} onChange={(e) => setNewP({ ...newP, skill: e.target.value })}><option value="reading">قراءة</option><option value="listening">استماع</option></select></label>
        <label>العنوان<input value={newP.title} onChange={(e) => setNewP({ ...newP, title: e.target.value })} /></label></div>
        <label className="bk-full">النص<textarea rows={6} value={newP.body} onChange={(e) => setNewP({ ...newP, body: e.target.value })} dir="rtl" lang="ar" /></label>
        <div className="bk-row"><button type="button" className="bk-primary" disabled={!!busy} onClick={() => void createPassage()}>إنشاء المقطع</button><button type="button" className="bk-soft" onClick={() => setCreating(false)}>إلغاء</button></div></div>}
      <div className="bk-tablewrap"><table className="mm-t bk-t"><thead><tr><th>المعرّف</th><th>المستوى</th><th>المهارة</th><th>العنوان</th><th>الصوت</th><th>الحالة</th><th></th></tr></thead><tbody>
        {passages.map((p) => <tr key={p.id}><td><code>{p.id}</code><br /><small>{p.version || p.source}</small></td><td>{BANK_LEVEL_AR[p.level as keyof typeof BANK_LEVEL_AR] || p.level}</td><td>{p.skill === 'listening' ? 'استماع' : 'قراءة'}</td><td>{p.title}<br /><small>{p.body.split(/\s+/).length} كلمة{p.meta?.voices ? ` · ${(p.meta.voices as string[]).join(' + ')}` : ''}{p.meta?.twice ? ' · مرتين' : ''}</small></td>
          <td>{p.skill === 'listening' ? <>{p.audio_public_path ? <audio controls preload="none" src={p.audio_public_path} /> : <small>{audioOf(p) || 'لا صوت'}</small>}<label className="bk-up">رفع MP3<input type="file" accept="audio/mpeg,.mp3" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadAudio(p, file); e.currentTarget.value = ''; }} /></label></> : '—'}</td>
          <td><span className={`bk-st ${p.status}`}>{STATUS_AR[p.status] || p.status}</span></td><td><button type="button" className="bk-soft" onClick={() => setPEdit({ ...p })}>تحرير</button></td></tr>)}
        {!passages.length && <tr><td colSpan={7} className="am-empty">لا مقاطع.</td></tr>}
      </tbody></table></div>
      {pEdit && <div className="bk-backdrop" onClick={() => setPEdit(null)}><div className="bk-edit" role="dialog" aria-modal="true" aria-label={`تحرير ${pEdit.id}`} onClick={(e) => e.stopPropagation()}><div className="bk-eh"><h4>تحرير المقطع {pEdit.id}</h4><button type="button" className="bk-soft" onClick={() => setPEdit(null)}>إغلاق</button></div>
        <div className="bk-grid"><label>العنوان<input value={pEdit.title} onChange={(e) => setPEdit({ ...pEdit, title: e.target.value })} /></label>
          <label>الحالة<select value={pEdit.status} onChange={(e) => setPEdit({ ...pEdit, status: e.target.value })}>{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          {pEdit.skill === 'listening' && <label>مسار الصوت العام<input value={pEdit.audio_public_path || ''} onChange={(e) => setPEdit({ ...pEdit, audio_public_path: e.target.value })} dir="ltr" placeholder="/miaar/audio/L-A1-01.mp3" /></label>}</div>
        <label className="bk-full">النص{pEdit.skill === 'listening' && ' (النصّ المقروء — يُعرض للطاقم فقط)'}<textarea rows={8} value={pEdit.body} onChange={(e) => setPEdit({ ...pEdit, body: e.target.value })} dir="rtl" lang="ar" /></label>
        <div className="bk-row"><button type="button" className="bk-primary" disabled={!!busy} onClick={() => void savePassage()}>حفظ المقطع</button></div></div></div>}
    </>}
  </section>;
}
const CSS = `
.bk-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.bk-tabs{display:flex;gap:6px}.bk-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:6px 14px;font-weight:800;cursor:pointer;min-height:36px}.bk-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.bk-ok{color:#0f5c57;font-weight:800;margin:6px 0}.bk-batch{border:1px solid #ead9a6;background:#fbf5e4;border-radius:14px;padding:12px 14px;margin:10px 0;display:grid;gap:8px}.bk-batch>div:first-child{display:flex;gap:16px;flex-wrap:wrap;align-items:center}
.bk-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.bk-row input{flex:1;min-width:180px}.bk-soft{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;font-weight:800;cursor:pointer;min-height:36px}.bk-soft:disabled{opacity:.5;cursor:not-allowed}.bk-acts{white-space:nowrap}.bk-act{border:1px solid #e2e8f0;background:#fff;color:var(--navy);border-radius:999px;padding:5px 11px;font-weight:800;font-size:12.5px;cursor:pointer;min-height:30px;margin-inline-end:4px;transition:background-color .15s,border-color .15s}.bk-act:hover{background:#f1f5f9;border-color:#cbd5e1}.bk-act:active{background:#e2e8f0}.bk-act:focus-visible{outline:none;box-shadow:0 0 0 3px #fff,0 0 0 6px var(--teal)}.bk-act.ok{color:#047857;border-color:#a7f3d0}.bk-act.ok:hover{background:#ecfdf5}.bk-act.warn{color:#a16207;border-color:#fde68a}.bk-act.warn:hover{background:#fffbeb}.bk-act.danger{color:#b91c1c;border-color:#fecaca}.bk-act.danger:hover{background:#fef2f2}.bk-act:disabled{opacity:.45;cursor:not-allowed}
.bk-filters{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}.bk-filters input,.bk-filters select,.bk-row input,.bk-row select,.bk-grid input,.bk-grid select,.bk-full textarea,.bk-opt input{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;min-height:36px}.bk-chk{display:flex;align-items:center;gap:6px;font-size:13px}
.bk-bulk{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:13px;margin:4px 0 8px}.bk-pager{margin-inline-start:auto;display:flex;gap:6px}.bk-pager button{border:1px solid #cbd5e1;background:#fff;border-radius:8px;padding:4px 10px;cursor:pointer}.bk-pager button:disabled{opacity:.4}
.bk-tablewrap{overflow:auto}.bk-t td{vertical-align:top;font-size:13px}.bk-t code{font-size:12px}.bk-stem{max-width:360px}.bk-stem img{width:34px;height:34px;vertical-align:middle;margin-inline-start:6px}.bk-stem small{display:block;color:#64748b}.bk-dup{color:#b45309!important}.bk-t tr.dup{background:#fff7ed}
.bk-st{display:inline-block;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:800;background:#e2e8f0}.bk-st.approved{background:#d1fae5;color:#065f46}.bk-st.in_review{background:#fef3c7;color:#92400e}.bk-st.archived{background:#f1f5f9;color:#64748b}.bk-st.draft{background:#e0e7ff;color:#3730a3}
.bk-primary{display:inline-flex;align-items:center;gap:8px;min-height:44px;border:0;border-radius:12px;padding:8px 18px;background:var(--gold,#c9a24b);color:var(--navy,#0b2a4a);font-weight:900;font-size:14px;cursor:pointer;box-shadow:0 6px 16px rgba(201,162,75,.35)}.bk-primary:hover{filter:brightness(1.05)}.bk-primary:disabled{opacity:.55;cursor:not-allowed}.bk-primary svg{background:var(--navy,#0b2a4a);color:#fff;border-radius:50%;padding:2px}
.bk-backdrop{position:fixed;inset:0;z-index:1200;background:rgba(11,42,74,.55);backdrop-filter:blur(2px);display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow:auto}
.bk-edit{width:min(980px,100%);max-height:calc(100vh - 48px);overflow:auto;border:1px solid #e2e8f0;border-radius:16px;padding:16px;background:#fff;display:grid;gap:10px;box-shadow:0 24px 60px rgba(0,0,0,.25)}
.bk-edit.bk-inline{width:auto;max-height:none;box-shadow:none;background:#f8fafc;margin-top:12px}.bk-eh{display:flex;justify-content:space-between;align-items:center}.bk-eh h4{margin:0}.bk-eh small{color:#64748b;font-weight:600;margin-inline-start:8px}
.bk-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}.bk-grid label,.bk-full{display:grid;gap:4px;font-size:13px;font-weight:800}.bk-full textarea{font-weight:500}
.bk-opts{display:grid;gap:6px}.bk-opt{display:grid;grid-template-columns:auto 1fr 180px auto auto;gap:8px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:6px 8px;background:#fff}.bk-opt.key{border-color:#0b8a83;background:#ecfdf5}.bk-opt img{width:40px;height:40px}.bk-radio{font-weight:800}.bk-rat{grid-column:2/-1;color:#64748b}.bk-x{border:none;background:transparent;font-size:18px;cursor:pointer;color:#94a3b8}
.bk-studio{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px dashed #0b8a83;border-radius:14px;padding:12px;margin:10px 0}.bk-studio p{margin:0;flex:1;font-size:13px}.bk-up{display:inline-block;border:1px solid #cbd5e1;border-radius:8px;padding:3px 8px;font-size:12px;cursor:pointer;margin-top:4px}.bk-up input{display:none}
audio{height:30px;max-width:200px;vertical-align:middle}
.bk-tabs button small{display:block;font-size:10px;font-weight:600;color:#8a6d1f;line-height:1}.bk-count{align-self:center;font-size:13px}.bk-prodintro{border-color:#c9a24b;background:#fffbea}.bk-soft.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.bk-task{width:min(1180px,100%)}.tk-grid{display:grid;grid-template-columns:1fr 320px;gap:14px}.tk-form{display:grid;gap:10px}.tk-wc{font-weight:600;color:#0b8a83}
.tk-rubric{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc;font-size:12.5px;max-height:70vh;overflow:auto}.tk-rubric h5{margin:0 0 6px;font-size:13px}.tk-rubric h5 small{display:block;color:#64748b;font-weight:600}.tk-rubric details{border-top:1px solid #e2e8f0;padding:6px 0}.tk-rubric summary{font-weight:800;cursor:pointer}.tk-rubric ol{margin:6px 0 0;padding-inline-start:0;list-style:none;display:grid;gap:4px}.tk-rubric li b{display:inline-block;min-width:22px;height:22px;border-radius:6px;background:#0f2a4e;color:#fff;text-align:center;line-height:22px;margin-inline-end:6px;font-size:12px}
.tk-preview{border:1px solid #e6d9b3;border-radius:16px;padding:18px 20px;background:linear-gradient(180deg,#fffdf7,#fff);display:grid;gap:10px;max-width:720px;margin:0 auto}.tk-chip{justify-self:start;border-radius:999px;background:#0f2a4e;color:#fff;padding:3px 12px;font-size:12px;font-weight:800}.tk-img{width:120px;height:120px;object-fit:contain;justify-self:center}.tk-prompt{font-size:18px;line-height:1.9;margin:0;color:#0f2a4e;font-weight:700}.tk-en{color:#64748b;font-size:13px;margin:0}.tk-tips{margin:0;padding-inline-start:18px;color:#334155;font-size:14px;line-height:1.8}.tk-limits{display:flex;gap:8px;flex-wrap:wrap}.tk-limits span{border:1px solid #cbd5e1;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;background:#fff}
@media (max-width:860px){.tk-grid{grid-template-columns:1fr}}
@media (max-width:720px){.bk-opt{grid-template-columns:auto 1fr auto}.bk-img{display:none}}
`;
