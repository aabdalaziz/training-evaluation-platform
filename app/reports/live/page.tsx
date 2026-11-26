'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P84 */
/**
 * /reports/live — «التقرير الحيّ»: هرم كيركباتريك الصريح · توزيع كلّ بند · مقارنة الدفعة السابقة · التنبيهات التلقائية → مهامّ «نقل الأثر»
 *  · خمسة قوالب بحسب القارئ · PDF بالهوية (طباعة) · إرسال للجهة بالبريد · وسم الأسئلة بالمستوى (للطاقم).
 *  البيانات = الحمولة نفسها التي يقرؤها «التقرير الشامل» + questions.kp_level + report_alerts.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { buildProgramReport } from '../../../lib/reports/program';
import type { ProgramReportInput, ProgramReport } from '../../../lib/reports/program';
import { buildEvaluations, buildFacts, buildComments, applyFilters, factsOf, groupBy, kpis, TARGET } from '../../../lib/reports/analytics';
import type { Lookups, Program } from '../../../lib/reports/analytics';
import { KP_META, TEMPLATES, ALERT_LABEL, autoLevel, buildItems, kirkpatrick, detectAlerts, newAlerts, previousCohort, buildDoc, templateHtml } from '../../../lib/reports/live';
import type { TemplateKind, LiveDoc, Block, Item, LevelCard, Alert, LiveQuestion } from '../../../lib/reports/live';
import { RoomHead } from '../../components/RoomKit';

type Raw = Omit<ProgramReportInput, 'program' | 'questions'> & { programs: Program[]; questions: LiveQuestion[] };
type DbAlert = { id: string; program_id: string; kind: string; ref: string; severity: string; title_ar: string; status: string; owner_ar: string | null; due_date: string | null; created_at: string };
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const STATUS_AR: Record<string, string> = { open: 'مفتوح', ack: 'قيد المعالجة', done: 'مُنجز', dismissed: 'مستبعَد' };

export default function LiveReportPage() { return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>; }

function Inner() {
  const db = supabase(); const router = useRouter(); const params = useSearchParams();
  const [ready, setReady] = useState(false); const [raw, setRaw] = useState<Raw | null>(null); const [role, setRole] = useState(''); const [token, setToken] = useState('');
  const [programId, setProgramId] = useState(params.get('program') || ''); const [tpl, setTpl] = useState<TemplateKind>((params.get('t') as TemplateKind) || 'executive');
  const [dbAlerts, setDbAlerts] = useState<DbAlert[]>([]); const [hasKp, setHasKp] = useState(true); const [hasAlerts, setHasAlerts] = useState(true);
  const [error, setError] = useState(''); const [flash, setFlash] = useState(''); const [busy, setBusy] = useState(''); const [tagOpen, setTagOpen] = useState(false); const [mailTo, setMailTo] = useState(''); const [mailOpen, setMailOpen] = useState(false);
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 3000); };
  const generatedAt = useMemo(() => new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }), []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await db.auth.getSession(); const user = session?.user; if (!user) { router.replace('/login?next=/reports/live'); return; } setToken(session?.access_token || '');
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle(); setRole(String((prof as any)?.role || '').toUpperCase());
      const [pg, cl, tr, qs, ev, an, ia, ir, fu, bq, br, ss, ar, ce, ok, om, al] = await Promise.all([
        db.from('programs').select('*').order('name_ar'), db.from('classrooms').select('id,code,program_id,trainer_id,delivery_mode,level'), db.from('trainers').select('id,name'), db.from('questions').select('*'),
        db.from('evaluations').select('*').limit(20000), db.from('evaluation_answers').select('*').limit(200000), db.from('impact_assessments').select('id,program_id,title_ar'), db.from('impact_responses').select('*').limit(20000),
        db.from('behavior_followups').select('*'), db.from('behavior_questions').select('*'), db.from('behavior_responses').select('*').limit(20000), db.from('attendance_sessions').select('id,program_id,session_date,title,status'),
        db.from('attendance_records').select('session_id,full_name,email,phone,identity_key,status').limit(50000), db.from('certificates').select('id,program_id,recipient_name,recipient_email,serial,issued_at,sent_at,revoked_at').limit(20000),
        db.from('outcome_kpis').select('*'), db.from('outcome_measurements').select('*').limit(20000), db.from('report_alerts').select('*').order('created_at', { ascending: false }).limit(2000),
      ]);
      const err = [pg, cl, tr, qs, ev, an, ia, ir, fu, bq, br, ss, ar, ce, ok, om].find(r => r.error)?.error; if (err) setError(err.message);
      if (al.error) setHasAlerts(false); else setDbAlerts((al.data || []) as DbAlert[]);
      const questions = (qs.data || []) as LiveQuestion[]; setHasKp(questions.length ? 'kp_level' in questions[0] : true);
      const programs = ((pg.data || []) as Program[]).filter((p: any) => p.status !== 'CANCELLED');
      setRaw({ programs, classrooms: (cl.data || []) as any[], trainers: (tr.data || []) as any[], questions, evaluations: (ev.data || []) as any[], answers: (an.data || []) as any[], assessments: (ia.data || []) as any[], impactResponses: (ir.data || []) as any[], followups: (fu.data || []) as any[], behaviorQuestions: (bq.data || []) as any[], behaviorResponses: (br.data || []) as any[], sessions: (ss.data || []) as any[], records: (ar.data || []) as any[], certificates: (ce.data || []) as any[], kpis: (ok.data || []) as any[], measurements: (om.data || []) as any[] });
      if (!params.get('program') && programs.length) setProgramId(programs[0].id);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useMemo(() => {
    if (!raw) return null; const program = raw.programs.find(p => p.id === programId); if (!program) return null;
    const { programs, ...rest } = raw; const rep: ProgramReport = buildProgramReport({ program, ...rest });
    const lk: Lookups = { classrooms: raw.classrooms, trainers: raw.trainers, programs, questions: raw.questions };
    const allEvals = buildEvaluations(raw.evaluations, raw.answers, lk); const facts = buildFacts(raw.answers, raw.questions);
    const evals = applyFilters(allEvals, { programId: program.id, kind: 'ALL' }, lk); const pf = factsOf(evals, facts);
    const items = evals.length ? buildItems(groupBy('question', evals, pf, lk, 'ar'), raw.questions) : [];
    const comments = buildComments(evals, raw.answers, raw.questions);
    const cards = kirkpatrick(rep, items); const alerts = detectAlerts(rep, items, comments);
    const cohort = previousCohort(programs, program, (p) => { const e = applyFilters(allEvals, { programId: p.id, kind: 'ALL' }, lk); if (!e.length) return { mean: null, responses: 0 }; const k = kpis(e, factsOf(e, facts)); return { mean: k.mean, responses: k.responses }; });
    const input = { rep, items, cards, alerts, cohort, comments, generatedAt };
    return { rep, items, cards, alerts, cohort, comments, doc: buildDoc(tpl, input), input };
  }, [raw, programId, tpl, generatedAt]);

  const mine = useMemo(() => dbAlerts.filter(a => a.program_id === programId), [dbAlerts, programId]);
  const pending = useMemo(() => (live ? newAlerts(live.alerts, mine) : []), [live, mine]);
  const canWrite = STAFF.includes(role) || role === 'TRAINER';

  async function createTasks() {
    if (!live || !pending.length) return; setBusy('tasks');
    const rows = pending.map(a => ({ program_id: programId, kind: a.kind, ref: a.ref, severity: a.severity, title_ar: a.title_ar, detail: a.detail, owner_ar: a.owner_ar, due_date: new Date(Date.now() + a.days * 86400000).toISOString().slice(0, 10) }));
    const { data, error } = await db.from('report_alerts').upsert(rows, { onConflict: 'program_id,kind,ref', ignoreDuplicates: true }).select();
    if (error) setError(error.message); else { const { data: all } = await db.from('report_alerts').select('*').eq('program_id', programId).order('created_at', { ascending: false }); setDbAlerts(l => [...(all || []) as DbAlert[], ...l.filter(x => x.program_id !== programId)]); say(`أُنشئت ${data?.length ?? rows.length} مهمّة في «نقل الأثر»`); }
    setBusy('');
  }
  async function setStatus(a: DbAlert, status: string) { const { error } = await db.from('report_alerts').update({ status }).eq('id', a.id); if (error) { setError(error.message); return; } setDbAlerts(l => l.map(x => (x.id === a.id ? { ...x, status } : x))); }
  async function setLevel(q: LiveQuestion, level: number) { const { error } = await db.from('questions').update({ kp_level: level }).eq('id', q.id); if (error) { setError(error.message); return; } setRaw(r => (r ? { ...r, questions: r.questions.map(x => (x.id === q.id ? { ...x, kp_level: level } : x)) } : r)); }
  async function sendMail() {
    if (!live) return; const to = mailTo.split(/[,\s;]+/).map(s => s.trim()).filter(Boolean); if (!to.length) { setError('اكتب بريدًا واحدًا على الأقل'); return; } setBusy('mail');
    try { const r = await fetch('/api/reports/live-send', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ to, doc: live.doc }) }); const j = await r.json().catch(() => null); if (!j?.success) throw new Error(j?.error || 'تعذّر الإرسال'); say(`أُرسل التقرير إلى ${to.length} بريدًا`); setMailOpen(false); setMailTo(''); } catch (e: any) { setError(e.message); } finally { setBusy(''); }
  }
  const programQuestions = useMemo(() => { if (!raw || !live) return []; const used = new Set(live.items.map(i => i.id)); return raw.questions.filter(q => used.has(q.id)); }, [raw, live]);

  if (!ready) return <div className="lv rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  return (
    <div className="lv rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead title={<>التقرير الحيّ</>} desc={<><p>هرم كيركباتريك بمستوياته الأربعة معًا، توزيع كلّ بند، مقارنة بالدفعة السابقة، تنبيهات تتحوّل إلى مهامّ، وخمسة قوالب بحسب القارئ — من البيانات نفسها، بزرّ واحد PDF أو بريد.</p></>}
        actions={<>
          <Link href={`/reports/program${programId ? `?program=${programId}` : ''}`} className="rm-btn"><Icon name="doc" size={16} /> التقرير الشامل</Link>
          <Link href={`/reports/studio${programId ? `?program=${programId}` : ''}`} className="rm-btn"><Icon name="chart" size={16} /> استوديو التحليل</Link>{/* P85 */}
          <button className="rm-btn" onClick={() => setMailOpen(o => !o)} disabled={!live || !canWrite}><Icon name="mail" size={16} /> أرسل للجهة</button>
          <button className="rm-btn primary" onClick={() => window.print()} disabled={!live}><Icon name="print" size={16} /> PDF بالهوية</button>
        </>} />
      {error && <div className="rm-alert lv-noprint" onClick={() => setError('')}>{error}</div>}
      {flash && <div className="lv-flash lv-noprint">{flash}</div>}
      {!hasKp && <div className="rm-alert lv-noprint">لم تُشغَّل هجرة P84 بعد (عمود kp_level) — الوسم يُحسب تلقائيًّا من نصّ السؤال حتى تشغيلها.</div>}

      <section className="rm-card lv-noprint lv-bar">
        <label className="lv-select">البرنامج<select value={programId} onChange={e => setProgramId(e.target.value)}>{!raw?.programs.length && <option value="">— لا توجد برامج —</option>}{raw?.programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
        <div className="lv-tabs" role="tablist" aria-label="القالب">{(Object.keys(TEMPLATES) as TemplateKind[]).map(k => <button key={k} role="tab" aria-selected={tpl === k} className={`lv-tab ${tpl === k ? 'on' : ''}`} onClick={() => setTpl(k)}><b>{TEMPLATES[k].ar}</b><small>{TEMPLATES[k].reader_ar} · {TEMPLATES[k].pages_ar}</small></button>)}</div>
      </section>
      {mailOpen && <section className="rm-card lv-noprint lv-mail"><label>إرسال «{TEMPLATES[tpl].ar}» إلى<input dir="ltr" placeholder="org@example.com, manager@example.com" value={mailTo} onChange={e => setMailTo(e.target.value)} /></label><button className="rm-btn primary" onClick={sendMail} disabled={busy === 'mail'}><Icon name="send" size={16} /> أرسل</button><small>يُرسل HTML بالهوية من reports@athar-portal.com ويُسجَّل في السجلّ.</small></section>}

      {!live && <div className="rm-card rm-empty"><Icon name="doc" size={34} /><b>اختر برنامجًا</b></div>}
      {live && <>
        {/* التنبيهات ← مهامّ (للطاقم، لا تُطبع) */}
        {canWrite && <section className="rm-card lv-noprint lv-alerts">
          <div className="lv-alerts-head"><h3><Icon name="alert" size={18} /> التنبيه التلقائي → مهامّ «نقل الأثر»</h3>{hasAlerts ? <button className="rm-btn primary small" onClick={createTasks} disabled={!pending.length || busy === 'tasks'}><Icon name="plus" size={14} /> أنشئ {pending.length} مهمّة جديدة</button> : <small>شغّل هجرة P84 لإنشاء جدول المهامّ</small>}</div>
          {live.alerts.length === 0 && mine.length === 0 && <p className="lv-muted">لا تنبيهات — كلّ البنود فوق العتبة، والحضور والكسب والنقل ضمن المستهدف.</p>}
          {(mine.length > 0 || pending.length > 0) && <table className="lv-tab-table"><thead><tr><th>التنبيه</th><th>النوع</th><th>الأهمّية</th><th>المسؤول</th><th>الاستحقاق</th><th>الحالة</th></tr></thead><tbody>
            {mine.map(a => <tr key={a.id} className={a.status === 'done' || a.status === 'dismissed' ? 'off' : ''}><td>{a.title_ar}</td><td>{ALERT_LABEL[a.kind as keyof typeof ALERT_LABEL] || a.kind}</td><td><span className={`lv-sev ${a.severity}`}>{a.severity === 'high' ? 'عالية' : 'متوسّطة'}</span></td><td>{a.owner_ar || '—'}</td><td dir="ltr">{a.due_date || '—'}</td><td><select value={a.status} onChange={e => setStatus(a, e.target.value)} aria-label="الحالة">{Object.entries(STATUS_AR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td></tr>)}
            {pending.map(a => <tr key={`${a.kind}:${a.ref}`} className="new"><td>{a.title_ar}</td><td>{ALERT_LABEL[a.kind]}</td><td><span className={`lv-sev ${a.severity}`}>{a.severity === 'high' ? 'عالية' : 'متوسّطة'}</span></td><td>{a.owner_ar}</td><td>{a.days} يومًا</td><td><small>جديد — لم يُنشأ بعد</small></td></tr>)}
          </tbody></table>}
        </section>}

        {/* وسم الأسئلة */}
        {canWrite && <section className="rm-card lv-noprint">
          <button className="lv-link" onClick={() => setTagOpen(o => !o)} aria-expanded={tagOpen}><Icon name="filter" size={14} /> وسم أسئلة هذا البرنامج بمستوى كيركباتريك ({programQuestions.length})</button>
          {tagOpen && <div className="lv-tags">{programQuestions.map(q => <label key={q.id}><span>{q.text_ar || q.text_en || q.question_key}</span><select value={autoLevel(q)} onChange={e => setLevel(q, Number(e.target.value))} disabled={!hasKp}>{([1, 2, 3, 4] as const).map(l => <option key={l} value={l}>{l} · {KP_META[l].short_ar}</option>)}</select></label>)}<small className="lv-muted">الوسم يسري على كلّ البرامج التي تستخدم القالب نفسه.</small></div>}
        </section>}

        {/* المستند */}
        <article className="lv-sheet">
          <header className="lv-top">
            <img src="/brand/athar-mark.svg" alt="أَثَر" className="lv-logo" />
            <div><div className="lv-kicker">{live.doc.title} · {TEMPLATES[tpl].reader_ar} · <bdi>{live.doc.generated_at}</bdi></div><h2>{live.doc.program}</h2><div className="lv-meta"><span>{live.doc.subtitle}</span><span><bdi>{live.doc.period}</bdi></span>{live.rep.trainers.length > 0 && <span>المدرّبون: {live.rep.trainers.join('، ')}</span>}</div></div>
          </header>
          {live.doc.sections.map((s, i) => <section key={i} className="lv-sec"><h3>{s.title}</h3>{s.blocks.map((b, j) => <BlockView key={j} b={b} />)}</section>)}
          <footer className="lv-foot">بوّابة أَثَر للتعليم والتدريب والتطوير والجودة · athar-portal.com · «نبني القدرة ونُثبت الأثر» · أُنتج آليًّا من بيانات البرنامج؛ الأحكام الختامية بيد الإنسان.</footer>
        </article>
      </>}
    </div>
  );
}

function BlockView({ b }: { b: Block }) {
  if (b.type === 'kpis') return <div className="lv-kpis">{b.items.map((i, k) => <div key={k} className={`lv-kpi ${i.tone || 'none'}`}><small>{i.label}</small><b>{i.value}</b><span>{i.sub}</span></div>)}</div>;
  if (b.type === 'levels') return <Levels cards={b.cards} />;
  if (b.type === 'table') return b.rows.length ? <table className="lv-table"><thead><tr>{b.head.map((h, k) => <th key={k}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r, k) => <tr key={k}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table> : <p className="lv-muted">لا بيانات.</p>;
  if (b.type === 'bars') return <Bars items={b.items} />;
  if (b.type === 'list') return b.items.length ? <ol className="lv-list">{b.items.map((i, k) => <li key={k}>{i}</li>)}</ol> : <p className="lv-muted">لا توصيات — الأداء ضمن المستهدف.</p>;
  if (b.type === 'quotes') return b.items.length ? <div className="lv-quotes">{b.items.map((q, k) => <blockquote key={k}>{q.text}{q.who && <small> — {q.who}</small>}</blockquote>)}</div> : <p className="lv-muted">لا تعليقات كافية.</p>;
  return b.text ? <p className="lv-text">{b.text}</p> : null;
}
function Levels({ cards }: { cards: LevelCard[] }) {
  return <div className="lv-levels">{cards.map(c => <div key={c.level} className={`lv-level ${c.tone}`} style={{ borderTopColor: KP_META[c.level].color }}><small>المستوى {c.level} · {KP_META[c.level].ar}</small><b>{c.score == null ? '—' : `${c.score}/100`}</b><div className="lv-level-h">{c.headline}</div><ul>{c.detail.map((d, i) => <li key={i}>{d}</li>)}</ul><i>{KP_META[c.level].hint_ar}</i></div>)}</div>;
}
function Bars({ items }: { items: Item[] }) {
  const cols = ['#b3261e', '#e8795c', '#D9A866', '#8fc4bd', '#2e7d6f'];
  if (!items.length) return <p className="lv-muted">لا بنود.</p>;
  return <div className="lv-bars">{items.map(i => { const t = i.dist.reduce((a, x) => a + x, 0) || 1; return <div key={i.id} className="lv-bar-row"><div className="lv-bar-label"><span className="lv-lv" style={{ background: KP_META[i.level].color }}>{i.level}</span>{i.label} <small>({i.n})</small></div><div className="lv-bar" role="img" aria-label={`توزيع: ${i.dist.join('/')}`}>{i.dist.map((v, j) => v ? <span key={j} style={{ width: `${(v / t) * 100}%`, background: cols[j] }} title={`${j + 1}: ${v}`}>{(v / t) >= 0.12 ? v : ''}</span> : null)}</div><div className="lv-bar-m"><b>{i.mean.toFixed(2)}</b><small>{i.top2}% ↑ · {i.bottom2}% ↓</small></div></div>; })}<div className="lv-legend">{cols.map((c, j) => <span key={j}><i style={{ background: c }} />{j + 1}</span>)} <em>مستهدف {TARGET}</em></div></div>;
}

const CSS = `
.lv{max-width:1100px;margin:0 auto}.lv-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
.lv-select{display:flex;gap:8px;align-items:center;font-weight:800;color:#3A1F36}.lv-select select{min-width:260px;padding:8px 10px;border:1px solid #e6d5c6;border-radius:10px;font:inherit}
.lv-tabs{display:flex;flex-wrap:wrap;gap:6px}.lv-tab{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 12px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;cursor:pointer;min-height:44px}.lv-tab.on{background:#3A1F36;color:#fff;border-color:#3A1F36}.lv-tab small{font-size:11px;opacity:.75}
.lv-mail{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.lv-mail label{display:flex;flex-direction:column;gap:4px;font-weight:700;flex:1;min-width:260px}.lv-mail input{padding:8px 10px;border:1px solid #e6d5c6;border-radius:10px;font:inherit}.lv-mail small{color:#8a7580;font-size:12px}
.lv-flash{background:#E6F3F1;color:#2F6B66;border-radius:10px;padding:8px 12px;margin:8px 0;font-weight:700}
.lv-alerts-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.lv-alerts h3{margin:0;display:flex;gap:6px;align-items:center;font-size:16px;color:#3A1F36}
.lv-tab-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}.lv-tab-table th{text-align:right;padding:6px;background:#F6EBE0}.lv-tab-table td{padding:6px;border-top:1px solid #f0e4d8;vertical-align:middle}.lv-tab-table tr.off td{opacity:.5}.lv-tab-table tr.new td{background:#fff8ef}.lv-tab-table select{font:inherit;padding:4px 6px;border-radius:8px;border:1px solid #e6d5c6}
.lv-sev{display:inline-block;border-radius:999px;padding:1px 8px;font-size:11px;font-weight:800;background:#F6EBE0}.lv-sev.high{background:#f8d7d3;color:#8b1e14}
.lv-link{border:0;background:transparent;color:#D4614A;font:inherit;font-weight:800;cursor:pointer;display:inline-flex;gap:6px;align-items:center;min-height:36px}
.lv-tags{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px;margin-top:8px}.lv-tags label{display:flex;justify-content:space-between;gap:8px;align-items:center;font-size:13px;padding:4px 0;border-bottom:1px solid #f0e4d8}.lv-tags select{font:inherit;padding:4px 6px;border-radius:8px;border:1px solid #e6d5c6}
.lv-muted{color:#8a7580;font-size:13px}
.lv-sheet{background:#fff;border:1px solid #e6d5c6;border-radius:18px;padding:22px 26px;margin-top:12px;box-shadow:0 10px 30px rgba(34,16,31,.06)}
.lv-top{display:grid;grid-template-columns:72px 1fr;gap:16px;align-items:center;border-bottom:3px solid #22101F;padding-bottom:12px;margin-bottom:14px}.lv-logo{width:72px;height:72px}
.lv-kicker{font-size:12px;font-weight:800;color:#D4614A;letter-spacing:.2px}.lv-top h2{margin:2px 0;font-size:24px;color:#22101F}.lv-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:#5C4858;font-weight:700}
.lv-sec{margin:14px 0;break-inside:avoid}.lv-sec h3{font-size:15px;color:#3A1F36;margin:0 0 8px;padding-inline-start:10px;border-inline-start:4px solid #D9A866}
.lv-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.lv-kpi{border-radius:14px;padding:10px 12px;background:#F6EBE0;display:flex;flex-direction:column;gap:2px}.lv-kpi small{font-size:11.5px;color:#5C4858;font-weight:800}.lv-kpi b{font-size:24px;color:#22101F}.lv-kpi span{font-size:11.5px;color:#5C4858}
.lv-kpi.ok{background:#E6F3F1}.lv-kpi.info{background:#F6ECD9}.lv-kpi.warn{background:#FDEEE9}.lv-kpi.bad{background:#F8D7D3}
.lv-levels{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.lv-level{border-top:6px solid;border-radius:12px;padding:10px 12px;background:#FBF4EE;display:flex;flex-direction:column;gap:4px;min-height:150px}.lv-level small{font-size:11.5px;color:#5C4858;font-weight:800}.lv-level b{font-size:26px;color:#22101F}.lv-level-h{font-size:12.5px;font-weight:800;color:#3A2634}.lv-level ul{margin:0;padding-inline-start:16px;font-size:11.5px;color:#5C4858;line-height:1.7}.lv-level i{font-size:11px;color:#B3A5AE;margin-top:auto}
.lv-level.ok{background:#E6F3F1}.lv-level.info{background:#F6ECD9}.lv-level.warn{background:#FDEEE9}.lv-level.bad{background:#F8D7D3}
.lv-table{width:100%;border-collapse:collapse;font-size:12.5px}.lv-table th{text-align:right;padding:6px 8px;background:#F6EBE0;color:#3A1F36}.lv-table td{padding:6px 8px;border-bottom:1px solid #f0e4d8}
.lv-bars{display:flex;flex-direction:column;gap:5px}.lv-bar-row{display:grid;grid-template-columns:1fr 1.4fr 110px;gap:10px;align-items:center;font-size:12.5px}.lv-bar-label small{color:#8a7580}.lv-lv{display:inline-block;width:18px;height:18px;border-radius:6px;color:#fff;font-size:10px;font-weight:900;text-align:center;line-height:18px;margin-inline-end:6px}
.lv-bar{display:flex;height:18px;border-radius:6px;overflow:hidden;background:#f3eee9}.lv-bar span{display:block;height:100%;color:#fff;font-size:10px;font-weight:800;text-align:center;line-height:18px}
.lv-bar-m{display:flex;flex-direction:column;align-items:center}.lv-bar-m b{font-size:14px}.lv-bar-m small{font-size:10.5px;color:#8a7580}
.lv-legend{display:flex;gap:10px;font-size:11px;color:#5C4858;margin-top:6px;align-items:center}.lv-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-inline-end:4px;vertical-align:middle}.lv-legend em{margin-inline-start:auto;font-style:normal;color:#8a7580}
.lv-list{margin:0;padding-inline-start:20px;font-size:13px;line-height:1.9;color:#3A2634;font-weight:700}.lv-text{font-size:13px;line-height:1.9;margin:0 0 6px}
.lv-quotes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.lv-quotes blockquote{margin:0;border-inline-start:4px solid #D9A866;background:#FBF4EE;border-radius:8px;padding:8px 12px;font-size:12px;line-height:1.7}.lv-quotes small{color:#8a7580}
.lv-foot{color:#B3A5AE;font-size:11px;font-weight:700;text-align:center;margin:14px 0 0;line-height:1.7;border-top:1px solid #f0e4d8;padding-top:8px}
@media print{@page{size:A4 portrait;margin:10mm}.lv-noprint,.global-nav,.rm-head-actions{display:none!important}.lv{max-width:none}.lv-sheet{border:0;box-shadow:none;padding:0;margin:0}.lv-sec{break-inside:avoid}.lv-top{position:running(h)}.lv-foot{position:fixed;bottom:0;left:0;right:0;background:#fff}body{background:#fff}}
@media(max-width:980px){.lv-kpis,.lv-levels{grid-template-columns:1fr 1fr}.lv-quotes{grid-template-columns:1fr}.lv-tags{grid-template-columns:1fr}.lv-bar-row{grid-template-columns:1fr}}
`;
