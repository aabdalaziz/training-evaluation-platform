'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import {
  ATTENDANCE, DIFFICULTIES, SCALE, STATEMENTS, SURVEY_INTRO, SURVEY_TITLE, UI,
  buildPayload, classroomLabel, classroomsFor, emptyDraft, levelLabel, levelsForProgram,
  remotePrograms, resolveLevelId, scheduleLabel, schedulesFor, t, toggleDifficulty, trainersFor, validateDraft,
  type Classroom, type Draft, type Lang, type Level, type Program, type Schedule, type Trainer,
  type ValidationError,
} from '../../../lib/surveys/remoteLearning';

/* ----------------------------------------------------------------------------
 * Bilingual label: primary language first (bold), secondary below (muted)
 * ------------------------------------------------------------------------- */
function Bi({ ar, en, lang, required, as = 'span' }: { ar: string; en: string; lang: Lang; required?: boolean; as?: 'span' | 'h2' }) {
  const primary = lang === 'ar' ? ar : en;
  const secondary = lang === 'ar' ? en : ar;
  const Tag = as;
  return (
    <Tag className={as === 'h2' ? 'rs-h2' : 'rs-bi'}>
      <span className="rs-primary" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {primary}{required && <span className="rs-req"> *</span>}
      </span>
      <span className="rs-secondary" dir={lang === 'ar' ? 'ltr' : 'rtl'}>{secondary}</span>
    </Tag>
  );
}

export default function RemoteLearningSurveyPage() {
  return (
    <Suspense fallback={<main className="rs-center">…</main>}>
      <SurveyForm />
    </Suspense>
  );
}

function SurveyForm() {
  const db = supabase();
  const params = useSearchParams();

  const [lang, setLang] = useState<Lang>(() => (params.get('lang') === 'en' ? 'en' : 'ar'));
  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  const [programs, setPrograms] = useState<Program[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [done, setDone] = useState(false);

  /* ---------------- load lookups ---------------- */
  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [p, l, tr, c, s] = await Promise.all([
          db.from('programs').select('id,name_ar,name_en,delivery_mode,status').order('name_ar'),
          db.from('program_levels').select('id,program_id,code,name_ar,name_en,sort_order,is_active').eq('is_active', true),
          db.from('trainers').select('id,name').order('name'),
          db.from('classrooms').select('id,code,program_id,trainer_id,level_id,level,section_name,delivery_mode').order('code'),
          db.from('class_schedules').select('id,classroom_id,day_of_week,start_time,end_time,is_active').eq('is_active', true),
        ]);
        if (!on) return;
        const firstError = [p, l, tr, c, s].find(r => r.error)?.error;
        if (firstError) throw firstError;

        const progs = remotePrograms((p.data || []) as Program[]).filter(x => x.status !== 'CANCELLED');
        setPrograms(progs);
        setLevels((l.data || []) as Level[]);
        setTrainers((tr.data || []) as Trainer[]);
        setClassrooms((c.data || []) as Classroom[]);
        setSchedules((s.data || []) as Schedule[]);

        // Pre-fill from a QR / shared link: ?classroom=…&schedule=…&date=…
        const qClassroom = params.get('classroom') || '';
        const qSchedule = params.get('schedule') || '';
        const qDate = params.get('date') || '';
        const qProgram = params.get('program') || '';
        const cls = (c.data || []).find((x: Classroom) => x.id === qClassroom) as Classroom | undefined;
        setDraft(d => ({
          ...d,
          programId: cls?.program_id || (progs.some(x => x.id === qProgram) ? qProgram : (progs.length === 1 ? progs[0].id : '')),
          levelId: cls ? (resolveLevelId(cls, (l.data || []) as Level[]) || '') : '',
          trainerId: cls?.trainer_id || '',
          classroomId: cls?.id || '',
          scheduleId: qSchedule,
          lectureDate: /^\d{4}-\d{2}-\d{2}$/.test(qDate) ? qDate : '',
        }));
        setLoading(false);
      } catch (e) {
        if (on) { setLoadError(t(UI.errorLoad, lang)); setLoading(false); }
      }
    })();
    return () => { on = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- cascading option lists ---------------- */
  const levelOptions = useMemo(() => levelsForProgram(levels, draft.programId), [levels, draft.programId]);
  const trainerOptions = useMemo(
    () => trainersFor(trainers, classrooms, { programId: draft.programId, levelId: draft.levelId }, levels),
    [trainers, classrooms, levels, draft.programId, draft.levelId],
  );
  const groupOptions = useMemo(
    () => classroomsFor(classrooms, { programId: draft.programId, levelId: draft.levelId, trainerId: draft.trainerId }, levels),
    [classrooms, levels, draft.programId, draft.levelId, draft.trainerId],
  );
  const scheduleOptions = useMemo(() => schedulesFor(schedules, draft.classroomId), [schedules, draft.classroomId]);

  // auto-select the only schedule
  useEffect(() => {
    if (scheduleOptions.length === 1 && draft.scheduleId !== scheduleOptions[0].id) {
      setDraft(d => ({ ...d, scheduleId: scheduleOptions[0].id }));
    }
  }, [scheduleOptions, draft.scheduleId]);

  const upd = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
  const onProgram = (v: string) => upd({ programId: v, levelId: '', trainerId: '', classroomId: '', scheduleId: '' });
  const onLevel = (v: string) => upd({ levelId: v, trainerId: '', classroomId: '', scheduleId: '' });
  const onTrainer = (v: string) => upd({ trainerId: v, classroomId: '', scheduleId: '' });
  const onGroup = (v: string) => {
    const c = classrooms.find(x => x.id === v);
    upd({ classroomId: v, scheduleId: '', levelId: (c && resolveLevelId(c, levels)) || draft.levelId, trainerId: c?.trainer_id || draft.trainerId });
  };

  const hasError = (field: string) => errors.some(e => e.field === field);

  /* ---------------- submit ---------------- */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaveError('');
    const errs = validateDraft(draft, { schedules });
    setErrors(errs);
    if (errs.length) {
      document.getElementById('rs-errors')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload(draft, { programs, levels, trainers, classrooms, schedules, lang });
      const { error } = await db.from('remote_learning_survey_responses').insert(payload);
      if (error) throw error;
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setSaveError((lang === 'ar' ? 'تعذر الإرسال: ' : 'Could not submit: ') + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- render ---------------- */
  if (loading) return (<main className="rs-center" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />{t(UI.loading, lang)}</main>);

  if (done) return (
    <main className="rs-wrap" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="rs-card rs-thanks">
        <div className="rs-thanks-icon">✅</div>
        <h1><Bi ar={UI.thanksTitle.ar} en={UI.thanksTitle.en} lang={lang} /></h1>
        <p><Bi ar={UI.thanksBody.ar} en={UI.thanksBody.en} lang={lang} /></p>
      </section>
    </main>
  );

  return (
    <main className="rs-wrap" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="rs-header">
        <div className="rs-badge">💻 Microsoft Teams</div>
        <h1 className="rs-title">
          <span dir="rtl">{SURVEY_TITLE.ar}</span>
          <span dir="ltr" className="rs-title-en">{SURVEY_TITLE.en}</span>
        </h1>
        <button type="button" className="rs-lang" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
          🌐 {t(UI.langToggle, lang)}
        </button>
      </header>

      {loadError && <div className="rs-alert rs-alert-err">{loadError}</div>}

      <section className="rs-card rs-intro">
        <p dir="rtl" className={lang === 'ar' ? 'rs-primary' : 'rs-secondary'}>{SURVEY_INTRO.ar}</p>
        <p dir="ltr" className={lang === 'en' ? 'rs-primary' : 'rs-secondary'}>{SURVEY_INTRO.en}</p>
        <div className="rs-anon">🔒 <Bi ar={UI.anonymous.ar} en={UI.anonymous.en} lang={lang} /></div>
      </section>

      <form onSubmit={submit} noValidate>
        <p className="rs-hint"><Bi ar={UI.required.ar} en={UI.required.en} lang={lang} /></p>

        {(errors.length > 0 || saveError) && (
          <div id="rs-errors" className="rs-alert rs-alert-err">
            {saveError ? <div>{saveError}</div> : (
              <>
                <b><Bi ar={UI.fixErrors.ar} en={UI.fixErrors.en} lang={lang} /></b>
                <ul>{errors.map((er, i) => <li key={i}><Bi ar={er.ar} en={er.en} lang={lang} /></li>)}</ul>
              </>
            )}
          </div>
        )}

        {/* ================= Group & class information ================= */}
        <section className="rs-card">
          <Bi as="h2" ar={UI.sectionGroup.ar} en={UI.sectionGroup.en} lang={lang} />
          <div className="rs-grid">
            {programs.length !== 1 && (
              <label className={`rs-field ${hasError('programId') ? 'rs-invalid' : ''}`}>
                <Bi ar={UI.program.ar} en={UI.program.en} lang={lang} required />
                <select value={draft.programId} onChange={e => onProgram(e.target.value)}>
                  <option value="">{t(UI.choose, lang)}</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
                </select>
              </label>
            )}

            <label className={`rs-field ${hasError('levelId') ? 'rs-invalid' : ''}`}>
              <Bi ar={UI.level.ar} en={UI.level.en} lang={lang} required />
              <select value={draft.levelId} onChange={e => onLevel(e.target.value)} disabled={!draft.programId}>
                <option value="">{t(UI.choose, lang)}</option>
                {levelOptions.map(l => <option key={l.id} value={l.id}>{levelLabel(l, lang)}</option>)}
              </select>
            </label>

            <label className={`rs-field ${hasError('trainerId') ? 'rs-invalid' : ''}`}>
              <Bi ar={UI.trainer.ar} en={UI.trainer.en} lang={lang} required />
              <select value={draft.trainerId} onChange={e => onTrainer(e.target.value)} disabled={!draft.levelId}>
                <option value="">{t(UI.choose, lang)}</option>
                {trainerOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>

            <label className={`rs-field ${hasError('classroomId') ? 'rs-invalid' : ''}`}>
              <Bi ar={UI.group.ar} en={UI.group.en} lang={lang} required />
              <select value={draft.classroomId} onChange={e => onGroup(e.target.value)} disabled={!draft.trainerId}>
                <option value="">{t(UI.choose, lang)}</option>
                {groupOptions.map(c => <option key={c.id} value={c.id}>{classroomLabel(c, { trainers, levels }, lang)}</option>)}
              </select>
              {draft.trainerId && groupOptions.length === 0 && <small className="rs-warn">{t(UI.noGroups, lang)}</small>}
            </label>

            <label className={`rs-field ${hasError('scheduleId') ? 'rs-invalid' : ''}`}>
              <Bi ar={UI.schedule.ar} en={UI.schedule.en} lang={lang} required={scheduleOptions.length > 0} />
              <select value={draft.scheduleId} onChange={e => upd({ scheduleId: e.target.value })} disabled={!draft.classroomId || scheduleOptions.length === 0}>
                <option value="">{scheduleOptions.length === 0 && draft.classroomId ? '—' : t(UI.choose, lang)}</option>
                {scheduleOptions.map(s => <option key={s.id} value={s.id}>{scheduleLabel(s, lang)}</option>)}
              </select>
            </label>

            <label className={`rs-field ${hasError('lectureDate') ? 'rs-invalid' : ''}`}>
              <Bi ar={UI.lectureDate.ar} en={UI.lectureDate.en} lang={lang} />
              <input type="date" value={draft.lectureDate} onChange={e => upd({ lectureDate: e.target.value })} />
            </label>
          </div>
        </section>

        {/* ================= General questions ================= */}
        <section className="rs-card">
          <Bi as="h2" ar={UI.sectionChoice.ar} en={UI.sectionChoice.en} lang={lang} />

          <div className={`rs-q ${hasError('selfLevelId') ? 'rs-invalid' : ''}`}>
            <Bi ar={UI.selfLevel.ar} en={UI.selfLevel.en} lang={lang} required />
            <div className="rs-pills">
              {levelOptions.map(l => (
                <button key={l.id} type="button" className={`rs-pill ${draft.selfLevelId === l.id ? 'on' : ''}`} onClick={() => upd({ selfLevelId: l.id })}>
                  {levelLabel(l, lang)}
                </button>
              ))}
              <button type="button" className={`rs-pill ${draft.selfLevelId === 'unknown' ? 'on' : ''}`} onClick={() => upd({ selfLevelId: 'unknown' })}>
                {UI.notSure.ar} | {UI.notSure.en}
              </button>
            </div>
          </div>

          <div className={`rs-q ${hasError('attendance') ? 'rs-invalid' : ''}`}>
            <Bi ar={UI.attendance.ar} en={UI.attendance.en} lang={lang} required />
            <div className="rs-pills">
              {ATTENDANCE.map(a => (
                <button key={a.code} type="button" className={`rs-pill ${draft.attendance === a.code ? 'on' : ''}`} onClick={() => upd({ attendance: a.code })}>
                  <Bi ar={a.ar} en={a.en} lang={lang} />
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ================= Rating statements ================= */}
        <section className={`rs-card ${hasError('ratings') ? 'rs-invalid' : ''}`}>
          <Bi as="h2" ar={UI.sectionRating.ar} en={UI.sectionRating.en} lang={lang} />
          <p className="rs-hint"><Bi ar={UI.ratingHint.ar} en={UI.ratingHint.en} lang={lang} /></p>

          {STATEMENTS.map((s, i) => {
            const answered = !!draft.ratings[s.key];
            return (
              <div key={s.key} className={`rs-q rs-statement ${errors.length && !answered ? 'rs-invalid' : ''}`}>
                <div className="rs-num">{i + 1}</div>
                <div className="rs-statement-body">
                  <Bi ar={s.ar} en={s.en} lang={lang} required />
                  <div className="rs-scale">
                    {SCALE.map(sc => (
                      <button
                        key={sc.code} type="button"
                        className={`rs-scale-btn ${draft.ratings[s.key] === sc.code ? 'on' : ''} ${sc.code === 'NA' ? 'na' : ''}`}
                        onClick={() => upd({ ratings: { ...draft.ratings, [s.key]: sc.code } })}
                        aria-pressed={draft.ratings[s.key] === sc.code}
                      >
                        <span dir="rtl">{sc.ar}</span>
                        <span dir="ltr" className="rs-scale-en">{sc.en}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* ================= Difficulties ================= */}
        <section className={`rs-card ${hasError('difficulties') ? 'rs-invalid' : ''}`}>
          <Bi as="h2" ar={UI.sectionDiff.ar} en={UI.sectionDiff.en} lang={lang} />
          <div className="rs-q">
            <Bi ar={UI.difficulties.ar} en={UI.difficulties.en} lang={lang} required />
            <div className="rs-checks">
              {DIFFICULTIES.map(d => {
                const on = draft.difficulties.includes(d.code);
                return (
                  <button key={d.code} type="button" className={`rs-check ${on ? 'on' : ''}`} onClick={() => upd({ difficulties: toggleDifficulty(draft.difficulties, d.code) })} aria-pressed={on}>
                    <span className="rs-box">{on ? '✓' : ''}</span>
                    <Bi ar={d.ar} en={d.en} lang={lang} />
                  </button>
                );
              })}
            </div>
            {draft.difficulties.includes('other') && (
              <label className="rs-field" style={{ marginTop: 12 }}>
                <Bi ar={UI.otherText.ar} en={UI.otherText.en} lang={lang} />
                <input value={draft.difficultyOther} maxLength={300} onChange={e => upd({ difficultyOther: e.target.value })} />
              </label>
            )}
          </div>
        </section>

        {/* ================= Open questions ================= */}
        <section className="rs-card">
          <Bi as="h2" ar={UI.sectionOpen.ar} en={UI.sectionOpen.en} lang={lang} />
          <label className="rs-field">
            <Bi ar={UI.likedMost.ar} en={UI.likedMost.en} lang={lang} />
            <textarea rows={3} maxLength={1000} value={draft.likedMost} onChange={e => upd({ likedMost: e.target.value })} />
          </label>
          <label className="rs-field">
            <Bi ar={UI.suggestion.ar} en={UI.suggestion.en} lang={lang} />
            <textarea rows={3} maxLength={1000} value={draft.suggestion} onChange={e => upd({ suggestion: e.target.value })} />
          </label>
        </section>

        <button type="submit" className="rs-submit" disabled={saving}>
          {saving ? t(UI.submitting, lang) : <Bi ar={UI.submit.ar} en={UI.submit.en} lang={lang} />}
        </button>
      </form>
    </main>
  );
}

/* ----------------------------------------------------------------------------
 * Styles (responsive, RTL/LTR aware via logical properties)
 * ------------------------------------------------------------------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
.rs-wrap{max-width:860px;margin:0 auto;padding:20px 16px 60px;font-family:Tajawal,Cairo,Arial,sans-serif;color:#0f172a;}
.rs-center{min-height:60vh;display:flex;align-items:center;justify-content:center;color:#64748b;font-family:Tajawal,Arial,sans-serif;font-weight:700;}
.rs-header{text-align:center;margin-bottom:18px;position:relative;}
.rs-badge{display:inline-block;background:#ede9fe;color:#6d28d9;font-weight:800;font-size:12px;padding:4px 12px;border-radius:999px;margin-bottom:10px;}
.rs-title{margin:0;font-size:22px;font-weight:900;color:#14466B;display:flex;flex-direction:column;gap:4px;}
.rs-title-en{font-size:15px;color:#64748b;font-weight:700;}
.rs-lang{margin-top:12px;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:800;color:#14466B;cursor:pointer;}
.rs-lang:hover{background:#f1f5f9;}
.rs-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:22px;margin-bottom:18px;box-shadow:0 6px 20px rgba(15,23,42,.04);}
.rs-card.rs-invalid{border-color:#fca5a5;}
.rs-intro p{margin:0 0 10px;line-height:1.9;font-size:15px;}
.rs-anon{margin-top:8px;padding:10px 12px;background:#f0fdf4;border-radius:10px;color:#166534;font-size:13px;font-weight:700;}
.rs-h2{display:flex;flex-direction:column;gap:2px;margin:0 0 16px;padding-bottom:10px;border-bottom:2px solid #0d9488;}
.rs-h2 .rs-primary{font-size:18px;font-weight:900;color:#14466B;}
.rs-bi{display:flex;flex-direction:column;gap:2px;}
.rs-primary{font-weight:800;font-size:15px;line-height:1.6;}
.rs-secondary{font-weight:600;font-size:13px;color:#64748b;line-height:1.5;}
.rs-req{color:#ef4444;}
.rs-hint{color:#64748b;font-size:13px;margin:0 0 14px;}
.rs-alert{padding:14px 16px;border-radius:12px;margin-bottom:16px;font-weight:700;line-height:1.7;}
.rs-alert-err{background:#fee2e2;color:#b91c1c;border:1px solid #fecaca;}
.rs-alert ul{margin:8px 0 0;padding-inline-start:20px;}
.rs-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.rs-field{display:flex;flex-direction:column;gap:6px;}
.rs-field select,.rs-field input,.rs-field textarea{width:100%;padding:11px 12px;border:1px solid #cbd5e1;border-radius:10px;font:inherit;font-weight:700;background:#fff;color:#0f172a;outline:none;box-sizing:border-box;}
.rs-field select:disabled{background:#f1f5f9;color:#94a3b8;}
.rs-field select:focus,.rs-field input:focus,.rs-field textarea:focus{border-color:#0d9488;box-shadow:0 0 0 3px rgba(13,148,136,.15);}
.rs-field.rs-invalid select,.rs-field.rs-invalid input{border-color:#ef4444;background:#fff7f7;}
.rs-warn{color:#b45309;font-weight:700;font-size:12px;}
.rs-q{padding:14px 0;border-bottom:1px solid #f1f5f9;}
.rs-q:last-child{border-bottom:0;}
.rs-q.rs-invalid{background:#fff7f7;border-radius:10px;padding-inline:10px;}
.rs-pills,.rs-checks{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.rs-pill{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;color:#475569;cursor:pointer;text-align:start;}
.rs-pill .rs-primary{font-size:13px;} .rs-pill .rs-secondary{font-size:11px;}
.rs-pill.on{border:2px solid #2563eb;background:#eff6ff;color:#1d4ed8;}
.rs-check{display:flex;align-items:center;gap:10px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:10px 12px;font:inherit;cursor:pointer;text-align:start;flex:1 1 calc(50% - 8px);min-width:220px;color:#475569;}
.rs-check .rs-primary{font-size:13px;} .rs-check .rs-secondary{font-size:11px;}
.rs-check.on{border:2px solid #0d9488;background:#f0fdfa;color:#0f766e;}
.rs-box{width:22px;height:22px;border-radius:6px;border:2px solid #94a3b8;display:flex;align-items:center;justify-content:center;font-weight:900;flex-shrink:0;}
.rs-check.on .rs-box{border-color:#0d9488;background:#0d9488;color:#fff;}
.rs-statement{display:flex;gap:12px;align-items:flex-start;}
.rs-num{width:30px;height:30px;border-radius:50%;background:#14466B;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;flex-shrink:0;margin-top:2px;}
.rs-statement-body{flex:1;min-width:0;}
.rs-scale{display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-top:10px;}
.rs-scale-btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 4px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;color:#475569;min-height:58px;}
.rs-scale-btn span:first-child{font-weight:800;font-size:12px;line-height:1.3;text-align:center;}
.rs-scale-en{font-size:10px;color:#94a3b8;line-height:1.2;text-align:center;}
.rs-scale-btn.on{border:2px solid #10b981;background:#d1fae5;color:#047857;}
.rs-scale-btn.on .rs-scale-en{color:#047857;}
.rs-scale-btn.na{background:#f8fafc;}
.rs-scale-btn.na.on{border-color:#64748b;background:#e2e8f0;color:#334155;}
.rs-submit{width:100%;border:0;border-radius:14px;padding:16px;background:linear-gradient(135deg,#00897B,#1FA39A);color:#fff;font:inherit;font-weight:900;font-size:16px;cursor:pointer;box-shadow:0 10px 24px rgba(0,137,123,.25);}
.rs-submit .rs-primary,.rs-submit .rs-secondary{color:#fff;}
.rs-submit:disabled{opacity:.7;cursor:wait;}
.rs-thanks{text-align:center;padding:40px 24px;border-top:8px solid #10b981;}
.rs-thanks-icon{font-size:64px;margin-bottom:10px;}
.rs-thanks h1{margin:0 0 10px;color:#047857;} .rs-thanks h1 .rs-primary{font-size:26px;}
.rs-thanks p{margin:0;color:#475569;}
@media(max-width:700px){
  .rs-grid{grid-template-columns:1fr;}
  .rs-scale{grid-template-columns:repeat(3,1fr);}
  .rs-check{flex-basis:100%;}
  .rs-card{padding:16px;}
  .rs-title{font-size:18px;}
}
`;
