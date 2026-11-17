'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «اقْرَأْ — من أَثَر» — واجهة المتعلّم (ق1). عربية فقط.
 *  الهوية: رمز نتيجة مِعيار من الرابط (?code=ML-…) أو جلسة حساب أَثَر؛ وإلا بوّابة «ابدأ بمِعيار أولًا».
 *  الشاشات: الرِّواق (المنازل → الحلقات · خطواتي · أيامي · سؤال اليوم) → الحلقة بخمس محطّات (مدخل/نصّ → بطاقات → قاعدة → مِران → أثر الحلقة)
 *          → «أراجع» (بطاقات مستحقّة بتقليب + مِران الأخطاء) → «دفتري» (كلماتي ونسبة الإتقان + طباعة).
 *  المِران: اختيار · مطابقة باللمس (يسار ثم يمين) · ترتيب باللمس (انقر الكلمات بالترتيب) — كلّها بلوحة المفاتيح أيضًا. التصحيح على الخادم.
 *  WCAG: أهداف ≥ 44px · aria-live للتغذية الراجعة · تباين · بلا سحب إلزامي.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import WayBar from '../components/WayBar';
import { supabase } from '../../lib/supabase/client';

type Ex = { id: string; kind: 'mcq' | 'matching' | 'ordering'; prompt_ar: string; options?: { id: string; text: string }[]; left?: string[]; right?: string[]; words?: string[] };
type Fb = { correct: boolean; explanation_ar: string | null; correct_option?: string; correct_pairs?: [string, string][]; correct_order?: string[] };
type Card = { id: string; word_ar: string; pos: string | null; gloss_ar: string; example_ar: string; audio_path: string | null; image_path: string | null };
type Home = { gate: string; copy?: { title: string; body: string; cta?: string; href?: string }; الرِّواق?: { label: string; name_ar: string; code: string; line_ar: string; can_ar: string; next: string | null }; منازل?: { code: string; title_ar: string; focus_ar: string; حلقات: { id: string; title_ar: string; goal_ar: string; minutes: number; حالة: 'new' | 'started' | 'done'; درجة: number | null }[] }[]; خطواتي?: { done: number; total: number; pct: number }; أيامي?: number; أراجع_مستحقّ?: number; التالية?: { id: string; title_ar: string } | null; سؤال_اليوم?: Ex | null; فارغ?: boolean };
type Lesson = { id: string; title_ar: string; goal_ar: string; minutes: number; المنزلة: { code: string; title_ar: string }; content: { intro_ar: string; text?: { kind: string; body: string; audio_path?: string | null } | null; grammar?: { title_ar: string; explanation_ar: string; examples: string[] } | null; speaking?: { prompt_ar: string; guide_ar: string } | null; writing?: { topic_ar: string; instructions_ar: string } | null; closing_ar?: string | null }; بطاقات: Card[]; مِران: Ex[]; تقدّمي: { status: string; score: number | null; attempts: number; answered: number }; قريبًا: string[] };
type Review = { review_id: string; kind: 'card' | 'item'; interval_days: number; card?: Card | null; exercise?: Ex | null };
type Screen = { s: 'home' } | { s: 'lesson'; id: string } | { s: 'reviews' } | { s: 'notebook' };
const STATIONS = ['المدخل', 'الكلمات', 'القاعدة', 'المِران', 'أثر الحلقة'] as const;

export default function IqraApp({ fontClass = '' }: { fontClass?: string }) {
  const [code, setCode] = useState(''); const [tok, setTok] = useState<string | null>(null); const [ready, setReady] = useState(false);
  const [home, setHome] = useState<Home | null>(null); const [err, setErr] = useState<string | null>(null); const [screen, setScreen] = useState<Screen>({ s: 'home' }); const [live, setLive] = useState('');
  useEffect(() => { (async () => { const c = new URLSearchParams(window.location.search).get('code') || ''; setCode(c.toUpperCase()); try { const { data } = await supabase().auth.getSession(); setTok(data.session?.access_token || null); } catch { setTok(null); } setReady(true); })(); }, []);
  const H = useCallback((): Record<string, string> => (tok ? { Authorization: `Bearer ${tok}` } : {}), [tok]);
  const q = useCallback((view: string, extra = '') => `/api/iqra?view=${view}${code ? `&code=${encodeURIComponent(code)}` : ''}${extra}`, [code]);
  const post = useCallback(async (body: Record<string, unknown>) => { const r = await fetch('/api/iqra', { method: 'POST', headers: { 'Content-Type': 'application/json', ...H() }, body: JSON.stringify({ ...body, code: code || undefined }) }); return r.json().catch(() => ({ ok: false })); }, [H, code]);
  const loadHome = useCallback(async () => { setErr(null); try { const r = await fetch(q('home'), { headers: H(), cache: 'no-store' }); const d = await r.json(); if (r.status === 401) { setHome({ gate: 'anon' }); return; } if (r.status === 404) { setErr('رمز النتيجة غير معروف'); return; } if (!d.ok) { setErr('تعذّر التحميل'); return; } setHome(d); } catch { setErr('تعذّر الاتصال'); } }, [q, H]);
  useEffect(() => { if (ready) void loadHome(); }, [ready, loadHome]);

  return <div className={`iq ${fontClass}`} dir="rtl" lang="ar" data-testid="iq-page">
    <header className="iq-top"><div className="iq-head"><a className="iq-brand" href="/" aria-label="أَثَر — الرئيسة">أَثَر<small>اقْرَأْ — تعلّم في رِواقك</small></a>
      <nav className="iq-nav" aria-label="أقسام اقْرَأْ">{home?.gate === 'enrolled' && <>
        <button type="button" className={screen.s === 'home' ? 'on' : ''} onClick={() => setScreen({ s: 'home' })} data-testid="iq-nav-home">رِواقي</button>
        <button type="button" className={screen.s === 'reviews' ? 'on' : ''} onClick={() => setScreen({ s: 'reviews' })} data-testid="iq-nav-reviews">أراجع{home.أراجع_مستحقّ ? <i>{home.أراجع_مستحقّ}</i> : null}</button>
        <button type="button" className={screen.s === 'notebook' ? 'on' : ''} onClick={() => setScreen({ s: 'notebook' })} data-testid="iq-nav-notebook">دفتري</button></>}
        {code ? <a className="iq-lnk" href={`/miaar/result/${encodeURIComponent(code)}`}>بطاقة نتيجتي</a> : <a className="iq-lnk" href="/me">صفحتي</a>}</nav></div><WayBar /></header>
    <p className="iq-live" aria-live="polite" role="status">{live}</p>
    {!ready || (!home && !err) ? <p className="iq-wait">نفتح رِواقك…</p> : null}
    {err && <section className="iq-wrap"><div className="iq-card"><p className="iq-err" role="alert">{err}</p></div></section>}
    {home && home.gate !== 'enrolled' && <Gate home={home} code={code} setCode={(c) => { setCode(c); window.history.replaceState(null, '', `/iqra?code=${encodeURIComponent(c)}`); }} reload={loadHome} />}
    {home?.gate === 'enrolled' && screen.s === 'home' && <HomeView home={home} open={(id) => setScreen({ s: 'lesson', id })} post={post} setLive={setLive} />}
    {home?.gate === 'enrolled' && screen.s === 'lesson' && <LessonView id={screen.id} q={q} H={H} post={post} setLive={setLive} back={() => { setScreen({ s: 'home' }); void loadHome(); }} next={(id) => setScreen({ s: 'lesson', id })} />}
    {home?.gate === 'enrolled' && screen.s === 'reviews' && <ReviewsView q={q} H={H} post={post} setLive={setLive} done={() => void loadHome()} />}
    {home?.gate === 'enrolled' && screen.s === 'notebook' && <NotebookView q={q} H={H} />}
    <footer className="iq-foot"><p>«اقْرَأْ — من أَثَر» تعلّمٌ لك وحدك: لا درجات رسمية هنا، ولا أثر على تقييمك أو شهادتك. تقدّمك ملكك ويُحذف فورًا متى طلبت.</p></footer>
    <style jsx global>{CSS}</style>
  </div>;
}

function Gate({ home, code, setCode, reload }: { home: Home; code: string; setCode: (c: string) => void; reload: () => void }) {
  const [v, setV] = useState(code);
  const anon = home.gate === 'anon';
  return <section className="iq-wrap"><div className="iq-gate" data-testid="iq-gate" data-gate={home.gate}>
    <p className="iq-kicker">اقْرَأْ — من أَثَر</p>
    <h1>{anon ? 'ادخل رِواقك' : home.copy?.title}</h1>
    <p className="iq-lead">{anon ? 'اقْرَأْ يفتح بنتيجة «مِعيار» المعتمدة. أدخل رمز نتيجتك (ML-XXXX-XXXX) أو سجّل الدخول بحساب أَثَر.' : home.copy?.body}</p>
    {anon && <form className="iq-row" onSubmit={(e) => { e.preventDefault(); const c = v.trim().toUpperCase(); if (/^ML-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) { setCode(c); setTimeout(reload, 0); } }}>
      <label className="iq-sr" htmlFor="iq-code">رمز النتيجة</label><input id="iq-code" dir="ltr" value={v} onChange={(e) => setV(e.target.value)} placeholder="ML-XXXX-XXXX" inputMode="text" autoComplete="off" data-testid="iq-code" />
      <button type="submit" className="iq-btn" data-testid="iq-code-go">افتح</button><a className="iq-btn ghost" href="/login?next=/iqra">تسجيل الدخول</a></form>}
    {home.gate === 'none' && <a className="iq-btn" href={home.copy?.href || '/miaar'} data-testid="iq-gate-cta">{home.copy?.cta}</a>}
    <ul className="iq-levels" aria-label="الرِّواقات السبعة">{['تمهيدي · Pre-A1', 'مكتشف · A1', 'مبتدئ · A2', 'متوسط · B1', 'مستقل · B2', 'متقدّم · C1', 'متقن · C2'].map((l) => <li key={l}>{l}</li>)}</ul>
  </div></section>;
}

function HomeView({ home, open, post, setLive }: { home: Home; open: (id: string) => void; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void }) {
  const r = home.الرِّواق!; const [dailyFb, setDailyFb] = useState<Fb | null>(null); const [dailyPick, setDailyPick] = useState('');
  async function daily(opt: string) { if (dailyFb || !home.سؤال_اليوم) return; setDailyPick(opt); const d = await post({ action: 'daily', item_id: home.سؤال_اليوم.id, answer: { option: opt } }); if (d.ok) { setDailyFb(d); setLive(d.correct ? 'أحسنت' : 'ليس بعد'); } }
  return <>
    <section className="iq-band"><div className="iq-bandin"><p className="iq-kicker" data-testid="iq-level">{r.label}</p><h1>رِواق {r.name_ar}</h1><p className="iq-lead">{r.line_ar} — {r.can_ar}</p>
      <div className="iq-stats"><div><b data-testid="iq-steps">{home.خطواتي?.done}</b><span>من {home.خطواتي?.total} حلقة</span></div><div><b data-testid="iq-streak">{home.أيامي}</b><span>أيام متّصلة</span></div><div><b>{home.أراجع_مستحقّ}</b><span>للمراجعة اليوم</span></div></div>
      {home.التالية && <button type="button" className="iq-btn gold" onClick={() => open(home.التالية!.id)} data-testid="iq-next">أكمل: {home.التالية.title_ar} ←</button>}</div></section>
    <section className="iq-wrap">
      {home.سؤال_اليوم && <div className="iq-card iq-daily" data-testid="iq-daily"><h2>سؤال اليوم</h2><p className="iq-q">{home.سؤال_اليوم.prompt_ar}</p>
        <div className="iq-opts">{home.سؤال_اليوم.options?.map((o) => <button key={o.id} type="button" className={`iq-opt ${dailyFb ? (o.id === dailyFb.correct_option ? 'right' : o.id === dailyPick ? 'wrong' : '') : ''}`} onClick={() => void daily(o.id)} disabled={!!dailyFb}>{o.text}</button>)}</div>
        {dailyFb && <p className="iq-fb">{dailyFb.correct ? 'أحسنت.' : 'ليس بعد.'} {dailyFb.explanation_ar}</p>}</div>}
      {home.فارغ ? <div className="iq-card"><p className="iq-empty" data-testid="iq-empty">حلقات هذا الرِّواق قيد الإعداد والاعتماد — تعود قريبًا.</p></div> : null}
      {home.منازل?.map((u) => <div key={u.code} className="iq-unit" data-testid="iq-unit"><h2><span>{u.code}</span>{u.title_ar}</h2><p className="iq-focus">{u.focus_ar}</p>
        <ol className="iq-lessons">{u.حلقات.map((l, i) => <li key={l.id} className={`iq-les ${l.حالة}`}><button type="button" onClick={() => open(l.id)} data-testid="iq-lesson" data-state={l.حالة} data-id={l.id}><i>{i + 1}</i><span><b>{l.title_ar}</b><small>{l.goal_ar || ''} · {l.minutes} د</small></span><em>{l.حالة === 'done' ? `تمّت · ${l.درجة ?? ''}٪` : l.حالة === 'started' ? 'بدأتها' : 'ابدأ'}</em></button></li>)}</ol></div>)}
      {r.next && <p className="iq-note">بعد هذا الرِّواق: {r.next}. طلب اختبار المستوى المبكّر يُفتح في مرحلة قادمة من اقْرَأْ.</p>}
    </section></>;
}

function LessonView({ id, q, H, post, setLive, back, next }: { id: string; q: (v: string, e?: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; back: () => void; next: (id: string) => void }) {
  const [l, setL] = useState<Lesson | null>(null); const [st, setSt] = useState(0); const [fb, setFb] = useState<Record<string, Fb>>({}); const [fin, setFin] = useState<{ score: number; passed: boolean; closing_ar: string | null; next: { id: string; title_ar: string } | null } | null>(null); const [flip, setFlip] = useState<Record<string, boolean>>({}); const [tries, setTries] = useState<Record<string, number>>({}); const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setL(null); setSt(0); setFb({}); setFin(null); fetch(q('lesson', `&id=${id}`), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => d.ok ? setL(d.حلقة) : setLive('تعذّر فتح الحلقة')).catch(() => setLive('تعذّر الاتصال')); }, [id, q, H, setLive]);
  const go = (n: number) => { setSt(n); topRef.current?.scrollIntoView({ block: 'start' }); };
  if (!l) return <p className="iq-wait">نفتح الحلقة…</p>;
  const stations = STATIONS.filter((s) => (s === 'القاعدة' ? !!l.content.grammar : s === 'الكلمات' ? l.بطاقات.length > 0 : true));
  const cur = stations[st]; const answered = Object.keys(fb).length; const total = l.مِران.length;
  async function answer(ex: Ex, a: Record<string, unknown>) { if (fb[ex.id]) return; const d = await post({ action: 'answer', lesson_id: l!.id, item_id: ex.id, answer: a }); if (d.ok) { setFb((p) => ({ ...p, [ex.id]: d })); setLive(d.correct ? 'أحسنت' : 'ليس بعد — انظر الشرح'); } else setLive('تعذّر الحفظ'); }
  async function finish() { const d = await post({ action: 'finish', lesson_id: l!.id }); if (d.ok) { setFin(d); setLive(d.passed ? 'أتممت الحلقة' : 'أعدها متى شئت'); } }
  /* «حاول مرّة أخرى»: بعد قراءة الشرح يعيد المتعلّم المحاولة؛ الخادم يعدّ المحاولات والإجابة الأخيرة هي التي تُحسب — تعلّم لا امتحان */
  const retry = (ex: Ex) => { setFb((p) => { const n2 = { ...p }; delete n2[ex.id]; return n2; }); setTries((t) => ({ ...t, [ex.id]: (t[ex.id] || 0) + 1 })); };
  return <section className="iq-wrap" ref={topRef}>
    <p className="iq-crumb"><button type="button" className="iq-lnkbtn" onClick={back} data-testid="iq-back">← رِواقي</button> · {l.المنزلة.code} {l.المنزلة.title_ar}</p>
    <h1 className="iq-h1" data-testid="iq-lesson-title">{l.title_ar}</h1>{l.goal_ar && <p className="iq-goal">{l.goal_ar}</p>}
    <ol className="iq-stations" aria-label="محطّات الحلقة">{stations.map((s, i) => <li key={s}><button type="button" className={i === st ? 'on' : i < st ? 'done' : ''} onClick={() => go(i)} aria-current={i === st ? 'step' : undefined} data-testid="iq-station">{s}</button></li>)}</ol>
    {cur === 'المدخل' && <div className="iq-card"><p className="iq-intro">{l.content.intro_ar}</p>
      {l.content.text && <div className={`iq-text ${l.content.text.kind}`} data-testid="iq-text">{l.content.text.body.split('\n').map((ln, i) => { const m = ln.match(/^([^:：]{1,20})[:：]\s*(.*)$/); return <p key={i}>{m && l.content.text!.kind === 'dialogue' ? <><b>{m[1]}:</b> {m[2]}</> : ln}</p>; })}{l.content.text.audio_path && <audio controls preload="none" src={l.content.text.audio_path} />}</div>}
      <div className="iq-soon">{l.قريبًا.map((s) => <button key={s} type="button" disabled title="يُفعَّل لاحقًا بقرار الإدارة" data-testid="iq-soon">{s}</button>)}</div>
      <button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">التالي ←</button></div>}
    {cur === 'الكلمات' && <div className="iq-card"><h2>كلمات الحلقة <small>انقر البطاقة لتقلبها</small></h2>
      <ul className="iq-cards" data-testid="iq-cards">{l.بطاقات.map((c) => <li key={c.id}><button type="button" className={`iq-flash ${flip[c.id] ? 'back' : ''}`} onClick={() => setFlip((p) => ({ ...p, [c.id]: !p[c.id] }))} aria-pressed={!!flip[c.id]} aria-label={flip[c.id] ? `${c.word_ar}: ${c.gloss_ar}` : c.word_ar}>
        {!flip[c.id] ? <span className="iq-w">{c.word_ar}{c.pos && <small>{c.pos}</small>}</span> : <span className="iq-g">{c.gloss_ar}{c.example_ar && <em>{c.example_ar}</em>}</span>}</button></li>)}</ul>
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">التالي ←</button></div></div>}
    {cur === 'القاعدة' && l.content.grammar && <div className="iq-card iq-rule" data-testid="iq-rule"><h2>{l.content.grammar.title_ar}</h2><p>{l.content.grammar.explanation_ar}</p>{l.content.grammar.examples.length > 0 && <ul>{l.content.grammar.examples.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" onClick={() => go(st + 1)} data-testid="iq-go">إلى المِران ←</button></div></div>}
    {cur === 'المِران' && <div className="iq-card"><h2>مِران <small>{answered} من {total}</small></h2>
      {l.مِران.map((ex, i) => <Exercise key={`${ex.id}:${tries[ex.id] || 0}`} n={i + 1} ex={ex} fb={fb[ex.id]} onAnswer={(a) => void answer(ex, a)} onRetry={() => retry(ex)} />)}
      {total === 0 && <p className="iq-empty">لا مِران في هذه الحلقة بعد.</p>}
      <div className="iq-rowb"><button type="button" className="iq-btn ghost" onClick={() => go(st - 1)}>→ السابق</button><button type="button" className="iq-btn" disabled={answered < total} onClick={() => { void finish(); go(st + 1); }} data-testid="iq-finish">أتممتُ الحلقة</button></div></div>}
    {cur === 'أثر الحلقة' && <div className="iq-card iq-close" data-testid="iq-closing">{!fin ? <p className="iq-wait">نحسب…</p> : <>
      <p className="iq-kicker">{fin.passed ? 'تمّت الحلقة' : 'قريبًا من التمام'}</p><h2>{fin.score}٪</h2>
      {fin.passed ? <><p className="iq-closing">{fin.closing_ar || 'أحسنت. كلمات هذه الحلقة ستعود إليك غدًا في «أراجع».'}</p>
        {(l.content.speaking || l.content.writing) && <div className="iq-prod">{l.content.speaking && <p><b>تحدّث:</b> {l.content.speaking.prompt_ar} <small>{l.content.speaking.guide_ar}</small></p>}{l.content.writing && <p><b>اكتب:</b> {l.content.writing.topic_ar} <small>{l.content.writing.instructions_ar}</small></p>}<small>تمرينان لك وحدك — لا يُرسلان ولا يُصحَّحان آليًّا.</small></div>}
        <div className="iq-rowb">{fin.next ? <button type="button" className="iq-btn gold" onClick={() => next(fin.next!.id)} data-testid="iq-next-lesson">الحلقة التالية: {fin.next.title_ar} ←</button> : <button type="button" className="iq-btn gold" onClick={back}>إلى رِواقي</button>}</div></>
        : <><p className="iq-closing">تحتاج ٧٠٪ ليُفتح أثر الحلقة. راجع الشرح تحت كلّ تمرين ثم أعدها — الإعادة مفتوحة دائمًا.</p><div className="iq-rowb"><button type="button" className="iq-btn" onClick={() => { setFb({}); setFin(null); go(stations.indexOf('المِران')); }} data-testid="iq-again">أعيدها</button><button type="button" className="iq-btn ghost" onClick={back}>إلى رِواقي</button></div></>}</>}</div>}
  </section>;
}

function Exercise({ n, ex, fb, onAnswer, onRetry }: { n: number; ex: Ex; fb?: Fb; onAnswer: (a: Record<string, unknown>) => void; onRetry?: () => void }) {
  const [pick, setPick] = useState(''); const [left, setLeft] = useState<string | null>(null); const [pairs, setPairs] = useState<Record<string, string>>({}); const [seq, setSeq] = useState<number[]>([]);
  const words = ex.words || []; const remaining = words.map((w, i) => i).filter((i) => !seq.includes(i));
  return <fieldset className={`iq-ex ${fb ? (fb.correct ? 'ok' : 'bad') : ''}`} data-testid="iq-ex" data-kind={ex.kind}><legend><i>{n}</i> {ex.prompt_ar}</legend>
    {ex.kind === 'mcq' && <div className="iq-opts">{ex.options?.map((o) => <button key={o.id} type="button" className={`iq-opt ${fb ? (o.id === fb.correct_option ? 'right' : o.id === pick ? 'wrong' : '') : ''}`} disabled={!!fb} onClick={() => { setPick(o.id); onAnswer({ option: o.id }); }} data-testid="iq-opt">{o.text}</button>)}</div>}
    {ex.kind === 'matching' && <div className="iq-match"><div className="iq-col" aria-label="الطرف الأوّل">{ex.left?.map((L) => <button key={L} type="button" className={`iq-chip ${left === L ? 'sel' : ''} ${pairs[L] ? 'paired' : ''}`} disabled={!!fb} onClick={() => setLeft(L)} aria-pressed={left === L} data-testid="iq-ml">{L}{pairs[L] && <small>← {pairs[L]}</small>}</button>)}</div>
      <div className="iq-col" aria-label="الطرف الثاني">{ex.right?.map((R) => <button key={R} type="button" className={`iq-chip ${Object.values(pairs).includes(R) ? 'paired' : ''}`} disabled={!!fb || !left} onClick={() => { if (!left) return; setPairs((p) => { const n2 = { ...p }; for (const k of Object.keys(n2)) if (n2[k] === R) delete n2[k]; n2[left] = R; return n2; }); setLeft(null); }} data-testid="iq-mr">{R}</button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={Object.keys(pairs).length !== (ex.left || []).length} onClick={() => onAnswer({ pairs: Object.entries(pairs) })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => { setPairs({}); setLeft(null); }}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_pairs && <p className="iq-key">الصواب: {fb.correct_pairs.map(([a, b]) => `${a} ← ${b}`).join(' · ')}</p>}</div>}
    {ex.kind === 'ordering' && <div className="iq-order"><div className="iq-line" aria-label="الجملة" data-testid="iq-line">{seq.length === 0 ? <span className="iq-ph">انقر الكلمات بالترتيب</span> : seq.map((i) => <button key={i} type="button" className="iq-chip in" disabled={!!fb} onClick={() => setSeq((s) => s.filter((x) => x !== i))} aria-label={`أزل ${words[i]}`}>{words[i]}</button>)}</div>
      <div className="iq-pool">{remaining.map((i) => <button key={i} type="button" className="iq-chip" disabled={!!fb} onClick={() => setSeq((s) => [...s, i])} data-testid="iq-word">{words[i]}</button>)}</div>
      {!fb && <div className="iq-rowb"><button type="button" className="iq-btn small" disabled={seq.length !== words.length} onClick={() => onAnswer({ order: seq.map((i) => words[i]) })} data-testid="iq-check">تحقّق</button><button type="button" className="iq-btn small ghost" onClick={() => setSeq([])}>مسح</button></div>}
      {fb && !fb.correct && fb.correct_order && <p className="iq-key">الصواب: {fb.correct_order.join(' ')}</p>}</div>}
    {fb && <p className="iq-fb" data-testid="iq-fb" data-correct={fb.correct ? '1' : '0'}>{fb.correct ? 'أحسنت.' : 'ليس بعد.'} {fb.explanation_ar}</p>}
    {fb && !fb.correct && onRetry && <button type="button" className="iq-btn small ghost" onClick={onRetry} data-testid="iq-retry">حاول مرّة أخرى</button>}
  </fieldset>;
}

function ReviewsView({ q, H, post, setLive, done }: { q: (v: string) => string; H: () => Record<string, string>; post: (b: Record<string, unknown>) => Promise<any>; setLive: (s: string) => void; done: () => void }) {
  const [rows, setRows] = useState<Review[] | null>(null); const [i, setI] = useState(0); const [flip, setFlip] = useState(false); const [fb, setFb] = useState<Fb | null>(null);
  const load = useCallback(() => { fetch(q('reviews'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((d) => { setRows(d.ok ? d.بطاقات : []); setI(0); setFlip(false); setFb(null); }).catch(() => setRows([])); }, [q, H]);
  useEffect(() => { load(); }, [load]);
  if (!rows) return <p className="iq-wait">نجمع بطاقاتك…</p>;
  const r = rows[i];
  if (!r) return <section className="iq-wrap"><div className="iq-card"><h1 className="iq-h1">أراجع</h1><p className="iq-empty" data-testid="iq-rev-empty">{rows.length ? 'انتهت مراجعة اليوم — أحسنت.' : 'لا بطاقات مستحقّة اليوم — عد غدًا أو أكمل حلقة جديدة.'}</p></div></section>;
  async function rate(result: 'again' | 'good' | 'easy') { const d = await post({ action: 'review', review_id: r.review_id, result }); if (d.ok) { setLive(`تعود بعد ${d.next_in_days} ${d.next_in_days === 1 ? 'يوم' : 'أيام'}`); setI(i + 1); setFlip(false); setFb(null); if (i + 1 >= rows!.length) done(); } }
  return <section className="iq-wrap"><div className="iq-card"><h1 className="iq-h1">أراجع <small>{i + 1} من {rows.length}</small></h1>
    {r.kind === 'card' && r.card && <div className="iq-revcard" data-testid="iq-rev-card"><button type="button" className={`iq-flash big ${flip ? 'back' : ''}`} onClick={() => setFlip(!flip)} aria-pressed={flip}>{!flip ? <span className="iq-w">{r.card.word_ar}</span> : <span className="iq-g">{r.card.gloss_ar}{r.card.example_ar && <em>{r.card.example_ar}</em>}</span>}</button>
      {flip && <div className="iq-rate"><button type="button" className="iq-btn again" onClick={() => void rate('again')} data-testid="iq-rate-again">ما زلت أتعلّمها</button><button type="button" className="iq-btn" onClick={() => void rate('good')} data-testid="iq-rate-good">أعرفها</button><button type="button" className="iq-btn gold" onClick={() => void rate('easy')}>سهلة</button></div>}
      {!flip && <p className="iq-hint">تذكّر المعنى ثم اقلب البطاقة.</p>}</div>}
    {r.kind === 'item' && r.exercise && <div data-testid="iq-rev-item"><Exercise n={i + 1} ex={r.exercise} fb={fb || undefined} onAnswer={async (a) => { const d = await post({ action: 'daily', item_id: r.exercise!.id, answer: a }); if (d.ok) setFb(d); }} />
      {fb && <div className="iq-rate"><button type="button" className="iq-btn again" onClick={() => void rate('again')}>أعيدها غدًا</button><button type="button" className="iq-btn" onClick={() => void rate(fb.correct ? 'good' : 'again')}>التالي</button></div>}</div>}
  </div></section>;
}

function NotebookView({ q, H }: { q: (v: string) => string; H: () => Record<string, string> }) {
  const [d, setD] = useState<{ كلمات: (Card & { الحلقة: string; إتقان: number })[]; إتقان: number } | null>(null); const [f, setF] = useState('');
  useEffect(() => { fetch(q('notebook'), { headers: H(), cache: 'no-store' }).then((r) => r.json()).then((j) => setD(j.ok ? j : { كلمات: [], إتقان: 0 })).catch(() => setD({ كلمات: [], إتقان: 0 })); }, [q, H]);
  const rows = useMemo(() => (d?.كلمات || []).filter((w) => !f || w.word_ar.includes(f) || w.gloss_ar.includes(f)), [d, f]);
  if (!d) return <p className="iq-wait">نفتح دفترك…</p>;
  return <section className="iq-wrap"><div className="iq-card iq-nb"><div className="iq-nbhead"><h1 className="iq-h1">دفتري <small>{d.كلمات.length} كلمة · إتقان {d.إتقان}٪</small></h1><div className="iq-row no-print"><input value={f} onChange={(e) => setF(e.target.value)} placeholder="ابحث في كلماتي" aria-label="بحث" /><button type="button" className="iq-btn ghost" onClick={() => window.print()}>طباعة</button></div></div>
    {rows.length === 0 ? <p className="iq-empty" data-testid="iq-nb-empty">دفترك يمتلئ مع كلّ حلقة تتمّها.</p> : <table className="iq-table" data-testid="iq-nb-table"><thead><tr><th>الكلمة</th><th>المعنى</th><th>مثال</th><th>الحلقة</th><th>إتقان</th></tr></thead><tbody>{rows.map((w) => <tr key={w.id}><td className="iq-wd">{w.word_ar}{w.pos && <small>{w.pos}</small>}</td><td>{w.gloss_ar}</td><td>{w.example_ar}</td><td>{w.الحلقة}</td><td><span className="iq-bar"><i style={{ width: `${w.إتقان}%` }} /></span>{w.إتقان}٪</td></tr>)}</tbody></table>}
  </div></section>;
}

const CSS = `
.iq{min-height:100vh;background:#faf8f4;color:#0b222a;font-family:inherit;line-height:1.75}
.iq :is(button,a,input):focus-visible{outline:3px solid #0f2a4e;outline-offset:2px}
.iq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.iq-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.95);backdrop-filter:blur(8px);border-bottom:1px solid #e8eef3}
.iq-head{max-width:980px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.iq-brand{font-weight:900;font-size:22px;color:#0f2a4e;text-decoration:none;display:flex;flex-direction:column;line-height:1.1}.iq-brand small{font-size:11.5px;color:#2e7d86;font-weight:800}
.iq-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap}.iq-nav button{font:inherit;font-weight:800;min-height:40px;border:1px solid #e8eef3;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 14px;cursor:pointer;display:inline-flex;gap:6px;align-items:center}.iq-nav button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-nav button i{font-style:normal;background:#d9a441;color:#0b222a;border-radius:999px;padding:0 7px;font-size:12px}
.iq-lnk{color:#0f2a4e;font-weight:800;text-decoration:none;min-height:40px;display:inline-flex;align-items:center;padding:0 8px}
.iq-live{min-height:1.2em;max-width:980px;margin:4px auto 0;padding:0 18px;color:#0f5c57;font-weight:800;font-size:13px}
.iq-wait{text-align:center;padding:40px;color:#5b6b72;font-weight:700}.iq-err{color:#9e2a2b;font-weight:800}
.iq-wrap{max-width:980px;margin:0 auto;padding:18px 18px 40px}
.iq-gate{background:#fff;border:1px solid #e8eef3;border-radius:20px;padding:28px;text-align:center;box-shadow:0 10px 30px rgba(15,42,78,.06)}.iq-gate h1{margin:6px 0 8px;font-size:30px;color:#0f2a4e}
.iq-kicker{margin:0;font-size:12.5px;font-weight:900;letter-spacing:.08em;color:#2e7d86}.iq-lead{margin:0 0 16px;color:#334155;font-size:16px;max-width:640px;margin-inline:auto}
.iq-row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;align-items:center}.iq-row input{font:inherit;min-height:44px;border:1px solid #cbd5e1;border-radius:12px;padding:8px 12px;min-width:200px;text-align:center;font-weight:800;letter-spacing:.08em}
.iq-levels{list-style:none;padding:0;margin:18px 0 0;display:flex;gap:6px;flex-wrap:wrap;justify-content:center}.iq-levels li{border:1px solid #e8eef3;border-radius:999px;padding:4px 12px;font-size:12.5px;font-weight:800;color:#0f2a4e;background:#f4f1ea}
.iq-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:999px;padding:10px 20px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:44px}.iq-btn:disabled{opacity:.45;cursor:not-allowed}.iq-btn.ghost{background:#fff;color:#0f2a4e}.iq-btn.gold{background:#d9a441;color:#0b222a;border-color:#d9a441}.iq-btn.again{background:#9e2a2b;border-color:#9e2a2b}.iq-btn.small{min-height:40px;padding:6px 14px}
.iq-lnkbtn{font:inherit;font-weight:800;color:#0f2a4e;background:none;border:0;cursor:pointer;min-height:40px;padding:0}
.iq-band{background:linear-gradient(135deg,#0f2a4e 0%,#0b3d4a 60%,#2e7d86 100%);color:#fff;padding:28px 18px 24px}.iq-bandin{max-width:980px;margin:0 auto}.iq-band h1{margin:4px 0 6px;font-size:30px;color:#fff}.iq-band .iq-kicker{color:#f4d58d}.iq-band .iq-lead{color:#d5e0ea;margin-inline:0}
.iq-stats{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 14px}.iq-stats div{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:14px;padding:8px 14px;min-width:120px}.iq-stats b{display:block;font-size:24px;line-height:1.1}.iq-stats span{font-size:12.5px;color:#d5e0ea}
.iq-card{background:#fff;border:1px solid #e8eef3;border-radius:18px;padding:18px 20px;margin:0 0 14px;box-shadow:0 6px 18px rgba(15,42,78,.04)}.iq-card h2{margin:0 0 10px;font-size:19px;color:#0f2a4e}.iq-card h2 small{font-size:12.5px;color:#5b6b72;margin-inline-start:8px;font-weight:700}
.iq-daily{border-top:3px solid #d9a441}.iq-q{font-weight:800;font-size:17px;margin:0 0 8px}
.iq-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px}.iq-opt{font:inherit;font-weight:700;min-height:44px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:8px 12px;cursor:pointer;text-align:start}.iq-opt:disabled{cursor:default}.iq-opt.right{background:#dcfce7;border-color:#86efac}.iq-opt.wrong{background:#fee2e2;border-color:#fca5a5}
.iq-fb{margin:8px 0 0;font-weight:700;color:#0f2a4e}.iq-key{margin:6px 0 0;font-weight:700;color:#1f6e5a}
.iq-unit{margin:0 0 16px}.iq-unit h2{margin:0;font-size:20px;color:#0f2a4e;display:flex;gap:10px;align-items:baseline}.iq-unit h2 span{font-size:11.5px;color:#2e7d86;letter-spacing:.08em}.iq-focus{margin:2px 0 8px;color:#5b6b72;font-size:13.5px}
.iq-lessons{list-style:none;margin:0;padding:0;display:grid;gap:8px}.iq-les button{width:100%;display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #e8eef3;border-radius:14px;padding:10px 14px;font:inherit;cursor:pointer;text-align:start;min-height:56px}.iq-les button i{font-style:normal;width:32px;height:32px;border-radius:999px;background:#f4f1ea;color:#0f2a4e;display:grid;place-items:center;font-weight:900;flex:none}.iq-les button span{flex:1;display:flex;flex-direction:column}.iq-les button b{color:#0f2a4e}.iq-les button small{color:#5b6b72;font-size:12.5px}.iq-les button em{font-style:normal;font-weight:800;color:#2e7d86;font-size:13px}.iq-les.done button{border-color:#86efac;background:#f0fdf4}.iq-les.done i{background:#1f6e5a;color:#fff}.iq-les.started button{border-color:#f3d98b}
.iq-note{color:#5b6b72;font-size:13px}.iq-empty{color:#5b6b72;text-align:center;padding:14px;font-weight:700}
.iq-crumb{margin:0 0 4px;color:#5b6b72;font-size:13px;font-weight:700}.iq-h1{margin:0 0 4px;font-size:26px;color:#0f2a4e}.iq-h1 small{font-size:13px;color:#5b6b72;margin-inline-start:8px}.iq-goal{margin:0 0 12px;color:#2e7d86;font-weight:800}
.iq-stations{list-style:none;margin:0 0 14px;padding:0;display:flex;gap:6px;flex-wrap:wrap}.iq-stations button{font:inherit;font-weight:800;font-size:13px;min-height:40px;border:1px solid #e8eef3;background:#fff;color:#0f2a4e;border-radius:999px;padding:6px 14px;cursor:pointer}.iq-stations button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-stations button.done{background:#e6f4f3;border-color:#76b0b8}
.iq-intro{font-size:16.5px;margin:0 0 12px}.iq-text{background:#f4f1ea;border-radius:14px;padding:14px 16px;margin:0 0 12px;font-size:18px;line-height:2}.iq-text p{margin:0 0 4px}.iq-text b{color:#0b3d4a}.iq-text audio{width:100%;margin-top:8px}
.iq-soon{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}.iq-soon button{font:inherit;font-weight:700;font-size:12.5px;min-height:40px;border:1px dashed #cbd5e1;background:#fff;color:#5b6b72;border-radius:999px;padding:6px 14px}
.iq-rowb{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.iq-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}.iq-flash{width:100%;min-height:120px;border:1px solid #e8eef3;background:#fff;border-radius:16px;padding:12px;font:inherit;cursor:pointer;display:grid;place-items:center;text-align:center;transition:transform .15s}.iq-flash.back{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-flash.big{min-height:200px;font-size:22px}.iq-w{font-size:22px;font-weight:900;display:flex;flex-direction:column;gap:4px}.iq-w small{font-size:11.5px;color:#2e7d86;font-weight:700}.iq-flash.back .iq-w small{color:#f4d58d}.iq-g{font-size:15px;font-weight:700;display:flex;flex-direction:column;gap:6px}.iq-g em{font-style:normal;font-size:13px;color:#d5e0ea}
.iq-rule p{font-size:16px}.iq-rule ul{background:#f4f1ea;border-radius:12px;padding:10px 28px;margin:0}.iq-rule li{font-weight:700;font-size:16px}
.iq-ex{border:1px solid #e8eef3;border-radius:14px;padding:10px 14px 14px;margin:0 0 10px;min-width:0}.iq-ex.ok{border-color:#86efac;background:#f0fdf4}.iq-ex.bad{border-color:#fca5a5;background:#fff1f2}.iq-ex legend{font-weight:800;color:#0f2a4e;padding:0 6px;font-size:15.5px}.iq-ex legend i{font-style:normal;color:#2e7d86;margin-inline-end:4px}
.iq-match{display:grid;gap:10px}.iq-col{display:flex;gap:6px;flex-wrap:wrap}.iq-chip{font:inherit;font-weight:700;min-height:44px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:6px 12px;cursor:pointer;display:inline-flex;flex-direction:column;align-items:flex-start}.iq-chip small{font-size:11px;color:#2e7d86}.iq-chip.sel{border-color:#0f2a4e;box-shadow:0 0 0 3px rgba(15,42,78,.15)}.iq-chip.paired{background:#e6f4f3;border-color:#76b0b8}.iq-chip.in{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.iq-chip:disabled{cursor:default;opacity:.85}
.iq-line{min-height:56px;border:2px dashed #cbd5e1;border-radius:14px;padding:6px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 8px;background:#fff}.iq-ph{color:#94a3b8;font-weight:700;padding:0 6px}.iq-pool{display:flex;gap:6px;flex-wrap:wrap}
.iq-close{text-align:center}.iq-close h2{font-size:44px;margin:0 0 8px;color:#0f2a4e}.iq-closing{font-size:17px;max-width:620px;margin:0 auto 12px}.iq-prod{text-align:start;background:#f4f1ea;border-radius:14px;padding:12px 14px;margin:0 0 8px}.iq-prod p{margin:0 0 6px}.iq-prod small{display:block;color:#5b6b72;font-size:12.5px}.iq-close .iq-rowb{justify-content:center}
.iq-revcard{display:grid;gap:12px;justify-items:center}.iq-rate{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.iq-hint{color:#5b6b72;font-weight:700;margin:0}
.iq-nbhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center}.iq-nb input{min-width:180px;text-align:start;letter-spacing:0}
.iq-table{width:100%;border-collapse:collapse;font-size:14px;margin-top:10px}.iq-table th{text-align:start;color:#5b6b72;font-size:12px;border-bottom:1px solid #e8eef3;padding:6px 8px}.iq-table td{border-bottom:1px solid #f1f5f9;padding:8px;vertical-align:top}.iq-wd{font-weight:900;color:#0f2a4e;font-size:16px}.iq-wd small{display:block;font-size:11px;color:#2e7d86;font-weight:700}.iq-bar{display:inline-block;width:70px;height:8px;background:#e8eef3;border-radius:999px;vertical-align:middle;margin-inline-end:6px;overflow:hidden}.iq-bar i{display:block;height:100%;background:#2e7d86}
.iq-foot{max-width:980px;margin:0 auto;padding:0 18px 30px;color:#5b6b72;font-size:12.5px;font-weight:600;text-align:center}
@media print{.iq-top,.iq-foot,.iq-live,.no-print{display:none!important}.iq{background:#fff}.iq-card{border:0;box-shadow:none}}
@media (max-width:640px){.iq-band h1{font-size:24px}.iq-close h2{font-size:36px}.iq-stats div{min-width:90px}}
`;
