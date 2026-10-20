'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import {
  DAYS, classroomLabel, formatTime, levelLabel, scheduleLabel, schedulesFor,
  type Classroom, type Level, type Program, type Schedule, type Trainer,
} from '../../../lib/surveys/remoteLearning';

type Tab = 'levels' | 'groups';

export default function SurveySettingsPage() {
  const router = useRouter();
  const db = supabase();

  const [lang, setLang] = useState<'ar' | 'en'>('ar');
  const ar = lang === 'ar';
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('groups');
  const [msg, setMsg] = useState('');

  const [programs, setPrograms] = useState<Program[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  const [programFilter, setProgramFilter] = useState<string>('');

  // level form
  const [lvProgram, setLvProgram] = useState<string>('');      // '' = global
  const [lvCode, setLvCode] = useState('');
  const [lvAr, setLvAr] = useState('');
  const [lvEn, setLvEn] = useState('');
  const [lvOrder, setLvOrder] = useState('0');

  // schedule form (per classroom)
  const [schForm, setSchForm] = useState<Record<string, { day: string; start: string; end: string }>>({});

  const flash = (text: string) => { setMsg(text); setTimeout(() => setMsg(''), 4000); };

  async function loadAll() {
    const [p, l, tr, c, s] = await Promise.all([
      db.from('programs').select('id,name_ar,name_en,delivery_mode,status').order('name_ar'),
      db.from('program_levels').select('id,program_id,code,name_ar,name_en,sort_order,is_active').order('sort_order'),
      db.from('trainers').select('id,name').order('name'),
      db.from('classrooms').select('id,code,program_id,trainer_id,level_id,level,section_name,delivery_mode').order('code'),
      db.from('class_schedules').select('id,classroom_id,day_of_week,start_time,end_time,is_active').order('day_of_week'),
    ]);
    const err = [p, l, tr, c, s].find(r => r.error)?.error;
    if (err) { flash(err.message); return; }
    setPrograms((p.data || []) as Program[]);
    setLevels((l.data || []) as Level[]);
    setTrainers((tr.data || []) as Trainer[]);
    setClassrooms((c.data || []) as Classroom[]);
    setSchedules((s.data || []) as Schedule[]);
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

  /* ---------------- levels ---------------- */
  async function addLevel() {
    if (!lvCode.trim() || !lvAr.trim() || !lvEn.trim()) { flash(ar ? 'الرمز والاسمان مطلوبة' : 'Code and both names are required'); return; }
    const { error } = await db.from('program_levels').insert({
      program_id: lvProgram || null, code: lvCode.trim().toUpperCase(), name_ar: lvAr.trim(), name_en: lvEn.trim(),
      sort_order: Number(lvOrder) || 0,
    });
    if (error) { flash(error.message); return; }
    setLvCode(''); setLvAr(''); setLvEn(''); setLvOrder('0');
    await loadAll(); flash(ar ? 'تمت إضافة المستوى' : 'Level added');
  }
  async function toggleLevel(l: Level) {
    const { error } = await db.from('program_levels').update({ is_active: !(l.is_active !== false) }).eq('id', l.id);
    if (error) flash(error.message); else await loadAll();
  }
  async function deleteLevel(l: Level) {
    if (!window.confirm(ar ? `حذف المستوى ${l.code}؟` : `Delete level ${l.code}?`)) return;
    const { error } = await db.from('program_levels').delete().eq('id', l.id);
    if (error) { flash(error.message); return; }
    await loadAll(); flash(ar ? 'تم الحذف' : 'Deleted');
  }

  /* ---------------- classrooms ---------------- */
  async function setClassroomLevel(c: Classroom, levelId: string) {
    const { error } = await db.from('classrooms').update({ level_id: levelId || null }).eq('id', c.id);
    if (error) flash(error.message); else await loadAll();
  }
  async function setSectionName(c: Classroom, name: string) {
    const { error } = await db.from('classrooms').update({ section_name: name.trim() || null }).eq('id', c.id);
    if (error) flash(error.message); else await loadAll();
  }

  /* ---------------- schedules ---------------- */
  function sch(cid: string) { return schForm[cid] || { day: '0', start: '', end: '' }; }
  async function addSchedule(c: Classroom) {
    const f = sch(c.id);
    if (!f.start || !f.end) { flash(ar ? 'أدخل وقت البداية والنهاية' : 'Enter start and end time'); return; }
    if (f.end <= f.start) { flash(ar ? 'وقت النهاية يجب أن يكون بعد البداية' : 'End time must be after start time'); return; }
    const { error } = await db.from('class_schedules').insert({
      classroom_id: c.id, day_of_week: Number(f.day), start_time: f.start, end_time: f.end, timezone: 'Asia/Riyadh',
    });
    if (error) { flash(error.message); return; }
    setSchForm(x => ({ ...x, [c.id]: { day: f.day, start: '', end: '' } }));
    await loadAll(); flash(ar ? 'تمت إضافة الموعد' : 'Schedule added');
  }
  async function deleteSchedule(s: Schedule) {
    if (!window.confirm(ar ? 'حذف هذا الموعد؟' : 'Delete this schedule?')) return;
    const { error } = await db.from('class_schedules').delete().eq('id', s.id);
    if (error) { flash(error.message); return; }
    await loadAll();
  }

  /* ---------------- links ---------------- */
  function surveyLink(c: Classroom, s?: Schedule) {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const q = new URLSearchParams({ classroom: c.id });
    if (s) q.set('schedule', s.id);
    return `${origin}/survey/remote-learning?${q.toString()}`;
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); flash(ar ? 'تم نسخ الرابط' : 'Link copied'); }
    catch { window.prompt(ar ? 'انسخ الرابط:' : 'Copy the link:', text); }
  }

  const visibleClassrooms = useMemo(
    () => classrooms.filter(c => !programFilter || c.program_id === programFilter),
    [classrooms, programFilter],
  );
  const visibleLevels = useMemo(
    () => levels.filter(l => !programFilter || l.program_id === null || l.program_id === programFilter),
    [levels, programFilter],
  );
  const programName = (id: string | null) => {
    const p = programs.find(x => x.id === id);
    return p ? (ar ? p.name_ar : (p.name_en || p.name_ar)) : (ar ? 'عام (كل البرامج)' : 'Global (all programs)');
  };

  if (!mounted || loading) return (<div className="ss ss-load"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="ss-spin" /></div>);

  return (
    <div className="ss" style={{ direction: ar ? 'rtl' : 'ltr' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="ss-top">
        <div className="ss-top-in">
          <div>
            <div className="ss-ttl">⚙️ {ar ? 'إعدادات استطلاع التعلم عن بُعد' : 'Remote Learning Survey Settings'}</div>
            <div className="ss-sub">{ar ? 'المستويات • المجموعات • المواعيد • روابط الاستطلاع' : 'Levels • Groups • Schedules • Survey links'}</div>
          </div>
          <div className="ss-actions">
            <button className="ss-ghost" onClick={() => setLang(ar ? 'en' : 'ar')}>🌐 {ar ? 'English' : 'العربية'}</button>
            <button className="ss-ghost" onClick={() => router.push('/admin/management')}>🏫 {ar ? 'القاعات والمدربون' : 'Rooms & trainers'}</button>
            <button className="ss-ghost" onClick={() => router.push('/reports/remote-survey')}>📊 {ar ? 'نتائج الاستطلاع' : 'Survey results'}</button>
          </div>
        </div>
      </header>

      {msg && <div className="ss-toast">{msg}</div>}

      <div className="ss-tabs">
        <button className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>🧩 {ar ? `المجموعات والمواعيد (${visibleClassrooms.length})` : `Groups & schedules (${visibleClassrooms.length})`}</button>
        <button className={tab === 'levels' ? 'on' : ''} onClick={() => setTab('levels')}>🎚️ {ar ? `المستويات (${visibleLevels.length})` : `Levels (${visibleLevels.length})`}</button>
        <select className="ss-filter" value={programFilter} onChange={e => setProgramFilter(e.target.value)}>
          <option value="">{ar ? 'كل البرامج' : 'All programs'}</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.delivery_mode === 'remote' ? '💻 ' : '🏫 '}{ar ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
        </select>
      </div>

      <main className="ss-wrap">
        {/* ====================== LEVELS ====================== */}
        {tab === 'levels' && (
          <div className="ss-grid">
            <div className="ss-card">
              <h3>➕ {ar ? 'إضافة مستوى' : 'Add level'}</h3>
              <label>{ar ? 'البرنامج' : 'Program'}</label>
              <select value={lvProgram} onChange={e => setLvProgram(e.target.value)}>
                <option value="">{ar ? 'عام (كل البرامج)' : 'Global (all programs)'}</option>
                {programs.map(p => <option key={p.id} value={p.id}>{ar ? p.name_ar : (p.name_en || p.name_ar)}</option>)}
              </select>
              <label>{ar ? 'الرمز *' : 'Code *'}</label>
              <input value={lvCode} onChange={e => setLvCode(e.target.value)} placeholder="A1 / B2 / L3" />
              <label>{ar ? 'الاسم بالعربية *' : 'Arabic name *'}</label>
              <input value={lvAr} onChange={e => setLvAr(e.target.value)} placeholder="مبتدئ 1" />
              <label>{ar ? 'الاسم بالإنجليزية *' : 'English name *'}</label>
              <input value={lvEn} onChange={e => setLvEn(e.target.value)} placeholder="Beginner 1" dir="ltr" />
              <label>{ar ? 'الترتيب' : 'Sort order'}</label>
              <input type="number" value={lvOrder} onChange={e => setLvOrder(e.target.value)} dir="ltr" />
              <button className="ss-primary" onClick={addLevel}>{ar ? 'حفظ المستوى' : 'Save level'}</button>
            </div>

            <div className="ss-card ss-full">
              <h3>🎚️ {ar ? 'قائمة المستويات' : 'Levels list'}</h3>
              <div className="ss-tw">
                <table>
                  <thead><tr><th>{ar ? 'الرمز' : 'Code'}</th><th>{ar ? 'الاسم' : 'Name'}</th><th>{ar ? 'البرنامج' : 'Program'}</th><th>{ar ? 'الترتيب' : 'Order'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th></th></tr></thead>
                  <tbody>
                    {visibleLevels.map(l => (
                      <tr key={l.id} style={{ opacity: l.is_active === false ? .55 : 1 }}>
                        <td><b>{l.code}</b></td>
                        <td>{l.name_ar} <span className="ss-muted">/ {l.name_en}</span></td>
                        <td>{programName(l.program_id)}</td>
                        <td dir="ltr">{l.sort_order}</td>
                        <td><button className="ss-mini" onClick={() => toggleLevel(l)}>{l.is_active === false ? (ar ? 'معطّل — تفعيل' : 'Inactive — enable') : (ar ? 'مفعّل' : 'Active')}</button></td>
                        <td><button className="ss-del" onClick={() => deleteLevel(l)}>🗑️</button></td>
                      </tr>
                    ))}
                    {!visibleLevels.length && <tr><td colSpan={6} className="ss-empty">{ar ? 'لا توجد مستويات' : 'No levels'}</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ====================== GROUPS & SCHEDULES ====================== */}
        {tab === 'groups' && (
          <div className="ss-list">
            <div className="ss-note">
              {ar
                ? 'لكل مجموعة: حدّد المستوى، أضف مواعيد المحاضرات (توقيت الرياض)، ثم انسخ رابط الاستطلاع الخاص بها. يمكن أن تتشارك مجموعتان نفس الموعد دون أي تعارض.'
                : 'For each group: set its level, add class schedules (Riyadh time), then copy its survey link. Two groups may share the same time slot without conflict.'}
            </div>

            {visibleClassrooms.map(c => {
              const cs = schedulesFor(schedules, c.id);
              const f = sch(c.id);
              const lvls = levels.filter(l => l.is_active !== false && (l.program_id === null || l.program_id === c.program_id));
              return (
                <div key={c.id} className="ss-card ss-group">
                  <div className="ss-group-head">
                    <div>
                      <div className="ss-group-title">{c.delivery_mode === 'remote' ? '💻' : '🏫'} {classroomLabel(c, { trainers, levels }, lang)}</div>
                      <div className="ss-muted">{programName(c.program_id)}</div>
                    </div>
                    <button className="ss-mini" onClick={() => copy(surveyLink(c))}>🔗 {ar ? 'نسخ رابط المجموعة' : 'Copy group link'}</button>
                  </div>

                  <div className="ss-group-grid">
                    <label>
                      {ar ? 'المستوى' : 'Level'}
                      <select value={c.level_id || ''} onChange={e => setClassroomLevel(c, e.target.value)}>
                        <option value="">{ar ? '— بدون —' : '— none —'}</option>
                        {lvls.map(l => <option key={l.id} value={l.id}>{levelLabel(l, lang)}</option>)}
                      </select>
                    </label>
                    <label>
                      {ar ? 'اسم الشعبة (اختياري)' : 'Section name (optional)'}
                      <input defaultValue={c.section_name || ''} placeholder={ar ? 'مثال: شعبة أ' : 'e.g. Section A'} onBlur={e => { if ((e.target.value || '') !== (c.section_name || '')) setSectionName(c, e.target.value); }} />
                    </label>
                  </div>

                  <div className="ss-sch">
                    <div className="ss-sch-title">🕒 {ar ? 'مواعيد المحاضرات' : 'Class schedules'}</div>
                    {cs.length === 0 && <div className="ss-muted">{ar ? 'لا توجد مواعيد بعد.' : 'No schedules yet.'}</div>}
                    {cs.map(s => (
                      <div key={s.id} className="ss-sch-row">
                        <span className="ss-chip">{scheduleLabel(s, lang)}</span>
                        <span className="ss-muted" dir="ltr">{formatTime(s.start_time)} – {formatTime(s.end_time)} (Asia/Riyadh)</span>
                        <button className="ss-mini" onClick={() => copy(surveyLink(c, s))}>🔗 {ar ? 'رابط الموعد' : 'Schedule link'}</button>
                        <a className="ss-mini" href={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(surveyLink(c, s))}`} target="_blank" rel="noreferrer">▦ QR</a>
                        <button className="ss-del" onClick={() => deleteSchedule(s)}>🗑️</button>
                      </div>
                    ))}
                    <div className="ss-sch-add">
                      <select value={f.day} onChange={e => setSchForm(x => ({ ...x, [c.id]: { ...f, day: e.target.value } }))}>
                        {DAYS.map(d => <option key={d.v} value={d.v}>{ar ? d.ar : d.en}</option>)}
                      </select>
                      <input type="time" value={f.start} onChange={e => setSchForm(x => ({ ...x, [c.id]: { ...f, start: e.target.value } }))} dir="ltr" />
                      <input type="time" value={f.end} onChange={e => setSchForm(x => ({ ...x, [c.id]: { ...f, end: e.target.value } }))} dir="ltr" />
                      <button className="ss-primary ss-inline" onClick={() => addSchedule(c)}>➕ {ar ? 'إضافة موعد' : 'Add schedule'}</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!visibleClassrooms.length && <div className="ss-card ss-empty">{ar ? 'لا توجد مجموعات. أضف القاعات/المجموعات من صفحة «القاعات والمدربون».' : 'No groups. Add rooms/groups from the "Rooms & trainers" page.'}</div>}
          </div>
        )}
      </main>
    </div>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');
*{box-sizing:border-box;}
@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
.ss{min-height:100vh;background:#f4f6f8;font-family:Tajawal,Arial,sans-serif;color:#0f172a;padding-bottom:40px;}
.ss-load{display:flex;align-items:center;justify-content:center;background:#14466B;}
.ss-spin{width:64px;height:64px;border:6px solid rgba(255,255,255,.14);border-top-color:#1FA39A;border-radius:50%;animation:spin 1s linear infinite;}
.ss-top{background:linear-gradient(135deg,#14466B,#0d3049);color:#fff;padding:22px 28px;border-bottom:3px solid #C9A24B;}
.ss-top-in{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;}
.ss-ttl{font-size:22px;font-weight:900;} .ss-sub{color:#9fc3d6;font-size:13px;margin-top:4px;font-weight:700;}
.ss-actions{display:flex;gap:10px;flex-wrap:wrap;}
.ss-ghost{background:rgba(255,255,255,.10);border:1px solid rgba(201,162,75,.35);color:#fff;border-radius:12px;padding:10px 16px;font-family:inherit;font-weight:800;cursor:pointer;}
.ss-toast{max-width:1200px;margin:16px auto 0;padding:12px 18px;border-radius:12px;font-weight:800;text-align:center;background:#d1fae5;color:#047857;}
.ss-tabs{max-width:1200px;margin:22px auto 0;padding:0 28px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
.ss-tabs button{border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:14px;padding:12px 18px;font-family:inherit;font-weight:900;font-size:14px;cursor:pointer;}
.ss-tabs button.on{background:linear-gradient(135deg,#00897B,#1FA39A);color:#fff;border-color:transparent;box-shadow:0 10px 24px rgba(0,137,123,.30);}
.ss-filter{margin-inline-start:auto;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-family:inherit;font-weight:700;background:#fff;}
.ss-wrap{max-width:1200px;margin:20px auto 0;padding:0 28px;}
.ss-grid{display:grid;grid-template-columns:1fr 2fr;gap:20px;}
.ss-full{grid-column:1/-1;}
.ss-card{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:22px;box-shadow:0 8px 28px rgba(15,23,42,.04);margin-bottom:18px;}
.ss-card h3{margin:0 0 14px;font-size:18px;font-weight:900;color:#14466B;}
.ss-card label{display:block;font-size:13px;font-weight:800;color:#475569;margin:10px 0 6px;}
.ss-card select,.ss-card input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font-family:inherit;font-weight:700;background:#fff;color:#0f172a;outline:none;}
.ss-primary{width:100%;margin-top:16px;border:0;border-radius:12px;padding:13px;background:linear-gradient(135deg,#00897B,#1FA39A);color:#fff;font-family:inherit;font-weight:900;font-size:14px;cursor:pointer;}
.ss-primary.ss-inline{width:auto;margin:0;padding:10px 14px;white-space:nowrap;}
.ss-tw{overflow-x:auto;} table{width:100%;border-collapse:collapse;min-width:560px;}
th{padding:12px;font-weight:900;font-size:13px;color:#64748b;border-bottom:2px solid #eef2f6;text-align:start;}
td{padding:12px;font-size:14px;border-bottom:1px solid #f1f5f9;font-weight:700;vertical-align:middle;}
.ss-muted{color:#64748b;font-weight:600;font-size:12px;}
.ss-empty{color:#94a3b8;text-align:center;font-weight:800;padding:20px;}
.ss-mini{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 10px;font-family:inherit;font-weight:800;font-size:12px;cursor:pointer;color:#14466B;text-decoration:none;display:inline-block;}
.ss-mini:hover{background:#f1f5f9;}
.ss-del{background:#fff;border:1px solid #fecaca;color:#b91c1c;border-radius:10px;padding:6px 10px;cursor:pointer;font-size:14px;}
.ss-note{background:#eff6ff;color:#1e40af;border:1px solid #bfdbfe;border-radius:14px;padding:12px 16px;font-weight:700;font-size:13px;margin-bottom:16px;line-height:1.8;}
.ss-group-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px;}
.ss-group-title{font-size:17px;font-weight:900;color:#14466B;}
.ss-group-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.ss-sch{margin-top:14px;padding-top:14px;border-top:1px dashed #e2e8f0;}
.ss-sch-title{font-weight:900;color:#334155;margin-bottom:8px;}
.ss-sch-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid #f1f5f9;}
.ss-chip{background:#ede9fe;color:#6d28d9;font-weight:900;padding:5px 12px;border-radius:999px;font-size:13px;}
.ss-sch-add{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:8px;margin-top:12px;align-items:center;}
.ss-sch-add select,.ss-sch-add input{margin:0;}
@media(max-width:900px){.ss-grid{grid-template-columns:1fr;}.ss-group-grid{grid-template-columns:1fr;}.ss-sch-add{grid-template-columns:1fr 1fr;}.ss-filter{margin-inline-start:0;width:100%;}.ss-top-in{flex-direction:column;align-items:flex-start;}}
`;
