// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
'use client';
/** P69 — «غرفة العرض» (/admin/demo): المكان الذي يُجهَّز فيه المشهد قبل أن يدخل الضيوف.
 *  يبني المستأجر التجريبي «قيادة افتراضية — المنطقة س» خطوةً خطوة (شريط تقدّم مسمّى)، ويعرض بطاقات العارضين الخمس،
 *  ومسار العرض التسع محطّات (قل · افتح · سيرون)، و«ساعة العرض» (تنبيه إن شاخ المشهد)، ويمحو كل شيء بتأكيد مكتوب.
 *  مدير المنصّة فقط. لا ذكاء اصطناعي · لا أسماء · الحسابات افتراضية على نطاق محجوز. */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';

const NAVY = '#0f2a4e', GOLD = '#c9a24b';
const ADMINS = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN'];
type Step = { key: string; label_ar: string; done: boolean };
type Station = { no: number; title_ar: string; say_ar: string; href: string; see_ar: string; who: string };
type Card = { training_no: string; pin: string; role: string; label_ar: string; org_ar: string; enter_url: string; note_ar: string };
type Status = { run: any; stale: boolean; days: number | null; steps: Step[]; path: Station[]; site: string; org: { name_ar: string; name_en: string }; slug: string; learners: number; presenters_n: number; cards: Card[] };
const WHO_AR: Record<string, string> = { staff: 'حسابك (الطاقم)', presenter_admin: 'بطاقة RX-P01 (رئيس اللجنة)', presenter: 'بطاقة عارض RX-P02…', public: 'بلا دخول — أي متصفّح' };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function DemoRoomPage() {
  const db = supabase(); const router = useRouter();
  const [ready, setReady] = useState(false); const [st, setSt] = useState<Status | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState('');
  const [building, setBuilding] = useState(false); const [stepAr, setStepAr] = useState(''); const [confirm, setConfirm] = useState(''); const [busy, setBusy] = useState(''); const [pathTxt, setPathTxt] = useState('');
  const stop = useRef(false);
  const H = useCallback(async () => { const { data: s } = await db.auth.getSession(); return { Authorization: `Bearer ${s.session?.access_token || ''}`, 'Content-Type': 'application/json' }; }, [db]);
  const load = useCallback(async () => { const j = await fetch('/api/admin/demo', { headers: await H(), cache: 'no-store' }).then((r) => r.json()).catch(() => null); if (j?.success) setSt(j); else setErr(j?.error || 'تعذّر التحميل'); }, [H]);
  useEffect(() => { (async () => {
    const { data: { user } } = await db.auth.getUser(); if (!user) { router.replace('/login?next=/admin/demo'); return; }
    const { data: prof } = await db.from('profiles').select('role').eq('id', user.id).single();
    if (!ADMINS.includes(String((prof as any)?.role || '').toUpperCase())) { router.replace('/dashboard'); return; }
    await load(); setReady(true);
  })(); }, [db, router, load]);

  const post = useCallback(async (body: Record<string, unknown>) => fetch('/api/admin/demo', { method: 'POST', headers: await H(), body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, j: await r.json().catch(() => ({})) })), [H]);
  const build = async () => {
    setErr(''); setMsg(''); setBuilding(true); stop.current = false; let guard = 0;
    try {
      while (!stop.current && guard++ < 80) {
        const { status, j } = await post({ action: 'build' });
        if (!j?.success) { setErr(j?.error || `خطأ ${status}`); break; }
        setStepAr(j.step_ar || ''); await load();
        if (j.done) { setMsg('اكتمل بناء المشهد — بطاقات العارضين أدناه تُعرض مرّة واحدة لكل بناء؛ اطبعها الآن.'); break; }
      }
    } finally { setBuilding(false); setStepAr(''); await load(); }
  };
  const destroy = async () => {
    setErr(''); setMsg(''); setBusy('destroy');
    const { j } = await post({ action: 'destroy', confirm }); setBusy('');
    if (!j?.success) { setErr(j?.error || 'تعذّر المحو'); return; }
    const c = j.counts || {}; setMsg(`مُحي المشهد: ${Object.entries(c).map(([k, v]) => `${k} ${v}`).join(' · ')}`); setConfirm(''); await load();
  };
  const copyPath = async () => { const { j } = await post({ action: 'path' }); if (j?.text) { setPathTxt(j.text); try { await navigator.clipboard.writeText(j.text); setMsg('نُسخ مسار العرض'); } catch { /* يظهر في الصندوق */ } } };
  const printCards = () => {
    if (!st?.cards?.length) return; const w = window.open('', '_blank', 'width=900,height=700'); if (!w) return;
    const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بطاقات العارضين — ${esc(st.org.name_ar)}</title><style>body{font-family:Tajawal,Arial,sans-serif;margin:0;padding:12mm;color:#0f172a}.g{display:grid;grid-template-columns:1fr 1fr;gap:8mm}.c{border:1.5px solid #0f2a4e;border-radius:12px;padding:8mm;break-inside:avoid;position:relative}.c h2{margin:0 0 4px;font-size:15px;color:#0f2a4e}.c .no{font-family:ui-monospace,monospace;font-size:26px;font-weight:900;letter-spacing:1px;margin:6px 0}.c .pin{font-family:ui-monospace,monospace;font-size:22px;font-weight:900;color:#9a3412}.c p{margin:3px 0;font-size:12px;color:#475569;line-height:1.7}.tag{position:absolute;top:6mm;left:6mm;background:#fff7ed;color:#9a3412;border:1px solid #fed7aa;border-radius:999px;padding:2px 10px;font-size:10px;font-weight:900}@media print{@page{size:A4;margin:10mm}}</style></head><body><div class="g">${st.cards.map((c) => `<div class="c"><span class="tag">عرض — بيانات افتراضية</span><h2>${esc(c.org_ar)}</h2><p>${esc(c.label_ar)}</p><div class="no">${esc(c.training_no)}</div><p>الرقم السرّي: <span class="pin">${esc(c.pin)}</span></p><p>الدخول: ${esc(c.enter_url)}</p><p>${esc(c.note_ar)}</p></div>`).join('')}</div><script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  if (!ready) return <div className="dm" dir="rtl"><style>{CSS}</style><div className="dm-card">…</div></div>;
  const run = st?.run || null; const status: string = run?.status || 'none'; const doneN = (st?.steps || []).filter((s) => s.done).length; const total = (st?.steps || []).length || 1;
  return (
    <div className="dm" dir="rtl" data-testid="dm-root">
      <style>{CSS}</style>
      <header className="dm-head">
        <div>
          <div className="dm-kicker"><Icon name="play" size={14} /> العرض · غرفة العرض</div>
          <h1>غرفة العرض — «{st?.org.name_ar || 'قيادة افتراضية — المنطقة س'}»</h1>
          <p>جهة افتراضية مكتملة الحياة تُبنى بزرّ واحد عبر المسارات الحقيقية نفسها (رموز تدريبية بلا أسماء · برامج بتواريخ نسبية · نموذج مثبَّت · تقرير قيادة بقرار) وتُمحى بزرّ واحد دون أن تمسّ صفًّا واحدًا غير موسوم. كل صفحة تخصّها تحمل اسمها: «افتراضية».</p>
        </div>
        <nav className="dm-nav">
          <Link href="/dashboard" className="dm-btn"><Icon name="dashboard" size={16} /> لوحة التحكم</Link>
          <Link href="/admin/miaar/invites" className="dm-btn"><Icon name="qr" size={16} /> دعوات مِعيار</Link>
          <Link href="/org" className="dm-btn"><Icon name="users" size={16} /> بوابة الجهات</Link>
        </nav>
      </header>
      {err && <div className="dm-err" data-testid="dm-err">{err}</div>}
      {msg && <div className="dm-ok" data-testid="dm-msg">{msg}</div>}

      <section className="dm-card dm-state" data-testid="dm-state" data-status={status}>
        <div className="dm-ct"><Icon name="spark" size={16} /> حالة المشهد</div>
        <div className="dm-staterow">
          <div>
            {status === 'none' || status === 'destroyed' ? <b>غير مبنيّ</b> : status === 'ready' ? <b className="ok">مبنيّ · {fmt(run.built_at)}</b> : status === 'building' ? <b className="warn">يُبنى الآن — {stepAr || run.step_ar || '…'}</b> : status === 'destroying' ? <b className="warn">يُمحى الآن…</b> : <b className="bad">فشل: {run.error_ar}</b>}
            {status === 'ready' && <p className="dm-muted">ساعة الصفر: {run.anchor} · {st?.learners} منسوبًا · {st?.presenters_n} عارضين · النموذج {run.manifest?.form_code || '—'} · التقرير السابق {run.manifest?.prev_report || '—'}</p>}
            {st?.stale && <p className="dm-stale" data-testid="dm-stale"><Icon name="clock" size={14} /> ساعة العرض: مضى {st.days} يومًا على البناء — التواريخ النسبية تشيخ؛ أعد البناء قبل العرض (المحو ثم البناء يضبط «ساعة الصفر» على اليوم).</p>}
          </div>
          <div className="dm-acts">
            {(status === 'none' || status === 'destroyed' || status === 'building') && <button type="button" className="dm-primary" data-testid="dm-build" disabled={building} onClick={build}>{building ? 'يُبنى…' : status === 'building' ? 'أكمل البناء' : 'ابنِ المشهد'}</button>}
            {(status === 'ready' || status === 'building' || status === 'failed') && <>
              <input className="dm-in" data-testid="dm-confirm" placeholder="اكتب: المنطقة س" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              <button type="button" className="dm-danger" data-testid="dm-destroy" disabled={busy === 'destroy' || confirm.trim() !== 'المنطقة س'} onClick={destroy}>{busy === 'destroy' ? 'يُمحى…' : 'امحُ المشهد'}</button>
            </>}
          </div>
        </div>
        <ol className="dm-steps" data-testid="dm-steps">
          {(st?.steps || []).map((s, i) => <li key={s.key} className={s.done ? 'done' : (status === 'building' && i === doneN ? 'now' : '')} data-testid={`dm-step-${s.key}`}><span>{s.done ? '✓' : i + 1}</span>{s.label_ar}</li>)}
        </ol>
        {(status === 'building' || building) && <div className="dm-bar"><i style={{ width: `${Math.round((doneN / total) * 100)}%` }} /></div>}
      </section>

      {status === 'ready' && st?.cards?.length ? (
        <section className="dm-card" data-testid="dm-cards">
          <div className="dm-ct"><Icon name="qr" size={16} /> بطاقات العارضين ({st.cards.length}) <button type="button" className="dm-btn" data-testid="dm-print" onClick={printCards}><Icon name="print" size={14} /> طباعة A6</button></div>
          <p className="dm-muted">حسابات افتراضية على نطاق محجوز لا يستقبل بريدًا. الأولى لرئيس اللجنة (مدير الجهة — يختم القرار)، والبقية منسوبون يرون صداه على الشاشة الثانية.</p>
          <div className="dm-grid">{st.cards.map((c) => <div key={c.training_no} className="dm-pc" data-testid={`dm-card-${c.training_no}`}><b>{c.training_no}</b><span className="dm-pin">{c.pin}</span><p>{c.label_ar}</p><p className="dm-muted">{c.note_ar}</p><p className="dm-url">{c.enter_url}</p></div>)}</div>
        </section>
      ) : null}

      <section className="dm-card" data-testid="dm-path">
        <div className="dm-ct"><Icon name="compass" size={16} /> مسار العرض — 9 محطّات <button type="button" className="dm-btn" data-testid="dm-copy" onClick={copyPath}><Icon name="copy" size={14} /> نسخ المسار</button></div>
        <ol className="dm-st">
          {(st?.path || []).map((s) => <li key={s.no} data-testid={`dm-station-${s.no}`}>
            <div className="dm-stn">{s.no}</div>
            <div className="dm-stb"><h3>{s.title_ar} <small>{WHO_AR[s.who] || s.who}</small></h3><p><b>قل:</b> {s.say_ar}</p><p><b>افتح:</b> <a href={s.href} target="_blank" rel="noreferrer" dir="ltr">{s.href}</a></p><p><b>سيرون:</b> {s.see_ar}</p></div>
          </li>)}
        </ol>
        {pathTxt && <textarea className="dm-ta" readOnly value={pathTxt} data-testid="dm-path-text" />}
      </section>

      <section className="dm-card dm-guard" data-testid="dm-guard">
        <div className="dm-ct"><Icon name="shield" size={16} /> الحواجز</div>
        <ul>
          <li>كل ما يُنشأ يُسجَّل في «البيان»؛ المحو يحذف من البيان فقط بترتيب التبعيات (جلسات → تقارير → نماذج → دعوات → حسابات → برامج → الجهة).</li>
          <li>سياسة الجهة الافتراضية pseudonymous ✓ — فهي مستبعَدة تلقائيًا من خيوط الصفحة الرئيسة ورسم المعرفة والمرصد (قواعد P67 نفسها)، وبرامجها غير عامة.</li>
          <li>قواعد k ≥ 5 وعدم الأسماء كما هي: العرض يُظهر المنصّة كما هي لا نسخة متساهلة. الجلسات حقيقية والدرجات يحسبها المحرّك.</li>
          <li>لا ذكاء اصطناعي: الأصوات الاثنا عشر من قائمة مغلقة موسومة «افتراضي»، وأرقام القياس من مولّد حتمي (البذرة = يوم البناء).</li>
        </ul>
      </section>
    </div>
  );
}

const CSS = `
.dm{font-family:var(--font-ar),Tajawal,Arial,sans-serif;background:#f1f5f9;min-height:100vh;padding:22px;color:#0f172a}
.dm *{box-sizing:border-box}
.dm-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;background:#fff;border:1px solid #e2e8f0;border-top:4px solid ${GOLD};border-radius:16px;padding:18px 22px;margin-bottom:14px}
.dm-head h1{margin:2px 0 4px;font-size:22px;color:${NAVY}}.dm-head p{margin:0;color:#64748b;font-size:13px;max-width:780px;line-height:1.7}
.dm-kicker{font-size:12px;font-weight:900;color:#078981;display:flex;align-items:center;gap:6px}
.dm-nav{display:flex;gap:8px;flex-wrap:wrap}
.dm-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #cbd5e1;background:#fff;color:${NAVY};border-radius:10px;padding:8px 12px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;text-decoration:none}
.dm-primary{border:0;background:${NAVY};color:#fff;border-radius:10px;padding:10px 18px;font:inherit;font-weight:800;cursor:pointer;min-height:44px}.dm-primary:disabled{opacity:.5;cursor:not-allowed}
.dm-danger{border:1px solid #fecaca;background:#fff;color:#991b1b;border-radius:10px;padding:10px 16px;font:inherit;font-weight:800;cursor:pointer;min-height:44px}.dm-danger:disabled{opacity:.4;cursor:not-allowed}
.dm-in{font:inherit;border:1px solid #cbd5e1;border-radius:10px;padding:9px 12px;min-height:44px;min-width:170px}
.dm-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin-bottom:14px}
.dm-ct{font-weight:900;color:${NAVY};display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.dm-muted{color:#64748b;font-size:13px;margin:4px 0}
.dm-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:12px;padding:10px 14px;margin-bottom:12px}
.dm-ok{background:#f0fdfa;border:1px solid #99f6e4;color:#115e59;border-radius:12px;padding:10px 14px;margin-bottom:12px}
.dm-staterow{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start}
.dm-staterow b{font-size:16px;color:${NAVY}}.dm-staterow b.ok{color:#0b8a83}.dm-staterow b.warn{color:#b45309}.dm-staterow b.bad{color:#991b1b}
.dm-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.dm-stale{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:10px;padding:8px 12px;font-size:13px;display:flex;gap:6px;align-items:center;margin-top:8px}
.dm-steps{list-style:none;margin:14px 0 0;padding:0;display:flex;gap:6px;flex-wrap:wrap}
.dm-steps li{display:flex;align-items:center;gap:6px;border:1px solid #e2e8f0;border-radius:999px;padding:5px 12px 5px 6px;font-size:12.5px;color:#475569;background:#f8fafc}
.dm-steps li span{width:22px;height:22px;border-radius:50%;background:#e2e8f0;color:#334155;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900}
.dm-steps li.done{border-color:#99f6e4;background:#f0fdfa;color:#115e59}.dm-steps li.done span{background:#0b8a83;color:#fff}
.dm-steps li.now{border-color:${GOLD};background:#fffbeb;color:#92400e}.dm-steps li.now span{background:${GOLD};color:#fff}
.dm-bar{height:8px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:10px}.dm-bar i{display:block;height:100%;background:linear-gradient(90deg,${NAVY},#0b8a83);transition:width .4s}
.dm-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.dm-pc{border:1.5px solid ${NAVY};border-radius:12px;padding:12px 14px}.dm-pc b{font-family:ui-monospace,monospace;font-size:20px;letter-spacing:1px;display:block}.dm-url{font-family:ui-monospace,monospace;font-size:11.5px;color:#475569;direction:ltr;text-align:left;word-break:break-all;margin:6px 0 0}.dm-pin{font-family:ui-monospace,monospace;font-size:18px;font-weight:900;color:#9a3412}.dm-pc p{margin:4px 0;font-size:13px}
.dm-st{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.dm-st li{display:flex;gap:12px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#fafbfc}
.dm-stn{width:34px;height:34px;border-radius:50%;background:${NAVY};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-weight:900;flex:none}
.dm-stb h3{margin:0 0 4px;font-size:15px;color:${NAVY}}.dm-stb h3 small{font-size:11px;color:#0b8a83;font-weight:800;margin-inline-start:8px}
.dm-stb p{margin:3px 0;font-size:13px;color:#334155;line-height:1.75}.dm-stb a{color:#0b5fa5;word-break:break-all}
.dm-ta{width:100%;min-height:220px;font:12.5px/1.7 ui-monospace,monospace;border:1px solid #cbd5e1;border-radius:12px;padding:10px;margin-top:10px;direction:rtl}
.dm-guard ul{margin:0;padding-inline-start:20px;color:#334155;font-size:13px;line-height:1.9}
@media (max-width:640px){.dm{padding:12px}.dm-head{padding:14px}.dm-st li{flex-direction:column}}
`;
