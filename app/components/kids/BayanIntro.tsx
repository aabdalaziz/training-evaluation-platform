'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «افتتاحية بَيان» (هـ-6-ز) — كتاب مصوَّر متحرّك داخل البوّابة (لا فيديو):
 *  لوحة لكلّ مشهد + حركة CSS خفيفة (Ken Burns ودخول المتكلّم) + مقاطع صوت متسلسلة + النصّ مكتوبًا.
 *  mode='child': «رسالة لؤلؤ» ≈ 90 ث، تُنادي الطفل باسمه كتابةً، وفي الختام زرّ «هَيّا بِنا!».
 *  mode='parents': «كيف يصنع بَيان أثرًا» ≈ 3 د بصوت جدّ سالم + كلمة المؤسّس مكتوبة.
 *  mode='facilitator': «دليل اللقاء الأسبوعيّ» ≈ 3 د بصوت جدّ سالم للميسّرين (/kids/facilitator).
 *  التشغيل يبدأ بلمسة (سياسة المتصفّحات)، ويمكن التخطّي في أيّ وقت. لا شيء يُرسَل إلى الخادم من هنا.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { INTRO_CHILD, INTRO_PARENTS, INTRO_FACILITATORS, INTRO_SPEAKER_AR, FOUNDER_SIGN, INTRO_GREET_FALLBACK, introImg, introSnd, type IntroScene } from '../../../lib/kids/intro';
import { nameClip } from '../../../lib/kids/names';
import { luluPose } from '../../../lib/kids/types';

export type IntroMode = 'child' | 'parents' | 'facilitator';
const TITLE: Record<IntroMode, string> = { child: 'رسالة لؤلؤ', parents: 'كيف يصنع بَيان أثرًا', facilitator: 'دليل اللقاء الأسبوعيّ' };
export function BayanIntro({ mode, name, onDone, onSkip }: { mode: IntroMode; name?: string; onDone: () => void; onSkip?: () => void }) {
  const scenes: IntroScene[] = mode === 'child' ? INTRO_CHILD : mode === 'facilitator' ? INTRO_FACILITATORS : INTRO_PARENTS;
  const [started, setStarted] = useState(false);
  const [si, setSi] = useState(0);
  const [li, setLi] = useState(0);
  const [lit, setLit] = useState(0);
  const [ended, setEnded] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scene = scenes[si]; const line = scene.lines[li];
  const clear = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; if (audio.current) { audio.current.pause(); audio.current.onended = null; audio.current = null; } }, []);

  const advance = useCallback(() => {
    if (li + 1 < scene.lines.length) { setLi(li + 1); return; }
    if (si + 1 < scenes.length) { setSi(si + 1); setLi(0); setLit(0); return; }
    setEnded(true);
  }, [li, si, scene, scenes]);

  // تشغيل السطر الحالي
  useEffect(() => {
    if (!started || ended) return;
    clear();
    const playMain = () => {
      const a = new Audio(introSnd(line.audio)); audio.current = a;
      a.onended = () => timers.current.push(setTimeout(advance, 450));
      a.onerror = () => timers.current.push(setTimeout(advance, 3500));
      a.play().catch(() => timers.current.push(setTimeout(advance, 3500)));
    };
    if (line.greet) {
      // «أَهْلًا يا (اسم)!» بصوت لؤلؤ من البنك، وإلّا «أَهْلًا بِكْ!»
      const g = new Audio((name && nameClip(name)) || introSnd(INTRO_GREET_FALLBACK)); audio.current = g;
      g.onended = () => timers.current.push(setTimeout(playMain, 150)); g.onerror = playMain;
      g.play().catch(playMain);
    } else playMain();
    if (scene.icons) scene.icons.forEach((ic, i) => timers.current.push(setTimeout(() => setLit(i + 1), ic.at * 1000)));
    return clear; /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [started, si, li, ended]);
  useEffect(() => () => clear(), [clear]);

  const skip = () => { clear(); (onSkip || onDone)(); };
  const finish = () => { clear(); onDone(); };
  const isLulu = scene.img === 'lulu';
  const n = scenes.length;

  return (
    <div className={`bi bi-${mode}`} dir="rtl" role="dialog" aria-label={TITLE[mode]}>
      <style dangerouslySetInnerHTML={{ __html: INTRO_CSS }} />
      {!started && (
        <div className="bi-cover">
          <img src={luluPose('wave')} alt="" width={140} height={140} />
          {mode === 'child'
            ? <><h1>{name ? `يا ${name}!` : 'يا صَديقي!'}</h1><p>عِنْدي لَكَ رِسالَةٌ قَصيرَةْ… اِسْمَعْها مَعَ ماما أَوْ بابا.</p><button className="bi-big" onClick={() => setStarted(true)}>اِفْتَحِ الرِّسالَةَ 💌</button></>
            : mode === 'facilitator'
              ? <><h1>دليل اللقاء الأسبوعيّ</h1><p>ثلاث دقائق بصوت جدّ سالم — دورك، وما تراه وما لا تراه، وعشرون دقيقة في أربع خطوات.</p><button className="bi-big" onClick={() => setStarted(true)}>شاهِد ▶</button></>
              : <><h1>كيف يصنع بَيان أثرًا؟</h1><p>ثلاث دقائق بصوت جدّ سالم — ما نفعله، ولماذا دوركم في البيت هو الأهمّ.</p><button className="bi-big" onClick={() => setStarted(true)}>شاهِدوا ▶</button></>}
          <button className="bi-skip" onClick={skip}>{mode === 'child' ? 'لاحِقًا' : 'إغلاق'}</button>
        </div>
      )}
      {started && (
        <div className="bi-stage" key={scene.key}>
          <div className={`bi-art ${isLulu ? 'is-lulu' : ''}`}>
            {isLulu ? <img className="bi-lulu" src={luluPose(line.pose || 'cheer')} alt="" /> : <img className="bi-img" src={introImg(scene.img)} alt="" />}
            {scene.icons && <ul className="bi-icons">{scene.icons.map((ic, i) => <li key={ic.label} className={i < lit ? 'on' : ''}><span>{ic.icon}</span><small>{ic.label}</small></li>)}</ul>}
          </div>
          <div className="bi-text" key={line.audio}>
            {scene.title && <h2>{scene.title}</h2>}
            <p className="bi-who"><img src={luluPose(line.who === 'lulu' ? (line.pose || 'wave') : 'calm')} alt="" style={{ visibility: line.who === 'lulu' ? 'visible' : 'hidden' }} /><b>{INTRO_SPEAKER_AR[line.who]}:</b></p>
            <p className="bi-say">{mode === 'child' && si === 0 && name ? line.text.replace('أَهْلًا بِكْ!', `أَهْلًا يا ${name}!`) : line.text}</p>
            {ended && scene.written && <div className="bi-written"><h3>كلمة المؤسّس</h3>{scene.written.split('\n').map((par, i) => <p key={i}>{par}</p>)}<small>{FOUNDER_SIGN}</small></div>}
          </div>
          <footer className="bi-bar">
            <ol className="bi-dots" aria-label="المشاهد">{scenes.map((s, i) => <li key={s.key} className={i === si ? 'on' : i < si ? 'ok' : ''} />)}</ol>
            {!ended && <button className="bi-skip" onClick={skip}>{mode === 'child' ? 'تَخَطّي ◀' : 'تخطّي'}</button>}
            {!ended && <button className="bi-ghost" onClick={() => { clear(); advance(); }}>التّالي</button>}
            {ended && <button className="bi-big" onClick={finish}>{mode === 'child' ? 'هَيّا بِنا! ☀️' : mode === 'facilitator' ? 'إلى ورقة اللقاء 📋' : 'ابدؤوا اليوم 🌱'}</button>}
          </footer>
          <span className="bi-count" aria-hidden>{si + 1}/{n}</span>
        </div>
      )}
    </div>
  );
}

export const INTRO_CSS = `
.bi{position:fixed;inset:0;z-index:130;background:radial-gradient(1200px 600px at 50% -10%,#fff 0%,#FBF4EE 60%);color:#2A1626;font-family:var(--font-read,var(--font-ar,sans-serif));display:flex;align-items:center;justify-content:center;overflow:auto}
.bi *{box-sizing:border-box}
.bi-cover{text-align:center;max-width:560px;padding:24px;animation:bi-in .5s ease-out}
.bi-cover h1{font-size:34px;color:#3A1F36;margin:8px 0}.bi-cover p{font-size:19px;line-height:1.8;color:#5b4a57;margin:0 0 18px}
.bi-big{display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:999px;border:0;background:#E8795C;color:#fff;font:inherit;font-size:22px;font-weight:800;cursor:pointer;box-shadow:0 8px 20px rgba(232,121,92,.35)}
.bi-ghost{padding:10px 18px;border-radius:999px;border:2px solid #F1D9A8;background:#fff;color:#3A1F36;font:inherit;font-size:16px;cursor:pointer}
.bi-skip{display:block;margin:14px auto 0;background:none;border:0;color:#8E7F8A;font:inherit;font-size:15px;cursor:pointer;text-decoration:underline}
.bi-stage{width:min(960px,100%);min-height:100%;display:grid;grid-template-rows:auto 1fr auto;padding:12px 14px 18px;position:relative}
.bi-art{position:relative;border-radius:24px;overflow:hidden;background:#F1D9A8;aspect-ratio:16/9;box-shadow:0 12px 30px rgba(58,31,54,.12)}
.bi-img{width:100%;height:100%;object-fit:cover;display:block;animation:bi-kb 14s ease-in-out infinite alternate}
.bi-art.is-lulu{background:linear-gradient(180deg,#7FC8E8,#FBF4EE);display:flex;align-items:center;justify-content:center}
.bi-lulu{width:min(46vh,320px);animation:bi-bob 1.6s ease-in-out infinite}
.bi-icons{position:absolute;inset:auto 0 10px 0;display:flex;justify-content:center;gap:10px;margin:0;padding:0 10px;list-style:none}
.bi-icons li{display:flex;flex-direction:column;align-items:center;gap:2px;background:rgba(255,255,255,.55);border-radius:16px;padding:6px 10px;opacity:.35;transform:scale(.9);transition:all .35s}
.bi-icons li.on{opacity:1;transform:scale(1.08);background:#fff;box-shadow:0 4px 14px rgba(58,31,54,.18)}
.bi-icons span{font-size:28px}.bi-icons small{font-size:12px;color:#3A1F36;font-weight:700}
.bi-text{padding:14px 6px 6px;animation:bi-in .45s ease-out}
.bi-text h2{margin:0 0 6px;font-size:20px;color:#5EA8A0}
.bi-who{display:flex;align-items:center;gap:8px;margin:0 0 4px;color:#E8795C;font-size:16px}.bi-who img{width:34px;height:34px}
.bi-say{margin:0;font-size:24px;line-height:1.9;color:#2A1626}
.bi-parents .bi-say{font-size:20px}
.bi-written{margin-top:16px;background:#fff;border:2px solid #F1D9A8;border-radius:18px;padding:14px 16px;animation:bi-in .6s ease-out}
.bi-written h3{margin:0 0 6px;font-size:16px;color:#5EA8A0}.bi-written p{margin:0 0 10px;font-size:17px;line-height:1.95;text-align:justify}.bi-written p:last-of-type{margin-bottom:0}.bi-written small{display:block;margin-top:8px;color:#8E7F8A}
.bi-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:10px;flex-wrap:wrap}
.bi-bar .bi-skip{margin:0}
.bi-dots{display:flex;gap:6px;margin:0;padding:0;list-style:none}.bi-dots li{width:10px;height:10px;border-radius:50%;background:#F1D9A8}.bi-dots li.on{background:#E8795C;transform:scale(1.25)}.bi-dots li.ok{background:#5EA8A0}
.bi-count{position:absolute;top:18px;left:22px;background:rgba(255,255,255,.8);border-radius:999px;padding:2px 10px;font-size:13px;color:#3A1F36}
@keyframes bi-kb{from{transform:scale(1)}to{transform:scale(1.06)}}
@keyframes bi-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes bi-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bi-img,.bi-lulu{animation:none}}
@media (max-width:640px){.bi-say{font-size:20px}.bi-cover h1{font-size:28px}}
`;
