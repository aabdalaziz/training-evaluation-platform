'use client';
/* بَيان (هـ-6-ب) — محرّك الجلسة النموذجية «في السوق» · وضع الطفل (شاشة كاملة، أزرار كبيرة، صوت في كل شيء)
 * المحطّات: هيّا نبدأ → الحكاية → حَرْف يرسم → نلعب → نمثّل → مدرسة المصطفى ﷺ → نتلو → أثري اليوم
 * لؤلؤ: طبقة دائمة (ترحيب/تشجيع/تلميح/انتقال/احتفال) وتصمت في محطّتي الحديث والقرآن. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  SESSION, STATIONS, type StationKey, ANTHEM, LULU, PANELS, STORY_CHOICE, HARF, VOCAB, ROLES, HADITH,
  FATIHA, QURAN, RECITER, ayahUrl, ATHARI, img, snd,
} from '../../../lib/kids/souq';

/* ───────── صوت ───────── */
function useAudio() {
  const ref = useRef<HTMLAudioElement | null>(null);
  const play = useCallback((src: string, onEnd?: () => void) => {
    try {
      if (ref.current) { ref.current.pause(); ref.current.onended = null; }
      const a = new Audio(src); ref.current = a;
      a.onended = () => { onEnd?.(); };
      a.onerror = () => { onEnd?.(); };
      void a.play().catch(() => onEnd?.());
    } catch { onEnd?.(); }
  }, []);
  const stop = useCallback(() => { ref.current?.pause(); }, []);
  useEffect(() => () => { ref.current?.pause(); }, []);
  return { play, stop };
}

type Mood = 'wave' | 'cheer' | 'sleep' | 'point' | 'think' | 'dance' | 'date' | 'quiet';

/* ───────── لؤلؤ — الطبقة الدائمة ───────── */
function Lulu({ mood, say, quiet }: { mood: Mood; say: string; quiet?: boolean }) {
  return (
    <div className={`by-lulu ${quiet ? 'quiet' : ''}`} aria-live="polite">
      {say && !quiet && <div className="by-bubble">{say}</div>}
      <img src={img(`lulu-${mood}`)} alt="لؤلؤ" width={120} height={120} />
    </div>
  );
}

/* ───────── المكوّن الرئيس ───────── */
export default function BayanSession() {
  const { play, stop } = useAudio();
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [mood, setMood] = useState<Mood>('wave');
  const [say, setSay] = useState('');
  const [done, setDone] = useState<Record<string, boolean>>({});
  const station = STATIONS[idx].key as StationKey;
  const quiet = station === 'hadith' || station === 'quran';
  const hero = gender === 'f' ? 'يا بَطَلَةْ' : 'يا بَطَلْ';

  useEffect(() => { try { const s = localStorage.getItem('bayan_demo_child'); if (s) { const j = JSON.parse(s); setName(j.name || ''); setGender(j.gender || 'm'); } } catch { /* ignore */ } }, []);
  const lulu = useCallback((k: keyof typeof LULU, m: Mood = 'cheer', onEnd?: () => void) => {
    const L = LULU[k]; setMood(m); setSay(L.text.replace('يا بَطَلْ', hero)); play(snd(L.audio), onEnd);
  }, [play, hero]);

  const go = useCallback((n: number) => { stop(); setSay(''); setIdx(Math.max(0, Math.min(STATIONS.length - 1, n))); window.scrollTo({ top: 0 }); }, [stop]);
  const finish = useCallback((k: StationKey) => { setDone(d => ({ ...d, [k]: true })); if (k !== 'hadith' && k !== 'quran') lulu('next', 'cheer'); }, [lulu]);
  const next = useCallback(() => go(idx + 1), [go, idx]);

  useEffect(() => { if (quiet) { setMood('quiet'); setSay(''); } }, [quiet]);

  const ctx = { play, lulu, next, finish, name, gender, hero, setMood, setSay };
  return (
    <div className="by" dir="rtl" data-station={station}>
      <style dangerouslySetInnerHTML={{ __html: BAYAN_CSS }} />
      <header className="by-top">
        <Link href="/kids" className="by-exit" aria-label="خروج">✕</Link>
        <ol className="by-stations" aria-label="محطّات الرحلة">
          {STATIONS.map((s, i) => (
            <li key={s.key} className={i === idx ? 'on' : done[s.key] ? 'ok' : ''} title={s.title}>
              <button onClick={() => go(i)} aria-current={i === idx ? 'step' : undefined}><span className="ic">{s.icon}</span><span className="tt">{s.title}</span></button>
            </li>
          ))}
        </ol>
        <div className="by-brand"><img src="/brand/athar-mark.svg" alt="" width={22} height={22} /><b>بَيان</b></div>
      </header>

      <main className="by-stage">
        {station === 'start' && <Start {...ctx} setName={setName} setGender={setGender} />}
        {station === 'story' && <Story {...ctx} />}
        {station === 'harf' && <Harf {...ctx} />}
        {station === 'play' && <Play {...ctx} />}
        {station === 'act' && <Act {...ctx} />}
        {station === 'hadith' && <Hadith {...ctx} />}
        {station === 'quran' && <Quran {...ctx} />}
        {station === 'athari' && <Athari {...ctx} />}
      </main>

      <Lulu mood={mood} say={say} quiet={quiet} />
    </div>
  );
}

type Ctx = {
  play: (src: string, onEnd?: () => void) => void;
  lulu: (k: keyof typeof LULU, m?: Mood, onEnd?: () => void) => void;
  next: () => void; finish: (k: StationKey) => void;
  name: string; gender: 'm' | 'f'; hero: string;
  setMood: (m: Mood) => void; setSay: (s: string) => void;
};

/* ───────── 1) هيّا نبدأ ───────── */
function Start(p: Ctx & { setName: (s: string) => void; setGender: (g: 'm' | 'f') => void }) {
  const [step, setStep] = useState<'gate' | 'hello' | 'anthem'>(p.name ? 'hello' : 'gate');
  const [line, setLine] = useState(-1);
  const save = () => { try { localStorage.setItem('bayan_demo_child', JSON.stringify({ name: p.name.trim(), gender: p.gender })); } catch { /* ignore */ } setStep('hello'); };
  const hello = () => { p.lulu('welcome', 'wave'); };
  const ready = () => { p.lulu('yasalam', 'cheer', () => { setStep('anthem'); }); };
  useEffect(() => { if (step !== 'anthem') return; setLine(0); const t = setInterval(() => setLine(l => (l < ANTHEM.length - 1 ? l + 1 : l)), 1800); return () => clearInterval(t); }, [step]);
  const start = () => { p.lulu('today', 'dance', () => { p.finish('start'); p.next(); }); };
  return (
    <section className="by-card">
      {step === 'gate' && (
        <div className="by-gate">
          <h1>مَرْحَبًا في بَيان</h1>
          <p className="by-parent">لوليّ الأمر: اكتب اسم طفلك ليناديه الأصدقاء به. (تجربة الجلسة النموذجية «في السوق» · 20 دقيقة · المسار أ · 4–6 سنوات)</p>
          <input className="by-input" value={p.name} onChange={e => p.setName(e.target.value)} placeholder="اسم الطفل" maxLength={20} autoFocus />
          <div className="by-row">
            <button className={`by-chip ${p.gender === 'm' ? 'on' : ''}`} onClick={() => p.setGender('m')}>ولد</button>
            <button className={`by-chip ${p.gender === 'f' ? 'on' : ''}`} onClick={() => p.setGender('f')}>بنت</button>
          </div>
          <button className="by-big" disabled={!p.name.trim()} onClick={save}>هَيّا نَبْدَأ ☀️</button>
        </div>
      )}
      {step === 'hello' && (
        <div className="by-center">
          <h1 className="by-huge">أَهْلًا يا {p.name}!</h1>
          <p className="by-sub">اِضْغَطْ عَلى لُؤْلُؤ لِتُسَلِّمَ عَلَيْكْ</p>
          <button className="by-tap" onClick={hello}><img src={img('lulu-wave')} alt="" width={180} height={180} /></button>
          <button className="by-big" onClick={ready}>أَنا جاهِزْ! ✋</button>
        </div>
      )}
      {step === 'anthem' && (
        <div className="by-center">
          <h2 className="by-h2">نَشيدُ بَيان 👏</h2>
          <div className="by-anthem">{ANTHEM.map((l, i) => <p key={i} className={i === line ? 'on' : i < line ? 'past' : ''}>{l}</p>)}</div>
          <p className="by-sub">صَفِّقْ مَعَ الْإيقاعْ!</p>
          <button className="by-big" onClick={start}>إِلَى السّوقْ! 🧺</button>
        </div>
      )}
    </section>
  );
}

/* ───────── 2) الحكاية ───────── */
function Story(p: Ctx) {
  const [i, setI] = useState(0);
  const [li, setLi] = useState(0);
  const [asked, setAsked] = useState(false);
  const [choice, setChoice] = useState<string | null>(null);
  const panel = PANELS[i];
  const playLine = useCallback((k: number) => {
    const l = panel.lines[k]; if (!l) return; setLi(k);
    if (l.audio) p.play(snd(l.audio), () => { if (k + 1 < panel.lines.length) playLine(k + 1); });
  }, [panel, p]);
  useEffect(() => { setLi(0); const t = setTimeout(() => playLine(0), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i]);
  const forward = () => {
    if (panel.n === STORY_CHOICE.after && !asked) { setAsked(true); p.lulu('question', 'think'); return; }
    if (i + 1 < PANELS.length) setI(i + 1); else { p.finish('story'); p.next(); }
  };
  const pick = (k: string) => { setChoice(k); p.lulu('letsee', 'point', () => setI(i + 1)); };
  return (
    <section className="by-story">
      <figure className="by-panel"><img src={img(`panel-0${panel.n}`)} alt={`لوحة ${panel.n}`} /></figure>
      <div className="by-lines">
        {panel.lines.map((l, k) => (
          <button key={k} className={`by-line ${k === li ? 'on' : ''}`} onClick={() => playLine(k)}>
            <span className="who">{l.who}</span><span className="txt">{l.text}</span><span className="spk">🔊</span>
          </button>
        ))}
      </div>
      {asked && !choice && panel.n === STORY_CHOICE.after ? (
        <div className="by-choices">
          <p className="by-q">{LULU.question.text}</p>
          {STORY_CHOICE.options.map(o => <button key={o.key} className="by-opt" onClick={() => pick(o.key)}><span className="em">{o.emoji}</span>{o.text}</button>)}
        </div>
      ) : (
        <nav className="by-nav">
          <button className="by-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>السّابِق</button>
          <span className="by-count">{panel.n} / {PANELS.length}</span>
          <button className="by-big" onClick={forward}>{i + 1 < PANELS.length ? 'التّالي ◀' : 'اِنْتَهَتِ الْحِكايَة ✨'}</button>
        </nav>
      )}
    </section>
  );
}

/* ───────── 3) حَرْف يرسم ───────── */
function Harf(p: Ctx) {
  const [wi, setWi] = useState(-1);
  const [vi, setVi] = useState(-1);
  const [heard, setHeard] = useState<Record<string, boolean>>({});
  useEffect(() => { const t = setTimeout(() => p.play(snd(HARF.intro.audio)), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const allHeard = VOCAB.every(v => heard[v.key]);
  return (
    <section className="by-card">
      <div className="by-harf">
        <div className="by-letter" onClick={() => p.play(snd(HARF.intro.audio))} role="button" aria-label="اسمع الحرف">
          <svg viewBox="0 0 200 140" width="220" height="154" aria-hidden><path d="M20 70 Q100 130 180 70" fill="none" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><path d="M20 70 L20 40" stroke="#3A1F36" strokeWidth="14" strokeLinecap="round" /><circle cx="100" cy="118" r="9" fill="#E8795C" /></svg>
          <b>باءْ</b>
          <small>قارِبٌ صَغيرْ، وَتَحْتَهُ نُقْطَةْ</small>
        </div>
        <p className="by-speech">{HARF.intro.text}</p>
        <div className="by-words">
          {HARF.words.map((w, k) => (
            <button key={w.w} className={`by-word ${wi === k ? 'on' : ''}`} onClick={() => { setWi(k); p.play(snd(w.audio)); }}>
              <span className="em">{w.emoji}</span><span className="w"><mark>{w.w.slice(0, 1)}</mark>{w.w.slice(1)}</span>
            </button>
          ))}
        </div>
        <div className="by-harakat" onClick={() => p.play(snd(HARF.harakat.audio))} role="button">
          {HARF.harakat.items.map(h => <span key={h.h} style={{ background: h.color }}><b>{h.h}</b><i>{h.name}</i><small>{h.w}</small></span>)}
        </div>
      </div>
      <h3 className="by-h3">كَلِماتُ الْيَوْم — لُؤْلُؤ تُرَدِّدْ، وَأَنْتَ تُرَدِّدْ</h3>
      <div className="by-vocab">
        {VOCAB.map((v, k) => (
          <button key={v.key} className={`by-vcard ${vi === k ? 'on' : ''} ${heard[v.key] ? 'ok' : ''}`} onClick={() => { setVi(k); setHeard(h => ({ ...h, [v.key]: true })); p.play(snd(v.audio)); }}>
            <img src={img(v.img)} alt="" /><b>{v.w}</b><span className="spk">🔊</span>
          </button>
        ))}
      </div>
      <nav className="by-nav end"><button className="by-big" disabled={!allHeard} onClick={() => { p.finish('harf'); p.next(); }}>{allHeard ? 'هَيّا نَلْعَبْ 🎲' : 'اِسْمَعِ الْكَلِماتِ الْأَرْبَعَ أَوَّلًا'}</button></nav>
    </section>
  );
}

/* ───────── 4) هيّا بنا نلعب: مطابقة صورة–كلمة (لمس الكلمة ثم الصورة) ───────── */
function shuffle<T>(a: T[], seed = 3): T[] { const r = [...a]; let s = seed; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
function Play(p: Ctx) {
  const words = useMemo(() => shuffle(VOCAB, 5), []);
  const pics = useMemo(() => shuffle(VOCAB, 11), []);
  const [sel, setSel] = useState<string | null>(null);
  const [matched, setMatched] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState<string | null>(null);
  const [round, setRound] = useState<1 | 2 | 3>(1); // 2 = لؤلؤ تلعب وتخطئ · 3 = الطفل يصحّح
  const [brk, setBrk] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { const t = setTimeout(() => p.lulu('play', 'point'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const armIdle = useCallback(() => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(() => p.lulu('hint', 'point'), 8000); }, [p]);
  useEffect(() => { armIdle(); return () => { if (idle.current) clearTimeout(idle.current); }; }, [armIdle, sel, matched]);
  const complete = Object.keys(matched).length === VOCAB.length;
  useEffect(() => { if (complete && round === 1) { setTimeout(() => { setRound(2); p.lulu('mistake', 'think'); }, 900); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [complete, round]);

  const tapWord = (k: string) => { if (matched[k]) return; setSel(k); const v = VOCAB.find(x => x.key === k)!; p.play(snd(v.audio)); };
  const tapPic = (k: string) => {
    if (round !== 1 || !sel || matched[k]) return;
    if (sel === k) { setMatched(m => ({ ...m, [k]: true })); setSel(null); p.lulu('correct', 'cheer'); }
    else { setShake(k); setTimeout(() => setShake(null), 500); p.lulu('tryagain', 'think'); }
  };
  const answerLulu = (yes: boolean) => { if (yes) { p.lulu('hmm', 'think'); } else { setRound(3); p.lulu('thanks', 'dance'); } };
  const fix = (k: string) => { if (round !== 3) return; if (k === 'khubz') { p.lulu('correct', 'cheer', () => { setBrk(true); p.lulu('brk', 'dance'); }); } else p.lulu('tryagain', 'think'); };
  return (
    <section className="by-card">
      <h2 className="by-h2">{round === 1 ? 'اِلْمِسِ الْكَلِمَةَ… ثُمَّ صورَتَها' : round === 2 ? 'دَوْرُ لُؤْلُؤ!' : 'صَحِّحْ لِلُؤْلُؤ: أَيْنَ الْخُبْزْ؟'}</h2>
      <div className="by-pics">
        {pics.map(v => (
          <button key={v.key} className={`by-pic ${matched[v.key] ? 'ok' : ''} ${shake === v.key ? 'shake' : ''} ${round === 2 && v.key === 'halib' ? 'lulu-wrong' : ''}`} onClick={() => (round === 3 ? fix(v.key) : tapPic(v.key))} aria-label={v.w}>
            <img src={img(v.img)} alt="" />
            {matched[v.key] && round === 1 && <span className="lbl">{v.w}</span>}
            {round !== 1 && <span className="lbl">{v.key === 'halib' && round === 2 ? 'خُبْزْ ؟' : v.w}</span>}
          </button>
        ))}
      </div>
      {round === 1 && (
        <div className="by-chips">
          {words.map(v => <button key={v.key} className={`by-chip big ${sel === v.key ? 'on' : ''} ${matched[v.key] ? 'gone' : ''}`} onClick={() => tapWord(v.key)} disabled={!!matched[v.key]}>{v.w} 🔊</button>)}
        </div>
      )}
      {round === 2 && (
        <div className="by-choices row">
          <p className="by-q">لُؤْلُؤ وَضَعَتْ «خُبْزْ» عَلى صورَةِ الْحَليبْ… هَلْ أَصابَتْ؟</p>
          <button className="by-opt" onClick={() => answerLulu(true)}>نَعَمْ 👍</button>
          <button className="by-opt" onClick={() => answerLulu(false)}>لا 👎</button>
        </div>
      )}
      {brk && (
        <div className="by-break">
          <p>🤸 اِسْتِراحَةُ الْحَيَوِيَّةْ: قِفْ! صَفِّقْ ثَلاثًا… وَاقْفِزْ كَالْأَرْنَبْ! … وَاجْلِسْ.</p>
          <button className="by-big" onClick={() => { p.finish('play'); p.next(); }}>جَلَسْتُ! هَيّا نُمَثِّلْ 🎭</button>
        </div>
      )}
    </section>
  );
}

/* ───────── 5) هيّا بنا نمثّل ───────── */
function Act(p: Ctx) {
  const [swap, setSwap] = useState(false);
  useEffect(() => { const t = setTimeout(() => p.lulu('act', 'point'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const me = swap ? ROLES.buyer : ROLES.seller, you = swap ? ROLES.seller : ROLES.buyer;
  return (
    <section className="by-card">
      <h2 className="by-h2">{LULU.act.text}</h2>
      <div className="by-roles">
        <div className="by-role me"><span className="tag">{p.name || 'أَنا'}</span><h3>{me.title}</h3>{me.lines.map(l => <p key={l}>{l}</p>)}</div>
        <div className="by-role you"><span className="tag">ماما / بابا</span><h3>{you.title}</h3>{you.lines.map(l => <p key={l}>{l}</p>)}</div>
      </div>
      <button className="by-ghost" onClick={() => setSwap(s => !s)}>بَدِّلُوا الْأَدْوارْ 🔁</button>
      <p className="by-parent">💡 لوليّ الأمر: {ROLES.parentTip}</p>
      <nav className="by-nav end"><button className="by-big" onClick={() => { p.finish('act'); p.next(); }}>مَثَّلْنا! إِلى جَدّ سالِم 🕌</button></nav>
    </section>
  );
}

/* ───────── 6) في مدرسة المصطفى ﷺ (لؤلؤ صامتة) ───────── */
function Hadith(p: Ctx) {
  const [rep, setRep] = useState(0);
  const [ans, setAns] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => p.play(snd(HADITH.story.audio)), 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const repeat = () => { p.play(snd(HADITH.repeat.audio)); setRep(r => Math.min(3, r + 1)); };
  const opt = HADITH.options.find(o => o.key === ans);
  return (
    <section className="by-card calm">
      <div className="by-salem"><img src={img('lulu-quiet')} alt="" className="by-quietlulu" /><h2 className="by-h2">في مَدْرَسَةِ الْمُصْطَفى ﷺ</h2></div>
      <button className="by-line salem on" onClick={() => p.play(snd(HADITH.story.audio))}><span className="who">جدّ سالم</span><span className="txt">{HADITH.story.text}</span><span className="spk">🔊</span></button>
      <div className="by-hadith">
        <p className="txt">«{HADITH.text}»</p><p className="src">{HADITH.source}</p>
        <button className="by-big" onClick={repeat}>رَدِّدْ مَعي 🔊 {rep > 0 && <small>{'⭐'.repeat(rep)}</small>}</button>
      </div>
      <p className="by-speech">{HADITH.lesson.text}</p>
      <div className="by-choices">
        <p className="by-q">{HADITH.question.text}</p>
        {HADITH.options.map(o => <button key={o.key} className={`by-opt ${ans === o.key ? (o.good ? 'good' : 'soft') : ''}`} onClick={() => { setAns(o.key); p.play(snd(`s-opt-${o.key}`)); }}><span className="em">{o.emoji}</span>{o.text}</button>)}
        {opt && <p className="by-reply">{opt.reply}</p>}
      </div>
      <nav className="by-nav end"><button className="by-big" disabled={rep < 3 || !opt?.good} onClick={() => { p.finish('hadith'); p.next(); }}>{rep < 3 ? 'رَدِّدِ الْحَديثَ ثَلاثَ مَرّاتْ' : !opt?.good ? 'اِخْتَرْ فِعْلَ الْأَمينْ' : 'هَيّا بِنا نَتْلو 📿'}</button></nav>
    </section>
  );
}

/* ───────── 7) هيّا بنا نتلو: الفاتحة (لؤلؤ صامتة · تلاوة قارئ بشري) ───────── */
function Quran(p: Ctx) {
  const [n, setN] = useState(0); // الآية الجارية (1..)
  const [heard, setHeard] = useState<Record<number, boolean>>({});
  const [all, setAll] = useState(false);
  const count = all ? FATIHA.length : QURAN.newKidsAyat;
  useEffect(() => { const t = setTimeout(() => p.play(snd(QURAN.intro.audio)), 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const listen = (k: number) => { setN(k); p.play(ayahUrl(k), () => setHeard(h => ({ ...h, [k]: true }))); };
  const ok = Array.from({ length: count }, (_, i) => i + 1).every(k => heard[k]);
  return (
    <section className="by-card calm">
      <div className="by-salem"><img src={img('lulu-quiet')} alt="" className="by-quietlulu" /><h2 className="by-h2">هَيّا بِنا نَتْلو — سورَةُ الْفاتِحَة</h2></div>
      <p className="by-speech">{QURAN.intro.text}</p>
      <div className="by-ayat">
        {FATIHA.slice(0, count).map((a, i) => {
          const k = i + 1;
          return (
            <button key={k} className={`by-ayah ${n === k ? 'on' : ''} ${heard[k] ? 'ok' : ''}`} onClick={() => listen(k)}>
              <span className="num">{k}</span><span className="txt">{a}</span><span className="spk">{heard[k] ? '✅' : '🔊'}</span>
            </button>
          );
        })}
      </div>
      <div className="by-row">
        <button className="by-ghost" onClick={() => p.play(snd(QURAN.meaning.audio))}>مَعْنى بِكَلِمَة: {QURAN.meaning.text}</button>
        {!all && <button className="by-ghost" onClick={() => setAll(true)}>أَحْفَظُها كامِلَةً — أَظْهِرِ السّورَة</button>}
      </div>
      <p className="by-parent">🎙️ بعد كل آية: دَوْرُكْ — ردّد الآية بصوتك مع ماما أو بابا. التلاوة: {RECITER.name}.</p>
      <nav className="by-nav end"><button className="by-big" disabled={!ok} onClick={() => { p.play(snd(QURAN.closing.audio)); p.finish('quran'); p.next(); }}>{ok ? 'صَدَقَ اللهُ الْعَظيمْ ✨' : 'اِسْتَمِعْ لِكُلِّ آيَةٍ ثُمَّ رَدِّدْ'}</button></nav>
    </section>
  );
}

/* ───────── 8) أثري اليوم ───────── */
function Athari(p: Ctx) {
  const [self, setSelf] = useState<string | null>(null);
  useEffect(() => { const t = setTimeout(() => p.lulu('athari', 'dance'), 400); try { localStorage.setItem('bayan_demo_done', new Date().toISOString()); } catch { /* ignore */ } return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <section className="by-card">
      <div className="by-badge"><img src={img(SESSION.badge.img)} alt="" /><h1 className="by-huge">شارَةُ «{SESSION.badge.title}»</h1><p className="by-sub">مُبارَكْ يا {p.name || p.hero}!</p></div>
      <ul className="by-summary">{ATHARI.summary.map(s => <li key={s}>🌱 {s}</li>)}</ul>
      <div className="by-self">
        <p className="by-q">{ATHARI.selfCheck.q}</p>
        <div className="by-row">{ATHARI.selfCheck.options.map(o => <button key={o.key} className={`by-face ${self === o.key ? 'on' : ''}`} onClick={() => { setSelf(o.key); try { localStorage.setItem('bayan_demo_self', o.key); } catch { /* ignore */ } }}><span>{o.emoji}</span>{o.text}</button>)}</div>
        {self && <p className="by-muted">شُكْرًا! سَيَراها الْميسِّرُ وَماما أَوْ بابا في مِلَفِّ إِنْجازِكْ.</p>}
      </div>
      <div className="by-task"><h3>مُهِمَّةُ الْبَيْت 🏠</h3><p>{ATHARI.homeTask}</p></div>
      <div className="by-pcard">
        <h3>بطاقة وليّ الأمر</h3>
        <p><b>تعلّمنا اليوم:</b> {ATHARI.parentCard.learned}</p>
        <p><b>كيف تدعمه:</b></p><ul>{ATHARI.parentCard.support.map(s => <li key={s}>{s}</li>)}</ul>
        <p className="by-muted">🌙 {ATHARI.bedtime}</p>
      </div>
      <nav className="by-nav end">
        <Link className="by-ghost" href="/contact?topic=bayan">رأي وليّ الأمر في التجربة ✍️</Link>
        <Link className="by-big" href="/kids">اِنْتَهَيْنا ✨</Link>
      </nav>
    </section>
  );
}

/* ───────── CSS ───────── */
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
.by-stage{max-width:960px;margin:0 auto;padding:14px}
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
.by-pcard{background:#f6f0f4;border-radius:18px;padding:12px 16px;margin-top:12px;font-size:17px}.by-pcard h3{margin:0 0 6px;color:var(--plum)}.by-pcard ul{margin:4px 0;padding-inline-start:20px}
.by-lulu{position:fixed;bottom:10px;inset-inline-start:10px;z-index:6;display:flex;align-items:flex-end;gap:8px;pointer-events:none}
.by-lulu img{width:120px;height:120px;object-fit:cover;border-radius:50%;border:3px solid #fff;box-shadow:0 6px 20px rgba(58,31,54,.18);background:#fff}
.by-lulu.quiet img{opacity:.55;filter:grayscale(.3)}
.by-bubble{background:#fff;border:2px solid var(--sand);border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:19px;max-width:min(60vw,420px);box-shadow:0 6px 20px rgba(58,31,54,.12);line-height:1.7}
@media (max-width:700px){.by{font-size:18px}.by-vocab,.by-pics{grid-template-columns:repeat(2,1fr)}.by-roles{grid-template-columns:1fr}.by-stations .tt{display:none}.by-lulu img{width:84px;height:84px}.by-bubble{font-size:16px;max-width:66vw}.by-ayah{font-size:24px}.by-hadith .txt{font-size:26px}}
@media (prefers-reduced-motion:reduce){.by *{animation:none!important}}
`;
