'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * هـ-3 ن «محطّات» — عدّة التدفّق لأدوات التقييم والاستبيان: شاشة لكل محور بدل النموذج الطولي.
 *  FlowShell: الغلاف + الرأس (علامة أَثَر · عنوان · سطر البرنامج · زرّ اللغة)
 *  Stations : شريط المحطّات (مكتمل/جارٍ/لم يبدأ/ينقصه) + نسبة التقدّم — الضغط ينقل إلى محطّة سبق بلوغها
 *  FlowNav  : السابق/التالي/إرسال + «المحور i من n» + رسالة الخطأ الموضعية
 *  FLOW_CSS : الهوية الواحدة (fl-*) — بطاقات، حقول، مقاييس، أقراص اختيار؛ أهداف لمس ≥ 44px
 *  لا يعرف شيئًا عن البيانات: الصفحة تملك الحالة والتحقّق، والعدّة تملك الشكل والحركة.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../../lib/ui/icons';

export type FlowLang = 'ar' | 'en' | 'fr'; /* P89: فرنسيّة */
export type StationState = 'done' | 'part' | 'todo' | 'miss';
export type Station = { key: string; title: string; hint?: string; state: StationState; done?: number; total?: number; optional?: boolean };

const T = {
  stepOf: { ar: (i: number, n: number) => `المحور ${i} من ${n}`, en: (i: number, n: number) => `Step ${i} of ${n}`, fr: (i: number, n: number) => `Étape ${i} sur ${n}` },
  next: { ar: 'التالي', en: 'Next', fr: 'Suivant' }, back: { ar: 'السابق', en: 'Back', fr: 'Précédent' }, start: { ar: 'ابدأ', en: 'Start', fr: 'Commencer' },
  submit: { ar: 'إرسال الإجابات', en: 'Submit answers', fr: 'Envoyer les réponses' }, sending: { ar: 'جارٍ الإرسال…', en: 'Submitting…', fr: 'Envoi…' },
  journey: { ar: 'محطّات الاستبيان', en: 'Survey stations', fr: 'Étapes du questionnaire' }, progress: { ar: 'التقدّم', en: 'Progress', fr: 'Progression' },
  optional: { ar: 'اختياري', en: 'Optional', fr: 'Facultatif' }, missing: { ar: 'ينقصه إلزامي', en: 'Required missing', fr: 'Obligatoire manquant' },
};
const LANG_NAME: Record<FlowLang, string> = { ar: 'العربية', en: 'English', fr: 'Français' };

export function FlowShell({ lang, kicker, title, sub, line, langs, onLang, children, testid }: {
  lang: FlowLang; kicker: ReactNode; title: ReactNode; sub?: ReactNode; line?: ReactNode;
  langs?: boolean | FlowLang[]; /* P89: true = عربي/إنجليزي · مصفوفة = الأزرار المطلوبة (مثل ['fr','ar','en']) */ onLang?: ((l: FlowLang) => void) | ((l: 'ar' | 'en') => void); /* P89: الصفحات القديمة ذات ar/en تمرّ بلا تغيير (لا تعرض زرّ fr) */ children: ReactNode; testid?: string;
}) {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  return (
    <main className="fl" dir={dir} lang={lang} data-testid={testid}>
      <style dangerouslySetInnerHTML={{ __html: FLOW_CSS }} />
      <div className="fl-wrap">
        <header className="fl-head">
          <div className="fl-brand"><img src="/brand/athar-mark.svg" alt="أَثَر" width={34} height={34} /><span>أَثَر</span></div>
          <div className="fl-kicker">{kicker}</div>
          <h1 className="fl-title">{title}</h1>
          {sub && <p className="fl-sub">{sub}</p>}
          {line && <div className="fl-line">{line}</div>}
          {langs && onLang && (
            <div className="fl-langs" role="group" aria-label="Language">
              {(Array.isArray(langs) ? langs : (['ar', 'en'] as FlowLang[])).map(l => <button key={l} type="button" className={lang === l ? 'on' : ''} onClick={() => (onLang as (x: FlowLang) => void)(l)} data-testid={`fl-lang-${l}`}>{LANG_NAME[l]}</button>)}
            </div>
          )}
        </header>
        {children}
      </div>
    </main>
  );
}

export function Stations({ lang, stations, index, reached, onGo, testid = 'fl-stations', chipTestid = 'fl-chip' }: {
  lang: FlowLang; stations: Station[]; index: number; reached: number; onGo: (i: number) => void; testid?: string; chipTestid?: string;
}) {
  const totalQ = stations.reduce((a, s) => a + (s.total || 0), 0);
  const doneQ = stations.reduce((a, s) => a + (s.done || 0), 0);
  const pct = totalQ ? Math.round(100 * doneQ / totalQ) : Math.round(100 * index / Math.max(1, stations.length - 1));
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); }, [index]);
  return (
    <nav className="fl-st" aria-label={T.journey[lang]} data-testid={testid}>
      <div className="fl-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={T.progress[lang]}><i style={{ width: `${pct}%` }} /></div>
      <ol className="fl-chips" ref={ref}>
        {stations.map((s, i) => {
          const cur = i === index; const can = i <= reached;
          return (
            <li key={s.key}>
              <button type="button" className={`fl-chip ${s.state}${cur ? ' cur' : ''}`} disabled={!can} aria-current={cur ? 'step' : undefined}
                data-testid={`${chipTestid}-${i}`} title={s.state === 'miss' ? T.missing[lang] : s.hint}
                onClick={() => can && onGo(i)}>
                <i>{s.state === 'done' && !cur ? <Icon name="check" size={12} /> : i + 1}</i>
                <span>{s.title}</span>
                {typeof s.total === 'number' && s.total > 0 && <b>{s.done}/{s.total}</b>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function StepCard({ n, title, hint, optional, lang, children, id, miss }: { n?: number; title: ReactNode; hint?: ReactNode; optional?: boolean; lang: FlowLang; children: ReactNode; id?: string; miss?: boolean }) {
  return (
    <section className={`fl-card fl-step${miss ? ' miss' : ''}`} id={id} data-testid="fl-step">
      <h2 className="fl-h2">{typeof n === 'number' && <span className="fl-n">{n}</span>}<span className="fl-h2t">{title}{optional && <em className="fl-opt">{T.optional[lang]}</em>}</span></h2>
      {hint && <p className="fl-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function FlowNav({ lang, index, count, onPrev, onNext, onSubmit, saving, error, first, last, nextLabel, submitLabel }: {
  lang: FlowLang; index: number; count: number; onPrev: () => void; onNext: () => void; onSubmit?: () => void;
  saving?: boolean; error?: ReactNode; first?: boolean; last?: boolean; nextLabel?: ReactNode; submitLabel?: ReactNode;
}) {
  return (
    <div className="fl-nav" data-testid="fl-nav">
      {error && <div className="fl-err" role="alert" data-testid="fl-err"><Icon name="alert" size={16} /><span>{error}</span></div>}
      <div className="fl-nav-row">
        <button type="button" className="fl-btn ghost" onClick={onPrev} disabled={!!first || !!saving} data-testid="fl-prev"><Icon name={lang === 'ar' ? 'arrow' : 'next'} size={16} /> {T.back[lang]}</button>
        <span className="fl-count" aria-live="polite">{T.stepOf[lang](index + 1, count)}</span>
        {last && onSubmit
          ? <button type="button" className="fl-btn primary" onClick={onSubmit} disabled={!!saving} data-testid="fl-submit" aria-busy={saving || undefined}><Icon name="send" size={16} /> {saving ? T.sending[lang] : (submitLabel || T.submit[lang])}</button>
          : <button type="button" className="fl-btn primary" onClick={onNext} disabled={!!saving} data-testid="fl-next">{nextLabel || T.next[lang]} <Icon name={lang === 'ar' ? 'next' : 'arrow'} size={16} /></button>}
      </div>
    </div>
  );
}

/** تمرير إلى أعلى المحطّة عند تغيّرها — ولا حركة مع prefers-reduced-motion */
export function useStepScroll(index: number) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [index]);
}

export const FLOW_CSS = `
.fl{min-height:100vh;background:#F6EBE0;color:#2A1626;font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;padding:16px 12px 56px}
.fl *{box-sizing:border-box}
.fl-wrap{max-width:760px;margin:0 auto}
.fl-head{text-align:center;padding:10px 6px 14px}
.fl-brand{display:inline-flex;align-items:center;gap:8px;font-weight:900;color:#3A1F36;font-size:15px;letter-spacing:.2px}
.fl-brand img{width:34px;height:34px;display:block}
.fl-kicker{display:inline-flex;align-items:center;gap:6px;margin:12px auto 8px;background:#F3E8EF;color:#6A3350;font-weight:800;font-size:12px;padding:5px 12px;border-radius:999px}
.fl-title{margin:0;font-size:clamp(19px,3.4vw,24px);font-weight:900;color:#3A1F36;line-height:1.45}
.fl-sub{margin:6px auto 0;max-width:600px;color:#5C4858;font-size:14px;line-height:1.8;font-weight:600}
.fl-line{display:inline-flex;align-items:center;gap:6px;margin-top:10px;color:#2F6B66;background:#E6F3F1;border:1px solid #BFE1DC;border-radius:999px;padding:5px 12px;font-weight:800;font-size:13px}
.fl-langs{display:inline-flex;margin-top:12px;border:1px solid #D9CBC2;border-radius:999px;background:#fff;overflow:hidden}
.fl-langs button{border:0;background:transparent;padding:8px 16px;font:inherit;font-weight:800;color:#5C4858;cursor:pointer;min-height:40px}
.fl-langs button.on{background:#3A1F36;color:#fff}
.fl-st{position:sticky;top:0;z-index:5;margin:0 -4px 14px;padding:10px 4px 8px;background:rgba(246,235,224,.94);backdrop-filter:blur(6px)}
.fl-bar{height:6px;border-radius:999px;background:#EADFD6;overflow:hidden}
.fl-bar i{display:block;height:100%;background:linear-gradient(90deg,#D4614A,#D9A866);border-radius:999px;transition:width .4s ease}
.fl-chips{list-style:none;margin:10px 0 0;padding:0 2px 4px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none}
.fl-chips::-webkit-scrollbar{display:none}
.fl-chip{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid #EADFD6;background:#fff;border-radius:999px;padding:7px 12px 7px 7px;font:inherit;font-weight:800;font-size:12.5px;color:#4A3645;cursor:pointer;min-height:40px}
[dir=rtl] .fl-chip{padding:7px 7px 7px 12px}
.fl-chip i{width:24px;height:24px;border-radius:50%;display:inline-grid;place-items:center;background:#F6EBE0;color:#8E7F8A;font-style:normal;font-size:12px;font-weight:900;flex:0 0 auto}
.fl-chip b{font-size:11px;color:#8E7F8A;font-weight:800}
.fl-chip.done i{background:#5EA8A0;color:#fff}.fl-chip.part i{background:#F1D9A8;color:#8A5A1E}
.fl-chip.miss{border-color:#F3C4B6;background:#FBEDE7;color:#9A3A2A}.fl-chip.miss i{background:#D4614A;color:#fff}
.fl-chip.cur{border-color:#3A1F36;background:#3A1F36;color:#fff;box-shadow:0 6px 16px rgba(42,22,38,.18)}.fl-chip.cur i{background:#D4614A;color:#fff}.fl-chip.cur b{color:#F1D9A8}
.fl-chip:disabled{cursor:default;opacity:.55}
.fl-card{background:#fff;border:1px solid #EADFD6;border-radius:22px;padding:22px 20px;box-shadow:0 10px 30px rgba(42,22,38,.05);margin-bottom:14px;animation:fl-in .32s ease both}
@keyframes fl-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.fl-card{animation:none}.fl-bar i{transition:none}}
.fl-card.miss{border-color:#F3C4B6}
.fl-h2{display:flex;align-items:flex-start;gap:10px;margin:0 0 6px;font-size:18px;font-weight:900;color:#3A1F36;line-height:1.5}
.fl-n{width:30px;height:30px;border-radius:10px;display:inline-grid;place-items:center;background:#3A1F36;color:#F1D9A8;font-size:14px;flex:0 0 auto}
.fl-h2t{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.fl-opt{font-style:normal;font-size:11px;font-weight:800;color:#8A5A1E;background:#FBF4EE;border:1px solid #F1D9A8;border-radius:999px;padding:2px 9px}
.fl-hint{margin:0 0 16px;color:#8E7F8A;font-size:13.5px;font-weight:600;line-height:1.7}
.fl-intro p{margin:0 0 10px;line-height:1.9;font-size:15px;font-weight:600;color:#4A3645}
.fl-anon{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:10px 12px;background:#E6F3F1;border:1px solid #BFE1DC;border-radius:12px;color:#2F6B66;font-size:13px;font-weight:700;line-height:1.6}
.fl-meta{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.fl-meta span{display:inline-flex;align-items:center;gap:6px;background:#FBF4EE;border:1px solid #EADFD6;border-radius:999px;padding:5px 11px;font-size:12.5px;font-weight:800;color:#5C4858}
.fl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media (max-width:600px){.fl-grid{grid-template-columns:1fr}}
.fl-field{display:flex;flex-direction:column;gap:6px;font-weight:800;font-size:14px;color:#3A1F36}
.fl-field.span{grid-column:1/-1}
.fl-field small{font-weight:600;color:#8E7F8A;font-size:12px}
.fl-field input,.fl-field select,.fl-field textarea{width:100%;min-height:46px;border:1px solid #D9CBC2;border-radius:12px;padding:10px 12px;font:inherit;font-size:15px;color:#2A1626;background:#fff}
.fl-field textarea{min-height:96px;resize:vertical;line-height:1.7}
.fl-field input:focus,.fl-field select:focus,.fl-field textarea:focus{outline:none;border-color:#D4614A;box-shadow:0 0 0 3px rgba(212,97,74,.18)}
.fl-field input:disabled,.fl-field select:disabled{background:#FBF4EE;color:#B3A5AE}
.fl-field.invalid input,.fl-field.invalid select,.fl-field.invalid textarea{border-color:#D4614A;background:#FBEDE7}
.fl-req{color:#D4614A}
.fl-q{padding:14px 0;border-top:1px solid #F3E6DC}
.fl-q:first-of-type{border-top:0;padding-top:4px}
.fl-q.miss{background:#FBEDE7;margin:0 -12px;padding-inline:12px;border-radius:12px;border-top-color:transparent}
.fl-qt{display:flex;gap:10px;align-items:flex-start;font-weight:800;font-size:15px;line-height:1.65;color:#2A1626;margin-bottom:10px}
.fl-qn{min-width:26px;height:26px;border-radius:8px;display:inline-grid;place-items:center;background:#FBF4EE;border:1px solid #EADFD6;color:#8A5A1E;font-size:12px;font-weight:900;flex:0 0 auto}
.fl-qen{color:#8E7F8A;font-size:13px;font-weight:600;margin:-6px 0 10px 36px;line-height:1.6}
[dir=rtl] .fl-qen{margin:-6px 36px 10px 0}
.fl-pills{display:flex;flex-wrap:wrap;gap:8px}
.fl-pill{border:1px solid #D9CBC2;background:#fff;border-radius:999px;padding:10px 16px;font:inherit;font-weight:800;font-size:14px;color:#3A1F36;cursor:pointer;min-height:44px;display:inline-flex;align-items:center;gap:8px}
.fl-pill:hover{border-color:#6A3350}
.fl-pill.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.fl-pill .fl-k{width:20px;height:20px;border-radius:50%;border:2px solid #D9CBC2;display:inline-grid;place-items:center;flex:0 0 auto}
.fl-pill.on .fl-k{border-color:#D9A866;background:#D9A866;color:#3A1F36}
.fl-pill.on .fl-k svg{color:#3A1F36}
.fl-pill.multi .fl-k{border-radius:6px}
.fl-scale{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.fl-scale button{border:1px solid #D9CBC2;background:#fff;border-radius:12px;padding:9px 4px;font:inherit;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;color:#3A1F36;min-height:56px}
.fl-scale button b{font-size:16px;font-weight:900}
.fl-scale button small{font-size:10.5px;font-weight:700;color:#8E7F8A;line-height:1.2;text-align:center}
.fl-scale button.on{background:#3A1F36;border-color:#3A1F36;color:#fff}
.fl-scale button.on small{color:#F1D9A8}
.fl-scale button.na{grid-column:1/-1;flex-direction:row;justify-content:center;min-height:40px;background:#FBF4EE;border-style:dashed}
.fl-scale button.na small{display:inline;font-size:12.5px;color:#5C4858;font-weight:800}.fl-scale button.na.on small{color:#fff}
.fl-legend{display:none;grid-column:1/-1;justify-content:space-between;color:#8E7F8A;font-size:11.5px;font-weight:700;margin-top:4px}
.fl-scale button.na.on{background:#8E7F8A;border-color:#8E7F8A;border-style:solid}
.fl-scale.six{grid-template-columns:repeat(5,minmax(0,1fr))}
@media (max-width:480px){.fl-scale{grid-template-columns:repeat(5,minmax(0,1fr))}.fl-scale button:not(.na) small{display:none}.fl-scale button{min-height:46px}.fl-legend{display:flex}}
.fl-nps{display:flex;flex-wrap:wrap;gap:6px}
.fl-nps button{width:calc((100% - 60px)/11);min-width:40px;height:44px;border:1px solid #D9CBC2;background:#fff;border-radius:10px;font:inherit;font-weight:900;cursor:pointer;color:#3A1F36}
.fl-nps button.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.fl-nps-l{display:flex;justify-content:space-between;width:100%;color:#8E7F8A;font-size:11.5px;font-weight:700;margin-top:4px}
.fl-text{width:100%;min-height:46px;border:1px solid #D9CBC2;border-radius:12px;padding:10px 12px;font:inherit;font-size:15px}
textarea.fl-text{min-height:100px;line-height:1.7;resize:vertical}
.fl-text:focus{outline:none;border-color:#D4614A;box-shadow:0 0 0 3px rgba(212,97,74,.18)}
.fl-nav{position:sticky;bottom:0;z-index:4;margin:0 -12px -56px;padding:10px 12px 14px;background:linear-gradient(180deg,rgba(246,235,224,0),#F6EBE0 30%)}
.fl-nav-row{max-width:760px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px}
.fl-count{font-size:12.5px;font-weight:800;color:#8E7F8A;white-space:nowrap}
.fl-btn{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 20px;border-radius:14px;border:1px solid #D9CBC2;background:#fff;font:inherit;font-weight:900;font-size:15px;color:#3A1F36;cursor:pointer}
.fl-btn.primary{background:#D4614A;border-color:#D4614A;color:#fff;box-shadow:0 8px 20px rgba(212,97,74,.28)}
.fl-btn.primary:hover{background:#B9544A}
.fl-btn.ghost{background:transparent}
.fl-btn:disabled{opacity:.5;cursor:default;box-shadow:none}
.fl-btn.wide{width:100%;justify-content:center;min-height:54px;font-size:16px}
.fl-err{max-width:760px;margin:0 auto 10px;display:flex;gap:8px;align-items:flex-start;background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A;border-radius:12px;padding:10px 12px;font-size:13.5px;font-weight:700;line-height:1.6;white-space:pre-line}
.fl-msg{display:flex;gap:8px;align-items:flex-start;border-radius:12px;padding:10px 12px;font-size:13.5px;font-weight:700;line-height:1.6;margin-bottom:12px;white-space:pre-line}
.fl-msg.warn{background:#FBF4EE;border:1px solid #F1D9A8;color:#8A5A1E}.fl-msg.bad{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A}.fl-msg.ok{background:#E6F3F1;border:1px solid #BFE1DC;color:#2F6B66}
.fl-center{text-align:center;padding:36px 20px}
.fl-ok{width:64px;height:64px;border-radius:50%;display:inline-grid;place-items:center;background:#E6F3F1;color:#2F6B66;margin-bottom:12px}
.fl-ok.off{background:#FBF4EE;color:#8A5A1E}
.fl-center h2{margin:0 0 6px;font-size:20px;color:#3A1F36}
.fl-muted{color:#8E7F8A;font-weight:600}
.fl-lock{display:flex;flex-direction:column;gap:4px;background:#FBF4EE;border:1px solid #F1D9A8;border-radius:16px;padding:12px 14px;margin-bottom:14px}
.fl-lock-k{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:800;color:#8A5A1E}
.fl-lock-t{font-weight:900;color:#3A1F36;font-size:15px}
.fl-lock-m{font-size:12.5px;color:#5C4858;font-weight:700}
.fl-review{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.fl-review li{list-style:none;display:flex;justify-content:space-between;gap:10px;background:#FBF4EE;border:1px solid #EADFD6;border-radius:12px;padding:9px 12px;font-size:13.5px;font-weight:700}
.fl-review li b{color:#2F6B66}.fl-review li b.bad{color:#9A3A2A}
.fl-review ul{margin:0;padding:0}
`;
