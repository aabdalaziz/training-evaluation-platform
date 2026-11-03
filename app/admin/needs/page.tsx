'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /admin/needs — «الاحتياج التدريبي المعلَن» للطاقم (P44 «البرنامج الذي لم يُكتب بعد»)
 *  كل الحاجات بحالاتها (بذرة · معلَنة · متبنّاة · وُلد منها برنامج · مطويّة · مسحوبة · مضمومة) · من كتبها (بريد — للطاقم فقط) · المصدر · الجهة
 *  أفعال الطاقم: تبنٍّ مباشر (→ مسودّة في هندسة البرامج) · فكّ التبنّي · ضمّ حاجة إلى أخرى (المؤيّدون يُنقلون) · إحياء مطويّة · حذف
 *  لا يُرتَّب شيء بالأكثر تأييدًا؛ الإنسان يقرأ ويقرّر.
 */
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import PortalAdminTabs from '../../components/PortalAdminTabs';
import { P44_NAMES_AR, NEED_K, FOLD_DAYS, PRIORITY_HOURS, PITCH_MAX } from '../../../lib/needs/registry';

const STAFF = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'PROGRAM_MANAGER', 'QUALITY_ANALYST'];
const fmt = (iso?: string | null) => (iso ? String(iso).slice(0, 10) : '—');

export default function AdminNeedsPage() {
  const router = useRouter(); const db = useMemo(() => supabase(), []);
  const [ready, setReady] = useState(false); const [tok, setTok] = useState(''); const [data, setData] = useState<any>(null); const [error, setError] = useState(''); const [ok, setOk] = useState(''); const [busy, setBusy] = useState('');
  const [filter, setFilter] = useState('all'); const [pitchFor, setPitchFor] = useState(''); const [pitch, setPitch] = useState(''); const [mergeFor, setMergeFor] = useState(''); const [mergeInto, setMergeInto] = useState('');
  const fresh = async () => { const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || tok; if (tk && tk !== tok) setTok(tk); return tk; };
  const H = async (tk?: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${tk || await fresh()}` });
  async function load(tk?: string) { const j = await fetch('/api/needs?admin=1', { headers: await H(tk), cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!j?.success) { setError(j?.error || 'تعذّر التحميل'); return; } setData(j); }
  async function post(body: any) { setBusy(body.action + (body.id || body.from || '')); setError(''); setOk(''); try { const j = await fetch('/api/needs', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); await load(); setOk(j.note_ar || 'تم'); return j; } catch (e: any) { setError(e.message || 'فشل'); return null; } finally { setBusy(''); } }
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/needs'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single(); if (!STAFF.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    const { data: s } = await db.auth.getSession(); const tk = s.session?.access_token || ''; setTok(tk); await load(tk); setReady(true);
  })(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const items: any[] = data?.items || []; const ST: Record<string, string> = data?.status_ar || {};
  const counts = items.reduce((m: Record<string, number>, n) => { m[n.status] = (m[n.status] || 0) + 1; return m; }, {});
  const list = items.filter(n => filter === 'all' ? n.status !== 'merged' && n.status !== 'withdrawn' : n.status === filter);
  const openOnes = items.filter(n => ['seed', 'open', 'adopted'].includes(n.status));
  if (!ready) return <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="am-wrap"><div className="am-card">{error ? <span className="am-err">{error}</span> : 'جارٍ التحميل…'}</div></div></div>;
  return (
    <div className="am"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="am-wrap">
        <header className="am-head"><div><span className="am-kicker"><Icon name="spark" size={14} /> بوابة أَثَر · P44</span><h1>{P44_NAMES_AR.phase} — {P44_NAMES_AR.official}</h1><p>الكتالوج يُكتب من الحاجة لا من المكتب: ممارس يكتب حاجته بجملة؛ خمسة يقولون «وأنا أيضًا» فتُعلَن بلا اسم؛ عضو في هيئة أَثَر يتبنّاها ويصمّمها في هندسة البرامج؛ إنسان يعتمد؛ والبرنامج يولد ولهم المقاعد الأولى {PRIORITY_HOURS} ساعة. الحاجة بلا كاتب {FOLD_DAYS} يومًا تُطوى بهدوء. الذكاء الاصطناعي لا يكتب حاجة ولا يتبنّاها ولا يعتمدها.</p></div></header>
        <PortalAdminTabs counts={{ '/admin/needs': (counts.open || 0) }} />
        {error && <div className="am-err" role="alert">{error}</div>}{ok && <div className="am-ok" role="status">{ok}</div>}
        <div className="am-kpis" data-testid="an-kpis"><span><b>{counts.seed || 0}</b> بذرة (دون {NEED_K})</span><span className="g"><b>{counts.open || 0}</b> معلَنة تنتظر كاتبها</span><span><b>{counts.adopted || 0}</b> متبنّاة</span><span><b>{counts.born || 0}</b> وُلد منها برنامج</span><span><b>{counts.folded || 0}</b> مطويّة</span></div>
        <div className="an-filters" role="group" aria-label="الحالة">{['all', 'seed', 'open', 'adopted', 'born', 'folded', 'withdrawn', 'merged'].map(k => <button key={k} type="button" className={filter === k ? 'on' : ''} onClick={() => setFilter(k)} data-testid={`an-f-${k}`}>{k === 'all' ? 'الحيّة' : ST[k] || k} {k !== 'all' && counts[k] ? <i>{counts[k]}</i> : null}</button>)}</div>
        {list.length === 0 && <div className="am-card am-empty" data-testid="an-empty">لا حاجات هنا. الحاجات تأتي من <Link href="/needs" target="_blank" rel="noreferrer">/needs</Link> (الممارسون) · من محطات «لم تسنح الفرصة» · من «جهة تحتاج» في بوابة الجهات · ومن خمسة «أرغب» في ورشة تطبيق.</div>}
        {list.map(n => <section key={n.id} className={`am-card an-card st-${n.status}`} data-testid="an-need" data-status={n.status}>
          <div className="an-top"><span className="an-sector">{n.sector_ar}</span><span className="an-src">{n.source === 'org' ? `جهة${n.org_ar ? `: ${n.org_ar}` : ''}${n.org_named ? ' (باسمها)' : ' (بلا اسم)'}` : n.source === 'station' ? 'من محطة بعد البرنامج' : n.source === 'offer' ? 'من ورشة تطبيق' : 'ممارس'}</span><span className={`an-status ${n.status}`}>{ST[n.status] || n.status}</span></div>
          <p className="an-text">{n.text_ar}</p>
          <p className="an-meta">كتبها <bdi>{String(n.email).endsWith('@athar.internal') ? 'البرنامج نفسه (خمسة «أرغب» في ورشة تطبيق)' : n.email}</bdi> · {fmt(n.created_at)} · المؤيّدون: <b>{n.supports}</b>{n.opened_at ? ` · أُعلنت ${fmt(n.opened_at)}` : ''}{n.adopted_at ? ` · تبنّاها ${n.adopter_name_ar || n.adopter_email} (${n.adopter_kind === 'staff' ? 'طاقم' : 'هيئة'}) ${fmt(n.adopted_at)}` : ''}{n.born_at ? ` · وُلد ${fmt(n.born_at)}` : ''}{n.priority_until ? ` · المقاعد الأولى حتى ${String(n.priority_until).slice(0, 16).replace('T', ' ')}` : ''}{n.folded_at ? ` · طُويت ${fmt(n.folded_at)}` : ''}</p>
          {n.pitch_ar && <blockquote className="an-pitch">{n.pitch_ar}</blockquote>}
          <div className="an-acts">
            {n.draft_id && <Link className="am-btn small" href={`/admin/program-engineering?draft=${encodeURIComponent(n.draft_id)}`} data-testid="an-draft">المسودّة في هندسة البرامج</Link>}
            {n.program_id && <Link className="am-btn small" href={`/programs/${encodeURIComponent(n.program_id)}`} target="_blank" rel="noreferrer">صفحة البرنامج ↗</Link>}
            <Link className="am-btn small ghost" href={`/needs?n=${n.id}`} target="_blank" rel="noreferrer">على اللوحة ↗</Link>
            {(n.status === 'seed' || n.status === 'open') && pitchFor !== n.id && <button type="button" className="am-btn small gold" disabled={!!busy} onClick={() => { setPitchFor(n.id); setPitch(''); }} data-testid="an-adopt">يتبنّاها الطاقم</button>}
            {n.status === 'adopted' && <button type="button" className="am-btn small ghost" disabled={!!busy} onClick={() => { if (window.confirm('فكّ التبنّي؟ تعود الحاجة مفتوحة وتبقى المسودّة.')) post({ action: 'abandon', id: n.id }); }} data-testid="an-abandon">فكّ التبنّي</button>}
            {n.status === 'folded' && <button type="button" className="am-btn small" disabled={!!busy} onClick={() => post({ action: 'revive', id: n.id })} data-testid="an-revive">أحيِها</button>}
            {['seed', 'open', 'folded'].includes(n.status) && mergeFor !== n.id && <button type="button" className="am-btn small ghost" disabled={!!busy} onClick={() => { setMergeFor(n.id); setMergeInto(''); }} data-testid="an-merge">ضمّها إلى…</button>}
            <button type="button" className="am-btn small danger" disabled={!!busy} onClick={() => { if (window.confirm('حذف نهائي للحاجة ومؤيّديها؟')) post({ action: 'delete', id: n.id }); }} data-testid="an-delete">حذف</button>
          </div>
          {pitchFor === n.id && <form className="an-form" onSubmit={e => { e.preventDefault(); post({ action: 'adopt', id: n.id, pitch_ar: pitch }).then(j => { if (j) setPitchFor(''); }); }} data-testid="an-adopt-form">
            <label>كيف سيلبّيها الطاقم؟ (≤ {PITCH_MAX})<textarea rows={3} maxLength={PITCH_MAX} value={pitch} onChange={e => setPitch(e.target.value)} data-testid="an-pitch" /></label>
            <div className="an-row"><button className="am-btn small gold" type="submit" disabled={!!busy} data-testid="an-adopt-submit">أنشئ المسودّة</button><button type="button" className="am-btn small ghost" onClick={() => setPitchFor('')}>إلغاء</button></div>
          </form>}
          {mergeFor === n.id && <form className="an-form" onSubmit={e => { e.preventDefault(); post({ action: 'merge', from: n.id, into: mergeInto }).then(j => { if (j) setMergeFor(''); }); }} data-testid="an-merge-form">
            <label>إلى أي حاجة؟ (يُنقل الكاتب والمؤيّدون إليها)<select value={mergeInto} onChange={e => setMergeInto(e.target.value)} required data-testid="an-merge-into"><option value="">اختر…</option>{openOnes.filter(o => o.id !== n.id).map(o => <option key={o.id} value={o.id}>{o.sector_ar} — {o.text_ar.slice(0, 70)}</option>)}</select></label>
            <div className="an-row"><button className="am-btn small" type="submit" disabled={!!busy || !mergeInto} data-testid="an-merge-submit">ضمّ</button><button type="button" className="am-btn small ghost" onClick={() => setMergeFor('')}>إلغاء</button></div>
          </form>}
        </section>)}
      </div>
    </div>
  );
}

const CSS = `
.am{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;direction:rtl}
.am :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.am-wrap{max-width:1160px;margin:0 auto;display:grid;gap:12px}
.am-head h1{margin:4px 0;font-size:26px;color:#0f2a4e}.am-head p{margin:0;color:#475569;font-size:14px;line-height:1.7;max-width:900px}.am-kicker{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:900;color:#0b6f69}
.am-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;min-width:0}.am-empty{color:#475569;font-size:14px;text-align:center;padding:20px;line-height:1.8}
.am-err{color:#991b1b;font-size:13px;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:8px 12px}.am-ok{color:#065f46;font-size:13px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px}
.am-kpis{display:flex;gap:8px;flex-wrap:wrap}.am-kpis span{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:13px;color:#475569}.am-kpis b{color:#0f2a4e;font-size:18px;margin-inline-end:4px}.am-kpis .g b{color:#0b8a83}
.am-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:10px;padding:8px 12px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none}.am-btn.small{padding:6px 10px;font-size:12.5px}.am-btn.ghost{background:#fff;color:#0f2a4e}.am-btn.gold{background:#c9a24b;border-color:#c9a24b;color:#0f2a4e}.am-btn.danger{background:#fff;color:#991b1b;border-color:#fecaca}.am-btn:disabled{opacity:.5;cursor:default}
.an-filters{display:flex;gap:6px;flex-wrap:wrap}.an-filters button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}.an-filters button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.an-filters i{font-style:normal;font-weight:900;margin-inline-start:4px}
.an-card{border-inline-start:4px solid #cbd5e1}.an-card.st-open{border-inline-start-color:#0b8a83}.an-card.st-adopted{border-inline-start-color:#c9a24b}.an-card.st-born{border-inline-start-color:#0f2a4e}.an-card.st-folded,.an-card.st-withdrawn,.an-card.st-merged{opacity:.7}
.an-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:12.5px}.an-sector{background:#eef2f8;color:#0f2a4e;border-radius:999px;padding:2px 10px;font-weight:800}.an-src{color:#475569}.an-status{margin-inline-start:auto;font-weight:800;color:#64748b}.an-status.open{color:#0b8a83}.an-status.adopted{color:#9a7524}.an-status.born{color:#0f2a4e}
.an-text{font-size:16px;line-height:1.8;margin:8px 0 4px;color:#0f172a}.an-meta{margin:0;font-size:12.5px;color:#64748b;line-height:1.8}.an-pitch{margin:8px 0;padding:6px 10px;border-inline-start:3px solid #c9a24b;background:#fbf7ec;color:#334155;line-height:1.7;font-size:13.5px}
.an-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.an-form{display:grid;gap:6px;margin-top:10px;padding:10px;background:#f8fafc;border-radius:12px}.an-form label{display:grid;gap:4px;font-size:13px;font-weight:800;color:#0f2a4e}.an-form textarea,.an-form select{font:inherit;padding:8px;border:1px solid #cbd5e1;border-radius:10px;width:100%;box-sizing:border-box}.an-row{display:flex;gap:6px}
@media (max-width:640px){.an-status{margin-inline-start:0}}
`;
