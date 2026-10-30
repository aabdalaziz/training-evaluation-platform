'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «خطوة مني وخطوة من جهتي» (P30 عهد الممارس وجهته) — مكوّن واحد بوجهين:
 *  side="member" داخل /me/pair («مع جهتي») · side="org" داخل /org?tab=horizon («عهود الجهة مع منسوبيها»).
 *  الحركات: طلب/دعوة → خطوة تطلبها الجهة من المنسوب (من خطوات P27) · خطوة يطلبها المنسوب من جهته (ما تشهده المنصة: مقعد مجلس · اعتماد مستوى · اعتماد شهادة قرين · تأكيد المهام في مهلتها)
 *  → توقيعان (المنسوب باسمه · المدير بصفته — وثيقة ATH-PO) → أين نحن (دربي كاملًا · حالة خطوة الآخر فقط · مرآة بلا حكم) → ما وعدنا / ما وقع (كلمات الآخر تُفتح بعد كلماتي).
 *  WCAG 2.2 AA: تباين ≥ 4.5 · تركيز لوحة مفاتيح مرئي · النقاط مصحوبة بنص · لا رسائل تختفي بمؤقّت · كل زر بنص.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon, type IconName } from '../../lib/ui/icons';
import { Channel } from './Channel';

type Lang = 'ar' | 'en'; type Side = 'member' | 'org';
type Step = { kind: string; title_ar: string; why_ar: string; target: any; proposed_by: Side; proposed_at: string; accepted_at: string | null; rework: number };
type Option = { kind: string; title_ar: string; why_ar: string; target: any };
type StepState = { complete: boolean; done: number; total: number; read_ar: string; last_at: string | null };
type Path = { steps: { label_ar: string; done: boolean; at: string | null; detail_ar: string | null }[]; read_ar: string; quarters: { label: string; text_ar: string }[]; complete: boolean };
type Pair = { id: string; status: string; my_side: Side; member_name_shown: string; org_name_shown: string; member_step: Step | null; org_step: Step | null; member_signed_at: string | null; org_signed_at: string | null; signed_at: string | null; review_at: string | null; accepted_at: string | null; member_review_ar: string | null; org_review_ar: string | null; member_reviewed_at: string | null; org_reviewed_at: string | null; member_decision: string | null; org_decision: string | null; partner_review_ar: string | null; code: string | null; verify_url: string | null; options: Option[] | null; my_rework_left: number; my_path: Path | null; my_state: StepState | null; partner_state: StepState | null; mirror: string | null; review_open: boolean; review_text: string | null };
type Invite = { id: string; status: string; invited_by: Side; invited_at: string; expires_at: string; why_ar: string; member_name: string; member_email: string; org_name: string };
type Past = { id: string; status: string; code: string | null; org_name: string; member_name: string; member_step: Step | null; org_step: Step | null; signed_at: string | null; reviewed_at: string | null; my_review_ar: string | null; partner_review_ar: string | null; my_decision: string | null; verify_url: string | null };
type Rules = { min_chapters: number; invite_days: number; propose_days: number; why_min: number; why_max: number; title_max: number; review_min: number; review_max: number; member_kinds_ar: Record<string, string>; org_kinds_ar: Record<string, string>; privacy: string[] };
type Elig = { ok: boolean; read_ar: string; chapters?: number; min?: number };
type MemberData = { me: { name: string; email: string }; org: { id: string; name_ar: string; charter_ok: boolean } | null; is_org_admin: boolean; eligible: Elig; org_eligible: Elig; chapters: number; pair: Pair | null; invites_in: Invite[]; invite_out: Invite | null; past: Past[]; rules: Rules };
type OrgData = { org: { id: string; name_ar: string } | null; org_eligible: Elig; can_write: boolean; me: { email: string; name: string }; pairs: Pair[]; requests_in: Invite[]; invites_out: Invite[]; past: Past[]; members: { email: string; name: string | null }[]; rules: Rules };
type Props = { side: Side; lang: Lang; token: () => Promise<string>; orgId?: string; orgName?: string };

const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'medium') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const daysUntil = (iso: string) => Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 864e5));
const KIND_ICON: Record<string, IconName> = { council: 'users', mission: 'flag', daily: 'calendar', level: 'trend', credential: 'star', seat: 'users', attestation: 'star', missions: 'flag' };
const STATUS_AR: Record<string, string> = { renewed: 'جُدّد', closed: 'طُوي', revoked: 'سُحب', expired: 'انقضى', declined: 'لم يكتمل' };

export function OrgPair({ side, lang, token, orgId, orgName }: Props) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState('');
  const [why, setWhy] = useState(''); const [nameMode, setNameMode] = useState<'full' | 'first' | 'anon'>('first'); const [memberEmail, setMemberEmail] = useState(''); const [open, setOpen] = useState<string>('');
  const tokenRef = useRef(token); tokenRef.current = token;
  const url = side === 'org' ? `/api/org/pair?org=${encodeURIComponent(orgId || '')}` : '/api/org/pair';
  const load = useCallback(async () => { try { const t = await tokenRef.current(); if (!t) { setErr('سجّل الدخول'); return; } const j = await fetch(url, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()); if (j?.success) { setD(j); setErr(''); } else setErr(j?.error || 'تعذّر فتح العهد'); } catch { setErr('انقطع الاتصال'); } }, [url]);
  useEffect(() => { setD(null); load(); }, [load]);
  const act = useCallback(async (body: any): Promise<any> => { setBusy(body.action); setErr(''); const t = await tokenRef.current(); const j = await fetch('/api/org/pair', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` }, body: JSON.stringify({ as: side, ...(side === 'org' ? { org: orgId } : {}), ...body }) }).then(r => r.json()).catch(() => ({ success: false, error: 'انقطع الاتصال' })); setBusy(''); if (j.success) { if (j.message) setMsg(j.message); await load(); } else setErr(j.error || 'تعذّر'); return j; }, [side, orgId, load]);
  const rules: Rules | undefined = d?.rules; const whyOk = !!rules && why.trim().length >= rules.why_min && why.trim().length <= rules.why_max;

  const inviteCard = (inv: Invite, incoming: boolean) => (
    <article key={inv.id} className={`op-invite ${incoming ? 'in' : 'out'}`} data-testid={incoming ? 'op-invite-in' : 'op-invite-out'}>
      <div className="op-sechead"><h3><Icon name={incoming ? 'inbox' : 'send'} size={15} /> {incoming ? (side === 'member' ? `${inv.org_name} تدعوك إلى عهد: خطوة منك وخطوة منها` : `${inv.member_name} يطلب من الجهة عهدًا لسنة`) : (side === 'member' ? `طلبك إلى ${inv.org_name} قائم` : `دعوة الجهة إلى ${inv.member_name} قائمة`)}</h3><span className="op-pill">تنقضي {fmt(inv.expires_at)}</span></div>
      <blockquote className="op-quote">«{inv.why_ar}»<small>{incoming ? 'لماذا — بكلماته' : 'ما كُتب'} · {fmt(inv.invited_at)}</small></blockquote>
      {incoming ? (<>
        {side === 'member' && !d.eligible.ok ? <p className="op-warn" role="status">{d.eligible.read_ar}</p> : side === 'org' && !d.org_eligible.ok ? <p className="op-warn" role="status">{d.org_eligible.read_ar}</p> : (<>
          {side === 'member' && <label className="op-lbl">اسمي في الوثيقة <select className="op-in" value={nameMode} onChange={e => setNameMode(e.target.value as any)} data-testid="op-namemode"><option value="first">الاسم الأول</option><option value="full">الاسم الكامل</option><option value="anon">«ممارس» بلا اسم</option></select></label>}
          <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || (side === 'org' && !d.can_write)} data-testid="op-accept" onClick={() => { if (confirm(side === 'member' ? `تقبل دعوة ${inv.org_name} إلى عهد لسنة؟ بعدها تقترح لها خطوة وتقترح لك خطوة خلال ${rules!.propose_days} يومًا.` : `تقبلون طلب ${inv.member_name}؟ بعدها تقترحون له خطوة ويقترح لكم خطوة خلال ${rules!.propose_days} يومًا.`)) act({ action: 'accept', id: inv.id, name_mode: nameMode, confirm: true }); }}><Icon name="check" size={14} /> {side === 'member' ? 'أقبل' : 'نقبل'}</button>
            <button type="button" className="pt-btn ghost" disabled={!!busy || (side === 'org' && !d.can_write)} data-testid="op-decline" onClick={() => { if (confirm('الرفض بلا تعليل — لن يُسأل أحد. متأكد؟')) act({ action: 'decline', id: inv.id, confirm: true }); }}>{side === 'member' ? 'أرفض — بلا تعليل' : 'نعتذر — بلا تعليل'}</button></div></>)}
      </>) : (<div className="op-rowbtns"><button type="button" className="pt-btn ghost small" disabled={!!busy || (side === 'org' && !d.can_write)} data-testid="op-cancel" onClick={() => { if (confirm('السحب بصمت؟')) act({ action: 'cancel', id: inv.id, confirm: true }); }}>{side === 'member' ? 'أسحب طلبي' : 'نسحب الدعوة'}</button></div>)}
    </article>);

  return (
    <section className="op" dir="rtl" data-testid={`op-${side}`}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="op-head"><span className="op-kicker"><Icon name="school" size={14} /> عهد الممارس وجهته</span>
        <h2>{side === 'member' ? 'مع جهتي' : 'عهود الجهة مع منسوبيها'}<small> — خطوة مني وخطوة من جهتي</small></h2>
        <p>{side === 'member' ? 'جهتك تطلب منك خطوة واحدة لسنة من خطوات تشهدها المنصة، وأنت تطلب منها خطوة واحدة تجاهك تشهدها المنصة أيضًا: مقعد في مجلس، اعتماد مستواك، اعتماد شهادة قرينك، أو تأكيد مهامك في مهلتها. توقيعان — أنت باسمك ومديرك بصفته — ووثيقة واحدة.' : 'منسوب يطلب من الجهة، أو الجهة تدعو منسوبًا: خطوة تطلبونها منه من خطوات تشهدها المنصة، وخطوة يطلبها منكم تجاهه تشهدها المنصة أيضًا. توقّعون بصفتكم لا بأسمائكم؛ وترون من درب المنسوب حالة خطوته فقط — لا أحداثه.'}</p></header>
      {err && <div className="op-err" role="alert">{err} <button type="button" className="op-x" aria-label="إغلاق الرسالة" onClick={() => setErr('')}>×</button></div>}
      {msg && <div className="op-ok" role="status">{msg} <button type="button" className="op-x" aria-label="إغلاق الرسالة" onClick={() => setMsg('')}>×</button></div>}
      {!d && !err && <p className="op-muted">نقرأ العهد…</p>}

      {/* ───── زاوية المنسوب ───── */}
      {d && side === 'member' && (() => { const m = d as MemberData; const p = m.pair; return (<>
        {!m.org ? (<div className="op-empty" data-testid="op-noorg"><Icon name="school" size={26} /><b>لست منسوبًا مؤكَّدًا في جهة بعد</b><p className="op-muted">حين تؤكّد جهتك عضويتك تنفتح هنا دعوتها إليك وطلبك إليها. <Link href="/me">عضويتي</Link></p></div>)
        : m.is_org_admin && !p && !m.invite_out && !m.invites_in.length ? (<div className="op-empty" data-testid="op-admin"><Icon name="school" size={26} /><b>أنت مدير {m.org.name_ar}</b><p className="op-muted">عهود الجهة مع منسوبيها تُدار من <Link href={`/org?tab=horizon&org=${m.org.id}`}>أفق الجهة</Link>. ولو أردت عهدًا لنفسك مع الجهة فيوقّعه عنها مدير غيرك.</p></div>)
        : (<>
          {m.invites_in.filter(() => !p).map(inv => inviteCard(inv, true))}
          {!p && !m.invites_in.length && (
            <div className="pt-box op-sec" data-testid="op-request">
              <div className="op-sechead"><h3><Icon name="send" size={15} /> أطلب من {m.org.name_ar} عهدًا</h3><span className="op-pill" data-testid="op-chapters">{m.eligible.ok ? `${m.chapters} فصول في رحلتك` : `${m.eligible.chapters} من ${m.eligible.min} فصول`}</span></div>
              {!m.eligible.ok ? (<div className="op-empty" data-testid="op-elig"><b>العهد مع الجهة يُقطع بعد {m.eligible.min} فصول</b><p className="op-muted">{m.eligible.read_ar}</p><p className="op-dots" aria-label={`${m.eligible.chapters} من ${m.eligible.min} فصول`}>{Array.from({ length: m.eligible.min || 3 }, (_, i) => <i key={i} className={i < (m.eligible.chapters || 0) ? 'on' : ''} aria-hidden />)} <span>{m.eligible.chapters} / {m.eligible.min}</span></p><p className="op-muted">الطرق الأسرع إلى فصل في <Link href="/me/pair">أعلى هذه الصفحة</Link> · كل فصل يظهر في <Link href="/me/journey">رحلتي</Link>.</p></div>)
              : !m.org_eligible.ok ? (<div className="op-empty" data-testid="op-charter"><b>{m.org.name_ar} لم توقّع ميثاقها بعد</b><p className="op-muted">{m.org_eligible.read_ar} العهد مع الجهة يحتاج ميثاقًا موقَّعًا حتى يكون لها من يوقّع بصفته. حين يوقَّع تنفتح هنا دعوتك تلقائيًا.</p></div>)
              : m.invite_out ? inviteCard(m.invite_out, false)
              : (<>
                <p className="op-muted">يصل طلبك إلى مديري الجهة. إن قبلوا خلال {m.rules.invite_days} يومًا بدأ الاقتراح، وإلا انقضى بصمت. اكتب لهم لماذا تريد هذا العهد — لا يراه غيركم.</p>
                <label className="op-lbl" htmlFor="op-why">لماذا؟ — بكلماتك ({why.trim().length}/{m.rules.why_max})</label>
                <Channel lang={lang} value={why} onChange={setWhy} context={{ type: 'free', id: 'org_pair_request', title: 'لماذا' }} placeholder="ما الذي تريده من جهتك هذه السنة، وما الذي تعطيه؟" rows={3} maxLength={m.rules.why_max} testId="op-why" />
                <label className="op-lbl">اسمي في الوثيقة <select className="op-in" value={nameMode} onChange={e => setNameMode(e.target.value as any)}><option value="first">الاسم الأول</option><option value="full">الاسم الكامل</option><option value="anon">«ممارس» بلا اسم</option></select></label>
                <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !whyOk} data-testid="op-send" onClick={() => act({ action: 'request', why_ar: why.trim(), name_mode: nameMode }).then(j => { if (j?.success) setWhy(''); })}><Icon name="send" size={14} /> أطلب العهد من جهتي</button></div></>)}
            </div>)}
          {p && <PairCard p={p} side="member" rules={m.rules} busy={busy} act={act} lang={lang} canWrite />}
        </>)}
        {m.past.length > 0 && <PastList past={m.past} side="member" />}
        {m.org && <ul className="op-privacy">{m.rules.privacy.map(t => <li key={t}><Icon name="shield" size={12} /> {t}</li>)}</ul>}
      </>); })()}

      {/* ───── زاوية الجهة ───── */}
      {d && side === 'org' && (() => { const o = d as OrgData; const can = o.can_write; return (<>
        {!o.org_eligible.ok && <p className="op-warn" role="status" data-testid="op-charter">{o.org_eligible.read_ar} — العهد مع المنسوبين يحتاج <Link href={`/org?tab=charter&org=${orgId}`}>ميثاقًا موقَّعًا</Link>.</p>}
        {!can && <p className="op-muted" data-testid="op-readonly">الطاقم يقرأ عهود الجهة ولا يوقّع عنها.</p>}
        {o.requests_in.map(inv => inviteCard(inv, true))}
        {o.invites_out.map(inv => inviteCard(inv, false))}
        {o.pairs.map(p => <PairCard key={p.id} p={p} side="org" rules={o.rules} busy={busy} act={act} lang={lang} canWrite={can} collapsed={open !== p.id && o.pairs.length > 1} onToggle={() => setOpen(open === p.id ? '' : p.id)} />)}
        {can && o.org_eligible.ok && (
          <div className="pt-box op-sec" data-testid="op-invite">
            <div className="op-sechead"><h3><Icon name="send" size={15} /> ندعو منسوبًا إلى عهد</h3><span className="op-pill">{o.members.length} منسوبًا يمكن دعوته</span></div>
            <p className="op-muted">الدعوة تصل إلى المنسوب باسم الجهة. إن سمحت رحلته ({o.rules.min_chapters} فصول) وصلكم ردّه خلال {o.rules.invite_days} يومًا — وإلا انقضت بصمت؛ لا تكشف الدعوة شيئًا عن رحلته.</p>
            <label className="op-lbl" htmlFor="op-member">المنسوب</label>
            <select id="op-member" className="op-in" value={memberEmail} onChange={e => setMemberEmail(e.target.value)} data-testid="op-member"><option value="">— اختر منسوبًا مؤكَّدًا —</option>{o.members.map(mm => <option key={mm.email} value={mm.email}>{mm.name ? `${mm.name} — ` : ''}{mm.email}</option>)}</select>
            <label className="op-lbl">لماذا هذا المنسوب؟ — باسم الجهة ({why.trim().length}/{o.rules.why_max})</label>
            <Channel lang={lang} value={why} onChange={setWhy} context={{ type: 'free', id: 'org_pair_invite', title: 'لماذا' }} placeholder="ما الذي رأته الجهة فيه، وما الذي تريد أن تعطيه هذه السنة؟ — لا يراه غيركما." rows={3} maxLength={o.rules.why_max} testId="op-why" />
            <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !whyOk || !memberEmail} data-testid="op-send" onClick={() => act({ action: 'invite', member_email: memberEmail, why_ar: why.trim() }).then(j => { if (j?.success) { setWhy(''); setMemberEmail(''); } })}><Icon name="send" size={14} /> ندعوه باسم الجهة</button></div>
          </div>)}
        {o.past.length > 0 && <PastList past={o.past} side="org" />}
        <ul className="op-privacy">{o.rules.privacy.map(t => <li key={t}><Icon name="shield" size={12} /> {t}</li>)}</ul>
      </>); })()}
    </section>
  );
}

function PairCard({ p, side, rules, busy, act, lang, canWrite, collapsed, onToggle }: { p: Pair; side: Side; rules: Rules; busy: string; act: (b: any) => Promise<any>; lang: Lang; canWrite: boolean; collapsed?: boolean; onToggle?: () => void }) {
  const [pick, setPick] = useState(-1); const [ptitle, setPtitle] = useState(''); const [pwhy, setPwhy] = useState(''); const [stitle, setStitle] = useState(''); const [review, setReview] = useState('');
  const mine = p.member_step; const ask = p.org_step; // العمود «ask» = خطوة الجهة دائمًا، و«mine» = خطوة المنسوب دائمًا — بأي زاوية
  const mySigned = !!(side === 'member' ? p.member_signed_at : p.org_signed_at); const ptSigned = !!(side === 'member' ? p.org_signed_at : p.member_signed_at);
  const myReviewed = !!(side === 'member' ? p.member_reviewed_at : p.org_reviewed_at); const myReview = side === 'member' ? p.member_review_ar : p.org_review_ar; const myDecision = side === 'member' ? p.member_decision : p.org_decision;
  const partner = side === 'member' ? p.org_name_shown : p.member_name_shown; const meName = side === 'member' ? 'أنا' : 'الجهة';
  const mineKinds = rules.member_kinds_ar; const askKinds = rules.org_kinds_ar;
  const pwhyOk = pwhy.trim().length >= rules.why_min && pwhy.trim().length <= rules.why_max; const revOk = review.trim().length >= rules.review_min && review.trim().length <= rules.review_max;
  const id = (s: string) => ({ action: s, id: p.id });
  const head = <div className="op-sechead"><h3><Icon name="target" size={15} /> {side === 'member' ? `عهدي مع ${partner}` : `عهد الجهة مع ${partner}`}</h3><span className="op-pill">{p.status === 'proposing' ? `اقتراح وتوقيع · ${p.accepted_at ? `${daysUntil(new Date(new Date(p.accepted_at).getTime() + rules.propose_days * 864e5).toISOString())} يومًا` : ''}` : p.status === 'review' || p.review_open ? 'المراجعة المشتركة' : `حيّ حتى ${fmt(p.review_at)}`}{p.code ? <span dir="ltr"> · {p.code}</span> : null}</span>{onToggle && <button type="button" className="pt-btn ghost small" aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? 'افتح' : 'اطوِ'}</button>}</div>;
  if (collapsed) return <article className="pt-box op-sec" data-testid="op-pair">{head}</article>;
  return (
    <article className={`pt-box op-sec ${p.review_open ? 'op-review' : ''}`} data-testid="op-pair" data-status={p.status}>{head}
      {p.status === 'proposing' && (
        <div className="op-two">
          <div className="op-col" data-testid="op-ask"><h4>{side === 'member' ? `ما أطلبه من ${partner}` : `ما يطلبه ${partner} من الجهة`}{side === 'org' ? '' : ''}</h4>
            {ask ? (<><div className="op-stepcard"><span className="op-kind"><Icon name={KIND_ICON[ask.kind] || 'flag'} size={13} /> {askKinds[ask.kind] || ask.kind}</span><b>«{ask.title_ar}»</b><small>{ask.why_ar}</small></div>
              {side === 'member' ? <p className="op-muted">{ptSigned ? <><Icon name="check" size={12} /> وقّع مدير {partner} بصفته.</> : `ننتظر توقيع ${partner} — أو طلبها غيرها (مرة واحدة).`}</p>
              : mySigned ? <p className="op-muted"><Icon name="check" size={12} /> وقّعت الجهة بصفتها.</p> : (<>
                <label className="op-lbl">صياغة الجهة لما تلتزم به (اختياري)<input className="op-in" value={stitle} onChange={e => setStitle(e.target.value)} maxLength={rules.title_max} placeholder={ask.title_ar} data-testid="op-sign-title" /></label>
                <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !canWrite} data-testid="op-sign" onClick={() => { if (confirm(`توقّعون بصفتكم أن الجهة تلتزم تجاه ${partner} لسنة: «${stitle.trim() || ask.title_ar}»؟`)) act({ ...id('sign'), title_ar: stitle.trim() || undefined, confirm: true }); }}><Icon name="check" size={14} /> نوقّع بصفتنا</button>
                  {p.my_rework_left > 0 && <button type="button" className="pt-btn ghost" disabled={!!busy || !canWrite} data-testid="op-rework" onClick={() => { if (confirm('تطلبون منه خطوة غيرها؟ مرة واحدة فقط.')) act({ ...id('rework'), confirm: true }); }}>اطلب منا غيرها</button>}</div></>)}
            </>) : (side !== 'member' || !p.options?.length) ? (<>{side === 'member' ? <p className="op-muted">المنصة تقترح ثلاث خطوات يمكن أن تشهدها من الجهة تجاهك — وأنت تختار وتكتب لماذا.</p> : <p className="op-muted">ننتظر ما يطلبه {partner} من الجهة.</p>}{side === 'member' && <button type="button" className="pt-btn" disabled={!!busy} data-testid="op-suggest" onClick={() => act(id('suggest'))}><Icon name="compass" size={14} /> اقترح لي ماذا أطلب</button>}</>)
            : (<>
              <div className="op-opts" role="radiogroup" aria-label="خيارات الخطوة">{p.options.map((o, i) => <label key={i} className={`op-opt ${pick === i ? 'on' : ''}`}><input type="radio" name={`op-opt-${p.id}`} checked={pick === i} onChange={() => { setPick(i); setPtitle(o.title_ar); }} data-testid={`op-opt-${i}`} /><b>{o.title_ar}</b><small>{(side === 'member' ? rules.org_kinds_ar : rules.member_kinds_ar)[o.kind] || o.kind} · {o.why_ar}</small></label>)}</div>
              {pick >= 0 && (<><label className="op-lbl">بصياغتك (اختياري)<input className="op-in" value={ptitle} onChange={e => setPtitle(e.target.value)} maxLength={rules.title_max} data-testid="op-ptitle" /></label>
                <label className="op-lbl">لماذا هذه الخطوة؟ ({pwhy.trim().length}/{rules.why_max})</label>
                <Channel lang={lang} value={pwhy} onChange={setPwhy} context={{ type: 'free', id: 'org_pair_propose', title: 'لماذا' }} placeholder="لا يراه غيركما." rows={3} maxLength={rules.why_max} testId="op-pwhy" />
                <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !pwhyOk || !canWrite} data-testid="op-propose" onClick={() => act({ ...id('propose'), index: pick, title_ar: ptitle.trim() || undefined, why_ar: pwhy.trim() }).then(j => { if (j?.success) { setPick(-1); setPwhy(''); } })}><Icon name="send" size={14} /> {side === 'member' ? 'أطلبها من جهتي' : 'نطلبها منه'}</button></div></>)}
            </>)}
          </div>
          <div className="op-col" data-testid="op-mine"><h4>{side === 'member' ? `ما تطلبه ${partner} مني` : `ما تطلبه الجهة من ${partner}`}</h4>
            {mine ? (<><div className="op-stepcard mine"><span className="op-kind"><Icon name={KIND_ICON[mine.kind] || 'flag'} size={13} /> {mineKinds[mine.kind] || mine.kind}</span><b>«{mine.title_ar}»</b><small>{mine.why_ar}</small></div>
              {side === 'org' ? <p className="op-muted">{ptSigned ? <><Icon name="check" size={12} /> وقّع {partner}.</> : `ننتظر توقيع ${partner} — أو طلبه غيرها (مرة واحدة).`}</p>
              : mySigned ? <p className="op-muted"><Icon name="check" size={12} /> وقّعتَ. {ptSigned ? '' : `ننتظر توقيع مدير ${partner} بصفته.`}</p> : (<>
                <label className="op-lbl">بصياغتي (اختياري)<input className="op-in" value={stitle} onChange={e => setStitle(e.target.value)} maxLength={rules.title_max} placeholder={mine.title_ar} data-testid="op-sign-title" /></label>
                <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy} data-testid="op-sign" onClick={() => { if (confirm(`توقّع باسمك أنك تلتزم لسنة: «${stitle.trim() || mine.title_ar}»؟`)) act({ ...id('sign'), title_ar: stitle.trim() || undefined, confirm: true }); }}><Icon name="check" size={14} /> أوقّع على خطوتي</button>
                  {p.my_rework_left > 0 && <button type="button" className="pt-btn ghost" disabled={!!busy} data-testid="op-rework" onClick={() => { if (confirm('تطلب من جهتك خطوة غيرها؟ مرة واحدة فقط.')) act({ ...id('rework'), confirm: true }); }}>اطلب مني غيرها</button>}</div></>)}
            </>) : (side !== 'org' || !p.options?.length) ? (<>{side === 'org' ? <p className="op-muted">المنصة تقترح من فصول {partner} ثلاث خطوات تشهدها هي — والجهة تختار وتكتب لماذا. لا تُطلب خطوة لا تشهدها المنصة.</p> : <p className="op-muted">ننتظر ما تطلبه {partner} منك.</p>}{side === 'org' && <button type="button" className="pt-btn" disabled={!!busy || !canWrite} data-testid="op-suggest" onClick={() => act(id('suggest'))}><Icon name="compass" size={14} /> اقترح لنا خطوة له</button>}</>)
            : (<>
              <div className="op-opts" role="radiogroup" aria-label="خيارات الخطوة">{p.options.map((o, i) => <label key={i} className={`op-opt ${pick === i ? 'on' : ''}`}><input type="radio" name={`op-opt-${p.id}`} checked={pick === i} onChange={() => { setPick(i); setPtitle(o.title_ar); }} data-testid={`op-opt-${i}`} /><b>{o.title_ar}</b><small>{rules.member_kinds_ar[o.kind] || o.kind} · {o.why_ar}</small></label>)}</div>
              {pick >= 0 && (<><label className="op-lbl">بصياغة الجهة (اختياري)<input className="op-in" value={ptitle} onChange={e => setPtitle(e.target.value)} maxLength={rules.title_max} data-testid="op-ptitle" /></label>
                <label className="op-lbl">لماذا هذه الخطوة؟ ({pwhy.trim().length}/{rules.why_max})</label>
                <Channel lang={lang} value={pwhy} onChange={setPwhy} context={{ type: 'free', id: 'org_pair_propose', title: 'لماذا' }} placeholder="لا يراه غيركما." rows={3} maxLength={rules.why_max} testId="op-pwhy" />
                <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !pwhyOk || !canWrite} data-testid="op-propose" onClick={() => act({ ...id('propose'), index: pick, title_ar: ptitle.trim() || undefined, why_ar: pwhy.trim() }).then(j => { if (j?.success) { setPick(-1); setPwhy(''); } })}><Icon name="send" size={14} /> نطلبها منه</button></div></>)}
            </>)}
          </div>
        </div>)}
      {p.status === 'proposing' && <div className="op-rowbtns"><button type="button" className="pt-btn ghost small" disabled={!!busy || !canWrite} data-testid="op-withdraw" onClick={() => { if (confirm('سحب العهد قبل اكتماله؟ لا تعليل مطلوب.')) act({ ...id('revoke'), confirm: true }); }}>{side === 'member' ? 'أنسحب بصمت' : 'نسحب بصمت'}</button></div>}

      {(p.status === 'active' || p.status === 'review') && mine && ask && (<>
        <div className="op-pledge" data-testid="op-pledge">
          <div className="op-pledgehead"><span>{fmt(p.signed_at, 'long')}</span><span>المراجعة المشتركة {fmt(p.review_at, 'long')}</span></div>
          <div className="op-two"><div><small>{side === 'member' ? `طلبت مني ${partner}` : `طلبت الجهة من ${partner}`}</small><h4>«{p.member_step!.title_ar}»</h4></div><div><small>{side === 'member' ? `وطلبتُ منها` : `وطلب منها`}</small><h4>«{p.org_step!.title_ar}»</h4></div></div>
          <p>وثيقة واحدة بتوقيعين — {p.member_name_shown} باسمه و{p.org_name_shown} بصفة مديرها. {p.verify_url && <a className="op-verify" href={p.verify_url} target="_blank" rel="noreferrer"><Icon name="shield" size={12} /> تحقّق</a>}</p>
        </div>
        {!p.review_open && (<>
          <div className="op-two">
            <div className="op-col"><h4>{side === 'member' ? 'دربي' : 'درب الجهة'} — {side === 'member' ? (mineKinds[mine.kind] || mine.kind) : (askKinds[ask.kind] || ask.kind)}</h4>
              {p.my_path ? (<><p className="op-read" data-testid="op-mypath">{p.my_path.read_ar}</p><ol className="op-steps">{p.my_path.steps.map((s, i) => <li key={i} className={s.done ? 'done' : ''}><span aria-hidden>{s.done ? '✓' : '○'}</span><div><b>{s.label_ar}</b>{s.detail_ar && <small>{s.detail_ar}</small>}{s.at && <small> · {fmt(s.at)}</small>}<span className="op-sr">{s.done ? ' (تمّت)' : ' (لم تتم بعد)'}</span></div></li>)}</ol></>) : <p className="op-muted">الدرب يُقرأ من أحداث مسجّلة بعد التوقيع.</p>}</div>
            <div className="op-col"><h4>خطوة {partner} — {side === 'member' ? (askKinds[ask.kind] || ask.kind) : (mineKinds[mine.kind] || mine.kind)}</h4>
              <div className={`op-ptstate ${p.partner_state?.complete ? 'done' : ''}`} data-testid="op-ptstate"><Icon name={p.partner_state?.complete ? 'check' : 'clock'} size={22} /><b>{p.partner_state?.complete ? 'وقعت' : 'لم تقع بعد'}</b>{p.partner_state?.read_ar && !['وقعت', 'لم تقع بعد'].includes(p.partner_state.read_ar.replace(/[.。]$/, '')) && <small>{p.partner_state.read_ar}</small>}<small>{side === 'member' ? 'ترى حالة خطوة الجهة فقط — لا تفاصيلها.' : 'ترون حالة خطوة المنسوب فقط — لا أحداثه.'}</small></div></div>
          </div>
          {p.mirror && <p className="op-read op-mirror" data-testid="op-mirror"><Icon name="compass" size={13} /> {p.mirror}</p>}
          <div className="op-rowbtns"><button type="button" className="pt-btn ghost small" disabled={!!busy || !canWrite} data-testid="op-revoke" onClick={() => { if (confirm('سحب العهد يسحب الوثيقة. لا تعليل مطلوب. متأكد؟')) act({ ...id('revoke'), confirm: true }); }}>{side === 'member' ? 'أسحب العهد' : 'نسحب العهد'}</button></div>
        </>)}
        {p.review_open && (<div data-testid="op-reviewbox">
          <h4 className="op-h4"><Icon name="book" size={15} /> ما وعدنا بعضَنا / ما وقع</h4>
          {p.review_text && <p className="op-read">{p.review_text}</p>}
          {!myReviewed ? (<>
            <label className="op-lbl">{side === 'member' ? 'ما تغيّر فيّ بسبب جهتي' : `ما تغيّر في الجهة بسبب ${partner}`} ({review.trim().length}/{rules.review_max})</label>
            <Channel lang={lang} value={review} onChange={setReview} context={{ type: 'free', id: 'org_pair_review', title: 'المراجعة' }} placeholder="بكلماتك — يُفتح للطرف الآخر حين يكتب هو." rows={5} maxLength={rules.review_max} testId="op-reviewtext" />
            <div className="op-rowbtns"><button type="button" className="pt-btn gold" disabled={!!busy || !revOk || !canWrite} data-testid="op-renew" onClick={() => { if (confirm('تُحفظ كلماتك وقرارك «نجدّد». تجدّدان فقط إن قرّر الطرفان ذلك.')) act({ ...id('review'), note_ar: review.trim(), decision: 'renew', confirm: true }); }}>نجدّد عهدًا جديدًا</button>
              <button type="button" className="pt-btn" disabled={!!busy || !revOk || !canWrite} data-testid="op-close" onClick={() => { if (confirm('تُحفظ كلماتك وقرارك «نطوي». الطيّ ليس فشلًا.')) act({ ...id('review'), note_ar: review.trim(), decision: 'close', confirm: true }); }}>نطوي هذا بسلام</button></div></>)
          : (<><blockquote className="op-quote">{myReview}<small>{meName === 'أنا' ? 'كلماتي' : 'كلمات الجهة'} · {myDecision === 'renew' ? 'القرار: نجدّد' : 'القرار: نطوي'}</small></blockquote>
            {p.partner_review_ar ? <blockquote className="op-quote partner" data-testid="op-partner-review">{p.partner_review_ar}<small>كلمات {partner}</small></blockquote> : <p className="op-muted">كلمات {partner} تُفتح حين تُكتب — كما تُفتح كلماتك.</p>}</>)}
        </div>)}
      </>)}
    </article>);
}

function PastList({ past, side }: { past: Past[]; side: Side }) {
  return (<div className="pt-box op-sec" data-testid="op-past"><div className="op-sechead"><h3><Icon name="folder" size={15} /> {side === 'member' ? 'عهودي السابقة مع جهتي' : 'عهود الجهة السابقة'}</h3></div>
    {past.map(x => (<div key={x.id} className="op-pastrow"><b>{side === 'member' ? `مع ${x.org_name}` : `مع ${x.member_name}`}</b> <span className="op-pill">{STATUS_AR[x.status] || x.status}</span> {x.code && <span dir="ltr" className="op-muted">{x.code}</span>}
      {x.member_step && x.org_step && <p>«{x.member_step.title_ar}» ↔ «{x.org_step.title_ar}»{x.signed_at ? ` · ${fmt(x.signed_at)}` : ''}</p>}
      {x.my_review_ar && <blockquote className="op-quote">{x.my_review_ar}<small>{side === 'member' ? 'كلماتي' : 'كلمات الجهة'}</small></blockquote>}{x.partner_review_ar && <blockquote className="op-quote partner">{x.partner_review_ar}<small>كلمات {side === 'member' ? x.org_name : x.member_name}</small></blockquote>}
      {x.verify_url && <a href={x.verify_url} target="_blank" rel="noreferrer" className="op-link">الوثيقة</a>}</div>))}
  </div>);
}

const CSS = `
.op{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;margin:18px 0 0}
.op :is(button,a,input,select,textarea):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px;border-radius:8px}
.op-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#0b6f69;background:#e6f7f5;border-radius:999px;padding:3px 10px}
.op-head h2{margin:6px 0 4px;font-size:24px;color:#0f2a4e}.op-head h2 small{font-size:14px;color:#0b6f69;font-weight:800}.op-head p{margin:0 0 12px;color:#334155;line-height:1.9;font-size:14px}
.op-muted{color:#475569;font-size:13px;line-height:1.8}.op-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.op-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800;display:flex;justify-content:space-between;gap:8px;align-items:center}.op-ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;border-radius:12px;padding:10px 14px;margin:10px 0;font-weight:800;display:flex;justify-content:space-between;gap:8px;align-items:center}
.op-x{all:unset;cursor:pointer;font-size:18px;line-height:1;padding:2px 8px;border-radius:8px;color:inherit}.op-x:hover{background:rgba(0,0,0,.06)}
.op-warn{background:#fffbeb;border:1px solid #f59e0b;border-radius:12px;padding:8px 12px;color:#78350f;font-size:13px;line-height:1.8}
.op-sec{margin:12px 0}.op-sec h3,.op-invite h3{margin:0;font-size:17px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}.op-sechead{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:8px;flex-wrap:wrap}
.op-pill{background:#e2e8f0;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800;color:#0f2a4e;display:inline-flex;gap:5px;align-items:center}
.op-invite{border:1px solid #cbd5e1;border-radius:18px;padding:14px 16px;margin:10px 0;background:#fff}.op-invite.in{border-color:#0f2a4e;box-shadow:inset 4px 0 0 #c9a24b}
.op-empty{text-align:center;color:#334155;padding:16px 8px}.op-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:16px}.op-dots{display:flex;gap:8px;justify-content:center;align-items:center;margin:10px 0;font-weight:900;color:#0f2a4e}.op-dots i{width:14px;height:14px;border-radius:50%;background:#e2e8f0;border:2px solid #94a3b8}.op-dots i.on{background:#0b8a83;border-color:#0b6f69}
.op-two{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:10px 0}.op-col{border:1px solid #cbd5e1;border-radius:16px;padding:12px 14px;background:#fff}.op-col h4{margin:0 0 8px;font-size:14px;color:#0b6f69}
.op-stepcard{display:grid;gap:4px;border-inline-start:4px solid #c9a24b;background:#fffdf7;border-radius:0 12px 12px 0;padding:10px 14px}.op-stepcard.mine{border-color:#0b8a83;background:#f0fdfa}.op-stepcard b{color:#0f2a4e;font-size:15px;line-height:1.7}.op-stepcard small{color:#334155;line-height:1.7}.op-kind{font-size:12px;color:#0b6f69;font-weight:800;display:inline-flex;gap:5px;align-items:center}
.op-rowbtns{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.op-in{width:100%;box-sizing:border-box;font:inherit;border:1px solid #94a3b8;border-radius:12px;padding:10px 12px;margin:6px 0;background:#fff;color:#0f172a}.op-lbl{display:block;font-size:13px;font-weight:800;color:#1e293b;margin:10px 0}
.op-opts{display:grid;gap:8px;margin:8px 0}.op-opt{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;border:1px solid #cbd5e1;border-radius:14px;padding:10px 12px;cursor:pointer;background:#fff}.op-opt.on{border-color:#0f2a4e;box-shadow:0 0 0 3px #c7d2fe}.op-opt input{grid-row:span 2;align-self:center}.op-opt b{color:#0f2a4e;font-size:14px;line-height:1.7}.op-opt small{color:#334155}
.op-pledge{background:linear-gradient(135deg,#0f2a4e,#0b6f69);color:#fff;border-radius:18px;padding:18px;margin:10px 0}.op-pledgehead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#e2e8f0}.op-pledge h4{margin:4px 0;font-size:17px;line-height:1.6;color:#fff}.op-pledge small{color:#e2e8f0;font-size:12px}.op-pledge p{margin:6px 0 0;color:#f1f5f9;font-size:13px}.op-pledge .op-two{gap:10px}.op-pledge .op-two>div{background:rgba(255,255,255,.1);border-radius:14px;padding:10px 14px}
.op-verify{display:inline-flex;gap:5px;align-items:center;color:#fff;font-weight:800;background:rgba(255,255,255,.18);border-radius:999px;padding:5px 12px;font-size:13px;text-decoration:underline}
.op-read{line-height:1.95;color:#1e293b;font-size:14px;background:#f8fafc;border-radius:12px;padding:10px 14px;margin:6px 0}.op-mirror{display:flex;gap:8px;align-items:flex-start}
.op-steps{list-style:none;margin:6px 0;padding:0;display:grid;gap:8px}.op-steps li{display:flex;gap:10px;align-items:flex-start;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;color:#475569;position:relative}.op-steps li.done{border-color:#6ee7b7;background:#ecfdf5;color:#065f46}.op-steps b{display:block;color:inherit}.op-steps small{color:#475569}
.op-ptstate{display:grid;justify-items:center;text-align:center;gap:6px;padding:22px 12px;border:1px dashed #94a3b8;border-radius:14px;color:#475569}.op-ptstate.done{border-color:#6ee7b7;background:#ecfdf5;color:#065f46}.op-ptstate b{font-size:16px}.op-ptstate small{font-size:12px;line-height:1.6}
.op-review{background:linear-gradient(135deg,#fffbeb,#fff)}.op-h4{margin:10px 0 6px;font-size:15px;color:#0f2a4e;display:inline-flex;gap:8px;align-items:center}
.op-pastrow{border-top:1px solid #e2e8f0;padding:10px 0}.op-pastrow b{color:#0f2a4e}.op-pastrow p{margin:4px 0;color:#334155}.op-link{color:#0f2a4e;text-decoration:underline;font-size:13px}
.op-quote{margin:8px 0 0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.8;font-size:14px;color:#1e293b}.op-quote.partner{border-color:#0b8a83;background:#f0fdfa}.op-quote small{display:block;color:#475569;font-size:11px;margin-top:4px}
.op-privacy{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:4px}.op-privacy li{font-size:12px;color:#334155;display:flex;gap:6px;align-items:center}
@media (max-width:700px){.op-two{grid-template-columns:1fr}}
`;
