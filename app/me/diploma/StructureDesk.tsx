'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P66-ب «هيكل الدبلوم» — مكتب المشرف (يُحمَّل ديناميكيًا بلا SSR)
 *  التسلسل في كل سطر: اسم الدبلوم : المستوى — المقرّر — الشعبة — أستاذ المادة
 *  (1) المقرّرات مجمَّعة بالمستوى: المستوى · أستاذ المادة الافتراضي · الرمز   (2) الشُّعب والمحاضرات: سطر = مقرّر × شعبة × أستاذ × يوم × محاضرة (وقت ومدّة بالعرف الأكاديمي — لا افتراض)
 *  (3) شبكة الأسبوع + التعارضات   (4) الفترات الخاصّة (رمضان…)   (5) «الميسِّر يقترح الجدول» → اعتماد   (6) «البديل بلمسة»   (7) طلبات النقل
 *  testids: ds-root ds-err ds-ok ds-prog ds-level ds-course ds-course-level ds-course-trainer ds-slot ds-slot-form ds-slot-save ds-slot-del ds-grid ds-cell ds-conflict ds-period ds-period-form ds-period-save
 *           ds-suggest ds-suggest-run ds-proposed ds-adopt ds-sub ds-sub-run ds-sub-pick ds-request ds-request-done ds-request-decline ds-print ds-line
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { fastToken } from '../../components/Pocket';
import { Icon } from '../../../lib/ui/icons';
import type { StructureView } from '../../../lib/diploma/store';

type SlotForm = { id?: string; unit_id: string; classroom_id: string; trainer_id: string; weekday: string; period_no: string; starts_at: string; minutes: string; from_day: string; to_day: string; room_ar: string };
const emptySlot = (): SlotForm => ({ unit_id: '', classroom_id: '', trainer_id: '', weekday: '0', period_no: '1', starts_at: '', minutes: '', from_day: '', to_day: '', room_ar: '' });
const pid = () => (typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('program') || '');

export default function StructureDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<StructureView | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [slot, setSlot] = useState<SlotForm>(emptySlot()); const [last, setLast] = useState<Partial<SlotForm>>({}); const [period, setPeriod] = useState<Record<string, string>>({ name_ar: '', from_day: '', to_day: '', lecture_minutes: '', lecture_break_min: '', first_lecture_at: '', shift_minutes: '0' });
  const [sug, setSug] = useState<Record<string, string>>({ level_no: '1', weekdays: '0,1,2,3,4', times: '', from_day: '', to_day: '', per_week: '1' }); const [proposed, setProposed] = useState<any[] | null>(null); const [sugNote, setSugNote] = useState('');
  const [sub, setSub] = useState<{ slot_id: string; day: string; candidates: any[]; line_ar: string } | null>(null);
  const [list, setList] = useState<Array<{ id: string; name_ar: string; is_diploma: boolean; courses: number; sections: number; role_ar: string }> | null>(null);
  const program = pid();
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => {
    if (!program) { const j = await fetch('/api/diploma?list=1', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setList(j.programs); else setErr(j?.error || 'تعذّر فتح الصفحة'); return; }
    const j = await fetch(`/api/diploma?program=${encodeURIComponent(program)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null);
    if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح الهيكل');
  }, [program]);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function post(body: Record<string, unknown>): Promise<any> { setBusy(true); setErr(''); const j = await fetch('/api/diploma', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ ...body, program_id: program }) }).then((r) => r.json()).catch(() => null); setBusy(false); if (!j?.success) setErr(j?.error || 'تعذّر التنفيذ'); return j; }
  const courseName = (id: string) => d?.courses.find((c) => c.id === id)?.title_ar || 'مقرّر'; const secName = (id: string) => { const s = d?.sections.find((x) => x.id === id); const m = String(s?.code || '').match(/\d+/); return m ? `شعبة ${Number(m[0])}` : s?.section_name ? `شعبة ${s.section_name}` : s?.code || 'شعبة'; };
  const insName = (id: string | null) => (id ? d?.instructors.find((t) => t.id === id)?.name || 'أستاذ المادة' : '—');
  async function saveCourse(unit_id: string, patch: Record<string, unknown>) { const j = await post({ action: 'course', unit_id, ...patch }); if (j?.success && tok) load(tok); }
  async function saveSlot() {
    const j = await post({ action: 'slot_save', ...slot, trainer_id: slot.trainer_id || null, weekday: Number(slot.weekday), period_no: Number(slot.period_no), minutes: Number(slot.minutes) });
    if (j?.success) { setLast({ starts_at: slot.starts_at, minutes: slot.minutes, from_day: slot.from_day, to_day: slot.to_day, weekday: slot.weekday, period_no: slot.period_no }); setSlot({ ...emptySlot(), starts_at: slot.starts_at, minutes: slot.minutes, from_day: slot.from_day, to_day: slot.to_day }); flash(`حُفظ السطر — وُلّدت ${j.lectures} محاضرة قادمة${j.conflicts?.length ? ` · تنبيه: ${j.conflicts.length} تعارض` : ''}.`); if (tok) load(tok); }
  }
  async function delSlot(id: string) { if (!confirm('يُحذف السطر ومحاضراته القادمة (الماضية تبقى). نتابع؟')) return; const j = await post({ action: 'slot_delete', id }); if (j?.success) { flash('حُذف السطر.'); if (tok) load(tok); } }
  async function savePeriod() { const j = await post({ action: 'period_save', ...period, lecture_minutes: period.lecture_minutes || null, lecture_break_min: period.lecture_break_min || null, first_lecture_at: period.first_lecture_at || null, shift_minutes: Number(period.shift_minutes || 0) }); if (j?.success) { flash(`حُفظت الفترة — أُعيد توليد ${j.lectures} محاضرة.`); setPeriod({ name_ar: '', from_day: '', to_day: '', lecture_minutes: '', lecture_break_min: '', first_lecture_at: '', shift_minutes: '0' }); if (tok) load(tok); } }
  async function delPeriod(id: string) { if (!confirm('تُحذف الفترة وتعود المحاضرات إلى الجدول الأصلي. نتابع؟')) return; const j = await post({ action: 'period_delete', id }); if (j?.success) { flash('حُذفت الفترة.'); if (tok) load(tok); } }
  async function runSuggest() { const times = sug.times.split(/[\n;]+/).map((s) => s.trim()).filter(Boolean).map((s, i) => { const m = s.match(/(\d{1,2}:\d{2})\D+(\d{2,3})/); return m ? { period_no: i + 1, starts_at: m[1], minutes: Number(m[2]) } : null; }).filter(Boolean); const j = await post({ action: 'suggest', level_no: Number(sug.level_no), weekdays: sug.weekdays.split(',').map((x) => Number(x.trim())).filter((x) => !Number.isNaN(x)), times, from_day: sug.from_day, to_day: sug.to_day, per_week: Number(sug.per_week || 1) }); if (j?.success) { setProposed(j.proposed); setSugNote(j.note_ar + (j.unplaced?.length ? ` لم يُوزَّع: ${j.unplaced.map((u: any) => u.line_ar).join(' · ')}` : '')); } }
  async function adoptAll() { if (!proposed?.length || !confirm(`اعتماد ${proposed.length} سطرًا وتوليد محاضراتها؟`)) return; const j = await post({ action: 'adopt', proposed }); if (j?.success) { flash(`اعتُمد ${j.saved} سطرًا — ${j.lectures} محاضرة.`); setProposed(null); if (tok) load(tok); } }
  async function findSub(slot_id: string) { const day = prompt('تاريخ المحاضرة التي يغيب عنها الأستاذ (YYYY-MM-DD)', d?.today || ''); if (!day) return; const j = await post({ action: 'substitutes', slot_id, day }); if (j?.success) setSub({ slot_id, day, candidates: j.candidates, line_ar: j.line_ar }); }
  async function pickSub(trainer_id: string) { if (!sub) return; const j = await post({ action: 'substitute', slot_id: sub.slot_id, day: sub.day, trainer_id }); if (j?.success) { flash(`اعتُمد البديل — أُبلغت الشعبة (${j.notified}).`); setSub(null); if (tok) load(tok); } }
  async function decide(id: number, status: 'done' | 'declined', to?: string | null) { const to_classroom = status === 'done' ? (to || prompt('معرّف/اختيار الشعبة الجديدة — اكتب رقم الشعبة', '') || null) : null; const pick = to_classroom && !d?.sections.some((s) => s.id === to_classroom) ? d?.sections.find((s) => secName(s.id) === `شعبة ${Number(to_classroom)}`)?.id || null : to_classroom; if (status === 'done' && !pick) { setErr('حدّد الشعبة الجديدة'); return; } const j = await post({ action: 'move_decide', id, status, to_classroom: pick }); if (j?.success) { flash(status === 'done' ? 'نُقل المتدرّب وأُبلغ.' : 'أُغلق الطلب وأُبلغ المتدرّب.'); if (tok) load(tok); } }
  const byLevel = useMemo(() => { const m = new Map<number, typeof d extends null ? never : NonNullable<typeof d>['courses']>(); for (const c of d?.courses || []) { const k = c.level_no || 0; m.set(k, [...(m.get(k) || []), c]); } return [...m.entries()].sort((a, b) => a[0] - b[0]); }, [d]);
  const ro = !d?.can_edit;
  return <main className="ds" dir="rtl" data-testid="ds-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <nav className="ds-nav" aria-label="تنقّل"><Link href="/me/day" className="ds-link"><Icon name="arrow" size={14} /> دفتر اليوم</Link><Link href="/me/reports" className="ds-link"><Icon name="reports" size={14} /> ملف الدبلوم</Link><Link href="/me" className="ds-link"><Icon name="home" size={14} /> مساحتي</Link>{d && <button type="button" className="ds-link ds-btnlink" data-testid="ds-print" onClick={() => window.print()}><Icon name="print" size={14} /> اطبع الهيكل</button>}</nav>
    <header className="ds-head"><span className="pt-kicker"><Icon name="programs" size={14} /> {d?.names.official || 'هيكل الدبلوم'}</span><h1>🏛️ {d?.names.page || 'هيكل الدبلوم'}{d && <small data-testid="ds-prog"> — {d.program.name_ar}</small>}</h1>
      <p>التسلسل في كل شاشة وتقرير وإشعار: <b>اسم الدبلوم : المستوى — المقرّر — الشعبة — أستاذ المادة</b>. الأوقات والمدد تكتبها أنت بالعرف الأكاديمي — لكل مقرّر مدّته، وللفترات الخاصّة (رمضان…) حكمها.</p></header>
    {err && <p className="ds-err" role="alert" data-testid="ds-err">{err}</p>}
    {msg && <p className="ds-ok" role="status" data-testid="ds-ok">{msg}</p>}
    {!program && list && <section className="pt-box" data-testid="ds-list"><h2><Icon name="programs" size={16} /> اختر البرنامج</h2>{!list.length && <p className="ds-muted">لا برامج تشرف على هيكلها بعد. المشرف يضيف الدبلوم ومقرّراته من «ملف الدبلوم» ثم يعود هنا.</p>}
      <ul className="ds-courses">{list.map((p) => <li key={p.id} data-testid="ds-list-item"><a href={`/me/diploma?program=${p.id}`} className="ds-line">{p.name_ar}</a><small className="ds-muted">{p.is_diploma ? 'دبلوم' : 'برنامج'} · {p.courses} مقرّرًا · {p.sections} شعبة · {p.role_ar}</small></li>)}</ul></section>}
    {d && <>
      {/* 1) المقرّرات بالمستوى */}
      <section className="pt-box" id="courses"><h2><Icon name="book" size={16} /> {d.names.courses} <small>{d.courses.length} مقرّرًا · {d.levels.length} مستوى بجدول</small>{!ro && <label className="ds-inline">عدد المستويات <input type="number" min={0} max={d.limits.maxLevels} defaultValue={d.program.levels_count} onBlur={(e) => saveCourse('', { levels_count: Number(e.target.value), unit_id: undefined })} /></label>}</h2>
        {!d.courses.length && <p className="ds-muted">لا مقرّرات بعد — أضفها من «ملف الدبلوم» (وحدات الدبلوم) أو استوردها من التصميم، ثم عُد لتضع المستوى وأستاذ المادة.</p>}
        {byLevel.map(([lv, cs]) => <div key={lv} className="ds-level" data-testid="ds-level" data-level={lv}><h3>{lv ? `${d.names.level} ${lv}` : 'بلا مستوى بعد'}{d.current_level?.level_no === lv && <em> · الجاري</em>}</h3>
          <ul className="ds-courses">{cs.map((c) => <li key={c.id} data-testid="ds-course"><b>{c.code ? `${c.code} · ` : ''}{c.title_ar}</b>
            {ro ? <span className="ds-muted">{insName(c.trainer_id)}</span> : <span className="ds-ctl">
              <label>{d.names.level} <select data-testid="ds-course-level" value={c.level_no || ''} onChange={(e) => saveCourse(c.id, { level_no: e.target.value ? Number(e.target.value) : null })}><option value="">—</option>{Array.from({ length: d.limits.maxLevels }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label>{d.names.instructor} <select data-testid="ds-course-trainer" value={c.trainer_id || ''} onChange={(e) => saveCourse(c.id, { trainer_id: e.target.value || null })}><option value="">—</option>{d.instructors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
              <label>الرمز <input defaultValue={c.code || ''} maxLength={20} onBlur={(e) => e.target.value !== (c.code || '') && saveCourse(c.id, { code: e.target.value })} /></label></span>}
          </li>)}</ul></div>)}
      </section>
      {/* 2) الشُّعب والمحاضرات */}
      <section className="pt-box" id="slots"><h2><Icon name="calendar" size={16} /> {d.names.slots} <small>{d.slots.length} سطرًا · {d.sections.length} شعبة</small></h2>
        {!!d.conflicts.length && <div className="ds-conf" role="alert"><b>{d.names.conflicts}: {d.conflicts.length}</b><ul>{d.conflicts.map((c, i) => <li key={i} data-testid="ds-conflict">{c.text_ar}</li>)}</ul></div>}
        <ul className="ds-slots">{d.slots.map((s) => <li key={s.id} data-testid="ds-slot" data-weekday={s.weekday}><span className="ds-when">{s.weekday_ar} · المحاضرة {s.period_no} · {s.starts_at} · {s.minutes} د</span><b className="ds-line" data-testid="ds-line">{s.line_ar}</b><small className="ds-muted">{s.from_day} → {s.to_day}{s.room_ar ? ` · ${s.room_ar}` : ''} · {s.lectures_left} محاضرة قادمة</small>
          {!ro && <span className="ds-ctl"><button type="button" className="ds-btn" onClick={() => setSlot({ id: s.id, unit_id: s.unit_id, classroom_id: s.classroom_id, trainer_id: s.trainer_id || '', weekday: String(s.weekday), period_no: String(s.period_no), starts_at: s.starts_at, minutes: String(s.minutes), from_day: s.from_day, to_day: s.to_day, room_ar: s.room_ar || '' })}>تعديل</button><button type="button" className="ds-btn" data-testid="ds-sub-run" onClick={() => findSub(s.id)}>{d.names.substitute}</button><button type="button" className="ds-btn ds-danger" data-testid="ds-slot-del" onClick={() => delSlot(s.id)}>حذف</button></span>}</li>)}</ul>
        {sub && <div className="ds-sub" data-testid="ds-sub"><b>{d.names.substitute} — {sub.day}</b><p className="ds-muted">{sub.line_ar}</p>{!sub.candidates.length && <p>لا أستاذ متفرّغ في هذا الوقت — عدّل المحاضرة أو أجّلها.</p>}<ul>{sub.candidates.map((c) => <li key={c.id}><button type="button" className="ds-btn" data-testid="ds-sub-pick" onClick={() => pickSub(c.id)}>{c.name}</button> <small className="ds-muted">{c.why_ar}</small></li>)}</ul><button type="button" className="ds-btn" onClick={() => setSub(null)}>إغلاق</button></div>}
        {!ro && <form className="ds-form" data-testid="ds-slot-form" onSubmit={(e) => { e.preventDefault(); saveSlot(); }}>
          <h3>{slot.id ? 'تعديل سطر' : 'سطر جديد'} <small className="ds-muted">{last.starts_at ? `آخر ما كتبتَه: ${last.starts_at} · ${last.minutes} د` : 'الوقت والمدّة بالعرف الأكاديمي عندكم'}</small></h3>
          <div className="ds-grid4">
            <label>{d.names.course}<select required value={slot.unit_id} onChange={(e) => setSlot({ ...slot, unit_id: e.target.value })}><option value="">—</option>{d.courses.map((c) => <option key={c.id} value={c.id}>{c.level_no ? `م${c.level_no} · ` : ''}{c.title_ar}</option>)}</select></label>
            <label>{d.names.section}<select required value={slot.classroom_id} onChange={(e) => setSlot({ ...slot, classroom_id: e.target.value })}><option value="">—</option>{d.sections.map((s) => <option key={s.id} value={s.id}>{secName(s.id)}</option>)}</select></label>
            <label>{d.names.instructor} <small>(فارغ = أستاذ المقرّر)</small><select value={slot.trainer_id} onChange={(e) => setSlot({ ...slot, trainer_id: e.target.value })}><option value="">—</option>{d.instructors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>اليوم<select value={slot.weekday} onChange={(e) => setSlot({ ...slot, weekday: e.target.value })}>{d.weekdays_ar.map((w, i) => <option key={i} value={i}>{w}</option>)}</select></label>
            <label>رقم المحاضرة<input type="number" min={1} max={d.limits.maxPeriods} value={slot.period_no} onChange={(e) => setSlot({ ...slot, period_no: e.target.value })} /></label>
            <label>وقت البدء<input type="time" required value={slot.starts_at} onChange={(e) => setSlot({ ...slot, starts_at: e.target.value })} /></label>
            <label>المدّة (دقيقة)<input type="number" required min={d.limits.minMinutes} max={d.limits.maxMinutes} value={slot.minutes} onChange={(e) => setSlot({ ...slot, minutes: e.target.value })} /></label>
            <label>القاعة<input value={slot.room_ar} maxLength={80} onChange={(e) => setSlot({ ...slot, room_ar: e.target.value })} /></label>
            <label>من<input type="date" required value={slot.from_day} onChange={(e) => setSlot({ ...slot, from_day: e.target.value })} /></label>
            <label>إلى<input type="date" required value={slot.to_day} onChange={(e) => setSlot({ ...slot, to_day: e.target.value })} /></label>
          </div>
          <div className="ds-row"><button type="submit" className="ds-btn ds-primary" data-testid="ds-slot-save" disabled={busy}>{slot.id ? 'احفظ التعديل' : 'أضف السطر وولّد محاضراته'}</button>{slot.id && <button type="button" className="ds-btn" onClick={() => setSlot(emptySlot())}>إلغاء</button>}<button type="button" className="ds-btn" onClick={async () => { const j = await post({ action: 'regenerate' }); if (j?.success) flash(`أُعيد توليد ${j.lectures} محاضرة قادمة.`); }}>{d.names.generate} من جديد</button></div>
        </form>}
      </section>
      {/* 3) شبكة الأسبوع */}
      <section className="pt-box" id="grid"><h2><Icon name="table" size={16} /> {d.names.grid}</h2>
        <div className="ds-gridwrap"><table className="ds-table" data-testid="ds-grid"><thead><tr><th>المحاضرة</th>{d.grid.days.map((w) => <th key={w}>{d.weekdays_ar[w]}</th>)}</tr></thead>
          <tbody>{d.grid.periods.map((p) => <tr key={p}><th>{p}</th>{d.grid.days.map((w) => { const ids = d.grid.cells[`${w}:${p}`] || []; const cf = d.conflicts.some((c) => c.weekday === w && ids.includes(c.a)); return <td key={w} data-testid="ds-cell" className={cf ? 'bad' : ''}>{ids.map((id) => { const s = d.slots.find((x) => x.id === id)!; return <div key={id} className="ds-chip"><b>{courseName(s.unit_id)}</b><span>{secName(s.classroom_id)} · {insName(s.instructor_id)}</span><small>{s.starts_at}–{s.minutes}د</small></div>; })}</td>; })}</tr>)}</tbody></table></div>
      </section>
      {/* 4) الفترات الخاصّة */}
      <section className="pt-box" id="periods"><h2><Icon name="clock" size={16} /> {d.names.periods} <small>رمضان · الاختبارات · الصيف — تغيّر المدّة أو الوقت ضمن مداها ثم تعود المحاضرات كما كانت</small></h2>
        <ul className="ds-periods">{d.periods.map((p) => <li key={p.id} data-testid="ds-period"><b>{p.name_ar}</b> <span>{p.from_day} → {p.to_day}</span> <small className="ds-muted">{p.lecture_minutes ? `المحاضرة ${p.lecture_minutes} د` : ''}{p.first_lecture_at ? ` · أول محاضرة ${p.first_lecture_at}` : ''}{p.lecture_break_min !== null ? ` · فاصل ${p.lecture_break_min}` : ''}{p.shift_minutes ? ` · إزاحة ${p.shift_minutes} د` : ''}</small>{!ro && <button type="button" className="ds-btn ds-danger" onClick={() => delPeriod(p.id)}>حذف</button>}</li>)}</ul>
        {!ro && <form className="ds-form" data-testid="ds-period-form" onSubmit={(e) => { e.preventDefault(); savePeriod(); }}><div className="ds-grid4">
          <label>اسم الفترة<input required value={period.name_ar} onChange={(e) => setPeriod({ ...period, name_ar: e.target.value })} placeholder="شهر رمضان 1448" /></label>
          <label>من<input type="date" required value={period.from_day} onChange={(e) => setPeriod({ ...period, from_day: e.target.value })} /></label>
          <label>إلى<input type="date" required value={period.to_day} onChange={(e) => setPeriod({ ...period, to_day: e.target.value })} /></label>
          <label>مدّة المحاضرة<input type="number" min={d.limits.minMinutes} max={d.limits.maxMinutes} value={period.lecture_minutes} onChange={(e) => setPeriod({ ...period, lecture_minutes: e.target.value })} placeholder="كما هي" /></label>
          <label>أول محاضرة<input type="time" value={period.first_lecture_at} onChange={(e) => setPeriod({ ...period, first_lecture_at: e.target.value })} /></label>
          <label>فاصل (د)<input type="number" min={0} max={60} value={period.lecture_break_min} onChange={(e) => setPeriod({ ...period, lecture_break_min: e.target.value })} /></label>
          <label>إزاحة (د)<input type="number" min={-720} max={720} value={period.shift_minutes} onChange={(e) => setPeriod({ ...period, shift_minutes: e.target.value })} /></label>
        </div><button type="submit" className="ds-btn ds-primary" data-testid="ds-period-save" disabled={busy}>احفظ الفترة وأعد توليد المحاضرات القادمة</button></form>}
      </section>
      {/* 5) الميسِّر يقترح */}
      {!ro && <section className="pt-box" id="suggest" data-testid="ds-suggest"><h2><Icon name="spark" size={16} /> {d.names.suggest} <small>خوارزمية قيود بلا تعارض — أنت تعتمد أو تسحب الخلايا</small></h2>
        <div className="ds-grid4">
          <label>{d.names.level}<input type="number" min={1} max={d.limits.maxLevels} value={sug.level_no} onChange={(e) => setSug({ ...sug, level_no: e.target.value })} /></label>
          <label>أيام الأسبوع (0=الأحد)<input value={sug.weekdays} onChange={(e) => setSug({ ...sug, weekdays: e.target.value })} /></label>
          <label>من<input type="date" value={sug.from_day} onChange={(e) => setSug({ ...sug, from_day: e.target.value })} /></label>
          <label>إلى<input type="date" value={sug.to_day} onChange={(e) => setSug({ ...sug, to_day: e.target.value })} /></label>
          <label>محاضرات المقرّر في الأسبوع<input type="number" min={1} max={3} value={sug.per_week} onChange={(e) => setSug({ ...sug, per_week: e.target.value })} /></label>
          <label className="ds-wide">أوقات المحاضرات ومددها — سطر لكل محاضرة بالعرف عندكم (مثال: 16:00 110)<textarea rows={3} value={sug.times} onChange={(e) => setSug({ ...sug, times: e.target.value })} /></label>
        </div>
        <button type="button" className="ds-btn ds-primary" data-testid="ds-suggest-run" disabled={busy} onClick={runSuggest}>اقترح</button>
        {proposed && <div className="ds-proposed" data-testid="ds-proposed"><p>{sugNote}</p><ul>{proposed.map((p) => <li key={p.key}><span className="ds-when">{p.weekday_ar} · المحاضرة {p.period_no} · {p.starts_at}</span> <b>{p.line_ar}</b> <button type="button" className="ds-btn" onClick={() => setProposed(proposed.filter((x) => x.key !== p.key))}>اسحب</button></li>)}</ul>{!!proposed.length && <button type="button" className="ds-btn ds-primary" data-testid="ds-adopt" disabled={busy} onClick={adoptAll}>اعتمد {proposed.length} سطرًا وولّد المحاضرات</button>}</div>}
      </section>}
      {/* 7) طلبات النقل */}
      {!ro && <section className="pt-box" id="requests"><h2><Icon name="users" size={16} /> {d.names.requests} <small>{d.requests.length} مفتوح</small></h2>
        {!d.requests.length && <p className="ds-muted">لا طلبات مفتوحة.</p>}
        <ul className="ds-reqs">{d.requests.map((r: any) => <li key={r.id} data-testid="ds-request"><b>{r.from_ar} ← {r.to_ar}</b> <span>{r.reason_ar}</span> <small className="ds-muted">{String(r.created_at).slice(0, 10)}</small><span className="ds-ctl"><button type="button" className="ds-btn ds-primary" data-testid="ds-request-done" onClick={() => decide(r.id, 'done', r.to_classroom)}>نفّذ النقل</button><button type="button" className="ds-btn" data-testid="ds-request-decline" onClick={() => decide(r.id, 'declined')}>اعتذر</button></span></li>)}</ul>
      </section>}
      <p className="ds-foot"><Icon name="shield" size={13} /> الجدول معلومة تنظيمية. ما يكتبه المتدرّبون لا يدخل في تقييم، ولا يظهر لأستاذ المادة إلا مجمَّعًا بلا أسماء حين يبلغون خمسة.</p>
    </>}
  </main>;
}

const CSS = `
.ds{font-family:var(--font-ar),Tajawal,Arial,sans-serif;max-width:1100px;margin:0 auto;padding:16px 12px 60px;color:#0f172a;display:flex;flex-direction:column;gap:12px}
.ds-nav{display:flex;gap:8px;flex-wrap:wrap}.ds-link{display:inline-flex;align-items:center;gap:5px;border:1px solid #e2e8f0;border-radius:999px;padding:6px 12px;font-size:12.5px;font-weight:800;color:#0f2a4e;text-decoration:none;background:#f8fafc}.ds-btnlink{font:inherit;cursor:pointer}
.ds-head h1{margin:4px 0;font-size:22px;color:#0f2a4e}.ds-head small{font-size:14px;color:#64748b;font-weight:700}.ds-head p{margin:4px 0 0;font-size:13.5px;line-height:1.8;color:#334155;background:#f8fafc;border-radius:10px;padding:10px 12px}
.ds h2{margin:0 0 8px;font-size:16px;color:#0f2a4e;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ds h2 small{font-size:12px;color:#64748b;font-weight:700}.ds h3{margin:8px 0 4px;font-size:14px;color:#0f2a4e}.ds h3 em{font-style:normal;color:#0b8a83}
.ds-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px}.ds-ok{background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px}
.ds-muted{color:#64748b;font-size:12.5px;font-weight:700}.ds-inline{font-size:12.5px;display:inline-flex;gap:6px;align-items:center;margin-inline-start:auto}.ds-inline input{width:64px}
.ds-courses,.ds-slots,.ds-periods,.ds-reqs,.ds-proposed ul,.ds-sub ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ds-courses li,.ds-slots li,.ds-periods li,.ds-reqs li{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:13.5px;background:#fff}
.ds-ctl{display:inline-flex;gap:6px;flex-wrap:wrap;margin-inline-start:auto;align-items:center}.ds-ctl label{font-size:12px;font-weight:800;color:#475569;display:inline-flex;gap:4px;align-items:center}
.ds input,.ds select,.ds textarea{border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;background:#fff;min-height:36px}.ds textarea{min-height:64px}
.ds-when{font-size:12px;font-weight:900;color:#0b8a83;background:#ecfeff;border-radius:999px;padding:3px 9px}.ds-line{font-size:13.5px;color:#0f2a4e}
.ds-form{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-top:10px;background:#fafbfc}.ds-grid4{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.ds-grid4 label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:800;color:#475569}.ds-wide{grid-column:1/-1}
.ds-row{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.ds-btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:900;color:#0f2a4e;cursor:pointer;min-height:36px}.ds-primary{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.ds-danger{color:#b91c1c;border-color:#fecaca}.ds-btn:disabled{opacity:.5;cursor:not-allowed}
.ds-conf{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:8px 12px;font-size:13px;margin-bottom:8px}.ds-conf ul{margin:4px 0 0;padding-inline-start:18px}
.ds-gridwrap{overflow-x:auto}.ds-table{border-collapse:collapse;width:100%;font-size:12.5px}.ds-table th,.ds-table td{border:1px solid #e2e8f0;padding:6px;vertical-align:top;min-width:120px}.ds-table th{background:#f8fafc;color:#0f2a4e}.ds-table td.bad{background:#fef2f2}
.ds-chip{display:flex;flex-direction:column;gap:1px;background:#f1f5f9;border-radius:8px;padding:5px 7px;margin-bottom:4px}.ds-chip b{font-size:12.5px;color:#0f2a4e}.ds-chip span,.ds-chip small{font-size:11.5px;color:#475569}
.ds-sub,.ds-proposed{border:1px solid #bbf7d0;background:#f0fdf4;border-radius:12px;padding:10px 12px;margin-top:8px;font-size:13px}.ds-proposed li{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:4px 0;border-bottom:1px dashed #d1fae5}
.ds-foot{display:flex;gap:6px;align-items:center;color:#64748b;font-size:12px;font-weight:700}
@media print{.ds-nav,.ds-form,.ds-ctl,.ds-btn,#suggest,#requests,.ds-foot{display:none!important}.ds{max-width:none}}
@media (max-width:420px){.ds-ctl{margin-inline-start:0}}
`;
