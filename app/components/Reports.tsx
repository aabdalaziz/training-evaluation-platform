'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 «محور التقارير» — واجهات ر1: تقرير التعلّم الأسبوعي
 *  <ReportsHome>      /me/reports            تقاريري + «ابدأ تقرير هذا الأسبوع» (برنامج · شعبة · الفترة)
 *  <ReportEditor>     /me/reports/[id]       المحرّر بأقسامه الثمانية + «صِغ لي من الأرقام» + معاينة الطباعة + الإرسال/الاعتماد
 *  <ReportPrint>      داخل المحرّر           صفحة A4 تطابق نموذج «تقرير التعلّم الشامل» (CSS print، بلا مكتبات)
 *  <AdminReports>     /admin/reports         الطاقم: الاعتماد · الإعادة · القائمة
 *  <MyReportLines>    /me                    «سطر لك من تقرير الأسبوع»
 *  <ReportVerify>     /verify/report/[code]  التحقّق العام (بلا أسماء طلاب)
 *  ر2: التقرير الختامي («خاتمة الرحلة») في FinalReport.tsx — بطاقاته هنا في تقاريري، ومحرّره يُستدعى من ReportEditor حين kind = final.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Icon } from '../../lib/ui/icons';
import { P46_NAMES_AR, GRADE_KEY_AR, WEEK_DAYS_AR, FIT_AR, ACHIEVED_AR, APPLIED_AR, RESPONSE_AR, SUMMATIVE_TOOLS_AR, MAX_ACTIVITIES, MAX_TOOLS, LINE_MAX, fmtDayAr, summativeStats, skillAverages, weakestSkill, listLineAr, type Body, type StudentRow, type Computed, type Phrase } from '../../lib/reports/registry';

type Tok = () => Promise<string>;
const FinalCards = dynamic(() => import('./FinalReport').then(m => m.FinalCards), { ssr: false });
const FinalEditor = dynamic(() => import('./FinalReport').then(m => m.FinalEditor), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
/* ر3 — تقرير إنجاز المهمة («أثرُ المهمة») */
const MissionCards = dynamic(() => import('./MissionReport').then(m => m.MissionCards), { ssr: false });
const MissionEditor = dynamic(() => import('./MissionReport').then(m => m.MissionEditor), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
const MissionClient = dynamic(() => import('./MissionReport').then(m => m.MissionClient), { ssr: false, loading: () => <main className="pt-main"><section className="pt-box"><p className="pt-muted">…</p></section></main> });
async function api(tok: Tok | null, path: string, body?: any) { const tk = tok ? await tok() : ''; const h: any = { 'Content-Type': 'application/json' }; if (tk) h.Authorization = `Bearer ${tk}`; const r = await fetch(path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h, cache: 'no-store' }); return r.json().catch(() => ({ success: false, error: 'استجابة غير صالحة' })); }
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const STATUS_TONE: Record<string, string> = { draft: 'g', submitted: 'b', approved: 't', returned: 'o' };

/* ───────── 1) تقاريري ───────── */
export function ReportsHome({ token }: { token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [f, setF] = useState({ program_id: '', classroom_id: '', from: '', to: '' });
  const load = useCallback(async () => { const j = await api(token, '/api/reports'); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setF(x => ({ ...x, from: x.from || j.week.from, to: x.to || j.week.to })); }, [token]);
  useEffect(() => { load(); }, [load]);
  const rooms: any[] = useMemo(() => (d?.scope?.classrooms || []).filter((c: any) => !f.program_id || c.program_id === f.program_id), [d, f.program_id]);
  useEffect(() => { if (d && !f.program_id) { const first = d.scope?.classrooms?.[0]; if (first) setF(x => ({ ...x, program_id: first.program_id, classroom_id: first.id })); else if (d.scope?.programs?.[0]) setF(x => ({ ...x, program_id: d.scope.programs[0].id })); } }, [d, f.program_id]);
  async function create(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); const j = await api(token, '/api/reports', { action: 'create', program_id: f.program_id, classroom_id: f.classroom_id || null, period_from: f.from, period_to: f.to }); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } window.location.href = `/me/reports/${j.report.id}`; }
  if (!d) return <main className="pt-main rp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const programs: any[] = d.scope?.programs || []; const mine: any[] = d.mine || []; const isTrainer = (d.scope?.trainer_ids || []).length > 0 || d.me?.staff;
  return <main className="pt-main rp" data-testid="rp-home"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box rp-hero">
      <span className="pt-kicker"><Icon name="doc" size={14} /> {P46_NAMES_AR.axis} · {P46_NAMES_AR.official}</span>
      <h1>{P46_NAMES_AR.page}</h1>
      <p className="rp-lead">التقرير هنا لا يُكتب من فراغ: أرقامه (المسجَّلون · المنتظمون · الجلسات والساعات · حضور كل متدرّب) تُلتقط من أَثَر، وتكتب أنت ما لا يعرفه إلا المعلّم: الأهداف، وما جرى في الصف، والحكم، والتوصية. ثم يعتمده مدير البرنامج ويُطبع بنموذج «{P46_NAMES_AR.weekly_full}».</p>
      {!isTrainer && !(d.missions?.length > 0) && <p className="rp-note" data-testid="rp-not-trainer">حسابك ليس مسجَّلًا مدرّبًا على شعبة بعد. حين يربطك الطاقم بشعبة (بريدك في سجلّ المدرّبين) تظهر هنا برامجك.</p>}
      {!isTrainer && d.missions?.length > 0 && <p className="rp-note" data-testid="rp-expert-note">أنت هنا بصفتك خبيرًا متعاقدًا مع أَثَر: تقاريرك تقارير إنجاز مهمة — واحد لكل عقد تعاون موقَّع.</p>}
      {isTrainer && <form className="rp-new" data-testid="rp-new" onSubmit={create}>
        <b>{P46_NAMES_AR.start}</b>
        <div className="rp-grid">
          <label>البرنامج<select value={f.program_id} onChange={e => setF(x => ({ ...x, program_id: e.target.value, classroom_id: '' }))} data-testid="rp-program" required><option value="">اختر…</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
          <label>الشعبة / القاعة<select value={f.classroom_id} onChange={e => setF(x => ({ ...x, classroom_id: e.target.value }))} data-testid="rp-classroom"><option value="">البرنامج كله</option>{rooms.map(c => <option key={c.id} value={c.id}>{[c.section_name, c.code, c.level].filter(Boolean).join(' · ')}</option>)}</select></label>
          <label>من<input type="date" value={f.from} onChange={e => setF(x => ({ ...x, from: e.target.value }))} data-testid="rp-from" required /></label>
          <label>إلى<input type="date" value={f.to} onChange={e => setF(x => ({ ...x, to: e.target.value }))} data-testid="rp-to" required /></label>
        </div>
        <div className="rp-row"><button className="pt-btn gold" type="submit" disabled={busy || !f.program_id} data-testid="rp-create"><Icon name="plus" size={16} /> {busy ? '…' : 'أنشئ التقرير وعبّئ أرقامه'}</button>{err && <span className="rp-err" role="alert">{err}</span>}</div>
      </form>}
    </section>
    {isTrainer && d.finals?.length > 0 && <FinalCards finals={d.finals} token={token} />}
    {d.missions?.length > 0 && <MissionCards missions={d.missions} token={token} />}
    <section className="pt-box" aria-labelledby="rp-mine-h">
      <h2 id="rp-mine-h"><Icon name="folder" size={18} /> تقاريري</h2>
      {mine.length === 0 && <p className="pt-muted" data-testid="rp-empty">لا تقارير بعد.</p>}
      <ul className="rp-list" data-testid="rp-list">{mine.map(r => <li key={r.id} data-status={r.status}><Link href={`/me/reports/${r.id}`}><span className={`rp-chip ${STATUS_TONE[r.status]}`}>{d.status_ar[r.status]}</span> {listLineAr(r)}</Link>{r.status === 'returned' && r.return_note && <small className="rp-ret">ملاحظة الإعادة: {r.return_note}</small>}</li>)}</ul>
    </section>
  </main>;
}

/* ───────── 2) المحرّر ───────── */
const upd = <O,>(o: O, path: (string | number)[], v: any): O => { const c: any = Array.isArray(o) ? [...(o as any)] : { ...(o as any) }; if (path.length === 1) { c[path[0]] = v; return c; } c[path[0]] = upd(c[path[0]] ?? (typeof path[1] === 'number' ? [] : {}), path.slice(1), v); return c; };
export function ReportEditor({ id, token, mode = 'author', onBack }: { id: string; token: Tok; mode?: 'author' | 'admin'; onBack?: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [dirty, setDirty] = useState(false);
  const [body, setBody] = useState<Body | null>(null); const [students, setStudents] = useState<StudentRow[]>([]); const [lines, setLines] = useState<Record<string, string>>({}); const [linesOk, setLinesOk] = useState(false);
  const [sec, setSec] = useState(1); const [print, setPrint] = useState(false); const [phr, setPhr] = useState<{ phrases: Phrase[]; note_ar: string } | null>(null); const [retNote, setRetNote] = useState('');
  const load = useCallback(async () => { const j = await api(token, `/api/reports?id=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setBody(j.report.body); setStudents(j.report.students || []); setLines(Object.fromEntries((j.report.lines || []).map((l: any) => [l.key, l.text]))); setLinesOk(!!j.report.lines_ok); setDirty(false); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const r = d?.report; const c: Computed | null = r?.computed || null; const skills = c?.skills || []; const editable = !!r?.can_edit;
  const setB = (path: (string | number)[], v: any) => { setBody(b => (b ? upd(b, path, v) : b)); setDirty(true); };
  const setScore = (key: string, code: string, v: string) => { setStudents(ss => ss.map(s => (s.key === key ? { ...s, scores: { ...s.scores, [code]: v === '' ? null : Math.max(0, Math.min(100, Number(v))) } } : s))); setDirty(true); };
  const setStudentNote = (key: string, v: string) => { setStudents(ss => ss.map(s => (s.key === key ? { ...s, note: v } : s))); setDirty(true); };
  const liveStudents = useMemo(() => students.map(s => { const vals = skills.map(k => s.scores?.[k.code]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v)); const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null; const g = avg === null ? null : avg >= 90 ? 'ممتاز' : avg >= 80 ? 'جيد جدًا' : avg >= 70 ? 'جيد' : avg >= 60 ? 'مقبول' : 'ضعيف'; return { ...s, avg, grade_ar: g }; }), [students, skills]);
  const stats = useMemo(() => summativeStats(liveStudents), [liveStudents]);
  async function save(silent = false): Promise<boolean> { if (!body) return false; setBusy('save'); setErr(''); if (!silent) setOk(''); const j = await api(token, '/api/reports', { action: 'save', id, body, students: liveStudents, lines: Object.entries(lines).map(([key, text]) => ({ key, text })), lines_ok: linesOk }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل الحفظ'); return false; } setD((x: any) => ({ ...x, report: j.report })); setDirty(false); if (!silent) setOk('حُفظ'); return true; }
  async function act(action: string, extra: any = {}) { setBusy(action); setErr(''); setOk(''); if (dirty && ['submit', 'recompute'].includes(action)) { const okSave = await save(true); if (!okSave) { setBusy(''); return; } } const j = await api(token, '/api/reports', { action, id, ...extra }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); setOk(action === 'submit' ? 'أُرسل للاعتماد' : action === 'approve' ? `اعتُمد — رمز التحقّق ${j.verify_code}${j.lines_sent ? ` · أُرسل ${j.lines_sent} سطرًا للمتدرّبين` : ''}` : action === 'return' ? 'أُعيد بملاحظة' : action === 'recompute' ? 'حُدِّثت الأرقام من أَثَر' : 'تم'); }
  async function phrase() { setBusy('phrase'); setErr(''); const j = await api(token, '/api/reports', { action: 'phrase', id }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } setPhr({ phrases: j.phrases || [], note_ar: j.note_ar || '' }); }
  function adopt(p: Phrase) { if (!body) return; const add = (cur: string) => (cur ? cur + ' ' + p.text : p.text); if (p.section === 'strengths') setB(['strengths', 'strengths'], [...body.strengths.strengths, { point: p.text, evidence: 'من أرقام التقرير' }]); else if (p.section === 'challenges') setB(['strengths', 'challenges'], [...body.strengths.challenges, { point: p.text, action: '' }]); else if (p.section === 'admin_attendance') setB(['admin', 'attendance'], add(body.admin.attendance)); else if (p.section === 'common_errors') setB(['assessment', 'formative', 'common_errors'], add(body.assessment.formative.common_errors)); else setB(['general', 'notes'], add(body.general.notes)); setPhr(x => (x ? { ...x, phrases: x.phrases.filter(q => q !== p) } : x)); }
  if (!d || !body || !c) return <main className="pt-main rp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  if (r.kind === 'final') return <FinalEditor id={id} token={token} mode={mode} onBack={onBack} />;
  if (r.kind === 'mission') return <MissionEditor id={id} token={token} mode={mode} onBack={onBack} />;
  const S = d.status_ar; const SECS = ['البيانات العامة', 'الأهداف التعليمية', 'الأنشطة والاستراتيجيات', 'أساليب التقييم', 'كشف الطلاب', 'التوصيات والقرارات', 'القوة والتحدّيات', 'الملاحظات الإدارية', 'سطر لكل متدرّب'];
  const ro = !editable;
  const inp = (path: (string | number)[], v: string, ph = '', max = 600, rows = 0) => rows ? <textarea value={v} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} rows={rows} maxLength={max} readOnly={ro} /> : <input value={v} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} maxLength={max} readOnly={ro} />;
  const sel = (path: (string | number)[], v: string, opts: Record<string, string>, tid?: string) => <select value={v} onChange={e => setB(path, e.target.value)} disabled={ro} data-testid={tid}><option value="">—</option>{Object.entries(opts).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>;
  const skillSel = (path: (string | number)[], v: string) => <select value={v} onChange={e => setB(path, e.target.value)} disabled={ro}><option value="">المهارة…</option>{skills.map(k => <option key={k.code} value={k.name_ar}>{k.name_ar}</option>)}</select>;
  if (print) return <ReportPrint r={{ ...r, body, students: liveStudents }} onClose={() => setPrint(false)} />;
  return <main className="pt-main rp rp-ed" data-testid="rp-editor" data-status={r.status}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box rp-head">
      <div className="rp-head-top">
        <div><span className="pt-kicker"><Icon name="doc" size={14} /> {P46_NAMES_AR.weekly} · الأسبوع {r.week_no}</span>{mode === 'admin' ? <h2 className="rp-h">{c.program_ar}{c.classroom_ar ? ` — ${c.classroom_ar}` : ''}</h2> : <h1>{c.program_ar}{c.classroom_ar ? ` — ${c.classroom_ar}` : ''}</h1>}<p className="pt-muted">{fmtDayAr(r.period_from)} → {fmtDayAr(r.period_to)} · {c.trainer_ar}{c.org_ar ? ` · ${c.org_ar}` : ''} · <span className={`rp-chip ${STATUS_TONE[r.status]}`} data-testid="rp-status">{S[r.status]}</span></p></div>
        <div className="rp-actions">
          {onBack ? <button className="pt-btn ghost small" type="button" onClick={onBack}><Icon name="arrow" size={14} /> القائمة</button> : <Link className="pt-btn ghost small" href="/me/reports"><Icon name="arrow" size={14} /> تقاريري</Link>}
          <button className="pt-btn ghost small" type="button" onClick={() => setPrint(true)} data-testid="rp-print"><Icon name="print" size={14} /> معاينة الطباعة</button>
          {editable && <button className="pt-btn ghost small" type="button" onClick={() => act('recompute')} disabled={!!busy} data-testid="rp-recompute"><Icon name="refresh" size={14} /> {P46_NAMES_AR.recompute}</button>}
          {editable && <button className="pt-btn navy small" type="button" onClick={() => save()} disabled={!!busy || !dirty} data-testid="rp-save"><Icon name="save" size={14} /> {busy === 'save' ? '…' : dirty ? 'احفظ' : 'محفوظ'}</button>}
          {editable && mode === 'author' && <button className="pt-btn gold small" type="button" onClick={() => act('submit')} disabled={!!busy} data-testid="rp-submit"><Icon name="send" size={14} /> {P46_NAMES_AR.submit}</button>}
          {r.can_decide && <button className="pt-btn gold small" type="button" onClick={() => act('approve')} disabled={!!busy} data-testid="rp-approve"><Icon name="check" size={14} /> {P46_NAMES_AR.approve}</button>}
        </div>
      </div>
      {r.can_decide && <div className="rp-return"><input value={retNote} onChange={e => setRetNote(e.target.value.slice(0, 400))} placeholder="ملاحظة الإعادة للمعلّم…" data-testid="rp-return-note" /><button className="pt-btn ghost small" type="button" onClick={() => act('return', { note: retNote })} disabled={!!busy || retNote.trim().length < 3} data-testid="rp-return"><Icon name="arrow" size={14} /> {P46_NAMES_AR.return}</button></div>}
      {r.status === 'returned' && r.return_note && <p className="rp-retbox" data-testid="rp-returned">أُعيد بملاحظة: {r.return_note}</p>}
      {r.status === 'approved' && <p className="rp-okbox" data-testid="rp-approved">معتمَد من {r.approved_name} · {fmtT(r.approved_at)} · رمز التحقّق <b dir="ltr">{r.verify_code}</b> · <Link href={`/verify/report/${r.verify_code}`}>صفحة التحقّق</Link>{r.lines_sent_at ? ' · أُرسلت الأسطر للمتدرّبين' : ''}</p>}
      {editable && r.missing?.length > 0 && <p className="rp-missing" data-testid="rp-missing">قبل الإرسال يلزم: {r.missing.join(' · ')}</p>}
      <div className="rp-kpis" data-testid="rp-kpis"><span><b>{c.enrolled}</b> مسجَّلًا</span><span><b>{c.regular}</b> منتظمًا فعليًا</span><span><b>{c.sessions}</b> جلسات</span><span><b>{c.hours}</b> ساعة</span><span><b>{stats.n ? `${stats.avg}%` : '—'}</b> متوسط المجموعة</span><small>من أَثَر · {fmtT(c.computed_at)}</small></div>
      {(err || ok) && <p className={err ? 'rp-err' : 'rp-ok'} role="status" data-testid="rp-msg">{err || ok}</p>}
    </section>
    <nav className="rp-secs" aria-label="أقسام التقرير">{SECS.map((s, i) => <button key={s} type="button" className={sec === i + 1 ? 'on' : ''} onClick={() => setSec(i + 1)} data-testid={`rp-sec-${i + 1}`}>{i + 1}. {s}</button>)}</nav>
    {editable && <section className="pt-box rp-ai">
      <div className="rp-row"><button className="pt-btn teal small" type="button" onClick={phrase} disabled={!!busy} data-testid="rp-phrase"><Icon name="spark" size={14} /> {busy === 'phrase' ? '…' : P46_NAMES_AR.phrase}</button><small>يصوغ جُملًا وصفية من أرقام التقرير فقط — لا تقديرات ولا توصيات ولا أسماء؛ لا يُحفظ شيء حتى تضغط «أعتمد».</small></div>
      {phr && <ul className="rp-phr" data-testid="rp-phrases">{phr.phrases.length === 0 && <li className="pt-muted">لا أرقام كافية بعد — أدخل درجات أو حدّث الأرقام.</li>}{phr.phrases.map((p, i) => <li key={i}><span>{p.text}</span><button type="button" className="pt-btn ghost small" onClick={() => adopt(p)} data-testid="rp-adopt">أعتمد ← {p.section === 'strengths' ? 'نقاط القوة' : p.section === 'challenges' ? 'التحدّيات' : p.section === 'admin_attendance' ? 'الحضور' : p.section === 'common_errors' ? 'الأخطاء الشائعة' : 'ملاحظات'}</button></li>)}<li className="pt-muted"><small>{phr.note_ar}</small></li></ul>}
    </section>}

    {sec === 1 && <section className="pt-box rp-sec" data-testid="rp-s1"><h2>القسم الأول: البيانات العامة</h2>
      <table className="rp-t"><tbody>
        <tr><th>اسم الجهة / المعهد</th><td>{inp(['general', 'institution'], body.general.institution, c.org_ar || 'اسم الجهة', 160)}</td></tr>
        <tr><th>اسم عضو هيئة التدريس</th><td>{c.trainer_ar}</td></tr>
        <tr><th>المستوى الدراسي</th><td>{inp(['general', 'level'], body.general.level, c.level_ar || 'مبتدئ · متوسط · …', 160)}</td></tr>
        <tr><th>المجموعة / القاعة</th><td>{inp(['general', 'group'], body.general.group, c.classroom_ar, 160)}</td></tr>
        <tr><th>الفترة الزمنية</th><td>من {fmtDayAr(r.period_from)} إلى {fmtDayAr(r.period_to)} (الأسبوع {r.week_no})</td></tr>
        <tr><th>عدد الطلاب المسجَّلين</th><td><b>{c.enrolled}</b> <small className="pt-muted">من أَثَر</small></td></tr>
        <tr><th>عدد الطلاب المنتظمين فعليًا</th><td><b>{c.regular}</b> <small className="pt-muted">حضور ≥ {d.regular_pct}% من جلسات الفترة</small></td></tr>
        <tr><th>عدد الساعات المنفَّذة</th><td><b>{c.hours}</b> <small className="pt-muted">من {c.sessions} جلسات حضور</small></td></tr>
        <tr><th>الوحدة / الدروس المنفَّذة</th><td>{inp(['general', 'units'], body.general.units, c.units.join(' · ') || 'عناوين الدروس', 600)}</td></tr>
        <tr><th>ملاحظات</th><td>{inp(['general', 'notes'], body.general.notes, '', 600, 2)}</td></tr>
      </tbody></table></section>}

    {sec === 2 && <section className="pt-box rp-sec" data-testid="rp-s2"><h2>القسم الثاني: الأهداف التعليمية للأسبوع</h2>
      <table className="rp-t"><thead><tr><th>اليوم</th><th>الهدف اللغوي/التعليمي المستهدف</th><th>المهارة الرئيسة</th><th>مدى الملاءمة للمستوى</th><th>ملاحظات التنفيذ</th></tr></thead><tbody>
        {body.objectives.days.map((day, i) => <tr key={i}><th>{WEEK_DAYS_AR[i]}</th><td>{inp(['objectives', 'days', i, 'goal'], day.goal, 'الهدف…', 320)}</td><td>{skillSel(['objectives', 'days', i, 'skill'], day.skill)}</td><td>{sel(['objectives', 'days', i, 'fit'], day.fit, FIT_AR)}</td><td>{inp(['objectives', 'days', i, 'note'], day.note, '', 160)}</td></tr>)}
      </tbody></table>
      <p className="rp-q">مدى تحقّق الأهداف بنهاية الأسبوع؟ {sel(['objectives', 'achieved'], body.objectives.achieved, ACHIEVED_AR, 'rp-achieved')}</p></section>}

    {sec === 3 && <section className="pt-box rp-sec" data-testid="rp-s3"><h2>القسم الثالث: الأنشطة التعليمية والاستراتيجيات المستخدمة</h2>
      <h3>أ. الأنشطة المنفَّذة</h3>
      <table className="rp-t"><thead><tr><th>النشاط</th><th>المهارة المستهدفة</th><th>وصف مختصر</th><th>دور المعلّم</th><th>دور الطالب</th><th>الوسائل</th><th></th></tr></thead><tbody>
        {body.activities.items.map((a, i) => <tr key={i}><td>{inp(['activities', 'items', i, 'name'], a.name, `النشاط ${i + 1}`, 160)}</td><td>{skillSel(['activities', 'items', i, 'skill'], a.skill)}</td><td>{inp(['activities', 'items', i, 'desc'], a.desc, '', 600)}</td><td>{inp(['activities', 'items', i, 'teacher_role'], a.teacher_role, '', 160)}</td><td>{inp(['activities', 'items', i, 'student_role'], a.student_role, '', 160)}</td><td>{inp(['activities', 'items', i, 'tools'], a.tools, '', 160)}</td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['activities', 'items'], body.activities.items.filter((_, j) => j !== i))}>×</button>}</td></tr>)}
      </tbody></table>
      {!ro && body.activities.items.length < MAX_ACTIVITIES && <button type="button" className="pt-btn ghost small" onClick={() => setB(['activities', 'items'], [...body.activities.items, { name: '', skill: '', desc: '', teacher_role: '', student_role: '', tools: '' }])} data-testid="rp-add-activity"><Icon name="plus" size={14} /> أضف نشاطًا</button>}
      <h3>ب. الاستراتيجيات التعليمية المستخدمة</h3>
      <table className="rp-t"><thead><tr><th>الاستراتيجية</th><th>هل طُبّقت؟</th><th>وصف التطبيق</th><th>الأثر الملاحَظ</th></tr></thead><tbody>
        {body.activities.strategies.map((s, i) => <tr key={i}><th>{s.name}</th><td>{sel(['activities', 'strategies', i, 'applied'], s.applied, APPLIED_AR)}</td><td>{inp(['activities', 'strategies', i, 'how'], s.how, '', 600)}</td><td>{inp(['activities', 'strategies', i, 'effect'], s.effect, '', 600)}</td></tr>)}
      </tbody></table></section>}

    {sec === 4 && <section className="pt-box rp-sec" data-testid="rp-s4"><h2>القسم الرابع: أساليب التقييم المطبَّقة</h2>
      <h3>أ. التقييم التكويني — المستمر داخل الحصة</h3>
      <table className="rp-t"><tbody>
        <tr><th>أساليب رصد الأداء</th><td>{inp(['assessment', 'formative', 'methods'], body.assessment.formative.methods, '', 600)}</td></tr>
        <tr><th>كيفية رصد الأخطاء وتصويبها</th><td>{inp(['assessment', 'formative', 'correction'], body.assessment.formative.correction, 'تصحيح فوري · تصحيح مؤجَّل', 160)}</td></tr>
        <tr><th>أكثر الأخطاء شيوعًا خلال الأسبوع</th><td>{inp(['assessment', 'formative', 'common_errors'], body.assessment.formative.common_errors, '', 600, 2)}</td></tr>
        <tr><th>مدى استجابة الطلاب للتصويب</th><td>{sel(['assessment', 'formative', 'response'], body.assessment.formative.response, RESPONSE_AR, 'rp-response')}</td></tr>
      </tbody></table>
      <h3>ب. التقييم الختامي — نهاية الأسبوع</h3>
      <table className="rp-t"><thead><tr><th>أداة التقييم</th><th>المهارة المقاسة</th><th>وصف مختصر</th><th>آلية التطبيق</th><th>معيار النجاح</th><th></th></tr></thead><tbody>
        {body.assessment.summative.tools.map((t, i) => <tr key={i}><td><input list="rp-tools" value={t.tool} onChange={e => setB(['assessment', 'summative', 'tools', i, 'tool'], e.target.value.slice(0, 160))} readOnly={ro} /></td><td>{skillSel(['assessment', 'summative', 'tools', i, 'skill'], t.skill)}</td><td>{inp(['assessment', 'summative', 'tools', i, 'desc'], t.desc, '', 600)}</td><td>{inp(['assessment', 'summative', 'tools', i, 'how'], t.how, '', 600)}</td><td>{inp(['assessment', 'summative', 'tools', i, 'pass'], t.pass, `${d.pass_mark}%`, 160)}</td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['assessment', 'summative', 'tools'], body.assessment.summative.tools.filter((_, j) => j !== i))}>×</button>}</td></tr>)}
      </tbody></table><datalist id="rp-tools">{SUMMATIVE_TOOLS_AR.map(t => <option key={t} value={t} />)}</datalist>
      {!ro && body.assessment.summative.tools.length < MAX_TOOLS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['assessment', 'summative', 'tools'], [...body.assessment.summative.tools, { tool: '', skill: '', desc: '', how: '', pass: '' }])} data-testid="rp-add-tool"><Icon name="plus" size={14} /> أضف أداة</button>}
      <h3>ج. نتائج التقييم الختامي الإجمالية <small className="pt-muted">(تُحسب من كشف الطلاب)</small></h3>
      <div className="rp-kpis" data-testid="rp-stats"><span><b>{stats.avg ?? '—'}</b> متوسط المجموعة</span><span><b>{stats.max ?? '—'}</b> أعلى درجة</span><span><b>{stats.min ?? '—'}</b> أدنى درجة</span><span><b>{stats.pass_pct === null ? '—' : `${stats.pass_pct}%`}</b> ناجحون</span><span><b>{stats.support_pct === null ? '—' : `${stats.support_pct}%`}</b> يحتاجون دعمًا</span></div></section>}

    {sec === 5 && <section className="pt-box rp-sec" data-testid="rp-s5"><h2>القسم الخامس: كشف رصد وتقييم مستويات الطلاب</h2>
      <p className="pt-muted">مفتاح التقدير: {GRADE_KEY_AR}. الحضور من أَثَر؛ الدرجات من 0 إلى 100 لكل مهارة، والتقدير يُحسب.</p>
      <div className="rp-scroll"><table className="rp-t rp-students"><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th>{skills.map(k => <th key={k.code}>{k.name_ar}</th>)}<th>المتوسط</th><th>التقدير</th><th>ملاحظة</th></tr></thead><tbody>
        {liveStudents.map((s, i) => <tr key={s.key} data-testid="rp-student"><td>{i + 1}</td><th>{s.name}{s.level ? <small> · {s.level}</small> : null}</th><td>{s.attendance_pct === null ? '—' : `${s.attendance_pct}%`}</td>{skills.map(k => <td key={k.code}><input type="number" min={0} max={100} inputMode="numeric" value={s.scores?.[k.code] ?? ''} onChange={e => setScore(s.key, k.code, e.target.value)} readOnly={ro} aria-label={`${k.name_ar} — ${s.name}`} /></td>)}<td>{s.avg ?? '—'}</td><td data-testid="rp-grade">{s.grade_ar || '—'}</td><td><input value={s.note || ''} onChange={e => setStudentNote(s.key, e.target.value.slice(0, 160))} readOnly={ro} /></td></tr>)}
        {liveStudents.length === 0 && <tr><td colSpan={6 + skills.length} className="pt-muted">لا طلاب في الكشف — تأكّد من قبول التسجيلات أو تنسيبهم إلى الشعبة ثم «{P46_NAMES_AR.recompute}».</td></tr>}
      </tbody></table></div></section>}

    {sec === 6 && <section className="pt-box rp-sec" data-testid="rp-s6"><h2>القسم السادس: التوصيات والقرارات النهائية</h2>
      <h3>أ. الطلاب المرشّحون للنقل إلى مستوى أعلى</h3>
      <table className="rp-t"><thead><tr><th>اسم الطالب</th><th>متوسط الأداء</th><th>المبرّرات</th><th>تاريخ النقل</th><th></th></tr></thead><tbody>
        {body.recommendations.promote.map((p, i) => { const st = liveStudents.find(s => s.key === p.key); return <tr key={i}><th>{p.name}</th><td>{st?.avg ?? '—'}</td><td>{inp(['recommendations', 'promote', i, 'reason'], p.reason, 'المبرّرات اللغوية/الأدائية', 600)}</td><td><input type="date" value={p.date} onChange={e => setB(['recommendations', 'promote', i, 'date'], e.target.value)} readOnly={ro} /></td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['recommendations', 'promote'], body.recommendations.promote.filter((_, j) => j !== i))}>×</button>}</td></tr>; })}
      </tbody></table>
      {!ro && <select className="rp-pick" value="" onChange={e => { const s = liveStudents.find(x => x.key === e.target.value); if (s && !body.recommendations.promote.some(p => p.key === s.key)) setB(['recommendations', 'promote'], [...body.recommendations.promote, { key: s.key, name: s.name, reason: '', date: '' }]); }} data-testid="rp-promote-pick"><option value="">+ أضف طالبًا للنقل…</option>{liveStudents.map(s => <option key={s.key} value={s.key}>{s.name}{s.avg !== null ? ` (${s.avg})` : ''}</option>)}</select>}
      <h3>ب. الطلاب الذين يحتاجون خطة دعم إضافية</h3>
      <table className="rp-t"><thead><tr><th>اسم الطالب</th><th>المهارة الأضعف</th><th>وصف الاحتياج بدقة</th><th>الإجراء المقترح</th><th>المسؤول عن التنفيذ</th><th></th></tr></thead><tbody>
        {body.recommendations.support.map((p, i) => <tr key={i}><th>{p.name}</th><td>{skillSel(['recommendations', 'support', i, 'skill'], p.skill)}</td><td>{inp(['recommendations', 'support', i, 'need'], p.need, '', 600)}</td><td>{inp(['recommendations', 'support', i, 'action'], p.action, '', 600)}</td><td>{inp(['recommendations', 'support', i, 'owner'], p.owner, 'المعلّم · المرشد · الإدارة', 160)}</td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['recommendations', 'support'], body.recommendations.support.filter((_, j) => j !== i))}>×</button>}</td></tr>)}
      </tbody></table>
      {!ro && <select className="rp-pick" value="" onChange={e => { const s = liveStudents.find(x => x.key === e.target.value); if (s && !body.recommendations.support.some(p => p.key === s.key)) { const w = weakestSkill(s, skills); setB(['recommendations', 'support'], [...body.recommendations.support, { key: s.key, name: s.name, skill: w?.name_ar || '', need: '', action: '', owner: '' }]); } }} data-testid="rp-support-pick"><option value="">+ أضف طالبًا لخطة دعم…</option>{liveStudents.map(s => <option key={s.key} value={s.key}>{s.name}{s.avg !== null ? ` (${s.avg})` : ''}</option>)}</select>}
      <h3>ج. خطة الأسبوع القادم</h3>
      <table className="rp-t"><tbody>
        <tr><th>أبرز ما سيُركَّز عليه تعليميًا</th><td>{inp(['recommendations', 'next_week', 'focus'], body.recommendations.next_week.focus, '', 600, 2)}</td></tr>
        <tr><th>مقترحات لتحسين الأداء الصفي</th><td>{inp(['recommendations', 'next_week', 'improve'], body.recommendations.next_week.improve, '', 600, 2)}</td></tr>
        <tr><th>احتياجات لوجستية أو تقنية مطلوبة</th><td>{inp(['recommendations', 'next_week', 'logistics'], body.recommendations.next_week.logistics, '', 600, 2)}</td></tr>
        <tr><th>ملاحظات خاصة للإدارة</th><td>{inp(['recommendations', 'admin_note'], body.recommendations.admin_note, '', 600, 2)}</td></tr>
      </tbody></table></section>}

    {sec === 7 && <section className="pt-box rp-sec" data-testid="rp-s7"><h2>القسم السابع: نقاط القوة والتحدّيات</h2>
      <h3>أ. أبرز نقاط القوة لدى المجموعة هذا الأسبوع</h3>
      <table className="rp-t"><thead><tr><th>م</th><th>نقطة القوة</th><th>الدليل / المؤشّر</th><th></th></tr></thead><tbody>
        {body.strengths.strengths.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{inp(['strengths', 'strengths', i, 'point'], s.point, '', 600)}</td><td>{inp(['strengths', 'strengths', i, 'evidence'], s.evidence, '', 600)}</td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['strengths', 'strengths'], body.strengths.strengths.filter((_, j) => j !== i))}>×</button>}</td></tr>)}
      </tbody></table>
      {!ro && body.strengths.strengths.length < 6 && <button type="button" className="pt-btn ghost small" onClick={() => setB(['strengths', 'strengths'], [...body.strengths.strengths, { point: '', evidence: '' }])} data-testid="rp-add-strength"><Icon name="plus" size={14} /> أضف نقطة قوة</button>}
      <h3>ب. التحدّيات وكيف ستُعالَج</h3>
      <table className="rp-t"><thead><tr><th>م</th><th>التحدّي</th><th>الإجراء</th><th></th></tr></thead><tbody>
        {body.strengths.challenges.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{inp(['strengths', 'challenges', i, 'point'], s.point, '', 600)}</td><td>{inp(['strengths', 'challenges', i, 'action'], s.action, '', 600)}</td><td>{!ro && <button type="button" className="rp-x" aria-label="حذف" onClick={() => setB(['strengths', 'challenges'], body.strengths.challenges.filter((_, j) => j !== i))}>×</button>}</td></tr>)}
      </tbody></table>
      {!ro && body.strengths.challenges.length < 6 && <button type="button" className="pt-btn ghost small" onClick={() => setB(['strengths', 'challenges'], [...body.strengths.challenges, { point: '', action: '' }])} data-testid="rp-add-challenge"><Icon name="plus" size={14} /> أضف تحدّيًا</button>}</section>}

    {sec === 8 && <section className="pt-box rp-sec" data-testid="rp-s8"><h2>القسم الثامن: الملاحظات الإدارية</h2>
      <table className="rp-t"><tbody>
        <tr><th>انتظام الحضور والانصراف</th><td>{inp(['admin', 'attendance'], body.admin.attendance, '', 600, 2)}</td></tr>
        <tr><th>التزام الطلاب بالتكليفات والواجبات</th><td>{inp(['admin', 'assignments'], body.admin.assignments, '', 600, 2)}</td></tr>
        <tr><th>مستوى الانضباط العام داخل القاعة</th><td>{inp(['admin', 'discipline'], body.admin.discipline, '', 600, 2)}</td></tr>
        <tr><th>ملاحظات على البيئة الصفية أو التجهيزات</th><td>{inp(['admin', 'environment'], body.admin.environment, '', 600, 2)}</td></tr>
        <tr><th>أي ملاحظات أخرى للإدارة</th><td>{inp(['admin', 'other'], body.admin.other, '', 600, 2)}</td></tr>
      </tbody></table></section>}

    {sec === 9 && <section className="pt-box rp-sec" data-testid="rp-s9"><h2>{P46_NAMES_AR.line}</h2>
      <p className="pt-muted">جملة خاصة لكل متدرّب عن أسبوعه (قوّته وما يركّز عليه) — تصله وحده بعد اعتماد التقرير، بلا درجات زملائه ولا ترتيب. اختياري.</p>
      <label className="rp-check"><input type="checkbox" checked={linesOk} onChange={e => { setLinesOk(e.target.checked); setDirty(true); }} disabled={ro} data-testid="rp-lines-ok" /> أأذن بإرسال هذه الأسطر إلى المتدرّبين بعد الاعتماد</label>
      <table className="rp-t"><tbody>
        {liveStudents.filter(s => s.email).map(s => <tr key={s.key}><th>{s.name}</th><td><input value={lines[s.key] || ''} onChange={e => { setLines(l => ({ ...l, [s.key]: e.target.value.slice(0, LINE_MAX) })); setDirty(true); }} maxLength={LINE_MAX} placeholder="مثال: صوتك في القراءة صار أوضح هذا الأسبوع — ركّز على همزة الوصل." readOnly={ro} data-testid="rp-line" /></td></tr>)}
        {liveStudents.filter(s => s.email).length === 0 && <tr><td className="pt-muted">لا بريد لأي متدرّب في الكشف — لا يمكن إرسال أسطر.</td></tr>}
      </tbody></table></section>}
    <div className="rp-nav"><button type="button" className="pt-btn ghost small" onClick={() => setSec(s => Math.max(1, s - 1))} disabled={sec === 1}>← السابق</button><span>{sec} / 9</span><button type="button" className="pt-btn ghost small" onClick={() => setSec(s => Math.min(9, s + 1))} disabled={sec === 9}>التالي →</button></div>
  </main>;
}

/* ───────── 3) الطباعة — نموذج «تقرير التعلّم الشامل» ───────── */
function Chk({ on, label }: { on: boolean; label: string }) { return <span className="pr-chk">{on ? '☑' : '☐'} {label}</span>; }
export function ReportPrint({ r, onClose }: { r: any; onClose?: () => void }) {
  const c: Computed = r.computed; const b: Body = r.body; const students: StudentRow[] = r.students || []; const skills = c.skills || []; const st = summativeStats(students); const sa = skillAverages(students, skills);
  return <div className="pr" data-testid="rp-print-view"><style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
    <div className="pr-bar"><button type="button" className="pt-btn gold small" onClick={() => window.print()} data-testid="rp-do-print">🖨 اطبع / احفظ PDF</button>{onClose && <button type="button" className="pt-btn ghost small" onClick={onClose}>← عودة إلى المحرّر</button>}<small>الطباعة من المتصفح (A4) — اختر «حفظ بصيغة PDF» إن أردت ملفًا.</small></div>
    <article className="pr-page" dir="rtl">
      <header className="pr-head"><div><h1>{P46_NAMES_AR.weekly_full}</h1><p>الأسبوع {r.week_no} · {c.program_ar}</p><p>{c.org_ar || b.general.institution}</p></div><div className="pr-meta"><span>الحالة: {r.status === 'approved' ? 'معتمَد' : 'مسودّة'}</span>{r.verify_code && <span>رمز التحقّق: <b dir="ltr">{r.verify_code}</b></span>}<span>أَثَر · توثيق الجودة والأداء</span></div></header>
      <h2>القسم الأول: البيانات العامة</h2>
      <table><tbody>
        <tr><th>اسم الجهة / المعهد</th><td>{b.general.institution || c.org_ar}</td><th>اسم عضو هيئة التدريس</th><td>{c.trainer_ar}</td></tr>
        <tr><th>المستوى الدراسي</th><td>{b.general.level || c.level_ar}</td><th>المجموعة / القاعة</th><td>{b.general.group || c.classroom_ar}</td></tr>
        <tr><th>الفترة الزمنية</th><td>من {fmtDayAr(r.period_from)} إلى {fmtDayAr(r.period_to)}</td><th>تاريخ رفع التقرير</th><td>{r.submitted_at ? fmtDayAr(String(r.submitted_at).slice(0, 10)) : '—'}</td></tr>
        <tr><th>عدد الطلاب المسجَّلين</th><td>{c.enrolled}</td><th>عدد الطلاب المنتظمين فعليًا</th><td>{c.regular}</td></tr>
        <tr><th>عدد الساعات المنفَّذة</th><td>{c.hours} ({c.sessions} جلسات)</td><th>الوحدة / الدروس المنفَّذة</th><td>{b.general.units || c.units.join(' · ')}</td></tr>
        {b.general.notes && <tr><th>ملاحظات</th><td colSpan={3}>{b.general.notes}</td></tr>}
      </tbody></table>
      <h2>القسم الثاني: الأهداف التعليمية للأسبوع</h2>
      <table><thead><tr><th>اليوم</th><th>الهدف المستهدف</th><th>المهارة الرئيسة</th><th>مدى الملاءمة للمستوى</th><th>ملاحظات التنفيذ</th></tr></thead><tbody>
        {b.objectives.days.map((d, i) => <tr key={i}><th>{WEEK_DAYS_AR[i]}</th><td>{d.goal}</td><td>{d.skill}</td><td>{['very', 'ok', 'adjust'].map(k => <Chk key={k} on={d.fit === k} label={FIT_AR[k]} />)}</td><td>{d.note}</td></tr>)}
      </tbody></table>
      <p className="pr-line">مدى تحقّق الأهداف بنهاية الأسبوع: {['full', 'partial', 'none'].map(k => <Chk key={k} on={b.objectives.achieved === k} label={ACHIEVED_AR[k]} />)}</p>
      <h2>القسم الثالث: الأنشطة التعليمية والاستراتيجيات المستخدمة</h2>
      <h3>أ. جدول الأنشطة المنفَّذة</h3>
      <table><thead><tr><th>النشاط</th><th>المهارة</th><th>وصف مختصر</th><th>دور المعلّم</th><th>دور الطالب</th><th>الوسائل</th></tr></thead><tbody>
        {b.activities.items.map((a, i) => <tr key={i}><th>{a.name}</th><td>{a.skill}</td><td>{a.desc}</td><td>{a.teacher_role}</td><td>{a.student_role}</td><td>{a.tools}</td></tr>)}
        {b.activities.items.length === 0 && <tr><td colSpan={6}>—</td></tr>}
      </tbody></table>
      <h3>ب. الاستراتيجيات التعليمية المستخدمة</h3>
      <table><thead><tr><th>الاستراتيجية</th><th>هل طُبّقت؟</th><th>وصف التطبيق</th><th>الأثر الملاحَظ</th></tr></thead><tbody>
        {b.activities.strategies.map((s, i) => <tr key={i}><th>{s.name}</th><td>{['yes', 'partial', 'no'].map(k => <Chk key={k} on={s.applied === k} label={APPLIED_AR[k]} />)}</td><td>{s.how}</td><td>{s.effect}</td></tr>)}
      </tbody></table>
      <h2>القسم الرابع: أساليب التقييم المطبَّقة</h2>
      <h3>أ. التقييم التكويني — المستمر داخل الحصة</h3>
      <table><tbody>
        <tr><th>أساليب رصد الأداء</th><td>{b.assessment.formative.methods}</td></tr>
        <tr><th>كيفية رصد الأخطاء وتصويبها</th><td>{b.assessment.formative.correction}</td></tr>
        <tr><th>أكثر الأخطاء شيوعًا لدى الطلاب خلال الأسبوع</th><td>{b.assessment.formative.common_errors}</td></tr>
        <tr><th>مدى استجابة الطلاب للتصويب</th><td>{['excellent', 'good', 'avg', 'needs'].map(k => <Chk key={k} on={b.assessment.formative.response === k} label={RESPONSE_AR[k]} />)}</td></tr>
      </tbody></table>
      <h3>ب. التقييم الختامي — نهاية الأسبوع</h3>
      <table><thead><tr><th>أداة التقييم</th><th>المهارة المقاسة</th><th>وصف مختصر للأداة</th><th>آلية التطبيق</th><th>معيار النجاح</th></tr></thead><tbody>
        {(b.assessment.summative.tools.length ? b.assessment.summative.tools : SUMMATIVE_TOOLS_AR.map(t => ({ tool: t, skill: '', desc: '', how: '', pass: '' }))).map((t, i) => <tr key={i}><th>{t.tool}</th><td>{t.skill}</td><td>{t.desc}</td><td>{t.how}</td><td>{t.pass}</td></tr>)}
      </tbody></table>
      <h3>ج. نتائج التقييم الختامي الإجمالية</h3>
      <ul className="pr-stats"><li>متوسط درجات المجموعة: <b>{st.avg ?? '—'}</b></li><li>أعلى درجة في المجموعة: <b>{st.max ?? '—'}</b></li><li>أدنى درجة في المجموعة: <b>{st.min ?? '—'}</b></li><li>نسبة الطلاب الناجحين: <b>{st.pass_pct === null ? '—' : `${st.pass_pct}%`}</b></li><li>نسبة الطلاب الذين يحتاجون دعمًا: <b>{st.support_pct === null ? '—' : `${st.support_pct}%`}</b></li>{sa.some(x => x.avg !== null) && <li>متوسط كل مهارة: {sa.map(x => `${x.skill.name_ar} ${x.avg ?? '—'}`).join(' · ')}</li>}</ul>
      <h2>القسم الخامس: كشف رصد وتقييم مستويات الطلاب</h2>
      <p className="pr-key">مفتاح التقدير: {GRADE_KEY_AR}</p>
      <table className="pr-students"><thead><tr><th>م</th><th>اسم الطالب</th><th>الحضور</th>{skills.map(k => <th key={k.code}>{k.name_ar}</th>)}<th>المتوسط</th><th>التقدير</th></tr></thead><tbody>
        {students.map((s, i) => <tr key={s.key}><td>{i + 1}</td><th>{s.name}</th><td>{s.attendance_pct === null ? '—' : `${s.attendance_pct}%`}</td>{skills.map(k => <td key={k.code}>{s.scores?.[k.code] ?? ''}</td>)}<td>{s.avg ?? ''}</td><td>{s.grade_ar || ''}</td></tr>)}
      </tbody></table>
      <h2>القسم السادس: التوصيات والقرارات النهائية</h2>
      <h3>أ. الطلاب المرشّحون للنقل إلى مستوى أعلى</h3>
      <table><thead><tr><th>م</th><th>اسم الطالب</th><th>متوسط الأداء</th><th>المبرّرات</th><th>تاريخ النقل</th></tr></thead><tbody>
        {b.recommendations.promote.map((p, i) => <tr key={i}><td>{i + 1}</td><th>{p.name}</th><td>{students.find(s => s.key === p.key)?.avg ?? '—'}</td><td>{p.reason}</td><td>{p.date ? fmtDayAr(p.date) : ''}</td></tr>)}
        {b.recommendations.promote.length === 0 && <tr><td colSpan={5}>—</td></tr>}
      </tbody></table>
      <h3>ب. الطلاب الذين يحتاجون خطة دعم إضافية</h3>
      <table><thead><tr><th>م</th><th>اسم الطالب</th><th>المهارة الأضعف</th><th>وصف الاحتياج بدقة</th><th>الإجراء المقترح</th><th>المسؤول عن التنفيذ</th></tr></thead><tbody>
        {b.recommendations.support.map((p, i) => <tr key={i}><td>{i + 1}</td><th>{p.name}</th><td>{p.skill}</td><td>{p.need}</td><td>{p.action}</td><td>{p.owner}</td></tr>)}
        {b.recommendations.support.length === 0 && <tr><td colSpan={6}>—</td></tr>}
      </tbody></table>
      <h3>ج. خطة الأسبوع القادم</h3>
      <table><tbody><tr><th>أبرز ما سيُركَّز عليه تعليميًا</th><td>{b.recommendations.next_week.focus}</td></tr><tr><th>مقترحات لتحسين الأداء الصفي</th><td>{b.recommendations.next_week.improve}</td></tr><tr><th>احتياجات لوجستية أو تقنية مطلوبة</th><td>{b.recommendations.next_week.logistics}</td></tr><tr><th>ملاحظات خاصة للإدارة</th><td>{b.recommendations.admin_note}</td></tr></tbody></table>
      <h2>القسم السابع: نقاط القوة والتحدّيات</h2>
      <table><thead><tr><th>م</th><th>نقطة القوة</th><th>الدليل / المؤشّر</th></tr></thead><tbody>{b.strengths.strengths.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{s.point}</td><td>{s.evidence}</td></tr>)}{b.strengths.strengths.length === 0 && <tr><td colSpan={3}>—</td></tr>}</tbody></table>
      <table><thead><tr><th>م</th><th>التحدّي</th><th>الإجراء</th></tr></thead><tbody>{b.strengths.challenges.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{s.point}</td><td>{s.action}</td></tr>)}{b.strengths.challenges.length === 0 && <tr><td colSpan={3}>—</td></tr>}</tbody></table>
      <h2>القسم الثامن: الملاحظات الإدارية</h2>
      <table><tbody><tr><th>انتظام الحضور والانصراف</th><td>{b.admin.attendance}</td></tr><tr><th>التزام الطلاب بالتكليفات والواجبات</th><td>{b.admin.assignments}</td></tr><tr><th>مستوى الانضباط العام داخل القاعة</th><td>{b.admin.discipline}</td></tr><tr><th>ملاحظات على البيئة الصفية أو التجهيزات</th><td>{b.admin.environment}</td></tr><tr><th>أي ملاحظات أخرى للإدارة</th><td>{b.admin.other}</td></tr></tbody></table>
      <table className="pr-sign"><thead><tr><th>صفة المعتمِد</th><th>الاسم</th><th>التوقيع</th><th>التاريخ</th></tr></thead><tbody>
        <tr><td>عضو هيئة التدريس</td><td>{c.trainer_ar}</td><td></td><td>{r.submitted_at ? fmtDayAr(String(r.submitted_at).slice(0, 10)) : ''}</td></tr>
        <tr><td>مدير البرنامج</td><td>{r.approved_name || ''}</td><td>{r.status === 'approved' ? 'معتمَد إلكترونيًا' : ''}</td><td>{r.approved_at ? fmtDayAr(String(r.approved_at).slice(0, 10)) : ''}</td></tr>
      </tbody></table>
      <footer className="pr-foot"><p>شاكرين لكم عظيم تعاونكم وحرصكم الدائم على جودة مخرجات البرنامج — إدارة البرنامج · {c.org_ar || b.general.institution}</p><p>{r.verify_code ? `التحقّق: /verify/report/${r.verify_code}` : ''} · © 2026 أَثَر</p></footer>
    </article>
  </div>;
}

/* ───────── 4) الطاقم ───────── */
export function AdminReports({ token }: { token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [open, setOpen] = useState(''); const [filter, setFilter] = useState('submitted');
  const load = useCallback(async () => { const j = await api(token, '/api/reports?admin=1'); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token]);
  useEffect(() => { load(); const r = new URLSearchParams(window.location.search).get('r'); if (r) setOpen(r); }, [load]);
  if (open) return <ReportEditor id={open} token={token} mode="admin" onBack={() => { setOpen(''); load(); }} />;
  if (!d) return <main className="pt-main rp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const items: any[] = d.items || []; const counts = items.reduce((m: Record<string, number>, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {}); const list = items.filter(r => filter === 'all' || (filter === 'final' ? r.kind === 'final' : filter === 'mission' ? r.kind === 'mission' : r.status === filter));
  return <main className="pt-main rp" data-testid="ar-reports"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box rp-hero"><span className="pt-kicker"><Icon name="doc" size={14} /> {P46_NAMES_AR.axis} · {P46_NAMES_AR.official}</span><h2 className="rp-h">{P46_NAMES_AR.admin}</h2>
      <div className="rp-kpis" data-testid="ar-kpis"><span className="b"><b>{counts.submitted || 0}</b> بانتظار الاعتماد</span><span><b>{counts.approved || 0}</b> معتمَد</span><span><b>{counts.returned || 0}</b> مُعاد</span><span><b>{counts.draft || 0}</b> مسودّات</span></div>
      <div className="rp-filters">{['submitted', 'approved', 'returned', 'draft', 'final', 'mission', 'all'].map(f => <button key={f} type="button" className={filter === f ? 'on' : ''} onClick={() => setFilter(f)} data-testid={`ar-f-${f}`}>{f === 'all' ? 'الكل' : f === 'final' ? `الختامية (${items.filter(r => r.kind === 'final').length})` : f === 'mission' ? `إنجاز المهمات (${items.filter(r => r.kind === 'mission').length})` : d.status_ar[f]}</button>)}</div>
    </section>
    <section className="pt-box"><ul className="rp-list" data-testid="ar-list">{list.length === 0 && <li className="pt-muted">لا تقارير في هذه الحالة.</li>}{list.map(r => <li key={r.id} data-status={r.status} data-kind={r.kind}><button type="button" className="rp-linkbtn" onClick={() => setOpen(r.id)} data-testid="ar-item"><span className={`rp-chip ${STATUS_TONE[r.status]}`}>{d.status_ar[r.status]}</span> {listLineAr(r)} · <small>{r.author_name || r.author_email}</small></button></li>)}</ul></section>
  </main>;
}

/* ───────── 5) «سطر لك» في /me ───────── */
export function MyReportLines({ token }: { token: Tok }) {
  const [lines, setLines] = useState<any[] | null>(null);
  useEffect(() => { api(token, '/api/reports?lines=1').then(j => setLines(j?.success ? j.lines : [])); }, [token]);
  if (!lines || lines.length === 0) return null;
  return <section className="pt-box rp-lines" id="report-lines" data-testid="rp-mylines"><style dangerouslySetInnerHTML={{ __html: CSS }} /><h3><Icon name="mail" size={16} /> {P46_NAMES_AR.line}</h3><ul>{lines.map(l => <li key={l.id} data-kind={l.kind || 'weekly'}>{l.kind === 'final' ? <b><span className="rp-chip t">{P46_NAMES_AR.final_story}</span> {l.program_ar} · {P46_NAMES_AR.final}</b> : <b>{l.program_ar} · الأسبوع {l.week_no}</b>}<p>{l.text_ar}</p><small>{fmtDayAr(l.period_to)}{l.kind === 'final' && <> · <Link href={`/me/reports/line/${l.id}`} data-testid="rp-myline-open">{P46_NAMES_AR.my_page}</Link></>}</small></li>)}</ul></section>;
}

/* ───────── 6) التحقّق العام ───────── */
export function ReportVerify({ code }: { code: string }) {
  const [d, setD] = useState<any>(undefined); const [k, setK] = useState<string | null>(null);
  useEffect(() => { const kk = new URLSearchParams(window.location.search).get('k') || ''; setK(kk); if (kk) return; fetch(`/api/reports?verify=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.report || null)).catch(() => setD(null)); }, [code]);
  if (k === null) return <main className="pt-main rp"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (k) return <MissionClient code={code} k={k} />;   // ر3: نسخة الجهة بلا دخول
  return <main className="pt-main rp" data-testid="rp-verify"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box rp-hero"><span className="pt-kicker"><Icon name="shield" size={14} /> التحقّق من تقرير</span>
    {d === undefined && <p className="pt-muted">…</p>}
    {d === null && <><h1>لا يوجد تقرير معتمَد بهذا الرمز</h1><p className="pt-muted" dir="ltr">{code}</p><p><Link href="/verify">التحقّق من الشهادات</Link></p></>}
    {d && d.kind === 'mission' && <><h1>{d.kind_ar}</h1><table className="rp-t" data-testid="rp-verify-mission"><tbody><tr><th>المهمة</th><td>{d.title_ar}</td></tr><tr><th>الجهة</th><td>{d.org_ar || '—'}</td></tr><tr><th>النوع</th><td>{d.engagement_kind_ar}{d.engagement_code ? <> · <span dir="ltr">{d.engagement_code}</span></> : ''}</td></tr><tr><th>المدة</th><td>{fmtDayAr(d.period_from)} → {fmtDayAr(d.period_to)}</td></tr><tr><th>الخبير</th><td>{d.author_name}</td></tr><tr><th>المخرجات</th><td>سُلِّم {d.delivered} من {d.total} متّفقًا عليها{d.milestones ? ` · ${d.milestones_done}/${d.milestones} مراحل` : ''}</td></tr><tr><th>اعتماد أَثَر</th><td>{d.approved_name} · {fmtT(d.approved_at)}</td></tr><tr><th>إقرار الجهة</th><td data-testid="rp-verify-ack">{d.ack ? `${d.ack.name} · ${fmtT(d.ack.at)}` : 'لم يُسجَّل بعد'}</td></tr><tr><th>الرمز</th><td dir="ltr">{d.code}</td></tr></tbody></table><p className="pt-muted">صفحة التحقّق لا تعرض الأجر ولا تفاصيل التقرير؛ نصّه الكامل لدى الجهة والخبير وأَثَر.</p></>}
    {d && d.kind !== 'mission' && <><h1>{d.kind === 'final' ? d.kind_ar : `${d.kind_ar} — الأسبوع ${d.week_no}`}</h1><table className="rp-t"><tbody><tr><th>البرنامج</th><td>{d.program_ar}{d.classroom_ar ? ` — ${d.classroom_ar}` : ''}</td></tr><tr><th>الجهة</th><td>{d.org_ar || '—'}</td></tr><tr><th>الفترة</th><td>{fmtDayAr(d.period_from)} → {fmtDayAr(d.period_to)}</td></tr><tr><th>عضو هيئة التدريس</th><td>{d.author_name}</td></tr>{d.kind === 'final' && d.signoff ? <tr><th>التوقيعان</th><td data-testid="rp-verify-signs">{d.signoff.quality ? `${d.signoff.quality.name} (الجودة)` : '—'} · {d.signoff.manager ? `${d.signoff.manager.name} (مدير البرنامج)` : '—'} · {fmtT(d.approved_at)}</td></tr> : <tr><th>اعتمده</th><td>{d.approved_name} · {fmtT(d.approved_at)}</td></tr>}{d.kind === 'final' && <tr><th>{P46_NAMES_AR.chain}</th><td data-testid="rp-verify-chain">{d.weeks} تقارير أسبوعية معتمدة{d.chain?.length ? <> — {d.chain.map((c: string) => <Link key={c} href={`/verify/report/${c}`} dir="ltr" style={{ marginInlineEnd: '.5rem' }}>{c}</Link>)}</> : ''}</td></tr>}<tr><th>التنفيذ</th><td>{d.sessions} جلسات · {d.hours} ساعة · {d.enrolled} مسجَّلًا</td></tr><tr><th>الرمز</th><td dir="ltr">{d.code}</td></tr></tbody></table><p className="pt-muted">صفحة التحقّق لا تعرض أسماء الطلاب ولا درجاتهم.</p></>}
  </section></main>;
}

const CSS = `
.rp{max-width:1100px}.rp-hero h1{margin:.2rem 0 .4rem;color:#0f2a4e}.rp-lead{font-size:1.02rem;line-height:1.9;margin:0 0 .6rem}.rp-note{background:#fff7e6;border:1px solid #f1dfae;border-radius:12px;padding:.6rem .8rem}
.rp-new{display:grid;gap:.6rem;background:#f7f8fb;border:1px solid #e5e8ef;border-radius:14px;padding:.9rem}.rp-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:.6rem}.rp-grid label{display:grid;gap:.3rem;font-size:.9rem;font-weight:700;color:#334155;min-width:0}
.rp input,.rp select,.rp textarea{width:100%;font:inherit;padding:.45rem .6rem;border:1px solid #cfd6e2;border-radius:9px;background:#fff;box-sizing:border-box}.rp input[readonly],.rp textarea[readonly]{background:#f8fafc;border-color:#e5e8ef}.rp select:disabled{background:#f8fafc}
.rp-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}.rp-err{color:#b42318;font-weight:700}.rp-ok{color:#0b8a83;font-weight:700}
.rp-list{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}.rp-list li{border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .8rem;background:#fff}.rp-list a,.rp-linkbtn{color:#0f2a4e;text-decoration:none;font-weight:700;background:none;border:0;font:inherit;cursor:pointer;text-align:start;padding:0}.rp-ret{display:block;color:#9a3412;margin-top:.3rem}
.rp-chip{display:inline-block;font-size:.78rem;font-weight:800;padding:.1rem .5rem;border-radius:999px;background:#eef2f7;color:#334155}.rp-chip.b{background:#e0f2fe;color:#075985}.rp-chip.t{background:#d1fae5;color:#065f46}.rp-chip.o{background:#ffedd5;color:#9a3412}
.rp-h{margin:.1rem 0 .3rem;color:#0f2a4e;font-size:1.35rem}.rp-hero .rp-h{font-size:1.6rem;margin:.2rem 0 .4rem}
.rp-head-top{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start}.rp-head h1{margin:.1rem 0 .3rem;color:#0f2a4e;font-size:1.35rem}.rp-actions{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
.rp-return{display:flex;gap:.5rem;align-items:center;margin-top:.5rem}.rp-return input{max-width:520px}.rp-retbox{background:#ffedd5;border:1px solid #fdba74;border-radius:10px;padding:.5rem .7rem;color:#9a3412;font-weight:700}.rp-okbox{background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:.5rem .7rem;color:#065f46}.rp-missing{background:#fff7e6;border:1px solid #f1dfae;border-radius:10px;padding:.5rem .7rem;color:#7c5a10}
.rp-kpis{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:.6rem 0 0}.rp-kpis span{background:#f7f8fb;border:1px solid #e5e8ef;border-radius:10px;padding:.35rem .6rem;font-size:.9rem}.rp-kpis span b{color:#0f2a4e;font-size:1.05rem;margin-inline-end:.25rem}.rp-kpis span.b{background:#e0f2fe}.rp-kpis small{color:#64748b}
.rp-secs{display:flex;gap:.35rem;flex-wrap:wrap;margin:.8rem 0}.rp-secs button,.rp-filters button{font:inherit;font-size:.86rem;font-weight:700;padding:.4rem .7rem;border-radius:999px;border:1px solid #cfd6e2;background:#fff;color:#334155;cursor:pointer}.rp-secs button.on,.rp-filters button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.rp-filters{display:flex;gap:.35rem;flex-wrap:wrap;margin-top:.6rem}
.rp-ai{background:#f3fbfa;border-color:#b9e6e1}.rp-phr{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.4rem}.rp-phr li{display:flex;justify-content:space-between;gap:.6rem;align-items:center;background:#fff;border:1px dashed #9fd6cf;border-radius:10px;padding:.45rem .7rem;color:#334155}
.rp-sec h2{margin:0 0 .6rem;color:#0f2a4e;font-size:1.15rem}.rp-sec h3{margin:1rem 0 .4rem;color:#0b8a83;font-size:1rem}.rp-t{width:100%;border-collapse:collapse;font-size:.92rem}.rp-t th,.rp-t td{border:1px solid #e5e8ef;padding:.35rem .45rem;vertical-align:top;text-align:start}.rp-t thead th{background:#f1f5f9;color:#0f2a4e;font-weight:800}.rp-t tbody th{background:#f8fafc;font-weight:700;color:#0f2a4e;white-space:nowrap}.rp-t td input,.rp-t td select,.rp-t td textarea{min-width:90px}
.rp-students td input[type=number]{width:64px;text-align:center}.rp-scroll{overflow:auto}.rp-x{border:0;background:#fee2e2;color:#b42318;border-radius:8px;width:26px;height:26px;cursor:pointer;font-weight:900}.rp-pick{max-width:360px;margin-top:.4rem}.rp-q{margin:.6rem 0 0;font-weight:700;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.rp-q select{max-width:240px}
.rp-check{display:flex;gap:.5rem;align-items:center;font-weight:700;margin:.4rem 0 .6rem}.rp-check input{width:auto}.rp-nav{display:flex;justify-content:space-between;align-items:center;margin:.8rem 0 1.2rem;color:#64748b}
.rp-lines ul{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}.rp-lines li{background:#f3fbfa;border:1px solid #b9e6e1;border-radius:12px;padding:.6rem .8rem}.rp-lines li p{margin:.25rem 0;font-size:1.02rem;line-height:1.8}.rp-lines small{color:#64748b}
@media (max-width:720px){.rp-t{font-size:.85rem}.rp-head-top{flex-direction:column}}
`;
const PRINT_CSS = `
.pr{max-width:1000px;margin:0 auto;padding:1rem}.pr-bar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem}.pr-bar small{color:#64748b}
.pr-page{background:#fff;color:#111;border:1px solid #cbd5e1;padding:14mm 12mm;font-size:11.5px;line-height:1.55;font-family:inherit}
.pr-head{display:flex;justify-content:space-between;gap:1rem;border-bottom:2px solid #0f2a4e;padding-bottom:.5rem;margin-bottom:.8rem}.pr-head h1{margin:0;font-size:18px;color:#0f2a4e}.pr-head p{margin:.1rem 0;color:#334155}.pr-meta{display:grid;gap:.15rem;text-align:start;font-size:10.5px;color:#334155;align-content:start}
.pr-page h2{font-size:13.5px;color:#fff;background:#0f2a4e;padding:.3rem .6rem;margin:1rem 0 .45rem;border-radius:4px;page-break-after:avoid}.pr-page h3{font-size:12px;color:#0f2a4e;margin:.6rem 0 .3rem;page-break-after:avoid}
.pr-page table{width:100%;border-collapse:collapse;margin:0 0 .4rem;page-break-inside:auto}.pr-page th,.pr-page td{border:1px solid #94a3b8;padding:.25rem .4rem;vertical-align:top;text-align:start}.pr-page thead th{background:#e2e8f0;font-weight:800}.pr-page tbody th{background:#f1f5f9;font-weight:700;white-space:nowrap}.pr-page tr{page-break-inside:avoid}
.pr-chk{display:inline-block;margin-inline-end:.6rem;white-space:nowrap}.pr-line{margin:.3rem 0 .6rem;font-weight:700}.pr-stats{columns:2;margin:.2rem 0 .6rem;padding-inline-start:1.2rem}.pr-key{font-size:10.5px;color:#334155;margin:.2rem 0 .3rem}.pr-students td,.pr-students th{text-align:center}.pr-students tbody th{text-align:start}
.pr-sign{margin-top:1rem}.pr-sign td{height:28px}.pr-foot{margin-top:.8rem;border-top:1px solid #94a3b8;padding-top:.4rem;font-size:10.5px;color:#334155;text-align:center}.pr-foot p{margin:.15rem 0}
@media print{@page{size:A4;margin:10mm}body{background:#fff}.pr{max-width:none;padding:0}.pr-bar,.pt-head,.pt-foot,header.pt-header,footer,nav,.way-bar,[data-testid="way-bar"],[data-testid="nadi-fab"],.nadi-fab,.pt-skip{display:none!important}.pr-page{border:0;padding:0}}
`;
