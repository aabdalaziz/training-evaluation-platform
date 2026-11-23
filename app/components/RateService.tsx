'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «تقييم الخدمة» (هـ-1/4) — بطاقة واحدة لكلّ خدمات أَثَر: نجوم ١–٥ + وسوم + كلمة قصيرة.
 *  · تُرسل إلى /api/ratings (بحساب Bearer أو برمز نتيجة مِعيار code=) · تتذكّر تقييمك وتسمح بتعديله
 *  · بعد الإرسال: شكر مختصر وتنقلب البطاقة (Flip أَثَر) · صامتة تمامًا إن فشل الخادم (لا تُعطّل الصفحة)
 */
import { useEffect, useState } from 'react';
import { RATING_TAGS, STAR_WORDS, SERVICE_AR, type RatingService } from '../../lib/portal/ratings';

type Props = { service: RatingService; refId?: string; code?: string; token?: string | null; title?: string; context?: Record<string, string>; compact?: boolean; onDone?: (stars: number) => void };

export default function RateService({ service, refId = '', code, token, title, context, compact = false, onDone }: Props) {
  const [stars, setStars] = useState(0); const [hover, setHover] = useState(0); const [tags, setTags] = useState<string[]>([]); const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'edit'>('idle'); const [thanks, setThanks] = useState(''); const [err, setErr] = useState('');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }; if (token) headers.Authorization = `Bearer ${token}`;
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const q = new URLSearchParams({ mine: '1', service, ref: refId }); if (code) q.set('code', code); const r = await fetch(`/api/ratings?${q}`, { headers, cache: 'no-store' }); const j = await r.json(); if (alive && j?.mine) { setStars(j.mine.stars); setTags(j.mine.tags || []); setComment(j.mine.comment || ''); setState('done'); setThanks('تقييمك محفوظ — يمكنك تعديله.'); } } catch { /* صامت */ }
    })(); return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, refId, code, token]);

  async function send() {
    if (!stars || state === 'busy') return; setState('busy'); setErr('');
    try {
      const r = await fetch('/api/ratings', { method: 'POST', headers, body: JSON.stringify({ service, ref_id: refId, stars, tags, comment, context, code }) }); const j = await r.json();
      if (!j?.ok) { setErr(j?.error === 'sign_in_or_code' ? 'سجّل الدخول لتقييم الخدمة.' : 'تعذّر الحفظ الآن — حاول لاحقًا.'); setState('idle'); return; }
      setThanks(j.thanks || 'شكرًا.'); setState('done'); onDone?.(stars);
    } catch { setErr('تعذّر الاتصال.'); setState('idle'); }
  }
  const shown = hover || stars; const tagList = stars ? RATING_TAGS.filter((t) => (stars >= 4 ? t.tone === 'up' : stars <= 2 ? t.tone === 'down' : true)) : [];
  return (
    <section className={`rs ${compact ? 'compact' : ''} ${state === 'done' ? 'done' : ''}`} dir="rtl" data-testid={`rate-${service}`} aria-label="تقييم الخدمة">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rs-card">
        <div className="rs-face rs-front">
          <header><span className="rs-k">تقييم الخدمة</span><h4>{title || `كيف كانت تجربتك مع ${SERVICE_AR[service]}؟`}</h4></header>
          <div className="rs-stars" role="radiogroup" aria-label="النجوم" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} — ${STAR_WORDS[n]}`} className={n <= shown ? 'on' : ''} onMouseEnter={() => setHover(n)} onFocus={() => setHover(n)} onClick={() => setStars(n)} data-testid={`rate-star-${n}`}>★</button>)}
            <span className="rs-word" aria-live="polite">{shown ? STAR_WORDS[shown] : ''}</span>
          </div>
          {stars > 0 && <div className="rs-more">
            <div className="rs-tags">{tagList.map((t) => <button key={t.key} type="button" className={tags.includes(t.key) ? 'on' : ''} onClick={() => setTags((s) => s.includes(t.key) ? s.filter((x) => x !== t.key) : s.length < 5 ? [...s, t.key] : s)}>{t.ar}</button>)}</div>
            {!compact && <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 300))} placeholder="كلمة قصيرة (اختياري)…" rows={2} maxLength={300} />}
            <div className="rs-act"><button type="button" className="rs-send" onClick={send} disabled={state === 'busy'} data-testid="rate-send">{state === 'busy' ? 'يُحفظ…' : 'أرسل التقييم'}</button>{err && <span className="rs-err" role="alert">{err}</span>}</div>
          </div>}
        </div>
        <div className="rs-face rs-back" aria-hidden={state !== 'done'}>
          <div className="rs-thanks"><span className="rs-big">{'★'.repeat(stars)}<i>{'★'.repeat(5 - stars)}</i></span><p>{thanks}</p><button type="button" onClick={() => setState('edit')} className="rs-edit">تعديل</button></div>
        </div>
      </div>
    </section>
  );
}

const CSS = `
.rs{margin:18px 0;perspective:1200px}
.rs-card{position:relative;transition:transform .7s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d;min-height:120px}
.rs.done .rs-card{transform:rotateY(180deg)}
.rs-face{backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:18px;border:1px solid #EADFD6;background:#FBF4EE;padding:16px 18px;box-shadow:0 10px 28px rgba(42,22,38,.06)}
.rs-back{position:absolute;inset:0;transform:rotateY(180deg);display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#3A1F36,#6A3350);color:#FBF4EE;border-color:transparent}
.rs-k{font-size:11px;font-weight:900;color:#8A5A1E;letter-spacing:.04em}.rs header h4{margin:2px 0 8px;font-size:15.5px;color:#2A1626}
.rs-stars{display:flex;align-items:center;gap:4px}.rs-stars button{font-size:30px;line-height:1;background:none;border:0;color:#D9CBC2;cursor:pointer;padding:2px;transition:transform .25s cubic-bezier(.2,.8,.2,1),color .2s}
.rs-stars button.on{color:#D9A866;text-shadow:0 2px 10px rgba(217,168,102,.45)}.rs-stars button:hover{transform:scale(1.18) rotate(-8deg)}
.rs-word{margin-inline-start:10px;font-size:13px;font-weight:800;color:#6A3350;min-width:70px}
.rs-more{margin-top:10px;animation:rsIn .45s cubic-bezier(.2,.8,.2,1)}
.rs-tags{display:flex;flex-wrap:wrap;gap:6px}.rs-tags button{border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:4px 11px;font-size:12.5px;font-weight:700;color:#5C4858;cursor:pointer;transition:all .2s}.rs-tags button.on{background:#3A1F36;color:#FBF4EE;border-color:#3A1F36}
.rs textarea{display:block;width:100%;margin-top:10px;border:1px solid #EADFD6;border-radius:12px;padding:8px 10px;font:inherit;font-size:13px;background:#fff;resize:vertical}
.rs-act{display:flex;align-items:center;gap:10px;margin-top:10px}.rs-send{background:#D4614A;color:#fff;border:0;border-radius:999px;padding:8px 18px;font-weight:900;font-size:13.5px;cursor:pointer;transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}.rs-send:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(212,97,74,.35)}.rs-send:disabled{opacity:.6}
.rs-err{font-size:12.5px;color:#B9544A;font-weight:700}
.rs-thanks{text-align:center}.rs-big{font-size:26px;color:#D9A866;letter-spacing:2px}.rs-big i{font-style:normal;color:rgba(251,244,238,.25)}.rs-thanks p{margin:6px 0 8px;font-size:14px;font-weight:700}
.rs-edit{background:transparent;color:#FBF4EE;border:1px solid rgba(251,244,238,.5);border-radius:999px;padding:4px 14px;font-size:12px;cursor:pointer}
.rs.compact .rs-face{padding:12px 14px}.rs.compact .rs-stars button{font-size:24px}
@keyframes rsIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.rs-card{transition:none}.rs-more{animation:none}}
`;
