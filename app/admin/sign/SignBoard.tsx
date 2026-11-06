'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «توقيعي» — P50: صفحة واحدة تُقرأ في دقيقة وتُفرَغ بأزرار.
 *  رأس: ينتظر توقيعك N · وقّعتَ اليوم M · الأقدم منذ X يومًا — ثم مجموعات بالأقدم أولًا، لكل واحدة «اذهب للتوقيع» و«توقيع بلمسة» حيث يكون آمنًا.
 *  اللمسة تطلب تأكيدًا واحدًا، تستدعي /api/admin/sign {touch} (الذي يستدعي الواجهة الأصلية بالرمز نفسه)، وتُحدّث العدّاد فورًا.
 *  الحالة الفارغة مقصودة: «لا شيء ينتظر توقيعك».
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import WayBar from '../../components/WayBar';
import { SIGN_EVENT } from '../../components/SignCounter'; /* العدّاد في الصدفة يتحدّث فور التوقيع */

type Item = { id: string; label_ar: string; count: number; oldest_at: string | null; href: string; touch?: { action: string; body: Record<string, string> } };
type Group = { key: string; area: 'miaar' | 'portal'; title_ar: string; hint_ar: string; count: number; oldest_at: string | null; href: string; urgent?: boolean; deadline_days?: number | null; items?: Item[] };
type Reg = { total: number; today_signed: number | null; oldest_days: number | null; groups: Group[]; scope: 'all' | 'trainer' | 'doors'; computed_at: string };

const days = (iso: string | null) => { if (!iso) return null; const d = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86400000)); return d; };
const since = (iso: string | null) => { const d = days(iso); if (d === null) return ''; return d === 0 ? 'اليوم' : d === 1 ? 'منذ يوم' : d === 2 ? 'منذ يومين' : d <= 10 ? `منذ ${d} أيام` : `منذ ${d} يومًا`; };
const SCOPE_AR = { all: 'ترى كل ما ينتظر توقيعًا في أَثَر ومِعيار', trainer: 'ترى شُعبك فقط', doors: 'ترى قرارات أبوابك' } as const;

export default function SignBoard() {
  const router = useRouter(); const [reg, setReg] = useState<Reg | null>(null); const [err, setErr] = useState<{ code: number; msg: string } | null>(null); const [busy, setBusy] = useState(''); const [ok, setOk] = useState(''); const [open, setOpen] = useState<Record<string, boolean>>({});
  const hdr = useCallback(async () => { const { data } = await supabase().auth.getSession(); const tk = data.session?.access_token; if (!tk) { router.replace('/login?next=/admin/sign'); return null; } return { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }; }, [router]);
  const load = useCallback(async (fresh = false) => { const H = await hdr(); if (!H) return; const r = await fetch(`/api/admin/sign${fresh ? '?fresh=1' : ''}`, { headers: H, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر التحميل' }); return; } setErr(null); setReg(j); window.dispatchEvent(new CustomEvent(SIGN_EVENT, { detail: { total: j.total, oldest_days: j.oldest_days } })); }, [hdr]);
  useEffect(() => { void load(); const iv = window.setInterval(() => void load(), 60000); return () => window.clearInterval(iv); }, [load]);
  async function touch(g: Group, it: Item) {
    if (!window.confirm(`توقيع «${it.label_ar}» — ${it.count} ${g.key === 'practice_start' ? 'مسوَّدة' : 'خطّة'} كما اقترحها النظام؟ يبدأ المتعلّمون اليوم.`)) return;
    setBusy(`${g.key}:${it.id}`); setOk(''); const H = await hdr(); if (!H) return;
    const r = await fetch('/api/admin/sign', { method: 'POST', headers: H, body: JSON.stringify({ action: 'touch', key: g.key, id: it.id }) }); const j = await r.json().catch(() => ({})); setBusy('');
    if (!r.ok || !j.success) { setErr({ code: r.status, msg: j.error || 'تعذّر التوقيع' }); return; }
    setOk(`وُقّع: ${it.label_ar} — ${j.result?.done ?? 0} ✓${j.result?.skipped ? ` · تُخطّي ${j.result.skipped}` : ''}${j.result?.errors?.length ? ` · تعذّر ${j.result.errors.length}` : ''}`);
    setReg((p) => p ? { ...p, total: j.total, groups: j.groups, today_signed: j.today_signed, oldest_days: j.oldest_days } : p);
    window.dispatchEvent(new CustomEvent(SIGN_EVENT, { detail: { total: j.total, oldest_days: j.oldest_days } }));
  }
  return <div className="sg" dir="rtl" data-testid="sg-root" data-total={reg?.total ?? ''}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="sg-wrap">
      <WayBar lang="ar" />
      <header className="sg-head">
        <div><span className="sg-kicker"><Icon name="check" size={14} /> بوابة أَثَر · P50 · سجلّ التوقيعات المعلّقة</span><h1>توقيعي <small>ما ينتظر توقيعي</small></h1>
          <p className="sg-lead">الذكاء يصوغ، والإنسان يوقّع. هذه الصفحة تجمع كل ما ينتظر إنسانًا في أَثَر ومِعيار — منذ متى، وأين يُوقَّع، وما يمكن توقيعه بلمسة.{reg ? ` ${SCOPE_AR[reg.scope]}.` : ''}</p></div>
        <div className="sg-acts"><button type="button" className="sg-btn ghost" onClick={() => void load(true)} data-testid="sg-refresh"><Icon name="refresh" size={14} /> تحديث</button><Link href="/hub" className="sg-btn ghost">الردهة</Link></div>
      </header>
      {err && <section className="sg-msg" role="alert" data-testid="sg-err">{err.code === 403 ? <>«توقيعي» للطاقم والمدرّبين وأصحاب الأبواب. <Link href="/me">مساحتي</Link></> : err.msg}</section>}
      {reg && <>
        <section className="sg-sum" data-testid="sg-summary">
          <div className={`sg-card ${reg.total ? 'hot' : 'calm'}`}><b data-testid="sg-total">{reg.total}</b><small>ينتظر توقيعك</small></div>
          <div className="sg-card"><b data-testid="sg-today">{reg.today_signed ?? '—'}</b><small>وقّعتَ اليوم</small></div>
          <div className="sg-card"><b data-testid="sg-oldest">{reg.oldest_days === null ? '—' : reg.oldest_days}</b><small>الأقدم (أيام)</small></div>
          <div className="sg-card"><b>{reg.groups.length}</b><small>مجموعة مفتوحة</small></div>
        </section>
        {ok && <p className="sg-ok" role="status" data-testid="sg-ok">{ok}</p>}
        {reg.total === 0 ? <section className="sg-empty" data-testid="sg-empty"><span aria-hidden="true">✍️</span><h2>لا شيء ينتظر توقيعك</h2><p>كل ما يحتاج إنسانًا وُقّع. {reg.today_signed ? <>وقّعتَ اليوم <b>{reg.today_signed}</b> — شكرًا.</> : 'عُد لاحقًا أو انتظر «نبض الصباح».'}</p></section>
          : <ol className="sg-list" data-testid="sg-list">
            {reg.groups.map((g) => { const multi = (g.items?.length || 0) > 0; const isOpen = open[g.key] ?? (g.items ? g.items.length <= 6 : false); return <li key={g.key} className={`sg-g ${g.urgent ? 'urgent' : ''} ${g.area}`} data-testid="sg-group" data-key={g.key} data-count={g.count}>
              <div className="sg-grow">
                <span className="sg-n" aria-label="العدد">{g.count}</span>
                <div className="sg-gbody"><h2>{g.title_ar} <small className="sg-area">{g.area === 'miaar' ? 'مِعيار' : 'أَثَر'}</small></h2><p>{g.hint_ar}</p>
                  <small className="sg-meta">{[g.oldest_at ? `الأقدم ${since(g.oldest_at)}` : '', g.deadline_days !== null && g.deadline_days !== undefined ? `تنقضي المهلة خلال ${g.deadline_days} ${g.deadline_days === 1 ? 'يوم' : g.deadline_days === 2 ? 'يومين' : 'أيام'}` : '', g.urgent ? 'عاجل' : ''].filter(Boolean).join(' · ')}</small></div>
                <div className="sg-gacts">{multi && <button type="button" className="sg-btn ghost sm" onClick={() => setOpen((p) => ({ ...p, [g.key]: !isOpen }))} aria-expanded={isOpen} data-testid="sg-toggle">{isOpen ? 'طيّ' : `التفاصيل (${g.items!.length})`}</button>}<Link href={g.href} className="sg-btn" data-testid="sg-go">اذهب للتوقيع <Icon name="arrow" size={14} /></Link></div>
              </div>
              {multi && isOpen && <ul className="sg-items">{g.items!.map((it) => <li key={it.id} data-testid="sg-item" data-id={it.id}>
                <span className="sg-in">{it.count}</span><div className="sg-ibody"><b>{it.label_ar}</b><small>{it.oldest_at ? `الأقدم ${since(it.oldest_at)}` : ''}</small></div>
                <div className="sg-iacts">{it.touch && reg.scope === 'all' && <button type="button" className="sg-btn primary sm" disabled={busy === `${g.key}:${it.id}`} onClick={() => void touch(g, it)} data-testid="sg-touch"><Icon name="check" size={14} /> توقيع بلمسة</button>}<Link href={it.href} className="sg-btn ghost sm" data-testid="sg-item-go">افتح</Link></div>
              </li>)}</ul>}
            </li>; })}
          </ol>}
        <p className="sg-foot">«توقيعي» لا يقرّر شيئًا: اللمسة تستدعي الواجهة نفسها التي توقّع منها عادة، وتترك الأثر نفسه في سجلّ التدقيق. الأعداد بلا أسماء؛ الأسماء في مكان التوقيع. يتحدّث كل دقيقة · © 2026 أَثَر.</p>
      </>}
    </div>
  </div>;
}

const CSS = `
.sg{min-height:100vh;background:#f8fafc;padding:92px 18px 40px;font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f2a4e}.sg :is(button,a):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.sg-wrap{max-width:1000px;margin:0 auto;display:grid;gap:12px}
.sg-head{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:flex-start}.sg-kicker{display:inline-flex;gap:6px;align-items:center;color:#c9a24b;font-weight:800;font-size:13px}.sg-head h1{margin:4px 0 4px;font-size:28px}.sg-head h1 small{font-size:15px;color:#475569;font-weight:600;margin-inline-start:8px}.sg-lead{margin:0;color:#475569;font-size:14px;line-height:1.9;max-width:720px}
.sg-acts{display:flex;gap:8px;flex-wrap:wrap}
.sg-btn{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:0 14px;border-radius:10px;border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;font-weight:800;cursor:pointer;text-decoration:none;font:inherit;font-size:13.5px}.sg-btn.ghost{background:#fff;color:#0f2a4e}.sg-btn.primary{background:#0b8a83;border-color:#0b8a83}.sg-btn.sm{min-height:32px;padding:0 10px;font-size:12.5px}.sg-btn:disabled{opacity:.5;cursor:not-allowed}
.sg-msg{padding:14px 16px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;line-height:1.8}
.sg-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}.sg-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;text-align:center}.sg-card b{display:block;font-size:30px;line-height:1.1}.sg-card small{color:#64748b;font-size:12.5px}.sg-card.hot{border-color:#fcd34d;background:#fffbeb}.sg-card.calm{border-color:#a7f3d0;background:#ecfdf5}
.sg-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:0}
.sg-empty{background:#fff;border:1px solid #a7f3d0;border-radius:16px;padding:34px 18px;text-align:center}.sg-empty span{font-size:40px}.sg-empty h2{margin:6px 0 4px;font-size:22px}.sg-empty p{margin:0;color:#475569}
.sg-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}.sg-g{background:#fff;border:1px solid #e2e8f0;border-right:5px solid #0f2a4e;border-radius:14px;padding:12px 14px}.sg-g.portal{border-right-color:#c9a24b}.sg-g.urgent{border-color:#fcd34d;background:#fffdf5}
.sg-grow{display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap}.sg-n{min-width:46px;height:46px;border-radius:12px;background:#0f2a4e;color:#fff;font-weight:900;font-size:20px;display:inline-flex;align-items:center;justify-content:center}.sg-g.portal .sg-n{background:#c9a24b}
.sg-gbody{flex:1;min-width:220px}.sg-gbody h2{margin:0;font-size:17px}.sg-area{font-size:11px;font-weight:800;color:#64748b;background:#f1f5f9;border-radius:6px;padding:1px 6px;margin-inline-start:6px;vertical-align:middle}.sg-gbody p{margin:3px 0 0;color:#475569;font-size:13px;line-height:1.7}.sg-meta{color:#92400e;font-size:12px}
.sg-gacts,.sg-iacts{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.sg-items{list-style:none;margin:10px 0 0;padding:10px 0 0;border-top:1px dashed #e2e8f0;display:grid;gap:6px}.sg-items li{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.sg-in{min-width:30px;height:30px;border-radius:8px;background:#f1f5f9;font-weight:800;display:inline-flex;align-items:center;justify-content:center;font-size:13px}.sg-ibody{flex:1;min-width:180px;display:grid}.sg-ibody b{font-size:14px}.sg-ibody small{color:#64748b;font-size:12px}
.sg-foot{color:#64748b;font-size:12px;line-height:1.8;margin:8px 0 0;text-align:center}
@media (max-width:640px){.sg{padding-top:84px}.sg-head h1{font-size:23px}.sg-card b{font-size:24px}}
`;
