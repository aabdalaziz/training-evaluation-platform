'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { qrSvg } from '../../../lib/certificates/qr';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { STATUS_LABEL, STATUS_ORDER, attendUrl, eligible, makeToken, riyadhToday, sessionCsvRows, summarize, summaryCsvRows } from '../../../lib/attendance/model';
import type { AttendanceRecord, AttendanceSession, PersonSummary, RecordStatus } from '../../../lib/attendance/model';

type Program = { id: string; name_ar: string; name_en?: string | null; status?: string | null };
type Classroom = { id: string; code: string; program_id: string | null; trainer_id?: string | null };
type Trainer = { id: string; name: string };
type Counts = { present: number; late: number; excused: number; absent: number };

const NAVY = '#0f2a4e';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST', 'TRAINER'];
const LIVE_MS = 10000;

export default function AttendanceAdminPage() {
  return <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>…</div>}><Inner /></Suspense>;
}

function Inner() {
  const db = supabase();
  const router = useRouter();
  const params = useSearchParams();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState(''); const [orgId, setOrgId] = useState<string | null>(null); const [me, setMe] = useState({ id: '', name: '' });
  const [programs, setPrograms] = useState<Program[]>([]); const [classrooms, setClassrooms] = useState<Classroom[]>([]); const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]); const [counts, setCounts] = useState<Record<string, Counts>>({});
  const [error, setError] = useState(''); const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const [mode, setMode] = useState<'list' | 'new' | 'view' | 'summary'>('list');
  const [filterProgram, setFilterProgram] = useState(''); const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [form, setForm] = useState({ program_id: '', classroom_id: '', trainer_id: '', title: '', session_date: riyadhToday(), start_time: '', end_time: '', late_after_min: 15, require_phone: false, notes: '' });
  const [busy, setBusy] = useState('');

  // عرض جلسة
  const [current, setCurrent] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [manual, setManual] = useState({ name: '', email: '', phone: '', status: 'present' as RecordStatus });
  const [qrOpen, setQrOpen] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const liveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ملخص البرنامج
  const [sumProgram, setSumProgram] = useState(''); const [sumClassroom, setSumClassroom] = useState(''); const [minPct, setMinPct] = useState(80);
  const [sumRecords, setSumRecords] = useState<AttendanceRecord[]>([]); const [sumBusy, setSumBusy] = useState(false);

  const pName = (id: string | null) => programs.find(p => p.id === id)?.name_ar || '—';
  const cCode = (id: string | null) => classrooms.find(c => c.id === id)?.code || '';
  const tName = (id: string | null) => trainers.find(t => t.id === id)?.name || '';

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/attendance'); return; }
      const [p, pg, cl, tr] = await Promise.all([
        db.from('profiles').select('role,organization_id,full_name').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,name_en,status').order('name_ar'),
        db.from('classrooms').select('id,code,program_id,trainer_id').order('code'),
        db.from('trainers').select('id,name').order('name'),
      ]);
      setRole(String(p.data?.role || '')); setOrgId(p.data?.organization_id || null); setMe({ id: user.id, name: p.data?.full_name || user.email || '' });
      setPrograms(((pg.data || []) as Program[]).filter(x => x.status !== 'CANCELLED')); setClassrooms((cl.data || []) as Classroom[]); setTrainers((tr.data || []) as Trainer[]);
      await loadSessions();
      setReady(true);
      const sid = params.get('s'); const pid = params.get('program');
      if (sid) openSession(sid);
      else if (pid) { setSumProgram(pid); setMode('summary'); }
      else if (params.get('new') === '1') setMode('new');
    })();
    return () => { if (liveRef.current) clearInterval(liveRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadSessions() {
    const { data, error } = await db.from('attendance_sessions').select('*').order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
    if (error) { setError(error.message); return; }
    const rows = (data || []) as AttendanceSession[]; setSessions(rows);
    if (rows.length) {
      const { data: rc } = await db.from('attendance_records').select('session_id,status').in('session_id', rows.map(r => r.id)).limit(20000);
      const c: Record<string, Counts> = {};
      for (const r of (rc || []) as any[]) { c[r.session_id] ||= { present: 0, late: 0, excused: 0, absent: 0 }; c[r.session_id][r.status as RecordStatus] += 1; }
      setCounts(c);
    } else setCounts({});
  }

  /* ---------- إنشاء جلسة ---------- */
  function startNew(programId = '') {
    const pid = programId || filterProgram || '';
    setForm({ program_id: pid, classroom_id: '', trainer_id: '', title: '', session_date: riyadhToday(), start_time: '', end_time: '', late_after_min: 15, require_phone: false, notes: '' });
    setMode('new'); setError('');
  }
  function pickClassroom(cid: string) {
    const c = classrooms.find(x => x.id === cid);
    setForm(f => ({ ...f, classroom_id: cid, trainer_id: f.trainer_id || c?.trainer_id || '' }));
  }
  async function createSession() {
    setError('');
    if (!form.program_id) { setError('اختر البرنامج'); return; }
    const title = form.title.trim() || `جلسة ${form.session_date}${form.classroom_id ? ' · ' + cCode(form.classroom_id) : ''}`;
    setBusy('create');
    try {
      const payload: any = {
        organization_id: orgId, program_id: form.program_id, classroom_id: form.classroom_id || null, trainer_id: form.trainer_id || null,
        title, session_date: form.session_date, start_time: form.start_time || null, end_time: form.end_time || null,
        late_after_min: Math.max(0, Math.min(240, Number(form.late_after_min) || 0)), require_phone: !!form.require_phone, notes: form.notes.trim() || null,
        token: makeToken(), status: 'open', created_by: me.id, created_by_name: me.name,
      };
      const { data, error } = await db.from('attendance_sessions').insert(payload).select('*').single();
      if (error) throw new Error(error.message);
      flash('تم إنشاء الجلسة — اعرض رمز QR للمتدربين');
      await loadSessions();
      openSession((data as any).id, data as AttendanceSession);
      setQrOpen(true);
    } catch (e: any) { setError('تعذر إنشاء الجلسة: ' + e.message); } finally { setBusy(''); }
  }

  /* ---------- عرض جلسة + تحديث حي ---------- */
  async function openSession(id: string, pre?: AttendanceSession) {
    let s = pre || sessions.find(x => x.id === id) || null;
    if (!s) { const { data } = await db.from('attendance_sessions').select('*').eq('id', id).maybeSingle(); s = (data as AttendanceSession) || null; }
    if (!s) { setError('الجلسة غير موجودة'); return; }
    setCurrent(s); setMode('view'); setQrOpen(false); setManual({ name: '', email: '', phone: '', status: 'present' });
    await loadRecords(s.id);
    if (liveRef.current) clearInterval(liveRef.current);
    liveRef.current = setInterval(() => loadRecords(s!.id, true), LIVE_MS);
  }
  function backToList() { if (liveRef.current) clearInterval(liveRef.current); liveRef.current = null; setCurrent(null); setMode('list'); loadSessions(); }
  async function loadRecords(sid: string, silent = false) {
    const { data, error } = await db.from('attendance_records').select('*').eq('session_id', sid).order('checked_in_at', { ascending: true }).limit(5000);
    if (error) { if (!silent) setError(error.message); return; }
    setRecords((data || []) as AttendanceRecord[]); setLastSync(new Date());
  }
  async function toggleStatus(s: AttendanceSession) {
    const next = s.status === 'open' ? 'closed' : 'open';
    if (next === 'closed' && !confirm(`إغلاق تسجيل الحضور لجلسة «${s.title}»؟ يمكن إعادة فتحها لاحقًا.`)) return;
    const { data, error } = await db.from('attendance_sessions').update({ status: next }).eq('id', s.id).select('*').single();
    if (error) { setError(error.message); return; }
    const u = data as AttendanceSession; setSessions(l => l.map(x => (x.id === u.id ? u : x))); if (current?.id === u.id) setCurrent(u);
    flash(next === 'closed' ? 'أُغلقت الجلسة' : 'أُعيد فتح الجلسة');
  }
  async function removeSession(s: AttendanceSession) {
    const c = counts[s.id]; const n = c ? c.present + c.late + c.excused + c.absent : 0;
    if (!confirm(`حذف جلسة «${s.title}» نهائيًا${n ? ` مع ${n} سجل حضور` : ''}؟`)) return;
    const { error } = await db.from('attendance_records').delete().eq('session_id', s.id);
    if (error) { setError(error.message); return; }
    const r2 = await db.from('attendance_sessions').delete().eq('id', s.id);
    if (r2.error) { setError(r2.error.message); return; }
    flash('تم الحذف'); if (current?.id === s.id) backToList(); else loadSessions();
  }
  async function addManual() {
    if (!current) return; setError('');
    if (manual.name.trim().length < 3) { setError('اكتب الاسم الكامل (3 أحرف على الأقل)'); return; }
    setBusy('manual');
    try {
      const { error } = await db.from('attendance_records').insert({ session_id: current.id, full_name: manual.name.trim(), email: manual.email.trim() || null, phone: manual.phone.trim() || null, status: manual.status, method: 'manual' });
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? 'هذا الشخص مسجّل في الجلسة مسبقًا' : error.message);
      setManual({ name: '', email: '', phone: '', status: 'present' }); flash('تمت الإضافة'); await loadRecords(current.id);
    } catch (e: any) { setError(e.message); } finally { setBusy(''); }
  }
  async function setRecordStatus(r: AttendanceRecord, status: RecordStatus) {
    const { error } = await db.from('attendance_records').update({ status }).eq('id', r.id);
    if (error) { setError(error.message); return; }
    setRecords(l => l.map(x => (x.id === r.id ? { ...x, status } : x)));
  }
  async function removeRecord(r: AttendanceRecord) {
    if (!confirm(`حذف سجل «${r.full_name}»؟`)) return;
    const { error } = await db.from('attendance_records').delete().eq('id', r.id);
    if (error) { setError(error.message); return; }
    setRecords(l => l.filter(x => x.id !== r.id));
  }
  async function importFromPrevious() {
    if (!current) return;
    const prev = sessions.filter(s => s.program_id === current.program_id && s.id !== current.id && (!current.classroom_id || !s.classroom_id || s.classroom_id === current.classroom_id));
    if (!prev.length) { setError('لا توجد جلسات سابقة لهذا البرنامج'); return; }
    setBusy('import');
    try {
      const { data, error } = await db.from('attendance_records').select('full_name,email,phone,identity_key').in('session_id', prev.map(s => s.id)).limit(10000);
      if (error) throw new Error(error.message);
      const have = new Set(records.map(r => r.identity_key)); const seen = new Set<string>(); const rows: any[] = [];
      for (const r of (data || []) as any[]) { if (have.has(r.identity_key) || seen.has(r.identity_key)) continue; seen.add(r.identity_key); rows.push({ session_id: current.id, full_name: r.full_name, email: r.email, phone: r.phone, status: 'absent', method: 'import' }); }
      if (!rows.length) { flash('لا توجد أسماء جديدة للاستيراد'); return; }
      if (!confirm(`إضافة ${rows.length} اسمًا من الجلسات السابقة بحالة «غائب» (تتحول إلى حاضر عند تسجيلهم)؟`)) return;
      const r2 = await db.from('attendance_records').insert(rows);
      if (r2.error) throw new Error(r2.error.message);
      flash(`أُضيف ${rows.length} اسمًا`); await loadRecords(current.id);
    } catch (e: any) { setError('تعذر الاستيراد: ' + e.message); } finally { setBusy(''); }
  }
  function exportSession() {
    if (!current) return;
    downloadCSV(safeFilename(`attendance_${current.session_date}_${cCode(current.classroom_id) || 'session'}`), sessionCsvRows(current, records, pName(current.program_id), cCode(current.classroom_id) || null));
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); flash('تم نسخ الرابط'); } catch { prompt('انسخ الرابط:', text); } }

  /* ---------- ملخص البرنامج ---------- */
  const sumSessions = useMemo(() => sessions.filter(s => s.program_id === sumProgram && (!sumClassroom || s.classroom_id === sumClassroom)), [sessions, sumProgram, sumClassroom]);
  useEffect(() => {
    if (mode !== 'summary' || !sumProgram) { setSumRecords([]); return; }
    if (!sumSessions.length) { setSumRecords([]); return; }
    (async () => {
      setSumBusy(true);
      const { data, error } = await db.from('attendance_records').select('*').in('session_id', sumSessions.map(s => s.id)).limit(20000);
      if (error) setError(error.message); else setSumRecords((data || []) as AttendanceRecord[]);
      setSumBusy(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sumProgram, sumClassroom, sessions]);
  const summary: PersonSummary[] = useMemo(() => summarize(sumSessions, sumRecords), [sumSessions, sumRecords]);
  const okList = useMemo(() => eligible(summary, minPct), [summary, minPct]);
  function exportSummary() { downloadCSV(safeFilename(`attendance_summary_${(pName(sumProgram) || '').replace(/\s+/g, '_')}`), summaryCsvRows(summary, pName(sumProgram))); }

  /* ---------- مشتقات ---------- */
  const allowed = ALLOWED.includes(role.toUpperCase()); const canWrite = WRITERS.includes(role.toUpperCase());
  const visible = sessions.filter(s => (!filterProgram || s.program_id === filterProgram) && (filterStatus === 'all' || s.status === filterStatus));
  const formClassrooms = classrooms.filter(c => !form.program_id || c.program_id === form.program_id);
  const sumClassrooms = classrooms.filter(c => c.program_id === sumProgram);
  const curCounts = useMemo(() => { const c: Counts = { present: 0, late: 0, excused: 0, absent: 0 }; for (const r of records) c[r.status] += 1; return c; }, [records]);
  const todayStr = riyadhToday();
  const openToday = sessions.filter(s => s.status === 'open' && s.session_date === todayStr).length;

  if (!ready) return <div className="aa" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="aa" dir="rtl">
      <style>{CSS}</style>
      <header className="aa-head">
        <div>
          <div className="aa-kicker"><Icon name="check" size={14} /> مركز الإدارة</div>
          <h1>الحضور الرقمي (QR)</h1>
          <p>أنشئ جلسة حضور لكل لقاء تدريبي، اعرض رمز QR على الشاشة أو اطبعه، ويسجّل المتدربون حضورهم من جوالاتهم خلال ثوانٍ. تُحتسب نسبة الحضور تلقائيًا لكل متدرب وتُستخدم شرطًا لإصدار الشهادات.</p>
        </div>
        <nav className="aa-nav">
          <Link href="/dashboard" className="aa-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/certificates" className="aa-btn"><Icon name="certificate" size={16} /> الشهادات</Link>
          {mode !== 'summary' && <button className="aa-btn" onClick={() => { setSumProgram(sumProgram || filterProgram || programs[0]?.id || ''); setMode('summary'); }}><Icon name="table" size={16} /> ملخص الحضور</button>}
          {mode !== 'list' && <button className="aa-btn" onClick={backToList}><Icon name="arrow" size={16} /> كل الجلسات</button>}
          {canWrite && mode === 'list' && <button className="aa-btn primary" onClick={() => startNew()}><Icon name="plus" size={16} /> جلسة جديدة</button>}
        </nav>
      </header>
      {!allowed && <div className="aa-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة ومديري البرامج والمدربين.</div>}
      {error && <div className="aa-alert err"><Icon name="alert" size={18} /> <span style={{ flex: 1 }}>{error}</span><button className="aa-x" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}

      {/* ===== قائمة الجلسات ===== */}
      {mode === 'list' && (
        <>
          <section className="aa-stats">
            <div className="aa-stat"><span>جلسات مفتوحة اليوم</span><b>{openToday}</b></div>
            <div className="aa-stat"><span>إجمالي الجلسات</span><b>{sessions.length}</b></div>
            <div className="aa-stat"><span>سجلات الحضور</span><b>{Object.values(counts).reduce((a, c) => a + c.present + c.late, 0)}</b></div>
            <div className="aa-stat"><span>برامج لها حضور</span><b>{new Set(sessions.map(s => s.program_id)).size}</b></div>
          </section>
          <section className="aa-card">
            <div className="aa-toolbar">
              <h2><Icon name="calendar" size={18} /> الجلسات <span className="aa-pill">{visible.length}</span></h2>
              <div className="aa-filters">
                <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)}><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
                <div className="aa-seg">{(['all', 'open', 'closed'] as const).map(k => <button key={k} className={filterStatus === k ? 'on' : ''} onClick={() => setFilterStatus(k)}>{k === 'all' ? 'الكل' : k === 'open' ? 'مفتوحة' : 'مغلقة'}</button>)}</div>
              </div>
            </div>
            {!visible.length && <div className="aa-empty"><Icon name="check" size={34} /><b>لا توجد جلسات بعد</b><span>ابدأ بـ «جلسة جديدة»: اختر البرنامج والقاعة والوقت، ثم اعرض رمز QR على الشاشة.</span></div>}
            <div className="aa-list">
              {visible.map(s => {
                const c = counts[s.id] || { present: 0, late: 0, excused: 0, absent: 0 };
                return (
                  <article key={s.id} className={`aa-item ${s.status}`}>
                    <div className="aa-item-main">
                      <div className="aa-item-title"><b>{s.title}</b><span className={`aa-status ${s.status}`}>{s.status === 'open' ? 'مفتوحة' : 'مغلقة'}</span>{s.session_date === todayStr && <span className="aa-today">اليوم</span>}</div>
                      <div className="aa-muted">{pName(s.program_id)}{s.classroom_id ? ` · ${cCode(s.classroom_id)}` : ''}{s.trainer_id ? ` · ${tName(s.trainer_id)}` : ''} · {s.session_date}{s.start_time ? ` · ${s.start_time.slice(0, 5)}${s.end_time ? '–' + s.end_time.slice(0, 5) : ''}` : ''} · الرمز <bdi className="aa-token">{s.token}</bdi></div>
                      <div className="aa-counts"><span className="ok">حاضر <b>{c.present}</b></span><span className="warn">متأخر <b>{c.late}</b></span><span>معتذر <b>{c.excused}</b></span><span className="bad">غائب <b>{c.absent}</b></span></div>
                    </div>
                    <div className="aa-item-actions">
                      <button className="aa-btn small primary" onClick={() => openSession(s.id)}><Icon name="play" size={14} /> عرض / QR</button>
                      {canWrite && <button className="aa-btn small" onClick={() => toggleStatus(s)}>{s.status === 'open' ? <><Icon name="pause" size={14} /> إغلاق</> : <><Icon name="refresh" size={14} /> إعادة فتح</>}</button>}
                      {canWrite && <button className="aa-btn small danger" onClick={() => removeSession(s)}><Icon name="trash" size={14} /></button>}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* ===== جلسة جديدة ===== */}
      {mode === 'new' && (
        <section className="aa-card">
          <h2><Icon name="plus" size={18} /> جلسة حضور جديدة</h2>
          <div className="aa-grid">
            <label><span>البرنامج <i>*</i></span><select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value, classroom_id: '' })}><option value="">— اختر —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <label><span>القاعة / المجموعة</span><select value={form.classroom_id} onChange={e => pickClassroom(e.target.value)}><option value="">— بدون —</option>{formClassrooms.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label>
            <label><span>المدرب</span><select value={form.trainer_id} onChange={e => setForm({ ...form, trainer_id: e.target.value })}><option value="">— بدون —</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="aa-span2"><span>عنوان الجلسة</span><input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder={`مثال: اليوم الأول — مقدمة (يُولَّد تلقائيًا إن تُرك فارغًا)`} /></label>
            <label><span>التاريخ <i>*</i></span><input type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} /></label>
            <label><span>وقت البداية</span><input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></label>
            <label><span>وقت النهاية</span><input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></label>
            <label><span>مهلة السماح قبل احتساب التأخر (دقيقة)</span><input type="number" min={0} max={240} value={form.late_after_min} onChange={e => setForm({ ...form, late_after_min: Number(e.target.value) })} /></label>
            <label className="aa-check"><input type="checkbox" checked={form.require_phone} onChange={e => setForm({ ...form, require_phone: e.target.checked })} /> رقم الجوال إلزامي عند التسجيل</label>
            <label className="aa-span3"><span>ملاحظات داخلية</span><input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label>
          </div>
          <div className="aa-row">
            <button className="aa-btn primary" onClick={createSession} disabled={!!busy || !form.program_id}><Icon name="check" size={16} /> {busy === 'create' ? 'جارٍ الإنشاء…' : 'إنشاء الجلسة وعرض QR'}</button>
            <button className="aa-btn" onClick={backToList}>إلغاء</button>
            <span className="aa-muted">يُحتسب «متأخرًا» من يسجّل بعد وقت البداية + المهلة (بتوقيت الرياض). بدون وقت بداية يُسجَّل الجميع «حاضرًا».</span>
          </div>
        </section>
      )}

      {/* ===== عرض جلسة ===== */}
      {mode === 'view' && current && (
        <>
          <section className="aa-card aa-cur">
            <div className="aa-cur-main">
              <div className="aa-item-title"><b style={{ fontSize: 19 }}>{current.title}</b><span className={`aa-status ${current.status}`}>{current.status === 'open' ? 'التسجيل مفتوح' : 'مغلقة'}</span></div>
              <div className="aa-muted">{pName(current.program_id)}{current.classroom_id ? ` · ${cCode(current.classroom_id)}` : ''}{current.trainer_id ? ` · ${tName(current.trainer_id)}` : ''} · {current.session_date}{current.start_time ? ` · ${current.start_time.slice(0, 5)}${current.end_time ? '–' + current.end_time.slice(0, 5) : ''}` : ''} · مهلة {current.late_after_min} د</div>
              <div className="aa-url"><bdi>{attendUrl(current.token)}</bdi><button className="aa-ic" title="نسخ" onClick={() => copy(attendUrl(current.token))}><Icon name="copy" size={14} /></button></div>
              <div className="aa-row" style={{ marginTop: 10 }}>
                <button className="aa-btn primary" onClick={() => setQrOpen(true)}><Icon name="play" size={16} /> عرض QR على الشاشة</button>
                {canWrite && <button className="aa-btn" onClick={() => toggleStatus(current)}>{current.status === 'open' ? <><Icon name="pause" size={16} /> إغلاق التسجيل</> : <><Icon name="refresh" size={16} /> إعادة الفتح</>}</button>}
                <button className="aa-btn" onClick={exportSession} disabled={!records.length}><Icon name="download" size={16} /> CSV</button>
                {canWrite && <button className="aa-btn" onClick={importFromPrevious} disabled={!!busy}><Icon name="users" size={16} /> استيراد الأسماء من الجلسات السابقة</button>}
              </div>
            </div>
            <div className="aa-live">
              <div className="aa-big"><b>{curCounts.present + curCounts.late}</b><span>حاضر</span></div>
              <div className="aa-counts"><span className="ok">حاضر <b>{curCounts.present}</b></span><span className="warn">متأخر <b>{curCounts.late}</b></span><span>معتذر <b>{curCounts.excused}</b></span><span className="bad">غائب <b>{curCounts.absent}</b></span></div>
              <small className="aa-muted"><Icon name="refresh" size={12} /> تحديث تلقائي كل {LIVE_MS / 1000} ث{lastSync ? ` · آخر مزامنة ${lastSync.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</small>
            </div>
          </section>

          {canWrite && (
            <section className="aa-card">
              <h2><Icon name="edit" size={18} /> تسجيل يدوي</h2>
              <div className="aa-manual">
                <input placeholder="الاسم الكامل *" value={manual.name} onChange={e => setManual({ ...manual, name: e.target.value })} />
                <input placeholder="البريد (اختياري)" dir="ltr" value={manual.email} onChange={e => setManual({ ...manual, email: e.target.value })} />
                <input placeholder="الجوال (اختياري)" dir="ltr" value={manual.phone} onChange={e => setManual({ ...manual, phone: e.target.value })} />
                <select value={manual.status} onChange={e => setManual({ ...manual, status: e.target.value as RecordStatus })}>{STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_LABEL[k].ar}</option>)}</select>
                <button className="aa-btn primary" onClick={addManual} disabled={!!busy}><Icon name="plus" size={15} /> إضافة</button>
              </div>
            </section>
          )}

          <section className="aa-card">
            <h2><Icon name="users" size={18} /> سجل الحضور <span className="aa-pill">{records.length}</span></h2>
            {!records.length && <div className="aa-empty"><Icon name="users" size={30} /><b>لم يسجّل أحد بعد</b><span>اعرض رمز QR — سيظهر كل تسجيل هنا فورًا.</span></div>}
            {!!records.length && (
              <div className="aa-tablewrap">
                <table className="aa-table">
                  <thead><tr><th>#</th><th>الاسم</th><th>البريد</th><th>الجوال</th><th>الوقت</th><th>الطريقة</th><th>الحالة</th>{canWrite && <th></th>}</tr></thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id}>
                        <td>{i + 1}</td><td><b>{r.full_name}</b></td><td dir="ltr">{r.email || '—'}</td><td dir="ltr">{r.phone || '—'}</td>
                        <td>{new Date(r.checked_in_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })}</td>
                        <td>{r.method === 'qr' ? 'QR' : r.method === 'manual' ? 'يدوي' : 'مستورد'}</td>
                        <td>{canWrite ? <select className={`aa-st ${r.status}`} value={r.status} onChange={e => setRecordStatus(r, e.target.value as RecordStatus)}>{STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_LABEL[k].ar}</option>)}</select> : <span className={`aa-st ${r.status}`}>{STATUS_LABEL[r.status].ar}</span>}</td>
                        {canWrite && <td><button className="aa-ic danger" onClick={() => removeRecord(r)} title="حذف"><Icon name="trash" size={14} /></button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {qrOpen && (
            <div className="aa-modal" onClick={() => setQrOpen(false)}>
              <div className="aa-modal-box aa-print" onClick={e => e.stopPropagation()}>
                <div className="aa-print-logos"><img src="/logos/upm.png" alt="" /><img src="/logos/gate.png" alt="" /></div>
                <h3>{current.title}</h3>
                <p>{pName(current.program_id)}{current.classroom_id ? ` · ${cCode(current.classroom_id)}` : ''} · {current.session_date}</p>
                <div className="aa-qr" dangerouslySetInnerHTML={{ __html: qrSvg(attendUrl(current.token), 300, 'M', NAVY) }} />
                <span className="aa-url-print" dir="ltr">{attendUrl(current.token).replace(/^https?:\/\//, '')}</span>
                <div className="aa-qr-count"><b>{curCounts.present + curCounts.late}</b> سجّلوا حضورهم</div>
                <small>امسح الرمز بكاميرا الجوال وسجّل اسمك — يستغرق أقل من 20 ثانية</small>
                <div className="aa-row aa-noprint" style={{ justifyContent: 'center' }}>
                  <button className="aa-btn primary" onClick={() => window.print()}><Icon name="print" size={16} /> طباعة</button>
                  <button className="aa-btn" onClick={() => copy(attendUrl(current.token))}><Icon name="copy" size={16} /> نسخ الرابط</button>
                  <button className="aa-btn" onClick={() => setQrOpen(false)}><Icon name="x" size={16} /> إغلاق</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== ملخص الحضور لبرنامج ===== */}
      {mode === 'summary' && (
        <section className="aa-card">
          <div className="aa-toolbar">
            <h2><Icon name="table" size={18} /> ملخص الحضور حسب المتدرب</h2>
            <div className="aa-filters">
              <select value={sumProgram} onChange={e => { setSumProgram(e.target.value); setSumClassroom(''); }}><option value="">— اختر البرنامج —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
              <select value={sumClassroom} onChange={e => setSumClassroom(e.target.value)} disabled={!sumProgram}><option value="">كل القاعات</option>{sumClassrooms.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select>
              <label className="aa-inline">الحد الأدنى للشهادة <input type="number" min={0} max={100} value={minPct} onChange={e => setMinPct(Number(e.target.value))} /> %</label>
              <button className="aa-btn" onClick={exportSummary} disabled={!summary.length}><Icon name="download" size={16} /> CSV</button>
            </div>
          </div>
          {!sumProgram && <div className="aa-empty"><Icon name="table" size={30} /><b>اختر برنامجًا</b></div>}
          {sumProgram && !sumSessions.length && <div className="aa-empty"><Icon name="calendar" size={30} /><b>لا توجد جلسات حضور لهذا البرنامج</b><span>أنشئ جلسة لكل لقاء تدريبي أولًا.</span></div>}
          {sumProgram && !!sumSessions.length && (
            <>
              <div className="aa-sumbar">
                <span>الجلسات <b>{sumSessions.length}</b></span><span>المتدربون <b>{summary.length}</b></span>
                <span className="ok">مستوفون ≥ {minPct}% <b>{okList.length}</b></span><span className="bad">غير مستوفين <b>{summary.length - okList.length}</b></span>
                <span>متوسط الحضور <b>{summary.length ? Math.round(summary.reduce((a, p) => a + p.pct, 0) / summary.length) : 0}%</b></span>
                {sumBusy && <span>جارٍ التحميل…</span>}
                <Link href="/admin/certificates" className="aa-btn small primary" style={{ marginInlineStart: 'auto' }}><Icon name="certificate" size={14} /> إصدار الشهادات للمستوفين</Link>
              </div>
              <div className="aa-tablewrap">
                <table className="aa-table">
                  <thead><tr><th>#</th><th>الاسم</th><th>البريد</th><th>الجوال</th><th>حاضر</th><th>متأخر</th><th>معتذر</th><th>غائب</th><th>النسبة</th><th>الحالة</th></tr></thead>
                  <tbody>
                    {summary.map((p, i) => (
                      <tr key={p.key} className={p.pct >= minPct ? '' : 'low'}>
                        <td>{i + 1}</td><td><b>{p.name}</b></td><td dir="ltr">{p.email || '—'}</td><td dir="ltr">{p.phone || '—'}</td>
                        <td>{p.present}</td><td>{p.late}</td><td>{p.excused}</td><td>{p.absent}</td>
                        <td><div className="aa-bar"><i style={{ width: `${p.pct}%` }} className={p.pct >= minPct ? 'ok' : 'bad'} /></div><b>{p.pct}%</b></td>
                        <td>{p.pct >= minPct ? <span className="aa-st present">مستوفٍ</span> : <span className="aa-st absent">غير مستوفٍ</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="aa-muted" style={{ marginTop: 10 }}>النسبة = (حاضر + متأخر) ÷ (عدد الجلسات − الاعتذارات). من لم يسجّل في جلسة يُعدّ غائبًا فيها. في صفحة الشهادات استخدم «استيراد من سجل الحضور» بنفس الحد الأدنى.</p>
            </>
          )}
        </section>
      )}

      {toast && <div className="aa-toast">{toast}</div>}
    </div>
  );
}

const CSS = `
.aa{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.aa *{box-sizing:border-box}
.aa-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid #c9a24b;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.aa-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.aa-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.aa-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.aa-nav{display:flex;gap:8px;flex-wrap:wrap}
.aa-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.aa-btn:disabled{opacity:.5;cursor:not-allowed}.aa-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}.aa-btn.small{padding:6px 10px;font-size:12px}.aa-btn.danger{color:#b91c1c;border-color:#fecaca}
.aa-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}.aa-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}
.aa-x{border:0;background:transparent;cursor:pointer;color:inherit}
.aa-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:14px}
.aa-stat{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px;display:flex;flex-direction:column;gap:2px}.aa-stat span{font-size:12px;font-weight:800;color:#64748b}.aa-stat b{font-size:24px;color:${NAVY}}
.aa-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}.aa-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.aa-toolbar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}.aa-toolbar h2{margin:0}
.aa-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.aa-seg{display:inline-flex;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:10px;padding:3px;gap:2px}.aa-seg button{border:0;background:transparent;font:inherit;font-size:12px;font-weight:800;color:#475569;padding:6px 11px;border-radius:8px;cursor:pointer}.aa-seg button.on{background:${NAVY};color:#fff}
.aa-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569}
.aa-muted{color:#64748b;font-size:12.5px;font-weight:700;line-height:1.7}
.aa-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:30px;text-align:center;color:#64748b;border:1px dashed #cbd5e1;border-radius:14px}.aa-empty b{color:${NAVY};font-size:15px}
.aa-list{display:flex;flex-direction:column;gap:10px}
.aa-item{border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;border-inline-start:5px solid #0b8a83}.aa-item.closed{border-inline-start-color:#94a3b8;opacity:.92}
.aa-item-title{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.aa-item-title b{font-size:15px;color:${NAVY}}
.aa-status{font-size:11px;font-weight:900;border-radius:999px;padding:2px 9px;background:#ecfdf5;color:#047857}.aa-status.closed{background:#f1f5f9;color:#475569}
.aa-today{font-size:11px;font-weight:900;border-radius:999px;padding:2px 9px;background:#fef3c7;color:#92400e}
.aa-token{font-family:ui-monospace,Menlo,monospace;font-weight:900;color:${NAVY}}
.aa-counts{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}.aa-counts span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#475569}.aa-counts span b{color:${NAVY}}
.aa-counts span.ok{background:#ecfdf5;border-color:#a7f3d0}.aa-counts span.ok b{color:#047857}.aa-counts span.warn{background:#fff7ed;border-color:#fed7aa}.aa-counts span.warn b{color:#b45309}.aa-counts span.bad{background:#fef2f2;border-color:#fecaca}.aa-counts span.bad b{color:#b91c1c}
.aa-item-actions{display:flex;flex-direction:column;gap:6px}
.aa-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.aa-span2{grid-column:span 2}.aa-span3{grid-column:1/-1}
.aa label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}.aa label i{color:#b91c1c;font-style:normal}
.aa select,.aa input{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff;min-width:0}
.aa-check{flex-direction:row!important;align-items:center;gap:8px!important;font-size:13px!important;color:#334155!important;align-self:end;padding-bottom:10px}
.aa-inline{flex-direction:row!important;align-items:center;gap:6px!important}.aa-inline input{width:70px;padding:7px 8px}
.aa-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:12px}
.aa-cur{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:start}.aa-cur-main{min-width:0}.aa-cur-main .aa-muted{overflow-wrap:anywhere}
.aa-url{display:flex;align-items:center;gap:6px;margin-top:8px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#334155;word-break:break-all}
.aa-ic{width:30px;height:30px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;display:inline-grid;place-items:center;cursor:pointer;color:${NAVY};font:inherit;flex:none}.aa-ic.danger{color:#b91c1c}
.aa-live{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:220px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:14px}
.aa-big{display:flex;flex-direction:column;align-items:center}.aa-big b{font-size:44px;line-height:1;color:#0b8a83}.aa-big span{font-size:12px;font-weight:800;color:#64748b}
.aa-manual{display:grid;grid-template-columns:1.4fr 1.2fr 1fr auto auto;gap:8px;align-items:center}
.aa-tablewrap{overflow:auto;border:1px solid #e2e8f0;border-radius:12px}
.aa-table{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}.aa-table th{background:#f8fafc;color:#475569;font-size:12px;text-align:start;padding:9px 10px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.aa-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9;vertical-align:middle}.aa-table tr.low td{background:#fff7f7}
.aa-st{display:inline-block;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:900;border:1px solid transparent}
.aa-st.present{background:#ecfdf5;color:#047857;border-color:#a7f3d0}.aa-st.late{background:#fff7ed;color:#b45309;border-color:#fed7aa}.aa-st.excused{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}.aa-st.absent{background:#fef2f2;color:#b91c1c;border-color:#fecaca}
select.aa-st{padding:4px 8px!important;font-size:12px!important}
.aa-bar{display:inline-block;width:90px;height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden;vertical-align:middle;margin-inline-end:8px}.aa-bar i{display:block;height:100%;background:#0b8a83}.aa-bar i.bad{background:#dc2626}
.aa-sumbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.aa-sumbar>span{background:#f8fafc;border:1px solid #e2e8f0;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:800;color:#475569}.aa-sumbar>span b{color:${NAVY}}
.aa-sumbar>span.ok{background:#ecfdf5;border-color:#a7f3d0}.aa-sumbar>span.ok b{color:#047857}.aa-sumbar>span.bad{background:#fef2f2;border-color:#fecaca}.aa-sumbar>span.bad b{color:#b91c1c}
.aa-modal{position:fixed;inset:0;background:rgba(15,23,42,.6);display:grid;place-items:center;z-index:100;padding:20px}
.aa-modal-box{background:#fff;border-radius:18px;padding:22px;max-width:520px;width:100%;text-align:center}
.aa-print-logos{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.aa-print-logos img{height:44px;object-fit:contain}
.aa-print h3{margin:6px 0 2px;color:${NAVY};font-size:20px}.aa-print p{margin:0 0 10px;color:#0b8a83;font-weight:800;font-size:13px}
.aa-qr{display:inline-block;padding:10px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:8px}.aa-qr svg{display:block;max-width:100%;height:auto}
.aa-url-print{display:block;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#334155;word-break:break-all;margin-bottom:6px}
.aa-qr-count{font-size:14px;font-weight:800;color:#475569;margin-bottom:4px}.aa-qr-count b{font-size:22px;color:#0b8a83}
.aa-print small{display:block;color:#64748b;font-weight:700;font-size:12px}
.aa-toast{position:fixed;bottom:18px;inset-inline-start:18px;background:${NAVY};color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:120}
@media print{.aa>*:not(.aa-modal){display:none!important}.aa{padding:0;background:#fff}.aa-modal{position:static;background:#fff;padding:0;display:block}.aa-modal-box{max-width:none;box-shadow:none;margin:0 auto}.aa-noprint{display:none!important}.aa-qr svg{width:420px;height:420px}.global-nav{display:none!important}}
@media(max-width:980px){.aa{padding:12px}.aa-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.aa-grid{grid-template-columns:1fr}.aa-span2,.aa-span3{grid-column:auto}.aa-item{grid-template-columns:1fr}.aa-item-actions{flex-direction:row;flex-wrap:wrap}.aa-cur{grid-template-columns:1fr}.aa-live{min-width:0}.aa-manual{grid-template-columns:1fr 1fr}}
`;
