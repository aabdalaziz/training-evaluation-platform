'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';

type Program = { id: string; name_ar: string | null; name_en: string | null; status?: string | null };
type Classroom = { id: string; code: string; program_id: string | null; trainer_id: string | null };
type Trainer = { id: string; name: string };
type AuditRow = { id: string; created_at: string; actor_id: string | null; action: string; metadata: any };
type Kind = 'BOTH' | 'DAILY' | 'FINAL';

const NAVY = '#0f2a4e';

export default function DataLifecyclePage() {
  const db = supabase();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string>('');
  const [programs, setPrograms] = useState<Program[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [auditErr, setAuditErr] = useState<string | null>(null);

  const [programId, setProgramId] = useState('ALL');
  const [classroomId, setClassroomId] = useState('ALL');
  const [trainerId, setTrainerId] = useState('ALL');
  const [kind, setKind] = useState<Kind>('BOTH');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [preview, setPreview] = useState<{ evaluations: number; answers: number } | null>(null);
  const [busy, setBusy] = useState<'preview' | 'purge' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ evaluations: number; answers: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [p, pr, cl, tr] = await Promise.all([
        db.from('profiles').select('role').eq('id', user.id).single(),
        db.from('programs').select('id,name_ar,name_en,status').order('created_at', { ascending: false }),
        db.from('classrooms').select('id,code,program_id,trainer_id'),
        db.from('trainers').select('id,name'),
      ]);
      setRole(p.data?.role || '');
      setPrograms(pr.data || []); setClassrooms(cl.data || []); setTrainers(tr.data || []);
      setReady(true);
      loadAudit();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadAudit() {
    const { data, error } = await db.from('audit_logs').select('id,created_at,actor_id,action,metadata').eq('action', 'PURGE_EVALUATIONS').order('created_at', { ascending: false }).limit(20);
    if (error) { setAuditErr(error.message); return; }
    setAudit(data || []);
  }

  const visibleRooms = useMemo(() => classrooms.filter(c => (programId === 'ALL' || c.program_id === programId) && (trainerId === 'ALL' || c.trainer_id === trainerId)), [classrooms, programId, trainerId]);
  const filters = { programId, classroomId, trainerId, from: from || null, to: to || null };
  const scope = useMemo(() => {
    const parts: string[] = [];
    parts.push(kind === 'BOTH' ? 'اليومي والختامي' : kind === 'DAILY' ? 'اليومي فقط' : 'الختامي فقط');
    if (programId !== 'ALL') parts.push('البرنامج: ' + (programs.find(p => p.id === programId)?.name_ar || programId));
    if (trainerId !== 'ALL') parts.push('المدرب: ' + (trainers.find(t => t.id === trainerId)?.name || trainerId));
    if (classroomId !== 'ALL') parts.push('القاعة: ' + (classrooms.find(c => c.id === classroomId)?.code || classroomId));
    if (from || to) parts.push(`الفترة: ${from || '…'} → ${to || '…'}`);
    return parts.join(' · ');
  }, [kind, programId, trainerId, classroomId, from, to, programs, trainers, classrooms]);

  async function call(body: any) {
    const { data: { session } } = await db.auth.getSession();
    const res = await fetch('/api/admin/purge-evaluations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
    return json;
  }

  async function doPreview() {
    setError(null); setDone(null); setPreview(null); setBusy('preview');
    try { const j = await call({ preview: true, kind, filters }); setPreview(j.counts); }
    catch (e: any) { setError(explain(e.message)); }
    finally { setBusy(null); }
  }

  async function doPurge() {
    setError(null); setBusy('purge');
    try {
      const j = await call({ confirmCode, kind, filters });
      setDone(j.deleted); setPreview(null); setConfirmOpen(false); setConfirmCode(''); setConfirmText('');
      loadAudit();
    } catch (e: any) { setError(explain(e.message)); }
    finally { setBusy(null); }
  }

  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(role);
  const canConfirm = confirmText.trim() === 'حذف' && confirmCode.trim().length >= 4 && !busy;

  if (!ready) return <div className="dl" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="dl" dir="rtl">
      <style>{CSS}</style>
      <header className="dl-head">
        <div>
          <div className="dl-kicker"><Icon name="admin" size={14} /> مركز الإدارة</div>
          <h1>إدارة دورة حياة البيانات</h1>
          <p>معاينة ثم حذف نهائي منضبط لاستجابات التقييم فقط — البرامج والقاعات والمدربون والقوالب لا تتأثر.</p>
        </div>
        <nav className="dl-nav">
          <Link href="/dashboard" className="dl-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/management" className="dl-btn"><Icon name="admin" size={16} /> لوحة الإدارة</Link>
          <Link href="/reports/center?type=raw" className="dl-btn"><Icon name="folder" size={16} /> تصدير البيانات أولًا</Link>
        </nav>
      </header>

      {!isAdmin && <div className="dl-alert err"><Icon name="alert" size={18} /> هذه الصفحة للإدارة فقط (ADMIN / SUPER_ADMIN). صلاحيتك الحالية: {role || 'غير معروفة'}.</div>}

      <div className="dl-alert warn">
        <Icon name="alert" size={18} />
        <div><b>تنبيه:</b> الحذف نهائي ولا يمكن التراجع عنه. يُنصح بتصدير البيانات (Excel) من مركز التقارير قبل التفريغ. كل عملية تُسجَّل في سجل التدقيق باسم المنفّذ ونطاق الحذف والأعداد.</div>
      </div>

      <section className="dl-card">
        <h2><Icon name="target" size={18} /> نطاق التفريغ</h2>
        <div className="dl-grid">
          <label>البرنامج<select value={programId} onChange={e => { setProgramId(e.target.value); setClassroomId('ALL'); setPreview(null); }}><option value="ALL">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar || p.name_en}{p.status ? ` (${p.status})` : ''}</option>)}</select></label>
          <label>المدرب<select value={trainerId} onChange={e => { setTrainerId(e.target.value); setClassroomId('ALL'); setPreview(null); }}><option value="ALL">كل المدربين</option>{trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label>القاعة<select value={classroomId} onChange={e => { setClassroomId(e.target.value); setPreview(null); }}><option value="ALL">كل القاعات ضمن النطاق</option>{visibleRooms.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label>
          <label>نوع التقييم<select value={kind} onChange={e => { setKind(e.target.value as Kind); setPreview(null); }}><option value="BOTH">اليومي والختامي</option><option value="DAILY">اليومي فقط</option><option value="FINAL">الختامي فقط</option></select></label>
          <label>من تاريخ<input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreview(null); }} /></label>
          <label>إلى تاريخ<input type="date" value={to} onChange={e => { setTo(e.target.value); setPreview(null); }} /></label>
        </div>
        <div className="dl-scope"><Icon name="flag" size={14} /> النطاق الحالي: {scope}</div>
        <div className="dl-actions">
          <button className="dl-btn primary" onClick={doPreview} disabled={!isAdmin || busy !== null}><Icon name="evaluations" size={16} /> {busy === 'preview' ? 'جارٍ الحساب…' : 'معاينة ما سيُحذف'}</button>
          {preview && preview.evaluations > 0 && <button className="dl-btn danger" onClick={() => setConfirmOpen(true)} disabled={busy !== null}><Icon name="trash" size={16} /> متابعة إلى الحذف النهائي</button>}
        </div>

        {error && <div className="dl-alert err"><Icon name="alert" size={18} /> {error}</div>}

        {preview && (
          <div className={`dl-preview ${preview.evaluations ? '' : 'empty'}`}>
            <div className="dl-num"><b>{preview.evaluations.toLocaleString('en')}</b><span>استجابة تقييم</span></div>
            <div className="dl-num"><b>{preview.answers.toLocaleString('en')}</b><span>إجابة سؤال</span></div>
            <div className="dl-note">{preview.evaluations ? 'هذه الأعداد هي ما سيُحذف نهائيًا عند التأكيد. لم يُحذف شيء بعد.' : 'لا توجد استجابات ضمن هذا النطاق — لا شيء لحذفه.'}</div>
          </div>
        )}

        {done && <div className="dl-alert ok"><Icon name="check" size={18} /> تم الحذف: {done.evaluations.toLocaleString('en')} استجابة و{done.answers.toLocaleString('en')} إجابة. سُجّلت العملية في سجل التدقيق.</div>}
      </section>

      <section className="dl-card">
        <h2><Icon name="clock" size={18} /> سجل التدقيق — آخر 20 عملية تفريغ</h2>
        {auditErr && <div className="dl-muted">تعذّر قراءة سجل التدقيق ({auditErr}). تأكد من تنفيذ ملف SQL الخاص بجدول <code>audit_logs</code>.</div>}
        {!auditErr && audit.length === 0 && <div className="dl-muted">لا توجد عمليات مسجلة.</div>}
        {audit.length > 0 && (
          <table className="dl-table">
            <thead><tr><th>التاريخ</th><th>النوع</th><th>النطاق</th><th>استجابات</th><th>إجابات</th><th>المنفّذ</th></tr></thead>
            <tbody>
              {audit.map(r => {
                const m = r.metadata || {}; const f = m.filters || {};
                const scopeTxt = [f.programId && f.programId !== 'ALL' ? 'برنامج: ' + (programs.find(p => p.id === f.programId)?.name_ar || f.programId) : null, f.trainerId && f.trainerId !== 'ALL' ? 'مدرب: ' + (trainers.find(t => t.id === f.trainerId)?.name || f.trainerId) : null, f.classroomId && f.classroomId !== 'ALL' ? 'قاعة: ' + (classrooms.find(c => c.id === f.classroomId)?.code || f.classroomId) : null, f.from || f.to ? `${f.from || '…'} → ${f.to || '…'}` : null].filter(Boolean).join(' · ') || 'الكل';
                return (
                  <tr key={r.id}>
                    <td dir="ltr">{new Date(r.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })}</td>
                    <td>{m.kind === 'DAILY' ? 'يومي' : m.kind === 'FINAL' ? 'ختامي' : 'الكل'}</td>
                    <td>{scopeTxt}</td>
                    <td>{m.deleted_evaluations ?? '—'}</td>
                    <td>{m.deleted_answers ?? '—'}</td>
                    <td dir="ltr" title={r.actor_id || ''}>{(r.actor_id || '').slice(0, 8)}…</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {confirmOpen && preview && (
        <div className="dl-modal" role="dialog" aria-modal="true" aria-labelledby="dl-confirm-title">
          <div className="dl-modal-box">
            <h3 id="dl-confirm-title"><Icon name="trash" size={20} color="#b91c1c" /> تأكيد الحذف النهائي</h3>
            <p>سيتم حذف <b>{preview.evaluations.toLocaleString('en')}</b> استجابة و<b>{preview.answers.toLocaleString('en')}</b> إجابة نهائيًا من النطاق:</p>
            <div className="dl-scope">{scope}</div>
            <label>اكتب كلمة <b>حذف</b> للتأكيد<input value={confirmText} onChange={e => setConfirmText(e.target.value)} autoComplete="off" /></label>
            <label>رمز التأكيد الإداري<input type="password" value={confirmCode} onChange={e => setConfirmCode(e.target.value)} autoComplete="off" inputMode="numeric" /></label>
            <div className="dl-actions">
              <button className="dl-btn" onClick={() => { setConfirmOpen(false); setConfirmCode(''); setConfirmText(''); }} disabled={busy !== null}>إلغاء</button>
              <button className="dl-btn danger" onClick={doPurge} disabled={!canConfirm}>{busy === 'purge' ? 'جارٍ الحذف…' : 'احذف نهائيًا'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function explain(m: string): string {
  const s = (m || '').toLowerCase();
  if (s.includes('إعدادات الخادم')) return 'إعدادات الخادم غير مكتملة: أضف SUPABASE_SERVICE_ROLE_KEY في Vercel → Settings → Environment Variables ثم Redeploy.';
  if (s.includes('audit_logs')) return 'الحذف تم لكن تعذّر تسجيله: جدول audit_logs غير موجود — نفّذ ملف SQL المرفق.';
  if (s.includes('كود التأكيد')) return 'رمز التأكيد غير صحيح.';
  if (s.includes('غير مصرح')) return 'غير مصرح — هذه العملية للإدارة فقط.';
  return m;
}

const CSS = `
.dl{font-family:Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.dl-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.dl-head h1{margin:2px 0 4px;font-size:26px;color:${NAVY}}.dl-head p{margin:0;color:#64748b;font-size:13px}
.dl-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.dl-nav{display:flex;gap:8px;flex-wrap:wrap}
.dl-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}
.dl-btn:disabled{opacity:.5;cursor:not-allowed}.dl-btn.primary{background:${NAVY};color:#fff;border-color:${NAVY}}.dl-btn.danger{background:#b91c1c;color:#fff;border-color:#b91c1c}
.dl-alert{display:flex;gap:10px;align-items:flex-start;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:13px;font-weight:700;line-height:1.7}
.dl-alert.warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}.dl-alert.err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.dl-alert.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}
.dl-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px}
.dl-card h2{margin:0 0 14px;font-size:17px;color:${NAVY};display:flex;align-items:center;gap:8px}
.dl-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.dl label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:#475569}
.dl select,.dl input{border:1px solid #cbd5e1;border-radius:10px;padding:10px;font:inherit;font-size:13px;font-weight:700;color:#0f172a;background:#fff}
.dl-scope{margin:12px 0;font-size:12px;font-weight:800;color:#334155;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;padding:8px 12px;display:flex;gap:6px;align-items:center}
.dl-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-start;margin-top:4px}
.dl-preview{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-top:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px}
.dl-preview.empty{background:#f8fafc;border-color:#e2e8f0}
.dl-num{background:#fff;border-radius:10px;padding:10px 18px;text-align:center;min-width:120px}.dl-num b{display:block;font-size:26px;color:#b91c1c}.dl-preview.empty .dl-num b{color:#64748b}.dl-num span{font-size:12px;color:#64748b;font-weight:800}
.dl-note{font-size:13px;font-weight:800;color:#7f1d1d;flex:1}.dl-preview.empty .dl-note{color:#475569}
.dl-muted{color:#64748b;font-size:13px}
.dl-table{width:100%;border-collapse:collapse;font-size:12.5px}.dl-table th{background:#f8fafc;text-align:right;padding:8px;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0}.dl-table td{padding:8px;border-bottom:1px solid #f1f5f9}
.dl-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100}
.dl-modal-box{background:#fff;border-radius:16px;padding:22px;max-width:520px;width:100%;display:flex;flex-direction:column;gap:12px}
.dl-modal-box h3{margin:0;color:#b91c1c;display:flex;align-items:center;gap:8px}.dl-modal-box p{margin:0;line-height:1.7}
@media(max-width:800px){.dl-grid{grid-template-columns:1fr}.dl{padding:12px}}
`;
