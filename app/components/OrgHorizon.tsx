'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «عشر سنوات وخطوة» (P28 أفق الجهة) — تبويب /org: خمس حركات في صفحة واحدة —
 *  نحن في 2036 (الجهة تكتب نفسها بعد عشر سنوات من فصولها، بصوتها) → خطوة لهذه السنة (ثلاث يقترحها أَثَر مما يستطيع أن يشهده من أفعال المنسوبين)
 *  → عهد الجهة (وثيقة ATH-OH باسم الجهة · 365 يومًا · تُسحب بنقرة · يُخبَر المنسوبون بعنوانها) → أين نحن من خطوتنا (أعداد أشخاص متمايزين من الأحداث بعد التوقيع؛ لا أسماء ولا نسبة)
 *  → ما وعدنا / ما وقع (مراجعة سنة الجهة → نجدّد أو نطوي؛ تصبح فصلًا في رحلة الجهة).
 *  الأفق لا يغادر الجهة: الطاقم يرى الحالة بلا نصه؛ الوثيقة تعرض عنوان العهد وتاريخه ومن وقّعه بصفته فقط.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../lib/ui/icons';
import { Channel, ReadAloud } from './Channel';

type Lang = 'ar' | 'en';
type Props = { orgId: string; orgName: string; lang: Lang; token: () => Promise<string> };
type Option = { kind: string; title_ar: string; why_ar: string; target: any };
type Horizon = { id: string; created_at: string; year_target: number; scenario_ar: string; scenario_source: string; status: string; activated_at: string | null; review_at: string | null; reviewed_at: string | null; review_note_ar: string | null; decision: string | null; options: Option[]; meta: any; hidden?: boolean };
type Pledge = { id: string; kind: string; title_ar: string; code: string | null; signed_at: string | null; expires_at: string | null; status: string; verify_url: string | null; meta: any };
type Path = { kind: string; steps: { label_ar: string; done: boolean; at: string | null; detail_ar: string | null; have: number; want: number }[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };
type Data = { me: { can_write: boolean; staff: boolean }; eligible: { ok: boolean; chapters: number; min: number; members: number; min_members: number; read_ar: string }; year_target: number; horizon: Horizon | null; pledge: Pledge | null; path: Path | null; review_open: boolean; review_text: string | null; past: { horizon: Horizon; pledge: Pledge | null }[]; chapters: number; members: number; rules: { min_chapters: number; min_members: number; years: number; pledge_days: number; review_window_days: number; scenario_min: number; scenario_max: number; review_max: number; pledge_title_max: number; people: number; kinds_ar: Record<string, string>; privacy_ar: string[]; signing_ready: boolean } };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { council: 'users', missions: 'flag', daily: 'calendar', levels: 'trend', attestations: 'star', yearbook: 'book' };
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));

export function OrgHorizon({ orgId, orgName, lang, token }: Props) {
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [scen, setScen] = useState(''); const [scenSrc, setScenSrc] = useState<'own' | 'local' | 'ai'>('own'); const [draftNote, setDraftNote] = useState(''); const [editScen, setEditScen] = useState(false);
  const [pick, setPick] = useState<number>(-1); const [title, setTitle] = useState(''); const [review, setReview] = useState(''); const [tok, setTok] = useState('');
  const tokenRef = useRef(token); tokenRef.current = token; const editRef = useRef(editScen); editRef.current = editScen;
  const load = useCallback(async () => { try { const t = await tokenRef.current(); setTok(t); const j = await fetch(`/api/org/horizon?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (j?.success) { setD(j); setErr(''); if (j.horizon && !editRef.current) { setScen(j.horizon.scenario_ar || ''); setScenSrc(j.horizon.scenario_source || 'own'); } } else setErr(j?.error || 'تعذّر فتح أفق الجهة'); } catch { setErr('انقطع الاتصال'); } }, [orgId]);
  useEffect(() => { setD(null); setEditScen(false); setPick(-1); load(); }, [load]);
  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 7000); };
  async function act(body: any): Promise<any> { setBusy(body.action); setErr(''); const t = await token(); const j = await fetch('/api/org/horizon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ org: orgId, ...body }) }).then(r => r.json()).catch(() => ({ success: false, error: 'انقطع الاتصال' })); setBusy(''); if (j.success) { if (j.message) flash(j.message); await load(); } else setErr(j.error || 'تعذّر'); return j; }
  async function draft(useAi: boolean) { setBusy('draft'); setErr(''); const t = await token(); const j = await fetch('/api/org/horizon', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ org: orgId, action: 'draft', use_ai: useAi }) }).then(r => r.json()).catch(() => null); setBusy(''); if (j?.success) { setScen(j.draft.text); setScenSrc(j.draft.source); setDraftNote(j.note_ar); } else setErr(j?.error || 'تعذّر'); }

  const h = d?.horizon || null; const p = d?.pledge || null; const path = d?.path || null; const options = h?.options || []; const can = !!d?.me.can_write;
  const stage: 1 | 2 | 3 | 4 | 5 = !h ? 1 : h.status === 'draft' ? 2 : d?.review_open ? 5 : 4;
  const scenValid = scen.trim().length >= (d?.rules.scenario_min || 100) && scen.trim().length <= (d?.rules.scenario_max || 1500);
  const yr = d?.year_target || new Date().getUTCFullYear() + 10;

  return (
    <div className="oh" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="oh-head"><span className="pt-kicker"><Icon name="compass" size={14} /> أفق الجهة</span><h2>عشر سنوات وخطوة<small> — «{orgName}» في {yr}، وخطوة واحدة لهذه السنة</small></h2>
        <p>لا نكتب لجهتكم خطة. تكتب الجهة نفسها بعد عشر سنوات من فصولها التي وقعت فعلًا، ثم تختار خطوة واحدة لهذه السنة وتوقّعها عهدًا باسمها — ومنسوبوها يشهدون عليها بأفعالهم لا بتقاريرها.</p></header>
      {err && <div className="oh-err" role="alert">{err}</div>}{msg && <div className="oh-ok" role="status">{msg}</div>}
      {!d && !err && <section className="pt-box"><p className="oh-muted">نقرأ فصول الجهة…</p></section>}
      {d && (<>
        <ol className="oh-stepper" aria-label="الحركات الخمس">{[`نحن في ${yr}`, 'خطوة لهذه السنة', 'عهد الجهة', 'أين نحن من خطوتنا', 'ما وعدنا / ما وقع'].map((s, i) => <li key={s} className={i + 1 < stage || (stage === 4 && i + 1 <= 4) ? 'done' : i + 1 === stage ? 'on' : ''}><span>{i + 1}</span>{s}</li>)}</ol>
        {d.me.staff && !can && <p className="oh-warn" data-testid="oh-staff">تقرأ بصفتك طاقم المنصة: ترى حالة الأفق والعهد والدرب — ولا ترى نص الأفق (لا يغادر الجهة) ولا تكتب.</p>}

        {!d.eligible.ok && !h && (
          <section className="pt-box oh-empty" data-testid="oh-elig"><Icon name="compass" size={26} /><b>أفق الجهة يُكتب بعد {d.eligible.min_members} منسوبين مؤكَّدين و{d.eligible.min === 2 ? 'فصلين' : `${d.eligible.min} فصول`}</b><p className="oh-muted">{d.eligible.read_ar}</p>
            <div className="oh-dotsrow"><div><small>المنسوبون المؤكَّدون</small><div className="oh-dots">{Array.from({ length: d.eligible.min_members }, (_, i) => <i key={i} className={i < d.eligible.members ? 'on' : ''} />)}</div></div><div><small>فصول رحلة الجهة</small><div className="oh-dots">{Array.from({ length: d.eligible.min }, (_, i) => <i key={i} className={i < d.eligible.chapters ? 'on' : ''} />)}</div></div></div>
            <p className="oh-muted">الفصول تُكتب من أفعال منسوبيكم: تبويب «رحلة الجهة» يريكم ما اكتمل وما لم يبلغ النصاب بعد.</p></section>)}

        {(d.eligible.ok || h) && (<>
          {/* 1) نحن في 2036 */}
          <section className="pt-box oh-sec" data-testid="oh-scenario">
            <div className="oh-sechead"><h3><Icon name="compass" size={16} /> نحن في {yr}</h3><span className="oh-pill">{h ? (h.scenario_source === 'ai' ? 'صيغ بالذكاء الاصطناعي ثم اعتمده مدير الجهة' : h.scenario_source === 'local' ? 'صيغ محليًا ثم اعتمده مدير الجهة' : 'بكلمات الجهة') : `من ${d.chapters} ${d.chapters === 1 ? 'فصل' : d.chapters <= 10 ? 'فصول' : 'فصلًا'} و${d.members} منسوبًا`}</span></div>
            {h && h.hidden ? <p className="oh-muted" data-testid="oh-hidden">نص أفق الجهة محجوب عن الطاقم — كُتب {fmt(h.created_at, 'long')} ولا يراه إلا مديرو الجهة.</p>
            : h && !editScen ? (<>
              <blockquote className="oh-scen">{h.scenario_ar}</blockquote>
              <div className="oh-rowbtns"><ReadAloud text={h.scenario_ar} lang={lang} label="اسمعه" />{can && <button className="pt-btn ghost small" onClick={() => { setScen(h.scenario_ar); setEditScen(true); }} data-testid="oh-edit"><Icon name="edit" size={13} /> عدّلوا الأفق</button>}<small className="oh-muted">كُتب {fmt(h.created_at, 'long')} · لا يغادر الجهة</small></div>
            </>) : can ? (<>
              <p className="oh-muted">اكتبوا الجهة كأنها تعيش {yr} الآن، بصيغة «نحن»: كيف نعمل؟ ما الذي صار عادةً بعد أن كان حدثًا؟ من يسألنا وماذا نجيب؟ يمكنكم طلب مسودة من فصول الجهة وكلماتها («ما تغيّر فينا») — ثم تعديل كل كلمة قبل اعتمادها.</p>
              <div className="oh-rowbtns">
                <button className="pt-btn ghost small" disabled={!!busy} onClick={() => draft(false)} data-testid="oh-draft-local"><Icon name="doc" size={13} /> مسودة من فصول الجهة (محليًا)</button>
                <button className="pt-btn ghost small" disabled={!!busy} onClick={() => draft(true)} data-testid="oh-draft-ai"><Icon name="edit" size={13} /> مسودة بالذكاء الاصطناعي من كلمات الجهة</button>
                {draftNote && <small className="oh-muted">{draftNote}</small>}
              </div>
              <Channel lang={lang} value={scen} onChange={v => setScen(v)} tok={tok || undefined} context={{ type: 'free', id: 'org_horizon', title: `نحن في ${yr}` }} rows={9} maxLength={d.rules.scenario_max} placeholder={`في ${yr} ننظر — نحن «${orgName}» — إلى الوراء فنرى…`} testId="oh-scen-channel" />
              <p className="oh-muted">{scen.trim().length}/{d.rules.scenario_max} · الحد الأدنى {d.rules.scenario_min} حرف</p>
              <div className="oh-rowbtns"><button className="pt-btn gold" disabled={!!busy || !scenValid} onClick={async () => { const j = await act({ action: 'scenario', scenario_ar: scen, source: scenSrc }); if (j.success) setEditScen(false); }} data-testid="oh-save"><Icon name="save" size={14} /> {h ? 'احفظوا التعديل' : 'اعتمدوا أفق الجهة'}</button>{h && <button className="pt-btn ghost" onClick={() => setEditScen(false)}>إلغاء</button>}</div>
            </>) : <p className="oh-muted">لم يكتب مديرو الجهة أفقها بعد.</p>}
          </section>

          {/* 2) خطوة لهذه السنة */}
          {h && h.status === 'draft' && (
            <section className="pt-box oh-sec" data-testid="oh-options">
              <div className="oh-sechead"><h3><Icon name="target" size={16} /> خطوة واحدة لهذه السنة</h3><span className="oh-pill">ثلاث خطوات — تختارون واحدة</span></div>
              <p className="oh-muted">خطوات يستطيع أَثَر أن يشهدها من أفعال منسوبيكم — لأن الدرب يُقاس مما يقع لا مما يُقال. لا «نرفع الوعي»؛ بل مجلس، مهمات، مواقف، مستويات، شهادات أقران، كتاب سنة — بخمسة أشخاص متمايزين على الأقل.</p>
              {!options.length ? (can ? <button className="pt-btn" disabled={!!busy} onClick={() => act({ action: 'options' })} data-testid="oh-propose"><Icon name="compass" size={14} /> اقترحوا لنا ثلاث خطوات من أفقنا وفصولنا</button> : <p className="oh-muted">لم تُقترح الخطوات بعد.</p>) : (<>
                <div className="oh-opts">{options.map((o, i) => (
                  <label key={i} className={`oh-opt ${pick === i ? 'on' : ''}`} data-testid="oh-opt"><input type="radio" name="oh-opt" disabled={!can} checked={pick === i} onChange={() => { setPick(i); setTitle(o.title_ar); }} />
                    <span className="oh-optkind"><Icon name={KIND_ICON[o.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[o.kind] || o.kind}</span><b>{o.title_ar}</b><small>{o.why_ar}</small></label>))}</div>
                {can && pick >= 0 && (<>
                  <label className="oh-lbl">صياغة العهد (بكلمات الجهة — اختياري)<input className="oh-in" value={title} maxLength={d.rules.pledge_title_max} onChange={e => setTitle(e.target.value)} data-testid="oh-title" /></label>
                  {!d.rules.signing_ready && <p className="oh-warn">مفتاح التوقيع غير مضبوط — سيُحفظ العهد بلا وثيقة موقَّعة حتى يُضبط.</p>}
                  <button className="pt-btn gold" disabled={!!busy} onClick={async () => { if (!confirm(`تقطع «${orgName}» عهدًا لسنة: «${title.trim() || options[pick].title_ar}». يُوقَّع وثيقةً باسم الجهة (وتُذكر بصفتك موقِّعًا)، ويُخبَر المنسوبون المؤكَّدون بعنوانه، ويُراجَع بعد ${d.rules.pledge_days} يومًا. متابعة؟`)) return; const j = await act({ action: 'pledge', index: pick, title_ar: title.trim() || undefined, confirm: true }); if (j.success) { setPick(-1); setTitle(''); } }} data-testid="oh-pledge"><Icon name="shield" size={15} /> نقطع عهد الجهة ونوقّعه</button>
                </>)}
                {can && <div className="oh-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} onClick={() => act({ action: 'options' })}>اقترحوا غيرها</button></div>}
              </>)}
            </section>)}

          {/* 3) عهد الجهة + 4) أين نحن من خطوتنا */}
          {h && p && h.status !== 'draft' && (<>
            <section className="oh-pledge" data-testid="oh-pledge-card">
              <div className="oh-pledgehead"><span className="oh-pill light"><Icon name={KIND_ICON[p.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[p.kind] || p.kind}</span><span dir="ltr">{p.code}</span></div>
              <h3>«{p.title_ar}»</h3>
              <p>عهد «{orgName}» — وُقّع {fmt(p.signed_at, 'long')}{p.meta?.signer_name ? ` بيد ${p.meta.signer_name} بصفته مدير الجهة` : ''} · المراجعة {fmt(h.review_at, 'long')}{h.review_at && h.status === 'active' ? ` (بعد ${daysUntil(h.review_at)} يومًا)` : ''}</p>
              <div className="oh-rowbtns">{p.verify_url && <a className="oh-verify" href={p.verify_url} target="_blank" rel="noreferrer" data-testid="oh-verify"><Icon name="shield" size={13} /> التحقق من الوثيقة</a>}{can && h.status === 'active' && <button className="pt-btn ghost small light" disabled={!!busy} onClick={() => { if (confirm('سحب عهد الجهة؟ تُلغى الوثيقة ويبقى أفق الجهة.')) act({ action: 'pledge_revoke', confirm: true }); }} data-testid="oh-revoke"><Icon name="x" size={13} /> نسحب العهد</button>}</div>
            </section>
            {path && (
              <section className="pt-box oh-sec" data-testid="oh-path">
                <div className="oh-sechead"><h3><Icon name="trend" size={16} /> أين نحن من خطوتنا</h3><span className="oh-pill">{path.complete ? 'وقع' : 'سنة مفتوحة'}</span></div>
                <p className="oh-read">{path.read_ar}</p>
                <ul className="oh-steps">{path.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''} data-testid="oh-step"><Icon name={s.done ? 'check' : 'clock'} size={14} /><div><b>{s.label_ar}</b>{s.detail_ar && <small>{s.detail_ar}{s.at ? ` · ${fmt(s.at)}` : ''}</small>}</div><span className="oh-count" dir="ltr">{s.have}/{s.want}</span></li>)}</ul>
                <div className="oh-quarters">{path.quarters.map((q, i) => <div key={i}><b>{q.label}</b><p>{q.text_ar}</p></div>)}</div>
                <p className="oh-muted">الدرب يُشتق من أحداث منسوبيكم المؤكَّدين بعد التوقيع (مجالس · مهام · كل يوم مهارة · مستويات · شهادات أقران · كتب السنة) — أعداد أشخاص متمايزين، لا أسماء ولا نسبة ملوّنة. المنسوبون يرون عنوان العهد فقط.</p>
              </section>)}
          </>)}

          {/* 5) ما وعدنا / ما وقع */}
          {h && p && d.review_open && (
            <section className="pt-box oh-sec oh-review" data-testid="oh-review">
              <div className="oh-sechead"><h3><Icon name="refresh" size={16} /> ما وعدنا / ما وقع</h3><span className="oh-pill">سنة</span></div>
              {d.review_text && <p className="oh-read">{d.review_text}</p>}
              {can ? (<>
                <Channel lang={lang} value={review} onChange={setReview} tok={tok || undefined} context={{ type: 'free', id: 'org_horizon_review', title: 'ما تغيّر فينا' }} rows={5} maxLength={d.rules.review_max} placeholder="ما الذي تغيّر في الجهة هذه السنة — سواء وقع العهد أم لا؟ اكتبوا أو تكلّموا…" testId="oh-review-note" />
                <div className="oh-rowbtns">
                  <button className="pt-btn gold" disabled={!!busy || review.trim().length < 20} onClick={() => { if (confirm('تجدّد الجهة أفقها وتبدأ عهد سنة جديدة؟')) act({ action: 'review', note_ar: review, decision: 'renew', confirm: true }).then(j => { if (j.success) { setReview(''); setEditScen(false); } }); }} data-testid="oh-renew"><Icon name="refresh" size={14} /> نجدّد أفق الجهة</button>
                  <button className="pt-btn ghost" disabled={!!busy || review.trim().length < 20} onClick={() => { if (confirm('تطوي الجهة هذا الأفق؟ يصبح فصلًا في رحلتها ويمكن كتابة أفق جديد لاحقًا.')) act({ action: 'review', note_ar: review, decision: 'archive', confirm: true }).then(j => { if (j.success) setReview(''); }); }} data-testid="oh-archive"><Icon name="check" size={14} /> نطوي هذا الأفق</button>
                </div>
              </>) : <p className="oh-muted">المراجعة مفتوحة لمديري الجهة.</p>}
              <p className="oh-muted">ما لم يُراجَع خلال {d.rules.review_window_days} يومًا يُطوى تلقائيًا — وليس ذلك فشلًا.</p>
            </section>)}
        </>)}

        {!!d.past.length && (
          <section className="pt-box oh-sec" data-testid="oh-past"><h3><Icon name="book" size={16} /> آفاق سابقة للجهة</h3>
            {d.past.map(({ horizon: ph, pledge: pp }) => <article key={ph.id} className="oh-pastrow"><div><b>{ph.decision === 'renew' ? 'جُدّد' : 'طُوي'} {fmt(ph.reviewed_at || ph.created_at)}</b>{pp && <p>«{pp.title_ar}» — {d.rules.kinds_ar[pp.kind] || pp.kind}</p>}{ph.review_note_ar && !ph.hidden && <blockquote className="oh-quote">{ph.review_note_ar}<small>ما تغيّر فينا — بكلمات الجهة</small></blockquote>}</div></article>)}
          </section>)}

        <ul className="oh-privacy">{d.rules.privacy_ar.map((t, i) => <li key={i}><Icon name="shield" size={12} /> {t}</li>)}</ul>
        <p className="oh-foot"><Icon name="shield" size={12} /> أفق الجهة وعهدها ملك الجهة؛ يُذكر الكاتب والموقِّع بصفتهما ويُحفظان في <Link href="/me/data">خزنة أَثَر</Link>. المراجعة تصبح فصلًا في <Link href="/org?tab=journey">رحلة الجهة</Link>.</p>
      </>)}
    </div>
  );
}

const CSS = `
.oh{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:900px;margin:0 auto}
.oh-head h2{margin:4px 0 6px;font-size:26px;color:#0f2a4e}.oh-head h2 small{display:block;font-size:14px;color:#0b8a83;font-weight:800;margin-top:4px}.oh-head p{margin:0 0 16px;color:#475569;line-height:1.9}
.oh-muted{color:#64748b;font-size:13px;line-height:1.8}.oh-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.oh-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.oh-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 12px;color:#92400e;font-size:13px}
.oh-stepper{list-style:none;margin:10px 0 16px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.oh-stepper li{display:inline-flex;gap:7px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:6px 14px 6px 8px;font-size:13px;font-weight:900;color:#64748b;background:#fff}.oh-stepper li span{width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:12px}
.oh-stepper li.on{border-color:#0f2a4e;color:#0f2a4e}.oh-stepper li.on span{background:#0f2a4e;color:#fff}.oh-stepper li.done{border-color:#0b8a83;color:#0b8a83}.oh-stepper li.done span{background:#0b8a83;color:#fff}
.oh-empty{text-align:center;color:#334155}.oh-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}.oh-dotsrow{display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin:10px 0}.oh-dotsrow small{display:block;color:#64748b;font-size:12px;margin-bottom:4px}.oh-dots{display:flex;gap:8px;justify-content:center}.oh-dots i{width:14px;height:14px;border-radius:50%;background:#e2e8f0;border:2px solid #cbd5e1}.oh-dots i.on{background:#0b8a83;border-color:#0b8a83}
.oh-sec{margin:12px 0;animation:ohIn .5s ease both}@keyframes ohIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.oh-sec h3{margin:0;font-size:18px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}
.oh-sechead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.oh-pill{background:#f1f5f9;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#0f2a4e;display:inline-flex;gap:5px;align-items:center}.oh-pill.light{background:rgba(255,255,255,.14);color:#fff}
.oh-scen{margin:6px 0;padding:16px 20px;border-inline-start:4px solid #c9a24b;background:linear-gradient(135deg,#fffdf7,#fff);border-radius:0 14px 14px 0;line-height:2.05;font-size:16px;color:#1e293b;white-space:pre-wrap}
.oh-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.oh-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff}.oh-lbl{display:block;font-size:13px;font-weight:800;color:#334155;margin:10px 0}
.oh-opts{display:grid;gap:10px;margin:10px 0}.oh-opt{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;cursor:pointer;background:#fff}.oh-opt.on{border-color:#0f2a4e;box-shadow:0 0 0 3px #e0e7ff}.oh-opt input{grid-row:span 3;align-self:center}.oh-optkind{font-size:12px;color:#0b8a83;font-weight:800;display:inline-flex;gap:5px;align-items:center}.oh-opt b{color:#0f2a4e;font-size:15px;line-height:1.7}.oh-opt small{color:#64748b;line-height:1.7}
.oh-pledge{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:20px;padding:20px;margin:12px 0}.oh-pledgehead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#cbd5e1}.oh-pledge h3{margin:8px 0 4px;font-size:21px;line-height:1.6;color:#fff}.oh-pledge p{margin:0;color:#e2e8f0;font-size:13px}
.oh-pledge .pt-btn.light{background:transparent;color:#fff;border-color:rgba(255,255,255,.55)}.oh-pledge .pt-btn.light:hover{background:rgba(255,255,255,.12)}.oh-verify{display:inline-flex;gap:5px;align-items:center;color:#fff;font-weight:800;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 12px;font-size:13px}
.oh-read{line-height:1.95;color:#1e293b;font-size:15px;background:#f8fafc;border-radius:12px;padding:10px 14px}
.oh-steps{list-style:none;margin:10px 0;padding:0;display:grid;gap:8px}.oh-steps li{display:flex;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;color:#64748b}.oh-steps li.done{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.oh-steps b{display:block;color:inherit}.oh-steps small{color:#64748b}.oh-steps div{flex:1}.oh-count{font-weight:900;font-size:13px;color:#0f2a4e;background:#fff;border:1px solid #e2e8f0;border-radius:999px;padding:2px 10px}
.oh-quarters{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;margin:10px 0}.oh-quarters div{background:#fff;border:1px dashed #cbd5e1;border-radius:12px;padding:8px 12px}.oh-quarters b{font-size:12px;color:#0b8a83}.oh-quarters p{margin:4px 0 0;font-size:13px;line-height:1.7;color:#334155}
.oh-review{background:linear-gradient(135deg,#fffbeb,#fff)}
.oh-pastrow{border-top:1px solid #e2e8f0;padding:10px 0}.oh-pastrow b{color:#0f2a4e}.oh-pastrow p{margin:4px 0;color:#334155}.oh-quote{margin:8px 0 0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.8;font-size:14px}.oh-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.oh-privacy{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:4px}.oh-privacy li{font-size:12px;color:#475569;display:flex;gap:6px;align-items:center}
.oh-foot{margin-top:16px;font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center;line-height:1.8;flex-wrap:wrap}
@media (max-width:640px){.oh-sechead{flex-direction:column;align-items:flex-start}}
`;
