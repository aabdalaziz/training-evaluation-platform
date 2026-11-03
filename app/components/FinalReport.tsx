'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 ر2 «محور التقارير» — التقرير الختامي لأداء المتدرّبين («خاتمة الرحلة»)
 *  <FinalCards>   داخل /me/reports        بطاقة لكل شعبة: «نضج التقرير» (الأسبوعيات المعتمدة ÷ المتوقَّعة) + «ابدأ التقرير الختامي» أو فتحه
 *  <FinalEditor>  /me/reports/[id]        ثمانية أقسام + «سطر لكل متدرّب»: المسار من الأسبوعيات (الفرق لا الدرجة) · التقييم الختامي · التوصية → قرار · توقيعان
 *  <FinalPrint>   داخل المحرّر            نموذج A4 مؤسسي بالأقسام الثمانية وسلسلة الثقة
 *  <MyFinalLine>  /me/reports/line/[id]   صفحة المتدرّب من التقرير الختامي (خاصة افتراضيًا · «أظهِر في شهادتي»)
 *  الذكاء الاصطناعي يصوغ فقرة المسار من الأرقام فقط؛ الحكم والتوصية للمعلّم؛ الاعتماد بتوقيعين.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P46_NAMES_AR, GRADE_KEY_AR, REC_AR, SIGN_AR, TREND_AR, TREND_SIGN, LINE_MAX, PARA_MAX, PROMOTE_MIN, PROMOTE_ATT, SUPPORT_MAX, fmtDayAr, summativeStats, distribution, suggestRec, gradeOf, type Phrase, type Rec, type Trajectory, type FinalComputed, type FinalStudent, type FinalBody } from '../../lib/reports/registry';

type Tok = () => Promise<string>;
async function api(tok: Tok | null, path: string, body?: any) { const tk = tok ? await tok() : ''; const h: any = { 'Content-Type': 'application/json' }; if (tk) h.Authorization = `Bearer ${tk}`; const r = await fetch(path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h, cache: 'no-store' }); return r.json().catch(() => ({ success: false, error: 'استجابة غير صالحة' })); }
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const TONE: Record<string, string> = { draft: 'g', submitted: 'b', approved: 't', returned: 'o' };
const upd = <O,>(o: O, path: (string | number)[], v: any): O => { const c: any = Array.isArray(o) ? [...(o as any)] : { ...(o as any) }; if (path.length === 1) { c[path[0]] = v; return c; } c[path[0]] = upd(c[path[0]] ?? (typeof path[1] === 'number' ? [] : {}), path.slice(1), v); return c; };
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${v}%`);
const sgn = (d: number | null) => (d === null ? '—' : `${d > 0 ? '+' : ''}${d}`);

/* ───────── شريط أفقي HTML (لا SVG — RTL آمن) ───────── */
function Bar({ v, tone = 'n', label }: { v: number | null; tone?: 'n' | 'g' | 'o'; label?: string }) { return <span className={`fr-bar ${tone}`} role="img" aria-label={label || pct(v)}><i style={{ width: `${Math.max(0, Math.min(100, v ?? 0))}%` }} /><b>{pct(v)}</b></span>; }
/** مسار صغير: الأسابيع كأعمدة متتالية */
function Spark({ vals, final }: { vals: (number | null)[]; final?: number | null }) { const all = [...vals, ...(final !== undefined ? [final] : [])]; return <span className="fr-spark" aria-hidden="true">{all.map((v, i) => <i key={i} className={i === all.length - 1 && final !== undefined ? 'f' : ''} style={{ height: `${Math.max(4, Math.min(100, v ?? 0))}%` }} title={pct(v)} />)}</span>; }

/* ───────── 1) بطاقات «التقرير الختامي» في تقاريري ───────── */
export function FinalCards({ finals, token }: { finals: any[]; token: Tok }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  if (!finals || !finals.length) return null;
  async function start(c: any) { setBusy(c.classroom_id); setErr(''); const j = await api(token, '/api/reports', { action: 'create_final', program_id: c.program_id, classroom_id: c.classroom_id || null }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } window.location.href = `/me/reports/${j.report.id}`; }
  return <section className="pt-box fr-cards" aria-labelledby="fr-cards-h" data-testid="fr-cards"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="fr-cards-h"><Icon name="trend" size={18} /> {P46_NAMES_AR.final} <small className="fr-story">«{P46_NAMES_AR.final_story}»</small></h2>
    <p className="pt-muted">لا يُكتب في الأسبوع الأخير: كل تقرير أسبوعي يُعتمد يضيف فصلًا إلى مسار كل متدرّب، وحين تنضج الشعبة يبقى عليك الحكم الختامي والتوصية فقط. عنوانه «الفرق لا الدرجة».</p>
    {err && <p className="fr-err" role="alert">{err}</p>}
    <ul className="fr-cardl">{finals.map(c => <li key={c.classroom_id} data-testid="fr-card" data-suggested={c.suggested ? '1' : '0'}>
      <div className="fr-cardh"><b>{c.program_ar}</b><span>{c.classroom_ar}{c.level ? ` · ${c.level}` : ''}</span></div>
      <div className="fr-mat"><span>{P46_NAMES_AR.maturity}: <b data-testid="fr-maturity">{c.maturity.approved}/{c.maturity.expected}</b> أسابيع معتمدة</span><Bar v={c.maturity.pct} tone={c.maturity.pct >= 75 ? 'g' : 'n'} label={`نضج ${c.maturity.pct}%`} />{c.progress_pct !== null && <small>{c.progress_pct}% من مدّة البرنامج</small>}</div>
      <div className="fr-cardf">
        {c.final_id ? <Link className="pt-btn navy small" href={`/me/reports/${c.final_id}`} data-testid="fr-open">افتح التقرير الختامي · {c.final_status === 'approved' ? 'معتمَد' : c.final_status === 'submitted' ? 'بانتظار التوقيعين' : c.final_status === 'returned' ? 'أُعيد' : 'مسودّة'}</Link>
          : <button type="button" className={`pt-btn small ${c.suggested ? 'gold' : 'ghost'}`} onClick={() => start(c)} disabled={busy === c.classroom_id} data-testid="fr-start">{busy === c.classroom_id ? '…' : P46_NAMES_AR.final_start}</button>}
        {!c.final_id && !c.suggested && <small className="pt-muted">يُقترح البدء عند 75% من المدّة أو أسبوعيتين معتمدتين — ويمكنك البدء الآن.</small>}
        {!c.final_id && c.suggested && <small className="fr-ready" data-testid="fr-ready">جاهز للنموّ — {c.approved_weeks} أسابيع معتمدة تغذّيه</small>}
      </div>
    </li>)}</ul>
  </section>;
}

/* ───────── 2) المحرّر ───────── */
export function FinalEditor({ id, token, mode = 'author', onBack }: { id: string; token: Tok; mode?: 'author' | 'admin'; onBack?: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [dirty, setDirty] = useState(false);
  const [body, setBody] = useState<FinalBody | null>(null); const [students, setStudents] = useState<FinalStudent[]>([]); const [lines, setLines] = useState<Record<string, string>>({}); const [linesOk, setLinesOk] = useState(false);
  const [sec, setSec] = useState(1); const [print, setPrint] = useState(false); const [phr, setPhr] = useState<{ phrases: Phrase[]; note_ar: string } | null>(null); const [retNote, setRetNote] = useState(''); const [view, setView] = useState('avg'); const [sort, setSort] = useState<'delta' | 'name'>('delta'); const [grp, setGrp] = useState<Rec | ''>(''); const [target, setTarget] = useState(''); const [programs, setPrograms] = useState<any[]>([]);
  const load = useCallback(async () => { const j = await api(token, `/api/reports?id=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setBody(j.report.body); setStudents(j.report.students || []); setLines(Object.fromEntries((j.report.lines || []).map((l: any) => [l.key, l.text]))); setLinesOk(!!j.report.lines_ok); setDirty(false); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (d?.report?.can_promote && !programs.length) api(token, '/api/reports').then(j => { if (j?.success) setPrograms((j.scope?.programs || []).filter((p: any) => p.id !== d.report.program_id)); }); }, [d, programs.length, token]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const r = d?.report; const c: FinalComputed | null = r?.computed || null; const skills = c?.skills || []; const editable = !!r?.can_edit; const ro = !editable;
  const setB = (path: (string | number)[], v: any) => { setBody(b => (b ? upd(b, path, v) : b)); setDirty(true); };
  const setS = (key: string, patch: Partial<FinalStudent> | ((s: FinalStudent) => Partial<FinalStudent>)) => { setStudents(ss => ss.map(s => (s.key === key ? { ...s, ...(typeof patch === 'function' ? patch(s) : patch) } : s))); setDirty(true); };
  const live = useMemo(() => students.map(s => { const vals = skills.map(k => s.scores?.[k.code]).filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v)); const avg = vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null; return { ...s, avg, grade_ar: gradeOf(avg)?.ar || null }; }), [students, skills]);
  const stats = useMemo(() => summativeStats(live), [live]); const dist = useMemo(() => distribution(live), [live]);
  const tj = useCallback((key: string): Trajectory | null => (c?.trajectory || []).find(t => t.key === key) || null, [c]);
  const ordered = useMemo(() => [...live].sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name, 'ar') : ((tj(b.key)?.delta ?? -999) - (tj(a.key)?.delta ?? -999)))), [live, sort, tj]);
  async function save(silent = false): Promise<boolean> { if (!body) return false; setBusy('save'); setErr(''); if (!silent) setOk(''); const j = await api(token, '/api/reports', { action: 'save', id, body, students: live, lines: Object.entries(lines).map(([key, text]) => ({ key, text })), lines_ok: linesOk }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل الحفظ'); return false; } setD((x: any) => ({ ...x, report: j.report })); setDirty(false); if (!silent) setOk('حُفظ'); return true; }
  async function act(action: string, extra: any = {}) { setBusy(action + (extra.as || '')); setErr(''); setOk(''); if (dirty && ['submit', 'recompute'].includes(action)) { const s = await save(true); if (!s) { setBusy(''); return; } } const j = await api(token, '/api/reports', { action, id, ...extra }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); setOk(action === 'submit' ? 'أُرسل — بانتظار توقيع الجودة ومدير البرنامج' : action === 'approve' ? (j.verify_code ? `اكتمل الاعتماد — رمز التحقّق ${j.verify_code}${j.lines_sent ? ` · أُرسل ${j.lines_sent} سطرًا للمتدرّبين` : ''}` : `وُقِّع (${SIGN_AR[j.signed as 'quality' | 'manager']}) — يبقى ${SIGN_AR[j.pending as 'quality' | 'manager']}`) : action === 'return' ? 'أُعيد بملاحظة' : action === 'recompute' ? 'حُدِّثت الأرقام والمسارات من أَثَر' : action === 'promote' ? `أُنشئ ${j.created} تسجيلًا معلَّقًا في «${j.program_ar}»${j.skipped ? ` · تُخطّي ${j.skipped} (مسجَّل من قبل)` : ''}` : 'تم'); }
  async function phrase() { setBusy('phrase'); setErr(''); const j = await api(token, '/api/reports', { action: 'phrase', id }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } setPhr({ phrases: j.phrases || [], note_ar: j.note_ar || '' }); }
  function adopt(p: Phrase) { if (!body) return; const add = (cur: string) => (cur ? cur + ' ' + p.text : p.text); if (p.section === 'strengths') setB(['strengths', 'strengths'], [...body.strengths.strengths, { point: p.text, evidence: 'من أرقام التقرير' }]); else if (p.section === 'challenges') setB(['strengths', 'challenges'], [...body.strengths.challenges, { point: p.text, action: '' }]); else if (p.section === 'admin_attendance') setB(['admin', 'attendance'], add(body.admin.attendance)); else if (p.section === 'common_errors') setB(['summary', 'trajectory_note'], add(body.summary.trajectory_note)); else setB(['summary', 'overview'], add(body.summary.overview)); setPhr(x => (x ? { ...x, phrases: x.phrases.filter(q => q !== p) } : x)); }
  async function paragraph(s: FinalStudent) { setBusy('para' + s.key); setErr(''); const j = await api(token, '/api/reports', { action: 'paragraph', id, key: s.key, student: { avg: s.avg, scores: s.scores } }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } setS(s.key, { paragraph: String(j.text || '').slice(0, PARA_MAX) }); setOk(j.note_ar || ''); }
  function suggestAll(onlyEmpty: boolean) { setStudents(ss => ss.map(s => { if (onlyEmpty && s.rec) return s; const vals = skills.map(k => s.scores?.[k.code]).filter((v): v is number => v !== null && v !== undefined); const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; const rec = suggestRec(avg, tj(s.key)?.last ?? null, s.attendance_pct); return rec ? { ...s, rec, reason: s.reason || `اقتراح آلي: ${avg !== null ? `التقييم الختامي ${Math.round(avg)}%` : `آخر أسبوع ${tj(s.key)?.last ?? '—'}%`} · الحضور ${pct(s.attendance_pct)}` } : s; })); setDirty(true); }
  function applyGroup() { if (!grp) return; setStudents(ss => ss.map(s => (s.rec ? s : { ...s, rec: grp }))); setDirty(true); }
  if (!d || !body || !c) return <main className="pt-main fr"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const S = d.status_ar; const SECS = ['البيانات العامة', 'ملخّص البرنامج', 'مصفوفة التقدّم', 'النتائج الختامية', 'التوصيات والقرارات', 'القوة والتحدّيات', 'الملاحظات الإدارية', 'الاعتماد', 'سطر لكل متدرّب'];
  const inp = (path: (string | number)[], v: string, ph = '', max = 600, rows = 0) => rows ? <textarea value={v} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} rows={rows} maxLength={max} readOnly={ro} /> : <input value={v} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} maxLength={max} readOnly={ro} />;
  const weeks = c.weeks || []; const so = r.signoff || {}; const title = `${c.program_ar}${c.classroom_ar ? ` — ${c.classroom_ar}` : ''}`;
  if (print) return <FinalPrint r={{ ...r, body, students: live }} onClose={() => setPrint(false)} />;
  return <main className="pt-main fr fr-ed" data-testid="fr-editor" data-status={r.status}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box fr-head">
      <div className="fr-head-top">
        <div><span className="pt-kicker"><Icon name="trend" size={14} /> {P46_NAMES_AR.final} · «{P46_NAMES_AR.final_story}»</span>{mode === 'admin' ? <h2 className="fr-h">{title}</h2> : <h1>{title}</h1>}<p className="pt-muted">{c.program_from ? `${fmtDayAr(c.program_from)} → ${c.program_to ? fmtDayAr(c.program_to) : '…'}` : ''} · {c.trainer_ar}{c.org_ar ? ` · ${c.org_ar}` : ''} · <span className={`fr-chip ${TONE[r.status]}`} data-testid="fr-status">{S[r.status]}</span></p></div>
        <div className="fr-actions">
          {onBack ? <button className="pt-btn ghost small" type="button" onClick={onBack}><Icon name="arrow" size={14} /> القائمة</button> : <Link className="pt-btn ghost small" href="/me/reports"><Icon name="arrow" size={14} /> تقاريري</Link>}
          <button className="pt-btn ghost small" type="button" onClick={() => setPrint(true)} data-testid="fr-print"><Icon name="print" size={14} /> معاينة الطباعة</button>
          {editable && <button className="pt-btn ghost small" type="button" onClick={() => act('recompute')} disabled={!!busy} data-testid="fr-recompute"><Icon name="refresh" size={14} /> {P46_NAMES_AR.recompute}</button>}
          {editable && <button className="pt-btn navy small" type="button" onClick={() => save()} disabled={!!busy || !dirty} data-testid="fr-save"><Icon name="save" size={14} /> {busy === 'save' ? '…' : dirty ? 'احفظ' : 'محفوظ'}</button>}
          {editable && mode === 'author' && <button className="pt-btn gold small" type="button" onClick={() => act('submit')} disabled={!!busy} data-testid="fr-submit"><Icon name="send" size={14} /> {P46_NAMES_AR.submit}</button>}
          {r.can_sign_quality && <button className="pt-btn gold small" type="button" onClick={() => act('approve', { as: 'quality' })} disabled={!!busy} data-testid="fr-sign-quality"><Icon name="check" size={14} /> {P46_NAMES_AR.sign_quality}</button>}
          {r.can_sign_manager && <button className="pt-btn gold small" type="button" onClick={() => act('approve', { as: 'manager' })} disabled={!!busy} data-testid="fr-sign-manager"><Icon name="check" size={14} /> {P46_NAMES_AR.sign_manager}</button>}
        </div>
      </div>
      {r.can_return && <div className="fr-return"><input value={retNote} onChange={e => setRetNote(e.target.value.slice(0, 400))} placeholder="ملاحظة الإعادة للمعلّم…" data-testid="fr-return-note" /><button className="pt-btn ghost small" type="button" onClick={() => act('return', { note: retNote })} disabled={!!busy || retNote.trim().length < 3} data-testid="fr-return"><Icon name="arrow" size={14} /> {P46_NAMES_AR.return}</button></div>}
      {r.status === 'returned' && r.return_note && <p className="fr-retbox" data-testid="fr-returned">أُعيد بملاحظة: {r.return_note}</p>}
      {r.status === 'submitted' && <p className="fr-signbox" data-testid="fr-signs">التوقيعان: الجودة {so.quality ? `✓ ${so.quality.name}` : '— بانتظار'} · مدير البرنامج {so.manager ? `✓ ${so.manager.name}` : '— بانتظار'}</p>}
      {r.status === 'approved' && <p className="fr-okbox" data-testid="fr-approved">معتمَد بتوقيعين · {fmtT(r.approved_at)} · رمز التحقّق <b dir="ltr">{r.verify_code}</b> · <Link href={`/verify/report/${r.verify_code}`}>صفحة التحقّق</Link>{r.lines_sent_at ? ' · أُرسلت الأسطر للمتدرّبين' : ''}</p>}
      {editable && r.missing?.length > 0 && <p className="fr-missing" data-testid="fr-missing">قبل الإرسال يلزم: {r.missing.join(' · ')}</p>}
      <div className="fr-kpis" data-testid="fr-kpis"><span><b>{c.enrolled}</b> مسجَّلًا</span><span><b>{c.regular}</b> منتظمًا</span><span><b>{c.sessions}</b> جلسة</span><span><b>{c.hours}</b> ساعة</span><span className="b"><b data-testid="fr-weeks">{weeks.length}</b> أسابيع معتمدة</span><span><b>{stats.n ? `${stats.avg}%` : '—'}</b> متوسط الختامي</span><small>من أَثَر · {fmtT(c.computed_at)}</small></div>
      <div className="fr-mat fr-mat-ed"><span>{P46_NAMES_AR.maturity}: <b>{c.maturity.approved}/{c.maturity.expected}</b></span><Bar v={c.maturity.pct} tone={c.maturity.pct >= 75 ? 'g' : 'n'} label={`نضج ${c.maturity.pct}%`} />{c.progress_pct !== null && <small>{c.progress_pct}% من المدّة</small>}</div>
      <nav className="fr-secs" aria-label="أقسام التقرير">{SECS.map((s, i) => <button key={s} type="button" className={sec === i + 1 ? 'on' : ''} onClick={() => setSec(i + 1)} data-testid={`fr-sec-${i + 1}`}>{i + 1}. {s}</button>)}</nav>
    </section>

    {sec === 1 && <section className="pt-box fr-sec" data-testid="fr-s1"><h2>١. البيانات العامة</h2>
      <table className="fr-t"><tbody>
        <tr><th>اسم البرنامج</th><td>{c.program_ar}</td><th>الجهة / المعهد</th><td>{inp(['general', 'institution'], body.general.institution, 'اسم الجهة', 160)}</td></tr>
        <tr><th>المستوى</th><td>{inp(['general', 'level'], body.general.level, 'المستوى', 160)}</td><th>الشعبة</th><td>{inp(['general', 'group'], body.general.group, 'الشعبة', 160)}</td></tr>
        <tr><th>عضو هيئة التدريس</th><td>{c.trainer_ar}</td><th>مدّة البرنامج</th><td>{inp(['general', 'duration'], body.general.duration, 'من … إلى … · الجلسات · الساعات', 160)}</td></tr>
        <tr><th>نمط التنفيذ</th><td>{c.delivery_ar || '—'}</td><th>الأسبوعيات المعتمدة</th><td>{weeks.length ? weeks.map(w => `الأسبوع ${w.week_no}`).join(' · ') : 'لا أسبوعيات معتمدة بعد — يمكن إكمال الختامي من التقييم الختامي وحده'}</td></tr>
        <tr><th>ملاحظات</th><td colSpan={3}>{inp(['general', 'notes'], body.general.notes, '', 600, 2)}</td></tr>
      </tbody></table></section>}

    {sec === 2 && <section className="pt-box fr-sec" data-testid="fr-s2"><h2>٢. ملخّص البرنامج</h2>
      <p className="pt-muted">ما الذي جرى في البرنامج كلّه؟ المسارات والأرقام أدناه من أَثَر، والحكم لك.</p>
      <label className="fr-lbl">نظرة عامة على البرنامج والتعلّم{inp(['summary', 'overview'], body.summary.overview, 'بدأت المجموعة من… وانتهت إلى…', 1200, 4)}</label>
      <label className="fr-lbl">الحضور والانتظام{inp(['summary', 'attendance_note'], body.summary.attendance_note, `انتظم ${c.regular} من ${c.enrolled} في ${c.sessions} جلسة…`, 600, 2)}</label>
      <label className="fr-lbl">قراءة المسارات (الفرق لا الدرجة){inp(['summary', 'trajectory_note'], body.summary.trajectory_note, 'أكبر تقدّم كان في مهارة… وأبطأه في…', 600, 2)}</label>
      <div className="fr-ai"><button type="button" className="pt-btn ghost small" onClick={phrase} disabled={busy === 'phrase'} data-testid="fr-phrase"><Icon name="spark" size={14} /> {busy === 'phrase' ? '…' : P46_NAMES_AR.phrase}</button><small className="pt-muted">يصوغ جملًا من أرقام البرنامج فقط — لا تقدير ولا توصية — وتختار أنت ما تعتمده.</small>
        {phr && <ul className="fr-phr" data-testid="fr-phrases">{phr.phrases.map((p, i) => <li key={i}><span>{p.text}</span>{editable && <button type="button" className="pt-btn gold small" onClick={() => adopt(p)}>اعتمد</button>}</li>)}{phr.phrases.length === 0 && <li className="pt-muted">لا جمل بعد — أدخل درجات أولًا.</li>}<small>{phr.note_ar}</small></ul>}
      </div></section>}

    {sec === 3 && <section className="pt-box fr-sec" data-testid="fr-s3"><h2>٣. مصفوفة التقدّم — «الفرق لا الدرجة»</h2>
      <div className="fr-row"><label>العرض <select value={view} onChange={e => setView(e.target.value)} data-testid="fr-view"><option value="avg">المتوسط العام</option>{skills.map(k => <option key={k.code} value={k.code}>{k.name_ar}</option>)}</select></label><label>الترتيب <select value={sort} onChange={e => setSort(e.target.value as any)} data-testid="fr-sort"><option value="delta">حسب مقدار التقدّم</option><option value="name">حسب الاسم</option></select></label><small className="pt-muted">القيم من التقارير الأسبوعية المعتمدة؛ العمود الأخير التقييم الختامي إن أُدخل.</small></div>
      {weeks.length === 0 && <p className="fr-note" data-testid="fr-noweeks">لا أسبوعيات معتمدة لهذه الشعبة بعد — المصفوفة تُملأ تلقائيًا كلّما اعتُمد تقرير أسبوعي.</p>}
      <div className="fr-scroll"><table className="fr-t fr-mx" data-testid="fr-matrix"><thead><tr><th>المتدرّب</th>{weeks.map(w => <th key={w.id}>أ{w.week_no}</th>)}<th>الختامي</th><th>المسار</th><th>الفرق</th><th>الاتجاه</th><th>الحضور</th></tr></thead><tbody>
        {ordered.map(s => { const t = tj(s.key); const vals = t ? (view === 'avg' ? t.avgs : (t.skills[view] || [])) : []; const fin = view === 'avg' ? s.avg : (s.scores?.[view] ?? null); return <tr key={s.key} data-testid="fr-mx-row"><th>{s.name}</th>{weeks.map((w, i) => <td key={w.id}>{pct(vals[i] ?? null)}</td>)}<td><b>{pct(fin)}</b></td><td><Spark vals={vals} final={fin} /></td><td className={t?.delta !== null && t?.delta !== undefined ? (t.delta > 0 ? 'up' : t.delta < 0 ? 'down' : '') : ''}>{sgn(t?.delta ?? null)}</td><td>{t?.trend ? `${TREND_SIGN[t.trend]} ${TREND_AR[t.trend]}` : '—'}</td><td><Bar v={s.attendance_pct} tone={s.attendance_pct !== null && s.attendance_pct < 75 ? 'o' : 'n'} /></td></tr>; })}
      </tbody></table></div>
      <p className="pt-muted">أ = أسبوع معتمَد. الفرق = آخر متوسط − أوّل متوسط. يُرتَّب المتدرّبون افتراضيًا حسب التقدّم لا حسب الدرجة.</p></section>}

    {sec === 4 && <section className="pt-box fr-sec" data-testid="fr-s4"><h2>٤. النتائج الختامية</h2>
      <p className="fr-key">{GRADE_KEY_AR}</p>
      <div className="fr-scroll"><table className="fr-t fr-students" data-testid="fr-results"><thead><tr><th>المتدرّب</th><th>آخر أسبوع</th>{skills.map(k => <th key={k.code}>{k.name_ar}</th>)}<th>المتوسط</th><th>التقدير</th><th>ملاحظة</th></tr></thead><tbody>
        {live.map(s => <tr key={s.key} data-testid="fr-student"><th>{s.name}</th><td>{pct(tj(s.key)?.last ?? null)}</td>{skills.map(k => <td key={k.code}><input type="number" min={0} max={100} value={s.scores?.[k.code] ?? ''} onChange={e => setS(s.key, x => ({ scores: { ...x.scores, [k.code]: e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))) } }))} readOnly={ro} aria-label={`${s.name} — ${k.name_ar}`} /></td>)}<td><b>{pct(s.avg)}</b></td><td>{s.grade_ar || '—'}</td><td><input value={s.note || ''} onChange={e => setS(s.key, { note: e.target.value.slice(0, 160) })} readOnly={ro} aria-label={`ملاحظة ${s.name}`} /></td></tr>)}
      </tbody></table></div>
      <div className="fr-dist" data-testid="fr-dist">{dist.map(g => <span key={g.code}><b>{g.n}</b> {g.ar}</span>)}<span className="t"><b>{stats.n ? `${stats.pass_pct}%` : '—'}</b> بلغوا حدّ النجاح</span></div>
      <label className="fr-lbl">أدوات التقييم الختامي{inp(['results', 'tools'], body.results.tools, 'اختبار ختامي · مهمة أدائية · مقابلة شفهية…', 600, 2)}</label>
      <label className="fr-lbl">قراءة النتائج{inp(['results', 'note'], body.results.note, '', 600, 2)}</label></section>}

    {sec === 5 && <section className="pt-box fr-sec" data-testid="fr-s5"><h2>٥. التوصيات والقرارات</h2>
      <p className="pt-muted">القاعدة المقترحة: متوسط ≥ {PROMOTE_MIN}% وحضور ≥ {PROMOTE_ATT}% → رفع · أقل من {SUPPORT_MAX}% → خطة دعم · وإلا استمرار. «إعادة المستوى» قرار إنسان لا يُقترح آليًا. تبدّل أيّ توصية بحرّية.</p>
      {editable && <div className="fr-row"><button type="button" className="pt-btn ghost small" onClick={() => suggestAll(true)} data-testid="fr-suggest">اقترح للفارغين</button><button type="button" className="pt-btn ghost small" onClick={() => suggestAll(false)}>أعد الاقتراح للجميع</button><span className="fr-grp"><select value={grp} onChange={e => setGrp(e.target.value as Rec | '')} data-testid="fr-grp"><option value="">تطبيق جماعي…</option>{(Object.keys(REC_AR) as Rec[]).map(k => <option key={k} value={k}>{REC_AR[k]}</option>)}</select><button type="button" className="pt-btn navy small" onClick={applyGroup} disabled={!grp} data-testid="fr-grp-apply">طبّق على من بلا توصية</button></span></div>}
      <div className="fr-scroll"><table className="fr-t" data-testid="fr-recs"><thead><tr><th>المتدرّب</th><th>الختامي</th><th>الفرق</th><th>الحضور</th><th>التوصية</th><th>السبب / الخطة</th></tr></thead><tbody>
        {live.map(s => <tr key={s.key} data-testid="fr-rec-row" data-rec={s.rec || ''}><th>{s.name}</th><td>{pct(s.avg)} {s.grade_ar ? <small>({s.grade_ar})</small> : null}</td><td>{sgn(tj(s.key)?.delta ?? null)}</td><td>{pct(s.attendance_pct)}</td><td><select value={s.rec} onChange={e => setS(s.key, { rec: e.target.value as Rec | '' })} disabled={ro} aria-label={`توصية ${s.name}`} data-testid="fr-rec"><option value="">—</option>{(Object.keys(REC_AR) as Rec[]).map(k => <option key={k} value={k}>{REC_AR[k]}</option>)}</select></td><td><input value={s.reason} onChange={e => setS(s.key, { reason: e.target.value.slice(0, 600) })} readOnly={ro} placeholder={s.rec === 'support' ? 'ما المهارة؟ ما الإجراء؟ من المسؤول؟' : ''} aria-label={`سبب ${s.name}`} /></td></tr>)}
      </tbody></table></div>
      <div className="fr-grid2"><label className="fr-lbl">المستوى التالي المقترح للمرفوعين{inp(['recommendations', 'next_level'], body.recommendations.next_level, 'مثال: المستوى الثاني (A2)', 160)}</label><label className="fr-lbl">توصية على مستوى المجموعة{inp(['recommendations', 'group_note'], body.recommendations.group_note, '', 600, 2)}</label></div>
      <label className="fr-lbl">ملاحظة للإدارة{inp(['recommendations', 'admin_note'], body.recommendations.admin_note, '', 600, 2)}</label>
      <p className="fr-note">بعد الاعتماد يستطيع الطاقم بضغطة واحدة تحويل توصيات «الرفع» إلى تسجيلات معلَّقة في برنامج المستوى التالي — ويبقى القبول قرار إنسان (القسم ٨).</p></section>}

    {sec === 6 && <section className="pt-box fr-sec" data-testid="fr-s6"><h2>٦. نقاط القوة والتحدّيات عبر البرنامج</h2>
      <p className="pt-muted">جُمعت من تقاريرك الأسبوعية المعتمدة — راجعها واحذف أو أضف.</p>
      <h3>نقاط القوة</h3><table className="fr-t"><thead><tr><th>النقطة</th><th>الشاهد</th><th /></tr></thead><tbody>{body.strengths.strengths.map((s, i) => <tr key={i}><td>{inp(['strengths', 'strengths', i, 'point'], s.point)}</td><td>{inp(['strengths', 'strengths', i, 'evidence'], s.evidence)}</td><td>{editable && <button type="button" className="fr-x" aria-label="حذف" onClick={() => setB(['strengths', 'strengths'], body.strengths.strengths.filter((_, j) => j !== i))}>×</button>}</td></tr>)}</tbody></table>
      {editable && body.strengths.strengths.length < 8 && <button type="button" className="pt-btn ghost small" onClick={() => setB(['strengths', 'strengths'], [...body.strengths.strengths, { point: '', evidence: '' }])} data-testid="fr-add-strength"><Icon name="plus" size={14} /> نقطة قوة</button>}
      <h3>التحدّيات</h3><table className="fr-t"><thead><tr><th>التحدّي</th><th>ما فُعل / يُقترح</th><th /></tr></thead><tbody>{body.strengths.challenges.map((s, i) => <tr key={i}><td>{inp(['strengths', 'challenges', i, 'point'], s.point)}</td><td>{inp(['strengths', 'challenges', i, 'action'], s.action)}</td><td>{editable && <button type="button" className="fr-x" aria-label="حذف" onClick={() => setB(['strengths', 'challenges'], body.strengths.challenges.filter((_, j) => j !== i))}>×</button>}</td></tr>)}</tbody></table>
      {editable && body.strengths.challenges.length < 8 && <button type="button" className="pt-btn ghost small" onClick={() => setB(['strengths', 'challenges'], [...body.strengths.challenges, { point: '', action: '' }])}><Icon name="plus" size={14} /> تحدٍّ</button>}</section>}

    {sec === 7 && <section className="pt-box fr-sec" data-testid="fr-s7"><h2>٧. الملاحظات الإدارية</h2>
      <label className="fr-lbl">الحضور والالتزام{inp(['admin', 'attendance'], body.admin.attendance, '', 600, 2)}</label><label className="fr-lbl">الانضباط{inp(['admin', 'discipline'], body.admin.discipline, '', 600, 2)}</label><label className="fr-lbl">البيئة والتجهيزات{inp(['admin', 'environment'], body.admin.environment, '', 600, 2)}</label><label className="fr-lbl">أخرى{inp(['admin', 'other'], body.admin.other, '', 600, 2)}</label></section>}

    {sec === 8 && <section className="pt-box fr-sec" data-testid="fr-s8"><h2>٨. الاعتماد — توقيعان</h2>
      <table className="fr-t"><tbody>
        <tr><th>عضو هيئة التدريس</th><td>{r.author_name || r.author_email}</td><td>{r.submitted_at ? `أرسل ${fmtT(r.submitted_at)}` : 'لم يُرسل بعد'}</td></tr>
        <tr><th>{SIGN_AR.quality}</th><td>{so.quality?.name || '—'}</td><td>{so.quality ? fmtT(so.quality.at) : 'بانتظار التوقيع'}</td></tr>
        <tr><th>{SIGN_AR.manager}</th><td>{so.manager?.name || '—'}</td><td>{so.manager ? fmtT(so.manager.at) : 'بانتظار التوقيع'}</td></tr>
      </tbody></table>
      <p className="pt-muted">التوقيع الثاني يلزم أن يكون من شخص غير الأوّل (إلا مدير المنصة). بالتوقيع الثاني يُعتمد التقرير ويصدر رمز التحقّق وتُرسل الأسطر للمتدرّبين إن أذنت.</p>
      {weeks.length > 0 && <p className="fr-chain" data-testid="fr-chain"><Icon name="shield" size={14} /> {P46_NAMES_AR.chain}: يستند هذا التقرير إلى {weeks.length} تقارير أسبوعية معتمدة — {weeks.map(w => <Link key={w.id} href={`/verify/report/${w.verify_code}`} dir="ltr">{w.verify_code}</Link>)}</p>}
      {r.can_promote && <div className="fr-promote" data-testid="fr-promote"><h3><Icon name="send" size={16} /> {P46_NAMES_AR.promote_btn}</h3><p>المرشَّحون للرفع ({live.filter(s => s.rec === 'promote').length}) يُسجَّلون <b>معلَّقين</b> في برنامج الهدف باسم هذا التقرير، ثم يقبلهم الطاقم من مسار القبول المعتاد (الإنسان يعتمد).</p>
        <div className="fr-row"><select value={target} onChange={e => setTarget(e.target.value)} data-testid="fr-target"><option value="">برنامج الهدف…</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select><button type="button" className="pt-btn gold small" onClick={() => act('promote', { program_id: target })} disabled={!target || !!busy || !live.some(s => s.rec === 'promote')} data-testid="fr-promote-btn">حوّل الآن</button></div></div>}
      {body.promotion?.at && <p className="fr-okbox" data-testid="fr-promoted">حُوِّلت التوصيات {fmtT(body.promotion.at)} بواسطة {body.promotion.by}: {body.promotion.created} تسجيلًا معلَّقًا في «{body.promotion.program_ar}»{body.promotion.skipped ? ` · ${body.promotion.skipped} مسجَّل من قبل` : ''} · <Link href={`/admin/enrollments?program=${body.promotion.program_id}`}>طلبات القبول</Link></p>}</section>}

    {sec === 9 && <section className="pt-box fr-sec" data-testid="fr-s9"><h2>٩. {P46_NAMES_AR.final_line}</h2>
      <p className="pt-muted">لكل متدرّب صفحته الخاصة من هذا التقرير: فقرة مساره (يصوغها الذكاء الاصطناعي من أرقامه فقط وتعتمدها أنت) وسطرٌ بخطّك له وحده. تُرسل بعد اكتمال التوقيعين وبإذنك. خاصة افتراضيًا، ويختار هو إظهارها في شهادته.</p>
      <ul className="fr-para" data-testid="fr-lines">{live.map(s => { const t = tj(s.key); return <li key={s.key} data-testid="fr-line-row"><div className="fr-parah"><b>{s.name}</b><small>{t?.weeks.length ? `${t.weeks.length} أسابيع · الفرق ${sgn(t.delta)}` : 'بلا أسبوعيات'} · الختامي {pct(s.avg)}{s.rec ? ` · ${REC_AR[s.rec]}` : ''}</small>{editable && <button type="button" className="pt-btn ghost small" onClick={() => paragraph(s)} disabled={busy === 'para' + s.key} data-testid="fr-para-btn"><Icon name="spark" size={14} /> {busy === 'para' + s.key ? '…' : 'صِغ فقرة المسار'}</button>}</div>
        <textarea value={s.paragraph || ''} onChange={e => setS(s.key, { paragraph: e.target.value.slice(0, PARA_MAX) })} placeholder="فقرة المسار (تظهر في صفحة المتدرّب وفي التقرير المطبوع)" rows={2} maxLength={PARA_MAX} readOnly={ro} aria-label={`فقرة ${s.name}`} data-testid="fr-para" />
        {s.email ? <input value={lines[s.key] || ''} onChange={e => { setLines(l => ({ ...l, [s.key]: e.target.value.slice(0, LINE_MAX) })); setDirty(true); }} placeholder="سطر بخطّك له وحده…" maxLength={LINE_MAX} readOnly={ro} aria-label={`سطر ${s.name}`} data-testid="fr-line" /> : <small className="pt-muted">بلا بريد — لا يمكن إرسال سطر.</small>}</li>; })}</ul>
      <label className="fr-check"><input type="checkbox" checked={linesOk} onChange={e => { setLinesOk(e.target.checked); setDirty(true); }} disabled={ro} data-testid="fr-lines-ok" /> أأذن بإرسال الأسطر والفقرات إلى أصحابها بعد الاعتماد</label></section>}

    <div className="fr-nav"><button type="button" className="pt-btn ghost small" onClick={() => setSec(s => Math.max(1, s - 1))} disabled={sec === 1}><Icon name="arrow" size={14} /> السابق</button><span>{sec} / 9</span><button type="button" className="pt-btn ghost small" onClick={() => setSec(s => Math.min(9, s + 1))} disabled={sec === 9}>التالي</button></div>
    {(err || ok) && <p className={err ? 'fr-err' : 'fr-ok'} role="status" data-testid="fr-msg">{err || ok}</p>}
  </main>;
}

/* ───────── 3) الطباعة ───────── */
export function FinalPrint({ r, onClose }: { r: any; onClose?: () => void }) {
  const c: FinalComputed = r.computed; const b: FinalBody = r.body; const st: FinalStudent[] = r.students || []; const skills = c.skills || []; const weeks = c.weeks || []; const stats = summativeStats(st); const dist = distribution(st); const so = b.signoff || { quality: null, manager: null };
  const tj = (key: string) => (c.trajectory || []).find(t => t.key === key);
  return <div className="pr fr-pr" data-testid="fr-print-page"><style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
    <div className="pr-bar">{onClose && <button type="button" className="pt-btn ghost small" onClick={onClose}><Icon name="arrow" size={14} /> عودة للمحرّر</button>}<button type="button" className="pt-btn gold small" onClick={() => window.print()} data-testid="fr-print-btn"><Icon name="print" size={14} /> {P46_NAMES_AR.print}</button><small>A4 · يُخفى كل ما ليس من التقرير عند الطباعة</small></div>
    <article className="pr-page" dir="rtl" lang="ar">
      <header className="pr-head"><div><h1>{P46_NAMES_AR.final}</h1><p>{c.program_ar}{c.classroom_ar ? ` — ${c.classroom_ar}` : ''}</p><p>{c.org_ar || b.general.institution}</p></div><div className="pr-meta"><span>الفترة: {c.program_from ? fmtDayAr(c.program_from) : fmtDayAr(c.period_from)} → {fmtDayAr(c.period_to)}</span><span>عضو هيئة التدريس: {c.trainer_ar}</span><span>الحالة: {r.status === 'approved' ? 'معتمَد' : 'مسودّة'}</span>{r.verify_code && <span>رمز التحقّق: <b dir="ltr">{r.verify_code}</b></span>}</div></header>
      <h2>١. البيانات العامة</h2>
      <table><tbody><tr><th>البرنامج</th><td>{c.program_ar}</td><th>الجهة</th><td>{b.general.institution || c.org_ar || '—'}</td></tr><tr><th>المستوى</th><td>{b.general.level || '—'}</td><th>الشعبة</th><td>{b.general.group || c.classroom_ar || '—'}</td></tr><tr><th>المدّة</th><td>{b.general.duration || '—'}</td><th>نمط التنفيذ</th><td>{c.delivery_ar || '—'}</td></tr><tr><th>المسجَّلون</th><td>{c.enrolled}</td><th>المنتظمون</th><td>{c.regular}</td></tr><tr><th>الجلسات / الساعات</th><td>{c.sessions} / {c.hours}</td><th>الأسبوعيات المعتمدة</th><td>{weeks.length}</td></tr>{b.general.notes && <tr><th>ملاحظات</th><td colSpan={3}>{b.general.notes}</td></tr>}</tbody></table>
      <h2>٢. ملخّص البرنامج</h2>
      <p>{b.summary.overview || '—'}</p>{b.summary.attendance_note && <p><b>الحضور:</b> {b.summary.attendance_note}</p>}{b.summary.trajectory_note && <p><b>قراءة المسارات:</b> {b.summary.trajectory_note}</p>}
      <h2>٣. مصفوفة التقدّم (الفرق لا الدرجة)</h2>
      <table className="pr-students"><thead><tr><th>المتدرّب</th>{weeks.map(w => <th key={w.id}>أ{w.week_no}</th>)}<th>الختامي</th><th>الفرق</th><th>الاتجاه</th><th>الحضور</th></tr></thead><tbody>{st.map(s => { const t = tj(s.key); return <tr key={s.key}><th>{s.name}</th>{weeks.map((w, i) => <td key={w.id}>{pct(t?.avgs[i] ?? null)}</td>)}<td><b>{pct(s.avg)}</b></td><td>{sgn(t?.delta ?? null)}</td><td>{t?.trend ? TREND_AR[t.trend] : '—'}</td><td>{pct(s.attendance_pct)}</td></tr>; })}</tbody></table>
      <h2>٤. النتائج الختامية</h2>
      <p className="pr-key">{GRADE_KEY_AR}</p>
      <table className="pr-students"><thead><tr><th>المتدرّب</th>{skills.map(k => <th key={k.code}>{k.name_ar}</th>)}<th>المتوسط</th><th>التقدير</th><th>ملاحظة</th></tr></thead><tbody>{st.map(s => <tr key={s.key}><th>{s.name}</th>{skills.map(k => <td key={k.code}>{s.scores?.[k.code] ?? '—'}</td>)}<td><b>{pct(s.avg)}</b></td><td>{s.grade_ar || '—'}</td><td style={{ textAlign: 'start' }}>{s.note || ''}</td></tr>)}</tbody></table>
      <ul className="pr-stats"><li>عدد من رُصدت درجاتهم: {stats.n}</li><li>المتوسط: {pct(stats.avg)} · أعلى {pct(stats.max)} · أدنى {pct(stats.min)}</li><li>بلغوا حدّ النجاح: {pct(stats.pass_pct)}</li><li>التوزيع: {dist.map(g => `${g.ar} ${g.n}`).join(' · ')}</li></ul>
      {b.results.tools && <p><b>أدوات التقييم:</b> {b.results.tools}</p>}{b.results.note && <p>{b.results.note}</p>}
      <h2>٥. التوصيات والقرارات</h2>
      <table><thead><tr><th>المتدرّب</th><th>الختامي</th><th>الفرق</th><th>التوصية</th><th>السبب / الخطة</th></tr></thead><tbody>{st.map(s => <tr key={s.key}><th>{s.name}</th><td>{pct(s.avg)}</td><td>{sgn(tj(s.key)?.delta ?? null)}</td><td>{s.rec ? REC_AR[s.rec] : '—'}</td><td>{s.reason || ''}</td></tr>)}</tbody></table>
      {b.recommendations.next_level && <p><b>المستوى التالي للمرفوعين:</b> {b.recommendations.next_level}</p>}{b.recommendations.group_note && <p><b>على مستوى المجموعة:</b> {b.recommendations.group_note}</p>}{b.recommendations.admin_note && <p><b>للإدارة:</b> {b.recommendations.admin_note}</p>}
      {b.promotion?.at && <p><b>قرار التنسيب:</b> حُوِّلت توصيات الرفع إلى «{b.promotion.program_ar}» ({b.promotion.created}) بتاريخ {fmtT(b.promotion.at)}.</p>}
      <h2>٦. نقاط القوة والتحدّيات عبر البرنامج</h2>
      <table><thead><tr><th>نقاط القوة</th><th>الشاهد</th></tr></thead><tbody>{b.strengths.strengths.length ? b.strengths.strengths.map((s, i) => <tr key={i}><td>{s.point}</td><td>{s.evidence}</td></tr>) : <tr><td colSpan={2}>—</td></tr>}</tbody></table>
      <table><thead><tr><th>التحدّيات</th><th>ما فُعل / يُقترح</th></tr></thead><tbody>{b.strengths.challenges.length ? b.strengths.challenges.map((s, i) => <tr key={i}><td>{s.point}</td><td>{s.action}</td></tr>) : <tr><td colSpan={2}>—</td></tr>}</tbody></table>
      <h2>٧. الملاحظات الإدارية</h2>
      <table><tbody><tr><th>الحضور والالتزام</th><td>{b.admin.attendance || '—'}</td></tr><tr><th>الانضباط</th><td>{b.admin.discipline || '—'}</td></tr><tr><th>البيئة والتجهيزات</th><td>{b.admin.environment || '—'}</td></tr><tr><th>أخرى</th><td>{b.admin.other || '—'}</td></tr></tbody></table>
      {st.some(s => s.paragraph) && <><h2>ملحق — مسار كل متدرّب</h2>{st.filter(s => s.paragraph).map(s => <p key={s.key}><b>{s.name}:</b> {s.paragraph}</p>)}</>}
      <h2>٨. الاعتماد</h2>
      <table className="pr-sign"><thead><tr><th>عضو هيئة التدريس</th><th>{SIGN_AR.quality}</th><th>{SIGN_AR.manager}</th></tr></thead><tbody><tr><td>{r.author_name || r.author_email}<br /><small>{r.submitted_at ? fmtT(r.submitted_at) : ''}</small></td><td>{so.quality?.name || ''}<br /><small>{so.quality ? fmtT(so.quality.at) : ''}</small></td><td>{so.manager?.name || ''}<br /><small>{so.manager ? fmtT(so.manager.at) : ''}</small></td></tr></tbody></table>
      <footer className="pr-foot"><p>{P46_NAMES_AR.axis} — {P46_NAMES_AR.official} · أرقام هذا التقرير التُقطت من منصّة أَثَر ({fmtT(c.computed_at)}) والحكم والتوصية لعضو هيئة التدريس، والاعتماد بتوقيعين.</p>{weeks.length > 0 && <p>{P46_NAMES_AR.chain}: {weeks.map(w => w.verify_code).filter(Boolean).join(' · ')}</p>}{r.verify_code && <p>التحقّق: /verify/report/{r.verify_code}</p>}</footer>
    </article>
  </div>;
}

/* ───────── 4) صفحة المتدرّب ───────── */
export function MyFinalLine({ id, token }: { id: string; token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const j = await api(token, `/api/reports?line=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  async function toggle(on: boolean) { setBusy(true); const j = await api(token, '/api/reports', { action: 'line_show', line_id: id, on }); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); }
  if (!d) return <main className="pt-main fr"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const l = d.line; const x = l.data || {}; const sk: any[] = x.skills || []; const weeks: number[] = x.weeks || [];
  return <main className="pt-main fr" data-testid="fr-myline"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box fr-head"><span className="pt-kicker"><Icon name="trend" size={14} /> «{P46_NAMES_AR.final_story}» · {P46_NAMES_AR.final}</span><h1>{P46_NAMES_AR.my_page}</h1>
      <p className="pt-muted">{l.program_ar}{l.classroom_ar ? ` — ${l.classroom_ar}` : ''}{l.org_ar ? ` · ${l.org_ar}` : ''} · {fmtDayAr(l.period_to)} · <Link href="/me#report-lines"><Icon name="arrow" size={12} /> أسطري</Link></p>
      {l.kind !== 'final' && <p className="fr-note">هذا سطر من تقرير أسبوعي: «{l.text_ar}»</p>}
      {l.kind === 'final' && <>
        <div className="fr-kpis"><span><b>{weeks.length}</b> أسابيع موثَّقة</span><span className={x.delta !== null && x.delta > 0 ? 'b' : ''}><b data-testid="fr-my-delta">{sgn(x.delta ?? null)}</b> الفرق</span><span><b>{x.trend ? `${TREND_SIGN[x.trend as 'up']} ${TREND_AR[x.trend as 'up']}` : '—'}</b> الاتجاه</span><span><b>{pct(x.attendance_pct)}</b> حضورك</span><span><b>{pct(x.final_avg)}</b> ختاميّك{x.grade_ar ? ` · ${x.grade_ar}` : ''}</span></div>
        <h2 className="fr-h3">مسارك مهارةً مهارة</h2>
        <div className="fr-scroll"><table className="fr-t fr-mx" data-testid="fr-my-matrix"><thead><tr><th>المهارة</th>{weeks.map(w => <th key={w}>أ{w}</th>)}<th>الختامي</th><th>المسار</th></tr></thead><tbody>{sk.map(k => <tr key={k.code}><th>{k.name_ar}</th>{(k.by_week || []).map((v: number | null, i: number) => <td key={i}>{pct(v)}</td>)}<td><b>{pct(k.final)}</b></td><td><Spark vals={k.by_week || []} final={k.final} /></td></tr>)}<tr><th>المتوسط</th>{(x.avgs || []).map((v: number | null, i: number) => <td key={i}>{pct(v)}</td>)}<td><b>{pct(x.final_avg)}</b></td><td><Spark vals={x.avgs || []} final={x.final_avg} /></td></tr></tbody></table></div>
        {x.paragraph && <blockquote className="fr-quote" data-testid="fr-my-para">{x.paragraph}</blockquote>}
        <div className="fr-lineyou" data-testid="fr-my-line"><b>سطر معلّمك لك:</b><p>{l.text_ar}</p><small>— {l.author_name}</small></div>
        {x.rec_ar && <p className="fr-note" data-testid="fr-my-rec"><b>توصية معلّمك:</b> {x.rec_ar} — والقرار النهائي للجهة.</p>}
        <p className="fr-chain"><Icon name="shield" size={14} /> من تقرير معتمَد بتوقيعين · رمز التحقّق <Link href={`/verify/report/${l.verify_code}`} dir="ltr">{l.verify_code}</Link></p>
        {l.mine && <label className="fr-check" data-testid="fr-my-show"><input type="checkbox" checked={!!l.show_on_credential} onChange={e => toggle(e.target.checked)} disabled={busy} /> {P46_NAMES_AR.show_cred} — تظهر فقرة مسارك (بلا توصية ولا تقدير) في صفحة التحقّق من شهادتك لهذا البرنامج. خاصة ما لم تأذن.</label>}
      </>}
      {err && <p className="fr-err" role="alert">{err}</p>}
    </section>
  </main>;
}

const CSS = `
.fr{max-width:1100px}.fr-head h1{margin:.1rem 0 .3rem;color:#0f2a4e;font-size:1.35rem}.fr-h{margin:.1rem 0 .3rem;color:#0f2a4e;font-size:1.35rem}.fr-h3{margin:1rem 0 .4rem;color:#0b8a83;font-size:1.05rem}
.fr input,.fr select,.fr textarea{width:100%;font:inherit;padding:.45rem .6rem;border:1px solid #cfd6e2;border-radius:9px;background:#fff;box-sizing:border-box}.fr input[readonly],.fr textarea[readonly]{background:#f8fafc;border-color:#e5e8ef}.fr select:disabled{background:#f8fafc}
.fr-row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin:.4rem 0}.fr-row label{display:flex;gap:.4rem;align-items:center;font-weight:700;color:#334155}.fr-row select{width:auto;min-width:160px}.fr-err{color:#b42318;font-weight:700}.fr-ok{color:#0b8a83;font-weight:700}
.fr-cards h2{display:flex;align-items:center;gap:.4rem;color:#0f2a4e;margin:0 0 .3rem}.fr-story{color:#0b8a83;font-weight:700;font-size:.9rem}.fr-cardl{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.6rem;grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.fr-cardl li{border:1px solid #e5e8ef;border-radius:14px;padding:.8rem;background:#fff;display:grid;gap:.5rem;min-width:0}.fr-cardl li[data-suggested="1"]{border-color:#c9a24b;box-shadow:0 0 0 2px #f1dfae inset}
.fr-cardh{display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap}.fr-cardh b{color:#0f2a4e}.fr-cardh span{color:#64748b}.fr-cardf{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}.fr-ready{color:#7c5a10;font-weight:700}
.fr-mat{display:grid;gap:.25rem;font-size:.9rem;color:#334155}.fr-mat b{color:#0f2a4e}.fr-mat small{color:#64748b}.fr-mat-ed{margin-top:.5rem;max-width:520px}
.fr-bar{position:relative;display:block;height:14px;background:#eef2f7;border-radius:999px;overflow:hidden;min-width:80px}.fr-bar i{position:absolute;inset-inline-start:0;top:0;bottom:0;background:#0f2a4e;border-radius:999px}.fr-bar.g i{background:#0b8a83}.fr-bar.o i{background:#d97706}.fr-bar b{position:absolute;inset:0;font-size:.7rem;line-height:14px;text-align:center;color:#fff;mix-blend-mode:difference}
.fr-spark{display:inline-flex;align-items:flex-end;gap:2px;height:22px;min-width:40px}.fr-spark i{display:block;width:6px;background:#94a3b8;border-radius:2px 2px 0 0}.fr-spark i.f{background:#c9a24b}
.fr-chip{display:inline-block;font-size:.78rem;font-weight:800;padding:.1rem .5rem;border-radius:999px;background:#eef2f7;color:#334155}.fr-chip.b{background:#e0f2fe;color:#075985}.fr-chip.t{background:#d1fae5;color:#065f46}.fr-chip.o{background:#ffedd5;color:#9a3412}
.fr-head-top{display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start}.fr-actions{display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}
.fr-return{display:flex;gap:.5rem;align-items:center;margin-top:.5rem}.fr-return input{max-width:520px}.fr-retbox{background:#ffedd5;border:1px solid #fdba74;border-radius:10px;padding:.5rem .7rem;color:#9a3412;font-weight:700}.fr-okbox{background:#d1fae5;border:1px solid #6ee7b7;border-radius:10px;padding:.5rem .7rem;color:#065f46}.fr-missing{background:#fff7e6;border:1px solid #f1dfae;border-radius:10px;padding:.5rem .7rem;color:#7c5a10}.fr-signbox{background:#e0f2fe;border:1px solid #7dd3fc;border-radius:10px;padding:.5rem .7rem;color:#075985;font-weight:700}.fr-note{background:#fff7e6;border:1px solid #f1dfae;border-radius:12px;padding:.6rem .8rem;color:#7c5a10}
.fr-kpis{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:.6rem 0 0}.fr-kpis span{background:#f7f8fb;border:1px solid #e5e8ef;border-radius:10px;padding:.35rem .6rem;font-size:.9rem}.fr-kpis span b{color:#0f2a4e;font-size:1.05rem;margin-inline-end:.25rem}.fr-kpis span.b{background:#e0f2fe}.fr-kpis small{color:#64748b}
.fr-secs{display:flex;gap:.35rem;flex-wrap:wrap;margin:.8rem 0 0}.fr-secs button{font:inherit;font-size:.86rem;font-weight:700;padding:.4rem .7rem;border-radius:999px;border:1px solid #cfd6e2;background:#fff;color:#334155;cursor:pointer}.fr-secs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.fr-sec h2{margin:0 0 .6rem;color:#0f2a4e;font-size:1.15rem}.fr-sec h3{margin:1rem 0 .4rem;color:#0b8a83;font-size:1rem}.fr-lbl{display:grid;gap:.3rem;font-weight:700;color:#334155;margin:.5rem 0}.fr-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:.6rem}.fr-key{font-size:.9rem;color:#334155;background:#f7f8fb;border-radius:10px;padding:.4rem .6rem}
.fr-t{width:100%;border-collapse:collapse;font-size:.92rem}.fr-t th,.fr-t td{border:1px solid #e5e8ef;padding:.35rem .45rem;vertical-align:top;text-align:start}.fr-t thead th{background:#f1f5f9;color:#0f2a4e;font-weight:800}.fr-t tbody th{background:#f8fafc;font-weight:700;color:#0f2a4e;white-space:nowrap}.fr-t td input,.fr-t td select{min-width:90px}.fr-students td input[type=number]{width:64px;text-align:center;min-width:0}.fr-scroll{overflow:auto}.fr-mx td{text-align:center;white-space:nowrap}.fr-mx td.up{color:#065f46;font-weight:800}.fr-mx td.down{color:#b42318;font-weight:800}
.fr-x{border:0;background:#fee2e2;color:#b42318;border-radius:8px;width:26px;height:26px;cursor:pointer;font-weight:900}.fr-dist{display:flex;gap:.5rem;flex-wrap:wrap;margin:.6rem 0}.fr-dist span{background:#f7f8fb;border:1px solid #e5e8ef;border-radius:999px;padding:.25rem .7rem;font-size:.9rem}.fr-dist span b{color:#0f2a4e}.fr-dist span.t{background:#d1fae5}.fr-grp{display:inline-flex;gap:.4rem;align-items:center}.fr-grp select{width:auto}
.fr-ai{background:#f3fbfa;border:1px solid #b9e6e1;border-radius:12px;padding:.7rem;margin-top:.6rem;display:grid;gap:.4rem}.fr-phr{list-style:none;margin:.3rem 0 0;padding:0;display:grid;gap:.4rem}.fr-phr li{display:flex;justify-content:space-between;gap:.6rem;align-items:center;background:#fff;border:1px dashed #9fd6cf;border-radius:10px;padding:.45rem .7rem;color:#334155}
.fr-chain{background:#f7f8fb;border:1px solid #e5e8ef;border-radius:10px;padding:.5rem .7rem;display:flex;gap:.4rem;flex-wrap:wrap;align-items:center}.fr-chain a{font-family:ui-monospace,monospace;font-size:.85rem;color:#0f2a4e}
.fr-promote{background:#fff7e6;border:1px solid #f1dfae;border-radius:14px;padding:.8rem;margin-top:.8rem}.fr-promote h3{margin:0 0 .3rem;color:#7c5a10}.fr-promote select{width:auto;min-width:260px}
.fr-para{list-style:none;margin:0;padding:0;display:grid;gap:.7rem}.fr-para li{border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .8rem;display:grid;gap:.4rem;background:#fff}.fr-parah{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;justify-content:space-between}.fr-parah small{color:#64748b;flex:1}
.fr-check{display:flex;gap:.5rem;align-items:center;font-weight:700;margin:.6rem 0}.fr-check input{width:auto}.fr-nav{display:flex;justify-content:space-between;align-items:center;margin:.8rem 0 1.2rem;color:#64748b}
.fr-quote{margin:.8rem 0;padding:.7rem 1rem;border-inline-start:4px solid #c9a24b;background:#fffaf0;border-radius:8px;font-size:1.05rem;line-height:1.9}.fr-lineyou{background:#f3fbfa;border:1px solid #b9e6e1;border-radius:12px;padding:.6rem .8rem}.fr-lineyou p{margin:.25rem 0;font-size:1.05rem;line-height:1.8}.fr-lineyou small{color:#64748b}
@media (max-width:720px){.fr-t{font-size:.85rem}.fr-head-top{flex-direction:column}}
`;
const PRINT_CSS = `
.pr{max-width:1000px;margin:0 auto;padding:1rem}.pr-bar{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap;margin-bottom:1rem}.pr-bar small{color:#64748b}
.pr-page{background:#fff;color:#111;border:1px solid #cbd5e1;padding:14mm 12mm;font-size:11.5px;line-height:1.55;font-family:inherit}
.pr-head{display:flex;justify-content:space-between;gap:1rem;border-bottom:2px solid #0f2a4e;padding-bottom:.5rem;margin-bottom:.8rem}.pr-head h1{margin:0;font-size:18px;color:#0f2a4e}.pr-head p{margin:.1rem 0;color:#334155}.pr-meta{display:grid;gap:.15rem;text-align:start;font-size:10.5px;color:#334155;align-content:start}
.pr-page h2{font-size:13.5px;color:#fff;background:#0f2a4e;padding:.3rem .6rem;margin:1rem 0 .45rem;border-radius:4px;page-break-after:avoid}
.pr-page table{width:100%;border-collapse:collapse;margin:0 0 .4rem;page-break-inside:auto}.pr-page th,.pr-page td{border:1px solid #94a3b8;padding:.25rem .4rem;vertical-align:top;text-align:start}.pr-page thead th{background:#e2e8f0;font-weight:800}.pr-page tbody th{background:#f1f5f9;font-weight:700;white-space:nowrap}.pr-page tr{page-break-inside:avoid}
.pr-stats{columns:2;margin:.2rem 0 .6rem;padding-inline-start:1.2rem}.pr-key{font-size:10.5px;color:#334155;margin:.2rem 0 .3rem}.pr-students td,.pr-students th{text-align:center}.pr-students tbody th{text-align:start}
.pr-sign{margin-top:1rem}.pr-sign td{height:40px}.pr-foot{margin-top:.8rem;border-top:1px solid #94a3b8;padding-top:.4rem;font-size:10.5px;color:#334155;text-align:center}.pr-foot p{margin:.15rem 0}
@media print{@page{size:A4;margin:10mm}body{background:#fff}.pr{max-width:none;padding:0}.pr-bar,.pt-head,.pt-foot,header.pt-header,footer,nav,.way-bar,[data-testid="way-bar"],[data-testid="nadi-fab"],.nadi-fab,.pt-skip{display:none!important}.pr-page{border:0;padding:0}}
`;
