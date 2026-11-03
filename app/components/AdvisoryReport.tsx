'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 ر3-ب «محور التقارير» — التقرير الاستشاري («أثرُ الرأي»): رأي استشاري · دراسة — للمستشار على طلب استشارة (بعقد أو بلا عقد)
 *  <WorkCards>    داخل /me/reports              «مهماتي وطلباتي»: بطاقة لكل عقد تعاون أو طلب مكلَّف به — ثلاثة أزرار: تقرير إنجاز · رأي استشاري · دراسة (+ «نسخة جديدة» بعد الاعتماد)
 *  <DocEditor>    /me/reports/[id] · /admin      الرأي: السؤال · المعطيات · الخيارات (مزايا/مخاطر/شروط) · الرأي والتسويغ والخطوات الأولى · الاعتماد
 *                                                 الدراسة: ملخّص · المشكلة والأهداف · المنهجية · النتائج (بشواهد) · تحليل الفجوات · التوصيات المربوطة بالنتائج · خطة التنفيذ · الملاحق · الاعتماد
 *  <AdvisoryDoc>  المطبوع A4 + ما تراه الجهة     وثيقة واحدة للقراءة؛ كل توصية في نسخة الجهة لها زرّ «اطلب تنفيذها من أَثَر» يفتح طلب استشارة مُعبَّأً
 *  <ClientReport> /verify/report/[code]?k=        الجهة تقرأ (إنجاز · رأي · دراسة) وتقرّ بالاستلام — بلا دخول
 *  <ClientDocsBox> /consulting/[id]               «وثائق أَثَر المعتمَدة» على صفحة الطلب لصاحبه
 *  الذكاء الاصطناعي هنا واحد: «من نقاطي إلى فقرة» — يحوّل نقاط المستشار إلى فقرة بلا إضافة حقيقة أو رقم أو حكم؛ الرأي للمستشار؛ الاعتماد لزميل من الطاقم (لا لكاتبها)؛ الإقرار للجهة.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P46_NAMES_AR, MISSION_NAMES_AR, DOC_NAMES_AR, HORIZON, HORIZON_AR, PRIORITY, PRIORITY_AR, METHOD_TOOLS, METHOD_TOOL_AR, COST_AR, TEXT_MAX, LINE_MAX, SHORT_MAX, ACK_NOTE_MAX, ADDENDUM_MAX, ADV_MAX_ASSUMPTIONS, ADV_MAX_INPUTS, ADV_MAX_OPTIONS, ADV_MAX_STEPS, ADV_MAX_RISKS, ADV_RATIONALE_MAX, ADV_QUESTION_MAX, STU_MAX_OBJ, STU_MAX_Q, STU_MAX_FINDINGS, STU_MAX_KPIS, STU_MAX_GAPS, STU_MAX_RECS, STU_MAX_PHASES, STU_MAX_RISKS, STU_MAX_ANNEX, STU_READING_MAX, STU_SUMMARY_MAX, BULLETS_MAX_IN, fmtDayAr, type AdvisoryBody, type StudyBody, type RequestComputed } from '../../lib/reports/registry';
import { MissionDoc, MR_CSS, MR_PRINT_CSS } from './MissionReport';

type Tok = () => Promise<string>;
async function api(tok: Tok | null, path: string, body?: any) { const tk = tok ? await tok() : ''; const h: any = { 'Content-Type': 'application/json' }; if (tk) h.Authorization = `Bearer ${tk}`; const r = await fetch(path, body ? { method: 'POST', headers: h, body: JSON.stringify(body) } : { headers: h, cache: 'no-store' }); return r.json().catch(() => ({ success: false, error: 'استجابة غير صالحة' })); }
const fmtT = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '');
const TONE: Record<string, string> = { draft: 'g', submitted: 'b', approved: 't', returned: 'o' };
const upd = <O,>(o: O, path: (string | number)[], v: any): O => { const c: any = Array.isArray(o) ? [...(o as any)] : { ...(o as any) }; if (path.length === 1) { c[path[0]] = v; return c; } c[path[0]] = upd(c[path[0]] ?? (typeof path[1] === 'number' ? [] : {}), path.slice(1), v); return c; };
const STATUS_SHORT: Record<string, string> = { draft: 'مسودّة', submitted: 'بانتظار الاعتماد', approved: 'معتمَد', returned: 'أُعيد' };
const REQ_AR: Record<string, string> = { accepted: 'مقبول', in_progress: 'جارٍ', completed: 'مُنجَز', active: 'جارٍ', settled: 'سُوّي' };
const ADV_SECS = ['بيانات الطلب', 'السؤال الاستشاري', 'المعطيات', 'الخيارات', 'الرأي والخطوات الأولى', 'الاعتماد'];
const STU_SECS = ['بيانات الطلب', 'الملخّص التنفيذي', 'المشكلة والأهداف', 'المنهجية', 'النتائج', 'تحليل الفجوات', 'التوصيات', 'خطة التنفيذ والملاحق', 'الاعتماد'];
const kindAr = (k: string) => (k === 'advisory' ? DOC_NAMES_AR.advisory : k === 'study' ? DOC_NAMES_AR.study : P46_NAMES_AR.mission);
/** رابط «اطلب تنفيذها من أَثَر»: طلب استشارة مُعبَّأ بعنوان التوصية ومصدرها */
export const recToRequestHref = (text: string, code: string, title: string) => `/consulting?title=${encodeURIComponent(text.slice(0, 120))}&from=${encodeURIComponent(code)}&details=${encodeURIComponent(`تنفيذ توصية وردت في وثيقة أَثَر المعتمَدة ${code} («${title}»): ${text}`.slice(0, 600))}`;

/* ───────── 1) بطاقات «مهماتي وطلباتي» ───────── */
export function WorkCards({ work, token, admin = false }: { work: any[]; token: Tok; admin?: boolean }) {
  const [busy, setBusy] = useState(''); const [err, setErr] = useState('');
  async function start(c: any, kind: 'mission' | 'advisory' | 'study') {
    const key = `${c.engagement_id || c.request_id}:${kind}`; setBusy(key); setErr('');
    const src = c.engagement_id ? { engagement_id: c.engagement_id } : { consulting_request_id: c.request_id };
    const j = await api(token, '/api/reports', kind === 'mission' ? { action: 'create_mission', ...src } : { action: 'create_doc', kind, ...src }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; }
    window.location.href = admin ? `/admin/reports?r=${j.report.id}` : `/me/reports/${j.report.id}`;
  }
  const btn = (c: any, kind: 'mission' | 'advisory' | 'study') => { const d = c[kind]; const key = `${c.engagement_id || c.request_id}:${kind}`; const open = (id: string) => (admin ? `/admin/reports?r=${id}` : `/me/reports/${id}`);
    return <span className="ad-kbtn" key={kind} data-testid={`ad-k-${kind}`} data-approved={d.approved}>
      {d.open ? <Link className="pt-btn navy small" href={open(d.open.id)} data-testid={`ad-open-${kind}`}>{kindAr(kind)} · {STATUS_SHORT[d.open.status] || d.open.status}</Link>
        : kind === 'mission' && d.last ? <Link className="pt-btn ghost small" href={open(d.last.id)} data-testid="ad-open-mission">{kindAr(kind)} · معتمَد</Link>
          : c.can_write ? <button className={`pt-btn ${d.last ? 'ghost' : 'gold'} small`} type="button" onClick={() => start(c, kind)} disabled={busy === key} data-testid={`ad-start-${kind}`}><Icon name="plus" size={14} /> {busy === key ? '…' : d.last ? `${DOC_NAMES_AR.new_version} من ${kindAr(kind)}` : kind === 'mission' ? MISSION_NAMES_AR.start : kind === 'advisory' ? DOC_NAMES_AR.new_advisory : DOC_NAMES_AR.new_study}</button> : null}
      {d.approved > 0 && kind !== 'mission' && d.last && <Link className="ad-mini" href={open(d.last.id)} title="آخر نسخة معتمَدة">{d.approved} معتمَدة{d.last.code ? ` · ${d.last.code}` : ''}</Link>}
    </span>; };
  return <section className="pt-box mr ad-cards" data-testid="ad-cards"><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} />
    <h2><Icon name="shield" size={18} /> {DOC_NAMES_AR.work} <span className="mr-story">«{MISSION_NAMES_AR.story}» · «{DOC_NAMES_AR.story}»</span></h2>
    <p className="pt-muted">لكل عقد تعاون أو طلب استشارة مكلَّف به ثلاث وثائق ممكنة: <b>{P46_NAMES_AR.mission}</b> (ما سُلِّم مقابل ما وُعد)، و<b>{DOC_NAMES_AR.advisory}</b> (سؤال واحد وخيارات ورأي)، و<b>{DOC_NAMES_AR.study}</b> (نتائج بشواهد وتوصيات مربوطة بها). بيانات الطلب تُسحب؛ وأنت تكتب الحكم. الأجر لا يدخل أي وثيقة.</p>
    <ul className="mr-cardl">{work.map(c => <li key={c.engagement_id || c.request_id} data-testid="ad-card" data-src={c.src} data-status={c.status}>
      <div className="mr-cardh"><b>{c.title_ar}</b><span>{c.kind_ar}{c.org_ar ? ` · ${c.org_ar}` : ''}</span></div>
      <small className="pt-muted">{c.start_at ? `${fmtDayAr(String(c.start_at).slice(0, 10))} → ${c.end_at ? fmtDayAr(String(c.end_at).slice(0, 10)) : '…'}` : 'بلا تاريخ'} · {c.src === 'eng' ? `عقد تعاون: ${REQ_AR[c.status] || c.status}` : `طلب بلا عقد: ${REQ_AR[c.status] || c.status}`}{c.code ? <> · <span dir="ltr">{c.code}</span></> : ''}{c.request_id && admin ? <> · <Link href={`/admin/consulting`}>الطلب</Link></> : ''}</small>
      <div className="mr-cardf ad-cardf">{btn(c, 'mission')}{btn(c, 'advisory')}{btn(c, 'study')}</div>
    </li>)}</ul>
    {!work.length && <p className="pt-muted" data-testid="ad-nowork">لا عقود موقَّعة ولا طلبات مكلَّف بها بعد.</p>}
    {err && <p className="mr-err" role="alert">{err}</p>}
  </section>;
}

/* ───────── «من نقاطي إلى فقرة» ───────── */
function BulletsBox({ id, token, section, onAdopt, disabled }: { id: string; token: Tok; section: string; onAdopt: (t: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [out, setOut] = useState<{ text: string; note_ar: string; source: string } | null>(null); const [err, setErr] = useState('');
  async function go() { setBusy(true); setErr(''); setOut(null); const j = await api(token, '/api/reports', { action: 'bullets_to_paragraph', id, text, section }); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } setOut({ text: j.text || '', note_ar: j.note_ar || '', source: j.source || '' }); }
  if (disabled) return null;
  return <div className="ad-bul" data-testid="ad-bullets"><button type="button" className="pt-btn ghost small" onClick={() => setOpen(o => !o)} data-testid="ad-bullets-toggle"><Icon name="spark" size={14} /> {DOC_NAMES_AR.bullets}</button>
    {open && <div className="mr-ai"><small>اكتب نقاطك سطرًا سطرًا؛ يصوغها الذكاء الاصطناعي فقرة <b>بلا إضافة حقيقة أو رقم أو حكم</b> ولا تُحفظ حتى تعتمدها.</small>
      <textarea value={text} onChange={e => setText(e.target.value.slice(0, BULLETS_MAX_IN))} rows={4} placeholder={'- النقطة الأولى\n- النقطة الثانية'} data-testid="ad-bullets-in" />
      <div className="mr-row"><button type="button" className="pt-btn navy small" onClick={go} disabled={busy || text.trim().length < 15} data-testid="ad-bullets-go">{busy ? '…' : 'صُغ فقرة'}</button>{err && <span className="mr-err">{err}</span>}</div>
      {out && <div className="ad-bulout" data-testid="ad-bullets-out"><p>{out.text}</p><div className="mr-row"><button type="button" className="pt-btn gold small" onClick={() => { onAdopt(out.text); setOut(null); setText(''); setOpen(false); }} data-testid="ad-bullets-adopt">أعتمد ←</button><small>{out.note_ar}</small></div></div>}
    </div>}
  </div>;
}

/* ───────── 2) المحرّر (رأي · دراسة) ───────── */
export function DocEditor({ id, token, mode = 'author', onBack }: { id: string; token: Tok; mode?: 'author' | 'admin'; onBack?: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [dirty, setDirty] = useState(false);
  const [body, setBody] = useState<any>(null); const [sec, setSec] = useState(1); const [print, setPrint] = useState(false); const [retNote, setRetNote] = useState(''); const [clientEmail, setClientEmail] = useState(''); const [addText, setAddText] = useState(''); const [sentUrl, setSentUrl] = useState('');
  const load = useCallback(async () => { const j = await api(token, `/api/reports?id=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setBody(j.report.body); setDirty(false); setClientEmail(x => x || j.report.computed?.client_sent_to || j.report.computed?.client_email || ''); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const r = d?.report; const c: RequestComputed | null = r?.computed || null; const kind: string = r?.kind || ''; const adv = kind === 'advisory'; const editable = !!r?.can_edit; const ro = !editable; const SECS = adv ? ADV_SECS : STU_SECS; const N = SECS.length;
  const setB = (path: (string | number)[], v: any) => { setBody((b: any) => (b ? upd(b, path, v) : b)); setDirty(true); };
  async function save(silent = false): Promise<boolean> { if (!body) return false; setBusy('save'); setErr(''); if (!silent) setOk(''); const j = await api(token, '/api/reports', { action: 'save', id, body }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل الحفظ'); return false; } setD((x: any) => ({ ...x, report: j.report })); setBody(j.report.body); setDirty(false); if (!silent) setOk('حُفظ'); return true; }
  async function act(action: string, extra: any = {}) { setBusy(action); setErr(''); setOk(''); if (dirty && ['submit', 'recompute'].includes(action)) { const s = await save(true); if (!s) { setBusy(''); return; } } const j = await api(token, '/api/reports', { action, id, ...extra }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); if (action === 'send_client') setSentUrl(j.url || ''); setOk(action === 'submit' ? 'أُرسل — بانتظار اعتماد زميل من الطاقم' : action === 'approve' ? `اعتُمد — رمز التحقّق ${j.verify_code}` : action === 'return' ? 'أُعيد بملاحظة' : action === 'send_client' ? `أُرسل إلى ${j.to}` : action === 'addendum' ? 'أُلحق التصويب' : 'حُدِّثت بيانات الطلب'); if (action === 'addendum') setAddText(''); }
  if (!d || !body || !c) return <main className="pt-main mr"><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const S = d.status_ar; const title = `${c.title}${c.org_ar ? ` — ${c.org_ar}` : ''}`; const consistency: string[] = r.consistency || [];
  const inp = (path: (string | number)[], v: string, ph = '', max = TEXT_MAX, rows = 0, tid?: string) => rows ? <textarea value={v || ''} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} rows={rows} maxLength={max} readOnly={ro} data-testid={tid} /> : <input value={v || ''} onChange={e => setB(path, e.target.value.slice(0, max))} placeholder={ph} maxLength={max} readOnly={ro} data-testid={tid} />;
  const strList = (path: (string | number)[], list: string[], max: number, ph: string, tid: string) => <div className="mr-list" data-testid={tid}>{list.map((t, i) => <div key={i} className="mr-li">{inp([...path, i], t, ph, LINE_MAX)}{editable && <button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(path, list.filter((_, j) => j !== i))}>×</button>}</div>)}{editable && list.length < max && <button type="button" className="pt-btn ghost small" onClick={() => setB(path, [...list, ''])} data-testid={`${tid}-add`}><Icon name="plus" size={14} /> أضف</button>}</div>;
  const sel = (path: (string | number)[], v: string, opts: readonly string[], ar: Record<string, string>, tid?: string) => <select value={v || ''} onChange={e => setB(path, e.target.value)} disabled={ro} data-testid={tid}><option value="">—</option>{opts.map(o => <option key={o} value={o}>{ar[o]}</option>)}</select>;
  const bullets = (section: string, path: (string | number)[], cur: string, max: number) => <BulletsBox id={id} token={token} section={section} disabled={!editable} onAdopt={t => setB(path, (cur ? cur + ' ' + t : t).slice(0, max))} />;
  const approvalBlock = <section className="pt-box mr-sec" data-testid="ad-s-approval"><h2>{N}. الاعتماد — زميل من الطاقم يعتمد (لا كاتب الوثيقة)، والجهة تقرّ بالاستلام</h2>
    <table className="mr-t"><tbody><tr><th>المستشار</th><td>{r.author_name}{r.submitted_at ? ` · أرسل ${fmtT(r.submitted_at)}` : ' · لم يُرسل بعد'}</td></tr><tr><th>اعتماد أَثَر</th><td>{r.status === 'approved' ? `${r.approved_name} · ${fmtT(r.approved_at)} · رمز ${r.verify_code}` : S[r.status]}</td></tr><tr><th>{MISSION_NAMES_AR.ack}</th><td data-testid="ad-ack-state">{body.ack ? <><b>{body.ack.name}</b> · {fmtT(body.ack.at)}{body.ack.note ? <> · «{body.ack.note}»</> : ''}</> : r.client_sent_at ? `أُرسل للجهة ${fmtT(r.client_sent_at)} — بانتظار الإقرار` : 'لم يُرسل للجهة بعد'}</td></tr>{r.supersedes_id && <tr><th>{DOC_NAMES_AR.supersedes}</th><td>نسخة معتمَدة سابقة من {kindAr(kind)} — تُعلَّم «{DOC_NAMES_AR.superseded}» عند اعتماد هذه النسخة <Link href={mode === 'admin' ? `/admin/reports?r=${r.supersedes_id}` : `/me/reports/${r.supersedes_id}`}>افتحها</Link></td></tr>}{body.superseded_by && <tr><th>{DOC_NAMES_AR.superseded}</th><td data-testid="ad-superseded">حلّت محلّها نسخة أحدث · رمز <span dir="ltr">{body.superseded_by.code}</span> · {fmtT(body.superseded_by.at)}</td></tr>}</tbody></table>
    {r.can_send_client && <div className="mr-client" data-testid="ad-send"><h3><Icon name="mail" size={16} /> {MISSION_NAMES_AR.send_client} — رابط قراءة وإقرار بلا دخول</h3><div className="mr-row"><input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="بريد الجهة" data-testid="ad-client-email" /><button className="pt-btn gold small" type="button" onClick={() => act('send_client', { email: clientEmail })} disabled={!!busy || !clientEmail} data-testid="ad-send-client"><Icon name="send" size={14} /> {r.client_sent_at ? 'أعد الإرسال' : MISSION_NAMES_AR.send_client}</button></div>{sentUrl && <p className="mr-note" data-testid="ad-sent-url">الرابط: <a href={sentUrl} dir="ltr">{sentUrl}</a></p>}</div>}
    {r.can_addendum && <div className="mr-client" data-testid="ad-addendum"><h3><Icon name="doc" size={16} /> {MISSION_NAMES_AR.addendum} — يظهر مؤرَّخًا أسفل الوثيقة دون مسّ الأصل</h3><div className="mr-row"><input value={addText} onChange={e => setAddText(e.target.value.slice(0, ADDENDUM_MAX))} placeholder="نصّ التصويب…" data-testid="ad-addendum-text" /><button className="pt-btn ghost small" type="button" onClick={() => act('addendum', { text: addText })} disabled={!!busy || addText.trim().length < 10} data-testid="ad-addendum-btn">ألحِق</button></div></div>}
    {body.addenda?.length > 0 && <ul className="mr-addenda" data-testid="ad-addenda">{body.addenda.map((a: any, i: number) => <li key={i}><small>{fmtT(a.at)} · {a.by}</small><p>{a.text}</p></li>)}</ul>}
    <p className="mr-key">اعتماد {kindAr(kind)} لا يغيّر حالة الطلب (الطلب يُنهيه {P46_NAMES_AR.mission}). بعد الاعتماد تظهر الوثيقة للجهة في صفحة طلبها تحت «{DOC_NAMES_AR.client_docs}»، وتُحتسب للمستشار في «ما شهده أَثَر»: «{DOC_NAMES_AR.docs_written}». التعديل بعد الاعتماد = «{DOC_NAMES_AR.new_version}» تحمل رمزًا جديدًا وتَنسخ السابقة.</p>
  </section>;
  if (print) return <AdvisoryDoc r={{ ...r, body }} onClose={() => setPrint(false)} />;
  const ab = body as AdvisoryBody; const sb = body as StudyBody;
  return <main className="pt-main mr mr-ed ad-ed" data-testid="ad-editor" data-kind={kind} data-status={r.status}><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} />
    <section className="pt-box mr-head">
      <div className="mr-head-top">
        <div><span className="pt-kicker"><Icon name="shield" size={14} /> {DOC_NAMES_AR.umbrella} · «{DOC_NAMES_AR.story}» · {kindAr(kind)}</span>{mode === 'admin' ? <h2 className="mr-h">{title}</h2> : <h1>{title}</h1>}<p className="pt-muted">{c.engagement_code ? <>عقد التعاون <span dir="ltr">{c.engagement_code}</span></> : 'طلب استشارة بلا عقد'}{c.requested_at ? ` · قُدِّم ${fmtDayAr(c.requested_at)}` : ''} · {c.consultant_name} · <span className={`mr-chip ${TONE[r.status]}`} data-testid="ad-status">{S[r.status]}</span>{body.superseded_by && <> · <span className="mr-chip o">{DOC_NAMES_AR.superseded}</span></>}</p></div>
        <div className="mr-actions">
          {onBack ? <button className="pt-btn ghost small" type="button" onClick={onBack}><Icon name="arrow" size={14} /> القائمة</button> : <Link className="pt-btn ghost small" href="/me/reports"><Icon name="arrow" size={14} /> تقاريري</Link>}
          <button className="pt-btn ghost small" type="button" onClick={() => setPrint(true)} data-testid="ad-print"><Icon name="print" size={14} /> معاينة الطباعة</button>
          {editable && <button className="pt-btn ghost small" type="button" onClick={() => act('recompute')} disabled={!!busy} data-testid="ad-recompute"><Icon name="refresh" size={14} /> {P46_NAMES_AR.recompute}</button>}
          {editable && <button className="pt-btn navy small" type="button" onClick={() => save()} disabled={!!busy || !dirty} data-testid="ad-save"><Icon name="save" size={14} /> {busy === 'save' ? '…' : dirty ? 'احفظ' : 'محفوظ'}</button>}
          {editable && mode === 'author' && <button className="pt-btn gold small" type="button" onClick={() => act('submit')} disabled={!!busy} data-testid="ad-submit"><Icon name="send" size={14} /> {P46_NAMES_AR.submit}</button>}
          {r.can_decide && <button className="pt-btn gold small" type="button" onClick={() => act('approve')} disabled={!!busy} data-testid="ad-approve"><Icon name="check" size={14} /> {P46_NAMES_AR.approve}</button>}
        </div>
      </div>
      {r.can_decide && <div className="mr-return"><input value={retNote} onChange={e => setRetNote(e.target.value.slice(0, 400))} placeholder="ملاحظة الإعادة للمستشار…" data-testid="ad-return-note" /><button className="pt-btn ghost small" type="button" onClick={() => act('return', { note: retNote })} disabled={!!busy || retNote.trim().length < 3} data-testid="ad-return"><Icon name="arrow" size={14} /> {P46_NAMES_AR.return}</button></div>}
      {r.status === 'submitted' && !r.can_decide && d.me?.staff && <p className="mr-missing" data-testid="ad-self">كاتب الوثيقة لا يعتمدها بنفسه — يعتمدها زميل من الطاقم أو مدير المنصة.</p>}
      {r.status === 'returned' && r.return_note && <p className="mr-retbox" data-testid="ad-returned">أُعيد بملاحظة: {r.return_note}</p>}
      {r.status === 'approved' && <p className="mr-okbox" data-testid="ad-approved">معتمَد · {r.approved_name} · {fmtT(r.approved_at)} · رمز التحقّق <b dir="ltr">{r.verify_code}</b> · <Link href={`/verify/report/${r.verify_code}`}>صفحة التحقّق</Link>{body.ack ? <> · <b>{MISSION_NAMES_AR.ack}</b>: {body.ack.name} · {fmtT(body.ack.at)}</> : r.client_sent_at ? ` · أُرسل للجهة ${fmtT(r.client_sent_at)} — بانتظار الإقرار` : ''}</p>}
      {editable && r.missing?.length > 0 && <p className="mr-missing" data-testid="ad-missing">قبل الإرسال يلزم: {r.missing.join(' · ')}</p>}
      {!adv && consistency.length > 0 && <p className="ad-cons" data-testid="ad-consistency"><b>{DOC_NAMES_AR.consistency}:</b> {consistency.join(' · ')}</p>}
      {!adv && !consistency.length && r.status !== 'draft' && <p className="ad-cons ok" data-testid="ad-consistency-ok"><b>{DOC_NAMES_AR.consistency}:</b> كل توصية مربوطة، وكل نتيجة بشاهد، وكل فجوة بأولوية.</p>}
      <nav className="mr-secs" aria-label="أقسام الوثيقة">{SECS.map((s, i) => <button key={s} type="button" className={sec === i + 1 ? 'on' : ''} onClick={() => setSec(i + 1)} data-testid={`ad-sec-${i + 1}`}>{i + 1}. {s}</button>)}</nav>
    </section>

    {sec === 1 && <section className="pt-box mr-sec" data-testid="ad-s1"><h2>١. بيانات الطلب — من طلب الاستشارة{c.engagement_code ? ' وعقد التعاون' : ''} وعرض السعر المقبول</h2>
      <table className="mr-t"><tbody>
        <tr><th>العنوان</th><td>{c.title}</td><th>الجهة</th><td>{c.org_ar || '—'}{c.sector ? ` · ${c.sector}` : ''}{c.area ? ` · ${c.area}` : ''}</td></tr>
        <tr><th>المستشار</th><td>{c.consultant_name}{c.consultant_title ? ` — ${c.consultant_title}` : ''}</td><th>حالة الطلب</th><td>{REQ_AR[c.request_status] || c.request_status || '—'}{c.requested_at ? ` · قُدِّم ${fmtDayAr(c.requested_at)}` : ''}</td></tr>
        <tr><th>تفاصيل الطلب</th><td colSpan={3}>{c.details || '—'}</td></tr>
        {(c.goals || c.timeline) && <tr><th>الأهداف والجدول</th><td colSpan={3}>{c.goals || '—'}{c.timeline ? ` — الجدول المطلوب: ${c.timeline}` : ''}</td></tr>}
        {c.quote_scope && <tr><th>نطاق العرض المقبول</th><td colSpan={3}>{c.quote_scope}{c.quote_duration ? ` — المدة: ${c.quote_duration}` : ''}{c.quote_deliverables.length ? <ul className="pr-ul">{c.quote_deliverables.map((x, i) => <li key={i}>{x}</li>)}</ul> : null}</td></tr>}
        {c.milestones.length > 0 && <tr><th>المراحل</th><td colSpan={3}>{c.milestones.map(m => `${m.title} (${m.status === 'done' ? 'منجَزة' : m.status === 'in_progress' ? 'جارية' : 'مخطَّطة'})`).join(' · ')}</td></tr>}
      </tbody></table>
      <p className="mr-key">هذه البيانات تُسحب من أَثَر ولا تُحرَّر هنا — «{P46_NAMES_AR.recompute}» يعيد سحبها. آخر سحب: {fmtT(c.at)}.</p>
    </section>}

    {adv && sec === 2 && <section className="pt-box mr-sec" data-testid="ad-s2"><h2>٢. السؤال الاستشاري — سؤال واحد واضح يُجاب عنه في هذه الوثيقة</h2>
      <label className="mr-lbl">السؤال (≤ {ADV_QUESTION_MAX} حرفًا){inp(['question', 'text'], ab.question.text, 'مثال: هل تُنشئ الجهة وحدة جودة مستقلة أم تُدمجها في التخطيط؟', ADV_QUESTION_MAX, 2, 'ad-q')}</label>
      <h3>الافتراضات التي بُني عليها الرأي (≤ {ADV_MAX_ASSUMPTIONS})</h3>{strList(['question', 'assumptions'], ab.question.assumptions, ADV_MAX_ASSUMPTIONS, 'افتراض', 'ad-assume')}
      <label className="mr-lbl">حدود الرأي (ما لا يغطّيه){inp(['question', 'limits'], ab.question.limits, 'مثال: لا يتناول الجانب المالي', LINE_MAX)}</label>
    </section>}
    {adv && sec === 3 && <section className="pt-box mr-sec" data-testid="ad-s3"><h2>٣. المعطيات — ما اطّلع عليه المستشار (≤ {ADV_MAX_INPUTS}) بمصدره</h2>
      <div className="mr-list" data-testid="ad-inputs">{ab.inputs.items.map((x, i) => <div key={i} className="mr-li mr-li2">{inp(['inputs', 'items', i, 'text'], x.text, 'المعطى', LINE_MAX)}{inp(['inputs', 'items', i, 'source'], x.source, 'المصدر (وثيقة · مقابلة · بيانات أَثَر)', SHORT_MAX)}{editable && <button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['inputs', 'items'], ab.inputs.items.filter((_, j) => j !== i))}>×</button>}</div>)}{editable && ab.inputs.items.length < ADV_MAX_INPUTS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['inputs', 'items'], [...ab.inputs.items, { text: '', source: '' }])} data-testid="ad-add-input"><Icon name="plus" size={14} /> معطى</button>}</div>
    </section>}
    {adv && sec === 4 && <section className="pt-box mr-sec" data-testid="ad-s4"><h2>٤. الخيارات — خياران على الأقل (≤ {ADV_MAX_OPTIONS})، لكلٍّ مزاياه ومخاطره وشروط نجاحه</h2>
      <div className="ad-opts" data-testid="ad-options">{ab.options.items.map((o, i) => <div key={i} className="ad-opt" data-testid="ad-opt" data-chosen={ab.opinion.chosen === i}><div className="mr-row"><b>الخيار {i + 1}</b>{ab.opinion.chosen === i && <span className="mr-chip t">الموصى به</span>}{editable && <button type="button" className="mr-x" aria-label="حذف" onClick={() => { setB(['options', 'items'], ab.options.items.filter((_, j) => j !== i)); if (ab.opinion.chosen === i) setB(['opinion', 'chosen'], null); }}>×</button>}</div>
        <label className="mr-lbl">العنوان{inp(['options', 'items', i, 'title'], o.title, 'مثال: وحدة جودة مستقلة', SHORT_MAX, 0, 'ad-opt-title')}</label>
        <label className="mr-lbl">الوصف{inp(['options', 'items', i, 'desc'], o.desc, '', TEXT_MAX, 2)}</label>
        <div className="ad-3"><label className="mr-lbl">المزايا{inp(['options', 'items', i, 'pros'], o.pros, '', LINE_MAX, 2, 'ad-opt-pros')}</label><label className="mr-lbl">المخاطر/الكلفة{inp(['options', 'items', i, 'cons'], o.cons, '', LINE_MAX, 2, 'ad-opt-cons')}</label><label className="mr-lbl">شروط النجاح{inp(['options', 'items', i, 'conditions'], o.conditions, '', LINE_MAX, 2)}</label></div>
      </div>)}</div>
      {editable && ab.options.items.length < ADV_MAX_OPTIONS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['options', 'items'], [...ab.options.items, { title: '', desc: '', pros: '', cons: '', conditions: '' }])} data-testid="ad-add-opt"><Icon name="plus" size={14} /> خيار</button>}
      <p className="mr-key">الرأي بلا خيارات مكتوبة ليس رأيًا؛ الجهة تقرأ البدائل التي استُبعدت ولماذا.</p>
    </section>}
    {adv && sec === 5 && <section className="pt-box mr-sec" data-testid="ad-s5"><h2>٥. الرأي — الخيار الموصى به، وتسويغه، وخطواته الأولى</h2>
      <div className="mr-row"><label>الخيار الموصى به <select value={ab.opinion.chosen === null ? '' : String(ab.opinion.chosen)} onChange={e => setB(['opinion', 'chosen'], e.target.value === '' ? null : Number(e.target.value))} disabled={ro} data-testid="ad-chosen"><option value="">—</option>{ab.options.items.map((o, i) => <option key={i} value={i}>{i + 1}. {o.title || 'بلا عنوان'}</option>)}</select></label></div>
      <label className="mr-lbl">التسويغ (≤ {ADV_RATIONALE_MAX} حرفًا) — لماذا هذا الخيار دون غيره{inp(['opinion', 'rationale'], ab.opinion.rationale, 'بالنظر إلى…', ADV_RATIONALE_MAX, 5, 'ad-rationale')}</label>
      {bullets('التسويغ', ['opinion', 'rationale'], ab.opinion.rationale, ADV_RATIONALE_MAX)}
      <h3>الخطوات الأولى (≤ {ADV_MAX_STEPS}) — بأفق ومسؤول</h3>
      <div className="mr-scroll"><table className="mr-t" data-testid="ad-steps"><thead><tr><th>#</th><th>الخطوة</th><th>الأفق</th><th>المسؤول</th>{editable && <th />}</tr></thead><tbody>{ab.opinion.first_steps.map((s, i) => <tr key={i} data-testid="ad-step"><td>{i + 1}</td><td>{inp(['opinion', 'first_steps', i, 'text'], s.text, 'الخطوة', LINE_MAX)}</td><td>{sel(['opinion', 'first_steps', i, 'horizon'], s.horizon, HORIZON, HORIZON_AR)}</td><td>{inp(['opinion', 'first_steps', i, 'owner'], s.owner, 'من', SHORT_MAX)}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['opinion', 'first_steps'], ab.opinion.first_steps.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table></div>
      {editable && ab.opinion.first_steps.length < ADV_MAX_STEPS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['opinion', 'first_steps'], [...ab.opinion.first_steps, { text: '', horizon: '', owner: '' }])} data-testid="ad-add-step"><Icon name="plus" size={14} /> خطوة</button>}
      <h3>مخاطر الخيار الموصى به وكيف تُدار (≤ {ADV_MAX_RISKS})</h3>{strList(['opinion', 'risks'], ab.opinion.risks, ADV_MAX_RISKS, 'الخطر — وكيف يُدار', 'ad-risks')}
    </section>}
    {adv && sec === 6 && approvalBlock}

    {!adv && sec === 2 && <section className="pt-box mr-sec" data-testid="ad-s2"><h2>٢. الملخّص التنفيذي — ما وجدته الدراسة وما توصي به، في صفحة واحدة</h2>
      <label className="mr-lbl">الملخّص (≤ {STU_SUMMARY_MAX} حرفًا){inp(['summary', 'executive'], sb.summary.executive, 'هدفت الدراسة إلى…', STU_SUMMARY_MAX, 7, 'ad-exec')}</label>
      {bullets('الملخّص التنفيذي', ['summary', 'executive'], sb.summary.executive, STU_SUMMARY_MAX)}
    </section>}
    {!adv && sec === 3 && <section className="pt-box mr-sec" data-testid="ad-s3"><h2>٣. المشكلة والأهداف والأسئلة</h2>
      <label className="mr-lbl">بيان المشكلة{inp(['problem', 'statement'], sb.problem.statement, 'ما الذي تعانيه الجهة ولماذا الآن؟', TEXT_MAX, 4, 'ad-statement')}</label>{bullets('بيان المشكلة', ['problem', 'statement'], sb.problem.statement, TEXT_MAX)}
      <h3>الأهداف (≤ {STU_MAX_OBJ})</h3>{strList(['problem', 'objectives'], sb.problem.objectives, STU_MAX_OBJ, 'هدف', 'ad-obj')}
      <h3>أسئلة الدراسة (≤ {STU_MAX_Q})</h3>{strList(['problem', 'questions'], sb.problem.questions, STU_MAX_Q, 'سؤال', 'ad-qs')}
    </section>}
    {!adv && sec === 4 && <section className="pt-box mr-sec" data-testid="ad-s4"><h2>٤. المنهجية — الأدوات والعيّنة والفترة والحدود</h2>
      <div className="ad-tools" data-testid="ad-tools">{METHOD_TOOLS.map(t => <label key={t} className={`ad-tool ${sb.method.tools.includes(t) ? 'on' : ''}`}><input type="checkbox" checked={sb.method.tools.includes(t)} disabled={ro} onChange={e => setB(['method', 'tools'], e.target.checked ? [...sb.method.tools, t] : sb.method.tools.filter(x => x !== t))} data-testid={`ad-tool-${t}`} /> {METHOD_TOOL_AR[t]}</label>)}</div>
      <div className="ad-3"><label className="mr-lbl">العيّنة / المشاركون{inp(['method', 'sample'], sb.method.sample, 'مثال: 12 مقابلة · 140 استجابة', LINE_MAX)}</label><label className="mr-lbl">الفترة{inp(['method', 'period'], sb.method.period, 'مثال: أكتوبر–نوفمبر 2026', SHORT_MAX)}</label><label className="mr-lbl">حدود الدراسة{inp(['method', 'limits'], sb.method.limits, '', LINE_MAX)}</label></div>
      <p className="mr-key">«بيانات أَثَر» تعني ما سُحب من المنصة (حضور · تقييمات · تقارير تعلّم) — اذكره في مصدر كل نتيجة.</p>
    </section>}
    {!adv && sec === 5 && <section className="pt-box mr-sec" data-testid="ad-s5"><h2>٥. النتائج — كل نتيجة بشاهدها ومصدرها (≤ {STU_MAX_FINDINGS})</h2>
      <div className="mr-scroll"><table className="mr-t" data-testid="ad-findings"><thead><tr><th>#</th><th>النتيجة</th><th>الشاهد</th><th>المصدر</th>{editable && <th />}</tr></thead><tbody>{sb.findings.items.map((f, i) => <tr key={i} data-testid="ad-finding" data-evidence={!!f.evidence}><td>ن{i + 1}</td><td>{inp(['findings', 'items', i, 'text'], f.text, 'النتيجة', LINE_MAX)}</td><td>{inp(['findings', 'items', i, 'evidence'], f.evidence, 'الشاهد (رقم · اقتباس · وثيقة)', LINE_MAX)}</td><td>{inp(['findings', 'items', i, 'source'], f.source, 'مقابلات · استبانة · بيانات أَثَر', SHORT_MAX)}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['findings', 'items'], sb.findings.items.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table></div>
      {editable && sb.findings.items.length < STU_MAX_FINDINGS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['findings', 'items'], [...sb.findings.items, { text: '', evidence: '', source: '' }])} data-testid="ad-add-finding"><Icon name="plus" size={14} /> نتيجة</button>}
      <h3>مؤشّرات كمّية (اختياري · ≤ {STU_MAX_KPIS})</h3>
      <table className="mr-t mr-kpi" data-testid="ad-kpis"><thead><tr><th>المؤشّر</th><th>القيمة</th><th>الوحدة</th><th>المصدر</th>{editable && <th />}</tr></thead><tbody>{sb.findings.kpis.map((k, i) => <tr key={i}><td>{inp(['findings', 'kpis', i, 'name'], k.name, 'مثال: نسبة رضا المتدرّبين', SHORT_MAX)}</td><td><input type="number" value={k.value ?? ''} onChange={e => setB(['findings', 'kpis', i, 'value'], e.target.value === '' ? null : Number(e.target.value))} readOnly={ro} /></td><td>{inp(['findings', 'kpis', i, 'unit'], k.unit, '%', 20)}</td><td>{inp(['findings', 'kpis', i, 'source'], k.source, '', SHORT_MAX)}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['findings', 'kpis'], sb.findings.kpis.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table>
      {editable && sb.findings.kpis.length < STU_MAX_KPIS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['findings', 'kpis'], [...sb.findings.kpis, { name: '', value: null, unit: '', source: '' }])} data-testid="ad-add-kpi"><Icon name="plus" size={14} /> مؤشّر</button>}
    </section>}
    {!adv && sec === 6 && <section className="pt-box mr-sec" data-testid="ad-s6"><h2>٦. تحليل الفجوات — المستهدَف مقابل الواقع (≤ {STU_MAX_GAPS})</h2>
      <div className="mr-scroll"><table className="mr-t" data-testid="ad-gaps"><thead><tr><th>#</th><th>المستهدَف</th><th>الواقع</th><th>الفجوة</th><th>الأولوية</th>{editable && <th />}</tr></thead><tbody>{sb.analysis.gaps.map((g, i) => <tr key={i} data-testid="ad-gap" data-priority={g.priority}><td>ف{i + 1}</td><td>{inp(['analysis', 'gaps', i, 'target'], g.target, '', LINE_MAX)}</td><td>{inp(['analysis', 'gaps', i, 'current'], g.current, '', LINE_MAX)}</td><td>{inp(['analysis', 'gaps', i, 'gap'], g.gap, '', LINE_MAX)}</td><td>{sel(['analysis', 'gaps', i, 'priority'], g.priority, PRIORITY, PRIORITY_AR, 'ad-gap-priority')}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['analysis', 'gaps'], sb.analysis.gaps.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table></div>
      {editable && sb.analysis.gaps.length < STU_MAX_GAPS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['analysis', 'gaps'], [...sb.analysis.gaps, { target: '', current: '', gap: '', priority: '' }])} data-testid="ad-add-gap"><Icon name="plus" size={14} /> فجوة</button>}
      <label className="mr-lbl">قراءة تحليلية (≤ {STU_READING_MAX} حرفًا) — ما الذي تقوله النتائج مجتمعة؟{inp(['analysis', 'reading'], sb.analysis.reading, '', STU_READING_MAX, 6, 'ad-reading')}</label>{bullets('القراءة التحليلية', ['analysis', 'reading'], sb.analysis.reading, STU_READING_MAX)}
    </section>}
    {!adv && sec === 7 && <section className="pt-box mr-sec" data-testid="ad-s7"><h2>٧. التوصيات — كل توصية مربوطة بنتيجة أو فجوة، بمؤشّر نجاح (≤ {STU_MAX_RECS})</h2>
      <div className="mr-scroll"><table className="mr-t" data-testid="ad-recs"><thead><tr><th>#</th><th>التوصية</th><th>تعالج</th><th>الأفق</th><th>الأولوية</th><th>المسؤول</th><th>الكلفة</th><th>مؤشّر النجاح</th>{editable && <th />}</tr></thead><tbody>{sb.recommendations.items.map((x, i) => <tr key={i} data-testid="ad-rec" data-ref={x.ref}><td>ت{i + 1}</td><td>{inp(['recommendations', 'items', i, 'text'], x.text, 'التوصية', LINE_MAX)}</td>
        <td><select value={x.ref} onChange={e => setB(['recommendations', 'items', i, 'ref'], e.target.value)} disabled={ro} data-testid="ad-rec-ref"><option value="">—</option>{sb.findings.items.map((f, j) => <option key={`f${j}`} value={`f:${j}`}>ن{j + 1} · {f.text.slice(0, 40)}</option>)}{sb.analysis.gaps.map((g, j) => <option key={`g${j}`} value={`g:${j}`}>ف{j + 1} · {(g.gap || g.target).slice(0, 40)}</option>)}</select></td>
        <td>{sel(['recommendations', 'items', i, 'horizon'], x.horizon, HORIZON, HORIZON_AR)}</td><td>{sel(['recommendations', 'items', i, 'priority'], x.priority, PRIORITY, PRIORITY_AR)}</td><td>{inp(['recommendations', 'items', i, 'owner'], x.owner, '', SHORT_MAX)}</td><td>{sel(['recommendations', 'items', i, 'cost'], x.cost, ['low', 'mid', 'high'], COST_AR)}</td><td>{inp(['recommendations', 'items', i, 'indicator'], x.indicator, 'كيف نعرف أنها نجحت؟', LINE_MAX)}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['recommendations', 'items'], sb.recommendations.items.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table></div>
      {editable && sb.recommendations.items.length < STU_MAX_RECS && <button type="button" className="pt-btn ghost small" onClick={() => setB(['recommendations', 'items'], [...sb.recommendations.items, { text: '', ref: '', horizon: '', priority: '', owner: '', cost: '', indicator: '' }])} data-testid="ad-add-rec"><Icon name="plus" size={14} /> توصية</button>}
      <p className="mr-key">توصية بلا نتيجة أو فجوة تسندها لا تُرسَل. في نسخة الجهة يصبح لكل توصية زرّ «{DOC_NAMES_AR.rec_to_request}» يفتح طلب استشارة مُعبَّأً.</p>
    </section>}
    {!adv && sec === 8 && <section className="pt-box mr-sec" data-testid="ad-s8"><h2>٨. خطة التنفيذ والملاحق</h2>
      <h3>المراحل (≤ {STU_MAX_PHASES})</h3>
      <div className="mr-scroll"><table className="mr-t" data-testid="ad-phases"><thead><tr><th>#</th><th>المرحلة</th><th>المدة</th><th>المسؤول</th><th>المخرج</th>{editable && <th />}</tr></thead><tbody>{sb.plan.phases.map((p, i) => <tr key={i} data-testid="ad-phase"><td>{i + 1}</td><td>{inp(['plan', 'phases', i, 'title'], p.title, '', SHORT_MAX)}</td><td>{inp(['plan', 'phases', i, 'duration'], p.duration, 'مثال: 6 أسابيع', SHORT_MAX)}</td><td>{inp(['plan', 'phases', i, 'owner'], p.owner, '', SHORT_MAX)}</td><td>{inp(['plan', 'phases', i, 'output'], p.output, '', LINE_MAX)}</td>{editable && <td><button type="button" className="mr-x" aria-label="حذف" onClick={() => setB(['plan', 'phases'], sb.plan.phases.filter((_, j) => j !== i))}>×</button></td>}</tr>)}</tbody></table></div>
      {editable && sb.plan.phases.length < STU_MAX_PHASES && <button type="button" className="pt-btn ghost small" onClick={() => setB(['plan', 'phases'], [...sb.plan.phases, { title: '', duration: '', owner: '', output: '' }])} data-testid="ad-add-phase"><Icon name="plus" size={14} /> مرحلة</button>}
      <h3>مخاطر التنفيذ (≤ {STU_MAX_RISKS})</h3>{strList(['plan', 'risks'], sb.plan.risks, STU_MAX_RISKS, 'الخطر — وكيف يُدار', 'ad-prisks')}
      <label className="mr-lbl">آلية المتابعة{inp(['plan', 'followup'], sb.plan.followup, 'مثال: مراجعة ربع سنوية مع فريق الجودة', LINE_MAX)}</label>
      <h3>الملاحق (≤ {STU_MAX_ANNEX}) — عنوان ووصف أو رابط</h3>{strList(['annexes'], sb.annexes, STU_MAX_ANNEX, 'مثال: أداة الاستبانة — رابط', 'ad-annex')}
    </section>}
    {!adv && sec === 9 && approvalBlock}

    {(err || ok) && <p className={err ? 'mr-err' : 'mr-ok'} role="status" data-testid="ad-msg">{err || ok}</p>}
    <div className="mr-nav"><button className="pt-btn ghost small" type="button" onClick={() => setSec(s => Math.max(1, s - 1))} disabled={sec === 1}><Icon name="arrow" size={14} /> السابق</button><span>{sec} / {N}</span><button className="pt-btn ghost small" type="button" onClick={() => setSec(s => Math.min(N, s + 1))} disabled={sec === N}>التالي</button></div>
  </main>;
}

/* ───────── 3) الوثيقة (الطباعة A4 · ما تراه الجهة) ───────── */
export function AdvisoryDoc({ r, onClose, client = false, ackSlot }: { r: any; onClose?: () => void; client?: boolean; ackSlot?: React.ReactNode }) {
  const c: RequestComputed = r.computed; const kind: string = r.kind; const adv = kind === 'advisory'; const ab: AdvisoryBody = r.body; const sb: StudyBody = r.body; const code = String(r.verify_code || r.code || '');
  const refAr = (ref: string) => (ref.startsWith('f:') ? `ن${Number(ref.slice(2)) + 1}` : ref.startsWith('g:') ? `ف${Number(ref.slice(2)) + 1}` : '—');
  const recBtn = (text: string) => (client && code ? <Link className="ad-reclink" href={recToRequestHref(text, code, c.title)} data-testid="ad-rec-request">{DOC_NAMES_AR.rec_to_request} ←</Link> : null);
  return <div className="pr mr-doc ad-doc" data-testid={client ? 'ad-client-doc' : 'ad-print-page'} data-kind={kind}><style dangerouslySetInnerHTML={{ __html: MR_CSS + MR_PRINT_CSS + CSS }} />
    {!client && <div className="pr-bar"><button className="pt-btn gold small" type="button" onClick={() => window.print()} data-testid="ad-print-btn"><Icon name="print" size={14} /> اطبع / احفظ PDF</button>{onClose && <button className="pt-btn ghost small" type="button" onClick={onClose}><Icon name="arrow" size={14} /> عودة للمحرّر</button>}<small>A4 — الأجر لا يظهر في هذه الوثيقة.</small></div>}
    <article className="pr-page">
      <header className="pr-head"><div><h1>{kindAr(kind)}</h1><p>{c.title}{c.org_ar ? ` — ${c.org_ar}` : ''}</p><p>{DOC_NAMES_AR.umbrella}{c.requested_at ? ` · الطلب ${fmtDayAr(c.requested_at)}` : ''} · الوثيقة {fmtDayAr(r.period_to)}</p></div><div className="pr-meta"><span>المستشار: {r.author_name}{c.consultant_title ? ` — ${c.consultant_title}` : ''}</span>{c.engagement_code && <span dir="ltr">عقد التعاون {c.engagement_code}</span>}{code && <span dir="ltr">رمز التحقّق {code}</span>}{r.approved_at && <span>اعتمده أَثَر: {r.approved_name} · {fmtT(r.approved_at)}</span>}{r.body?.superseded_by && <span className="ad-sup">{DOC_NAMES_AR.superseded} — حلّت محلّها {r.body.superseded_by.code}</span>}</div></header>
      <h2>١. بيانات الطلب</h2>
      <table><tbody><tr><th>الجهة</th><td>{c.org_ar || '—'}{c.sector ? ` · ${c.sector}` : ''}{c.area ? ` · ${c.area}` : ''}</td><th>حالة الطلب</th><td>{REQ_AR[c.request_status] || c.request_status || '—'}</td></tr><tr><th>الطلب</th><td colSpan={3}>{c.details || '—'}{c.goals ? ` — الأهداف: ${c.goals}` : ''}</td></tr>{c.quote_scope && <tr><th>نطاق العرض المقبول</th><td colSpan={3}>{c.quote_scope}</td></tr>}</tbody></table>
      {adv ? <>
        <h2>٢. السؤال الاستشاري</h2><p className="pr-p ad-q">{ab.question.text || '—'}</p>
        {ab.question.assumptions.length > 0 && <><p className="pr-key">الافتراضات:</p><ul className="pr-ul">{ab.question.assumptions.map((a, i) => <li key={i}>{a}</li>)}</ul></>}{ab.question.limits && <p className="pr-key">حدود الرأي: {ab.question.limits}</p>}
        <h2>٣. المعطيات</h2>{ab.inputs.items.length ? <table><thead><tr><th>#</th><th>المعطى</th><th>المصدر</th></tr></thead><tbody>{ab.inputs.items.map((x, i) => <tr key={i}><td>{i + 1}</td><td>{x.text}</td><td>{x.source || '—'}</td></tr>)}</tbody></table> : <p className="pr-p">—</p>}
        <h2>٤. الخيارات</h2>
        <table><thead><tr><th>#</th><th>الخيار</th><th>المزايا</th><th>المخاطر/الكلفة</th><th>شروط النجاح</th></tr></thead><tbody>{ab.options.items.map((o, i) => <tr key={i} className={ab.opinion.chosen === i ? 'ad-chosen' : ''}><td>{i + 1}{ab.opinion.chosen === i ? ' ★' : ''}</td><td><b>{o.title}</b>{o.desc ? <><br />{o.desc}</> : null}</td><td>{o.pros || '—'}</td><td>{o.cons || '—'}</td><td>{o.conditions || '—'}</td></tr>)}{!ab.options.items.length && <tr><td colSpan={5}>—</td></tr>}</tbody></table>
        <h2>٥. الرأي</h2>
        <p className="pr-key"><b>الخيار الموصى به:</b> {ab.opinion.chosen !== null && ab.options.items[ab.opinion.chosen] ? `${ab.opinion.chosen + 1}. ${ab.options.items[ab.opinion.chosen].title}` : '—'}</p>
        <p className="pr-p">{ab.opinion.rationale || '—'}</p>
        {ab.opinion.first_steps.length > 0 && <table><thead><tr><th>#</th><th>الخطوة الأولى</th><th>الأفق</th><th>المسؤول</th>{client && <th />}</tr></thead><tbody>{ab.opinion.first_steps.map((s, i) => <tr key={i}><td>{i + 1}</td><td>{s.text}</td><td>{s.horizon ? HORIZON_AR[s.horizon] : '—'}</td><td>{s.owner || '—'}</td>{client && <td>{recBtn(s.text)}</td>}</tr>)}</tbody></table>}
        {ab.opinion.risks.length > 0 && <><p className="pr-key">مخاطر الخيار وكيف تُدار:</p><ul className="pr-ul">{ab.opinion.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></>}
        <h2>٦. الاعتماد</h2>
      </> : <>
        <h2>٢. الملخّص التنفيذي</h2><p className="pr-p">{sb.summary.executive || '—'}</p>
        <h2>٣. المشكلة والأهداف</h2><p className="pr-p">{sb.problem.statement || '—'}</p>
        {sb.problem.objectives.length > 0 && <><p className="pr-key">الأهداف:</p><ol className="pr-ul">{sb.problem.objectives.map((x, i) => <li key={i}>{x}</li>)}</ol></>}{sb.problem.questions.length > 0 && <><p className="pr-key">الأسئلة:</p><ol className="pr-ul">{sb.problem.questions.map((x, i) => <li key={i}>{x}</li>)}</ol></>}
        <h2>٤. المنهجية</h2><table><tbody><tr><th>الأدوات</th><td>{sb.method.tools.map(t => METHOD_TOOL_AR[t]).join(' · ') || '—'}</td><th>الفترة</th><td>{sb.method.period || '—'}</td></tr><tr><th>العيّنة</th><td>{sb.method.sample || '—'}</td><th>الحدود</th><td>{sb.method.limits || '—'}</td></tr></tbody></table>
        <h2>٥. النتائج</h2>{sb.findings.items.length ? <table><thead><tr><th>#</th><th>النتيجة</th><th>الشاهد</th><th>المصدر</th></tr></thead><tbody>{sb.findings.items.map((f, i) => <tr key={i}><td>ن{i + 1}</td><td>{f.text}</td><td>{f.evidence || '—'}</td><td>{f.source || '—'}</td></tr>)}</tbody></table> : <p className="pr-p">—</p>}
        {sb.findings.kpis.length > 0 && <table><thead><tr><th>المؤشّر</th><th>القيمة</th><th>المصدر</th></tr></thead><tbody>{sb.findings.kpis.map((k, i) => <tr key={i}><td>{k.name}</td><td>{k.value ?? '—'}{k.unit}</td><td>{k.source || '—'}</td></tr>)}</tbody></table>}
        <h2>٦. تحليل الفجوات</h2>{sb.analysis.gaps.length ? <table><thead><tr><th>#</th><th>المستهدَف</th><th>الواقع</th><th>الفجوة</th><th>الأولوية</th></tr></thead><tbody>{sb.analysis.gaps.map((g, i) => <tr key={i}><td>ف{i + 1}</td><td>{g.target}</td><td>{g.current || '—'}</td><td>{g.gap || '—'}</td><td>{g.priority ? PRIORITY_AR[g.priority] : '—'}</td></tr>)}</tbody></table> : null}{sb.analysis.reading && <p className="pr-p">{sb.analysis.reading}</p>}{!sb.analysis.gaps.length && !sb.analysis.reading && <p className="pr-p">—</p>}
        <h2>٧. التوصيات</h2>
        <table><thead><tr><th>#</th><th>التوصية</th><th>تعالج</th><th>الأفق</th><th>الأولوية</th><th>المسؤول</th><th>الكلفة</th><th>مؤشّر النجاح</th>{client && <th />}</tr></thead><tbody>{sb.recommendations.items.map((x, i) => <tr key={i}><td>ت{i + 1}</td><td>{x.text}</td><td>{refAr(x.ref)}</td><td>{x.horizon ? HORIZON_AR[x.horizon] : '—'}</td><td>{x.priority ? PRIORITY_AR[x.priority] : '—'}</td><td>{x.owner || '—'}</td><td>{x.cost ? COST_AR[x.cost] : '—'}</td><td>{x.indicator || '—'}</td>{client && <td>{recBtn(x.text)}</td>}</tr>)}{!sb.recommendations.items.length && <tr><td colSpan={client ? 9 : 8}>—</td></tr>}</tbody></table>
        <h2>٨. خطة التنفيذ والملاحق</h2>
        {sb.plan.phases.length > 0 && <table><thead><tr><th>#</th><th>المرحلة</th><th>المدة</th><th>المسؤول</th><th>المخرج</th></tr></thead><tbody>{sb.plan.phases.map((p, i) => <tr key={i}><td>{i + 1}</td><td>{p.title}</td><td>{p.duration || '—'}</td><td>{p.owner || '—'}</td><td>{p.output || '—'}</td></tr>)}</tbody></table>}
        {sb.plan.risks.length > 0 && <><p className="pr-key">مخاطر التنفيذ:</p><ul className="pr-ul">{sb.plan.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></>}{sb.plan.followup && <p className="pr-key">المتابعة: {sb.plan.followup}</p>}
        {sb.annexes.length > 0 && <><p className="pr-key">الملاحق:</p><ol className="pr-ul">{sb.annexes.map((x, i) => <li key={i}>{x}</li>)}</ol></>}
        <h2>٩. الاعتماد</h2>
      </>}
      <table className="pr-sign"><thead><tr><th>المستشار</th><th>اعتماد أَثَر</th><th>{MISSION_NAMES_AR.ack}</th></tr></thead><tbody><tr><td>{r.author_name}<br /><small>{r.submitted_at ? fmtT(r.submitted_at) : ''}</small></td><td>{r.approved_name || '—'}<br /><small>{r.approved_at ? `${fmtT(r.approved_at)} · معتمَد إلكترونيًا` : 'بانتظار الاعتماد'}</small></td><td>{r.body?.ack ? <>{r.body.ack.name}<br /><small>{fmtT(r.body.ack.at)}{r.body.ack.note ? ` · «${r.body.ack.note}»` : ''}</small></> : <small>—</small>}</td></tr></tbody></table>
      {r.body?.addenda?.length > 0 && <><h2>إلحاقات مؤرَّخة</h2><ul className="pr-ul">{r.body.addenda.map((a: any, i: number) => <li key={i}><small>{fmtT(a.at)} · {a.by}:</small> {a.text}</li>)}</ul></>}
      {ackSlot}
      <footer className="pr-foot"><p>{P46_NAMES_AR.axis} · {P46_NAMES_AR.official} · {DOC_NAMES_AR.umbrella} — أَثَر</p>{code && <p>للتحقّق: /verify/report/{code}</p>}<p>هذا الرأي مبنيّ على المعطيات المذكورة وفي تاريخ الوثيقة؛ وهو رأي مهني لا قرار إداري.</p></footer>
    </article>
  </div>;
}

/* ───────── 4) الجهة: قراءة + إقرار بالاستلام (إنجاز · رأي · دراسة) ───────── */
export function ClientReport({ code, k }: { code: string; k: string }) {
  const [d, setD] = useState<any>(undefined); const [name, setName] = useState(''); const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [done, setDone] = useState(false);
  const load = useCallback(() => fetch(`/api/reports?verify=${encodeURIComponent(code)}&k=${encodeURIComponent(k)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.report || null)).catch(() => setD(null)), [code, k]);
  useEffect(() => { load(); }, [load]);
  async function ack(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(''); const j = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ack', code, k, name, note }) }).then(r => r.json()).catch(() => ({ success: false, error: 'تعذّر الإرسال' })); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } setDone(true); load(); }
  if (d === undefined) return <main className="pt-main mr"><style dangerouslySetInnerHTML={{ __html: MR_CSS }} /><section className="pt-box"><p className="pt-muted">…</p></section></main>;
  if (d === null) return <main className="pt-main mr" data-testid="mr-client-bad"><style dangerouslySetInnerHTML={{ __html: MR_CSS }} /><section className="pt-box"><h1>الرابط غير صالح أو انتهى</h1><p className="pt-muted">اطلب من أَثَر إعادة إرسال رابط الوثيقة. <Link href={`/verify/report/${code}`}>صفحة التحقّق العامة</Link></p></section></main>;
  const doc = d.kind === 'advisory' || d.kind === 'study'; const label = kindAr(d.kind);
  const slot = <section className="mr-ackbox" data-testid="mr-ackbox">{d.body?.ack || done ? <p className="mr-okbox" data-testid="mr-acked"><Icon name="check" size={16} /> أُقرّ باستلام هذه الوثيقة{d.body?.ack ? ` — ${d.body.ack.name} · ${fmtT(d.body.ack.at)}` : ''}. شكرًا لكم.</p> : <form onSubmit={ack} className="mr-ackform"><h3><Icon name="mail" size={16} /> {MISSION_NAMES_AR.ack} — استلامٌ لا تقييم</h3><p className="pt-muted">بالضغط تُثبتون أن الجهة استلمت {label} بصيغته المعتمَدة. يمكنكم إضافة ملاحظة قصيرة تُحفظ مع الوثيقة.</p><div className="mr-row"><input value={name} onChange={e => setName(e.target.value.slice(0, 120))} placeholder="اسم المُقِرّ وصفته" required data-testid="mr-ack-name" /><input value={note} onChange={e => setNote(e.target.value.slice(0, ACK_NOTE_MAX))} placeholder="ملاحظة (اختياري)" data-testid="mr-ack-note" /><button className="pt-btn gold" type="submit" disabled={busy || name.trim().length < 2} data-testid="mr-ack-btn"><Icon name="check" size={16} /> {busy ? '…' : MISSION_NAMES_AR.ack_btn}</button></div>{err && <p className="mr-err" role="alert">{err}</p>}</form>}</section>;
  return <main className="pt-main mr" data-testid="mr-client" data-kind={d.kind}><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} /><p className="mr-clienthead"><Icon name="shield" size={14} /> نسخة الجهة من {label} — معتمَدة من أَثَر · <Link href={`/verify/report/${code}`}>صفحة التحقّق العامة</Link> · <button type="button" className="mr-linkbtn" onClick={() => window.print()}>اطبع / PDF</button>{doc && <> · <small>كل توصية لها زرّ «{DOC_NAMES_AR.rec_to_request}».</small></>}</p>{doc ? <AdvisoryDoc r={d} client ackSlot={slot} /> : <MissionDoc r={d} client ackSlot={slot} />}</main>;
}

/* ───────── 5) صندوق «وثائق أَثَر المعتمَدة» على صفحة الطلب ───────── */
export function ClientDocsBox({ requestId, token }: { requestId: string; token: Tok }) {
  const [docs, setDocs] = useState<any[] | null>(null);
  useEffect(() => { let on = true; api(token, `/api/reports?request=${encodeURIComponent(requestId)}`).then(j => { if (on) setDocs(j?.success ? j.docs || [] : []); }); return () => { on = false; }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [requestId]);
  if (!docs || !docs.length) return null;
  return <section className="pt-box ad-cdocs" data-testid="ad-client-docs"><style dangerouslySetInnerHTML={{ __html: CSS }} /><h2><Icon name="shield" size={16} /> {DOC_NAMES_AR.client_docs}</h2><p className="pt-muted">وثائق اعتمدها أَثَر على طلبكم — تُقرأ وتُطبع ويُقرّ باستلامها من رابطها (بلا دخول).</p>
    <ul>{docs.map(x => <li key={x.id} data-testid="ad-client-doc" data-kind={x.kind} data-superseded={x.superseded}><span className="mr-chip g">{x.kind_ar}</span> <b>{x.title}</b> · {x.author_name} · {x.approved_at ? fmtDayAr(String(x.approved_at).slice(0, 10)) : ''}{x.acked_at ? <span className="mr-chip t">أُقرّ باستلامها</span> : <span className="mr-chip b">بانتظار إقراركم</span>}{x.superseded && <span className="mr-chip o">{DOC_NAMES_AR.superseded}</span>} <a className="pt-btn navy small" href={x.url} data-testid="ad-client-doc-open">اقرأ وأقرّ ←</a></li>)}</ul></section>;
}

const CSS = `
.ad-cardf{gap:.4rem}.ad-kbtn{display:inline-flex;gap:.3rem;align-items:center;flex-wrap:wrap}.ad-mini{font-size:.78rem;color:#0b8a83;font-weight:700;text-decoration:none;border:1px dashed #9fd6cf;border-radius:999px;padding:.05rem .5rem}
.ad-bul{margin:.3rem 0 .6rem}.ad-bul .mr-ai textarea{min-height:90px}.ad-bulout{background:#fff;border:1px dashed #9fd6cf;border-radius:10px;padding:.5rem .7rem}.ad-bulout p{margin:0 0 .3rem;color:#1e293b}
.ad-cons{background:#ffedd5;border:1px solid #fdba74;border-radius:10px;padding:.5rem .7rem;color:#9a3412;font-size:.92rem}.ad-cons.ok{background:#d1fae5;border-color:#6ee7b7;color:#065f46}
.ad-opts{display:grid;gap:.7rem}.ad-opt{border:1px solid #e5e8ef;border-radius:12px;padding:.7rem;background:#fff}.ad-opt[data-chosen="true"]{border-color:#c9a24b;background:#fffdf5}.ad-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.5rem}
.ad-tools{display:flex;gap:.4rem;flex-wrap:wrap;margin:.3rem 0 .6rem}.ad-tool{display:inline-flex;gap:.3rem;align-items:center;border:1px solid #cfd6e2;border-radius:999px;padding:.3rem .7rem;font-weight:700;color:#334155;cursor:pointer}.ad-tool.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ad-tool input{width:auto}
.ad-doc .ad-q{font-size:13px;font-weight:800;color:#0f2a4e}.ad-doc tr.ad-chosen td{background:#fffdf5}.ad-sup{color:#9a3412;font-weight:800}.ad-reclink{font-size:10.5px;white-space:nowrap;color:#0b8a83;font-weight:800;text-decoration:none;border:1px solid #9fd6cf;border-radius:999px;padding:.05rem .4rem}
.ad-cdocs h2{display:flex;gap:.4rem;align-items:center;color:#0f2a4e;margin:0 0 .3rem}.ad-cdocs ul{list-style:none;margin:.5rem 0 0;padding:0;display:grid;gap:.5rem}.ad-cdocs li{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .8rem}.ad-cdocs li b{color:#0f2a4e}
@media (max-width:720px){.ad-3{grid-template-columns:1fr}}@media print{.ad-reclink{display:none}}
`;
