import CommandCenter from "./components/sections/CommandCenter";
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';

type Profile = { full_name: string; role: string; organization_id: string; phone: string | null };
type Program = {
  id: string; name_ar: string; name_en: string | null;
  description_ar?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  start_date: string | null; end_date: string | null; created_at: string;
};
type View = 'dashboard' | 'programs' | 'evaluations' | 'reports' | 'settings';
type FormState = { name_ar: string; name_en: string; description_ar: string; start_date: string; end_date: string };

const labels: Record<View, string> = {
  dashboard: '📊 لوحة التحكم', programs: '📋 البرامج التدريبية',
  evaluations: '📝 التقييمات', reports: '📑 التقارير', settings: '⚙️ الإعدادات'
};
const emptyForm: FormState = { name_ar: '', name_en: '', description_ar: '', start_date: '', end_date: '' };

const STATUS_STYLE: Record<Program['status'], { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#475569', label: 'مسودة / Draft' },
  ACTIVE: { bg: '#d1fae5', color: '#047857', label: 'نشط / Active' },
  COMPLETED: { bg: '#dbeafe', color: '#1d4ed8', label: 'مكتمل / Completed' },
  CANCELLED: { bg: '#fee2e2', color: '#b91c1c', label: 'ملغى / Cancelled' }
};

export default function Dashboard() {
  const db = supabase(), router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [view, setView] = useState<View>('dashboard');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [evalStats, setEvalStats] = useState({ daily: 0, final: 0, avg: 0 });

  const notify = (s: string) => { setNotice(s); setTimeout(() => setNotice(''), 4000); };

  async function load() {
    setLoading(true);
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    const [p, pr, d, f] = await Promise.all([
      db.from('profiles').select('full_name,role,organization_id,phone').eq('id', user.id).single(),
      db.from('programs').select('id,name_ar,name_en,description_ar,status,start_date,end_date,created_at').order('created_at', { ascending: false }),
      db.from('evaluations').select('overall_rating', { count: 'exact', head: false }).eq('kind', 'DAILY'),
      db.from('evaluations').select('id', { count: 'exact', head: false }).eq('kind', 'FINAL')
    ]);
    setProfile(p.data);
    setPrograms(pr.data || []);
    const values = (d.data || []).map(x => Number(x.overall_rating || 0)).filter(Boolean);
    setEvalStats({ daily: d.count || 0, final: f.count || 0, avg: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 });
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function logout() { await db.auth.signOut(); router.replace('/'); }

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(p: Program) {
    setEditing(p);
    setForm({
      name_ar: p.name_ar || '', name_en: p.name_en || '',
      description_ar: p.description_ar || '',
      start_date: p.start_date || '', end_date: p.end_date || ''
    });
    setShowForm(true);
  }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm); }

  async function saveProgram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!profile) return;
    if (!form.name_ar.trim()) { notify('اسم البرنامج بالعربية مطلوب.'); return; }
    setSaving(true);
    const payload = {
      name_ar: form.name_ar.trim(),
      name_en: form.name_en.trim() || null,
      description_ar: form.description_ar.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null
    };
    if (editing) {
      const { error } = await db.from('programs').update(payload).eq('id', editing.id);
      if (error) { notify('تعذر التعديل: ' + error.message); setSaving(false); return; }
      notify('✅ تم تحديث البرنامج');
    } else {
      const { error } = await db.from('programs').insert({ organization_id: profile.organization_id, status: 'DRAFT', ...payload });
      if (error) { notify('تعذر إضافة البرنامج: ' + error.message); setSaving(false); return; }
      notify('✅ تمت إضافة البرنامج كمسودة');
    }
    setSaving(false); closeForm(); load();
  }

  async function setStatus(id: string, status: Program['status']) {
    const { error } = await db.from('programs').update({ status }).eq('id', id);
    if (error) { notify('تعذر تحديث الحالة: ' + error.message); return; }
    notify('✅ تم تحديث حالة البرنامج'); load();
  }

  async function deleteProgram(p: Program) {
    if (!window.confirm(`حذف البرنامج "${p.name_ar}" نهائيًا؟\nملاحظة: إن كانت له تقييمات أو قاعات مرتبطة فقد يرفض النظام الحذف حفاظًا على البيانات.`)) return;
    const { error } = await db.from('programs').delete().eq('id', p.id);
    if (error) { notify('تعذر الحذف (قد تكون هناك بيانات مرتبطة): ' + error.message); return; }
    notify('✅ تم حذف البرنامج'); load();
  }

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile) return;
    const fd = new FormData(e.currentTarget);
    const { error } = await db.from('profiles').update({
      full_name: String(fd.get('full_name')), phone: String(fd.get('phone') || '') || null
    }).eq('id', (await db.auth.getUser()).data.user?.id);
    if (error) { notify('تعذر الحفظ: ' + error.message); return; }
    notify('✅ تم حفظ الملف الشخصي'); load();
  }

  if (loading) return <main className="center">جارٍ تحميل المنصة…</main>;
  if (!profile) return <main className="center">تعذر تحميل ملف المستخدم. أعد تسجيل الدخول.</main>;

  return (
    <main className="app">
      <aside>
        <b>🏛️ منصة التقويم</b>
        <small>{profile?.role || 'USER'}</small>
        {(Object.keys(labels) as View[]).map(k => (
          <button key={k} className={view === k ? 'active' : ''} onClick={() => setView(k)}>{labels[k]}</button>
        ))}
        <button onClick={logout}>🚪 تسجيل الخروج</button>
      </aside>
      <section>
        <header>
          <div><h1>مرحباً، {profile?.full_name || 'مدير المنصة'} 👋</h1><p>{labels[view]}</p></div>
          <button className="outline" onClick={load}>🔄 تحديث</button>
        </header>
        {notice && <div className="error">{notice}</div>}
        {view === "dashboard" && (
  <CommandCenter
    profile={profile}
    programs={programs}
    stats={evalStats}
    onRefresh={load}
  />
)}
        {view === 'evaluations' && <Evaluations stats={evalStats} />}
        {view === 'reports' && <Reports programs={programs} stats={evalStats} />}
        {view === 'settings' && <Settings profile={profile} updateProfile={updateProfile} />}
      </section>
    </main>
  );
}

function DashboardHome({ programs, stats, onPrograms }: { programs: Program[]; stats: { daily: number; final: number; avg: number }; onPrograms: () => void }) {
  return (
    <>
      <div className="stats">
        <article><small>البرامج / Programs</small><b>{programs.length}</b></article>
        <article><small>البرامج النشطة / Active</small><b>{programs.filter(x => x.status === 'ACTIVE').length}</b></article>
        <article><small>متوسط الرضا / Avg Rating</small><b>{stats.avg ? stats.avg.toFixed(1) + '/5' : '—'}</b></article>
        <article><small>تقييمات يومية / Daily</small><b>{stats.daily}</b></article>
      </div>
      <div className="panel">
        <h2>البدء السريع / Quick Start</h2>
        <p>أضف برنامجاً، فعّله، ثم أدر القاعات والمدربين، وابدأ جمع التقييمات.</p>
        <button className="button" onClick={onPrograms}>إدارة البرامج ←</button>
      </div>
    </>
  );
}

function Programs(props: {
  programs: Program[]; showForm: boolean; editing: Program | null; form: FormState; saving: boolean;
  setForm: (f: FormState) => void; openAdd: () => void; openEdit: (p: Program) => void; closeForm: () => void;
  saveProgram: (e: React.FormEvent<HTMLFormElement>) => void; setStatus: (id: string, s: Program['status']) => void;
  deleteProgram: (p: Program) => void;
}) {
  const { programs, showForm, editing, form, saving, setForm, openAdd, openEdit, closeForm, saveProgram, setStatus, deleteProgram } = props;
  const field = { padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', width: '100%', font: 'inherit' };
  return (
    <>
      <div className="toolbar">
        <button className="button" onClick={openAdd}>＋ برنامج جديد / New Program</button>
      </div>

      {showForm && (
        <form className="panel formgrid" onSubmit={saveProgram} style={{ borderColor: editing ? '#0d9488' : undefined, borderWidth: editing ? 2 : undefined }}>
          <h2>{editing ? '✏️ تعديل البرنامج / Edit Program' : '➕ إضافة برنامج تدريبي / Add Program'}</h2>
          <label>اسم البرنامج بالعربية * / Arabic name *
            <input style={field} value={form.name_ar} required onChange={e => setForm({ ...form, name_ar: e.target.value })} />
          </label>
          <label>الاسم بالإنجليزية / English name
            <input style={field} value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} />
          </label>
          <label>تاريخ البداية / Start date
            <input style={field} type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </label>
          <label>تاريخ النهاية / End date
            <input style={field} type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </label>
          <label className="wide">وصف البرنامج / Description
            <textarea style={field} rows={3} value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} />
          </label>
          <div className="toolbar wide">
            <button className="button" disabled={saving}>{saving ? '⏳ جارٍ الحفظ…' : (editing ? 'حفظ التعديلات' : 'حفظ كمسودة')}</button>
            <button type="button" className="outline" onClick={closeForm}>إلغاء / Cancel</button>
          </div>
        </form>
      )}

      <div className="panel">
        <h2>البرامج التدريبية / Training Programs</h2>
        {programs.length ? programs.map(p => {
          const st = STATUS_STYLE[p.status];
          return (
            <div className="program" key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '14px', borderBottom: '1px solid #eef2f6' }}>
              <div style={{ flex: 1, minWidth: '220px' }}>
                <b>{p.name_ar}</b> {p.name_en && <span style={{ color: '#64748b', fontSize: '12px' }}>/ {p.name_en}</span>}
                <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '12px' }}>
                  {p.start_date || 'بدون تاريخ'} {p.end_date ? ' — ' + p.end_date : ''}
                </p>
              </div>
              <span style={{ background: st.bg, color: st.color, padding: '5px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, whiteSpace: 'nowrap' }}>{st.label}</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button className="outline" onClick={() => openEdit(p)}>✏️</button>
                {p.status === 'DRAFT' && <button className="outline" onClick={() => setStatus(p.id, 'ACTIVE')}>تفعيل</button>}
                {p.status === 'ACTIVE' && <button className="outline" onClick={() => setStatus(p.id, 'COMPLETED')}>إنهاء</button>}
                {p.status !== 'CANCELLED' && <button className="outline" onClick={() => setStatus(p.id, 'CANCELLED')}>تعطيل</button>}
                <button className="outline" style={{ color: '#b91c1c', borderColor: '#fecaca' }} onClick={() => deleteProgram(p)}>🗑️</button>
              </div>
            </div>
          );
        }) : <p>لا توجد برامج. أضف برنامجاً جديداً.</p>}
      </div>
    </>
  );
}

function Evaluations({ stats }: { stats: { daily: number; final: number; avg: number } }) {
  return (
    <>
      <div className="stats">
        <article><small>تقييمات يومية / Daily</small><b>{stats.daily}</b></article>
        <article><small>تقييمات نهائية / Final</small><b>{stats.final}</b></article>
        <article><small>المتوسط العام / Avg</small><b>{stats.avg ? stats.avg.toFixed(1) + '/5' : '—'}</b></article>
      </div>
      <div className="panel">
        <h2>استبيانات البرنامج / Evaluation Forms</h2>
        <p>افتح النموذج المطلوب. يُفضّل مشاركة رابط الاستبيان مع المتدربين عبر QR.</p>
        <div className="toolbar">
          <a className="button" href="/evaluate/daily">📝 الاستبيان اليومي / Daily</a>
          <a className="outline" href="/evaluate/final">🏁 الاستبيان النهائي / Final</a>
        </div>
      </div>
    </>
  );
}

function Reports({ programs, stats }: { programs: Program[]; stats: { daily: number; final: number; avg: number } }) {
  const active = programs.filter(x => x.status === 'ACTIVE').length;
  return (
    <>
      <div className="stats">
        <article><small>تغطية البرامج / Programs</small><b>{programs.length}</b></article>
        <article><small>برامج نشطة / Active</small><b>{active}</b></article>
        <article><small>رضا مبدئي / Satisfaction</small><b>{stats.avg ? Math.round(stats.avg / 5 * 100) + '%' : '—'}</b></article>
      </div>
      <div className="panel">
        <h2>التقرير التحليلي / Analytical Report</h2>
        <p>{stats.daily ? `تم استلام ${stats.daily} تقييماً يومياً ومتوسط الرضا ${stats.avg.toFixed(1)} من 5.` : 'ابدأ بجمع التقييمات لإنتاج التقرير التفصيلي لكل مؤشر.'}</p>
        <Link href="/reports" style={{ background: '#0d9488', color: '#fff', padding: '12px 24px', borderRadius: 10, textDecoration: 'none', display: 'inline-block', fontWeight: 800 }}>
          فتح التقرير التحليلي الكامل / Open Full Report
        </Link>
      </div>
    </>
  );
}

function Settings({ profile, updateProfile }: { profile: Profile; updateProfile: (e: React.FormEvent<HTMLFormElement>) => void }) {
  return (
    <form className="panel formgrid" onSubmit={updateProfile}>
      <h2>الملف الشخصي / Profile</h2>
      <label>الاسم الكامل / Full name<input name="full_name" defaultValue={profile.full_name} required /></label>
      <label>رقم الجوال / Phone<input name="phone" defaultValue={profile.phone || ''} /></label>
      <label>الصلاحية / Role<input disabled value={profile.role} /></label>
      <p className="wide">لتغيير كلمة المرور استخدم إعادة التعيين الآمن من Supabase Auth.</p>
      <button className="button">حفظ التعديلات / Save</button>
    </form>
  );
}
