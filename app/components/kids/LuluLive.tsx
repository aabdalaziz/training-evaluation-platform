'use client';
/* بَيان (هـ-6-ج) — «لؤلؤ الحيّة»: آلة حالات من 8 حالات فوق وضعيات ورقة النموذج المعتمدة (/kids/lulu/*.png)
 * ساكنة (تتنفّس) · تتكلّم (قفزات متزامنة مع شدّة صوتها عبر --ll-amp) · تنتظر (إمالة + «…») · تلمّح · تفكّر · تحتفل (+نثار)
 * تشجّع · ترقص · تهدأ (الحديث والقرآن: صامتة وبلا حركة). الحركات CSS فقط — بلا مكتبات؛ وتُعطَّل مع prefers-reduced-motion. */
import { luluPose, type LuluPose } from '../../../lib/kids/types';

export type LuluState = 'idle' | 'listen' | 'talk' | 'wait' | 'hint' | 'think' | 'cheer' | 'encourage' | 'dance' | 'calm';

export function LuluLive({ pose, state, say, size = 150 }: { pose: LuluPose; state: LuluState; say: string; size?: number }) {
  const quiet = state === 'calm';
  return (
    <div className={`ll ll-${state}`} aria-live="polite" style={{ ['--ll-size' as string]: `${size}px` }}>
      {say && !quiet && <div className="ll-bubble">{say}</div>}
      {state === 'wait' && <div className="ll-dots" aria-hidden><i /><i /><i /></div>}
      <div className="ll-fig">
        {state === 'cheer' && <div className="ll-confetti" aria-hidden>{Array.from({ length: 10 }, (_, i) => <b key={i} style={{ ['--i' as string]: i }} />)}</div>}
        <img src={luluPose(quiet ? 'calm' : pose)} alt="لؤلؤ" width={size} height={size} draggable={false} />
      </div>
    </div>
  );
}

/** الوضعية المناسبة لكل حالة إن لم تُحدَّد وضعية صريحة */
export const POSE_FOR: Record<LuluState, LuluPose> = {
  idle: 'wave', listen: 'wave', talk: 'wave', wait: 'think', hint: 'point', think: 'think', cheer: 'cheer', encourage: 'wave', dance: 'dance', calm: 'calm',
};

export const LULU_CSS = `
.ll{position:fixed;bottom:8px;inset-inline-start:8px;z-index:6;display:flex;align-items:flex-end;gap:6px;pointer-events:none;--ll-amp:0}
.ll-fig{position:relative;width:var(--ll-size);height:var(--ll-size);transform-origin:50% 100%;filter:drop-shadow(0 8px 10px rgba(58,31,54,.22))}
.ll-fig img{width:100%;height:100%;object-fit:contain;display:block;user-select:none}
.ll-bubble{background:#fff;border:2px solid #F1D9A8;border-radius:18px 18px 18px 4px;padding:10px 14px;font-size:19px;max-width:min(60vw,420px);box-shadow:0 6px 20px rgba(58,31,54,.12);line-height:1.7;margin-bottom:28px;animation:ll-pop .25s ease-out}
.ll-dots{position:absolute;bottom:calc(var(--ll-size) - 10px);inset-inline-start:calc(var(--ll-size) * .62);background:#fff;border:2px solid #F1D9A8;border-radius:999px;padding:6px 10px;display:flex;gap:4px}
.ll-dots i{width:8px;height:8px;border-radius:50%;background:#E8795C;animation:ll-dot 1.2s infinite}.ll-dots i:nth-child(2){animation-delay:.2s}.ll-dots i:nth-child(3){animation-delay:.4s}
@keyframes ll-dot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-5px);opacity:1}}
@keyframes ll-pop{from{transform:scale(.8);opacity:0}to{transform:scale(1);opacity:1}}
/* ساكنة: تنفّس */
.ll-idle .ll-fig{animation:ll-breathe 3.2s ease-in-out infinite}
@keyframes ll-breathe{0%,100%{transform:scaleY(1) scaleX(1)}50%{transform:scaleY(1.03) scaleX(.99)}}
/* تُصغي لغيرها: إيماء بطيء */
.ll-listen .ll-fig{animation:ll-nod 2.6s ease-in-out infinite}
@keyframes ll-nod{0%,100%{transform:rotate(0)}30%{transform:rotate(3deg) translateY(1px)}60%{transform:rotate(-2deg)}}
/* تتكلّم: القفزة تتبع شدّة الصوت */
.ll-talk .ll-fig{transform:translateY(calc(var(--ll-amp) * -16px)) scaleY(calc(1 + var(--ll-amp) * .10)) scaleX(calc(1 - var(--ll-amp) * .04));transition:transform .07s linear}
/* تنتظر: إمالة رأس */
.ll-wait .ll-fig{animation:ll-tilt 1.8s ease-in-out infinite}
@keyframes ll-tilt{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
/* تلمّح: تميل نحو الشاشة */
.ll-hint .ll-fig{animation:ll-lean 1.1s ease-in-out infinite}
@keyframes ll-lean{0%,100%{transform:translateX(0) rotate(0)}50%{transform:translateX(-10px) rotate(-8deg)}}
/* تفكّر: تمايل */
.ll-think .ll-fig{animation:ll-sway 2.4s ease-in-out infinite}
@keyframes ll-sway{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}
/* تحتفل: قفزات + نثار */
.ll-cheer .ll-fig{animation:ll-jump .55s ease-out 3}
@keyframes ll-jump{0%{transform:translateY(0) scaleY(1)}30%{transform:translateY(-34px) scaleY(1.06)}60%{transform:translateY(0) scaleY(.94)}80%{transform:translateY(-8px)}100%{transform:translateY(0)}}
.ll-confetti{position:absolute;inset:0;pointer-events:none}
.ll-confetti b{position:absolute;left:50%;top:40%;width:9px;height:9px;border-radius:2px;background:#E8795C;animation:ll-conf 1.1s ease-out forwards;animation-delay:calc(var(--i) * .05s)}
.ll-confetti b:nth-child(2n){background:#5EA8A0;border-radius:50%}.ll-confetti b:nth-child(3n){background:#F1D9A8}.ll-confetti b:nth-child(4n){background:#7FC8E8}.ll-confetti b:nth-child(5n){background:#3A1F36}
@keyframes ll-conf{0%{transform:translate(0,0) rotate(0);opacity:1}100%{transform:translate(calc((var(--i) - 5) * 22px),calc(-90px - (var(--i) * 7px))) rotate(calc(var(--i) * 80deg));opacity:0}}
/* تشجّع: هزّة لطيفة */
.ll-encourage .ll-fig{animation:ll-wiggle .7s ease-in-out 2}
@keyframes ll-wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}
/* ترقص */
.ll-dance .ll-fig{animation:ll-dance .8s ease-in-out infinite}
@keyframes ll-dance{0%,100%{transform:translateY(0) rotate(-8deg)}25%{transform:translateY(-10px) rotate(0)}50%{transform:translateY(0) rotate(8deg)}75%{transform:translateY(-10px) rotate(0)}}
/* تهدأ (القرآن والحديث): صامتة، باهتة قليلًا، بلا حركة */
.ll-calm .ll-fig{opacity:.75;filter:drop-shadow(0 4px 6px rgba(58,31,54,.15)) saturate(.8)}
@media (max-width:700px){.ll{--ll-size:96px!important}.ll-bubble{font-size:16px;max-width:66vw;margin-bottom:16px}}
@media (prefers-reduced-motion:reduce){.ll .ll-fig{animation:none!important;transform:none!important;transition:none!important}}
`;
