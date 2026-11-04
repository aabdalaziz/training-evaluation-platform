'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P48-أ «ملف الاعتماد الحيّ» (الرسمي: ملف الدراسة الذاتية للاعتماد البرامجي)
 *  <AccredFile>   /me/accreditation?program=<pid>  — المصمّم/قائد البرنامج: 4 معايير × (ما ثبت · ما ينقص · فقرة موقَّعة) + شروط التأهّل + خريطة الكفايات إلى معايير المعلّم
 *  <AccredAdmin>  /admin/accreditation             — الطاقم: كل الملفات موجزةً · أضعف معيار عبر البرامج · تحرير نصوص المعايير بلا نشر كود
 *  قواعد: التغطية بكلمات (مستوفى · جزئي · ناقص · يدوي) لا ألوان وحدها · الذكاء يسوّد والإنسان يوقّع · لا أسماء متدرّبين.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P48_NAMES_AR, P48B_NAMES_AR, COVERAGE_AR, NARRATIVE_MIN, NARRATIVE_MAX, NOTE_MAX, type Coverage } from '../../lib/accreditation/registry';

type Tok = () => Promise<string>;
async function api(token: Tok, path: string, body?: any) { const t = await token(); const r = await fetch(path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' }); try { return await r.json(); } catch { return { success: false, error: 'استجابة غير صالحة' }; } }
const fmtT = (d: string | null) => (d ? new Date(d).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const fmtDay = (d: string | null) => (d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const TONE: Record<Coverage, string> = { met: 'ok', partial: 'mid', missing: 'no', manual: 'man' };

/* ───────── 1) ملف البرنامج ───────── */
export function AccredFile({ token, programId }: { token: Tok; programId: string | null }) {
  const [scope, setScope] = useState<any>(null); const [pid, setPid] = useState<string>(programId || ''); const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [open, setOpen] = useState<string>('1');
  useEffect(() => { api(token, '/api/accreditation?scope=1').then(j => { if (j?.success) { setScope(j); if (!pid && j.programs?.[0]) setPid(String(j.programs[0].id)); } else setErr(j?.error || 'تعذّر التحميل'); }); }, [token]);   // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => { if (!pid) return; const j = await api(token, `/api/accreditation?program=${encodeURIComponent(pid)}`); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); setD(null); return; } setErr(''); setD(j); }, [token, pid]);
  useEffect(() => { load(); }, [load]);
  if (!scope) return <main className="pt-main ac"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  const programs: any[] = scope.programs || [];
  return <main className="pt-main ac" data-testid="ac-file"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box ac-hero">
      <span className="pt-kicker"><Icon name="award" size={14} /> {P48_NAMES_AR.official} · {P48_NAMES_AR.body_ar}</span>
      <h1>{P48_NAMES_AR.file}{d ? ` — ${d.program.name_ar}` : ''}</h1>
      <p className="ac-lead">{P48_NAMES_AR.motto}. كل ما يُعتمَد في أَثَر (التصميم · الوحدات · التقارير · المراجعة · نسخة الدفعة · محطات الأثر · سير المدرّبين) يعلّق نفسه دليلًا تحت معياره الفرعي من «{P48_NAMES_AR.pas}». أنت تكتب فقرة المعيار وتوقّعها؛ الذكاء يسوّد من الأدلة فقط.</p>
      <div className="ac-row">
        {programs.length > 1 && <label className="ac-pick">البرنامج <select value={pid} onChange={e => setPid(e.target.value)} data-testid="ac-program">{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>}
        <Link href="/me/reports" className="pt-btn ghost small"><Icon name="arrow" size={14} /> تقاريري</Link>
        {scope.staff && <Link href="/admin/accreditation" className="pt-btn ghost small">ملفات الاعتماد (الطاقم)</Link>}
      </div>
      {!programs.length && <p className="pt-muted" data-testid="ac-none">لا برنامج في نطاقك بعد — حين يربطك الطاقم بشعبة يظهر ملف برنامجها هنا.</p>}
    </section>
    {err && <section className="pt-box"><p className="ac-err" role="alert">{err}</p></section>}
    {d && <>
      <section className="pt-box" data-testid="ac-summary">
        <div className="ac-kpis"><span className="b"><b>{d.score.met}</b>/{d.score.total} <small>معيارًا فرعيًّا مستوفى</small></span><span><b>{d.score.pct}%</b> <small>التغطية</small></span><span><b>{d.evidence_n}</b> <small>دليلًا معتمَدًا</small></span><span><b>{d.narratives.filter((n: any) => n.signed_at).length}</b> <small>فقرة موقَّعة</small></span></div>
        <div className="ac-elig" data-testid="ac-eligibility"><b>{P48_NAMES_AR.eligibility} (كما تعلنها الهيئة — تُشتقّ ولا تُكتب):</b> <ul>{d.eligibility.map((e: any) => <li key={e.key} data-ok={e.ok ? '1' : '0'}><span className={`ac-st ${e.ok ? 'ok' : 'no'}`}>{e.ok ? 'متحقّق' : 'ليس بعد'}</span> {e.text_ar}</li>)}</ul></div>
        {d.tasks.length > 0 && <div className="ac-tasks" data-testid="ac-tasks"><b><Icon name="target" size={14} /> {P48_NAMES_AR.missing} ({d.tasks.length}) — كل نقص يفتح الخدمة التي تُنتج دليله:</b><ul>{d.tasks.slice(0, 12).map((t: any) => <li key={t.code}><span className={`ac-st ${TONE[t.state as Coverage]}`}>{COVERAGE_AR[t.state as Coverage]}</span> <b>{t.code}</b> {t.task_ar} {t.href.startsWith('#') ? <button type="button" className="ac-link" onClick={() => { setOpen(t.code.split('.')[0]); setTimeout(() => document.getElementById(`ac-nar-${t.code}`)?.scrollIntoView({ behavior: 'smooth' }), 50); }}>{P48_NAMES_AR.produce} ←</button> : <Link href={t.href}>{P48_NAMES_AR.produce} ←</Link>}</li>)}</ul></div>}
      </section>
      <FreezePanel d={d} token={token} onChanged={load} />
      {d.ageing?.length > 0 && <section className="pt-box ac-age" data-testid="ac-ageing"><h2><Icon name="clock" size={16} /> {P48B_NAMES_AR.ageing_card} ({d.ageing.length}) <small className="pt-muted">— أدلة مضى عليها 12 شهرًا فأكثر؛ المراجِع يسأل: «هل ما زال هذا صحيحًا؟»</small></h2><ul>{d.ageing.slice(0, 10).map((e: any) => <li key={e.id}><span className="ac-st man">{P48B_NAMES_AR.ageing}</span> {e.label_ar} · {fmtDay(e.at)} · <b>{e.codes.join('، ')}</b>{e.href && !e.href.startsWith('#') && <> · <Link href={e.href}>{P48_NAMES_AR.produce} ←</Link></>}</li>)}</ul></section>}
      {d.coverage.map((s: any) => <StandardCard key={s.code} s={s} d={d} open={open === s.code} onToggle={() => setOpen(open === s.code ? '' : s.code)} token={token} onChanged={load} />)}
      <ReviewerClock timeline={d.timeline || []} />
      <SkillMapPanel d={d} token={token} onChanged={load} />
    </>}
  </main>;
}
function StandardCard({ s, d, open, onToggle, token, onChanged }: { s: any; d: any; open: boolean; onToggle: () => void; token: Tok; onChanged: () => Promise<void> }) {
  const std = d.standards.find((x: any) => x.code === s.code); const nar = d.narratives.find((n: any) => n.framework === 'pas' && n.code === s.code);
  return <section className="pt-box ac-std" data-testid="ac-std" data-code={s.code} data-pct={s.pct}>
    <button type="button" className="ac-head" onClick={onToggle} aria-expanded={open} data-testid="ac-std-toggle">
      <span className="ac-num">{s.code}</span><span className="ac-title"><b>{std?.title_ar}</b><small>{s.met} {COVERAGE_AR.met} · {s.partial} {COVERAGE_AR.partial} · {s.missing} {COVERAGE_AR.missing} · {s.manual} {COVERAGE_AR.manual} — {s.pct}%</small></span>
      <span className="ac-bar" aria-hidden="true"><i style={{ width: `${s.pct}%` }} /></span><Icon name={open ? 'x' : 'plus'} size={14} />
    </button>
    {open && <div className="ac-body">
      <p className="ac-text">{std?.text_ar}</p>
      <ol className="ac-subs" data-testid="ac-subs">{s.subs.map((x: any) => { const sub = d.standards.find((y: any) => y.code === x.code); return <li key={x.code} data-state={x.state} data-testid="ac-sub">
        <div className="ac-subh"><span className={`ac-st ${TONE[x.state as Coverage]}`}>{COVERAGE_AR[x.state as Coverage]}</span> <b>{x.code}</b> {sub?.title_ar}{x.signed && <span className="ac-signed"><Icon name="check" size={12} /> فقرة موقَّعة</span>}</div>
        <small className="pt-muted">{sub?.text_ar}</small>
        {x.state === 'manual' || (x.signed && !x.evidence.length) ? <NarrativeBox code={x.code} programId={d.program.id} nar={d.narratives.find((n: any) => n.framework === 'pas' && n.code === x.code)} token={token} onChanged={onChanged} compact /> : null}
        {x.evidence.length > 0 ? <ul className="ac-ev">{x.evidence.map((e: any) => <li key={e.id}><Icon name="check" size={12} /> {e.label_ar}{e.at ? ` · ${fmtDay(e.at)}` : ''}{e.href && !e.href.startsWith('#') && <> · <Link href={e.href}>{e.href.startsWith('/verify') ? 'تحقّق' : 'افتح'}</Link></>}</li>)}</ul> : (x.state === 'manual' || x.signed ? null : <p className="ac-task"><Icon name="target" size={12} /> {x.task_ar}</p>)}
      </li>; })}</ol>
      <NarrativeBox code={s.code} programId={d.program.id} nar={nar} token={token} onChanged={onChanged} />
    </div>}
  </section>;
}
function NarrativeBox({ code, programId, nar, token, onChanged, compact }: { code: string; programId: string; nar: any; token: Tok; onChanged: () => Promise<void>; compact?: boolean }) {
  const [text, setText] = useState<string>(nar?.text_ar || ''); const [src, setSrc] = useState<string>(nar?.source || 'human'); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  useEffect(() => { setText(nar?.text_ar || ''); setSrc(nar?.source || 'human'); }, [nar?.text_ar, nar?.source]);
  async function draft(local = false) { setBusy('draft'); setErr(''); setOk(''); const j = await api(token, '/api/accreditation', { action: 'narrative_draft', program_id: programId, code, local }); setBusy(''); if (!j.success) { setErr(j.error || 'تعذّرت المسودّة'); return; } setText(j.text_ar); setSrc(j.source); setOk(j.source === 'ai' ? 'مسودّة من الذكاء الاصطناعي من الأدلة فقط — راجعها ثم وقّع' : 'مسودّة محلية من الأدلة — عدّلها ثم وقّع'); }
  async function sign() { setBusy('sign'); setErr(''); setOk(''); const j = await api(token, '/api/accreditation', { action: 'narrative_sign', program_id: programId, code, text_ar: text, source: src }); if (!j.success) { setBusy(''); setErr(j.error || 'فشل التوقيع'); return; } await onChanged(); setBusy(''); setOk('وُقِّعت الفقرة'); }
  const dirty = text !== (nar?.text_ar || '');
  return <div className="ac-nar" id={`ac-nar-${code}`} data-testid="ac-narrative">
    <label><b>{P48_NAMES_AR.narrative} {code}</b> <small className="pt-muted">— {compact ? 'معيار يُستوفى بفقرة موقَّعة (لا دليل آلي له)؛' : 'فقرة الدراسة الذاتية؛'} لا تُحفظ إلا موقَّعة ({text.length}/{NARRATIVE_MAX}){nar?.signed_at ? ` · ${P48_NAMES_AR.signed}: ${nar.signed_name} · ${fmtDay(nar.signed_at)}${dirty ? ' · معدَّلة غير موقَّعة' : ''}` : ''}</small>
      <textarea value={text} onChange={e => { setText(e.target.value.slice(0, NARRATIVE_MAX)); setSrc('human'); }} rows={compact ? 3 : 5} maxLength={NARRATIVE_MAX} data-testid="ac-nar-text" placeholder="اكتب الفقرة أو اطلب مسودّة من الأدلة…" /></label>
    <div className="ac-row">
      <button type="button" className="pt-btn navy small" onClick={() => draft(false)} disabled={!!busy} data-testid="ac-nar-draft"><Icon name="spark" size={14} /> {busy === 'draft' ? '…' : P48_NAMES_AR.draft}</button>
      <button type="button" className="pt-btn ghost small" onClick={() => draft(true)} disabled={!!busy} data-testid="ac-nar-local">بالقاعدة المحلية فقط</button>
      <button type="button" className="pt-btn gold small" onClick={sign} disabled={!!busy || text.trim().length < NARRATIVE_MIN || (!dirty && !!nar?.signed_at)} data-testid="ac-nar-sign"><Icon name="check" size={14} /> {busy === 'sign' ? '…' : nar?.signed_at && !dirty ? P48_NAMES_AR.signed : P48_NAMES_AR.sign}</button>
      {err && <span className="ac-err" role="alert" data-testid="ac-nar-err">{err}</span>}{ok && <span className="ac-ok" data-testid="ac-nar-ok">{ok}</span>}
    </div>
  </div>;
}
function SkillMapPanel({ d, token, onChanged }: { d: any; token: Tok; onChanged: () => Promise<void> }) {
  const [map, setMap] = useState<Record<string, string[]>>(d.skill_map || {}); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { setMap(d.skill_map || {}); }, [d.skill_map]);
  const tps: any[] = d.tps || []; const skills: any[] = d.skills || []; const dirty = JSON.stringify(map) !== JSON.stringify(d.skill_map || {});
  const toggle = (sk: string, code: string) => setMap(m => { const cur = new Set(m[sk] || []); if (cur.has(code)) cur.delete(code); else cur.add(code); const n = { ...m }; if (cur.size) n[sk] = Array.from(cur); else delete n[sk]; return n; });
  async function save() { setBusy(true); setErr(''); setOk(''); const j = await api(token, '/api/accreditation', { action: 'skill_map', program_id: d.program.id, map }); if (!j.success) { setBusy(false); setErr(j.error || 'فشل الحفظ'); return; } await onChanged(); setBusy(false); setOk('حُفظت الخريطة — وصارت دليلًا للمعيار 1.1'); }
  if (!skills.length) return null;
  return <section className="pt-box ac-map" id="tps" data-testid="ac-map">
    <h2><Icon name="target" size={16} /> {P48_NAMES_AR.map} <small className="pt-muted">— الإطار الثاني «{P48_NAMES_AR.tps}» (3 مجالات · 10 معايير عامة): اربط كل كفاية في قالب البرنامج بما تخدمه؛ التغطية تصير دليلًا على توافق النواتج مع المعايير المهنية (1.1)</small></h2>
    <p className="ac-kpis"><span className="b"><b>{d.skill_map_coverage.n}</b>/{d.skill_map_coverage.total} <small>معيارًا عامًّا مغطًّى</small></span></p>
    <div className="ac-grid" role="table" aria-label={P48_NAMES_AR.map}>
      <div className="ac-gh" role="row"><span role="columnheader">الكفاية</span>{tps.map(t => <span key={t.code} role="columnheader" title={t.title_ar}><b>{t.code}</b><small>{t.title_ar}</small></span>)}</div>
      {skills.map(sk => <div className="ac-gr" role="row" key={sk.code} data-testid="ac-map-row"><span role="rowheader"><b>{sk.code}</b> {sk.name_ar}</span>{tps.map(t => <label key={t.code} role="cell"><input type="checkbox" checked={(map[sk.code] || []).includes(t.code)} onChange={() => toggle(sk.code, t.code)} aria-label={`${sk.name_ar} ← المعيار ${t.code}`} data-testid="ac-map-cb" /></label>)}</div>)}
    </div>
    <div className="ac-row"><button type="button" className="pt-btn gold small" onClick={save} disabled={busy || !dirty} data-testid="ac-map-save"><Icon name="save" size={14} /> {busy ? '…' : dirty ? 'احفظ الخريطة' : 'محفوظة'}</button>{err && <span className="ac-err" role="alert">{err}</span>}{ok && <span className="ac-ok" data-testid="ac-map-ok">{ok}</span>}</div>
  </section>;
}

/* ───────── P48-ب: التجميد · ساعة المراجِع ───────── */
function FreezePanel({ d, token, onChanged }: { d: any; token: Tok; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [missing, setMissing] = useState<string[]>([]); const [done, setDone] = useState<any>(null); const [openForm, setOpenForm] = useState(false);
  const snaps: any[] = d.snapshots || []; const last = snaps[0] || null; const can = (d.freeze_missing || []).length === 0;
  async function freeze() { setBusy(true); setErr(''); setMissing([]); setDone(null); const j = await api(token, '/api/accreditation', { action: 'freeze', program_id: d.program.id, note_ar: note }); if (!j.success) { setBusy(false); setErr(j.error || 'تعذّر التجميد'); setMissing(j.missing || []); return; } await onChanged(); setBusy(false); setDone(j); setNote(''); setOpenForm(false); }
  return <section className="pt-box ac-frz" data-testid="ac-freeze">
    <div className="ac-frzh"><h2><Icon name="shield" size={16} /> {P48B_NAMES_AR.snapshots} ({snaps.length}) <small className="pt-muted">— {P48B_NAMES_AR.official}: بصمة SHA-256 ورمز تحقّق عام يفتحه المراجِع بلا دخول وبلا أسماء</small></h2>
      <div className="ac-row">{!openForm && <button type="button" className="pt-btn gold small" onClick={() => setOpenForm(true)} data-testid="ac-freeze-open" disabled={busy}><Icon name="shield" size={14} /> {P48B_NAMES_AR.freeze}</button>}{last && <Link href={`/verify/accreditation/${last.code}`} className="pt-btn ghost small" data-testid="ac-freeze-last">آخر نسخة · <span dir="ltr">{last.code}</span></Link>}</div></div>
    {!can && <p className="ac-task" data-testid="ac-freeze-blocked"><Icon name="target" size={12} /> لا يُجمَّد الملف قبل فقرة موقَّعة لكل معيار رئيس: {(d.freeze_missing || []).map((m: string) => m.split(' ')[1]).join(' · ')}</p>}
    {openForm && <div className="ac-nar" data-testid="ac-freeze-form"><label><b>{P48B_NAMES_AR.note}</b> <small className="pt-muted">— اختيارية، ≤ {NOTE_MAX} حرفًا، تُختم مع النسخة ({note.length}/{NOTE_MAX})</small><textarea rows={2} value={note} onChange={e => setNote(e.target.value.slice(0, NOTE_MAX))} maxLength={NOTE_MAX} data-testid="ac-freeze-note" placeholder="مثال: هذه النسخة تُسلَّم مع طلب الاعتماد؛ النواقص في 3.5 و4.3 لها خطة حتى نهاية الفصل." /></label>
      <p className="pt-muted" style={{ margin: 0, fontSize: '.85rem' }}>ما سيُختم: {d.score.met}/{d.score.total} مستوفى · {d.narratives.filter((n: any) => n.signed_at).length} فقرة موقَّعة · {d.evidence_n} دليلًا · شروط التأهّل {d.eligibility.every((e: any) => e.ok) ? 'متحقّقة' : 'غير مكتملة (تُعلَن كما هي)'}{d.ageing?.length ? ` · ${d.ageing.length} دليل سيشيخ` : ''}.</p>
      <div className="ac-row"><button type="button" className="pt-btn gold small" onClick={freeze} disabled={busy || !can} data-testid="ac-freeze-go"><Icon name="check" size={14} /> {busy ? '…' : 'اختم النسخة الآن'}</button><button type="button" className="pt-btn ghost small" onClick={() => setOpenForm(false)}>إلغاء</button>{err && <span className="ac-err" role="alert" data-testid="ac-freeze-err">{err}{missing.length ? ` — ${missing.join('؛ ')}` : ''}</span>}</div></div>}
    {done && <p className="ac-ok" data-testid="ac-freeze-ok">خُتمت النسخة <b dir="ltr">{done.snapshot.code}</b> · <Link href={`/verify/accreditation/${done.snapshot.code}`}>افتح صفحة التحقّق</Link>{done.diff && <> · {P48B_NAMES_AR.diff}: {done.diff.met_from} → {done.diff.met_to} مستوفى</>}</p>}
    {d.diff && last && <p className="ac-diff" data-testid="ac-diff"><b>{P48B_NAMES_AR.diff} ({fmtDay(last.frozen_at)}):</b> {d.diff.improved.length ? <>صعد {d.diff.improved.map((x: any) => <span key={x.code} className="ac-st ok">{x.code}: {COVERAGE_AR[x.from as Coverage]} → {COVERAGE_AR[x.to as Coverage]}</span>)}</> : 'لا صعود'}{d.diff.regressed.length ? <> · نزل {d.diff.regressed.map((x: any) => <span key={x.code} className="ac-st no">{x.code}: {COVERAGE_AR[x.from as Coverage]} → {COVERAGE_AR[x.to as Coverage]}</span>)}</> : null} · المستوفى {d.diff.met_from} → {d.diff.met_to}</p>}
    {snaps.length > 0 && <ul className="ac-snaps" data-testid="ac-snaps">{snaps.map((s: any) => <li key={s.code}><span dir="ltr" className="ac-code">{s.code}</span><span>{fmtT(s.frozen_at)} · {s.frozen_name}</span><span>{s.score_met}/{s.score_total} مستوفى · {s.eligible ? 'مؤهَّل' : 'التأهّل غير مكتمل'}</span>{s.note_ar && <small className="pt-muted">«{s.note_ar}»</small>}<Link href={`/verify/accreditation/${s.code}`}>تحقّق</Link></li>)}</ul>}
  </section>;
}
export function ReviewerClock({ timeline, compact }: { timeline: any[]; compact?: boolean }) {
  const [top, setTop] = useState(''); const items = timeline.filter(t => !top || (t.codes || []).some((c: string) => c.split('.')[0] === top));
  if (!timeline.length) return null;
  return <section className="pt-box ac-clock" data-testid="ac-clock"><h2><Icon name="clock" size={16} /> {P48B_NAMES_AR.clock} <small className="pt-muted">— البرنامج كقصة: كل دليل في وقته، من أول احتياج إلى آخر محطة أثر</small></h2>
    {!compact && <div className="ac-row ac-filters" role="group" aria-label="تصفية حسب المعيار">{['', '1', '2', '3', '4'].map(c => <button key={c} type="button" className={`pt-btn small ${top === c ? 'navy' : 'ghost'}`} onClick={() => setTop(c)} aria-pressed={top === c} data-testid="ac-clock-filter">{c ? `المعيار ${c}` : 'الكل'}</button>)}</div>}
    <ol className="ac-tl">{items.map((t, i) => <li key={i} data-ageing={t.ageing ? '1' : '0'} data-testid="ac-clock-item"><span className="ac-tld">{t.at ? fmtDay(t.at) : 'بلا تاريخ'}</span><span className="ac-tlk">{t.kind_ar}</span><span className="ac-tll">{t.label_ar}</span><span className="ac-tlc">{(t.codes || []).join(' · ')}</span>{t.ageing && <span className="ac-st man">{P48B_NAMES_AR.ageing}</span>}</li>)}</ol>
  </section>;
}
/** صفحة التحقّق العامة /verify/accreditation/<code> — بلا دخول · بلا أسماء · طباعة A4 */
export function AccredVerify({ code }: { code: string }) {
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { fetch(`/api/accreditation?verify=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.snapshot || null)).catch(() => setD(null)); }, [code]);
  return <main className="pt-main ac ac-ver" data-testid="ac-verify"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box ac-hero"><span className="pt-kicker"><Icon name="shield" size={14} /> {P48B_NAMES_AR.verify} · {P48_NAMES_AR.body_ar}</span>
      {d === undefined && <p className="pt-muted">…</p>}
      {d === null && <><h1>لا توجد نسخة مختومة بهذا الرمز</h1><p className="pt-muted" dir="ltr">{code}</p><p><Link href="/verify">التحقّق من الشهادات</Link></p></>}
      {d && <>
        <h1>{P48_NAMES_AR.official} — {d.program_ar}</h1>
        <p className="ac-lead">{P48B_NAMES_AR.snapshot} خُتمت في {fmtT(d.frozen_at)} بواسطة {d.frozen_name} · {d.org_ar ? `الجهة: ${d.org_ar} · ` : ''}رمز <b dir="ltr">{d.code}</b>{d.superseded && <> · <span className="ac-st man">نُسخت بنسخة أحدث</span> <Link href={`/verify/accreditation/${d.superseded.code}`}>افتح الأحدث</Link></>}</p>
        <p className={`ac-intact ${d.intact ? 'ok' : 'no'}`} data-testid="ac-verify-intact"><Icon name={d.intact ? 'check' : 'alert'} size={14} /> {d.intact ? P48B_NAMES_AR.intact : P48B_NAMES_AR.tampered} — SHA-256 <code dir="ltr">{d.sha256}</code> · إصدار نصوص المعايير <code dir="ltr">{d.standards_sha_short}</code></p>
        <div className="ac-kpis"><span className="b"><b>{d.met}</b>/{d.total} <small>معيارًا فرعيًّا مستوفى</small></span><span><b>{d.pct}%</b> <small>التغطية</small></span><span><b>{(d.narratives || []).length}</b> <small>فقرة موقَّعة</small></span><span><b>{(d.timeline || []).length}</b> <small>دليلًا</small></span>{d.ageing_n > 0 && <span><b>{d.ageing_n}</b> <small>{P48B_NAMES_AR.ageing}</small></span>}<span className={d.eligible ? 'b' : ''}><small>{d.eligible ? 'شروط التأهّل متحقّقة' : 'شروط التأهّل غير مكتملة (مُعلَنة)'}</small></span></div>
        {d.note_ar && <blockquote className="ac-note" data-testid="ac-verify-note"><b>{P48B_NAMES_AR.note}:</b> «{d.note_ar}»</blockquote>}
        <div className="ac-row no-print"><button type="button" className="pt-btn ghost small" onClick={() => window.print()} data-testid="ac-verify-print"><Icon name="print" size={14} /> طباعة / {P48B_NAMES_AR.delivery}</button><Link href="/" className="pt-btn ghost small"><Icon name="home" size={14} /> الرئيسية</Link></div>
      </>}
    </section>
    {d && <>
      <section className="pt-box" data-testid="ac-verify-elig"><h2>{P48_NAMES_AR.eligibility} (كما كانت عند الختم)</h2><ul className="ac-elig-l">{(d.eligibility || []).map((e: any) => <li key={e.key}><span className={`ac-st ${e.ok ? 'ok' : 'no'}`}>{e.ok ? 'متحقّق' : 'ليس بعد'}</span> {e.text_ar}</li>)}</ul></section>
      {(d.standards || []).map((s: any) => { const nar = (d.narratives || []).find((n: any) => n.framework === 'pas' && n.code === s.code); return <section className="pt-box ac-std ac-std-open" key={s.code} data-testid="ac-verify-std">
        <div className="ac-head as-div"><span className="ac-num">{s.code}</span><span className="ac-title"><b>{s.title_ar}</b><small>{s.met} {COVERAGE_AR.met} · {s.partial} {COVERAGE_AR.partial} · {s.missing} {COVERAGE_AR.missing} · {s.manual} {COVERAGE_AR.manual} — {s.pct}%</small></span><span className="ac-bar" aria-hidden="true"><i style={{ width: `${s.pct}%` }} /></span></div>
        <div className="ac-body">{s.text_ar && <p className="ac-text">{s.text_ar}</p>}
          <ol className="ac-subs">{s.subs.map((x: any) => <li key={x.code} data-state={x.state}><div className="ac-subh"><span className={`ac-st ${TONE[x.state as Coverage]}`}>{x.state_ar}</span> <b>{x.code}</b> {x.title_ar} <small className="pt-muted">· {x.n} دليل</small></div>{(d.narratives || []).filter((n: any) => n.code === x.code).map((n: any) => <p key={n.code} className="ac-vnar"><b>{P48_NAMES_AR.narrative} {n.code}:</b> {n.text_ar}</p>)}</li>)}</ol>
          {nar && <div className="ac-nar ac-vnarbox" data-testid="ac-verify-narrative"><b>{P48_NAMES_AR.narrative} {s.code}</b> <small className="pt-muted">— موقَّعة {fmtDay(nar.signed_at)}</small><p>{nar.text_ar}</p></div>}
        </div></section>; })}
      {d.diff && <section className="pt-box" data-testid="ac-verify-diff"><h2>{P48B_NAMES_AR.diff}</h2><p>{d.diff.improved.length ? <>صعد: {d.diff.improved.map((x: any) => <span key={x.code} className="ac-st ok">{x.code}</span>)}</> : 'لا صعود'}{d.diff.regressed.length ? <> · نزل: {d.diff.regressed.map((x: any) => <span key={x.code} className="ac-st no">{x.code}</span>)}</> : null} · المستوفى {d.diff.met_from} → {d.diff.met_to}</p></section>}
      <ReviewerClock timeline={d.timeline || []} compact />
      <p className="pt-muted ac-foot">هذه النسخة لا تحمل أسماء متدرّبين؛ الأعداد مجاميع لخمسة أشخاص فأكثر. التحقّق يعيد حساب البصمة من النسخة المحفوظة لحظيًّا. © 2026 بوابة أَثَر.</p>
    </>}
  </main>;
}
/** الشريط العام على صفحة البرنامج — يظهر بعد التجميد فقط */
export function AccredStrip({ programId }: { programId: string }) {
  const [s, setS] = useState<any>(null);
  useEffect(() => { fetch(`/api/accreditation?strip=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setS(j?.strip || null)).catch(() => setS(null)); }, [programId]);
  if (!s) return null;
  return <section className="ac-strip" data-testid="ac-strip" aria-labelledby="ac-strip-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h2 id="ac-strip-h"><Icon name="award" size={16} /> {P48B_NAMES_AR.strip}: {s.met}/{s.total} معيارًا فرعيًّا مستوفى ({s.pct}%)</h2>
    <small>{P48_NAMES_AR.official} ({P48_NAMES_AR.body_ar}) — آخر {P48B_NAMES_AR.snapshot} {fmtDay(s.frozen_at)} · {s.eligible ? 'شروط التأهّل متحقّقة' : 'التأهّل غير مكتمل (مُعلَن)'} · <Link href={`/verify/accreditation/${s.code}`}>تحقّق</Link></small>
    <ul>{(s.standards || []).map((x: any) => <li key={x.code}><b>{x.code}</b> {x.title_ar} <span>{x.pct}%</span></li>)}</ul>
  </section>;
}
/** بطاقة الجهة في /org — أرقام فقط */
export function AccredOrgCard({ orgId, token }: { orgId: string; token: Tok }) {
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { if (!orgId) return; api(token, `/api/accreditation?org=${encodeURIComponent(orgId)}`).then(j => setD(j?.success ? j.org : null)); }, [orgId, token]);
  if (!d || !d.programs) return null;
  return <section className="pt-box ac" data-testid="ac-org"><style dangerouslySetInnerHTML={{ __html: CSS }} /><h3><Icon name="award" size={16} /> ملفات اعتماد برامجنا <small className="pt-muted">— {P48B_NAMES_AR.rollup}</small></h3>
    <div className="ac-kpis"><span className="b"><b>{d.programs}</b> <small>برنامجًا منتهيًا بمؤهل</small></span><span><b>{d.avg_pct}%</b> <small>متوسط التغطية</small></span><span><b>{d.frozen}</b> <small>نسخة مختومة</small></span>{d.ageing > 0 && <span><b>{d.ageing}</b> <small>دليل سيشيخ</small></span>}{d.weakest && <span><small>أضعف معيار: <b>{d.weakest.code}</b> {d.weakest.title_ar} ({d.weakest.avg}%)</small></span>}</div>
    <ul className="ac-files">{d.files.map((f: any) => <li key={f.id}><b>{f.name_ar}</b><span className="ac-kpis"><span className="b"><b>{f.met}</b>/{f.total}</span><span><b>{f.pct}%</b></span>{f.last_code && <span><small>آخر نسخة {fmtDay(f.last_at)} · <Link href={`/verify/accreditation/${f.last_code}`}>تحقّق</Link></small></span>}</span></li>)}</ul>
  </section>;
}

/* ───────── 2) الطاقم ───────── */
export function AccredAdmin({ token }: { token: Tok }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [edit, setEdit] = useState<any>(null); const [busy, setBusy] = useState(false); const [ok, setOk] = useState('');
  const load = useCallback(async () => { const j = await api(token, '/api/accreditation?admin=1'); if (!j?.success) { setErr(j?.error || 'تعذّر التحميل'); return; } setD(j); }, [token]);
  useEffect(() => { load(); }, [load]);
  const pas = useMemo(() => (d?.standards || []).filter((s: any) => s.framework === 'pas'), [d]);
  async function save() { if (!edit) return; setBusy(true); setOk(''); const j = await api(token, '/api/accreditation', { action: 'standard_update', framework: 'pas', code: edit.code, title_ar: edit.title_ar, text_ar: edit.text_ar, source: edit.source }); setBusy(false); if (!j.success) { setErr(j.error || 'فشل'); return; } setEdit(null); setOk(`حُدِّث المعيار ${edit.code}`); await load(); }
  if (!d) return <main className="pt-main ac"><style dangerouslySetInnerHTML={{ __html: CSS }} /><section className="pt-box"><p className="pt-muted">{err || '…'}</p></section></main>;
  return <main className="pt-main ac" data-testid="ac-admin"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <section className="pt-box">
      <h2><Icon name="award" size={16} /> ملفات الاعتماد الحيّة ({d.files.length})</h2>
      {!d.files.length && <p className="pt-muted" data-testid="ac-admin-empty">لا برامج منتهية بمؤهل (دبلوم) بعد.</p>}
      <ul className="ac-files" data-testid="ac-admin-files">{d.files.map((f: any) => <li key={f.id} data-testid="ac-admin-file" data-pct={f.score.pct}><Link href={`/me/accreditation?program=${f.id}`}><b>{f.name_ar}</b></Link><span className="ac-kpis"><span className="b"><b>{f.score.met}</b>/{f.score.total}</span><span><b>{f.score.pct}%</b></span><span><b>{f.signed}</b> <small>فقرة موقَّعة</small></span><span className={f.eligible ? 'b' : ''}><small>{f.eligible ? 'مؤهَّل للتقدّم' : 'لم يستوفِ شروط التأهّل'}</small></span>{f.snapshots > 0 && <span><small>{f.snapshots} نسخة مختومة · <Link href={`/verify/accreditation/${f.last_code}`}>آخرها</Link></small></span>}{f.ageing > 0 && <span><small>{f.ageing} دليل سيشيخ</small></span>}</span><span className="ac-mini">{f.standards.map((s: any) => <i key={s.code} title={`المعيار ${s.code}: ${s.pct}%`}><b>{s.code}</b> {s.pct}%</i>)}</span></li>)}</ul>
      {d.orgs?.length > 0 && <div className="ac-orgs" data-testid="ac-admin-orgs"><h3><Icon name="globe" size={14} /> {P48B_NAMES_AR.rollup} — لكل جهة</h3><ul>{d.orgs.map((o: any) => <li key={o.organization_id || '-'} data-testid="ac-admin-org"><b>{o.org_ar}</b><span className="ac-kpis"><span className="b"><b>{o.programs}</b> <small>برنامجًا</small></span><span><b>{o.avg_pct}%</b> <small>متوسط التغطية</small></span><span><b>{o.frozen}</b> <small>نسخة مختومة</small></span>{o.ageing > 0 && <span><b>{o.ageing}</b> <small>سيشيخ</small></span>}{o.weakest && <span><small>أضعف معيار <b>{o.weakest.code}</b> ({o.weakest.avg}%)</small></span>}</span></li>)}</ul></div>}
      {d.weakest?.length > 0 && d.files.length > 0 && <p className="ac-weak" data-testid="ac-weakest">أضعف معيار عبر البرامج: <b>{d.weakest[0].code} — {d.weakest[0].title_ar}</b> ({d.weakest[0].avg}%) · أقواها: <b>{d.weakest[d.weakest.length - 1].code}</b> ({d.weakest[d.weakest.length - 1].avg}%)</p>}
    </section>
    <section className="pt-box" data-testid="ac-standards">
      <h2><Icon name="doc" size={16} /> سجلّ المعايير — {P48_NAMES_AR.pas} <small className="pt-muted">— النصّ كما طُرح على منصّة استطلاع؛ حدِّثه من الوثيقة الرسمية هنا بلا نشر كود</small></h2>
      {ok && <p className="ac-ok" data-testid="ac-std-ok">{ok}</p>}
      <ol className="ac-stdlist">{pas.map((s: any) => <li key={s.code} data-top={s.parent ? '0' : '1'}>{edit?.code === s.code ? <div className="ac-edit" data-testid="ac-std-edit"><input value={edit.title_ar} onChange={e => setEdit({ ...edit, title_ar: e.target.value.slice(0, 160) })} aria-label="عنوان المعيار" /><textarea value={edit.text_ar} onChange={e => setEdit({ ...edit, text_ar: e.target.value.slice(0, 1200) })} rows={3} aria-label="نصّ المعيار" data-testid="ac-std-text" /><label><input type="checkbox" checked={edit.source === 'draft'} onChange={e => setEdit({ ...edit, source: e.target.checked ? 'draft' : 'official' })} /> مسودّة (لم تُطابَق مع الوثيقة الرسمية بعد)</label><div className="ac-row"><button type="button" className="pt-btn gold small" onClick={save} disabled={busy} data-testid="ac-std-save">احفظ</button><button type="button" className="pt-btn ghost small" onClick={() => setEdit(null)}>إلغاء</button></div></div>
        : <><b>{s.code}</b> {s.title_ar}{s.source === 'draft' && <span className="ac-st man">مسودّة</span>} <small className="pt-muted">{s.parent ? s.text_ar : ''}</small> <button type="button" className="ac-link" onClick={() => setEdit({ code: s.code, title_ar: s.title_ar, text_ar: s.text_ar, source: s.source })} data-testid="ac-std-editbtn">تحرير</button></>}</li>)}</ol>
    </section>
  </main>;
}
const CSS = `
.ac .ac-hero h1{margin:.2rem 0 .4rem;font-size:1.5rem;color:#0f2a4e}.ac-lead{color:#475569;line-height:1.8;font-size:.95rem;margin:0 0 .6rem;max-width:900px}.ac-row{display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;margin-top:.4rem}.ac-pick select{margin-inline-start:.4rem;padding:.3rem .5rem;border:1px solid #cbd5e1;border-radius:8px;font:inherit}
.ac-kpis{display:flex;gap:.6rem;flex-wrap:wrap;margin:0 0 .6rem;padding:0}.ac-kpis span{display:inline-flex;align-items:baseline;gap:.25rem;background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:.2rem .7rem;font-size:.85rem}.ac-kpis span b{font-size:1.05rem;color:#0f2a4e}.ac-kpis span.b{background:#eefaf5;border-color:#bfe9d6}
.ac-st{display:inline-block;font-size:.75rem;font-weight:900;padding:.05rem .5rem;border-radius:999px;border:1px solid transparent;vertical-align:middle}.ac-st.ok{background:#eefaf5;color:#0b6b4a;border-color:#bfe9d6}.ac-st.mid{background:#fff7e6;color:#8a6a1a;border-color:#f1dfae}.ac-st.no{background:#fff1f1;color:#8a1f1f;border-color:#f3c5c5}.ac-st.man{background:#f1f5f9;color:#334155;border-color:#cbd5e1}
.ac-elig ul,.ac-tasks ul{margin:.3rem 0 0;padding:0 1.1rem 0 0;font-size:.9rem;line-height:1.9}.ac-tasks{margin-top:.6rem;border-top:1px dashed #e2e8f0;padding-top:.5rem}.ac-tasks b{display:inline-flex;gap:.3rem;align-items:center}.ac-tasks a,.ac-link{color:#0b6f69;font-weight:800;text-decoration:none;background:none;border:0;padding:0;font:inherit;cursor:pointer}.ac-tasks a:hover,.ac-link:hover{text-decoration:underline}
.ac-std{padding:0;overflow:hidden}.ac-head{display:grid;grid-template-columns:44px 1fr 160px 20px;gap:.7rem;align-items:center;width:100%;text-align:start;background:#fff;border:0;padding:.9rem 1rem;font:inherit;cursor:pointer}.ac-head:hover{background:#f8fafc}.ac-num{display:inline-grid;place-items:center;width:40px;height:40px;border-radius:12px;background:#0f2a4e;color:#fff;font-weight:900;font-size:1.05rem}.ac-title{display:grid;gap:.1rem;min-width:0}.ac-title b{font-size:1.02rem;color:#0f2a4e}.ac-title small{color:#64748b;font-size:.8rem}.ac-bar{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden}.ac-bar i{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b)}
.ac-body{padding:.2rem 1rem 1rem;border-top:1px solid #eef2f7}.ac-text{color:#334155;font-size:.9rem;line-height:1.8;margin:.6rem 0}.ac-subs{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}.ac-subs li{border:1px solid #e2e8f0;border-radius:12px;padding:.55rem .75rem;background:#fff}.ac-subs li[data-state="met"]{border-color:#bfe9d6}.ac-subs li[data-state="missing"]{border-color:#f3c5c5}.ac-subh{display:flex;gap:.4rem;align-items:center;flex-wrap:wrap;font-size:.95rem}.ac-signed{font-size:.75rem;color:#0b6b4a;display:inline-flex;gap:.2rem;align-items:center;margin-inline-start:.3rem}
.ac-ev{list-style:none;margin:.3rem 0 0;padding:0;display:grid;gap:.15rem;font-size:.85rem}.ac-ev li{display:flex;gap:.3rem;align-items:center;color:#0f172a;flex-wrap:wrap}.ac-ev a{color:#0b6f69;font-weight:700;text-decoration:none}.ac-task{margin:.3rem 0 0;font-size:.85rem;color:#8a6a1a;display:flex;gap:.3rem;align-items:center}
.ac-nar{margin-top:.8rem;border:1px solid #f1dfae;border-radius:14px;padding:.7rem .9rem;background:#fffaf0;display:grid;gap:.4rem}.ac-nar label{display:grid;gap:.3rem;font-size:.9rem}.ac-nar textarea{width:100%;box-sizing:border-box;border:1px solid #e5d9b8;border-radius:10px;padding:.5rem .7rem;font:inherit;line-height:1.8;background:#fff;min-height:110px}
.ac-err{color:#8a1f1f;font-size:.85rem}.ac-ok{color:#0b6b4a;font-size:.85rem}
.ac-map h2{font-size:1.05rem;color:#0f2a4e;display:flex;gap:.4rem;align-items:flex-start;flex-wrap:wrap}.ac-map h2 small{font-weight:400;font-size:.82rem}.ac-grid{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}.ac-gh,.ac-gr{display:grid;grid-template-columns:220px repeat(10,minmax(64px,1fr));align-items:center;min-width:900px}.ac-gh{background:#f8fafc;border-bottom:1px solid #e2e8f0}.ac-gh span{padding:.4rem .4rem;font-size:.72rem;line-height:1.3;text-align:center;display:grid;gap:.1rem}.ac-gh span:first-child{text-align:start}.ac-gh small{color:#64748b;font-weight:400;display:block;max-height:2.6em;overflow:hidden}.ac-gr{border-bottom:1px solid #eef2f7}.ac-gr:last-child{border-bottom:0}.ac-gr span{padding:.4rem .6rem;font-size:.85rem}.ac-gr label{display:grid;place-items:center;padding:.35rem}.ac-gr input{width:18px;height:18px}
.ac-files{list-style:none;margin:0;padding:0;display:grid;gap:.5rem}.ac-files li{display:grid;gap:.3rem;border:1px solid #e2e8f0;border-radius:12px;padding:.6rem .8rem}.ac-files a{color:#0f2a4e;text-decoration:none}.ac-mini{display:flex;gap:.4rem;flex-wrap:wrap;font-size:.78rem;color:#475569}.ac-mini i{font-style:normal;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:.05rem .4rem}.ac-weak{margin:.6rem 0 0;font-size:.9rem;color:#334155}
.ac-stdlist{list-style:none;margin:0;padding:0;font-size:.9rem;line-height:1.8;display:grid;gap:.25rem}.ac-stdlist li[data-top="1"]{margin-top:.5rem;font-size:1rem}.ac-stdlist li[data-top="1"]>b{background:#0f2a4e;color:#fff;border-radius:6px;padding:0 .4rem}.ac-edit{display:grid;gap:.4rem;border:1px solid #e2e8f0;border-radius:12px;padding:.6rem;background:#f8fafc}.ac-edit input,.ac-edit textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:.4rem .6rem;font:inherit}
.ac-frz h2,.ac-clock h2,.ac-age h2{font-size:1.05rem;color:#0f2a4e;display:flex;gap:.4rem;align-items:flex-start;flex-wrap:wrap;margin:0 0 .5rem}.ac-frz h2 small,.ac-clock h2 small,.ac-age h2 small{font-weight:400;font-size:.82rem}.ac-frzh{display:flex;justify-content:space-between;gap:.6rem;flex-wrap:wrap;align-items:flex-start}
.ac-snaps{list-style:none;margin:.6rem 0 0;padding:0;display:grid;gap:.35rem}.ac-snaps li{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:.4rem .7rem;font-size:.85rem}.ac-code{font-family:ui-monospace,monospace;font-weight:900;color:#0f2a4e;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:0 .4rem}.ac-snaps a{color:#0b6f69;font-weight:800;text-decoration:none;margin-inline-start:auto}
.ac-diff{font-size:.88rem;color:#334155;margin:.5rem 0 0;display:flex;gap:.3rem;flex-wrap:wrap;align-items:center}.ac-age ul{margin:0;padding:0 1.1rem 0 0;font-size:.9rem;line-height:1.9}
.ac-tl{list-style:none;margin:0;padding:0;display:grid;gap:.25rem;position:relative}.ac-tl li{display:grid;grid-template-columns:150px 120px 1fr auto auto;gap:.6rem;align-items:center;padding:.35rem .6rem;border-inline-start:3px solid #0b8a83;background:#f8fafc;border-radius:8px;font-size:.85rem}.ac-tl li[data-ageing="1"]{border-inline-start-color:#c9a24b}.ac-tld{font-weight:800;color:#0f2a4e}.ac-tlk{color:#0b6f69;font-weight:700}.ac-tlc{color:#64748b;font-size:.78rem}.ac-filters{margin-bottom:.6rem}
.ac-intact{display:inline-flex;gap:.4rem;align-items:center;flex-wrap:wrap;font-size:.85rem;border-radius:10px;padding:.4rem .7rem;margin:.3rem 0 .6rem}.ac-intact.ok{background:#eefaf5;color:#0b6b4a;border:1px solid #bfe9d6}.ac-intact.no{background:#fff1f1;color:#8a1f1f;border:1px solid #f3c5c5}.ac-intact code{font-size:.72rem;word-break:break-all}
.ac-note{margin:.6rem 0;border-inline-start:4px solid #c9a24b;background:#fffaf0;padding:.5rem .8rem;border-radius:8px;font-size:.92rem;line-height:1.8}.ac-elig-l{margin:0;padding:0 1.1rem 0 0;line-height:1.9;font-size:.9rem}.ac-ver h2{font-size:1.05rem;color:#0f2a4e}.ac-std-open .ac-head.as-div{cursor:default;grid-template-columns:44px 1fr 160px}.ac-vnar{margin:.3rem 0 0;font-size:.88rem;line-height:1.8;color:#334155}.ac-vnarbox p{margin:.3rem 0 0;line-height:1.9}.ac-foot{font-size:.8rem;text-align:center}
.ac-strip{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;margin:12px 0;direction:rtl}.ac-strip h2{margin:0 0 4px;font-size:1.02rem;color:#0f2a4e;display:flex;gap:.4rem;align-items:center}.ac-strip small{color:#475569;line-height:1.8}.ac-strip a{color:#0b6f69;font-weight:800;text-decoration:none}.ac-strip ul{list-style:none;margin:.5rem 0 0;padding:0;display:flex;gap:.4rem;flex-wrap:wrap}.ac-strip li{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:.15rem .5rem;font-size:.8rem}.ac-strip li span{font-weight:900;color:#0f2a4e;margin-inline-start:.3rem}
.ac-orgs{margin:0 0 .8rem;border:1px solid #e2e8f0;border-radius:12px;padding:.6rem .8rem;background:#f8fafc}.ac-orgs h3{margin:0 0 .4rem;font-size:.95rem;color:#0f2a4e;display:flex;gap:.3rem;align-items:center}.ac-orgs ul{list-style:none;margin:0;padding:0;display:grid;gap:.3rem}.ac-orgs li{display:grid;gap:.2rem;font-size:.9rem}
@media print{.no-print,.pt-nav,nav,footer,header{display:none!important}.ac .pt-box{break-inside:avoid;border:1px solid #cbd5e1}.ac-tl li{grid-template-columns:120px 100px 1fr auto}}
@media (max-width:720px){.ac-head{grid-template-columns:40px 1fr 20px}.ac-bar{display:none}.ac-tl li{grid-template-columns:1fr;gap:.15rem}}
`;
