'use client';
/* بَيان (هـ-6-ج) — محرّك الجلسة الموحّد · وضع الطفل (شاشة كاملة، أزرار كبيرة، صوت في كل شيء)
 * يعرض أي جلسة من lib/kids/sessions (البيت أولًا ثم السوق). المحطّات: هيّا نبدأ → الحكاية → حَرْف يرسم → نلعب → نمثّل → مدرسة المصطفى ﷺ → نتلو → أثري اليوم
 * «لؤلؤ الحيّة» (LuluLive): طبقة دائمة بآلة حالات — تتكلّم مع صوتها، تنتظر، تلمّح، تحتفل، ترقص، وتهدأ في محطّتي الحديث والقرآن. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { SessionData, LuluKey, LuluPose } from '../../../lib/kids/types';
import { kidsImg, kidsSnd } from '../../../lib/kids/types';
import { STATIONS, type StationKey, SESSIONS } from '../../../lib/kids/sessions';
import { FATIHA, RECITER, ayahUrl } from '../../../lib/kids/souq';
import { LuluLive, LULU_CSS, POSE_FOR, type LuluState } from './LuluLive';
import { Trace, Hear, NameLetter, Memory, Missing, Listen, Clap, Jump, Basket, Discover, ColorLetter, Count, Paint, Catch, Draw, ACT_CSS } from './activities';
import { COMMON } from '../../../lib/kids/common';
import { Talk, TALK_CSS, TALK_RECOG_KEY, talkRecogEnabled, type TalkOutcome } from './Talk';
import { BayanIntro } from './BayanIntro';
import { INTRO_DEMO_KEY } from '../../../lib/kids/intro';
import { nameClip } from '../../../lib/kids/names';
import type { Game, HarfActivity } from '../../../lib/kids/types';

/* ───────── صوت (+ قياس شدّة الصوت لتحريك لؤلؤ) ───────── */
function useAudio(onLevel: (v: number) => void, onSpeaking: (v: boolean) => void) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef<number | null>(null);
  const stopMeter = useCallback(() => { if (raf.current) cancelAnimationFrame(raf.current); raf.current = null; onLevel(0); onSpeaking(false); }, [onLevel, onSpeaking]);
  const play = useCallback((src: string, onEnd?: () => void, meter = false) => {
    try {
      if (ref.current) { ref.current.pause(); ref.current.onended = null; }
      stopMeter();
      const a = new Audio(src); a.crossOrigin = 'anonymous'; ref.current = a;
      const done = () => { stopMeter(); onEnd?.(); };
      a.onended = done; a.onerror = done;
      if (meter) {
        onSpeaking(true);
        try {
          const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
          if (!ctx.current) ctx.current = new AC();
          const an = ctx.current.createAnalyser(); an.fftSize = 512;
          const srcNode = ctx.current.createMediaElementSource(a); srcNode.connect(an); an.connect(ctx.current.destination);
          const buf = new Uint8Array(an.frequencyBinCount);
          const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; s += d * d; } onLevel(Math.min(1, Math.sqrt(s / buf.length) * 3.2)); raf.current = requestAnimationFrame(tick); };
          raf.current = requestAnimationFrame(tick);
          void ctx.current.resume();
        } catch { /* المتصفّح لا يدعم — تبقى الحركة الافتراضية */ }
      }
      void a.play().catch(() => done());
    } catch { onEnd?.(); }
  }, [stopMeter, onLevel, onSpeaking]);
  const stop = useCallback(() => { ref.current?.pause(); stopMeter(); }, [stopMeter]);
  useEffect(() => () => { ref.current?.pause(); if (raf.current) cancelAnimationFrame(raf.current); }, []);
  return { play, stop };
}

/* ───────── المكوّن الرئيس ───────── */
/** وضع «بَيْتُ بَيان»: طفل معروف من البوّابة الأبوية — لا بوّابة اسم، التعرّف على الصوت بإذن speech_recog، النصّ يُبلَّغ بإذن save_text، ونتيجة الجلسة تُبلَّغ إلى /api/kids */
export type KidChild = { id: string; nick: string; gender: 'm' | 'f'; consents: { speech_recog: boolean; save_text: boolean }; exitHref: string; playHref: (slug: string) => string; report: (p: Record<string, unknown>) => void };
export default function BayanSession({ session, child }: { session: SessionData; child?: KidChild }) {
  const S = session;
  const img = useCallback((n: string) => kidsImg(S.slug, n), [S.slug]);
  const snd = useCallback((n: string) => kidsSnd(S.slug, n), [S.slug]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const onLevel = useCallback((v: number) => { rootRef.current?.style.setProperty('--ll-amp', v.toFixed(3)); }, []);
  const { play, stop } = useAudio(onLevel, setSpeaking);
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState(child?.nick || '');
  const [gender, setGender] = useState<'m' | 'f'>(child?.gender || 'm');
  const startedAt = useRef(new Date().toISOString());
  const doneRef = useRef<Record<string, boolean>>({});
  const [pose, setPose] = useState<LuluPose>('wave');
  const [lstate, setLstate] = useState<LuluState>('idle');
  const [say, setSay] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const station = STATIONS[idx].key as StationKey;
  const quiet = station === 'hadith' || station === 'quran';
  const hero = gender === 'f' ? 'يا بَطَلَةْ' : 'يا بَطَلْ';
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { if (child) return; try { const s = localStorage.getItem('bayan_demo_child'); if (s) { const j = JSON.parse(s); setName(j.name || ''); setGender(j.gender || 'm'); } } catch { /* ignore */ } }, [child]);
  /** تبليغ «بَيْتُ بَيان» (إن كان طفلًا معروفًا): المحطّات المنجزة + ما يُضاف (الحوار/التقييم الذاتي). لا صوت ولا صورة أبدًا؛ النصّ بإذن save_text فقط */
  const report = useCallback((extra: Record<string, unknown> = {}) => {
    if (!child) return;
    const talk = Array.isArray(extra.talk) ? (extra.talk as TalkOutcome['results']).map(r => child.consents.save_text ? { role: r.role, matched: r.matched, attempts: r.attempts, heard: r.heard } : { role: r.role, matched: r.matched, attempts: r.attempts }) : undefined;
    const stations = { ...doneRef.current, ...((extra.stations as Record<string, boolean>) || {}) };
    child.report({ session: S.slug, badge: S.meta.badge.title, startedAt: startedAt.current, ...extra, stations, ...(talk ? { talk } : {}) });
  }, [child, S]);

  /** لؤلؤ تقول عبارة: الوضعية + الحالة بعد الكلام (افتراضيًا: ساكنة) */
  const lulu = useCallback((k: LuluKey, p: LuluPose = 'cheer', onEnd?: () => void, after: LuluState = 'idle') => {
    const L = S.lulu[k]; setPose(p); setLstate('talk'); setSay(L.text.replace('يا بَطَلْ', hero).replace('يا بَطَلَةْ', hero));
    play(snd(L.audio), () => { setLstate(after); onEnd?.(); }, true);
  }, [S, play, snd, hero]);
  /** لؤلؤ تنتظر إجابة: بعد 5 ث «…» وبعد 10 ث تلميح */
  const awaitAnswer = useCallback(() => {
    if (waitTimer.current) clearTimeout(waitTimer.current);
    setLstate('wait');
    waitTimer.current = setTimeout(() => { setLstate('hint'); setPose('point'); }, 7000);
  }, []);
  const stopWaiting = useCallback(() => { if (waitTimer.current) clearTimeout(waitTimer.current); waitTimer.current = null; }, []);
  /** لؤلؤ تنطق نصًّا حرًّا (سطر في الحكاية أو كلمة) بصوتها المقيس */
  const luluSay = useCallback((text: string, audio: string, p: LuluPose = 'wave', onEnd?: () => void) => {
    setPose(p); setLstate('talk'); setSay(text); play(snd(audio), () => { setLstate('idle'); onEnd?.(); }, true);
  }, [play, snd]);
  /** غيرها يتكلّم: لؤلؤ تُصغي */
  const speak = useCallback((src: string, onEnd?: () => void) => { if (!quiet) setLstate('listen'); play(src, () => { if (!quiet) setLstate('idle'); onEnd?.(); }); }, [play, quiet]);

  /** طبقة خلفيّة (مؤثّر مثل الأذان من بعيد) تُسمَع تحت الكلام ولا تقطعه؛ تتوقّف عند تغيير المحطّة */
  const bgRef = useRef<HTMLAudioElement | null>(null);
  const bg = useCallback((src?: string, vol = 0.5) => { if (bgRef.current) { bgRef.current.pause(); bgRef.current = null; } if (!src) return; try { const a = new Audio(src); a.volume = vol; bgRef.current = a; void a.play().catch(() => {}); } catch { /* ignore */ } }, []);
  useEffect(() => () => { bgRef.current?.pause(); }, []);
  const go = useCallback((n: number) => { bg(); stop(); stopWaiting(); setSay(''); setIdx(Math.max(0, Math.min(STATIONS.length - 1, n))); window.scrollTo({ top: 0 }); }, [stop, stopWaiting]);
  const finish = useCallback((k: StationKey) => { doneRef.current[k] = true; setDone(d => ({ ...d, [k]: true })); if (k !== 'hadith' && k !== 'quran') lulu('next', 'cheer', undefined, 'idle'); }, [lulu]);
  const next = useCallback(() => go(idx + 1), [go, idx]);

  useEffect(() => { if (quiet) { setLstate('calm'); setSay(''); } else setLstate('idle'); }, [quiet]);
  useEffect(() => { if (!speaking && lstate === 'talk') setLstate('idle'); }, [speaking, lstate]);
  useEffect(() => () => { if (waitTimer.current) clearTimeout(waitTimer.current); }, []);

  const ctx: Ctx = { S, img, snd, play: speak, bg, lulu, luluSay, awaitAnswer, stopWaiting, next, finish, name, gender, hero, setPose, setLstate, setSay, child, report };
  const others = SESSIONS.filter(x => x.slug !== S.slug);
  return (
    <div className="by" dir="rtl" data-station={station} data-session={S.slug} ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: BAYAN_CSS + LULU_CSS + ACT_CSS + TALK_CSS }} />
      <header className="by-top">
        <Link href={child ? child.exitHref : '/kids'} className="by-exit" aria-label="خروج">✕</Link>
        <ol className="by-stations" aria-label="محطّات الرحلة">
          {STATIONS.map((s, i) => (
            <li key={s.key} className={i === idx ? 'on' : done[s.key] ? 'ok' : ''} title={s.title}>
              <button onClick={() => go(i)} aria-current={i === idx ? 'step' : undefined}><span className="ic">{s.icon}</span><span className="tt">{s.title}</span></button>
            </li>
          ))}
        </ol>
        <div className="by-brand"><img src="/brand/athar-mark.svg" alt="" width={22} height={22} /><b>بَيان</b><small className="by-sess">{S.meta.order} · {S.meta.world}</small></div>
      </header>

      <main className="by-stage">
        {station === 'start' && <Start {...ctx} setName={setName} setGender={setGender} />}
        {station === 'story' && <Story {...ctx} />}
        {station === 'harf' && <Harf {...ctx} />}
        {station === 'play' && <Play {...ctx} />}
        {station === 'act' && <Act {...ctx} />}
        {station === 'hadith' && <Hadith {...ctx} />}
        {station === 'quran' && <Quran {...ctx} />}
        {station === 'athari' && <Athari {...ctx} others={others} />}
      </main>

      <LuluLive pose={lstate === 'calm' ? 'calm' : (lstate === 'talk' || lstate === 'idle' || lstate === 'listen') ? pose : POSE_FOR[lstate]} state={quiet ? 'calm' : lstate} say={say} />
    </div>
  );
}

type Ctx = {
  S: SessionData;
  img: (n: string) => string; snd: (n: string) => string;
  play: (src: string, onEnd?: () => void, meter?: boolean) => void;
  bg: (src?: string, vol?: number) => void;
  lulu: (k: LuluKey, p?: LuluPose, onEnd?: () => void, after?: LuluState) => void;
  luluSay: (text: string, audio: string, p?: LuluPose, onEnd?: () => void) => void;
  awaitAnswer: () => void; stopWaiting: () => void;
  next: () => void; finish: (k: StationKey) => void;
  name: string; gender: 'm' | 'f'; hero: string;
  setPose: (p: LuluPose) => void; setLstate: (s: LuluState) => void; setSay: (s: string) => void;
  child?: KidChild; report: (extra?: Record<string, unknown>) => void;
};

/* ───────── 1) هيّا نبدأ ───────── */
function Start(p: Ctx & { setName: (s: string) => void; setGender: (g: 'm' | 'f') => void }) {
  const { S } = p;
  const [step, setStep] = useState<'gate' | 'hello' | 'anthem'>(p.child || p.name ? 'hello' : 'gate');
  const [intro, setIntro] = useState(false);
  const save = () => { try { localStorage.setItem('bayan_demo_child', JSON.stringify({ name: p.name.trim(), gender: p.gender })); } catch { /* ignore */ } let seen = true; try { seen = localStorage.getItem(INTRO_DEMO_KEY) === '1'; } catch { /* ignore */ } if (seen || p.child) setStep('hello'); else setIntro(true); };
  const introDone = () => { try { localStorage.setItem(INTRO_DEMO_KEY, '1'); } catch { /* ignore */ } setIntro(false); setStep('hello'); };
  const [line, setLine] = useState(-1);
  /** لؤلؤ تسلّم باسم الطفل بصوتها إن كان اسمه في البنك (200 اسم)، ثمّ جملة الترحيب؛ وإلّا الترحيب العامّ */
  const hello = () => { const clip = nameClip(p.name); if (clip) p.luluSay(`أَهْلًا يا ${p.name.trim()}!`, clip, 'wave', () => p.lulu('welcome', 'wave', undefined, 'wait')); else p.lulu('welcome', 'wave', undefined, 'wait'); };
  const ready = () => { p.lulu('yasalam', 'cheer', () => { setStep('anthem'); }, 'dance'); };
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const sing = useCallback(() => {
    timers.current.forEach(clearTimeout); timers.current = [];
    setLine(-1); p.setPose('dance'); p.setLstate('dance'); p.setSay(ANTHEM_INTRO);
    p.play('/kids/common/audio/anthem.mp3', () => { setLine(ANTHEM.length); p.setLstate('cheer'); p.setSay('صَفَّقْتَ مَعي؟ يا سَلامْ! 👏'); }, true);
    ANTHEM_AT.forEach((t, i) => timers.current.push(setTimeout(() => { setLine(i); p.setSay(ANTHEM[i]); }, t * 1000)));
  }, [p]);
  useEffect(() => { if (step !== 'anthem') return; sing(); return () => { timers.current.forEach(clearTimeout); }; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [step]);
  const start = () => { if (S.startSfx) p.bg(p.snd(S.startSfx), 0.45); p.lulu('today', 'dance', () => { p.finish('start'); p.next(); }); };
  return (
    <section className="by-card">
      {step === 'gate' && (
        <div className="by-gate">
          <h1>مَرْحَبًا في بَيان</h1>
          <p className="by-parent">لوليّ الأمر: اكتب اسم طفلك ليناديه الأصدقاء به. (الجلسة {S.meta.order}: «في {S.meta.world}» · حرف {S.meta.letterName} · {S.meta.minutes} دقيقة · المسار أ · 4–6 سنوات)</p>
          <input className="by-input" value={p.name} onChange={e => p.setName(e.target.value)} placeholder="اسم الطفل" maxLength={20} autoFocus />
          <div className="by-row">
            <button className={`by-chip ${p.gender === 'm' ? 'on' : ''}`} onClick={() => p.setGender('m')}>ولد</button>
            <button className={`by-chip ${p.gender === 'f' ? 'on' : ''}`} onClick={() => p.setGender('f')}>بنت</button>
          </div>
          {S.talk && <label className="by-toggle"><input type="checkbox" defaultChecked={talkRecogEnabled()} onChange={e => { try { localStorage.setItem(TALK_RECOG_KEY, e.target.checked ? '1' : '0'); } catch { /* ignore */ } }} /> <span>تعرّف تلقائي على كلام الطفل في «حَديثٌ مَعَ لُؤْلُؤ» عبر خدمة المتصفّح <small>(قد يُرسَل الصوت لمزوّد المتصفّح لتحويله إلى نصّ — بدونه يؤكّد وليّ الأمر بنفسه ولا يغادر الجهاز شيء)</small></span></label>}
          <button className="by-big" disabled={!p.name.trim()} onClick={save}>هَيّا نَبْدَأ ☀️</button>
          <button className="by-ghost" onClick={() => setIntro(true)}>قِصَّتُنا 📖 (رسالة لؤلؤ)</button>
        </div>
      )}
      {intro && <BayanIntro mode="child" name={p.name.trim() || undefined} onDone={introDone} onSkip={introDone} />}
      {step === 'hello' && (
        <div className="by-center">
          <h1 className="by-huge">أَهْلًا يا {p.name}!</h1>
          <p className="by-sub">اِضْغَطْ عَلى لُؤْلُؤ لِتُسَلِّمَ عَلَيْكْ</p>
          <button className="by-tap" onClick={hello}><img src="/kids/lulu/wave.png" alt="" width={180} height={180} /></button>
          <button className="by-big" onClick={ready}>أَنا جاهِزْ! ✋</button>
        </div>
      )}
      {step === 'anthem' && (
        <div className="by-center">
          <h2 className="by-h2">نَشيدُ بَيان 👏</h2>
          <div className="by-anthem">{ANTHEM.map((l, i) => <p key={i} className={i === line ? 'on' : i < line ? 'past' : ''}>{l}</p>)}</div>
          <p className="by-sub">صَفِّقْ مَعَ الْإيقاعْ! 👏</p>
          <div className="by-row">
            <button className="by-ghost" onClick={sing}>🔁 مَرَّةً أُخْرى</button>
            <button className="by-big" onClick={() => { timers.current.forEach(clearTimeout); start(); }}>{S.goLabel}</button>
          </div>
        </div>
      )}
    </section>
  );
}
/** نشيد الافتتاح (إيقاع تصفيق) — مشترك */
const ANTHEM = ['بَيانْ بَيانْ، هَيّا نَبْدَأْ', 'نَقْرَأْ نَلْعَبْ، ثُمَّ نَهْدَأْ', 'حَرْفٌ وَكَلِمَةْ، وَآيَةٌ طَيِّبَةْ', 'وَأَثَرٌ يَبْقى، في قَلْبي وَلِساني'];
const ANTHEM_INTRO = 'هَيّا نُنْشِدُ نَشيدَ بَيانْ! صَفِّقْ مَعي 👏';
/** بدايات الأسطر داخل /kids/common/audio/anthem.mp3 بالثواني (من kids/common/audio/cut/anthem-times.json) */
export const ANTHEM_AT = [4.33, 7.49, 11.35, 15.98];

/* نشيد الختام (هـ-6-ي): يعكس ما عمله الطفل — سطران مشتركان، ثمّ سطر الجلسة (حرفها وقيمتها)، ثمّ سطر الأثر والوداع. يُشغَّل متسلسلًا (ملفّ لكلّ سطر) فلا يحتاج توقيتات */
export const CLOSE_ANTHEM = ['بَيانْ بَيانْ، هٰذا أَثَري', 'قَرَأْنا لَعِبْنا، وَالْآنَ نَهْدَأْ', 'حَرْفٌ وَكَلِمَةْ، وَآيَةٌ طَيِّبَةْ', 'وَالْأَثَرُ باقٍ، في قَلْبي وَلِساني', 'بَيانْ… إِلَى اللِّقاءْ!'];
const CLOSE_SRC = (i: number) => `/kids/common/audio/anthem-close-${i}.mp3`;
function ClosingAnthem(p: Ctx) {
  const { S } = p;
  const [line, setLine] = useState(-2); // -2 لم يبدأ · -1 يبدأ · 0..4 السطر الحاليّ · 5 انتهى
  const lines = useMemo(() => [CLOSE_ANTHEM[0], CLOSE_ANTHEM[1], S.closing?.line || CLOSE_ANTHEM[2], CLOSE_ANTHEM[3], CLOSE_ANTHEM[4]], [S]);
  const srcs = useMemo(() => [CLOSE_SRC(1), CLOSE_SRC(2), S.closing ? p.snd(S.closing.audio) : CLOSE_SRC(3), CLOSE_SRC(4), CLOSE_SRC(5)], [S, p]);
  const sing = () => {
    setLine(-1); p.setPose('dance'); p.setLstate('dance'); p.setSay('نَشيدُ الْخِتامْ! صَفِّقْ مَعي 👏');
    let i = 0;
    const step = () => {
      if (i >= srcs.length) { setLine(lines.length); p.setLstate('cheer'); p.setSay('صَفَّقْتَ مَعي؟ يا سَلامْ! إِلَى اللِّقاءْ 👋'); if (p.child) p.report({ closing: true }); return; }
      const k = i++; setLine(k); p.setSay(lines[k]); p.play(srcs[k], step, true);
    };
    step();
  };
  return (
    <div className="by-close">
      <h2 className="by-h2">نَشيدُ الْخِتامْ 👏</h2>
      <div className="by-anthem">{lines.map((l, i) => <p key={i} className={i === line ? 'on' : i < line ? 'past' : ''}>{l}</p>)}</div>
      {line === -2 && <button className="by-big" onClick={sing}>نُنْشِدُ مَعًا! 🎵</button>}
      {line >= lines.length && <button className="by-ghost" onClick={sing}>مَرَّةً أُخْرى 🔁</button>}
    </div>
  );
}

/* ───────── 2) الحكاية ───────── */
function Story(p: Ctx) {
  const { S } = p;
  const [i, setI] = useState(0);
  const [li, setLi] = useState(0);
  const [asked, setAsked] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const panel = S.panels[i];
  const playLine = useCallback((k: number) => {
    const l = panel.lines[k]; if (!l) return; setLi(k);
    if (!l.audio) return;
    const after = () => { if (k + 1 < panel.lines.length) playLine(k + 1); };
    if (l.who === 'لؤلؤ') p.luluSay(l.text, l.audio, 'cheer', after);
    else p.play(p.snd(l.audio), after);
  }, [panel, p]);
  useEffect(() => { setLi(0); if (panel.sfx) p.bg(p.snd(panel.sfx), 0.5); const t = setTimeout(() => playLine(0), panel.sfx ? 1800 : 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i]);
  const forward = () => {
    if (panel.n === S.storyChoice.after && !asked) { setAsked(true); p.lulu('question', 'think', p.awaitAnswer); return; }
    if (i + 1 < S.panels.length) setI(i + 1); else { p.finish('story'); p.next(); }
  };
  const pick = (k: string) => { p.stopWaiting(); setChoice(k); p.lulu('letsee', 'point', () => setI(i + 1)); };
  return (
    <section className="by-story">
      <figure className="by-panel"><img src={p.img(`panel-0${panel.n}`)} alt={`لوحة ${panel.n}`} /></figure>
      <div className="by-lines">
        {panel.lines.map((l, k) => (
          <button key={k} className={`by-line ${k === li ? 'on' : ''} ${l.who === 'جدّ سالم' ? 'salem' : ''}`} onClick={() => playLine(k)}>
            <span className="who">{l.who}</span><span className="txt">{l.text}</span><span className="spk">🔊</span>
          </button>
        ))}
      </div>
      {asked && !choice && panel.n === S.storyChoice.after ? (
        <div className="by-choices">
          <p className="by-q">{S.lulu.question.text}</p>
          {S.storyChoice.options.map(o => <button key={o.key} className="by-opt" onClick={() => pick(o.key)}><span className="em">{o.emoji}</span>{o.text}</button>)}
        </div>
      ) : (
        <nav className="by-nav">
          <button className="by-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>السّابِق</button>
          <span className="by-count">{panel.n} / {S.panels.length}</span>
          <button className="by-big" onClick={forward}>{i + 1 < S.panels.length ? 'التّالي ◀' : 'اِنْتَهَتِ الْحِكايَة ✨'}</button>
        </nav>
      )}
    </section>
  );
}

/* ───────── 3) حَرْف يرسم ───────── */
function Glyph({ g }: { g: 'baa' | 'alif' | 'taa' | 'thaa' | 'jeem' | 'haa' }) {
  if (g === 'haa') return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M62 38 Q118 30 150 46" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M150 46 Q60 70 44 84 Q24 110 60 128 Q110 146 160 110" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /></svg>;
  if (g === 'jeem') return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M62 38 Q118 30 150 46" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M150 46 Q60 70 44 84 Q24 110 60 128 Q110 146 160 110" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><circle cx="96" cy="102" r="9" fill="#E8795C" /></svg>;
  if (g === 'thaa') return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M20 70 Q100 130 180 70" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M20 70 L20 40" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><circle cx="100" cy="18" r="9" fill="#E8795C" /><circle cx="84" cy="44" r="9" fill="#E8795C" /><circle cx="116" cy="44" r="9" fill="#E8795C" /></svg>;
  if (g === 'taa') return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M20 70 Q100 130 180 70" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M20 70 L20 40" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><circle cx="86" cy="38" r="9" fill="#E8795C" /><circle cx="114" cy="38" r="9" fill="#E8795C" /></svg>;
  if (g === 'alif') return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M100 26 L100 126" fill="none" stroke="#3A1F36" strokeWidth="16" strokeLinecap="round" /><text x="100" y="22" textAnchor="middle" fontSize="30" fontWeight="700" fill="#E8795C">ء</text></svg>;
  return <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M20 70 Q100 130 180 70" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M20 70 L20 40" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><circle cx="100" cy="118" r="9" fill="#E8795C" /></svg>;
}
function HarfMorph(p: Ctx & { onDone: () => void }) {
  const { S } = p; const H = S.harf;
  const [wi, setWi] = useState(-1);
  const [vi, setVi] = useState(-1);
  const [heard, setHeard] = useState<Record<string, boolean>>({});
  useEffect(() => { const t = setTimeout(() => p.play(p.snd(H.intro.audio)), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const allHeard = S.vocab.every(v => heard[v.key]);
  const letterCls = S.meta.letter === 'ا' ? '[اأإآ]' : S.meta.letter;
  const mark = (w: string): [string, string, string] => { const m = w.match(new RegExp(`(${letterCls}[\\u064B-\\u0652]*)`)); if (!m || m.index === undefined) return ['', w.slice(0, 1), w.slice(1)]; return [w.slice(0, m.index), m[1], w.slice(m.index + m[1].length)]; };
  return (
    <>
      <div className="by-harf">
        <div className="by-letter" onClick={() => p.play(p.snd(H.intro.audio))} role="button" aria-label="اسمع الحرف">
          <Glyph g={H.glyph} />
          <b>{H.name}</b>
          <small>{H.hint}</small>
        </div>
        <p className="by-speech">{H.intro.text}</p>
        <div className="by-words">
          {H.words.map((w, k) => { const [a0, a, b] = mark(w.w); return (
            <button key={w.w} className={`by-word ${wi === k ? 'on' : ''}`} onClick={() => { setWi(k); p.play(p.snd(w.audio)); }}>
              <span className="em">{w.emoji}</span><span className="w">{a0}<mark>{a}</mark>{b}</span>
            </button>
          ); })}
        </div>
        <div className="by-harakat" onClick={() => p.play(p.snd(H.harakat.audio))} role="button">
          {H.harakat.items.map(h => <span key={h.h} style={{ background: h.color }}><b>{h.h}</b><i>{h.name}</i><small>{h.w}</small></span>)}
        </div>
        {H.glyph === 'alif' && <p className="by-muted">الْهَمْزَةُ صَديقَةُ الْأَلِفْ — تَرْكَبُ فَوْقَهُ مَعَ الْفَتْحَةِ وَالضَّمَّةْ، وَتَحْتَهُ مَعَ الْكَسْرَةْ.</p>}
      </div>
      <h3 className="by-h3">كَلِماتُ الْيَوْم — لُؤْلُؤ تُرَدِّدْ، وَأَنْتَ تُرَدِّدْ</h3>
      <div className="by-vocab">
        {S.vocab.map((v, k) => (
          <button key={v.key} className={`by-vcard ${vi === k ? 'on' : ''} ${heard[v.key] ? 'ok' : ''}`} onClick={() => { setVi(k); setHeard(h => ({ ...h, [v.key]: true })); p.luluSay(v.w, v.audio, 'wave'); }}>
            <img src={p.img(v.img)} alt="" /><b>{v.w}</b><span className="spk">🔊</span>
          </button>
        ))}
      </div>
      <nav className="by-nav end"><button className="by-big" disabled={!allHeard} onClick={p.onDone}>{allHeard ? 'التّالي ◀' : 'اِسْمَعِ الْكَلِماتِ الْأَرْبَعَ أَوَّلًا'}</button></nav>
    </>
  );
}

const ACT_NAMES: Record<HarfActivity['kind'], string> = { morph: 'الحرف يتحوّل', trace: 'تتبّع بإصبعك', hear: 'أسمع الصوت', name: 'الحرف في اسمي', color: 'لوّن الحرف' };
const GAME_NAMES: Record<Game['kind'], string> = { match: 'طابِق', scene: 'في مكانها', memory: 'الذاكرة', missing: 'ماذا اختفى؟', listen: 'اسمع واختر', clap: 'صفّق المقاطع', jump: 'الجسد يلعب', basket: 'سلّة لؤلؤ', discover: 'نكتشف', count: 'عُدّ', paint: 'لوّن حسب الكلمة', catch: 'صيد الكلمة', draw: 'ارسم ما سمعت' };
function Bar({ items, at }: { items: string[]; at: number }) { return <div className="ac-bar" aria-label="تقدّم النشاط">{items.map((t, i) => <span key={i} className={i === at ? 'on' : i < at ? 'ok' : ''}>{i < at ? '★ ' : ''}{t}</span>)}</div>; }

/** حَرْف يرسم — سلسلة أنشطة من البنك (HARF-PLAY-BANK.md) */
function Harf(p: Ctx) {
  const acts = p.S.harf.activities;
  const [ai, setAi] = useState(0);
  const a = acts[ai];
  const onDone = () => { if (ai + 1 < acts.length) { setAi(ai + 1); window.scrollTo({ top: 0 }); } else { p.finish('harf'); p.next(); } };
  const star = () => { p.lulu('yasalam', 'cheer', onDone, 'cheer'); };
  return (
    <section className="by-card">
      <Bar items={acts.map(x => ACT_NAMES[x.kind])} at={ai} />
      {a.kind === 'morph' && <HarfMorph {...p} onDone={onDone} />}
      {a.kind === 'trace' && <Trace key={ai} p={p} strokes={a.strokes} onDone={star} />}
      {a.kind === 'hear' && <Hear key={ai} p={p} items={a.items} onDone={onDone} />}
      {a.kind === 'name' && <NameLetter key={ai} p={p} re={a.letterRe} fallback={a.fallback} onDone={onDone} />}
      {a.kind === 'color' && <ColorLetter key={ai} p={p} A={a} onDone={onDone} />}
      {ai + 1 === acts.length && a.kind !== 'morph' && <p className="by-muted">بَعْدَ هٰذا النَّشاطْ: هَيّا نَلْعَبْ 🎲</p>}
    </section>
  );
}



/* ───────── 4) هيّا بنا نلعب: مطابقة (كلمة → بطاقة) أو مشهد (كلمة → مكانها) ───────── */
function shuffle<T>(a: T[], seed = 3): T[] { const r = [...a]; let s = seed; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function PrimaryGame(p: Ctx & { G: Extract<Game, { kind: 'match' | 'scene' }>; onDone: () => void }) {
  const { S, G } = p; const V = S.vocab;
  const words = useMemo(() => shuffle(V, 5), [V]);
  const pics = useMemo(() => shuffle(V, 11), [V]);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState<string | null>(null);
  const [round, setRound] = useState<1 | 2 | 3>(1); // 2 = لؤلؤ تلعب وتخطئ · 3 = الطفل يصحّح
  const [brk, setBrk] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordOf = (k: string) => V.find(x => x.key === k)!;
  const mistakeWord = wordOf(G.luluMistake.word), mistakeOnto = wordOf(G.luluMistake.onto);
  useEffect(() => { const t = setTimeout(() => p.lulu('play', 'point', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const armIdle = useCallback(() => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(() => p.lulu('hint', 'point', undefined, 'hint'), 9000); }, [p]);
  useEffect(() => { if (round === 1 && !brk) armIdle(); return () => { if (idle.current) clearTimeout(idle.current); }; }, [armIdle, sel, matched, round, brk]);
  const complete = Object.keys(matched).length === V.length;
  useEffect(() => { if (complete && round === 1) { setTimeout(() => { setRound(2); p.lulu('mistake', 'think', p.awaitAnswer); }, 900); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [complete, round]);

  const tapWord = (k: string) => { if (matched[k]) return; p.stopWaiting(); setSel(k); p.play(p.snd(wordOf(k).audio)); };
  const tapTarget = (k: string) => {
    if (round !== 1 || !sel || matched[k]) return;
    if (sel === k) { setMatched(m => ({ ...m, [k]: true })); setSel(null); p.lulu('correct', 'cheer', undefined, 'cheer'); }
    else { setShake(k); setTimeout(() => setShake(null), 500); p.lulu('tryagain', 'think', undefined, 'encourage'); }
  };
  const answerLulu = (yes: boolean) => { p.stopWaiting(); if (yes) { p.lulu('hmm', 'think', p.awaitAnswer); } else { setRound(3); p.lulu('thanks', 'dance', p.awaitAnswer); } };
  const fix = (k: string) => { if (round !== 3) return; p.stopWaiting(); if (k === G.luluMistake.word) { p.lulu('correct', 'cheer', () => { setBrk(true); p.lulu('brk', 'dance', undefined, 'dance'); }, 'cheer'); } else p.lulu('tryagain', 'think', undefined, 'encourage'); };
  const label = (k: string) => (round === 2 && k === G.luluMistake.onto ? `${mistakeWord.w} ؟` : wordOf(k).w);
  const cls = (k: string) => `${matched[k] ? 'ok' : ''} ${shake === k ? 'shake' : ''} ${round === 2 && k === G.luluMistake.onto ? 'lulu-wrong' : ''}`;
  const onTarget = (k: string) => (round === 3 ? fix(k) : tapTarget(k));
  return (
    <>
      <h2 className="by-h2">{round === 1 ? G.title : round === 2 ? 'دَوْرُ لُؤْلُؤ!' : `صَحِّحْ لِلُؤْلُؤ: أَيْنَ «${mistakeWord.w}»؟`}</h2>
      {G.kind === 'match' ? (
        <div className="by-pics">
          {pics.map(v => (
            <button key={v.key} className={`by-pic ${cls(v.key)}`} onClick={() => onTarget(v.key)} aria-label={v.w}>
              <img src={p.img(v.img)} alt="" />
              {(matched[v.key] || round !== 1) && <span className="lbl">{label(v.key)}</span>}
            </button>
          ))}
        </div>
      ) : (
        <div className="by-scene">
          <img src={p.img(G.img)} alt="" />
          {G.hotspots.map(h => (
            <button key={h.key} className={`by-spot ${cls(h.key)}`} style={{ left: `${h.x}%`, top: `${h.y}%`, width: `${h.w}%`, height: `${h.h}%` }} onClick={() => onTarget(h.key)} aria-label={wordOf(h.key).w}>
              {(matched[h.key] || round !== 1) && <span className="lbl">{label(h.key)}</span>}
            </button>
          ))}
        </div>
      )}
      {round === 1 && (
        <div className="by-chips">
          {words.map(v => <button key={v.key} className={`by-chip big ${sel === v.key ? 'on' : ''} ${matched[v.key] ? 'gone' : ''}`} onClick={() => tapWord(v.key)} disabled={!!matched[v.key]}>{v.w} 🔊</button>)}
        </div>
      )}
      {round === 2 && (
        <div className="by-choices row">
          <p className="by-q">لُؤْلُؤ وَضَعَتْ «{mistakeWord.w}» عَلى «{mistakeOnto.w}»… هَلْ أَصابَتْ؟</p>
          <button className="by-opt" onClick={() => answerLulu(true)}>نَعَمْ 👍</button>
          <button className="by-opt" onClick={() => answerLulu(false)}>لا 👎</button>
        </div>
      )}
      {brk && (
        <div className="by-break">
          <p>🤸 اِسْتِراحَةُ الْحَيَوِيَّةْ: {S.lulu.brk.text}</p>
          <button className="by-big" onClick={p.onDone}>جَلَسْتُ! لُعْبَةٌ ثانِيَةْ ◀</button>
        </div>
      )}
    </>
  );
}

/** هيّا بنا نلعب — اللعبة الرئيسة (مع جولة لؤلؤ) ثم ألعاب البنك، ثم «لُعْبَةٌ أُخْرى؟» اختيارية */
function GameView({ p, G, onDone }: { p: Ctx; G: Game; onDone: () => void }) {
  switch (G.kind) {
    case 'match': case 'scene': return <PrimaryGame {...p} G={G} onDone={onDone} />;
    case 'memory': return <Memory p={p} onDone={onDone} />;
    case 'missing': return <Missing p={p} rounds={G.rounds} onDone={onDone} />;
    case 'listen': return <Listen p={p} rounds={G.rounds} onDone={onDone} />;
    case 'clap': return <Clap p={p} items={G.items} onDone={onDone} />;
    case 'jump': return <Jump p={p} items={G.items} onDone={onDone} />;
    case 'basket': return <Basket p={p} items={G.items} onDone={onDone} />;
    case 'discover': return <Discover p={p} G={G} onDone={onDone} />;
    case 'count': return <Count p={p} G={G} onDone={onDone} />;
    case 'paint': return <Paint p={p} G={G} onDone={onDone} />;
    case 'catch': return <Catch p={p} G={G} onDone={onDone} />;
    case 'draw': return <Draw p={p} G={G} onDone={onDone} />;
  }
}
function Play(p: Ctx) {
  const { S } = p;
  const [gi, setGi] = useState(0);
  const [offer, setOffer] = useState(false);
  const [extra, setExtra] = useState(false);
  const games = extra && S.extraGame ? [...S.games, S.extraGame] : S.games;
  const G = games[gi];
  const leave = () => { p.finish('play'); p.next(); };
  const onDone = () => {
    if (gi + 1 < games.length) { setGi(gi + 1); window.scrollTo({ top: 0 }); return; }
    if (S.extraGame && !extra) { setOffer(true); p.luluSay(COMMON.another.text, COMMON.another.audio, 'think', p.awaitAnswer); return; }
    leave();
  };
  const titles = games.map(g => GAME_NAMES[g.kind]);
  return (
    <section className="by-card">
      <Bar items={S.extraGame && !extra ? [...titles, 'لعبة أخرى؟'] : titles} at={gi} />
      {!offer && G && <GameView key={gi} p={p} G={G} onDone={onDone} />}
      {offer && (
        <div className="by-choices row">
          <p className="by-q">{COMMON.another.text} 🎲</p>
          <button className="by-opt good" onClick={() => { p.stopWaiting(); setOffer(false); setExtra(true); setGi(S.games.length); }}>نَعَمْ! {S.extraGame ? GAME_NAMES[S.extraGame.kind] : ''} 🎉</button>
          <button className="by-opt" onClick={() => { p.stopWaiting(); leave(); }}>لا، هَيّا نُمَثِّلْ 🎭</button>
        </div>
      )}
    </section>
  );
}

/* ───────── 5) هيّا بنا نمثّل ───────── */
function Act(p: Ctx) {
  const { S } = p; const R = S.roles;
  const [swap, setSwap] = useState(false);
  useEffect(() => { const t = setTimeout(() => p.lulu('act', 'point'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const me = swap ? R.you : R.me, you = swap ? R.me : R.you;
  return (
    <section className="by-card">
      <h2 className="by-h2">{R.mePrompt}</h2>
      <div className="by-roles">
        <div className="by-role me"><span className="tag">{p.name || 'أَنا'}</span><h3>{me.title}</h3>{me.lines.map(l => <p key={l}>{l}</p>)}</div>
        <div className="by-role you"><span className="tag">ماما / بابا</span><h3>{you.title}</h3>{you.lines.map(l => <p key={l}>{l}</p>)}</div>
      </div>
      <div className="by-row">
        {R.model && <button className="by-ghost" onClick={() => p.play(p.snd(R.model!.audio))}>{R.model.label} 🔊</button>}
        <button className="by-ghost" onClick={() => setSwap(s => !s)}>بَدِّلُوا الْأَدْوارْ 🔁</button>
      </div>
      <p className="by-parent">💡 لوليّ الأمر: {R.parentTip}</p>
      <nav className="by-nav end"><button className="by-big" onClick={() => { p.finish('act'); p.next(); }}>مَثَّلْنا! إِلى جَدّ سالِم 🕌</button></nav>
    </section>
  );
}

/* ───────── 6) في مدرسة المصطفى ﷺ (لؤلؤ صامتة) ───────── */
function Hadith(p: Ctx) {
  const { S } = p; const H = S.hadith;
  const [rep, setRep] = useState(0);
  const [ans, setAns] = useState<string | null>(null);
  const [rev, setRev] = useState(false);
  useEffect(() => { const t = setTimeout(() => p.play(p.snd(H.story.audio)), 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const repeat = () => { p.play(p.snd(H.repeat.audio)); setRep(r => Math.min(3, r + 1)); };
  const opt = H.options.find(o => o.key === ans);
  return (
    <section className="by-card calm">
      <div className="by-salem"><img src="/kids/lulu/calm.png" alt="" className="by-quietlulu" /><h2 className="by-h2">في مَدْرَسَةِ الْمُصْطَفى ﷺ</h2></div>
      <button className="by-line salem on" onClick={() => p.play(p.snd(H.story.audio))}><span className="who">جدّ سالم</span><span className="txt">{H.story.text}</span><span className="spk">🔊</span></button>
      <div className="by-hadith">
        <p className="txt">«{H.text}»</p><p className="src">{H.source}</p>
        <button className="by-big" onClick={repeat}>رَدِّدْ مَعي 🔊 {rep > 0 && <small>{'⭐'.repeat(rep)}</small>}</button>
      </div>
      {H.review && (
        <div className="by-review by-hreview">
          <button className="by-ghost" onClick={() => { setRev(true); p.play(p.snd(H.review!.intro.audio), () => p.play(p.snd(H.review!.audio))); }}>🔁 حَديثُ الْأُسْبوعِ الْماضي</button>
          {rev && <p className="txt small">«{H.review.text}» <span className="src">{H.review.source}</span></p>}
        </div>
      )}
      <button className="by-speech by-speech-btn" onClick={() => p.play(p.snd(H.lesson.audio))}>{H.lesson.text} 🔊</button>
      <div className="by-choices">
        <button className="by-q by-speech-btn" onClick={() => p.play(p.snd(H.question.audio))}>{H.question.text} 🔊</button>
        {H.options.map(o => <button key={o.key} className={`by-opt ${ans === o.key ? (o.good ? 'good' : 'soft') : ''}`} onClick={() => { setAns(o.key); p.play(p.snd(`s-opt-${o.key}`)); }}><span className="em">{o.emoji}</span>{o.text}</button>)}
        {opt && <p className="by-reply">{opt.reply}</p>}
      </div>
      <nav className="by-nav end"><button className="by-big" disabled={rep < 3 || !opt?.good} onClick={() => { p.finish('hadith'); p.next(); }}>{rep < 3 ? 'رَدِّدِ الْحَديثَ ثَلاثَ مَرّاتْ' : !opt?.good ? H.goodLabel : 'هَيّا بِنا نَتْلو 📿'}</button></nav>
    </section>
  );
}

/* ───────── 7) هيّا بنا نتلو: الفاتحة أو سورة الجلسة (لؤلؤ صامتة · «المصحف المعلّم») ───────── */
function Quran(p: Ctx) {
  const { S } = p; const Q = S.quran;
  const [n, setN] = useState(0);
  const [heard, setHeard] = useState<Record<number, boolean>>({});
  const [all, setAll] = useState(false);
  const AYAT = Q.surah?.ayat ?? FATIHA; const SNUM = Q.surah?.num ?? 1; const SNAME = Q.surah?.name ?? 'الْفاتِحَة';
  const FROM = Q.surah?.from ?? 1; // الجلسة (ب): الآيات السابقة مراجعة مطويّة، والجديد يبدأ من FROM
  const [review, setReview] = useState(false);
  const count = all ? AYAT.length : Q.newKidsAyat;
  const shown = all ? AYAT.map((a, i) => ({ a, k: i + 1 })) : AYAT.slice(FROM - 1, FROM - 1 + count).map((a, i) => ({ a, k: FROM + i }));
  const prev = FROM > 1 && !all ? AYAT.slice(0, FROM - 1).map((a, i) => ({ a, k: i + 1 })) : [];
  useEffect(() => { const t = setTimeout(() => p.play(p.snd(Q.intro.audio)), 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const listen = (k: number) => { setN(k); p.play(ayahUrl(k, SNUM), () => setHeard(h => ({ ...h, [k]: true }))); };
  const ok = shown.every(x => heard[x.k]);
  return (
    <section className="by-card calm">
      <div className="by-salem"><img src="/kids/lulu/calm.png" alt="" className="by-quietlulu" /><h2 className="by-h2">هَيّا بِنا نَتْلو — سورَةُ {SNAME}</h2></div>
      <p className="by-speech">{Q.intro.text}</p>
      {prev.length > 0 && (
        <div className="by-review">
          <button className="by-ghost" onClick={() => setReview(r => !r)}>{review ? 'أَخْفِ الْمُراجَعَةْ ▴' : `مُراجَعَةْ: الْآياتُ ١–${['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'][prev.length] ?? prev.length} ▾`}</button>
          {review && <div className="by-ayat small">{prev.map(({ a, k }) => <button key={k} className={`by-ayah ${n === k ? 'on' : ''}`} onClick={() => listen(k)}><span className="num">{k}</span><span className="txt">{a}</span><span className="spk">🔊</span></button>)}</div>}
        </div>
      )}
      <div className="by-ayat">
        {shown.map(({ a, k }) => {
          return (
            <button key={k} className={`by-ayah ${n === k ? 'on' : ''} ${heard[k] ? 'ok' : ''}`} onClick={() => listen(k)}>
              <span className="num">{k}</span><span className="txt">{a}</span><span className="spk">{heard[k] ? '✅' : '🔊'}</span>
            </button>
          );
        })}
      </div>
      <div className="by-row">
        <button className="by-ghost" onClick={() => Q.meaning.ayah ? p.play(ayahUrl(Q.meaning.ayah, SNUM), () => p.play(p.snd(Q.meaning.audio))) : p.play(p.snd(Q.meaning.audio))}>مَعْنى بِكَلِمَة: {Q.meaning.text}</button>
        {!all && <button className="by-ghost" onClick={() => setAll(true)}>أَحْفَظُها كامِلَةً — أَظْهِرِ السّورَة</button>}
      </div>
      <p className="by-parent">🎙️ بعد كل آية: دَوْرُكْ — ردّد الآية بصوتك مع ماما أو بابا (في «المصحف المعلّم» يقرأ الشيخ ثم يردّد الأطفال). التلاوة: {RECITER.name}.</p>
      <nav className="by-nav end"><button className="by-big" disabled={!ok} onClick={() => { p.play(p.snd(Q.closing.audio)); p.finish('quran'); p.next(); }}>{ok ? 'صَدَقَ اللهُ الْعَظيمْ ✨' : 'اِسْتَمِعْ لِكُلِّ آيَةٍ ثُمَّ رَدِّدْ'}</button></nav>
    </section>
  );
}

/* ───────── 8) أثري اليوم ───────── */
function Athari(p: Ctx & { others: SessionData[] }) {
  const { S } = p; const A = S.athari;
  const [self, setSelf] = useState<string | null>(null);
  const drawings = useMemo(() => { const out: { w: string; src: string }[] = []; for (const g of [...S.games, ...(S.extraGame ? [S.extraGame] : [])]) { if (g.kind !== 'draw') continue; for (const r of g.rounds) { try { const v = localStorage.getItem(`bayan_draw_${S.slug}_${r.key}`); if (v) out.push({ w: r.w, src: v }); } catch { /* ignore */ } } } return out; }, [S]);
  const [talked, setTalked] = useState(!S.talk);
  const [talkReady, setTalkReady] = useState(false);
  const [letterHeard, setLetterHeard] = useState(!S.letter);
  const B = typeof A.bedtime === 'string' ? null : A.bedtime;
  useEffect(() => { const t = setTimeout(() => p.lulu('athari', 'dance', () => setTalkReady(true), 'dance'), 400); if (p.child) p.report({ stations: { athari: true } }); else { try { localStorage.setItem(`bayan_demo_done_${S.slug}`, new Date().toISOString()); } catch { /* ignore */ } } return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <section className="by-card">
      <div className="by-badge"><img src={p.img(S.meta.badge.img)} alt="" /><h1 className="by-huge">شارَةُ «{S.meta.badge.title}»</h1><p className="by-sub">مُبارَكْ يا {p.name || p.hero}!</p></div>
      <ul className="by-summary">{A.summary.map(s => <li key={s}>🌱 {s}</li>)}</ul>
      {S.letter && talkReady && !talked && (
        <div className="by-mail">
          <img src={S.letter.img} alt="" />
          <div>
            <h3>📬 رِسالَةٌ مِنْ بَعيدْ — مِنْ {S.letter.from}</h3>
            <button className="by-big" onClick={() => { setLetterHeard(false); let done = false; const ok = () => { if (!done) { done = true; setLetterHeard(true); } }; p.play(p.snd(S.letter!.audio), ok); setTimeout(ok, 20000); }}>{S.letter.button}</button>
            <p className="by-muted">{S.letter.text}</p>
          </div>
        </div>
      )}
      {S.talk && !talked && talkReady && letterHeard && <div className="by-talk"><Talk p={p} T={S.talk} recogAllowed={p.child ? p.child.consents.speech_recog : undefined} onDone={o => { setTalked(true); if (o && o.results.length) p.report({ talk: o.results, selfVoice: o.selfVoice }); window.scrollTo({ top: 0 }); }} /></div>}
      {talked && <>
      <ClosingAnthem {...p} />
      <div className="by-self">
        <p className="by-q">{A.selfCheck.q}</p>
        <div className="by-row">{A.selfCheck.options.map(o => <button key={o.key} className={`by-face ${self === o.key ? 'on' : ''}`} onClick={() => { setSelf(o.key); p.setLstate('cheer'); if (p.child) p.report({ self: o.key }); else { try { localStorage.setItem(`bayan_demo_self_${S.slug}`, o.key); } catch { /* ignore */ } } }}><span>{o.emoji}</span>{o.text}</button>)}</div>
        {self && <p className="by-muted">شُكْرًا! سَيَراها الْميسِّرُ وَماما أَوْ بابا في مِلَفِّ إِنْجازِكْ.</p>}
      </div>
      <div className="by-task"><h3>مُهِمَّةُ الْبَيْت 🏠</h3><p>{A.homeTask}</p></div>
      <div className="by-pcard">
        <h3>بطاقة وليّ الأمر</h3>
        <p><b>تعلّمنا اليوم:</b> {A.parentCard.learned}</p>
        <p><b>كيف تدعمه:</b></p><ul>{A.parentCard.support.map(s => <li key={s}>{s}</li>)}</ul>
        {drawings.length > 0 && <div className="by-drawings">{drawings.map(d => <figure key={d.w}><img src={d.src} alt={`رسم الطفل: ${d.w}`} /><figcaption>🖼️ {d.w}</figcaption></figure>)}</div>}
        {B ? (
          <div className="by-bedtime">
            <img src={B.img} alt="" />
            <div><h3>🌙 قِصَّةُ اللَّيْلَةْ: «{B.title}»</h3><p className="by-muted">بصوت جدّ سالم · {B.minutes} دقائق · للاستماع في الفراش</p>
              <audio controls preload="none" src={B.audio} style={{ width: '100%' }} />
              {B.video && <a className="by-ghost" href={B.video} target="_blank" rel="noopener" style={{ display: 'inline-block', marginTop: 6 }}>🎬 شاهِدْها فيديو — للمشاركة مع الأسرة</a>}</div>
          </div>
        ) : <p className="by-muted">🌙 {String(A.bedtime)}</p>}
      </div>
      </>}
      <nav className="by-nav end">
        <Link className="by-ghost" href="/contact?topic=bayan">رأي وليّ الأمر في التجربة ✍️</Link>
        {p.others.map(o => <Link key={o.slug} className="by-ghost" href={p.child ? p.child.playHref(o.slug) : `/kids/demo/${o.slug}`}>الجلسة {o.meta.order}: «في {o.meta.world}» ▶</Link>)}
        <Link className="by-big" href={p.child ? p.child.exitHref : '/kids'}>اِنْتَهَيْنا ✨</Link>
      </nav>
    </section>
  );
}

export const BAYAN_CSS = `
.by{--plum:#3A1F36;--coral:#E8795C;--sand:#F1D9A8;--sea:#5EA8A0;--shell:#FBF4EE;--sky:#7FC8E8;--ink:#2A1626;min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#fff 0%,var(--shell) 60%);color:var(--ink);font-family:var(--font-read,var(--font-ar,sans-serif));font-size:20px;padding-bottom:160px}
.by *{box-sizing:border-box}
.by-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;padding:8px 12px;background:rgba(251,244,238,.92);backdrop-filter:blur(6px);border-bottom:2px solid var(--sand)}
.by-exit{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:#fff;border:2px solid var(--sand);color:var(--plum);text-decoration:none;font-weight:700}
.by-stations{display:flex;gap:6px;list-style:none;margin:0;padding:0;flex:1;overflow:auto}
.by-stations li button{display:flex;flex-direction:column;align-items:center;gap:2px;border:2px solid transparent;background:#fff;border-radius:14px;padding:4px 8px;min-width:58px;cursor:pointer;color:var(--ink);opacity:.6}
.by-stations li.on button{border-color:var(--coral);opacity:1;background:#fff5f0}.by-stations li.ok button{opacity:1;border-color:var(--sea)}
.by-stations .ic{font-size:20px}.by-stations .tt{font-size:11px;white-space:nowrap}
.by-brand{display:flex;align-items:center;gap:6px;color:var(--plum)}
.by-stage{max-width:960px;margin:0 auto;padding:14px 14px 190px}
.by-card{background:#fff;border:2px solid var(--sand);border-radius:24px;padding:20px;box-shadow:0 8px 30px rgba(58,31,54,.06)}
.by-card.calm{background:linear-gradient(180deg,#fff,#fdf7ef);border-color:#e6d2b5}
.by-center{text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.by-huge{font-size:34px;margin:0;color:var(--plum)}.by-h2{font-size:24px;margin:0 0 12px;color:var(--plum)}.by-h3{font-size:19px;margin:18px 0 8px;color:var(--plum)}
.by-sub{margin:0;color:#6b5a66}.by-muted{color:#8E7F8A;font-size:16px}
.by-parent{font-size:15px;color:#5C4858;background:#f6f0f4;border-radius:12px;padding:8px 12px;margin:10px 0}
.by-input{font-size:24px;padding:12px 16px;border:2px solid var(--sand);border-radius:16px;width:100%;max-width:420px;text-align:center}
.by-row{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:12px 0}
.by-chip{font-size:20px;padding:10px 18px;border-radius:999px;border:2px solid var(--sand);background:#fff;cursor:pointer;color:var(--ink)}
.by-chip.on{background:var(--coral);border-color:var(--coral);color:#fff}.by-chip.big{font-size:26px;padding:14px 24px}.by-chip.gone{opacity:.25}
.by-big{font-size:24px;padding:16px 28px;border-radius:999px;border:0;background:var(--coral);color:#fff;cursor:pointer;box-shadow:0 6px 0 #b9544a;font-weight:700;text-decoration:none;display:inline-block}
.by-big:active{transform:translateY(4px);box-shadow:0 2px 0 #b9544a}.by-big:disabled{background:#d9cbc2;box-shadow:none;cursor:not-allowed}
.by-ghost{font-size:18px;padding:12px 20px;border-radius:999px;border:2px solid var(--sea);background:#fff;color:#2F6B66;cursor:pointer;text-decoration:none}
.by-tap{background:none;border:0;cursor:pointer;animation:by-bob 1.6s ease-in-out infinite}
@keyframes by-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
.by-anthem p{font-size:26px;margin:6px 0;color:#9a8a95;transition:.3s}.by-anthem p.on{color:var(--plum);font-weight:700;transform:scale(1.06)}.by-anthem p.past{color:var(--sea)}
.by-story{display:grid;gap:12px}
.by-panel{margin:0;border-radius:24px;overflow:hidden;border:3px solid var(--sand);background:#fff}.by-panel img{width:100%;display:block;aspect-ratio:16/9;object-fit:cover}
.by-lines{display:grid;gap:8px}
.by-line{display:flex;gap:10px;align-items:center;text-align:start;border:2px solid var(--sand);background:#fff;border-radius:16px;padding:10px 14px;font-size:21px;cursor:pointer;color:var(--ink)}
.by-line.on{border-color:var(--coral);background:#fff5f0}.by-line .who{font-size:14px;color:#fff;background:var(--plum);border-radius:999px;padding:2px 10px;white-space:nowrap}.by-line .txt{flex:1;line-height:1.7}.by-line.salem .who{background:#2F6B66}
.by-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}.by-nav.end{justify-content:flex-end}
.by-count{color:#8E7F8A}
.by-choices{display:grid;gap:10px;justify-items:center;margin-top:10px}.by-choices.row{grid-template-columns:1fr 1fr}.by-choices.row .by-q{grid-column:1/-1}
.by-q{font-size:24px;color:var(--plum);margin:4px 0;text-align:center;grid-column:1/-1}
.by-opt{font-size:22px;padding:14px 22px;border-radius:18px;border:2px solid var(--sand);background:#fff;cursor:pointer;display:flex;gap:10px;align-items:center;color:var(--ink);min-width:260px;justify-content:center}
.by-opt .em{font-size:28px}.by-opt.good{border-color:var(--sea);background:#E6F3F1}.by-opt.soft{border-color:var(--sand);background:#fff8ea}
.by-reply{grid-column:1/-1;background:#E6F3F1;border-radius:14px;padding:10px 14px;font-size:20px;color:#2F6B66}
.by-harf{display:grid;gap:12px;justify-items:center}
.by-letter{display:grid;justify-items:center;gap:4px;cursor:pointer;background:var(--shell);border-radius:24px;padding:12px 24px;border:2px dashed var(--sand)}
.by-letter b{font-size:40px;color:var(--plum)}.by-letter small{color:#6b5a66}
.by-speech{font-size:21px;line-height:1.9;color:#4A3645;text-align:center;margin:4px 0}
.by-words{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.by-word{font-size:28px;border:2px solid var(--sand);background:#fff;border-radius:18px;padding:10px 18px;cursor:pointer;display:flex;gap:10px;align-items:center;color:var(--ink)}
.by-word.on{border-color:var(--coral)}.by-word mark{background:#ffe3d9;color:var(--coral);border-radius:6px;padding:0 2px}
.by-harakat{display:flex;gap:10px;cursor:pointer}.by-harakat span{display:grid;justify-items:center;color:#fff;border-radius:16px;padding:8px 16px;min-width:96px}
.by-harakat b{font-size:32px}.by-harakat i{font-size:13px;font-style:normal;opacity:.9}.by-harakat small{font-size:14px}
.by-vocab{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.by-vcard{display:grid;justify-items:center;gap:6px;border:2px solid var(--sand);background:#fff;border-radius:18px;padding:8px;cursor:pointer;color:var(--ink);position:relative}
.by-vcard img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.by-vcard b{font-size:24px}.by-vcard.on{border-color:var(--coral)}.by-vcard.ok::after{content:'✓';position:absolute;top:6px;inset-inline-start:8px;background:var(--sea);color:#fff;border-radius:50%;width:26px;height:26px;display:grid;place-items:center;font-size:15px}
.by-pics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.by-pic{border:3px solid var(--sand);background:#fff;border-radius:18px;padding:6px;cursor:pointer;position:relative;color:var(--ink)}
.by-pic img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:12px}.by-pic.ok{border-color:var(--sea)}.by-pic .lbl{display:block;font-size:22px;padding-top:4px}
.by-pic.shake{animation:by-shake .45s}.by-pic.lulu-wrong{border-color:var(--coral);background:#fff5f0}
@keyframes by-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
.by-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:14px}
.by-break{margin-top:14px;background:#E6F3F1;border-radius:18px;padding:14px;text-align:center;font-size:22px;display:grid;gap:10px;justify-items:center}
.by-roles{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.by-role{border-radius:20px;padding:14px;border:2px solid var(--sand);background:#fff;text-align:center}.by-role.me{border-color:var(--coral)}.by-role.you{border-color:var(--sea)}
.by-role .tag{font-size:14px;background:var(--plum);color:#fff;border-radius:999px;padding:2px 12px}.by-role h3{margin:8px 0;color:var(--plum)}.by-role p{font-size:24px;margin:6px 0}
.by-salem{display:flex;align-items:center;gap:12px}.by-quietlulu{width:56px;height:56px;border-radius:50%;object-fit:cover;opacity:.8}
.by-hadith{text-align:center;background:#fff;border:2px solid #e6d2b5;border-radius:20px;padding:16px;margin:12px 0;display:grid;gap:8px;justify-items:center}
.by-hadith .txt{font-size:34px;color:var(--plum);margin:0;line-height:1.8}.by-hadith .src{margin:0;color:#8E7F8A}
.by-ayat{display:grid;gap:8px;margin:10px 0}
.by-ayah{display:flex;gap:12px;align-items:center;text-align:start;border:2px solid #e6d2b5;background:#fff;border-radius:16px;padding:12px 14px;font-size:30px;cursor:pointer;color:var(--ink);line-height:1.9}
.by-ayah.on{border-color:var(--coral);background:#fff5f0}.by-ayah.ok{border-color:var(--sea)}.by-ayah .num{font-size:14px;background:var(--plum);color:#fff;border-radius:50%;width:28px;height:28px;display:grid;place-items:center;flex:none}.by-ayah .txt{flex:1}
.by-badge{text-align:center;display:grid;justify-items:center;gap:6px}.by-badge img{width:200px;height:200px;object-fit:contain;animation:by-bob 2s ease-in-out infinite}
.by-summary{list-style:none;padding:0;margin:14px 0;display:grid;gap:6px;font-size:21px}
.by-self{background:#E6F3F1;border-radius:18px;padding:12px 16px;margin-bottom:12px;text-align:center}
.by-face{display:grid;justify-items:center;gap:4px;font-size:18px;border:2px solid var(--sand);background:#fff;border-radius:18px;padding:10px 18px;cursor:pointer;color:var(--ink);min-width:120px}.by-face span{font-size:36px}.by-face.on{border-color:var(--sea);background:#fff}
.by-task{background:#fff8ea;border-radius:18px;padding:12px 16px;border:2px solid var(--sand)}.by-task h3{margin:0 0 6px;color:var(--plum)}
.by-mail{display:grid;grid-template-columns:120px 1fr;gap:14px;align-items:center;background:#fff;border:3px solid var(--sand);border-radius:22px;padding:14px;margin:8px 0}.by-mail img{width:120px;height:120px;object-fit:cover;border-radius:50%;border:3px solid var(--sky)}.by-mail h3{margin:0 0 8px;color:var(--plum)}
.by-bedtime{display:grid;grid-template-columns:96px 1fr;gap:12px;align-items:center;margin-top:10px}.by-bedtime img{width:96px;height:96px;object-fit:cover;border-radius:16px}.by-bedtime h3{margin:0 0 4px;color:var(--plum);font-size:17px}
.by-hreview{margin-top:6px}.by-hreview .small{font-size:20px;margin:6px 0 0}.by-hreview .src{font-size:13px;color:#8E7F8A}
@media (max-width:700px){.by-letter{grid-template-columns:80px 1fr}.by-letter img{width:80px;height:80px}}
.by-pcard{background:#f6f0f4;border-radius:18px;padding:12px 16px;margin-top:12px;font-size:17px}.by-pcard h3{margin:0 0 6px;color:var(--plum)}.by-pcard ul{margin:4px 0;padding-inline-start:20px}
.by-drawings{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0}.by-drawings figure{margin:0;text-align:center}.by-drawings img{width:140px;aspect-ratio:4/3;object-fit:cover;border-radius:12px;border:2px solid var(--sand)}.by-drawings figcaption{font-size:14px;color:var(--plum)}
.by-lulu{position:fixed;bottom:10px;inset-inline-start:10px;z-index:6;display:flex;align-items:flex-end;gap:8px;pointer-events:none}
.by-lulu img{width:120px;height:120px;object-fit:cover;border-radius:50%;border:3px solid #fff;box-shadow:0 6px 20px rgba(58,31,54,.18);background:#fff}
.by-lulu.quiet img{opacity:.55;filter:grayscale(.3)}
.by-bubble{background:#fff;border:2px solid var(--sand);border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:19px;max-width:min(60vw,420px);box-shadow:0 6px 20px rgba(58,31,54,.12);line-height:1.7}
.by-sess{font-size:12px;color:#8E7F8A;margin-inline-start:4px}
.by-scene{position:relative;border-radius:20px;overflow:hidden;border:3px solid var(--sand);background:#fff}.by-scene>img{width:100%;display:block}
.by-review{display:grid;gap:8px;justify-items:center;margin-bottom:8px}.by-ayat.small .by-ayah .txt{font-size:22px;opacity:.8}
.by-spot{position:absolute;border:3px dashed rgba(232,121,92,.55);background:rgba(255,255,255,.04);border-radius:16px;cursor:pointer;display:grid;place-items:end center;padding:4px;color:var(--ink)}
.by-spot:hover{background:rgba(232,121,92,.12)}.by-spot.ok{border:3px solid var(--sea);background:rgba(94,168,160,.12)}.by-spot.lulu-wrong{border-color:var(--coral);background:rgba(232,121,92,.18)}
.by-spot .lbl{background:#fff;border:2px solid var(--sand);border-radius:999px;padding:2px 12px;font-size:20px;box-shadow:0 3px 10px rgba(58,31,54,.12)}
.by-spot.shake{animation:by-shake .45s}
.by-speech-btn{background:none;border:0;cursor:pointer;font-family:inherit;width:100%}
@media (max-width:700px){.by{font-size:18px}.by-spot .lbl{font-size:14px;padding:0 8px}.by-vocab,.by-pics{grid-template-columns:repeat(2,1fr)}.by-roles{grid-template-columns:1fr}.by-stations .tt{display:none}.by-lulu img{width:84px;height:84px}.by-bubble{font-size:16px;max-width:66vw}.by-ayah{font-size:24px}.by-hadith .txt{font-size:26px}}
/* ── لمسات حركة (2026-11-24، من روح 60fps: قصيرة · هادئة · لها معنى) ── */
@keyframes by-enter{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
@keyframes by-pop{0%{opacity:0;transform:scale(.86)}70%{transform:scale(1.04)}100%{opacity:1;transform:none}}
@keyframes by-reveal{0%{opacity:0;transform:scale(.5) rotate(-10deg)}60%{opacity:1;transform:scale(1.08) rotate(3deg)}100%{transform:none}}
@keyframes by-okpop{0%{transform:scale(1)}40%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes by-twinkle{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
.by-card{animation:by-enter .22s cubic-bezier(.2,.8,.2,1) both}
.by-vcard,.by-pic{animation:by-pop .32s cubic-bezier(.2,.8,.2,1) both;transition:transform .15s ease,box-shadow .15s ease}
.by-vcard:nth-child(2),.by-pic:nth-child(2){animation-delay:.05s}.by-vcard:nth-child(3),.by-pic:nth-child(3){animation-delay:.1s}.by-vcard:nth-child(4),.by-pic:nth-child(4){animation-delay:.15s}.by-vcard:nth-child(5),.by-pic:nth-child(5){animation-delay:.2s}.by-vcard:nth-child(6),.by-pic:nth-child(6){animation-delay:.25s}.by-vcard:nth-child(n+7),.by-pic:nth-child(n+7){animation-delay:.3s}
@media (hover:hover){.by-vcard:hover,.by-pic:hover{transform:translateY(-3px);box-shadow:0 10px 22px rgba(58,31,54,.10)}}
.by-vcard.ok,.by-pic.ok,.by-spot.ok{animation:by-okpop .35s ease}
.by-badge img{animation:by-reveal .9s cubic-bezier(.2,.8,.2,1) both,by-bob 2s ease-in-out .9s infinite}
.by-big{transition:transform .08s ease,box-shadow .08s ease}.by-big:active{transform:translateY(3px);box-shadow:0 3px 0 #b9544a}
.by-bedtime h3::before{content:'✦ ';color:#C9A227;display:inline-block;animation:by-twinkle 2.2s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.by *{animation:none!important;transition:none!important}}
`;
