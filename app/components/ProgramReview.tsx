'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P47 «البرنامج الذي يراجع نفسه» (الرسمي: مراجعة البرنامج بعد الدفعة)
 *  <ReviewCards>        /me/reports#review           بطاقة لكل دفعة اكتملت: «راجع الدفعة» أو فتح المراجعة القائمة
 *  <ReviewEditor>       /me/reports/[id] · /admin    ثلاثة أقسام: الوعد وما ثبت (جاهز من أَثَر) · الاقتراحات والقرارات (أقبل · أعدّل · أرفض) · ما لا تراه الأرقام
 *  <ReviewDoc>          المطبوع A4                   الوعد/ما ثبت · الفجوات · القرارات · التوقيعان
 *  <ProgramReviewStrip> /programs/[id] (عام)         «هذا البرنامج تغيّر N مرة بسبب دفعاته» + آخر ما تغيّر (بلا أسماء)
 *  <VerifyReview>       /verify/report/<code>        درجات الفجوات والتعديلات المعتمَدة
 *  القاعدة: الأرقام من التقارير المعتمَدة فقط، والاقتراح من قائمة أفعال مغلقة (محليًا أو بالذكاء بعد تنقية)، والقرار والسياق للإنسان، والاعتماد لزميل غير الكاتب.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P47B_NAMES_AR, VERSION_MESSAGE_MAX, VERSION_MESSAGE_MIN } from '../../lib/reports/registry';   // P47-ب
import { P46_NAMES_AR, P47_NAMES_AR, GAP_GRADE_AR, REVIEW_ACTION_AR, REVIEW_DECISIONS, REVIEW_DECISION_AR, TEXT_MAX, SHORT_MAX, REVIEW_CONTEXT_MIN, targetLabelAr, reviewChanges, gapCounts, fmtDayAr, type ReviewBody, type ReviewComputed, type ReviewProposal, type GapGrade } from '../../lib/reports/registry';
import { MR_CSS, MR_PRINT_CSS } from './MissionReport';
import { drApi as api, DR_CSS, DrReturn, DrNotes, drStatusAr as statusAr } from './DiplomaReport';

type Tok = () => Promise<string>;
const CSS = `
.pv-cards{display:grid;gap:.5rem;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));list-style:none;margin:.4rem 0 0;padding:0}.pv-cards li{border:1px solid #e5e8ef;border-radius:14px;padding:.7rem .8rem;background:#fff;display:grid;gap:.4rem}.pv-cards li b{color:#0f2a4e}.pv-cards li small{color:#64748b}.pv-cards li[data-ready="0"]{opacity:.8}
.pv-g{display:inline-block;font-size:.78rem;font-weight:800;padding:.1rem .55rem;border-radius:999px;border:1px solid transparent}.pv-g[data-g="kept"]{background:#d1fae5;color:#065f46}.pv-g[data-g="near"]{background:#fff7e6;color:#9a6b00;border-color:#f1dfae}.pv-g[data-g="missed"]{background:#fee2e2;color:#991b1b}
.pv-t{width:100%;border-collapse:collapse;font-size:.88rem}.pv-t th,.pv-t td{border-bottom:1px solid #eef0f4;padding:.35rem .4rem;text-align:right;vertical-align:top}.pv-t thead th{color:#64748b;font-weight:700;font-size:.8rem}
.pv-two{display:grid;grid-template-columns:1fr 1fr;gap:.8rem}.pv-two>div{border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .7rem;background:#fbfcfe}.pv-two h4{margin:0 0 .4rem;color:#0f2a4e;display:flex;gap:.4rem;align-items:center}
.pv-prop{border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .7rem;background:#fff;margin:.45rem 0;display:grid;gap:.45rem}.pv-prop[data-d="accept"]{border-color:#0b8a83;background:#f0fbf9}.pv-prop[data-d="edit"]{border-color:#c9a24b;background:#fffaf0}.pv-prop[data-d="reject"]{border-color:#e5e8ef;background:#f8fafc;opacity:.9}
.pv-prop h4{margin:0;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;color:#0f2a4e}.pv-prop h4 small{color:#64748b;font-weight:600}.pv-prop .why{margin:0;color:#334155;font-size:.9rem}.pv-prop .why b{color:#0b8a83}
.pv-dec{display:flex;gap:.4rem;flex-wrap:wrap}.pv-dec label{display:inline-flex;gap:.3rem;align-items:center;border:1px solid #e5e8ef;border-radius:999px;padding:.2rem .6rem;cursor:pointer;font-weight:700;font-size:.86rem}.pv-dec label[data-on="1"]{border-color:#0f2a4e;background:#0f2a4e;color:#fff}
.pv-prop textarea{min-height:52px}.pv-src{font-size:.8rem;color:#64748b}
.pv-ver{margin:.6rem 0 0;border:1px solid #f1dfae;border-radius:14px;padding:.7rem .9rem;background:#fffaf0;display:grid;gap:.5rem}.pv-ver h4{margin:0;font-size:.98rem;color:#7a5c12;display:flex;gap:.4rem;align-items:center;flex-wrap:wrap}.pv-ver ul{margin:0;padding:0 1.1rem 0 0;font-size:.88rem;line-height:1.7}.pv-ver ul.m li{color:#7a5c12}.pv-ver textarea{width:100%;box-sizing:border-box;min-height:64px;border:1px solid #e5d9b8;border-radius:10px;padding:.5rem .7rem;font:inherit;line-height:1.7;background:#fff}.pv-ver .warn{background:#fff3f3;border:1px solid #f3c5c5;color:#8a1f1f;border-radius:10px;padding:.4rem .7rem;font-size:.85rem;margin:0}.pv-ver .row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}.pv-ver .ba{display:flex;gap:.6rem;flex-wrap:wrap;font-size:.85rem}.pv-ver .ba b{color:#0f2a4e}.pv-ver .ok{background:#eefaf5;border:1px solid #bfe9d6;color:#0b6b4a;border-radius:10px;padding:.4rem .7rem;margin:0;font-size:.9rem}
.pv-vers{margin:.5rem 0 0;padding:0;list-style:none;display:grid;gap:.3rem;font-size:.85rem}.pv-vers li{display:flex;gap:.5rem;flex-wrap:wrap;align-items:baseline}.pv-vers .v{font-weight:900;color:#7a5c12;background:#fff7e6;border:1px solid #f1dfae;border-radius:999px;padding:.05rem .55rem;font-size:.78rem}.pv-msg{margin:.5rem 0 0;border-right:3px solid #c9a24b;padding:.3rem .7rem;background:#fffaf0;border-radius:8px;font-size:.92rem;line-height:1.75}
.pv-strip{margin:1rem 0;border:1px solid #d9efe9;border-radius:16px;padding:.8rem 1rem;background:#f3fbfa}.pv-strip h2{font-size:1.05rem;color:#0b6f69;margin:0 0 .4rem;display:flex;gap:.4rem;align-items:center}.pv-strip ul{margin:.3rem 0 0;padding-inline-start:1.1rem;font-size:.9rem;color:#0f172a}.pv-strip small{color:#64748b}
.pv-sum{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
@media (max-width:720px){.pv-two{grid-template-columns:1fr}}
`;
const TONE: Record<string, string> = { draft: '', submitted: 'b', approved: 't', returned: 'o' };
const G = ({ g }: { g: GapGrade }) => <span className="pv-g" data-g={g} data-testid="pv-grade">{GAP_GRADE_AR[g]}</span>;

/* ───────── 1) بطاقات «راجع الدفعة» ───────── */
export function ReviewCards({ reviews, token }: { reviews: any[]; token: Tok }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  async function open(c: any) { setBusy(c.classroom_id || c.program_id); setErr(''); const j = await api(token, '/api/reports', { action: 'create_review', program_id: c.program_id, classroom_id: c.classroom_id }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } window.location.href = `/me/reports/${j.report.id}`; }
  return <section className="pt-box" id="review" aria-labelledby="pv-h" data-testid="pv-cards"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="pv-h"><Icon name="refresh" size={18} /> {P47_NAMES_AR.review} <small className="pt-muted">— «{P47_NAMES_AR.story}»</small></h2>
    <p className="pt-muted">{P47_NAMES_AR.motto}. حين تكتمل الدفعة يضع أَثَر «{P47_NAMES_AR.promise}» بجوار «{P47_NAMES_AR.proven}» ويقترح تعديلات على النسخة القادمة — وتقرّر أنت على كلٍّ منها.</p>
    {err && <p className="mr-err" role="alert">{err}</p>}
    <ul className="pv-cards">{reviews.map(c => <li key={`${c.program_id}:${c.classroom_id}`} data-ready={c.ready ? '1' : '0'} data-testid="pv-card" data-status={c.review?.status || 'none'}>
      <div><b>{c.program_ar}</b>{c.classroom_ar ? <> · {c.classroom_ar}</> : null}<br /><small>{P47_NAMES_AR.cohort} {c.cohort_no} · {c.reason_ar}</small></div>
      {c.review ? <Link className="pt-btn navy small" href={`/me/reports/${c.review.id}`} data-testid="pv-open"><span className={`mr-chip ${TONE[c.review.status]}`}>{statusAr(c.review.status)}</span> افتح المراجعة{c.review.code ? <> · <span dir="ltr">{c.review.code}</span></> : null}</Link>
        : <button type="button" className="pt-btn gold small" onClick={() => open(c)} disabled={!!busy || !c.ready} data-testid="pv-create"><Icon name="plus" size={14} /> {busy === (c.classroom_id || c.program_id) ? '…' : P47_NAMES_AR.open}</button>}
      {c.review?.status === 'approved' && c.ready && <button type="button" className="pt-btn ghost small" onClick={() => open(c)} disabled={!!busy} data-testid="pv-again">مراجعة جديدة لدفعة لاحقة</button>}
    </li>)}</ul>
  </section>;
}

/* ───────── 2) المحرّر ───────── */
function Head({ r, c, mode, onBack, busy, dirty, editable, act, save, print, extra }: any) {
  return <section className="pt-box mr-head">
    <div className="mr-head-top">
      <div><span className="pt-kicker"><Icon name="refresh" size={14} /> {P47_NAMES_AR.review} · «{P47_NAMES_AR.story}»</span>{mode === 'admin' ? <h2 className="mr-h">{c.program_ar} — {P47_NAMES_AR.cohort} {c.cohort_no}</h2> : <h1>{c.program_ar} — {P47_NAMES_AR.cohort} {c.cohort_no}</h1>}<p className="pt-muted">{[c.classroom_ar, c.org_ar, c.trainer_ar].filter(Boolean).join(' · ')} · {fmtDayAr(c.period_from)} → {fmtDayAr(c.period_to)} · <span className={`mr-chip ${TONE[r.status]}`} data-testid="dr-status">{statusAr(r.status)}</span></p></div>
      <div className="mr-actions">
        {onBack ? <button className="pt-btn ghost small" type="button" onClick={onBack}><Icon name="arrow" size={14} /> القائمة</button> : <Link className="pt-btn ghost small" href="/me/reports#review"><Icon name="arrow" size={14} /> {P46_NAMES_AR.page}</Link>}
        {print && <button className="pt-btn ghost small" type="button" onClick={print} data-testid="dr-print"><Icon name="print" size={14} /> معاينة الطباعة</button>}
        {editable && <button className="pt-btn ghost small" type="button" onClick={() => act('recompute')} disabled={!!busy} data-testid="dr-recompute"><Icon name="refresh" size={14} /> {P46_NAMES_AR.recompute}</button>}
        {editable && <button className="pt-btn navy small" type="button" onClick={() => save()} disabled={!!busy || !dirty} data-testid="dr-save"><Icon name="save" size={14} /> {busy === 'save' ? '…' : dirty ? 'احفظ' : 'محفوظ'}</button>}
        {editable && mode === 'author' && <button className="pt-btn gold small" type="button" onClick={() => act('submit')} disabled={!!busy} data-testid="dr-submit"><Icon name="send" size={14} /> {P46_NAMES_AR.submit}</button>}
        {r.can_decide && <button className="pt-btn gold small" type="button" onClick={() => act('approve')} disabled={!!busy} data-testid="dr-approve"><Icon name="check" size={14} /> {P46_NAMES_AR.approve}</button>}
      </div>
    </div>
    {extra}
  </section>;
}
export function ReviewEditor({ id, token, mode = 'author', onBack }: { id: string; token: Tok; mode?: 'author' | 'admin'; onBack?: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [dirty, setDirty] = useState(false); const [body, setBody] = useState<ReviewBody | null>(null); const [sec, setSec] = useState(1); const [print, setPrint] = useState(false); const [note, setNote] = useState('');
  const load = useCallback(async () => { const j = await api(token, `/api/reports?id=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setBody(j.report.body); setDirty(false); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const r = d?.report; const c: ReviewComputed | null = r?.computed || null; const editable = !!r?.can_edit; const ro = !editable;
  const setB = (patch: Partial<ReviewBody>) => { setBody(b => (b ? { ...b, ...patch } : b)); setDirty(true); };
  const setDec = (pid: string, patch: Partial<{ decision: any; text_ar: string; reason_ar: string }>) => { setBody(b => (b ? { ...b, decisions: b.decisions.map(x => (x.proposal_id === pid ? { ...x, ...patch } : x)) } : b)); setDirty(true); };
  const missing = useMemo(() => (r?.missing || []) as string[], [r]);
  async function save(silent = false): Promise<boolean> { if (!body) return false; setBusy('save'); setErr(''); if (!silent) setOk(''); const j = await api(token, '/api/reports', { action: 'save', id, body }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل الحفظ'); return false; } setD((x: any) => ({ ...x, report: j.report })); setBody(j.report.body); setDirty(false); if (!silent) setOk('حُفظ'); return true; }
  async function act(action: string, extra: any = {}) { setBusy(action); setErr(''); setOk(''); if (dirty && ['submit', 'recompute', 'propose'].includes(action)) { const s = await save(true); if (!s) { setBusy(''); return; } } const j = await api(token, '/api/reports', { action, id, ...extra }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); setNote(action === 'propose' ? j.note_ar || '' : note); setOk(action === 'submit' ? 'أُرسلت — يعتمدها زميل من الطاقم غير الكاتب' : action === 'approve' ? `اعتُمدت — رمز التحقّق ${j.verify_code}` : action === 'return' ? 'أُعيدت بملاحظة' : action === 'propose' ? (j.source === 'ai' ? 'اقتراحات جديدة من الذكاء الاصطناعي — قرّر على كلٍّ منها' : 'اقتراحات محلية بقاعدة مُعلنة — قرّر على كلٍّ منها') : 'حُدِّثت الأرقام من أَثَر'); if (action === 'propose') setSec(2); }
  if (!d || !body || !c) return <main className="pt-main mr"><style dangerouslySetInnerHTML={{ __html: MR_CSS + DR_CSS + CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  if (print) return <ReviewDoc r={{ ...r, body }} onClose={() => setPrint(false)} />;
  const secs = [P47_NAMES_AR.promise + ' · ' + P47_NAMES_AR.proven, P47_NAMES_AR.proposals, P47_NAMES_AR.context]; const gc = gapCounts(c.gaps); const changes = reviewChanges(body, c);
  return <main className="pt-main mr mr-ed" data-testid="pv-editor" data-status={r.status}><style dangerouslySetInnerHTML={{ __html: MR_CSS + DR_CSS + CSS }} />
    <Head r={r} c={c} mode={mode} onBack={onBack} busy={busy} dirty={dirty} editable={editable} act={act} save={save} print={() => setPrint(true)}
      extra={<><DrReturn r={r} busy={busy} act={act} /><DrNotes r={r} err={err} ok={ok} />
        {r.status === 'approved' && <p className="mr-okbox" data-testid="pv-after">{changes.length ? `قُبل ${changes.length} من ${body.proposals.length} ${body.proposals.length === 1 ? 'اقتراح' : 'اقتراحات'} — تدخل «${P47_NAMES_AR.version}» القادمة من هذا البرنامج، وتظهر على صفحته العامّة بلا أسماء.` : `اعتُمدت المراجعة بلا تعديلات — البرنامج وفى بوعده في هذه الدفعة.`}</p>}
        {r.status === 'approved' && (r.can_apply || body.version?.id) && <VersionPanel id={id} token={token} body={body} cohort={c.cohort_no} onApplied={load} />}
        <div className="mr-kpis" data-testid="pv-kpis"><span className="b"><b>{gc.kept}</b> <small>{GAP_GRADE_AR.kept}</small></span><span className="o"><b>{gc.near}</b> <small>{GAP_GRADE_AR.near}</small></span><span><b>{gc.missed}</b> <small>{GAP_GRADE_AR.missed}</small></span><span><b>{c.proven.enrolled}</b> <small>مسجَّل · <b>{c.proven.attendance_pct ?? '—'}{c.proven.attendance_pct !== null ? '%' : ''}</b> حضور</small></span><span><b>{c.proven.hours}</b>/{c.promise.hours} <small>ساعة</small></span>{c.proven.completion_pct !== null && <span className="b"><b>{c.proven.completion_pct}%</b> <small>إتمام</small></span>}{c.previous.length > 0 && <span><b>{c.previous.length}</b> <small>{c.previous.length === 1 ? 'مراجعة سابقة' : 'مراجعات سابقة'}</small></span>}</div>
        <div className="mr-secs" role="tablist" aria-label="أقسام المراجعة">{secs.map((s, i) => <button key={s} type="button" className={sec === i + 1 ? 'on' : ''} onClick={() => setSec(i + 1)} role="tab" aria-selected={sec === i + 1} data-testid={`pv-sec-${i + 1}`}>{i + 1} · {s}</button>)}</div></>} />
    {sec === 1 && <section className="pt-box mr-sec" data-testid="pv-s1"><h3>١ · {P47_NAMES_AR.promise} مقابل {P47_NAMES_AR.proven} <small className="pt-muted">— جاهز من أَثَر · الوعد من {c.source === 'units' ? 'وحدات الدبلوم' : c.source === 'design' ? 'هندسة البرنامج' : 'قالب البرنامج'} · ما ثبت من التقارير المعتمَدة فقط</small></h3>
      {c.gaps.length ? <table className="pv-t" data-testid="pv-gaps"><thead><tr><th>البند</th><th>{P47_NAMES_AR.promise}</th><th>{P47_NAMES_AR.proven}</th><th>{P47_NAMES_AR.gap}</th><th>لماذا</th></tr></thead><tbody>{c.gaps.map(g => <tr key={g.target} data-testid="pv-gap" data-grade={g.grade}><th>{g.label_ar}</th><td>{g.promised_ar}</td><td>{g.proven_ar}</td><td><G g={g.grade} /></td><td className="pt-muted">{g.why_ar}</td></tr>)}</tbody></table> : <p className="pt-muted" data-testid="pv-nogaps">لا فجوات محسوبة بعد — لم تُعتمد تقارير وحدات أو ختامي لهذه الدفعة.</p>}
      <div className="pv-two" style={{ marginTop: '.8rem' }}>
        <div><h4><Icon name="book" size={14} /> الوحدات</h4>{c.proven.units.length ? <table className="pv-t"><thead><tr><th>#</th><th>الوحدة</th><th>ساعات</th><th>بلغه</th><th>قرارات</th><th>الرمز</th></tr></thead><tbody>{c.proven.units.map(u => <tr key={u.idx}><td>{u.idx}</td><th>{u.title_ar}</th><td>{u.hours_actual ?? '—'}/{u.hours_planned}</td><td>{u.outcome_pct === null ? (u.closed ? '—' : 'لم تُغلق') : `${u.outcome_pct}%`}</td><td className="pt-muted">{u.report_code ? `${u.decisions.completed} بلغ · ${u.decisions.support} دعم · ${u.decisions.repeat} يعيد` : '—'}</td><td dir="ltr">{u.report_code || '—'}</td></tr>)}</tbody></table> : <p className="pt-muted">لا وحدات في وعد هذا البرنامج — الفجوات على مستوى البرنامج والكفايات.</p>}</div>
        <div><h4><Icon name="star" size={14} /> الكفايات</h4>{c.proven.skills.length ? <table className="pv-t"><thead><tr><th>الكفاية</th><th>متوسط</th><th>أثبتها</th><th>مهمات</th><th>يوم مهارة</th></tr></thead><tbody>{c.proven.skills.map(s => <tr key={s.code}><th>{s.name_ar} <small className="pt-muted" dir="ltr">{s.code}</small></th><td>{s.avg === null ? '—' : `${s.avg}%`}</td><td>{s.proven_pct === null ? '—' : `${s.proven_pct}% من ${s.profiles}`}</td><td>{s.missions}</td><td>{s.cases}</td></tr>)}</tbody></table> : <p className="pt-muted">لا كفايات في قالب البرنامج.</p>}
          <p className="pt-muted" style={{ marginBottom: 0 }}>بعد البرنامج: {c.proven.after.stations} محطة ({c.proven.after.applied} طبّق أو طبّق جزئيًا) · {c.proven.after.letters} رسالة «أمانة»{c.proven.final_code ? <> · الختامي <span dir="ltr">{c.proven.final_code}</span></> : null}{c.proven.profiles ? ` · ${c.proven.profiles} كشف كفايات معتمَد` : ''}</p></div>
      </div>
      {c.previous.length > 0 && <p className="pt-muted" data-testid="pv-previous">المراجعات السابقة لهذا البرنامج: {c.previous.map(p => `${p.code} (${p.kept}/${p.near}/${p.missed} · قُبل ${p.accepted})`).join(' · ')} — البرنامج يُقارَن بذاته فقط.</p>}
    </section>}
    {sec === 2 && <section className="pt-box mr-sec" data-testid="pv-s2"><h3>٢ · {P47_NAMES_AR.proposals} و{P47_NAMES_AR.decisions} <small className="pt-muted">— أفعال محدّدة من قائمة مغلقة؛ لا يدخل التصميم إلا ما تقبله أو تعدّله</small></h3>
      {editable && <p className="pv-sum"><button type="button" className="pt-btn gold small" onClick={() => act('propose')} disabled={!!busy} data-testid="pv-propose"><Icon name="star" size={14} /> {busy === 'propose' ? '…' : body.proposals.length ? 'جدّد الاقتراحات' : P47_NAMES_AR.propose}</button>{body.proposals.length > 0 && <button type="button" className="pt-btn ghost small" onClick={() => act('propose', { local: true })} disabled={!!busy} data-testid="pv-propose-local">بالقاعدة المحلية فقط</button>}{note && <small className="pv-src" data-testid="pv-propose-note">{note}</small>}</p>}
      {!body.proposals.length && <p className="pt-muted" data-testid="pv-noprop">لا اقتراحات بعد. {editable ? `اضغط «${P47_NAMES_AR.propose}»: يقرأ أَثَر الفجوات ويقترح أفعالًا محدّدة — وتقرّر أنت.` : ''}</p>}
      {body.proposals.map(p => { const dec = body.decisions.find(x => x.proposal_id === p.id) || { proposal_id: p.id, decision: '' as const, text_ar: '', reason_ar: '' }; return <div key={p.id} className="pv-prop" data-testid="pv-prop" data-d={dec.decision || ''} data-action={p.action}>
        <h4>{REVIEW_ACTION_AR[p.action]}{p.value ? <>: {p.value}</> : null} <small>— {targetLabelAr(p.target, c)}</small> <small className="pv-src">{p.source === 'ai' ? 'اقتراح الذكاء الاصطناعي' : 'اقتراح بالقاعدة المحلية'}</small></h4>
        <p className="why"><b>لماذا:</b> {p.why_ar}</p>
        <div className="pv-dec" role="radiogroup" aria-label="قرارك">{REVIEW_DECISIONS.map(x => <label key={x} data-on={dec.decision === x ? '1' : '0'}><input type="radio" name={`dec-${p.id}`} checked={dec.decision === x} onChange={() => setDec(p.id, { decision: x })} disabled={ro} data-testid={`pv-dec-${x}`} /> {REVIEW_DECISION_AR[x]}</label>)}</div>
        {dec.decision === 'edit' && <label>صيغتك للتعديل<textarea value={dec.text_ar} onChange={e => setDec(p.id, { text_ar: e.target.value.slice(0, TEXT_MAX) })} readOnly={ro} maxLength={TEXT_MAX} placeholder="اكتب التعديل كما تريده أن يدخل النسخة القادمة" data-testid="pv-edit-text" /></label>}
        {dec.decision === 'reject' && <label>سبب الرفض (قصير)<input value={dec.reason_ar} onChange={e => setDec(p.id, { reason_ar: e.target.value.slice(0, SHORT_MAX) })} readOnly={ro} maxLength={SHORT_MAX} data-testid="pv-reject-reason" /></label>}
      </div>; })}
      {body.proposals.length > 0 && <p className="pt-muted" data-testid="pv-changes">سيدخل «{P47_NAMES_AR.version}» القادمة: <b>{changes.length}</b> من {body.proposals.length}.</p>}
    </section>}
    {sec === 3 && <section className="pt-box mr-sec" data-testid="pv-s3"><h3>٣ · {P47_NAMES_AR.context} <small className="pt-muted">— فقرة من المصمّم: سياق الدفعة الذي لا يظهر في الجداول</small></h3>
      <label>{P47_NAMES_AR.context}<textarea value={body.context_ar} onChange={e => setB({ context_ar: e.target.value.slice(0, TEXT_MAX) })} rows={4} readOnly={ro} maxLength={TEXT_MAX} placeholder="ما الذي جرى في هذه الدفعة ولا تقوله الأرقام؟ (ظرف · تغيير معلّم · دفعة صغيرة · …)" data-testid="pv-context" /></label>
      <label>ملاحظات إدارية (لا تظهر للعموم)<textarea value={body.admin} onChange={e => setB({ admin: e.target.value.slice(0, TEXT_MAX) })} rows={2} readOnly={ro} maxLength={TEXT_MAX} data-testid="pv-admin" /></label>
      {missing.length > 0 && r.status !== 'approved' && <p className="mr-missing">قبل الإرسال: {missing.join(' · ')}</p>}
      <p className="pt-muted">الحدّ الأدنى للسياق {REVIEW_CONTEXT_MIN} حرفًا.</p>
    </section>}
  </main>;
}

/* ───────── 3) المطبوع A4 ───────── */
/* ───────── 3-ب) P47-ب «نسخة الدفعة»: تطبيق ما قُبل على الوحدات كنسخة جديدة + «رسالة إلى الدفعة القادمة» ───────── */
function VersionPanel({ id, token, body, cohort, onApplied }: { id: string; token: Tok; body: ReviewBody; cohort: number; onApplied: () => Promise<void> }) {
  const [pv, setPv] = useState<any>(null); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [open, setOpen] = useState(false);
  const v = body.version;
  async function preview() { setBusy('preview'); setErr(''); const j = await api(token, '/api/reports', { action: 'version_preview', id }); setBusy(''); if (!j.success) { setErr(j.error || 'تعذّرت المعاينة'); return; } setPv(j); setMsg(j.message_ar || ''); setOpen(true); }
  async function apply() { if (!pv) return; const warn = pv.open_rooms > 0 ? `تنبيه: ${pv.open_rooms} ${pv.open_rooms === 1 ? 'شعبة لم تُراجَع بعد' : 'شعب لم تُراجَع بعد'} في هذه الدفعة — لا تطبّق إلا بعد انتهاء كل شعب الدفعة.\n\n` : ''; if (!window.confirm(`${warn}ستصبح وحدات البرنامج الحالية (${pv.plan.units.length - pv.plan.applied.filter((x: any) => x.action === 'split_unit').length}) نسخة مؤرشَفة، وتُنشأ النسخة ${pv.next_version} مفتوحة للدفعة القادمة. لا يُحذف شيء، وتقارير الوحدات المعتمَدة تبقى. أتطبّق؟`)) return; setBusy('apply'); setErr(''); const j = await api(token, '/api/reports', { action: 'apply_version', id, message_ar: msg }); if (!j.success) { setBusy(''); setErr(j.error || 'فشل التطبيق'); return; } await onApplied(); setBusy(''); setOpen(false); }
  if (v?.id) return <div className="pv-ver" data-testid="pv-version-done"><p className="ok"><Icon name="check" size={14} /> {P47B_NAMES_AR.applied} — النسخة {v.version} من هذا البرنامج مفتوحة للدفعة القادمة ({fmtDayAr(String(v.at || '').slice(0, 10))}). عدّل عناوين الوحدات أو رتّبها من <Link href="/me/reports">لوحة الوحدات</Link> إن احتجت.</p></div>;
  return <div className="pv-ver" data-testid="pv-version">
    <h4><Icon name="copy" size={15} /> {P47B_NAMES_AR.version} {!open && <button className="pt-btn gold small" type="button" onClick={preview} disabled={!!busy} data-testid="pv-apply-open">{busy === 'preview' ? '…' : P47B_NAMES_AR.apply}</button>}</h4>
    {!open && <small className="pt-muted">ما قبلتَه أعلاه يُطبَّق على وحدات البرنامج كنسخة جديدة مفتوحة للدفعة القادمة — بزرّ منك لا تلقائيًّا؛ الوحدات الحالية تُؤرشَف ولا تُحذف.</small>}
    {err && <p className="warn" data-testid="pv-version-err">{err}</p>}
    {open && pv && <>
      {pv.open_rooms > 0 && <p className="warn" data-testid="pv-version-warn">تنبيه: {pv.open_rooms} {pv.open_rooms === 1 ? 'شعبة لم تُراجَع بعد' : 'شعب لم تُراجَع بعد'} — لا تطبّق إلا بعد انتهاء كل شعب الدفعة.</p>}
      <div className="ba" data-testid="pv-version-ba"><span>النسخة <b>{pv.next_version}</b></span><span>الوحدات <b>{pv.plan.units.length}</b></span><span>الساعات <b>{pv.plan.hours}</b></span><span>الكفايات <b>{pv.plan.skills.length}</b></span></div>
      <div><b style={{ fontSize: '.88rem' }}>يُطبَّق آليًا ({pv.plan.applied.length})</b>{pv.plan.applied.length ? <ul data-testid="pv-version-applied">{pv.plan.applied.map((x: any, i: number) => <li key={i}><b>{x.target_ar}</b> · {x.action_ar} — <span className="pt-muted">{x.note_ar}</span></li>)}</ul> : <p className="pt-muted" style={{ margin: 0 }}>لا شيء آلي — النسخة تحفظ القرار وتفتح الوحدات من جديد.</p>}</div>
      {pv.plan.manual.length > 0 && <div><b style={{ fontSize: '.88rem' }}>{P47B_NAMES_AR.manual} ({pv.plan.manual.length})</b><ul className="m" data-testid="pv-version-manual">{pv.plan.manual.map((x: any, i: number) => <li key={i}><b>{x.target_ar}</b> · {x.action_ar} — {x.note_ar}</li>)}</ul></div>}
      <label style={{ fontSize: '.88rem', fontWeight: 800 }}>{P47B_NAMES_AR.message} <small className="pt-muted">— يراها متدرّبو الدفعة {cohort + 1} في صفحتهم وعلى صفحة البرنامج · بلا أسماء ({msg.length}/{VERSION_MESSAGE_MAX})</small>
        <textarea value={msg} onChange={e => setMsg(e.target.value.slice(0, VERSION_MESSAGE_MAX))} maxLength={VERSION_MESSAGE_MAX} rows={2} data-testid="pv-message" /></label>
      <div className="row"><button className="pt-btn gold small" type="button" onClick={apply} disabled={!!busy || msg.trim().length < VERSION_MESSAGE_MIN} data-testid="pv-apply"><Icon name="check" size={14} /> {busy === 'apply' ? '…' : `أصدر النسخة ${pv.next_version}`}</button><button className="pt-btn ghost small" type="button" onClick={() => setOpen(false)} disabled={!!busy}>ليس الآن</button></div>
    </>}
  </div>;
}
export function ReviewDoc({ r, onClose }: { r: any; onClose?: () => void }) {
  const c: ReviewComputed = r.computed; const b: ReviewBody = r.body; const gc = gapCounts(c.gaps); const ch = reviewChanges(b, c);
  return <main className="pt-main pr" data-testid="pv-doc"><style dangerouslySetInnerHTML={{ __html: MR_CSS + MR_PRINT_CSS }} />
    <div className="pr-bar">{onClose && <button type="button" className="pt-btn ghost small" onClick={onClose}><Icon name="arrow" size={14} /> عودة للمحرّر</button>}<button type="button" className="pt-btn navy small" onClick={() => window.print()}><Icon name="print" size={14} /> اطبع / احفظ PDF</button><small>A4 · {P47_NAMES_AR.official}</small></div>
    <article className="pr-page">
      <header className="pr-head"><div><h1>{P47_NAMES_AR.review} — {c.program_ar}</h1><p>{[c.org_ar, c.classroom_ar].filter(Boolean).join(' · ')} · {P47_NAMES_AR.cohort} {c.cohort_no} · {fmtDayAr(c.period_from)} → {fmtDayAr(c.period_to)}</p><p>{gc.kept} {GAP_GRADE_AR.kept} · {gc.near} {GAP_GRADE_AR.near} · {gc.missed} {GAP_GRADE_AR.missed} · {c.proven.enrolled} مسجَّل · حضور {c.proven.attendance_pct ?? '—'}% · {c.proven.hours}/{c.promise.hours} ساعة</p></div><div className="pr-meta"><span>المصمّم/المعلّم: {c.trainer_ar}</span>{r.verify_code && <span>رمز التحقّق: {r.verify_code}</span>}{r.approved_name && <span>اعتمدها: {r.approved_name}</span>}</div></header>
      <h2>١ · {P47_NAMES_AR.promise} مقابل {P47_NAMES_AR.proven}</h2>
      <table><thead><tr><th>البند</th><th>الوعد</th><th>ما ثبت</th><th>الفجوة</th><th>لماذا</th></tr></thead><tbody>{c.gaps.map(g => <tr key={g.target}><th>{g.label_ar}</th><td>{g.promised_ar}</td><td>{g.proven_ar}</td><td><b>{GAP_GRADE_AR[g.grade]}</b></td><td>{g.why_ar}</td></tr>)}</tbody></table>
      <h2>٢ · {P47_NAMES_AR.decisions}</h2>
      {b.proposals.length ? <table><thead><tr><th>الهدف</th><th>الاقتراح</th><th>لماذا</th><th>القرار</th><th>الصيغة/السبب</th></tr></thead><tbody>{b.proposals.map(p => { const d = b.decisions.find(x => x.proposal_id === p.id); return <tr key={p.id}><th>{targetLabelAr(p.target, c)}</th><td>{REVIEW_ACTION_AR[p.action]}{p.value ? `: ${p.value}` : ''}</td><td>{p.why_ar}</td><td><b>{d?.decision ? REVIEW_DECISION_AR[d.decision] : '—'}</b></td><td>{d?.decision === 'edit' ? d.text_ar : d?.decision === 'reject' ? d.reason_ar : ''}</td></tr>; })}</tbody></table> : <p className="pr-p">—</p>}
      <p className="pr-key">يدخل «{P47_NAMES_AR.version}» القادمة: {ch.length} من {b.proposals.length}.</p>
      <h2>٣ · {P47_NAMES_AR.context}</h2><p className="pr-p">{b.context_ar || '—'}</p>
      <footer className="pr-sign"><div><b>المصمّم/المعلّم</b><span>{c.trainer_ar}</span></div><div><b>اعتماد الطاقم</b><span>{r.approved_name || '…'}</span></div></footer>
      <p className="pr-foot">{P47_NAMES_AR.official} · أَثَر — {P47_NAMES_AR.motto}</p>
    </article>
  </main>;
}

/* ───────── 4) الشريط العام على صفحة البرنامج ───────── */
export function ProgramReviewStrip({ programId }: { programId: string }) {
  const [d, setD] = useState<any>(null); const [vs, setVs] = useState<any>(null);
  useEffect(() => { fetch(`/api/reports?reviews=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.success ? j : { n: 0 })).catch(() => setD({ n: 0 })); fetch(`/api/reports?versions=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setVs(j?.success ? j : { n: 0 })).catch(() => setVs({ n: 0 })); }, [programId]);   /* P47-ب: + سجلّ النسخ */
  if (!d || !d.n) return null; const last = vs?.n ? vs.versions[0] : null;
  return <section className="pv-strip" data-testid="pv-strip" aria-labelledby="pv-strip-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="pv-strip-h"><Icon name="refresh" size={16} /> {P47_NAMES_AR.changed} {d.n === 1 ? 'مرة' : d.n === 2 ? 'مرتين' : `${d.n} مرات`} بسبب دفعاته</h2>
    <small>«{P47_NAMES_AR.story}» — بعد كل دفعة يُقارَن وعد التصميم بما ثبت، ويعدَّل البرنامج بقرار إنسان. آخر مراجعة: {P47_NAMES_AR.cohort} {d.last.cohort_no} · {fmtDayAr(d.last.period_to)} · {d.last.kept} {GAP_GRADE_AR.kept} · {d.last.near} {GAP_GRADE_AR.near} · {d.last.missed} {GAP_GRADE_AR.missed} · <Link href={`/verify/report/${d.last.code}`}>تحقّق</Link></small>
    {d.last.changes?.length > 0 && <ul data-testid="pv-strip-changes">{d.last.changes.slice(0, 5).map((x: any, i: number) => <li key={i}><b>{x.target_ar}</b>: {x.text_ar}</li>)}</ul>}
    {last && <ul className="pv-vers" data-testid="pv-strip-versions">{vs.versions.slice(0, 4).map((v: any) => <li key={v.version}><span className="v">النسخة {v.version}</span><span>بعد {P47_NAMES_AR.cohort} {v.cohort_no} · {fmtDayAr(v.at)}</span>{v.units_before !== null && <span className="pt-muted">{v.units_before} → {v.units_after} وحدة · {v.hours_before} → {v.hours_after} ساعة</span>}{v.code && <Link href={`/verify/report/${v.code}`}>تحقّق</Link>}</li>)}</ul>}
    {last?.message_ar && <p className="pv-msg" data-testid="pv-strip-message"><b>{P47B_NAMES_AR.message}:</b> «{last.message_ar}»</p>}
  </section>;
}

/* ───────── 5) التحقّق العام ───────── */
export function VerifyReview({ d }: { d: any }) {
  return <div data-testid="pv-verify"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h1>{d.kind_ar} — {P47_NAMES_AR.cohort} {d.cohort_no}</h1>
    <table className="rp-t"><tbody><tr><th>البرنامج</th><td>{d.program_ar}{d.org_ar ? ` · ${d.org_ar}` : ''}</td></tr><tr><th>الفترة</th><td>{fmtDayAr(d.period_from)} → {fmtDayAr(d.period_to)}</td></tr><tr><th>الفجوات</th><td data-testid="pv-verify-counts">{d.kept} {GAP_GRADE_AR.kept} · {d.near} {GAP_GRADE_AR.near} · {d.missed} {GAP_GRADE_AR.missed}</td></tr><tr><th>كتبها</th><td>{d.author_name}</td></tr><tr><th>اعتمدها</th><td>{d.approved_name} · {fmtDayAr(String(d.approved_at || '').slice(0, 10))}</td></tr></tbody></table>
    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}>{(d.gaps || []).map((g: any, i: number) => <li key={i}><span className="pv-g" data-g={g.grade}>{g.grade_ar}</span> {g.label_ar}</li>)}</ul>
    <h2 style={{ fontSize: '1.05rem' }}>ما يدخل النسخة القادمة ({(d.changes || []).length}){d.rejected ? ` · رُفض ${d.rejected}` : ''}</h2>
    {(d.changes || []).length ? <ul data-testid="pv-verify-changes">{d.changes.map((x: any, i: number) => <li key={i}><b>{x.target_ar}</b>: {x.text_ar}</li>)}</ul> : <p className="pt-muted">لا تعديلات — البرنامج وفى بوعده.</p>}
    <p className="pt-muted">{P47_NAMES_AR.motto}. لا أسماء متدرّبين ولا أرقام أفراد في هذه الصفحة.</p>
  </div>;
}
