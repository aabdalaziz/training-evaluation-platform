'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P85 */
/**
 * /reports/studio — «استوديو التحليل والتقارير»: مركز واحد لكلّ الاستبيانات (اليومي · النهائي · الختامي · عن بُعد)
 *  اختر البرنامج والأنواع والفترة والعمق → تحليل موحّد (محاور/بنود بفواصل ثقة · ثبات · محرّكات الرضا · ديناميكا الأيام · شرائح · خريطة حرارية · أصوات · نتائج → توصيات)
 *  → تقرير مكتوب بالهوية: تنفيذي / تفصيلي / شامل → طباعة PDF · Word · PowerPoint · Excel · نسخ النصّ.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { RoomHead } from '../../components/RoomKit';
import { buildEvaluations, buildFacts, buildComments, applyFilters, factsOf } from '../../../lib/reports/analytics';
import type { Lookups, Program } from '../../../lib/reports/analytics';
import { fromEvaluations, fromRemote, merge, filterKinds, filterScope, analyze, compose, reportText, KIND_AR, DEPTH_AR, QUADRANT_AR } from '../../../lib/reports/insight';
import type { ObsKind, Depth, Report, RBlock, Dataset, Analysis } from '../../../lib/reports/insight';
import type { ResponseRow } from '../../../lib/surveys/remoteLearning';
import { Chart, svgToPng } from '../components/Charts';
import { downloadDocx, type DocBlock } from '../../../lib/export/docx';
import { downloadPptx, type PptSlide } from '../../../lib/export/pptx';
import { downloadXlsx, type Sheet } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';

type Raw = { programs: Program[]; lk: Lookups; evaluations: any[]; answers: any[]; remote: ResponseRow[]; levels: { id: string; code: string; name_ar: string; program_id: string | null }[] };
type Room = { id: string; code: string; program_id: string | null; trainer_id: string | null; delivery_mode: string | null; level: string | null; level_id: string | null; section_name: string | null };
const ALL_KINDS: ObsKind[] = ['DAILY', 'FINAL', 'END', 'REMOTE'];
const fmtDate = (s: string) => (s ? new Date(s + 'T00:00:00').toLocaleDateString('ar-SA-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function StudioPage() { return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>; }

function Inner() {
  const db = useMemo(() => supabase(), []); const router = useRouter(); const sp = useSearchParams();
  const [ready, setReady] = useState(false); const [raw, setRaw] = useState<Raw | null>(null); const [error, setError] = useState(''); const [flash, setFlash] = useState('');
  const [programId, setProgramId] = useState(sp.get('program') || ''); const [kinds, setKinds] = useState<ObsKind[]>(ALL_KINDS); const [depth, setDepth] = useState<Depth>((sp.get('depth') as Depth) || 'detailed');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [levelId, setLevelId] = useState(sp.get('level') || ''); const [trainerId, setTrainerId] = useState(sp.get('trainer') || ''); const [roomId, setRoomId] = useState(sp.get('classroom') || ''); /* P85-ب: نطاق الدبلومات */ const [busy, setBusy] = useState(''); const sheetRef = useRef<HTMLElement>(null);
  const say = (m: string) => { setFlash(m); setTimeout(() => setFlash(''), 3500); };
  const generatedAt = useMemo(() => new Date().toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }), []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/reports/studio'); return; }
      const [pg, cl, tr, qs, ev, an, rm, lv] = await Promise.all([
        db.from('programs').select('id,name_ar,name_en,delivery_mode,status,start_date,end_date').order('name_ar'), db.from('classrooms').select('id,code,program_id,trainer_id,delivery_mode,level,level_id,section_name').order('code'), db.from('trainers').select('id,name'), db.from('questions').select('*'),
        db.from('evaluations').select('*').limit(20000), db.from('evaluation_answers').select('*').limit(200000), db.from('remote_learning_survey_responses').select('*').limit(20000), db.from('program_levels').select('id,code,name_ar,program_id,sort_order').order('sort_order'),
      ]);
      const err = [pg, cl, tr, qs, ev, an].find((r) => r.error)?.error; if (err) setError(err.message);
      const programs = ((pg.data || []) as Program[]).filter((p: any) => p.status !== 'CANCELLED');
      setRaw({ programs, lk: { classrooms: (cl.data || []) as any[], trainers: (tr.data || []) as any[], programs, questions: (qs.data || []) as any[] }, evaluations: (ev.data || []) as any[], answers: (an.data || []) as any[], remote: (rm.data || []) as ResponseRow[], levels: (lv.data || []) as any[] });
      if (!sp.get('program') && programs.length) { const arabic = programs.find((p) => /العربية للناطقين/.test(p.name_ar)); setProgramId((arabic || programs[0]).id); }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* التحليل */
  const built = useMemo((): { ds: Dataset; a: Analysis; rep: Report; program: Program; availableKinds: ObsKind[] } | null => {
    if (!raw) return null; const program = raw.programs.find((p) => p.id === programId); if (!program) return null;
    const evalsAll = buildEvaluations(raw.evaluations, raw.answers, raw.lk); const facts = buildFacts(raw.answers, raw.lk.questions);
    const evals = applyFilters(evalsAll, { programId, kind: 'ALL', from: from || undefined, to: to || undefined }, raw.lk); const pf = factsOf(evals, facts); const comments = buildComments(evals, raw.answers, raw.lk.questions);
    const remote = raw.remote.filter((r) => r.program_id === programId && (!from || (r.lecture_date || r.submitted_at.slice(0, 10)) >= from) && (!to || (r.lecture_date || r.submitted_at.slice(0, 10)) <= to));
    const full = merge(fromEvaluations(evals, pf, comments, raw.lk), fromRemote(remote, { classrooms: raw.lk.classrooms, trainers: raw.lk.trainers, levels: raw.levels }));
    /* رموز المستويات النصّية القديمة (classrooms.level) → معرّف المستوى حتى يعمل المرشّح والتسمية */
    const codeToId = new Map(raw.levels.filter((l) => !l.program_id || l.program_id === programId).map((l) => [l.code.toLowerCase(), l.id]));
    for (const o of full.obs) if (o.level && !full.labels[o.level]) { const id = codeToId.get(String(o.level).toLowerCase()); if (id) o.level = id; }
    const availableKinds = ALL_KINDS.filter((k) => full.obs.some((o) => o.kind === k)); const ds = filterScope(filterKinds(full, kinds), { level: levelId, trainer: trainerId, classroom: roomId });
    const scope: string[] = []; if (levelId) scope.push(full.labels[levelId] || raw.levels.find((l) => l.id === levelId)?.name_ar || 'مستوى'); if (trainerId) scope.push(full.labels[trainerId] || 'مدرّب'); if (roomId) scope.push(`الشعبة ${full.labels[roomId] || ''}`);
    /* مرجعية: متوسّط كلّ برنامج آخر (التقييمات الاعتيادية) */
    const others: number[] = []; for (const p of raw.programs) { if (p.id === programId) continue; const e = applyFilters(evalsAll, { programId: p.id, kind: 'ALL' }, raw.lk); if (e.length < 5) continue; const vals = e.flatMap((x) => x.ratings); if (vals.length) others.push(vals.reduce((s, v) => s + v, 0) / vals.length); }
    const a = analyze(ds, { benchmarkOthers: others });
    const dates = ds.obs.map((o) => o.date).filter(Boolean).sort(); const period = dates.length ? `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}` : '';
    const trainers = Array.from(new Set(ds.obs.map((o) => o.trainer).filter(Boolean))).map((t) => ds.labels[t as string] || (t as string));
    const rep = compose(a, { program: program.name_ar, period, generatedAt, depth, trainers, scope, delivery: program.delivery_mode === 'remote' || /عن ب/.test(program.name_ar) ? 'عن بُعد' : null });
    return { ds, a, rep, program, availableKinds };
  }, [raw, programId, kinds, depth, from, to, generatedAt, levelId, trainerId, roomId]);

  /* التصدير */
  const chartPngs = async (): Promise<Map<string, { png: Uint8Array; w: number; h: number }>> => { const out = new Map(); const svgs = sheetRef.current?.querySelectorAll<SVGSVGElement>('svg.ch') || []; for (const s of Array.from(svgs)) { try { out.set(s.getAttribute('data-chart') || '', await svgToPng(s, 2)); } catch { /* يُتجاوز */ } } return out; };
  const toDocBlocks = (rep: Report, pngs: Map<string, { png: Uint8Array; w: number; h: number }>): DocBlock[] => {
    const B: DocBlock[] = [{ type: 'p', text: `${rep.subtitle} · ${rep.period} · أُعدّ في ${rep.generated_at} · القارئ: ${rep.audience}`, color: '#5C4858', size: 10 }];
    for (const s of rep.sections) { B.push({ type: 'h2', text: s.title }); for (const b of s.blocks) {
      if (b.type === 'p') B.push({ type: 'p', text: b.text }); else if (b.type === 'kpis') B.push({ type: 'kpis', items: b.items.map((k) => ({ label: k.label, value: k.value, sub: k.sub })) });
      else if (b.type === 'table') B.push({ type: 'table', head: b.head, rows: b.rows }); else if (b.type === 'list') B.push({ type: 'bullets', items: b.items });
      else if (b.type === 'quotes') B.push({ type: 'bullets', items: b.items.map((q) => `«${q.text}» — ${q.who}`) });
      else if (b.type === 'chart') { const im = pngs.get(b.spec.title); if (im) B.push({ type: 'image', png: im.png, w: im.w, h: im.h, caption: b.spec.title }); }
      else if (b.type === 'findings') for (const f of b.items) B.push({ type: 'callout', title: `${f.id} · ${f.title}`, text: f.evidence, color: f.kind === 'strength' ? '#E6F3F1' : f.kind === 'risk' ? '#F8D7D3' : f.kind === 'quality' ? '#F3E8EF' : '#F6ECD9' });
      else if (b.type === 'recs') { B.push({ type: 'table', head: ['#', 'الأولوية', 'التوصية', 'المالك', 'المدّة', 'مؤشّر النجاح'], rows: b.items.map((r) => [r.id, r.priority, r.title, r.owner, `${r.days} يومًا`, r.kpi]) }); for (const r of b.items) { B.push({ type: 'h3', text: `${r.id} · ${r.title}` }); B.push({ type: 'p', text: `لماذا: ${r.why}`, size: 10 }); B.push({ type: 'numbered', items: r.steps }); } }
    } }
    B.push({ type: 'p', text: 'أُنتج هذا التقرير آليًّا من بيانات الاستبيانات في بوّابة أَثَر؛ الأحكام الختامية بيد الإنسان.', color: '#8A7580', size: 9, align: 'center' });
    return B;
  };
  async function exportDocx() { if (!built) return; setBusy('docx'); try { const pngs = await chartPngs(); downloadDocx(safeFilename(`athar_${depth}_${built.program.name_ar}`, 'docx'), toDocBlocks(built.rep, pngs), { title: `${built.rep.title} — ${built.rep.program}`, subtitle: `${built.rep.subtitle} · ${built.rep.period}`, header: `بوّابة أَثَر · ${built.rep.title} · ${built.rep.program}` }); say('نُزّل ملفّ Word بالهوية'); } catch (e: any) { setError(e.message); } finally { setBusy(''); } }
  function exportPptx() { if (!built) return; const { rep, a } = built; const slides: PptSlide[] = [{ title: `${rep.title} — ${rep.program}`, subtitle: `${rep.subtitle} · ${rep.period}`, bullets: a.findings.slice(0, 5).map((f) => `${f.title}: ${f.evidence}`) }];
    for (const s of rep.sections) { if (s.id === 'summary') continue; const tables = s.blocks.filter((b): b is Extract<RBlock, { type: 'table' }> => b.type === 'table'); const ps = s.blocks.filter((b): b is Extract<RBlock, { type: 'p' }> => b.type === 'p'); if (tables[0]) slides.push({ title: s.title, table: [tables[0].head, ...tables[0].rows.slice(0, 12)], note: ps[0]?.text }); else if (ps.length) slides.push({ title: s.title, bullets: ps.map((p) => p.text) }); const recs = s.blocks.find((b): b is Extract<RBlock, { type: 'recs' }> => b.type === 'recs'); if (recs) slides.push({ title: 'خطّة العمل', table: [['#', 'الأولوية', 'التوصية', 'المالك', 'المدّة'], ...recs.items.map((r) => [r.id, r.priority, r.title, r.owner, `${r.days} يومًا`])] }); }
    downloadPptx(safeFilename(`athar_${depth}_${rep.program}`, 'pptx'), slides, { rtl: true, footer: 'بوّابة أَثَر · athar-portal.com', navy: '#3A1F36', accent: '#D4614A' }); say('نُزّل عرض PowerPoint'); }
  function exportXlsx() { if (!built) return; const { a, rep } = built; const sheets: Sheet[] = [
    { name: 'الملخص', rows: [['المؤشر', 'القيمة'], ['المتوسط العام', a.overall.mean], ['فاصل الثقة 95%', `${a.overall.lo}–${a.overall.hi}`], ['صافي الرضا', a.overall.net], ['الاستجابات', a.n], ...a.byKind.map((k) => [KIND_AR[k.kind], k.n])] },
    { name: 'المحاور', rows: [['المحور', 'n', 'المتوسط', 'أدنى 95%', 'أعلى 95%', 'أعلى صندوقين', 'أدنى صندوقين', 'ألفا'], ...a.axes.map((x) => [x.axis, x.n, x.mean, x.lo, x.hi, x.top2, x.bottom2, x.alpha ?? ''])] },
    { name: 'البنود', rows: [['#', 'البند', 'المحور', 'n', 'المتوسط', 'أدنى 95%', 'أعلى 95%', '1', '2', '3', '4', '5', 'أعلى صندوقين', 'أدنى صندوقين'], ...a.items.map((i) => [i.rank, i.label, i.axis, i.n, i.mean, i.lo, i.hi, ...i.dist, i.top2, i.bottom2])] },
    { name: 'المحركات', rows: [['البند', 'r', 'المتوسط', 'n', 'القرار'], ...a.drivers.map((d) => [d.label, d.r, d.mean, d.n, QUADRANT_AR[d.quadrant]])] },
    { name: 'الأيام', rows: [['اليوم', 'n', 'المتوسط', 'أدنى 95%', 'أعلى 95%', 'z'], ...a.dyn.days.map((d) => [d.date, d.n, d.mean, d.lo, d.hi, d.z])] },
    { name: 'المواضيع', rows: [['الموضوع', 'التعليقات', 'إيجابي', 'سلبي', 'الحصة%'], ...a.voices.themes.map((t) => [t.label, t.count, t.positive, t.negative, t.share])] },
    { name: 'النتائج', rows: [['#', 'النوع', 'العنوان', 'الدليل'], ...a.findings.map((f) => [f.id, f.kind, f.title, f.evidence])] },
    { name: 'التوصيات', rows: [['#', 'الأولوية', 'الدرجة', 'التوصية', 'لماذا', 'الخطوات', 'المالك', 'المدة', 'المؤشر'], ...a.recs.map((r) => [r.id, r.priority, r.score, r.title, r.why, r.steps.join(' | '), r.owner, r.days, r.kpi])] },
  ]; downloadXlsx(safeFilename(`athar_analysis_${rep.program}`, 'xlsx'), sheets); say('نُزّل ملفّ Excel'); }
  async function copyText() { if (!built) return; try { await navigator.clipboard.writeText(reportText(built.rep)); say('نُسخ نصّ التقرير'); } catch { setError('تعذّر النسخ'); } }

  /* P85-ب: خيارات النطاق مقيّدة بالبرنامج (وبالمستوى/المدرّب عند اختيارهما) */
  const rooms = ((raw?.lk.classrooms || []) as Room[]).filter((c) => c.program_id === programId);
  const levelOpts = (raw?.levels || []).filter((l) => (!l.program_id || l.program_id === programId) && rooms.some((c) => c.level_id === l.id || (c.level || '').toLowerCase() === l.code.toLowerCase()));
  const roomMatches = (c: Room) => (!levelId || c.level_id === levelId || levelOpts.some((l) => l.id === levelId && (c.level || '').toLowerCase() === l.code.toLowerCase())) && (!trainerId || c.trainer_id === trainerId);
  const trainerOpts = (raw?.lk.trainers || []).filter((t) => rooms.some((c) => c.trainer_id === t.id && (!levelId || roomMatches({ ...c, trainer_id: null }))));
  const roomOpts = rooms.filter(roomMatches);
  const changeProgram = (id: string) => { setProgramId(id); setLevelId(''); setTrainerId(''); setRoomId(''); };
  if (!ready) return <div className="st rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;
  const toggleKind = (k: ObsKind) => setKinds((l) => (l.includes(k) ? (l.length > 1 ? l.filter((x) => x !== k) : l) : [...l, k]));
  return (
    <div className="st rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead title={<>استوديو التحليل والتقارير</>} desc={<><p>مركز واحد لكلّ الاستبيانات: اليومي والنهائي والختامي والتعلّم عن بُعد تُحلَّل معًا بالمنهج نفسه — فواصل ثقة، ثبات المحاور، محرّكات الرضا، ديناميكا الأيام، الشرائح، أصوات المشاركين — ثمّ تقرير مكتوب بالهوية بثلاثة أعماق، يُسلَّم PDF أو Word أو PowerPoint أو Excel.</p></>}
        actions={<>
          <Link href={`/reports/live${programId ? `?program=${programId}` : ''}`} className="rm-btn"><Icon name="spark" size={16} /> التقرير الحيّ</Link>
          <button className="rm-btn" onClick={copyText} disabled={!built}><Icon name="copy" size={16} /> نسخ النصّ</button>
          <button className="rm-btn" onClick={exportXlsx} disabled={!built}><Icon name="table" size={16} /> Excel</button>
          <button className="rm-btn" onClick={exportPptx} disabled={!built}><Icon name="slides" size={16} /> PowerPoint</button>
          <button className="rm-btn" onClick={exportDocx} disabled={!built || busy === 'docx'}><Icon name="doc" size={16} /> {busy === 'docx' ? '…' : 'Word'}</button>
          <button className="rm-btn primary" onClick={() => window.print()} disabled={!built}><Icon name="print" size={16} /> PDF بالهوية</button>
        </>} />
      {error && <div className="rm-alert st-noprint" onClick={() => setError('')}>{error}</div>}{flash && <div className="st-flash st-noprint">{flash}</div>}

      <section className="rm-card st-noprint st-bar">
        <label className="st-sel">البرنامج<select value={programId} onChange={(e) => changeProgram(e.target.value)}>{raw?.programs.map((p) => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
        <div className="st-kinds" role="group" aria-label="أنواع الاستبيانات">{ALL_KINDS.map((k) => { const n = built ? built.ds.obs.filter((o) => o.kind === k).length : 0; const avail = built?.availableKinds.includes(k); return <button key={k} type="button" className={`st-kind ${kinds.includes(k) ? 'on' : ''} ${avail ? '' : 'none'}`} onClick={() => toggleKind(k)} aria-pressed={kinds.includes(k)}>{KIND_AR[k]}<small>{avail ? `${n}` : 'لا بيانات'}</small></button>; })}</div>
        <label className="st-sel sm">المستوى<select value={levelId} onChange={(e) => { setLevelId(e.target.value); setRoomId(''); }} disabled={!levelOpts.length}><option value="">{levelOpts.length ? 'كلّ المستويات' : '— لا مستويات —'}</option>{levelOpts.map((l) => <option key={l.id} value={l.id}>{l.name_ar}</option>)}</select></label>
        <label className="st-sel sm">المدرّب<select value={trainerId} onChange={(e) => { setTrainerId(e.target.value); setRoomId(''); }} disabled={!trainerOpts.length}><option value="">كلّ المدرّبين</option>{trainerOpts.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="st-sel sm">القاعة / الشعبة<select value={roomId} onChange={(e) => setRoomId(e.target.value)} disabled={!roomOpts.length}><option value="">كلّ الشُّعب</option>{roomOpts.map((c) => <option key={c.id} value={c.id}>{c.code}{c.section_name ? ` · ${c.section_name}` : ''}</option>)}</select></label>
        <label className="st-date">من<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="st-date">إلى<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <div className="st-depth" role="tablist" aria-label="عمق التقرير">{(Object.keys(DEPTH_AR) as Depth[]).map((d) => <button key={d} role="tab" aria-selected={depth === d} className={`st-tab ${depth === d ? 'on' : ''}`} onClick={() => setDepth(d)}><b>{DEPTH_AR[d].label}</b><small>{DEPTH_AR[d].reader} · {DEPTH_AR[d].pages}</small></button>)}</div>
      </section>

      {!built && <div className="rm-card rm-empty"><Icon name="chart" size={34} /><b>اختر برنامجًا</b></div>}
      {built && built.a.n === 0 && <div className="rm-card rm-empty"><Icon name="chart" size={34} /><b>لا استجابات في هذا النطاق</b><span>غيّر الأنواع أو الفترة أو المستوى/المدرّب/الشعبة.</span>{(levelId || trainerId || roomId) && <button className="rm-btn" onClick={() => { setLevelId(''); setTrainerId(''); setRoomId(''); }}>إلغاء النطاق</button>}</div>}
      {built && built.a.n > 0 && <article className="st-sheet" ref={sheetRef}>
        <header className="st-top"><img src="/brand/athar-mark.svg" alt="أَثَر" className="st-logo" /><div><div className="st-kicker">{built.rep.title} · {built.rep.audience} · <bdi>{built.rep.generated_at}</bdi></div><h2>{built.rep.program}</h2><div className="st-meta"><span>{built.rep.subtitle}</span><span><bdi>{built.rep.period}</bdi></span><span>{built.a.n} استجابة</span></div></div></header>
        <nav className="st-toc st-noprint" aria-label="أقسام التقرير">{built.rep.sections.map((s) => <a key={s.id} href={`#st-${s.id}`}>{s.title}</a>)}</nav>
        {built.rep.sections.map((s) => <section key={s.id} id={`st-${s.id}`} className="st-sec"><h3>{s.title}</h3>{s.blocks.map((b, i) => <BlockView key={i} b={b} />)}</section>)}
        <footer className="st-foot">بوّابة أَثَر للتعليم والتدريب والتطوير والجودة · athar-portal.com · «نبني القدرة ونُثبت الأثر» · أُنتج آليًّا من بيانات الاستبيانات؛ الأحكام الختامية بيد الإنسان.</footer>
      </article>}
    </div>
  );
}

function BlockView({ b }: { b: RBlock }) {
  if (b.type === 'p') return <p className="st-p">{b.text}</p>;
  if (b.type === 'kpis') return <div className="st-kpis">{b.items.map((k, i) => <div key={i} className={`st-kpi ${k.tone || ''}`}><small>{k.label}</small><b>{k.value}</b><span>{k.sub}</span></div>)}</div>;
  if (b.type === 'table') return <div className="st-tw"><table className="st-table"><thead><tr>{b.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>;
  if (b.type === 'list') return <ul className="st-list">{b.items.map((x, i) => <li key={i}>{x}</li>)}</ul>;
  if (b.type === 'chart') return <figure className="st-fig"><Chart spec={b.spec} /></figure>;
  if (b.type === 'quotes') return <div className="st-quotes">{b.items.map((q, i) => <blockquote key={i}>{q.text}<small>— {q.who}</small></blockquote>)}</div>;
  if (b.type === 'findings') return <div className="st-findings">{b.items.map((f) => <div key={f.id} className={`st-finding ${f.kind}`}><b>{f.id} · {f.title}</b><span>{f.evidence}</span></div>)}</div>;
  if (b.type === 'recs') return <div className="st-recs">{b.items.map((r) => <article key={r.id} className={`st-rec p-${r.priority}`}><header><span className="st-pri">{r.priority}</span><b>{r.id} · {r.title}</b><small>{r.owner} · {r.days} يومًا</small></header><p><b>لماذا:</b> {r.why}</p><ol>{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ol><p className="st-kpi-line"><b>مؤشّر النجاح:</b> {r.kpi}</p></article>)}</div>;
  return null;
}

const CSS = `
.st{max-width:1120px;margin:0 auto}.st-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:end}
.st-sel{display:flex;flex-direction:column;gap:4px;font-weight:800;color:#3A1F36;font-size:13px}.st-sel.sm select{min-width:160px;max-width:220px}.st-sel select{min-width:280px;padding:8px 10px;border:1px solid #e6d5c6;border-radius:10px;font:inherit}
.st-kinds{display:flex;gap:6px;flex-wrap:wrap}.st-kind{display:flex;flex-direction:column;align-items:flex-start;padding:6px 10px;border-radius:10px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer;min-height:44px}.st-kind.on{background:#5EA8A0;border-color:#5EA8A0;color:#fff}.st-kind.none{opacity:.5}.st-kind small{font-size:11px;font-weight:700;opacity:.8}
.st-date{display:flex;flex-direction:column;gap:4px;font-weight:800;color:#3A1F36;font-size:13px}.st-date input{padding:7px 8px;border:1px solid #e6d5c6;border-radius:10px;font:inherit}
.st-depth{display:flex;gap:6px;flex-wrap:wrap;margin-inline-start:auto}.st-tab{display:flex;flex-direction:column;align-items:flex-start;gap:1px;padding:7px 12px;border-radius:12px;border:1px solid #e6d5c6;background:#fff;color:#3A1F36;font:inherit;cursor:pointer;min-height:44px}.st-tab.on{background:#3A1F36;color:#fff;border-color:#3A1F36}.st-tab small{font-size:11px;opacity:.75}
.st-flash{background:#E6F3F1;color:#2F6B66;border-radius:10px;padding:8px 12px;margin:8px 0;font-weight:700}
.st-sheet{background:#fff;border:1px solid #e6d5c6;border-radius:18px;padding:22px 26px;margin-top:12px;box-shadow:0 10px 30px rgba(34,16,31,.06)}
.st-top{display:grid;grid-template-columns:72px 1fr;gap:16px;align-items:center;border-bottom:3px solid #22101F;padding-bottom:12px;margin-bottom:10px}.st-logo{width:72px;height:72px}.st-kicker{font-size:12px;font-weight:800;color:#D4614A}.st-top h2{margin:2px 0;font-size:24px;color:#22101F}.st-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12.5px;color:#5C4858;font-weight:700}
.st-toc{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 10px}.st-toc a{font-size:12px;font-weight:800;color:#3A1F36;background:#F6EBE0;border-radius:999px;padding:4px 10px;text-decoration:none}
.st-sec{margin:16px 0;break-inside:avoid-page}.st-sec h3{font-size:16px;color:#3A1F36;margin:0 0 10px;padding-inline-start:10px;border-inline-start:4px solid #D9A866}
.st-p{font-size:13.5px;line-height:2;margin:0 0 10px;color:#2a1a26}
.st-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}.st-kpi{border-radius:14px;padding:10px 12px;background:#F6EBE0;display:flex;flex-direction:column;gap:2px}.st-kpi small{font-size:11.5px;color:#5C4858;font-weight:800}.st-kpi b{font-size:24px;color:#22101F}.st-kpi span{font-size:11.5px;color:#5C4858}.st-kpi.ok{background:#E6F3F1}.st-kpi.info{background:#F6ECD9}.st-kpi.warn{background:#FDEEE9}.st-kpi.bad{background:#F8D7D3}
.st-tw{overflow:auto;margin-bottom:10px}.st-table{width:100%;border-collapse:collapse;font-size:12.5px}.st-table th{text-align:right;padding:6px 8px;background:#3A1F36;color:#fff;font-weight:800}.st-table td{padding:6px 8px;border-bottom:1px solid #f0e4d8;vertical-align:top}.st-table tr:nth-child(even) td{background:#FBF4EE}
.st-list{margin:0 0 10px;padding-inline-start:20px;font-size:13px;line-height:1.9}
.st-fig{margin:6px 0 12px;break-inside:avoid}
.st-quotes{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}.st-quotes blockquote{margin:0;border-inline-start:4px solid #D9A866;background:#FBF4EE;border-radius:8px;padding:8px 12px;font-size:12.5px;line-height:1.7;display:flex;flex-direction:column;gap:4px}.st-quotes small{color:#8a7580}
.st-findings{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}.st-finding{border-radius:12px;padding:8px 12px;display:flex;flex-direction:column;gap:3px;font-size:12.5px;line-height:1.7;border-inline-start:5px solid}.st-finding b{color:#22101F}.st-finding span{color:#4a3a46}.st-finding.strength{background:#E6F3F1;border-color:#2F6B66}.st-finding.gap{background:#F6ECD9;border-color:#D9A866}.st-finding.risk{background:#F8D7D3;border-color:#b3261e}.st-finding.signal{background:#FDEEE9;border-color:#E8795C}.st-finding.quality{background:#F3E8EF;border-color:#8E4A68}
.st-recs{display:flex;flex-direction:column;gap:10px}.st-rec{border:1px solid #EADFD6;border-radius:14px;padding:10px 14px;background:#fff;break-inside:avoid}.st-rec header{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:6px}.st-rec header b{font-size:14px;color:#22101F}.st-rec header small{color:#8a7580;margin-inline-start:auto;font-weight:700}.st-rec p{margin:4px 0;font-size:12.5px;line-height:1.8}.st-rec ol{margin:4px 0;padding-inline-start:20px;font-size:12.5px;line-height:1.8}.st-kpi-line{color:#2F6B66}
.st-pri{border-radius:999px;padding:2px 10px;font-size:11px;font-weight:900;background:#F6EBE0;color:#5C4858}.p-عاجلة .st-pri{background:#F8D7D3;color:#8b1e14}.p-عالية .st-pri{background:#FDEEE9;color:#9A3A2A}.p-متوسّطة .st-pri{background:#F6ECD9;color:#6B4A12}
.st-foot{color:#B3A5AE;font-size:11px;font-weight:700;text-align:center;margin:14px 0 0;line-height:1.7;border-top:1px solid #f0e4d8;padding-top:8px}
@media print{@page{size:A4 portrait;margin:10mm}.st-noprint,.global-nav,.rm-head-actions,.rm-head{display:none!important}.st{max-width:none}.st-sheet{border:0;box-shadow:none;padding:0;margin:0}body{background:#fff}.st-findings,.st-quotes{grid-template-columns:1fr 1fr}}
@media(max-width:980px){.st-kpis,.st-findings{grid-template-columns:1fr 1fr}.st-quotes{grid-template-columns:1fr}.st-depth{margin-inline-start:0}}
@media(max-width:560px){.st-kpis,.st-findings{grid-template-columns:1fr}}
`;
