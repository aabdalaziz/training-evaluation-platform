'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — إدارة مستودع الحقائب: إنشاء/تحرير · وسم المهارات والقطاع · مستوى الوصول · رفع الملفات · نشر/أرشفة · إحصاءات التنزيل · Excel

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import type { IconName } from '../../../lib/ui/icons';
import { downloadXlsx } from '../../../lib/export/xlsx';
import { safeFilename } from '../../../lib/export/csv';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { RES_TYPES, RES_LEVELS, RES_DELIVERY, RES_LANGS, RES_ACCESS, EMPTY_RES, validateResource, resourcePayload, resourceToForm, typeLabel, typeIcon, levelLabel, accessLabel, statusLabel, fmtSize, storageName, resourcesSheet, eventsSheet, resourceStats } from '../../../lib/portal/resources';
import type { Resource, ResourceFile, ResForm, ResStatus, LearningEvent } from '../../../lib/portal/resources';
import { SECTORS_FALLBACK, skillName, domainLabel, DOMAINS } from '../../../lib/portal/skills';
import type { Skill, Sector, Organization } from '../../../lib/portal/skills';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const BUCKET = 'portal-resources';
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
type Prog = { id: string; name_ar: string; status?: string | null };
const FILTERS: { k: ResStatus | 'all'; l: string }[] = [{ k: 'all', l: 'الكل' }, { k: 'published', l: 'منشورة' }, { k: 'draft', l: 'مسودات' }, { k: 'archived', l: 'مؤرشفة' }];

export default function Page() { return <Suspense fallback={null}><ResourcesAdmin /></Suspense>; }

function ResourcesAdmin() {
  const db = useMemo(() => supabase(), []); const router = useRouter(); const sp = useSearchParams();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [rows, setRows] = useState<Resource[]>([]); const [skills, setSkills] = useState<Skill[]>([]); const [sectors, setSectors] = useState<Sector[]>(SECTORS_FALLBACK); const [orgs, setOrgs] = useState<Organization[]>([]); const [progs, setProgs] = useState<Prog[]>([]);
  const [filter, setFilter] = useState<ResStatus | 'all'>('all'); const [type, setType] = useState('all'); const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(sp.get('open')); const [files, setFiles] = useState<ResourceFile[]>([]); const [events, setEvents] = useState<LearningEvent[]>([]);
  const [form, setForm] = useState<ResForm | null>(null); const [editing, setEditing] = useState<string | null>(null); const [busy, setBusy] = useState(''); const [skillQ, setSkillQ] = useState(''); const [progress, setProgress] = useState('');
  const canWrite = !!me && WRITERS.includes(me.role);

  async function load() {
    const [{ data: r, error: e1 }, { data: s }, { data: sec }, { data: o }, { data: p }] = await Promise.all([
      db.from('portal_resources').select('*').order('updated_at', { ascending: false }).limit(1000),
      db.from('portal_skills').select('*').order('code'),
      db.from('portal_sectors').select('*').order('sort'),
      db.from('portal_organizations').select('*').order('name_ar'),
      db.from('programs').select('id,name_ar,status').is('archived_at', null).order('start_date', { ascending: false }).limit(300),
    ]);
    if (e1) { setError(e1.message); return; }
    setRows((r || []) as Resource[]); setSkills((s || []) as Skill[]); if (sec && (sec as any[]).length) setSectors(sec as Sector[]); setOrgs((o || []) as Organization[]); setProgs((p || []) as Prog[]);
  }
  async function loadDetail(id: string) {
    const [{ data: f }, { data: ev }] = await Promise.all([
      db.from('portal_resource_files').select('*').eq('resource_id', id).order('sort'),
      db.from('portal_learning_events').select('*').eq('object_type', 'resource_file').contains('context', { resource_id: id }).order('at', { ascending: false }).limit(50),
    ]);
    setFiles((f || []) as ResourceFile[]); setEvents((ev || []) as LearningEvent[]);
  }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { router.replace('/login?next=/admin/resources'); return; }
      const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
      const role = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(role)) { router.replace('/dashboard'); return; }
      setMe({ id: user.id, role }); await load(); setReady(true);
    })();
  }, [db, router]);
  useEffect(() => { if (open) loadDetail(open); else { setFiles([]); setEvents([]); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<string | void>) => { setBusy(key); setError(''); setNotice(''); try { const m = await fn(); if (m) setNotice(m); await load(); if (open) await loadDetail(open); } catch (e: any) { setError(e.message || String(e)); } setBusy(''); };
  const shown = useMemo(() => rows.filter(r => (filter === 'all' || r.status === filter) && (type === 'all' || r.type === type) && (!q.trim() || `${r.title_ar} ${r.title_en || ''} ${(r.tags || []).join(' ')}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, filter, type, q]);
  const stats = useMemo(() => resourceStats(rows), [rows]);
  const skillById = useMemo(() => new Map(skills.map(s => [s.id, s])), [skills]);
  const secName = (c?: string | null) => sectors.find(s => s.code === c)?.name_ar || '';

  const startNew = () => { setEditing(null); setForm({ ...EMPTY_RES }); setOpen(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startEdit = (r: Resource) => { setEditing(r.id); setForm(resourceToForm(r)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const save = () => run('save', async () => {
    if (!form || !me) return; const v = validateResource(form); if (v) throw new Error(v);
    const payload = resourcePayload(form);
    if (editing) { const { error } = await db.from('portal_resources').update(payload).eq('id', editing); if (error) throw error; setForm(null); return 'تم حفظ التعديلات.'; }
    const { data, error } = await db.from('portal_resources').insert({ ...payload, created_by: me.id, status: 'draft' }).select('id').single(); if (error) throw error;
    setForm(null); setOpen((data as any).id); return 'أُنشئت المادة كمسودة — ارفع الملفات ثم انشرها.';
  });
  const setStatus = (r: Resource, s: ResStatus) => run('st' + r.id, async () => {
    if (s === 'published' && !window.confirm(`نشر «${r.title_ar}» على البوابة العامة؟`)) return;
    const patch: any = { status: s, updated_at: new Date().toISOString() }; if (s === 'published' && !r.published_at) patch.published_at = new Date().toISOString();
    const { error } = await db.from('portal_resources').update(patch).eq('id', r.id); if (error) throw error; return s === 'published' ? 'نُشرت المادة.' : s === 'archived' ? 'أُرشفت المادة.' : 'أُعيدت إلى المسودات.';
  });
  const remove = (r: Resource) => run('rm' + r.id, async () => {
    if (!window.confirm(`حذف «${r.title_ar}» نهائيًا مع ملفاتها؟`)) return;
    const { data: fs } = await db.from('portal_resource_files').select('path').eq('resource_id', r.id);
    const paths = ((fs || []) as any[]).map(x => x.path).filter(Boolean); if (paths.length) await db.storage.from(BUCKET).remove(paths);
    const { error } = await db.from('portal_resources').delete().eq('id', r.id); if (error) throw error; if (open === r.id) setOpen(null); return 'حُذفت المادة.';
  });
  const upload = (r: Resource, list: FileList | null) => run('up', async () => {
    if (!list || list.length === 0) return; const arr = Array.from(list); let n = 0;
    for (const file of arr) {
      setProgress(`رفع ${n + 1}/${arr.length}: ${file.name}`);
      const path = `${r.id}/${storageName(file.name)}`;
      const { error } = await db.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined }); if (error) throw new Error(`${file.name}: ${error.message}`);
      const { error: e2 } = await db.from('portal_resource_files').insert({ resource_id: r.id, name: file.name, path, size: file.size, mime: file.type || null, version: r.version, sort: files.length + n }); if (e2) throw e2; n++;
    }
    setProgress(''); return `رُفع ${n} ملف.`;
  });
  const removeFile = (f: ResourceFile) => run('rf' + f.id, async () => {
    if (!window.confirm(`حذف الملف «${f.name}»؟`)) return;
    await db.storage.from(BUCKET).remove([f.path]); const { error } = await db.from('portal_resource_files').delete().eq('id', f.id); if (error) throw error; return 'حُذف الملف.';
  });
  const preview = (f: ResourceFile) => run('pv' + f.id, async () => { const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.path, 120); if (error || !data?.signedUrl) throw new Error(error?.message || 'تعذّر إنشاء الرابط'); window.open(data.signedUrl, '_blank', 'noopener'); });
  const exportXlsx = () => downloadXlsx(safeFilename('athar_resources', 'xlsx'), [resourcesSheet(shown, skills, sectors)]);
  const exportEvents = (r: Resource) => downloadXlsx(safeFilename('athar_resource_downloads', 'xlsx'), [eventsSheet(events, new Map([[r.id, r.title_ar]]))]);
  const toggleSkill = (id: string) => setForm(f => f ? { ...f, skills: f.skills.includes(id) ? f.skills.filter(x => x !== id) : [...f.skills, id] } : f);
  const skillOptions = useMemo(() => skills.filter(s => s.active && (!skillQ.trim() || `${s.code} ${s.name_ar} ${s.name_en}`.toLowerCase().includes(skillQ.trim().toLowerCase()))), [skills, skillQ]);

  if (!ready) return <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="en-wrap"><div className="en-card en-muted">جارٍ التحميل…</div></div></div>;
  return (
    <div className="en"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="en-wrap">
        <header className="en-head"><div><span className="en-kicker"><Icon name="globe" size={14} /> بوابة أَثَر</span><h1>مستودع الحقائب</h1><p>كل مادة تحمل قطاعًا ومهارات ومستوى وصول — وكل تنزيل يُسجَّل في سجل أحداث التعلّم ليغذّي الملف المهاري وتقارير الأثر.</p></div>
          <div className="en-acts">{canWrite && <button type="button" className="en-btn" onClick={startNew}><Icon name="plus" size={14} /> مادة جديدة</button>}<Link href="/admin/skills" className="en-btn ghost"><Icon name="target" size={14} /> المهارات والجهات</Link><Link href="/resources" target="_blank" className="en-btn ghost"><Icon name="globe" size={14} /> الصفحة العامة</Link></div></header>
        <PortalAdminTabs counts={{ '/admin/resources': stats.drafts }} />
        {error && <div className="en-err">{error}</div>}{notice && <div className="en-ok">{notice}</div>}

        <div className="en-card en-seats">
          <span className="en-seat"><b>{stats.published}</b><span>منشورة</span></span><span className="en-seat"><b>{stats.drafts}</b><span>مسودات</span></span><span className="en-seat"><b>{stats.downloads}</b><span>تنزيلات</span></span><span className="en-seat"><b>{stats.views}</b><span>مشاهدات</span></span><span className="en-seat"><b>{stats.aiReady}</b><span>AI-ready</span></span>
          <span className="en-muted" style={{ marginInlineStart: 'auto' }}>المهارات المعرّفة: {skills.length} · القطاعات: {sectors.length} · الجهات: {orgs.length}</span>
        </div>

        {form && <div className="en-card rs-form">
          <h2><Icon name={editing ? 'edit' : 'plus'} size={18} /> {editing ? 'تحرير المادة' : 'مادة جديدة'}</h2>
          <div className="rs-g2"><label className="en-note">العنوان (عربي) *<input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} /></label><label className="en-note">Title (English)<input dir="ltr" value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} /></label></div>
          <div className="rs-g2"><label className="en-note">ملخص قصير (عربي)<textarea value={form.summary_ar} onChange={e => setForm({ ...form, summary_ar: e.target.value })} /></label><label className="en-note">Short summary (English)<textarea dir="ltr" value={form.summary_en} onChange={e => setForm({ ...form, summary_en: e.target.value })} /></label></div>
          <div className="rs-g2"><label className="en-note">الوصف التفصيلي (فقرات)<textarea style={{ minHeight: 90 }} value={form.body_ar} onChange={e => setForm({ ...form, body_ar: e.target.value })} /></label><label className="en-note">Detailed description<textarea dir="ltr" style={{ minHeight: 90 }} value={form.body_en} onChange={e => setForm({ ...form, body_en: e.target.value })} /></label></div>
          <div className="rs-g4">
            <label className="en-note">النوع<select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })}>{RES_TYPES.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select></label>
            <label className="en-note">القطاع<select value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })}><option value="">— عام —</option>{sectors.map(s => <option key={s.code} value={s.code}>{s.name_ar}</option>)}</select></label>
            <label className="en-note">المستوى<select value={form.level} onChange={e => setForm({ ...form, level: e.target.value as any })}>{RES_LEVELS.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select></label>
            <label className="en-note">نمط التقديم<select value={form.delivery} onChange={e => setForm({ ...form, delivery: e.target.value as any })}>{RES_DELIVERY.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select></label>
            <label className="en-note">اللغة<select value={form.lang} onChange={e => setForm({ ...form, lang: e.target.value as any })}>{RES_LANGS.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select></label>
            <label className="en-note">الإصدار<input dir="ltr" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} /></label>
            <label className="en-note">رابط صورة الغلاف (اختياري)<input dir="ltr" value={form.cover_url} onChange={e => setForm({ ...form, cover_url: e.target.value })} placeholder="https://…" /></label>
            <label className="en-note">وسوم (مفصولة بفاصلة)<input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="تقويم، CEFR، دليل مدرب" /></label>
          </div>
          <div className="rs-access">
            <b>مستوى الوصول</b>
            <div className="rs-accgrid">{RES_ACCESS.map(a => <label key={a.value} className={`rs-acc ${form.access === a.value ? 'on' : ''}`}><input type="radio" name="access" checked={form.access === a.value} onChange={() => setForm({ ...form, access: a.value })} /><span><b>{a.label.ar}</b><small>{a.hint.ar}</small></span></label>)}</div>
            <div className="rs-g2">
              <label className="en-note">البرنامج المرتبط {form.access === 'program' && '*'}<select value={form.program_id} onChange={e => setForm({ ...form, program_id: e.target.value })}><option value="">— بدون —</option>{progs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
              <label className="en-note">الجهة المرتبطة {form.access === 'org' && '*'}<select value={form.organization_id} onChange={e => setForm({ ...form, organization_id: e.target.value })}><option value="">— بدون —</option>{orgs.map(o => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select></label>
            </div>
            <label className="cs-chk"><input type="checkbox" checked={form.ai_ready} onChange={e => setForm({ ...form, ai_ready: e.target.checked })} /> مهيأة للذكاء الاصطناعي (محتوى نصي مفهرس وقابل للتقسيم — سيُستخدم في المدرّب الرقمي والتوصيات)</label>
          </div>
          <div className="rs-skills">
            <div className="rs-skhead"><b>المهارات التي تنمّيها ({form.skills.length})</b><input placeholder="تصفية المهارات…" value={skillQ} onChange={e => setSkillQ(e.target.value)} /></div>
            <div className="rs-skgrid">{skillOptions.map(s => <button type="button" key={s.id} className={`rs-sk ${form.skills.includes(s.id) ? 'on' : ''}`} onClick={() => toggleSkill(s.id)}><small>{s.code}</small>{s.name_ar}<i>{domainLabel(s.domain, 'ar')} · م{s.level}</i></button>)}{skillOptions.length === 0 && <span className="en-muted">لا مهارات مطابقة — أضفها من صفحة المهارات.</span>}</div>
          </div>
          <div className="en-acts"><button type="button" className="en-btn ok" disabled={busy === 'save'} onClick={save}><Icon name="save" size={14} /> {editing ? 'حفظ التعديلات' : 'إنشاء المسودة'}</button><button type="button" className="en-btn ghost" onClick={() => setForm(null)}>إلغاء</button></div>
        </div>}

        <div className="en-tools">
          <div className="en-tabs">{FILTERS.map(f => <button type="button" key={f.k} className={filter === f.k ? 'on' : ''} onClick={() => setFilter(f.k)}>{f.l} ({f.k === 'all' ? rows.length : rows.filter(r => r.status === f.k).length})</button>)}</div>
          <select value={type} onChange={e => setType(e.target.value)}><option value="all">كل الأنواع</option>{RES_TYPES.map(x => <option key={x.value} value={x.value}>{x.label.ar}</option>)}</select>
          <input placeholder="بحث: العنوان، الوسوم…" value={q} onChange={e => setQ(e.target.value)} />
          <button type="button" className="en-btn ghost" onClick={exportXlsx} disabled={shown.length === 0}><Icon name="download" size={14} /> Excel ({shown.length})</button>
          <button type="button" className="en-btn ghost" onClick={() => run('r', async () => undefined)}><Icon name="refresh" size={14} /> تحديث</button>
        </div>

        {shown.length === 0 && <div className="en-card en-muted">لا مواد ضمن هذه التصفية.{canWrite && rows.length === 0 && ' ابدأ بإنشاء أول مادة.'}</div>}
        {shown.map(r => { const isOpen = open === r.id; const sk = (r.skills || []).map(id => skillById.get(id)).filter(Boolean) as Skill[]; return (
          <div key={r.id} className={`en-card en-row ${r.status}`}>
            <div className="en-top" onClick={() => setOpen(isOpen ? null : r.id)}>
              <div className="en-who"><span className={`rs-ti ${r.type}`}><Icon name={typeIcon(r.type) as IconName} size={16} /></span><b>{r.title_ar}</b><span className={`en-tag ${r.status}`}>{statusLabel(r.status, 'ar')}</span><span className={`en-tag acc-${r.access}`}>{accessLabel(r.access, 'ar')}</span>{r.ai_ready && <span className="en-tag ai">AI</span>}</div>
              <div className="en-meta"><span>{typeLabel(r.type, 'ar')}</span>·<span>{levelLabel(r.level, 'ar')}</span>{r.sector && <>·<span>{secName(r.sector)}</span></>}·<span>v{r.version}</span>·<span><Icon name="download" size={12} /> {r.downloads || 0}</span>·<span>{fmt(r.updated_at || r.created_at)}</span></div>
            </div>
            {isOpen && <div className="en-body">
              <div className="en-details">{r.title_en && <span dir="ltr">{r.title_en}</span>}{r.program_id && <span>البرنامج: <b>{progs.find(p => p.id === r.program_id)?.name_ar || '—'}</b></span>}{r.organization_id && <span>الجهة: <b>{orgs.find(o => o.id === r.organization_id)?.name_ar || '—'}</b></span>}<span>المشاهدات: {r.views || 0}</span><span>النشر: {fmt(r.published_at)}</span><Link href={`/resources/${r.id}`} target="_blank">فتح الصفحة العامة ↗</Link></div>
              {sk.length > 0 && <div className="rs-chips">{sk.map(s => <span key={s.id} className="rs-chip">{s.code} · {skillName(s, 'ar')}</span>)}</div>}
              <div className="cs-grid2">
                <div className="cs-sec"><h3><Icon name="folder" size={16} /> الملفات ({files.length})</h3>
                  {files.length === 0 && <span className="en-muted">لا ملفات بعد — المادة لن تكون مفيدة للمتعلم حتى تُرفع ملفاتها.</span>}
                  {files.map(f => <div key={f.id} className="rs-file"><Icon name="doc" size={16} /><div><b>{f.name}</b><small>{fmtSize(f.size, 'ar')} · v{f.version} · {f.downloads || 0} تنزيل</small></div><div className="en-acts"><button type="button" className="en-btn ghost" onClick={() => preview(f)} disabled={!!busy}>معاينة</button>{canWrite && <button type="button" className="cs-x" title="حذف" onClick={() => removeFile(f)} disabled={!!busy}>×</button>}</div></div>)}
                  {canWrite && <label className="rs-upload"><Icon name="plus" size={14} /> {progress || 'رفع ملفات (PDF، Word، PowerPoint، Excel، فيديو، ZIP — حتى 100 م.ب للملف)'}<input type="file" multiple style={{ display: 'none' }} onChange={e => { upload(r, e.target.files); e.currentTarget.value = ''; }} disabled={busy === 'up'} /></label>}
                </div>
                <div className="cs-sec"><h3><Icon name="trend" size={16} /> آخر التنزيلات ({events.length})</h3>
                  {events.length === 0 && <span className="en-muted">لا تنزيلات مسجّلة بعد.</span>}
                  <div className="rs-ev">{events.slice(0, 12).map(e => <div key={e.id}><small>{fmt(e.at)}</small><span dir="ltr">{e.email || 'زائر'}</span><em>{String(e.context?.file_name || '')}</em></div>)}</div>
                  {events.length > 0 && <button type="button" className="en-btn ghost" onClick={() => exportEvents(r)}><Icon name="download" size={14} /> سجل التنزيلات Excel</button>}
                </div>
              </div>
              {canWrite && <div className="en-acts">
                <button type="button" className="en-btn ghost" onClick={() => startEdit(r)}><Icon name="edit" size={14} /> تحرير</button>
                {r.status !== 'published' && <button type="button" className="en-btn ok" disabled={!!busy} onClick={() => setStatus(r, 'published')}><Icon name="check" size={14} /> نشر</button>}
                {r.status === 'published' && <button type="button" className="en-btn warn" disabled={!!busy} onClick={() => setStatus(r, 'archived')}><Icon name="pause" size={14} /> أرشفة</button>}
                {r.status === 'archived' && <button type="button" className="en-btn ghost" disabled={!!busy} onClick={() => setStatus(r, 'draft')}>إعادة إلى المسودات</button>}
                <button type="button" className="en-btn ghost" style={{ marginInlineStart: 'auto', color: '#991b1b' }} disabled={!!busy} onClick={() => remove(r)}><Icon name="trash" size={14} /> حذف</button>
              </div>}
            </div>}
          </div>
        ); })}
      </div>
    </div>
  );
}

const CSS = `
.en{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif}
.en-wrap{max-width:1080px;margin:0 auto;display:grid;gap:12px}
.en-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.en-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.en-head p{margin:0;color:#64748b;font-size:14px;max-width:720px}.en-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b8a83}
.en-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 16px}.en-muted{color:#64748b;font-size:13.5px}
.en-seats{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-seat{text-align:start;border:1px solid #e2e8f0;background:#f8fafc;border-radius:12px;padding:8px 14px;display:grid;gap:2px;min-width:92px}.en-seat b{font-size:18px;color:#0f2a4e}.en-seat span{font-size:11.5px;color:#64748b}
.en-tools{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.en-tabs{display:flex;gap:6px;flex-wrap:wrap}.en-tabs button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;color:#334155}.en-tabs button.on{background:#0f2a4e;border-color:#0f2a4e;color:#fff}
.en-tools select,.en-tools input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff}.en-tools input{min-width:200px}
.en-row.published{border-inline-start:4px solid #059669}.en-row.draft{border-inline-start:4px solid #d97706}.en-row.archived{opacity:.7}
.en-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;cursor:pointer}.en-who{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:#64748b}.en-who b{color:#0f2a4e;font-size:15px}
.en-meta{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12.5px;color:#64748b}
.en-tag{border-radius:999px;padding:3px 10px;font-size:11.5px;font-weight:900;background:#f1f5f9;color:#475569}.en-tag.published{background:#ecfdf5;color:#065f46}.en-tag.draft{background:#fff7ed;color:#9a3412}.en-tag.acc-public{background:#ecfdf5;color:#065f46}.en-tag.acc-registered{background:#eff6ff;color:#1e40af}.en-tag.acc-program{background:#fff7ed;color:#9a3412}.en-tag.acc-org{background:#f5f3ff;color:#5b21b6}.en-tag.ai{background:#0f2a4e;color:#c9a24b}
.en-body{margin-top:12px;border-top:1px dashed #e2e8f0;padding-top:12px;display:grid;gap:12px}
.en-details{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:#64748b}.en-details a{color:#0b8a83;font-weight:800}
.en-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.en-note textarea,.en-note input,.en-note select{font:inherit;font-size:13.5px;border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;background:#fff;font-weight:500}.en-note textarea{min-height:56px;resize:vertical}
.en-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.en-btn{display:inline-flex;gap:6px;align-items:center;border-radius:10px;padding:8px 14px;font:inherit;font-size:13px;font-weight:900;cursor:pointer;text-decoration:none;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e}.en-btn.ok{background:#059669;border-color:#059669}.en-btn.warn{background:#d97706;border-color:#d97706}.en-btn.ghost{background:#fff;color:#0f2a4e;border-color:#cbd5e1}.en-btn:disabled{opacity:.6;cursor:not-allowed}
.en-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}.en-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:12px;padding:10px 14px;font-weight:800;font-size:13.5px}
.cs-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}.cs-sec{border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;display:grid;gap:10px;background:#fcfcfd;align-content:start}.cs-sec h3{margin:0;font-size:15px;color:#0f2a4e;display:flex;gap:6px;align-items:center}
.cs-x{border:0;background:#fee2e2;color:#991b1b;border-radius:8px;width:26px;height:26px;cursor:pointer;display:inline-grid;place-items:center}.cs-chk{display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:#334155;font-weight:800}
.rs-form{display:grid;gap:12px;border:2px solid #0b8a83}.rs-form h2{margin:0;font-size:18px;color:#0f2a4e;display:flex;gap:8px;align-items:center}
.rs-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.rs-g4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.rs-access{display:grid;gap:10px;border:1px solid #e2e8f0;border-radius:12px;padding:12px;background:#fcfcfd}.rs-access>b{font-size:13.5px;color:#0f2a4e}
.rs-accgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.rs-acc{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;display:flex;gap:8px;align-items:flex-start;cursor:pointer;background:#fff}.rs-acc.on{border-color:#0b8a83;background:#f0fdfa}.rs-acc span{display:grid;gap:2px}.rs-acc b{font-size:13px;color:#0f172a}.rs-acc small{font-size:11px;color:#64748b;line-height:1.5}
.rs-skills{display:grid;gap:8px}.rs-skhead{display:flex;justify-content:space-between;gap:8px;align-items:center}.rs-skhead b{font-size:13.5px;color:#0f2a4e}.rs-skhead input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:6px 10px;min-width:220px}
.rs-skgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;max-height:260px;overflow:auto;padding:2px}.rs-sk{text-align:start;border:1px solid #e2e8f0;background:#fff;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;color:#0f172a;cursor:pointer;display:grid;gap:1px}.rs-sk small{color:#0b8a83;font-weight:900;font-size:11px;direction:ltr;text-align:start}.rs-sk i{font-style:normal;color:#64748b;font-size:11px}.rs-sk.on{border-color:#0f2a4e;background:#0f2a4e;color:#fff}.rs-sk.on small,.rs-sk.on i{color:#c9a24b}
.rs-ti{width:30px;height:30px;border-radius:9px;background:#e6f4f3;color:#0b8a83;display:inline-grid;place-items:center}.rs-ti.package{background:#fdf6e3;color:#9a7417}.rs-ti.assessment{background:#eef4fb;color:#0f2a4e}
.rs-chips{display:flex;gap:6px;flex-wrap:wrap}.rs-chip{font-size:12px;font-weight:800;background:#f1f5f9;color:#334155;border-radius:999px;padding:3px 10px}
.rs-file{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;background:#fff;color:#0f2a4e}.rs-file b{display:block;font-size:13px;color:#0f172a;word-break:break-all}.rs-file small{color:#64748b;font-size:11.5px}
.rs-upload{display:flex;gap:8px;align-items:center;justify-content:center;border:2px dashed #0b8a83;border-radius:12px;padding:14px;cursor:pointer;color:#0b8a83;font-weight:800;font-size:13px;background:#f0fdfa}
.rs-ev{display:grid;gap:4px;font-size:12.5px}.rs-ev div{display:grid;grid-template-columns:auto 1fr auto;gap:10px;border-bottom:1px solid #f1f5f9;padding:4px 0}.rs-ev small{color:#64748b}.rs-ev em{font-style:normal;color:#0b8a83;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media(max-width:900px){.rs-g4{grid-template-columns:1fr 1fr}.rs-accgrid{grid-template-columns:1fr 1fr}.rs-skgrid{grid-template-columns:1fr}}
@media(max-width:760px){.cs-grid2,.rs-g2{grid-template-columns:1fr}}
`;
