'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { Icon } from '../../../lib/ui/icons';
import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ك «عدّة الغرفة» */
import {
  ATTENDANCE, DAYS, DIFFICULTIES, SCALE, STATEMENTS, UI,
  applyFilters, classroomLabel, compareGroups, formatRiyadh, levelLabel, responsesToCsvRows,
  scheduleLabel, summarize, summaryToCsvRows, t,
  type Classroom, type Lang, type Level, type Program, type ReportFilters, type ResponseRow,
  type Schedule, type Trainer,
} from '../../../lib/surveys/remoteLearning';

const NAVY = '#3A1F36', TEAL = '#D4614A', RED = '#D4614A', AMBER = '#8A5A1E', GREEN = '#3F7F79';

export default function RemoteSurveyReportPage() {
  const router = useRouter();
  const db = supabase();

  const [lang, setLang] = useState<Lang>('ar');
  const ar = lang === 'ar';
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [rows, setRows] = useState<ResponseRow[]>([]);

  const [f, setF] = useState<ReportFilters>({ programId: '', levelId: '', trainerId: '', classroomId: '', dayOfWeek: '', scheduleId: '', dateFrom: '', dateTo: '' });

  async function loadAll() {
    const [p, l, tr, c, s, r] = await Promise.all([
      db.from('programs').select('id,name_ar,name_en,delivery_mode,status').order('name_ar'),
      db.from('program_levels').select('id,program_id,code,name_ar,name_en,sort_order,is_active').order('sort_order'),
      db.from('trainers').select('id,name').order('name'),
      db.from('classrooms').select('id,code,program_id,trainer_id,level_id,level,section_name,delivery_mode').order('code'),
      db.from('class_schedules').select('id,classroom_id,day_of_week,start_time,end_time,is_active'),
      db.from('remote_learning_survey_responses').select('*').order('submitted_at', { ascending: false }),
    ]);
    const e = [p, l, tr, c, s, r].find(x => x.error)?.error;
    if (e) { setErr(e.message); return; }
    setPrograms((p.data || []) as Program[]);
    setLevels((l.data || []) as Level[]);
    setTrainers((tr.data || []) as Trainer[]);
    setClassrooms((c.data || []) as Classroom[]);
    setSchedules((s.data || []) as Schedule[]);
    setRows((r.data || []) as ResponseRow[]);
  }

  useEffect(() => {
    setMounted(true);
    let on = true;
    (async () => {
      const s = await db.auth.getSession();
      if (!s.data?.session) { router.push('/login'); return; }
      if (on) { await loadAll(); setLoading(false); }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- dependent filter options ---------------- */
  const levelOpts = useMemo(() => levels.filter(l => !f.programId || l.program_id === null || l.program_id === f.programId), [levels, f.programId]);
  const classroomOpts = useMemo(() => classrooms.filter(c =>
    (!f.programId || c.program_id === f.programId) &&
    (!f.levelId || c.level_id === f.levelId) &&
    (!f.trainerId || c.trainer_id === f.trainerId)), [classrooms, f.programId, f.levelId, f.trainerId]);
  const trainerOpts = useMemo(() => {
    const ids = new Set(classrooms.filter(c => (!f.programId || c.program_id === f.programId) && (!f.levelId || c.level_id === f.levelId)).map(c => c.trainer_id));
    return trainers.filter(x => ids.has(x.id));
  }, [trainers, classrooms, f.programId, f.levelId]);
  const scheduleOpts = useMemo(() => schedules.filter(s =>
    (!f.classroomId || s.classroom_id === f.classroomId) &&
    (f.dayOfWeek === '' || f.dayOfWeek === undefined || s.day_of_week === Number(f.dayOfWeek)) &&
    classroomOpts.some(c => c.id === s.classroom_id)), [schedules, classroomOpts, f.classroomId, f.dayOfWeek]);

  const filtered = useMemo(() => applyFilters(rows, f, schedules), [rows, f, schedules]);
  const summary = useMemo(() => summarize(filtered), [filtered]);
  const groups = useMemo(() => compareGroups(filtered, { classrooms, trainers, levels, schedules, lang }), [filtered, classrooms, trainers, levels, schedules, lang]);
  const ctx = { programs, levels, trainers, classrooms, schedules, lang };

  const setFilter = (patch: Partial<ReportFilters>) => setF(x => ({ ...x, ...patch }));
  const reset = () => setF({ programId: '', levelId: '', trainerId: '', classroomId: '', dayOfWeek: '', scheduleId: '', dateFrom: '', dateTo: '' });

  const scheduleOptLabel = (s: Schedule) => {
    const c = classrooms.find(x => x.id === s.classroom_id);
    return `${c ? classroomLabel(c, { trainers, levels }, lang) + ' — ' : ''}${scheduleLabel(s, lang)}`;
  };

  const pctColor = (p: number | null) => p == null ? '#B3A5AE' : p >= 80 ? GREEN : p >= 60 ? AMBER : RED;

  if (!mounted || loading) return (<div className="rr rr-load"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="rr-spin" /></div>);

  return (
    <div className="rr rm-page" style={{ direction: ar ? 'rtl' : 'ltr' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <RoomHead
        title={<>{ar ? 'نتائج استبيان التعلم عن بُعد عبر Teams' : 'Remote Learning (Teams) Survey Results'}</>}
        desc={<><p>{ar ? 'التوقيت: الرياض (Asia/Riyadh) — الإجابات مجهولة الهوية' : 'Time zone: Asia/Riyadh — anonymous responses'}</p></>}
        actions={<>
            <button className="rm-btn" onClick={() => setLang(ar ? 'en' : 'ar')}><Icon name="globe" size={16} /> {ar ? 'English' : 'العربية'}</button>
            <button className="rm-btn" onClick={() => window.print()}><Icon name="print" size={16} /> {ar ? 'طباعة' : 'Print'}</button>
        </>}
      />

      <main className="rr-wrap">
        {err && <div className="rr-err">{err}</div>}

        {/* ================= Filters ================= */}
        <section className="rr-card noprint">
          <div className="rr-filters">
            <label>{ar ? 'البرنامج' : 'Program'}
              <select value={f.programId} onChange={e => setFilter({ programId: e.target.value, levelId: '', trainerId: '', classroomId: '', scheduleId: '' })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {programs.map(p => <option key={p.id} value={p.id}>{ar ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
              </select>
            </label>
            <label>{ar ? 'المستوى' : 'Level'}
              <select value={f.levelId} onChange={e => setFilter({ levelId: e.target.value, trainerId: '', classroomId: '', scheduleId: '' })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {levelOpts.map(l => <option key={l.id} value={l.id}>{levelLabel(l, lang)}</option>)}
              </select>
            </label>
            <label>{ar ? 'المدرّب' : 'Trainer'}
              <select value={f.trainerId} onChange={e => setFilter({ trainerId: e.target.value, classroomId: '', scheduleId: '' })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {trainerOpts.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label>{ar ? 'الشعبة' : 'Group/section'}
              <select value={f.classroomId} onChange={e => setFilter({ classroomId: e.target.value, scheduleId: '' })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {classroomOpts.map(c => <option key={c.id} value={c.id}>{classroomLabel(c, { trainers, levels }, lang)}</option>)}
              </select>
            </label>
            <label>{ar ? 'اليوم' : 'Day'}
              <select value={String(f.dayOfWeek ?? '')} onChange={e => setFilter({ dayOfWeek: e.target.value === '' ? '' : Number(e.target.value), scheduleId: '' })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {DAYS.map(d => <option key={d.v} value={d.v}>{ar ? d.ar : d.en}</option>)}
              </select>
            </label>
            <label>{ar ? 'الموعد' : 'Schedule'}
              <select value={f.scheduleId} onChange={e => setFilter({ scheduleId: e.target.value })}>
                <option value="">{ar ? 'الكل' : 'All'}</option>
                {scheduleOpts.map(s => <option key={s.id} value={s.id}>{scheduleOptLabel(s)}</option>)}
              </select>
            </label>
            <label>{ar ? 'من تاريخ' : 'From date'}<input type="date" value={f.dateFrom} onChange={e => setFilter({ dateFrom: e.target.value })} /></label>
            <label>{ar ? 'إلى تاريخ' : 'To date'}<input type="date" value={f.dateTo} onChange={e => setFilter({ dateTo: e.target.value })} /></label>
          </div>
          <div className="rr-toolbar">
            <button className="rm-btn" onClick={reset}>↺ {ar ? 'إعادة ضبط' : 'Reset'}</button>
            <button className="rm-btn" onClick={() => loadAll()}>🔄 {ar ? 'تحديث' : 'Refresh'}</button>
            <span style={{ flex: 1 }} />
            <button className="rm-btn primary" disabled={!filtered.length} onClick={() => downloadCSV(safeFilename('RemoteSurvey_Responses'), responsesToCsvRows(filtered, ctx))}>⬇️ CSV — {ar ? 'الإجابات' : 'Responses'}</button>
            <button className="rm-btn primary" disabled={!filtered.length} onClick={() => downloadCSV(safeFilename('RemoteSurvey_Summary'), summaryToCsvRows(summary, lang))}>⬇️ CSV — {ar ? 'الملخص' : 'Summary'}</button>
          </div>
        </section>

        {/* ================= KPIs ================= */}
        <section className="rr-kpis">
          <Kpi title={ar ? 'عدد الإجابات' : 'Responses'} value={summary.count} color={NAVY} icon="🧾" />
          <Kpi title={ar ? 'متوسط الموافقة (1–5)' : 'Average agreement (1–5)'} value={summary.overallAvg ?? '—'} color={TEAL} icon="⭐" />
          <Kpi title={ar ? 'نسبة الموافقة العامة' : 'Overall agree %'} value={summary.overallAgreePct == null ? '—' : `${summary.overallAgreePct}%`} color={pctColor(summary.overallAgreePct)} icon="👍" />
          <Kpi title={ar ? 'الرضا عن التجربة' : 'Satisfied with experience'} value={summary.satisfactionAgreePct == null ? '—' : `${summary.satisfactionAgreePct}%`} color={pctColor(summary.satisfactionAgreePct)} icon="😊" />
          <Kpi title={ar ? 'عدد الشُّعب' : 'Groups'} value={groups.length} color="#8E4A68" icon="🧩" />
        </section>

        {/* ================= Group comparison ================= */}
        <section className="rr-card">
          <h3>🧩 {ar ? 'مقارنة بين المجموعات' : 'Group comparison'} <span className="rr-muted">{ar ? '(كل مجموعة/موعد في سطر مستقل حتى لو تطابق التوقيت)' : '(each group/schedule on its own row, even with identical times)'}</span></h3>
          <div className="rr-tw">
            <table>
              <thead><tr>
                <th>{ar ? 'المجموعة — الموعد' : 'Group — schedule'}</th>
                <th>{ar ? 'الإجابات' : 'Responses'}</th>
                <th>{ar ? 'المتوسط' : 'Average'}</th>
                <th>{ar ? 'الموافقة %' : 'Agree %'}</th>
                <th>{ar ? 'الرضا %' : 'Satisfaction %'}</th>
                <th></th>
              </tr></thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.key}>
                    <td><b>{g.label}</b></td>
                    <td dir="ltr">{g.n}</td>
                    <td dir="ltr">{g.avg ?? '—'}</td>
                    <td><Bar pct={g.agreePct} color={pctColor(g.agreePct)} /></td>
                    <td><Bar pct={g.satisfactionAgreePct} color={pctColor(g.satisfactionAgreePct)} /></td>
                    <td className="noprint">{g.classroom_id && <button className="rr-mini" onClick={() => setFilter({ classroomId: g.classroom_id || '', scheduleId: g.schedule_id || '' })}>{ar ? 'تصفية' : 'Filter'}</button>}</td>
                  </tr>
                ))}
                {!groups.length && <tr><td colSpan={6} className="rr-empty">{ar ? 'لا توجد إجابات مطابقة' : 'No matching responses'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================= Per statement ================= */}
        <section className="rr-card">
          <h3>📋 {ar ? 'نتائج العبارات' : 'Statement results'}</h3>
          <div className="rr-tw">
            <table>
              <thead><tr>
                <th>#</th><th>{ar ? 'العبارة' : 'Statement'}</th><th>{ar ? 'ن' : 'n'}</th><th>{ar ? 'المتوسط' : 'Avg'}</th><th>{ar ? 'الموافقة %' : 'Agree %'}</th><th>{ar ? 'التوزيع' : 'Distribution'}</th>
              </tr></thead>
              <tbody>
                {summary.statements.map((st, i) => {
                  const def = STATEMENTS[i];
                  const total = SCALE.reduce((a, s) => a + st.dist[s.code], 0) || 1;
                  return (
                    <tr key={st.key}>
                      <td dir="ltr">{i + 1}</td>
                      <td><div style={{ fontWeight: 800 }}>{def.ar}</div><div className="rr-muted" dir="ltr">{def.en}</div></td>
                      <td dir="ltr">{st.n}{st.naCount ? <span className="rr-muted"> (+{st.naCount} N/A)</span> : null}</td>
                      <td dir="ltr"><b style={{ color: st.avg == null ? '#B3A5AE' : st.avg >= 4 ? GREEN : st.avg >= 3 ? AMBER : RED }}>{st.avg ?? '—'}</b></td>
                      <td><Bar pct={st.agreePct} color={pctColor(st.agreePct)} /></td>
                      <td>
                        <div className="rr-dist" title={SCALE.map(s => `${ar ? s.ar : s.en}: ${st.dist[s.code]}`).join(' | ')}>
                          {SCALE.map(s => st.dist[s.code] > 0 && (
                            <span key={s.code} className={`rr-seg rr-seg-${s.code}`} style={{ width: `${(st.dist[s.code] / total) * 100}%` }}>{st.dist[s.code]}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="rr-legend">{SCALE.map(s => <span key={s.code}><i className={`rr-seg-${s.code}`} /> {ar ? s.ar : s.en}</span>)}</div>
        </section>

        {/* ================= Attendance / self level / difficulties ================= */}
        <section className="rr-grid3">
          <div className="rr-card">
            <h3>🗓️ {ar ? 'الحضور' : 'Attendance'}</h3>
            {ATTENDANCE.map(a => <Row key={a.code} label={ar ? a.ar : a.en} n={summary.attendance[a.code]} total={summary.count} color={TEAL} />)}
          </div>
          <div className="rr-card">
            <h3>🎚️ {ar ? 'المستوى (برأي الطالب)' : 'Self-reported level'}</h3>
            {Object.entries(summary.selfLevels).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
              <Row key={k} label={k === 'unknown' ? t(UI.notSure, lang) : levelLabel(levels.find(l => l.id === k), lang) || k} n={n} total={summary.count} color="#8E4A68" />
            ))}
            {!Object.keys(summary.selfLevels).length && <div className="rr-empty">—</div>}
          </div>
          <div className="rr-card">
            <h3>⚠️ {ar ? 'الصعوبات' : 'Difficulties'}</h3>
            {DIFFICULTIES.map(d => <Row key={d.code} label={ar ? d.ar : d.en} n={summary.difficulties[d.code]} total={summary.count} color={d.code === 'none' ? GREEN : RED} />)}
          </div>
        </section>

        {/* ================= Open comments ================= */}
        <section className="rr-card">
          <h3>💬 {ar ? 'التعليقات المفتوحة' : 'Open comments'} <span className="rr-muted">({filtered.filter(r => r.liked_most || r.suggestion || r.difficulty_other).length})</span></h3>
          <div className="rr-tw">
            <table>
              <thead><tr><th>{ar ? 'الوقت' : 'Time'}</th><th>{ar ? 'المجموعة' : 'Group'}</th><th>{ar ? 'أكثر ما أعجبه' : 'Liked most'}</th><th>{ar ? 'اقتراح' : 'Suggestion'}</th><th>{ar ? 'صعوبة أخرى' : 'Other difficulty'}</th></tr></thead>
              <tbody>
                {filtered.filter(r => r.liked_most || r.suggestion || r.difficulty_other).slice(0, 300).map(r => {
                  const c = classrooms.find(x => x.id === r.classroom_id);
                  return (
                    <tr key={r.id}>
                      <td dir="ltr" className="rr-muted">{formatRiyadh(r.submitted_at, lang)}</td>
                      <td>{c ? classroomLabel(c, { trainers, levels }, lang) : (r.classroom_code_snapshot || '—')}</td>
                      <td>{r.liked_most || ''}</td>
                      <td>{r.suggestion || ''}</td>
                      <td>{r.difficulty_other || ''}</td>
                    </tr>
                  );
                })}
                {!filtered.some(r => r.liked_most || r.suggestion || r.difficulty_other) && <tr><td colSpan={5} className="rr-empty">{ar ? 'لا توجد تعليقات' : 'No comments'}</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Kpi({ title, value, color, icon }: { title: string; value: string | number; color: string; icon: string }) {
  return (
    <div className="rr-kpi" style={{ borderTopColor: color }}>
      <div className="rr-kpi-icon">{icon}</div>
      <div className="rr-kpi-val" style={{ color }} dir="ltr">{value}</div>
      <div className="rr-kpi-ttl">{title}</div>
    </div>
  );
}
function Bar({ pct, color }: { pct: number | null; color: string }) {
  if (pct == null) return <span className="rr-muted">—</span>;
  return (
    <div className="rr-bar"><div className="rr-bar-fill" style={{ width: `${Math.min(100, pct)}%`, background: color }} /><span dir="ltr">{pct}%</span></div>
  );
}
function Row({ label, n, total, color }: { label: string; n: number; total: number; color: string }) {
  const pct = total ? Math.round((n / total) * 100) : 0;
  return (
    <div className="rr-row">
      <div className="rr-row-top"><span>{label}</span><b dir="ltr">{n} ({pct}%)</b></div>
      <div className="rr-row-bar"><div style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}

const CSS = `
*{box-sizing:border-box;}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.rr{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626;}
.rr-load{display:flex;align-items:center;justify-content:center;background:#3A1F36;}
.rr-spin{width:64px;height:64px;border:6px solid rgba(255,255,255,.14);border-top-color:#3F7F79;border-radius:50%;animation:spin 1s linear infinite;}


 


.rr-wrap{max-width:1240px;margin:20px auto 0;padding:0 28px;}
.rr-err{background:#FBEDE7;color:#B9544A;border:1px solid #F3C4B6;border-radius:12px;padding:12px 16px;font-weight:800;margin-bottom:16px;}
.rr-card{background:#fff;border:1px solid #EADFD6;border-radius:22px;padding:22px;box-shadow:0 8px 28px rgba(42,22,38,.04);margin-bottom:18px;}
.rr-card h3{margin:0 0 14px;font-size:18px;font-weight:900;color:#3A1F36;}
.rr-muted{color:#8E7F8A;font-weight:600;font-size:12px;}
.rr-filters{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.rr-filters label{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:800;color:#5C4858;}
.rr-filters select,.rr-filters input{border:1px solid #D9CBC2;border-radius:10px;padding:9px 10px;font-family:inherit;font-weight:700;background:#fff;color:#2A1626;}
.rr-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center;}
.rr-mini{border:1px solid #D9CBC2;background:#fff;border-radius:8px;padding:5px 10px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;color:#3A1F36;}
.rr-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-bottom:18px;}
.rr-kpi{background:#fff;border:1px solid #EADFD6;border-top:5px solid;border-radius:18px;padding:16px;text-align:center;}
.rr-kpi-icon{font-size:22px;} .rr-kpi-val{font-size:30px;font-weight:900;margin:4px 0;} .rr-kpi-ttl{font-size:12px;font-weight:800;color:#8E7F8A;}
.rr-tw{overflow-x:auto;} table{width:100%;border-collapse:collapse;min-width:640px;}
th{padding:11px;font-weight:900;font-size:12px;color:#8E7F8A;border-bottom:2px solid #EADFD6;text-align:start;}
td{padding:11px;font-size:13.5px;border-bottom:1px solid #F6EBE0;font-weight:700;vertical-align:middle;}
.rr-empty{color:#B3A5AE;text-align:center;font-weight:800;padding:16px;}
.rr-bar{position:relative;height:22px;background:#F6EBE0;border-radius:6px;min-width:110px;overflow:hidden;}
.rr-bar-fill{position:absolute;inset:0 auto 0 0;border-radius:6px;}
[dir=rtl] .rr-bar-fill{inset:0 0 0 auto;}
.rr-bar span{position:relative;display:block;text-align:center;font-size:12px;font-weight:900;line-height:22px;color:#2A1626;}
.rr-dist{display:flex;height:20px;border-radius:6px;overflow:hidden;min-width:160px;background:#F6EBE0;}
.rr-seg{display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#fff;min-width:14px;}
.rr-seg-SA{background:#2F6B66;} .rr-seg-A{background:#5EA8A0;color:#1F4F4A;} .rr-seg-N{background:#D9A866;color:#5C3B12;} .rr-seg-D{background:#D9A866;} .rr-seg-SD{background:#D4614A;} .rr-seg-NA{background:#B3A5AE;}
.rr-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;font-size:12px;font-weight:800;color:#5C4858;}
.rr-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:middle;}
.rr-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
.rr-row{margin-bottom:10px;} .rr-row-top{display:flex;justify-content:space-between;font-size:13px;font-weight:800;margin-bottom:4px;}
.rr-row-bar{height:8px;background:#F6EBE0;border-radius:4px;overflow:hidden;} .rr-row-bar div{height:100%;border-radius:4px;}
@media(max-width:1000px){.rr-kpis{grid-template-columns:repeat(2,1fr);}.rr-filters{grid-template-columns:1fr 1fr;}.rr-grid3{grid-template-columns:1fr;}}
@media(max-width:600px){.rr-filters{grid-template-columns:1fr;}.rr-kpis{grid-template-columns:1fr;}}
@media print{.noprint{display:none !important;}.rr{background:#fff;}.rr-card{box-shadow:none;break-inside:avoid;}}
`;
