'use client';
/**
 * /reports/center — Reports Center
 * One place to generate different decision-oriented report types from the same
 * evaluation data: pick a report → set filters → read → export (Excel / CSV / PDF) → act.
 */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { buildXlsx, downloadXlsx, type Sheet } from '../../../lib/export/xlsx';
import { buildPptx, downloadPptx, type PptSlide } from '../../../lib/export/pptx';
import { buildReportEmailHtml, mailSubject, parseRecipients, toBase64 } from '../../../lib/email/report-mail';
import { AUDIENCES, PERIOD_PRESETS, REPORTS, REPORT_GROUPS, reportById, type ReportDef, type SectionId } from '../../../lib/reports/catalog';
import { Icon, REPORT_ICON } from '../../../lib/ui/icons';
import {
  TARGET, THRESHOLDS, PERF_LABEL, RISK_LABEL, KIND_LABEL, CATEGORY_LABEL,
  actionsToTable, applyFilters, briefText, buildComments, buildEvaluations, buildFacts, commentsToTable, factsOf, groupBy,
  groupRowsToTable, keywordFrequency, kpis as computeKpis, kpisToTable, labelFor, narrative, periodComparison, rawToTable,
  riskRegister, riyadhDate, timeSeries, addDays,
  type Action, type Comparison, type Evaluation, type Fact, type Filters, type GroupRow, type Kpis, type Lang, type Lookups, type SeriesPoint, type Comment,
} from '../../../lib/reports/analytics';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#C9A24B';

type Preset = { name: string; report: string; filters: Filters; compare: boolean; preset: string };
const PRESETS_KEY = 'tep.reportCenter.presets';

export default function ReportsCenterPage() {
  return <Suspense fallback={<div className="rc-loading">…</div>}><ReportsCenter /></Suspense>;
}

function ReportsCenter() {
  const router = useRouter();
  const params = useSearchParams();
  const db = useMemo(() => supabase(), []);

  const [lang, setLang] = useState<Lang>((params.get('lang') as Lang) === 'en' ? 'en' : 'ar');
  const ar = lang === 'ar';
  const [reportId, setReportId] = useState<string>(params.get('type') || 'executive');
  const report: ReportDef = reportById(reportId);
  const [preset, setPreset] = useState<string>(params.get('preset') || report.defaults?.preset || 'all');
  const [compare, setCompare] = useState<boolean>(params.get('compare') === '1' || !!report.defaults?.compare);
  const [filters, setFilters] = useState<Filters>({
    programId: params.get('program') || '', trainerId: params.get('trainer') || '', classroomId: params.get('classroom') || '',
    kind: (params.get('kind') as Filters['kind']) || report.defaults?.kind || 'ALL', from: params.get('from') || '', to: params.get('to') || '',
    gender: params.get('gender') || '', deliveryMode: (params.get('mode') as Filters['deliveryMode']) || '',
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [audience, setAudience] = useState<(typeof AUDIENCES)[number]['id']>('all');
  const visibleReports = useMemo(() => REPORTS.filter(r => audience === 'all' || r.audienceKey === audience), [audience]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [raw, setRaw] = useState<{ evaluations: any[]; answers: any[]; questions: any[]; classrooms: any[]; trainers: any[]; programs: any[] } | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  /* ---------------- auth + load ---------------- */
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const s = await db.auth.getSession();
        if (!s.data?.session) { router.push('/login'); return; }
        const [ev, an, qs, cl, tr, pg] = await Promise.all([
          db.from('evaluations').select('*').order('submitted_at', { ascending: false }),
          db.from('evaluation_answers').select('*'),
          db.from('questions').select('*'),
          db.from('classrooms').select('*'),
          db.from('trainers').select('*'),
          db.from('programs').select('*'),
        ]);
        const err = [ev, an, qs, cl, tr, pg].find(r => r.error)?.error;
        if (err) throw err;
        if (!on) return;
        setRaw({ evaluations: ev.data || [], answers: an.data || [], questions: qs.data || [], classrooms: cl.data || [], trainers: tr.data || [], programs: pg.data || [] });
        try { setPresets(JSON.parse(localStorage.getItem(PRESETS_KEY) || '[]')); } catch { /* ignore */ }
        setLoading(false);
      } catch (e: any) {
        if (on) { setError(e?.message || 'Load error'); setLoading(false); }
      }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- URL sync (shareable links) ---------------- */
  useEffect(() => {
    const q = new URLSearchParams();
    q.set('type', reportId); q.set('lang', lang);
    if (filters.programId) q.set('program', filters.programId);
    if (filters.trainerId) q.set('trainer', filters.trainerId);
    if (filters.classroomId) q.set('classroom', filters.classroomId);
    if (filters.kind && filters.kind !== 'ALL') q.set('kind', filters.kind);
    if (filters.gender) q.set('gender', filters.gender);
    if (filters.deliveryMode) q.set('mode', filters.deliveryMode);
    if (preset !== 'all') q.set('preset', preset);
    if (preset === 'custom') { if (filters.from) q.set('from', filters.from); if (filters.to) q.set('to', filters.to); }
    if (compare) q.set('compare', '1');
    window.history.replaceState(null, '', `?${q.toString()}`);
  }, [reportId, lang, filters, preset, compare]);

  /* ---------------- derived data ---------------- */
  const lk: Lookups = useMemo(() => ({
    classrooms: raw?.classrooms || [], trainers: raw?.trainers || [], programs: raw?.programs || [], questions: raw?.questions || [],
  }), [raw]);
  const allEvals: Evaluation[] = useMemo(() => raw ? buildEvaluations(raw.evaluations, raw.answers, lk) : [], [raw, lk]);
  const facts: Fact[] = useMemo(() => raw ? buildFacts(raw.answers, raw.questions) : [], [raw]);
  const allComments: Comment[] = useMemo(() => raw ? buildComments(allEvals, raw.answers, raw.questions) : [], [raw, allEvals]);

  const today = riyadhDate(new Date().toISOString());
  const effFilters: Filters = useMemo(() => {
    const p = PERIOD_PRESETS.find(x => x.id === preset);
    if (preset === 'custom') return filters;
    if (p?.days) return { ...filters, from: addDays(today, -(p.days - 1)), to: today };
    return { ...filters, from: '', to: '' };
  }, [filters, preset, today]);

  const evals = useMemo(() => applyFilters(allEvals, effFilters, lk), [allEvals, effFilters, lk]);
  const k: Kpis = useMemo(() => computeKpis(evals, facts), [evals, facts]);
  const axes = useMemo(() => groupBy('axis', evals, facts, lk, lang), [evals, facts, lk, lang]);
  const trainers = useMemo(() => groupBy('trainer', evals, facts, lk, lang).filter(r => r.key), [evals, facts, lk, lang]);
  const programs = useMemo(() => groupBy('program', evals, facts, lk, lang), [evals, facts, lk, lang]);
  const classrooms = useMemo(() => groupBy('classroom', evals, facts, lk, lang).filter(r => r.key), [evals, facts, lk, lang]);
  const questions = useMemo(() => groupBy('question', evals, facts, lk, lang), [evals, facts, lk, lang]);
  const daily = useMemo(() => timeSeries(evals, facts, 'day', lk, lang), [evals, facts, lk, lang]);
  const weekly = useMemo(() => groupBy('week', evals, facts, lk, lang), [evals, facts, lk, lang]);
  const cmp: Comparison | null = useMemo(() => compare ? periodComparison(allEvals, facts, effFilters, lk) : null, [compare, allEvals, facts, effFilters, lk]);
  const actions: Action[] = useMemo(() => riskRegister(evals, facts, lk, lang), [evals, facts, lk, lang]);
  const comments = useMemo(() => { const ids = new Set(evals.map(e => e.id)); return allComments.filter(c => ids.has(c.evaluation_id)); }, [allComments, evals]);
  const keywords = useMemo(() => keywordFrequency(comments), [comments]);
  const scopeText = useMemo(() => scopeLabel(effFilters, lk, lang, preset), [effFilters, lk, lang, preset]);
  const story = useMemo(() => narrative(k, axes, daily, cmp, lang, ar ? 'التقرير' : 'This report'), [k, axes, daily, cmp, lang, ar]);

  // cascading filter option lists
  const programOpts = lk.programs;
  const classroomOpts = lk.classrooms.filter(c => (!effFilters.programId || c.program_id === effFilters.programId) && (!effFilters.trainerId || c.trainer_id === effFilters.trainerId));
  const trainerOpts = lk.trainers.filter(t => !effFilters.programId || lk.classrooms.some(c => c.trainer_id === t.id && c.program_id === effFilters.programId));

  const pickReport = (id: string) => {
    const def = reportById(id);
    setReportId(id); setMenuOpen(false);
    if (def.defaults?.kind) setFilters(f => ({ ...f, kind: def.defaults!.kind }));
    if (def.defaults?.compare !== undefined) setCompare(!!def.defaults.compare);
    if (def.defaults?.preset) setPreset(def.defaults.preset);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const upd = (patch: Partial<Filters>) => setFilters(f => ({ ...f, ...patch }));
  const resetFilters = () => { setFilters({ programId: '', trainerId: '', classroomId: '', kind: 'ALL', from: '', to: '', gender: '', deliveryMode: '' }); setPreset('all'); };

  /* ---------------- exports ---------------- */
  const title = report.title[lang];
  const fileBase = () => safeFilename(`${ar ? 'تقرير' : 'report'}-${report.id}-${today}`);
  const mainTables = (): { name: string; rows: (string | number)[][] }[] => {
    const t: { name: string; rows: (string | number)[][] }[] = [];
    const dim = (a: string, e: string) => (ar ? a : e);
    const s = new Set(report.sections);
    if (s.has('trainerTable') || s.has('trainerBars')) t.push({ name: dim('المدربون', 'Trainers'), rows: groupRowsToTable(trainers, lang, dim('المدرب', 'Trainer')) });
    if (s.has('programTable')) t.push({ name: dim('البرامج', 'Programs'), rows: groupRowsToTable(programs, lang, dim('البرنامج', 'Program')) });
    if (s.has('classroomTable') || s.has('heatmap')) t.push({ name: dim('القاعات', 'Rooms'), rows: groupRowsToTable(classrooms, lang, dim('القاعة', 'Room')) });
    if (s.has('axisBars') || s.has('strengthsGaps') || s.has('distribution')) t.push({ name: dim('المحاور', 'Axes'), rows: groupRowsToTable(axes, lang, dim('المحور', 'Axis')) });
    if (s.has('questionTable')) t.push({ name: dim('الأسئلة', 'Questions'), rows: groupRowsToTable(questions, lang, dim('السؤال', 'Question')) });
    if (s.has('trendLine') || s.has('weeklyTable')) {
      t.push({ name: dim('يومي', 'Daily'), rows: [[dim('اليوم', 'Day'), dim('الاستجابات', 'Responses'), dim('القياسات', 'Measurements'), dim('المتوسط', 'Mean'), dim('متوسط متحرك', 'Moving avg'), dim('الهدف', 'Target')], ...daily.map(d => [d.label, d.responses, d.n, d.mean ?? '', d.ma ?? '', TARGET])] });
      t.push({ name: dim('أسبوعي', 'Weekly'), rows: groupRowsToTable(weekly, lang, dim('الأسبوع', 'Week')) });
    }
    if (s.has('periodCompare') && cmp) t.push({ name: dim('مقارنة الفترات', 'Period comparison'), rows: compareTable(cmp, lang) });
    if (s.has('participationTables')) {
      t.push({ name: dim('حسب النوع', 'By kind'), rows: groupRowsToTable(groupBy('kind', evals, facts, lk, lang), lang, dim('النوع', 'Kind')) });
      t.push({ name: dim('حسب الجنس', 'By gender'), rows: groupRowsToTable(groupBy('gender', evals, facts, lk, lang), lang, dim('الجنس', 'Gender')) });
      t.push({ name: dim('حسب الإقامة', 'By accommodation'), rows: groupRowsToTable(groupBy('accommodation', evals, facts, lk, lang), lang, dim('الإقامة', 'Accommodation')) });
      t.push({ name: dim('حسب اليوم', 'By day'), rows: groupRowsToTable(groupBy('day', evals, facts, lk, lang), lang, dim('اليوم', 'Day')) });
    }
    if (s.has('comments') || s.has('keywords')) {
      t.push({ name: dim('التعليقات', 'Comments'), rows: commentsToTable(comments, lk, lang) });
      t.push({ name: dim('الكلمات المتكررة', 'Keywords'), rows: [[dim('الكلمة', 'Word'), dim('التكرار', 'Count')], ...keywords.map(w => [w.word, w.count])] });
    }
    if (s.has('actions')) t.push({ name: dim('خطة الإجراءات', 'Action plan'), rows: actionsToTable(actions, lang) });
    if (s.has('rawTable')) t.push({ name: dim('البيانات', 'Data'), rows: rawToTable(evals, lk, lang) });
    return t;
  };
  const xlsxSheets = (): Sheet[] => [
      { name: ar ? 'الملخص' : 'Summary', rtl: ar, rows: [[ar ? 'التقرير' : 'Report', title], [ar ? 'النطاق' : 'Scope', scopeText], [ar ? 'تاريخ الإنشاء' : 'Generated', `${today} (Asia/Riyadh)`], [], ...kpisToTable(k, lang)] },
      ...mainTables().map(t => ({ name: t.name, rows: t.rows, rtl: ar })),
  ];
  const exportXlsx = () => { downloadXlsx(fileBase(), xlsxSheets()); flash(ar ? '✅ تم تنزيل ملف Excel' : '✅ Excel downloaded'); };
  const exportCsv = () => {
    const t = mainTables()[0] || { name: 'kpis', rows: kpisToTable(k, lang) };
    downloadCSV(`${fileBase()}-${safeFilename(t.name)}.csv`, t.rows); flash(ar ? '✅ تم تنزيل CSV' : '✅ CSV downloaded');
  };
  const PPT_OPTS = { rtl: ar, footer: ar ? 'منصة تقويم البرامج التدريبية · جامعة الأمير مقرن' : 'Training Evaluation Platform · Prince Mugrin University' };
  const pptxSlides = (): PptSlide[] => {
    const slides: PptSlide[] = [];
    slides.push({ title, subtitle: scopeText, bullets: [`${ar ? 'الجمهور' : 'Audience'}: ${report.audience[lang]}`, `${ar ? 'تاريخ الإعداد' : 'Generated'}: ${today} · Asia/Riyadh`, ar ? 'منصة تقويم البرامج التدريبية — النتائج مجمّعة ولا تعرض هوية المشاركين' : 'Training Evaluation Platform — aggregated, anonymous results'] });
    if (k.responses) {
      slides.push({ title: ar ? 'المؤشرات الرئيسية' : 'Key indicators', bullets: [
        `${ar ? 'المتوسط العام' : 'Overall mean'}: ${k.mean.toFixed(2)}/5 — ${ar ? 'الهدف' : 'target'} ${TARGET} (${ar ? 'الفجوة' : 'gap'} ${(k.mean - TARGET).toFixed(2)})`,
        `${ar ? 'الاستجابات' : 'Responses'}: ${k.responses} — ${ar ? 'المشاركون' : 'participants'}: ${k.participants}`,
        `${ar ? 'رضا مرتفع (4–5)' : 'High (4–5)'}: ${k.highPct.toFixed(0)}% — ${ar ? 'منخفض (1–2)' : 'low (1–2)'}: ${k.lowPct.toFixed(0)}%`,
        `${ar ? 'التصنيف' : 'Band'}: ${PERF_LABEL[k.perf][lang]} — ${ar ? 'المخاطر' : 'risk'}: ${RISK_LABEL[k.risk][lang]}`,
        ...(cmp && cmp.deltaMean !== null ? [`${ar ? 'مقارنة بالفترة السابقة' : 'vs previous period'}: ${cmp.deltaMean >= 0 ? '▲' : '▼'} ${Math.abs(cmp.deltaMean).toFixed(2)}`] : []),
      ] });
      if (story.length) slides.push({ title: ar ? 'القراءة التحليلية' : 'Analytical reading', bullets: story.slice(0, 6) });
    } else {
      slides.push({ title: ar ? 'لا توجد استجابات' : 'No responses', bullets: [ar ? 'لا توجد استجابات ضمن هذا النطاق — وسّع الفترة أو أزل بعض الفلاتر.' : 'No responses in this scope.'] });
    }
    for (const t of mainTables()) {
      if (!t.rows.length || t.rows.length === 1) continue;
      const body = t.rows.slice(1);
      for (let i = 0; i < body.length && i < 39; i += 13) {
        const chunk = body.slice(i, i + 13);
        slides.push({ title: t.name + (body.length > 13 ? ` (${Math.floor(i / 13) + 1}/${Math.min(3, Math.ceil(body.length / 13))})` : ''), table: [t.rows[0], ...chunk] });
      }
    }
    if (actions.length) slides.push({ title: ar ? 'القرارات المطلوبة' : 'Decisions required', bullets: actions.slice(0, 6).map(a => `${a.label}: ${a.recommendation} (${ar ? 'خلال' : 'within'} ${a.dueDays} ${ar ? 'يوم' : 'days'} — ${a.owner})`) });
    return slides;
  };
  const exportPptx = () => { downloadPptx(fileBase(), pptxSlides(), PPT_OPTS); flash(ar ? '✅ تم تنزيل عرض PowerPoint' : '✅ PowerPoint downloaded'); };
  /* ---------------- email ---------------- */
  const MAIL_KEY = 'rc_mail_recipients_v1';
  const [mail, setMail] = useState({ open: false, to: '', note: '', xlsx: true, pptx: false, subscribe: false, days: 7, sending: false, error: '' });
  const openMail = () => { let to = ''; try { to = localStorage.getItem(MAIL_KEY) || ''; } catch { /* ignore */ } setMail(m => ({ ...m, open: true, to: m.to || to, error: '' })); };
  const sendMail = async () => {
    const to = parseRecipients(mail.to);
    if (!to.length) { setMail(m => ({ ...m, error: ar ? 'أدخل بريدًا إلكترونيًا صحيحًا واحدًا على الأقل (افصل بين العناوين بفاصلة)' : 'Enter at least one valid email (comma-separated)' })); return; }
    setMail(m => ({ ...m, sending: true, error: '' }));
    try {
      const session = (await db.auth.getSession()).data.session;
      if (!session) throw new Error(ar ? 'انتهت الجلسة — سجّل الدخول مجددًا' : 'Session expired');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` };
      const { data: prof } = await db.from('profiles').select('full_name').eq('id', session.user.id).single();
      const attachments: { filename: string; content: string }[] = [];
      if (mail.xlsx) attachments.push({ filename: `${fileBase()}.xlsx`, content: toBase64(buildXlsx(xlsxSheets())) });
      if (mail.pptx) attachments.push({ filename: `${fileBase()}.pptx`, content: toBase64(buildPptx(pptxSlides(), PPT_OPTS)) });
      const html = buildReportEmailHtml({
        lang, title, scope: scopeText, generatedAt: today, audience: report.audience[lang], k, deltaMean: cmp?.deltaMean ?? null, story, actions,
        link: window.location.href, note: mail.note.trim() || undefined, senderName: prof?.full_name || session.user.email || undefined, attachments: attachments.map(a => a.filename),
      });
      const res = await fetch('/api/reports/email', { method: 'POST', headers, body: JSON.stringify({ action: 'send', to, subject: mailSubject({ lang, title, scope: scopeText, k }), html, attachments, meta: { reportId, scope: scopeText } }) });
      const j = await res.json();
      if (!j.success) throw new Error(j.error || 'Send failed');
      if (mail.subscribe) {
        const subFilters = { programId: effFilters.programId || '', trainerId: effFilters.trainerId || '', classroomId: effFilters.classroomId || '', kind: effFilters.kind || 'ALL', deliveryMode: effFilters.deliveryMode || '', days: mail.days };
        const r2 = await fetch('/api/reports/email', { method: 'POST', headers, body: JSON.stringify({ action: 'subscribe', to, reportId, filters: subFilters, lang, label: `${title} — ${scopeText}` }) });
        const j2 = await r2.json(); if (!j2.success) throw new Error((ar ? 'أُرسلت الرسالة لكن تعذّر حفظ الاشتراك: ' : 'Sent, but subscription failed: ') + (j2.error || ''));
      }
      try { localStorage.setItem(MAIL_KEY, to.join(', ')); } catch { /* ignore */ }
      setMail(m => ({ ...m, open: false, sending: false }));
      flash(ar ? `✅ أُرسل التقرير إلى ${to.length} مستلم${mail.subscribe ? ' وتم تفعيل الملخص الأسبوعي' : ''}` : `✅ Sent to ${to.length} recipient(s)${mail.subscribe ? ' · weekly digest enabled' : ''}`);
    } catch (e: any) {
      setMail(m => ({ ...m, sending: false, error: e?.message || 'Error' }));
    }
  };

  const exportWord = () => {
    const doc = document.querySelector('.rc-doc');
    if (!doc) return;
    const css = `body{font-family:Tajawal,Tahoma,Arial,sans-serif;direction:${ar ? 'rtl' : 'ltr'};color:#0f172a;font-size:12pt}
      h1{color:#0f2a4e;font-size:20pt;margin:0 0 6pt}h2,h3{color:#0f2a4e;margin:14pt 0 6pt}
      table{border-collapse:collapse;width:100%;margin:8pt 0}th,td{border:1px solid #cbd5e1;padding:4pt 6pt;font-size:10.5pt}th{background:#eef2f7}
      .noprint{display:none}.rc-muted{color:#64748b}p{line-height:1.7;margin:4pt 0}`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${title}</title><!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]--><style>${css}</style></head><body>${doc.innerHTML}</body></html>`;
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${fileBase()}.doc`; a.click(); URL.revokeObjectURL(a.href);
    flash(ar ? '✅ تم تنزيل ملف Word' : '✅ Word file downloaded');
  };

  const copyBrief = async () => {
    const txt = briefText(title, k, axes, actions, lang, scopeText);
    try { await navigator.clipboard.writeText(txt); flash(ar ? '✅ نُسخ الموجز — الصقه في واتساب أو البريد' : '✅ Brief copied'); } catch { window.prompt('Copy:', txt); }
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); flash(ar ? '✅ نُسخ رابط التقرير' : '✅ Link copied'); } catch { window.prompt('Copy:', window.location.href); } };
  const savePreset = () => {
    const name = window.prompt(ar ? 'اسم التقرير المحفوظ:' : 'Preset name:', `${title} — ${scopeText}`.slice(0, 60));
    if (!name) return;
    const next = [...presets.filter(p => p.name !== name), { name, report: reportId, filters, compare, preset }];
    setPresets(next); localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); flash(ar ? '✅ تم الحفظ' : '✅ Saved');
  };
  const loadPreset = (p: Preset) => { setReportId(p.report); setFilters(p.filters); setCompare(p.compare); setPreset(p.preset); setMenuOpen(false); };
  const removePreset = (name: string) => { const next = presets.filter(p => p.name !== name); setPresets(next); localStorage.setItem(PRESETS_KEY, JSON.stringify(next)); };

  /* ---------------- render ---------------- */
  if (loading) return <div className="rc-loading" style={{ direction: ar ? 'rtl' : 'ltr' }}><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="rc-spin" /></div>;

  return (
    <div className="rc" dir={ar ? 'rtl' : 'ltr'}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {toast && <div className="rc-toast noprint">{toast}</div>}
      {mail.open && (
        <div className="rc-modal noprint" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget && !mail.sending) setMail(m => ({ ...m, open: false })); }}>
          <div className="rc-modal-box">
            <div className="rc-modal-head"><b><Icon name="mail" size={18} /> {ar ? 'إرسال التقرير بالبريد الإلكتروني' : 'Email this report'}</b><button className="rc-x" onClick={() => setMail(m => ({ ...m, open: false }))} aria-label="close">✕</button></div>
            <p className="rc-modal-sub">{title} · {scopeText}</p>
            <label className="rc-field"><span>{ar ? 'المستلمون (افصل بينهم بفاصلة)' : 'Recipients (comma-separated)'}</span>
              <textarea rows={2} dir="ltr" value={mail.to} onChange={e => setMail(m => ({ ...m, to: e.target.value }))} placeholder="dean@upm.edu.sa, quality@upm.edu.sa" /></label>
            <label className="rc-field"><span>{ar ? 'رسالة مرافقة (اختياري)' : 'Message (optional)'}</span>
              <textarea rows={3} value={mail.note} onChange={e => setMail(m => ({ ...m, note: e.target.value }))} placeholder={ar ? 'مثال: مرفق تقرير الأسبوع — يرجى الاطلاع على بند الإجراءات قبل اجتماع الأحد.' : 'e.g. Weekly report attached — please review the actions before Sunday.'} /></label>
            <div className="rc-modal-row">
              <label className="rc-check"><input type="checkbox" checked={mail.xlsx} onChange={e => setMail(m => ({ ...m, xlsx: e.target.checked }))} /><span>{ar ? 'إرفاق Excel' : 'Attach Excel'}</span></label>
              <label className="rc-check"><input type="checkbox" checked={mail.pptx} onChange={e => setMail(m => ({ ...m, pptx: e.target.checked }))} /><span>{ar ? 'إرفاق PowerPoint' : 'Attach PowerPoint'}</span></label>
            </div>
            <div className="rc-modal-sub2">
              <label className="rc-check"><input type="checkbox" checked={mail.subscribe} onChange={e => setMail(m => ({ ...m, subscribe: e.target.checked }))} /><span>{ar ? 'إرسال ملخص أسبوعي تلقائي لهؤلاء المستلمين (كل أحد 8 صباحًا)' : 'Also send an automatic weekly digest to these recipients (Sundays 08:00)'}</span></label>
              {mail.subscribe && <select value={mail.days} onChange={e => setMail(m => ({ ...m, days: Number(e.target.value) }))}><option value={7}>{ar ? 'نافذة 7 أيام' : '7-day window'}</option><option value={14}>{ar ? 'نافذة 14 يومًا' : '14-day window'}</option><option value={30}>{ar ? 'نافذة 30 يومًا' : '30-day window'}</option></select>}
            </div>
            {mail.error && <div className="rc-error" style={{ marginTop: 10 }}>{mail.error}</div>}
            <div className="rc-modal-actions">
              <button className="rc-btn" onClick={() => setMail(m => ({ ...m, open: false }))} disabled={mail.sending}>{ar ? 'إلغاء' : 'Cancel'}</button>
              <button className="rc-btn primary" onClick={sendMail} disabled={mail.sending}><Icon name="mail" size={15} /> {mail.sending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال الآن' : 'Send now')}</button>
            </div>
            <p className="rc-modal-foot">{ar ? 'تُرسل الرسالة من عنوان المنصة ويُسجَّل الإرسال في سجل التدقيق. الرد على الرسالة يصل إلى بريدك.' : 'Sent from the platform address and logged in the audit trail; replies go to your inbox.'}</p>
          </div>
        </div>
      )}


      {/* ===== header ===== */}
      <header className="rc-top noprint">
        <div className="rc-top-in">
          <button className="rc-burger" onClick={() => setMenuOpen(o => !o)} aria-label="menu">☰</button>
          <div className="rc-brand">
            <div className="rc-brand-ico"><Icon name="reports" size={24} /></div>
            <div>
            <div className="rc-ttl">{ar ? 'مركز التقارير' : 'Reports Center'}</div>
            <div className="rc-sub">{ar ? 'تقارير متعددة الأنواع من نفس البيانات — للقراءة والتصدير واتخاذ القرار' : 'Many report types from one dataset — read, export, decide'}</div>
            </div>
          </div>
          <div className="rc-actions">
            <button className="rc-ghost" onClick={() => setLang(ar ? 'en' : 'ar')}><Icon name="globe" size={16} /> {ar ? 'English' : 'العربية'}</button>
            <button className="rc-ghost" onClick={() => window.print()}><Icon name="print" size={16} /> {ar ? 'طباعة' : 'Print'}</button>
            <button className="rc-ghost" onClick={() => router.push('/dashboard')}><Icon name="dashboard" size={16} /> {ar ? 'لوحة القيادة' : 'Dashboard'}</button>
          </div>
        </div>
      </header>

      <div className="rc-lay">
        {/* ===== catalog sidebar ===== */}
        <aside className={`rc-side noprint ${menuOpen ? 'open' : ''}`}>
          <div className="rc-aud" role="tablist" aria-label={ar ? 'الفئة المستهدفة' : 'Audience'}>
            {AUDIENCES.map(a => <button key={a.id} role="tab" aria-selected={audience === a.id} className={audience === a.id ? 'on' : ''} onClick={() => setAudience(a.id)}>{ar ? a.ar : a.en}</button>)}
          </div>
          {REPORT_GROUPS.filter(g => visibleReports.some(r => r.group === g.id)).map(g => (
            <div key={g.id} className="rc-group">
              <div className="rc-group-title">{ar ? g.ar : g.en}</div>
              {visibleReports.filter(r => r.group === g.id).map(r => (
                <button key={r.id} className={`rc-item ${r.id === reportId ? 'on' : ''}`} onClick={() => pickReport(r.id)} title={r.desc[lang]}>
                  <span className="rc-item-ico"><Icon name={REPORT_ICON[r.id] || 'reports'} size={18} /></span>
                  <span className="rc-item-txt"><b>{r.title[lang]}</b><small>{r.decision[lang]}</small></span>
                </button>
              ))}
            </div>
          ))}
          {presets.length > 0 && (
            <div className="rc-group">
              <div className="rc-group-title">⭐ {ar ? 'تقاريري المحفوظة' : 'My saved reports'}</div>
              {presets.map(p => (
                <div key={p.name} className="rc-preset">
                  <button className="rc-item" onClick={() => loadPreset(p)}><span className="rc-item-ico">⭐</span><span className="rc-item-txt"><b>{p.name}</b></span></button>
                  <button className="rc-x" onClick={() => removePreset(p.name)} title={ar ? 'حذف' : 'Remove'}>✕</button>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ===== main ===== */}
        <main className="rc-main">
          {error && <div className="rc-error">{error}</div>}

          {/* filters */}
          <section className="rc-card rc-filters noprint">
            <div className="rc-filters-head">
              <b><Icon name="filter" size={16} /> {ar ? 'نطاق التقرير' : 'Report scope'}</b>
              <button className="rc-link" onClick={resetFilters}><Icon name="refresh" size={14} /> {ar ? 'إعادة ضبط' : 'Reset'}</button>
            </div>
            <div className="rc-filters-grid">
              <label><span>{ar ? 'البرنامج' : 'Program'}</span>
                <select value={filters.programId} onChange={e => upd({ programId: e.target.value, trainerId: '', classroomId: '' })}>
                  <option value="">{ar ? 'كل البرامج' : 'All programs'}</option>
                  {programOpts.map(p => <option key={p.id} value={p.id}>{p.delivery_mode === 'remote' ? '💻 ' : ''}{ar ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
                </select></label>
              <label><span>{ar ? 'المدرب' : 'Trainer'}</span>
                <select value={filters.trainerId} onChange={e => upd({ trainerId: e.target.value, classroomId: '' })}>
                  <option value="">{ar ? 'كل المدربين' : 'All trainers'}</option>
                  {trainerOpts.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></label>
              <label><span>{ar ? 'القاعة / المجموعة' : 'Room / group'}</span>
                <select value={filters.classroomId} onChange={e => upd({ classroomId: e.target.value })}>
                  <option value="">{ar ? 'كل القاعات' : 'All rooms'}</option>
                  {classroomOpts.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select></label>
              <label><span>{ar ? 'نوع التقييم' : 'Evaluation kind'}</span>
                <select value={filters.kind} onChange={e => upd({ kind: e.target.value as Filters['kind'] })}>
                  {(['ALL', 'DAILY', 'FINAL'] as const).map(x => <option key={x} value={x}>{KIND_LABEL[x][lang]}</option>)}
                </select></label>
              <label><span>{ar ? 'طريقة التنفيذ' : 'Delivery'}</span>
                <select value={filters.deliveryMode} onChange={e => upd({ deliveryMode: e.target.value as Filters['deliveryMode'] })}>
                  <option value="">{ar ? 'الكل' : 'All'}</option><option value="onsite">{ar ? '🏫 حضوري' : '🏫 On-site'}</option><option value="remote">{ar ? '💻 عن بُعد' : '💻 Remote'}</option>
                </select></label>
              <label><span>{ar ? 'الفترة' : 'Period'}</span>
                <select value={preset} onChange={e => setPreset(e.target.value)}>
                  {PERIOD_PRESETS.map(p => <option key={p.id} value={p.id}>{ar ? p.ar : p.en}</option>)}
                </select></label>
              {preset === 'custom' && (<>
                <label><span>{ar ? 'من' : 'From'}</span><input type="date" value={filters.from} onChange={e => upd({ from: e.target.value })} /></label>
                <label><span>{ar ? 'إلى' : 'To'}</span><input type="date" value={filters.to} onChange={e => upd({ to: e.target.value })} /></label>
              </>)}
              <label className="rc-check"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /><span>{ar ? 'مقارنة بالفترة السابقة' : 'Compare with previous period'}</span></label>
            </div>
            <div className="rc-toolbar">
              <span className="rc-toolbar-lbl"><Icon name="download" size={14} /> {ar ? 'تصدير' : 'Export'}</span>
              <button className="rc-btn primary" onClick={exportXlsx}><Icon name="table" size={15} /> Excel</button>
              <button className="rc-btn" onClick={exportCsv}><Icon name="doc" size={15} /> CSV</button>
              <button className="rc-btn" onClick={exportWord}><Icon name="doc" size={15} /> Word</button>
              <button className="rc-btn" onClick={exportPptx}><Icon name="slides" size={15} /> PowerPoint</button>
              <button className="rc-btn" onClick={() => window.print()}><Icon name="print" size={15} /> {ar ? 'طباعة / PDF' : 'Print / PDF'}</button>
              <span className="rc-sep" />
              <button className="rc-btn" onClick={copyBrief}><Icon name="copy" size={15} /> {ar ? 'نسخ الموجز' : 'Copy brief'}</button>
              <button className="rc-btn" onClick={copyLink}><Icon name="link" size={15} /> {ar ? 'نسخ الرابط' : 'Copy link'}</button>
              <button className="rc-btn gold" onClick={savePreset}><Icon name="star" size={15} /> {ar ? 'حفظ كتقرير' : 'Save preset'}</button>
              <span className="rc-sep" />
              <button className="rc-btn navy" onClick={openMail}><Icon name="mail" size={15} /> {ar ? 'إرسال بالبريد' : 'Email report'}</button>
            </div>
          </section>

          {/* report document */}
          <article className="rc-doc">
            <header className="rc-doc-head">
              <div className="rc-logos"><img src="/logos/upm.png" alt="UPM" /><img src="/logos/center.png" alt="Center" /></div>
              <div className="rc-doc-title">
                <div className="rc-kicker"><Icon name={REPORT_ICON[report.id] || 'reports'} size={14} /> {REPORT_GROUPS.find(g => g.id === report.group)?.[lang]} · {ar ? 'الجمهور' : 'Audience'}: {report.audience[lang]}</div>
                <h1>{title}</h1>
                <p>{report.desc[lang]}</p>
                <div className="rc-meta">
                  <span>🎯 {ar ? 'يجيب عن:' : 'Answers:'} {report.decision[lang]}</span>
                  <span>👥 {ar ? 'الجمهور:' : 'Audience:'} {report.audience[lang]}</span>
                  <span>🔎 {ar ? 'النطاق:' : 'Scope:'} {scopeText}</span>
                  <span>🕒 {ar ? 'أُنشئ في' : 'Generated'} {today} · Asia/Riyadh</span>
                </div>
              </div>
            </header>

            {evals.length === 0 && <div className="rc-empty">{ar ? 'لا توجد استجابات ضمن هذا النطاق. وسّع الفترة أو أزل بعض الفلاتر.' : 'No responses in this scope. Widen the period or remove filters.'}</div>}

            {report.sections.map(sec => (
              <Section key={sec} id={sec} lang={lang} ctx={{ k, axes, trainers, programs, classrooms, questions, daily, weekly, cmp, actions, comments, keywords, story, evals, facts, lk, report, programId: filters.programId }} />
            ))}

            <footer className="rc-doc-foot">
              {ar ? `الهدف المرجعي ${TARGET}/5 · الحد الأدنى للعينة الموثوقة ${THRESHOLDS.minSample} استجابات · التصنيف: ممتاز ≥ ${THRESHOLDS.excellent}، جيد ≥ ${THRESHOLDS.good}، مراقبة ≥ ${THRESHOLDS.watch}، خطر < ${THRESHOLDS.watch}`
                : `Benchmark ${TARGET}/5 · Reliable sample ≥ ${THRESHOLDS.minSample} responses · Bands: Excellent ≥ ${THRESHOLDS.excellent}, Good ≥ ${THRESHOLDS.good}, Watch ≥ ${THRESHOLDS.watch}, At risk < ${THRESHOLDS.watch}`}
            </footer>
          </article>
        </main>
      </div>
    </div>
  );
}

/* ====================================================================== sections */
type Ctx = {
  k: Kpis; axes: GroupRow[]; trainers: GroupRow[]; programs: GroupRow[]; classrooms: GroupRow[]; questions: GroupRow[];
  daily: SeriesPoint[]; weekly: GroupRow[]; cmp: Comparison | null; actions: Action[]; comments: Comment[];
  keywords: { word: string; count: number }[]; story: string[]; evals: Evaluation[]; facts: Fact[]; lk: Lookups; report: ReportDef; programId?: string;
};

function Section({ id, lang, ctx }: { id: SectionId; lang: Lang; ctx: Ctx }) {
  const ar = lang === 'ar';
  const { k, axes, trainers, programs, classrooms, questions, daily, weekly, cmp, actions, comments, keywords, story, evals, facts, lk } = ctx;
  switch (id) {
    case 'kpis': return <KpiStrip k={k} cmp={cmp} lang={lang} />;
    case 'programProfile': return <ProgramProfile programId={ctx.programId} lk={lk} lang={lang} />;
    case 'priorityGauge': return <PriorityGauge actions={actions} k={k} lang={lang} />;
    case 'verdict': return <Verdict k={k} lang={lang} />;
    case 'narrative': return <Card title={ar ? '📝 القراءة التحليلية' : '📝 Analytical reading'}>{story.map((p, i) => <p key={i} className="rc-p">{p}</p>)}</Card>;
    case 'strengthsGaps': return <StrengthsGaps axes={axes} lang={lang} />;
    case 'axisBars': return <Card title={ar ? '🧭 المحاور مقابل الهدف' : '🧭 Axes vs target'}><Bars rows={axes} lang={lang} /></Card>;
    case 'trendLine': return <Card title={ar ? '📈 الاتجاه الزمني (يومي) مع متوسط متحرك 3 أيام' : '📈 Daily trend with 3-day moving average'}><LineChart series={daily} lang={lang} /></Card>;
    case 'distribution': return <Card title={ar ? '📊 توزيع الدرجات 1–5' : '📊 Rating distribution 1–5'}><Distribution dist={k.dist} lang={lang} /></Card>;
    case 'trainerBars': return <Card title={ar ? '🏅 ترتيب المدربين' : '🏅 Trainer ranking'}><Bars rows={trainers} lang={lang} showN /></Card>;
    case 'trainerTable': return <Card title={ar ? '👨‍🏫 جدول أداء المدربين' : '👨‍🏫 Trainer performance table'}><GroupTable rows={trainers} lang={lang} dim={ar ? 'المدرب' : 'Trainer'} /></Card>;
    case 'programTable': return <Card title={ar ? '📚 جدول البرامج' : '📚 Programs table'}><GroupTable rows={programs} lang={lang} dim={ar ? 'البرنامج' : 'Program'} /></Card>;
    case 'classroomTable': return <Card title={ar ? '🏫 جدول القاعات / المجموعات' : '🏫 Rooms / groups table'}><GroupTable rows={classrooms.map(r => ({ ...r, label: `${r.label}${r.meta?.trainer_id ? ' — ' + labelFor('trainer', String(r.meta.trainer_id), lk, lang) : ''}` }))} lang={lang} dim={ar ? 'القاعة — المدرب' : 'Room — trainer'} /></Card>;
    case 'heatmap': return <Card title={ar ? '🗺️ الخريطة الحرارية: المحاور × القاعات' : '🗺️ Heat map: axes × rooms'}><HeatMap evals={evals} facts={facts} lk={lk} lang={lang} /></Card>;
    case 'questionTable': return <Card title={ar ? '❓ تحليل الأسئلة (مرتبة من الأدنى)' : '❓ Question analysis (lowest first)'}><GroupTable rows={[...questions].sort((a, b) => a.mean - b.mean)} lang={lang} dim={ar ? 'السؤال' : 'Question'} extra={r => String(r.meta?.section || '')} extraLabel={ar ? 'المحور' : 'Axis'} /></Card>;
    case 'periodCompare': return <PeriodCompare cmp={cmp} lang={lang} />;
    case 'weeklyTable': return <Card title={ar ? '📅 الملخص الأسبوعي' : '📅 Weekly summary'}><GroupTable rows={weekly} lang={lang} dim={ar ? 'الأسبوع (من → إلى)' : 'Week (from → to)'} /></Card>;
    case 'participationTables': return (<>
      <Card title={ar ? '📝 حسب نوع التقييم' : '📝 By kind'}><GroupTable rows={groupBy('kind', evals, facts, lk, lang)} lang={lang} dim={ar ? 'النوع' : 'Kind'} compact /></Card>
      <div className="rc-g2">
        <Card title={ar ? '🚻 حسب الجنس' : '🚻 By gender'}><GroupTable rows={groupBy('gender', evals, facts, lk, lang)} lang={lang} dim={ar ? 'الجنس' : 'Gender'} compact /></Card>
        <Card title={ar ? '🏨 حسب الإقامة' : '🏨 By accommodation'}><GroupTable rows={groupBy('accommodation', evals, facts, lk, lang)} lang={lang} dim={ar ? 'الإقامة' : 'Accommodation'} compact /></Card>
      </div>
      <Card title={ar ? '📆 الاستجابات حسب اليوم' : '📆 Responses by day'}><VolumeBars series={daily} lang={lang} /></Card>
    </>);
    case 'keywords': return <Card title={ar ? '🔤 الكلمات الأكثر تكرارًا' : '🔤 Most frequent words'}><div className="rc-cloud">{keywords.length ? keywords.map(w => <span key={w.word} style={{ fontSize: 12 + Math.min(16, w.count * 2) }}>{w.word} <small>{w.count}</small></span>) : <span className="rc-muted">{ar ? 'لا تعليقات' : 'No comments'}</span>}</div></Card>;
    case 'comments': return <Comments comments={comments} lk={lk} lang={lang} />;
    case 'actions': return <Actions actions={actions} lang={lang} />;
    case 'rawTable': return <Card title={ar ? `🗂️ الاستجابات (${evals.length})` : `🗂️ Responses (${evals.length})`}><SimpleTable rows={rawToTable(evals.slice(0, 500), lk, lang)} />{evals.length > 500 && <div className="rc-muted">{ar ? 'يُعرض أول 500 صف — التصدير يشمل الكل.' : 'First 500 rows shown — export includes all.'}</div>}</Card>;
    default: return null;
  }
}

/* ===== ملف البرنامج المهني (مقدمة/أهداف/مخرجات) — يظهر عند اختيار برنامج واحد ===== */
function ProgramProfile({ programId, lk, lang }: { programId?: string; lk: Lookups; lang: Lang }) {
  const ar = lang === 'ar';
  const p = programId ? lk.programs.find(x => x.id === programId) : undefined;
  if (!p) return <div className="rc-hint">{ar ? 'اختر برنامجًا من الفلاتر لإظهار المقدمة والأهداف والمخرجات الخاصة به في التقرير.' : 'Select a program in the filters to include its overview, objectives and outcomes.'}</div>;
  const pick = (a?: string | null, b?: string | null) => (ar ? a || b : b || a) || '';
  const lines = (t: string) => t.split(/\r?\n/).map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
  const intro = pick(p.intro_ar, p.intro_en), objectives = lines(pick(p.objectives_ar, p.objectives_en)), outcomes = lines(pick(p.outcomes_ar, p.outcomes_en)), audience = pick(p.audience_ar, p.audience_en);
  const empty = !intro && !objectives.length && !outcomes.length && !audience;
  return (
    <Card title={ar ? `📘 ملف البرنامج: ${p.name_ar || p.name_en}` : `📘 Program profile: ${p.name_en || p.name_ar}`}>
      <div className="rc-profile-meta">
        {p.start_date && <span>{ar ? 'الفترة' : 'Period'}: <bdi>{p.start_date} → {p.end_date || '…'}</bdi></span>}
        {p.delivery_mode && <span>{ar ? 'التنفيذ' : 'Mode'}: {p.delivery_mode === 'remote' ? (ar ? 'عن بُعد' : 'Remote') : (ar ? 'حضوري' : 'On-site')}</span>}
        {audience && <span>{ar ? 'الفئة المستهدفة' : 'Audience'}: {audience}</span>}
      </div>
      {empty && <div className="rc-muted">{ar ? 'لم تُدخل بيانات المحتوى المهني لهذا البرنامج بعد — تُضاف من لوحة التحكم ← البرامج ← تعديل ← «المحتوى المهني للتقرير».' : 'No professional content yet — add it from Dashboard → Programs → Edit.'}</div>}
      {intro && <p className="rc-p">{intro}</p>}
      <div className="rc-profile-cols">
        {objectives.length > 0 && <div><h4>{ar ? 'الأهداف' : 'Objectives'}</h4><ol>{objectives.map((o, i) => <li key={i}>{o}</li>)}</ol></div>}
        {outcomes.length > 0 && <div><h4>{ar ? 'المخرجات المتوقعة' : 'Expected outcomes'}</h4><ol>{outcomes.map((o, i) => <li key={i}>{o}</li>)}</ol></div>}
      </div>
    </Card>
  );
}

/* ===== عدّاد أولوية التدخل — من سجل المخاطر الحقيقي ===== */
function PriorityGauge({ actions, k, lang }: { actions: Action[]; k: Kpis; lang: Lang }) {
  const ar = lang === 'ar';
  if (!k.responses) return null;
  const top = actions[0];
  // 0–100: الفجوة عن الهدف (حتى 1.2 درجة) 50% + نسبة التقييمات المنخفضة (حتى 25%) 30% + عدد بنود الخطر العالي 20%
  const gapScore = Math.min(1, Math.max(0, TARGET - k.mean) / 1.2) * 50;
  const lowScore = Math.min(1, k.lowPct / 25) * 30;
  const highCount = actions.filter(a => a.priority === 'HIGH').length;
  const riskScore = Math.min(1, highCount / 3) * 20;
  const score = Math.round(gapScore + lowScore + riskScore);
  const level = score >= 60 ? 2 : score >= 30 ? 1 : 0;
  const color = ['#059669', '#d97706', '#dc2626'][level];
  const label = ar ? ['متابعة اعتيادية', 'تدخل خلال الأسبوع', 'تدخل فوري'][level] : ['Routine follow-up', 'Act this week', 'Immediate action'][level];
  const r = 44, c = 2 * Math.PI * r, dash = (score / 100) * c;
  return (
    <Card title={ar ? '🎯 أولوية التدخل' : '🎯 Intervention priority'}>
      <div className="rc-gauge">
        <svg width="120" height="120" viewBox="0 0 120 120" aria-label={`${score}/100`}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${dash} ${c - dash}`} transform="rotate(-90 60 60)" />
          <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="900" fill={color}>{score}</text>
          <text x="60" y="76" textAnchor="middle" fontSize="11" fill="#64748b">/100</text>
        </svg>
        <div className="rc-gauge-txt">
          <b style={{ color }}>{label}</b>
          <div className="rc-muted">{ar ? `الفجوة عن الهدف ${Math.max(0, TARGET - k.mean).toFixed(2)} · تقييمات منخفضة ${k.lowPct.toFixed(0)}% · بنود خطر عالٍ ${highCount}` : `Gap ${Math.max(0, TARGET - k.mean).toFixed(2)} · low ratings ${k.lowPct.toFixed(0)}% · high-risk items ${highCount}`}</div>
          {top && <div className="rc-gauge-top">{ar ? 'القرار المطلوب أولًا:' : 'First decision:'} <b>{top.label}</b> — {top.recommendation}</div>}
        </div>
      </div>
    </Card>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rc-card"><h3 className="rc-ct">{String(title).replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '')}</h3>{children}</section>;
}
function Badge({ kind, value, lang }: { kind: 'perf' | 'risk'; value: string; lang: Lang }) {
  const m = kind === 'perf' ? PERF_LABEL[value as keyof typeof PERF_LABEL] : RISK_LABEL[value as keyof typeof RISK_LABEL];
  return <span className="rc-badge" style={{ background: m.bg, color: m.color }}>{m[lang]}</span>;
}
const Delta = ({ v, suffix = '', good = 'up' }: { v: number | null; suffix?: string; good?: 'up' | 'down' }) => {
  if (v === null || v === undefined) return <span className="rc-muted">—</span>;
  const pos = good === 'up' ? v >= 0 : v <= 0;
  return <span className="rc-delta" style={{ color: v === 0 ? '#64748b' : pos ? '#047857' : '#b91c1c' }}>{v > 0 ? '▲' : v < 0 ? '▼' : '•'} {Number.isInteger(v) ? Math.abs(v) : Math.abs(v).toFixed(suffix === '%' ? 1 : 2)}{suffix}</span>;
};

function KpiStrip({ k, cmp, lang }: { k: Kpis; cmp: Comparison | null; lang: Lang }) {
  const ar = lang === 'ar';
  const items = [
    { l: ar ? 'المتوسط العام' : 'Overall mean', v: k.mean.toFixed(2), s: `/5 · ${ar ? 'الهدف' : 'target'} ${TARGET}`, d: cmp?.deltaMean ?? null, color: PERF_LABEL[k.perf].color },
    { l: ar ? 'الاستجابات' : 'Responses', v: k.responses, s: `${k.participants} ${ar ? 'مشارك' : 'participants'}`, d: cmp ? cmp.deltaResponses : null },
    { l: ar ? 'رضا مرتفع' : 'High ratings', v: `${k.highPct.toFixed(0)}%`, s: ar ? 'درجات 4–5' : 'scores 4–5', d: cmp?.deltaHighPct ?? null, suffix: '%' },
    { l: ar ? 'تقييمات منخفضة' : 'Low ratings', v: `${k.lowPct.toFixed(0)}%`, s: ar ? 'درجات 1–2' : 'scores 1–2', d: cmp?.deltaLowPct ?? null, suffix: '%', good: 'down' as const },
    { l: ar ? 'الفجوة للهدف' : 'Gap to target', v: (k.gap > 0 ? '-' : '+') + Math.abs(k.gap).toFixed(2), s: ar ? 'درجة' : 'points', color: k.gap > 0 ? '#b91c1c' : '#047857' },
    { l: ar ? 'التغطية' : 'Coverage', v: k.rooms, s: `${ar ? 'قاعة' : 'rooms'} · ${k.trainers} ${ar ? 'مدرب' : 'trainers'} · ${k.days} ${ar ? 'يوم' : 'days'}` },
  ];
  return (
    <div className="rc-kpis">
      {items.map((it, i) => (
        <div key={i} className="rc-kpi">
          <div className="rc-kpi-l">{it.l}</div>
          <div className="rc-kpi-v" style={{ color: it.color || NAVY }}>{it.v}</div>
          <div className="rc-kpi-s">{it.s}</div>
          {cmp && 'd' in it && <div className="rc-kpi-d"><Delta v={it.d ?? null} suffix={it.suffix || ''} good={it.good || 'up'} /> <small>{ar ? 'مقابل الفترة السابقة' : 'vs previous'}</small></div>}
        </div>
      ))}
      <div className="rc-kpi rc-kpi-badges">
        <div className="rc-kpi-l">{ar ? 'الحكم العام' : 'Verdict'}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}><Badge kind="perf" value={k.perf} lang={lang} /><Badge kind="risk" value={k.risk} lang={lang} /></div>
        <div className="rc-kpi-s">{ar ? 'الأداء · المخاطر' : 'performance · risk'}</div>
      </div>
    </div>
  );
}

function Verdict({ k, lang }: { k: Kpis; lang: Lang }) {
  const ar = lang === 'ar';
  const m = PERF_LABEL[k.perf];
  const text = k.responses < THRESHOLDS.minSample
    ? (ar ? 'حجم العينة الحالي لا يسمح بإصدار حكم موثوق. يُوصى بزيادة الاستجابات قبل اتخاذ قرارات.' : 'Sample too small for a reliable verdict; collect more responses before deciding.')
    : k.perf === 'EXCELLENT' ? (ar ? `الأداء يتجاوز الهدف المرجعي (${TARGET}). يُوصى بتوثيق الممارسات الناجحة وتعميمها.` : `Performance exceeds the ${TARGET} benchmark; document and scale what works.`)
      : k.perf === 'GOOD' ? (ar ? `أداء جيد والفجوة إلى الامتياز ${k.gap.toFixed(2)} درجة؛ التركيز على المحاور الأدنى سيرفع المؤشر سريعًا.` : `Good performance; gap to excellence is ${k.gap.toFixed(2)}. Focus on the lowest axes.`)
        : k.perf === 'WATCH' ? (ar ? `أداء مقبول دون الهدف بفجوة ${k.gap.toFixed(2)} درجة؛ تلزم خطة تحسين خلال أسبوعين.` : `Acceptable but ${k.gap.toFixed(2)} below target; an improvement plan within two weeks is needed.`)
          : (ar ? 'مستوى خطر — يتطلب تدخلًا عاجلًا ومراجعة أسبوعية للمحاور الحمراء.' : 'At risk — urgent intervention and weekly review of red axes.');
  return <div className="rc-verdict" style={{ borderColor: m.color, background: m.bg }}><b style={{ color: m.color }}>{ar ? 'الحكم:' : 'Verdict:'} {m[lang]}</b><span>{text}</span></div>;
}

function StrengthsGaps({ axes, lang }: { axes: GroupRow[]; lang: Lang }) {
  const ar = lang === 'ar';
  const s = [...axes].sort((a, b) => b.mean - a.mean).filter(x => x.mean >= THRESHOLDS.good).slice(0, 3);
  const g = [...axes].sort((a, b) => a.mean - b.mean).filter(x => x.mean < THRESHOLDS.good).slice(0, 3);
  const Box = ({ t, rows, color }: { t: string; rows: GroupRow[]; color: string }) => (
    <div className="rc-box" style={{ borderTopColor: color }}><h4>{t}</h4>
      {rows.length ? rows.map(r => <div key={r.key} className="rc-row"><b>{r.label}</b><span className="ltr">{r.mean.toFixed(2)}/5 · {ar ? 'مرتفع' : 'high'} {r.highPct.toFixed(0)}% · n={r.responses}</span></div>) : <div className="rc-muted">{ar ? 'لا يوجد' : 'None'}</div>}
    </div>);
  return <div className="rc-g2"><Box t={ar ? '💪 أبرز نقاط القوة' : '💪 Top strengths'} rows={s} color="#059669" /><Box t={ar ? '⚠️ أبرز الفجوات' : '⚠️ Top gaps'} rows={g} color="#dc2626" /></div>;
}

function Bars({ rows, lang, showN }: { rows: GroupRow[]; lang: Lang; showN?: boolean }) {
  const ar = lang === 'ar';
  if (!rows.length) return <div className="rc-muted">{ar ? 'لا توجد بيانات' : 'No data'}</div>;
  return (
    <div className="rc-bars">
      {rows.map(r => {
        const m = PERF_LABEL[r.perf];
        return (
          <div key={r.key} className="rc-bar">
            <div className="rc-bar-l" title={r.label}>{r.label}{showN && <small> (n={r.responses})</small>}</div>
            <div className="rc-bar-track">
              <div className="rc-bar-fill" style={{ width: `${(r.mean / 5) * 100}%`, background: m.color }} />
              <div className="rc-bar-target" style={{ [ar ? 'right' : 'left']: `${(TARGET / 5) * 100}%` } as React.CSSProperties} />
            </div>
            <div className="rc-bar-v ltr" style={{ color: m.color }}>{r.mean.toFixed(2)}</div>
            <Badge kind="perf" value={r.perf} lang={lang} />
          </div>
        );
      })}
      <div className="rc-muted" style={{ fontSize: 11 }}>{ar ? `الخط المنقط = الهدف ${TARGET}` : `Dotted line = target ${TARGET}`}</div>
    </div>
  );
}

function LineChart({ series, lang }: { series: SeriesPoint[]; lang: Lang }) {
  const ar = lang === 'ar';
  const pts = series.filter(s => s.mean !== null);
  if (pts.length < 2) return <div className="rc-muted">{ar ? 'يلزم يومان على الأقل من البيانات لرسم الاتجاه.' : 'At least two data days are needed.'}</div>;
  const W = 760, H = 220, P = 36;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - P - ((v - 1) / 4) * (H - 2 * P);
  const path = (get: (p: SeriesPoint) => number | null) => pts.map((p, i) => { const v = get(p); return v === null ? '' : `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`; }).join(' ');
  const step = Math.max(1, Math.ceil(pts.length / 10));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rc-svg" role="img">
      {[1, 2, 3, 4, 5].map(v => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="#e2e8f0" /><text x={P - 8} y={y(v) + 4} fontSize="10" textAnchor="end" fill="#64748b">{v}</text></g>)}
      <line x1={P} x2={W - P} y1={y(TARGET)} y2={y(TARGET)} stroke={GOLD} strokeDasharray="6 4" strokeWidth="2" />
      <text x={W - P} y={y(TARGET) - 6} fontSize="10" textAnchor="end" fill={GOLD}>{ar ? 'الهدف' : 'target'} {TARGET}</text>
      <path d={path(p => p.mean)} fill="none" stroke={NAVY} strokeWidth="2.5" />
      <path d={path(p => p.ma)} fill="none" stroke={TEAL} strokeWidth="2" strokeDasharray="3 3" />
      {pts.map((p, i) => <g key={p.key}><circle cx={x(i)} cy={y(p.mean as number)} r="4" fill={(p.mean as number) >= TARGET ? '#059669' : (p.mean as number) >= THRESHOLDS.good ? NAVY : '#dc2626'}><title>{p.label}: {p.mean} (n={p.responses})</title></circle>
        {i % step === 0 && <text x={x(i)} y={H - P + 14} fontSize="9" textAnchor="middle" fill="#64748b">{p.label.slice(5)}</text>}</g>)}
      <text x={P} y={14} fontSize="10" fill={NAVY}>— {ar ? 'المتوسط اليومي' : 'daily mean'}</text>
      <text x={P + 120} y={14} fontSize="10" fill={TEAL}>- - {ar ? 'متوسط متحرك' : 'moving avg'}</text>
    </svg>
  );
}

function VolumeBars({ series, lang }: { series: SeriesPoint[]; lang: Lang }) {
  const ar = lang === 'ar';
  if (!series.length) return <div className="rc-muted">{ar ? 'لا توجد بيانات' : 'No data'}</div>;
  const max = Math.max(...series.map(s => s.responses), 1);
  return <div className="rc-vol">{series.map(s => <div key={s.key} className="rc-vol-col" title={`${s.label}: ${s.responses}`}><div className="rc-vol-bar" style={{ height: `${(s.responses / max) * 100}%` }}><span>{s.responses}</span></div><small>{s.label.slice(5)}</small></div>)}</div>;
}

function Distribution({ dist, lang }: { dist: number[]; lang: Lang }) {
  const total = dist.reduce((a, b) => a + b, 0) || 1;
  const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e', '#059669'];
  return <div className="rc-dist">{dist.map((c, i) => <div key={i} className="rc-dist-row"><span className="rc-dist-l">{i + 1} ★</span><div className="rc-dist-track"><div style={{ width: `${(c / total) * 100}%`, background: colors[i] }} /></div><span className="ltr rc-dist-v">{c} ({((c / total) * 100).toFixed(0)}%)</span></div>)}<div className="rc-muted" style={{ fontSize: 11 }}>{lang === 'ar' ? `إجمالي القياسات ${total}` : `Total measurements ${total}`}</div></div>;
}

function GroupTable({ rows, lang, dim, compact, extra, extraLabel }: { rows: GroupRow[]; lang: Lang; dim: string; compact?: boolean; extra?: (r: GroupRow) => string; extraLabel?: string }) {
  const ar = lang === 'ar';
  if (!rows.length) return <div className="rc-muted">{ar ? 'لا توجد بيانات' : 'No data'}</div>;
  return (
    <div className="rc-tw"><table className="rc-tbl">
      <thead><tr>
        <th>#</th><th>{dim}</th>{extra && <th>{extraLabel}</th>}<th>{ar ? 'الاستجابات' : 'Resp.'}</th>{!compact && <th>{ar ? 'المشاركون' : 'Partic.'}</th>}<th>{ar ? 'المتوسط' : 'Mean'}</th>
        {!compact && <th>{ar ? 'الانحراف' : 'SD'}</th>}<th>{ar ? 'مرتفع %' : 'High %'}</th><th>{ar ? 'منخفض %' : 'Low %'}</th><th>{ar ? 'الفجوة' : 'Gap'}</th>{!compact && <th>{ar ? 'الاتجاه' : 'Trend'}</th>}<th>{ar ? 'التصنيف' : 'Band'}</th><th>{ar ? 'المخاطر' : 'Risk'}</th>
      </tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={r.key}>
          <td>{i + 1}</td><td className="rc-td-l">{r.label}</td>{extra && <td className="rc-td-l rc-muted">{extra(r)}</td>}<td className="ltr">{r.responses}</td>{!compact && <td className="ltr">{r.participants}</td>}
          <td className="ltr" style={{ fontWeight: 900, color: PERF_LABEL[r.perf].color }}>{r.mean.toFixed(2)}</td>{!compact && <td className="ltr">{r.sd.toFixed(2)}</td>}
          <td className="ltr">{r.highPct.toFixed(0)}%</td><td className="ltr" style={{ color: r.lowPct >= 10 ? '#b91c1c' : undefined }}>{r.lowPct.toFixed(0)}%</td>
          <td className="ltr" style={{ color: r.gap > 0 ? '#b91c1c' : '#047857' }}>{r.gap > 0 ? '-' : '+'}{Math.abs(r.gap).toFixed(2)}</td>
          {!compact && <td><Delta v={r.delta} /></td>}<td><Badge kind="perf" value={r.perf} lang={lang} /></td><td><Badge kind="risk" value={r.risk} lang={lang} /></td>
        </tr>))}</tbody>
    </table></div>
  );
}

function SimpleTable({ rows }: { rows: (string | number)[][] }) {
  if (rows.length < 2) return <div className="rc-muted">—</div>;
  return <div className="rc-tw"><table className="rc-tbl"><thead><tr>{rows[0].map((h, i) => <th key={i}>{h}</th>)}</tr></thead><tbody>{rows.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={typeof c === 'number' ? 'ltr' : 'rc-td-l'}>{String(c)}</td>)}</tr>)}</tbody></table></div>;
}

function HeatMap({ evals, facts, lk, lang }: { evals: Evaluation[]; facts: Fact[]; lk: Lookups; lang: Lang }) {
  const ar = lang === 'ar';
  const fx = factsOf(evals, facts);
  const eMap = new Map(evals.map(e => [e.id, e]));
  const rooms = Array.from(new Set(evals.map(e => e.classroom_id).filter(Boolean))) as string[];
  const axesKeys = Array.from(new Set(fx.map(f => ar ? f.section_ar : f.section_en)));
  if (!rooms.length || !axesKeys.length) return <div className="rc-muted">{ar ? 'لا توجد بيانات كافية' : 'Not enough data'}</div>;
  const cell = new Map<string, number[]>();
  for (const f of fx) { const e = eMap.get(f.evaluation_id); if (!e?.classroom_id) continue; const key = `${e.classroom_id}|${ar ? f.section_ar : f.section_en}`; const arr = cell.get(key) || []; arr.push(f.value); cell.set(key, arr); }
  const color = (m: number) => m >= THRESHOLDS.excellent ? '#bbf7d0' : m >= THRESHOLDS.good ? '#d9f99d' : m >= THRESHOLDS.watch ? '#fde68a' : '#fecaca';
  return (
    <div className="rc-tw"><table className="rc-tbl rc-heat">
      <thead><tr><th>{ar ? 'القاعة \\ المحور' : 'Room \\ Axis'}</th>{axesKeys.map(a => <th key={a}>{a}</th>)}</tr></thead>
      <tbody>{rooms.map(r => <tr key={r}><td className="rc-td-l"><b>{labelFor('classroom', r, lk, lang)}</b><br /><small className="rc-muted">{labelFor('trainer', lk.classrooms.find(c => c.id === r)?.trainer_id || '', lk, lang)}</small></td>
        {axesKeys.map(a => { const v = cell.get(`${r}|${a}`); if (!v?.length) return <td key={a} className="rc-muted">—</td>; const m = v.reduce((x, y) => x + y, 0) / v.length; return <td key={a} className="ltr" style={{ background: color(m), fontWeight: 800 }}>{m.toFixed(2)}<br /><small style={{ fontWeight: 400 }}>n={v.length}</small></td>; })}
      </tr>)}</tbody>
    </table></div>
  );
}

function compareTable(cmp: Comparison, lang: Lang): (string | number)[][] {
  const ar = lang === 'ar';
  const c = cmp.current, p = cmp.previous;
  return [
    [ar ? 'المؤشر' : 'Indicator', `${ar ? 'الحالية' : 'Current'} (${cmp.from} → ${cmp.to})`, `${ar ? 'السابقة' : 'Previous'} (${cmp.prevFrom} → ${cmp.prevTo})`, ar ? 'التغير' : 'Change'],
    [ar ? 'الاستجابات' : 'Responses', c.responses, p.responses, cmp.deltaResponses],
    [ar ? 'المشاركون' : 'Participants', c.participants, p.participants, c.participants - p.participants],
    [ar ? 'المتوسط' : 'Mean', c.mean, p.mean, cmp.deltaMean ?? ''],
    [ar ? 'مرتفع %' : 'High %', c.highPct, p.highPct, cmp.deltaHighPct ?? ''],
    [ar ? 'منخفض %' : 'Low %', c.lowPct, p.lowPct, cmp.deltaLowPct ?? ''],
    [ar ? 'الانحراف' : 'SD', c.sd, p.sd, Math.round((c.sd - p.sd) * 100) / 100],
  ];
}
function PeriodCompare({ cmp, lang }: { cmp: Comparison | null; lang: Lang }) {
  const ar = lang === 'ar';
  if (!cmp) return <Card title={ar ? '⚖️ مقارنة الفترات' : '⚖️ Period comparison'}><div className="rc-muted">{ar ? 'فعّل «مقارنة بالفترة السابقة» واختر فترة محددة.' : 'Enable “compare with previous period” and choose a period.'}</div></Card>;
  const rows = compareTable(cmp, lang);
  return (
    <Card title={ar ? '⚖️ الفترة الحالية مقابل الفترة السابقة (بنفس الطول)' : '⚖️ Current vs previous period (equal length)'}>
      <div className="rc-cmp">
        <div className="rc-cmp-box"><small>{ar ? 'الحالية' : 'Current'}</small><b>{cmp.current.mean.toFixed(2)}</b><span>{cmp.from} → {cmp.to} · n={cmp.current.responses}</span></div>
        <div className="rc-cmp-mid"><Delta v={cmp.deltaMean} /><small>{ar ? 'تغير المتوسط' : 'mean change'}</small></div>
        <div className="rc-cmp-box"><small>{ar ? 'السابقة' : 'Previous'}</small><b>{cmp.previous.mean.toFixed(2)}</b><span>{cmp.prevFrom} → {cmp.prevTo} · n={cmp.previous.responses}</span></div>
      </div>
      <SimpleTable rows={rows} />
    </Card>
  );
}

function Comments({ comments, lk, lang }: { comments: Comment[]; lk: Lookups; lang: Lang }) {
  const ar = lang === 'ar';
  const [filter, setFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const list = comments.filter(c => filter === 'all' || c.sentiment === filter);
  const counts = { positive: comments.filter(c => c.sentiment === 'positive').length, negative: comments.filter(c => c.sentiment === 'negative').length, neutral: comments.filter(c => c.sentiment === 'neutral').length };
  const col = { positive: '#047857', negative: '#b91c1c', neutral: '#64748b' };
  return (
    <Card title={ar ? `💬 التعليقات المفتوحة (${comments.length})` : `💬 Open comments (${comments.length})`}>
      <div className="rc-seg noprint">
        {(['all', 'positive', 'negative', 'neutral'] as const).map(f => <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f === 'all' ? (ar ? 'الكل' : 'All') : f === 'positive' ? (ar ? `إيجابي ${counts.positive}` : `Positive ${counts.positive}`) : f === 'negative' ? (ar ? `سلبي ${counts.negative}` : `Negative ${counts.negative}`) : (ar ? `محايد ${counts.neutral}` : `Neutral ${counts.neutral}`)}</button>)}
      </div>
      {list.length ? <div className="rc-comments">{list.slice(0, 300).map((c, i) => (
        <div key={i} className="rc-comment" style={{ borderInlineStartColor: col[c.sentiment] }}>
          <div className="rc-comment-meta"><span>{c.date}</span><span>{KIND_LABEL[c.kind]?.[lang] || c.kind}</span>{c.classroom_id && <span>{labelFor('classroom', c.classroom_id, lk, lang)}</span>}{c.trainer_id && <span>{labelFor('trainer', c.trainer_id, lk, lang)}</span>}<span className="rc-muted">{ar ? c.question_ar : c.question_en}</span></div>
          <div className="rc-comment-text">{c.text}</div>
        </div>))}</div> : <div className="rc-muted">{ar ? 'لا توجد تعليقات' : 'No comments'}</div>}
    </Card>
  );
}

function Actions({ actions, lang }: { actions: Action[]; lang: Lang }) {
  const ar = lang === 'ar';
  const pr = { HIGH: { ar: 'عالية', en: 'High', c: '#b91c1c', bg: '#fee2e2' }, MED: { ar: 'متوسطة', en: 'Medium', c: '#b45309', bg: '#fef3c7' }, LOW: { ar: 'منخفضة', en: 'Low', c: '#0f766e', bg: '#ccfbf1' } };
  return (
    <Card title={ar ? `🎯 خطة الإجراءات (${actions.length})` : `🎯 Action plan (${actions.length})`}>
      {actions.length ? actions.map((a, i) => (
        <div key={a.id} className="rc-action">
          <div className="rc-action-n" style={{ background: pr[a.priority].c }}>{i + 1}</div>
          <div style={{ flex: 1 }}>
            <div className="rc-action-head"><b>{a.label}</b><span className="rc-badge" style={{ background: pr[a.priority].bg, color: pr[a.priority].c }}>{ar ? 'أولوية' : 'Priority'} {pr[a.priority][lang]}</span><span className="rc-badge" style={{ background: '#f1f5f9', color: '#334155' }}>{CATEGORY_LABEL[a.category][lang]}</span><span className="ltr rc-muted">{a.mean.toFixed(2)}/5 · {ar ? 'منخفض' : 'low'} {a.lowPct.toFixed(0)}% · n={a.responses} · {ar ? 'الأثر' : 'impact'} {a.impact}</span></div>
            <div className="rc-action-rec">{a.recommendation}</div>
            <div className="rc-action-meta"><span>👤 {a.owner}</span><span>⏱️ {a.dueDays} {ar ? 'يوم' : 'days'}</span><span>📏 {a.kpi}</span></div>
          </div>
        </div>
      )) : <div className="rc-muted">{ar ? 'لا توجد إجراءات مطلوبة — الأداء ضمن النطاق المطمئن أو العينة غير كافية.' : 'No actions required — performance within safe zone or sample insufficient.'}</div>}
    </Card>
  );
}

function scopeLabel(f: Filters, lk: Lookups, lang: Lang, preset: string): string {
  const ar = lang === 'ar';
  const parts: string[] = [];
  parts.push(f.programId ? labelFor('program', f.programId, lk, lang) : (ar ? 'كل البرامج' : 'All programs'));
  if (f.trainerId) parts.push(labelFor('trainer', f.trainerId, lk, lang));
  if (f.classroomId) parts.push(labelFor('classroom', f.classroomId, lk, lang));
  if (f.kind && f.kind !== 'ALL') parts.push(KIND_LABEL[f.kind][lang]);
  if (f.deliveryMode) parts.push(f.deliveryMode === 'remote' ? (ar ? 'عن بُعد' : 'Remote') : (ar ? 'حضوري' : 'On-site'));
  const p = PERIOD_PRESETS.find(x => x.id === preset);
  parts.push(f.from || f.to ? `${f.from || '…'} → ${f.to || '…'}` : (p ? (ar ? p.ar : p.en) : ''));
  return parts.filter(Boolean).join(' · ');
}

/* ====================================================================== styles */
const CSS = `
.rc{min-height:100vh;color:var(--ink);background:var(--bg)}
.rc-loading{min-height:100vh;display:grid;place-items:center;background:var(--navy)}
@keyframes rcspin{to{transform:rotate(360deg)}}
.rc-spin{width:52px;height:52px;border:5px solid rgba(255,255,255,.14);border-top-color:var(--teal-2);border-radius:50%;animation:rcspin .9s linear infinite}
.rc-muted{color:var(--muted-2);font-weight:700;font-size:12px}
.rc-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:50;background:var(--navy);color:#fff;padding:10px 18px;border-radius:var(--r);font-weight:800;box-shadow:var(--shadow);border-inline-start:4px solid var(--teal-2)}
/* ---------- page header ---------- */
.rc-top{background:linear-gradient(135deg,var(--navy) 0%,#0b2240 100%);color:#fff;position:relative;overflow:hidden}
.rc-top::before{content:'';position:absolute;inset:0;background:radial-gradient(600px 200px at 85% 120%,rgba(11,138,131,.35),transparent 70%)}
.rc-top::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--gold),var(--teal-2))}
.rc-top-in{max-width:1400px;margin:0 auto;padding:18px 22px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;position:relative}
.rc-burger{display:none;background:rgba(255,255,255,.12);border:0;color:#fff;font-size:20px;border-radius:10px;padding:6px 12px;cursor:pointer}
.rc-brand{flex:1;min-width:220px;display:flex;gap:14px;align-items:center}
.rc-brand-ico{width:46px;height:46px;border-radius:14px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;color:#f1dfa6;flex-shrink:0}
.rc-ttl{font-size:22px;font-weight:800;line-height:1.2}
.rc-sub{color:#a9c4d8;font-size:12.5px;font-weight:700;margin-top:3px}
.rc-actions{display:flex;gap:8px;flex-wrap:wrap}
.rc-ghost{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:10px;padding:8px 12px;font-weight:800;cursor:pointer;font-size:13px;transition:.15s}
.rc-ghost:hover{background:rgba(255,255,255,.16);border-color:rgba(255,255,255,.35)}
/* ---------- layout ---------- */
.rc-lay{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:296px 1fr;gap:18px;padding:18px 22px 36px}
.rc-side{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:12px;align-self:start;position:sticky;top:70px;max-height:calc(100vh - 84px);overflow:auto;box-shadow:var(--shadow-sm)}
.rc-aud{display:flex;gap:3px;background:var(--surface-2);border:1px solid var(--line);padding:3px;border-radius:10px;margin:2px 0 12px}
.rc-aud button{flex:1;border:0;background:transparent;border-radius:8px;padding:7px 4px;font-size:12px;font-weight:800;color:var(--muted);cursor:pointer;transition:.15s}
.rc-aud button.on{background:var(--navy);color:#fff;box-shadow:var(--shadow-sm)}
.rc-group{margin-bottom:10px}
.rc-group-title{font-size:10.5px;font-weight:800;color:var(--muted);letter-spacing:.6px;padding:8px 10px 4px;text-transform:uppercase;display:flex;align-items:center;gap:8px}
.rc-group-title::after{content:'';flex:1;height:1px;background:var(--line)}
.rc-item{width:100%;display:flex;gap:10px;align-items:flex-start;background:transparent;border:1px solid transparent;border-radius:10px;padding:8px 10px;cursor:pointer;text-align:start;color:var(--ink);transition:.15s;position:relative}
.rc-item:hover{background:var(--surface-2)}
.rc-item.on{background:var(--teal-soft);border-color:var(--teal-line)}
.rc-item.on::before{content:'';position:absolute;inset-inline-start:-1px;top:8px;bottom:8px;width:3px;border-radius:3px;background:var(--teal)}
.rc-item-ico{width:32px;height:32px;border-radius:9px;background:var(--navy-soft);color:var(--navy);display:inline-grid;place-items:center;flex-shrink:0}
.rc-item.on .rc-item-ico{background:var(--teal);color:#fff}
.rc-kicker svg{vertical-align:-2px}
.rc-item-txt{display:flex;flex-direction:column;gap:1px;min-width:0}
.rc-item-txt b{font-size:13.5px;color:var(--navy)}
.rc-item-txt small{font-size:11px;color:var(--muted);font-weight:700;line-height:1.45}
.rc-preset{display:flex;align-items:center}
.rc-x{border:0;background:transparent;color:var(--bad);cursor:pointer;font-weight:900;padding:6px;border-radius:6px}.rc-x:hover{background:var(--bad-soft)}
.rc-main{min-width:0}
.rc-error{background:var(--bad-soft);border:1px solid var(--bad-line);color:var(--bad);border-radius:var(--r);padding:12px 14px;font-weight:800;margin-bottom:12px}
.rc-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px 20px;margin-bottom:16px;break-inside:avoid;box-shadow:var(--shadow-sm)}
.rc-ct{margin:0 0 14px;font-size:16px;font-weight:800;color:var(--navy);display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.rc-ct::before{content:'';width:4px;height:18px;border-radius:3px;background:var(--teal)}
/* ---------- filters ---------- */
.rc-filters{padding:14px 18px 12px}
.rc-filters-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.rc-filters-head b{display:inline-flex;align-items:center;gap:8px;color:var(--navy);font-size:14px}
.rc-filters-head b svg{color:var(--teal)}
.rc-filters-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px 12px;align-items:end}
.rc-filters label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:var(--ink-2)}
.rc-filters select,.rc-filters input[type=date]{border:1px solid var(--line-2);border-radius:10px;padding:0 12px;height:40px;font-weight:700;background:var(--surface);color:var(--ink);font-size:13px;transition:.15s;width:100%}
.rc-filters select:focus,.rc-filters input[type=date]:focus{outline:0;border-color:var(--teal);box-shadow:var(--ring)}
.rc-check{flex-direction:row!important;align-items:center;gap:8px!important;height:40px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);cursor:pointer;user-select:none}
.rc-check input{accent-color:var(--teal);width:16px;height:16px;margin:0}
.rc-link{display:inline-flex;align-items:center;gap:5px;background:transparent;border:0;color:var(--teal);font-weight:800;cursor:pointer;padding:8px 6px;font-size:13px;border-radius:8px}
.rc-link:hover{background:var(--teal-soft)}
.rc-toolbar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}
.rc-toolbar-lbl{font-size:11.5px;font-weight:800;color:var(--muted);margin-inline-end:4px;display:inline-flex;align-items:center;gap:5px}
.rc-sep{width:1px;height:22px;background:var(--line);margin:0 6px}
.rc-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-2);background:var(--surface);border-radius:9px;padding:8px 12px;font-weight:800;cursor:pointer;font-size:12.5px;color:var(--ink-2);transition:.15s;line-height:1.3}
.rc-btn svg{color:var(--navy);opacity:.8}
.rc-btn:hover{background:var(--navy-soft);border-color:#b9c7d8;color:var(--navy)}
.rc-btn.primary{background:var(--teal);color:#fff;border-color:var(--teal);box-shadow:0 4px 12px rgba(11,138,131,.22)}
.rc-btn.primary svg{color:#fff;opacity:1}
.rc-btn.primary:hover{background:var(--teal-2);border-color:var(--teal-2);color:#fff}
.rc-btn.gold{background:var(--gold-soft);border-color:var(--gold-line);color:#7a5c0f}.rc-btn.gold svg{color:var(--gold);opacity:1}
.rc-btn.navy{background:var(--navy);border-color:var(--navy);color:#fff}.rc-btn.navy svg{color:#fff;opacity:1}.rc-btn.navy:hover{background:var(--navy-2);color:#fff}
.rc-btn:disabled{opacity:.6;cursor:not-allowed}
/* ---------- email modal ---------- */
.rc-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(2px);display:grid;place-items:center;z-index:200;padding:16px}
.rc-modal-box{width:min(620px,100%);background:var(--surface);border-radius:var(--r-lg);padding:20px 22px;box-shadow:0 24px 60px rgba(15,23,42,.3);max-height:92vh;overflow:auto}
.rc-modal-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.rc-modal-head b{display:inline-flex;align-items:center;gap:8px;font-size:16px;color:var(--navy)}.rc-modal-head b svg{color:var(--teal)}
.rc-modal-sub{margin:4px 0 14px;font-size:12.5px;font-weight:700;color:var(--muted)}
.rc-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:10px}
.rc-field textarea{border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;font-weight:700;font-size:13px;color:var(--ink);background:var(--surface);line-height:1.7;resize:vertical}
.rc-field textarea:focus{outline:0;border-color:var(--teal);box-shadow:var(--ring)}
.rc-modal-row{display:flex;gap:10px;flex-wrap:wrap}
.rc-modal-sub2{margin-top:10px;padding:10px 12px;background:var(--teal-soft);border:1px solid var(--teal-line);border-radius:10px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.rc-modal-sub2 .rc-check{background:transparent;border:0;padding:0;height:auto}
.rc-modal .rc-check{display:inline-flex;align-items:center;gap:8px}.rc-modal .rc-check input{margin:0}
.rc-modal-sub2 select{border:1px solid var(--line-2);border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px;background:#fff}
.rc-modal-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}
.rc-modal-foot{margin:10px 0 0;font-size:11.5px;color:var(--muted-2);font-weight:700;line-height:1.7}

/* ---------- report document ---------- */
.rc-doc{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:24px;box-shadow:var(--shadow-sm)}
.rc-doc-head{display:flex;gap:18px;align-items:flex-start;border-bottom:2px solid var(--gold);padding-bottom:16px;margin-bottom:18px}
.rc-logos{display:flex;gap:10px;align-items:center}
.rc-logos img{height:52px;width:auto}
.rc-doc-title{flex:1}
.rc-kicker{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;color:var(--teal);background:var(--teal-soft);border:1px solid var(--teal-line);padding:3px 10px;border-radius:999px}
.rc-doc-title h1{margin:8px 0 4px;font-size:26px;color:var(--navy);font-weight:800;letter-spacing:-.2px}
.rc-doc-title p{margin:0 0 8px;color:var(--ink-2);font-weight:700;font-size:13px;line-height:1.7}
.rc-meta{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;font-weight:800;color:var(--ink-2)}
.rc-empty{display:flex;gap:12px;align-items:center;background:var(--warn-soft);border:1px solid var(--warn-line);color:#7c4a03;border-radius:var(--r);padding:14px 16px;font-weight:800;margin-bottom:14px}
.rc-empty::before{content:'';width:10px;height:10px;border-radius:50%;background:var(--warn);flex-shrink:0}
.rc-hint{display:flex;gap:10px;align-items:center;background:var(--info-soft);border:1px solid var(--info-line);color:var(--info);border-radius:var(--r);padding:10px 14px;font-size:13px;font-weight:700}
.rc-profile-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:8px}
.rc-profile-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.rc-profile-cols h4{margin:6px 0;color:var(--navy);font-size:14px}
.rc-profile-cols ol{margin:0;padding-inline-start:20px;line-height:1.9;font-size:13px}
.rc-gauge{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.rc-gauge-txt{flex:1;min-width:220px;font-size:13px;line-height:1.8}.rc-gauge-txt>b{font-size:16px}
.rc-gauge-top{margin-top:6px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.rc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.rc-kpi{background:var(--surface);border:1px solid var(--line);border-top:3px solid var(--navy);border-radius:var(--r);padding:12px 14px;box-shadow:var(--shadow-sm)}
.rc-kpi-l{font-size:11px;font-weight:800;color:var(--muted)}
.rc-kpi-v{font-size:28px;font-weight:900;direction:ltr;unicode-bidi:plaintext;line-height:1.2;color:var(--navy);font-variant-numeric:tabular-nums}
.rc-kpi-s{font-size:11px;color:var(--muted);font-weight:700}
.rc-kpi-d{font-size:12px;margin-top:4px;font-weight:800}
.rc-kpi-d small{color:var(--muted-2);font-weight:700}
.rc-delta{font-weight:900;direction:ltr;unicode-bidi:plaintext}
.rc-badge{display:inline-flex;align-items:center;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap;line-height:1.6}
.rc-verdict{display:flex;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid;border-inline-start-width:5px;border-radius:var(--r);padding:12px 16px;margin-bottom:16px;font-weight:700;font-size:14px}
.rc-p{margin:0 0 10px;line-height:1.95;font-size:14px;color:var(--ink-2)}
.rc-g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}
.rc-box{background:var(--surface-2);border:1px solid var(--line);border-top:3px solid;border-radius:var(--r);padding:14px}
.rc-box h4{margin:0 0 8px;font-size:14px;color:var(--navy)}
.rc-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px dashed var(--line);font-size:13px}
.rc-bars{display:flex;flex-direction:column;gap:8px}
.rc-bar{display:grid;grid-template-columns:minmax(120px,220px) 1fr 52px auto;gap:10px;align-items:center;font-size:13px}
.rc-bar-l{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-bar-l small{color:var(--muted-2);font-weight:700}
.rc-bar-track{position:relative;height:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;overflow:visible}
.rc-bar-fill{height:100%;border-radius:999px;margin:-1px 0}
.rc-bar-target{position:absolute;top:-4px;bottom:-4px;width:0;border-inline-start:2px dotted var(--gold)}
.rc-bar-v{font-weight:900;font-variant-numeric:tabular-nums}
.rc-svg{width:100%;height:auto;display:block}
.rc-vol{display:flex;gap:3px;align-items:flex-end;height:140px;overflow-x:auto;padding-bottom:16px}
.rc-vol-col{flex:1;min-width:22px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}
.rc-vol-bar{width:100%;background:linear-gradient(180deg,var(--teal-2),var(--teal));border-radius:4px 4px 0 0;min-height:2px;position:relative}
.rc-vol-bar span{position:absolute;top:-16px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;color:var(--ink-2)}
.rc-vol-col small{position:absolute;bottom:-16px;font-size:9px;color:var(--muted-2)}
.rc-dist-row{display:grid;grid-template-columns:44px 1fr 90px;gap:10px;align-items:center;margin-bottom:6px;font-size:13px;font-weight:800}
.rc-dist-track{height:12px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px;overflow:hidden}
.rc-dist-track div{height:100%}
.rc-tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r)}
.rc-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.rc-tbl th{background:var(--surface-2);color:var(--muted);font-weight:800;padding:10px 10px;border-bottom:1px solid var(--line);text-align:center;font-size:11.5px;white-space:nowrap;letter-spacing:.2px}
.rc-tbl th:first-child{text-align:start}
.rc-tbl td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:center;font-weight:700;vertical-align:middle;font-variant-numeric:tabular-nums}
.rc-tbl tbody tr:last-child td{border-bottom:0}
.rc-tbl tbody tr:hover td{background:#fbfcfe}
.rc-td-l{text-align:start!important;font-weight:800!important;color:var(--navy)}
.rc-heat td{font-size:12px}
.rc-cmp{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center;margin-bottom:12px}
.rc-cmp-box{background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r);padding:12px;text-align:center}
.rc-cmp-box small{display:block;color:var(--muted);font-weight:800;font-size:11px}
.rc-cmp-box b{display:block;font-size:30px;color:var(--navy);direction:ltr;font-variant-numeric:tabular-nums}
.rc-cmp-box span{font-size:11px;color:var(--muted);font-weight:700}
.rc-cmp-mid{text-align:center;font-size:22px}
.rc-cmp-mid small{display:block;font-size:11px;color:var(--muted);font-weight:800}
.rc-cloud{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline}
.rc-cloud span{font-weight:800;color:var(--navy)}
.rc-cloud small{color:var(--muted-2);font-weight:700}
.rc-seg{display:inline-flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:3px;margin-bottom:10px}
.rc-seg button{border:0;background:transparent;border-radius:8px;padding:6px 12px;font-weight:800;cursor:pointer;color:var(--muted);font-size:12px}
.rc-seg button.on{background:var(--navy);color:#fff;box-shadow:var(--shadow-sm)}
.rc-comments{display:flex;flex-direction:column;gap:8px}
.rc-comment{border:1px solid var(--line);border-inline-start:4px solid;border-radius:var(--r);padding:10px 12px;background:var(--surface-2)}
.rc-comment-meta{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:11px;font-weight:800;color:var(--ink-2);margin-bottom:4px}
.rc-comment-text{font-size:14px;line-height:1.8}
.rc-action{display:flex;gap:12px;padding:12px 0;border-bottom:1px dashed var(--line)}
.rc-action-n{width:30px;height:30px;border-radius:50%;color:#fff;font-weight:900;display:grid;place-items:center;flex-shrink:0}
.rc-action-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px;font-size:14px}
.rc-action-rec{font-size:13px;color:var(--ink-2);line-height:1.8}
.rc-action-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);font-weight:800;margin-top:4px}
.rc-doc-foot{margin-top:16px;padding-top:10px;border-top:1px solid var(--line);font-size:11px;color:var(--muted-2);font-weight:700}
@media(max-width:1000px){.rc-lay{grid-template-columns:1fr;padding:14px}.rc-side{display:none;position:static;max-height:none}.rc-side.open{display:block}.rc-burger{display:block}.rc-g2{grid-template-columns:1fr}.rc-cmp{grid-template-columns:1fr}.rc-bar{grid-template-columns:1fr}.rc-bar-l{white-space:normal}.rc-profile-cols{grid-template-columns:1fr}.rc-doc{padding:16px}}
@media print{
  @page{size:A4 landscape;margin:10mm}
  body{background:#fff}
  .noprint,.global-nav{display:none!important}
  .rc-lay{display:block;padding:0;max-width:none}
  .rc-doc{border:0;padding:0;box-shadow:none}
  .rc-card{border:1px solid #e2e8f0;box-shadow:none;page-break-inside:avoid}
  .rc-kpi-v{font-size:22px}
  .rc-tbl{font-size:11px}
  .rc-comments{max-height:none}
}
`;
