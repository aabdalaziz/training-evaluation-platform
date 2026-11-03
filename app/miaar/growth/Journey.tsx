'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «رحلة المتقدّم» — /miaar/growth/<ML-code> (م5-ب)
 *  على الرمز نفسه الذي يحمل بطاقته: محاولاته على سُلّم واحد، والمقارنة «الاختبار الأول بتاريخ… والثاني بتاريخ…»،
 *  وما استجدّ من «أستطيع»، وحكم النموّ بميزان خطأ القياس — ثم «شهادة النموّ» إن أصدرها إنسان، و«ختم النموّ» باختيار صاحبه.
 *  لا اسم كامل ولا بريد: الاسم الأول فقط. لا فهرسة.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import WayBar from '../../components/WayBar';
import { Icon } from '../../../lib/ui/icons';

type Lv = 'PRE_A1' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
type Attempt = { code: string | null; taken_at: string; attempt: number; demonstrated: Lv; entry: Lv; percent: number | null; n_items: number; confidence: string; archived: boolean; skills: { skill: string; label: string; percent: number; answered: number }[] };
type Cmp = { first: { code: string | null; taken_at: string; level: Lv; percent: number | null; n: number }; second: { code: string | null; taken_at: string; level: Lv; percent: number | null; n: number }; steps: number; percent_diff: number | null; se_diff: number | null; z: number | null; days: number; verdict: 'confirmed' | 'likely' | 'within' | 'decline'; skills: { skill: string; label: string; a: number | null; b: number | null; diff: number | null }[]; gained: { level: string; statements: string[] }[]; sentence: string };
type Journey = { name: string; code: string; count: number; latest: Attempt; attempts: Attempt[]; comparison: Cmp | null; since_first: Cmp | null; certificate: { code: string; url: string } | null; public: boolean; ladder: { level: Lv; label: string; points: number[] }[] };

const LEVELS: Lv[] = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LV_AR: Record<Lv, string> = { PRE_A1: 'ما قبل A1', A1: 'A1', A2: 'A2', B1: 'B1', B2: 'B2', C1: 'C1', C2: 'C2' };
const LV_NAME: Record<Lv, [string, string]> = { PRE_A1: ['قبل البداية', 'Pre-A1'], A1: ['مبتدئ', 'Beginner'], A2: ['أساسي', 'Elementary'], B1: ['متوسط', 'Intermediate'], B2: ['فوق المتوسط', 'Upper-intermediate'], C1: ['متقدم', 'Advanced'], C2: ['إتقان', 'Mastery'] };
const VERDICT: Record<Cmp['verdict'], { ar: [string, string]; en: [string, string]; tone: string }> = {
  confirmed: { ar: ['نموّ مؤكَّد', 'الفرق أكبر من ضعف خطأ القياس المشترك، أو ارتقيتَ درجةً كاملة على السُّلّم بفرق إيجابي واضح.'], en: ['Confirmed growth', 'The difference exceeds twice the pooled standard error, or you climbed a full band with a clear positive gain.'], tone: 'ok' },
  likely: { ar: ['نموّ محتمل', 'الفرق إيجابي ويتجاوز خطأ القياس مرّة واحدة؛ يُستحسن دليل بشري (كتابة أو تحدّث) قبل التثبيت.'], en: ['Likely growth', 'Positive and beyond one standard error; a human-rated writing or speaking sample is advised before certifying.'], tone: 'mid' },
  within: { ar: ['ضمن خطأ القياس', 'الفرق أصغر من هامش الخطأ؛ لا يصحّ وصفه نموًّا ولا تراجعًا — وهذا أمانة القياس لا تقصير منك.'], en: ['Within measurement error', 'The difference is smaller than the error margin; it is neither growth nor decline — that is measurement honesty, not a failing.'], tone: 'flat' },
  decline: { ar: ['تراجع ملحوظ', 'النتيجة الثانية أدنى بفارق يتجاوز خطأ القياس — راجع ظروف الجلسة (الوقت، الانقطاع، الجهاز).'], en: ['Noticeable decline', 'The second sitting is lower beyond the error margin — review the sitting conditions (time, interruptions, device).'], tone: 'down' },
};
const T = {
  ar: { title: 'رحلتك في مِعيار', k: 'رحلة المتقدّم · مِعيار من أَثَر', attempts: 'محاولات', one: 'محاولة واحدة', only: 'لك محاولة واحدة حتى الآن — حين تعود بعد فترة تعلّم ستظهر المقارنة هنا على السُّلّم نفسه.', ladder: 'السُّلّم', from: 'البداية', to: 'الآن', verdict: 'حكم النموّ', diff: 'فرق النسبة', se: 'خطأ الفرق', z: 'المسافة بالأخطاء', days: 'الأيام بين الاختبارين', gained: 'ما استجدّ من «أستطيع»', skills: 'المهارات: قبل → بعد', timeline: 'كل المحاولات', card: 'البطاقة', cert: 'شهادة النموّ', certHave: 'صدرت لك شهادة نموّ موقَّعة من إنسان', verify: 'تحقّق منها', certCan: 'نموّك مؤهّل لشهادة نموّ موقَّعة — تُصدرها الجهة التي اختبرتك (إنسان، لا نظام).', certNo: 'لا تصدر شهادة نموّ لفرق يقع ضمن خطأ القياس — وهذا يحمي قيمة الشهادة حين تستحقّها.', seal: 'ختم النموّ', sealOn: 'نموّك يظهر في «نبض مِعيار» العلني بلا اسم ولا بريد — رقمٌ ضمن مجموعة.', sealOff: 'نموّك خاصّ بك. يمكنك إظهاره كرقم مجهول في «نبض مِعيار» لتشجيع غيرك.', sealBtnOn: 'أظهِر نموّي (بلا اسم)', sealBtnOff: 'أخفِ نموّي', share: 'نسخة للمشاركة', copied: 'نُسخت', print: 'طباعة', back: 'بطاقتي', since: 'منذ أول محاولة', pct: 'النسبة', entry: 'الالتحاق', nf: 'لا رحلة بهذا الرمز.', loading: 'نقرأ رحلتك…', footer: '«مِعيار — من أَثَر» · © 2026 د. أحمد محمد عبدالعزيز بدوي', steps: (n: number) => (n === 1 ? 'درجة واحدة' : n === 2 ? 'درجتان' : `${n} درجات`), up: 'ارتقاء', down: 'نزول', same: 'المستوى نفسه', items: 'بندًا' },
  en: { title: 'Your Miaar journey', k: 'Candidate journey · Miaar by Athar', attempts: 'sittings', one: 'one sitting', only: 'You have one sitting so far — when you return after a period of learning, the comparison will appear here on the same scale.', ladder: 'The scale', from: 'Start', to: 'Now', verdict: 'Growth verdict', diff: 'Score difference', se: 'SE of difference', z: 'Distance in SEs', days: 'Days between sittings', gained: 'Newly achieved “can-do”', skills: 'Skills: before → after', timeline: 'All sittings', card: 'Card', cert: 'Growth certificate', certHave: 'A human-issued, signed growth certificate was issued to you', verify: 'Verify', certCan: 'Your growth qualifies for a signed certificate — issued by the institution that tested you (a human, not a system).', certNo: 'No growth certificate is issued for a difference within measurement error — this protects its value when you earn it.', seal: 'Growth seal', sealOn: 'Your growth appears in the public “Miaar pulse” without name or email — a number within a group.', sealOff: 'Your growth is private. You may show it as an anonymous number in the “Miaar pulse” to encourage others.', sealBtnOn: 'Show my growth (anonymous)', sealBtnOff: 'Hide my growth', share: 'Copy for sharing', copied: 'Copied', print: 'Print', back: 'My card', since: 'Since first sitting', pct: 'Score', entry: 'Entry', nf: 'No journey for this code.', loading: 'Reading your journey…', footer: 'Miaar — by Athar · © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi', steps: (n: number) => (n === 1 ? 'one band' : `${n} bands`), up: 'up', down: 'down', same: 'same level', items: 'items' },
};
const day = (iso: string, lang: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' }); };
const idx = (l: Lv) => LEVELS.indexOf(l);

export default function Journey({ code, fontClass = '' }: { code: string; fontClass?: string }) {
  const [lang, setLang] = useState<'ar' | 'en'>('ar'); const t = T[lang]; const ar = lang === 'ar';
  const [j, setJ] = useState<Journey | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  useEffect(() => { try { const q = new URLSearchParams(window.location.search).get('lang'); if (q === 'en') setLang('en'); } catch { /* لا شيء */ } }, []);
  const load = useCallback(async () => { try { const r = await fetch(`/api/miaar?journey=${encodeURIComponent(code)}`, { cache: 'no-store' }); const d = await r.json(); if (!r.ok || !d.ok) { setErr(t.nf); return; } setJ(d.journey); } catch { setErr(t.nf); } }, [code, t.nf]);
  useEffect(() => { void load(); }, [load]);
  const cmp = j?.comparison || null; const v = cmp ? VERDICT[cmp.verdict] : null;
  const shareText = useMemo(() => { if (!j || !cmp) return ''; return ar ? `${cmp.steps > 0 ? `ارتقيتُ من ${LV_AR[cmp.first.level]} إلى ${LV_AR[cmp.second.level]}` : `أعدتُ قياس مستواي (${LV_AR[cmp.second.level]})`} خلال ${cmp.days} يومًا — ${v!.ar[0]} · مِعيار من أَثَر` : `${cmp.steps > 0 ? `I moved from ${cmp.first.level} to ${cmp.second.level}` : `I re-measured my level (${cmp.second.level})`} in ${cmp.days} days — ${v!.en[0]} · Miaar by Athar`; }, [j, cmp, ar, v]);
  const toggleSeal = async () => { if (!j || busy) return; setBusy(true); try { const r = await fetch('/api/miaar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'growth_public', code, on: !j.public }) }); const d = await r.json(); if (d.ok) setJ({ ...j, public: !!d.public }); } finally { setBusy(false); } };
  const copy = async () => {
    let done = false; try { await navigator.clipboard.writeText(shareText); done = true; } catch { /* حافظة غير متاحة → الطريقة القديمة */ }
    if (!done) { try { const ta = document.createElement('textarea'); ta.value = shareText; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); done = document.execCommand('copy'); document.body.removeChild(ta); } catch { done = false; } }
    if (!done) { try { window.prompt(ar ? 'انسخ النص:' : 'Copy the text:', shareText); } catch { /* لا شيء */ } }
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };
  const startIdx = cmp ? idx(cmp.first.level) : j ? idx(j.latest.demonstrated) : 0; const endIdx = cmp ? idx(cmp.second.level) : startIdx;

  return <div className={`mg ${fontClass}`} dir={ar ? 'rtl' : 'ltr'} lang={lang} data-testid="mg-page">
    <div className="mg-top"><header className="mg-head"><div className="mg-brandside"><a className="mg-brand" href="/">أَثَر<small>{ar ? 'بوابة التميّز للاستشارات والتدريب' : 'Athar · TRACE'}</small></a><a className="mg-mark" href="/miaar">مِعيار</a></div>
      <div className="mg-left"><button type="button" className="mg-lang" onClick={() => setLang(ar ? 'en' : 'ar')} data-testid="mg-lang">{ar ? 'English' : 'العربية'}</button></div></header><WayBar lang={lang} /></div>
    {!j && !err && <p className="mg-wait" role="status">{t.loading}</p>}
    {err && <section className="mg-wrap"><div className="mg-card"><p className="mg-err" role="alert" data-testid="mg-nf">{err}</p><a className="mg-btn" href="/miaar">{ar ? 'إلى مِعيار' : 'Go to Miaar'}</a></div></section>}
    {j && <>
      <section className="mg-band"><p className="mg-kicker">{t.k}</p><h1 data-testid="mg-name">{t.title} · {j.name}</h1>
        <p className="mg-lead" data-testid="mg-count">{j.count === 1 ? t.one : `${j.count} ${t.attempts}`}{cmp ? ` · ${cmp.steps > 0 ? `${t.up} ${t.steps(cmp.steps)}` : cmp.steps < 0 ? `${t.down} ${t.steps(Math.abs(cmp.steps))}` : t.same}` : ''}</p></section>
      <div className="mg-wrap">
        {cmp && <p className="mg-sentence" data-testid="mg-sentence">{ar ? cmp.sentence : `First sitting on ${cmp.first.taken_at.slice(0, 10)} (${cmp.first.level}${cmp.first.percent !== null ? ` · ${cmp.first.percent}%` : ''}) and second on ${cmp.second.taken_at.slice(0, 10)} (${cmp.second.level}${cmp.second.percent !== null ? ` · ${cmp.second.percent}%` : ''}) — ${v!.en[0]}.`}</p>}
        {!cmp && <p className="mg-sentence soft" data-testid="mg-only">{t.only}</p>}

        <div className="mg-card">
          <h2>{t.ladder}</h2>
          <ol className="mg-ladder" data-testid="mg-ladder">{LEVELS.map((l, i) => { const pts = j.ladder.find((x) => x.level === l)?.points || []; const isStart = cmp && i === startIdx; const isEnd = i === endIdx; const between = cmp && ((i > startIdx && i < endIdx) || (i < startIdx && i > endIdx));
            return <li key={l} className={`mg-rung${isEnd ? ' now' : ''}${isStart ? ' start' : ''}${between ? ' path' : ''}${pts.length ? ' hit' : ''}`} data-testid={`mg-rung-${l}`} data-points={pts.join(',')}><b>{LV_AR[l]}</b><span>{LV_NAME[l][ar ? 0 : 1]}</span>{pts.length > 0 && <em aria-label={ar ? `المحاولات ${pts.join('، ')}` : `Sittings ${pts.join(', ')}`}>{pts.map((p) => <i key={p}>{p}</i>)}</em>}{isStart && <small>{t.from}</small>}{isEnd && <small className="now">{t.to}</small>}</li>; })}</ol>
        </div>

        {cmp && v && <div className={`mg-card mg-verdict ${v.tone}`} data-testid="mg-verdict" data-verdict={cmp.verdict}>
          <h2>{t.verdict}</h2><p className="mg-vtitle">{ar ? v.ar[0] : v.en[0]}</p><p className="mg-vnote">{ar ? v.ar[1] : v.en[1]}</p>
          <div className="mg-nums"><div><span>{t.diff}</span><b dir="ltr">{cmp.percent_diff === null ? '—' : `${cmp.percent_diff > 0 ? '+' : ''}${cmp.percent_diff}`}</b></div><div><span>{t.se}</span><b dir="ltr">{cmp.se_diff ?? '—'}</b></div><div><span>{t.z}</span><b dir="ltr">{cmp.z ?? '—'}</b></div><div><span>{t.days}</span><b dir="ltr">{cmp.days}</b></div></div>
          {j.since_first && <p className="mg-since">{t.since}: {LV_AR[j.since_first.first.level]} → {LV_AR[j.since_first.second.level]} · {ar ? VERDICT[j.since_first.verdict].ar[0] : VERDICT[j.since_first.verdict].en[0]}</p>}
        </div>}

        {cmp && cmp.gained.length > 0 && <div className="mg-card" data-testid="mg-gained"><h2>{t.gained}</h2>{cmp.gained.map((g) => <div key={g.level} className="mg-gain"><b>{g.level}</b><ul>{g.statements.map((s, i) => <li key={i}>{s}</li>)}</ul></div>)}</div>}

        {cmp && cmp.skills.length > 0 && <div className="mg-card" data-testid="mg-skills"><h2>{t.skills}</h2>
          {cmp.skills.map((s) => <div key={s.skill} className="mg-skill"><div className="mg-sk-h"><span>{s.label}</span><b dir="ltr">{s.a ?? '—'}% → {s.b ?? '—'}%{s.diff !== null && <em className={s.diff > 0 ? 'up' : s.diff < 0 ? 'down' : ''}>{s.diff > 0 ? '+' : ''}{s.diff}</em>}</b></div>
            <div className="mg-bars"><div className="mg-bar a" style={{ width: `${s.a ?? 0}%` }} /><div className="mg-bar b" style={{ width: `${s.b ?? 0}%` }} /></div></div>)}
        </div>}

        <div className="mg-card" data-testid="mg-timeline"><h2>{t.timeline}</h2>
          <ol className="mg-tl">{j.attempts.map((a) => <li key={a.attempt} className={a.code === j.code ? 'me' : ''} data-testid="mg-tl-item"><i>{a.attempt}</i><div><b>{LV_AR[a.demonstrated]}</b> · <span>{day(a.taken_at, lang)}</span>{a.percent !== null && <span> · {t.pct} {a.percent}%</span>}<span> · {t.entry} {LV_AR[a.entry]}</span>{a.archived && <span className="mg-arch">{ar ? 'مؤرشفة' : 'archived'}</span>}</div>{a.code && <a href={`/miaar/result/${a.code}`} className="mg-mini">{t.card}</a>}</li>)}</ol>
        </div>

        {cmp && <div className="mg-card" data-testid="mg-cert"><h2>{t.cert}</h2>
          {j.certificate ? <p className="mg-certok"><Icon name="check" /> {t.certHave} · <a href={j.certificate.url} data-testid="mg-cert-link">{t.verify}</a> <span dir="ltr">({j.certificate.code})</span></p>
            : cmp.verdict === 'confirmed' || cmp.verdict === 'likely' ? <p className="mg-certcan" data-testid="mg-cert-can">{t.certCan}</p> : <p className="mg-certno" data-testid="mg-cert-no">{t.certNo}</p>}
          <div className="mg-seal"><h3>{t.seal}</h3><p>{j.public ? t.sealOn : t.sealOff}</p><button type="button" className={`mg-btn${j.public ? ' ghost' : ''}`} onClick={toggleSeal} disabled={busy} aria-pressed={j.public} data-testid="mg-seal">{j.public ? t.sealBtnOff : t.sealBtnOn}</button></div>
        </div>}

        <div className="mg-actions">{cmp && <button type="button" className="mg-btn ghost" onClick={copy} data-testid="mg-share">{copied ? t.copied : t.share}</button>}<button type="button" className="mg-btn ghost" onClick={() => window.print()}>{t.print}</button><a className="mg-btn" href={`/miaar/result/${j.code}`} data-testid="mg-back">{t.back}</a></div>
        <p className="mg-foot">{t.footer}</p>
      </div>
    </>}
    <style jsx global>{`
.mg{min-height:100vh;background:#f8fafc;color:#0f172a;font-family:inherit}
.mg-top{position:sticky;top:0;z-index:20;background:rgba(255,255,255,.94);backdrop-filter:blur(8px);border-bottom:1px solid #e2e8f0}
.mg-head{max-width:1040px;margin:0 auto;padding:10px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.mg-brandside{display:flex;align-items:center;gap:12px}.mg-brand{font-weight:900;font-size:22px;color:#0f2a4e;text-decoration:none;display:flex;flex-direction:column;line-height:1.1}.mg-brand small{font-size:11px;font-weight:600;color:#64748b}
.mg-mark{font-weight:900;color:#0b8a83;text-decoration:none;border-inline-start:1px solid #e2e8f0;padding-inline-start:12px}
.mg-lang{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;font:inherit;font-weight:700;cursor:pointer;min-height:36px}
.mg-band{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;padding:34px 18px 28px}.mg-band h1{max-width:1040px;margin:4px auto 0;font-size:30px}.mg-kicker{max-width:1040px;margin:0 auto;color:#f3d98b;font-weight:800;font-size:13px;letter-spacing:.3px}.mg-lead{max-width:1040px;margin:8px auto 0;opacity:.92;font-weight:700}
.mg-wrap{max-width:1040px;margin:0 auto;padding:18px 18px 40px}
.mg-sentence{background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid #c9a24b;border-radius:14px;padding:14px 18px;font-weight:800;font-size:17px;line-height:1.8;margin:0 0 14px}.mg-sentence.soft{border-inline-start-color:#94a3b8;font-weight:600;color:#334155}
.mg-card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;margin:0 0 14px}.mg-card h2{font-size:17px;margin:0 0 12px;color:#0f2a4e}
.mg-ladder{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.mg-rung{position:relative;border:2px solid #e2e8f0;border-radius:12px;padding:12px 6px 10px;text-align:center;min-height:92px;background:#f8fafc;display:flex;flex-direction:column;align-items:center;gap:2px}.mg-rung b{font-size:18px;color:#0f2a4e}.mg-rung span{font-size:11px;color:#64748b;font-weight:700}
.mg-rung.hit{background:#fff;border-color:#cbd5e1}.mg-rung.path{background:#fdf7e6;border-color:#f3d98b}.mg-rung.start{border-color:#94a3b8;background:#f1f5f9}.mg-rung.now{border-color:#0b8a83;background:#e6f7f5;box-shadow:0 0 0 3px rgba(11,138,131,.15)}
.mg-rung em{display:flex;gap:3px;margin-top:4px}.mg-rung em i{font-style:normal;font-size:11px;font-weight:900;background:#0f2a4e;color:#fff;border-radius:999px;min-width:18px;height:18px;line-height:18px;padding:0 4px}.mg-rung.now em i:last-child{background:#0b8a83}
.mg-rung small{position:absolute;bottom:-10px;inset-inline-start:50%;transform:translateX(50%);background:#64748b;color:#fff;font-size:10px;font-weight:900;border-radius:999px;padding:1px 8px}[dir=ltr] .mg-rung small{transform:translateX(-50%)}.mg-rung small.now{background:#0b8a83}
.mg-verdict.ok{border-color:#0b8a83;background:#f0fbfa}.mg-verdict.mid{border-color:#c9a24b;background:#fffaf0}.mg-verdict.flat{border-color:#cbd5e1;background:#f8fafc}.mg-verdict.down{border-color:#e11d48;background:#fff1f2}
.mg-vtitle{font-size:24px;font-weight:900;margin:0 0 6px;color:#0f2a4e}.mg-vnote{margin:0 0 12px;color:#334155;line-height:1.8;font-weight:600}
.mg-nums{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.mg-nums div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center}.mg-nums span{display:block;font-size:12px;color:#64748b;font-weight:700}.mg-nums b{font-size:20px;color:#0f2a4e}
.mg-since{margin:12px 0 0;font-weight:700;color:#334155}
.mg-gain{display:grid;grid-template-columns:52px 1fr;gap:10px;align-items:start;margin:0 0 8px}.mg-gain b{background:#0f2a4e;color:#fff;border-radius:10px;text-align:center;padding:6px 0;font-size:15px}.mg-gain ul{margin:0;padding-inline-start:18px;line-height:1.9;font-weight:600}
.mg-skill{margin:0 0 12px}.mg-sk-h{display:flex;justify-content:space-between;font-weight:800;margin:0 0 4px}.mg-sk-h em{font-style:normal;margin-inline-start:8px;color:#64748b}.mg-sk-h em.up{color:#0b8a83}.mg-sk-h em.down{color:#e11d48}
.mg-bars{display:grid;gap:3px}.mg-bar{height:10px;border-radius:999px;min-width:4px;transition:width .4s}.mg-bar.a{background:#cbd5e1}.mg-bar.b{background:#0b8a83}
.mg-tl{list-style:none;margin:0;padding:0}.mg-tl li{display:flex;gap:10px;align-items:center;padding:10px 0;border-top:1px solid #f1f5f9;font-weight:600}.mg-tl li:first-child{border-top:0}.mg-tl li.me{background:#f0fbfa;margin:0 -8px;padding:10px 8px;border-radius:10px}.mg-tl i{font-style:normal;width:28px;height:28px;border-radius:999px;background:#0f2a4e;color:#fff;display:grid;place-items:center;font-weight:900;flex:none}.mg-tl div{flex:1;min-width:0}.mg-tl b{color:#0f2a4e}.mg-arch{background:#f1f5f9;border-radius:999px;padding:1px 8px;font-size:11px;margin-inline-start:6px;color:#334155}
.mg-mini{border:1px solid #cbd5e1;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:800;text-decoration:none;color:#0f2a4e;white-space:nowrap}
.mg-certok{color:#0b8a83;font-weight:800;line-height:1.8}.mg-certok a{color:#0f2a4e}.mg-certcan{background:#fffaf0;border:1px dashed #c9a24b;border-radius:12px;padding:12px;font-weight:700;line-height:1.8;margin:0}.mg-certno{color:#334155;font-weight:600;line-height:1.8;margin:0}
.mg-seal{margin-top:14px;padding-top:14px;border-top:1px solid #e2e8f0}.mg-seal h3{margin:0 0 4px;font-size:15px;color:#0f2a4e}.mg-seal p{margin:0 0 10px;color:#334155;font-weight:600;line-height:1.8}
.mg-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:999px;padding:9px 18px;font:inherit;font-weight:800;cursor:pointer;text-decoration:none;min-height:40px}.mg-btn.ghost{background:#fff;color:#0f2a4e}.mg-btn:disabled{opacity:.6;cursor:default}.mg-btn:focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
.mg-actions{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 18px}.mg-foot{color:#64748b;font-size:12px;font-weight:600;text-align:center}
.mg-wait{text-align:center;padding:40px;color:#64748b;font-weight:700}.mg-err{color:#e11d48;font-weight:800;margin:0 0 12px}
@media (max-width:720px){.mg-ladder{grid-template-columns:repeat(4,1fr)}.mg-nums{grid-template-columns:repeat(2,1fr)}.mg-band h1{font-size:24px}.mg-rung{min-height:84px}.mg-rung small{bottom:-9px}}
@media (max-width:420px){.mg-ladder{grid-template-columns:repeat(3,1fr)}}
@media print{.mg-top,.mg-actions,.mg-seal,.mg-mini{display:none !important}.mg-band{background:#fff !important;color:#0f172a !important;border-bottom:2px solid #0f2a4e}.mg-kicker{color:#0f2a4e !important}.mg-card{break-inside:avoid}}
    `}</style>
  </div>;
}
