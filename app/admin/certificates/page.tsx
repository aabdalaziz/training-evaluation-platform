'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { renderCertificate, jpegsToPdf, downloadBytes, DEFAULT_SETTINGS, KIND_LABEL, fmtDate } from '../../../lib/certificates/render';
import type { CertKind, CertSettings } from '../../../lib/certificates/render';
import { loadSettings, saveSettings, insertCertificates, renderRows, emailRendered, previewData, rowToData, verifyUrl, pdfFilename, SETTINGS_FIELDS } from '../../../lib/certificates/issue';
import type { CertRow, IssueInput } from '../../../lib/certificates/issue';

type Program = { id: string; name_ar: string | null; name_en: string | null; status?: string | null; start_date?: string | null; end_date?: string | null; delivery_mode?: string | null };
type Classroom = { id: string; code: string; program_id: string | null; trainer_id: string | null };
type Trainer = { id: string; name: string };
type Recipient = { name: string; email: string; name_en?: string; source: 'manual' | 'evaluations' | 'enrollments' };
type Tab = 'issue' | 'registry' | 'settings';

const NAVY = '#0f2a4e';
const ALLOWED = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseRecipients(text: string): Recipient[] {
  const out: Recipient[] = []; const seen = new Set<string>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim(); if (!line) continue;
    const parts = line.split(/[,\t;|]+/).map(x => x.trim()).filter(Boolean);
    let email = parts.find(p => EMAIL_RE.test(p)) || '';
    const name = parts.filter(p => p !== email).join(' ').trim() || email.split('@')[0];
    email = email.toLowerCase();
    const key = (email || name).toLowerCase(); if (!name || seen.has(key)) continue; seen.add(key);
    out.push({ name, email, source: 'manual' });
  }
  return out;
}

export default function CertificatesPage() {
  const db = supabase();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState('');
  const [uid, setUid] = useState('');
  const [orgId, setOrgId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [settings, setSettings] = useState<CertSettings>({ ...DEFAULT_SETTINGS });
  const [settingsDraft, setSettingsDraft] = useState<CertSettings>({ ...DEFAULT_SETTINGS });
  const [tab, setTab] = useState<Tab>('issue');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 4500); };

  // issue form
  const [programId, setProgramId] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [kind, setKind] = useState<CertKind>('completion');
  const [hours, setHours] = useState<number>(DEFAULT_SETTINGS.default_hours);
  const [start, setStart] = useState(''); const [end, setEnd] = useState('');
  const [recText, setRecText] = useState('');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string>('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [issuedSummary, setIssuedSummary] = useState<{ count: number; sent: number; failed: number; skipped: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // registry
  const [regRows, setRegRows] = useState<CertRow[]>([]);
  const [regQ, setRegQ] = useState(''); const [regProgram, setRegProgram] = useState('');
  const [revoke, setRevoke] = useState<{ row: CertRow; reason: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUid(user.id);
      const [p, pr, cl, tr] = await Promise.all([
        db.from('profiles').select('role,organization_id').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,name_en,status,start_date,end_date,delivery_mode').order('created_at', { ascending: false }),
        db.from('classrooms').select('id,code,program_id,trainer_id'),
        db.from('trainers').select('id,name'),
      ]);
      setRole(String(p.data?.role || '')); const org = p.data?.organization_id || null; setOrgId(org);
      setPrograms(pr.data || []); setClassrooms(cl.data || []); setTrainers(tr.data || []);
      const s = await loadSettings(db, org); setSettings(s); setSettingsDraft(s); setHours(s.default_hours);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const program = programs.find(p => p.id === programId) || null;
  const rooms = useMemo(() => classrooms.filter(c => c.program_id === programId), [classrooms, programId]);
  const room = rooms.find(r => r.id === classroomId) || null;
  const trainer = room ? trainers.find(t => t.id === room.trainer_id) || null : null;
  useEffect(() => { if (program) { setStart(program.start_date || ''); setEnd(program.end_date || ''); } setClassroomId(''); }, [programId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setRecipients(parseRecipients(recText)); setPreviewIdx(0); }, [recText]);

  const baseInput = (r?: Recipient): IssueInput => ({
    kind, recipient_name: r?.name || '', recipient_name_en: r?.name_en || null, recipient_email: r?.email || null,
    program_id: program?.id || null, program_name: program?.name_ar || '', classroom_id: room?.id || null, classroom_code: room?.code || null,
    trainer_id: trainer?.id || null, trainer_name: trainer?.name || null, start_date: start || null, end_date: end || null,
    hours: kind === 'appreciation' ? null : hours || null, organization_id: orgId, meta: { program_en: program?.name_en || null, source: r?.source || 'manual' },
  });

  // live preview
  useEffect(() => {
    if (tab !== 'issue' || !canvasRef.current) return;
    const r = recipients[previewIdx]; let cancelled = false;
    (async () => { if (!cancelled) await renderCertificate(canvasRef.current!, previewData(baseInput(r), program?.name_en), settings); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, recipients, previewIdx, kind, hours, start, end, programId, classroomId, settings, ready]);

  /* ---------- imports ---------- */
  async function importFromEvaluations() {
    if (!programId) { setError('اختر البرنامج أولًا'); return; }
    setBusy('import'); setError('');
    try {
      let q = db.from('evaluations').select('guest_name,guest_email,guest_phone,classroom_id').eq('program_id', programId).not('guest_name', 'is', null);
      if (classroomId) q = q.eq('classroom_id', classroomId);
      const { data, error } = await q.limit(5000);
      if (error) throw new Error(error.message);
      const seen = new Set<string>(); const lines: string[] = [];
      for (const e of (data || []) as any[]) {
        const name = String(e.guest_name || '').trim(); const email = String(e.guest_email || '').trim().toLowerCase();
        if (!name) continue; const key = email || name.toLowerCase(); if (seen.has(key)) continue; seen.add(key);
        lines.push(email ? `${name}, ${email}` : name);
      }
      if (!lines.length) { setError('لا توجد أسماء متدربين في تقييمات هذا النطاق'); return; }
      setRecText(prev => [prev.trim(), ...lines].filter(Boolean).join('\n'));
      flash(`✓ استُوردت ${lines.length} اسمًا من التقييمات`);
    } catch (e: any) { setError('تعذر الاستيراد: ' + e.message); } finally { setBusy(''); }
  }
  async function importFromEnrollments() {
    if (!programId) { setError('اختر البرنامج أولًا'); return; }
    setBusy('import'); setError('');
    try {
      const { data: en, error } = await db.from('enrollments').select('trainee_id').eq('program_id', programId).eq('is_active', true).limit(2000);
      if (error) throw new Error(error.message);
      const ids = Array.from(new Set((en || []).map((x: any) => x.trainee_id).filter(Boolean)));
      if (!ids.length) { setError('لا يوجد متدربون مسجلون في هذا البرنامج'); return; }
      let profs: any[] = [];
      const r1 = await db.from('profiles').select('id,full_name,email').in('id', ids);
      if (r1.error) { const r2 = await db.from('profiles').select('id,full_name').in('id', ids); profs = r2.data || []; } else profs = r1.data || [];
      const lines = profs.map(p => [p.full_name, p.email].filter(Boolean).join(', ')).filter(Boolean);
      if (!lines.length) { setError('تعذر قراءة أسماء المسجلين'); return; }
      setRecText(prev => [prev.trim(), ...lines].filter(Boolean).join('\n'));
      flash(`✓ استُورد ${lines.length} متدربًا من قائمة المسجلين`);
    } catch (e: any) { setError('تعذر الاستيراد من المسجلين: ' + e.message); } finally { setBusy(''); }
  }

  /* ---------- issue ---------- */
  async function issue(mode: 'download' | 'email' | 'both') {
    setError(''); setIssuedSummary(null);
    if (!program) { setError('اختر البرنامج'); return; }
    if (!recipients.length) { setError('أضف اسمًا واحدًا على الأقل'); return; }
    const needMail = mode !== 'download'; const noMail = recipients.filter(r => !r.email).length;
    if (needMail && noMail === recipients.length) { setError('لا يوجد بريد إلكتروني لأي من المستفيدين — أضف البريد بعد الاسم بفاصلة'); return; }
    if (!window.confirm(`سيتم إصدار ${recipients.length} شهادة «${KIND_LABEL[kind].ar}» لبرنامج «${program.name_ar}» وتسجيلها بأرقام تسلسلية رسمية${needMail ? ' وإرسالها بالبريد' : ''}. متابعة؟`)) return;
    setBusy('issue'); setProgress({ done: 0, total: recipients.length });
    try {
      const { rows, error } = await insertCertificates(db, recipients.map(r => baseInput(r)));
      if (error) throw new Error(error);
      const rendered = await renderRows(rows, settings, (d, t) => setProgress({ done: d, total: t }));
      let sent = 0, failed = 0, skipped = 0;
      if (mode !== 'email') {
        const pdf = jpegsToPdf(rendered.map(x => ({ jpeg: x.jpeg, w: x.w, h: x.h })), `${KIND_LABEL[kind].ar} — ${program.name_ar}`);
        downloadBytes(rows.length === 1 ? pdfFilename(rows[0]) : `شهادات-${(program.name_ar || '').replace(/\s+/g, '_')}-${rows.length}.pdf`, pdf);
      }
      if (needMail) {
        setProgress({ done: 0, total: rendered.filter(x => x.row.recipient_email).length });
        const r = await emailRendered(db, rendered, settings, note, (d, t) => setProgress({ done: d, total: t }));
        sent = r.results.filter(x => x.ok).length; failed = r.results.filter(x => !x.ok).length; skipped = r.skipped;
        if (failed) setError('تعذر الإرسال إلى: ' + r.results.filter(x => !x.ok).map(x => `${x.to} (${x.error})`).join('، '));
      }
      setIssuedSummary({ count: rows.length, sent, failed, skipped });
      flash(`✓ صدرت ${rows.length} شهادة${needMail ? ` · أُرسل ${sent}` : ''}`);
      setRecText('');
      if (tab === 'registry') loadRegistry();
    } catch (e: any) { setError(explain(e.message)); } finally { setBusy(''); setProgress(null); }
  }

  /* ---------- registry ---------- */
  async function loadRegistry() {
    let q = db.from('certificates').select('*').order('created_at', { ascending: false }).limit(300);
    if (regProgram) q = q.eq('program_id', regProgram);
    const { data, error } = await q;
    if (error) { setError(explain(error.message)); return; }
    setRegRows((data || []) as CertRow[]);
  }
  useEffect(() => { if (ready && tab === 'registry') loadRegistry(); }, [tab, regProgram, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  const regFiltered = regRows.filter(r => { const q = regQ.trim().toLowerCase(); return !q || [r.recipient_name, r.recipient_email, r.serial, r.verify_code, r.program_name].some(x => String(x || '').toLowerCase().includes(q)); });
  async function downloadOne(r: CertRow) {
    setBusy('dl' + r.id);
    try { const [x] = await renderRows([r], settings); downloadBytes(pdfFilename(r), jpegsToPdf([{ jpeg: x.jpeg, w: x.w, h: x.h }], `${KIND_LABEL[r.kind].ar} — ${r.recipient_name}`)); } finally { setBusy(''); }
  }
  async function sendOne(r: CertRow) {
    let to = r.recipient_email || '';
    if (!to) { to = window.prompt('أدخل البريد الإلكتروني للمستفيد:') || ''; if (!to) return; if (!EMAIL_RE.test(to)) { setError('بريد غير صالح'); return; } await db.from('certificates').update({ recipient_email: to.toLowerCase() }).eq('id', r.id); r = { ...r, recipient_email: to.toLowerCase() }; }
    setBusy('mail' + r.id); setError('');
    try { const rendered = await renderRows([r], settings); const res = await emailRendered(db, rendered, settings, ''); const ok = res.results[0]?.ok; if (ok) { flash(`✓ أُرسلت إلى ${to}`); loadRegistry(); } else setError('تعذر الإرسال: ' + (res.results[0]?.error || '')); }
    catch (e: any) { setError(explain(e.message)); } finally { setBusy(''); }
  }
  async function doRevoke() {
    if (!revoke) return; if (!revoke.reason.trim()) { setError('سبب الإلغاء مطلوب'); return; }
    const { error } = await db.from('certificates').update({ revoked_at: new Date().toISOString(), revoke_reason: revoke.reason.trim() }).eq('id', revoke.row.id);
    if (error) setError(error.message); else { flash('✓ أُلغيت الشهادة — سيظهر ذلك في صفحة التحقق'); setRevoke(null); loadRegistry(); }
  }
  async function unrevoke(r: CertRow) { const { error } = await db.from('certificates').update({ revoked_at: null, revoke_reason: null }).eq('id', r.id); if (error) setError(error.message); else { flash('✓ أُعيد تفعيل الشهادة'); loadRegistry(); } }
  const copy = async (t: string) => { try { await navigator.clipboard.writeText(t); flash('✓ نُسخ الرابط'); } catch { window.prompt('انسخ الرابط:', t); } };

  /* ---------- settings ---------- */
  async function doSaveSettings() {
    setBusy('settings'); setError('');
    const err = await saveSettings(db, orgId, settingsDraft, uid);
    if (err) setError(explain(err)); else { setSettings(settingsDraft); flash('✓ حُفظت إعدادات الشهادة'); }
    setBusy('');
  }

  const allowed = ALLOWED.includes(role.toUpperCase());
  if (!ready) return <div className="ct" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="ct" dir="rtl">
      <style>{CSS}</style>
      <header className="ct-head">
        <div>
          <div className="ct-kicker"><Icon name="certificate" size={14} /> مركز الإدارة</div>
          <h1>الشهادات الإلكترونية</h1>
          <p>إصدار شهادات الإتمام والحضور والتقدير بأرقام تسلسلية ورمز تحقق QR، وتنزيلها PDF أو إرسالها بالبريد مباشرة.</p>
        </div>
        <nav className="ct-nav">
          <Link href="/dashboard" className="ct-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/awards" className="ct-btn"><Icon name="award" size={16} /> تكريم المدربين</Link>
          <Link href="/verify" className="ct-btn" target="_blank"><Icon name="search" size={16} /> صفحة التحقق</Link>
        </nav>
      </header>

      {!allowed && <div className="ct-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة ومديري البرامج ومحللي الجودة. صلاحيتك الحالية: {role || 'غير معروفة'}.</div>}

      <div className="ct-tabs">
        {([['issue', 'إصدار شهادات', 'plus'], ['registry', 'سجل الشهادات', 'folder'], ['settings', 'إعدادات الشهادة', 'settings']] as [Tab, string, any][]).map(([t, l, ic]) => (
          <button key={t} className={`ct-tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}><Icon name={ic} size={15} /> {l}</button>
        ))}
      </div>

      {error && <div className="ct-alert err"><Icon name="alert" size={18} /> <span style={{ flex: 1 }}>{error}</span><button className="ct-x" onClick={() => setError('')}><Icon name="x" size={14} /></button></div>}

      {/* ================= ISSUE ================= */}
      {tab === 'issue' && (
        <div className="ct-two">
          <section className="ct-card">
            <h2><Icon name="target" size={18} /> 1) بيانات الشهادة</h2>
            <div className="ct-grid">
              <label>البرنامج *<select value={programId} onChange={e => setProgramId(e.target.value)}><option value="">— اختر —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}{p.status === 'COMPLETED' ? ' (مكتمل)' : ''}</option>)}</select></label>
              <label>نوع الشهادة<select value={kind} onChange={e => setKind(e.target.value as CertKind)}>{(Object.keys(KIND_LABEL) as CertKind[]).filter(k => k !== 'appreciation').map(k => <option key={k} value={k}>{KIND_LABEL[k].ar}</option>)}</select></label>
              <label>القاعة (اختياري)<select value={classroomId} onChange={e => setClassroomId(e.target.value)}><option value="">— بدون —</option>{rooms.map(r => <option key={r.id} value={r.id}>{r.code}{trainers.find(t => t.id === r.trainer_id)?.name ? ` · ${trainers.find(t => t.id === r.trainer_id)?.name}` : ''}</option>)}</select></label>
              <label>الساعات التدريبية<input type="number" min={1} max={999} value={hours} onChange={e => setHours(Number(e.target.value))} /></label>
              <label>من تاريخ<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label>
              <label>إلى تاريخ<input type="date" value={end} onChange={e => setEnd(e.target.value)} /></label>
            </div>

            <h2 style={{ marginTop: 18 }}><Icon name="users" size={18} /> 2) المستفيدون <span className="ct-count">{recipients.length}</span></h2>
            <div className="ct-import">
              <button className="ct-btn" onClick={importFromEvaluations} disabled={!programId || !!busy}><Icon name="evaluations" size={15} /> استيراد من التقييمات</button>
              <button className="ct-btn" onClick={importFromEnrollments} disabled={!programId || !!busy}><Icon name="school" size={15} /> استيراد من المسجلين</button>
              <span className="ct-muted">أو الصق القائمة: <b>اسم, بريد</b> في كل سطر (البريد اختياري للتنزيل، مطلوب للإرسال)</span>
            </div>
            <textarea className="ct-ta" rows={7} value={recText} onChange={e => setRecText(e.target.value)} placeholder={'محمد بن أحمد العتيبي, mohammed@example.com\nسارة القحطاني, sara@example.com\nخالد الحربي'} />
            {recipients.length > 0 && (
              <div className="ct-chips">
                {recipients.slice(0, 60).map((r, i) => <button key={i} className={`ct-chip ${i === previewIdx ? 'on' : ''} ${r.email ? '' : 'nomail'}`} title={r.email || 'بدون بريد'} onClick={() => setPreviewIdx(i)}>{r.name}{r.email ? '' : ' ✉︎✕'}</button>)}
                {recipients.length > 60 && <span className="ct-muted">+{recipients.length - 60}</span>}
              </div>
            )}

            <h2 style={{ marginTop: 18 }}><Icon name="send" size={18} /> 3) الإصدار</h2>
            <label>رسالة مرافقة للبريد (اختياري)<textarea className="ct-ta" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="مثال: نبارك لكم إتمام البرنامج، ونتطلع لمشاركتكم في البرامج القادمة." /></label>
            <div className="ct-actions">
              <button className="ct-btn primary" onClick={() => issue('download')} disabled={!allowed || !!busy || !recipients.length || !programId}><Icon name="download" size={16} /> إصدار وتنزيل PDF</button>
              <button className="ct-btn teal" onClick={() => issue('email')} disabled={!allowed || !!busy || !recipients.length || !programId}><Icon name="mail" size={16} /> إصدار وإرسال بالبريد</button>
              <button className="ct-btn" onClick={() => issue('both')} disabled={!allowed || !!busy || !recipients.length || !programId}><Icon name="save" size={16} /> الاثنان معًا</button>
            </div>
            {progress && <div className="ct-progress"><div style={{ width: `${progress.total ? Math.round(progress.done / progress.total * 100) : 0}%` }} /><span>{busy === 'issue' ? 'جارٍ الإصدار…' : ''} {progress.done}/{progress.total}</span></div>}
            {issuedSummary && <div className="ct-alert ok"><Icon name="check" size={18} /> صدرت {issuedSummary.count} شهادة وسُجّلت بأرقام تسلسلية.{issuedSummary.sent ? ` أُرسل ${issuedSummary.sent} بالبريد.` : ''}{issuedSummary.failed ? ` فشل ${issuedSummary.failed}.` : ''}{issuedSummary.skipped ? ` ${issuedSummary.skipped} بدون بريد (نزّلها من السجل).` : ''} <button className="ct-link" onClick={() => setTab('registry')}>فتح السجل</button></div>}
          </section>

          <section className="ct-card ct-preview">
            <h2><Icon name="certificate" size={18} /> معاينة حيّة {recipients[previewIdx] ? <span className="ct-muted" style={{ fontWeight: 700 }}>— {recipients[previewIdx].name}</span> : <span className="ct-muted" style={{ fontWeight: 700 }}>— نموذج</span>}</h2>
            <div className="ct-canvas-wrap"><canvas ref={canvasRef} /></div>
            <div className="ct-muted" style={{ marginTop: 8 }}>الشهادة بمقاس A4 أفقي بدقة طباعة (300dpi). الشعارات من <code>/logos</code>، والتوقيعات والجهة من تبويب «إعدادات الشهادة».</div>
          </section>
        </div>
      )}

      {/* ================= REGISTRY ================= */}
      {tab === 'registry' && (
        <section className="ct-card">
          <div className="ct-reg-head">
            <h2><Icon name="folder" size={18} /> سجل الشهادات <span className="ct-count">{regFiltered.length}</span></h2>
            <div className="ct-reg-tools">
              <select value={regProgram} onChange={e => setRegProgram(e.target.value)}><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
              <input placeholder="بحث بالاسم / البريد / الرقم التسلسلي" value={regQ} onChange={e => setRegQ(e.target.value)} />
              <button className="ct-btn" onClick={loadRegistry}><Icon name="refresh" size={15} /> تحديث</button>
            </div>
          </div>
          {regFiltered.length === 0 ? <div className="ct-muted">لا توجد شهادات بعد.</div> : (
            <div className="ct-tw"><table className="ct-table">
              <thead><tr><th>الرقم التسلسلي</th><th>النوع</th><th>المستفيد</th><th>البرنامج</th><th>الإصدار</th><th>البريد</th><th>الحالة</th><th></th></tr></thead>
              <tbody>{regFiltered.map(r => (
                <tr key={r.id} className={r.revoked_at ? 'revoked' : ''}>
                  <td dir="ltr" style={{ textAlign: 'end' }}><b>{r.serial}</b><div className="ct-muted" style={{ fontSize: 11 }}>{r.verify_code}</div></td>
                  <td>{KIND_LABEL[r.kind]?.ar || r.kind}{r.award_title ? <div className="ct-muted" style={{ fontSize: 11 }}>{r.award_title}</div> : null}</td>
                  <td><b>{r.recipient_name}</b>{r.recipient_email ? <div className="ct-muted" style={{ fontSize: 11 }} dir="ltr">{r.recipient_email}</div> : null}</td>
                  <td>{r.program_name}{r.classroom_code ? <div className="ct-muted" style={{ fontSize: 11 }}>القاعة {r.classroom_code}</div> : null}</td>
                  <td dir="ltr" style={{ textAlign: 'end' }}>{fmtDate(r.issued_at)}<div className="ct-muted" style={{ fontSize: 11 }}>{r.issued_by_name || ''}</div></td>
                  <td>{r.sent_at ? <span className="ct-pill ok">أُرسلت {fmtDate(r.sent_at.slice(0, 10))}</span> : <span className="ct-pill">لم تُرسل</span>}</td>
                  <td>{r.revoked_at ? <span className="ct-pill bad" title={r.revoke_reason || ''}>ملغاة</span> : <span className="ct-pill ok">سارية</span>}</td>
                  <td><div className="ct-row-acts">
                    <button className="ct-ic" title="تنزيل PDF" onClick={() => downloadOne(r)} disabled={!!busy}><Icon name="download" size={15} /></button>
                    <button className="ct-ic" title="إرسال بالبريد" onClick={() => sendOne(r)} disabled={!!busy || !!r.revoked_at}><Icon name="mail" size={15} /></button>
                    <button className="ct-ic" title="نسخ رابط التحقق" onClick={() => copy(verifyUrl(r.verify_code))}><Icon name="link" size={15} /></button>
                    {r.revoked_at ? <button className="ct-ic" title="إعادة التفعيل" onClick={() => unrevoke(r)}><Icon name="refresh" size={15} /></button> : <button className="ct-ic danger" title="إلغاء الشهادة" onClick={() => setRevoke({ row: r, reason: '' })}><Icon name="x" size={15} /></button>}
                  </div></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {/* ================= SETTINGS ================= */}
      {tab === 'settings' && (
        <div className="ct-two">
          <section className="ct-card">
            <h2><Icon name="settings" size={18} /> إعدادات الشهادة</h2>
            <div className="ct-grid">
              {([
                ['issuer_ar', 'الجهة (عربي)'], ['issuer_en', 'الجهة (إنجليزي)'], ['unit_ar', 'الوحدة / المركز (عربي)'], ['unit_en', 'الوحدة / المركز (إنجليزي)'],
                ['sign1_name', 'اسم الموقّع الأول (يمين)'], ['sign1_title', 'صفة الموقّع الأول'], ['sign2_name', 'اسم الموقّع الثاني (يسار)'], ['sign2_title', 'صفة الموقّع الثاني'],
                ['serial_prefix', 'بادئة الرقم التسلسلي'], ['city_ar', 'المدينة'],
              ] as [keyof CertSettings, string][]).map(([k, l]) => (
                <label key={k}>{l}<input value={String(settingsDraft[k] ?? '')} onChange={e => setSettingsDraft(s => ({ ...s, [k]: e.target.value }))} /></label>
              ))}
              <label>الساعات الافتراضية<input type="number" min={1} value={settingsDraft.default_hours} onChange={e => setSettingsDraft(s => ({ ...s, default_hours: Number(e.target.value) || 1 }))} /></label>
              <label className="ct-check"><input type="checkbox" checked={settingsDraft.show_en} onChange={e => setSettingsDraft(s => ({ ...s, show_en: e.target.checked }))} /> إظهار السطور الإنجليزية</label>
            </div>
            <label style={{ marginTop: 12 }}>نص التذييل<textarea className="ct-ta" rows={2} value={settingsDraft.footer_ar} onChange={e => setSettingsDraft(s => ({ ...s, footer_ar: e.target.value }))} /></label>
            <div className="ct-actions">
              <button className="ct-btn primary" onClick={doSaveSettings} disabled={!allowed || busy === 'settings'}><Icon name="save" size={16} /> حفظ الإعدادات</button>
              <button className="ct-btn" onClick={() => setSettingsDraft({ ...DEFAULT_SETTINGS })}><Icon name="refresh" size={16} /> استعادة الافتراضي</button>
              <button className="ct-btn" onClick={() => { setSettings(settingsDraft); setTab('issue'); }}><Icon name="certificate" size={16} /> معاينة دون حفظ</button>
            </div>
            <div className="ct-muted" style={{ marginTop: 10 }}>الحقول المحفوظة: {SETTINGS_FIELDS.length}. تنطبق الإعدادات على كل الشهادات الجديدة والمعاد تنزيلها.</div>
          </section>
          <section className="ct-card">
            <h2><Icon name="shield" size={18} /> كيف يعمل التحقق؟</h2>
            <ol className="ct-ol">
              <li>كل شهادة تحمل رقمًا تسلسليًا فريدًا (<code>{settingsDraft.serial_prefix}-2026-000123</code>) ورمز تحقق من 10 رموز.</li>
              <li>رمز QR على الشهادة يفتح <code>/verify/&lt;الرمز&gt;</code> ويعرض: الاسم، البرنامج، التاريخ، والحالة (سارية / ملغاة) — دون أي بيانات أخرى.</li>
              <li>يمكن لأي جهة إدخال الرقم التسلسلي يدويًا في <Link href="/verify" target="_blank">صفحة التحقق</Link>.</li>
              <li>إلغاء الشهادة من السجل يجعل صفحة التحقق تعرض «ملغاة» فورًا مع الاحتفاظ بالأثر.</li>
            </ol>
          </section>
        </div>
      )}

      {revoke && (
        <div className="ct-modal" role="dialog" aria-modal="true">
          <div className="ct-modal-box">
            <h3><Icon name="alert" size={20} color="#b91c1c" /> إلغاء الشهادة {revoke.row.serial}</h3>
            <p>المستفيد: <b>{revoke.row.recipient_name}</b> · {revoke.row.program_name}</p>
            <label>سبب الإلغاء *<input value={revoke.reason} onChange={e => setRevoke(v => v && { ...v, reason: e.target.value })} placeholder="مثال: صدرت بالخطأ / عدم استيفاء نسبة الحضور" /></label>
            <div className="ct-actions">
              <button className="ct-btn" onClick={() => setRevoke(null)}>تراجع</button>
              <button className="ct-btn danger" onClick={doRevoke}>إلغاء الشهادة</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="ct-toast">{toast}</div>}
    </div>
  );
}

function explain(m: string): string {
  const s = (m || '').toLowerCase();
  if (s.includes('relation') && s.includes('does not exist')) return 'جداول الشهادات غير موجودة بعد — شغّل ملف SQL الخاص بالشهادات في Supabase أولًا.';
  if (s.includes('row-level security') || s.includes('permission denied')) return 'صلاحيات غير كافية (RLS). تأكد من دورك وأن ملف SQL نُفِّذ كاملًا.';
  if (s.includes('resend_api_key')) return 'مفتاح Resend غير مضبوط في Vercel (RESEND_API_KEY).';
  return m;
}

const CSS = `
.ct{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.ct-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ct-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.ct-head p{margin:0;color:#64748b;font-size:13px}
.ct-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ct-nav{display:flex;gap:8px;flex-wrap:wrap}
.ct-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.ct-btn:disabled{opacity:.5;cursor:not-allowed}.ct-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}.ct-btn.teal{background:#0b8a83;color:#fff;border-color:#0b8a83}.ct-btn.danger{background:#b91c1c;color:#fff;border-color:#b91c1c}
.ct-tabs{display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap}
.ct-tab{display:inline-flex;align-items:center;gap:6px;border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font:inherit;font-size:13px;font-weight:800;color:#475569;cursor:pointer}.ct-tab.on{background:${NAVY};border-color:${NAVY};color:#fff}
.ct-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}
.ct-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.ct-alert.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
.ct-x{border:0;background:transparent;cursor:pointer;color:inherit;padding:2px}
.ct-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ct-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.ct-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.ct-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ct label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}
.ct select,.ct input,.ct-ta{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff;width:100%;box-sizing:border-box}
.ct-ta{resize:vertical;line-height:1.7;margin-top:6px}
.ct-check{flex-direction:row!important;align-items:center;gap:8px!important;padding-top:22px}.ct-check input{width:auto}
.ct-import{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.ct-muted{color:#64748b;font-size:12.5px;font-weight:700}
.ct-count{background:#eef2f7;color:${NAVY};border-radius:999px;padding:2px 10px;font-size:12px}
.ct-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.ct-chip{border:1px solid #e2e8f0;background:#f8fafc;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;font-weight:800;color:#334155;cursor:pointer}.ct-chip.on{background:${NAVY};border-color:${NAVY};color:#fff}.ct-chip.nomail{border-style:dashed}
.ct-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
.ct-progress{position:relative;height:26px;background:#eef2f7;border-radius:999px;overflow:hidden;margin-top:12px}.ct-progress div{height:100%;background:linear-gradient(90deg,#0b8a83,#0f2a4e);transition:width .3s}.ct-progress span{position:absolute;inset:0;display:grid;place-items:center;font-size:12px;font-weight:900;color:#fff;mix-blend-mode:difference}
.ct-link{border:0;background:transparent;color:#0b8a83;font:inherit;font-weight:900;cursor:pointer;text-decoration:underline}
.ct-preview{position:sticky;top:12px}
.ct-canvas-wrap{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 10px 30px rgba(15,42,78,.12)}.ct-canvas-wrap canvas{display:block;width:100%;height:auto}
.ct-reg-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}.ct-reg-head h2{margin:0}
.ct-reg-tools{display:flex;gap:8px;flex-wrap:wrap}.ct-reg-tools input{min-width:260px}.ct-reg-tools select,.ct-reg-tools input{width:auto}
.ct-tw{overflow:auto}
.ct-table{width:100%;border-collapse:collapse;font-size:12.5px}.ct-table th{background:#f8fafc;text-align:right;padding:8px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap}.ct-table td{padding:8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.ct-table tr.revoked td{opacity:.6}
.ct-pill{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:800;background:#f1f5f9;color:#475569;white-space:nowrap}.ct-pill.ok{background:#ecfdf5;color:#047857}.ct-pill.bad{background:#fef2f2;color:#b91c1c}
.ct-row-acts{display:flex;gap:4px}
.ct-ic{width:30px;height:30px;border:1px solid #e2e8f0;background:#fff;border-radius:8px;display:grid;place-items:center;cursor:pointer;color:${NAVY}}.ct-ic:disabled{opacity:.4;cursor:not-allowed}.ct-ic.danger{color:#b91c1c}
.ct-ol{margin:0;padding-inline-start:18px;line-height:1.9;font-size:13.5px;color:#334155}.ct-ol code{background:#f1f5f9;padding:1px 6px;border-radius:6px;direction:ltr;unicode-bidi:embed}
.ct-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100}
.ct-modal-box{background:#fff;border-radius:16px;padding:22px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px}
.ct-modal-box h3{margin:0;color:#b91c1c;display:flex;align-items:center;gap:8px}.ct-modal-box p{margin:0;line-height:1.7}
.ct-toast{position:fixed;bottom:18px;inset-inline-start:18px;background:${NAVY};color:#fff;padding:12px 18px;border-radius:12px;font-weight:800;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:120}
@media(max-width:1000px){.ct-two{grid-template-columns:1fr}.ct-preview{position:static}}
@media(max-width:700px){.ct-grid{grid-template-columns:1fr}.ct{padding:12px}}
`;
