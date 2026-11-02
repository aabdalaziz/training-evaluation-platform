// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /miaar/trust — «سجلّ الصدق»: صفحة عامة تعلن موثوقية كل مستوى في مِعيار (ضوء · معامل الثبات · خطأ القياس · ثبات القرار عند حدّ 60%).
 *  لا أسماء ولا أرقام أفراد — أرقامٌ مجمّعة فقط. لماذا علنية؟ لأن الاختبار الذي يُحدِّد مستوى إنسان يجب أن يُعلن كم هو واثق من نفسه.
 *  يُحدَّث تلقائيًا كل 50 جلسة منتهية (reweighIfDue في المحرّك) أو يدويًا من «الميزان» في لوحة الإدارة. مُصيَّر على الخادم بلا JavaScript (خِفّة أَثَر). */
import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { trustSummary } from '../../../lib/miaar/balance';

export const metadata: Metadata = {
  title: 'سجلّ الصدق — مِعيار من أَثَر',
  description: 'موثوقية اختبار مِعيار لكل مستوى من A1 إلى C2: معامل الثبات وخطأ القياس وثبات قرار الاجتياز — أرقام مجمّعة علنية بلا أسماء.',
  alternates: { canonical: '/miaar/trust' },
};
export const dynamic = 'force-dynamic';

const LIGHT_COLOR: Record<string, string> = { green: '#0b8a83', yellow: '#c9a24b', red: '#b42318', gray: '#94a3b8' };
const LIGHT_LABEL: Record<string, string> = { green: 'معتمد', yellow: 'مقبول', red: 'يحتاج مراجعة', gray: 'قيد المعايرة' };
const LEVEL_AR: Record<string, string> = { A1: 'المبتدئ', A2: 'الأساسي', B1: 'المتوسط', B2: 'فوق المتوسط', C1: 'المتقدّم', C2: 'الإتقان' };
/* ملاحظة: الأسماء العربية للمستويات هنا تتبع الجدول المعتمد في مقدّمة مِعيار (مستخدم أساسي/مستقل/متمكّن) */
const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default async function Page() {
  const U = process.env.NEXT_PUBLIC_SUPABASE_URL; const S = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let data: Awaited<ReturnType<typeof trustSummary>> | null = null;
  if (U && S) { try { data = await trustSummary(createClient(U, S, { auth: { persistSession: false }, global: { fetch: (i: any, o: any) => fetch(i, { ...(o || {}), cache: 'no-store' }) } })); } catch { data = null; } }
  const byLevel = new Map((data?.levels || []).map((l) => [l.level, l]));
  const rows = ORDER.map((L) => byLevel.get(L) || { level: L, n: 0, k: 0, rel: 0, sem: 0, decision: 0, light: 'gray', light_ar: 'قيد المعايرة', method: null });
  const when = data?.computed_at ? new Date(data.computed_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
  const pct = (x: number) => (x > 0 ? `${Math.round(x * 100)}%` : '—');
  return <main dir="rtl" lang="ar" style={{ fontFamily: 'var(--font-ar, Tajawal), system-ui, sans-serif', background: '#f6f3ea', minHeight: '100vh', color: '#0f172a' }} data-testid="mi-trust-page">
    <style dangerouslySetInnerHTML={{ __html: `
.tr-wrap{max-width:880px;margin:0 auto;padding:40px 20px 72px}.tr-hero{background:#0f2a4e;color:#fff;border-radius:22px;padding:34px 30px;position:relative;overflow:hidden}
.tr-hero:after{content:'';position:absolute;inset:auto -60px -80px auto;width:260px;height:260px;border-radius:50%;border:26px solid rgba(201,162,75,.18)}
.tr-kicker{font-size:13px;letter-spacing:.08em;color:#c9a24b;margin:0}.tr-hero h1{margin:8px 0 0;font-size:clamp(28px,4vw,38px);font-weight:900}.tr-hero p{margin:12px 0 0;max-width:620px;line-height:1.9;color:#d5e0ea;font-size:15px}
.tr-meta{display:flex;gap:18px;flex-wrap:wrap;margin:18px 0 0;font-size:13px;color:#c9a24b}
.tr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin:22px 0 0}
.tr-card{background:#fff;border:1px solid #e7e2d2;border-radius:18px;padding:18px 18px 16px;position:relative}
.tr-card header{display:flex;align-items:center;justify-content:space-between;gap:10px}.tr-card b{font-size:30px;font-weight:900;color:#0f2a4e}.tr-card small{display:block;color:#64748b;font-size:13px}
.tr-light{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:800;padding:5px 10px;border-radius:999px;background:#f1f5f9}.tr-light i{width:11px;height:11px;border-radius:50%;display:inline-block}
.tr-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin:14px 0 0}.tr-stats div{background:#f8f7f2;border-radius:12px;padding:8px 10px;text-align:center}.tr-stats span{display:block;font-size:11px;color:#64748b}.tr-stats strong{font-size:18px;color:#0f2a4e}
.tr-n{margin:10px 0 0;font-size:12px;color:#64748b}
.tr-how{background:#fff;border:1px solid #e7e2d2;border-radius:18px;padding:20px 22px;margin:22px 0 0;line-height:1.95;font-size:15px}.tr-how h2{margin:0 0 8px;font-size:19px;color:#0f2a4e}.tr-how dt{font-weight:800;color:#0b8a83;margin-top:8px}.tr-how dd{margin:0}
.tr-h2{margin:30px 0 0;font-size:21px;color:#0f2a4e}.tr-sub{margin:6px 0 0;color:#475569;font-size:14px;line-height:1.8;max-width:720px}
.tr-grid{margin-top:14px}
.tr-foot{margin:26px 0 0;font-size:13px;color:#64748b;line-height:1.8;text-align:center}.tr-foot a{color:#0b8a83}
@media (prefers-reduced-motion:no-preference){.tr-card{transition:transform .2s}.tr-card:hover{transform:translateY(-2px)}}
`}} />
    <div className="tr-wrap">
      <section className="tr-hero">
        <p className="tr-kicker">مِعيار — من أَثَر · شفافية القياس</p>
        <h1>سجلّ الصدق</h1>
        <p>اختبارٌ يحدِّد مستوى إنسان يجب أن يُعلن كم هو واثقٌ من نفسه. هذه الصفحة تنشر موثوقية كل مستوى من مستويات مِعيار كما تحسبها إجابات المتقدّمين الحقيقية — أرقامٌ مجمّعة فقط، بلا اسم ولا بريد ولا نتيجة فردية.</p>
        <div className="tr-meta"><span>الجلسات المحسوبة: <b data-testid="tr-sessions">{data?.sessions ?? 0}</b></span><span>آخر معايرة: {when || 'لم تُجرَ بعد'}</span><span>التحديث: تلقائي كل 50 جلسة</span></div>
      </section>

      <h2 className="tr-h2">النماذج التي يخوضها المتقدّمون</h2>
      <p className="tr-sub">قرار التسكين أو الاجتياز يُبنى على النموذج كاملًا — وهذه موثوقيته كما قاستها الجلسات الحقيقية.</p>
      <div className="tr-grid" data-testid="tr-forms">
        {!(data?.forms || []).length && <article className="tr-card"><p className="tr-n">لم يكتمل 30 جلسة على أي نموذج بعد — الأضواء رمادية حتى تكتمل.</p></article>}
        {(data?.forms || []).map((f) => <article className="tr-card" key={f.code} data-testid={`tr-form-${f.code}`} data-light={f.light}>
          <header><div><b style={{ fontSize: 20 }}>{f.name_ar}</b><small dir="ltr" style={{ textAlign: 'end' }}>{f.code}</small></div><span className="tr-light"><i style={{ background: LIGHT_COLOR[f.light] || LIGHT_COLOR.gray }} aria-hidden="true" />{LIGHT_LABEL[f.light] || f.light_ar}</span></header>
          <div className="tr-stats">
            <div><span>معامل الثبات</span><strong>{f.rel > 0 ? f.rel.toFixed(2) : '—'}</strong></div>
            <div><span>خطأ القياس</span><strong>{f.sem > 0 ? `±${f.sem.toFixed(1)}` : '—'}</strong></div>
            <div><span>ثبات القرار</span><strong>{pct(f.decision)}</strong></div>
          </div>
          <p className="tr-n">{f.n > 0 ? `${f.n} جلسة · ${f.k} بندًا${f.method ? ` · ${f.method}` : ''}` : 'قيد الجمع'}</p>
        </article>)}
      </div>

      <h2 className="tr-h2">لبنات المستويات داخل النماذج</h2>
      <p className="tr-sub">كل مستوى داخل النموذج كتلة قصيرة (6–8 بنود)، وموثوقية الكتلة القصيرة أدنى بطبيعتها من موثوقية النموذج كله — ننشرها لأنها تُرشد الطاقم إلى المستوى الذي يحتاج بنودًا أقوى، لا لأنها تحكم على نتيجتك.</p>
      <div className="tr-grid" data-testid="tr-levels">
        {rows.map((r) => <article className="tr-card" key={r.level} data-testid={`tr-level-${r.level}`} data-light={r.light}>
          <header><div><b>{r.level}</b><small>{LEVEL_AR[r.level]}</small></div><span className="tr-light"><i style={{ background: LIGHT_COLOR[r.light] || LIGHT_COLOR.gray }} aria-hidden="true" />{LIGHT_LABEL[r.light] || r.light_ar}</span></header>
          <div className="tr-stats">
            <div><span>معامل الثبات</span><strong>{r.rel > 0 ? r.rel.toFixed(2) : '—'}</strong></div>
            <div><span>خطأ القياس</span><strong>{r.sem > 0 ? `±${r.sem.toFixed(1)}` : '—'}</strong></div>
            <div><span>ثبات القرار</span><strong>{pct(r.decision)}</strong></div>
          </div>
          <p className="tr-n">{r.n > 0 ? `${r.n} جلسة · ${r.k} بندًا${r.method ? ` · ${r.method}` : ''}` : 'لم تكتمل 30 جلسة بعد — الضوء رمادي حتى تكتمل'}</p>
        </article>)}
      </div>

      <section className="tr-how">
        <h2>كيف تقرأ الأضواء؟</h2>
        <dl>
          <dt>أخضر — معتمد</dt><dd>معامل ثبات ≥ 0.80 وثبات قرار ≥ 85%: نثق أن من اجتاز هذا المستوى سيجتازه لو أعاد الاختبار بنموذج مكافئ.</dd>
          <dt>أصفر — مقبول</dt><dd>معامل ثبات بين 0.70 و0.80: النتيجة صالحة للتسكين، ونراجع البنود الأضعف لرفعها.</dd>
          <dt>أحمر — يحتاج مراجعة</dt><dd>دون 0.70: يُعرض ذلك على المتقدّم في بطاقته صراحةً («النموذج تحت المراجعة — النتيجة إرشادية»)، ويُراجع الطاقم بنود النموذج قبل اعتماده لامتحانات الاجتياز.</dd>
          <dt>رمادي — قيد المعايرة</dt><dd>أقل من 30 جلسة: لا نُصدر حكمًا على ما لم نقسه بما يكفي.</dd>
        </dl>
        <p style={{ margin: '12px 0 0', color: '#475569', fontSize: 14 }}>الطريقة: معامل ألفا (كرونباخ) على البنود ثنائية التصحيح لكل مستوى، وخطأ القياس المعياري بالدرجة الخام، وثبات القرار عند حدّ الاجتياز 60% بمعادلة ليفنغستون. تُراجع لجنة بشرية كل اقتراح معايرة قبل اعتماده — الحاسوب يقترح، والإنسان يعتمد.</p>
      </section>

      <p className="tr-foot">هذه الصفحة جزء من التزام أَثَر بالشفافية في القياس · <a href="/miaar">العودة إلى مِعيار</a> · © 2026 د. أحمد محمد عبدالعزيز بدوي — جميع الحقوق محفوظة</p>
    </div>
  </main>;
}
