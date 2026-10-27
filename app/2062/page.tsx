'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — التجربة الاستشرافية التفاعلية «/2062» (P13-أ): تختار قطاعك ودورك وعمرك، فتعيش يومًا كاملًا هناك — صباحًا يوقظك أثير بسؤال،
// قرارًا تختلف فيه الآلات وتقرّر أنت، مجلس حضور، سجلّك الموثّق للجدارات البشرية، ومساءً سؤال المعنى — ثم تعود بما تحتاجه الآن (2026).
// للمسجّلين: مؤشر جاهزيتك لذلك اليوم من ملفك الحقيقي (خريطة الجدارات الاثني عشر).
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { t } from '../../lib/portal/content';
import { SECTORS_2062, HUMAN_DOMAINS, FATE_LABEL, domainByCode, domainMap, readinessIndex, balanceIndex, hcri, indexBand } from '../../lib/portal/lexicon';
import type { SectorFate, DomainCode, DomainScore } from '../../lib/portal/lexicon';

export default function Page2062() { return <PortalShell><Inner /></PortalShell>; }

const YEAR = 2062;
const SEEDS: Record<DomainCode, { brand: string; sub: string }> = {
  purpose: { brand: 'الغاية', sub: 'اكتب حياتك قبل أن تُكتب لك' }, judgment: { brand: 'حين تختلف الآلات', sub: 'الحكم المهني واتخاذ القرار في بيئات الذكاء الاصطناعي' }, integrity: { brand: 'الممكن ليس المباح', sub: 'النزاهة المهنية والإفصاح' }, resilience: { brand: 'الصلابة الهادئة', sub: 'المرونة النفسية والذكاء العاطفي' },
  vitality: { brand: '90 دقيقة', sub: 'التركيز العميق والإنتاجية المعرفية' }, relational: { brand: 'من يشهد لك', sub: 'الجدارات العلائقية والقيادة الاجتماعية' }, language: { brand: 'العربية لغة تفكير', sub: 'الكفاءة اللغوية والتواصل المهني' }, professional: { brand: 'مدير فريقك الاصطناعي الأول', sub: 'إدارة التفويض والإشراف على الأنظمة الذكية' },
  financial: { brand: 'أن تملك ولا تُملَك', sub: 'الثقافة المالية والرشد الاقتصادي' }, civic: { brand: 'الإنسان في الحلقة', sub: 'المسؤولية المجتمعية والمواطنة الفاعلة' }, creative: { brand: 'صنعتُه بيدي', sub: 'الإبداع والابتكار والحِرفية' }, digital_sovereignty: { brand: 'من يقرّر عنك؟', sub: 'الثقافة الرقمية والسيادة على البيانات' },
};
type Stance = 'delegate' | 'decide' | 'verify';
const STANCES: { code: Stance; label: string; effect: string; hcri: number; tone: string }[] = [
  { code: 'delegate', label: 'أفوّض النظام الأعلى ثقة وأمضي', effect: 'القرار نُفّذ في ثوانٍ. بعد أسبوعين تبيّن أن أحد النظامين دُرّب على بيانات ما قبل التحوّل. السجل يقول: «قرار آلي بتوقيع بشري» — ومؤشر احتفاظك بالقدرة البشرية هبط.', hcri: -18, tone: 'warn' },
  { code: 'verify', label: 'أؤجّل ساعة: أسأل كيف دُرّب كلٌّ منهما، وأستشير طرفًا متأثرًا', effect: 'كلّفك التأجيل ساعة واجتماعًا قصيرًا. اكتشفت فجوة البيانات، وقرّرت بوضوح ووثّقت السبب. هذا ما يُدفع مقابله في 2062 — وهو ما يُقيَّد في سجلّك الموثّق.', hcri: +14, tone: 'ok' },
  { code: 'decide', label: 'أقرّر الآن بحدسي وأتحمّل', effect: 'قرار بشري شجاع، لكن بلا تحقق. أصبتَ هذه المرة، وسجلّك يقيّده «حكمًا بشريًا بلا شواهد». الشجاعة وحدها ليست جدارة؛ الشجاعة + التحقق + التوثيق هي.', hcri: +3, tone: 'navy' },
];

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [sector, setSector] = useState<SectorFate | null>(null); const [role, setRole] = useState(''); const [age, setAge] = useState(35); const [step, setStep] = useState<'pick' | 'day' | 'back'>('pick'); const [beat, setBeat] = useState(0); const [stance, setStance] = useState<Stance | null>(null);
  const [me, setMe] = useState<{ map: DomainScore[]; readiness: number; balance: number; hcri: number } | null>(null); const [tok, setTok] = useState('');
  const [clock, setClock] = useState('');
  useEffect(() => { const id = setInterval(() => { const d = new Date(); d.setFullYear(YEAR); setClock(d.toLocaleString(ar ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })); }, 1000); return () => clearInterval(id); }, [ar]);
  useEffect(() => { (async () => {
    try { const { data } = await db.auth.getSession(); const tk = data.session?.access_token || ''; setTok(tk); if (!tk) return;
      const j = await fetch('/api/profile', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'me' }) }).then(r => r.json()); if (!j?.success) return;
      const ids = Array.from(new Set((j.levels || []).map((l: any) => l.skill_id))) as string[]; const { data: sk } = ids.length ? await db.from('portal_skills').select('id,domain,domain_code').in('id', ids) : { data: [] as any[] };
      const map = domainMap(j.levels || [], new Map(((sk || []) as any[]).map(s => [s.id, { domain: s.domain, domain_code: s.domain_code }])));
      setMe({ map, readiness: readinessIndex(map), balance: balanceIndex(map), hcri: hcri(map) });
    } catch { /* ignore */ }
  })(); }, [db]);
  useEffect(() => { if (step !== 'day') return; setBeat(0); const id = setInterval(() => setBeat(b => (b < 5 ? b + 1 : b)), 1800); return () => clearInterval(id); }, [step]);
  const doms = sector ? sector.domains.map(c => domainByCode(c)!).filter(Boolean) : [];
  const ageThen = age + (YEAR - 2026);
  const stanceObj = STANCES.find(s => s.code === stance) || null;
  const myReadiness = me && sector ? Math.round(me.map.filter(m => sector.domains.includes(m.code)).reduce((s, m) => s + m.level, 0) / Math.max(1, sector.domains.length) * 20) : null;

  return (
    <main className="pt-main y62">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="y62-hero">
        <div className="pt-wrap">
          <span className="y62-clock"><i /> {clock || '…'}</span>
          <h1>{ar ? <>عِش يومك في <em>2062</em></> : <>Live your day in <em>2062</em></>}</h1>
          <p>{ar ? 'لا نتنبأ بالتقنية؛ نتنبأ بالندرة. هناك لا يُدفع لمن يعرف ولا لمن ينفّذ، بل لمن يحكم ويُشهَد له ويحضر ويمنح المعنى. اختر قطاعك ودورك — وسيوقظك أثير بسؤال.' : 'We do not predict technology; we predict scarcity. There, nobody pays for knowing or executing — only for judging, being vouched for, being present and giving meaning. Pick your sector and role — Athir will wake you with a question.'}</p>
        </div>
      </section>

      {step === 'pick' && <section className="pt-sec"><div className="pt-wrap y62-pick">
        <h2>{ar ? '1) قطاعك اليوم' : '1) Your sector today'}</h2>
        <div className="y62-chips">{SECTORS_2062.filter(s => s.kind === 'existing').map(s => <button key={s.code} className={sector?.code === s.code ? 'on' : ''} onClick={() => { setSector(s); setRole(s.roles[0]); }}>{t(s.name, lang)}<small>{t(FATE_LABEL[s.fate], lang)}</small></button>)}</div>
        <h3>{ar ? 'أو قطاع لم يُولد بعد' : 'Or a sector not born yet'}</h3>
        <div className="y62-chips new">{SECTORS_2062.filter(s => s.kind === 'new').map(s => <button key={s.code} className={sector?.code === s.code ? 'on' : ''} onClick={() => { setSector(s); setRole(s.roles[0]); }}>{t(s.name, lang)}<small>{ar ? 'مستحدث' : 'new'}</small></button>)}</div>
        {sector && <div className="y62-role">
          <h2>{ar ? '2) دورك وعمرك' : '2) Your role and age'}</h2>
          <div className="y62-chips small">{sector.roles.map(r => <button key={r} className={role === r ? 'on' : ''} onClick={() => setRole(r)}>{r}</button>)}</div>
          <label>{ar ? `عمرك الآن: ${age} — ستكون في الـ${ageThen} عام 2062` : `Your age now: ${age} — you will be ${ageThen} in 2062`}<input type="range" min={16} max={70} value={age} onChange={e => setAge(Number(e.target.value))} /></label>
          <div className="y62-waves"><div><b>2035</b><span>{sector.w2035}</span></div><div><b>2050</b><span>{sector.w2050}</span></div><div><b>2070</b><span>{sector.w2070}</span></div></div>
          <button className="pt-btn gold" onClick={() => setStep('day')}><Icon name="play" size={16} /> {ar ? 'ابدأ اليوم' : 'Start the day'}</button>
        </div>}
      </div></section>}

      {step === 'day' && sector && <section className="pt-sec navy y62-day"><div className="pt-wrap">
        <div className="y62-dayhead"><span>{ar ? `${role} · ${t(sector.name, lang)} · ${ageThen} عامًا` : `${role} · ${t(sector.name, lang)} · age ${ageThen}`}</span><button className="y62-link" onClick={() => { setStep('pick'); setStance(null); }}>{ar ? 'غيّر الاختيار' : 'Change'}</button></div>
        <ol className="y62-beats">
          <li className={beat >= 0 ? 'in' : ''}><time>06:40</time><div><b>{ar ? 'أثير يوقظك بسؤال لا بإشعار' : 'Athir wakes you with a question'}</b><p>«صباح الخير. ثلاثة قرارات تحتاج إنسانًا اليوم، والباقي أنجزته أو فوّضته ضمن حدودك: (1) {sector.decision_2062}. (2) طلب تصديق من زميل على إنجاز لم تره بعينك. (3) ابنك يسأل عن مستقبل لا تملك له جوابًا جاهزًا. بأيها نبدأ؟»</p></div></li>
          <li className={beat >= 1 ? 'in' : ''}><time>09:00</time><div><b>{ar ? `قطاعك في ${YEAR}` : `Your sector in ${YEAR}`}</b><p>{sector.w2050} — وتلوح بوادر ما بعده: {sector.w2070}. {sector.fate === 'dissolves' ? 'أغلب مهام الأمس تذوب؛ ما بقي لك هو ما لا يُنسخ.' : sector.fate === 'transforms' ? 'المهنة اسمها القديم ومضمونها جديد: تحكم أكثر وتنفّذ أقل.' : 'القطاع يزدهر لأن قيمته إنسانية: حضور، ثقة، معنى.'}</p></div></li>
          <li className={beat >= 2 ? 'in' : ''}><time>11:00</time><div><b>{ar ? 'مجلس حضور' : 'A presence council'}</b><p>اجتماع جسدي حُجز قبل شهرين. الوكلاء ينتظرون خارج الباب — بروتوكول «الغرفة البشرية». عشرون دقيقة بلا شاشة، تُقال فيها الحقيقة التي لا تُكتب في التقارير المولَّدة. من يُحسن الإصغاء هنا يُشهَد له.</p></div></li>
          <li className={beat >= 3 ? 'in' : ''}><time>13:00</time><div><b>{ar ? 'القرار: حين تختلف الآلات' : 'The decision: when the machines disagree'}</b><p>{sector.decision_2062}. على شاشتك توصيتان من نظامين معتمدين متعارضتان، والوقت ضيّق. ماذا تفعل؟</p>
            {!stance ? <div className="y62-stances">{STANCES.map(s => <button key={s.code} onClick={() => setStance(s.code)}>{s.label}</button>)}</div> : <div className={`y62-effect ${stanceObj?.tone}`}><b>{stanceObj?.label}</b><p>{stanceObj?.effect}</p><small>{ar ? 'مؤشر الاحتفاظ بالقدرة البشرية:' : 'Human capability retention:'} <i>{(stanceObj?.hcri || 0) > 0 ? '+' : ''}{stanceObj?.hcri}</i></small></div>}
          </div></li>
          <li className={beat >= 4 ? 'in' : ''}><time>16:00</time><div><b>{ar ? 'سجلّك الموثّق للجدارات البشرية («شهادة الإنسان»)' : 'Your verified human competency record'}</b><p>طلبت جهة أن ترى سجلّك قبل تكليفك. لا يحتوي درجات؛ يحتوي ما <em>حكمتَ به وشهد عليه بشر</em> عبر السنين. أقوى ما فيه لدورك:</p><div className="y62-vhcr">{doms.map(d => <span key={d.code}><b>{d.h}</b>{d.name.ar}<small>{d.scarce_2062.ar}</small></span>)}</div></div></li>
          <li className={beat >= 5 ? 'in' : ''}><time>21:00</time><div><b>{ar ? 'المساء: سؤال المعنى' : 'Evening: the question of meaning'}</b><p>الوكيل أنجز 80% من يومك. ما الذي صنعتَه أنت؟ في 2062 هذا السؤال ليس فلسفيًا؛ هو مؤشر في سجلّك وسبب لنومك هادئًا. «{domainByCode('purpose')!.question.ar}»</p><button className="pt-btn gold" onClick={() => setStep('back')}>{ar ? 'عُد إلى 2026 بما تحتاجه' : 'Return to 2026 with what you need'} <Icon name="arrow" size={14} /></button></div></li>
        </ol>
      </div></section>}

      {step === 'back' && sector && <section className="pt-sec alt"><div className="pt-wrap y62-back">
        <h2>{ar ? 'ما تحتاجه الآن (2026) لتكون ذلك الإنسان في 2062' : 'What you need now (2026) to be that person in 2062'}</h2>
        <p className="y62-lead">{ar ? `الجدارات التي تُشترى بالزمن لا بالمال — ولدورك «${role}» في ${t(sector.name, lang)} ثلاثة مجالات تبدأ منها اليوم:` : `Competencies bought with time, not money — for your role, three domains to start from today:`}</p>
        <div className="y62-needs">{doms.map(d => { const mine = me?.map.find(m => m.code === d.code); return <div key={d.code} className="y62-need"><span className="y62-h">{d.h}</span><b>{d.name.ar}</b><small>{d.scarce_2062.ar}</small>{mine && <div className="y62-bar" title={ar ? 'مستواك الآن من ملفك' : 'Your current level'}><i style={{ width: `${(mine.level / 5) * 100}%` }} /><em>{mine.level ? `${mine.level}/5` : (ar ? 'لا شواهد بعد' : 'no evidence yet')}</em></div>}<p><b>{SEEDS[d.code].brand}</b> — {SEEDS[d.code].sub}</p></div>; })}</div>
        {me ? <div className="y62-me"><div><b>{myReadiness ?? 0}%</b><span>{ar ? `جاهزيتك لهذا اليوم في ${t(sector.name, lang)}` : 'Your readiness for this day'}</span></div><div><b>{me.readiness}%</b><span>{ar ? `جاهزية المستقبل — ${indexBand(me.readiness).label.ar}` : `Future readiness — ${indexBand(me.readiness).label.en}`}</span></div><div><b>{me.balance}%</b><span>{ar ? 'اتزان الجدارات' : 'Competency balance'}</span></div><div><b>{me.hcri}%</b><span>{ar ? 'شواهد مُصدَّقة بشريًا' : 'Human-attested evidence'}</span></div><Link href="/me/map" className="pt-btn light small">{ar ? 'خريطة جداراتي الاثنتي عشرة' : 'My 12-domain map'}</Link></div>
          : <div className="y62-me guest"><p>{ar ? 'سجّل الدخول لترى جاهزيتك الحقيقية لهذا اليوم من ملفك المهني الرقمي.' : 'Sign in to see your real readiness from your digital professional profile.'}</p><Link href={tok ? '/me/map' : '/login?next=/2062'} className="pt-btn gold small">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></div>}
        <div className="y62-ctas"><Link href="/#daily" className="pt-btn gold"><Icon name="target" size={16} /> {ar ? 'ابدأ بموقف اليوم' : 'Start with today’s case'}</Link><Link href="/sim" className="pt-btn outline dark"><Icon name="play" size={16} /> {ar ? 'محاكيات القرار' : 'Judgment simulations'}</Link><Link href="/programs" className="pt-btn outline dark"><Icon name="book" size={16} /> {ar ? 'البرامج' : 'Programs'}</Link><Link href="/consulting" className="pt-btn outline dark"><Icon name="users" size={16} /> {ar ? 'للجهات: ابنوا جاهزية 2050' : 'Organizations: build 2050 readiness'}</Link></div>
        <p className="y62-foot">{ar ? 'الأطلس المرجعي لجدارات المستقبل — إصدار 2026.10 · يُراجَع كل ستة أشهر · © د. أحمد محمد عبدالعزيز بدوي' : 'Future Competency Atlas — edition 2026.10 · reviewed every six months · © Dr. Ahmed M. A. Badawi'}</p>
        <div className="y62-all"><h3>{ar ? 'المجالات الاثنا عشر لبناء الإنسان' : 'The twelve domains of human building'}</h3><div className="y62-grid12">{HUMAN_DOMAINS.map(d => <div key={d.code}><b>{d.h}</b><span>{t(d.name, lang)}</span><small>{t(d.question, lang)}</small></div>)}</div></div>
      </div></section>}
    </main>
  );
}

const CSS = `
.y62 .pt-wrap{max-width:1080px}
.y62-hero{background:radial-gradient(1200px 500px at 70% -10%,#1d4f8a 0%,#0f2a4e 55%,#09182d 100%);color:#fff;padding:120px 18px 56px;text-align:center}
.y62-hero h1{font-size:44px;margin:14px 0 10px;font-weight:900;line-height:1.3}.y62-hero h1 em{font-style:normal;color:#c9a24b}.y62-hero p{max-width:760px;margin:0 auto;font-size:16px;line-height:1.95;color:rgba(255,255,255,.85)}
.y62-clock{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:800;letter-spacing:.3px}.y62-clock i{width:8px;height:8px;border-radius:50%;background:#c9a24b;animation:y62p 1.2s infinite}@keyframes y62p{0%,100%{opacity:.3}50%{opacity:1}}
.y62-pick h2{font-size:22px;color:#0f2a4e;margin:0 0 12px}.y62-pick h3{font-size:15px;color:#0b8a83;margin:18px 0 8px}
.y62-chips{display:flex;flex-wrap:wrap;gap:8px}.y62-chips button{display:grid;text-align:start;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 14px;font:inherit;font-weight:800;color:#0f2a4e;cursor:pointer;min-width:150px}.y62-chips button small{font-weight:600;color:#64748b;font-size:11.5px}.y62-chips button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.y62-chips button.on small{color:#f1dfae}.y62-chips.new button{border-style:dashed;border-color:#c9a24b}.y62-chips.small button{min-width:0;padding:6px 12px;border-radius:999px}
.y62-role{margin-top:22px;display:grid;gap:12px}.y62-role label{font-size:14px;font-weight:800;color:#334155;display:grid;gap:6px;max-width:520px}.y62-role input[type=range]{accent-color:#0b8a83}
.y62-waves{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.y62-waves div{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;font-size:13.5px;line-height:1.8;color:#1e293b}.y62-waves b{display:block;color:#c9a24b;font-size:18px}
.y62-day{color:#fff}.y62-dayhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:18px;font-size:13.5px;color:rgba(255,255,255,.8)}.y62-link{background:none;border:0;color:#f1dfae;font:inherit;cursor:pointer;text-decoration:underline}
.y62-beats{list-style:none;margin:0;padding:0;display:grid;gap:14px}.y62-beats li{display:grid;grid-template-columns:70px 1fr;gap:14px;opacity:0;transform:translateY(10px);transition:all .7s}.y62-beats li.in{opacity:1;transform:none}.y62-beats time{font-weight:900;color:#c9a24b;font-size:18px}.y62-beats li>div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:14px 18px}.y62-beats b{display:block;font-size:16px;margin-bottom:6px}.y62-beats p{margin:0 0 8px;font-size:15px;line-height:1.95;color:rgba(255,255,255,.9)}.y62-beats em{font-style:normal;color:#f1dfae}
.y62-stances{display:grid;gap:8px}.y62-stances button{text-align:start;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.06);color:#fff;border-radius:12px;padding:10px 14px;font:inherit;font-weight:800;cursor:pointer}.y62-stances button:hover{background:#c9a24b;color:#0f2a4e;border-color:#c9a24b}
.y62-effect{border-radius:12px;padding:12px 14px;background:#fff;color:#0f172a}.y62-effect.ok{border-inline-start:6px solid #0b8a83}.y62-effect.warn{border-inline-start:6px solid #b45309}.y62-effect.navy{border-inline-start:6px solid #0f2a4e}.y62-effect b{color:#0f2a4e}.y62-effect p{color:#1e293b;font-size:14px}.y62-effect small{color:#64748b;font-weight:800}.y62-effect i{font-style:normal;color:#0f2a4e;font-size:16px}
.y62-vhcr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.y62-vhcr span{display:grid;background:#fff;color:#0f172a;border-radius:12px;padding:10px 12px;font-size:13px;font-weight:800}.y62-vhcr span b{color:#c9a24b;font-size:12px;margin:0}.y62-vhcr small{font-weight:500;color:#64748b;font-size:11.5px;line-height:1.6}
.y62-back h2{font-size:24px;color:#0f2a4e;margin:0 0 8px}.y62-lead{font-size:15px;color:#334155;line-height:1.9;margin:0 0 16px}
.y62-needs{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.y62-need{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;display:grid;gap:6px;align-content:start}.y62-h{color:#c9a24b;font-weight:900;font-size:13px}.y62-need b{font-size:15px;color:#0f2a4e}.y62-need small{color:#64748b;font-size:12.5px;line-height:1.7}.y62-need p{margin:6px 0 0;font-size:13.5px;line-height:1.7;color:#1e293b;border-top:1px dashed #e2e8f0;padding-top:8px}
.y62-bar{position:relative;height:18px;background:#f1f5f9;border-radius:999px;overflow:hidden}.y62-bar i{position:absolute;top:0;bottom:0;right:0;background:#0b8a83;border-radius:999px}.y62-bar em{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:11px;font-weight:900;color:#0f2a4e}
.y62-me{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:18px 0;background:linear-gradient(135deg,#0f2a4e,#163a66);color:#fff;border-radius:16px;padding:14px 18px}.y62-me>div{display:grid;min-width:120px}.y62-me b{font-size:26px;color:#f1dfae}.y62-me span{font-size:12px;opacity:.9}.y62-me.guest{display:flex;justify-content:space-between}.y62-me.guest p{margin:0;font-size:14px}
.y62-ctas{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.y62 .pt-btn.outline.dark{color:#0f2a4e;border-color:#0f2a4e}.y62-foot{font-size:12px;color:#94a3b8;margin:0 0 20px}
.y62-all h3{font-size:16px;color:#0f2a4e;margin:0 0 10px}.y62-grid12{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.y62-grid12 div{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:2px}.y62-grid12 b{color:#c9a24b;font-size:12px}.y62-grid12 span{font-size:13px;font-weight:800;color:#0f2a4e}.y62-grid12 small{font-size:11.5px;color:#64748b}
@media (max-width:900px){.y62-hero h1{font-size:30px}.y62-waves,.y62-needs,.y62-vhcr{grid-template-columns:1fr}.y62-grid12{grid-template-columns:1fr 1fr}.y62-beats li{grid-template-columns:52px 1fr}}
`;
