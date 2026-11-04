'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P46 ر4-ب «محور التقارير» — «كشف الكفايات» («العودة إلى الجواز»)
 *  <ProfilesPanel>     داخل بطاقة الدبلوم (/me/reports#diploma)   متدرّبو الشعبة وحالة كشف كلٍّ منهم · «افتح الكشف» (يُنشأ آليًا من أول وحدة معتمَدة، أو عند الطلب) · «نسخة جديدة» بعد الاعتماد
 *  <ProfileEditor>     /me/reports/[id] · /admin                    أربعة أقسام: المسار (جاهز من أَثَر) · الكفايات (أدلّة + «اقتراح من الأدلّة» + مستوى المعلّم + جملة شاهد + «رتّب الأدلّة») · ما يميّزه/ما يواصله · التوصية بالكلمات
 *  <ProfileDoc>        المطبوع A4                                  وثيقة واحدة: المسار · جدول الكفايات · الاقتباسات بمصادرها · التوصية · التوقيعان
 *  <MyProfileLine>     /me/reports/line/[id]                        المتدرّب يرى كشفه كاملًا بعد الاعتماد و«أظهِر كفاياتي في شهادتي»
 *  <CohortReading>     /verify/report/<code> (وحدة) · /org          قراءة الدفعة: توزيع المستويات لكل كفاية (k ≥ 5 · بلا أسماء)
 *  القاعدة: الأدلّة من أَثَر، والاقتراح محليّ بقاعدة مُعلنة، والمستوى للمعلّم على سُلّم الجواز، والاعتماد لزميل غير الكاتب — ثم يعود المستوى إلى جواز المهارات بملاحظة تحمل رمز الكشف.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P46_NAMES_AR, R4_NAMES_AR, R4B_NAMES_AR, PROFILE_LEVEL_AR, PROFILE_REC, PROFILE_REC_AR, PROFILE_EVIDENCE_MIN_LEVEL, UNIT_DECISION_AR, UNIT_STATE_AR, ATTENTION_CHANGE_AR, TEXT_MAX, COHORT_MIN, fmtDayAr, levelAr, type ProfileBody, type ProfileComputed, type ProfileQuote, type Competency } from '../../lib/reports/registry';
import { MR_CSS, MR_PRINT_CSS } from './MissionReport';
import { drApi as api, DR_CSS, DrHead, DrReturn, DrNotes, drStatusAr as statusAr } from './DiplomaReport';

type Tok = () => Promise<string>;
const CSS = `
.dp-path{display:grid;gap:.5rem}.dp-units{width:100%;border-collapse:collapse;font-size:.88rem}.dp-units th,.dp-units td{border-bottom:1px solid #eef0f4;padding:.3rem .4rem;text-align:right}.dp-units tr[data-state="current"] th{color:#9a6b00}
.dp-comp{border:1px solid #e5e8ef;border-radius:12px;padding:.6rem .7rem;background:#fff;margin:.45rem 0;display:grid;gap:.4rem}.dp-comp h4{margin:0;display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;color:#0f2a4e}.dp-comp h4 small{color:#64748b;font-weight:600}
.dp-ev{display:flex;gap:.35rem;flex-wrap:wrap}.dp-ev span{font-size:.78rem;font-weight:800;padding:.12rem .5rem;border-radius:999px;background:#f1f5f9;color:#334155}.dp-ev span.g{background:#e6f4f1;color:#0b6f69}.dp-ev span.o{background:#fff7e6;color:#9a6b00}
.dp-sg{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;font-size:.85rem}.dp-sg b{color:#0b8a83}.dp-sg em{color:#64748b;font-style:normal}
.dp-lv{display:grid;grid-template-columns:180px 1fr;gap:.5rem;align-items:start}.dp-lv select{min-width:0}.dp-lv textarea{min-height:56px}.dp-lv .req{color:#b45309;font-size:.78rem;font-weight:800}
.dp-q{list-style:none;margin:0;padding:0;display:grid;gap:.3rem}.dp-q li{display:grid;grid-template-columns:1fr auto;gap:.4rem;align-items:center;border:1px dashed #cfd6e2;border-radius:8px;padding:.3rem .5rem;font-size:.86rem;background:#fbfcfe}.dp-q li small{display:block;color:#64748b}.dp-q li.kept{border-style:solid;border-color:#0b8a83;background:#f0fbf9}
.dp-rec{display:grid;gap:.35rem}.dp-rec label{display:flex;gap:.5rem;align-items:center;border:1px solid #e5e8ef;border-radius:10px;padding:.4rem .6rem;cursor:pointer}.dp-rec label[data-on="1"]{border-color:#c9a24b;background:#fffaf0}
.dp-pl{list-style:none;margin:.3rem 0;padding:0;display:grid;gap:.35rem}.dp-pl li{display:grid;grid-template-columns:1fr auto auto;gap:.5rem;align-items:center;border:1px solid #e5e8ef;border-radius:10px;padding:.4rem .6rem;background:#fff}.dp-pl li b{color:#0f2a4e}.dp-pl li small{color:#64748b}
.dp-co{margin:.6rem 0}.dp-co table{width:100%;border-collapse:collapse;font-size:.85rem}.dp-co th,.dp-co td{border-bottom:1px solid #eef0f4;padding:.3rem .4rem;text-align:center}.dp-co th:first-child,.dp-co td:first-child{text-align:right}.dp-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:#eef0f4}.dp-bar i{display:block;height:100%}.dp-bar i[data-l="0"]{background:#cbd5e1}.dp-bar i[data-l="1"]{background:#93c5fd}.dp-bar i[data-l="2"]{background:#60a5fa}.dp-bar i[data-l="3"]{background:#0b8a83}.dp-bar i[data-l="4"]{background:#c9a24b}.dp-bar i[data-l="5"]{background:#9a6b00}
.dp-my{display:grid;gap:.5rem}.dp-my .lv{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:.4rem;list-style:none;margin:0;padding:0}.dp-my .lv li{border:1px solid #e5e8ef;border-radius:10px;padding:.5rem .6rem;background:#fff}.dp-my .lv li b{display:block;color:#0b8a83}.dp-my .lv li[data-level="0"] b{color:#94a3b8}.dp-my .lv li p{margin:.2rem 0 0;font-size:.86rem;color:#334155}
@media (max-width:720px){.dp-lv{grid-template-columns:1fr}.dp-pl li{grid-template-columns:1fr}}
`;
const REC_TONE: Record<string, string> = { complete: 't', complete_plan: 'b', finish_units: 'o', repeat: 'o' };

/** عدّ عربي سليم: «عاد مستوى واحد» · «عاد مستويان» · «عادت 3 مستويات» */
const countAr = (n: number, one: string, two: string, many: string) => n === 1 ? `عاد ${one} واحد` : n === 2 ? `عاد ${two}` : `عادت ${n} ${many}`;

/* ───────── 1) كشوف الشعبة (داخل بطاقة الدبلوم) ───────── */
export function ProfilesPanel({ programId, classroomId, token }: { programId: string; classroomId: string | null; token: Tok }) {
  const [rows, setRows] = useState<any[] | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState('');
  const load = useCallback(async () => { const j = await api(token, `/api/reports?profiles=${encodeURIComponent(programId)}${classroomId ? `&classroom=${encodeURIComponent(classroomId)}` : ''}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); setRows([]); return; } setRows(j.rows || []); }, [token, programId, classroomId]);
  useEffect(() => { load(); }, [load]);
  async function open(email: string, renew = false) { setBusy(email); setErr(''); const j = await api(token, '/api/reports', { action: 'create_profile', program_id: programId, classroom_id: classroomId, email, renew }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } window.location.href = `/me/reports/${j.report.id}`; }
  return <div className="dr-units" data-testid="dp-panel"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <p className="pt-muted" style={{ margin: 0 }}><b>{R4B_NAMES_AR.open}</b> — «{R4B_NAMES_AR.motto}». يُنشأ كشف كل متدرّب آليًا عند اعتماد أول تقرير وحدة ويُحدَّث بعد كل وحدة؛ تكتب مستوياته في آخر الدبلوم ويعتمده زميل، فيعود إلى {R4B_NAMES_AR.passport}.</p>
    {err && <p className="mr-err" role="alert">{err}</p>}
    {rows === null ? <p className="pt-muted">…</p> : !rows.length ? <p className="pt-muted" data-testid="dp-empty">لا متدرّبين ببريد في هذه الشعبة.</p> : <ul className="dp-pl">{rows.map(r => <li key={r.key} data-testid="dp-row" data-status={r.profile?.status || 'none'}>
      <div><b>{r.name}</b><br /><small>{r.profile ? <>{statusAr(r.profile.status)}{r.profile.total ? ` · أثبت ${r.profile.proven} من ${r.profile.total}` : ''}{r.profile.verify_code ? <> · <span dir="ltr">{r.profile.verify_code}</span></> : ''}</> : 'لا كشف بعد'}</small></div>
      {r.profile ? <Link className="pt-btn navy small" href={`/me/reports/${r.profile.id}`} data-testid="dp-open">افتح الكشف</Link> : <button type="button" className="pt-btn gold small" onClick={() => open(r.email)} disabled={!!busy} data-testid="dp-create">{busy === r.email ? '…' : 'أنشئ الكشف الآن'}</button>}
      {r.profile?.status === 'approved' ? <button type="button" className="pt-btn ghost small" onClick={() => open(r.email, true)} disabled={!!busy} data-testid="dp-renew" title="نسخة جديدة تَنسخ المعتمَدة وتُحدِّث الجواز عند اعتمادها">نسخة جديدة</button> : <span />}
    </li>)}</ul>}
  </div>;
}

/* ───────── 2) محرّر الكشف ───────── */
const Ev = ({ k }: { k: Competency }) => <div className="dp-ev" data-testid="dp-ev">
  <span className={k.avg !== null ? 'g' : ''}>{k.units.filter(u => u.score !== null).length ? `${k.units.filter(u => u.score !== null).length} ${k.units.filter(u => u.score !== null).length === 1 ? 'وحدة' : 'وحدات'} · متوسط ${k.avg}%` : 'لا كشف وحدة بعد'}</span>
  {k.missions > 0 && <span className="g">م {k.missions} مصدَّقة</span>}{k.cases > 0 && <span>ي {k.cases}</span>}
  {k.passport_approved !== null ? <span className="o">الجواز: {levelAr(k.passport_approved)} (معتمَد)</span> : k.passport_computed !== null && k.passport_computed > 0 ? <span>الجواز المحسوب {k.passport_computed}</span> : <span>لا أثر في الجواز بعد</span>}
</div>;
export function ProfileEditor({ id, token, mode = 'author', onBack }: { id: string; token: Tok; mode?: 'author' | 'admin'; onBack?: () => void }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState(''); const [dirty, setDirty] = useState(false); const [body, setBody] = useState<ProfileBody | null>(null); const [sec, setSec] = useState(1); const [print, setPrint] = useState(false);
  const [arr, setArr] = useState<Record<string, { quotes: ProfileQuote[]; note_ar: string; source: string }>>({});
  const load = useCallback(async () => { const j = await api(token, `/api/reports?id=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); setBody(j.report.body); setDirty(false); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h); }, [dirty]);
  const r = d?.report; const c: ProfileComputed | null = r?.computed || null; const editable = !!r?.can_edit; const ro = !editable;
  const setB = (patch: Partial<ProfileBody>) => { setBody(b => (b ? { ...b, ...patch } : b)); setDirty(true); };
  const setLv = (code: string, patch: { level?: number | null; evidence?: string }) => { setBody(b => (b ? { ...b, levels: b.levels.map(l => (l.code === code ? { ...l, ...patch } : l)) } : b)); setDirty(true); };
  const missing = useMemo(() => (r?.missing || []) as string[], [r]);
  async function save(silent = false): Promise<boolean> { if (!body) return false; setBusy('save'); setErr(''); if (!silent) setOk(''); const j = await api(token, '/api/reports', { action: 'save', id, body }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل الحفظ'); return false; } setD((x: any) => ({ ...x, report: j.report })); setBody(j.report.body); setDirty(false); if (!silent) setOk('حُفظ'); return true; }
  async function act(action: string, extra: any = {}) { setBusy(action); setErr(''); setOk(''); if (dirty && ['submit', 'recompute'].includes(action)) { const s = await save(true); if (!s) { setBusy(''); return; } } const j = await api(token, '/api/reports', { action, id, ...extra }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); setOk(action === 'submit' ? 'أُرسل — يعتمده زميل من الطاقم غير الكاتب' : action === 'approve' ? `اعتُمد — رمز التحقّق ${j.verify_code} · عادت المستويات إلى ${R4B_NAMES_AR.passport}` : action === 'return' ? 'أُعيد بملاحظة' : 'حُدِّثت الأدلّة والاقتراحات من أَثَر'); }
  async function arrange(code: string) { setBusy('arr' + code); setErr(''); const j = await api(token, '/api/reports', { action: 'arrange', id, code }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } setArr(a => ({ ...a, [code]: { quotes: j.quotes || [], note_ar: j.note_ar || '', source: j.source } })); }
  function keep(q: ProfileQuote) { if (!body) return; if (body.quotes.some(x => x.code === q.code && x.text === q.text)) return; setB({ quotes: [...body.quotes, q] }); setArr(a => ({ ...a, [q.code]: { ...a[q.code], quotes: (a[q.code]?.quotes || []).filter(x => x.text !== q.text) } })); }
  function drop(q: ProfileQuote) { if (!body) return; setB({ quotes: body.quotes.filter(x => !(x.code === q.code && x.text === q.text)) }); }
  async function renew() { if (!c) return; setBusy('renew'); const j = await api(token, '/api/reports', { action: 'create_profile', program_id: r.program_id, classroom_id: r.classroom_id, email: c.subject.email, renew: true }); setBusy(''); if (!j.success) { setErr(j.error || 'فشل'); return; } window.location.href = `/me/reports/${j.report.id}`; }
  if (!d || !body || !c) return <main className="pt-main mr"><style dangerouslySetInnerHTML={{ __html: MR_CSS + DR_CSS + CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  if (print) return <ProfileDoc r={{ ...r, body }} onClose={() => setPrint(false)} />;
  const secs = ['المسار', 'الكفايات', 'ما يميّزه', 'التوصية'];
  const kept = (code: string) => body.quotes.filter(q => q.code === code);
  return <main className="pt-main mr mr-ed" data-testid="dp-editor" data-status={r.status}><style dangerouslySetInnerHTML={{ __html: MR_CSS + DR_CSS + CSS }} />
    <DrHead r={r} c={c} mode={mode} onBack={onBack} busy={busy} dirty={dirty} editable={editable} act={act} save={save} print={() => setPrint(true)} kicker={R4B_NAMES_AR.profile} title={`${R4B_NAMES_AR.profile} — ${c.subject.name}`} sub={`${c.program_ar}${c.classroom_ar ? ` · ${c.classroom_ar}` : ''} · ${c.trainer_ar}${c.supersedes_code ? ` · يَنسخ ${c.supersedes_code}` : ''}`}
      extra={<><DrReturn r={r} busy={busy} act={act} /><DrNotes r={r} err={err} ok={ok} />
        {r.status === 'approved' && <p className="mr-okbox" data-testid="dp-after">{`${countAr(body.levels.filter(l => (l.level || 0) >= 1).length, 'مستوى', 'مستويان', 'مستويات')} إلى ${R4B_NAMES_AR.passport} بملاحظة «${R4B_NAMES_AR.profile} ${r.verify_code}».`} {body.recommendation === 'complete' && d.me?.staff && <Link href={`/admin/credentials?program=${encodeURIComponent(r.program_id)}&email=${encodeURIComponent(c.subject.email)}&from=profile`} className="pt-btn gold small" data-testid="dp-complete-cert"><Icon name="certificate" size={14} /> {R4B_NAMES_AR.complete_cert}</Link>} {r.can_renew && <button type="button" className="pt-btn ghost small" onClick={renew} disabled={!!busy} data-testid="dp-renew-btn">نسخة جديدة تَنسخ هذه</button>}</p>}
        {r.body?.superseded_by && <p className="mr-retbox" data-testid="dp-superseded">نُسخت هذه النسخة بكشف أحدث ({r.body.superseded_by.code}).</p>}
        <div className="mr-kpis" data-testid="dp-kpis"><span><b>{c.units_closed}</b>/{c.units_total} <small>وحدات مغلقة</small></span><span className="b"><b>{c.units_reached}</b> <small>بلغ ناتجها</small></span><span><b>{c.attendance_pct ?? '—'}{c.attendance_pct !== null ? '%' : ''}</b> <small>حضور</small></span><span><b>{c.hours}</b> <small>ساعة</small></span><span className="b"><b>{c.around.missions}</b> <small>مهمة · <b>{c.around.rehearsals}</b> بروفة · <b>{c.around.cases}</b> يوم مهارة</small></span>{c.attention.length > 0 && <span className="o"><b>{c.attention.length}</b> <small>في {R4_NAMES_AR.attention}</small></span>}</div>
        <div className="mr-secs" role="tablist" aria-label="أقسام الكشف">{secs.map((s, i) => <button key={s} type="button" className={sec === i + 1 ? 'on' : ''} onClick={() => setSec(i + 1)} role="tab" aria-selected={sec === i + 1} data-testid={`dp-sec-${i + 1}`}>{i + 1} · {s}</button>)}</div></>} />
    {sec === 1 && <section className="pt-box mr-sec dp-path" data-testid="dp-s1"><h3>١ · المسار في الدبلوم <small className="pt-muted">— جاهز من أَثَر</small></h3>
      <p className="pt-muted">{c.subject.name} · <span dir="ltr">{c.subject.email}</span>{c.subject.user_id ? '' : ' · (لا حساب مرتبط — لن تُكتب المستويات في الجواز حتى يُنشئ حسابه)'}</p>
      <table className="dp-units"><thead><tr><th>#</th><th>الوحدة</th><th>الحالة</th><th>درجته</th><th>قرار الوحدة</th><th>رمز التقرير</th></tr></thead><tbody>{c.units.map(u => <tr key={u.idx} data-state={u.state}><td>{u.idx}</td><th>{u.title_ar}</th><td>{UNIT_STATE_AR[u.state]}</td><td>{u.score ?? '—'}</td><td>{u.decision ? UNIT_DECISION_AR[u.decision as keyof typeof UNIT_DECISION_AR] : '—'}</td><td dir="ltr">{u.verify_code || '—'}</td></tr>)}</tbody></table>
      {c.attention.length > 0 && <div><b>{R4_NAMES_AR.attention}</b><ul>{c.attention.map((a, i) => <li key={i}>الأسبوع {a.since_week}: {a.reason}{a.last_change ? ` → ${ATTENTION_CHANGE_AR[a.last_change as keyof typeof ATTENTION_CHANGE_AR] || a.last_change}` : ''}</li>)}</ul></div>}
    </section>}
    {sec === 2 && <section className="pt-box mr-sec" data-testid="dp-s2"><h3>٢ · الكفايات <small className="pt-muted">— الأدلّة من أَثَر، و«{R4B_NAMES_AR.suggest}» بقاعدة مُعلنة، والمستوى لك على سُلّم {R4B_NAMES_AR.passport}</small></h3>
      <label className="cs-chk" style={{ display: 'flex', gap: '.4rem', alignItems: 'center' }}><input type="checkbox" checked={body.show_suggest !== false} onChange={e => setB({ show_suggest: e.target.checked })} disabled={ro} data-testid="dp-show-suggest" /> أظهِر الاقتراح (يمكنك إخفاؤه لتحكم أولًا ثم تقارن)</label>
      {c.competencies.map(k => { const l = body.levels.find(x => x.code === k.code) || { code: k.code, level: null, evidence: '' }; const needEv = (l.level || 0) >= PROFILE_EVIDENCE_MIN_LEVEL && l.evidence.length < 10; const a = arr[k.code]; return <div key={k.code} className="dp-comp" data-testid="dp-comp" data-code={k.code}>
        <h4>{k.name_ar} <small dir="ltr">{k.code}</small></h4><Ev k={k} />
        {body.show_suggest !== false && <p className="dp-sg" data-testid="dp-suggest">{R4B_NAMES_AR.suggest}: <b>{k.suggested === null ? 'لا اقتراح' : levelAr(k.suggested)}</b> <em>— {k.why}</em>{editable && k.suggested !== null && l.level !== k.suggested && <button type="button" className="mr-linkbtn" onClick={() => setLv(k.code, { level: k.suggested })} data-testid="dp-take">خذ الاقتراح</button>}</p>}
        <div className="dp-lv"><label>المستوى<select value={l.level === null ? '' : String(l.level)} onChange={e => setLv(k.code, { level: e.target.value === '' ? null : Number(e.target.value) })} disabled={ro} data-testid="dp-level"><option value="">— اختر —</option>{PROFILE_LEVEL_AR.map((n, i) => <option key={i} value={i}>{i ? `${i} · ${n}` : n}</option>)}</select></label>
          <label>جملة الشاهد {needEv && <span className="req">مطلوبة من «{PROFILE_LEVEL_AR[PROFILE_EVIDENCE_MIN_LEVEL]}» فأعلى</span>}<textarea value={l.evidence} onChange={e => setLv(k.code, { evidence: e.target.value.slice(0, TEXT_MAX) })} placeholder="ما الذي رأيته يفعله فعلًا؟ (موقف · مهمة · درس · إنتاج)" readOnly={ro} maxLength={TEXT_MAX} data-testid="dp-evidence" /></label></div>
        <div>{editable && <button type="button" className="pt-btn ghost small" onClick={() => arrange(k.code)} disabled={!!busy} data-testid="dp-arrange"><Icon name="star" size={14} /> {busy === 'arr' + k.code ? '…' : R4B_NAMES_AR.arrange}</button>} {a && <small className="pt-muted" data-testid="dp-arrange-note">{a.note_ar}</small>}
          {a && a.quotes.length > 0 && <ul className="dp-q" data-testid="dp-proposed">{a.quotes.map((q, i) => <li key={i}><span>{q.text}<small>— {q.source}</small></span><button type="button" className="pt-btn gold small" onClick={() => keep(q)} data-testid="dp-keep">أبقِها</button></li>)}</ul>}
          {kept(k.code).length > 0 && <ul className="dp-q" data-testid="dp-kept">{kept(k.code).map((q, i) => <li key={i} className="kept"><span>{q.text}<small>— {q.source}</small></span>{editable ? <button type="button" className="mr-linkbtn" onClick={() => drop(q)} data-testid="dp-drop">احذف</button> : <span />}</li>)}</ul>}</div>
      </div>; })}
      {!c.competencies.length && <p className="pt-muted">لا كفايات في قالب هذا البرنامج — اختر مهارات البرنامج أولًا.</p>}
    </section>}
    {sec === 3 && <section className="pt-box mr-sec" data-testid="dp-s3"><h3>٣ · {R4B_NAMES_AR.distinguish} · {R4B_NAMES_AR.keep}</h3>
      <label>{R4B_NAMES_AR.distinguish}<textarea value={body.strengths} onChange={e => setB({ strengths: e.target.value.slice(0, TEXT_MAX) })} rows={3} readOnly={ro} maxLength={TEXT_MAX} placeholder="ما الذي يفعله هذا المتدرّب ولا يفعله غيره بالطريقة نفسها؟" data-testid="dp-strengths" /></label>
      <label>{R4B_NAMES_AR.keep}<textarea value={body.keep} onChange={e => setB({ keep: e.target.value.slice(0, TEXT_MAX) })} rows={3} readOnly={ro} maxLength={TEXT_MAX} placeholder="لا نقاط ضعف — ما الذي يحتاج أن يواصله بعد الدبلوم؟" data-testid="dp-keep-txt" /></label>
    </section>}
    {sec === 4 && <section className="pt-box mr-sec" data-testid="dp-s4"><h3>٤ · {R4B_NAMES_AR.recommendation} بالكلمات <small className="pt-muted">— لا درجة نهائية؛ توصية يحملها المتدرّب</small></h3>
      <div className="dp-rec" role="radiogroup">{PROFILE_REC.map(x => <label key={x} data-on={body.recommendation === x ? '1' : '0'}><input type="radio" name="rec" checked={body.recommendation === x} onChange={() => setB({ recommendation: x })} disabled={ro} data-testid={`dp-rec-${x}`} /> <span className={`mr-chip ${REC_TONE[x]}`}>{PROFILE_REC_AR[x]}</span></label>)}</div>
      {body.recommendation && body.recommendation !== 'complete' && <label>{body.recommendation === 'finish_units' ? 'ما الوحدات التي تُستكمل؟' : 'خطة المتابعة/الإعادة'}<textarea value={body.plan} onChange={e => setB({ plan: e.target.value.slice(0, TEXT_MAX) })} rows={3} readOnly={ro} maxLength={TEXT_MAX} data-testid="dp-plan" /></label>}
      <label>ملاحظات إدارية (لا تصل المتدرّب)<textarea value={body.admin} onChange={e => setB({ admin: e.target.value.slice(0, TEXT_MAX) })} rows={2} readOnly={ro} maxLength={TEXT_MAX} data-testid="dp-admin" /></label>
      {missing.length > 0 && r.status !== 'approved' && <p className="mr-missing">قبل الإرسال: {missing.join(' · ')}</p>}
    </section>}
  </main>;
}

/* ───────── 3) المطبوع A4 ───────── */
export function ProfileDoc({ r, onClose }: { r: any; onClose?: () => void }) {
  const c: ProfileComputed = r.computed; const b: ProfileBody = r.body;
  return <main className="pt-main pr" data-testid="dp-doc"><style dangerouslySetInnerHTML={{ __html: MR_CSS + MR_PRINT_CSS }} />
    <div className="pr-bar">{onClose && <button type="button" className="pt-btn ghost small" onClick={onClose}><Icon name="arrow" size={14} /> عودة للمحرّر</button>}<button type="button" className="pt-btn navy small" onClick={() => window.print()}><Icon name="print" size={14} /> اطبع / احفظ PDF</button><small>A4 · {R4B_NAMES_AR.official}</small></div>
    <article className="pr-page">
      <header className="pr-head"><div><h1>{R4B_NAMES_AR.profile} — {c.subject.name}</h1><p>{c.program_ar}{c.org_ar ? ` · ${c.org_ar}` : ''}{c.classroom_ar ? ` · ${c.classroom_ar}` : ''}</p><p>{c.units_closed} من {c.units_total} وحدات مغلقة · بلغ ناتج {c.units_reached} · حضور {c.attendance_pct ?? '—'}% · {c.hours} ساعة</p></div><div className="pr-meta"><span>المعلّم: {c.trainer_ar}</span>{r.verify_code && <span>رمز التحقّق: {r.verify_code}</span>}{r.approved_name && <span>اعتمده: {r.approved_name}</span>}{c.supersedes_code && <span>يَنسخ: {c.supersedes_code}</span>}</div></header>
      <h2>١ · المسار</h2><table><thead><tr><th>#</th><th>الوحدة</th><th>الحالة</th><th>درجته</th><th>قرار الوحدة</th><th>الرمز</th></tr></thead><tbody>{c.units.map(u => <tr key={u.idx}><td>{u.idx}</td><th>{u.title_ar}</th><td>{UNIT_STATE_AR[u.state]}</td><td>{u.score ?? '—'}</td><td>{u.decision ? UNIT_DECISION_AR[u.decision as keyof typeof UNIT_DECISION_AR] : '—'}</td><td>{u.verify_code || '—'}</td></tr>)}</tbody></table>
      <p className="pr-key">حول الدبلوم: {c.around.missions} مهمة مصدَّقة · {c.around.rehearsals} بروفة · {c.around.cases} «كل يوم مهارة» · {c.around.stations} محطة{c.attention.length ? ` · ذُكر في ${R4_NAMES_AR.attention} ${c.attention.length} مرّة` : ''}</p>
      <h2>٢ · الكفايات</h2><table><thead><tr><th>الكفاية</th><th>الأدلّة</th><th>{R4B_NAMES_AR.suggest}</th><th>المستوى</th><th>الشاهد</th></tr></thead><tbody>{c.competencies.map(k => { const l = b.levels.find(x => x.code === k.code); return <tr key={k.code}><th>{k.name_ar}</th><td>{[k.avg !== null ? `متوسط ${k.avg}%` : '', k.missions ? `م${k.missions}` : '', k.cases ? `ي${k.cases}` : '', k.passport_computed ? `جواز ${k.passport_computed}` : ''].filter(Boolean).join(' · ') || '—'}</td><td>{k.suggested === null ? '—' : levelAr(k.suggested)}</td><td><b>{levelAr(l?.level ?? 0)}</b></td><td>{l?.evidence || '—'}</td></tr>; })}</tbody></table>
      {b.quotes.length > 0 && <><h2>٣ · من الأدلّة</h2><ul>{b.quotes.map((q, i) => <li key={i}>{c.competencies.find(k => k.code === q.code)?.name_ar}: «{q.text}» — {q.source}</li>)}</ul></>}
      <h2>{b.quotes.length ? '٤' : '٣'} · {R4B_NAMES_AR.distinguish}</h2><p className="pr-p">{b.strengths || '—'}</p><h2>{b.quotes.length ? '٥' : '٤'} · {R4B_NAMES_AR.keep}</h2><p className="pr-p">{b.keep || '—'}</p>
      <h2>{b.quotes.length ? '٦' : '٥'} · {R4B_NAMES_AR.recommendation}</h2><p className="pr-p"><b>{b.recommendation ? PROFILE_REC_AR[b.recommendation] : '—'}</b>{b.plan ? ` — ${b.plan}` : ''}</p>
      <p className="pr-key">سُلّم المستوى هو سُلّم {R4B_NAMES_AR.passport}: {PROFILE_LEVEL_AR.slice(1).map((n, i) => `${i + 1} ${n}`).join(' · ')} — و«{R4B_NAMES_AR.not_proven}» تعني أن لا شاهد كافيًا بعد، لا أن القدرة غائبة.</p>
      <table className="pr-sign"><thead><tr><th>المعلّم</th><th>اعتماد الطاقم</th></tr></thead><tbody><tr><td>{r.author_name || ''}</td><td>{r.approved_name || ''}{r.approved_at ? ` · ${fmtDayAr(String(r.approved_at).slice(0, 10))}` : ''}</td></tr></tbody></table>
      <footer className="pr-foot"><p>«{R4B_NAMES_AR.story}» — {R4B_NAMES_AR.motto}</p>{r.verify_code && <p>التحقّق: /verify/report/{r.verify_code}</p>}</footer>
    </article>
  </main>;
}

/* ───────── 4) صفحة المتدرّب: كشفي كاملًا ───────── */
export function MyProfileLine({ id, token }: { id: string; token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const j = await api(token, `/api/reports?line=${encodeURIComponent(id)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token, id]);
  useEffect(() => { load(); }, [load]);
  async function toggle(on: boolean) { setBusy(true); const j = await api(token, '/api/reports', { action: 'line_show', line_id: id, on }); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } await load(); }
  if (!d) return <main className="pt-main mr"><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const l = d.line; const x = l.data || {}; const lv: any[] = x.levels || []; const qs: any[] = x.quotes || [];
  return <main className="pt-main mr dp-my" data-testid="dp-my"><style dangerouslySetInnerHTML={{ __html: MR_CSS + CSS }} />
    <section className="pt-box mr-head"><span className="pt-kicker"><Icon name="certificate" size={14} /> {R4B_NAMES_AR.my_profile} · «{R4B_NAMES_AR.story}»</span><h1>{l.program_ar}</h1>
      <p className="pt-muted">{x.org_ar ? `${x.org_ar} · ` : ''}اعتُمد {fmtDayAr(l.period_to)}{l.approved_name ? ` · اعتمده ${l.approved_name}` : ''} · رمز التحقّق <span dir="ltr">{l.verify_code}</span> · <Link href={`/verify/report/${l.verify_code}`}>صفحة التحقّق</Link></p>
      <div className="mr-kpis"><span><b>{lv.filter(v => (v.level || 0) >= 1).length}</b>/{lv.length} <small>كفايات أثبتَّها</small></span><span className="b"><b>{x.units_reached ?? '—'}</b>/{x.units_total ?? '—'} <small>وحدات بلغتَ ناتجها</small></span><span><b>{x.hours ?? '—'}</b> <small>ساعة</small></span></div>
      <p className="pt-muted">{x.recommendation_ar && <>{R4B_NAMES_AR.recommendation}: <b>{x.recommendation_ar}</b>{x.plan ? ` — ${x.plan}` : ''} · </>}مستوياتك هذه عادت إلى <Link href="/me/skills">{R4B_NAMES_AR.passport}</Link> مستويات معتمَدة.</p>
      {l.mine && <p><label className="cs-chk" style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center' }}><input type="checkbox" checked={!!l.show_on_credential} onChange={e => toggle(e.target.checked)} disabled={busy} data-testid="dp-show-cred" /> {R4B_NAMES_AR.show_cred} <small className="pt-muted">(الكفايات بمستوياتها و«ما يميّزك» — بلا التوصية)</small></label></p>}
      {err && <p className="mr-err" role="alert">{err}</p>}
    </section>
    <section className="pt-box mr-sec"><h3>كفاياتك</h3><ul className="lv" data-testid="dp-my-levels">{lv.map((v, i) => <li key={i} data-level={v.level}><b>{v.level_ar}</b>{v.name_ar}{v.evidence && <p>{v.evidence}</p>}{qs.filter(q => q.code === v.code).map((q, j) => <p key={j}>«{q.text}» <small className="pt-muted">— {q.source}</small></p>)}</li>)}</ul></section>
    {(x.strengths || x.keep) && <section className="pt-box mr-sec">{x.strengths && <><h3>{R4B_NAMES_AR.distinguish}</h3><p>{x.strengths}</p></>}{x.keep && <><h3>{R4B_NAMES_AR.keep}</h3><p>{x.keep}</p></>}</section>}
    <p><Link href="/me#report-lines" className="pt-btn ghost small"><Icon name="arrow" size={14} /> بوابتي</Link></p>
  </main>;
}

/* ───────── 5) قراءة الدفعة (عامّة · k ≥ 5 · بلا أسماء) ───────── */
export function CohortReading({ cohort, title }: { cohort: any; title?: string }) {
  if (!cohort) return null;
  return <div className="dp-co" data-testid="dp-cohort" data-shown={cohort.shown ? '1' : '0'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <b>{R4B_NAMES_AR.cohort}{title ? ` — ${title}` : ''}</b>
    {!cohort.shown ? <p className="pt-muted" data-testid="dp-cohort-hidden">تظهر القراءة حين تُعتمد {COHORT_MIN} كشوف كفايات على الأقل — اعتُمد {cohort.n} حتى الآن.</p> : <>
      <p className="pt-muted">{cohort.n} كشفًا معتمَدًا · إتمام {cohort.completion_pct}%{cohort.avg_hours ? ` · متوسط الساعات ${cohort.avg_hours}` : ''}</p>
      <table><thead><tr><th>الكفاية</th><th>التوزيع</th><th>متوسط المستوى</th></tr></thead><tbody>{cohort.competencies.map((k: any) => <tr key={k.code}><th>{k.name_ar}</th><td><div className="dp-bar" title={k.dist.map((n: number, i: number) => `${PROFILE_LEVEL_AR[i]}: ${n}`).join(' · ')}>{k.dist.map((n: number, i: number) => n > 0 && <i key={i} data-l={i} style={{ width: `${(n / cohort.n) * 100}%` }} />)}</div></td><td>{k.avg_level ?? '—'}</td></tr>)}</tbody></table>
      <small className="pt-muted">الألوان من «{PROFILE_LEVEL_AR[0]}» إلى «{PROFILE_LEVEL_AR[5]}» — بلا أسماء.</small></>}
  </div>;
}
/** داخل /verify لتقرير وحدة: قراءة الدفعة لبرنامجها */
export function VerifyCohort({ programId }: { programId: string }) {
  const [c, setC] = useState<any>(null);
  useEffect(() => { if (!programId) return; fetch(`/api/reports?cohort=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setC(j?.success ? j.cohort : null)).catch(() => setC(null)); }, [programId]);
  if (!c || !c.n) return null; return <CohortReading cohort={c} />;
}
/** داخل /org: قراءة دفعات برامج الجهة */
export function OrgCohorts({ orgId, token }: { orgId: string; token: () => Promise<string> }) {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => { if (!orgId) return; (async () => { try { const tk = await token(); const j = await fetch(`/api/reports?org_cohorts=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); setList(j?.success ? j.cohorts : []); } catch { setList([]); } })(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!list || !list.length) return null;
  return <section className="pt-box" data-testid="dp-org"><h3><Icon name="certificate" size={16} /> {R4B_NAMES_AR.cohort} — {R4B_NAMES_AR.profile}</h3>{list.map(c => <CohortReading key={c.program_id} cohort={c} title={c.program_ar} />)}</section>;
}
