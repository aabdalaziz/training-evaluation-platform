'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import {
  QUESTION_KINDS, TEMPLATE_KINDS, RATING_KINDS, kindLabel, templateKindLabel, templateName,
  emptyDraft, draftFromQuestion, validateQuestion, questionPayload, questionsOf, nextOrder, move, renumber,
  templateStats, coverage, linkPlan, duplicatePayload, previewGroups, estimateMinutes,
} from '../../../lib/templates/model';
import type { Template, Question, TemplateLink, ProgramLite, QuestionDraft, TemplateKind } from '../../../lib/templates/model';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const EDIT_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const VIEW_ROLES = [...EDIT_ROLES, 'QUALITY_ANALYST'];

type Tab = 'questions' | 'preview';

export default function TemplatesPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const [role, setRole] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]); const [questions, setQuestions] = useState<Question[]>([]);
  const [links, setLinks] = useState<TemplateLink[]>([]); const [programs, setPrograms] = useState<ProgramLite[]>([]);
  const [selected, setSelected] = useState<string>(''); const [tab, setTab] = useState<Tab>('questions');
  const [busy, setBusy] = useState(false);
  const [editingQ, setEditingQ] = useState<string | null>(null); const [draft, setDraft] = useState<QuestionDraft>(emptyDraft()); const [draftErrors, setDraftErrors] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newTpl, setNewTpl] = useState<{ open: boolean; kind: TemplateKind; name: string; copyFrom: string }>({ open: false, kind: 'DAILY', name: '', copyFrom: '' });
  const [renaming, setRenaming] = useState(false); const [renameVal, setRenameVal] = useState('');

  async function load(keep?: string) {
    const [t, q, l, p] = await Promise.all([
      db.from('evaluation_templates').select('id,kind,name_ar,name_en').limit(500),
      db.from('questions').select('id,template_id,kind,text_ar,text_en,section_ar,section_en,is_required,options,max_value,order_index,question_key').limit(5000),
      db.from('program_evaluation_templates').select('program_id,template_id,is_active'),
      db.from('programs').select('id,name_ar,status').order('name_ar'),
    ]);
    const err = t.error || q.error || l.error || p.error;
    if (err) setError(err.message);
    const ts = ((t.data || []) as any[]).map(x => ({ ...x, kind: String(x.kind || '').toUpperCase() })) as Template[];
    setTemplates(ts);
    setQuestions(((q.data || []) as any[]).map(x => ({ ...x, options: Array.isArray(x.options) ? x.options : [], is_required: !!x.is_required, order_index: Number(x.order_index) || 0 })) as Question[]);
    setLinks(((l.data || []) as any[]).map(x => ({ ...x, is_active: x.is_active !== false })) as TemplateLink[]);
    setPrograms((p.data || []) as ProgramLite[]);
    setSelected(s => keep || (s && ts.some(x => x.id === s) ? s : (ts[0]?.id || '')));
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/templates'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      const r = String((prof as any)?.role || '').toUpperCase(); setRole(r);
      if (!VIEW_ROLES.includes(r)) { router.replace('/dashboard'); return; }
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canEdit = EDIT_ROLES.includes(role);
  const stats = useMemo(() => templateStats(templates, questions, links), [templates, questions, links]);
  const cov = useMemo(() => coverage(programs, templates, questions, links), [programs, templates, questions, links]);
  const current = templates.find(t => t.id === selected) || null;
  const currentQs = useMemo(() => current ? questionsOf(questions, current.id) : [], [questions, current]);
  const currentPrograms = useMemo(() => current ? cov.filter(c => (c.daily?.id === current.id) || (c.final?.id === current.id)).map(c => c.program) : [], [cov, current]);
  const gaps = cov.filter(c => !c.ok).length;

  function flash(msg: string) { setOk(msg); setError(''); setTimeout(() => setOk(''), 4000); }
  function fail(e: any) { setError(e?.message || String(e) || 'تعذر تنفيذ العملية'); setOk(''); }

  // ---------- التغطية: تغيير القالب المفعّل لبرنامج ----------
  async function setProgramTemplate(programId: string, kind: TemplateKind, templateId: string) {
    if (!canEdit) return;
    setBusy(true);
    try {
      const plan = linkPlan(programId, kind, templateId || null, templates, links);
      for (const l of plan.deactivate) { const { error } = await db.from('program_evaluation_templates').update({ is_active: false } as any).eq('program_id', l.program_id).eq('template_id', l.template_id); if (error) throw error; }
      if (plan.activate) { const { error } = await db.from('program_evaluation_templates').update({ is_active: true } as any).eq('program_id', plan.activate.program_id).eq('template_id', plan.activate.template_id); if (error) throw error; }
      if (plan.insert) { const { error } = await db.from('program_evaluation_templates').insert(plan.insert as any); if (error) throw error; }
      await load(); flash(templateId ? 'تم تحديث القالب المفعّل للبرنامج' : 'تم فصل القالب عن البرنامج');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  // ---------- القوالب ----------
  async function createTemplate() {
    if (!canEdit) return;
    setBusy(true);
    try {
      const src = templates.find(t => t.id === newTpl.copyFrom) || null;
      const payload = src ? duplicatePayload(src, questions, newTpl.name) : { template: { kind: newTpl.kind, name_ar: newTpl.name.trim() || (newTpl.kind === 'FINAL' ? 'قالب ختامي جديد' : 'قالب يومي جديد'), name_en: null }, questions: [] };
      const { data, error } = await db.from('evaluation_templates').insert(payload.template as any).select('id').single();
      if (error || !data) throw error || new Error('تعذر إنشاء القالب');
      const id = (data as any).id as string;
      if (payload.questions.length) { const { error: qe } = await db.from('questions').insert(payload.questions.map(q => ({ ...q, template_id: id })) as any); if (qe) throw qe; }
      setNewTpl({ open: false, kind: 'DAILY', name: '', copyFrom: '' });
      await load(id); setTab('questions'); flash(src ? `تم نسخ «${templateName(src)}» مع ${payload.questions.length} سؤالًا` : 'تم إنشاء القالب — أضف أسئلته الآن');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function renameTemplate() {
    if (!current || !canEdit) return;
    setBusy(true);
    try { const { error } = await db.from('evaluation_templates').update({ name_ar: renameVal.trim() || templateName(current) } as any).eq('id', current.id); if (error) throw error; setRenaming(false); await load(current.id); flash('تم تغيير الاسم'); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function deleteTemplate() {
    if (!current || !canEdit) return;
    const n = currentPrograms.length;
    if (!window.confirm(`حذف القالب «${templateName(current)}» وأسئلته (${currentQs.length})؟${n ? `\nسيُفصل عن ${n} برنامج.` : ''}\nلا يمكن التراجع.`)) return;
    setBusy(true);
    try {
      const { error } = await db.from('evaluation_templates').delete().eq('id', current.id); if (error) throw error;
      await load(''); flash('تم حذف القالب');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  // ---------- الأسئلة ----------
  function startAdd() { setAdding(true); setEditingQ(null); setDraft(emptyDraft()); setDraftErrors([]); }
  function startEdit(q: Question) { setEditingQ(q.id); setAdding(false); setDraft(draftFromQuestion(q)); setDraftErrors([]); }
  function cancelEdit() { setEditingQ(null); setAdding(false); setDraftErrors([]); }
  async function saveQuestion() {
    if (!current || !canEdit) return;
    const errs = validateQuestion(draft); setDraftErrors(errs); if (errs.length) return;
    setBusy(true);
    try {
      const payload = questionPayload(draft);
      if (editingQ) { const { error } = await db.from('questions').update(payload as any).eq('id', editingQ); if (error) throw error; }
      else { const { error } = await db.from('questions').insert({ ...payload, template_id: current.id, order_index: nextOrder(questions, current.id) } as any); if (error) throw error; }
      await load(current.id); cancelEdit(); flash(editingQ ? 'تم تحديث السؤال' : 'تمت إضافة السؤال');
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function deleteQuestion(q: Question) {
    if (!canEdit || !window.confirm(`حذف السؤال:\n«${q.text_ar}»؟`)) return;
    setBusy(true);
    try { const { error } = await db.from('questions').delete().eq('id', q.id); if (error) throw error; await load(current?.id); flash('تم حذف السؤال'); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function moveQuestion(from: number, to: number) {
    if (!current || !canEdit) return;
    const ordered = move(currentQs, from, to); const changes = renumber(ordered);
    if (!changes.length) return;
    setBusy(true);
    try {
      for (const c of changes) { const { error } = await db.from('questions').update({ order_index: c.order_index } as any).eq('id', c.id); if (error) throw error; }
      await load(current.id);
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  if (!ready) return <div className="tp" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const kindMeta = QUESTION_KINDS.find(k => k.id === draft.kind);

  const editor = (
    <div className="tp-editor">
      <div className="tp-grid2">
        <label>نوع السؤال<select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value })}>{QUESTION_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select><small>{kindMeta?.hint}</small></label>
        <label>القسم (عربي)<input value={draft.section_ar} onChange={e => setDraft({ ...draft, section_ar: e.target.value })} placeholder="مثال: المدرب / المحتوى / البيئة التدريبية" list="tp-sections" /><datalist id="tp-sections">{Array.from(new Set(currentQs.map(q => q.section_ar).filter(Boolean))).map(s => <option key={s as string} value={s as string} />)}</datalist></label>
      </div>
      <label>نص السؤال (عربي) *<textarea rows={2} value={draft.text_ar} onChange={e => setDraft({ ...draft, text_ar: e.target.value })} /></label>
      <div className="tp-grid2">
        <label>Question text (English)<input dir="ltr" value={draft.text_en} onChange={e => setDraft({ ...draft, text_en: e.target.value })} /></label>
        <label>Section (English)<input dir="ltr" value={draft.section_en} onChange={e => setDraft({ ...draft, section_en: e.target.value })} /></label>
      </div>
      {kindMeta?.hasOptions && <label>الخيارات — سطر لكل خيار<textarea rows={4} value={draft.optionsText} onChange={e => setDraft({ ...draft, optionsText: e.target.value })} placeholder={'ممتاز\nجيد\nمقبول'} /></label>}
      <div className="tp-grid2">
        {kindMeta?.isScale && <label>الحد الأعلى للمقياس<input type="number" min={3} max={10} value={draft.max_value} onChange={e => setDraft({ ...draft, max_value: Number(e.target.value) })} /></label>}
        <label className="tp-check"><input type="checkbox" checked={draft.is_required} onChange={e => setDraft({ ...draft, is_required: e.target.checked })} /> سؤال إلزامي</label>
      </div>
      {draftErrors.length > 0 && <div className="tp-alert">{draftErrors.map(e => <div key={e}>• {e}</div>)}</div>}
      <div className="tp-actions"><button className="tp-btn primary" disabled={busy} onClick={saveQuestion}><Icon name="save" size={15} /> {editingQ ? 'حفظ التعديل' : 'إضافة السؤال'}</button><button className="tp-btn" disabled={busy} onClick={cancelEdit}>إلغاء</button></div>
    </div>
  );

  return (
    <div className="tp" dir="rtl">
      <style>{CSS}</style>
      <header className="tp-head">
        <div>
          <div className="tp-kicker"><Icon name="doc" size={14} /> الاستدامة · قوالب التقييم</div>
          <h1>قوالب التقييم والأسئلة</h1>
          <p>من هنا تتحكم فيما يراه المشارك في استمارتي التقييم اليومي والختامي: أنشئ القوالب، حرّر الأسئلة ورتّبها، واربط كل برنامج بقالبه — بلا أي SQL. التعديلات تُطبَّق فورًا على الاستمارات العامة وتُسجَّل في سجل التدقيق.</p>
        </div>
        <nav className="tp-nav">
          <Link href="/dashboard" className="tp-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/management" className="tp-btn"><Icon name="admin" size={16} /> مركز الإدارة</Link>
          <Link href="/evaluate/daily" target="_blank" className="tp-btn"><Icon name="link" size={16} /> فتح الاستمارة</Link>
        </nav>
      </header>
      {error && <div className="tp-alert">{error}</div>}
      {ok && <div className="tp-alert ok">{ok}</div>}
      {!canEdit && <div className="tp-alert warn">عرض فقط — التحرير متاح لمديري المنصة والإداريين ومديري البرامج.</div>}

      <section className="tp-kpis">
        <div className="tp-kpi"><b>{templates.length}</b><span>قالبًا</span></div>
        <div className="tp-kpi"><b>{questions.length}</b><span>سؤالًا</span></div>
        <div className={`tp-kpi ${gaps ? 'warn' : 'ok'}`}><b>{programs.length - gaps}/{programs.length}</b><span>برامج مكتملة التغطية</span></div>
        <div className={`tp-kpi ${gaps ? 'warn' : ''}`}><b>{gaps}</b><span>برامج تحتاج ربطًا</span></div>
      </section>

      <section className="tp-card">
        <div className="tp-card-head"><h2><Icon name="link" size={16} /> تغطية البرامج</h2><span>قالب واحد مفعّل لكل نوع — اختر من القائمة ليُحفظ فورًا</span></div>
        <div className="tp-scroll">
          <table className="tp-table">
            <thead><tr><th>البرنامج</th><th>القالب اليومي</th><th>القالب الختامي</th><th>الحالة</th></tr></thead>
            <tbody>
              {cov.map(c => (
                <tr key={c.program.id} className={c.ok ? '' : 'gap'}>
                  <td><b>{c.program.name_ar}</b><small>{c.program.status || ''}</small></td>
                  {(['DAILY', 'FINAL'] as TemplateKind[]).map(k => {
                    const cur = k === 'DAILY' ? c.daily : c.final; const n = k === 'DAILY' ? c.dailyQuestions : c.finalQuestions;
                    return (
                      <td key={k}>
                        <select disabled={!canEdit || busy} value={cur?.id || ''} onChange={e => setProgramTemplate(c.program.id, k, e.target.value)}>
                          <option value="">— بلا قالب —</option>
                          {templates.filter(t => t.kind === k).map(t => <option key={t.id} value={t.id}>{templateName(t)}</option>)}
                        </select>
                        <small className={cur && !n ? 'bad' : ''}>{cur ? `${n} سؤال` : 'غير مرتبط'}</small>
                      </td>
                    );
                  })}
                  <td>{c.ok ? <span className="tp-st ok"><Icon name="check" size={12} /> جاهز</span> : <span className="tp-st warn"><Icon name="alert" size={12} /> {!c.daily ? 'بلا يومي' : !c.final ? 'بلا ختامي' : 'قالب بلا أسئلة'}</span>}</td>
                </tr>
              ))}
              {!cov.length && <tr><td colSpan={4} className="tp-empty-cell">لا توجد برامج بعد.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="tp-split">
        <aside className="tp-card tp-side">
          <div className="tp-card-head"><h2><Icon name="folder" size={16} /> القوالب</h2>{canEdit && <button className="tp-btn small primary" onClick={() => setNewTpl({ ...newTpl, open: !newTpl.open })}><Icon name="plus" size={14} /> جديد</button>}</div>
          {newTpl.open && canEdit && (
            <div className="tp-new">
              <label>الاسم<input value={newTpl.name} onChange={e => setNewTpl({ ...newTpl, name: e.target.value })} placeholder="مثال: التقييم اليومي — برنامج التفويض" /></label>
              <label>نسخ من قالب موجود (اختياري)<select value={newTpl.copyFrom} onChange={e => setNewTpl({ ...newTpl, copyFrom: e.target.value })}><option value="">— قالب فارغ —</option>{templates.map(t => <option key={t.id} value={t.id}>{templateKindLabel(t.kind)} · {templateName(t)}</option>)}</select></label>
              {!newTpl.copyFrom && <label>النوع<select value={newTpl.kind} onChange={e => setNewTpl({ ...newTpl, kind: e.target.value as TemplateKind })}>{TEMPLATE_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>}
              <div className="tp-actions"><button className="tp-btn primary" disabled={busy} onClick={createTemplate}><Icon name="save" size={14} /> إنشاء</button><button className="tp-btn" onClick={() => setNewTpl({ open: false, kind: 'DAILY', name: '', copyFrom: '' })}>إلغاء</button></div>
            </div>
          )}
          <div className="tp-tlist">
            {stats.map(s => (
              <button key={s.template.id} className={`tp-titem ${selected === s.template.id ? 'on' : ''}`} onClick={() => { setSelected(s.template.id); cancelEdit(); setRenaming(false); }}>
                <span className={`tp-kind ${s.template.kind}`}>{templateKindLabel(s.template.kind)}</span>
                <b>{templateName(s.template)}</b>
                <small>{s.questions} سؤال · {s.activePrograms} برنامج</small>
              </button>
            ))}
            {!stats.length && <div className="tp-empty"><Icon name="folder" size={30} /><b>لا توجد قوالب</b><span>أنشئ قالبًا يوميًا وآخر ختاميًا ثم اربطهما بالبرامج.</span></div>}
          </div>
        </aside>

        <section className="tp-card tp-main">
          {!current ? <div className="tp-empty"><Icon name="doc" size={30} /><b>اختر قالبًا من القائمة</b></div> : (
            <>
              <div className="tp-card-head wrap">
                <div className="tp-title">
                  <span className={`tp-kind ${current.kind}`}>{templateKindLabel(current.kind)}</span>
                  {renaming ? <span className="tp-rename"><input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus /><button className="tp-btn small primary" disabled={busy} onClick={renameTemplate}>حفظ</button><button className="tp-btn small" onClick={() => setRenaming(false)}>إلغاء</button></span>
                    : <h2>{templateName(current)}</h2>}
                  <small>{currentQs.length} سؤال · {currentQs.filter(q => q.is_required).length} إلزامي · ≈ {estimateMinutes(currentQs)} دقيقة تعبئة · مرتبط بـ {currentPrograms.length} برنامج</small>
                </div>
                <div className="tp-actions">
                  <div className="tp-tabs"><button className={tab === 'questions' ? 'on' : ''} onClick={() => setTab('questions')}>الأسئلة</button><button className={tab === 'preview' ? 'on' : ''} onClick={() => setTab('preview')}>معاينة</button></div>
                  {canEdit && !renaming && <button className="tp-btn small" onClick={() => { setRenaming(true); setRenameVal(templateName(current)); }}><Icon name="edit" size={13} /> إعادة تسمية</button>}
                  {canEdit && <button className="tp-btn small" onClick={() => setNewTpl({ open: true, kind: current.kind as TemplateKind, name: `${templateName(current)} — نسخة`, copyFrom: current.id })}><Icon name="copy" size={13} /> نسخ</button>}
                  {canEdit && <button className="tp-btn small danger" disabled={busy} onClick={deleteTemplate}><Icon name="trash" size={13} /> حذف</button>}
                </div>
              </div>
              {currentPrograms.length > 0 && <div className="tp-chips">{currentPrograms.map(p => <span key={p.id} className="tp-chip">{p.name_ar}</span>)}</div>}

              {tab === 'questions' && (
                <>
                  <ol className="tp-qlist">
                    {currentQs.map((q, i) => (
                      <li key={q.id} className={editingQ === q.id ? 'editing' : ''}>
                        <div className="tp-q">
                          <span className="tp-num">{i + 1}</span>
                          <div className="tp-qbody">
                            <b>{q.text_ar}{q.is_required && <i title="إلزامي"> *</i>}</b>
                            {q.text_en && <span dir="ltr" className="tp-en">{q.text_en}</span>}
                            <div className="tp-meta"><span className="tp-tag">{kindLabel(q.kind)}{RATING_KINDS.includes(q.kind) && q.max_value ? ` 1–${q.max_value}` : ''}</span>{q.section_ar && <span className="tp-tag sec">{q.section_ar}</span>}{q.options?.length > 0 && <span className="tp-tag">{q.options.length} خيارات: {q.options.join(' · ')}</span>}</div>
                          </div>
                          {canEdit && (
                            <div className="tp-qact">
                              <button title="أعلى" disabled={busy || i === 0} onClick={() => moveQuestion(i, i - 1)}>▲</button>
                              <button title="أسفل" disabled={busy || i === currentQs.length - 1} onClick={() => moveQuestion(i, i + 1)}>▼</button>
                              <button title="تعديل" disabled={busy} onClick={() => startEdit(q)}><Icon name="edit" size={13} /></button>
                              <button title="حذف" className="danger" disabled={busy} onClick={() => deleteQuestion(q)}><Icon name="trash" size={13} /></button>
                            </div>
                          )}
                        </div>
                        {editingQ === q.id && editor}
                      </li>
                    ))}
                  </ol>
                  {!currentQs.length && !adding && <div className="tp-empty"><Icon name="question" size={30} /><b>القالب بلا أسئلة</b><span>الاستمارة ستظهر فارغة للمشارك — أضف الأسئلة أو انسخ قالبًا جاهزًا.</span></div>}
                  {canEdit && (adding ? editor : <button className="tp-btn primary tp-add" onClick={startAdd}><Icon name="plus" size={15} /> إضافة سؤال</button>)}
                </>
              )}

              {tab === 'preview' && (
                <div className="tp-preview">
                  <div className="tp-pv-head"><b>{current.kind === 'FINAL' ? 'التقييم الختامي للبرنامج التدريبي' : 'التقييم اليومي لجلسات التدريب'}</b><span>هكذا يرى المشارك الأسئلة (ترتيبًا وأقسامًا)</span></div>
                  {previewGroups(currentQs).map((g, gi) => (
                    <div key={g.section} className="tp-pv-sec">
                      <div className="tp-pv-sec-h"><span>{gi + 1}</span>{g.section}</div>
                      {g.items.map(q => (
                        <div key={q.id} className="tp-pv-q">
                          <b>{q.text_ar}{q.is_required && ' *'}</b>{q.text_en && <small dir="ltr">{q.text_en}</small>}
                          {RATING_KINDS.includes(q.kind) && <div className="tp-pv-scale">{Array.from({ length: q.max_value || 5 }, (_, i) => <span key={i}>{q.kind === 'STARS' ? '★' : i + 1}</span>)}</div>}
                          {q.kind === 'YES_NO' && <div className="tp-pv-scale two"><span>نعم</span><span>لا</span></div>}
                          {(q.kind === 'SINGLE_CHOICE' || q.kind === 'MULTI_CHOICE') && <div className="tp-pv-opts">{q.options.map(o => <span key={o}>{q.kind === 'MULTI_CHOICE' ? '☐' : '○'} {o}</span>)}</div>}
                          {(q.kind === 'SHORT_TEXT' || q.kind === 'LONG_TEXT') && <div className={`tp-pv-text ${q.kind === 'LONG_TEXT' ? 'long' : ''}`}>اكتب إجابتك هنا…</div>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {!currentQs.length && <div className="tp-empty"><b>لا شيء للمعاينة</b></div>}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <section className="tp-card tp-how">
        <b>ملاحظات:</b> الأسئلة التي عليها إجابات مسجلة لا يمكن حذفها (انسخ القالب وعدّل النسخة ثم اربطها بالبرنامج) · القالب الذي عليه تقييمات لا يمكن حذفه لكن يمكن فصله عن البرامج · البرامج الجديدة تُربط تلقائيًا بالقالبين الأكثر أسئلة ويمكنك تغيير ذلك من جدول التغطية · أنواع المقياس (رقمي/نجوم/ليكرت) هي التي تدخل في متوسط الرضا والتقارير.
      </section>
    </div>
  );
}

const CSS = `
.tp{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.tp *{box-sizing:border-box}
.tp-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.tp-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.tp-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.tp-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.tp-nav{display:flex;gap:8px;flex-wrap:wrap}
.tp-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none;white-space:nowrap}.tp-btn:disabled{opacity:.5;cursor:default}.tp-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}.tp-btn.small{padding:6px 10px;font-size:12px}.tp-btn.danger{color:#b91c1c;border-color:#fecaca}
.tp-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700;white-space:pre-line}.tp-alert.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.tp-alert.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}
.tp-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.tp-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}.tp-kpi b{display:block;font-size:22px;color:${NAVY}}.tp-kpi span{font-size:12px;font-weight:800;color:#64748b}.tp-kpi.ok b{color:#047857}.tp-kpi.warn b{color:#b45309}
.tp-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:14px}
.tp-card-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap}.tp-card-head h2{margin:0;font-size:16px;color:${NAVY};display:flex;align-items:center;gap:8px}.tp-card-head>span{font-size:12px;color:#64748b;font-weight:700}
.tp-scroll{overflow-x:auto}
.tp-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}.tp-table th{text-align:right;background:#f8fafc;color:#475569;font-size:12px;padding:9px 10px;border-bottom:1px solid #e2e8f0}.tp-table td{padding:9px 10px;border-bottom:1px solid #f1f5f9;vertical-align:top}.tp-table td b{display:block}.tp-table td small{display:block;color:#64748b;font-size:11.5px;margin-top:3px}.tp-table td small.bad{color:#b91c1c;font-weight:800}.tp-table tr.gap td{background:#fffbeb}
.tp-table select,.tp-editor select,.tp-editor input,.tp-editor textarea,.tp-new select,.tp-new input,.tp-rename input{width:100%;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;font:inherit;font-size:13px;background:#fff;color:#0f172a}
.tp-st{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:900;border-radius:999px;padding:3px 9px}.tp-st.ok{background:#ecfdf5;color:#047857}.tp-st.warn{background:#fff7ed;color:#b45309}
.tp-empty-cell{text-align:center;color:#64748b;padding:18px}
.tp-split{display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start}
.tp-tlist{display:flex;flex-direction:column;gap:6px}
.tp-titem{display:flex;flex-direction:column;align-items:flex-start;gap:3px;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff;font:inherit;text-align:right;cursor:pointer;color:#0f172a}.tp-titem.on{border-color:${TEAL};background:#f0fdfa;box-shadow:inset 3px 0 0 ${TEAL}}.tp-titem b{font-size:13.5px}.tp-titem small{color:#64748b;font-size:11.5px}
.tp-kind{font-size:10.5px;font-weight:900;border-radius:6px;padding:2px 7px;background:#e0f2fe;color:#075985}.tp-kind.FINAL{background:#fef3c7;color:#92400e}
.tp-new{border:1px dashed #cbd5e1;border-radius:12px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px;background:#f8fafc}
.tp-new label,.tp-editor label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#475569}.tp-editor label small{font-weight:600;color:#94a3b8}
.tp-title{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.tp-title h2{margin:0;font-size:18px;color:${NAVY}}.tp-title small{color:#64748b;font-size:12px}
.tp-rename{display:flex;gap:6px;align-items:center}.tp-rename input{min-width:240px}
.tp-actions{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.tp-tabs{display:inline-flex;border:1px solid #cbd5e1;border-radius:10px;overflow:hidden}.tp-tabs button{border:0;background:#fff;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:800;color:#475569;cursor:pointer}.tp-tabs button.on{background:${NAVY};color:#fff}
.tp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}.tp-chip{font-size:11.5px;font-weight:800;background:#f1f5f9;color:#334155;border-radius:999px;padding:3px 10px}
.tp-qlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}.tp-qlist li{border:1px solid #e2e8f0;border-radius:12px;background:#fff}.tp-qlist li.editing{border-color:${TEAL}}
.tp-q{display:flex;gap:10px;padding:10px 12px;align-items:flex-start}
.tp-num{flex:0 0 26px;height:26px;border-radius:8px;background:${NAVY};color:#fff;font-weight:900;font-size:12px;display:inline-flex;align-items:center;justify-content:center}
.tp-qbody{flex:1;min-width:0}.tp-qbody b{display:block;font-size:13.5px;line-height:1.5}.tp-qbody b i{color:#b91c1c;font-style:normal}.tp-en{display:block;color:#64748b;font-size:12px;text-align:left}
.tp-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:5px}.tp-tag{font-size:11px;font-weight:800;background:#f1f5f9;color:#475569;border-radius:6px;padding:2px 7px}.tp-tag.sec{background:#fef3c7;color:#92400e}
.tp-qact{display:flex;gap:4px;flex-shrink:0}.tp-qact button{border:1px solid #e2e8f0;background:#fff;border-radius:8px;width:30px;height:30px;font:inherit;font-size:12px;cursor:pointer;color:#334155;display:inline-flex;align-items:center;justify-content:center}.tp-qact button:disabled{opacity:.35;cursor:default}.tp-qact button.danger{color:#b91c1c}
.tp-editor{border-top:1px dashed #e2e8f0;padding:12px;display:flex;flex-direction:column;gap:10px;background:#f8fafc;border-radius:0 0 12px 12px}
.tp-add+.tp-editor,.tp-main>.tp-editor{border:1px solid ${TEAL};border-radius:12px;margin-top:10px}
.tp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.tp-check{flex-direction:row!important;align-items:center;gap:8px!important;font-size:13px!important;padding-top:20px}.tp-check input{width:auto!important}
.tp-add{margin-top:10px}
.tp-empty{text-align:center;padding:26px 14px;color:#64748b;display:flex;flex-direction:column;align-items:center;gap:6px}.tp-empty b{color:${NAVY}}.tp-empty span{font-size:12.5px;max-width:420px;line-height:1.7}
.tp-preview{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc}
.tp-pv-head{text-align:center;margin-bottom:12px}.tp-pv-head b{display:block;font-size:17px;color:${NAVY}}.tp-pv-head span{font-size:12px;color:#64748b}
.tp-pv-sec{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin-bottom:10px}
.tp-pv-sec-h{display:flex;align-items:center;gap:8px;font-weight:900;color:${NAVY};margin-bottom:8px}.tp-pv-sec-h span{width:22px;height:22px;border-radius:7px;background:${NAVY};color:#fff;font-size:11px;display:inline-flex;align-items:center;justify-content:center}
.tp-pv-q{padding:8px 0;border-top:1px dashed #e2e8f0}.tp-pv-q b{display:block;font-size:13.5px}.tp-pv-q small{display:block;color:#64748b;font-size:11.5px;text-align:left}
.tp-pv-scale{display:flex;gap:6px;margin-top:6px;direction:ltr}.tp-pv-scale span{flex:1;border:1px solid #cbd5e1;border-radius:8px;text-align:center;padding:6px 0;font-weight:800;font-size:13px;color:${NAVY}}.tp-pv-scale.two{direction:rtl}
.tp-pv-opts{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}.tp-pv-opts span{border:1px solid #cbd5e1;border-radius:8px;padding:5px 10px;font-size:12.5px}
.tp-pv-text{border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;margin-top:6px;color:#94a3b8;font-size:12.5px;background:#fff}.tp-pv-text.long{min-height:64px}
.tp-how{font-size:12.5px;color:#475569;line-height:1.8}
@media(max-width:900px){.tp{padding:12px}.tp-kpis{grid-template-columns:repeat(2,1fr)}.tp-split{grid-template-columns:1fr}.tp-grid2{grid-template-columns:1fr}.tp-check{padding-top:0}.tp-q{flex-wrap:wrap}.tp-qact{width:100%;justify-content:flex-end}.tp-rename input{min-width:0}}
`;
