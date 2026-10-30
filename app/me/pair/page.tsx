'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/pair — «عهدان متقابلان — خطوة لك وخطوة لي» (P29 العهد المتقابل): خمس حركات في صفحة واحدة —
 *  من دائرتي (دعوة بالبريد؛ الردّ واحد لا يكشف عضوية أحد) → خطوة أطلبها منك (كلٌّ يقترح لصاحبه من خطوات تشهدها المنصة) → توقيعان (وثيقة ATH-MP واحدة بحاملَين)
 *  → أين نحن من عهدنا (دربي كاملًا · حالة خطوة صاحبي فقط · مرآة مشتركة بلا حكم) → ما وعدنا بعضَنا / ما وقع (كلمات صاحبي تُفتح بعد كلماتي → نجدّد أو نطوي).
 *  لا ذكاء اصطناعي بين الإنسانين؛ الكلمات لهما.
 *  P30: تبويب «مع جهتي» (?with=org) — عهد الممارس وجهته عبر مكوّن OrgPair.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { Channel } from '../../components/Channel';
import { supabase } from '../../../lib/supabase/client';
import { OrgPair } from '../../components/OrgPair';

type Step = { kind: string; title_ar: string; why_ar: string; target: any; proposed_by: 'a' | 'b'; proposed_at: string; accepted_at: string | null; rework: number };
type Option = { kind: string; title_ar: string; why_ar: string; target: any };
type Pair = { id: string; status: string; circle_kind: 'council' | 'org'; circle_title: string | null; my_side: 'a' | 'b'; my_name: string; partner_name: string; a_step: Step | null; b_step: Step | null; a_signed_at: string | null; b_signed_at: string | null; signed_at: string | null; review_at: string | null; accepted_at: string | null; a_review_ar: string | null; b_review_ar: string | null; a_reviewed_at: string | null; b_reviewed_at: string | null; a_decision: string | null; b_decision: string | null; partner_review_ar: string | null; code: string | null; verify_url: string | null; options: Option[] | null; my_rework_left: number };
type Invite = { id: string; status: string; invited_at: string; circle_kind: string; circle_title: string | null; why_ar: string; from_name: string; from_email: string | null; to_email: string | null; expires_at: string };
type StepState = { complete: boolean; done: number; total: number; read_ar: string; last_at: string | null };
type Path = { steps: { label_ar: string; done: boolean; at: string | null; detail_ar: string | null }[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };
type Past = { id: string; status: string; code: string | null; circle_kind: string; circle_title: string | null; partner_name: string; my_step: Step | null; partner_step: Step | null; signed_at: string | null; reviewed_at: string | null; my_review_ar: string | null; partner_review_ar: string | null; my_decision: string | null; verify_url: string | null };
type Data = { me: { name: string; email: string }; eligible: { ok: boolean; chapters: number; min: number; read_ar: string }; chapters: number; chapter_kinds?: string[]; pair: Pair | null; invites_in: Invite[]; invite_out: Invite | null; my_path: Path | null; my_state: StepState | null; partner_state: StepState | null; mirror: string | null; review_open: boolean; review_text: string | null; meets_horizon: boolean; past: Past[]; rules: { min_chapters: number; invite_days: number; propose_days: number; why_min: number; why_max: number; title_max: number; review_min: number; review_max: number; kinds_ar: Record<string, string>; circles_ar: Record<string, string>; privacy: string[] } };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { council: 'users', mission: 'flag', daily: 'calendar', level: 'trend', credential: 'star' };
const STATUS_AR: Record<string, string> = { renewed: 'جُدّد', closed: 'طُوي', revoked: 'سُحب', expired: 'انقضى', declined: 'لم يكتمل' };
/** الحركات الخمس — معاينة تُفتح بالنقر على الرقم (قبل الأهلية وبعدها) */
const MOVES: { title: string; what: string; see: string }[] = [
  { title: 'من دائرتي', what: 'تدعو زميلًا من مجلس تشاركانه أو من جهتك — ببريده الذي يستخدمه في أَثَر — وتكتب له «لماذا أنت» بكلماتك.', see: 'الردّ واحد دائمًا ولا يكشف عضوية أحد؛ إن لم يكن في دائرتك أو لم تسمح رحلته انقضت الدعوة بصمت.' },
  { title: 'خطوة أطلبها منك', what: 'بعد القبول يقترح كلٌّ منكما خطوةً لصاحبه من خطوات تشهدها المنصة: مجلس أقران · مهمة من قلب العمل · كل يوم مهارة · مستوى معتمد · شهادة قرين.', see: 'المنصة تقترح وأنت تختار أو تكتب؛ ولصاحبك أن يقول «اطلب مني غيرها» مرةً واحدة.' },
  { title: 'توقيعان', what: 'وثيقة واحدة بحاملَين (ATH-MP) تحمل خطوتيكما، تُوقَّع بمفتاح أَثَر حين يوقّع الثاني.', see: 'تُتحقَّق علنًا من رمزها بلا كشف كلمات «لماذا» — وتظهر في رحلتيكما ومحفظتيكما.' },
  { title: 'أين نحن من عهدنا', what: 'دربك كاملًا بتفاصيله، وحالة خطوة صاحبك فقط (تمّت أم لا) — ومرآة مشتركة تُقرأ بلا حكم.', see: 'في منتصف السنة تذكير هادئ، وحين تقع خطوة صاحبك يصلك «خطوة صاحبك وقعت».' },
  { title: 'ما وعدنا / ما وقع', what: 'بعد سنة يكتب كلٌّ منكما ما وقع بكلماته؛ وكلمات صاحبك تُفتح بعد كلماتك.', see: 'ثم تقرّران معًا: نجدّد عهدًا جديدًا، أو نطوي هذا بسلام — والوثيقة تبقى شاهدة.' },
];
/** أسرع ثلاثة طرق لفصل يشهده أَثَر */
const WAYS: { kind: string; title: string; how: string; href: string; cta: string }[] = [
  { kind: 'daily', title: 'موقف تواجهه بكلماتك', how: 'في «كل يوم مهارة» اقرأ الموقف واكتب كيف تتصرّف — يُكتب الفصل مع أول إجابة.', href: '/#daily', cta: 'افتح موقف اليوم' },
  { kind: 'simulation', title: 'محاكاة تُكملها حتى النهاية', how: 'ابدأ سيناريو حيًّا وتابعه حتى شاشة النتيجة — يُكتب الفصل عند الإنهاء لا عند البدء.', href: '/sim', cta: 'ابدأ محاكاة' },
  { kind: 'mission', title: 'مهمة يؤكّدها مشرفك', how: 'أنشئ مهمة من قلب عملك، سلّمها، ويؤكّدها مشرفك — يُكتب الفصل عند التأكيد.', href: '/me/missions', cta: 'مهامي' },
];
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));

export default function PairPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [email, setEmail] = useState(''); const [why, setWhy] = useState(''); const [nameMode, setNameMode] = useState<'full' | 'first' | 'anon'>('first');
  const [withOrg, setWithOrg] = useState(false);
  useEffect(() => { try { const q = new URLSearchParams(window.location.search); setWithOrg(q.get('with') === 'org'); } catch { /* لا شيء */ } }, []);
  const switchTo = (org: boolean) => { setWithOrg(org); try { const u = new URL(window.location.href); if (org) u.searchParams.set('with', 'org'); else u.searchParams.delete('with'); window.history.replaceState(null, '', u.toString()); } catch { /* لا شيء */ } };
  const [peek, setPeek] = useState(-1); const [pick, setPick] = useState(-1); const [ptitle, setPtitle] = useState(''); const [pwhy, setPwhy] = useState(''); const [stitle, setStitle] = useState(''); const [review, setReview] = useState('');
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/pair', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر التحميل'); }, []);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  const flashT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setMsg(t); if (flashT.current) clearTimeout(flashT.current); flashT.current = setTimeout(() => setMsg(''), 8000); };
  async function act(body: any): Promise<any> { setBusy(body.action); setErr(''); const j = await fetch('/api/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null); setBusy(''); if (!j?.success) { setErr(j?.error || 'تعذّر'); return null; } if (j.message) flash(j.message); if (tok) await load(tok); return j; }

  const p = d?.pair || null; const side = p?.my_side || 'a'; const o: 'a' | 'b' = side === 'a' ? 'b' : 'a';
  const myStep = p ? (side === 'a' ? p.a_step : p.b_step) : null; const ptStep = p ? (o === 'a' ? p.a_step : p.b_step) : null;
  const mySigned = p ? !!(side === 'a' ? p.a_signed_at : p.b_signed_at) : false; const ptSigned = p ? !!(o === 'a' ? p.a_signed_at : p.b_signed_at) : false;
  const myReviewed = p ? !!(side === 'a' ? p.a_reviewed_at : p.b_reviewed_at) : false; const myReview = p ? (side === 'a' ? p.a_review_ar : p.b_review_ar) : null;
  const stage: 1 | 2 | 3 | 4 | 5 = !p ? 1 : p.status === 'proposing' ? (myStep && ptStep ? 3 : 2) : d?.review_open ? 5 : 4;
  const whyOk = why.trim().length >= (d?.rules.why_min || 20) && why.trim().length <= (d?.rules.why_max || 300);
  const pwhyOk = pwhy.trim().length >= (d?.rules.why_min || 20) && pwhy.trim().length <= (d?.rules.why_max || 300);
  const revOk = review.trim().length >= (d?.rules.review_min || 20) && review.trim().length <= (d?.rules.review_max || 1500);

  return (
    <main className="pp" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="pp-head"><span className="pt-kicker"><Icon name="users" size={14} /> العهد المتقابل</span><h1>عهدان متقابلان<small> — خطوة لك وخطوة لي</small></h1>
        <p>لا أحد يفي بعهده وحده. تدعو زميلًا من دائرتك، يطلب كلٌّ منكما من صاحبه خطوة واحدة لسنة، وتوقّعان وثيقة واحدة بتوقيعين — والدرب يشهد للاثنين، والمراجعة تُقرأ معًا. لا ذكاء اصطناعي بينكما؛ الكلمات لكما.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول لفتح عهدك. <Link href="/login?next=/me/pair">تسجيل الدخول</Link></p></section>}
      {tok && <div className="pp-tabs" role="tablist" aria-label="مع من؟"><button type="button" role="tab" aria-selected={!withOrg} className={!withOrg ? 'on' : ''} data-testid="pp-tab-peer" onClick={() => switchTo(false)}><Icon name="users" size={14} /> مع زميل</button><button type="button" role="tab" aria-selected={withOrg} className={withOrg ? 'on' : ''} data-testid="pp-tab-org" onClick={() => switchTo(true)}><Icon name="school" size={14} /> مع جهتي</button></div>}
      {tok && withOrg && <OrgPair side="member" lang={lang} token={() => Promise.resolve(tok)} />}
      {!withOrg && err && <div className="pp-err" role="alert">{err}</div>}{!withOrg && msg && <div className="pp-ok" role="status">{msg}</div>}
      {tok && !withOrg && !d && !err && <section className="pt-box"><p className="pp-muted">نقرأ فصولك…</p></section>}
      {d && !withOrg && (<>
        <ol className="pp-stepper" aria-label="الحركات الخمس">{MOVES.map((m, i) => <li key={m.title} className={(i + 1 < stage ? 'done' : i + 1 === stage ? 'on' : '') + (peek === i ? ' peek' : '')}><button type="button" aria-expanded={peek === i} data-testid={`pp-step-${i + 1}`} onClick={() => setPeek(peek === i ? -1 : i)}><span>{i + 1}</span>{m.title}</button></li>)}</ol>
        {peek >= 0 && (<aside className="pp-peek" data-testid="pp-peek" role="note"><div className="pp-sechead"><h3><span className="pp-num">{peek + 1}</span> {MOVES[peek].title}{peek + 1 === stage ? <small className="pp-now">أنت هنا الآن</small> : peek + 1 < stage ? <small className="pp-now done">مرّت</small> : <small className="pp-now next">قادمة</small>}</h3><button type="button" className="pt-btn ghost small" onClick={() => setPeek(-1)}>إغلاق</button></div>
          <p>{MOVES[peek].what}</p><p className="pp-muted">{MOVES[peek].see}</p>
          <div className="pp-peeknav">{peek > 0 && <button type="button" className="pt-btn light small" onClick={() => setPeek(peek - 1)}>→ {MOVES[peek - 1].title}</button>}{peek < 4 && <button type="button" className="pt-btn light small" onClick={() => setPeek(peek + 1)}>{MOVES[peek + 1].title} ←</button>}</div></aside>)}

        {/* الدعوات الواردة — تظهر دائمًا حين توجد */}
        {d.invites_in.length > 0 && !p && d.invites_in.map(inv => (
          <section key={inv.id} className="pp-invite" data-testid="pp-invite-in">
            <div className="pp-sechead"><h2><Icon name="inbox" size={16} /> {inv.from_name} يدعوك إلى عهد متقابل</h2><span className="pp-pill light">{d.rules.circles_ar[inv.circle_kind]}{inv.circle_title ? ` · ${inv.circle_title}` : ''}</span></div>
            <blockquote className="pp-quote light">«{inv.why_ar}»<small>لماذا أنت — بكلماته · {fmt(inv.invited_at)}</small></blockquote>
            {!d.eligible.ok ? <p className="pp-warn">{d.eligible.read_ar}</p> : (<>
              <label className="pp-lbl light">اسمك في الوثيقة <select className="pp-in" value={nameMode} onChange={e => setNameMode(e.target.value as any)} data-testid="pp-namemode"><option value="first">الاسم الأول</option><option value="full">الاسم الكامل</option><option value="anon">«ممارس» بلا اسم</option></select></label>
              <div className="pp-rowbtns"><button className="pt-btn gold" disabled={!!busy} data-testid="pp-accept" onClick={() => { if (confirm(`تقبل دعوة ${inv.from_name} إلى عهد متقابل لسنة؟ بعدها يقترح كلٌّ منكما خطوة لصاحبه خلال ${d.rules.propose_days} يومًا.`)) act({ action: 'accept', id: inv.id, name_mode: nameMode, confirm: true }); }}><Icon name="check" size={14} /> أقبل</button>
                <button className="pt-btn light" disabled={!!busy} data-testid="pp-decline" onClick={() => { if (confirm('ترفض بلا تعليل؟ لن يُسأل أحد.')) act({ action: 'decline', id: inv.id, confirm: true }); }}>أرفض — بلا تعليل</button></div>
              <small className="pp-muted light">تنقضي في {fmt(inv.expires_at)} · الرفض لا يُعلَّل ولا يُعلن</small></>)}
          </section>))}

        {/* 1) من دائرتي */}
        {!p && (
          <section className="pt-box pp-sec" data-testid="pp-invite">
            <div className="pp-sechead"><h2><Icon name="send" size={16} /> من دائرتي</h2><span className="pp-pill">{d.eligible.ok ? `${d.chapters} فصول في رحلتك` : `${d.eligible.chapters} من ${d.eligible.min} فصول`}</span></div>
            {!d.eligible.ok ? (<div className="pp-empty" data-testid="pp-elig"><Icon name="users" size={26} /><b>العهد المتقابل يُقطع بعد {d.eligible.min} فصول</b><p className="pp-muted">{d.eligible.read_ar}</p>
              <div className="pp-dots">{Array.from({ length: d.eligible.min }, (_, i) => <i key={i} className={i < d.eligible.chapters ? 'on' : ''} />)}</div>
              <p className="pp-left">{d.eligible.min - d.eligible.chapters === 1 ? 'بقي فصل واحد' : d.eligible.min - d.eligible.chapters === 2 ? 'بقي فصلان' : `بقي ${d.eligible.min - d.eligible.chapters} فصول`} — أسرع ثلاثة طرق يشهدها أَثَر:</p>
              <ul className="pp-ways" data-testid="pp-ways">{WAYS.map(w => { const done = (d.chapter_kinds || []).includes(w.kind); return (<li key={w.kind} className={done ? 'done' : ''}><span className="pp-tick" aria-hidden>{done ? '✓' : '○'}</span><div><b>{w.title}</b><small>{done ? 'كُتب هذا الفصل في رحلتك.' : w.how}</small></div>{!done && <Link className="pt-btn gold small" href={w.href}>{w.cta}</Link>}</li>); })}</ul>
              <p className="pp-muted">وطرق أخرى تُكتب فصولًا: الانضمام إلى <Link href="/councils">مجلس</Link> · اختبار مِعيار · مستوى يعتمده إنسان · شهادة قرين. كل فصل جديد يظهر في <Link href="/me/journey">رحلتي</Link> — وحين تبلغ {d.eligible.min} تنفتح الدعوة هنا تلقائيًا؛ وينطبق الشرط نفسه على زميلك.</p>
              <p className="pp-muted small">الأرقام ١–٥ في الأعلى معاينة: انقر أيّ حركة لتقرأ ما يحدث فيها.</p></div>)
            : d.invite_out ? (<div data-testid="pp-invite-out"><p className="pp-read">دعوتك إلى <b dir="ltr">{d.invite_out.to_email}</b> قائمة منذ {fmt(d.invite_out.invited_at)} — تنقضي بصمت في {fmt(d.invite_out.expires_at)} إن لم يصل ردّ.</p>
              <blockquote className="pp-quote">«{d.invite_out.why_ar}»<small>ما كتبتَه له</small></blockquote>
              <div className="pp-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} data-testid="pp-cancel" onClick={() => { if (confirm('تسحب دعوتك بصمت؟')) act({ action: 'cancel', confirm: true }); }}>أسحب الدعوة</button></div></div>)
            : (<>
              <p className="pp-muted">زميل من مجلس تشاركانه أو من جهتك — بالبريد الذي يستخدمه في أَثَر. الردّ واحد دائمًا: لا تكشف الدعوة عضوية أحد، وإن لم يكن زميلك في دائرتك أو لم تسمح رحلته انقضت بصمت بعد {d.rules.invite_days} يومًا.</p>
              <label className="pp-lbl">بريد زميلك<input className="pp-in" dir="ltr" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@org.sa" data-testid="pp-email" /></label>
              <label className="pp-lbl">لماذا أنت؟ — بكلماتك ({why.trim().length}/{d.rules.why_max})</label>
              <Channel lang={lang} value={why} onChange={setWhy} tok={tok || undefined} context={{ type: 'free', id: 'pair_invite', title: 'لماذا أنت' }} placeholder="لماذا هذا الزميل تحديدًا؟ ما الذي رأيته فيه؟ — لا يراه غيركما." rows={3} maxLength={d.rules.why_max} testId="pp-why" />
              <label className="pp-lbl">اسمي في الوثيقة <select className="pp-in" value={nameMode} onChange={e => setNameMode(e.target.value as any)}><option value="first">الاسم الأول</option><option value="full">الاسم الكامل</option><option value="anon">«ممارس» بلا اسم</option></select></label>
              <div className="pp-rowbtns"><button className="pt-btn gold" disabled={!!busy || !whyOk || !email.includes('@')} data-testid="pp-send" onClick={() => act({ action: 'invite', email: email.trim(), why_ar: why.trim(), name_mode: nameMode })}><Icon name="send" size={14} /> أدعوه إلى عهد متقابل</button></div>
            </>)}
          </section>)}

        {/* 2) خطوة أطلبها منك + 3) توقيعان */}
        {p && p.status === 'proposing' && (
          <section className="pt-box pp-sec" data-testid="pp-proposing">
            <div className="pp-sechead"><h2><Icon name="target" size={16} /> خطوة أطلبها منك · خطوة يطلبها مني</h2><span className="pp-pill">{d.rules.circles_ar[p.circle_kind]}{p.circle_title ? ` · ${p.circle_title}` : ''} · {p.accepted_at ? `${daysUntil(new Date(new Date(p.accepted_at).getTime() + d.rules.propose_days * 864e5).toISOString())} يومًا للتوقيعين` : ''}</span></div>
            <div className="pp-two">
              <div className="pp-col" data-testid="pp-ask">
                <h3>ما أطلبه من {p.partner_name}</h3>
                {ptStep ? (<><div className="pp-stepcard"><span className="pp-kind"><Icon name={KIND_ICON[ptStep.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[ptStep.kind] || ptStep.kind}</span><b>«{ptStep.title_ar}»</b><small>{ptStep.why_ar}</small></div>
                  <p className="pp-muted">{ptSigned ? <><Icon name="check" size={12} /> وقّع {p.partner_name}.</> : `ننتظر توقيع ${p.partner_name} — أو طلبه غيرها (مرة واحدة).`}</p></>)
                : !p.options?.length ? (<><p className="pp-muted">المنصة تقترح من فصول {p.partner_name} ثلاث خطوات تشهدها هي — وأنت تختار وتكتب لماذا. لا تُطلب خطوة لا تشهدها المنصة.</p><button className="pt-btn" disabled={!!busy} data-testid="pp-suggest" onClick={() => act({ action: 'suggest' })}><Icon name="compass" size={14} /> خطوات يمكن أن أطلبها</button></>)
                : (<>
                  <div className="pp-opts">{p.options.map((op, i) => (<label key={i} className={`pp-opt ${pick === i ? 'on' : ''}`} data-testid="pp-opt"><input type="radio" name="opt" checked={pick === i} onChange={() => { setPick(i); setPtitle(op.title_ar); }} /><span className="pp-kind"><Icon name={KIND_ICON[op.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[op.kind] || op.kind}</span><b>{op.title_ar}</b></label>))}</div>
                  {pick >= 0 && (<>
                    <label className="pp-lbl">صياغة الخطوة (اختياري)<input className="pp-in" value={ptitle} maxLength={d.rules.title_max} onChange={e => setPtitle(e.target.value)} data-testid="pp-ptitle" /></label>
                    <label className="pp-lbl">لماذا أطلب منك هذا؟ ({pwhy.trim().length}/{d.rules.why_max})</label>
                    <Channel lang={lang} value={pwhy} onChange={setPwhy} tok={tok || undefined} context={{ type: 'free', id: 'pair_why', title: 'لماذا أطلب' }} placeholder="بكلماتك — يقرؤها صاحبك وحده." rows={3} maxLength={d.rules.why_max} testId="pp-pwhy" />
                    <button className="pt-btn gold" disabled={!!busy || !pwhyOk} data-testid="pp-propose" onClick={() => { if (confirm(`تطلب من ${p.partner_name} لسنة: «${ptitle.trim() || p.options![pick].title_ar}»؟`)) act({ action: 'propose', index: pick, title_ar: ptitle.trim() || undefined, why_ar: pwhy.trim() }); }}><Icon name="send" size={14} /> أطلبها منه</button></>)}
                </>)}
              </div>
              <div className="pp-col" data-testid="pp-asked">
                <h3>ما يطلبه {p.partner_name} مني</h3>
                {!myStep ? <p className="pp-muted">لم يطلب {p.partner_name} خطوته بعد — ستصلك حين يكتبها.</p> : (<>
                  <div className="pp-stepcard mine"><span className="pp-kind"><Icon name={KIND_ICON[myStep.kind] || 'flag'} size={13} /> {d.rules.kinds_ar[myStep.kind] || myStep.kind}</span><b>«{myStep.title_ar}»</b><small>{myStep.why_ar}</small></div>
                  {mySigned ? <p className="pp-muted"><Icon name="check" size={12} /> وقّعتَ في {fmt(side === 'a' ? p.a_signed_at : p.b_signed_at)} — ننتظر {ptSigned ? '' : `توقيع ${p.partner_name}`}{!ptStep ? ` بعد أن تطلب أنت خطوته` : ''}.</p> : (<>
                    <label className="pp-lbl">أعيد صياغتها بكلماتي (اختياري)<input className="pp-in" value={stitle} maxLength={d.rules.title_max} placeholder={myStep.title_ar} onChange={e => setStitle(e.target.value)} data-testid="pp-stitle" /></label>
                    <div className="pp-rowbtns"><button className="pt-btn gold" disabled={!!busy} data-testid="pp-sign" onClick={() => { if (confirm(`توقّع لسنة على: «${stitle.trim() || myStep.title_ar}»؟ حين يوقّع ${p.partner_name} تُصدر وثيقتكما الواحدة.`)) act({ action: 'sign', title_ar: stitle.trim() || undefined, confirm: true }); }}><Icon name="edit" size={14} /> أوقّع</button>
                      {p.my_rework_left > 0 && <button className="pt-btn ghost small" disabled={!!busy} data-testid="pp-rework" onClick={() => { if (confirm('تطلب خطوة غيرها؟ مرة واحدة فقط.')) act({ action: 'rework', confirm: true }); }}>اطلب مني غيرها</button>}</div></>)}
                </>)}
              </div>
            </div>
            <div className="pp-rowbtns"><button className="pt-btn ghost small" disabled={!!busy} data-testid="pp-revoke" onClick={() => { if (confirm('تنسحب من هذا العهد قبل اكتماله؟')) act({ action: 'revoke', confirm: true }); }}>أنسحب</button></div>
          </section>)}

        {/* 3) الوثيقة + 4) أين نحن */}
        {p && (p.status === 'active' || p.status === 'review') && myStep && ptStep && (<>
          <section className="pp-pledge" data-testid="pp-pledge-card">
            <div className="pp-pledgehead"><span className="pp-pill light">{d.rules.circles_ar[p.circle_kind]}{p.circle_title ? ` · ${p.circle_title}` : ''}</span><span dir="ltr">{p.code}</span></div>
            <div className="pp-two">
              <div><small>{p.my_name} — طلبها {p.partner_name}</small><h2>«{myStep.title_ar}»</h2></div>
              <div><small>{p.partner_name} — طلبتَها أنت</small><h2>«{ptStep.title_ar}»</h2></div>
            </div>
            <p>وُقّع {fmt(p.signed_at, 'long')} · المراجعة المشتركة {fmt(p.review_at, 'long')}{p.status === 'active' && p.review_at ? ` (بعد ${daysUntil(p.review_at)} يومًا)` : ''}</p>
            {d.meets_horizon && <p className="pp-meet"><Icon name="star" size={12} /> التقاء العهود: ما طلبه منك {p.partner_name} هو ما وعدتَ به نفسك في أفقك.</p>}
            <div className="pp-rowbtns">{p.verify_url && <a className="pp-verify" href={p.verify_url} target="_blank" rel="noreferrer" data-testid="pp-verify"><Icon name="shield" size={13} /> وثيقة واحدة بتوقيعين — تحقّق</a>}
              {p.status === 'active' && <button className="pt-btn light small" disabled={!!busy} data-testid="pp-revoke" onClick={() => { if (confirm('تسحب العهد؟ تُسحب الوثيقة ويُخبَر صاحبك — بلا تعليل.')) act({ action: 'revoke', confirm: true }); }}>أسحب العهد</button>}</div>
          </section>
          <section className="pt-box pp-sec" data-testid="pp-path">
            <div className="pp-sechead"><h2><Icon name="compass" size={16} /> أين نحن من عهدنا</h2><span className="pp-pill">{d.my_path?.quarters.find(() => true)?.label ? 'الدرب يُكتب من الأحداث' : ''}</span></div>
            {d.mirror && <p className="pp-read" data-testid="pp-mirror">{d.mirror}</p>}
            <div className="pp-two">
              <div className="pp-col"><h3>خطوتي</h3>{d.my_path && <><ul className="pp-steps">{d.my_path.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}><Icon name={s.done ? 'check' : 'clock'} size={14} /><div><b>{s.label_ar}</b>{s.detail_ar && <small>{s.detail_ar}</small>}{s.at && <small> · {fmt(s.at)}</small>}</div></li>)}</ul><p className="pp-muted">{d.my_path.read_ar}</p></>}</div>
              <div className="pp-col"><h3>خطوة {p.partner_name}</h3><div className={`pp-ptstate ${d.partner_state?.complete ? 'done' : ''}`} data-testid="pp-partner-state"><Icon name={d.partner_state?.complete ? 'check' : 'clock'} size={18} /><b>{d.partner_state?.read_ar || '—'}</b><small>ترى حالتها فقط — لا أحداثه ولا مواقفه</small></div></div>
            </div>
          </section></>)}

        {/* 5) المراجعة المشتركة */}
        {p && d.review_open && (
          <section className="pt-box pp-sec pp-review" data-testid="pp-review">
            <div className="pp-sechead"><h2><Icon name="book" size={16} /> ما وعدنا بعضَنا / ما وقع</h2><span className="pp-pill">{myReviewed ? (p.partner_review_ar ? 'اكتملت' : `ننتظر ${p.partner_name}`) : 'كلماتك أولًا'}</span></div>
            {d.review_text && <p className="pp-read">{d.review_text}</p>}
            {!myReviewed ? (<>
              <label className="pp-lbl">ما تغيّر فيّ بسبب {p.partner_name} ({review.trim().length}/{d.rules.review_max})</label>
              <Channel lang={lang} value={review} onChange={setReview} tok={tok || undefined} context={{ type: 'free', id: 'pair_review', title: 'مراجعة العهد المتقابل' }} placeholder="لا يقرؤه صاحبك حتى يكتب كلماته. لا حكم — ما تغيّر." rows={4} maxLength={d.rules.review_max} testId="pp-review-note" />
              <div className="pp-rowbtns"><button className="pt-btn gold" disabled={!!busy || !revOk} data-testid="pp-renew" onClick={() => { if (confirm('تقرّر التجديد؟ إن قرّر صاحبك مثلك بدأتما عهدًا جديدًا بخطوتين جديدتين.')) act({ action: 'review', note_ar: review.trim(), decision: 'renew', confirm: true }); }}>نجدّد — سنة أخرى</button>
                <button className="pt-btn ghost" disabled={!!busy || !revOk} data-testid="pp-close" onClick={() => { if (confirm('تقرّر طيّ العهد بكلماتك؟')) act({ action: 'review', note_ar: review.trim(), decision: 'close', confirm: true }); }}>نطوي — بكلماتنا</button></div>
            </>) : (<>
              <blockquote className="pp-quote">{myReview}<small>كلماتك · {(side === 'a' ? p.a_decision : p.b_decision) === 'renew' ? 'قرّرتَ: نجدّد' : 'قرّرتَ: نطوي'}</small></blockquote>
              {p.partner_review_ar ? <blockquote className="pp-quote partner" data-testid="pp-partner-review">{p.partner_review_ar}<small>كلمات {p.partner_name}</small></blockquote> : <p className="pp-muted">كلمات {p.partner_name} تُفتح لك حين يكتبها — كما تُفتح له كلماتك.</p>}
            </>)}
          </section>)}

        {d.past.length > 0 && (
          <section className="pt-box pp-sec" data-testid="pp-past"><div className="pp-sechead"><h2><Icon name="folder" size={16} /> عهودي السابقة</h2></div>
            {d.past.map(x => (<div key={x.id} className="pp-pastrow"><b>مع {x.partner_name}</b> <span className="pp-pill">{STATUS_AR[x.status] || x.status}</span> {x.code && <span dir="ltr" className="pp-muted">{x.code}</span>}
              {x.my_step && <p>طُلب مني: «{x.my_step.title_ar}»{x.partner_step ? ` · طلبتُ: «${x.partner_step.title_ar}»` : ''}{x.signed_at ? ` · ${fmt(x.signed_at)}` : ''}</p>}
              {x.my_review_ar && <blockquote className="pp-quote">{x.my_review_ar}<small>كلماتي</small></blockquote>}{x.partner_review_ar && <blockquote className="pp-quote partner">{x.partner_review_ar}<small>كلمات {x.partner_name}</small></blockquote>}
              {x.verify_url && <a href={x.verify_url} target="_blank" rel="noreferrer" className="pp-muted">الوثيقة</a>}</div>))}
          </section>)}

        <ul className="pp-privacy">{d.rules.privacy.map(t => <li key={t}><Icon name="shield" size={12} /> {t}</li>)}</ul>
        <p className="pp-foot"><Icon name="flag" size={12} /> عهدك مع نفسك في <Link href="/me/horizon">أفقي</Link> · فصولك في <Link href="/me/journey">رحلتي</Link> · ما يظهر منه في رحلتك: «زميل من مجلسك/جهتك» بلا اسم.</p>
      </>)}
    </main>
  );
}

const CSS = `
.pp-tabs{display:inline-flex;gap:4px;background:#e2e8f0;border-radius:999px;padding:4px;margin:0 0 12px}.pp-tabs button{all:unset;cursor:pointer;display:inline-flex;gap:6px;align-items:center;font:inherit;font-weight:900;font-size:14px;color:#1e293b;padding:7px 16px;border-radius:999px}.pp-tabs button.on{background:#0f2a4e;color:#fff}.pp-tabs button:focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.pp{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:920px;margin:0 auto;padding:28px 18px 60px}
.pp-head h1{margin:4px 0 6px;font-size:30px;color:#0f2a4e}.pp-head h1 small{font-size:16px;color:#0b8a83;font-weight:800}.pp-head p{margin:0 0 18px;color:#475569;line-height:1.9}
.pp-muted{color:#64748b;font-size:13px;line-height:1.8}.pp-muted.light{color:#cbd5e1}.pp-err{background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}.pp-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800}
.pp-warn{background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:8px 12px;color:#92400e;font-size:13px}
.pp-stepper{list-style:none;margin:10px 0 16px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.pp-stepper li{display:inline-flex;gap:7px;align-items:center;border:1px solid #cbd5e1;border-radius:999px;padding:6px 14px 6px 8px;font-size:13px;font-weight:900;color:#64748b;background:#fff}.pp-stepper li span{width:22px;height:22px;border-radius:50%;background:#e2e8f0;display:inline-flex;align-items:center;justify-content:center;font-size:12px}.pp-stepper li button{all:unset;cursor:pointer;display:inline-flex;gap:7px;align-items:center;font:inherit;color:inherit}.pp-stepper li:hover{border-color:#94a3b8;box-shadow:0 2px 8px rgba(15,42,78,.08)}.pp-stepper li.peek{background:#f8fafc;box-shadow:inset 0 0 0 1px #0f2a4e}
.pp-peek{border:1px dashed #94a3b8;border-radius:14px;padding:12px 16px;margin:-6px 0 16px;background:#fff;display:grid;gap:6px}.pp-peek h3{margin:0;font-size:16px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}.pp-peek p{margin:0;line-height:1.8;color:#334155}.pp-num{width:24px;height:24px;border-radius:50%;background:#0f2a4e;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px}.pp-now{font-size:11px;font-weight:800;color:#0f2a4e;background:#e2e8f0;border-radius:999px;padding:2px 8px}.pp-now.done{color:#0b8a83;background:#ccfbf1}.pp-now.next{color:#64748b}.pp-peeknav{display:flex;gap:8px;flex-wrap:wrap;margin-top:4px}
.pp-left{margin:10px 0 4px;font-weight:900;color:#0f2a4e}.pp-ways{list-style:none;margin:0;padding:0;display:grid;gap:8px;text-align:start;width:100%;max-width:640px}.pp-ways li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;background:#fff}.pp-ways li.done{background:#f0fdfa;border-color:#99f6e4}.pp-ways b{display:block;color:#0f2a4e;font-size:14px}.pp-ways small{color:#475569;line-height:1.7}.pp-tick{width:26px;height:26px;border-radius:50%;background:#e2e8f0;color:#64748b;display:inline-flex;align-items:center;justify-content:center;font-weight:900}.pp-ways li.done .pp-tick{background:#0b8a83;color:#fff}.pp-muted.small{font-size:12px}.pp-empty .pp-ways{margin:6px auto}
.pp-stepper li.on{border-color:#0f2a4e;color:#0f2a4e}.pp-stepper li.on span{background:#0f2a4e;color:#fff}.pp-stepper li.done{border-color:#0b8a83;color:#0b8a83}.pp-stepper li.done span{background:#0b8a83;color:#fff}
.pp-empty{text-align:center;color:#334155}.pp-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}.pp-dots{display:flex;gap:8px;justify-content:center;margin:10px 0}.pp-dots i{width:14px;height:14px;border-radius:50%;background:#e2e8f0;border:2px solid #cbd5e1}.pp-dots i.on{background:#0b8a83;border-color:#0b8a83}
.pp-sec{margin:12px 0;animation:ppIn .5s ease both}@keyframes ppIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.pp-sec h2{margin:0;font-size:18px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}
.pp-sechead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px}.pp-pill{background:#f1f5f9;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#0f2a4e;display:inline-flex;gap:5px;align-items:center}.pp-pill.light{background:rgba(255,255,255,.16);color:#fff}
.pp-invite{background:linear-gradient(135deg,#0f2a4e,#1e3a5f);color:#fff;border-radius:20px;padding:18px 20px;margin:12px 0}.pp-invite h2{color:#fff;margin:0;font-size:18px;display:inline-flex;gap:8px;align-items:center}.pp-lbl.light{color:#e2e8f0}
.pp-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:10px 0}.pp-col{border:1px solid #e2e8f0;border-radius:16px;padding:12px 14px;background:#fff}.pp-col h3{margin:0 0 8px;font-size:15px;color:#0b8a83}
.pp-stepcard{display:grid;gap:4px;border-inline-start:4px solid #c9a24b;background:#fffdf7;border-radius:0 12px 12px 0;padding:10px 14px}.pp-stepcard.mine{border-color:#0b8a83;background:#f0fdfa}.pp-stepcard b{color:#0f2a4e;font-size:15px;line-height:1.7}.pp-stepcard small{color:#475569;line-height:1.7}.pp-kind{font-size:12px;color:#0b8a83;font-weight:800;display:inline-flex;gap:5px;align-items:center}
.pp-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.pp-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff;color:#0f172a}.pp-lbl{display:block;font-size:13px;font-weight:800;color:#334155;margin:10px 0}
.pp-opts{display:grid;gap:8px;margin:8px 0}.pp-opt{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;border:1px solid #e2e8f0;border-radius:14px;padding:10px 12px;cursor:pointer;background:#fff}.pp-opt.on{border-color:#0f2a4e;box-shadow:0 0 0 3px #e0e7ff}.pp-opt input{grid-row:span 2;align-self:center}.pp-opt b{color:#0f2a4e;font-size:14px;line-height:1.7}
.pp-pledge{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:20px;padding:20px;margin:12px 0}.pp-pledgehead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#cbd5e1}.pp-pledge h2{margin:4px 0;font-size:19px;line-height:1.6;color:#fff}.pp-pledge small{color:#cbd5e1;font-size:12px}.pp-pledge p{margin:6px 0 0;color:#e2e8f0;font-size:13px}.pp-pledge .pp-two{gap:10px}.pp-pledge .pp-two>div{background:rgba(255,255,255,.08);border-radius:14px;padding:10px 14px}
.pp-meet{color:#fde68a!important;font-weight:800}.pt-btn.light{background:transparent;color:#fff;border-color:rgba(255,255,255,.55)}.pt-btn.light:hover{background:rgba(255,255,255,.12)}.pp-verify{display:inline-flex;gap:5px;align-items:center;color:#fff;font-weight:800;background:rgba(255,255,255,.14);border-radius:999px;padding:6px 12px;font-size:13px}
.pp-read{line-height:1.95;color:#1e293b;font-size:15px;background:#f8fafc;border-radius:12px;padding:10px 14px}
.pp-steps{list-style:none;margin:6px 0;padding:0;display:grid;gap:8px}.pp-steps li{display:flex;gap:10px;align-items:flex-start;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;color:#64748b}.pp-steps li.done{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.pp-steps b{display:block;color:inherit}.pp-steps small{color:#64748b}
.pp-ptstate{display:grid;justify-items:center;text-align:center;gap:6px;padding:22px 12px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b}.pp-ptstate.done{border-color:#a7f3d0;background:#ecfdf5;color:#065f46}.pp-ptstate b{font-size:16px}.pp-ptstate small{font-size:11px}
.pp-review{background:linear-gradient(135deg,#fffbeb,#fff)}
.pp-pastrow{border-top:1px solid #e2e8f0;padding:10px 0}.pp-pastrow b{color:#0f2a4e}.pp-pastrow p{margin:4px 0;color:#334155}.pp-quote{margin:8px 0 0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.8;font-size:14px;color:#1e293b}.pp-quote.partner{border-color:#0b8a83;background:#f0fdfa}.pp-quote.light{background:rgba(255,255,255,.1);color:#fff;border-color:#c9a24b}.pp-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.pp-privacy{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:4px}.pp-privacy li{font-size:12px;color:#475569;display:flex;gap:6px;align-items:center}
.pp-foot{margin-top:16px;font-size:12px;color:#64748b;display:flex;gap:6px;align-items:center;line-height:1.8;flex-wrap:wrap}
@media (max-width:700px){.pp-two{grid-template-columns:1fr}.pp-sechead{flex-direction:column;align-items:flex-start}}
`;
