'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /councils — «مجالس أَثَر» للعموم (P23): الدوائر الحيّة — كل مجلس منعقد دائرة من مقاعد تنبض بالمداولة (مجهولة: مجال · أعضاء · جهات · موضوع القضية الجارية · النبض)
 *  + الحركات الخمس · الميثاق · خريطة الحكمة (k ≥ 5) · طلب مقعد (لمن سجّل الدخول).
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell, useLang } from '../components/PortalShell';
import { fastToken } from '../components/Pocket';
import { supabase } from '../../lib/supabase/client';

type Circle = { code: string; title_ar: string; domain: string | null; sector_code: string | null; status: string; cycle_no: number; cycle_ends_at: string | null; members: number; orgs: number; seats_open: number; case: { status: string; theme: string | null; theme_ar: string; opened_days: number; questions: number; advice: number; evidence: number; voices: number } | null; pulse: 'lively' | 'steady' | 'quiet'; cases_total: number; returns: number };
type Yearbook = { code: string; org_name: string; year_label: string; intro_ar: string | null; chapters: { key: string; title_ar: string; people: number | null; quarter_ar: string }[]; created_at: string; expires_at: string; verify_url: string | null; views: number; k: number; url: string };
type Data = { circles: Circle[]; wisdom: { pattern: string; label_ar: string; cases: number; persons: number; orgs: number; councils: number }[]; totals: any; themes: { code: string; label: string }[]; org_charter?: { version: string; clauses: { id: string; title: string; body: string }[]; orgs: { organization_id: string; org_name: string; signed_at: string; expires_at: string; code: string | null }[] }; charter: { version: string; clauses: { id: string; title: string; body: string }[] }; rules: any; privacy_ar: string };
const MOVES = [
  { n: '①', t: 'القضية', d: 'عضو يحمل موقف عمل حقيقي: ما الذي أواجهه؟ ما خياراتي؟ ما الذي أخشاه؟ — نصًّا أو صوتًا أو فيديو.' },
  { n: '②', t: 'المداولة', d: 'الأقران يسألون قبل أن ينصحوا. المجلس يعدّ الأسئلة والنصائح — وسيظهر ذلك في مرآة كل عضو.' },
  { n: '③', t: 'الالتزام', d: 'صاحب القضية يعلن ما سيفعله خلال أسبوعين — و«كاتب المجلس» يصوغه التزامًا قابلًا للعودة.' },
  { n: '④', t: 'العودة', d: 'يعود بما حدث فعلًا: نجح، تعثّر، أو تغيّر فهمه — أثمن لحظة تعلّم في المجلس كله.' },
  { n: '⑤', t: 'شهادة الأقران', d: 'كل من شهد الدورة يشهد بدليل محدد على مهارة محددة. تصبح حدث تعلّم في خيط الأثر، ولا تمسّ المستوى المعتمد إلا باعتماد إنسان.' },
];

export default function CouncilsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [tok, setTok] = useState<string | null>(null);
  const [books, setBooks] = useState<Yearbook[] | null>(null);
  const [form, setForm] = useState({ domain: '', sector: '', note: '' }); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false); const [applied, setApplied] = useState(false);
  useEffect(() => { fetch('/api/councils/public', { cache: 'no-store' }).then(r => r.json()).then(j => j?.success ? setD(j) : setErr('تعذّر تحميل المجالس')).catch(() => setErr('تعذّر تحميل المجالس')); fastToken(db).then(t => setTok(t || '')); fetch('/api/org/journey?public=1', { cache: 'no-store' }).then(r => r.json()).then(j => setBooks(j?.success ? (j.items || []) : [])).catch(() => setBooks([])); }, [db]);
  useEffect(() => { if (!tok) return; fetch('/api/councils', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' }).then(r => r.json()).then(j => { if (j?.success && (j.applied || (j.halls || []).length)) setApplied(true); }).catch(() => null); }, [tok]);
  async function apply() {
    setBusy(true); const j = await fetch('/api/councils', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'apply', ...form }) }).then(r => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setApplied(true); setMsg(j.message || 'سُجّل طلبك'); } else setMsg(j?.error || 'تعذّر');
  }
  const t = d?.totals;
  return (
    <main className="cn" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="cn-hero">
        <span className="pt-kicker"><Icon name="users" size={14} /> مجالس أَثَر · حيث يُصنع الأثر بين الممارسين لا فوقهم</span>
        <h1>مجلسٌ من أقرانك، حول موقف حقيقي</h1>
        <p>خمسة إلى سبعة ممارسين من جهات مختلفة، في مجال واحد، لستة أسابيع. أحدهم يحمل موقفًا يواجهه الآن؛ الآخرون يسألون قبل أن ينصحوا؛ يلتزم؛ ثم <b>يعود بما حدث</b>. الذكاء الاصطناعي هنا كاتب المجلس لا قاضيه — والإنسان يعتمد.</p>
        {t && <div className="cn-kpis" data-testid="councils-kpis"><span><b>{t.councils_active}</b> مجلس منعقد</span><span><b>{t.councils_forming}</b> قيد التشكيل</span><span><b>{t.members}</b> عضوًا من <b>{t.orgs}</b> جهة</span><span><b>{t.cases}</b> قضية · <b>{t.returns}</b> عودة</span><span><b>{t.attestations_approved}</b> شهادة أقران معتمدة</span></div>}
      </header>
      {err && <p className="cn-err">{err}</p>}

      <section className="cn-sec" id="circles"><h2><Icon name="globe" size={18} /> الدوائر الحيّة</h2><p className="cn-muted">كل دائرة مجلس. المقاعد أعضاؤه، والنبض مداولته الجارية. لا أسماء ولا جهات — ما يُقال في المجلس يبقى فيه.</p>
        {d && !d.circles.length && <div className="pt-box cn-empty"><Icon name="compass" size={28} /><b>المجالس الأولى تتشكّل الآن</b><p>اطلب مقعدًا أدناه — حين يكتمل مجلس يناسب مستواك وجهتك تصلك دعوة لتوقيع الميثاق.</p></div>}
        <div className="cn-circles">{(d?.circles || []).map(c => <CircleCard key={c.code} c={c} />)}</div>
      </section>

      <section className="cn-sec" id="moves"><h2><Icon name="refresh" size={18} /> الحركات الخمس</h2>
        <ol className="cn-moves">{MOVES.map(m => <li key={m.n}><span className="cn-n">{m.n}</span><div><b>{m.t}</b><p>{m.d}</p></div></li>)}</ol>
      </section>

      {d && (
        <section className="cn-sec" id="wisdom"><h2><Icon name="compass" size={18} /> خريطة الحكمة</h2><p className="cn-muted">القضايا التي تتكرر عبر المجالس — تُنشر فقط حين يقف خلف النمط {d.rules.k_anonymity} أشخاص من جهتين على الأقل. منها تولد برامج من قضايا حقيقية.</p>
          {!d.wisdom.length ? <p className="cn-quiet">لم يبلغ نمط بعدُ عتبة النشر (k ≥ {d.rules.k_anonymity}). الموضوعات التي يرصدها كاتب المجلس: {d.themes.map(x => x.label).join(' · ')}.</p> : <div className="cn-wisdom">{d.wisdom.map(w => <div key={w.pattern} className="cn-wis" style={{ ['--w' as any]: Math.min(100, 20 + w.cases * 8) + '%' }}><b>{w.label_ar}</b><span>{w.cases} قضية · {w.persons} ممارسًا · {w.orgs} جهات · {w.councils} مجالس</span></div>)}</div>}
        </section>
      )}

      {d && (
        <section className="cn-sec" id="charter"><h2><Icon name="scale" size={18} /> ميثاق المجلس <small>v{d.charter.version}</small></h2>
          <div className="cn-charter">{d.charter.clauses.map(c => <div key={c.id} className="pt-box"><h3>{c.title}</h3><p>{c.body}</p></div>)}</div>
          <p className="cn-muted">{d.privacy_ar}</p>
        </section>
      )}

      {d && d.org_charter && (
        <section className="cn-sec" id="orgs" data-testid="org-charter-sec"><h2><Icon name="award" size={18} /> جهات موقِّعة على ميثاق الجهة <small>v{d.org_charter.version}</small></h2>
          <p className="cn-muted">الجهة الموقِّعة تتعهد سنويًا — بوثيقة موقَّعة Ed25519 قابلة للتحقق — بأن تمنح منسوبيها وقتًا للمجالس داخل الدوام، وتحترم السرية، ولا تستعمل المرآة ولا المداولات في التقييم الوظيفي، ولا تطلب أسماء. اسم الجهة هنا بقرارها هي.</p>
          {!d.org_charter.orgs.length ? <p className="cn-quiet">لم توقّع جهة بعد. مديرو الجهات يوقّعون من <Link href="/org">بوابة الجهات</Link> ← «ميثاق الجهة».</p> : <div className="cn-orgs">{d.org_charter.orgs.map(o => <a key={o.organization_id} className="cn-org" href={o.code ? `/verify/vc?code=${encodeURIComponent(o.code)}` : '#orgs'} target={o.code ? '_blank' : undefined} rel="noreferrer"><i><Icon name="check" size={14} /></i><b>{o.org_name}</b><small>موقِّعة منذ {new Date(o.signed_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')} · حتى {new Date(o.expires_at).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')}{o.code ? ' · تحقق' : ''}</small></a>)}</div>}
          <details className="cn-orgclauses"><summary>بنود ميثاق الجهة الأربعة</summary><div className="cn-charter" style={{ marginTop: 10 }}>{d.org_charter.clauses.map(c => <div key={c.id} className="pt-box"><h3>{c.title}</h3><p>{c.body}</p></div>)}</div></details>
        </section>
      )}

      <section className="cn-sec cn-shelf" id="yearbooks" data-testid="yearbooks"><h2><Icon name="book" size={18} /> رفّ كتب السنة</h2>
        <p className="cn-muted">ما تعلّمته جهة كاملة في سنة — فصولًا لا أرقامًا: كل فصل عدد أشخاص (لا يقل عن خمسة) وحقبة وكلمات الجهة نفسها. الجهة تختار ما تنشره، والكتاب موقَّع ويُسحب بنقرة. لا أسماء ولا مقارنات بين الجهات.</p>
        {books === null ? <p className="cn-quiet">نفتح الرفّ…</p> : !books.length ? <p className="cn-quiet">الرفّ فارغ بعد. مديرو الجهات يصدرون كتاب سنتهم من <Link href="/org?tab=journey">بوابة الجهات</Link> ← «رحلة الجهة».</p> : (
          <div className="cn-books">{books.map(b => <a key={b.code} className="cn-book" href={b.url} data-testid="yearbook"><span className="cn-bookyear">{b.year_label}</span><b>{b.org_name}</b><small>{b.chapters.length} فصلًا · {b.chapters[0]?.quarter_ar || ''}{b.chapters.length > 1 ? ` ← ${b.chapters[b.chapters.length - 1].quarter_ar}` : ''}</small>{b.intro_ar && <p>{b.intro_ar.length > 140 ? b.intro_ar.slice(0, 140) + '…' : b.intro_ar}</p>}<i>{b.verify_url ? 'موقَّع · ' : ''}{b.views} قراءة</i></a>)}</div>)}
      </section>

      <section className="cn-sec cn-apply" id="apply"><h2><Icon name="flag" size={18} /> اطلب مقعدًا</h2>
        {tok === '' && <p>المجالس للممارسين المسجّلين في أَثَر. <Link href="/login?next=/councils#apply" className="pt-btn small">سجّل الدخول لطلب مقعد</Link></p>}
        {tok && applied && <p className="cn-ok"><Icon name="check" size={16} /> {msg || 'طلبك قائم — المُوفِّق يراه عند التشكيل التالي.'} <Link href="/me/council">قاعة المجلس</Link></p>}
        {tok && !applied && (
          <div className="cn-form" data-testid="apply-form">
            <label>المجال الذي تريد مجلسًا فيه<input value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="مثال: قيادة الفرق · الجودة والاعتماد · تصميم التعلّم" /></label>
            <label>قطاعك<input value={form.sector} onChange={e => setForm({ ...form, sector: e.target.value })} placeholder="حكومي · صحي · تعليم عالٍ · خاص…" /></label>
            <label>لماذا الآن؟ (اختياري)<textarea rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="موقف تواجهه، أو ما تريد أن تراه في مرآتك" /></label>
            <button className="pt-btn" disabled={busy} onClick={apply}><Icon name="send" size={15} /> {busy ? '…' : 'اطلب مقعدًا'}</button>
            {msg && <p className="cn-err">{msg}</p>}
          </div>
        )}
        <p className="cn-muted">المُوفِّق يقترح التشكيل من محفظة القدرة (مستويات متقاربة) وتنوّع الجهات — والطاقم يعتمد. لا تُنشأ مجالس آليًا.</p>
      </section>
    </main>
  );
}

function CircleCard({ c }: { c: Circle }) {
  const seats = Math.max(c.members + c.seats_open, 5); const R = 54; const cx = 70, cy = 70;
  const dots = Array.from({ length: seats }, (_, i) => { const a = (i / seats) * Math.PI * 2 - Math.PI / 2; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), filled: i < c.members }; });
  return (
    <article className={`cn-circle ${c.pulse} ${c.status}`} data-testid="circle">
      <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden>
        <circle cx={cx} cy={cy} r={R} className="cn-ring" />
        {c.case && <circle cx={cx} cy={cy} r={R - 14} className="cn-pulse" />}
        {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.filled ? 6 : 4.5} className={d.filled ? 'cn-seat on' : 'cn-seat'} />)}
        <text x={cx} y={cy - 4} textAnchor="middle" className="cn-num">{c.members}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" className="cn-lbl">{c.orgs} جهات</text>
      </svg>
      <div className="cn-cbody">
        <b>{c.title_ar}</b>
        <span className="cn-tag">{c.status === 'active' ? `منعقد · الدورة ${c.cycle_no}` : 'قيد التشكيل'}{c.seats_open ? ` · ${c.seats_open} مقاعد شاغرة` : ''}</span>
        {c.case ? <p><i className={`cn-dot ${c.pulse}`} /> {c.case.theme_ar ? `قضية في «${c.case.theme_ar}»` : 'قضية جارية'} منذ {c.case.opened_days === 0 ? 'اليوم' : `${c.case.opened_days} ${c.case.opened_days === 1 ? 'يوم' : 'أيام'}`} — {c.case.questions} سؤالًا · {c.case.advice} نصيحة · {c.case.evidence} دليلًا من {c.case.voices} أصوات{c.case.status === 'committed' ? ' · في انتظار العودة' : ''}</p> : <p className="cn-quiet">لا قضية مفتوحة الآن · {c.cases_total} قضية سابقة · {c.returns} عودة</p>}
      </div>
    </article>
  );
}

const CSS = `
.cn-books{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px;margin-top:12px}.cn-book{display:flex;flex-direction:column;gap:4px;background:linear-gradient(160deg,#0f2a4e,#0b8a83);color:#fff;border-radius:16px;padding:16px;text-decoration:none;min-height:150px;position:relative;overflow:hidden;box-shadow:inset 6px 0 0 #c9a24b}.cn-book:hover{transform:translateY(-2px)}.cn-bookyear{color:#c9a24b;font-weight:900;font-size:20px}.cn-book b{font-size:16px;line-height:1.5}.cn-book small{color:#cbd5e1;font-size:12px}.cn-book p{margin:6px 0 0;font-size:12.5px;line-height:1.75;color:#e2e8f0}.cn-book i{margin-top:auto;font-style:normal;font-size:11px;color:#cbd5e1;padding-top:8px}
.cn{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1100px;margin:0 auto;padding:28px 18px 60px}
.cn-hero{background:radial-gradient(1200px 400px at 80% -20%,rgba(11,138,131,.18),transparent),linear-gradient(135deg,#0f2a4e,#123a66);color:#fff;border-radius:24px;padding:36px 30px;margin-bottom:28px}
.cn-hero .pt-kicker{color:#c9a24b}.cn-hero h1{margin:6px 0 10px;font-size:34px;line-height:1.3}.cn-hero p{margin:0;max-width:820px;line-height:1.95;font-size:16px;color:#e2e8f0}
.cn-kpis{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.cn-kpis span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;font-size:13px}.cn-kpis b{color:#c9a24b;font-size:16px}
.cn-sec{margin:34px 0}.cn-sec h2{display:flex;align-items:center;gap:8px;font-size:22px;color:#0f2a4e;margin:0 0 6px}.cn-sec h2 small{font-size:12px;color:#64748b;font-weight:700}.cn-muted{color:#64748b;font-size:14px;line-height:1.9;margin:0 0 14px}.cn-quiet{color:#64748b;font-size:14px;line-height:1.9}
.cn-err{color:#b91c1c;font-weight:800}.cn-ok{color:#0b8a83;font-weight:800;display:flex;gap:8px;align-items:center}.cn-ok a{margin-inline-start:8px}
.cn-circles{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.cn-circle{display:flex;gap:14px;align-items:center;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:14px 16px;transition:transform .2s}.cn-circle:hover{transform:translateY(-2px)}
.cn-ring{fill:none;stroke:#cbd5e1;stroke-width:1.5;stroke-dasharray:3 4}.cn-circle.active .cn-ring{stroke:#0b8a83}
.cn-pulse{fill:rgba(11,138,131,.08);stroke:rgba(11,138,131,.35);stroke-width:1;transform-origin:70px 70px;animation:cnp 3s ease-in-out infinite}.cn-circle.lively .cn-pulse{animation-duration:1.6s;fill:rgba(201,162,75,.16);stroke:#c9a24b}.cn-circle.quiet .cn-pulse{animation:none;opacity:.5}
@keyframes cnp{0%,100%{transform:scale(.92);opacity:.6}50%{transform:scale(1.06);opacity:1}}
.cn-seat{fill:#fff;stroke:#94a3b8;stroke-width:1.5}.cn-seat.on{fill:#0f2a4e;stroke:#0f2a4e}.cn-circle.active .cn-seat.on{fill:#0b8a83;stroke:#0b8a83}
.cn-num{font-size:26px;font-weight:900;fill:#0f2a4e}.cn-lbl{font-size:10px;fill:#64748b;font-weight:800}
.cn-cbody{flex:1;min-width:0}.cn-cbody b{display:block;font-size:16px;color:#0f2a4e}.cn-tag{display:inline-block;font-size:12px;color:#0b8a83;font-weight:800;margin:4px 0 6px}.cn-cbody p{margin:0;font-size:13px;line-height:1.8;color:#334155}
.cn-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#94a3b8;margin-inline-end:4px}.cn-dot.lively{background:#c9a24b;box-shadow:0 0 0 4px rgba(201,162,75,.25)}.cn-dot.steady{background:#0b8a83}
.cn-empty{text-align:center;color:#334155}.cn-empty b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:17px}.cn-empty p{margin:0;color:#64748b}
.cn-moves{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;counter-reset:m}.cn-moves li{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;display:flex;gap:12px}.cn-n{font-size:26px;color:#c9a24b;font-weight:900;line-height:1}.cn-moves b{display:block;color:#0f2a4e;margin-bottom:4px}.cn-moves p{margin:0;font-size:13px;line-height:1.8;color:#334155}
.cn-wisdom{display:grid;gap:10px}.cn-wis{position:relative;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px;overflow:hidden}.cn-wis:before{content:'';position:absolute;inset:0 auto 0 0;width:var(--w);background:linear-gradient(90deg,rgba(11,138,131,.12),rgba(201,162,75,.12))}.cn-wis b{position:relative;display:block;color:#0f2a4e}.cn-wis span{position:relative;font-size:12px;color:#64748b}
.cn-orgs{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin:10px 0}.cn-org{display:grid;grid-template-columns:auto 1fr;gap:4px 10px;align-items:center;border:1px solid #cfe9e6;background:linear-gradient(135deg,#f3fbfa,#fff);border-radius:14px;padding:10px 12px;text-decoration:none;color:#0f2a4e}.cn-org i{grid-row:1/3;width:30px;height:30px;border-radius:999px;background:#0b8a83;color:#fff;display:grid;place-items:center}.cn-org b{font-size:14px}.cn-org small{color:#64748b;font-size:11.5px}.cn-orgclauses summary{cursor:pointer;color:#0b8a83;font-weight:800;font-size:13px}
.cn-charter{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:10px}.cn-charter h3{font-size:15px}.cn-charter p{margin:0;font-size:13px;line-height:1.85;color:#334155}
.cn-apply{background:#f8fafc;border:1px solid #e2e8f0;border-radius:22px;padding:22px}.cn-form{display:grid;gap:12px;max-width:620px}.cn-form label{display:grid;gap:6px;font-size:13px;font-weight:800;color:#334155}.cn-form input,.cn-form textarea{font:inherit;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#fff}
@media (max-width:640px){.cn-hero h1{font-size:26px}.cn-circle{flex-direction:column;text-align:center}}
`;
