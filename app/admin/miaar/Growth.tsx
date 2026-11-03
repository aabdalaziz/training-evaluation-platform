'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «النموّ والمقارنة» (م5-ب) — لسان 08 في /admin/miaar/growth
 *  (أ) رحلة متقدّم: بالبريد → كل محاولاته على السُّلّم، المقارنة «الأول بتاريخ… والثاني بتاريخ…»، حكم النموّ، [أصدر شهادة النموّ] (إنسان فقط؛ لا تصدر ضمن خطأ القياس)
 *  (ب) مجموعة مقابل مجموعة: وسم/دعوة/برنامج/فترة لكلٍّ — k ≥ 5 — توزيع السُّلّم، المتوسط، Cohen d بتفسير عربي وفاصل ثقة 95% · CSV · طباعة
 *  (ج) قبل/بعد البرنامج: الأزواج وملخّصها (متوسط الكسب، من ارتقى، d المزدوج) · أذون «نهاية البرنامج» تُمنح كسولًا عند فتح اللسان
 *  الأرقام تصف، والإنسان يحكم. لا ذكاء اصطناعي هنا.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../lib/ui/icons';

const LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const LV: Record<string, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const VERD: Record<string, { t: string; cls: string }> = { confirmed: { t: 'نموّ مؤكَّد', cls: 'ok' }, likely: { t: 'نموّ محتمل', cls: 'mid' }, within: { t: 'ضمن خطأ القياس', cls: 'flat' }, decline: { t: 'تراجع ملحوظ', cls: 'down' } };
type Opts = { tags: { tag: string; n: number }[]; invites: { id: string; label: string }[]; programs: { id: string; name: string; start_date: string | null; end_date: string | null }[]; auto?: { programs: number; granted: number } };
type Sel = { kind: 'tag' | 'invite' | 'program' | 'period'; value: string; from: string; to: string };
type Mode = 'journey' | 'groups' | 'program';
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');
const day = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '—');
const selQs = (p: string, s: Sel) => s.kind === 'period' ? `${p}_kind=period&${p}_from=${encodeURIComponent(s.from)}&${p}_to=${encodeURIComponent(s.to)}` : `${p}_kind=${s.kind}&${p}=${encodeURIComponent(s.value)}`;
const selOk = (s: Sel) => (s.kind === 'period' ? !!(s.from || s.to) : !!s.value);

export default function Growth({ auth }: { auth: () => Promise<Record<string, string>> }) {
  const [mode, setMode] = useState<Mode>('journey'); const [opts, setOpts] = useState<Opts | null>(null); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(''); const [journey, setJourney] = useState<any>(null);
  const [a, setA] = useState<Sel>({ kind: 'tag', value: '', from: '', to: '' }); const [b, setB] = useState<Sel>({ kind: 'tag', value: '', from: '', to: '' }); const [cmp, setCmp] = useState<any>(null);
  const [program, setProgram] = useState(''); const [impact, setImpact] = useState<any>(null);
  const get = useCallback(async (qs: string) => fetch(`/api/admin/miaar/growth?${qs}`, { headers: await auth(), cache: 'no-store' }).then((r) => r.json()).catch(() => null), [auth]);
  useEffect(() => { void (async () => { const j = await get('options=1'); if (j?.success) setOpts(j); else setErr(j?.error || 'تعذّر التحميل'); })(); }, [get]);
  /* ?email= من سجلّ المتقدّم · ?program= من البرامج */
  const loadJourney = useCallback(async (e: string) => { const v = e.trim().toLowerCase(); if (!v) return; setBusy(true); setErr(null); const j = await get(`email=${encodeURIComponent(v)}`); setBusy(false); if (j?.success) setJourney(j.journey); else { setJourney(null); setErr(j?.error || 'لا محاولات'); } }, [get]);
  useEffect(() => { try { const sp = new URLSearchParams(window.location.search); const e = sp.get('email'); const p = sp.get('program'); if (e) { setEmail(e); setMode('journey'); void loadJourney(e); } else if (p) { setProgram(p); setMode('program'); } } catch { /* لا شيء */ } }, [loadJourney]);
  const runGroups = async () => { if (!selOk(a) || !selOk(b)) { setErr('اختر المجموعتين أولًا'); return; } setBusy(true); setErr(null); const j = await get(`${selQs('a', a)}&${selQs('b', b)}`); setBusy(false); if (j?.success) setCmp(j.compare); else { setCmp(null); setErr(j?.error || 'تعذّرت المقارنة'); } };
  const runProgram = useCallback(async (id: string) => { if (!id) return; setBusy(true); setErr(null); const j = await get(`program=${encodeURIComponent(id)}`); setBusy(false); if (j?.success) setImpact(j.impact); else { setImpact(null); setErr(j?.error || 'تعذّر'); } }, [get]);
  useEffect(() => { if (mode === 'program' && program) void runProgram(program); }, [mode, program, runProgram]);
  const csv = async (qs: string, name: string) => { const r = await fetch(`/api/admin/miaar/growth?csv=1&${qs}`, { headers: await auth() }); const blob = await r.blob(); const u = URL.createObjectURL(blob); const el = document.createElement('a'); el.href = u; el.download = name; el.click(); URL.revokeObjectURL(u); };
  const certificate = async (reportId: string) => { if (!window.confirm('إصدار «شهادة النموّ» الموقَّعة لهذه المقارنة؟ القرار بشري ويُقيَّد باسمك.')) return; setBusy(true); setErr(null); try { const j = await fetch('/api/admin/miaar/growth', { method: 'POST', headers: await auth(), body: JSON.stringify({ action: 'certificate', report_id: reportId }) }).then((r) => r.json()); if (!j?.success) { setErr(j?.error || 'تعذّر الإصدار'); return; } await loadJourney(email || journey?.email || ''); setOk(j.already ? `الشهادة صادرة من قبل: ${j.code}` : `صدرت شهادة النموّ: ${j.code}`); } finally { setBusy(false); } };
  const maxDist = useMemo(() => (cmp ? Math.max(1, ...LEVELS.map((l) => Math.max(cmp.a.dist[l] || 0, cmp.b.dist[l] || 0))) : 1), [cmp]);

  const selPicker = ({ s, set, label, tid }: { s: Sel; set: (v: Sel) => void; label: string; tid: string }) => <div className="gr-sel" data-testid={tid}>
    <b>{label}</b>
    <select value={s.kind} onChange={(e) => set({ ...s, kind: e.target.value as Sel['kind'], value: '' })} aria-label={`${label}: نوع المجموعة`} data-testid={`${tid}-kind`}><option value="tag">وسم</option><option value="invite">دعوة</option><option value="program">برنامج</option><option value="period">فترة</option></select>
    {s.kind === 'tag' && <select value={s.value} onChange={(e) => set({ ...s, value: e.target.value })} aria-label={`${label}: الوسم`} data-testid={`${tid}-value`}><option value="">— اختر وسمًا —</option>{(opts?.tags || []).map((t) => <option key={t.tag} value={t.tag}>{t.tag} ({t.n})</option>)}</select>}
    {s.kind === 'invite' && <select value={s.value} onChange={(e) => set({ ...s, value: e.target.value })} aria-label={`${label}: الدعوة`} data-testid={`${tid}-value`}><option value="">— اختر دعوة —</option>{(opts?.invites || []).map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}</select>}
    {s.kind === 'program' && <select value={s.value} onChange={(e) => set({ ...s, value: e.target.value })} aria-label={`${label}: البرنامج`} data-testid={`${tid}-value`}><option value="">— اختر برنامجًا —</option>{(opts?.programs || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
    {s.kind === 'period' && <span className="gr-dates"><input type="date" value={s.from} onChange={(e) => set({ ...s, from: e.target.value })} aria-label={`${label}: من`} data-testid={`${tid}-from`} /><input type="date" value={s.to} onChange={(e) => set({ ...s, to: e.target.value })} aria-label={`${label}: إلى`} data-testid={`${tid}-to`} /></span>}
  </div>;
  const cmpView = ({ c, reportId, showCert }: { c: any; reportId?: string | null; showCert?: boolean }) => <div className={`gr-cmp ${VERD[c.verdict]?.cls || ''}`} data-testid="gr-cmp" data-verdict={c.verdict}>
    <p className="gr-sentence">{c.sentence}</p>
    <div className="gr-nums"><div><span>فرق النسبة</span><b dir="ltr">{c.percent_diff === null ? '—' : `${c.percent_diff > 0 ? '+' : ''}${c.percent_diff}`}</b></div><div><span>خطأ الفرق</span><b dir="ltr">{c.se_diff ?? '—'}</b></div><div><span>z</span><b dir="ltr">{c.z ?? '—'}</b></div><div><span>الأيام</span><b dir="ltr">{c.days}</b></div><div><span>الدرجات</span><b dir="ltr">{c.steps > 0 ? `+${c.steps}` : c.steps}</b></div></div>
    {c.skills?.length > 0 && <div className="gr-skills">{c.skills.map((s: any) => <div key={s.skill}><span>{s.label}</span><b dir="ltr">{s.a ?? '—'} → {s.b ?? '—'}</b><em className={s.diff > 0 ? 'up' : s.diff < 0 ? 'down' : ''}>{s.diff === null ? '' : `${s.diff > 0 ? '+' : ''}${s.diff}`}</em></div>)}</div>}
    {c.gained?.length > 0 && <p className="gr-gained"><b>ما استجدّ من «أستطيع»:</b> {c.gained.map((g: any) => `${g.level}: ${g.statements[0]}`).join(' · ')}</p>}
    {showCert && reportId && <div className="gr-certrow">{journey?.certificate ? <span className="gr-certok" data-testid="gr-cert-have"><Icon name="check" /> شهادة النموّ صادرة · <a href={journey.certificate.url} target="_blank" rel="noreferrer">{journey.certificate.code}</a></span>
      : (c.verdict === 'confirmed' || c.verdict === 'likely') ? <button type="button" className="am-btn gold small" onClick={() => void certificate(reportId)} disabled={busy} data-testid="gr-cert">أصدر «شهادة النموّ» (قرار بشري)</button>
      : <span className="gr-certno" data-testid="gr-cert-no">لا تصدر شهادة نموّ هنا — الحكم «{VERD[c.verdict]?.t}»</span>}</div>}
  </div>;

  return <section className="gr" data-testid="gr">
    {err && <div className="am-err" role="alert" data-testid="gr-err">{err}</div>}{ok && <div className="am-ok" role="status" data-testid="gr-ok">{ok}</div>}
    {opts?.auto && opts.auto.granted > 0 && <div className="am-ok" role="status" data-testid="gr-auto">مُنحت الآن {opts.auto.granted} أذون إعادة «نهاية البرنامج» تلقائيًا ({opts.auto.programs} برنامج انتهى).</div>}
    <nav className="gr-modes" aria-label="أقسام النموّ">{([['journey', 'رحلة متقدّم'], ['groups', 'مجموعة مقابل مجموعة'], ['program', 'قبل/بعد البرنامج']] as const).map(([k, l]) => <button key={k} type="button" className={mode === k ? 'on' : ''} onClick={() => setMode(k)} aria-pressed={mode === k} data-testid={`gr-mode-${k}`}>{l}</button>)}</nav>

    {mode === 'journey' && <div className="am-card">
      <form className="gr-form" onSubmit={(e) => { e.preventDefault(); void loadJourney(email); }}><label>بريد المتقدّم<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" dir="ltr" data-testid="gr-email" /></label><button type="submit" className="am-btn small" disabled={busy} data-testid="gr-open">افتح الرحلة</button></form>
      {journey && <div className="gr-journey" data-testid="gr-journey">
        <div className="gr-jhead"><h3>{journey.name} <small dir="ltr">{journey.email}</small></h3><span>{journey.count} محاولة{journey.latest?.code && <> · <a href={`/miaar/growth/${journey.latest.code}`} target="_blank" rel="noreferrer" data-testid="gr-public-link">صفحة الرحلة العامّة</a></>}</span></div>
        <ol className="gr-ladder" data-testid="gr-ladder">{LEVELS.map((l) => { const pts = (journey.ladder || []).find((x: any) => x.level === l)?.points || []; const now = journey.latest?.demonstrated === l; return <li key={l} className={`${pts.length ? 'hit' : ''}${now ? ' now' : ''}`}><b>{LV[l]}</b>{pts.length > 0 && <em>{pts.map((p: number) => <i key={p}>{p}</i>)}</em>}</li>; })}</ol>
        <ol className="gr-tl">{journey.attempts.map((x: any) => <li key={x.id} className={x.id === journey.latest.id ? 'me' : ''}><i>{x.attempt}</i><span>{fmt(x.taken_at)} · <b>{LV[x.demonstrated]}</b> · التحاق {LV[x.entry]} · {x.percent ?? '—'}% · {x.n_items} بندًا{x.archived ? ' · مؤرشفة' : ''}{x.growth_vc_code ? ` · شهادة ${x.growth_vc_code}` : ''}</span>{x.code && <a href={`/miaar/result/${x.code}`} target="_blank" rel="noreferrer">البطاقة</a>}</li>)}</ol>
        {journey.comparison ? cmpView({ c: journey.comparison, reportId: journey.latest.id, showCert: true }) : <p className="mm-note" data-testid="gr-one">محاولة واحدة فقط — لا مقارنة بعد. امنح إذن إعادة من «السجلّ» حين يحين وقت القياس الثاني.</p>}
        {journey.since_first && <details className="gr-since"><summary>منذ أول محاولة ({LV[journey.since_first.first.level]} → {LV[journey.since_first.second.level]} · {VERD[journey.since_first.verdict]?.t})</summary>{cmpView({ c: journey.since_first })}</details>}
      </div>}
    </div>}

    {mode === 'groups' && <div className="am-card">
      <div className="gr-pick">{selPicker({ s: a, set: setA, label: 'المجموعة الأولى', tid: 'gr-a' })}{selPicker({ s: b, set: setB, label: 'المجموعة الثانية', tid: 'gr-b' })}<button type="button" className="am-btn small" onClick={() => void runGroups()} disabled={busy} data-testid="gr-compare">قارِن</button></div>
      <p className="mm-note">يُحسب كل متقدّم مرّة واحدة (أحدث محاولة غير مؤرشفة). لا تُقارَن مجموعة أصغر من 5 — حمايةً للأفراد.</p>
      {cmp && <div className="gr-groups" data-testid="gr-groups">
        <div className="gr-gcards">{[cmp.a, cmp.b].map((g: any, i: number) => <div key={i} className="gr-gcard" data-testid={`gr-g${i}`}><h4>{i === 0 ? 'الأولى' : 'الثانية'} · {g.label}</h4><div className="gr-gstats"><span>k <b>{g.k}</b></span><span>المتوسط <b>{g.mean ?? '—'}%</b></span><span>الانحراف <b>{g.sd ?? '—'}</b></span><span>الوسيط <b>{g.median ?? '—'}</b></span><span>متوسط السُّلّم <b>{g.mean_level ?? '—'}</b></span><span>على الحدّ <b>{g.border}</b></span></div></div>)}</div>
        <div className="gr-dist" data-testid="gr-dist">{LEVELS.map((l) => <div key={l} className="gr-drow"><b>{LV[l]}</b><div className="gr-dbars"><div className="gr-dbar a" style={{ width: `${((cmp.a.dist[l] || 0) / maxDist) * 100}%` }}><span>{cmp.a.dist[l] || 0}</span></div><div className="gr-dbar b" style={{ width: `${((cmp.b.dist[l] || 0) / maxDist) * 100}%` }}><span>{cmp.b.dist[l] || 0}</span></div></div></div>)}</div>
        {cmp.ok ? <div className="gr-effect" data-testid="gr-effect"><div><span>Cohen d</span><b dir="ltr">{cmp.d}</b></div><div><span>فاصل الثقة 95%</span><b dir="ltr">{cmp.ci ? `${cmp.ci[0]} … ${cmp.ci[1]}` : '—'}</b></div><div><span>فرق المتوسط</span><b dir="ltr">{cmp.diff}</b></div><div><span>فرق السُّلّم</span><b dir="ltr">{cmp.level_diff ?? '—'}</b></div><p>{cmp.interpretation}</p></div> : <p className="am-err" data-testid="gr-small">{cmp.reason}</p>}
        <div className="gr-actions"><button type="button" className="am-btn ghost small" onClick={() => void csv(`${selQs('a', a)}&${selQs('b', b)}`, 'miaar-groups.csv')}>CSV</button><button type="button" className="am-btn ghost small" onClick={() => window.print()}>طباعة</button></div>
      </div>}
    </div>}

    {mode === 'program' && <div className="am-card">
      <div className="gr-form"><label>البرنامج<select value={program} onChange={(e) => setProgram(e.target.value)} data-testid="gr-program"><option value="">— اختر برنامجًا له تسجيلات من مِعيار —</option>{(opts?.programs || []).map((p) => <option key={p.id} value={p.id}>{p.name} {p.end_date ? `(ينتهي ${p.end_date})` : ''}</option>)}</select></label></div>
      {impact && <div className="gr-impact" data-testid="gr-impact">
        <p className="gr-pnote" data-testid="gr-pnote">{impact.program.name} · {day(impact.program.start_date)} → {day(impact.program.end_date)} · {impact.program.ended ? 'انتهى' : 'جارٍ'} · مسجَّلون من مِعيار: <b>{impact.enrolled}</b> · أذون نهاية مفتوحة: <b>{impact.grants_open}</b> · أزواج قبل/بعد: <b>{impact.retook}</b><br /><small>{impact.note}</small></p>
        {impact.summary && <div className="gr-effect" data-testid="gr-psummary"><div><span>متوسط الكسب</span><b dir="ltr">{impact.summary.mean_gain ?? '—'}</b></div><div><span>ارتقوا</span><b>{impact.summary.level_up}</b></div><div><span>ثبتوا</span><b>{impact.summary.same}</b></div><div><span>نزلوا</span><b>{impact.summary.down}</b></div><div><span>d المزدوج</span><b dir="ltr">{impact.summary.d_paired ?? '—'}</b></div><div><span>CI95</span><b dir="ltr">{impact.summary.ci ? `${impact.summary.ci[0]} … ${impact.summary.ci[1]}` : '—'}</b></div>
          <p>الأحكام: مؤكَّد {impact.summary.verdicts.confirmed} · محتمل {impact.summary.verdicts.likely} · ضمن الخطأ {impact.summary.verdicts.within} · تراجع {impact.summary.verdicts.decline}{impact.summary.skills?.length ? ` — المهارات: ${impact.summary.skills.map((s: any) => `${s.label} ${s.mean_diff > 0 ? '+' : ''}${s.mean_diff}`).join(' · ')}` : ''}</p></div>}
        {impact.pairs.length > 0 && <table className="gr-table" data-testid="gr-pairs"><thead><tr><th>قبل</th><th>بعد</th><th>الدرجات</th><th>فرق %</th><th>الأيام</th><th>الحكم</th></tr></thead><tbody>{impact.pairs.map((c: any, i: number) => <tr key={i}><td>{day(c.first.taken_at)} · {LV[c.first.level]} · {c.first.percent ?? '—'}%</td><td>{day(c.second.taken_at)} · {LV[c.second.level]} · {c.second.percent ?? '—'}%</td><td dir="ltr">{c.steps > 0 ? `+${c.steps}` : c.steps}</td><td dir="ltr">{c.percent_diff ?? '—'}</td><td>{c.days}</td><td><span className={`gr-v ${VERD[c.verdict]?.cls}`}>{VERD[c.verdict]?.t}</span></td></tr>)}</tbody></table>}
        <div className="gr-actions"><button type="button" className="am-btn ghost small" onClick={() => void csv(`program=${encodeURIComponent(program)}`, 'miaar-program.csv')}>CSV</button><button type="button" className="am-btn ghost small" onClick={() => window.print()}>طباعة</button><a className="am-btn ghost small" href={`/admin/miaar/ledger`}>السجلّ</a></div>
      </div>}
    </div>}

    <style jsx global>{`
.gr{display:grid;gap:12px}
.gr-modes{display:flex;gap:6px;flex-wrap:wrap}.gr-modes button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:800;cursor:pointer;min-height:40px;color:#0f2a4e}.gr-modes button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.gr-modes button:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.gr-form{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.gr-form label{display:grid;gap:4px;font-weight:800;font-size:13px;min-width:260px}.gr-form input,.gr-form select,.gr-sel select,.gr-sel input{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;min-height:40px;background:#fff}
.gr-jhead{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:14px 0 8px}.gr-jhead h3{margin:0;font-size:17px;color:#0f2a4e}.gr-jhead small{font-weight:600;color:#64748b;margin-inline-start:8px}.gr-jhead span{font-weight:700;color:#334155}
.gr-ladder{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:4px}.gr-ladder li{border:2px solid #e2e8f0;border-radius:10px;padding:8px 4px;text-align:center;background:#f8fafc;min-height:54px}.gr-ladder li b{font-size:14px;color:#0f2a4e}.gr-ladder li.hit{background:#fff;border-color:#cbd5e1}.gr-ladder li.now{border-color:#0b8a83;background:#e6f7f5}.gr-ladder em{display:flex;justify-content:center;gap:3px;margin-top:4px}.gr-ladder em i{font-style:normal;font-size:10px;font-weight:900;background:#0f2a4e;color:#fff;border-radius:999px;min-width:16px;height:16px;line-height:16px;padding:0 3px}
.gr-tl{list-style:none;margin:0 0 12px;padding:0}.gr-tl li{display:flex;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #f1f5f9;font-size:13px;font-weight:600}.gr-tl li.me{background:#f0fbfa;border-radius:8px;padding:6px 8px}.gr-tl i{font-style:normal;width:22px;height:22px;border-radius:999px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-weight:900;flex:none;font-size:11px}.gr-tl span{flex:1}.gr-tl a{font-weight:800;color:#0f2a4e}
.gr-cmp{border:1px solid #e2e8f0;border-radius:14px;padding:14px;background:#f8fafc}.gr-cmp.ok{border-color:#0b8a83;background:#f0fbfa}.gr-cmp.mid{border-color:#c9a24b;background:#fffaf0}.gr-cmp.down{border-color:#e11d48;background:#fff1f2}
.gr-sentence{font-weight:900;font-size:15px;line-height:1.8;margin:0 0 10px;color:#0f2a4e}
.gr-nums{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin:0 0 10px}.gr-nums div,.gr-effect>div{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center}.gr-nums span,.gr-effect span{display:block;font-size:11px;color:#64748b;font-weight:700}.gr-nums b,.gr-effect b{font-size:17px;color:#0f2a4e}
.gr-skills{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:6px;margin:0 0 8px}.gr-skills>div{display:flex;justify-content:space-between;gap:6px;background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:6px 10px;font-size:13px;font-weight:700}.gr-skills em{font-style:normal;color:#64748b}.gr-skills em.up{color:#0b8a83}.gr-skills em.down{color:#e11d48}
.gr-gained{margin:0 0 8px;font-size:13px;line-height:1.8;color:#334155}
.gr-certrow{margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.gr-certok{color:#0b8a83;font-weight:800}.gr-certok a{color:#0f2a4e}.gr-certno{color:#64748b;font-weight:700;font-size:13px}
.gr-since{margin-top:10px}.gr-since summary{cursor:pointer;font-weight:800;color:#0f2a4e}
.gr-pick{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end}.gr-sel{display:grid;gap:6px}.gr-sel b{font-size:13px;color:#0f2a4e}.gr-dates{display:flex;gap:6px}.gr-dates input{flex:1;min-width:0}
.gr-gcards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0}.gr-gcard{border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fff}.gr-gcard h4{margin:0 0 8px;font-size:14px;color:#0f2a4e}.gr-gstats{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:13px;font-weight:700;color:#334155}.gr-gstats b{color:#0f2a4e;margin-inline-start:4px}
.gr-dist{display:grid;gap:4px;margin:0 0 12px}.gr-drow{display:grid;grid-template-columns:80px 1fr;gap:8px;align-items:center}.gr-drow b{font-size:13px;color:#0f2a4e}.gr-dbars{display:grid;gap:2px}.gr-dbar{height:14px;border-radius:999px;min-width:22px;position:relative;transition:width .4s}.gr-dbar.a{background:#94a3b8}.gr-dbar.b{background:#0b8a83}.gr-dbar span{position:absolute;inset-inline-end:6px;top:-1px;font-size:11px;font-weight:900;color:#fff}
.gr-effect{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin:0 0 10px}.gr-effect p{grid-column:1/-1;margin:4px 0 0;font-weight:800;color:#0f2a4e;line-height:1.7}
.gr-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.gr-pnote{margin:12px 0;font-weight:700;color:#334155;line-height:1.8}.gr-pnote small{color:#64748b}
.gr-table{width:100%;border-collapse:collapse;font-size:13px}.gr-table th,.gr-table td{border-bottom:1px solid #e2e8f0;padding:6px 8px;text-align:start}.gr-table th{color:#64748b;font-weight:800}
.gr-v{border-radius:999px;padding:2px 10px;font-weight:800;font-size:12px;background:#f1f5f9;color:#334155}.gr-v.ok{background:#e6f7f5;color:#0b8a83}.gr-v.mid{background:#fdf7e6;color:#8a6a12}.gr-v.down{background:#fff1f2;color:#e11d48}
@media (max-width:820px){.gr-pick{grid-template-columns:1fr}.gr-gcards{grid-template-columns:1fr}.gr-nums{grid-template-columns:repeat(3,1fr)}.gr-ladder{grid-template-columns:repeat(4,1fr)}}
@media print{.gr-modes,.gr-form,.gr-pick,.gr-actions,.mm-tabs,.mm-heroacts{display:none !important}}
    `}</style>
  </section>;
}
