'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { FlowShell, Stations, StepCard, FlowNav, useStepScroll, type Station, type StationState } from '../../components/StepFlow'; /* هـ-3 ن «محطّات» */
import { Icon } from '../../../lib/ui/icons';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { resolveOpenLang } from '../../../lib/evaluation/links';
import { markDone, onceMessage, ONCE_SHARED, ONCE_TITLE, wasDone } from '../../../lib/evaluation/once';
import {
  ATTENDANCE, DIFFICULTIES, SCALE, STATEMENTS, STATEMENT_AXES, SURVEY_INTRO, SURVEY_TITLE, UI,
  buildPayload, classroomLabel, classroomsFor, emptyDraft, levelLabel, levelsForProgram,
  remotePrograms, resolveLevelId, scheduleLabel, schedulesFor, t, toggleDifficulty, trainersFor, validateDraft,
  type Classroom, type Draft, type Lang, type Level, type Program, type Schedule, type Trainer,
  type ValidationError,
} from '../../../lib/surveys/remoteLearning';

export default function RemoteLearningSurveyPage() {
  return (
    <Suspense fallback={<main className="fl" style={{ minHeight: '60vh' }} />}>
      <SurveyForm />
    </Suspense>
  );
}

function SurveyForm() {
  const db = supabase();
  const params = useSearchParams();

  /* P49-ب «بلغة الطالب»: بلا ?lang يُفتح بلغة المتصفّح (غير العربي → الإنجليزية) */
  const [lang, setLang] = useState<Lang>(() => (params.get('lang') === 'en' ? 'en' : 'ar'));
  useEffect(() => { if (!params.get('lang')) setLang(resolveOpenLang('auto', navigator.language)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

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
  /* هـ-3 ن «محطّات»: 0 البداية · 1 المجموعة · 2 عنك · 3..6 محاور العبارات · 7 الصعوبات · 8 رأيك+إرسال */
  const [step, setStep] = useState(0); const [reached, setReached] = useState(0); const [stepErr, setStepErr] = useState('');
  useStepScroll(step);
  /* P49-ج «مرّة واحدة في اليوم»: الاستبيان مجهول الهوية، فالطبقة الوحيدة هنا ذاكرة الجهاز (لكل مجموعة/يوم) */
  const [onceAt, setOnceAt] = useState<string | null>(null); const [onceOverride, setOnceOverride] = useState(false);
  useEffect(() => { if (!loading && draft.classroomId) setOnceAt(wasDone({ kind: 'REMOTE', programId: draft.programId, classroomId: draft.classroomId })); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [loading, draft.classroomId]);

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
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setSaveError('');
    const errs = validateDraft(draft, { schedules });
    setErrors(errs);
    if (errs.length) { const i = firstStepWithErrors(errs); setStep(i); setStepErr(t(UI.fixErrors, lang) + ' ' + errs.filter(e => stepOfField(e.field) === i).map(e => t(e, lang)).join(' · ')); return; }
    setSaving(true);
    try {
      const payload = buildPayload(draft, { programs, levels, trainers, classrooms, schedules, lang });
      const { error } = await db.from('remote_learning_survey_responses').insert(payload);
      if (error) throw error;
      markDone({ kind: 'REMOTE', programId: draft.programId, classroomId: draft.classroomId }); setOnceOverride(false);
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err: any) {
      setSaveError((lang === 'ar' ? 'تعذر الإرسال: ' : 'Could not submit: ') + (err?.message || ''));
    } finally {
      setSaving(false);
    }
  }

  /* ---------------- render ---------------- */
  if (loading) return (<FlowShell lang={lang} kicker={<><Icon name="laptop" size={14} /> Microsoft Teams</>} title={t(SURVEY_TITLE, lang)}><div className="fl-card fl-center fl-muted">{t(UI.loading, lang)}</div></FlowShell>);

  if (onceAt && !onceOverride && !done) return (
    <FlowShell lang={lang} kicker={<><Icon name="laptop" size={14} /> Microsoft Teams</>} title={t(SURVEY_TITLE, lang)}>
      <section className="fl-card fl-center" data-testid="rs-once" data-at={onceAt}>
        <div className="fl-ok"><Icon name="check" size={30} /></div>
        <h2>{ONCE_TITLE[lang === 'en' ? 1 : 0]}</h2>
        <p className="fl-muted">{onceMessage('REMOTE', lang)}</p>
        <button type="button" className="fl-btn ghost" onClick={() => setOnceOverride(true)} data-testid="rs-once-override"><Icon name="users" size={14} /> {ONCE_SHARED[lang === 'en' ? 1 : 0]}</button>
      </section>
    </FlowShell>
  );

  if (done) return (
    <FlowShell lang={lang} kicker={<><Icon name="laptop" size={14} /> Microsoft Teams</>} title={t(SURVEY_TITLE, lang)}>
      <section className="fl-card fl-center" data-testid="rs-done">
        <div className="fl-ok"><Icon name="check" size={30} /></div>
        <h2>{t(UI.thanksTitle, lang)}</h2>
        <p className="fl-muted">{t(UI.thanksBody, lang)}</p>
      </section>
    </FlowShell>
  );

  /* ---------------- محطّات ---------------- */
  const groupFields = ['programId', 'levelId', 'trainerId', 'classroomId', 'scheduleId', 'lectureDate'];
  const aboutFields = ['selfLevelId', 'attendance'];
  function stepOfField(field: string): number { if (groupFields.includes(field)) return 1; if (aboutFields.includes(field)) return 2; if (field === 'ratings') return 3; if (field === 'difficulties') return 7; return 8; }
  function firstStepWithErrors(errs: ValidationError[]): number { return Math.min(...errs.map(e => stepOfField(e.field))); }
  const axisDone = (keys: string[]) => keys.filter(k => !!draft.ratings[k]).length;
  const groupDone = () => ['programId', 'levelId', 'trainerId', 'classroomId'].filter(k => !!(draft as any)[k]).length + (scheduleOptions.length === 0 || draft.scheduleId ? 1 : 0);
  const st = (done: number, total: number, missNow: boolean): StationState => missNow ? 'miss' : done >= total ? 'done' : done > 0 ? 'part' : 'todo';
  const stations: Station[] = [
    { key: 'start', title: lang === 'ar' ? 'البداية' : 'Start', state: reached > 0 ? 'done' : 'todo' },
    { key: 'group', title: t(UI.sectionGroup, lang), state: st(groupDone(), 5, step === 1 && !!stepErr), done: groupDone(), total: 5 },
    { key: 'about', title: t(UI.sectionAbout, lang), state: st((draft.selfLevelId ? 1 : 0) + (draft.attendance ? 1 : 0), 2, step === 2 && !!stepErr), done: (draft.selfLevelId ? 1 : 0) + (draft.attendance ? 1 : 0), total: 2 },
    ...STATEMENT_AXES.map((ax, i) => ({ key: ax.key, title: lang === 'ar' ? ax.ar : ax.en, hint: lang === 'ar' ? ax.hint_ar : ax.hint_en, state: st(axisDone(ax.keys), ax.keys.length, step === 3 + i && !!stepErr), done: axisDone(ax.keys), total: ax.keys.length })),
    { key: 'diff', title: t(UI.sectionDiff, lang), state: st(draft.difficulties.length ? 1 : 0, 1, step === 7 && !!stepErr), done: draft.difficulties.length ? 1 : 0, total: 1 },
    { key: 'open', title: t(UI.sectionOpen, lang), state: reached >= 8 ? 'done' : 'todo', optional: true },
  ];
  const N = stations.length;

  /** تحقّق المحطّة الحالية فقط — فلا يُطلب من المتعلّم شيء لم يصل إليه بعد */
  function stepErrors(i: number): string[] {
    const errs = validateDraft(draft, { schedules });
    if (i >= 3 && i <= 6) { const ax = STATEMENT_AXES[i - 3]; const missing = ax.keys.filter(k => !draft.ratings[k]).length; return missing ? [lang === 'ar' ? `بقي ${missing} من ${ax.keys.length} عبارات بلا إجابة` : `${missing} of ${ax.keys.length} statements unanswered`] : []; }
    return errs.filter(e => stepOfField(e.field) === i).map(e => t(e, lang));
  }
  function go(i: number) { setStepErr(''); setStep(i); setReached(r => Math.max(r, i)); }
  function next() { const errs = stepErrors(step); if (errs.length) { setStepErr(errs.join(' · ')); return; } go(Math.min(N - 1, step + 1)); }
  function prev() { setStepErr(''); setStep(s => Math.max(0, s - 1)); }

  const scaleBtn = (key: string) => (
    <div className="fl-scale" role="radiogroup">
      {SCALE.map(sc => (
        <button key={sc.code} type="button" role="radio" aria-checked={draft.ratings[key] === sc.code}
          className={`${draft.ratings[key] === sc.code ? 'on' : ''} ${sc.code === 'NA' ? 'na' : ''}`}
          onClick={() => { setStepErr(''); upd({ ratings: { ...draft.ratings, [key]: sc.code } }); }}>
          {sc.code !== 'NA' && <b>{sc.value}</b>}<small>{lang === 'ar' ? sc.ar : sc.en}</small>
        </button>
      ))}
      <div className="fl-legend" aria-hidden="true"><small>1 = {lang === 'ar' ? SCALE[4].ar : SCALE[4].en}</small><small>5 = {lang === 'ar' ? SCALE[0].ar : SCALE[0].en}</small></div>
    </div>
  );

  const head = {
    kicker: <><Icon name="laptop" size={14} /> Microsoft Teams</>,
    title: lang === 'ar' ? SURVEY_TITLE.ar : SURVEY_TITLE.en,
    sub: step === 0 ? (lang === 'ar' ? SURVEY_TITLE.en : SURVEY_TITLE.ar) : undefined,
  };

  return (
    <FlowShell lang={lang} kicker={head.kicker} title={head.title} sub={head.sub} langs={step === 0} onLang={setLang} testid="rs-flow">
      {loadError && <div className="fl-msg bad"><Icon name="alert" size={16} /><span>{loadError}</span></div>}
      {step > 0 && <Stations lang={lang} stations={stations} index={step} reached={reached} onGo={go} testid="rs-stations" chipTestid="rs-chip" />}

      {step === 0 && (
        <StepCard lang={lang} title={lang === 'ar' ? 'قبل أن تبدأ' : 'Before you start'} id="rs-step-0">
          <div className="fl-intro">
            <p dir={lang === 'ar' ? 'rtl' : 'ltr'}>{t(SURVEY_INTRO, lang)}</p>
            <div className="fl-anon"><Icon name="shield" size={16} /><span>{t(UI.anonymous, lang)}</span></div>
            <div className="fl-meta"><span><Icon name="clock" size={13} /> {t(UI.minutes, lang)}</span><span><Icon name="check" size={13} /> {t(UI.required, lang)}</span></div>
          </div>
          <div style={{ marginTop: 18 }}><button type="button" className="fl-btn primary wide" onClick={() => go(1)} data-testid="rs-start">{t(UI.start, lang)} <Icon name={lang === 'ar' ? 'next' : 'arrow'} size={16} /></button></div>
        </StepCard>
      )}

      {step === 1 && (
        <StepCard lang={lang} n={1} title={t(UI.sectionGroup, lang)} id="rs-step-1" miss={!!stepErr}>
          <div className="fl-grid">
            {programs.length !== 1 && (
              <label className={`fl-field ${hasError('programId') ? 'invalid' : ''}`}>
                <span>{t(UI.program, lang)}<span className="fl-req"> *</span></span>
                <select value={draft.programId} onChange={e => onProgram(e.target.value)}>
                  <option value="">{t(UI.choose, lang)}</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{lang === 'ar' ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
                </select>
              </label>
            )}
            <label className={`fl-field ${hasError('levelId') ? 'invalid' : ''}`}>
              <span>{t(UI.level, lang)}<span className="fl-req"> *</span></span>
              <select value={draft.levelId} onChange={e => onLevel(e.target.value)} disabled={!draft.programId}>
                <option value="">{t(UI.choose, lang)}</option>
                {levelOptions.map(l => <option key={l.id} value={l.id}>{levelLabel(l, lang)}</option>)}
              </select>
            </label>
            <label className={`fl-field ${hasError('trainerId') ? 'invalid' : ''}`}>
              <span>{t(UI.trainer, lang)}<span className="fl-req"> *</span></span>
              <select value={draft.trainerId} onChange={e => onTrainer(e.target.value)} disabled={!draft.levelId}>
                <option value="">{t(UI.choose, lang)}</option>
                {trainerOptions.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </label>
            <label className={`fl-field ${hasError('classroomId') ? 'invalid' : ''}`}>
              <span>{t(UI.group, lang)}<span className="fl-req"> *</span></span>
              <select value={draft.classroomId} onChange={e => onGroup(e.target.value)} disabled={!draft.trainerId}>
                <option value="">{t(UI.choose, lang)}</option>
                {groupOptions.map(c => <option key={c.id} value={c.id}>{classroomLabel(c, { trainers, levels }, lang)}</option>)}
              </select>
              {draft.trainerId && groupOptions.length === 0 && <small style={{ color: '#8A5A1E' }}>{t(UI.noGroups, lang)}</small>}
            </label>
            <label className={`fl-field ${hasError('scheduleId') ? 'invalid' : ''}`}>
              <span>{t(UI.schedule, lang)}{scheduleOptions.length > 0 && <span className="fl-req"> *</span>}</span>
              <select value={draft.scheduleId} onChange={e => upd({ scheduleId: e.target.value })} disabled={!draft.classroomId || scheduleOptions.length === 0}>
                <option value="">{scheduleOptions.length === 0 && draft.classroomId ? '—' : t(UI.choose, lang)}</option>
                {scheduleOptions.map(s => <option key={s.id} value={s.id}>{scheduleLabel(s, lang)}</option>)}
              </select>
            </label>
            <label className={`fl-field ${hasError('lectureDate') ? 'invalid' : ''}`}>
              <span>{t(UI.lectureDate, lang)}</span>
              <input type="date" value={draft.lectureDate} onChange={e => upd({ lectureDate: e.target.value })} />
            </label>
          </div>
        </StepCard>
      )}

      {step === 2 && (
        <StepCard lang={lang} n={2} title={t(UI.sectionAbout, lang)} id="rs-step-2" miss={!!stepErr}>
          <div className={`fl-q ${hasError('selfLevelId') ? 'miss' : ''}`}>
            <div className="fl-qt"><span className="fl-qn">1</span><span>{t(UI.selfLevel, lang)}<span className="fl-req"> *</span></span></div>
            <div className="fl-pills" role="radiogroup">
              {levelOptions.map(l => (
                <button key={l.id} type="button" role="radio" aria-checked={draft.selfLevelId === l.id} className={`fl-pill ${draft.selfLevelId === l.id ? 'on' : ''}`} onClick={() => { setStepErr(''); upd({ selfLevelId: l.id }); }}>
                  <span className="fl-k">{draft.selfLevelId === l.id && <Icon name="check" size={12} />}</span>{levelLabel(l, lang)}
                </button>
              ))}
              <button type="button" role="radio" aria-checked={draft.selfLevelId === 'unknown'} className={`fl-pill ${draft.selfLevelId === 'unknown' ? 'on' : ''}`} onClick={() => { setStepErr(''); upd({ selfLevelId: 'unknown' }); }}>
                <span className="fl-k">{draft.selfLevelId === 'unknown' && <Icon name="check" size={12} />}</span>{t(UI.notSure, lang)}
              </button>
            </div>
          </div>
          <div className={`fl-q ${hasError('attendance') ? 'miss' : ''}`}>
            <div className="fl-qt"><span className="fl-qn">2</span><span>{t(UI.attendance, lang)}<span className="fl-req"> *</span></span></div>
            <div className="fl-pills" role="radiogroup">
              {ATTENDANCE.map(a => (
                <button key={a.code} type="button" role="radio" aria-checked={draft.attendance === a.code} className={`fl-pill ${draft.attendance === a.code ? 'on' : ''}`} onClick={() => { setStepErr(''); upd({ attendance: a.code }); }}>
                  <span className="fl-k">{draft.attendance === a.code && <Icon name="check" size={12} />}</span>{lang === 'ar' ? a.ar : a.en}
                </button>
              ))}
            </div>
          </div>
        </StepCard>
      )}

      {step >= 3 && step <= 6 && (() => { const ax = STATEMENT_AXES[step - 3]; const items = STATEMENTS.filter(s => ax.keys.includes(s.key)); return (
        <StepCard lang={lang} n={step} title={lang === 'ar' ? ax.ar : ax.en} hint={`${lang === 'ar' ? ax.hint_ar : ax.hint_en} · ${t(UI.ratingHint, lang)}`} id={`rs-step-${step}`} miss={!!stepErr}>
          {items.map(s => (
            <div key={s.key} className={`fl-q ${stepErr && !draft.ratings[s.key] ? 'miss' : ''}`} data-testid={`rs-q-${s.key}`}>
              <div className="fl-qt"><span className="fl-qn">{STATEMENTS.indexOf(s) + 1}</span><span>{lang === 'ar' ? s.ar : s.en}<span className="fl-req"> *</span></span></div>
              {lang === 'ar' && <div className="fl-qen" dir="ltr">{s.en}</div>}
              {scaleBtn(s.key)}
            </div>
          ))}
        </StepCard>
      ); })()}

      {step === 7 && (
        <StepCard lang={lang} n={7} title={t(UI.sectionDiff, lang)} hint={t(UI.difficulties, lang)} id="rs-step-7" miss={!!stepErr}>
          <div className="fl-pills">
            {DIFFICULTIES.map(d => {
              const on = draft.difficulties.includes(d.code);
              return (
                <button key={d.code} type="button" className={`fl-pill multi ${on ? 'on' : ''}`} onClick={() => { setStepErr(''); upd({ difficulties: toggleDifficulty(draft.difficulties, d.code) }); }} aria-pressed={on}>
                  <span className="fl-k">{on && <Icon name="check" size={12} />}</span>{lang === 'ar' ? d.ar : d.en}
                </button>
              );
            })}
          </div>
          {draft.difficulties.includes('other') && (
            <label className="fl-field" style={{ marginTop: 14 }}>
              <span>{t(UI.otherText, lang)}</span>
              <input value={draft.difficultyOther} maxLength={300} onChange={e => upd({ difficultyOther: e.target.value })} />
            </label>
          )}
        </StepCard>
      )}

      {step === 8 && (
        <StepCard lang={lang} n={8} title={t(UI.sectionOpen, lang)} hint={t(UI.optionalStep, lang)} optional id="rs-step-8">
          <label className="fl-field span">
            <span>{t(UI.likedMost, lang)}</span>
            <textarea rows={3} maxLength={1000} value={draft.likedMost} onChange={e => upd({ likedMost: e.target.value })} />
          </label>
          <label className="fl-field span" style={{ marginTop: 12 }}>
            <span>{t(UI.suggestion, lang)}</span>
            <textarea rows={3} maxLength={1000} value={draft.suggestion} onChange={e => upd({ suggestion: e.target.value })} />
          </label>
          <ul className="fl-review" style={{ marginTop: 16 }} aria-label={lang === 'ar' ? 'خلاصة' : 'Summary'}>
            {stations.slice(1, 8).map(s => <li key={s.key}><span>{s.title}</span><b className={s.state === 'done' ? '' : 'bad'}>{typeof s.total === 'number' ? `${s.done}/${s.total}` : ''}{s.state === 'done' ? ' ✓' : ''}</b></li>)}
          </ul>
        </StepCard>
      )}

      {step > 0 && (
        <FlowNav lang={lang} index={step} count={N} onPrev={prev} onNext={next} onSubmit={() => void submit()} saving={saving} last={step === N - 1}
          error={stepErr || saveError || undefined} />
      )}
    </FlowShell>
  );
}
