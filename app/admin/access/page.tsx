'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { accessMatrix, diffAssignments, roleLabel, accessCsv, SCOPABLE_ROLES, UNRESTRICTED_ROLES } from '../../../lib/access/model';
import type { Assignment, Profile, ProgramLite } from '../../../lib/access/model';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b';
const ADMIN_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];

export default function AccessPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]); const [programs, setPrograms] = useState<ProgramLite[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [editing, setEditing] = useState<string | null>(null); const [draft, setDraft] = useState<string[]>([]); const [saving, setSaving] = useState(false);
  const [q, setQ] = useState(''); const [onlyManagers, setOnlyManagers] = useState(true);

  async function load() {
    const [p, pg, a] = await Promise.all([
      db.from('profiles').select('id,full_name,email,role').limit(1000),
      db.from('programs').select('id,name_ar,status').order('name_ar'),
      db.from('program_managers').select('profile_id,program_id,assigned_at,assigned_by'),
    ]);
    if (a.error && /program_managers/.test(a.error.message)) setError('جدول الربط غير موجود — نفّذ ملف SQL (20261101_program_scoped_access.sql) في Supabase.');
    else if (p.error || pg.error || a.error) setError((p.error || pg.error || a.error)!.message);
    setProfiles((p.data || []) as any[]); setPrograms((pg.data || []) as any[]); setAssignments((a.data || []) as any[]);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/access'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      const role = String((prof as any)?.role || '').toUpperCase();
      setMe({ id: user.id, role });
      await load(); setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows = useMemo(() => accessMatrix(profiles, assignments, programs).filter(r => (!onlyManagers || SCOPABLE_ROLES.includes(r.role)) && (!q || [r.profile.full_name, r.profile.email, roleLabel(r.role)].join(' ').toLowerCase().includes(q.toLowerCase()))), [profiles, assignments, programs, q, onlyManagers]);
  const stats = useMemo(() => { const m = accessMatrix(profiles, assignments, programs); const mgrs = m.filter(r => SCOPABLE_ROLES.includes(r.role)); return { managers: mgrs.length, scoped: mgrs.filter(r => r.scope.kind === 'subset').length, open: mgrs.filter(r => r.scope.kind === 'all').length, links: assignments.length }; }, [profiles, assignments, programs]);
  const isAdmin = !!me && ADMIN_ROLES.includes(me.role);

  function startEdit(profileId: string) { setEditing(profileId); setDraft(assignments.filter(a => a.profile_id === profileId).map(a => a.program_id)); setOk(''); setError(''); }
  async function save() {
    if (!editing || !me) return;
    setSaving(true); setError('');
    try {
      const { add, remove } = diffAssignments(editing, assignments, draft);
      if (add.length) { const { error } = await db.from('program_managers').insert(add.map(a => ({ ...a, assigned_by: me.id }))); if (error) throw error; }
      for (const r of remove) { const { error } = await db.from('program_managers').delete().eq('profile_id', r.profile_id).eq('program_id', r.program_id); if (error) throw error; }
      await load(); setOk(`تم الحفظ: +${add.length} / −${remove.length}`); setEditing(null);
    } catch (e: any) { setError(e?.message || 'تعذر الحفظ'); } finally { setSaving(false); }
  }

  if (!ready) return <div className="ac" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="ac" dir="rtl">
      <style>{CSS}</style>
      <header className="ac-head">
        <div>
          <div className="ac-kicker"><Icon name="shield" size={14} /> الحوكمة · نطاق الوصول</div>
          <h1>أدوار دقيقة لكل برنامج</h1>
          <p>اربط مدير البرنامج ببرامجه، فيرى ويعدّل بياناتها فقط (البرامج، القاعات، التقييمات، الحضور، الشهادات، المتابعات، الأثر، المؤشرات) — التقييد يُطبَّق في قاعدة البيانات نفسها (RLS) لا في الواجهة فقط. مدير بلا ربط يبقى كما هو اليوم (يرى الكل).</p>
        </div>
        <nav className="ac-nav">
          <Link href="/dashboard" className="ac-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/management" className="ac-btn"><Icon name="admin" size={16} /> مركز الإدارة</Link>
          <Link href="/admin/audit" className="ac-btn"><Icon name="shield" size={16} /> سجل التدقيق</Link>
          <button className="ac-btn" onClick={() => downloadCSV(safeFilename('program_access'), accessCsv(rows))}><Icon name="download" size={16} /> CSV</button>
        </nav>
      </header>
      {error && <div className="ac-alert">{error}</div>}
      {ok && <div className="ac-alert ok">{ok}</div>}
      {!isAdmin && <div className="ac-alert warn">عرض فقط — تعديل الربط متاح لمديري المنصة والإداريين.</div>}

      <section className="ac-kpis">
        <div className="ac-kpi"><b>{stats.managers}</b><span>مديرو برامج</span></div>
        <div className="ac-kpi ok"><b>{stats.scoped}</b><span>مقيّدون ببرامجهم</span></div>
        <div className="ac-kpi warn"><b>{stats.open}</b><span>يرون كل البرامج</span></div>
        <div className="ac-kpi"><b>{stats.links}</b><span>روابط برنامج↔مدير</span></div>
      </section>

      <section className="ac-card">
        <div className="ac-filters">
          <input placeholder="بحث بالاسم أو البريد…" value={q} onChange={e => setQ(e.target.value)} />
          <label className="ac-toggle"><input type="checkbox" checked={onlyManagers} onChange={e => setOnlyManagers(e.target.checked)} /> مديرو البرامج فقط</label>
        </div>
        {!rows.length && <div className="ac-empty"><Icon name="users" size={34} /><b>لا يوجد مستخدمون مطابقون</b><span>عيّن دور «مدير برنامج» للمستخدم أولًا من إدارة المستخدمين، ثم اربطه ببرامجه هنا.</span></div>}
        <div className="ac-list">
          {rows.map(r => {
            const isEditing = editing === r.profile.id; const scopable = SCOPABLE_ROLES.includes(r.role);
            return (
              <article key={r.profile.id} className={`ac-row ${r.scope.kind}`}>
                <div className="ac-row-main">
                  <div className="ac-who"><b>{r.profile.full_name || r.profile.email || r.profile.id}</b><span>{r.profile.email || '—'} · {roleLabel(r.role)}</span></div>
                  <div className="ac-scope"><span className={`ac-st ${r.scope.kind}`}>{r.scope.kind === 'subset' ? `مقيّد: ${r.programs.length} برنامج` : r.scope.kind === 'all' ? 'كل البرامج' : 'بلا صلاحية'}</span><small>{r.scope.reason}</small></div>
                  <div className="ac-progs">{r.programs.length ? r.programs.map(p => <span key={p.id} className="ac-chip">{p.name_ar || p.id}</span>) : <small className="ac-muted">{scopable ? 'لم يُربط بأي برنامج' : UNRESTRICTED_ROLES.includes(r.role) ? 'غير قابل للتقييد' : '—'}</small>}</div>
                  <div className="ac-actions">{scopable && isAdmin && !isEditing && <button className="ac-btn" onClick={() => startEdit(r.profile.id)}><Icon name="edit" size={14} /> تعديل الربط</button>}</div>
                </div>
                {isEditing && (
                  <div className="ac-edit">
                    <div className="ac-edit-head"><b>اختر البرامج التي يديرها {r.profile.full_name || r.profile.email}</b><span>{draft.length} من {programs.length}</span><button className="ac-link" onClick={() => setDraft(programs.map(p => p.id))}>تحديد الكل</button><button className="ac-link" onClick={() => setDraft([])}>مسح</button></div>
                    <div className="ac-grid">
                      {programs.map(p => <label key={p.id} className={`ac-opt ${draft.includes(p.id) ? 'on' : ''}`}><input type="checkbox" checked={draft.includes(p.id)} onChange={e => setDraft(d => e.target.checked ? [...d, p.id] : d.filter(x => x !== p.id))} /><span>{p.name_ar || p.id}</span><small>{p.status || ''}</small></label>)}
                    </div>
                    {draft.length === 0 && <div className="ac-note">بلا أي ربط = يعود المدير لرؤية كل البرامج (الوضع الافتراضي).</div>}
                    <div className="ac-edit-foot"><button className="ac-btn primary" disabled={saving} onClick={save}><Icon name="save" size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}</button><button className="ac-btn" disabled={saving} onClick={() => setEditing(null)}>إلغاء</button></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="ac-card ac-how">
        <b>كيف يعمل؟</b> عند الربط، تُطبَّق سياسات تقييدية في Supabase على جداول: البرامج، القاعات، الجداول، التقييمات وإجاباتها، الشهادات، جلسات الحضور وسجلاته، المتابعات السلوكية، أدوات الأثر، المؤشرات المؤسسية وقياساتها، وسجل بريد المتدربين. المدرّبون والأسئلة والإعدادات العامة تبقى مشتركة. إذا أنشأ مدير مقيّد برنامجًا جديدًا يُربط به تلقائيًا. كل تغيير في الربط يُسجَّل في سجل التدقيق.
      </section>
    </div>
  );
}

const CSS = `
.ac{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.ac *{box-sizing:border-box}
.ac-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.ac-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.ac-head p{margin:0;color:#64748b;font-size:13px;max-width:760px;line-height:1.7}
.ac-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.ac-nav{display:flex;gap:8px;flex-wrap:wrap}
.ac-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 13px;font:inherit;font-size:13px;font-weight:800;color:${NAVY};cursor:pointer;text-decoration:none}.ac-btn:disabled{opacity:.5}.ac-btn.primary{background:${TEAL};border-color:${TEAL};color:#fff}
.ac-link{border:0;background:transparent;color:${TEAL};font:inherit;font-size:12.5px;font-weight:900;cursor:pointer;padding:0 6px}
.ac-alert{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-weight:700}.ac-alert.ok{background:#ecfdf5;border-color:#a7f3d0;color:#065f46}.ac-alert.warn{background:#fff7ed;border-color:#fed7aa;color:#9a3412}
.ac-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.ac-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px}.ac-kpi b{display:block;font-size:22px;color:${NAVY}}.ac-kpi span{font-size:12px;font-weight:800;color:#64748b}.ac-kpi.ok b{color:#047857}.ac-kpi.warn b{color:#b45309}
.ac-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;margin-bottom:14px;min-width:0}
.ac-filters{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.ac-filters input[type=text],.ac-filters input:not([type]){flex:1;min-width:220px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:inherit;font-size:13px;font-weight:700}
.ac-toggle{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#475569;cursor:pointer}
.ac-empty{display:flex;flex-direction:column;align-items:center;gap:8px;padding:34px;text-align:center;color:#64748b}.ac-empty b{color:${NAVY};font-size:15px}
.ac-list{display:flex;flex-direction:column;gap:8px}
.ac-row{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;border-inline-start:4px solid #cbd5e1}.ac-row.subset{border-inline-start-color:#059669}.ac-row.all{border-inline-start-color:#d97706}.ac-row.none{border-inline-start-color:#94a3b8}
.ac-row-main{display:grid;grid-template-columns:220px 180px 1fr auto;gap:12px;align-items:center;padding:10px 14px}
.ac-who{min-width:0}.ac-who b{display:block;font-size:13.5px;color:${NAVY};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-who span{font-size:11.5px;color:#64748b;font-weight:700}
.ac-scope{display:flex;flex-direction:column;gap:3px}.ac-scope small{font-size:11px;color:#94a3b8;font-weight:700}
.ac-st{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:#f1f5f9;color:#475569;width:max-content}.ac-st.subset{background:#ecfdf5;color:#047857}.ac-st.all{background:#fff7ed;color:#b45309}
.ac-progs{display:flex;flex-wrap:wrap;gap:5px;min-width:0}.ac-chip{font-size:11.5px;font-weight:800;background:#eff6ff;color:#1e3a8a;border-radius:999px;padding:3px 9px}.ac-muted{color:#94a3b8;font-weight:700;font-size:12px}
.ac-edit{border-top:1px solid #e2e8f0;background:#f8fafc;padding:12px 14px}.ac-edit-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:13px}.ac-edit-head b{color:${NAVY}}.ac-edit-head span{color:#64748b;font-weight:800;font-size:12px}
.ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
.ac-opt{display:flex;align-items:center;gap:8px;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:800;color:#334155;cursor:pointer}.ac-opt.on{border-color:${TEAL};background:#f0fdfa}.ac-opt span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-opt small{font-size:10.5px;color:#94a3b8}
.ac-note{margin-top:10px;font-size:12.5px;color:#9a3412;font-weight:800}
.ac-edit-foot{display:flex;gap:8px;margin-top:12px}
.ac-how{font-size:13px;line-height:1.9;color:#334155;background:#f0fdfa;border-color:#99f6e4}
@media(max-width:980px){.ac{padding:12px}.ac-kpis{grid-template-columns:repeat(2,1fr)}.ac-row-main{grid-template-columns:1fr;gap:8px}.ac-grid{grid-template-columns:1fr}}
`;
