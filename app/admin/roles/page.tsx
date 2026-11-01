'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/roles — الأدوار والدعوات (P42-أ «بابٌ واحد لكل دور»)
 *  دعوة: بريد + صفات (حتى 5) + جهة اختيارية + رسالة → رابط لمرة واحدة يُنسخ ويُرسل (واتساب/بريد) — لا إرسال آلي
 *  المنح: جدول حيّ مع سحب فوري · الدعوات: الحالة والنسخ والإلغاء · الكتالوج: 16 صفة نظامية + صفات مخصّصة «حسب الاحتياج»
 *  الطاقم يرى؛ مدير النظام وحده يكتب. كل كتابة تُسجَّل في درع أَثَر.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';

type InviteState = 'pending' | 'accepted' | 'expired' | 'revoked';
const INVITE_STATE_AR: Record<InviteState, string> = { pending: 'بانتظار القبول', accepted: 'مقبولة', expired: 'منتهية', revoked: 'ملغاة' }; // نسخة عميل (lib/portal/roles يستورد crypto)

type Role = { code: string; name_ar: string; name_en: string; scope: string; landing: string; permissions: string[]; is_staff: boolean; legacy_role: string | null; is_system: boolean; active: boolean; sort: number };
type Grant = { id: string; user_id: string | null; email: string; role_code: string; org_id: string | null; source: string; created_at: string; note: string | null };
type Inv = { id: string; email: string; full_name: string | null; role_codes: string[]; org_id: string | null; message: string | null; expires_at: string; created_at: string; state: InviteState };
type Org = { id: string; name_ar: string; name_en: string | null };
type Data = { roles: Role[]; grants: Grant[]; invites: Inv[]; orgs: Org[]; me: { roles: string[]; admin: boolean }; invite_days: number };
const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn', { dateStyle: 'medium' }) : '—';
const SCOPE_AR: Record<string, string> = { platform: 'المنصة', org: 'الجهة', personal: 'شخصي' };

export default function AdminRolesPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [tok, setTok] = useState(''); const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<'invite' | 'grants' | 'invites' | 'catalog'>('invite'); const [busy, setBusy] = useState('');
  const [email, setEmail] = useState(''); const [fullName, setFullName] = useState(''); const [picked, setPicked] = useState<string[]>([]); const [orgId, setOrgId] = useState(''); const [message, setMessage] = useState(''); const [direct, setDirect] = useState(false);
  const [made, setMade] = useState<{ url: string; text: string; expires_at: string } | null>(null); const [q, setQ] = useState('');
  const [nr, setNr] = useState({ code: '', name_ar: '', name_en: '', scope: 'platform', landing: '/hub', is_staff: true, legacy_role: 'QUALITY_ANALYST', permissions: '' });
  const fresh = useCallback(async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk !== tok) setTok(tk); return tk; }, [db, tok]);
  async function load(tk: string) { const j = await fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return false; } setData(j); return true; }
  useEffect(() => {
    (async () => {
      const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/roles'); return; }
      const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); const okk = await load(tk); if (!okk) { setTimeout(() => router.replace('/hub'), 1200); } setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function post(body: any) { return fetch('/api/admin/roles', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await fresh()}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); }
  const roles = data?.roles || []; const active = roles.filter(r => r.active); const admin = !!data?.me.admin;
  const orgName = (id: string | null) => id ? (data?.orgs.find(o => o.id === id)?.name_ar || id.slice(0, 8)) : '—';
  const roleName = (c: string) => roles.find(r => r.code === c)?.name_ar || c;
  const toggle = (c: string) => setPicked(p => p.includes(c) ? p.filter(x => x !== c) : p.length >= 5 ? p : [...p, c]);
  const needOrg = picked.some(c => roles.find(r => r.code === c)?.scope === 'org');

  async function submitInvite(e: React.FormEvent) {
    e.preventDefault(); setError(''); setOk(''); setMade(null); setBusy('invite');
    const j = await post({ action: direct ? 'grant' : 'invite', email, full_name: fullName, roles: picked, org_id: orgId || null, message });
    setBusy(''); if (!j?.success) { setError(j?.error || 'تعذّر'); return; }
    if (direct) { setOk(`مُنحت مباشرة: ${(j.granted || []).map(roleName).join(' · ') || 'لا جديد'}${j.already?.length ? ` (كانت لديه: ${j.already.map(roleName).join(' · ')})` : ''}`); }
    else setMade({ url: j.url, text: j.text, expires_at: j.expires_at });
    setEmail(''); setFullName(''); setPicked([]); setMessage(''); await load(await fresh());
  }
  async function copy(t: string) { try { await navigator.clipboard.writeText(t); setOk('نُسخ'); setTimeout(() => setOk(''), 1500); } catch { setError('تعذّر النسخ — حدّد النص وانسخه يدويًا'); } }
  async function revoke(g: Grant) { if (!confirm(`سحب «${roleName(g.role_code)}» من ${g.email}؟ يسري فورًا.`)) return; setBusy(g.id); const j = await post({ action: 'revoke', grant_id: g.id }); if (!j?.success) setError(j?.error || 'تعذّر السحب'); await load(await fresh()); setBusy(''); }
  async function revokeInvite(i: Inv) { if (!confirm(`إلغاء دعوة ${i.email}؟`)) return; setBusy(i.id); const j = await post({ action: 'revoke_invite', invite_id: i.id }); if (!j?.success) setError(j?.error || 'تعذّر'); await load(await fresh()); setBusy(''); }
  async function createRole(e: React.FormEvent) { e.preventDefault(); setError(''); setBusy('role'); const j = await post({ action: 'role_create', ...nr, code: nr.code.toUpperCase(), permissions: nr.permissions.split(/[,\s،]+/).filter(Boolean), legacy_role: nr.is_staff ? nr.legacy_role : null }); setBusy(''); if (!j?.success) { setError(j?.error || 'تعذّر'); return; } setOk(`أُنشئت الصفة ${j.code}`); setNr({ code: '', name_ar: '', name_en: '', scope: 'platform', landing: '/hub', is_staff: true, legacy_role: 'QUALITY_ANALYST', permissions: '' }); await load(await fresh()); }
  async function toggleRole(r: Role) { setBusy(r.code); const j = await post({ action: 'role_toggle', code: r.code, active: !r.active }); if (!j?.success) setError(j?.error || 'تعذّر'); await load(await fresh()); setBusy(''); }

  const grants = useMemo(() => (data?.grants || []).filter(g => !q || g.email.includes(q.toLowerCase()) || roleName(g.role_code).includes(q) || g.role_code.includes(q.toUpperCase())), [data, q, roles]); // eslint-disable-line react-hooks/exhaustive-deps
  const pendingInv = (data?.invites || []).filter(i => i.state === 'pending').length;
  const byEmail = useMemo(() => { const m = new Map<string, Grant[]>(); for (const g of data?.grants || []) m.set(g.email, [...(m.get(g.email) || []), g]); return m; }, [data]);

  if (!ready) return <div className="rl"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="rl-wrap"><div className="rl-card">{error ? <span className="rl-err">{error}</span> : 'جارٍ فتح الأدوار…'}</div></div></div>;
  return (
    <div className="rl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rl-wrap">
        <header className="rl-head"><div><span className="rl-kicker"><Icon name="users" size={14} /> بوابة أَثَر · P42</span><h1>الأدوار والدعوات</h1><p>بابٌ واحد لكل صفة: تدعو الشخص برابط واحد، يدخل ببريده، فيفتح بابه بما يخصّه فقط. {admin ? '' : '(أنت تقرأ فقط — الكتابة لمدير النظام)'}</p></div></header>
        <PortalAdminTabs counts={{ '/admin/roles': pendingInv }} />
        {error && <div className="rl-err" role="alert">{error}</div>}{ok && <div className="rl-ok" role="status">{ok}</div>}
        <div className="rl-kpis" data-testid="roles-kpis">
          <span><b>{byEmail.size}</b> شخصًا لهم صفات</span><span><b>{data?.grants.length || 0}</b> منحة فعّالة</span><span><b>{pendingInv}</b> دعوة بانتظار القبول</span><span><b>{active.length}</b> صفة متاحة ({roles.filter(r => !r.is_system).length} مخصّصة)</span>
        </div>
        <div className="rl-tabs" role="tablist">
          {(['invite', 'grants', 'invites', 'catalog'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)} data-testid={`roles-tab-${t}`}>{t === 'invite' ? 'دعوة جديدة' : t === 'grants' ? 'من لديه ماذا' : t === 'invites' ? 'الدعوات' : 'كتالوج الصفات'}</button>)}
        </div>

        {tab === 'invite' && (
          <section className="rl-card">
            {made && (
              <div className="rl-made" data-testid="invite-made">
                <h3><Icon name="check" size={16} /> الدعوة جاهزة — انسخ الرابط وأرسله بالقناة التي تناسبك</h3>
                <code dir="ltr" data-testid="invite-url">{made.url}</code>
                <div className="rl-row"><button type="button" onClick={() => copy(made.url)} data-testid="invite-copy"><Icon name="copy" size={14} /> نسخ الرابط</button><button type="button" onClick={() => copy(made.text)}><Icon name="copy" size={14} /> نسخ رسالة كاملة</button><a className="rl-btn" href={`https://wa.me/?text=${encodeURIComponent(made.text)}`} target="_blank" rel="noopener noreferrer"><Icon name="send" size={14} /> عبر واتساب</a><a className="rl-btn" href={`mailto:?subject=${encodeURIComponent('دعوة إلى بوابة أَثَر')}&body=${encodeURIComponent(made.text)}`}><Icon name="mail" size={14} /> عبر البريد</a></div>
                <p className="rl-muted">الرابط يُعرض مرة واحدة ولا يُخزَّن — إن ضاع أنشئ دعوة جديدة. صالح حتى {fmt(made.expires_at)}.</p>
              </div>
            )}
            <form onSubmit={submitInvite} className="rl-form" data-testid="invite-form">
              <div className="rl-two">
                <label>البريد الإلكتروني<input type="email" required dir="ltr" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" data-testid="inv-email" disabled={!admin} /></label>
                <label>الاسم (اختياري)<input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="د. …" disabled={!admin} /></label>
              </div>
              <fieldset><legend>الصفات (حتى 5) — اختر ما يخصّه فقط</legend>
                <div className="rl-roles" data-testid="inv-roles">
                  {active.map(r => <label key={r.code} className={picked.includes(r.code) ? 'on' : ''}><input type="checkbox" checked={picked.includes(r.code)} onChange={() => toggle(r.code)} disabled={!admin} data-testid={`inv-role-${r.code}`} /><b>{r.name_ar}</b><span>{r.name_en} · {SCOPE_AR[r.scope]}{r.is_staff ? ' · طاقم' : ''}</span></label>)}
                </div>
              </fieldset>
              <div className="rl-two">
                <label>الجهة {needOrg ? <em>(مطلوبة لصفة الجهة)</em> : '(اختياري)'}<select value={orgId} onChange={e => setOrgId(e.target.value)} disabled={!admin} data-testid="inv-org"><option value="">— بلا جهة —</option>{data?.orgs.map(o => <option key={o.id} value={o.id}>{o.name_ar}</option>)}</select></label>
                <label>رسالة قصيرة تظهر في الدعوة (اختياري)<input value={message} onChange={e => setMessage(e.target.value)} maxLength={600} placeholder="مثال: نرحّب بك مديرًا لبرامج العربية ابتداءً من يناير" disabled={!admin} /></label>
              </div>
              <label className="rl-check"><input type="checkbox" checked={direct} onChange={e => setDirect(e.target.checked)} disabled={!admin} data-testid="inv-direct" /> منح مباشر بلا دعوة (لمن هو داخل أصلًا ويحتاج صفة إضافية الآن)</label>
              <div className="rl-row"><button type="submit" disabled={!admin || busy === 'invite' || !picked.length} data-testid="inv-submit"><Icon name={direct ? 'check' : 'link'} size={16} /> {busy === 'invite' ? 'لحظة…' : direct ? 'امنح الآن' : 'أنشئ رابط الدعوة'}</button><span className="rl-muted">{picked.length ? picked.map(roleName).join(' + ') : 'لم تختر صفة بعد'}</span></div>
            </form>
          </section>
        )}

        {tab === 'grants' && (
          <section className="rl-card">
            <div className="rl-row"><input className="rl-search" value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث بالبريد أو الصفة…" aria-label="بحث" data-testid="grants-q" /><span className="rl-muted">{grants.length} منحة</span></div>
            <div className="rl-tablewrap"><table className="rl-table" data-testid="grants-table"><thead><tr><th>البريد</th><th>الصفة</th><th>الجهة</th><th>المصدر</th><th>منذ</th><th>الحالة</th><th></th></tr></thead><tbody>
              {grants.map(g => <tr key={g.id} data-testid="grant-row"><td dir="ltr">{g.email}</td><td><b>{roleName(g.role_code)}</b> <small>{g.role_code}</small></td><td>{orgName(g.org_id)}</td><td>{g.source === 'invite' ? 'دعوة' : g.source === 'manual' ? 'منح مباشر' : g.source}</td><td>{fmt(g.created_at)}</td><td>{g.user_id ? <span className="rl-tag ok">مرتبط بحساب</span> : <span className="rl-tag">بانتظار أول دخول</span>}</td><td>{admin && <button type="button" className="rl-x" onClick={() => revoke(g)} disabled={busy === g.id} data-testid="grant-revoke">سحب</button>}</td></tr>)}
              {!grants.length && <tr><td colSpan={7} className="rl-muted">لا منح بعد — ابدأ بدعوة.</td></tr>}
            </tbody></table></div>
          </section>
        )}

        {tab === 'invites' && (
          <section className="rl-card">
            <div className="rl-tablewrap"><table className="rl-table" data-testid="invites-table"><thead><tr><th>البريد</th><th>الاسم</th><th>الصفات</th><th>الجهة</th><th>الحالة</th><th>تنتهي</th><th></th></tr></thead><tbody>
              {(data?.invites || []).map(i => <tr key={i.id} data-testid="invite-row" data-state={i.state}><td dir="ltr">{i.email}</td><td>{i.full_name || '—'}</td><td>{i.role_codes.map(roleName).join(' · ')}</td><td>{orgName(i.org_id)}</td><td><span className={`rl-tag ${i.state === 'accepted' ? 'ok' : i.state === 'pending' ? 'warn' : ''}`}>{INVITE_STATE_AR[i.state]}</span></td><td>{fmt(i.expires_at)}</td><td>{admin && i.state === 'pending' && <button type="button" className="rl-x" onClick={() => revokeInvite(i)} disabled={busy === i.id} data-testid="invite-revoke">إلغاء</button>}</td></tr>)}
              {!data?.invites.length && <tr><td colSpan={7} className="rl-muted">لا دعوات بعد.</td></tr>}
            </tbody></table></div>
            <p className="rl-muted">الرابط نفسه لا يُعرض هنا (لا نخزّنه) — إن احتاج الشخص رابطًا جديدًا ألغِ الدعوة وأنشئ أخرى.</p>
          </section>
        )}

        {tab === 'catalog' && (
          <section className="rl-card">
            <div className="rl-tablewrap"><table className="rl-table" data-testid="catalog-table"><thead><tr><th>الصفة</th><th>الرمز</th><th>النطاق</th><th>الباب</th><th>طاقم؟</th><th>جسر قديم</th><th>الحالة</th><th></th></tr></thead><tbody>
              {roles.map(r => <tr key={r.code} data-testid="catalog-row"><td><b>{r.name_ar}</b><br /><small dir="ltr">{r.name_en}</small></td><td dir="ltr"><code>{r.code}</code></td><td>{SCOPE_AR[r.scope]}</td><td dir="ltr">{r.landing}</td><td>{r.is_staff ? 'نعم' : '—'}</td><td dir="ltr">{r.legacy_role || '—'}</td><td>{r.active ? <span className="rl-tag ok">فعّالة</span> : <span className="rl-tag">معطَّلة</span>}{r.is_system ? '' : <span className="rl-tag">مخصّصة</span>}</td><td>{admin && !r.is_system && <button type="button" className="rl-x" onClick={() => toggleRole(r)} disabled={busy === r.code}>{r.active ? 'تعطيل' : 'تفعيل'}</button>}</td></tr>)}
            </tbody></table></div>
            {admin && (
              <form onSubmit={createRole} className="rl-form rl-newrole" data-testid="role-form">
                <h3>صفة مخصّصة «حسب الاحتياج»</h3>
                <div className="rl-two"><label>الرمز (لاتيني كبير)<input dir="ltr" required value={nr.code} onChange={e => setNr({ ...nr, code: e.target.value.toUpperCase() })} placeholder="PARTNER_LIAISON" pattern="[A-Za-z][A-Za-z0-9_]{1,39}" data-testid="nr-code" /></label><label>الاسم العربي<input required value={nr.name_ar} onChange={e => setNr({ ...nr, name_ar: e.target.value })} placeholder="منسّق الشراكات" data-testid="nr-name" /></label></div>
                <div className="rl-two"><label>الاسم الإنجليزي<input dir="ltr" required value={nr.name_en} onChange={e => setNr({ ...nr, name_en: e.target.value })} placeholder="Partnerships liaison" /></label><label>الباب (مسار داخلي)<input dir="ltr" value={nr.landing} onChange={e => setNr({ ...nr, landing: e.target.value })} /></label></div>
                <div className="rl-two"><label>النطاق<select value={nr.scope} onChange={e => setNr({ ...nr, scope: e.target.value })}><option value="platform">المنصة</option><option value="org">الجهة</option><option value="personal">شخصي</option></select></label><label>الصلاحيات (مفصولة بفواصل)<input dir="ltr" value={nr.permissions} onChange={e => setNr({ ...nr, permissions: e.target.value })} placeholder="programs.read, contracts.read" /></label></div>
                <label className="rl-check"><input type="checkbox" checked={nr.is_staff} onChange={e => setNr({ ...nr, is_staff: e.target.checked })} /> صفة طاقم (ترى صفحات الإدارة التي تخصّها)</label>
                {nr.is_staff && <label>مستوى الجسر القديم (ما تراه الصفحات القديمة)<select value={nr.legacy_role} onChange={e => setNr({ ...nr, legacy_role: e.target.value })}><option value="QUALITY_ANALYST">QUALITY_ANALYST — قراءة ومتابعة</option><option value="PROGRAM_MANAGER">PROGRAM_MANAGER — تشغيل البرامج</option><option value="TRAINER">TRAINER — مدرّب</option></select></label>}
                <div className="rl-row"><button type="submit" disabled={busy === 'role'} data-testid="nr-submit"><Icon name="star" size={16} /> أنشئ الصفة</button></div>
              </form>
            )}
          </section>
        )}
        <p className="rl-foot">لماذا «صفة» و«باب»؟ الدور كلمة إدارية؛ أمّا «الصفة» فهي ما يحمله الإنسان («بصفتي مدير جودة»)، و«الباب» هو ما يُفتح له. في العقود والشهادات نستخدم الاسم الرسمي للصفة.</p>
      </div>
    </div>
  );
}

const CSS = `
.rl{min-height:100vh;background:#f6f8fb;padding:22px 14px 60px}.rl-wrap{max-width:1180px;margin:0 auto}
.rl-kicker{display:inline-flex;gap:6px;align-items:center;color:#0b8a83;font-weight:800;font-size:13px}.rl-head h1{margin:6px 0 4px;color:#0f2a4e;font-size:28px}.rl-head p{margin:0 0 14px;color:#475569;line-height:1.8}
.rl-kpis{display:flex;flex-wrap:wrap;gap:10px;margin:12px 0}.rl-kpis span{background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 12px;color:#334155;font-size:14px}.rl-kpis b{color:#0f2a4e;font-size:18px;margin-inline-end:4px}
.rl-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 14px}.rl-tabs button{border:1px solid #e2e8f0;background:#fff;border-radius:999px;padding:8px 14px;font-weight:800;color:#334155;cursor:pointer;font-family:inherit;min-height:40px}.rl-tabs button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.rl-card{background:#fff;border:1px solid #e5e9f0;border-radius:18px;padding:18px}
.rl-form{display:grid;gap:14px}.rl-form label{display:grid;gap:6px;font-weight:700;color:#0f2a4e;font-size:14px}.rl-form label em{font-style:normal;color:#b45309;font-weight:600}.rl-form input,.rl-form select{border:1.5px solid #cbd5e1;border-radius:12px;padding:10px 12px;font-size:15px;font-family:inherit;font-weight:500;width:100%;box-sizing:border-box;min-height:44px}.rl-form input:focus-visible,.rl-form select:focus-visible{outline:3px solid #0b8a83;outline-offset:1px}
.rl-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:720px){.rl-two{grid-template-columns:1fr}}
.rl-form fieldset{border:1px dashed #cbd5e1;border-radius:14px;padding:12px}.rl-form legend{font-weight:800;color:#0f2a4e;padding:0 6px}
.rl-roles{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px}.rl-roles label{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;column-gap:8px;align-items:center;border:1px solid #e5e9f0;border-radius:12px;padding:8px 10px;cursor:pointer;font-weight:600}.rl-roles label.on{border-color:#0b8a83;background:#e6f4f3}.rl-roles input{grid-row:1/3;width:18px;height:18px;min-height:0}.rl-roles b{color:#0f2a4e}.rl-roles span{color:#64748b;font-size:11px;grid-column:2}
.rl-check{display:flex!important;gap:8px;align-items:center;font-weight:600!important}.rl-check input{width:18px;height:18px;min-height:0!important}
.rl-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.rl-form button,.rl-made button,.rl-btn{display:inline-flex;gap:6px;align-items:center;border:0;border-radius:12px;padding:10px 16px;background:#0f2a4e;color:#fff;font-weight:800;cursor:pointer;font-family:inherit;font-size:14px;min-height:44px;text-decoration:none}.rl-form button:disabled{opacity:.5;cursor:not-allowed}.rl-made button,.rl-btn{background:#0b8a83}
.rl-made{border:1px solid #a7f3d0;background:#ecfdf5;border-radius:14px;padding:14px;margin-bottom:16px;display:grid;gap:10px}.rl-made h3{margin:0;color:#065f46;display:flex;gap:6px;align-items:center;font-size:16px}.rl-made code{display:block;background:#fff;border:1px solid #d1fae5;border-radius:10px;padding:10px;word-break:break-all;font-size:13px;color:#0f2a4e}
.rl-search{border:1.5px solid #cbd5e1;border-radius:12px;padding:9px 12px;font-family:inherit;font-size:15px;min-width:260px;min-height:44px}
.rl-tablewrap{overflow:auto;margin-top:10px}.rl-table{width:100%;border-collapse:collapse;font-size:14px}.rl-table th{text-align:right;color:#64748b;font-weight:700;padding:8px;border-bottom:1px solid #e5e9f0;white-space:nowrap}.rl-table td{padding:9px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;color:#334155}.rl-table small{color:#94a3b8;font-size:11px}.rl-table code{background:#f1f5f9;padding:1px 6px;border-radius:6px;font-size:12px}
.rl-tag{display:inline-block;border-radius:999px;padding:2px 9px;font-size:12px;background:#f1f5f9;color:#475569;margin-inline-end:4px}.rl-tag.ok{background:#ecfdf5;color:#065f46}.rl-tag.warn{background:#fffbeb;color:#92400e}
.rl-x{border:1px solid #fecaca;background:#fff;color:#991b1b;border-radius:10px;padding:6px 10px;font-weight:800;cursor:pointer;font-family:inherit;min-height:36px}.rl-x:disabled{opacity:.5}
.rl-newrole{margin-top:18px;padding-top:16px;border-top:1px dashed #e5e9f0}.rl-newrole h3{margin:0;color:#0f2a4e}
.rl-err{color:#991b1b;background:#fef2f2;border-radius:10px;padding:10px 12px;margin:8px 0}.rl-ok{color:#065f46;background:#ecfdf5;border-radius:10px;padding:10px 12px;margin:8px 0}.rl-muted{color:#64748b;font-size:13px}
.rl-foot{margin-top:20px;color:#94a3b8;font-size:12px;line-height:1.8}
`;
