'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/pulse — «نبض أَثَر» (هـ-1/4): شريط أخبار المناطق + تقييم الخدمة
 *  · الأخبار: الطاقم يكتب خبرًا لمنطقة (مِعيار/اقْرَأْ/البرامج/…) بعنوان وسطر ورابط داخلي ولون، يثبّته أو يؤقّته أو يخفيه
 *  · التقييم: متوسّط كلّ خدمة وتوزيع النجوم ونسبة الرضا + آخر الكلمات (بريد مُقنَّع)
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { SERVICE_AR, RATING_TAGS, fmtAvg, fmtCount, satisfaction } from '../../../lib/portal/ratings';

import { RoomHead } from '../../components/RoomKit'; /* هـ-3 ح «عدّة الغرفة» */
const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const WRITERS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER'];
const ZONES = [{ k: 'miaar', ar: 'مِعيار' }, { k: 'iqra', ar: 'اقْرَأْ' }, { k: 'programs', ar: 'البرامج' }, { k: 'org', ar: 'الجهات' }, { k: 'experts', ar: 'الخبراء' }, { k: 'staff', ar: 'الطاقم' }, { k: 'portal', ar: 'البوّابة' }];
const TONES = [{ k: 'plum', ar: 'برقوقي' }, { k: 'coral', ar: 'مرجاني' }, { k: 'sand', ar: 'رملي' }, { k: 'sea', ar: 'بحري' }];
type News = { id?: string; zone: string; title_ar: string; body_ar: string; href: string; tone: string; pinned: boolean; starts_at: string | null; ends_at: string | null; published: boolean };
const EMPTY: News = { zone: 'miaar', title_ar: '', body_ar: '', href: '', tone: 'plum', pinned: false, starts_at: null, ends_at: null, published: true };
const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function PulsePage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [role, setRole] = useState(''); const [tok, setTok] = useState(''); const [error, setError] = useState(''); const [ok, setOk] = useState('');
  const [tab, setTab] = useState<'news' | 'ratings'>('news'); const [news, setNews] = useState<News[]>([]); const [form, setForm] = useState<News>(EMPTY); const [busy, setBusy] = useState(false);
  const [sum, setSum] = useState<{ services: Record<string, { avg: number; n: number; dist: number[] }>; refs: Record<string, { avg: number; n: number }> } | null>(null); const [rows, setRows] = useState<any[]>([]); const [svc, setSvc] = useState('');
  const canWrite = WRITERS.includes(role);
  const H = (tk = tok) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` });
  async function loadNews(tk = tok) { const j = await fetch('/api/zone-news?all=1', { headers: H(tk), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.ok) setNews(j.items || []); else setError(j?.error || 'تعذّر تحميل الأخبار'); }
  async function loadRatings(tk = tok, s = svc) {
    const [a, b] = await Promise.all([fetch('/api/ratings?summary=1', { cache: 'no-store' }).then((r) => r.json()).catch(() => null), fetch(`/api/ratings?list=1&service=${s}`, { headers: H(tk), cache: 'no-store' }).then((r) => r.json()).catch(() => null)]);
    if (a?.ok) setSum({ services: a.services, refs: a.refs }); if (b?.ok) setRows(b.rows || []);
  }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/pulse'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); const r = String((prof as any)?.role || '').toUpperCase(); if (!STAFF.includes(r)) { router.replace('/dashboard'); return; } setRole(r);
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await Promise.all([loadNews(tk), loadRatings(tk)]); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function save() {
    if (!form.title_ar.trim()) { setError('اكتب عنوان الخبر'); return; } setBusy(true); setError(''); setOk('');
    const j = await fetch('/api/zone-news', { method: 'POST', headers: H(), body: JSON.stringify({ action: 'upsert', item: form }) }).then((r) => r.json()).catch(() => null);
    setBusy(false); if (!j?.ok) { setError(j?.error || 'تعذّر الحفظ'); return; } setOk(form.id ? 'حُدِّث الخبر' : 'نُشر الخبر — يظهر في شريط المنطقة خلال دقيقة'); setForm(EMPTY); await loadNews();
  }
  async function del(id: string) { if (!confirm('حذف الخبر؟')) return; const j = await fetch('/api/zone-news', { method: 'POST', headers: H(), body: JSON.stringify({ action: 'delete', id }) }).then((r) => r.json()).catch(() => null); if (j?.ok) { setOk('حُذف'); await loadNews(); } else setError(j?.error || 'تعذّر الحذف'); }
  async function toggle(n: News, k: 'published' | 'pinned') { const j = await fetch('/api/zone-news', { method: 'POST', headers: H(), body: JSON.stringify({ action: 'upsert', item: { ...n, [k]: !n[k] } }) }).then((r) => r.json()).catch(() => null); if (j?.ok) await loadNews(); }
  const toLocal = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : ''); const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

  if (!ready) return <div className="pu rm-page"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="pu-wrap"><div className="rm-card">{error ? <span className="pu-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  const services = Object.entries(sum?.services || {}).sort((a, b) => b[1].n - a[1].n);
  return (
    <div className="pu rm-page" data-testid="pulse-page"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pu-wrap">
        <RoomHead
        title={<>نبض أَثَر</>}
        desc={<><p>شريط أخبار كلّ منطقة بيدك، وتقييم كلّ خدمة أمام عينك. الأخبار الآلية (تقارير مِعيار، دروس اقْرَأْ المعتمدة، البرامج المفتوحة…) تُضاف وحدها.</p></>}
      />
        <PortalAdminTabs />
        {error && <div className="pu-err" role="alert">{error}</div>}{ok && <div className="pu-ok" role="status">{ok}</div>}
        <nav className="pu-tabs" role="tablist"><button role="tab" aria-selected={tab === 'news'} className={tab === 'news' ? 'on' : ''} onClick={() => setTab('news')} data-testid="pulse-tab-news">شريط أخبار المنطقة <i>{news.length}</i></button><button role="tab" aria-selected={tab === 'ratings'} className={tab === 'ratings' ? 'on' : ''} onClick={() => setTab('ratings')} data-testid="pulse-tab-ratings">تقييم الخدمة <i>{services.reduce((n, [, v]) => n + v.n, 0)}</i></button></nav>

        {tab === 'news' && <div className="pu-grid">
          {canWrite && <form className="rm-card pu-form" onSubmit={(e) => { e.preventDefault(); void save(); }} data-testid="zn-form">
            <h3>{form.id ? 'تعديل خبر' : 'خبر جديد'}</h3>
            <div className="pu-row"><label>المنطقة<select value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })}>{ZONES.map((z) => <option key={z.k} value={z.k}>{z.ar}</option>)}</select></label><label>اللون<select value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })}>{TONES.map((z) => <option key={z.k} value={z.k}>{z.ar}</option>)}</select></label></div>
            <label>العنوان (حتى ٨٠ حرفًا)<input value={form.title_ar} maxLength={80} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} placeholder="مثال: فُتح باب نموذج B1 الجديد" data-testid="zn-title" /></label>
            <label>سطر توضيحي (اختياري)<input value={form.body_ar} maxLength={160} onChange={(e) => setForm({ ...form, body_ar: e.target.value })} placeholder="سطر واحد يُكمل العنوان" /></label>
            <label>رابط داخلي (اختياري، يبدأ بـ /)<input value={form.href} onChange={(e) => setForm({ ...form, href: e.target.value })} placeholder="/miaar" dir="ltr" /></label>
            <div className="pu-row"><label>يبدأ<input type="datetime-local" value={toLocal(form.starts_at)} onChange={(e) => setForm({ ...form, starts_at: fromLocal(e.target.value) })} /></label><label>ينتهي<input type="datetime-local" value={toLocal(form.ends_at)} onChange={(e) => setForm({ ...form, ends_at: fromLocal(e.target.value) })} /></label></div>
            <div className="pu-row pu-checks"><label><input type="checkbox" checked={form.pinned} onChange={(e) => setForm({ ...form, pinned: e.target.checked })} /> مثبّت أوّلًا</label><label><input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} /> منشور</label></div>
            <div className="pu-act"><button type="submit" className="rm-btn" disabled={busy} data-testid="zn-save">{busy ? 'يُحفظ…' : form.id ? 'حفظ التعديل' : 'نشر الخبر'}</button>{form.id && <button type="button" className="rm-btn ghost" onClick={() => setForm(EMPTY)}>إلغاء</button>}</div>
            <p className="pu-hint">معاينة: <span className="pu-prev" data-tone={form.tone}><b>{form.title_ar || 'العنوان'}</b>{form.body_ar && <small> — {form.body_ar}</small>}</span></p>
          </form>}
          <div className="rm-card">
            <h3>الأخبار <small>— {news.length}</small></h3>
            {news.length === 0 && <p className="rm-muted" data-testid="zn-empty">لا أخبار مكتوبة بعد. الشريط يعرض الأخبار الآلية وحدها حتى تكتب.</p>}
            <table className="rm-table"><tbody>{news.map((n) => <tr key={n.id} className={n.published ? '' : 'off'} data-testid="zn-row">
              <td><span className="pu-zone">{ZONES.find((z) => z.k === n.zone)?.ar || n.zone}</span></td>
              <td><b data-tone={n.tone} className="pu-prev">{n.pinned && '● '}{n.title_ar}</b>{n.body_ar && <div className="rm-muted">{n.body_ar}</div>}{n.href && <div className="rm-muted" dir="ltr">{n.href}</div>}</td>
              <td className="rm-muted">{n.starts_at || n.ends_at ? `${fmt(n.starts_at)} ← ${fmt(n.ends_at)}` : 'دائم'}</td>
              {canWrite && <td className="pu-ops"><button type="button" onClick={() => toggle(n, 'published')} title={n.published ? 'إخفاء' : 'نشر'}>{n.published ? 'إخفاء' : 'نشر'}</button><button type="button" onClick={() => toggle(n, 'pinned')}>{n.pinned ? 'فكّ التثبيت' : 'تثبيت'}</button><button type="button" onClick={() => { setForm({ ...n, href: n.href || '', body_ar: n.body_ar || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>تعديل</button><button type="button" className="danger" onClick={() => del(n.id!)}>حذف</button></td>}
            </tr>)}</tbody></table>
          </div>
        </div>}

        {tab === 'ratings' && <div className="pu-grid">
          <div className="rm-card">
            <h3>متوسّط كلّ خدمة</h3>
            {services.length === 0 && <p className="rm-muted" data-testid="rt-empty">لا تقييمات بعد — تظهر هنا أوّل نجمة يضعها مستفيد.</p>}
            <div className="pu-svcs">{services.map(([k, v]) => <button type="button" key={k} className={`pu-svc ${svc === k ? 'on' : ''}`} onClick={() => { const s = svc === k ? '' : k; setSvc(s); void loadRatings(tok, s); }} data-testid={`rt-svc-${k}`}>
              <span className="pu-svc-name">{(SERVICE_AR as any)[k] || k}</span><span className="pu-svc-avg">{fmtAvg(v.avg)} <i>★</i></span><span className="rm-muted">{fmtCount(v.n)} · رضا {satisfaction(v.dist)}٪</span>
              <span className="pu-dist">{[4, 3, 2, 1, 0].map((i) => <i key={i} style={{ height: `${v.n ? Math.max(6, (v.dist[i] / v.n) * 100) : 6}%` }} title={`${i + 1}★: ${v.dist[i]}`} />)}</span>
            </button>)}</div>
          </div>
          <div className="rm-card">
            <h3>آخر التقييمات {svc && <small>— {(SERVICE_AR as any)[svc]}</small>}</h3>
            <table className="rm-table"><tbody>{rows.map((r) => <tr key={r.id} data-testid="rt-row">
              <td><b className="pu-stars">{'★'.repeat(r.stars)}<i>{'★'.repeat(5 - r.stars)}</i></b><div className="rm-muted">{(SERVICE_AR as any)[r.service] || r.service}{r.ref_id ? ` · ${r.ref_id}` : ''}</div></td>
              <td>{(r.tags || []).map((t: string) => <span key={t} className="pu-tag">{RATING_TAGS.find((x) => x.key === t)?.ar || t}</span>)}{r.comment && <div className="pu-comment">«{r.comment}»</div>}</td>
              <td className="rm-muted"><bdi>{r.rater_email}</bdi><br />{fmt(r.created_at)}</td>
            </tr>)}</tbody></table>
            {rows.length === 0 && <p className="rm-muted">لا شيء بعد.</p>}
          </div>
        </div>}
      </div>
    </div>
  );
}

const CSS = `
.pu{font-family:'Noto Kufi Arabic','IBM Plex Sans Arabic',system-ui,sans-serif;direction:rtl;color:#2A1626}
.pu-wrap{max-width:1180px;margin:0 auto;padding:26px 18px 60px}
.pu-tabs{display:flex;gap:8px;margin:14px 0}.pu-tabs button{border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:8px 16px;font:inherit;font-weight:800;font-size:13.5px;cursor:pointer;color:#5C4858}.pu-tabs button.on{background:#3A1F36;color:#FBF4EE;border-color:#3A1F36}.pu-tabs i{font-style:normal;opacity:.7;margin-inline-start:4px}
.pu-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:16px}@media(max-width:900px){.pu-grid{grid-template-columns:1fr}}.rm-card h3 small{font-weight:600;color:#8A5A1E}
.pu-form label{display:block;font-size:12.5px;font-weight:800;color:#5C4858;margin-top:10px}.pu-form input:not([type=checkbox]),.pu-form select{display:block;width:100%;margin-top:4px;border:1px solid #EADFD6;border-radius:10px;padding:8px 10px;font:inherit;font-size:13.5px;background:#FBF4EE}
.pu-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pu-checks label{display:flex;gap:6px;align-items:center;margin-top:12px}
.pu-act{display:flex;gap:8px;margin-top:14px}
.pu-hint{margin:12px 0 0;font-size:12.5px;color:#5C4858}.pu-prev{font-weight:800}.pu-prev[data-tone=plum]{color:#3A1F36}.pu-prev[data-tone=coral]{color:#D4614A}.pu-prev[data-tone=sand]{color:#8A5A1E}.pu-prev[data-tone=sea]{color:#3F7F79}.rm-table tr.off{opacity:.5}
.pu-zone{display:inline-block;background:#F6EBE0;color:#8A5A1E;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:900;white-space:nowrap}.pu-ops{white-space:nowrap}.pu-ops button{border:1px solid #EADFD6;background:#fff;border-radius:8px;padding:4px 8px;font:inherit;font-size:12px;cursor:pointer;margin-inline-start:4px}.pu-ops button.danger{color:#B9544A}
.pu-err{background:#FBEDE7;color:#B9544A;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}.pu-ok{background:#E6F3F1;color:#1F4F4A;border-radius:12px;padding:10px 14px;margin:8px 0;font-weight:700}
.pu-svcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.pu-svc{position:relative;text-align:right;border:1px solid #EADFD6;background:#FBF4EE;border-radius:14px;padding:12px;cursor:pointer;font:inherit;display:flex;flex-direction:column;gap:4px;min-height:110px}.pu-svc.on{border-color:#3A1F36;box-shadow:0 0 0 2px rgba(58,31,54,.15)}
.pu-svc-name{font-weight:900;color:#3A1F36}.pu-svc-avg{font-size:24px;font-weight:900;color:#2A1626}.pu-svc-avg i{font-style:normal;color:#D9A866;font-size:18px}
.pu-dist{position:absolute;left:10px;bottom:10px;display:flex;align-items:flex-end;gap:2px;height:36px}.pu-dist i{display:block;width:6px;border-radius:3px;background:#D9A866}.pu-dist i:nth-child(1){background:#5EA8A0}.pu-dist i:nth-child(5){background:#D4614A}
.pu-stars{color:#D9A866;letter-spacing:1px}.pu-stars i{font-style:normal;color:#F1D9A8}
.pu-tag{display:inline-block;background:#F6EBE0;color:#5C4858;border-radius:999px;padding:2px 9px;font-size:12px;margin:0 0 4px 4px}.pu-comment{margin-top:4px;font-size:13px;color:#2A1626}
`;
