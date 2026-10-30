'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/horizon — «أفقي» (P27 أفق الممارس · «رسالتي من 2036»): خمس حركات في صفحة واحدة —
 *  الأفق (أكتب نفسي بعد عشر سنوات من فصولي، بصوتي) → ثلاث خطوات لسنة (تعرفها المنصة) → العهد (وثيقة ATH-HZ موقَّعة · 365 يومًا · تُسحب بنقرة)
 *  → الدرب (يُشتق من الأحداث لا من التصريح؛ بلا نسبة) → المراجعة السنوية (ما وعدتُ / ما وقع → أجدّد أو أطوي).
 *  الأفق لا يُنشر أبدًا؛ الوثيقة تعرض عنوان العهد وتاريخه فقط.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { Channel, ReadAloud } from '../../components/Channel';
import { supabase } from '../../../lib/supabase/client';

type Option = { kind: string; title_ar: string; why_ar: string; target: any };
type Horizon = { id: string; created_at: string; year_target: number; scenario_ar: string; scenario_source: string; status: string; activated_at: string | null; review_at: string | null; reviewed_at: string | null; review_note_ar: string | null; decision: string | null; options: Option[]; meta: any };
type Pledge = { id: string; kind: string; title_ar: string; code: string | null; signed_at: string | null; expires_at: string | null; status: string; verify_url: string | null };
type Path = { kind: string; steps: { label_ar: string; done: boolean; at: string | null; detail_ar: string | null }[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };
type Data = { me: { name: string; email: string }; eligible: { ok: boolean; chapters: number; min: number; read_ar: string }; year_target: number; horizon: Horizon | null; pledge: Pledge | null; path: Path | null; review_open: boolean; review_text: string | null; past: { horizon: Horizon; pledge: Pledge | null }[]; chapters: number; rules: { min_chapters: number; years: number; pledge_days: number; review_window_days: number; scenario_min: number; scenario_max: number; review_max: number; pledge_title_max: number; kinds_ar: Record<string, string>; privacy_ar: string[]; signing_ready: boolean } };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { council: 'users', mission: 'flag', daily: 'calendar', level: 'trend', credential: 'star' };
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));

export default function HorizonPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [scen, setScen] = useState(''); const [scenSrc, setScenSrc] = useState<'own' | 'local' | 'ai'>('own'); const [draftNote, setDraftNote] = useState(''); const [editScen, setEditScen] = useState(false);
  const [pick, setPick] = useState<number>(-1); const [title, setTitle] = useState(''); const [review, setReview] = useState('');
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/horizon', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); if (j.horizon && !editScen) { setScen(j.horizon.scenario_ar); setScenSrc(j.horizon.scenario_source); } } else setErr(j?.error || 'تعذّر فتح الأفق'); }, [editScen]);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 6000); };
  async function act(body: any): Promise<any> { setBusy(body.action); setErr(''); const j = await fetch('/api/horizon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => ({ success: false, error: 'انقطع الاتصال' })); setBusy(''); if (j.success) { if (j.message) flash(j.message); await load(tok!); } else setErr(j.error || 'تعذّر'); return j; }

  const h = d?.horizon || null; const p = d?.pledge || null; const path = d?.path || null; const options = h?.options || [];
  const stage: 1 | 2 | 3 | 4 | 5 = !h ? 1 : h.status === 'draft' ? 2 : d?.review_open ? 5 : 4;
  const scenValid = scen.trim().length >= (d?.rules.scenario_min || 80) && scen.trim().length <= (d?.rules.scenario_max || 1200);

  return (
    <main className="hz" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="hz-head"><span className="pt-kicker"><Icon name="flag" size={14} /> أفق الممارس</span><h1>أفقي{d ? <small> — رسالتي من {d.year_target}</small> : null}</h1>
        <p>لا نرسم لك مسارًا. تكتب نفسك بعد عشر سنوات من فصولك أنت، ثم تختار خطوة واحدة لسنة واحدة وتوقّعها عهدًا مع نفسك — ونحن نشهد ما يقع، ولا نحكم.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول لفتح أفقك. <Link href="/login?next=/me/horizon">تسجيل الدخول</Link></p></section>}
      {err && <div className="hz-err" role="alert">{err}</div>}{msg && <div className="hz-ok" role="status">{msg}</div>}
      {tok && !d && !err && <section className="pt-box"><p className="hz-muted">نقرأ فصولك…</p></section>}
      {d && (<>
        <ol className="hz-stepper" aria-label="الحركات الخمس">{['الأفق', 'ثلاث خطوات', 'العهد', 'الدرب', 'المراجعة'].map((s, i) => <li key={s} className={i + 1 < stage || (stage === 4 && i + 1 <= 4) ? 'done' : i + 1 === stage ? 'on' : ''}><span>{i + 1}</span>{s}</li>)}</ol>

        {!d.eligible.ok && !h && (
          <section className="pt-box hz-empty" data-testid="hz-elig"><Icon name="flag" size={26} /><b>الأفق يُكتب بعد {d.eligible.min} فصول</b><p className="hz-muted">{d.eligible.read_ar}</p>
            <div className="hz-dots">{Array.from({ length: d.eligible.min }, (_, i) => <i key={i} className={i < d.eligible.chapters ? 'on' : ''} />)}</div>
            <p className="hz-muted">فصولك تُكتب من أفعالك: <Link href="/me/daily">كل يوم مهارة</Link> · <Link href="/me/missions">مهامي</Link> · <Link href="/councils">المجالس</Link> · <Link href="/me/journey">رحلتي</Link></p></section>)}

        {(d.eligible.ok || h) && (<>
          {/* 1) الأفق */}
          <section className="pt-box hz-sec" data-testid="hz-scenario">
            <div className="hz-sechead"><h2><Icon name="compass" size={16} /> أنا في {d.year_target}</h2><span className="hz-pill">{h ? (h.scenario_source === 'ai' ? 'صيغ بالذكاء الاصطناعي ثم اعتمدتَه' : h.scenario_source === 'local' ? 'صيغ محليًا ثم اعتمدتَه' : 'بكلماتك') : `من ${d.chapters} فصلًا`}</span></div>
            {h && !editScen ? (<>
              <blockquote className="hz-scen">{h.scenario_ar}</blockquote>
              <div className="hz-rowbtns"><ReadAloud text={h.scenario_ar} lang={lang} label="اسمعه" /><button className="pt-btn ghost small" onClick={() => { setScen(h.scenario_ar); setEditScen(true); }} data-testid="hz-edit"><Icon name="edit" size={13} /> عدّل أفقي</button><small className="hz-muted">كُتب {fmt(h.created_at, 'long')} · لا يراه غيرك</small></div>
            </>) : (<>
              <p className="hz-muted">اكتب نفسك كأنك تعيش {d.year_target} الآن: كيف تعمل؟ من يسألك؟ ما الذي صار عادةً بعد أن كان حدثًا؟ يمكنك أن تطلب مسودة من فصولك وكلماتك — ثم تعدّل كل كلمة قبل أن تعتمدها.</p>
              <div className="hz-rowbtns">
                <button className="pt-btn ghost small" disabled={!!busy} onClick={async () => { setBusy('draft'); const j = await fetch('/api/horizon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'draft', use_ai: false }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setScen(j.draft.text); setScenSrc('local'); setDraftNote(j.note_ar); } else setErr(j?.error || 'تعذّر'); }} data-testid="hz-draft-local"><Icon name="doc" size={13} /> مسودة من فصولي (محليًا)</button>
                <button className="pt-btn ghost small" disabled={!!busy} onClick={async () => { setBusy('draft'); const j = await fetch('/api/horizon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'draft', use_ai: true }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setScen(j.draft.text); setScenSrc(j.draft.source); setDraftNote(j.note_ar); } else setErr(j?.error || 'تعذّر'); }} data-testid="hz-draft-ai"><Icon name="edit" size={13} /> مسودة بالذكاء الاصطناعي من كلماتي</button>
                {draftNote && <small className="hz-muted">{draftNote}</small>}
              </div>
              <Channel lang={lang} value={scen} onChange={v => { setScen(v); if (scenSrc !== 'own' && v !== scen) setScenSrc(scenSrc); }} tok={tok || undefined} context={{ type: 'free', id: 'horizon', title: `أنا في ${d.year_target}` }} rows={8} maxLength={d.rules.scenario_max} placeholder={`في ${d.year_target} أنظر إلى الوراء فأرى…`} testId="hz-scen-channel" />
              <p className="hz-muted">{scen.trim().length}/{d.rules.scenario_max} · الحد الأدنى {d.rules.scenario_min} حرفًا</p>
              <div className="hz-rowbtns"><button className="pt-btn gold" disabled={!!busy || !scenValid} onClick={async () => { const j = await act({ action: 'scenario', scenario_ar: scen, source: scenSrc }); if (j.success) setEditScen(false); }} data-testid="hz-save"><Icon name="save" size={14} /> {h ? 'احفظ التعديل' : 'اعتمد أفقي'}</button>{h && <button className="pt-btn ghost" onClick={() => setEditScen(false)}>إلغاء</button>}</div>
            </>)}
          </section>

          {/* 2) ثلاث خطوات */}
          {h && h.status === 'draft' && (
            <section className="pt-box hz-sec" data-testid="hz-options">
              <div className="hz-sechead"><h2><Icon name="target" size={16} /> ثلاث خطوات لسنة واحدة</h2><span className="hz-pill">تختار واحدة</span></div>
              <p className="hz-muted">خطوات تعرفها المنصة فقط — لأن الدرب يُقاس مما يقع لا مما يُقال. لا «اقرأ كتابًا»؛ بل مجلس، مهمة، مواقف، مستوى، شهادة قرين.</p>
              {!options.length ? <button className="pt-btn" disabled={!!busy} onClick={() => act({ action: 'options' })} data-testid="hz-propose"><Icon name="compass" size={14} /> اقترحوا لي ثلاث خطوات من أفقي وفصولي</button> : (<>
                <div className="hz-opts">{options.map((o, i) => (
                  <label key={i} className={`hz-opt ${pick === i ? 'on' : ''}`} data-testid="hz-opt"><input type="radio" name="opt" checked={pick === i} onChange={() => { setPick(i); setTitle(o.title_ar); }} />
                    <span className="hz-optkind"><Icon name={KIND_ICON[o.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[o.kind] || o.kind}</span><b>{o.title_ar}</b><small>{o.why_ar}</small></label>))}</div>
                {pick >= 0 && (<>
                  <label className="hz-lbl">صياغة العهد (بكلماتك — اختياري)<input className="hz-in" value={title} maxLength={d.rules.pledge_title_max} onChange={e => setTitle(e.target.value)} data-testid="hz-title" /></label>
                  {!d.rules.signing_ready && <p className="hz-warn">مفتاح التوقيع غير مضبوط — سيُحفظ العهد بلا وثيقة موقَّعة حتى يُضبط.</p>}
                  <button className="pt-btn gold" disabled={!!busy} onClick={async () => { if (!confirm(`تقطع عهدًا مع نفسك لسنة: «${title.trim() || options[pick].title_ar}». يُوقَّع وثيقةً باسمك ويُراجَع بعد ${d.rules.pledge_days} يومًا. متابعة؟`)) return; const j = await act({ action: 'pledge', index: pick, title_ar: title.trim() || undefined, confirm: true }); if (j.success) { setPick(-1); setTitle(''); } }} data-testid="hz-pledge"><Icon name="shield" size={15} /> أقطع العهد وأوقّعه</button>
                </>)}
                <div className="hz-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'options' })}>اقترحوا غيرها</button></div>
              </>)}
            </section>)}

          {/* 3) العهد + 4) الدرب */}
          {h && p && h.status !== 'draft' && (<>
            <section className="hz-pledge" data-testid="hz-pledge-card">
              <div className="hz-pledgehead"><span className="hz-pill light"><Icon name={KIND_ICON[p.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[p.kind] || p.kind}</span><span dir="ltr">{p.code}</span></div>
              <h2>«{p.title_ar}»</h2>
              <p>عهد مع نفسي — وُقّع {fmt(p.signed_at, 'long')} · المراجعة {fmt(h.review_at, 'long')}{h.review_at && h.status === 'active' ? ` (بعد ${daysUntil(h.review_at)} يومًا)` : ''}</p>
              <div className="hz-rowbtns">{p.verify_url && <a className="hz-verify" href={p.verify_url} target="_blank" rel="noreferrer" data-testid="hz-verify"><Icon name="shield" size={13} /> التحقق من الوثيقة</a>}{h.status === 'active' && <button className="pt-btn ghost small light" disabled={!!busy} onClick={() => { if (confirm('سحب العهد؟ تُلغى الوثيقة ويبقى أفقك.')) act({ action: 'pledge_revoke', confirm: true }); }} data-testid="hz-revoke"><Icon name="x" size={13} /> أسحب العهد</button>}</div>
            </section>
            {path && (
              <section className="pt-box hz-sec" data-testid="hz-path">
                <div className="hz-sechead"><h2><Icon name="trend" size={16} /> أين أنا من عهدي</h2><span className="hz-pill">{path.complete ? 'وقع' : 'سنة مفتوحة'}</span></div>
                <p className="hz-read">{path.read_ar}</p>
                <ul className="hz-steps">{path.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''} data-testid="hz-step"><Icon name={s.done ? 'check' : 'clock'} size={14} /><div><b>{s.label_ar}</b>{s.detail_ar && <small>{s.detail_ar}{s.at ? ` · ${fmt(s.at)}` : ''}</small>}</div></li>)}</ul>
                <div className="hz-quarters">{path.quarters.map((q, i) => <div key={i}><b>{q.label}</b><p>{q.text_ar}</p></div>)}</div>
                <p className="hz-muted">الدرب يُشتق من أحداث مسجَّلة (مجالس · مهام · كل يوم مهارة · مستويات · شهادات) — لا من تصريحك، ولا نسبة ملوّنة.</p>
              </section>)}
          </>)}

          {/* 5) المراجعة */}
          {h && p && d.review_open && (
            <section className="pt-box hz-sec hz-review" data-testid="hz-review">
              <div className="hz-sechead"><h2><Icon name="refresh" size={16} /> ما وعدتُ / ما وقع</h2><span className="hz-pill">سنة</span></div>
              {d.review_text && <p className="hz-read">{d.review_text}</p>}
              <Channel lang={lang} value={review} onChange={setReview} tok={tok || undefined} context={{ type: 'free', id: 'horizon_review', title: 'ما تغيّر' }} rows={5} maxLength={d.rules.review_max} placeholder="ما الذي تغيّر فيك هذه السنة — سواء وقع العهد أم لا؟ اكتب أو تكلّم…" testId="hz-review-note" />
              <div className="hz-rowbtns">
                <button className="pt-btn gold" disabled={!!busy || review.trim().length < 20} onClick={() => { if (confirm('تجدّد أفقك وتبدأ عهد سنة جديدة؟')) act({ action: 'review', note_ar: review, decision: 'renew', confirm: true }).then(j => { if (j.success) { setReview(''); setEditScen(false); } }); }} data-testid="hz-renew"><Icon name="refresh" size={14} /> أجدّد أفقي</button>
                <button className="pt-btn ghost" disabled={!!busy || review.trim().length < 20} onClick={() => { if (confirm('تطوي هذا الأفق؟ يصبح فصلًا في رحلتك ويمكنك كتابة أفق جديد لاحقًا.')) act({ action: 'review', note_ar: review, decision: 'archive', confirm: true }).then(j => { if (j.success) setReview(''); }); }} data-testid="hz-archive"><Icon name="check" size={14} /> أطوي هذا الأفق</button>
              </div>
              <p className="hz-muted">ما لم يُراجَع خلال {d.rules.review_window_days} يومًا يُطوى تلقائيًا — وليس ذلك فشلًا.</p>
            </section>)}
        </>)}

        {!!d.past.length && (
          <section className="pt-box hz-sec" data-testid="hz-past"><h2><Icon name="book" size={16} /> آفاق سابقة</h2>
            {d.past.map(({ horizon: ph, pledge: pp }) => <article key={ph.id} className="hz-pastrow"><div><b>{ph.decision === 'renew' ? 'جُدّد' : 'طُوي'} {fmt(ph.reviewed_at || ph.created_at)}</b>{pp && <p>«{pp.title_ar}» — {d.rules.kinds_ar[pp.kind] || pp.kind}</p>}{ph.review_note_ar && <blockquote className="hz-quote">{ph.review_note_ar}<small>ما تغيّر — بكلماتك</small></blockquote>}</div></article>)}
          </section>)}

        <ul className="hz-privacy">{d.rules.privacy_ar.map((t, i) => <li key={i}><Icon name="shield" size={12} /> {t}</li>)}</ul>
        <p className="hz-foot"><Icon name="shield" size={12} /> أفقك وعهدك ملكك: يُحفظان في <Link href="/me/vault">خزنة أَثَر</Link>، ويُصدَّران ويُمحيان بطلبك. المراجعة تصبح فصلًا في <Link href="/me/journey">رحلتك</Link>.</p>
      </>)}
    </main>
  );
}

const CSS = `
.hz{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:880px;margin:0 auto;padding:28px 18px 60px}
.hz-head h1{margin:4px 0 6px;font-size:30px;color:#0f2a4e}.hz-head h1 small{font-size:16px;color:#0b8a83;font-weight:800}.hz-head p{margin:0 0 18px;color:#475569;line-height:1.9}
.hz-muted{color:#64748b;font-size:13px;line-height:1.8}.hz-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.hz-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.hz-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 12px;color:#92400e;font-size:13px}
.hz-stepper{list-style:none;margin:10px 0 16px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.hz-stepper li{display:inline-flex;gap:7px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:6px 14px 6px 8px;font-size:13px;font-weight:900;color:#64748b;background:#fff}.hz-stepper li span{width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
.hz-stepper li.on{border-color:#0f2a4e;color:#0f2a4e}.hz-stepper li.on span{background:#0f2a4e;color:#fff}.hz-stepper li.done{border-color:#0b8a83;color:#0b8a83}.hz-stepper li.done span{background:#0b8a83;color:#fff}
.hz-empty{text-align:center;color:#334155}.hz-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}.hz-dots{display:flex;gap:8px;justify-content:center;margin:10px 0}.hz-dots i{width:14px;height:14px;border-radius:50%;background:#e2e8f0;border:2px solid #cbd5e1}.hz-dots i.on{background:#0b8a83;border-color:#0b8a83}
.hz-sec{margin:12px 0;animation:hzIn .5s ease both}@keyframes hzIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.hz-sec h2{margin:0;font-size:18px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}
.hz-sechead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.hz-pill{background:#f1f5f9;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#0f2a4e;display:inline-flex;gap:5px;align-items:center}.hz-pill.light{background:rgba(255,255,255,.14);color:#fff}
.hz-scen{margin:6px 0;padding:16px 20px;border-inline-start:4px solid #c9a24b;background:linear-gradient(135deg,#fffdf7,#fff);border-radius:0 14px 14px 0;line-height:2.05;font-size:16px;color:#1e293b;white-space:pre-wrap}
.hz-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.hz-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff}.hz-lbl{display:block;font-size:13px;font-weight:800;color:#334155;margin:10px 0}
.hz-opts{display:grid;gap:10px;margin:10px 0}.hz-opt{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;cursor:pointer;background:#fff}.hz-opt.on{border-color:#0f2a4e;box-shadow:0 0 0 3px #e0e7ff}.hz-opt input{grid-row:span 3;align-self:center}.hz-optkind{font-size:12px;color:#0b8a83;font-weight:800;display:inline-flex;gap:5px;align-items:center}.hz-opt b{color:#0f2a4e;font-size:15px;line-height:1.7}.hz-opt small{color:#64748b;line-height:1.7}
.hz-pledge{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:20px;padding:20px;margin:12px 0}.hz-pledgehead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#cbd5e1}.hz-pledge h2{margin:8px 0 4px;font-size:21px;line-height:1.6}.hz-pledge p{margin:0;color:#e2e8f0;font-size:13px}
.hz-pledge .pt-btn.light{background:transparent;color:#fff;border-color:rgba(255,255,255,.55)}.hz-pledge .pt-btn.light:hover{background:rgba(255,255,255,.12)}.hz-verify{display:inline-flex;gap:5px;align-items:center;color:#fff;font-weight:800;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 12px;font-size:13px}.pt-btn.light{color:#fff;border-color:rgba(255,255,255,.4)}
.hz-read{line-height:1.95;color:#1e293b;font-size:15px;background:#f8fafc;border-radius:12px;padding:10px 14px}
.hz-steps{list-style:none;margin:10px 0;padding:0;display:grid;gap:8px}.hz-steps li{display:flex;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;color:#64748b}.hz-steps li.done{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.hz-steps b{display:block;color:inherit}.hz-steps small{color:#64748b}
.hz-quarters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0}.hz-quarters div{background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:8px 12px}.hz-quarters b{font-size:12px;color:#0b8a83}.hz-quarters p{margin:4px 0 0;font-size:13px;line-height:1.7;color:#334155}
.hz-review{background:linear-gradient(135deg,#fffbeb,#fff)}
.hz-pastrow{border-top:1px solid #e2e8f0;padding:10px 0}.hz-pastrow b{color:#0f2a4e}.hz-pastrow p{margin:4px 0;color:#334155}.hz-quote{margin:8px 0 0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.8;font-size:14px}.hz-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.hz-privacy{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:4px}.hz-privacy li{font-size:12px;color:#475569;display:flex;gap:6px;align-items:center}
.hz-foot{margin-top:16px;font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center;line-height:1.8}
@media (max-width:640px){.hz-sechead{flex-direction:column;align-items:flex-start}}
`;
