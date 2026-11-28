'use client';
/* بَيان (هـ-6-د) — بنك أنشطة «حَرْف يرسم» و«هيّا بنا نلعب» (kids/curriculum/HARF-PLAY-BANK.md)
 * كل نشاط مكوّن مستقلّ يعمل لأي جلسة: يأخذ بيانات الجلسة + سياق الصوت/لؤلؤ، وينادي onDone عند الاكتمال.
 * قواعد 4–6: لمس ثم لمس (لا سحب دقيق) · قاعدة واحدة · تغذية راجعة فورية («يا سَلااامْ!» / «قَريبْ!») · ≤ 3 دقائق. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SessionData, LuluKey, LuluPose, SoundItem, VocabItem, Game, HarfActivity } from '../../../lib/kids/types';
import { COMMON, type CommonKey } from '../../../lib/kids/common';
import type { LuluState } from './LuluLive';

export type ActCtx = {
  S: SessionData;
  img: (n: string) => string; snd: (n: string) => string;
  play: (src: string, onEnd?: () => void) => void;
  lulu: (k: LuluKey, p?: LuluPose, onEnd?: () => void, after?: LuluState) => void;
  luluSay: (text: string, audio: string, p?: LuluPose, onEnd?: () => void) => void;
  awaitAnswer: () => void; stopWaiting: () => void;
  name: string; setLstate: (s: LuluState) => void; setPose: (p: LuluPose) => void;
};

/** قول سطر عامّ: لؤلؤ بصوتها المقيس، وحَرْف كصوت آخر */
function useSay(p: ActCtx) {
  return useCallback((k: CommonKey, pose: LuluPose = 'wave', onEnd?: () => void) => {
    const L = COMMON[k];
    if (L.who === 'لؤلؤ') p.luluSay(L.text, L.audio, pose, onEnd); else p.play(p.snd(L.audio), onEnd);
  }, [p]);
}
function shuffle<T>(a: T[], seed: number): T[] { const r = [...a]; let s = seed; for (let i = r.length - 1; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor((s / 233280) * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; }
const Stars = ({ n, of }: { n: number; of: number }) => <div className="ac-stars" aria-label={`${n} من ${of}`}>{Array.from({ length: of }, (_, i) => <span key={i} className={i < n ? 'on' : ''}>★</span>)}</div>;

/* ═══════════ ح2) تتبّع بالإصبع ═══════════ */
export function Trace({ p, strokes, onDone }: { p: ActCtx; strokes: string[]; onDone: () => void }) {
  const say = useSay(p);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const [pts, setPts] = useState<{ x: number; y: number }[][]>([]);
  const [round, setRound] = useState(0);          // 0 مع الدليل · 1 وحده · 2 في الهواء
  const [si, setSi] = useState(0);                // الخطّ الجاري
  const [prog, setProg] = useState(0);            // النقطة الجارية
  const down = useRef(false);
  useEffect(() => { const t = setTimeout(() => say('trace', 'point'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    const all = pathRefs.current.map(el => { if (!el) return []; const L = el.getTotalLength(); const n = Math.max(2, Math.round(L / 9)); return Array.from({ length: n + 1 }, (_, i) => { const q = el.getPointAtLength((L * i) / n); return { x: q.x, y: q.y }; }); });
    setPts(all);
  }, [strokes]);
  const toSvg = (e: React.PointerEvent) => { const svg = svgRef.current!; const m = svg.getScreenCTM(); if (!m) return null; const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: pt.x, y: pt.y }; };
  const advance = (q: { x: number; y: number }) => {
    const cur = pts[si]; if (!cur) return;
    let k = prog; while (k < cur.length && Math.hypot(cur[k].x - q.x, cur[k].y - q.y) < 22) k++;
    if (k !== prog) setProg(k);
    if (k >= cur.length) {
      if (si + 1 < strokes.length) { setSi(si + 1); setProg(0); }
      else { down.current = false; if (round === 0) { setRound(1); setSi(0); setProg(0); say('traceAgain', 'cheer'); } else { setRound(2); say('traceDone', 'cheer', () => say('traceAir', 'dance')); } }
    }
  };
  const onDown = (e: React.PointerEvent) => { down.current = true; const q = toSvg(e); if (q) advance(q); };
  const onMove = (e: React.PointerEvent) => { if (!down.current) return; const q = toSvg(e); if (q) advance(q); };
  const onUp = () => { down.current = false; };
  const done = pts[si]?.length ? prog / pts[si].length : 0;
  const start = pts[si]?.[0], end = pts[si]?.[pts[si].length - 1];
  return (
    <div className="ac ac-trace">
      <p className="by-speech">{COMMON.trace.text}</p>
      <Stars n={round} of={3} />
      {round < 2 ? (
        <svg ref={svgRef} viewBox="0 0 200 200" className="ac-svg" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} style={{ touchAction: 'none' }}>
          {strokes.map((d, i) => <path key={'g' + i} d={d} fill="none" stroke={round === 0 ? '#F1D9A8' : '#f6ece0'} strokeWidth="26" strokeLinecap="round" strokeDasharray={round === 0 ? '0' : '6 14'} />)}
          {strokes.map((d, i) => <path key={'p' + i} ref={el => { pathRefs.current[i] = el; }} d={d} fill="none" stroke="transparent" strokeWidth="2" />)}
          {strokes.map((d, i) => (i < si || (i === si && done >= 1)) && <path key={'d' + i} d={d} fill="none" stroke="#5EA8A0" strokeWidth="26" strokeLinecap="round" />)}
          {pts[si] && prog > 0 && <polyline points={pts[si].slice(0, prog).map(q => `${q.x},${q.y}`).join(' ')} fill="none" stroke="#E8795C" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />}
          {start && <circle cx={start.x} cy={start.y} r="11" fill="#5EA8A0" stroke="#fff" strokeWidth="3" />}
          {end && <text x={end.x} y={end.y + 8} textAnchor="middle" fontSize="24">⭐</text>}
          {round === 0 && start && end && <text x={(start.x + end.x) / 2 + 26} y={(start.y + end.y) / 2} fontSize="20" fill="#E8795C">👆</text>}
        </svg>
      ) : (
        <div className="by-center">
          <div className="ac-air">✋ {COMMON.traceAir.text}</div>
          <button className="by-big" onClick={onDone}>رَسَمْتُهُ في الْهَواءْ! ⭐</button>
        </div>
      )}
      {round < 2 && <p className="by-muted">{round === 0 ? 'مَعَ حَرْف: مِنَ الدّائِرَةِ إِلَى النَّجْمَةْ' : 'وَحْدَكْ هٰذِهِ الْمَرَّةْ!'}</p>}
    </div>
  );
}

/* ═══════════ ح3) أسمع الصوت ═══════════ */
export function Hear({ p, items, onDone }: { p: ActCtx; items: SoundItem[]; onDone: () => void }) {
  const say = useSay(p);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [flash, setFlash] = useState<'ok' | 'no' | null>(null);
  const busy = useRef(false);
  const it = items[i];
  const hearIt = useCallback(() => { if (!it) return; p.luluSay(it.w, it.audio, 'think', p.awaitAnswer); }, [it, p]);
  useEffect(() => { const t = setTimeout(() => say('hear', 'point', hearIt), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (i > 0 && it) { const t = setTimeout(hearIt, 500); return () => clearTimeout(t); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [i]);
  const answer = (yes: boolean) => {
    if (!it || busy.current) return; busy.current = true;
    p.stopWaiting();
    if (yes === it.yes) { setFlash('ok'); setScore(s => s + 1); p.lulu('correct', 'cheer', () => { setFlash(null); busy.current = false; if (i + 1 < items.length) setI(i + 1); else onDone(); }, 'cheer'); }
    else { setFlash('no'); p.lulu('tryagain', 'think', () => { setFlash(null); busy.current = false; hearIt(); }, 'encourage'); }
  };
  return (
    <div className="ac ac-hear">
      <p className="by-speech">{COMMON.hear.text} <b>{p.S.harf.name}</b></p>
      <Stars n={score} of={items.length} />
      <button className={`ac-bigcard ${flash || ''}`} onClick={hearIt} aria-label="اسمع مرّة أخرى"><span className="em">{it?.emoji}</span><span className="spk">🔊</span></button>
      <div className="by-choices row">
        <button className="by-opt" onClick={() => answer(true)}>نَعَمْ، تَبْدَأُ بِـ«{p.S.meta.letter}» 👍</button>
        <button className="by-opt" onClick={() => answer(false)}>لا 👎</button>
      </div>
    </div>
  );
}

/* ═══════════ ح6) الحرف في اسمي ═══════════ */
export function NameLetter({ p, re, fallback, onDone }: { p: ActCtx; re: string; fallback: string; onDone: () => void }) {
  const say = useSay(p);
  const rx = useMemo(() => new RegExp(re), [re]);
  const name = p.name || fallback;
  const has = rx.test(name);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { const t = setTimeout(() => say('nameQ', 'think', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const reveal = () => { p.stopWaiting(); setRevealed(true); say(has ? 'nameYes' : 'nameNo', has ? 'cheer' : 'point'); };
  const shown = has ? name : fallback;
  return (
    <div className="ac ac-name">
      <p className="by-speech">{COMMON.nameQ.text}</p>
      <div className={`ac-bigname ${revealed ? 'on' : ''}`} dir="rtl">
        {Array.from(shown).map((ch, i) => <span key={i} className={revealed && rx.test(ch) ? 'hit' : ''}>{ch}</span>)}
      </div>
      {!revealed ? <button className="by-big" onClick={reveal}>اُنْظُرْ! 👀</button> : (
        <div className="by-center">
          <p className="by-sub">{has ? `حَرْفُ ${p.S.harf.name} في اسْمِكْ!` : `لَيْسَ في اسْمِكْ… لٰكِنَّهُ في «${fallback}»`}</p>
          <button className="by-big" onClick={onDone}>التّالي ◀</button>
        </div>
      )}
    </div>
  );
}

/* ═══════════ ل3) الذاكرة: صورة ↔ كلمة ═══════════ */
export function Memory({ p, onDone }: { p: ActCtx; onDone: () => void }) {
  const say = useSay(p);
  const V = p.S.vocab;
  const tiles = useMemo(() => shuffle([...V.map(v => ({ id: v.key + '-i', key: v.key, img: v.img, w: '' })), ...V.map(v => ({ id: v.key + '-w', key: v.key, img: '', w: v.w }))], 7), [V]);
  const [open, setOpen] = useState<string[]>([]);
  const [found, setFound] = useState<Record<string, boolean>>({});
  const [moves, setMoves] = useState(0);
  useEffect(() => { const t = setTimeout(() => say('memory', 'point'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const flip = (id: string) => {
    if (open.includes(id) || open.length === 2) return;
    const t = tiles.find(x => x.id === id)!; if (found[t.key]) return;
    const v = V.find(x => x.key === t.key)!; p.play(p.snd(v.audio));
    const nx = [...open, id]; setOpen(nx);
    if (nx.length === 2) {
      setMoves(m => m + 1);
      const a = tiles.find(x => x.id === nx[0])!, b = tiles.find(x => x.id === nx[1])!;
      if (a.key === b.key) { setTimeout(() => { setFound(f => { const g = { ...f, [a.key]: true }; if (Object.keys(g).length === V.length) p.lulu('correct', 'cheer', onDone, 'cheer'); else p.lulu('yasalam', 'cheer', undefined, 'cheer'); return g; }); setOpen([]); }, 500); }
      else setTimeout(() => setOpen([]), 1100);
    }
  };
  return (
    <div className="ac ac-memory">
      <p className="by-speech">{COMMON.memory.text}</p>
      <Stars n={Object.keys(found).length} of={V.length} />
      <div className="ac-grid4">
        {tiles.map(t => { const up = open.includes(t.id) || found[t.key]; return (
          <button key={t.id} className={`ac-tile ${up ? 'up' : ''} ${found[t.key] ? 'ok' : ''}`} onClick={() => flip(t.id)} aria-label={up ? (t.w || t.key) : 'بطاقة'}>
            {up ? (t.img ? <img src={p.img(t.img)} alt="" /> : <b>{t.w}</b>) : <span className="back">🦜</span>}
          </button>
        ); })}
      </div>
      <p className="by-muted">مُحاوَلاتْ: {moves}</p>
    </div>
  );
}

/* ═══════════ ل5) ماذا اختفى؟ ═══════════ */
export function Missing({ p, rounds, onDone }: { p: ActCtx; rounds: number; onDone: () => void }) {
  const say = useSay(p);
  const V = p.S.vocab;
  const [r, setR] = useState(0);
  const [hidden, setHidden] = useState<string | null>(null);
  const [phase, setPhase] = useState<'look' | 'ask' | 'done'>('look');
  const order = useMemo(() => shuffle(V.map(v => v.key), 13), [V]);
  useEffect(() => { const t = setTimeout(() => say('missing', 'point', () => startRound(0)), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const startRound = (k: number) => { setPhase('look'); setHidden(null); setTimeout(() => { setHidden(order[k % order.length]); setPhase('ask'); say('whatMissing', 'think', p.awaitAnswer); }, 2600); };
  const pick = (key: string) => {
    if (phase !== 'ask') return; p.stopWaiting();
    if (key === hidden) { const v = V.find(x => x.key === key)!; p.luluSay(v.w, v.audio, 'cheer', () => { if (r + 1 < rounds) { setR(r + 1); startRound(r + 1); } else { setPhase('done'); p.lulu('correct', 'cheer', onDone, 'cheer'); } }); }
    else p.lulu('tryagain', 'think', undefined, 'encourage');
  };
  return (
    <div className="ac ac-missing">
      <p className="by-speech">{phase === 'look' ? 'اُنْظُرْ جَيِّدًا… 👀' : COMMON.whatMissing.text}</p>
      <Stars n={r + (phase === 'done' ? 1 : 0)} of={rounds} />
      <div className="by-vocab">
        {V.map(v => <div key={v.key} className={`by-vcard ${hidden === v.key ? 'hide' : ''}`}>{hidden === v.key ? <span className="q">؟</span> : <img src={p.img(v.img)} alt="" />}<b>{hidden === v.key ? '…' : v.w}</b></div>)}
      </div>
      {phase === 'ask' && <div className="by-chips">{shuffle(V, 3 + r).map(v => <button key={v.key} className="by-chip big" onClick={() => pick(v.key)}>{v.w}</button>)}</div>}
      <p className="by-parent">🎙️ قُلِ الْكَلِمَةَ بِصَوْتِكَ أَوَّلًا… ثُمَّ الْمِسْها.</p>
    </div>
  );
}

/* ═══════════ ل6) اسمع واختر ═══════════ */
export function Listen({ p, rounds, onDone }: { p: ActCtx; rounds: number; onDone: () => void }) {
  const say = useSay(p);
  const V = p.S.vocab;
  const [r, setR] = useState(0);
  const [score, setScore] = useState(0);
  const order = useMemo(() => shuffle(V, 17), [V]);
  const target = order[r % order.length];
  const options = useMemo(() => shuffle([target, ...shuffle(V.filter(v => v.key !== target.key), 23 + r).slice(0, 2)], 29 + r), [V, target, r]);
  const ask = useCallback(() => p.luluSay('…', target.audio, 'think', p.awaitAnswer), [p, target]);
  useEffect(() => { const t = setTimeout(() => say('listen', 'point', ask), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (r === 0) return; const half = Math.floor(rounds / 2); const t = setTimeout(() => (r === half ? say('faster', 'dance', ask) : ask()), 400); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [r]);
  const busy = useRef(false);
  const pick = (v: VocabItem) => {
    if (busy.current) return; busy.current = true; p.stopWaiting();
    const free = () => { busy.current = false; };
    if (v.key === target.key) { setScore(s => s + 1); p.lulu('correct', 'cheer', () => { free(); if (r + 1 < rounds) setR(r + 1); else onDone(); }, 'cheer'); }
    else p.lulu('tryagain', 'think', () => { free(); ask(); }, 'encourage');
  };
  return (
    <div className="ac ac-listen">
      <p className="by-speech">{COMMON.listen.text}</p>
      <Stars n={score} of={rounds} />
      <button className="by-ghost" onClick={ask}>🔊 اِسْمَعْ مَرَّةً أُخْرى</button>
      <div className="by-pics three">
        {options.map(v => <button key={v.key} className="by-pic" onClick={() => pick(v)} aria-label={v.w}><img src={p.img(v.img)} alt="" /></button>)}
      </div>
    </div>
  );
}

/* ═══════════ ل8) صفّق المقاطع ═══════════ */
export function Clap({ p, items, onDone }: { p: ActCtx; items: { w: string; audio: string; syllables: string[] }[]; onDone: () => void }) {
  const say = useSay(p);
  const [i, setI] = useState(0);
  const [taps, setTaps] = useState(0);
  const it = items[i];
  useEffect(() => { const t = setTimeout(() => say('clap', 'dance', () => p.play(p.snd(it.audio))), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const tap = () => {
    const n = taps + 1; setTaps(n); p.setLstate('cheer');
    if (n === it.syllables.length) { setTimeout(() => p.luluSay(it.w, it.audio, 'cheer', () => { setTaps(0); if (i + 1 < items.length) { setI(i + 1); p.play(p.snd(items[i + 1].audio)); } else onDone(); }), 350); }
  };
  const reset = () => { setTaps(0); p.lulu('tryagain', 'think', () => p.play(p.snd(it.audio)), 'encourage'); };
  return (
    <div className="ac ac-clap">
      <p className="by-speech">{COMMON.clap.text}</p>
      <Stars n={i} of={items.length} />
      <button className="ac-word" onClick={() => p.play(p.snd(it.audio))}>{it.w} 🔊</button>
      <div className="ac-syll">{it.syllables.map((s, k) => <span key={k} className={k < taps ? 'on' : ''}>{s}</span>)}</div>
      <div className="by-row">
        <button className="ac-clapbtn" onClick={tap} disabled={taps >= it.syllables.length} aria-label="صفّق">👏</button>
        <button className="by-ghost" onClick={reset}>🔁 مِنَ الْبِدايَةْ</button>
      </div>
      <p className="by-muted">كَمْ مَقْطَعًا؟ صَفِّقْ وَاضْغَطْ لِكُلِّ مَقْطَعْ</p>
    </div>
  );
}

/* ═══════════ ل10) الجسد يلعب: اقفز إذا سمعت حرف اليوم ═══════════ */
export function Jump({ p, items, onDone }: { p: ActCtx; items: SoundItem[]; onDone: () => void }) {
  const say = useSay(p);
  const [i, setI] = useState(-1);
  const [score, setScore] = useState(0);
  const [reveal, setReveal] = useState(false);
  const it = items[i];
  useEffect(() => { const t = setTimeout(() => say('jump', 'dance'), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const next = (k: number) => { setReveal(false); setI(k); const x = items[k]; setTimeout(() => p.luluSay(x.w, x.audio, 'think', p.awaitAnswer), 400); };
  const answer = (jumped: boolean) => {
    if (!it || reveal) return;
    p.stopWaiting(); setReveal(true);
    const ok = jumped === it.yes; if (ok) setScore(s => s + 1);
    p.lulu(ok ? 'correct' : 'tryagain', ok ? 'cheer' : 'think', () => { if (i + 1 < items.length) next(i + 1); else say('parentCheck', 'point', onDone); }, ok ? 'cheer' : 'encourage');
  };
  return (
    <div className="ac ac-jump">
      <p className="by-speech">{COMMON.jump.text} <b>({p.S.meta.letter})</b></p>
      <Stars n={score} of={items.length} />
      {i < 0 ? <button className="by-big" onClick={() => next(0)}>قِفْ وَاسْتَعِدّْ! 🧍 ثُمَّ ابْدَأْ ▶</button> : (
        <>
          <div className={`ac-bigcard ${reveal ? (it.yes ? 'ok' : 'no') : ''}`}><span className="em">{reveal ? it.emoji : '🔊'}</span>{reveal && <b>{it.w}</b>}</div>
          {!reveal && <div className="by-choices row">
            <button className="by-opt" onClick={() => answer(true)}>قَفَزْتُ! 🙌</button>
            <button className="by-opt" onClick={() => answer(false)}>بَقيتُ واقِفًا 🧍</button>
          </div>}
        </>
      )}
      <p className="by-parent">💡 لوليّ الأمر: {COMMON.parentCheck.text} اضغط معه الزرّ الذي يصف ما فعل.</p>
    </div>
  );
}

/* ═══════════ ل4) سلّة لؤلؤ ═══════════ */
export function Basket({ p, items, onDone }: { p: ActCtx; items: SoundItem[]; onDone: () => void }) {
  const say = useSay(p);
  const [sel, setSel] = useState<number | null>(null);
  const [placed, setPlaced] = useState<Record<number, 'in' | 'out'>>({});
  const [shake, setShake] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => say('basket', 'point', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const pickItem = (k: number) => { if (placed[k] !== undefined) return; p.stopWaiting(); setSel(k); p.luluSay(items[k].w, items[k].audio, 'wave'); };
  const drop = (where: 'in' | 'out') => {
    if (sel === null) return; const it = items[sel]; const ok = (where === 'in') === it.yes;
    if (ok) { const np = { ...placed, [sel]: where }; setPlaced(np); setSel(null); const finished = Object.keys(np).length === items.length; p.lulu('correct', 'cheer', finished ? onDone : undefined, 'cheer'); }
    else { setShake(sel); setTimeout(() => setShake(null), 500); p.lulu('tryagain', 'think', undefined, 'encourage'); }
  };
  const inCount = Object.values(placed).filter(v => v === 'in').length;
  return (
    <div className="ac ac-basket">
      <p className="by-speech">{COMMON.basket.text} <b>({p.S.meta.letter})</b></p>
      <Stars n={Object.keys(placed).length} of={items.length} />
      <div className="ac-items">
        {items.map((it, k) => <button key={k} className={`ac-item ${sel === k ? 'on' : ''} ${placed[k] ? 'gone' : ''} ${shake === k ? 'shake' : ''}`} onClick={() => pickItem(k)} disabled={placed[k] !== undefined}><span className="em">{it.emoji}</span><b>{it.w}</b></button>)}
      </div>
      <div className="ac-bins">
        <button className={`ac-bin in ${sel !== null ? 'ready' : ''}`} onClick={() => drop('in')}><span className="em">🧺</span><b>سَلَّةُ لُؤْلُؤ ({inCount})</b></button>
        <button className={`ac-bin out ${sel !== null ? 'ready' : ''}`} onClick={() => drop('out')}><span className="em">✋</span><b>لَيْسَ لِلسَّلَّةْ</b></button>
      </div>
      <p className="by-muted">اِلْمِسِ الشَّيْءَ… ثُمَّ الْمِسِ السَّلَّةَ أَوْ «لَيْسَ لِلسَّلَّةْ»</p>
    </div>
  );
}

/* ═══════════ ل9) نكتشف: «ابحث عن الحرف في بيتك» (الأسبوع 3) ═══════════
 * لؤلؤ تسمّي ثلاثة أشياء حقيقيّة فيها حرف اليوم؛ الطفل يحضرها أو يشير إليها ثم يضغط «وَجَدْتُها!» — بلا كاميرا ولا صورة.
 * مؤقّت لطيف 60 ث للعرض فقط (لا يُخسَر شيء). عند الثلاث: مقطع «وَجَدْتَ الثَّلاثَةْ…» ثم onDone. */
export function Discover({ p, G, onDone }: { p: ActCtx; G: Extract<Game, { kind: 'discover' }>; onDone: () => void }) {
  const [found, setFound] = useState<Record<number, boolean>>({});
  const [sec, setSec] = useState(60);
  useEffect(() => { const t = setTimeout(() => p.luluSay(G.prompt.text, G.prompt.audio, 'point', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (sec <= 0) return; const t = setTimeout(() => setSec(s => s - 1), 1000); return () => clearTimeout(t); }, [sec]);
  const hear = (k: number) => { p.stopWaiting(); p.luluSay(G.items[k].w, G.items[k].audio, 'wave'); };
  const got = (k: number) => {
    if (found[k]) return; p.stopWaiting();
    const nf = { ...found, [k]: true }; setFound(nf);
    if (Object.keys(nf).length === G.items.length) p.luluSay(G.done.text, G.done.audio, 'cheer', onDone);
    else p.lulu('correct', 'cheer', undefined, 'cheer');
  };
  const n = Object.keys(found).length;
  return (
    <div className="ac ac-discover">
      <p className="by-speech">{G.prompt.text}</p>
      <img src={p.img(G.img)} alt="" className="ac-discover-img" />
      <Stars n={n} of={G.items.length} />
      <div className="ac-items">
        {G.items.map((it, k) => (
          <div key={k} className={`ac-find ${found[k] ? 'ok' : ''}`}>
            <button className="ac-item" onClick={() => hear(k)}><span className="em">{it.emoji}</span><b>{it.w}</b></button>
            <button className="ac-found" onClick={() => got(k)} disabled={!!found[k]} aria-label={`وجدت ${it.w}`}>{found[k] ? '✅ وَجَدْتُها' : 'وَجَدْتُها!'}</button>
          </div>
        ))}
      </div>
      <p className="by-muted">⏳ {sec > 0 ? `${sec} ث` : 'خُذْ وَقْتَكْ…'} · 👨‍👩‍👧 وليّ الأمر: أكّد بلمسة «وَجَدْتُها» بعد أن يُحضر الطفل الشيء أو يشير إليه</p>
    </div>
  );
}

/* ═══════════ ح5) نلوّن: لَوِّنِ الحرف (الأسبوع 3 ب) ═══════════
 * كلمة كبيرة حرفًا حرفًا (كما في «الحرف في اسمي»)؛ الطفل يلمس كلّ حرف يوم فيتلوّن مرجانيًّا. ثلاث كلمات، ثمّ done. */
export function ColorLetter({ p, A, onDone }: { p: ActCtx; A: Extract<HarfActivity, { kind: 'color' }>; onDone: () => void }) {
  const L = p.S.meta.letter; const rx = useMemo(() => new RegExp(L === 'ا' ? '[اأإآ]' : L), [L]);
  const [wi, setWi] = useState(0);
  const [hit, setHit] = useState<Record<number, boolean>>({});
  const [shake, setShake] = useState<number | null>(null);
  const word = A.words[wi];
  const chars = useMemo(() => Array.from(word.w.match(/.[\u064B-\u0652\u0670]*/g) || []), [word.w]);
  const targets = chars.map((c, i) => (rx.test(c[0]) ? i : -1)).filter(i => i >= 0);
  useEffect(() => { const t = setTimeout(() => p.luluSay(A.prompt.text, A.prompt.audio, 'point', () => p.play(p.snd(word.audio))), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (wi > 0) p.play(p.snd(word.audio)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [wi]);
  const tap = (i: number) => {
    if (hit[i]) return;
    if (!targets.includes(i)) { setShake(i); setTimeout(() => setShake(null), 500); p.lulu('tryagain', 'think', undefined, 'encourage'); return; }
    const nh = { ...hit, [i]: true }; setHit(nh);
    const doneWord = targets.every(t => nh[t]);
    if (!doneWord) { p.lulu('yasalam', 'cheer', undefined, 'cheer'); return; }
    if (wi + 1 < A.words.length) p.lulu('correct', 'cheer', () => { setHit({}); setWi(wi + 1); }, 'cheer');
    else p.luluSay(A.done.text, A.done.audio, 'dance', onDone);
  };
  return (
    <div className="ac ac-color">
      <p className="by-speech">{A.prompt.text}</p>
      <Stars n={wi + (targets.every(t => hit[t]) ? 1 : 0)} of={A.words.length} />
      <div className="ac-bigname on" dir="rtl">
        {chars.map((c, i) => <span key={i} className={`${hit[i] ? 'hit' : ''} ${shake === i ? 'shake' : ''}`} onClick={() => tap(i)} role="button" aria-label={c}>{c}</span>)}
      </div>
      <button className="by-ghost" onClick={() => p.play(p.snd(word.audio))}>🔊 {word.w}</button>
      <p className="by-muted">اِلْمِسْ كُلَّ «{L}» في الْكَلِمَةْ · {wi + 1} / {A.words.length}</p>
    </div>
  );
}

/* ═══════════ ل10) نكتشف/عُدّ: عُدَّ ما يبدأ بحرف اليوم في المشهد (الأسبوع 3 ب) ═══════════
 * مشهد مرسوم بمواقع لمس (٪). لمس شيء يبدأ بالحرف → يُعَدّ بصوت لؤلؤ (nums[n-1]) ويُعلَّم؛ غيره → «قَريبْ!».
 * عند اكتمال العدّ: سؤال «كَمْ؟» بخيارات أرقام؛ الصحيح = عدد الأشياء الصحيحة → done. */
export function Count({ p, G, onDone }: { p: ActCtx; G: Extract<Game, { kind: 'count' }>; onDone: () => void }) {
  const [found, setFound] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [pick, setPick] = useState<number | null>(null);
  const total = G.items.filter(i => i.yes).length;
  const n = Object.keys(found).length;
  useEffect(() => { const t = setTimeout(() => p.luluSay(G.prompt.text, G.prompt.audio, 'point', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const tap = (k: string) => {
    if (asking || found[k]) return; p.stopWaiting();
    const it = G.items.find(i => i.key === k)!;
    if (!it.yes) { setShake(k); setTimeout(() => setShake(null), 500); p.luluSay(it.w, it.audio, 'think', () => p.lulu('tryagain', 'think', undefined, 'encourage')); return; }
    const nf = { ...found, [k]: true }; setFound(nf); const c = Object.keys(nf).length;
    const num = G.nums[Math.min(c, G.nums.length) - 1];
    p.luluSay(`${it.w}… ${num.text}`, num.audio, 'cheer', () => { if (c === total) { setAsking(true); p.luluSay(G.ask.text, G.ask.audio, 'think', p.awaitAnswer); } });
  };
  const answer = (v: number) => {
    p.stopWaiting(); setPick(v);
    if (v === total) p.luluSay(G.done.text, G.done.audio, 'dance', onDone); else p.lulu('hmm', 'think', p.awaitAnswer);
  };
  const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return (
    <div className="ac ac-count">
      <p className="by-speech">{asking ? G.ask.text : G.prompt.text} <b>({p.S.meta.letter})</b></p>
      <div className="by-scene">
        <img src={p.img(G.img)} alt="" />
        {G.items.map(it => <button key={it.key} className={`by-spot ${found[it.key] ? 'ok' : ''} ${shake === it.key ? 'shake' : ''}`} style={{ left: `${it.box.x}%`, top: `${it.box.y}%`, width: `${it.box.w}%`, height: `${it.box.h}%` }} onClick={() => tap(it.key)} aria-label={it.w}>{found[it.key] && <span className="lbl">{AR[Object.keys(found).indexOf(it.key) + 1]}</span>}</button>)}
      </div>
      <div className="ac-counter" aria-live="polite">{Array.from({ length: total }, (_, i) => <span key={i} className={i < n ? 'on' : ''}>{AR[i + 1]}</span>)}</div>
      {asking && (
        <div className="by-choices row">
          {G.choices.map(v => <button key={v} className={`by-opt ${pick === v ? (v === total ? 'good' : 'soft') : ''}`} onClick={() => answer(v)}>{AR[v]}</button>)}
        </div>
      )}
    </div>
  );
}

/* ═══════════ ل11) نلوّن حسب الكلمة: لوّن حسب الكلمة (الأسبوع 4) ═══════════
 * صورتان بالمشهد نفسه: خطّية (أسفل) وملوّنة (أعلى، مقصوصة بـ clip-path على مواقع ما تلوّن). لؤلؤ تقول «لَوِّنِ…» + الكلمة،
 * الطفل يلمس الشيء → يُكشَف لونه + ok؛ لمس غيره → near. عند اكتمال الأربعة تُكشَف الصورة كلّها → done. */
export function Paint({ p, G, onDone }: { p: ActCtx; G: Extract<Game, { kind: 'paint' }>; onDone: () => void }) {
  const [i, setI] = useState(-1);                       // الكلمة الجارية (-1 قبل البدء)
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [shake, setShake] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const cur = i >= 0 ? G.items[i] : null;
  const ask = (k: number) => { setI(k); const it = G.items[k]; p.luluSay(`${G.ask.text} ${it.w}!`, G.ask.audio, 'point', () => p.play(p.snd(it.audio), p.awaitAnswer)); };
  useEffect(() => { const t = setTimeout(() => p.luluSay(G.prompt.text, G.prompt.audio, 'wave', () => ask(0)), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const tap = (k: string) => {
    if (!cur || done[k]) return; p.stopWaiting();
    if (k !== cur.key) { setShake(k); setTimeout(() => setShake(null), 500); p.luluSay(G.near.text, G.near.audio, 'think', () => p.play(p.snd(cur.audio), p.awaitAnswer)); return; }
    const nd = { ...done, [k]: true }; setDone(nd);
    p.luluSay(cur.ok.text, cur.ok.audio, 'cheer', () => {
      if (i + 1 < G.items.length) ask(i + 1);
      else { setAll(true); p.luluSay(G.done.text, G.done.audio, 'dance', onDone); }
    });
  };
  const n = Object.keys(done).length;
  return (
    <div className="ac ac-paint">
      <p className="by-speech">{cur ? `${G.ask.text} ${cur.w}!` : G.prompt.text}</p>
      <div className={`by-scene ac-paint-scene ${all ? 'all' : ''}`}>
        <img src={p.img(G.line)} alt="" />
        {all ? <img src={p.img(G.color)} alt="" className="ac-paint-color" />
          : G.items.filter(it => done[it.key]).map(it => <img key={it.key} src={p.img(G.color)} alt="" className="ac-paint-color" style={{ clipPath: `inset(${it.box.y}% ${100 - it.box.x - it.box.w}% ${100 - it.box.y - it.box.h}% ${it.box.x}%)` }} />)}
        {G.items.map(it => <button key={it.key} className={`by-spot ac-paint-spot ${done[it.key] ? 'ok' : ''} ${shake === it.key ? 'shake' : ''}`} style={{ left: `${it.box.x}%`, top: `${it.box.y}%`, width: `${it.box.w}%`, height: `${it.box.h}%` }} onClick={() => tap(it.key)} aria-label={it.w}>{done[it.key] && <span className="lbl">{it.w}</span>}</button>)}
      </div>
      <Stars n={n} of={G.items.length} />
    </div>
  );
}

/* ═══════════ ل12) صَيْدُ الْكَلِمَةْ (الأسبوع 5 — المسجد) ═══════════
 * فوانيس تصعد ببطء في سماء المشهد؛ على كلّ فانوس صورة وكلمة. الطفل يلمس الفانوس الذي تبدأ كلمته بحرف اليوم:
 * صحيح → يضيء ويثبت في صفّ «اصطدتُ» ويُقال اسمه؛ خطأ → يهتزّ و«هِمْمْ». بعد صيد الكلّ: جولة «لؤلؤ تخطئ» (تدّعي كلمةً لا تبدأ بالحرف) والطفل يصحّحها بزرّ. */
export function Catch({ p, G, onDone }: { p: ActCtx; G: Extract<Game, { kind: 'catch' }>; onDone: () => void }) {
  const [caught, setCaught] = useState<Record<number, boolean>>({});
  const [shake, setShake] = useState<number | null>(null);
  const [phase, setPhase] = useState<'play' | 'lulu' | 'end'>('play');
  const order = useMemo(() => shuffle(G.items.map((_, i) => i), 11), [G.items]);
  const need = G.items.filter(it => it.yes).length;
  const got = Object.keys(caught).length;
  useEffect(() => { const t = setTimeout(() => p.luluSay(G.prompt.text, G.prompt.audio, 'point', p.awaitAnswer), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const tap = (k: number) => {
    if (phase !== 'play' || caught[k]) return; p.stopWaiting();
    const it = G.items[k];
    if (!it.yes) { setShake(k); setTimeout(() => setShake(null), 500); p.lulu('hmm', 'think', p.awaitAnswer, 'encourage'); return; }
    const nc = { ...caught, [k]: true }; setCaught(nc);
    p.play(p.snd(it.audio), () => {
      if (Object.keys(nc).length < need) { p.lulu('correct', 'cheer', p.awaitAnswer, 'cheer'); return; }
      setPhase('lulu'); p.luluSay(G.mistake.say.text, G.mistake.say.audio, 'think', p.awaitAnswer);
    });
  };
  const judge = (right: boolean) => {
    if (phase !== 'lulu') return; p.stopWaiting();
    if (right) { p.lulu('hmm', 'think', p.awaitAnswer, 'encourage'); return; }   // الطفل وافق لؤلؤ على الخطأ → تلميح
    setPhase('end'); p.lulu('thanks', 'cheer', onDone, 'cheer');
  };
  return (
    <div className="ac ac-catch">
      <p className="by-speech">{phase === 'lulu' ? G.mistake.say.text : G.prompt.text} <b>({p.S.meta.letter})</b></p>
      <Stars n={got} of={need} />
      <div className="ac-sky" style={{ backgroundImage: `url(${p.img(G.img)})` }} aria-label="سماء المسجد">
        {order.map((k, slot) => { const it = G.items[k]; const on = !!caught[k]; return (
          <button key={k} className={`ac-lantern ${on ? 'lit' : ''} ${shake === k ? 'shake' : ''}`} style={{ left: `${6 + (slot % 4) * 23}%`, animationDelay: `${(slot * 1.7) % 9}s`, animationDuration: `${11 + (slot % 3) * 2}s` }} onClick={() => tap(k)} aria-label={it.w} disabled={on}>
            <span className="em">{it.emoji}</span><b>{it.w}</b>
          </button>
        ); })}
      </div>
      {phase === 'lulu' && (
        <div className="by-choices row">
          <button className="by-opt" onClick={() => judge(false)}>لا يا لُؤْلُؤ… {G.mistake.w} لا تَبْدَأُ بِـ{p.S.meta.letter} ✋</button>
          <button className="by-opt" onClick={() => judge(true)}>نَعَمْ أَصَبْتِ 👍</button>
        </div>
      )}
      <p className="by-muted">اِلْمِسِ الْفانوسَ الَّذي تَبْدَأُ كَلِمَتُهُ بِحَرْفِ الْيَوْمْ</p>
    </div>
  );
}

/* ═══════════ ر2) اِرْسَمْ ما سَمِعْتْ (الأسبوع 5 — المسجد) ═══════════
 * لؤلؤ تقول الكلمة (بلا صورة)؛ الطفل يرسم بإصبعه على لوحة (3 ألوان + ممحاة + مسح)؛ «اِنْتَهَيْتْ!» → تُكشَف بطاقة الكلمة بجانب رسمه
 * ولؤلؤ تحتفي (بلا تقييم آليّ). الرسم يُحفَظ محلّيًّا (localStorage: bayan_draw_<slug>_<key>) ليظهر في بطاقة وليّ الأمر. */
export function Draw({ p, G, onDone }: { p: ActCtx; G: Extract<Game, { kind: 'draw' }>; onDone: () => void }) {
  const COLORS = ['#3A1F36', '#E8795C', '#5EA8A0', '#D9A866'];
  const cv = useRef<HTMLCanvasElement | null>(null);
  const [i, setI] = useState(0);
  const [color, setColor] = useState(COLORS[0]);
  const [eraser, setEraser] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [marks, setMarks] = useState(0);
  const down = useRef(false); const last = useRef<{ x: number; y: number } | null>(null);
  const R = G.rounds[i];
  const clear = () => { const c = cv.current; if (!c) return; const g = c.getContext('2d')!; g.fillStyle = '#FBF4EE'; g.fillRect(0, 0, c.width, c.height); setMarks(0); };
  const ask = (k: number) => { setI(k); setReveal(false); setEraser(false); setTimeout(clear, 0); const r = G.rounds[k]; p.luluSay(`${G.prompt.text} ${r.w}!`, G.prompt.audio, 'point', () => p.play(p.snd(r.audio), p.awaitAnswer)); };
  useEffect(() => { clear(); const t = setTimeout(() => ask(0), 300); return () => clearTimeout(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const pos = (e: React.PointerEvent) => { const c = cv.current!; const b = c.getBoundingClientRect(); return { x: (e.clientX - b.left) * (c.width / b.width), y: (e.clientY - b.top) * (c.height / b.height) }; };
  const stroke = (q: { x: number; y: number }) => { const g = cv.current!.getContext('2d')!; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = eraser ? 34 : 12; g.strokeStyle = eraser ? '#FBF4EE' : color; g.beginPath(); const l = last.current || q; g.moveTo(l.x, l.y); g.lineTo(q.x, q.y); g.stroke(); last.current = q; };
  const onDown = (e: React.PointerEvent) => { if (reveal) return; down.current = true; last.current = null; stroke(pos(e)); setMarks(m => m + 1); p.stopWaiting(); };
  const onMove = (e: React.PointerEvent) => { if (!down.current || reveal) return; stroke(pos(e)); };
  const onUp = () => { down.current = false; last.current = null; };
  const finish = () => {
    if (reveal) return; setReveal(true);
    try { localStorage.setItem(`bayan_draw_${p.S.slug}_${R.key}`, cv.current!.toDataURL('image/jpeg', 0.6)); } catch { /* تخزين ممتلئ — لا يهمّ */ }
    p.luluSay(R.done.text, R.done.audio, 'cheer', () => { if (i + 1 < G.rounds.length) ask(i + 1); else onDone(); });
  };
  return (
    <div className="ac ac-draw">
      <p className="by-speech">{reveal ? R.done.text : `${G.prompt.text} ${R.w}!`}</p>
      <Stars n={i + (reveal ? 1 : 0)} of={G.rounds.length} />
      <div className={`ac-draw-wrap ${reveal ? 'reveal' : ''}`}>
        <canvas ref={cv} width={480} height={360} className="ac-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} style={{ touchAction: 'none' }} aria-label={`لوحة رسم: ${R.w}`} />
        {reveal && <figure className="ac-draw-card"><img src={p.img(R.img)} alt={R.w} /><figcaption>{R.w}</figcaption></figure>}
      </div>
      {!reveal && (
        <div className="ac-palette" role="toolbar" aria-label="ألوان">
          {COLORS.map(c => <button key={c} className={`ac-swatch ${!eraser && color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => { setColor(c); setEraser(false); }} aria-label="لون" />)}
          <button className={`ac-tool ${eraser ? 'on' : ''}`} onClick={() => setEraser(true)} aria-label="ممحاة">🧽</button>
          <button className="ac-tool" onClick={clear} aria-label="امسح الكلّ">🗑️</button>
          <button className="by-big" onClick={finish} disabled={marks === 0}>اِنْتَهَيْتْ! ✅</button>
        </div>
      )}
      <p className="by-muted">{reveal ? 'رَسْمُكَ عَلَى الْيَمينْ… وَبِطاقَةُ لُؤْلُؤ عَلَى الْيَسارْ!' : 'اِرْسُمْ بِإِصْبَعِكَ ما قالَتْهُ لُؤْلُؤ… ثُمَّ اضْغَطْ اِنْتَهَيْتْ'}</p>
    </div>
  );
}

export const ACT_CSS = `
.ac-sky{position:relative;width:100%;max-width:640px;aspect-ratio:4/3;border-radius:22px;overflow:hidden;background:#2a1a3a center/cover no-repeat;border:3px solid #F1D9A8}
.ac-lantern{position:absolute;bottom:-30%;width:19%;aspect-ratio:3/4;border:0;border-radius:40% 40% 46% 46%;background:linear-gradient(#f6d58a,#e59a3c);box-shadow:inset 0 -10px 0 rgba(0,0,0,.12),0 6px 18px rgba(0,0,0,.35);display:grid;place-items:center;align-content:center;gap:2px;cursor:pointer;color:#3A1F36;padding:6px 2px;animation:ac-rise linear infinite}
.ac-lantern .em{font-size:clamp(22px,5vw,38px);line-height:1}.ac-lantern b{font-size:clamp(12px,2.4vw,17px)}
.ac-lantern.lit{animation-play-state:paused;background:linear-gradient(#fff3c4,#ffc54d);box-shadow:0 0 0 4px #5EA8A0,0 0 30px 10px rgba(255,210,90,.75);transform:scale(1.08)}
.ac-lantern.shake{animation:ac-rise linear infinite,ac-shake .45s}
@keyframes ac-rise{from{transform:translateY(0)}to{transform:translateY(-460%)}}
@media (prefers-reduced-motion:reduce){.ac-lantern{animation:none;bottom:auto;top:calc(12% + var(--i,0)*0%)}}
.ac-draw-wrap{display:grid;grid-template-columns:1fr;gap:12px;width:100%;max-width:640px;justify-items:center}.ac-draw-wrap.reveal{grid-template-columns:1fr 1fr;align-items:center}
.ac-canvas{width:100%;max-width:480px;aspect-ratio:4/3;background:#FBF4EE;border:3px dashed #F1D9A8;border-radius:22px;cursor:crosshair}
.ac-draw-card{margin:0;display:grid;justify-items:center;gap:6px;animation:ac-pop .5s ease}.ac-draw-card img{width:100%;max-width:300px;border-radius:18px;border:3px solid #5EA8A0}.ac-draw-card figcaption{font-size:26px;font-weight:800;color:#3A1F36}
.ac-palette{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:center}
.ac-swatch{width:44px;height:44px;border-radius:50%;border:4px solid #fff;box-shadow:0 0 0 2px #F1D9A8;cursor:pointer}.ac-swatch.on{box-shadow:0 0 0 4px #5EA8A0;transform:scale(1.12)}
.ac-tool{width:48px;height:48px;border-radius:14px;border:3px solid #F1D9A8;background:#fff;font-size:24px;cursor:pointer}.ac-tool.on{border-color:#5EA8A0;background:#E6F3F1}
.ac-paint .by-scene{width:100%;max-width:640px}.ac-paint-scene img{width:100%;display:block;border-radius:22px}.ac-paint-color{position:absolute;inset:0;animation:ac-pop .5s ease}@keyframes ac-pop{from{opacity:0;transform:scale(1.02)}to{opacity:1;transform:none}}.ac-paint-spot{border-style:dotted;border-color:rgba(58,31,54,.25)}.ac-paint-spot.ok{border-color:#5EA8A0}
.ac-count .by-scene{position:relative;width:100%;max-width:640px}.ac-count .by-scene img{width:100%;border-radius:22px;border:3px solid #F1D9A8;display:block}
.ac-counter{display:flex;gap:10px;font-size:34px;font-weight:800;color:#e9ddd0}.ac-counter .on{color:#E8795C}
.ac-bigname span[role=button]{cursor:pointer}.ac-bigname span.shake{animation:ac-shake .4s}
@keyframes ac-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.ac-discover-img{width:100%;max-width:560px;border-radius:22px;border:3px solid #F1D9A8}
.ac-find{display:grid;gap:6px;justify-items:center}.ac-found{border:0;border-radius:14px;padding:10px 16px;font-size:18px;font-weight:800;background:#E8795C;color:#fff;cursor:pointer}.ac-found:disabled{background:#5EA8A0;cursor:default}.ac-find.ok .ac-item{border-color:#5EA8A0;background:#E6F3F1}
.ac{display:grid;gap:12px;justify-items:center}
.ac-stars{display:flex;gap:4px;font-size:26px;color:#e9ddd0}.ac-stars .on{color:#D9A866;text-shadow:0 2px 0 #b9854a}
.ac-svg{width:min(78vw,360px);height:min(78vw,360px);background:#FBF4EE;border:3px dashed #F1D9A8;border-radius:28px;cursor:crosshair}
.ac-air{font-size:26px;color:#3A1F36;background:#E6F3F1;border-radius:18px;padding:14px 20px}
.ac-bigcard{display:grid;justify-items:center;gap:6px;border:3px solid #F1D9A8;background:#fff;border-radius:28px;padding:18px 40px;cursor:pointer;color:#2A1626;min-width:200px;transition:.2s}
.ac-bigcard .em{font-size:84px;line-height:1}.ac-bigcard b{font-size:30px}.ac-bigcard .spk{font-size:20px;color:#8E7F8A}
.ac-bigcard.ok{border-color:#5EA8A0;background:#E6F3F1}.ac-bigcard.no{border-color:#E8795C;background:#fff5f0}
.ac-bigname{display:flex;gap:6px;font-size:56px;font-weight:800;color:#3A1F36;background:#fff;border:3px solid #F1D9A8;border-radius:24px;padding:14px 28px;direction:rtl}
.ac-bigname span{transition:.4s}.ac-bigname.on span.hit{color:#E8795C;transform:scale(1.25);text-shadow:0 0 18px rgba(232,121,92,.5)}
.ac-grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;width:100%;max-width:640px}
.ac-tile{aspect-ratio:1;border:3px solid #F1D9A8;background:#5EA8A0;border-radius:18px;cursor:pointer;display:grid;place-items:center;overflow:hidden;color:#3A1F36;font-size:26px;padding:0}
.ac-tile .back{font-size:40px;filter:grayscale(1);opacity:.6}.ac-tile.up{background:#fff}.ac-tile.ok{border-color:#5EA8A0;background:#E6F3F1}.ac-tile img{width:100%;height:100%;object-fit:cover}
.by-vcard.hide{background:#fff8ea;border-style:dashed}.by-vcard .q{display:grid;place-items:center;width:100%;aspect-ratio:1;font-size:72px;color:#E8795C;background:#fff;border-radius:12px}
.by-pics.three{grid-template-columns:repeat(3,1fr);max-width:640px;width:100%}
.ac-word{font-size:36px;border:3px solid #F1D9A8;background:#fff;border-radius:22px;padding:10px 26px;cursor:pointer;color:#3A1F36}
.ac-syll{display:flex;gap:8px;direction:rtl}.ac-syll span{font-size:28px;border-radius:14px;padding:6px 16px;background:#f6ece0;color:#8E7F8A;transition:.2s}.ac-syll span.on{background:#E8795C;color:#fff;transform:scale(1.08)}
.ac-clapbtn{font-size:64px;width:120px;height:120px;border-radius:50%;border:0;background:#E8795C;box-shadow:0 8px 0 #b9544a;cursor:pointer}.ac-clapbtn:active{transform:translateY(6px);box-shadow:0 2px 0 #b9544a}.ac-clapbtn:disabled{background:#d9cbc2;box-shadow:none}
.ac-items{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.ac-item{display:grid;justify-items:center;gap:2px;border:3px solid #F1D9A8;background:#fff;border-radius:18px;padding:8px 14px;cursor:pointer;color:#2A1626;min-width:110px}
.ac-item .em{font-size:44px;line-height:1}.ac-item b{font-size:20px}.ac-item.on{border-color:#E8795C;background:#fff5f0;transform:scale(1.06)}.ac-item.gone{opacity:.25}.ac-item.shake{animation:by-shake .45s}
.ac-bins{display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:560px}
.ac-bin{display:grid;justify-items:center;gap:4px;border:3px dashed #F1D9A8;background:#fff;border-radius:22px;padding:14px;cursor:pointer;color:#3A1F36;font-size:18px;opacity:.7}
.ac-bin .em{font-size:52px}.ac-bin.ready{opacity:1;border-style:solid}.ac-bin.in.ready{border-color:#5EA8A0;background:#E6F3F1}.ac-bin.out.ready{border-color:#E8795C;background:#fff5f0}
.ac-bar{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
.ac-bar span{font-size:13px;border-radius:999px;padding:4px 10px;background:#f6ece0;color:#8E7F8A}.ac-bar span.on{background:#E8795C;color:#fff}.ac-bar span.ok{background:#5EA8A0;color:#fff}
@media (max-width:700px){.ac-grid4{grid-template-columns:repeat(4,1fr)}.ac-bigname{font-size:40px}.ac-bigcard .em{font-size:64px}}
`;
