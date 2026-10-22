'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { qrSvg } from '../../../lib/certificates/qr';
import { TEMPLATES, MCQ_KEYS, emptyMcq, impactUrl, makeToken } from '../../../lib/impact/model';
import { parseInstrumentText, parseRows, parseAnswerKey, applyAnswerKey, csvTemplate, validateQuestions, KEY_AR } from '../../../lib/impact/import';
import type { DraftQuestion } from '../../../lib/impact/import';
import { readInstrumentFile } from '../../../lib/impact/office';
import type { ImpactAssessment, ImpactQuestion, Phase, QuestionKind } from '../../../lib/impact/model';

type Program = { id: string; name_ar: string; name_en?: string | null; status?: string | null; description_ar?: string | null; objectives_ar?: string | null; outcomes_ar?: string | null };
type Classroom = { id: string; code: string; program_id: string | null };
type Counts = { pre: number; post: number; paired: number };
type Draft = Omit<ImpactQuestion, 'id'> & { id?: string; _tmp: string };

const NAVY = '#0f2a4e';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];

export default function ImpactAdminPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase();
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(''); const [orgId, setOrgId] = useState<string | null>(null); const [me, setMe] = useState<{ id: string; name: string }>({ id: '', name: '' });
  const [programs, setPrograms] = useState<Program[]>([]); const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [list, setList] = useState<ImpactAssessment[]>([]); const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  // builder
  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<ImpactAssessment | null>(null);
  const [form, setForm] = useState({ program_id: '', classroom_id: '', title_ar: '', title_en: '', intro_ar: '', scale_max: 5, identity_hint_ar: 'آخر 4 أرقام من رقم الهوية/الإقامة + سنة الميلاد (مثال: 4821-1998)', status: 'open' as ImpactAssessment['status'], pre_open: true, post_open: false });
  const [qs, setQs] = useState<Draft[]>([]);
  const [template, setTemplate] = useState('competency');
  // طرق البناء: يدوي / رفع ملف / ذكاء اصطناعي
  const [build, setBuild] = useState<'manual' | 'upload' | 'ai'>('manual');
  const [upText, setUpText] = useState(''); const [upKey, setUpKey] = useState(''); const [upName, setUpName] = useState(''); const [upRows, setUpRows] = useState<string[][] | null>(null);
  const [preview, setPreview] = useState<{ questions: DraftQuestion[]; warnings: string[]; source: string } | null>(null);
  const [ai, setAi] = useState({ objectives: '', axes: 'المعرفة\nالمهارة\nالتطبيق', count_mode: 'per_axis' as 'per_axis' | 'total', scale_count: 3, mcq_count: 3, tf_count: 0, level: 'intermediate' as 'basic' | 'intermediate' | 'advanced', audience: '', bilingual: false, notes: '', variety: true, mcq_style: 'mixed' as 'mixed' | 'concept' | 'scenario' });
  const [aiBusy, setAiBusy] = useState(false); const [aiMode, setAiMode] = useState('');
  const [aiCheck, setAiCheck] = useState<{ busy: boolean; text: string; ok?: boolean }>({ busy: false, text: '' });
  const AI_MAX = { perAxis: 40, total: 200 };
  const aiAxes = ai.axes.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const aiExpected = ai.count_mode === 'total' ? ai.scale_count + ai.mcq_count + ai.tf_count : Math.max(1, aiAxes.length) * (ai.scale_count + ai.mcq_count + ai.tf_count);
  const [busy, setBusy] = useState(false);
  const [qrFor, setQrFor] = useState<{ a: ImpactAssessment; phase: Phase } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [p, pg, cl] = await Promise.all([
        db.from('profiles').select('role,organization_id,full_name').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,name_en,status,description_ar,objectives_ar,outcomes_ar').order('name_ar'),
        db.from('classrooms').select('id,code,program_id').order('code'),
      ]);
      setRole(String(p.data?.role || '')); setOrgId(p.data?.organization_id || null); setMe({ id: user.id, name: p.data?.full_name || user.email || '' });
      setPrograms(((pg.data || []) as Program[]).filter(x => x.status !== 'CANCELLED')); setClassrooms((cl.data || []) as Classroom[]);
      await load();
      setReady(true);
      if (params.get('new') === '1') startNew(((pg.data || []) as Program[]).filter(x => x.status !== 'CANCELLED'));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data, error } = await db.from('impact_assessments').select('*').order('created_at', { ascending: false });
    if (error) { setError(error.message); return; }
    const rows = (data || []) as ImpactAssessment[]; setList(rows);
    const { data: rs } = await db.from('impact_responses').select('assessment_id,phase,respondent_hash');
    const c: Record<string, { pre: Set<string>; post: Set<string> }> = {};
    for (const r of (rs || []) as any[]) { c[r.assessment_id] ||= { pre: new Set(), post: new Set() }; c[r.assessment_id][r.phase as Phase].add(r.respondent_hash); }
    const out: Record<string, Counts> = {};
    for (const [k, v] of Object.entries(c)) out[k] = { pre: v.pre.size, post: v.post.size, paired: Array.from(v.pre).filter(h => v.post.has(h)).length };
    setCounts(out);
  }

  const pName = (id: string | null) => programs.find(p => p.id === id)?.name_ar || '—';
  const cCode = (id: string | null) => classrooms.find(c => c.id === id)?.code || '';

  function startNew(list: Program[] = programs) {
    setEditing(null);
    setForm({ program_id: list[0]?.id || '', classroom_id: '', title_ar: '', title_en: '', intro_ar: 'يهدف هذا القياس إلى معرفة أثر البرنامج على معارفك ومهاراتك. لا توجد إجابات صحيحة أو خاطئة في بنود التقدير الذاتي — أجب بصراحة.', scale_max: 5, identity_hint_ar: 'آخر 4 أرقام من رقم الهوية/الإقامة + سنة الميلاد (مثال: 4821-1998)', status: 'open', pre_open: true, post_open: false });
    applyTemplate('competency'); setBuild('manual'); setPreview(null); setUpText(''); setUpKey(''); setUpRows(null); setUpName(''); setMode('edit');
  }
  function applyTemplate(id: string) {
    setTemplate(id);
    const t = TEMPLATES.find(x => x.id === id);
    setQs((t?.questions || []).map((q, i) => ({ ...q, order_no: i + 1, _tmp: Math.random().toString(36).slice(2) })));
  }
  /* ---------- رفع أداة جاهزة ---------- */
  async function onUploadFile(f: File | null) {
    if (!f) return; setError(''); setUpName(f.name);
    try {
      const r = await readInstrumentFile(f);
      if (r.kind === 'rows') { setUpRows(r.rows); setUpText(r.rows.map(x => x.join(' | ')).join('\n')); }
      else { setUpRows(null); setUpText(r.text); }
    } catch (e: any) { setError(e?.message || 'تعذر قراءة الملف'); }
  }
  async function onKeyFile(f: File | null) {
    if (!f) return;
    try { const r = await readInstrumentFile(f); setUpKey(r.kind === 'rows' ? r.rows.map(x => x.join(' ')).join('\n') : r.text); } catch (e: any) { setError(e?.message || 'تعذر قراءة ملف الإجابة'); }
  }
  function runParse() {
    setError('');
    const res = upRows ? parseRows(upRows) : parseInstrumentText(upText);
    const warnings = [...res.warnings];
    if (upKey.trim()) { const k = parseAnswerKey(upKey); const ap = applyAnswerKey(res.questions, k); warnings.push(`نموذج الإجابة: طُبّق على ${ap.applied} سؤالًا${ap.missing.length ? ` — بلا إجابة: ${ap.missing.join('، ')}` : ''}.`); }
    const mcqNoKey = res.questions.filter(q => q.kind === 'mcq' && !q.correct_key).length;
    if (mcqNoKey) warnings.push(`${mcqNoKey} سؤال معرفي بلا إجابة صحيحة — حدّدها في المحرر قبل الحفظ.`);
    setPreview({ questions: res.questions, warnings, source: upName || 'نص ملصوق' });
  }
  function adoptPreview(mode: 'replace' | 'append') {
    if (!preview) return;
    const base = mode === 'append' ? qs : [];
    const add = preview.questions.map((q, i) => ({ ...q, order_no: base.length + i + 1, _tmp: Math.random().toString(36).slice(2) }));
    setQs([...base, ...add]); setPreview(null); setBuild('manual'); flash(`أُضيف ${add.length} بندًا إلى المحرر — راجعها ثم احفظ`);
    setTimeout(() => document.getElementById('ia-editor')?.scrollIntoView({ behavior: 'smooth' }), 50);
  }
  function downloadTemplate() {
    const blob = new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8' }); const u = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = u; a.download = 'قالب-أداة-قياس-الأثر.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(u), 2000);
  }
  /* ---------- توليد بالذكاء الاصطناعي ---------- */
  function prefillAi(pid: string) {
    const p = programs.find(x => x.id === pid); if (!p) return;
    const obj = [p.objectives_ar, p.outcomes_ar].filter(Boolean).join('\n').trim();
    setAi(a => ({ ...a, objectives: obj || a.objectives }));
  }
  async function runAi() {
    setAiBusy(true); setError(''); setAiMode('');
    try {
      const session = (await db.auth.getSession()).data.session; if (!session) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
      const p = programs.find(x => x.id === form.program_id);
      const r = await fetch('/api/impact/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ ...ai, axes: aiAxes, program_name: p?.name_ar || form.title_ar, program_desc: p?.description_ar || '' }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setAiMode(j.mode === 'ai' ? `تم التوليد بـ ${j.provider} / ${j.model}${j.batches > 1 ? ` على ${j.batches} دفعات` : ''}` : 'وضع التوليد المحلي');
      setPreview({ questions: j.questions || [], warnings: j.warnings || [], source: j.mode === 'ai' ? 'الذكاء الاصطناعي' : 'المولّد المحلي' });
    } catch (e: any) { setError(e?.message || 'تعذر التوليد'); }
    setAiBusy(false);
  }

  async function checkAi() {
    setAiCheck({ busy: true, text: 'جارٍ الفحص…' });
    try {
      const session = (await db.auth.getSession()).data.session; if (!session) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
      const r = await fetch('/api/impact/generate', { headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      if (!j.configured) setAiCheck({ busy: false, ok: false, text: j.hint });
      else if (j.valid) setAiCheck({ busy: false, ok: true, text: `✓ المفتاح صالح (${j.provider}) — النموذج: ${j.model}${j.model_env ? '' : ' (اكتُشف تلقائيًا)'}` });
      else setAiCheck({ busy: false, ok: false, text: `✗ ${j.error} — ${j.hint} (المفتاح: ${j.key_masked}، الطول ${j.key_length})` });
    } catch (e: any) { setAiCheck({ busy: false, ok: false, text: e?.message || 'تعذر الفحص' }); }
  }

  async function startEdit(a: ImpactAssessment) {
    setEditing(a);
    setForm({ program_id: a.program_id || '', classroom_id: a.classroom_id || '', title_ar: a.title_ar, title_en: a.title_en || '', intro_ar: a.intro_ar || '', scale_max: a.scale_max, identity_hint_ar: a.identity_hint_ar, status: a.status, pre_open: a.pre_open, post_open: a.post_open });
    const { data } = await db.from('impact_questions').select('*').eq('assessment_id', a.id).order('order_no');
    setQs(((data || []) as ImpactQuestion[]).map(q => ({ ...q, _tmp: q.id })));
    setBuild('manual'); setPreview(null); setMode('edit');
  }

  function updQ(i: number, patch: Partial<Draft>) { setQs(s => s.map((q, j) => j === i ? { ...q, ...patch } : q)); }
  function moveQ(i: number, d: -1 | 1) { setQs(s => { const a = [...s]; const j = i + d; if (j < 0 || j >= a.length) return s; [a[i], a[j]] = [a[j], a[i]]; return a.map((q, k) => ({ ...q, order_no: k + 1 })); }); }
  function addQ(kind: QuestionKind) { setQs(s => [...s, kind === 'scale' ? { kind: 'scale', domain_ar: s[s.length - 1]?.domain_ar || 'عام', text_ar: '', text_en: null, options: [], correct_key: null, weight: 1, order_no: s.length + 1, _tmp: Math.random().toString(36).slice(2) } : { ...emptyMcq(), order_no: s.length + 1, _tmp: Math.random().toString(36).slice(2) }]); }
  function delQ(i: number) { setQs(s => s.filter((_, j) => j !== i).map((q, k) => ({ ...q, order_no: k + 1 }))); }

  async function save() {
    if (!form.program_id) { setError('اختر البرنامج.'); return; }
    if (!form.title_ar.trim()) { setError('اكتب عنوان الأداة.'); return; }
    const valid = qs.filter(q => q.text_ar.trim());
    if (!valid.length) { setError('أضف بندًا واحدًا على الأقل.'); return; }
    const verrs = validateQuestions(valid); if (verrs.length) { setError(verrs.slice(0, 3).join(' ')); return; }
    setBusy(true); setError('');
    try {
      let id = editing?.id;
      const payload = { organization_id: orgId, program_id: form.program_id, classroom_id: form.classroom_id || null, title_ar: form.title_ar.trim(), title_en: form.title_en.trim() || null, intro_ar: form.intro_ar.trim() || null, scale_max: form.scale_max, identity_hint_ar: form.identity_hint_ar.trim(), status: form.status, pre_open: form.pre_open, post_open: form.post_open };
      if (!id) {
        const { data, error } = await db.from('impact_assessments').insert({ ...payload, token: makeToken(), created_by: me.id, created_by_name: me.name } as any).select('id').single();
        if (error) throw error; id = (data as any).id;
      } else {
        const { error } = await db.from('impact_assessments').update(payload as any).eq('id', id); if (error) throw error;
      }
      // الأسئلة: نحدّث الموجودة ونضيف الجديدة ونحذف المحذوفة (الاستجابات تحتفظ بالقيم بمعرّف السؤال)
      const keep = valid.filter(q => q.id).map(q => q.id as string);
      if (editing) {
        const { data: ex } = await db.from('impact_questions').select('id').eq('assessment_id', id);
        const gone = ((ex || []) as any[]).map(r => r.id).filter(x => !keep.includes(x));
        if (gone.length) await db.from('impact_questions').delete().in('id', gone);
      }
      for (const q of valid) {
        const row = { assessment_id: id, order_no: q.order_no, kind: q.kind, domain_ar: q.domain_ar.trim() || 'عام', text_ar: q.text_ar.trim(), text_en: q.text_en?.trim() || null, options: q.kind === 'mcq' ? q.options.filter(o => o.ar.trim()) : [], correct_key: q.kind === 'mcq' ? q.correct_key : null, weight: q.weight ?? 1 };
        const r = q.id ? await db.from('impact_questions').update(row as any).eq('id', q.id) : await db.from('impact_questions').insert(row as any);
        if (r.error) throw r.error;
      }
      flash(editing ? 'تم حفظ التعديلات' : 'تم إنشاء الأداة — انسخ الرابط القبلي وشاركه مع المتدربين');
      await load(); setMode('list');
    } catch (e: any) { setError(e?.message || 'تعذر الحفظ'); }
    setBusy(false);
  }

  async function toggle(a: ImpactAssessment, patch: Partial<ImpactAssessment>) {
    const { error } = await db.from('impact_assessments').update(patch as any).eq('id', a.id);
    if (error) { setError(error.message); return; }
    setList(s => s.map(x => x.id === a.id ? { ...x, ...patch } : x));
  }
  async function remove(a: ImpactAssessment) {
    const c = counts[a.id]; if (!confirm(`حذف «${a.title_ar}» نهائيًا${c ? ` مع ${c.pre + c.post} استجابة` : ''}؟`)) return;
    const { error } = await db.from('impact_assessments').delete().eq('id', a.id);
    if (error) { setError(error.message); return; } flash('تم الحذف'); load();
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); flash('تم نسخ الرابط'); } catch { prompt('انسخ الرابط:', text); } }

  const allowed = ALLOWED.includes(role.toUpperCase());
  const progClassrooms = useMemo(() => classrooms.filter(c => !form.program_id || c.program_id === form.program_id), [classrooms, form.program_id]);
  if (!ready) return <div className="ia" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="ia" dir="rtl">
      <style>{CSS}</style>
      <header className="ia-head">
        <div>
          <div className="ia-kicker"><Icon name="target" size={14} /> مركز الإدارة</div>
          <h1>قياس أثر التدريب — قبلي / بعدي</h1>
          <p>أنشئ أداة قياس لكل برنامج (تقدير ذاتي للكفايات أو اختبار معرفي)، شارك رابط القياس القبلي قبل البدء والبعدي بعد الختام، ثم اقرأ الأثر في التقرير.</p>
        </div>
        <nav className="ia-nav">
          <Link href="/dashboard" className="ia-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/reports/impact" className="ia-btn"><Icon name="trend" size={16} /> تقرير الأثر</Link>
          {allowed && mode === 'list' && <button className="ia-btn primary" onClick={() => startNew()}><Icon name="plus" size={16} /> أداة جديدة</button>}
        </nav>
      </header>
      {!allowed && <div className="ia-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة ومديري البرامج ومحللي الجودة.</div>}
      {error && <div className="ia-alert err"><Icon name="alert" size={18} /> <span style={{ flex: 1 }}>{error}</span><button className="ia-x" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}

      {mode === 'list' && (
        <section className="ia-card">
          <h2><Icon name="folder" size={18} /> أدوات القياس <span className="ia-pill">{list.length}</span></h2>
          {!list.length && <div className="ia-empty"><Icon name="target" size={34} /><b>لا توجد أدوات بعد</b><span>ابدأ بـ «أداة جديدة» — تحصل على قالب جاهز من 8 بنود يمكن تعديله خلال دقيقة.</span>{allowed && <button className="ia-btn primary" onClick={() => startNew()}><Icon name="plus" size={16} /> أداة جديدة</button>}</div>}
          <div className="ia-list">
            {list.map(a => {
              const c = counts[a.id] || { pre: 0, post: 0, paired: 0 };
              return (
                <article className={`ia-item ${a.status}`} key={a.id}>
                  <div className="ia-item-main">
                    <div className="ia-item-title"><b>{a.title_ar}</b><span className={`ia-status ${a.status}`}>{a.status === 'open' ? 'مفتوحة' : a.status === 'closed' ? 'مغلقة' : 'مسودة'}</span></div>
                    <div className="ia-muted">{pName(a.program_id)}{a.classroom_id ? ` · ${cCode(a.classroom_id)}` : ''} · الرمز <bdi className="ia-token">{a.token}</bdi> · أُنشئت {String(a.created_at || '').slice(0, 10)}</div>
                    <div className="ia-counts"><span>قبلي <b>{c.pre}</b></span><span>بعدي <b>{c.post}</b></span><span className={c.paired ? 'ok' : ''}>مزدوج <b>{c.paired}</b></span></div>
                  </div>
                  <div className="ia-phases">
                    {(['pre', 'post'] as Phase[]).map(ph => {
                      const open = ph === 'pre' ? a.pre_open : a.post_open;
                      return (
                        <div className={`ia-ph ${open ? 'open' : ''}`} key={ph}>
                          <div className="ia-ph-head"><b>{ph === 'pre' ? 'القياس القبلي' : 'القياس البعدي'}</b>
                            <label className="ia-switch"><input type="checkbox" checked={open} disabled={!allowed} onChange={e => toggle(a, ph === 'pre' ? { pre_open: e.target.checked } : { post_open: e.target.checked })} /><span>{open ? 'مفتوح' : 'مغلق'}</span></label>
                          </div>
                          <div className="ia-ph-actions">
                            <button className="ia-ic" title="نسخ الرابط" onClick={() => copy(impactUrl(a.token, ph))}><Icon name="link" size={15} /></button>
                            <button className="ia-ic" title="رمز QR للعرض/الطباعة" onClick={() => setQrFor({ a, phase: ph })}><Icon name="print" size={15} /></button>
                            <a className="ia-ic" title="فتح النموذج" href={impactUrl(a.token, ph)} target="_blank" rel="noreferrer"><Icon name="globe" size={15} /></a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="ia-item-actions">
                    <Link href={`/reports/impact?assessment=${a.id}`} className="ia-btn small"><Icon name="trend" size={14} /> التقرير</Link>
                    {allowed && <button className="ia-btn small" onClick={() => startEdit(a)}><Icon name="edit" size={14} /> تعديل</button>}
                    {allowed && a.status !== 'closed' && <button className="ia-btn small" onClick={() => toggle(a, { status: 'closed', pre_open: false, post_open: false })}><Icon name="stop" size={14} /> إغلاق</button>}
                    {allowed && a.status === 'closed' && <button className="ia-btn small" onClick={() => toggle(a, { status: 'open' })}><Icon name="play" size={14} /> إعادة فتح</button>}
                    {allowed && <button className="ia-btn small danger" onClick={() => remove(a)}><Icon name="trash" size={14} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {mode === 'edit' && (
        <>
          <section className="ia-card">
            <h2><Icon name="edit" size={18} /> {editing ? 'تعديل الأداة' : 'أداة قياس جديدة'}</h2>
            <div className="ia-grid">
              <label>البرنامج *<select value={form.program_id} onChange={e => setForm(f => ({ ...f, program_id: e.target.value, classroom_id: '' }))}><option value="">— اختر —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label>القاعة (اختياري)<select value={form.classroom_id} onChange={e => setForm(f => ({ ...f, classroom_id: e.target.value }))}><option value="">كل قاعات البرنامج</option>{progClassrooms.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label>
              <label>سلّم المقياس<select value={form.scale_max} onChange={e => setForm(f => ({ ...f, scale_max: Number(e.target.value) }))}><option value={5}>1 – 5</option><option value={4}>1 – 4</option><option value={7}>1 – 7</option><option value={10}>1 – 10</option></select></label>
              <label>عنوان الأداة *<input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} placeholder="مثال: قياس أثر برنامج الانغماس اللغوي — الدفعة 3" /></label>
              <label>العنوان بالإنجليزية<input value={form.title_en} onChange={e => setForm(f => ({ ...f, title_en: e.target.value }))} dir="ltr" /></label>
              <label>تلميح المعرّف الشخصي<input value={form.identity_hint_ar} onChange={e => setForm(f => ({ ...f, identity_hint_ar: e.target.value }))} /></label>
              <label className="ia-span3">مقدمة تظهر للمتدرب<textarea rows={2} value={form.intro_ar} onChange={e => setForm(f => ({ ...f, intro_ar: e.target.value }))} /></label>
            </div>
            <div className="ia-row">
              <label className="ia-check"><input type="checkbox" checked={form.pre_open} onChange={e => setForm(f => ({ ...f, pre_open: e.target.checked }))} /> فتح القياس القبلي الآن</label>
              <label className="ia-check"><input type="checkbox" checked={form.post_open} onChange={e => setForm(f => ({ ...f, post_open: e.target.checked }))} /> فتح القياس البعدي الآن</label>
              <label className="ia-check"><input type="checkbox" checked={form.status === 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.checked ? 'draft' : 'open' }))} /> حفظ كمسودة (الرابط لا يعمل)</label>
            </div>
          </section>

          <section className="ia-card">
            <h2><Icon name="question" size={18} /> طريقة بناء الأداة</h2>
            <div className="ia-modes">
              <button className={`ia-mode ${build === 'manual' ? 'on' : ''}`} onClick={() => setBuild('manual')}><Icon name="edit" size={18} /><b>بناء يدوي</b><small>قالب جاهز أو من الصفر: نوع السؤال، النص، 4 بدائل، نموذج الإجابة</small></button>
              <button className={`ia-mode ${build === 'upload' ? 'on' : ''}`} onClick={() => setBuild('upload')}><Icon name="folder" size={18} /><b>رفع أداة جاهزة</b><small>Word / Excel / CSV / نص + نموذج الإجابة — وتقوم المنصة بالإعداد</small></button>
              <button className={`ia-mode ${build === 'ai' ? 'on' : ''}`} onClick={() => { setBuild('ai'); prefillAi(form.program_id); }}><Icon name="star" size={18} /><b>توليد بالذكاء الاصطناعي</b><small>وفق أهداف البرنامج ومحاوره: بنود مقياس + أسئلة معرفية بإجاباتها</small></button>
            </div>

            {build === 'manual' && !editing && <div className="ia-templates">{TEMPLATES.map(t => <button key={t.id} className={`ia-tpl ${template === t.id ? 'on' : ''}`} onClick={() => applyTemplate(t.id)}><b>{t.ar}</b><small>{t.desc}</small></button>)}</div>}

            {build === 'upload' && (
              <div className="ia-panel">
                <div className="ia-grid">
                  <label className="ia-span2">١) ملف الأداة (docx / xlsx / csv / txt)<input type="file" accept=".docx,.xlsx,.csv,.tsv,.txt,.md" onChange={e => onUploadFile(e.target.files?.[0] || null)} />{upName && <small className="ia-muted">تمت قراءة: {upName}{upRows ? ` — ${upRows.length} صفًا` : ''}</small>}</label>
                  <label>أو قالب Excel جاهز<button type="button" className="ia-btn" onClick={downloadTemplate}><Icon name="download" size={14} /> تنزيل القالب (CSV)</button></label>
                  <label className="ia-span3">أو الصق نص الأداة<textarea rows={6} value={upText} onChange={e => { setUpText(e.target.value); setUpRows(null); }} placeholder={'المحور: المعرفة\n1. ما المقصود بـ…؟\nأ. البديل الأول\nب. البديل الثاني *\nج. البديل الثالث\nد. البديل الرابع\n2. أستطيع تطبيق … دون مساعدة   (بند بلا بدائل = مقياس 1–5)'} dir="auto" /></label>
                  <label className="ia-span2">٢) نموذج الإجابة (اختياري إن كانت الإجابة محدّدة بعلامة * داخل الأداة)<textarea rows={2} value={upKey} onChange={e => setUpKey(e.target.value)} placeholder="1-ب  2-أ  3-د  4-ج   أو سطر لكل سؤال: 1. ب" dir="auto" /></label>
                  <label>أو ملف نموذج الإجابة<input type="file" accept=".docx,.xlsx,.csv,.txt" onChange={e => onKeyFile(e.target.files?.[0] || null)} /></label>
                </div>
                <div className="ia-row"><button className="ia-btn primary" onClick={runParse} disabled={!upText.trim() && !upRows}><Icon name="refresh" size={14} /> تحليل الأداة وإعدادها</button><small className="ia-muted">الصيغ المفهومة: ترقيم 1. / 1) / س1 — البدائل أ. ب. ج. د. أو A. B. C. D. — عناوين المحاور «المحور: …» — علامة * أو ✓ بعد البديل الصحيح.</small></div>
              </div>
            )}

            {build === 'ai' && (
              <div className="ia-panel">
                <div className="ia-grid">
                  <label className="ia-span3">أهداف/مخرجات البرنامج (تُقرأ تلقائيًا من بطاقة البرنامج إن وُجدت)<textarea rows={4} value={ai.objectives} onChange={e => setAi(a => ({ ...a, objectives: e.target.value }))} placeholder={'أن يتمكن المتدرب من…\nأن يميّز المتدرب بين…'} /></label>
                  <label>محاور البرنامج (محور في كل سطر)<textarea rows={4} value={ai.axes} onChange={e => setAi(a => ({ ...a, axes: e.target.value }))} /></label>
                  <label>الفئة المستهدفة<input value={ai.audience} onChange={e => setAi(a => ({ ...a, audience: e.target.value }))} placeholder="مثال: معلمو المرحلة الابتدائية" /></label>
                  <label>المستوى<select value={ai.level} onChange={e => setAi(a => ({ ...a, level: e.target.value as any }))}><option value="basic">أساسي</option><option value="intermediate">متوسط</option><option value="advanced">متقدم</option></select></label>
                  <div className="ia-span3 ia-row" style={{ gap: 18 }}>
                    <b>توزيع العدد:</b>
                    <label className="ia-check"><input type="radio" name="count_mode" checked={ai.count_mode === 'per_axis'} onChange={() => setAi(a => ({ ...a, count_mode: 'per_axis', scale_count: Math.min(a.scale_count, AI_MAX.perAxis), mcq_count: Math.min(a.mcq_count, AI_MAX.perAxis), tf_count: Math.min(a.tf_count, AI_MAX.perAxis) }))} /> لكل محور</label>
                    <label className="ia-check"><input type="radio" name="count_mode" checked={ai.count_mode === 'total'} onChange={() => setAi(a => ({ ...a, count_mode: 'total' }))} /> إجمالي للأداة (يوزَّع تلقائيًا على المحاور)</label>
                  </div>
                  <label>بنود تقدير ذاتي {ai.count_mode === 'total' ? '(إجمالي)' : '(لكل محور)'}<input type="number" min={0} max={ai.count_mode === 'total' ? AI_MAX.total : AI_MAX.perAxis} value={ai.scale_count} onChange={e => setAi(a => ({ ...a, scale_count: Math.max(0, Number(e.target.value) || 0) }))} /></label>
                  <label>أسئلة اختيار من متعدد (4 بدائل) {ai.count_mode === 'total' ? '(إجمالي)' : '(لكل محور)'}<input type="number" min={0} max={ai.count_mode === 'total' ? AI_MAX.total : AI_MAX.perAxis} value={ai.mcq_count} onChange={e => setAi(a => ({ ...a, mcq_count: Math.max(0, Number(e.target.value) || 0) }))} /></label>
                  <label>أسئلة صح/خطأ {ai.count_mode === 'total' ? '(إجمالي)' : '(لكل محور)'}<input type="number" min={0} max={ai.count_mode === 'total' ? AI_MAX.total : AI_MAX.perAxis} value={ai.tf_count} onChange={e => setAi(a => ({ ...a, tf_count: Math.max(0, Number(e.target.value) || 0) }))} /></label>
                  <label>نمط الأسئلة المعرفية<select value={ai.mcq_style} onChange={e => setAi(a => ({ ...a, mcq_style: e.target.value as any }))}><option value="mixed">مزيج (مفاهيم + مواقف تطبيقية)</option><option value="concept">مفاهيمية مباشرة</option><option value="scenario">مواقف تطبيقية (سيناريوهات)</option></select></label>
                  <label className="ia-span2">ملاحظات للمولّد (اختياري)<input value={ai.notes} onChange={e => setAi(a => ({ ...a, notes: e.target.value }))} placeholder="مثال: ركّز على التطبيق العملي، تجنّب المصطلحات الإنجليزية، اجعل السيناريوهات من بيئة المدرسة…" /></label>
                  <label className="ia-check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={ai.variety} onChange={e => setAi(a => ({ ...a, variety: e.target.checked }))} /> تنويع الصياغة ومستويات بلوم (تذكر → تقويم)</label>
                  <label className="ia-check" style={{ alignSelf: 'end' }}><input type="checkbox" checked={ai.bilingual} onChange={e => setAi(a => ({ ...a, bilingual: e.target.checked }))} /> ترجمة إنجليزية للبنود</label>
                  <div className="ia-span3"><small className={aiExpected > AI_MAX.total ? 'ia-bad' : 'ia-muted'}>الإجمالي المتوقع: <b>{aiExpected}</b> بندًا على {aiAxes.length || 1} محور{aiExpected > AI_MAX.total ? ` — يتجاوز الحد الأقصى (${AI_MAX.total}) وسيُقلَّص تلقائيًا` : aiExpected > 60 ? ' — الأعداد الكبيرة تُولَّد على دفعات وقد تستغرق حتى دقيقة' : ''}</small></div>
                </div>
                <div className="ia-row"><button className="ia-btn primary" onClick={runAi} disabled={aiBusy || aiExpected === 0}><Icon name="star" size={14} /> {aiBusy ? 'جارٍ التوليد…' : 'توليد الأداة'}</button><button className="ia-btn" onClick={checkAi} disabled={aiCheck.busy}><Icon name="shield" size={14} /> فحص إعداد الذكاء الاصطناعي</button>{aiMode && <small className="ia-muted">{aiMode}</small>}<small className="ia-muted">يُراجع الخبير البنود المولّدة ويعدّلها قبل الحفظ؛ الإجابات الصحيحة قابلة للتعديل.</small></div>
                {aiCheck.text && <div className={`ia-note ${aiCheck.ok === false ? 'bad' : aiCheck.ok ? 'ok' : ''}`}>{aiCheck.text}</div>}
              </div>
            )}

            {preview && (
              <div className="ia-preview">
                <div className="ia-preview-head"><b><Icon name="check" size={16} /> تم إعداد {preview.questions.length} بندًا من {preview.source}</b><span className="ia-muted">{preview.questions.filter(q => q.kind === 'scale').length} مقياس · {preview.questions.filter(q => q.kind === 'mcq').length} معرفي · {Array.from(new Set(preview.questions.map(q => q.domain_ar))).length} محور</span></div>
                {preview.warnings.length > 0 && <ul className="ia-warn">{preview.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
                <ol className="ia-preview-list">
                  {preview.questions.map(q => <li key={q.order_no}><span className={`ia-kind ${q.kind}`}>{q.kind === 'mcq' ? (q.options.length === 2 ? 'صح/خطأ' : 'اختيار') : 'مقياس'}</span><span className="ia-muted">[{q.domain_ar}]</span> {q.text_ar}{q.kind === 'mcq' && <div className="ia-preview-opts">{q.options.map(o => <span key={o.k} className={o.k === q.correct_key ? 'ok' : ''}>{KEY_AR[o.k] || o.k}. {o.ar}</span>)}{!q.correct_key && <span className="bad">بلا إجابة</span>}</div>}</li>)}
                </ol>
                <div className="ia-row"><button className="ia-btn primary" onClick={() => adoptPreview('replace')} disabled={!preview.questions.length}><Icon name="check" size={14} /> اعتماد البنود (استبدال المحرر)</button><button className="ia-btn" onClick={() => adoptPreview('append')} disabled={!preview.questions.length}><Icon name="plus" size={14} /> إضافة إلى البنود الحالية</button><button className="ia-btn" onClick={() => setPreview(null)}>إلغاء</button></div>
              </div>
            )}
          </section>

          <section className="ia-card" id="ia-editor">
            <h2><Icon name="edit" size={18} /> البنود <span className="ia-pill">{qs.length}</span> <small className="ia-muted">نوع السؤال → نص السؤال → البدائل (4 للاختيار من متعدد) → نموذج الإجابة</small></h2>
            <div className="ia-qs">
              {qs.map((q, i) => (
                <div className="ia-q" key={q._tmp}>
                  <div className="ia-q-top">
                    <span className="ia-qn">{q.order_no}</span>
                    <select value={q.kind === 'mcq' && q.options.length === 2 && /^(صحيح|خطأ)$/.test(q.options[0]?.ar || '') ? 'tf' : q.kind} onChange={e => updQ(i, e.target.value === 'mcq' ? { ...emptyMcq(), text_ar: q.text_ar, domain_ar: q.domain_ar } : e.target.value === 'tf' ? { kind: 'mcq', options: [{ k: 'a', ar: 'صحيح' }, { k: 'b', ar: 'خطأ' }], correct_key: 'a' } : { kind: 'scale', options: [], correct_key: null })}><option value="scale">مقياس تقدير (1–5)</option><option value="mcq">اختيار من متعدد (4 بدائل)</option><option value="tf">صح / خطأ</option></select>
                    <input className="ia-dom" value={q.domain_ar} onChange={e => updQ(i, { domain_ar: e.target.value })} placeholder="المحور" list="ia-domains" />
                    <div className="ia-q-tools"><button className="ia-ic" onClick={() => moveQ(i, -1)} disabled={i === 0}>↑</button><button className="ia-ic" onClick={() => moveQ(i, 1)} disabled={i === qs.length - 1}>↓</button><button className="ia-ic danger" onClick={() => delQ(i)}><Icon name="trash" size={14} /></button></div>
                  </div>
                  <input className="ia-qtext" value={q.text_ar} onChange={e => updQ(i, { text_ar: e.target.value })} placeholder={q.kind === 'scale' ? 'نص البند (عبارة تقدير ذاتي)…' : 'نص السؤال المعرفي…'} />
                  <input className="ia-qtext en" value={q.text_en || ''} onChange={e => updQ(i, { text_en: e.target.value })} placeholder="English (optional)" dir="ltr" />
                  {q.kind === 'mcq' && (
                    <div className="ia-opts">
                      {q.options.map((o, oi) => (
                        <div className="ia-opt" key={o.k}>
                          <label className="ia-radio" title="الإجابة الصحيحة"><input type="radio" name={`c-${q._tmp}`} checked={q.correct_key === o.k} onChange={() => updQ(i, { correct_key: o.k })} /><span>{o.k.toUpperCase()}</span></label>
                          <input value={o.ar} onChange={e => updQ(i, { options: q.options.map((x, k) => k === oi ? { ...x, ar: e.target.value } : x) })} placeholder={`الخيار ${o.k.toUpperCase()}`} />
                          <button className="ia-ic" onClick={() => updQ(i, { options: q.options.filter((_, k) => k !== oi), correct_key: q.correct_key === o.k ? (q.options[0]?.k || null) : q.correct_key })} disabled={q.options.length <= 2}><Icon name="x" size={12} /></button>
                        </div>
                      ))}
                      {q.options.length < MCQ_KEYS.length && <button className="ia-btn small" onClick={() => updQ(i, { options: [...q.options, { k: MCQ_KEYS[q.options.length], ar: '' }] })}><Icon name="plus" size={12} /> خيار</button>}
                      <small className="ia-muted"><b>نموذج الإجابة:</b> حدّد البديل الصحيح بالدائرة{q.correct_key ? ` — الإجابة الحالية: ${KEY_AR[q.correct_key] || q.correct_key}` : ' — لم تُحدَّد بعد'}. تُحتسب نسبة الصواب لكل مرحلة.</small>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <datalist id="ia-domains">{Array.from(new Set(qs.map(q => q.domain_ar))).map(d => <option key={d} value={d} />)}</datalist>
            <div className="ia-row">
              <button className="ia-btn" onClick={() => addQ('scale')}><Icon name="plus" size={14} /> بند مقياس</button>
              <button className="ia-btn" onClick={() => addQ('mcq')}><Icon name="plus" size={14} /> سؤال معرفي</button>
            </div>
          </section>

          <div className="ia-row ia-save">
            <button className="ia-btn primary" disabled={busy} onClick={save}><Icon name="save" size={16} /> {busy ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إنشاء الأداة'}</button>
            <button className="ia-btn" onClick={() => setMode('list')}>إلغاء</button>
            {editing && <small className="ia-muted">تعديل نص بند موجود لا يؤثر على الاستجابات السابقة؛ حذف بند يحذف قيمه من التحليل.</small>}
          </div>
        </>
      )}

      {qrFor && (
        <div className="ia-modal" onClick={() => setQrFor(null)}>
          <div className="ia-modal-box" onClick={e => e.stopPropagation()}>
            <div className="ia-print">
              <div className="ia-print-logos"><img src="/logos/upm.png" alt="" /><img src="/logos/gate.png" alt="" /></div>
              <h3>{qrFor.a.title_ar}</h3>
              <p>{qrFor.phase === 'pre' ? 'القياس القبلي — قبل بدء البرنامج' : 'القياس البعدي — بعد ختام البرنامج'}</p>
              <div className="ia-qr" dangerouslySetInnerHTML={{ __html: qrSvg(impactUrl(qrFor.a.token, qrFor.phase), 220) }} />
              <bdi className="ia-url">{impactUrl(qrFor.a.token, qrFor.phase)}</bdi>
              <small>امسح الرمز بكاميرا الجوال · استخدم نفس المعرّف الشخصي في القياسين</small>
            </div>
            <div className="ia-row ia-noprint"><button className="ia-btn primary" onClick={() => window.print()}><Icon name="print" size={14} /> طباعة</button><button className="ia-btn" onClick={() => copy(impactUrl(qrFor.a.token, qrFor.phase))}><Icon name="link" size={14} /> نسخ الرابط</button><button className="ia-btn" onClick={() => setQrFor(null)}>إغلاق</button></div>
          </div>
        </div>
      )}
      {toast && <div className="ia-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.ia{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.ia-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ia-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.ia-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.ia-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ia-nav{display:flex;gap:8px;flex-wrap:wrap}
.ia-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.ia-btn:disabled{opacity:.5;cursor:not-allowed}.ia-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}.ia-btn.small{padding:6px 10px;font-size:12px}.ia-btn.danger{color:#b91c1c;border-color:#fecaca}
.ia-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}.ia-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.ia-x{border:0;background:transparent;cursor:pointer;color:inherit}
.ia-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.ia-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.ia-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}
.ia-muted{color:#64748b;font-size:12.5px;font-weight:700}
.ia-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:14px}.ia-empty b{color:${NAVY};font-size:15px}
.ia-list{display:flex;flex-direction:column;gap:12px}
.ia-item{border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:1.3fr 1.4fr auto;gap:14px;align-items:center;border-inline-start:5px solid #0b8a83}.ia-item.closed{border-inline-start-color:#94a3b8;opacity:.9}.ia-item.draft{border-inline-start-color:#f59e0b}
.ia-item-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ia-item-title b{font-size:15px;color:${NAVY}}
.ia-status{font-size:11px;font-weight:900;border-radius:999px;padding:2px 9px;background:#ecfdf5;color:#047857}.ia-status.closed{background:#f1f5f9;color:#475569}.ia-status.draft{background:#fff7ed;color:#b45309}
.ia-token{font-family:ui-monospace,Menlo,monospace;font-weight:900;color:${NAVY}}
.ia-counts{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.ia-counts span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#475569}.ia-counts span b{color:${NAVY}}.ia-counts span.ok{background:#ecfdf5;border-color:#a7f3d0}.ia-counts span.ok b{color:#047857}
.ia-phases{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ia-ph{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#f8fafc}.ia-ph.open{background:#ecfdf5;border-color:#a7f3d0}
.ia-ph-head{display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:8px}.ia-ph-head b{font-size:13px;color:${NAVY}}
.ia-switch{display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:800;color:#475569;cursor:pointer}
.ia-ph-actions{display:flex;gap:6px}
.ia-ic{width:30px;height:30px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:${NAVY};text-decoration:none;font:inherit}.ia-ic:disabled{opacity:.4}.ia-ic.danger{color:#b91c1c}
.ia-item-actions{display:flex;flex-direction:column;gap:6px}
.ia-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ia-span3{grid-column:1/-1}
.ia label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}
.ia select,.ia input,.ia textarea{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff}
.ia-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}.ia-save{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px}
.ia-check{flex-direction:row!important;align-items:center;gap:8px!important;font-size:13px!important;color:#334155!important}
.ia-templates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.ia-tpl{border:2px solid #e2e8f0;background:#fff;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;font:inherit;cursor:pointer;text-align:start}.ia-tpl b{color:${NAVY};font-size:14px}.ia-tpl small{color:#64748b;font-weight:700;line-height:1.6}.ia-tpl.on{border-color:#0b8a83;background:#ecfdf5}
.ia-qs{display:flex;flex-direction:column;gap:10px}
.ia-q{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fbfdff;display:flex;flex-direction:column;gap:8px}
.ia-q-top{display:flex;gap:8px;align-items:center}.ia-q-top select{padding:7px 8px;font-size:12px}.ia-dom{max-width:180px;padding:7px 10px!important;font-size:12px!important}
.ia-qn{min-width:26px;height:26px;border-radius:8px;background:${NAVY};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}
.ia-q-tools{margin-inline-start:auto;display:flex;gap:4px}
.ia-qtext{width:100%;font-size:14px!important}.ia-qtext.en{font-size:12px!important;color:#475569!important}
.ia-opts{display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:#fff;border:1px dashed #cbd5e1;border-radius:10px}
.ia-opt{display:flex;gap:8px;align-items:center}.ia-opt input[type=text],.ia-opt input:not([type]){flex:1}
.ia-radio{flex-direction:row!important;align-items:center;gap:4px!important;cursor:pointer}.ia-radio span{width:24px;height:24px;border-radius:7px;background:#eef2f7;display:grid;place-items:center;font-size:11px;font-weight:900;color:${NAVY}}
.ia-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:grid;place-items:center;z-index:100;padding:20px}
.ia-modal-box{background:#fff;border-radius:18px;padding:22px;max-width:460px;width:100%;text-align:center}
.ia-print-logos{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.ia-print-logos img{height:44px;object-fit:contain}
.ia-print h3{margin:6px 0 2px;color:${NAVY};font-size:18px}.ia-print p{margin:0 0 10px;color:#0b8a83;font-weight:800;font-size:13px}
.ia-qr{display:inline-block;padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px}.ia-qr svg{display:block}
.ia-url{display:block;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#334155;word-break:break-all;margin-bottom:6px}
.ia-print small{display:block;color:#64748b;font-weight:700;font-size:12px}
.ia-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.ia-mode{border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;font:inherit;cursor:pointer;text-align:start;color:${NAVY}}.ia-mode b{font-size:14.5px}.ia-mode small{color:#64748b;font-weight:700;line-height:1.6}.ia-mode.on{border-color:#0b8a83;background:#ecfdf5}
.ia-panel{border:1px dashed #cbd5e1;border-radius:14px;padding:14px;background:#fbfdff;margin-bottom:12px}.ia-span2{grid-column:span 2}
.ia input[type=file]{padding:8px;background:#fff}
.ia-preview{border:1px solid #a7f3d0;background:#f0fdf9;border-radius:14px;padding:14px;margin-top:10px}
.ia-preview-head{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px}.ia-preview-head b{color:#047857;display:flex;gap:6px;align-items:center}
.ia-bad{color:#b91c1c;font-weight:800}
.ia-note{margin-top:8px;padding:8px 12px;border-radius:10px;font-size:12.5px;font-weight:700;line-height:1.8;background:#f1f5f9;border:1px solid #e2e8f0;color:#334155}
.ia-note.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}
.ia-note.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.ia-warn{margin:0 0 10px;padding:8px 26px 8px 10px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;font-size:12.5px;font-weight:700;line-height:1.8}
.ia-preview-list{margin:0;padding:0 20px 0 0;max-height:340px;overflow:auto;font-size:13px;font-weight:700;line-height:1.8;display:flex;flex-direction:column;gap:4px}
.ia-kind{display:inline-block;font-size:10.5px;font-weight:900;border-radius:999px;padding:1px 8px;background:#e0f2fe;color:#075985;margin-inline-end:6px}.ia-kind.mcq{background:#fef3c7;color:#92400e}
.ia-preview-opts{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;font-weight:700;color:#475569;margin:2px 0 4px}.ia-preview-opts span{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:1px 8px}.ia-preview-opts span.ok{background:#dcfce7;border-color:#86efac;color:#166534}.ia-preview-opts span.bad{background:#fee2e2;border-color:#fecaca;color:#991b1b}
.ia-toast{position:fixed;bottom:18px;inset-inline-start:18px;background:${NAVY};color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:120}
@media print{.ia>*:not(.ia-modal){display:none!important}.ia{padding:0;background:#fff}.ia-modal{position:static;background:#fff;padding:0}.ia-modal-box{max-width:none;box-shadow:none}.ia-noprint{display:none!important}.ia-qr svg{width:360px;height:360px}}
@media(max-width:980px){.ia-modes{grid-template-columns:1fr}.ia-span2{grid-column:auto}.ia-item{grid-template-columns:1fr}.ia-item-actions{flex-direction:row;flex-wrap:wrap}.ia-grid,.ia-templates{grid-template-columns:1fr}.ia{padding:12px}}
`;
