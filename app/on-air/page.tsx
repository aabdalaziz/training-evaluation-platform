'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air — «أَثَر معك — على الهواء» (P33): الصفحة العامة
 *  من على الهواء الآن (العدد للجميع، الأسماء بعد الدخول) · الدرجات الثلاث · النوافذ القادمة · «أسئلة أجاب عنها الهواء» · أرقام الشهر (k≥5) · كيف يعمل · الخصوصية.
 *  الإنسان هو من يردّ؛ لا ذكاء اصطناعي يتكلم باسم أحد.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { openOnAir } from '../components/OnAir';
import { fastToken } from '../components/Pocket';
import { supabase } from '../../lib/supabase/client';
import { GRADES, GRADE_LABEL, GRADE_HINT, QUICK_TIMEOUT_MIN, SESSION_MINUTES, SESSION_EXTEND_MINUTES, CERT_HOURS, CERT_MEETINGS, ON_AIR_MINUTES } from '../../lib/onair/registry';
import type { Grade } from '../../lib/onair/registry';

export default function OnAirPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let alive = true;
    const load = async () => { const tk = await fastToken(supabase()).catch(() => ''); const r = await fetch('/api/onair?now=1', { cache: 'no-store', headers: tk ? { Authorization: `Bearer ${tk}` } : {} }).then(x => x.json()).catch(() => null); if (!alive) return; if (r?.success) setD(r); else setErr(r?.error || 'تعذّر التحميل'); };
    load(); const id = setInterval(load, 30000); return () => { alive = false; clearInterval(id); };
  }, []);
  const present: any[] = d?.present || []; const st = d?.stats; const faq: any[] = d?.faq || []; const upcoming: any[] = d?.upcoming || [];
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

    <section className="pt-box"><h2>{ar ? 'من على الهواء الآن' : 'On air now'}</h2>
      {!present.length && <p className="pt-muted" data-testid="oap-nobody">{ar ? 'لا أحد الآن. الاستشارة تصل الطاقم في أي وقت، والنوافذ القادمة أدناه.' : 'Nobody right now.'}</p>}
      <ul className="oap-people" data-testid="oap-people">{present.map((p: any, i: number) => <li key={p.user_id || i}>
        <span className="oap-ava" aria-hidden="true">{p.photo_url ? <img src={p.photo_url} alt="" /> : <Icon name="users" size={18} />}</span>
        <span><b>{p.name_ar || (ar ? 'عضو هيئة أَثَر' : 'Athar Faculty member')}</b><small>{p.face_ar}{p.title_ar ? ` · ${p.title_ar}` : ''}</small><small>{(p.receives || []).map((g: Grade) => GRADE_LABEL[g].ar).join(' · ')}{p.domains?.length ? ` · ${p.domains.slice(0, 4).join(' · ')}` : ''} · {ar ? `${p.minutes_left} د متبقية` : `${p.minutes_left} min`}</small></span>
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
.oap-people,.oap-wins,.oap-faq{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.oap-people li{display:flex;gap:12px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.oap-people li>span:nth-child(2){flex:1}.oap-people b{display:block;color:#0f2a4e}.oap-people small{display:block;color:#475569;line-height:1.6}
.oap-ava{width:48px;height:48px;border-radius:50%;background:#f1f5f9;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;color:#0b6f69}.oap-ava img{width:100%;height:100%;object-fit:cover}
.oap-wins li{color:#334155}.oap-wins small{color:#475569}
.oap-faq details{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px}.oap-faq summary{cursor:pointer;font-weight:800;color:#0f2a4e;min-height:24px}.oap-faq summary small{color:#64748b;font-weight:400}.oap-faq p{margin:8px 0 0;color:#334155;line-height:1.8;white-space:pre-wrap}
.oap-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 10px}.oap-kpis span{background:#f8fafc;border-radius:12px;padding:10px 12px;color:#334155;display:flex;flex-direction:column;gap:2px;font-size:13px}.oap-kpis b{font-size:22px;color:#0f2a4e}
.oap-how{margin:0 0 10px;padding-inline-start:20px;color:#334155;line-height:1.9}
`;
