'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-6-و «بَيْتُ بَيان» — منطقة لعب الطفل /kids/play/[child]
 *  1) بوّابة الكبار: سؤال حسابي بسيط (لا رمز يُنسى) ثم اختيار الجلسة — في جلسة وليّ الأمر نفسه (لا حساب للطفل).
 *  2) ثمّ BayanSession بوضع الطفل: كنيته وجنسه من البذرة، التعرّف على الصوت بأمانة speech_recog، النصّ بأمانة save_text،
 *     ونتيجة الجلسة تُبلَّغ إلى /api/kids {action:'progress'} (لا صوت ولا صورة أبدًا).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import BayanSession, { type KidChild } from './BayanSession';
import { BayanIntro } from './BayanIntro';
import { api } from './ParentHome';
import { SESSIONS, getSession } from '../../../lib/kids/sessions';
import { adultGate, checkGate, STAGE_AR, type ConsentKind, type Stage } from '../../../lib/kids/parent';

type Child = { id: string; nick: string; gender: 'm' | 'f'; avatar: string; intro_seen_at?: string | null; stage: Stage; finished: number; consents: Record<ConsentKind, boolean>; next: { slug: string; world: string; order: number }; progress: { session: string; finished_at: string | null }[] };

export function KidPlay({ childId }: { childId: string }) {
  const sp = useSearchParams();
  const [child, setChild] = useState<Child | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [unauth, setUnauth] = useState(false);
  const [gate, setGate] = useState(() => adultGate());
  const [ans, setAns] = useState('');
  const [wrong, setWrong] = useState(0);
  const [open, setOpen] = useState(false);
  const [slug, setSlug] = useState<string | null>(null);
  const [sent, setSent] = useState<'idle' | 'ok' | 'err'>('idle');
  const [intro, setIntro] = useState<'auto' | 'force' | 'off'>('auto');
  const lastRef = useRef<string>('');

  useEffect(() => { (async () => {
    const j = await api(`/api/kids?child=${encodeURIComponent(childId)}`);
    if (j.unauth) { setUnauth(true); return; }
    if (!j.success || !j.children?.[0]) { setErr(j.error || 'الطفل غير موجود'); return; }
    setChild(j.children[0]); const want = sp?.get('s'); setSlug(want && getSession(want) ? want : j.children[0].next.slug);
  })(); }, [childId, sp]);

  const tryGate = () => { if (checkGate(gate, ans)) { setOpen(true); setWrong(0); } else { setWrong(w => w + 1); setAns(''); setGate(adultGate(Date.now() + wrong * 13)); } };

  /** التبليغ: تجميع الحمولة (upsert في الخادم بمفتاح الطفل/الجلسة/البداية) — صامت للطفل، مع مؤشّر صغير للكبار */
  const report = useCallback(async (p: Record<string, unknown>) => {
    const key = JSON.stringify(p); if (key === lastRef.current) return; lastRef.current = key;
    const j = await api('/api/kids', { action: 'progress', child: childId, ...p });
    setSent(j.success ? 'ok' : 'err');
  }, [childId]);

  if (unauth) return <Shell><h1>بَيْتُ بَيان</h1><p>هذه الصفحة لوليّ الأمر صاحب البذرة.</p><Link className="by-big" href={`/login?next=${encodeURIComponent(`/kids/play/${childId}`)}`}>دخول وليّ الأمر</Link></Shell>;
  if (err) return <Shell><h1>عذرًا</h1><p>{err}</p><Link className="by-ghost" href="/kids/parent">إلى بَيْتُ بَيان</Link></Shell>;
  if (!child || !slug) return <Shell><p className="kp-wait">لحظة… نوقظ لؤلؤ 🦜</p></Shell>;

  /** «رسالة لؤلؤ» (افتتاحية بَيان): أوّل مرّة تلقائيًّا بعد بوّابة الكبار، وتُعاد من «قصّتنا» */
  const introDone = () => { setIntro('off'); if (!child?.intro_seen_at) { api('/api/kids', { action: 'intro', child: childId }).catch(() => {}); setChild(c => c ? { ...c, intro_seen_at: new Date().toISOString() } : c); } };
  if (!open) {
    const doneSlugs = new Set(child.progress.filter(p => p.finished_at).map(p => p.session));
    return (
      <Shell>
        <p className="kp-eyebrow">بَيْتُ بَيان · بوّابة الكبار</p>
        <h1>{child.avatar} {STAGE_AR[child.stage]} {child.nick}</h1>
        <p className="kp-note">قبل أن تسلّم الجهاز ل{child.gender === 'f' ? 'ها' : 'ه'}: اختر الجلسة، وأجب عن سؤال الكبار. لا يُرسَل صوت ولا صورة إلى أَثَر؛ التعرّف على الصوت {child.consents.speech_recog ? 'مفعَّل بأمانتكم' : 'مطفأ (فعِّله من الأمانات إن شئت)'}.</p>
        <div className="kp-pick" role="radiogroup" aria-label="الجلسة">
          {SESSIONS.map(S => <button key={S.slug} role="radio" aria-checked={slug === S.slug} className={`kp-opt ${slug === S.slug ? 'on' : ''}`} onClick={() => setSlug(S.slug)}>
            <b>الجلسة {S.meta.order}: «في {S.meta.world}»</b><small>حرف {S.meta.letterName} · {S.meta.minutes} دقيقة{doneSlugs.has(S.slug) ? ' · مكتملة ✓' : S.slug === child.next.slug ? ' · التالية 🌱' : ''}</small>
          </button>)}
        </div>
        <label className="kp-gate">كم يساوي <b dir="ltr">{gate.q}</b>؟
          <input inputMode="numeric" value={ans} onChange={e => setAns(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') tryGate(); }} aria-label="جواب سؤال الكبار" autoFocus />
        </label>
        {wrong > 0 && <p className="kp-wrong">ليس هذا — جرّب سؤالًا آخر.</p>}
        <div className="kp-row">
          <button className="by-big" onClick={tryGate} disabled={!ans.trim()}>سَلِّمِ الجهازَ ل{child.gender === 'f' ? 'ها' : 'ه'} ▶</button>
          <Link className="by-ghost" href={`/kids/parent/${child.id}`}>رجوع إلى البذرة</Link>
          <button className="by-ghost" onClick={() => { setIntro('force'); setOpen(true); }}>قِصَّتُنا 📖</button>
        </div>
      </Shell>
    );
  }

  if (intro === 'force' || (intro === 'auto' && !child.intro_seen_at)) return <BayanIntro mode="child" name={child.nick} onDone={introDone} onSkip={introDone} />;
  const S = getSession(slug)!;
  const kid: KidChild = { id: child.id, nick: child.nick, gender: child.gender, consents: { speech_recog: !!child.consents.speech_recog, save_text: !!child.consents.save_text }, exitHref: `/kids/parent/${child.id}`, playHref: s => `/kids/play/${child.id}?s=${s}`, report };
  return <>
    <BayanSession key={S.slug} session={S} child={kid} />
    <span className={`kp-dot ${sent}`} aria-live="polite" title={sent === 'ok' ? 'وصلت النتيجة إلى بَيْتُ بَيان' : sent === 'err' ? 'لم تصل النتيجة' : ''} />
    <style dangerouslySetInnerHTML={{ __html: KIDPLAY_CSS }} />
  </>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="kpl" dir="rtl"><style dangerouslySetInnerHTML={{ __html: KIDPLAY_CSS }} /><section className="kpl-card">{children}</section></div>;
}

export const KIDPLAY_CSS = `
.kpl{min-height:100vh;background:radial-gradient(1200px 600px at 50% -10%,#fff 0%,#FBF4EE 60%);color:#2A1626;font-family:var(--font-read,var(--font-ar,sans-serif));display:flex;align-items:flex-start;justify-content:center;padding:28px 14px 80px}
.kpl-card{width:min(640px,100%);background:#fff;border:2px solid #F1D9A8;border-radius:24px;padding:24px 22px;box-shadow:0 10px 30px rgba(58,31,54,.08)}
.kpl h1{margin:4px 0 8px;font-size:28px;color:#3A1F36}
.kpl .kp-eyebrow{margin:0;font-size:13px;color:#8E7F8A;letter-spacing:.3px}
.kpl .kp-note{font-size:15px;line-height:1.8;color:#5b4a57;margin:0 0 14px}
.kpl .kp-pick{display:grid;gap:10px;margin:8px 0 16px}
.kpl .kp-opt{display:flex;flex-direction:column;gap:4px;text-align:right;padding:12px 14px;border-radius:16px;border:2px solid #F1D9A8;background:#FBF4EE;cursor:pointer;font:inherit;color:inherit}
.kpl .kp-opt.on{border-color:#5EA8A0;background:#eaf6f4}
.kpl .kp-opt small{color:#6f5f6b;font-size:13px}
.kpl .kp-gate{display:flex;align-items:center;gap:12px;font-size:20px;margin:8px 0}
.kpl .kp-gate input{width:96px;font-size:24px;padding:8px 10px;border-radius:12px;border:2px solid #F1D9A8;text-align:center;font-family:inherit}
.kpl .kp-wrong{color:#b8432c;margin:0 0 8px;font-size:14px}
.kpl .kp-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px}
.kpl .kp-wait{font-size:20px;text-align:center;margin:20px 0}
.kpl .by-big{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 22px;border-radius:999px;border:0;background:#E8795C;color:#fff;font:inherit;font-size:18px;font-weight:700;cursor:pointer;text-decoration:none}
.kpl .by-big:disabled{opacity:.5;cursor:not-allowed}
.kpl .by-ghost{display:inline-flex;align-items:center;padding:10px 16px;border-radius:999px;border:2px solid #F1D9A8;background:#fff;color:#3A1F36;font:inherit;font-size:15px;text-decoration:none}
.kp-dot{position:fixed;bottom:10px;left:10px;width:10px;height:10px;border-radius:50%;background:transparent;z-index:9}
.kp-dot.ok{background:#5EA8A0}.kp-dot.err{background:#b8432c}
`;
