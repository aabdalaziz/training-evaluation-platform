'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — الصفحة الرئيسية الحيّة (P10): مسرح «الآن في أَثَر» · كل يوم بناء: موقف اليوم (P13-أ) · مستشارك: اسأل وأنا أجيب · جلسة حوار (محاكاة فورية + الجلسة القادمة) · شريط TRACE
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabase/client';
import { Icon } from '../lib/ui/icons';
import { PortalShell, useLang } from './components/PortalShell';
import { ACRONYM, BRAND, SERVICES, UI, t } from '../lib/portal/content';
import { buildFeed, countdown, typewriter } from '../lib/portal/home';
import type { FeedItem, FeedProgram, FeedSession } from '../lib/portal/home';
import { DEMO_SCENARIO, bandLabel } from '../lib/portal/sim';
import type { Turn, SimScore } from '../lib/portal/sim';
import { domainByCode, familyName, HORIZON_LABEL } from '../lib/portal/lexicon';
import { BAND_LABEL, RUBRIC_LABEL } from '../lib/portal/daily-case';
import { PushOptIn } from './components/Pwa';
import { useOutbox, valueMoment } from './components/Pocket';
import { Channel, ReadAloud, VoiceButton } from './components/Channel';
import { SimplerText } from './components/Inclusion';
import { OnAirLine } from './components/OnAir';

export default function HomePage() { return <PortalShell><Home /></PortalShell>; }

type DailyCaseT = { day?: string; skill_ids?: string[]; title_ar: string; scene_ar: string; role_ar: string; situation_ar: string; twist_ar: string; ask_ar: string; parties_ar: string[]; domain_code: string; family: string; horizon: number; source: string };
type CaseEval = { band: 'emerging' | 'capable' | 'distinguished' | 'exceptional'; score: number; performance_ar: string; strengths_ar: string[]; blind_spot_ar: string; needs_ar: string[]; next_step_ar: string; skills: { code: string; label_ar: string; level: number }[]; rubric_hits: { code: string; hit: number }[]; recommend: { label_ar: string; href: string }[]; source: string };
type WhatIfT = { text_ar: string; ask_ar: string; tests: string; source: string };
type Round2T = { whatif: WhatIfT; response: string; score: number; band: CaseEval['band']; shift: number; stance: 'held' | 'revised' | 'unclear'; verdict_ar: string; adaptability_ar: string };
type CrowdT = { n: number; bands: Record<CaseEval['band'], number>; avg: number; rubric_rates: { code: string; rate: number }[]; most_missed: string | null };
type Daily = { day: string; case: DailyCaseT; crowd?: CrowdT; crowd_line?: string; event: null | { code: string; name_ar: string; name_en: string; theme_ar: string; line_ar: string; line_en: string; exact: boolean; kind: string }; upcoming: { code: string; name_ar: string; line_ar: string; line_en: string }[]; mine: null | { response: string; evaluation: CaseEval; round2?: Partial<Round2T> | null }; streak: number; participants: number; limits: { min: number; max: number } };

function Home() {
  const { lang } = useLang(); const ar = lang === 'ar';
  const [programs, setPrograms] = useState<FeedProgram[]>([]); const [sessions, setSessions] = useState<FeedSession[]>([]); const [counters, setCounters] = useState({ resources: 0, credentials: 0, sims: 0 });
  const [now, setNow] = useState(() => Date.now()); const [tok, setTok] = useState('');
  useEffect(() => {
    fetch('/api/advisor').then(r => r.json()).then(j => { if (j?.success) { setPrograms(j.programs || []); setSessions(j.sessions || []); setCounters(j.counters || counters); } }).catch(() => {});
    supabase().auth.getSession().then(({ data }) => setTok(data.session?.access_token || '')).catch(() => {});
    const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const feed = buildFeed(programs, sessions, new Date(now).toISOString(), lang);
  const openCount = programs.filter(p => p.registration_open).length; const upcoming = sessions.filter(s => Date.parse(s.starts_at) > now).length;

  return (
    <main className="pt-main hm">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <Hero feed={feed} now={now} lang={lang} counters={{ open: openCount, sessions: upcoming, ...counters }} />
      <DailyCase lang={lang} tok={tok} />
      <Advisor lang={lang} tok={tok} />
      <Memory lang={lang} />
      <Embassy lang={lang} />
      <Dialogue lang={lang} tok={tok} sessions={sessions} now={now} />
      <section className="pt-sec hm-trace">
        <div className="pt-wrap">
          <div className="hm-tracehead"><span className="pt-kicker"><Icon name="compass" size={14} /> {ar ? 'منهجية TRACE · ثماني خدمات' : 'TRACE method · eight services'}</span><h2>{ar ? 'كل ما سبق يقف على بنية واحدة' : 'Everything above stands on one architecture'}</h2></div>
          <div className="hm-tracerow">{ACRONYM.map(a => <Link key={a.letter} href={`/services/${a.slug}`} className="hm-tracecell"><b>{a.letter}</b><span>{ar ? a.ar : a.word}</span></Link>)}</div>
          <div className="hm-services">{SERVICES.map(s => <Link key={s.slug} href={`/services/${s.slug}`} className="hm-svc"><Icon name={s.icon as any} size={16} /> {t(s.title, lang)}</Link>)}</div>
          <div className="hm-final"><div><b>{t(BRAND.tagline, lang)}</b><small>{t(BRAND.promise, lang)}</small></div><div className="pt-heroacts"><Link href="/programs" className="pt-btn gold">{t(UI.programs, lang)}</Link><Link href="/consulting" className="pt-btn outline dark">{ar ? 'للجهات: اطلب استشارة' : 'Organizations: request a consultation'}</Link></div></div>
        </div>
      </section>
    </main>
  );
}

/* ------------------------------------------------ البطل + مسرح «الآن في أَثَر» ------------------------------------------------ */
const WORDS_AR = ['نبني القدرة', 'نُثبت الأثر', 'نتدرّب في مواقف حقيقية', 'نبني كل يوم جدارة', 'نسأل… ونجد من يجيب'];
const WORDS_EN = ['we build capability', 'we prove impact', 'we rehearse real situations', 'we build one competency a day', 'we ask — and get answers'];
function Hero({ feed, now, lang, counters }: { feed: FeedItem[]; now: number; lang: 'ar' | 'en'; counters: { open: number; sessions: number; resources: number; credentials: number; sims: number } }) {
  const ar = lang === 'ar'; const words = ar ? WORDS_AR : WORDS_EN; const [w, setW] = useState(0); const [i, setI] = useState(0); const [hold, setHold] = useState(false);
  useEffect(() => { const id = setInterval(() => setW(x => (x + 1) % words.length), 2600); return () => clearInterval(id); }, [words.length]);
  useEffect(() => { if (hold || feed.length < 2) return; const id = setInterval(() => setI(x => (x + 1) % feed.length), 6500); return () => clearInterval(id); }, [feed.length, hold]);
  const item = feed[Math.min(i, Math.max(0, feed.length - 1))]; const cd = item?.at ? countdown(item.at, now, lang) : null;
  return (
    <section className="pt-hero hm-hero">
      <div className="pt-wrap pt-herogrid">
        <div>
          <span className="pt-heropill"><Icon name="star" size={14} /> {t(BRAND.tagline, lang)}</span>
          <h1>{ar ? <>التدريب ما بعد الذكاء الاصطناعي:<br /><em key={w} className="hm-word">{words[w]}</em></> : <>Post‑AI training:<br /><em key={w} className="hm-word">{words[w]}</em></>}</h1>
          <p>{ar ? 'هنا لا تقرأ عن التدريب — تعيشه: محاكيات تضعك في الموقف، موقف واحد كل يوم يكشف كيف تفكّر، مستشار يجيبك الآن، وملف مهاري يتشكّل من أدلة حقيقية يعتمدها خبراء.' : 'You do not read about training here — you live it: simulators that put you in the situation, one real situation a day that shows how you think, an advisor who answers now, and a skills profile built from real evidence approved by experts.'}</p>
          <div className="pt-heroacts">
            <Link href="/sim" className="pt-btn gold"><Icon name="play" size={16} /> {ar ? 'جرّب محاكاة — 3 دقائق' : 'Try a simulation — 3 min'}</Link>
            <a href="#daily" className="pt-btn light"><Icon name="target" size={16} /> {ar ? 'موقف اليوم' : "Today's case"}</a>
            <Link href="/2062" className="pt-btn outline"><Icon name="star" size={16} /> {ar ? 'عِش يومك في 2062' : 'Live your day in 2062'}</Link>
            <a href="#advisor" className="pt-btn outline"><Icon name="chat" size={16} /> {ar ? 'اسأل مستشارك' : 'Ask your advisor'}</a>
          </div>
          <div className="hm-counters">
            {[[counters.open, ar ? 'برنامج مفتوح للتسجيل' : 'programs enrolling'], [counters.sessions, ar ? 'جلسة قادمة' : 'upcoming sessions'], [counters.resources, ar ? 'حقيبة منشورة' : 'published resources'], [counters.credentials, ar ? 'شهادة قابلة للتحقق' : 'verifiable credentials'], [counters.sims, ar ? 'محاكاة أُجريت' : 'simulations run']].map(([n, l], k) => <div key={k}><b>{n}</b><span>{l}</span></div>)}
          </div>
        </div>
        <div className="hm-stage" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)} aria-live="polite">
          <div className="hm-stagehead"><span className="hm-live"><i /> {ar ? 'الآن في أَثَر' : 'Now at Athar'}</span><span className="hm-dots">{feed.map((_, k) => <button key={k} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`${k + 1}`} />)}</span></div>
          {item ? (
            <div key={item.id} className={`hm-stagecard ${item.tone}`}>
              <span className="hm-badge">{item.badge}</span>
              <h3>{item.title}</h3>
              <p>{item.sub}</p>
              {cd && !cd.past && <div className="hm-cd"><span><b>{cd.d}</b><small>{ar ? 'يوم' : 'd'}</small></span><span><b>{cd.h}</b><small>{ar ? 'ساعة' : 'h'}</small></span><span><b>{cd.m}</b><small>{ar ? 'دقيقة' : 'm'}</small></span><span><b>{cd.s}</b><small>{ar ? 'ثانية' : 's'}</small></span></div>}
              <Link href={item.href} className="pt-btn gold small">{item.cta} <Icon name="arrow" size={14} /></Link>
            </div>
          ) : <div className="hm-stagecard navy"><span className="hm-badge">{ar ? 'جارٍ التحميل' : 'Loading'}</span><h3>…</h3></div>}
          <div className="hm-stagefoot">{feed.slice(0, 4).map((f, k) => <button key={f.id} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)}><small>{f.badge}</small><span>{f.title}</span></button>)}</div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------ كل يوم بناء: موقف اليوم (P13-أ) ------------------------------------------------ */
const HINTS_AR = ['اكتب ما تفعله فعلًا، لا ما تؤمن به', 'سمِّ الأطراف وتحدّث معهم في ردّك', 'رتّب خطواتك بزمن: اليوم، غدًا، بعد شهر', 'إن كان في الموقف نظام ذكي: كيف تتحقق منه؟', 'كيف ستعرف لاحقًا أن قرارك عمل؟'];
const HINTS_EN = ['Write what you would actually do, not what you believe', 'Name the parties and talk to them in your answer', 'Order your steps in time: today, tomorrow, in a month', 'If an AI system is involved: how do you verify it?', 'How will you know later that your decision worked?'];
function DailyCase({ lang, tok }: { lang: 'ar' | 'en'; tok: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<Daily | null>(null); const [err, setErr] = useState(''); const [text, setText] = useState(''); const [busy, setBusy] = useState(false);
  const [ev, setEv] = useState<CaseEval | null>(null); const [revealed, setRevealed] = useState<DailyCaseT | null>(null); const [saved, setSaved] = useState(false); const [streak, setStreak] = useState(0); const [showMine, setShowMine] = useState(false);
  const [wi, setWi] = useState<WhatIfT | null>(null); const [r2, setR2] = useState<Round2T | null>(null); const [r2text, setR2text] = useState(''); const [wiBusy, setWiBusy] = useState(false); const [crowd, setCrowd] = useState<CrowdT | null>(null); const [crowdLine, setCrowdLine] = useState('');
  const hdr = useCallback(() => ({ 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }), [tok]);
  const ob = useOutbox(); const [queued, setQueued] = useState(false);
  useEffect(() => { fetch('/api/daily', { headers: hdr() }).then(r => r.json()).then(j => { if (j?.success) { setD(j); setStreak(j.streak || 0); if (j.crowd) { setCrowd(j.crowd); setCrowdLine(j.crowd_line || ''); } if (j.mine) { setEv(j.mine.evaluation); setText(j.mine.response); setRevealed(j.case); setSaved(true); const rr = j.mine.round2; if (rr?.whatif) setWi(rr.whatif as WhatIfT); if (rr?.response) setR2(rr as Round2T); } } else setErr(j?.error || 'x'); }).catch(() => setErr('x')); }, [hdr]);
  const refreshCrowd = useCallback(() => { fetch('/api/daily', { headers: hdr() }).then(r => r.json()).then(j => { if (j?.success && j.crowd) { setCrowd(j.crowd); setCrowdLine(j.crowd_line || ''); } }).catch(() => { /* تجاهل */ }); }, [hdr]);
  async function whatIf(withAnswer?: boolean) {
    if (!tok || wiBusy) return; if (withAnswer && r2text.trim().length < 40) return; setWiBusy(true); setErr('');
    try { const j = await fetch('/api/daily', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'whatif', ...(withAnswer ? { response: r2text } : {}) }) }).then(r => r.json()); if (j?.success) { if (j.whatif) setWi(j.whatif); if (j.round2?.response) setR2(j.round2); if (j.crowd) { setCrowd(j.crowd); setCrowdLine(j.crowd_line || ''); } } else setErr(j?.error || 'x'); } catch { setErr('x'); }
    setWiBusy(false);
  }
  /** بلا اتصال: الردّ يدخل صندوق الأدلة الميداني (أَثَر في الجيب) ويُقوَّم حين يعود الاتصال — بتاريخ كتابته */
  async function queueOffline(): Promise<boolean> {
    if (!d || !tok) return false; const r = await ob.enqueue('daily', { day: d.day, response: text.trim(), title: d.case?.title_ar || '' }); if (!r.ok) { setErr(r.reason_ar || 'x'); return false; }
    setQueued(true); valueMoment('daily_answered'); return true;
  }
  async function submit() {
    if (!d || busy || text.trim().length < (d.limits?.min || 80)) return; setBusy(true); setErr('');
    if (typeof navigator !== 'undefined' && !navigator.onLine && tok) { await queueOffline(); setBusy(false); return; }
    try { const j = await fetch('/api/daily', { method: 'POST', headers: hdr(), body: JSON.stringify({ response: text }) }).then(r => r.json()); if (j?.success) { setEv(j.evaluation); setRevealed(j.case); setSaved(!!j.saved); if (j.streak) setStreak(j.streak); refreshCrowd(); if (j.saved) valueMoment('daily_answered'); } else setErr(j?.error || 'x'); } catch { if (tok && await queueOffline()) { setBusy(false); return; } setErr('x'); }
    setBusy(false);
  }
  const c = revealed || d?.case; const min = d?.limits?.min || 80; const left = Math.max(0, min - text.trim().length); const dom = c ? domainByCode(c.domain_code) : null; const band = ev ? BAND_LABEL[ev.band] : null; const ring = 2 * Math.PI * 26;
  return (
    <section className="pt-sec alt hm-daily" id="daily">
      <div className="pt-wrap">
        <div className="hm-sechead"><div><span className="pt-kicker"><Icon name="target" size={14} /> {ar ? 'كل يوم بناء · موقف اليوم' : 'Daily build · today’s case'}</span><h2>{ar ? 'موقف واحد… يكشف كيف تفكّر، لا كم تعرف' : 'One situation — it shows how you think, not how much you know'}</h2><p className="hm-dailysub">{ar ? 'لا سؤال ولا خيارات. موقف حقيقي فيه توتر خفي؛ تكتب كيف تتصرّف بكلماتك، ونعيد لك مرآة أدائك: ما ظهر من جداراتك، وما لم تره، وما تحتاجه.' : 'No quiz, no options. A real situation with a hidden tension; you write how you would act, and we hand you a mirror: what your response showed, what you missed, what you need.'}</p></div>
          <div className="hm-streak" title={ar ? 'أيام متتالية' : 'Day streak'}><b>{streak}</b><span>{ar ? 'يوم متتالٍ' : 'day streak'}</span>{d && <small>{d.participants} {ar ? 'تعاملوا معه اليوم' : 'answered today'}</small>}</div></div>
        {d?.event && <div className={`hm-event ${d.event.kind}`}><Icon name="calendar" size={15} /> <b>{ar ? d.event.line_ar : d.event.line_en}</b>{d.event.theme_ar && <span>— {d.event.theme_ar}</span>}</div>}
        {!d && !err && <div className="hm-skel" />}
        {err && !d && <div className="pt-box pt-empty">{ar ? 'تعذّر تحميل موقف اليوم الآن.' : 'Could not load today’s case.'}</div>}
        {d && c && (
          <div className="hm-casegrid">
            <article className="hm-case">
              <div className="hm-lessonmeta">{dom && <span className={`hm-chip ${dom.tone}`}>{dom.h} · {t(dom.name, lang)}</span>}<span className="hm-chip">{familyName(c.family, lang)}</span><span className="hm-chip gold">{t(HORIZON_LABEL[c.horizon as 2035], lang)}</span>{c.source === 'ai' && <span className="hm-chip teal">{ar ? 'كُتب اليوم بالذكاء الاصطناعي · يراجعه فريق أَثَر' : 'Written today by AI · reviewed by Athar'}</span>}</div>
              <h3>{c.title_ar}</h3>
              <p className="hm-scene"><Icon name="compass" size={14} /> {c.scene_ar}</p>
              <p className="hm-role">{c.role_ar}</p>
              <p className="hm-situation">{c.situation_ar}</p>
              {!!c.parties_ar?.length && <div className="hm-parties"><small>{ar ? 'الأطراف' : 'Parties'}</small>{c.parties_ar.map((x, k) => <span key={k}>{x}</span>)}</div>}
              <div className="hm-ask"><b>{ar ? 'المطلوب منك' : 'Your task'}</b><p>{c.ask_ar}</p></div>
              {d.day && <SimplerText source="daily_case" id={d.day} lang={lang} />}
              {revealed?.twist_ar && <div className="hm-twist"><b>{ar ? 'التعقيد الخفي الذي كان في الموقف' : 'The hidden complication'}</b><p>{revealed.twist_ar}</p></div>}
            </article>
            <aside className="hm-respond">
              {!ev ? (
                <>
                  <div className="hm-chhead"><b>{ar ? 'كيف تتصرّف؟' : 'How would you act?'}</b></div>
                  <Channel lang={lang} value={text} onChange={setText} maxLength={d.limits?.max || 2500} rows={9} tok={tok} context={{ type: 'daily_case', id: c.day || null, skills: c.skill_ids || [], title: c.title_ar, parties: c.parties_ar || [] }} placeholder={ar ? 'اكتب هنا بكلماتك: ماذا تفعل أولًا، مع من تتحدث، ما البدائل، ما الذي لن تفعله، وكيف ستتأكد لاحقًا…' : 'Write in your own words: what you do first, whom you talk to, the alternatives, what you will not do, and how you will verify later…'} disabled={busy} testId="daily-channel" />
                  <ul className="hm-hints">{(ar ? HINTS_AR : HINTS_EN).map(h => <li key={h}><Icon name="check" size={12} /> {h}</li>)}</ul>
                  <div className="hm-respacts"><button type="button" className="pt-btn gold" onClick={submit} disabled={busy || left > 0}>{busy ? (ar ? 'أقرأ ردّك بعناية…' : 'Reading carefully…') : (ar ? 'أرني مرآة أدائي' : 'Show me my mirror')} <Icon name="arrow" size={14} /></button>{left > 0 && <small>{ar ? `${left} حرفًا على الأقل بعد` : `${left} more characters`}</small>}</div>
                  {busy && <div className="hm-think light"><i /><i /><i /> {ar ? 'أقارن ردّك بمعايير الموقف وأطرافه وتعقيده الخفي…' : 'Comparing your answer with the case criteria, parties and hidden twist…'}</div>}
                  {err && err !== 'x' && <div className="hm-err">{err}</div>}
                  {queued && <div className="hm-ok" data-testid="daily-queued"><Icon name="inbox" size={15} /> {ar ? 'لا اتصال الآن — حُفظ ردّك في صندوق الأدلة الميداني وسيُقوَّم تلقائيًا حين يعود الاتصال، بتاريخ كتابته.' : 'Offline — your answer is saved in the field outbox and will be evaluated automatically when you reconnect, stamped with the time you wrote it.'} <Link href="/offline#outbox">{ar ? 'الصندوق' : 'Outbox'}</Link></div>}
                  {!tok && <small className="hm-note">{ar ? 'يمكنك التجربة بلا تسجيل؛ سجّل الدخول ليُحفظ ردّك شاهدًا في ملفك المهني وتُحسَّن المرآة بالذكاء الاصطناعي.' : 'Try without signing in; sign in to save your answer as evidence and get the AI-enhanced mirror.'} <Link href="/login">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></small>}
                </>
              ) : (
                <div className="hm-mirror">
                  <div className="hm-mirrorhead">
                    <svg width="64" height="64" viewBox="0 0 64 64" className="hm-ring big"><circle cx="32" cy="32" r="26" /><circle cx="32" cy="32" r="26" strokeDasharray={ring} strokeDashoffset={ring * (1 - ev.score / 100)} /><text x="32" y="37" textAnchor="middle">{ev.score}</text></svg>
                    <div><small>{ar ? 'مرآة الأداء' : 'Performance mirror'}</small><b className={`hm-band ${band?.tone}`}>{ar ? band?.ar : band?.en}</b><span>{ev.source === 'ai' ? (ar ? 'بالذكاء الاصطناعي + معايير الموقف' : 'AI + case criteria') : (ar ? 'بمعايير الموقف — تقدير اصطلاحي' : 'Case criteria — indicative')}</span></div>
                  </div>
                  <p className="hm-perf">{ev.performance_ar}</p>
                  <div className="hm-readrow"><ReadAloud lang={lang} text={[ev.performance_ar, ar ? 'ما ظهر عندك:' : '', ...ev.strengths_ar, ar ? 'ما لم تره:' : '', ev.blind_spot_ar, ar ? 'احتياجاتك:' : '', ...ev.needs_ar, ar ? 'خطوة اليوم:' : '', ev.next_step_ar].filter(Boolean).join('. ')} /></div>
                  {!!ev.strengths_ar.length && <div className="hm-mblock ok"><b>{ar ? 'ما ظهر عندك' : 'What showed'}</b><ul>{ev.strengths_ar.map((x, k) => <li key={k}>{x}</li>)}</ul></div>}
                  <div className="hm-mblock warn"><b>{ar ? 'ما لم تره' : 'What you missed'}</b><p>{ev.blind_spot_ar}</p></div>
                  <div className="hm-mblock"><b>{ar ? 'احتياجاتك التطويرية' : 'Your development needs'}</b><ul>{ev.needs_ar.map((x, k) => <li key={k}>{x}</li>)}</ul></div>
                  <div className="hm-apply"><Icon name="flag" size={15} /> <span><b>{ar ? 'خطوة اليوم:' : 'Today’s step:'}</b> {ev.next_step_ar}</span></div>
                  <div className="hm-rub">{ev.rubric_hits.map(h => { const rl = (RUBRIC_LABEL as Record<string, { ar: string; en: string; hint_ar: string }>)[h.code]; return <span key={h.code} className={`h${h.hit}`} title={rl?.hint_ar}>{ar ? rl?.ar : rl?.en}</span>; })}</div>
                  {!!ev.skills.length && <div className="hm-skills">{ev.skills.map(s => <span key={s.code}><b>{s.label_ar}</b><i>{'●'.repeat(s.level)}{'○'.repeat(5 - s.level)}</i></span>)}</div>}
                  {crowd && <div className="hm-crowd" data-testid="crowd"><b><Icon name="users" size={14} /> {ar ? 'كيف تصرّف الآخرون اليوم؟' : 'How did others act today?'}</b>
                    <div className="hm-crowdbars">{(['emerging', 'capable', 'distinguished', 'exceptional'] as const).map(b => { const n = crowd.bands[b] || 0; const pct = crowd.n ? Math.round(100 * n / crowd.n) : 0; return <span key={b} className={`b-${b} ${ev.band === b ? 'me' : ''}`} title={`${n}`}><i style={{ height: `${Math.max(6, pct)}%` }} /><small>{ar ? BAND_LABEL[b].ar : BAND_LABEL[b].en}</small><em>{pct}%</em></span>; })}</div>
                    <p>{crowdLine}</p></div>}
                  {tok && !r2 && <div className="hm-whatif" data-testid="whatif">
                    {!wi ? <><b>{ar ? 'جولة ثانية: ماذا لو؟' : 'Round two: what if?'}</b><p>{ar ? 'أثير يضيف معلومة جديدة تغيّر الصورة — ويطلب قرارك مرة أخرى. هل تثبت أم تراجع؟' : 'Athir adds one new fact that changes the picture — and asks for your decision again.'}</p><button type="button" className="pt-btn gold small" disabled={wiBusy} onClick={() => whatIf(false)}>{wiBusy ? (ar ? 'أثير يفكّر…' : 'Thinking…') : (ar ? 'هات «ماذا لو؟»' : 'Give me the what-if')} <Icon name="arrow" size={13} /></button></>
                      : <><b>{ar ? 'ماذا لو…' : 'What if…'}</b><p className="hm-wtext">{wi.text_ar}</p><p className="hm-wask">{wi.ask_ar}</p>
                        <Channel lang={lang} value={r2text} onChange={setR2text} rows={5} maxLength={d.limits?.max || 2500} tok={tok} compact context={{ type: 'whatif', id: c.day || null, skills: c.skill_ids || [], title: c.title_ar, parties: c.parties_ar || [] }} placeholder={ar ? 'قل صراحةً: أثبت على قراري أم أغيّره؟ ولماذا؟ وماذا أفعل الآن…' : 'Say it plainly: do you hold or revise? Why? What now…'} testId="whatif-channel" />
                        <div className="hm-respacts"><button type="button" className="pt-btn gold small" disabled={wiBusy || r2text.trim().length < 40} onClick={() => whatIf(true)}>{wiBusy ? (ar ? 'أقرأ…' : 'Reading…') : (ar ? 'هذا قراري الآن' : 'This is my decision now')}</button>{r2text.trim().length < 40 && <small>{ar ? `${40 - r2text.trim().length} حرفًا بعد` : `${40 - r2text.trim().length} more`}</small>}</div></>}
                  </div>}
                  {r2 && <div className="hm-whatif done" data-testid="round2"><b>{ar ? 'ماذا لو… — الجولة الثانية' : 'What if — round two'} <span className={`hm-stance ${r2.stance}`}>{r2.stance === 'revised' ? (ar ? 'راجعتَ قرارك' : 'Revised') : r2.stance === 'held' ? (ar ? 'ثبتَّ على قرارك' : 'Held') : (ar ? 'غير محسوم' : 'Unclear')}</span><span className="hm-shift" dir="ltr">{r2.shift > 0 ? `+${r2.shift}` : r2.shift}</span></b><p className="hm-wtext">{r2.whatif.text_ar}</p><p>{r2.verdict_ar}</p><p className="hm-wadapt"><Icon name="trend" size={13} /> {r2.adaptability_ar}</p></div>}
                  <div className="pt-chips">{ev.recommend.map((r, k) => <Link key={k} href={r.href} className="pt-btn light small">{r.label_ar}</Link>)}</div>
                  <small className="hm-note">{saved ? (ar ? 'حُفظ ردّك شاهدًا في ملفك المهني (موقف اليوم).' : 'Saved as evidence in your profile.') : (ar ? 'سجّل الدخول ليُحفظ ردّك شاهدًا في ملفك المهني.' : 'Sign in to save this as evidence.')} <Link href="/me/map">{ar ? 'خريطة جداراتي' : 'My competency map'}</Link> · <button type="button" className="hm-linkbtn" onClick={() => setShowMine(v => !v)}>{showMine ? (ar ? 'إخفاء ردّي' : 'Hide my answer') : (ar ? 'عرض ردّي' : 'Show my answer')}</button></small>
                  {showMine && <div className="hm-mine">{text}</div>}
                  <div className="hm-pushrow"><PushOptIn lang={lang} tok={tok} compact /></div>
                </div>
              )}
            </aside>
          </div>
        )}
        {!!d?.upcoming?.length && <div className="hm-upcoming"><small>{ar ? 'مواقف قادمة مرتبطة بمناسبات:' : 'Upcoming event-linked cases:'}</small>{d.upcoming.map(u => <span key={u.code}>{ar ? u.line_ar : u.line_en}</span>)}</div>}
      </div>
    </section>
  );
}

/* ------------------------------------------------ مستشارك: اسأل وأنا أجيب ------------------------------------------------ */
const SUGGEST_AR = ['ما البرامج المفتوحة للتسجيل الآن؟', 'كم رسوم دبلوم إعداد المعلمين؟', 'كيف أثبت مهاراتي بشهادة قابلة للتحقق؟', 'أريد برنامجًا لموظفي جهتي — كيف أبدأ؟', 'ما الفرق بينكم وبين منصات التدريب الأخرى؟'];
const SUGGEST_EN = ['Which programs are enrolling now?', 'How much is the teacher diploma?', 'How do I prove my skills with a verifiable credential?', 'I need a program for my staff — where do I start?', 'How are you different from other training platforms?'];
function Advisor({ lang, tok }: { lang: 'ar' | 'en'; tok: string }) {
  const ar = lang === 'ar'; const [q, setQ] = useState(''); const [busy, setBusy] = useState(false); const [a, setA] = useState<null | { id: string; answer: string; links: { label: string; href: string }[]; handoff: boolean; source: string; q: string }>(null); const [step, setStep] = useState(0);
  const [hand, setHand] = useState(false); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [sent, setSent] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { if (!a) return; setStep(0); const id = setInterval(() => setStep(s => { if (s * 3 >= a.answer.length) { clearInterval(id); return s; } return s + 1; }), 18); return () => clearInterval(id); }, [a]);
  async function ask(text?: string) {
    const question = (text ?? q).trim(); if (question.length < 3 || busy) return; setBusy(true); setErr(''); setSent(''); setHand(false); setQ(question);
    try { const j = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) }, body: JSON.stringify({ question, lang, page: '/#advisor' }) }).then(r => r.json()); if (j?.success) { setA({ id: j.id, answer: j.answer, links: j.links || [], handoff: !!j.handoff, source: j.source, q: question }); if (j.handoff) setHand(true); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
    setBusy(false);
  }
  async function handoff() {
    if (!a) return; setErr('');
    try { const j = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'handoff', question_id: a.id, question: a.q, answer: a.answer, name, email, lang, page: '/#advisor' }) }).then(r => r.json()); if (j?.success) { setSent(ar ? 'وصل سؤالك إلى مستشار بشري — سيجيبك على بريدك خلال يوم عمل.' : 'Your question reached a human advisor — expect a reply within one business day.'); setHand(false); } else setErr(j?.error || 'x'); } catch { setErr('x'); }
  }
  const shown = a ? typewriter(a.answer, step) : '';
  return (
    <section className="pt-sec hm-advisor" id="advisor">
      <div className="pt-wrap">
        <div className="hm-advgrid">
          <div className="hm-advintro">
            <span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? 'مستشارك' : 'Your advisor'}</span>
            <h2>{ar ? 'اسأل… وأنا أجيب' : 'Ask — and I answer'}</h2>
            <p>{ar ? 'إجابات فورية من معلومات أَثَر الحيّة: البرامج المفتوحة، الجلسات القادمة، الرسوم، الشهادات، وخدمات الجهات. وحين يحتاج سؤالك إلى إنسان، أحوّله فورًا إلى مستشار بشري.' : 'Instant answers from Athar’s live data: open programs, upcoming sessions, fees, credentials and services for organizations. When your question needs a human, I hand it over immediately.'}</p>
            <ul className="hm-advrules"><li><Icon name="check" size={14} /> {ar ? 'لا أعد بما ليس موجودًا' : 'No promises beyond the facts'}</li><li><Icon name="check" size={14} /> {ar ? 'أذكر مصدر الإجابة' : 'Every answer shows its source'}</li><li><Icon name="check" size={14} /> {ar ? 'إنسان حقيقي بضغطة زر' : 'A real human one click away'}</li></ul>
            <OnAirLine lang={lang} />
          </div>
          <div className="hm-advbox">
            <form className="hm-ask" onSubmit={e => { e.preventDefault(); ask(); }}>
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={ar ? 'اكتب سؤالك أو تكلّم… مثلًا: هل عندكم برنامج للمعلمين يبدأ قريبًا؟' : 'Type or speak your question…'} maxLength={600} />
              <VoiceButton lang={lang} onText={t => setQ(x => (x ? x + ' ' : '') + t)} />
              <button type="submit" className="pt-btn gold" disabled={busy || q.trim().length < 3}>{busy ? (ar ? 'أفكر…' : 'Thinking…') : (ar ? 'اسأل' : 'Ask')} <Icon name="send" size={15} /></button>
            </form>
            <div className="hm-suggest">{(ar ? SUGGEST_AR : SUGGEST_EN).map(s => <button key={s} type="button" onClick={() => ask(s)} disabled={busy}>{s}</button>)}</div>
            {busy && <div className="hm-think"><i /><i /><i /> {ar ? 'أراجع البرامج والجلسات الحالية…' : 'Checking current programs and sessions…'}</div>}
            {a && !busy && (
              <div className="hm-answer">
                <div className="hm-anshead"><b>{ar ? 'مستشارك' : 'Advisor'}</b><span className={`hm-src ${a.source}`}>{a.source === 'ai' ? (ar ? 'ذكاء اصطناعي من بيانات حيّة' : 'AI on live data') : (ar ? 'إجابة من قاعدة المعرفة' : 'Knowledge base')}</span></div>
                <p>{shown}{shown.length < a.answer.length && <i className="hm-caret" />}</p>
                {shown.length >= a.answer.length && !!a.links.length && <div className="pt-chips">{a.links.map((l, k) => <Link key={k} href={l.href} className="pt-btn light small">{l.label}</Link>)}</div>}
                {shown.length >= a.answer.length && !sent && <div className="hm-human">{a.handoff ? <b>{ar ? 'هذا السؤال يستحق إنسانًا:' : 'This one deserves a human:'}</b> : <span>{ar ? 'لم تكفِك الإجابة؟' : 'Not enough?'}</span>} <button type="button" className="pt-btn outline dark small" onClick={() => setHand(h => !h)}>{ar ? 'أريد إجابة من مستشار بشري' : 'I want a human advisor'}</button></div>}
                {hand && !sent && <div className="hm-handform"><input value={name} onChange={e => setName(e.target.value)} placeholder={ar ? 'الاسم' : 'Name'} maxLength={120} /><input value={email} onChange={e => setEmail(e.target.value)} placeholder={ar ? 'البريد الإلكتروني' : 'Email'} type="email" maxLength={160} /><button type="button" className="pt-btn small" onClick={handoff} disabled={!email}>{ar ? 'حوّل سؤالي' : 'Send to a human'}</button></div>}
                {sent && <div className="hm-ok"><Icon name="check" size={15} /> {sent}</div>}
              </div>
            )}
            {err && <div className="hm-err">{err === 'x' ? (ar ? 'تعذّر الاتصال، حاول مجددًا.' : 'Connection failed, try again.') : err}</div>}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------ جلسة حوار: محاكاة فورية + الجلسة القادمة ------------------------------------------------ */
// P14-أ — «الذاكرة الحية»: ثلاثة خيوط أثر مجهّلة لليوم من قاعدة الأدلة المؤسسية (مجموعات ≥ 5 فقط · بلا أسماء) + درس الأسبوع المعتمد. تختفي كليًا إن لم تكن هناك خيوط.
type MemThread = { icon: 'spark' | 'compass' | 'target'; text_ar: string; text_en: string };
function Embassy({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar';
  return (
    <section className="pt-sec hm-embsec"><div className="pt-wrap">
      <a className="hm-embassy" href="/agents#mcp" data-testid="home-embassy"><span className="hm-embk"><Icon name="link" size={14} /> {ar ? 'سفارة أَثَر · MCP' : 'Athar Embassy · MCP'}</span><b>{ar ? 'أَثَر داخل مساعدك الذكي' : 'Athar inside your AI assistant'}</b><p>{ar ? 'الصق رابطًا واحدًا في ChatGPT أو Claude أو وكيل جهتك: يتحقق من الشهادات، يقرأ مؤشر الأداء، يرشّح برنامجًا بدليل — ومحفظتك بإذنك أنت.' : 'Paste one link into ChatGPT, Claude or your organization’s agent: verify credentials, read the performance index, recommend by evidence — and your wallet, with your consent.'}</p><code dir="ltr">athar-portal.vercel.app/mcp</code></a>
    </div></section>
  );
}

function Memory({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar'; const [d, setD] = useState<null | { threads: MemThread[]; lesson: { week: string; title_ar: string; body_ar: string } | null; nodes: number }>(null); const [shown, setShown] = useState(0);
  useEffect(() => { fetch('/api/evidence?threads=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success && Array.isArray(j.threads) && j.threads.length) setD({ threads: j.threads.slice(0, 3), lesson: j.lesson || null, nodes: j.nodes || 0 }); }).catch(() => {}); }, []);
  useEffect(() => { if (!d) return; setShown(0); const id = setInterval(() => setShown(s => { if (s >= d.threads.length) { clearInterval(id); return s; } return s + 1; }), 650); return () => clearInterval(id); }, [d]);
  if (!d) return null;
  const ICON: Record<MemThread['icon'], 'star' | 'compass' | 'target'> = { spark: 'star', compass: 'compass', target: 'target' };
  return (
    <section className="pt-sec hm-memory" id="memory" data-testid="home-memory">
      <div className="pt-wrap">
        <div className="hm-sechead"><div><span className="pt-kicker"><Icon name="compass" size={14} /> {ar ? 'الذاكرة الحية · قاعدة الأدلة المؤسسية' : 'Living memory · institutional evidence base'}</span><h2>{ar ? 'ثلاثة خيوط أثر من ذاكرة أَثَر اليوم' : 'Three threads of impact from Athar’s memory today'}</h2><p className="hm-dailysub">{ar ? `كل برنامج وجلسة وشهادة تُنسج في شبكة معرفية حيّة من ${d.nodes} عقدة؛ نعرض منها يوميًا ما تثبته مجموعات لا أفراد — بلا أسماء.` : `Every program, session and credential is woven into a living graph of ${d.nodes} nodes; each day we surface what groups — never individuals — have proven.`}</p></div><Link href="/agents" className="hm-memlink">{ar ? 'للوكلاء: المكتب الزجاجي ←' : 'For agents: the glass office →'}</Link></div>
        <div className="hm-threads">{d.threads.map((th, i) => <article key={i} className={`hm-thread ${i < shown ? 'in' : ''}`}><span className={`hm-thicon ${th.icon}`}><Icon name={ICON[th.icon]} size={18} /></span><p>{ar ? th.text_ar : th.text_en}</p><small>{ar ? 'دليل مجمّع · مجموعة ≥ 5' : 'Aggregated evidence · group ≥ 5'}</small></article>)}</div>
        {d.lesson && <aside className="hm-lesson"><span className="hm-lessonk">{ar ? `درس الأسبوع · ${d.lesson.week}` : `Lesson of the week · ${d.lesson.week}`}</span><b>{d.lesson.title_ar}</b><p>{d.lesson.body_ar}</p><small>{ar ? 'صاغته الذاكرة واعتمده إنسان' : 'Drafted from memory, approved by a human'}</small></aside>}
      </div>
    </section>
  );
}

function Dialogue({ lang, tok, sessions, now }: { lang: 'ar' | 'en'; tok: string; sessions: FeedSession[]; now: number }) {
  const ar = lang === 'ar'; const s = DEMO_SCENARIO; const [turns, setTurns] = useState<Turn[]>([]); const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [score, setScore] = useState<SimScore | null>(null); const [started, setStarted] = useState(false); const listRef = useRef<HTMLDivElement>(null);
  const next = sessions.filter(x => Date.parse(x.starts_at) > now - 3600000).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]; const cd = next ? countdown(next.starts_at, now, lang) : null;
  const [qs, setQs] = useState(''); const [qEmail, setQEmail] = useState(''); const [qSent, setQSent] = useState('');
  const [roomBusy, setRoomBusy] = useState(false); const [roomErr, setRoomErr] = useState(''); const [joinCode, setJoinCode] = useState('');
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [turns, score]);
  async function openRoom() { if (!tok || roomBusy) return; setRoomBusy(true); setRoomErr(''); try { const j = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'create', kind: 'dialogue', minutes: 15 }) }).then(r => r.json()); if (j?.success && j.room?.code) { window.location.href = `/room/${j.room.code}`; return; } setRoomErr(j?.error || (ar ? 'تعذّر فتح الغرفة' : 'Could not open the room')); } catch { setRoomErr(ar ? 'انقطع الاتصال' : 'Network error'); } setRoomBusy(false); }
  const hdr = () => ({ 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) });
  async function start() { setStarted(true); setScore(null); setBusy(true); try { const j = await fetch('/api/sim', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'start', scenario: 'dad-dha' }) }).then(r => r.json()); setTurns(j?.success ? j.run.turns : [{ role: 'persona', text: s.persona.opening_ar, at: new Date().toISOString() }]); } catch { setTurns([{ role: 'persona', text: s.persona.opening_ar, at: new Date().toISOString() }]); } setBusy(false); }
  async function reply() {
    const v = text.trim(); if (v.length < 2 || busy) return; setText(''); setBusy(true); const mine: Turn[] = [...turns, { role: 'learner', text: v, at: new Date().toISOString() }]; setTurns(mine);
    try { const j = await fetch('/api/sim', { method: 'POST', headers: hdr(), body: JSON.stringify({ action: 'turn', scenario: 'dad-dha', turns, text: v }) }).then(r => r.json()); if (j?.success) { setTurns(j.turns); if (j.finished) setScore(j.score); } else setTurns([...mine, { role: 'persona', text: j?.error || '…', at: new Date().toISOString() }]); } catch { setTurns([...mine, { role: 'persona', text: ar ? 'انقطع الاتصال لحظة…' : 'Connection hiccup…', at: new Date().toISOString() }]); }
    setBusy(false);
  }
  async function sendQ() { if (qs.trim().length < 5 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(qEmail)) return; try { const j = await fetch('/api/advisor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'handoff', question: `[سؤال لجلسة الحوار${next ? `: ${next.title_ar}` : ''}] ${qs.trim()}`, email: qEmail, lang, page: '/#dialogue' }) }).then(r => r.json()); if (j?.success) { setQSent(ar ? 'وصل سؤالك — سيُطرح في الجلسة أو يجيبك الضيف كتابةً.' : 'Received — it will be raised in the session or answered in writing.'); setQs(''); } } catch { /* ignore */ } }
  const myTurns = turns.filter(x => x.role === 'learner').length;
  return (
    <section className="pt-sec navy hm-dialogue" id="dialogue">
      <div className="pt-wrap">
        <div className="hm-sechead light"><div><span className="pt-kicker"><Icon name="users" size={14} /> {ar ? 'جلسة حوار' : 'Dialogue session'}</span><h2>{ar ? 'حوار يُدرّبك الآن… وحوار يجمعك بخبير قريبًا' : 'A dialogue that trains you now — and one with an expert soon'}</h2></div></div>
        <div className="hm-dlggrid">
          <div className="hm-simbox">
            <div className="hm-simhead"><div><small>{ar ? 'حوار تدريبي فوري · بلا تسجيل' : 'Instant practice dialogue · no sign‑up'}</small><b>{s.title_ar}</b></div><span className="hm-chip gold">{s.minutes} {ar ? 'دقائق' : 'min'} · {s.max_turns} {ar ? 'أدوار' : 'turns'}</span></div>
            {!started ? (
              <div className="hm-simintro"><p><b>{ar ? 'الموقف:' : 'Situation:'}</b> {s.situation_ar}</p><p><b>{ar ? 'هدفك:' : 'Your goal:'}</b> {s.goal_ar}</p><div className="hm-rubric">{s.rubric.map(r => <span key={r.key}>{r.title_ar} <b>{r.weight}%</b></span>)}</div><button type="button" className="pt-btn gold" onClick={start}><Icon name="play" size={15} /> {ar ? 'ادخل الصف الآن' : 'Enter the classroom'}</button></div>
            ) : (
              <>
                <div className="hm-simlist" ref={listRef}>
                  {turns.map((tn, k) => <div key={k} className={`hm-turn ${tn.role}`}><small>{tn.role === 'persona' ? s.persona.name : (ar ? 'أنت' : 'You')}</small><div>{tn.text}</div></div>)}
                  {busy && <div className="hm-turn persona"><small>{s.persona.name}</small><div className="hm-think"><i /><i /><i /></div></div>}
                  {score && (
                    <div className="hm-score">
                      <div className="hm-scorehead"><b>{score.total}<small>/100</small></b><div><span>{bandLabel(score.total, lang)}</span><small>{ar ? 'تقييم أولي بمعيار معلن — يعتمده مدرب بشري في النسخة الكاملة' : 'Preliminary rubric score — approved by a human trainer in the full version'}</small></div></div>
                      <div className="hm-crit">{score.criteria.map(c => { const r = s.rubric.find(x => x.key === c.key); return <div key={c.key}><span>{r?.title_ar || c.key}</span><i><b style={{ width: `${c.score}%` }} /></i><em>{c.score}</em></div>; })}</div>
                      {!!score.improve.length && <p><b>{ar ? 'لتتحسن:' : 'To improve:'}</b> {score.improve[0]}</p>}
                      <div className="pt-chips"><Link href="/sim" className="pt-btn gold small">{ar ? 'كل المحاكيات' : 'All simulators'}</Link><Link href="/me" className="pt-btn light small">{ar ? 'سجّل الدخول ليُحفظ الدليل' : 'Sign in to keep the evidence'}</Link><button type="button" className="pt-btn outline small" onClick={start}>{ar ? 'أعد المحاولة' : 'Try again'}</button></div>
                    </div>
                  )}
                </div>
                {!score && <form className="hm-simform" onSubmit={e => { e.preventDefault(); reply(); }}><input value={text} onChange={e => setText(e.target.value)} placeholder={ar ? `ردّك على ${s.persona.name}… (الدور ${myTurns + 1} من ${s.max_turns})` : `Your reply… (${myTurns + 1}/${s.max_turns})`} maxLength={600} disabled={busy} /><button type="submit" className="pt-btn gold" disabled={busy || text.trim().length < 2}><Icon name="send" size={15} /></button></form>}
              </>
            )}
          </div>
          <div className="hm-nextbox">
            <small className="hm-eyebrow">{ar ? 'الجلسة الحوارية القادمة' : 'Next live dialogue'}</small>
            {next ? (
              <>
                <h3>{(lang === 'en' && next.title_en) || next.title_ar}</h3>
                <p className="hm-nextmeta">{next.speaker_name && <span><Icon name="users" size={14} /> {next.speaker_name}</span>}<span><Icon name="calendar" size={14} /> {new Date(next.starts_at).toLocaleString(ar ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' })}</span>{cd && <span className="hm-chip gold">{cd.label}</span>}</p>
                {next.description_ar && <p className="hm-nextdesc">{next.description_ar.slice(0, 220)}</p>}
                <div className="pt-chips"><Link href={`/live/${next.id}`} className="pt-btn gold small">{cd?.past ? (ar ? 'ادخل الآن' : 'Join now') : (ar ? 'احجز مقعدك مجانًا' : 'Reserve a free seat')}</Link><Link href="/live" className="pt-btn light small">{ar ? 'كل الجلسات' : 'All sessions'}</Link></div>
              </>
            ) : (
              <><h3>{ar ? 'نُعدّ الجلسة القادمة' : 'Next session is being prepared'}</h3><p className="hm-nextdesc">{ar ? 'جلسات حوارية مباشرة مع خبراء في تعليم العربية وتصميم التدريب وقياس الأثر. اترك سؤالك وسنبني الجلسة حوله.' : 'Live dialogues with experts in Arabic teaching, training design and impact measurement. Leave your question and we will build the session around it.'}</p><div className="pt-chips"><Link href="/live" className="pt-btn light small">{ar ? 'جدول الجلسات' : 'Schedule'}</Link></div></>
            )}
            <div className="hm-roombox" data-testid="roombox">
              <b><Icon name="users" size={15} /> {ar ? 'غرفة أَثَر الصغيرة — فيديو من داخل المنصة' : 'Athar small room — in-platform video'}</b>
              <p>{ar ? 'حتى 6 أشخاص، بلا تطبيق ولا رابط خارجي: افتح غرفة حوار الآن وشارك رمزها، أو ادخل برمز وصلك.' : 'Up to 6 people, no app or external link: open a dialogue room now and share its code, or join with a code.'}</p>
              <div className="hm-roomrow">
                {tok ? <button type="button" className="pt-btn gold small" onClick={openRoom} disabled={roomBusy}>{roomBusy ? (ar ? 'نفتح الغرفة…' : 'Opening…') : (ar ? 'افتح غرفة حوار الآن' : 'Open a room now')}</button> : <Link href="/me" className="pt-btn gold small">{ar ? 'سجّل الدخول لفتح غرفة' : 'Sign in to open a room'}</Link>}
                <form className="hm-joinform" onSubmit={e => { e.preventDefault(); const c = joinCode.trim().toUpperCase(); if (/^[A-HJ-NP-Z2-9]{6}$/.test(c)) window.location.href = `/room/${c}`; }}><input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder={ar ? 'رمز الغرفة' : 'Room code'} maxLength={6} dir="ltr" /><button type="submit" className="pt-btn light small" disabled={joinCode.trim().length !== 6}>{ar ? 'ادخل' : 'Join'}</button></form>
              </div>
              {roomErr && <small className="hm-err">{roomErr}</small>}
            </div>
            <div className="hm-askguest">
              <b>{ar ? 'اطرح سؤالك على الضيف مسبقًا' : 'Ask the guest in advance'}</b>
              {qSent ? <div className="hm-ok light"><Icon name="check" size={14} /> {qSent}</div> : <><textarea value={qs} onChange={e => setQs(e.target.value)} rows={2} maxLength={400} placeholder={ar ? 'سؤالك…' : 'Your question…'} /><div className="hm-askrow"><input value={qEmail} onChange={e => setQEmail(e.target.value)} type="email" placeholder={ar ? 'بريدك للرد' : 'Email for reply'} /><button type="button" className="pt-btn gold small" onClick={sendQ} disabled={qs.trim().length < 5 || !qEmail}>{ar ? 'أرسل' : 'Send'}</button></div></>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.hm-memory{background:linear-gradient(180deg,#f6f8fb,#eef5f4);padding:56px 0}.hm-memlink{font-size:13px;font-weight:800;color:#0b8a83;white-space:nowrap}
.hm-threads{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}@media(max-width:820px){.hm-threads{grid-template-columns:1fr}}
.hm-thread{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px 18px 14px;display:grid;gap:8px;align-content:start;opacity:0;transform:translateY(10px);transition:opacity .5s,transform .5s}.hm-thread.in{opacity:1;transform:none}
.hm-thread p{margin:0;font-size:15px;line-height:1.8;color:#0f2a4e;font-weight:700}.hm-thread small{color:#94a3b8;font-size:11.5px}
.hm-thicon{width:38px;height:38px;border-radius:12px;display:inline-flex;align-items:center;justify-content:center;color:#fff;background:#0b8a83}.hm-thicon.spark{background:#c9a24b;color:#0f2a4e}.hm-thicon.target{background:#0f2a4e}
.hm-lesson{margin-top:16px;background:#0f2a4e;color:#fff;border-radius:18px;padding:18px 22px;display:grid;gap:6px}.hm-lessonk{font-size:12px;font-weight:900;color:#c9a24b}.hm-lesson b{font-size:17px}.hm-lesson p{margin:0;font-size:14px;line-height:1.8;color:#e2e8f0}.hm-lesson small{color:#94a3b8;font-size:11.5px}
.hm .hm-word{display:inline-block;animation:hmWord .6s ease}@keyframes hmWord{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.hm-hero.pt-hero{padding:64px 0 72px}.hm-hero .pt-herogrid{grid-template-columns:1.05fr .95fr;align-items:start}
.hm-counters{display:flex;gap:18px;flex-wrap:wrap;margin-top:28px}.hm-counters div{display:grid}.hm-counters b{font-size:26px;font-weight:900;color:#c9a24b;line-height:1}.hm-counters span{font-size:12px;color:rgba(255,255,255,.75)}
.hm-stage{position:relative;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:24px;padding:16px;backdrop-filter:blur(6px)}
.hm-stagehead{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.hm-live{display:inline-flex;align-items:center;gap:7px;font-weight:900;font-size:13px;color:#fff}.hm-live i{width:9px;height:9px;border-radius:50%;background:#c9a24b;box-shadow:0 0 0 0 rgba(201,162,75,.6);animation:hmPing 1.6s infinite}@keyframes hmPing{0%{box-shadow:0 0 0 0 rgba(201,162,75,.6)}100%{box-shadow:0 0 0 10px rgba(201,162,75,0)}}
.hm-dots{display:flex;gap:5px}.hm-dots button{width:8px;height:8px;border-radius:50%;border:0;background:rgba(255,255,255,.35);cursor:pointer;padding:0}.hm-dots button.on{background:#c9a24b;width:20px;border-radius:4px}
.hm-stagecard{border-radius:18px;padding:22px;min-height:230px;display:flex;flex-direction:column;gap:10px;align-items:flex-start;animation:hmWord .5s ease;color:#fff}
.hm-stagecard.navy{background:linear-gradient(135deg,#0f2a4e,#1b4a80)}.hm-stagecard.teal{background:linear-gradient(135deg,#0b8a83,#0f766e)}.hm-stagecard.gold{background:linear-gradient(135deg,#9a6b00,#c9a24b);color:#0f172a}.hm-stagecard.plum{background:linear-gradient(135deg,#3b1d5e,#6d3fa0)}
.hm-badge{font-size:11.5px;font-weight:900;padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.2)}.hm-stagecard h3{margin:0;font-size:21px;line-height:1.4;font-weight:900}.hm-stagecard p{margin:0;font-size:13.5px;opacity:.9;line-height:1.7}
.hm-cd{display:flex;gap:8px;margin:4px 0}.hm-cd span{display:grid;justify-items:center;min-width:52px;padding:6px 4px;border-radius:10px;background:rgba(255,255,255,.15)}.hm-cd b{font-size:20px;font-weight:900;line-height:1}.hm-cd small{font-size:10.5px;opacity:.85}
.hm-stagefoot{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.hm-stagefoot button{text-align:start;background:transparent;border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:7px 8px;color:#fff;cursor:pointer;font:inherit;display:grid;gap:2px;min-width:0}.hm-stagefoot button.on{background:rgba(255,255,255,.14)}.hm-stagefoot small{font-size:10px;color:#c9a24b;font-weight:800}.hm-stagefoot span{font-size:11.5px;line-height:1.4;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.hm-embsec{padding:0 0 36px}.hm-embassy{display:grid;gap:6px;padding:16px 18px;border-radius:16px;background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;text-decoration:none;border:1px solid rgba(255,255,255,.18)}.hm-embassy b{font-size:16px}.hm-embassy p{margin:0;font-size:13.5px;line-height:1.8;color:#e2e8f0;max-width:760px}.hm-embk{font-size:12px;font-weight:900;color:#f6e2a8;display:inline-flex;gap:6px;align-items:center}.hm-embassy code{justify-self:start;background:rgba(255,255,255,.12);border-radius:8px;padding:4px 10px;font-size:12.5px;color:#fff}
.hm-sechead{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:26px}.hm-sechead h2{margin:4px 0 0;font-size:28px;color:#0f2a4e;font-weight:900}.hm-sechead.light h2{color:#fff}.hm-sechead.light .pt-kicker{color:#c9a24b}
.hm-streak{display:grid;justify-items:center;padding:10px 18px;border-radius:16px;background:#fff7e6;border:1px solid #f1dfae}.hm-streak b{font-size:28px;font-weight:900;color:#9a6b00;line-height:1}.hm-streak span{font-size:12px;color:#9a6b00}.hm-streak small{font-size:11px;color:#64748b}
.hm-skel{height:220px;border-radius:20px;background:linear-gradient(90deg,#eef2f7,#f8fafc,#eef2f7);background-size:200% 100%;animation:hmSk 1.4s infinite}@keyframes hmSk{to{background-position:-200% 0}}
.hm-dailygrid{display:grid;grid-template-columns:1.1fr .9fr;gap:20px}
.hm-lesson{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:26px}.hm-lessonmeta{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.hm-chip{font-size:11.5px;font-weight:800;padding:4px 10px;border-radius:999px;background:#eef2f7;color:#334155}.hm-chip.navy{background:#0f2a4e;color:#fff}.hm-chip.gold{background:#fdf6e3;color:#9a6b00}.hm-chip.teal{background:#e6f4f1;color:#0b8a83}
.hm-lesson h3{margin:0 0 10px;font-size:24px;color:#0f2a4e;font-weight:900;line-height:1.4}.hm-hook{font-size:16px;color:#0b8a83;font-weight:700;line-height:1.8;margin:0 0 10px}.hm-idea{font-size:15px;line-height:1.95;color:#1e293b;margin:0}
.hm-more{margin-top:12px;background:none;border:0;color:#0b8a83;font:inherit;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:0}.hm-example{margin-top:10px;background:#f3fbfa;border:1px solid #cfe9e6;border-radius:14px;padding:14px 16px;font-size:14.5px;line-height:1.9;color:#0f172a;white-space:pre-wrap}
.hm-challenge{background:#0f2a4e;color:#fff;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:12px}.hm-chhead{display:flex;justify-content:space-between;align-items:center}.hm-chhead b{font-size:17px}.hm-challenge>p{margin:0;font-size:14px;line-height:1.8;opacity:.9}
.hm-ring circle{fill:none;stroke:rgba(255,255,255,.2);stroke-width:4}.hm-ring circle+circle{stroke:#c9a24b;stroke-linecap:round;transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 1s linear}.hm-ring text{fill:#fff;font-size:14px;font-weight:900}
.hm-q{margin:0;font-size:16px;font-weight:800;line-height:1.7}.hm-opts{display:grid;gap:8px}.hm-opts button{display:flex;gap:10px;align-items:flex-start;text-align:start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;line-height:1.6;cursor:pointer}.hm-opts button:hover:not(:disabled){background:rgba(255,255,255,.16)}.hm-opts button i{flex:none;width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,.15);display:inline-flex;align-items:center;justify-content:center;font-style:normal;font-weight:900;font-size:12px}
.hm-opts button.ok{background:#0b8a83;border-color:#0b8a83}.hm-opts button.bad{background:#7f1d1d;border-color:#7f1d1d}.hm-opts button.sel{border-color:#c9a24b}
.hm-verdict{background:#fff;color:#0f172a;border-radius:14px;padding:14px 16px;display:grid;gap:8px}.hm-verdict b{color:#0b8a83;font-size:15px}.hm-verdict.bad>b{color:#b91c1c}.hm-verdict p{margin:0;font-size:14px;line-height:1.8}.hm-apply{display:flex;gap:8px;align-items:flex-start;background:#fdf6e3;border-radius:10px;padding:8px 10px;font-size:13.5px;line-height:1.7;color:#7c5a00}.hm-verdict small{color:#64748b;font-size:12px}.hm-verdict small a{color:#0b8a83}
.hm-advgrid{display:grid;grid-template-columns:.8fr 1.2fr;gap:28px;align-items:start}.hm-advintro h2{margin:4px 0 10px;font-size:30px;color:#0f2a4e;font-weight:900}.hm-advintro p{font-size:15px;line-height:1.9;color:#334155}.hm-advrules{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:6px;font-size:13.5px;color:#0b8a83;font-weight:700}.hm-advrules li{display:flex;gap:6px;align-items:center}
.hm-advbox{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:20px;box-shadow:0 20px 50px rgba(15,42,78,.08)}.hm-ask{display:flex;gap:8px}.hm-ask input{flex:1;min-width:0;border:2px solid #cbd5e1;border-radius:14px;padding:13px 14px;font:inherit;font-size:15px}.hm-ask input:focus{border-color:#0b8a83;outline:none}
.hm-suggest{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.hm-suggest button{border:1px solid #cfe9e6;background:#f3fbfa;color:#0b8a83;border-radius:999px;padding:6px 11px;font:inherit;font-size:12.5px;cursor:pointer}.hm-suggest button:hover:not(:disabled){background:#0b8a83;color:#fff}
.hm-think{display:flex;align-items:center;gap:5px;margin-top:14px;font-size:13px;color:#64748b}.hm-think i{width:7px;height:7px;border-radius:50%;background:#0b8a83;animation:atDot 1s infinite}.hm-think i:nth-child(2){animation-delay:.15s}.hm-think i:nth-child(3){animation-delay:.3s}@keyframes atDot{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
.hm-answer{margin-top:16px;border-top:1px dashed #e2e8f0;padding-top:14px}.hm-anshead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}.hm-anshead b{color:#0f2a4e}.hm-src{font-size:11px;padding:2px 8px;border-radius:999px;background:#e2e8f0;color:#475569}.hm-src.ai{background:#0b8a83;color:#fff}
.hm-answer p{margin:0 0 10px;font-size:15.5px;line-height:1.95;color:#0f172a;white-space:pre-wrap;min-height:28px}.hm-caret{display:inline-block;width:2px;height:18px;background:#0b8a83;vertical-align:-3px;animation:hmBlink .8s infinite}@keyframes hmBlink{50%{opacity:0}}
.hm-human{margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:13.5px;color:#334155}.hm-human b{color:#9a6b00}.hm-handform{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.hm-handform input{flex:1;min-width:160px;border:1px solid #cbd5e1;border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px}
.hm-ok{margin-top:10px;display:flex;gap:6px;align-items:center;color:#0b8a83;font-weight:700;font-size:13.5px}.hm-ok.light{color:#7fd7cf}.hm-err{margin-top:10px;color:#b91c1c;font-size:13px}
.pt-btn.outline.dark{border-color:#0f2a4e;color:#0f2a4e}.pt-btn.outline.dark:hover{background:#0f2a4e;color:#fff}
.hm-dlggrid{display:grid;grid-template-columns:1.15fr .85fr;gap:20px;align-items:start}
.hm-simbox{background:#fff;color:#0f172a;border-radius:22px;overflow:hidden;display:flex;flex-direction:column;min-height:420px}.hm-simhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:14px 18px;background:#f8fafc;border-bottom:1px solid #e2e8f0}.hm-simhead small{display:block;font-size:11.5px;color:#0b8a83;font-weight:800}.hm-simhead b{font-size:16px;color:#0f2a4e}
.hm-simintro{padding:20px;display:grid;gap:10px;font-size:14.5px;line-height:1.85}.hm-simintro p{margin:0}.hm-rubric{display:flex;gap:6px;flex-wrap:wrap}.hm-rubric span{font-size:12px;background:#eef2f7;border-radius:999px;padding:4px 10px;color:#334155}.hm-rubric b{color:#0b8a83}
.hm-simlist{flex:1;overflow:auto;max-height:420px;padding:16px 18px;display:grid;gap:10px;align-content:start;background:#f8fafc}.hm-turn{display:grid;gap:3px;justify-items:start;max-width:92%}.hm-turn.learner{justify-self:end;justify-items:end}.hm-turn small{font-size:11px;color:#64748b;font-weight:800}.hm-turn>div{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:9px 12px;font-size:14.5px;line-height:1.75}.hm-turn.learner>div{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.hm-turn .hm-think{margin:0;padding:4px 2px}
.hm-simform{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #e2e8f0;background:#fff}.hm-simform input{flex:1;min-width:0;border:1px solid #cbd5e1;border-radius:12px;padding:11px 12px;font:inherit;font-size:14.5px}
.hm-score{max-width:100%;background:#fff;border:1px solid #cfe9e6;border-radius:16px;padding:14px 16px;display:grid;gap:10px;animation:hmWord .5s ease}.hm-scorehead{display:flex;gap:14px;align-items:center}.hm-scorehead>b{font-size:38px;font-weight:900;color:#0b8a83;line-height:1}.hm-scorehead>b small{font-size:14px;color:#94a3b8}.hm-scorehead span{display:block;font-weight:900;color:#0f2a4e}.hm-scorehead small{display:block;font-size:12px;color:#64748b;line-height:1.5}
.hm-crit{display:grid;gap:6px}.hm-crit div{display:grid;grid-template-columns:150px 1fr 36px;gap:8px;align-items:center;font-size:12.5px}.hm-crit i{height:8px;border-radius:4px;background:#e2e8f0;overflow:hidden;display:block}.hm-crit i b{display:block;height:100%;background:linear-gradient(90deg,#0b8a83,#c9a24b);border-radius:4px;transition:width 1s ease}.hm-crit em{font-style:normal;font-weight:800;color:#0f2a4e;text-align:end}.hm-score p{margin:0;font-size:13.5px;line-height:1.7;color:#334155}
.hm-nextbox{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:22px;padding:22px;display:grid;gap:10px;align-content:start}.hm-eyebrow{font-size:12px;font-weight:900;color:#c9a24b}.hm-nextbox h3{margin:0;font-size:22px;line-height:1.45;font-weight:900}.hm-nextmeta{margin:0;display:flex;gap:12px;flex-wrap:wrap;font-size:13px;opacity:.95;align-items:center}.hm-nextmeta span{display:inline-flex;gap:5px;align-items:center}.hm-nextdesc{margin:0;font-size:14px;line-height:1.8;opacity:.9}
.hm-roombox{margin-top:8px;padding:12px 14px;border:1px solid rgba(201,162,75,.45);background:rgba(201,162,75,.08);border-radius:14px;display:grid;gap:8px}.hm-roombox b{display:flex;align-items:center;gap:6px;font-size:14px}.hm-roombox p{margin:0;font-size:13px;color:rgba(255,255,255,.8);line-height:1.7}.hm-roomrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.hm-joinform{display:flex;gap:6px}.hm-joinform input{width:110px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.08);color:#fff;border-radius:10px;padding:7px 10px;font:inherit;font-weight:800;letter-spacing:.12em;text-align:center}.hm-readrow{margin:-4px 0 8px}
.hm-askguest{margin-top:8px;padding-top:14px;border-top:1px dashed rgba(255,255,255,.2);display:grid;gap:8px}.hm-askguest b{font-size:14px}.hm-askguest textarea,.hm-askrow input{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:12px;padding:9px 11px;font:inherit;font-size:13.5px;resize:vertical}.hm-askguest textarea::placeholder,.hm-askrow input::placeholder{color:rgba(255,255,255,.6)}.hm-askrow{display:flex;gap:6px}.hm-askrow input{flex:1;min-width:0}
.hm-trace .hm-tracehead{text-align:center;margin-bottom:22px}.hm-trace h2{margin:4px 0 0;font-size:26px;color:#0f2a4e;font-weight:900}
.hm-tracerow{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;max-width:760px;margin:0 auto 18px}.hm-tracecell{display:grid;justify-items:center;gap:4px;padding:14px 8px;border-radius:16px;background:#fff;border:1px solid #e2e8f0;text-decoration:none;color:#0f2a4e;transition:transform .2s,border-color .2s}.hm-tracecell:hover{transform:translateY(-3px);border-color:#0b8a83}.hm-tracecell b{font-size:26px;color:#0b8a83;line-height:1}.hm-tracecell span{font-size:12.5px;font-weight:700}
.hm-services{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:28px}.hm-svc{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;border:1px solid #e2e8f0;background:#fff;color:#0f2a4e;font-size:13.5px;font-weight:700;text-decoration:none}.hm-svc:hover{border-color:#0b8a83;color:#0b8a83}
.hm-final{display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;background:linear-gradient(135deg,#0f2a4e,#0b6b66);color:#fff;border-radius:24px;padding:26px 30px}.hm-final b{display:block;font-size:20px;font-weight:900}.hm-final small{display:block;font-size:13.5px;opacity:.85;margin-top:4px;max-width:560px;line-height:1.7}.hm-final .pt-btn.outline.dark{border-color:#fff;color:#fff}.hm-final .pt-btn.outline.dark:hover{background:#fff;color:#0f2a4e}

.hm-dailysub{margin:8px 0 0;max-width:720px;font-size:14.5px;line-height:1.9;color:#475569}
.hm-event{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:-8px 0 18px;padding:10px 16px;border-radius:14px;background:#fdf6e3;border:1px solid #f1dfae;color:#7c5a00;font-size:14px}.hm-event span{color:#92400e}.hm-event.national{background:#eefaf5;border-color:#bfe7d7;color:#065f46}
.hm-casegrid{display:grid;grid-template-columns:1.15fr .85fr;gap:20px;align-items:start}
.hm-case{background:#fff;border:1px solid #e2e8f0;border-radius:22px;padding:26px}.hm-case h3{margin:0 0 10px;font-size:25px;color:#0f2a4e;font-weight:900;line-height:1.4}
.hm-scene{display:flex;gap:6px;align-items:flex-start;margin:0 0 8px;font-size:14px;color:#64748b;font-style:italic;line-height:1.8}
.hm-role{display:inline-block;margin:0 0 12px;padding:5px 12px;border-radius:999px;background:#0f2a4e;color:#fff;font-size:13px;font-weight:800}
.hm-situation{font-size:16px;line-height:2;color:#1e293b;margin:0 0 12px}
.hm-parties{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:12px}.hm-parties small{color:#64748b;font-weight:800}.hm-parties span{font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;border:1px dashed #94a3b8;color:#334155}
.hm-ask{background:#f3fbfa;border:1px solid #cfe9e6;border-radius:14px;padding:14px 16px}.hm-ask b{display:block;color:#0b8a83;margin-bottom:4px}.hm-ask p{margin:0;font-size:15px;line-height:1.9;color:#0f172a;font-weight:700}
.hm-twist{margin-top:12px;background:#fff7ed;border:1px solid #fed7aa;border-radius:14px;padding:14px 16px}.hm-twist b{display:block;color:#9a3412;margin-bottom:4px}.hm-twist p{margin:0;font-size:14.5px;line-height:1.9;color:#7c2d12}
.hm-respond{background:#0f2a4e;color:#fff;border-radius:22px;padding:24px;display:flex;flex-direction:column;gap:12px}
.hm-respond textarea{width:100%;box-sizing:border-box;border-radius:14px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;padding:14px;font:inherit;font-size:15px;line-height:1.9;resize:vertical;min-height:200px}.hm-respond textarea::placeholder{color:rgba(255,255,255,.5)}.hm-respond textarea:focus{outline:2px solid #c9a24b;background:rgba(255,255,255,.12)}
.hm-hints{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:12.5px;color:rgba(255,255,255,.75)}.hm-hints li{display:flex;gap:6px;align-items:center}
.hm-respacts{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.hm-respacts small{color:rgba(255,255,255,.7)}
.hm-think.light{color:rgba(255,255,255,.85)}.hm-think.light i{background:#c9a24b}
.hm-note{font-size:12.5px;color:rgba(255,255,255,.7);line-height:1.8}.hm-note a{color:#f1dfae}.hm-linkbtn{background:none;border:0;color:#f1dfae;font:inherit;font-size:12.5px;cursor:pointer;text-decoration:underline;padding:0}
.hm-mirror{display:grid;gap:12px}.hm-mirrorhead{display:flex;gap:14px;align-items:center}.hm-mirrorhead small{display:block;color:rgba(255,255,255,.7);font-size:12px}.hm-mirrorhead span{display:block;font-size:11.5px;color:rgba(255,255,255,.6)}
.hm-band{display:inline-block;font-size:20px;font-weight:900;margin:2px 0}.hm-band.gold{color:#f1dfae}.hm-band.navy{color:#bfe0ff}.hm-band.teal{color:#9fe3dd}.hm-band.warn{color:#fcd9a0}
.hm-ring.big circle{stroke-width:5}.hm-ring.big text{font-size:16px}
.hm-perf{margin:0;font-size:15px;line-height:1.95;background:#fff;color:#0f172a;border-radius:14px;padding:14px 16px}
.hm-mblock{background:rgba(255,255,255,.08);border-radius:12px;padding:10px 14px}.hm-mblock b{display:block;margin-bottom:4px;font-size:13px;color:#f1dfae}.hm-mblock ul{margin:0;padding-inline-start:18px;font-size:13.5px;line-height:1.8}.hm-mblock p{margin:0;font-size:13.5px;line-height:1.8}.hm-mblock.ok b{color:#9fe3dd}.hm-mblock.warn{background:rgba(201,162,75,.18)}.hm-mblock.warn b{color:#fcd9a0}
.hm-rub{display:flex;gap:5px;flex-wrap:wrap}.hm-rub span{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;border:1px solid rgba(255,255,255,.3);color:rgba(255,255,255,.6)}.hm-rub span.h1{background:rgba(201,162,75,.35);color:#fff;border-color:transparent}.hm-rub span.h2{background:#0b8a83;color:#fff;border-color:transparent}
.hm-skills{display:flex;gap:8px;flex-wrap:wrap}.hm-skills span{display:grid;background:#fff;color:#0f172a;border-radius:10px;padding:6px 10px;font-size:12.5px}.hm-skills i{font-style:normal;color:#c9a24b;letter-spacing:2px;font-size:11px}
.hm-crowd{background:rgba(255,255,255,.07);border-radius:14px;padding:12px 14px}.hm-crowd>b{display:flex;gap:6px;align-items:center;font-size:14px;margin-bottom:8px}.hm-crowd>p{margin:8px 0 0;font-size:13px;color:rgba(255,255,255,.85);line-height:1.7}.hm-crowdbars{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;height:92px;align-items:end}.hm-crowdbars span{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:3px;font-size:11px;color:rgba(255,255,255,.75)}.hm-crowdbars i{display:block;width:70%;border-radius:6px 6px 0 0;background:rgba(255,255,255,.35);transition:height .5s}.hm-crowdbars .b-capable i{background:#0b8a83}.hm-crowdbars .b-distinguished i{background:#7dd3fc}.hm-crowdbars .b-exceptional i{background:#c9a24b}.hm-crowdbars span.me small{color:#fff;font-weight:800;text-decoration:underline}.hm-crowdbars em{font-style:normal;font-weight:700;color:#fff}
.hm-whatif{background:linear-gradient(135deg,rgba(201,162,75,.18),rgba(11,138,131,.18));border:1px solid rgba(201,162,75,.4);border-radius:14px;padding:12px 14px;display:grid;gap:8px}.hm-whatif>b{font-size:15px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}.hm-whatif p{margin:0;font-size:13.5px;line-height:1.8;color:rgba(255,255,255,.9)}.hm-whatif .hm-wtext{font-size:14.5px;font-weight:600;color:#fff}.hm-whatif .hm-wask{color:#fcd34d}.hm-whatif textarea{width:100%;box-sizing:border-box;border:0;border-radius:10px;padding:10px;font:inherit;font-size:14px;line-height:1.7;color:#0f2a4e}.hm-whatif.done{border-color:rgba(255,255,255,.25)}.hm-stance{font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.15)}.hm-stance.revised{background:#0b8a83}.hm-stance.held{background:#1d4ed8}.hm-shift{font-size:12px;font-weight:800;color:#c9a24b}.hm-wadapt{display:flex;gap:6px;align-items:center;color:#a7f3d0 !important}
.hm-pushrow{margin-top:6px}.hm-pushrow .pt-btn.ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.4)}
.hm-mine{white-space:pre-wrap;background:rgba(255,255,255,.08);border-radius:12px;padding:12px;font-size:13.5px;line-height:1.8;color:rgba(255,255,255,.85)}
.hm-upcoming{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:16px;font-size:12.5px;color:#64748b}.hm-upcoming span{padding:3px 10px;border-radius:999px;background:#eef2f7;color:#334155;font-weight:800}
.hm-chip.violet{background:#ede9fe;color:#5b21b6}.hm-chip.rose{background:#ffe4e6;color:#9f1239}.hm-chip.sky{background:#e0f2fe;color:#075985}.hm-chip.ok{background:#dcfce7;color:#166534}.hm-chip.warn{background:#fef3c7;color:#92400e}
@media (max-width:980px){.hm-hero .pt-herogrid,.hm-dailygrid,.hm-casegrid,.hm-advgrid,.hm-dlggrid{grid-template-columns:1fr}.hm-tracerow{grid-template-columns:repeat(5,1fr)}.hm-stagefoot{grid-template-columns:repeat(2,1fr)}.hm-crit div{grid-template-columns:110px 1fr 32px}}
@media (prefers-reduced-motion:reduce){.hm .hm-word,.hm-stagecard,.hm-score,.hm-live i{animation:none}}
`;
