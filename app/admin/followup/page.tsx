'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { qrSvg } from '../../../lib/certificates/qr';
import { parseInstrumentText } from '../../../lib/impact/import';
import { normalizeSpec } from '../../../lib/impact/generate';
import { TEMPLATE, DEFAULT_BARRIERS, KIND_LABEL, AUDIENCE_LABEL, ROLE_LABEL, makeToken, followupUrl, suggestOpenAt, parseRecipients, recipientsText } from '../../../lib/behavior/model';
import type { BehaviorFollowup, BehaviorQuestion, BehaviorKind, Audience, Recipient } from '../../../lib/behavior/model';

type Program = { id: string; name_ar: string; name_en?: string | null; status?: string | null; end_date?: string | null; objectives_ar?: string | null; description_ar?: string | null };
type Classroom = { id: string; code: string; program_id: string | null };
type Draft = Omit<BehaviorQuestion, 'id'> & { id?: string; _tmp: string };
type Counts = { supervisor: number; trainee: number; trainees: number };

const NAVY = '#0f2a4e';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
let tmpSeq = 0; const tmp = () => `t${++tmpSeq}`;
const fromTemplate = (): Draft[] => TEMPLATE.map(q => ({ ...q, options: q.options ? [...q.options] : null, _tmp: tmp() }));

export default function FollowupAdminPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(''); const [orgId, setOrgId] = useState<string | null>(null); const [me, setMe] = useState({ id: '', name: '' });
  const [programs, setPrograms] = useState<Program[]>([]); const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [list, setList] = useState<BehaviorFollowup[]>([]); const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  const [mode, setMode] = useState<'list' | 'edit'>('list');
  const [editing, setEditing] = useState<BehaviorFollowup | null>(null);
  const [form, setForm] = useState({ program_id: '', classroom_id: '', title_ar: '', title_en: '', intro_ar: '', due_days: 60, open_at: '', supervisor_open: true, trainee_open: true, auto_send: true, remind_after_days: 14, scale_max: 5, status: 'open' as 'draft' | 'open' | 'closed' });
  const [qs, setQs] = useState<Draft[]>(fromTemplate());
  const [recText, setRecText] = useState('');
  const [build, setBuild] = useState<'manual' | 'upload' | 'ai'>('manual');
  const [upText, setUpText] = useState('');
  const [ai, setAi] = useState({ objectives: '', axes: 'التطبيق\nالأداء\nنقل الأثر', per_axis: 2 });
  const [aiBusy, setAiBusy] = useState(false); const [aiNote, setAiNote] = useState('');
  const [busy, setBusy] = useState('');
  const [linksFor, setLinksFor] = useState<BehaviorFollowup | null>(null);
  const [sendRes, setSendRes] = useState<string>('');
  const [testEmail, setTestEmail] = useState('');

  const pName = (id: string | null) => programs.find(p => p.id === id)?.name_ar || '—';
  const cCode = (id: string | null) => classrooms.find(c => c.id === id)?.code || '';
  const rec = useMemo(() => parseRecipients(recText), [recText]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/followup'); return; }
      const [p, pg, cl] = await Promise.all([
        db.from('profiles').select('role,organization_id,full_name').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,name_en,status,end_date,objectives_ar,description_ar').order('name_ar'),
        db.from('classrooms').select('id,code,program_id').order('code'),
      ]);
      setRole(String(p.data?.role || '')); setOrgId(p.data?.organization_id || null); setMe({ id: user.id, name: p.data?.full_name || user.email || '' });
      const pgs = ((pg.data || []) as Program[]).filter(x => x.status !== 'CANCELLED'); setPrograms(pgs); setClassrooms((cl.data || []) as Classroom[]);
      await load(); setReady(true);
      if (params.get('new') === '1') startNew(pgs, params.get('program') || '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const { data, error } = await db.from('behavior_followups').select('*').order('created_at', { ascending: false });
    if (error) { setError(error.message); return; }
    const rows = (data || []) as BehaviorFollowup[]; setList(rows);
    if (rows.length) {
      const { data: rs } = await db.from('behavior_responses').select('followup_id,role,trainee_key').in('followup_id', rows.map(r => r.id)).limit(20000);
      const c: Record<string, Counts & { keys: Set<string> }> = {};
      for (const r of (rs || []) as any[]) { c[r.followup_id] ||= { supervisor: 0, trainee: 0, trainees: 0, keys: new Set() }; if (r.role === 'supervisor') c[r.followup_id].supervisor++; if (r.role === 'trainee') c[r.followup_id].trainee++; c[r.followup_id].keys.add(r.trainee_key); }
      const out: Record<string, Counts> = {}; for (const k of Object.keys(c)) out[k] = { supervisor: c[k].supervisor, trainee: c[k].trainee, trainees: c[k].keys.size };
      setCounts(out);
    }
  }

  /* ---------- إنشاء / تعديل ---------- */
  function startNew(pgs = programs, programId = '') {
    const p = pgs.find(x => x.id === programId) || null;
    setEditing(null);
    setForm({ program_id: programId, classroom_id: '', title_ar: p ? `متابعة أثر التدريب — ${p.name_ar}` : '', title_en: p?.name_en ? `Training impact follow-up — ${p.name_en}` : '', intro_ar: '', due_days: 60, open_at: suggestOpenAt(p?.end_date, 60), supervisor_open: true, trainee_open: true, auto_send: true, remind_after_days: 14, scale_max: 5, status: 'open' });
    setQs(fromTemplate()); setRecText(''); setBuild('manual'); setUpText(''); setAiNote(''); setMode('edit'); setError('');
  }
  function pickProgram(pid: string) {
    const p = programs.find(x => x.id === pid);
    setForm(f => ({ ...f, program_id: pid, classroom_id: '', title_ar: f.title_ar && editing ? f.title_ar : (p ? `متابعة أثر التدريب — ${p.name_ar}` : ''), title_en: p?.name_en ? `Training impact follow-up — ${p.name_en}` : f.title_en, open_at: suggestOpenAt(p?.end_date, f.due_days) }));
    if (p?.objectives_ar) setAi(a => ({ ...a, objectives: a.objectives || p.objectives_ar || '' }));
  }
  function setDue(d: number) { const p = programs.find(x => x.id === form.program_id); setForm(f => ({ ...f, due_days: d, open_at: suggestOpenAt(p?.end_date, d) })); }
  async function startEdit(f: BehaviorFollowup) {
    setEditing(f);
    setForm({ program_id: f.program_id || '', classroom_id: f.classroom_id || '', title_ar: f.title_ar, title_en: f.title_en || '', intro_ar: f.intro_ar || '', due_days: f.due_days, open_at: f.open_at || '', supervisor_open: f.supervisor_open, trainee_open: f.trainee_open, auto_send: f.auto_send, remind_after_days: f.remind_after_days, scale_max: f.scale_max, status: f.status });
    const { data } = await db.from('behavior_questions').select('*').eq('followup_id', f.id).order('order_no');
    setQs(((data || []) as BehaviorQuestion[]).map(q => ({ ...q, _tmp: tmp() })));
    setRecText(recipientsText(Array.isArray(f.recipients) ? f.recipients : [])); setBuild('manual'); setMode('edit'); setError('');
  }
  async function save() {
    setError('');
    if (!form.program_id) { setError('اختر البرنامج'); return; }
    if (!form.title_ar.trim()) { setError('اكتب عنوان الحملة'); return; }
    const valid = qs.filter(q => q.text_ar.trim());
    if (!valid.length) { setError('أضف بندًا واحدًا على الأقل'); return; }
    if (!form.supervisor_open && !form.trainee_open) { setError('فعّل دورًا واحدًا على الأقل (مشرف أو متدرب)'); return; }
    setBusy('save');
    try {
      const payload: any = { organization_id: orgId, program_id: form.program_id, classroom_id: form.classroom_id || null, title_ar: form.title_ar.trim(), title_en: form.title_en.trim() || null, intro_ar: form.intro_ar.trim() || null, due_days: form.due_days, open_at: form.open_at || null, supervisor_open: form.supervisor_open, trainee_open: form.trainee_open, auto_send: form.auto_send, remind_after_days: Math.max(0, Number(form.remind_after_days) || 0), scale_max: form.scale_max, status: form.status, recipients: rec.recipients };
      let id = editing?.id;
      if (editing) { const { error } = await db.from('behavior_followups').update(payload).eq('id', editing.id); if (error) throw new Error(error.message); }
      else { const { data, error } = await db.from('behavior_followups').insert({ ...payload, token: makeToken(), created_by: me.id, created_by_name: me.name }).select('*').single(); if (error) throw new Error(error.message); id = (data as any).id; }
      if (editing) { const { error } = await db.from('behavior_questions').delete().eq('followup_id', editing.id); if (error) throw new Error(error.message); }
      const rows = valid.map((q, i) => ({ followup_id: id, order_no: i + 1, kind: q.kind, audience: q.audience, domain_ar: q.domain_ar?.trim() || null, text_ar: q.text_ar.trim(), text_en: q.text_en?.trim() || null, options: q.kind === 'multi' ? (q.options || []).filter(Boolean) : null, required: q.required !== false }));
      const { error: qe } = await db.from('behavior_questions').insert(rows); if (qe) throw new Error(qe.message);
      flash(editing ? 'تم حفظ التعديلات' : 'تم إنشاء حملة المتابعة'); await load(); setMode('list'); setEditing(null);
    } catch (e: any) { setError('تعذر الحفظ: ' + e.message); } finally { setBusy(''); }
  }
  async function setStatus(f: BehaviorFollowup, status: 'open' | 'closed') {
    const { error } = await db.from('behavior_followups').update({ status }).eq('id', f.id); if (error) { setError(error.message); return; }
    flash(status === 'open' ? 'فُتحت الحملة' : 'أُغلقت الحملة'); load();
  }
  async function remove(f: BehaviorFollowup) {
    const c = counts[f.id]; if (!confirm(`حذف «${f.title_ar}» نهائيًا${c ? ` مع ${c.supervisor + c.trainee} استجابة` : ''}؟`)) return;
    const { error } = await db.from('behavior_followups').delete().eq('id', f.id); if (error) { setError(error.message); return; } flash('تم الحذف'); load();
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); flash('تم نسخ الرابط'); } catch { prompt('انسخ الرابط:', text); } }

  /* ---------- الإرسال ---------- */
  async function send(f: BehaviorFollowup, sendMode: 'send' | 'remind' | 'test') {
    const n = Array.isArray(f.recipients) ? f.recipients.length : 0;
    if (sendMode !== 'test' && !n) { setError('لا توجد قائمة مستلمين في هذه الحملة — عدّلها وأضف الأسماء والبريد'); return; }
    if (sendMode === 'test' && !testEmail.trim()) { setError('اكتب بريدًا للتجربة'); return; }
    if (sendMode === 'send' && f.sent_at && !confirm(`أُرسلت هذه الحملة مسبقًا (${String(f.sent_at).slice(0, 10)}). إعادة الإرسال للجميع؟`)) return;
    if (sendMode !== 'test' && !confirm(`${sendMode === 'remind' ? 'إرسال تذكير لمن لم يُجب' : 'إرسال روابط المتابعة'} إلى ${n} مستلمًا؟`)) return;
    setBusy('send-' + f.id); setSendRes('');
    try {
      const session = (await db.auth.getSession()).data.session; if (!session) throw new Error('انتهت الجلسة');
      const r = await fetch('/api/followups/send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ followup_id: f.id, mode: sendMode, test_email: testEmail.trim() || undefined }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.success) throw new Error(j.error || `HTTP ${r.status}`);
      const msg = `${sendMode === 'test' ? 'تجربة' : sendMode === 'remind' ? 'تذكير' : 'إرسال'}: أُرسل ${j.sent} · تخطّي ${j.skipped} · فشل ${j.failed}${j.errors?.length ? ' — ' + j.errors.join(' | ') : ''}`;
      setSendRes(msg); flash(msg); load();
    } catch (e: any) { setError('تعذر الإرسال: ' + e.message); } finally { setBusy(''); }
  }

  /* ---------- البنود ---------- */
  const upd = (i: number, patch: Partial<Draft>) => setQs(l => l.map((q, k) => (k === i ? { ...q, ...patch } : q)));
  const move = (i: number, d: number) => setQs(l => { const n = [...l]; const j = i + d; if (j < 0 || j >= n.length) return l; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addQ = (kind: BehaviorKind = 'scale') => setQs(l => [...l, { order_no: l.length + 1, kind, audience: 'all', domain_ar: kind === 'multi' ? 'المعوقات' : kind === 'percent' ? 'التطبيق' : '', text_ar: '', text_en: '', options: kind === 'multi' ? [...DEFAULT_BARRIERS] : null, required: kind !== 'text', _tmp: tmp() }]);
  function importUpload(append: boolean) {
    const r = parseInstrumentText(upText);
    const items: Draft[] = r.questions.filter(q => q.kind === 'scale').map(q => ({ order_no: 0, kind: 'scale' as BehaviorKind, audience: 'all' as Audience, domain_ar: q.domain_ar || '', text_ar: q.text_ar, text_en: q.text_en || '', options: null, required: true, _tmp: tmp() }));
    if (!items.length) { setError('لم يُعثر على بنود مقياس في النص — كل بند في سطر، ويمكن تحديد المحور بسطر «المحور: …»'); return; }
    const tail = fromTemplate().filter(q => q.kind !== 'scale');
    setQs(append ? l => [...l, ...items] : [...items, ...tail]); setBuild('manual'); flash(`أُضيف ${items.length} بندًا من النص${append ? '' : ' + بنود التطبيق والمعوقات والمثال من القالب'}`);
  }
  async function runAi(append: boolean) {
    setAiBusy(true); setError(''); setAiNote('');
    try {
      const session = (await db.auth.getSession()).data.session; if (!session) throw new Error('انتهت الجلسة — سجّل الدخول مجددًا');
      const p = programs.find(x => x.id === form.program_id);
      const axes = ai.axes.split(/\r?\n/).map(x => x.trim()).filter(Boolean).slice(0, 6);
      if (!axes.length) throw new Error('حدد محورًا واحدًا على الأقل');
      const spec = normalizeSpec({ program_name: p?.name_ar || form.title_ar, program_desc: p?.description_ar || '', objectives: ai.objectives, axes, count_mode: 'per_axis', scale_count: Math.min(6, Math.max(1, ai.per_axis)), mcq_count: 0, tf_count: 0, audience: 'المشرف المباشر والمتدرب بعد 60–90 يومًا من التدريب', level: 'intermediate', bilingual: true, notes: 'بنود ملاحظة سلوك وظيفي قابل للملاحظة في بيئة العمل بصيغة الغائب (يطبّق/يستخدم/يشارك…)، تقيس نقل أثر التدريب لا المعرفة النظرية.' });
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
      let j: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        setAiNote(`جارٍ التوليد${attempt > 1 ? ` (محاولة ${attempt})` : ''}…`);
        const r = await fetch('/api/impact/generate', { method: 'POST', headers, body: JSON.stringify(spec) });
        j = await r.json().catch(() => ({}));
        if (r.ok && j?.success) break;
        if (r.status === 401 || r.status === 403) throw new Error(j?.error || 'غير مصرح');
        if (attempt === 3) throw new Error(j?.error || `HTTP ${r.status}`);
        const wait = Math.min(60, Number(j?.retry_after) || (r.status === 429 ? 20 : 6));
        for (let t = wait; t > 0; t--) { setAiNote(`المزوّد مشغول — إعادة المحاولة بعد ${t} ث`); await new Promise(r => setTimeout(r, 1000)); }
      }
      const items: Draft[] = (j.questions || []).filter((q: any) => q.kind === 'scale').map((q: any) => ({ order_no: 0, kind: 'scale' as BehaviorKind, audience: 'all' as Audience, domain_ar: q.domain_ar || '', text_ar: q.text_ar, text_en: q.text_en || '', options: null, required: true, _tmp: tmp() }));
      if (!items.length) throw new Error('لم يُنتج المولّد بنودًا');
      const tail = fromTemplate().filter(q => q.kind !== 'scale');
      setQs(append ? l => [...l, ...items] : [...items, ...tail]); setBuild('manual');
      setAiNote(`تم توليد ${items.length} بندًا بـ ${j.mode === 'offline' ? 'المولّد المحلي' : j.model || 'الذكاء الاصطناعي'}`); flash(`أُضيف ${items.length} بندًا`);
    } catch (e: any) { setError(e?.message || 'تعذر التوليد'); }
    setAiBusy(false);
  }

  /* ---------- استيراد المستلمين ---------- */
  async function importTrainees(src: 'attendance' | 'evaluations') {
    if (!form.program_id) { setError('اختر البرنامج أولًا'); return; }
    setBusy('import');
    try {
      const lines: string[] = []; const seen = new Set<string>();
      if (src === 'attendance') {
        let q = db.from('attendance_sessions').select('id').eq('program_id', form.program_id); if (form.classroom_id) q = q.eq('classroom_id', form.classroom_id);
        const { data: ss } = await q.limit(1000); const ids = (ss || []).map((x: any) => x.id);
        if (ids.length) { const { data } = await db.from('attendance_records').select('full_name,email').in('session_id', ids).limit(20000); for (const r of (data || []) as any[]) { if (!r.email || seen.has(r.email)) continue; seen.add(r.email); lines.push(`${r.full_name}, ${r.email}, متدرب`); } }
      } else {
        let q = db.from('evaluations').select('guest_name,guest_email').eq('program_id', form.program_id).not('guest_email', 'is', null); if (form.classroom_id) q = q.eq('classroom_id', form.classroom_id);
        const { data } = await q.limit(5000); for (const r of (data || []) as any[]) { const em = String(r.guest_email || '').toLowerCase().trim(); if (!em || seen.has(em)) continue; seen.add(em); lines.push(`${r.guest_name || em}, ${em}, متدرب`); }
      }
      if (!lines.length) { setError(src === 'attendance' ? 'لا توجد سجلات حضور ببريد إلكتروني لهذا البرنامج' : 'لا توجد تقييمات ببريد إلكتروني لهذا البرنامج'); return; }
      setRecText(prev => [prev.trim(), ...lines].filter(Boolean).join('\n')); flash(`استُورد ${lines.length} متدربًا`);
    } catch (e: any) { setError('تعذر الاستيراد: ' + e.message); } finally { setBusy(''); }
  }

  const allowed = ALLOWED.includes(role.toUpperCase()); const canWrite = WRITERS.includes(role.toUpperCase());
  const progClassrooms = classrooms.filter(c => !form.program_id || c.program_id === form.program_id);
  const today = new Date().toISOString().slice(0, 10);
  if (!ready) return <div className="bf" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="bf" dir="rtl">
      <style>{CSS}</style>
      <header className="bf-head">
        <div>
          <div className="bf-kicker"><Icon name="trend" size={14} /> مركز الإدارة · كيركباتريك — المستوى 3</div>
          <h1>متابعة أثر التدريب في بيئة العمل</h1>
          <p>بعد 60–90 يومًا من ختام البرنامج يصل للمشرف المباشر وللمتدرب استبيان قصير: هل تغيّر السلوك والأداء فعلًا؟ تُرسل الروابط تلقائيًا في الموعد، وتُقرأ النتائج في «تقرير نقل الأثر» بجانب القياس القبلي/البعدي.</p>
        </div>
        <nav className="bf-nav">
          <Link href="/dashboard" className="bf-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/reports/transfer" className="bf-btn"><Icon name="chart" size={16} /> تقرير نقل الأثر</Link>
          <Link href="/admin/impact" className="bf-btn"><Icon name="target" size={16} /> القبلي/البعدي</Link>
          {mode === 'edit' && <button className="bf-btn" onClick={() => { setMode('list'); setEditing(null); }}><Icon name="arrow" size={16} /> كل الحملات</button>}
          {canWrite && mode === 'list' && <button className="bf-btn primary" onClick={() => startNew()}><Icon name="plus" size={16} /> حملة متابعة جديدة</button>}
        </nav>
      </header>
      {!allowed && <div className="bf-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة ومديري البرامج ومحللي الجودة.</div>}
      {error && <div className="bf-alert err"><Icon name="alert" size={18} /> <span style={{ flex: 1 }}>{error}</span><button className="bf-x" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}

      {mode === 'list' && (
        <section className="bf-card">
          <h2><Icon name="folder" size={18} /> حملات المتابعة <span className="bf-pill">{list.length}</span></h2>
          {!list.length && <div className="bf-empty"><Icon name="trend" size={34} /><b>لا توجد حملات بعد</b><span>ابدأ بـ «حملة متابعة جديدة» — قالب جاهز من 10 بنود، وتحديد موعد الإرسال التلقائي بعد 60 أو 90 يومًا من نهاية البرنامج.</span></div>}
          <div className="bf-list">
            {list.map(f => {
              const c = counts[f.id] || { supervisor: 0, trainee: 0, trainees: 0 }; const n = Array.isArray(f.recipients) ? f.recipients.length : 0;
              const due = f.open_at && !f.sent_at ? (f.open_at <= today ? 'موعد الإرسال حان' : `يُرسل تلقائيًا ${f.open_at}`) : f.sent_at ? `أُرسلت ${String(f.sent_at).slice(0, 10)}${f.reminded_at ? ' · ذُكّر' : ''}` : 'بدون موعد';
              return (
                <article key={f.id} className={`bf-item ${f.status}`}>
                  <div>
                    <div className="bf-item-title"><b>{f.title_ar}</b><span className={`bf-status ${f.status}`}>{f.status === 'open' ? 'مفتوحة' : f.status === 'closed' ? 'مغلقة' : 'مسودة'}</span></div>
                    <div className="bf-muted">{pName(f.program_id)}{f.classroom_id ? ` · ${cCode(f.classroom_id)}` : ''} · بعد {f.due_days} يومًا · {due} · المستلمون {n} · الرمز <bdi className="bf-token">{f.token}</bdi></div>
                    <div className="bf-counts"><span>مشرفون <b>{c.supervisor}</b></span><span>متدربون <b>{c.trainee}</b></span><span className={c.trainees ? 'ok' : ''}>متدربون مقيَّمون <b>{c.trainees}</b></span>{f.auto_send ? <span className="ok">إرسال تلقائي</span> : <span>إرسال يدوي</span>}</div>
                  </div>
                  <div className="bf-actions">
                    <button className="bf-btn small" onClick={() => setLinksFor(f)}><Icon name="link" size={14} /> الروابط / QR</button>
                    <Link href={`/reports/transfer?followup=${f.id}`} className="bf-btn small"><Icon name="chart" size={14} /> النتائج</Link>
                    {canWrite && <button className="bf-btn small primary" disabled={!!busy || f.status !== 'open'} onClick={() => send(f, 'send')}><Icon name="send" size={14} /> {busy === 'send-' + f.id ? 'جارٍ…' : 'إرسال الآن'}</button>}
                    {canWrite && f.sent_at && <button className="bf-btn small" disabled={!!busy} onClick={() => send(f, 'remind')}><Icon name="mail" size={14} /> تذكير</button>}
                    {canWrite && <button className="bf-btn small" onClick={() => startEdit(f)}><Icon name="edit" size={14} /> تعديل</button>}
                    {canWrite && (f.status === 'open' ? <button className="bf-btn small" onClick={() => setStatus(f, 'closed')}><Icon name="pause" size={14} /> إغلاق</button> : <button className="bf-btn small" onClick={() => setStatus(f, 'open')}><Icon name="play" size={14} /> فتح</button>)}
                    {canWrite && <button className="bf-btn small danger" onClick={() => remove(f)}><Icon name="trash" size={14} /></button>}
                  </div>
                </article>
              );
            })}
          </div>
          {sendRes && <div className="bf-note ok">{sendRes}</div>}
          {canWrite && <div className="bf-row"><span className="bf-muted">تجربة شكل الرسالة:</span><input placeholder="بريدك" dir="ltr" value={testEmail} onChange={e => setTestEmail(e.target.value)} style={{ width: 240 }} /><button className="bf-btn small" disabled={!list.length || !!busy} onClick={() => list[0] && send(list[0], 'test')}><Icon name="mail" size={14} /> أرسل رسالة تجريبية</button></div>}
        </section>
      )}

      {mode === 'edit' && (
        <>
          <section className="bf-card">
            <h2><Icon name="settings" size={18} /> 1) إعدادات الحملة</h2>
            <div className="bf-grid">
              <label><span>البرنامج <i>*</i></span><select value={form.program_id} onChange={e => pickProgram(e.target.value)}><option value="">— اختر —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label><span>القاعة / المجموعة</span><select value={form.classroom_id} onChange={e => setForm({ ...form, classroom_id: e.target.value })}><option value="">— الكل —</option>{progClassrooms.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label>
              <label><span>الحالة</span><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })}><option value="open">مفتوحة</option><option value="draft">مسودة</option><option value="closed">مغلقة</option></select></label>
              <label className="bf-span2"><span>عنوان الحملة <i>*</i></span><input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} /></label>
              <label><span>Title (EN)</span><input dir="ltr" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></label>
              <label className="bf-span3"><span>مقدمة للمُجيب (اختياري)</span><input value={form.intro_ar} onChange={e => setForm({ ...form, intro_ar: e.target.value })} placeholder="مرّ وقت كافٍ منذ ختام البرنامج. نرجو تقييم ما تم تطبيقه فعليًا…" /></label>
              <label><span>التوقيت بعد نهاية البرنامج</span><div className="bf-seg">{[30, 60, 90].map(d => <button type="button" key={d} className={form.due_days === d ? 'on' : ''} onClick={() => setDue(d)}>{d} يومًا</button>)}</div></label>
              <label><span>موعد الإرسال التلقائي</span><input type="date" value={form.open_at} onChange={e => setForm({ ...form, open_at: e.target.value })} /></label>
              <label><span>تذكير بعد (أيام) — 0 = بدون</span><input type="number" min={0} max={60} value={form.remind_after_days} onChange={e => setForm({ ...form, remind_after_days: Number(e.target.value) })} /></label>
              <label className="bf-check"><input type="checkbox" checked={form.supervisor_open} onChange={e => setForm({ ...form, supervisor_open: e.target.checked })} /> استبيان المشرف المباشر</label>
              <label className="bf-check"><input type="checkbox" checked={form.trainee_open} onChange={e => setForm({ ...form, trainee_open: e.target.checked })} /> التقييم الذاتي للمتدرب</label>
              <label className="bf-check"><input type="checkbox" checked={form.auto_send} onChange={e => setForm({ ...form, auto_send: e.target.checked })} /> إرسال تلقائي في الموعد (يتطلب قائمة مستلمين)</label>
            </div>
            <p className="bf-muted" style={{ marginTop: 8 }}>نهاية البرنامج المسجّلة: <b>{programs.find(p => p.id === form.program_id)?.end_date || 'غير محددة'}</b>. يعمل الإرسال التلقائي يوميًا الساعة 6 صباحًا (الرياض) عبر Vercel Cron.</p>
          </section>

          <section className="bf-card">
            <h2><Icon name="users" size={18} /> 2) المستلمون <span className="bf-pill">{rec.recipients.length}</span></h2>
            <div className="bf-row" style={{ marginTop: 0 }}>
              <button className="bf-btn small" disabled={!form.program_id || !!busy} onClick={() => importTrainees('attendance')}><Icon name="check" size={14} /> متدربون من سجل الحضور</button>
              <button className="bf-btn small" disabled={!form.program_id || !!busy} onClick={() => importTrainees('evaluations')}><Icon name="evaluations" size={14} /> متدربون من التقييمات</button>
              <span className="bf-muted">سطر لكل مستلم: <b>الاسم, البريد, الدور</b> (مشرف/متدرب) — وللمشرف يمكن إضافة <b>, اسم المتدرب, بريد المتدرب</b></span>
            </div>
            <textarea rows={6} value={recText} onChange={e => setRecText(e.target.value)} placeholder={'سارة القحطاني, sara@example.com, متدرب\nم. خالد العتيبي, khalid@example.com, مشرف, سارة القحطاني, sara@example.com'} />
            {rec.warnings.length > 0 && <div className="bf-note bad">{rec.warnings.slice(0, 5).join(' · ')}{rec.warnings.length > 5 ? ` … (+${rec.warnings.length - 5})` : ''}</div>}
            <div className="bf-counts"><span>مشرفون <b>{rec.recipients.filter(r => r.role === 'supervisor').length}</b></span><span>متدربون <b>{rec.recipients.filter(r => r.role === 'trainee').length}</b></span><span>زملاء <b>{rec.recipients.filter(r => r.role === 'peer').length}</b></span></div>
          </section>

          <section className="bf-card">
            <h2><Icon name="edit" size={18} /> 3) بنود الاستبيان <span className="bf-pill">{qs.length}</span></h2>
            <div className="bf-modes">
              <button type="button" className={`bf-mode ${build === 'manual' ? 'on' : ''}`} onClick={() => setBuild('manual')}><b>القالب / يدوي</b><small>10 بنود جاهزة قابلة للتعديل: مقياس، نسبة تطبيق، معوقات، مثال</small></button>
              <button type="button" className={`bf-mode ${build === 'upload' ? 'on' : ''}`} onClick={() => setBuild('upload')}><b>لصق أداة جاهزة</b><small>كل بند في سطر؛ «المحور: …» لتجميع البنود</small></button>
              <button type="button" className={`bf-mode ${build === 'ai' ? 'on' : ''}`} onClick={() => setBuild('ai')}><b>ذكاء اصطناعي</b><small>بنود سلوك وظيفي من أهداف البرنامج ومحاوره</small></button>
            </div>
            {build === 'upload' && (
              <div className="bf-panel">
                <textarea rows={7} value={upText} onChange={e => setUpText(e.target.value)} placeholder={'المحور: التطبيق\n1. يطبّق أساليب التقويم البديل في الفصل\n2. يستخدم أدوات رقمية لرصد تقدم الطلاب\nالمحور: نقل الأثر\n3. يدرّب زملاءه على ما تعلّمه'} />
                <div className="bf-row"><button className="bf-btn primary" onClick={() => importUpload(false)} disabled={!upText.trim()}><Icon name="check" size={15} /> استبدال بنود المقياس</button><button className="bf-btn" onClick={() => importUpload(true)} disabled={!upText.trim()}><Icon name="plus" size={15} /> إضافة إلى البنود الحالية</button></div>
              </div>
            )}
            {build === 'ai' && (
              <div className="bf-panel">
                <div className="bf-grid">
                  <label className="bf-span2"><span>أهداف البرنامج / السلوكيات المستهدفة</span><textarea rows={4} value={ai.objectives} onChange={e => setAi({ ...ai, objectives: e.target.value })} placeholder="مثال: توظيف استراتيجيات التعلم النشط، تصميم أدوات تقويم بديلة، إدارة الصف الرقمي…" /></label>
                  <label><span>المحاور (سطر لكل محور)</span><textarea rows={4} value={ai.axes} onChange={e => setAi({ ...ai, axes: e.target.value })} /></label>
                  <label><span>بنود لكل محور</span><input type="number" min={1} max={6} value={ai.per_axis} onChange={e => setAi({ ...ai, per_axis: Number(e.target.value) })} /></label>
                </div>
                <div className="bf-row"><button className="bf-btn primary" onClick={() => runAi(false)} disabled={aiBusy}><Icon name="play" size={15} /> {aiBusy ? 'جارٍ التوليد…' : 'توليد (استبدال بنود المقياس)'}</button><button className="bf-btn" onClick={() => runAi(true)} disabled={aiBusy}><Icon name="plus" size={15} /> توليد وإضافة</button>{aiNote && <span className="bf-muted">{aiNote}</span>}</div>
                <p className="bf-muted">يستخدم نفس إعداد الذكاء الاصطناعي لأدوات القياس القبلي/البعدي (AI_API_KEY). بدون مفتاح يعمل المولّد المحلي.</p>
              </div>
            )}
            <div className="bf-qs">
              {qs.map((q, i) => (
                <div key={q._tmp} className="bf-q">
                  <div className="bf-q-top">
                    <span className="bf-qn">{i + 1}</span>
                    <select value={q.kind} onChange={e => upd(i, { kind: e.target.value as BehaviorKind, options: e.target.value === 'multi' ? (q.options?.length ? q.options : [...DEFAULT_BARRIERS]) : null, required: e.target.value !== 'text' })}>{(Object.keys(KIND_LABEL) as BehaviorKind[]).map(k => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select>
                    <select value={q.audience} onChange={e => upd(i, { audience: e.target.value as Audience })}>{(Object.keys(AUDIENCE_LABEL) as Audience[]).map(k => <option key={k} value={k}>{AUDIENCE_LABEL[k]}</option>)}</select>
                    <input className="bf-dom" placeholder="المحور" value={q.domain_ar || ''} onChange={e => upd(i, { domain_ar: e.target.value })} />
                    <label className="bf-req"><input type="checkbox" checked={q.required !== false} onChange={e => upd(i, { required: e.target.checked })} /> مطلوب</label>
                    <div className="bf-q-tools"><button className="bf-ic" onClick={() => move(i, -1)} title="أعلى">↑</button><button className="bf-ic" onClick={() => move(i, 1)} title="أسفل">↓</button><button className="bf-ic danger" onClick={() => setQs(l => l.filter((_, k) => k !== i))} title="حذف"><Icon name="trash" size={14} /></button></div>
                  </div>
                  <input className="bf-qtext" placeholder="نص البند بالعربية" value={q.text_ar} onChange={e => upd(i, { text_ar: e.target.value })} />
                  <input className="bf-qtext en" dir="ltr" placeholder="English text (optional)" value={q.text_en || ''} onChange={e => upd(i, { text_en: e.target.value })} />
                  {q.kind === 'multi' && <textarea rows={3} className="bf-opts" placeholder="خيار في كل سطر" value={(q.options || []).join('\n')} onChange={e => upd(i, { options: e.target.value.split(/\r?\n/) })} />}
                </div>
              ))}
            </div>
            <div className="bf-row">
              <button className="bf-btn" onClick={() => addQ('scale')}><Icon name="plus" size={15} /> بند مقياس</button>
              <button className="bf-btn" onClick={() => addQ('percent')}><Icon name="plus" size={15} /> نسبة تطبيق</button>
              <button className="bf-btn" onClick={() => addQ('multi')}><Icon name="plus" size={15} /> معوقات</button>
              <button className="bf-btn" onClick={() => addQ('text')}><Icon name="plus" size={15} /> سؤال مفتوح</button>
              <button className="bf-btn" onClick={() => setQs(fromTemplate())}><Icon name="refresh" size={15} /> استعادة القالب</button>
            </div>
          </section>

          <div className="bf-save">
            <button className="bf-btn primary" onClick={save} disabled={!!busy}><Icon name="save" size={16} /> {busy === 'save' ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'إنشاء الحملة'}</button>
            <button className="bf-btn" onClick={() => { setMode('list'); setEditing(null); }}>إلغاء</button>
            <span className="bf-muted">بعد الإنشاء: «الروابط / QR» للمشاركة اليدوية، أو «إرسال الآن»، أو اترك الإرسال التلقائي في الموعد.</span>
          </div>
        </>
      )}

      {linksFor && (
        <div className="bf-modal" onClick={() => setLinksFor(null)}>
          <div className="bf-modal-box" onClick={e => e.stopPropagation()}>
            <h3>{linksFor.title_ar}</h3>
            <p className="bf-muted">{pName(linksFor.program_id)} · الرمز <bdi className="bf-token">{linksFor.token}</bdi></p>
            <div className="bf-links">
              {(['supervisor', 'trainee'] as const).filter(r => (r === 'supervisor' ? linksFor.supervisor_open : linksFor.trainee_open)).map(r => (
                <div key={r} className="bf-linkcard">
                  <b>{ROLE_LABEL[r].ar}</b>
                  <div className="bf-qr" dangerouslySetInnerHTML={{ __html: qrSvg(followupUrl(linksFor.token, r), 150, 'M', NAVY) }} />
                  <span className="bf-url" dir="ltr">{followupUrl(linksFor.token, r)}</span>
                  <button className="bf-btn small" onClick={() => copy(followupUrl(linksFor.token, r))}><Icon name="copy" size={14} /> نسخ</button>
                </div>
              ))}
            </div>
            <p className="bf-muted">رابط المشرف يسمح له بإدخال اسم المتدرب؛ ويمكن تخصيصه لمتدرب بعينه بإضافة <code dir="ltr" style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: 6 }}>?role=supervisor&amp;tn=NAME&amp;te=EMAIL</code> — وهو ما يفعله الإرسال بالبريد تلقائيًا.</p>
            <div className="bf-row" style={{ justifyContent: 'center' }}><button className="bf-btn primary" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة</button><button className="bf-btn" onClick={() => setLinksFor(null)}><Icon name="x" size={16} /> إغلاق</button></div>
          </div>
        </div>
      )}
      {toast && <div className="bf-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.bf{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.bf *{box-sizing:border-box}
.bf-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.bf-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.bf-head p{margin:0;color:#64748b;font-size:13px;max-width:780px;line-height:1.7}
.bf-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.bf-nav{display:flex;gap:8px;flex-wrap:wrap}
.bf-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.bf-btn:disabled{opacity:.5;cursor:not-allowed}.bf-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}.bf-btn.small{padding:6px 10px;font-size:12px}.bf-btn.danger{color:#b91c1c;border-color:#fecaca}
.bf-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}.bf-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.bf-x{border:0;background:transparent;cursor:pointer;color:inherit}
.bf-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.bf-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.bf-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}
.bf-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7}
.bf-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:14px}.bf-empty b{color:${NAVY};font-size:15px}
.bf-list{display:flex;flex-direction:column;gap:12px}
.bf-item{border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;border-inline-start:5px solid #0b8a83}.bf-item.closed{border-inline-start-color:#94a3b8;opacity:.9}.bf-item.draft{border-inline-start-color:#f59e0b}
.bf-item-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bf-item-title b{font-size:15px;color:${NAVY}}
.bf-status{font-size:11px;font-weight:900;border-radius:999px;padding:2px 9px;background:#ecfdf5;color:#047857}.bf-status.closed{background:#f1f5f9;color:#475569}.bf-status.draft{background:#fff7ed;color:#b45309}
.bf-token{font-family:ui-monospace,Menlo,monospace;font-weight:900;color:${NAVY}}
.bf-counts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.bf-counts span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#475569}.bf-counts span b{color:${NAVY}}.bf-counts span.ok{background:#ecfdf5;border-color:#a7f3d0}.bf-counts span.ok b{color:#047857}
.bf-actions{display:flex;flex-wrap:wrap;gap:6px;max-width:360px;justify-content:flex-end}
.bf-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.bf-span2{grid-column:span 2}.bf-span3{grid-column:1/-1}
.bf label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.bf label i{color:#b91c1c;font-style:normal}
.bf select,.bf input,.bf textarea{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff;min-width:0;width:100%}
.bf-check{flex-direction:row!important;align-items:center;gap:8px!important;font-size:13px!important;color:#334155!important}.bf-check input{width:18px;height:18px}
.bf-seg{display:inline-flex;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:3px;gap:2px}.bf-seg button{border:0;background:transparent;font:inherit;font-size:12px;font-weight:800;color:#475569;padding:7px 12px;border-radius:8px;cursor:pointer}.bf-seg button.on{background:${NAVY};color:#fff}
.bf-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
.bf-note{margin-top:8px;padding:8px 12px;border-radius:10px;font-size:12.5px;font-weight:700;line-height:1.8;background:#f1f5f9;border:1px solid #e2e8f0;color:#334155}.bf-note.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.bf-note.bad{background:#fef2f2;border-color:#fecaca;color:#991b1b}
.bf-modes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px}
.bf-mode{border:2px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;align-items:flex-start;font:inherit;cursor:pointer;text-align:start;color:${NAVY}}.bf-mode b{font-size:14px}.bf-mode small{color:#64748b;font-weight:700;line-height:1.6}.bf-mode.on{border-color:#0b8a83;background:#f0fdf9}
.bf-panel{border:1px dashed #cbd5e1;border-radius:14px;padding:14px;background:#fbfdff;margin-bottom:12px}
.bf-qs{display:flex;flex-direction:column;gap:10px}
.bf-q{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fbfdff;display:flex;flex-direction:column;gap:8px}
.bf-q-top{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.bf-q-top select{width:auto;padding:7px 8px;font-size:12px}.bf-dom{max-width:160px;padding:7px 10px!important;font-size:12px!important}
.bf-req{flex-direction:row!important;align-items:center;gap:4px!important;font-size:11.5px!important}.bf-req input{width:16px;height:16px}
.bf-qn{min-width:26px;height:26px;border-radius:8px;background:${NAVY};color:#fff;display:grid;place-items:center;font-size:12px;font-weight:900}
.bf-q-tools{margin-inline-start:auto;display:flex;gap:4px}
.bf-ic{width:30px;height:30px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:${NAVY};font:inherit;font-weight:900}.bf-ic.danger{color:#b91c1c}
.bf-qtext{font-size:14px!important}.bf-qtext.en{font-size:12px!important;color:#475569!important}.bf-opts{font-size:12.5px!important}
.bf-save{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.bf-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:grid;place-items:center;z-index:100;padding:20px}
.bf-modal-box{background:#fff;border-radius:18px;padding:22px;max-width:640px;width:100%;text-align:center}.bf-modal-box h3{margin:0 0 4px;color:${NAVY}}
.bf-links{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0}
.bf-linkcard{border:1px solid #e2e8f0;border-radius:14px;padding:12px;display:flex;flex-direction:column;align-items:center;gap:8px}.bf-linkcard b{color:${NAVY}}
.bf-qr svg{display:block}.bf-url{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#334155;word-break:break-all}
.bf-toast{position:fixed;bottom:18px;inset-inline-start:18px;background:${NAVY};color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:120}
@media print{.bf>*:not(.bf-modal){display:none!important}.bf{padding:0;background:#fff}.bf-modal{position:static;background:#fff;padding:0;display:block}.bf-modal-box{max-width:none}.global-nav{display:none!important}}
@media(max-width:980px){.bf{padding:12px}.bf-grid,.bf-modes,.bf-links{grid-template-columns:1fr}.bf-span2,.bf-span3{grid-column:auto}.bf-item{grid-template-columns:1fr}.bf-actions{justify-content:flex-start;max-width:none}}
`;
