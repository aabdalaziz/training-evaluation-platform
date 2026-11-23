'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { downloadCSV, safeFilename } from '../../../lib/export/csv';
import { accessMatrix, diffAssignments, roleLabel, accessCsv, SCOPABLE_ROLES, UNRESTRICTED_ROLES } from '../../../lib/access/model';
import type { Assignment, Profile, ProgramLite } from '../../../lib/access/model';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const NAVY = '#3A1F36', TEAL = '#D4614A', GOLD = '#D9A866';
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

  if (!ready) return <div className="ac rm-page" style={{ padding: 40, textAlign: 'center' }}>جارٍ التحميل…</div>;

  return (
    <div className="ac rm-page" dir="rtl">
      <style>{CSS}</style>
      <RoomHead
        title={<>أدوار دقيقة لكل برنامج</>}
        desc={<><p>اربط مدير البرنامج ببرامجه، فيرى ويعدّل بياناتها فقط (البرامج، القاعات، التقييمات، الحضور، الشهادات، المتابعات، الأثر، المؤشرات) — التقييد يُطبَّق في قاعدة البيانات نفسها (RLS) لا في الواجهة فقط. مدير بلا ربط يبقى كما هو اليوم (يرى الكل).</p></>}
        actions={<>
          <button className="rm-btn" onClick={() => downloadCSV(safeFilename('program_access'), accessCsv(rows))}><Icon name="download" size={16} /> CSV</button>
        </>}
      />
      {error && <div className="rm-alert">{error}</div>}
      {ok && <div className="rm-alert ok">{ok}</div>}
      {!isAdmin && <div className="rm-alert warn">عرض فقط — تعديل الربط متاح لمديري المنصة والإداريين.</div>}

      <section className="rm-kpis">
        <div className="rm-kpi"><b>{stats.managers}</b><span>مديرو برامج</span></div>
        <div className="rm-kpi ok"><b>{stats.scoped}</b><span>مقيّدون ببرامجهم</span></div>
        <div className="rm-kpi warn"><b>{stats.open}</b><span>يرون كل البرامج</span></div>
        <div className="rm-kpi"><b>{stats.links}</b><span>روابط برنامج↔مدير</span></div>
      </section>

      <section className="rm-card">
        <div className="ac-filters">
          <input placeholder="بحث بالاسم أو البريد…" value={q} onChange={e => setQ(e.target.value)} />
          <label className="ac-toggle"><input type="checkbox" checked={onlyManagers} onChange={e => setOnlyManagers(e.target.checked)} /> مديرو البرامج فقط</label>
        </div>
        {!rows.length && <div className="rm-empty"><Icon name="users" size={34} /><b>لا يوجد مستخدمون مطابقون</b><span>عيّن دور «مدير برنامج» للمستخدم أولًا من إدارة المستخدمين، ثم اربطه ببرامجه هنا.</span></div>}
        <div className="ac-list">
          {rows.map(r => {
            const isEditing = editing === r.profile.id; const scopable = SCOPABLE_ROLES.includes(r.role);
            return (
              <article key={r.profile.id} className={`ac-row ${r.scope.kind}`}>
                <div className="ac-row-main">
                  <div className="ac-who"><b>{r.profile.full_name || r.profile.email || r.profile.id}</b><span>{r.profile.email || '—'} · {roleLabel(r.role)}</span></div>
                  <div className="ac-scope"><span className={`ac-st ${r.scope.kind}`}>{r.scope.kind === 'subset' ? `مقيّد: ${r.programs.length} برنامج` : r.scope.kind === 'all' ? 'كل البرامج' : 'بلا صلاحية'}</span><small>{r.scope.reason}</small></div>
                  <div className="ac-progs">{r.programs.length ? r.programs.map(p => <span key={p.id} className="ac-chip">{p.name_ar || p.id}</span>) : <small className="rm-muted">{scopable ? 'لم يُربط بأي برنامج' : UNRESTRICTED_ROLES.includes(r.role) ? 'غير قابل للتقييد' : '—'}</small>}</div>
                  <div className="ac-actions">{scopable && isAdmin && !isEditing && <button className="rm-btn" onClick={() => startEdit(r.profile.id)}><Icon name="edit" size={14} /> تعديل الربط</button>}</div>
                </div>
                {isEditing && (
                  <div className="ac-edit">
                    <div className="ac-edit-head"><b>اختر البرامج التي يديرها {r.profile.full_name || r.profile.email}</b><span>{draft.length} من {programs.length}</span><button className="ac-link" onClick={() => setDraft(programs.map(p => p.id))}>تحديد الكل</button><button className="ac-link" onClick={() => setDraft([])}>مسح</button></div>
                    <div className="ac-grid">
                      {programs.map(p => <label key={p.id} className={`ac-opt ${draft.includes(p.id) ? 'on' : ''}`}><input type="checkbox" checked={draft.includes(p.id)} onChange={e => setDraft(d => e.target.checked ? [...d, p.id] : d.filter(x => x !== p.id))} /><span>{p.name_ar || p.id}</span><small>{p.status || ''}</small></label>)}
                    </div>
                    {draft.length === 0 && <div className="ac-note">بلا أي ربط = يعود المدير لرؤية كل البرامج (الوضع الافتراضي).</div>}
                    <div className="ac-edit-foot"><button className="rm-btn primary" disabled={saving} onClick={save}><Icon name="save" size={15} /> {saving ? 'جارٍ الحفظ…' : 'حفظ'}</button><button className="rm-btn" disabled={saving} onClick={() => setEditing(null)}>إلغاء</button></div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <section className="rm-card ac-how">
        <b>كيف يعمل؟</b> عند الربط، تُطبَّق سياسات تقييدية في Supabase على جداول: البرامج، القاعات، الجداول، التقييمات وإجاباتها، الشهادات، جلسات الحضور وسجلاته، المتابعات السلوكية، أدوات الأثر، المؤشرات المؤسسية وقياساتها، وسجل بريد المتدربين. المدرّبون والأسئلة والإعدادات العامة تبقى مشتركة. إذا أنشأ مدير مقيّد برنامجًا جديدًا يُربط به تلقائيًا. كل تغيير في الربط يُسجَّل في سجل التدقيق.
      </section>
    </div>
  );
}

const CSS = `
.ac{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626}
.ac *{box-sizing:border-box}
.ac-link{border:0;background:transparent;color:${TEAL};font:inherit;font-size:12.5px;font-weight:900;cursor:pointer;padding:0 6px}
.ac-filters{display:flex;gap:12px;align-items:center;margin-bottom:12px;flex-wrap:wrap}.ac-filters input[type=text],.ac-filters input:not([type]){flex:1;min-width:220px;border:1px solid #D9CBC2;border-radius:10px;padding:9px 10px;font:inherit;font-size:13px;font-weight:700}
.ac-toggle{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:800;color:#5C4858;cursor:pointer}
.ac-list{display:flex;flex-direction:column;gap:8px}
.ac-row{border:1px solid #EADFD6;border-radius:12px;overflow:hidden;border-inline-start:4px solid #D9CBC2}.ac-row.subset{border-inline-start-color:#2F6B66}.ac-row.all{border-inline-start-color:#8A5A1E}.ac-row.none{border-inline-start-color:#B3A5AE}
.ac-row-main{display:grid;grid-template-columns:220px 180px 1fr auto;gap:12px;align-items:center;padding:10px 14px}
.ac-who{min-width:0}.ac-who b{display:block;font-size:13.5px;color:${NAVY};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-who span{font-size:11.5px;color:#8E7F8A;font-weight:700}
.ac-scope{display:flex;flex-direction:column;gap:3px}.ac-scope small{font-size:11px;color:#B3A5AE;font-weight:700}
.ac-st{font-size:11px;font-weight:900;border-radius:999px;padding:3px 9px;background:#F6EBE0;color:#5C4858;width:max-content}.ac-st.subset{background:#E6F3F1;color:#2F6B66}.ac-st.all{background:#FBF4EE;color:#8A5A1E}
.ac-progs{display:flex;flex-wrap:wrap;gap:5px;min-width:0}.ac-chip{font-size:11.5px;font-weight:800;background:#F3E8EF;color:#3A1F36;border-radius:999px;padding:3px 9px}
.ac-edit{border-top:1px solid #EADFD6;background:#FBF4EE;padding:12px 14px}.ac-edit-head{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px;font-size:13px}.ac-edit-head b{color:${NAVY}}.ac-edit-head span{color:#8E7F8A;font-weight:800;font-size:12px}
.ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px}
.ac-opt{display:flex;align-items:center;gap:8px;border:1px solid #EADFD6;background:#fff;border-radius:10px;padding:8px 10px;font-size:13px;font-weight:800;color:#4A3645;cursor:pointer}.ac-opt.on{border-color:${TEAL};background:#FBEDE7}.ac-opt span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ac-opt small{font-size:10.5px;color:#B3A5AE}
.ac-note{margin-top:10px;font-size:12.5px;color:#9A3A2A;font-weight:800}
.ac-edit-foot{display:flex;gap:8px;margin-top:12px}
.ac-how{font-size:13px;line-height:1.9;color:#4A3645;background:#FBEDE7;border-color:#BFE1DC}
@media(max-width:980px){.ac{}.ac-row-main{grid-template-columns:1fr;gap:8px}.ac-grid{grid-template-columns:1fr}}
`;
