'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air — «أَثَر معك — على الهواء» (P33): الصفحة العامة
 *  من على الهواء الآن (العدد للجميع، الأسماء بعد الدخول) · الدرجات الثلاث · النوافذ القادمة · «أسئلة أجاب عنها الهواء» · أرقام الشهر (k≥5) · كيف يعمل · الخصوصية.
 *  الإنسان هو من يردّ؛ لا ذكاء اصطناعي يتكلم باسم أحد.
 *  P36 «ذاكرة الهواء»: ساعات «بالإشارة» في الموسم (تتقدّم لمن اختار لغة الإشارة في «احتياجاتي» — ترتيب على جهازه فقط) · «أضِف الموسم إلى تقويمك» (.ics) · رابط «سجلّ المواسم» · قسم «سؤال الأسبوع» (أمانة متسلسلة) يجيب عنه من على الهواء بدوره.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { openOnAir, OnAirMap, WhenStrip } from '../components/OnAir';
import { fastToken } from '../components/Pocket';
import { supabase } from '../../lib/supabase/client';
import { GRADES, GRADE_LABEL, GRADE_HINT, QUICK_TIMEOUT_MIN, SESSION_MINUTES, SESSION_EXTEND_MINUTES, CERT_HOURS, CERT_MEETINGS, ON_AIR_MINUTES, P34_NAMES_AR, BOTTLE_AR, BOTTLE_HOURS, SHADOW_REQUESTS, P35_NAMES_AR, WHISPER_MINUTES, P37_NAMES_AR, P36_NAMES_AR, WEEK_ANSWER_MAX } from '../../lib/onair/registry';
import type { Grade } from '../../lib/onair/registry';

export default function OnAirPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    const load = async () => { const tk = await fastToken(supabase()).catch(() => ''); const r = await fetch('/api/onair?now=1', { cache: 'no-store', headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).then(x => x.json()).catch(() => null); if (!alive) return; if (r?.success) setD(r); else setErr(r?.error || 'تعذّر التحميل'); };
    load(); const id = setInterval(load, 30000); return () => { alive = false; clearInterval(id); };
  }, []);
  const present: any[] = d?.present || []; const st = d?.stats; const faq: any[] = d?.faq || []; const upcoming: any[] = d?.upcoming || []; const golden = d?.golden || null; const season = d?.season || null; const whisper = d?.whisper || null;
  const [pnote, setPnote] = useState('');
  // P36: من اختار «أتواصل بلغة الإشارة» في احتياجاته يرى ساعات الإشارة أولًا — قراءة سمة <html data-access> على جهازه، لا شيء يُرسل
  const [signFirst, setSignFirst] = useState(false);
  useEffect(() => { const read = () => { try { setSignFirst((document.documentElement.getAttribute('data-access') || '').split(/\s+/).includes('sign_language')); } catch { /* ssr */ } }; read(); let mo: MutationObserver | null = null; try { mo = new MutationObserver(read); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-access'] }); } catch { /* ignore */ } return () => { mo?.disconnect(); }; }, []);   /* السمة تُطبَّق بعد تحميل الاحتياجات — نراقبها */
  const weekq = d?.week_question || null; const [wtext, setWtext] = useState(''); const [wnote, setWnote] = useState(''); const [wbusy, setWbusy] = useState(false);
  async function answerWeek() { if (!weekq) return; setWbusy(true); setWnote(''); const tk = await fastToken(supabase()).catch(() => ''); if (!tk) { setWnote(ar ? 'سجّل الدخول أولًا' : 'Sign in first'); setWbusy(false); return; } const r = await fetch('/api/onair', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'week_answer', id: weekq.id, text: wtext }) }).then(x => x.json()).catch(() => null); setWbusy(false); setWnote(r?.note_ar || r?.error || ''); if (r?.success) { setWtext(''); setD((x: any) => x ? { ...x, week_question: { ...x.week_question, answers: [...(x.week_question.answers || []), { id: r.answer.id, role_label_ar: r.answer.role_label_ar, text_ar: r.answer.text_ar, created_at: r.answer.created_at }], n: r.n, mine: true, can_answer: false } } : x); } }
  const seasonSlots: any[] = season?.slots ? (signFirst ? [...season.slots].sort((a: any, b: any) => Number(!!b.sign_language) - Number(!!a.sign_language)) : season.slots) : [];
  async function pledge(on: boolean) { const tk = await fastToken(supabase()).catch(() => ''); if (!tk) { setPnote(ar ? 'سجّل الدخول أولًا' : 'Sign in first'); return; } const r = await fetch('/api/onair', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'pledge', on }) }).then(x => x.json()).catch(() => null); setPnote(r?.note_ar || r?.error || ''); if (r?.success) setD((x: any) => x ? { ...x, golden: { ...x.golden, ...r.golden } } : x); }
  const forGrade = (g: Grade) => present.filter(p => (p.receives || []).includes(g)).length;
  return <main className="pt-main oap" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="oap-h"><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? 'أَثَر معك' : 'Athar with you'}</span><h1>{ar ? 'على الهواء — اسأل الآن، فثمّة إنسان يسمعك' : 'On air — ask now, a human is listening'}</h1>
      <p>{ar ? 'ليس مركز اتصال ولا روبوتًا. هم أعضاء هيئة أَثَر وطاقمها، يرفعون أيديهم ساعةً أو ساعتين من يومهم ليقولوا: «أنا هنا». يختار الحاضر ما يستقبله ومجالَه، وتختار أنت الدرجة التي تحتاجها، ويدير الذكاءُ الاصطناعي الصفَّ من وراء الستار دون أن يتكلم باسم أحد.' : 'Not a call centre and not a bot. Athar Faculty members and staff raise their hands for an hour or two to say: “I am here.”'}</p>
      <p className="oap-live" data-testid="oap-live" aria-live="polite">{d ? <><span className="oap-dot" aria-hidden="true" /> <b>{d.count}</b> {ar ? 'على الهواء الآن' : 'on air now'}{st?.avg_response_min !== null && st?.avg_response_min !== undefined ? <small> · {ar ? `متوسط أول ردّ هذا الشهر ${st.avg_response_min} د` : `avg first reply this month ${st.avg_response_min} min`}</small> : null}</> : '…'}</p>
      <div className="oap-cta"><button type="button" className="pt-btn gold" onClick={() => openOnAir()} data-testid="oap-ask">{ar ? 'اسأل الآن' : 'Ask now'}</button> <Link href="/me/onair" className="pt-btn ghost">{ar ? 'أنا عضو — أريد أن أستقبل' : 'I am a member — I want to receive'}</Link></div>
      {err && <p className="oap-err" role="alert">{err}</p>}
    </header>

    <section className="pt-box"><h2>{ar ? 'ثلاث درجات — وأنت تختار' : 'Three grades — you choose'}</h2>
      <ul className="oap-grades" data-testid="oap-grades">{GRADES.map(g => <li key={g}><button type="button" className="oap-grade" onClick={() => openOnAir(g)} data-testid={`oap-grade-${g}`}><b>{GRADE_LABEL[g][lang]}</b><small>{GRADE_HINT[g][lang]}</small><span>{g === 'consult' ? (ar ? 'تصل الطاقم دائمًا' : 'always reaches staff') : ar ? `${forGrade(g)} يستقبلون الآن` : `${forGrade(g)} receiving now`}</span></button></li>)}</ul>
      <p className="pt-muted">{ar ? `«عونٌ سريع» متاح للجميع ولو بلا حساب — باسم مستعار. إن لم يردّ أحد خلال ${QUICK_TIMEOUT_MIN} دقائق نعرض عليك البدائل فورًا. «جلسة دعم» ${SESSION_MINUTES} دقيقة في غرفة أَثَر (أو عبر رابط العضو) مع ترجمة حيّة ومقعد مترجم إشارة، وتُمدَّد ${SESSION_EXTEND_MINUTES} دقائق مرة واحدة. «استشارة» تُحال إلى طلبات الاستشارة في هيئة أَثَر.` : `Quick help is open to everyone, even without an account.`}</p>
    </section>

    <section className="pt-box oap-two">
      <div><h2>{ar ? P34_NAMES_AR.map : 'Live presence map'}</h2><OnAirMap map={d?.map} lang={lang} /><p className="pt-muted">{ar ? 'المدينة من الملف العام المعتمَد في «هيئة أَثَر» — أعداد بلا أسماء. من لم يُعلن مدينة يُعدّ بلا نقطة.' : 'City from the public Faculty profile — counts only, no names.'}</p></div>
      <div><h2>{ar ? P34_NAMES_AR.golden : 'Golden Hour'}</h2>
        {!golden && <p className="pt-muted" data-testid="oap-golden-none">{ar ? 'لم يُعلن الطاقم ساعة ذهبية بعد — حين تُعلن، يتواعد فيها أعضاء الهيئة على الصعود معًا فتصبح البوابة ساعةً كاملة غرفةً مفتوحة.' : 'No Golden Hour announced yet.'}</p>}
        {golden && <div className="oap-golden" data-testid="oap-golden" data-live={golden.live ? '1' : '0'}>
          <p className="oap-gold-big">{golden.live ? (ar ? 'جارية الآن' : 'Live now') : golden.countdown_ar}</p>
          <p><b>{golden.title_ar}</b> · {golden.weekday_ar} {golden.from} · {golden.duration_min} {ar ? 'دقيقة' : 'min'}</p>
          <p className="oap-gold-n"><b data-testid="oap-golden-pledged">{golden.pledged}</b> {ar ? 'تعهّدوا بالحضور هذا الأسبوع' : 'pledged this week'}</p>
          {d?.signed_in && <p><button type="button" className={`pt-btn ${golden.mine ? 'ghost' : 'gold'} small`} onClick={() => pledge(!golden.mine)} data-testid="oap-pledge">{golden.mine ? (ar ? 'ألغِ تعهّدي' : 'Withdraw pledge') : (ar ? 'أتعهّد بالحضور' : 'I pledge to be there')}</button></p>}
          {!d?.signed_in && <p className="pt-muted"><Link href="/login?next=/on-air">{ar ? 'سجّل الدخول' : 'Sign in'}</Link> {ar ? 'لتتعهّد (لأعضاء الهيئة والطاقم)' : 'to pledge'}</p>}
          {pnote && <p className="pt-muted" role="status" data-testid="oap-pledge-note">{pnote}</p>}
        </div>}
        {!!d?.bottles && <p className="oap-bottles" data-testid="oap-bottles">🤲 <b>{d.bottles}</b> {ar ? `${BOTTLE_AR} في عهدة الهواء — تنتظر أول من يصعد` : 'entrusted questions waiting'}</p>}
      </div>
    </section>

    {d?.sign_now && <section className="pt-box oap-whisper oap-signnow" data-testid="oap-sign-now" aria-live="polite"><span className="oap-whisper-ic" aria-hidden="true">🤟</span>
      <div><h2>{ar ? `${P37_NAMES_AR.season_sign} — على الهواء الآن` : 'Season interpreter — on air now'}</h2><p>{d.sign_now.interpreter_name_ar ? <b>{d.sign_now.interpreter_name_ar} · </b> : null}{ar ? `ساعة إشارة مفتوحة جارية — تبقّى نحو ${d.sign_now.ends_in_min} دقيقة. اطلب عونًا بالإشارة من الزرّ أدناه.` : `An open sign-language hour is live — about ${d.sign_now.ends_in_min} min left.`}</p></div>
      <a href="#ask" className="pt-btn gold" data-testid="oap-sign-now-ask">{ar ? 'اطلب بالإشارة' : 'Ask in sign'}</a>
    </section>}
    {whisper && <section className="pt-box oap-whisper" data-testid="oap-whisper" aria-live="polite"><span className="oap-whisper-ic" aria-hidden="true">🤟</span>
      <div><h2>{ar ? `${P35_NAMES_AR.whisper} — الآن` : 'Interpreter’s whisper — now'}</h2><p><b>{whisper.title_ar}</b>{whisper.interpreter_name_ar ? ` · ${whisper.interpreter_name_ar}` : ''} · {ar ? `غرفة مفتوحة للجميع ${WHISPER_MINUTES} دقائق — تنتهي ${new Date(whisper.ends_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}` : `open room ${WHISPER_MINUTES} min`}</p></div>
      <Link href={`/room/${whisper.room_code}`} className="pt-btn gold" data-testid="oap-whisper-join">{ar ? 'ادخل الغرفة' : 'Join'}</Link>
    </section>}

    <section className="pt-box oap-two" id="season">
      <div><h2>{ar ? P35_NAMES_AR.season : 'On-Air Season'}</h2>
        {!season && <p className="pt-muted" data-testid="oap-season-none">{ar ? 'لا موسم معلَنًا الآن — حين يُعلن الطاقم موسمًا (أسبوعًا أو أسبوعين)، تعلن كلُّ جهةٍ ساعتها الذهبية فيه، فتضيء خريطة المملكة جهةً بعد جهة، وتحصل الجهة بعده على «وثيقة موسم» موقَّعة.' : 'No season announced yet.'} <Link href="/on-air/seasons" data-testid="oap-seasons-link">{ar ? 'سجلّ المواسم السابقة' : 'Past seasons'}</Link></p>}
        {season && <div className="oap-season" data-testid="oap-season" data-phase={season.phase}>
          <p className="oap-gold-big">{season.phrase}</p>
          <p><b>{season.title_ar}</b> · {season.from_day} → {season.to_day}</p>
          {season.invite_ar && <p className="oap-season-inv">«{season.invite_ar}»</p>}
          <p className="oap-gold-n" data-testid="oap-season-line">{season.line}</p>
          {signFirst && !!season.sign_slots && <p className="oap-signfirst" data-testid="oap-sign-first">🤟 {ar ? `${season.sign_slots === 1 ? 'ساعة واحدة' : `${season.sign_slots} ساعات`} بالإشارة في هذا الموسم — قدّمناها لك أولًا` : 'Signed hours shown first for you'}</p>}
          <ul className="oap-slots" data-testid="oap-season-slots">{seasonSlots.map((x: any) => <li key={x.id} data-sign={x.sign_language ? '1' : '0'}><b>{x.weekday_ar} {x.from}</b> · {x.duration_min} {ar ? 'دقيقة' : 'min'}{x.org_name_ar ? <span> · {x.org_name_ar}</span> : <span className="pt-muted"> · {ar ? 'جهة (بلا اسم)' : 'an organization'}</span>}{x.sign_language ? <span className="oap-sign" data-testid="oap-slot-sign"> · 🤟 {ar ? 'بالإشارة' : 'signed'}</span> : null}{x.shared ? <span className="oap-shared" data-testid="oap-slot-shared"> · 🤝 {x.shared_label_ar}</span> : null}</li>)}</ul>
          {!!(season.sign_hours || []).length && <p className="oap-signhours" data-testid="oap-sign-hours">🤟 {ar ? `${P37_NAMES_AR.season_sign}: ` : 'Season interpreters: '}{(season.sign_hours as any[]).map((h: any, i: number) => <span key={h.id}>{i ? ' · ' : ''}{h.weekday_ar} {h.from} ({h.duration_min} {ar ? 'د' : 'min'}){h.live ? (ar ? ' — الآن' : ' — now') : ''}</span>)}<small> — {ar ? 'ساعات إشارة مفتوحة تعهّد بها مترجمون طوال الموسم' : 'open sign-language hours pledged for the season'}</small></p>}
          <p className="oap-season-links">{season.phase !== 'after' && <a href={`/api/onair?season_ics=${season.id}`} className="pt-btn ghost small" data-testid="oap-season-ics">📅 {ar ? 'أضِف الموسم إلى تقويمك' : 'Add to calendar'}</a>} <Link href="/on-air/seasons" className="pt-btn ghost small" data-testid="oap-seasons-link">📖 {ar ? `${P36_NAMES_AR.record} — كل المواسم` : 'Season records'}</Link></p>
          {season.phase !== 'after' && <p className="pt-muted">{ar ? 'مدير الجهة يعلن ساعتها من «جهتي ← أَثَر معك». منسوبوها يُذكَّرون قبلها بساعة، والصعود يبقى قرارًا شخصيًا.' : 'Org admins announce their hour from the organization page.'}</p>}
        </div>}
      </div>
      <div><h2>{ar ? 'خريطة الموسم' : 'Season map'}</h2>
        {season && season.map?.length > 0 ? <><OnAirMap map={{ points: season.map, total: season.orgs, other: 0 }} lang={lang} compact /><p className="pt-muted">{ar ? `${season.orgs} ${season.orgs === 1 ? 'جهة' : season.orgs === 2 ? 'جهتان' : 'جهات'} على الخريطة — بمدن الجهات، أعداد بلا أسماء إلا بإذن مدير الجهة.` : 'Organizations by city.'}</p></> : <p className="pt-muted" data-testid="oap-season-map-empty">{ar ? 'تضيء الخريطة جهةً بعد جهة حين تُعلن الجهات ساعاتها.' : 'The map lights up as organizations announce their hours.'}</p>}
      </div>
    </section>

    <section className="pt-box"><h2>{ar ? P35_NAMES_AR.when : 'When is the air lit?'}</h2>
      <p className="pt-muted">{ar ? 'لا «الآن» فقط — متى يُضاء الهواء عادةً في كل مدينة؟ كثافة آخر ثمانية أسابيع بتوقيت الرياض: نادرًا · أحيانًا · غالبًا. تظهر المدينة إن صعد منها خمسة أشخاص مختلفون، بلا أسماء ولا أعداد، ويُحذف السجل بعد 90 يومًا.' : 'Not only now — when is the air usually lit in each city? Density over the last eight weeks.'}</p>
      <WhenStrip lang={lang} />
    </section>

    <section className="pt-box oap-week" id="week" data-testid="oap-week" data-has={weekq ? '1' : '0'}><h2>🔗 {ar ? `${P36_NAMES_AR.week_question} — ${P36_NAMES_AR.chain}` : 'Question of the week'}</h2>
      <p className="pt-muted">{ar ? `أمانة لم يجدها أحد ${BOTTLE_HOURS} ساعة، أذن كاتبها بنشرها مجهولةً، واعتمدها إنسان من الطاقم — فصارت سؤال الأسبوع. يجيب عنه من هو على الهواء الآن بدوره لا باسمه، ويُبلَّغ كاتبها بما جاء.` : 'An entrusted question nobody found in 72 h, published anonymously with its author’s consent and staff approval; those on air answer by role, not by name.'}</p>
      {!weekq && <p className="pt-muted" data-testid="oap-week-none">{ar ? 'لا سؤال هذا الأسبوع — الأمانات كلها وجدت من يحملها.' : 'No question this week.'}</p>}
      {weekq && <div className="oap-weekq">
        <p className="oap-weekq-q" data-testid="oap-week-q">«{weekq.text_ar}»{weekq.domain ? <small> · {weekq.domain}</small> : null}</p>
        <p className="oap-gold-n" data-testid="oap-week-line">{weekq.line_ar}{weekq.ends_day ? <small> · {ar ? 'حتى' : 'until'} {weekq.ends_day}</small> : null}</p>
        <ul className="oap-week-answers" data-testid="oap-week-answers">{(weekq.answers || []).map((a: any) => <li key={a.id}><b>{a.role_label_ar}</b><p>{a.text_ar}</p></li>)}</ul>
        {d?.signed_in && weekq.can_answer && <form className="oap-week-form" onSubmit={e => { e.preventDefault(); answerWeek(); }} data-testid="oap-week-form"><label>{ar ? 'إجابتك — أنت على الهواء الآن' : 'Your answer'}<textarea value={wtext} onChange={e => setWtext(e.target.value.slice(0, WEEK_ANSWER_MAX))} rows={3} required minLength={10} data-testid="oap-week-text" placeholder={ar ? 'قصيرة ونافعة — بلا بيانات شخصية' : 'Short and useful'} /></label><button type="submit" className="pt-btn gold small" disabled={wbusy || wtext.trim().length < 10} data-testid="oap-week-send">{ar ? 'أجب على الهواء' : 'Answer on air'}</button></form>}
        {!(d?.signed_in && weekq.can_answer) && <p className="pt-muted" data-testid="oap-week-cannot">{weekq.mine ? (ar ? 'أجبت عن سؤال هذا الأسبوع — شكرًا.' : 'You answered this week.') : (ar ? 'الإجابة لمن هو على الهواء الآن — ' : 'Only those on air may answer — ')}{!weekq.mine && (d?.signed_in ? <Link href="/me/onair">{ar ? 'اصعد من «أستقبل»' : 'go on air'}</Link> : <Link href="/login?next=/me/onair">{ar ? 'سجّل الدخول ثم اصعد من «أستقبل»' : 'sign in, then go on air'}</Link>)}</p>}
        {!d?.signed_in && <p className="pt-muted"><Link href="/login?next=/on-air">{ar ? 'سجّل الدخول' : 'Sign in'}</Link> {ar ? 'ثم اصعد على الهواء لتجيب' : 'then go on air to answer'}</p>}
        {wnote && <p className="pt-muted" role="status" data-testid="oap-week-note">{wnote}</p>}
      </div>}
    </section>

    <section className="pt-box"><h2>{ar ? 'من على الهواء الآن' : 'On air now'}</h2>
      {!present.length && <p className="pt-muted" data-testid="oap-nobody">{ar ? 'لا أحد الآن. الاستشارة تصل الطاقم في أي وقت، والنوافذ القادمة أدناه.' : 'Nobody right now.'}</p>}
      <ul className="oap-people" data-testid="oap-people">{present.map((p: any, i: number) => <li key={p.user_id || i}>
        <span className="oap-ava" aria-hidden="true">{p.photo_url ? <img src={p.photo_url} alt="" /> : <Icon name="users" size={18} />}</span>
        <span><b>{p.name_ar || (ar ? 'عضو هيئة أَثَر' : 'Athar Faculty member')}</b><small>{p.face_ar}{p.title_ar ? ` · ${p.title_ar}` : ''}{p.text_only ? (ar ? ' · نصّ فقط (الهواء الصامت)' : ' · text only') : ''}</small><small>{(p.receives || []).map((g: Grade) => GRADE_LABEL[g].ar).join(' · ')}{p.domains?.length ? ` · ${p.domains.slice(0, 4).join(' · ')}` : ''} · {ar ? `${p.minutes_left} د متبقية` : `${p.minutes_left} min`}</small></span>
        {p.slug && <Link href={`/experts/${p.slug}`} className="pt-btn ghost small">{ar ? 'سيرته' : 'Profile'}</Link>}
      </li>)}</ul>
      {d && !d.signed_in && present.length > 0 && <p className="pt-muted">{ar ? 'الأسماء والصور بعد تسجيل الدخول — ' : 'Names after sign-in — '}<Link href="/login?next=/on-air">{ar ? 'سجّل الدخول' : 'Sign in'}</Link></p>}
    </section>

    <section className="pt-box"><h2>{ar ? 'نوافذ قادمة' : 'Upcoming windows'}</h2>
      {!upcoming.length && <p className="pt-muted">{ar ? 'لم يُعلن أحد نافذة قادمة بعد.' : 'No windows announced yet.'}</p>}
      <ul className="oap-wins" data-testid="oap-wins">{upcoming.map((w: any) => <li key={w.id}><b>{w.weekday_ar} {w.from}–{w.to}</b>{w.name_ar ? <span> · {w.name_ar}</span> : null}{w.note_ar ? <small> · {w.note_ar}</small> : null}</li>)}</ul>
    </section>

    <section className="pt-box"><h2>{ar ? 'أسئلة أجاب عنها الهواء' : 'Questions the air answered'}</h2>
      <p className="pt-muted">{ar ? 'أجوبة حقيقية أعاد الطاقم صياغتها بلا أسماء ولا تفاصيل، بموافقة من سأل — لتنفع من يأتي بعده.' : 'Real answers, rewritten by staff without names, with the asker’s consent.'}</p>
      {!faq.length && <p className="pt-muted" data-testid="oap-faq-empty">{ar ? 'لا شيء بعد — أول سؤال يُجاب على الهواء يبدأ هذا الجدار.' : 'Nothing yet.'}</p>}
      <p className="oap-wall-link"><Link href="/on-air/week" className="pt-btn ghost small" data-testid="oap-wall-link">🧱 {ar ? `${P37_NAMES_AR.wall} — أسئلة الأسابيع الماضية بإجاباتها` : 'Week Wall — past questions answered'}</Link></p>
      <ul className="oap-faq" data-testid="oap-faq">{faq.map((f: any) => <li key={f.id}><details><summary>{f.question_ar}{f.domain ? <small> · {f.domain}</small> : null}</summary><p>{f.answer_ar}</p></details></li>)}</ul>
    </section>

    {st && <section className="pt-box oap-stats" data-testid="oap-stats"><h2>{ar ? 'هذا الشهر' : 'This month'}</h2>
      <div className="oap-kpis"><span><b>{st.present}</b>{ar ? 'على الهواء الآن' : 'on air now'}</span><span><b>{st.meetings_month ?? `< ${st.k}`}</b>{ar ? 'لقاءً اكتمل' : 'meetings done'}</span><span><b>{st.askers_month ?? `< ${st.k}`}</b>{ar ? 'سائلًا مختلفًا' : 'distinct askers'}</span><span><b>{st.avg_response_min ?? '—'}</b>{ar ? 'د متوسط أول ردّ' : 'min avg first reply'}</span></div>
      <p className="pt-muted">{ar ? `لا نُظهر أي رقم عن السائلين قبل أن يبلغ ${st.k}. لا نجوم ولا تقييم: من سأل يكتب — إن شاء — «ما الذي تغيّر؟» ويقرؤه من ساعده وحده.` : `No asker figure is shown below ${st.k}. No stars.`}</p>
    </section>}

    <section className="pt-box"><h2>{ar ? 'كيف يعمل' : 'How it works'}</h2>
      <ol className="oap-how">
        <li>{ar ? `العضو يضغط «أستقبل» فيصعد إلى الهواء ${ON_AIR_MINUTES} دقيقة، ثم ينطفئ وحده — ولا يُسأل لماذا نزل.` : `A member clicks “receive” and is on air for ${ON_AIR_MINUTES} minutes.`}</li>
        <li>{ar ? 'طلبك يصل كل الحاضرين المناسبين؛ أول من يضغط «أستقبل» يكون معك، والبقية يرون أنه أُخذ.' : 'Your request reaches all suitable receivers; the first to accept is with you.'}</li>
        <li>{ar ? 'الذكاء الاصطناعي يرتّب الصفّ ويلخّص الخيط للمُستقبِل بإذنك — ولا يردّ عليك قط باسم إنسان.' : 'AI ranks the queue and summarises with your consent — it never replies in a human’s name.'}</li>
        <li>{ar ? `ساعات الحضور تُحسب من اللقاءات الفعلية: ${CERT_HOURS} ساعات و${CERT_MEETINGS} لقاءات = «شهادة حضور على الهواء» موقَّعة (ATH-OA) تظهر في «ما شهده أَثَر».` : `${CERT_HOURS} hours and ${CERT_MEETINGS} meetings earn a signed On-Air certificate (ATH-OA).`}</li>
        <li>{ar ? `«${P34_NAMES_AR.bottle}»: إن كان الهواء صفرًا، يُودَع سؤالك أمانةً ${BOTTLE_HOURS} ساعة ويجده أول من يصعد — ولا يضيع.` : 'Entrusted question: when nobody is on air, your question is held in trust 72 h for the first to go on air.'}</li>
        <li>{ar ? `«${P34_NAMES_AR.quiet}»: من يستقبل بالنص فقط يُعلن ذلك، ومن يفضّل النص يُقدَّم له المتوافقون أولًا. «${P34_NAMES_AR.signed}»: حين يحضر مترجم تظهر يدٌ على زر الرأس.` : 'Quiet Air and Signed Air: text-only receivers and interpreter presence are visible.'}</li>
        <li>{ar ? `«${P34_NAMES_AR.echo}»: سؤال حُلّ — بإذن صاحبه ومجهّلًا — قد يصبح «مهارة اليوم» بعد اعتماد الطاقم. «${P34_NAMES_AR.legacy}»: حامل ATH-OA يرافق مُستقبِلًا جديدًا في أول ${SHADOW_REQUESTS} طلبات، يقرأ ولا يتدخّل.` : 'Echo and Legacy: consented questions become daily skills; certified members shadow newcomers.'}</li>
        <li>{ar ? 'احتياجاتك (أَثَر يلبّي احتياجاتي) لا تدخل في اختيار من يردّ — إلا إن طلبت مترجم إشارة بنفسك.' : 'Your access needs never enter matching — unless you ask for an interpreter yourself.'}</li>
      </ol>
      <p className="pt-muted">{d?.privacy_ar}</p>
      <p><Link href="/experts" className="pt-btn ghost small">{ar ? 'هيئة أَثَر' : 'Athar Faculty'}</Link> <Link href="/accessibility" className="pt-btn ghost small">{ar ? 'بيان الوصول' : 'Accessibility'}</Link> <Link href="/verify/vc" className="pt-btn ghost small">{ar ? 'تحقّق من شهادة' : 'Verify a certificate'}</Link></p>
    </section>
  </main>;
}

const CSS = `
.oap{max-width:960px;margin:0 auto;padding:28px 18px 60px}.oap-h h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}.oap-h p{color:#334155;line-height:1.9;margin:0 0 12px;font-size:16px}
.oap-live{display:inline-flex;align-items:center;gap:8px;background:#fffbeb;color:#92400e;border-radius:999px;padding:6px 14px;font-weight:800}.oap-live b{font-size:20px}.oap-live small{color:#92400e;font-weight:400}
.oap-dot{width:10px;height:10px;border-radius:50%;background:#dc2626;box-shadow:0 0 0 0 rgba(220,38,38,.45);animation:oaPulse 1.6s infinite}html[data-access~="focus"] .oap-dot{animation:none}
.oap-cta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 18px}.oap-err{color:#b91c1c;font-weight:800}
.oap .pt-box{margin-bottom:16px}.oap h2{font-size:19px;color:#0f2a4e;margin:0 0 10px}
.oap-grades{list-style:none;margin:0 0 10px;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.oap-grade{width:100%;text-align:start;border:1.5px solid #e2e8f0;border-radius:14px;padding:14px;background:#fff;font:inherit;cursor:pointer;min-height:44px;display:flex;flex-direction:column;gap:4px;color:#0f2a4e}.oap-grade:hover{border-color:#0b6f69;background:#f0fbfa}
.oap-grade b{font-size:17px}.oap-grade small{color:#475569;line-height:1.6}.oap-grade span{align-self:flex-start;background:#f1f5f9;border-radius:999px;padding:1px 10px;font-size:12.5px;font-weight:800;color:#0b6f69;margin-top:4px}
.oap-shared{color:#9a3412;font-weight:800}.oap-signhours{margin:8px 0 0;color:#701a75;font-size:14px;line-height:1.8}.oap-signhours small{color:#64748b;font-weight:400}.oap-wall-link{margin:0 0 10px}.oap-signnow{background:linear-gradient(135deg,#fdf4ff,#fae8ff)}
.oap-people,.oap-wins,.oap-faq{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.oap-people li{display:flex;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.oap-people li>span:nth-child(2){flex:1}.oap-people b{display:block;color:#0f2a4e}.oap-people small{display:block;color:#475569;line-height:1.6}
.oap-ava{width:48px;height:48px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;color:#0b6f69}.oap-ava img{width:100%;height:100%;object-fit:cover}
.oap-wins li{color:#334155}.oap-wins small{color:#475569}
.oap-faq details{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px}.oap-faq summary{cursor:pointer;font-weight:800;color:#0f2a4e;min-height:24px}.oap-faq summary small{color:#64748b;font-weight:400}.oap-faq p{margin:8px 0 0;color:#334155;line-height:1.8;white-space:pre-wrap}
.oap-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 10px}.oap-kpis span{background:#f8fafc;border-radius:12px;padding:10px 12px;color:#334155;display:flex;flex-direction:column;gap:2px;font-size:13px}.oap-kpis b{font-size:22px;color:#0f2a4e}
.oap-two{display:grid;grid-template-columns:1.2fr 1fr;gap:18px}@media(max-width:760px){.oap-two{grid-template-columns:1fr}}
.oap-season{background:linear-gradient(135deg,#ecfeff,#cffafe);border:1px solid #a5f3fc;border-radius:16px;padding:14px 16px;color:#164e63}.oap-season p{margin:0 0 6px;color:#164e63;font-size:15px}.oap-season .oap-gold-big{color:#0e7490}.oap-season-inv{font-style:italic}.oap-slots{list-style:none;margin:6px 0;padding:0;display:grid;gap:4px;font-size:14px}
.oap-sign{color:#701a75;font-weight:800}.oap-signfirst{margin:0 0 6px;background:#fdf4ff;border:1px solid #f0abfc;color:#701a75;border-radius:10px;padding:6px 10px;font-weight:700}.oap-season-links{margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap}
.oap-weekq{background:linear-gradient(135deg,#f5f3ff,#ede9fe);border:1px solid #c4b5fd;border-radius:16px;padding:14px 16px;color:#4c1d95}.oap-weekq p{color:#4c1d95}.oap-weekq-q{font-size:19px;font-weight:900;margin:0 0 6px;line-height:1.7}.oap-weekq-q small{font-weight:400;color:#6d28d9}.oap-week-answers{list-style:none;margin:8px 0;padding:0;display:grid;gap:8px}.oap-week-answers li{background:#fff;border-radius:12px;padding:8px 12px}.oap-week-answers b{display:block;color:#0f2a4e;font-size:13px}.oap-week-answers p{margin:2px 0 0;color:#1e293b;line-height:1.8}.oap-week-form{display:grid;gap:8px;margin-top:8px}.oap-week-form label{display:grid;gap:4px;font-weight:800;color:#0f2a4e;font-size:13px}.oap-week-form textarea{border:1px solid #cbd5e1;border-radius:10px;padding:8px 10px;font:inherit;min-height:44px}.oap-week-form button{justify-self:start}
.oap-whisper{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fdf4ff;border-color:#f0abfc}.oap-whisper h2{margin:0 0 4px;font-size:18px}.oap-whisper p{margin:0;color:#701a75}.oap-whisper-ic{font-size:30px}
.oap-golden{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:16px;padding:14px 16px;color:#78350f}.oap-golden p{margin:0 0 6px;color:#78350f;font-size:15px}.oap-gold-big{font-size:26px;font-weight:900;color:#92400e}.oap-gold-n b{font-size:20px}
.oap-bottles{margin:12px 0 0;background:#f0f9ff;border:1px solid #bae6fd;color:#0c4a6e;border-radius:12px;padding:8px 12px;font-weight:700}
.oap-how{margin:0 0 10px;padding-inline-start:20px;color:#334155;line-height:1.9}
`;
