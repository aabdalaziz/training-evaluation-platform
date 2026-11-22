'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /iqra/start — «باب اقْرَأْ» (هـ-1/3): شاشة الدخول الواحدة بكلّ حالاتها:
 *   guest → noLevel → pendingLevel → noSeat (تجربة ٧ أيام | خطط) → paying → active → expired
 * هوية v1.2: شريط المستوى بلون مستوى مِعيار نفسه (التوأمة)، بطاقات الخطط تنقلب (تقنية القلب القديمة)، أفق وأقواس خفيفة.
 * الدفع عبر فاتورة أَثَر العادية (/pay/<id>) — بطاقة Moyasar (حساب تجريبي الآن) أو تحويل بنكي؛ المقعد يُفتح بمحفّز قاعدة البيانات عند السداد.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Flip, Reveal, Horizon, ArcDivider, CountUp } from '../../../lib/ui/motion';
import { LEVEL_META, type IqraLevel } from '../../../lib/iqra/registry';
import { planTotals, savingsPct, PAID, TRIAL, type Plan, type Seat, type SeatState } from '../../../lib/portal/entitlements';

type Access = { ok: boolean; state: SeatState; copy: { title: string; body: string; cta?: string; href?: string }; level: string | null; seat: Seat | null; days_left: number; trial_used?: boolean; trial_available: boolean; pending_invoice_id: string | null; plans: Plan[]; vat: { rate: number; included: boolean; currency: string; card: boolean; bank: boolean }; staff_free?: boolean; error?: string };

const AR = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });
const AR2 = new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const SAR = (n: number) => `${AR.format(n)} ر.س`;
const dateAr = (iso: string) => { try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso)); } catch { return iso.slice(0, 10); } };

export default function IqraStart({ fontClass }: { fontClass?: string }) {
  const [tok, setTok] = useState<string | null | undefined>(undefined);
  const [a, setA] = useState<Access | null>(null); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState<string | null>(null); const [flipped, setFlipped] = useState<string | null>(null);
  const H = useCallback((): Record<string, string> => (tok ? { Authorization: `Bearer ${tok}` } : {}), [tok]);
  useEffect(() => { (async () => { try { const { data } = await supabase().auth.getSession(); setTok(data.session?.access_token || null); } catch { setTok(null); } })(); }, []);
  const load = useCallback(async () => { if (tok === undefined) return; setErr(null); try { const r = await fetch('/api/iqra/access', { headers: H(), cache: 'no-store' }); const d = (await r.json()) as Access; if (!d.ok) throw new Error(d.error || `HTTP ${r.status}`); setA(d); } catch (e: any) { setErr(String(e?.message || e)); } }, [tok, H]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (a?.level) document.documentElement.setAttribute('data-level', a.level); return () => { document.documentElement.removeAttribute('data-level'); }; }, [a?.level]);

  const post = useCallback(async (body: Record<string, unknown>) => { const r = await fetch('/api/iqra/access', { method: 'POST', headers: { 'Content-Type': 'application/json', ...H() }, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({})); if (!r.ok || !d.ok) throw new Error(d.error || `HTTP ${r.status}`); return d; }, [H]);
  const startTrial = async () => { setBusy('trial'); setErr(null); try { await post({ action: 'trial' }); window.location.assign('/iqra?welcome=trial'); } catch (e: any) { setErr(msgOf(e)); setBusy(null); } };
  const buy = async (plan: string) => { setBusy(plan); setErr(null); try { const d = await post({ action: 'buy', plan }); window.location.assign(d.pay_url || `/pay/${d.invoice_id}`); } catch (e: any) { setErr(msgOf(e)); setBusy(null); } };

  const lvl = (a?.level && LEVEL_META[a.level as IqraLevel]) || null;
  const paid = useMemo(() => (a ? PAID(a.plans) : []), [a]); const trial = a ? TRIAL(a.plans) : null; const base = paid[0] || null;
  const st = a?.state;

  return (
    <main className={`iqs ${fontClass || ''}`} dir="rtl" data-testid="iqra-start" data-state={st || 'loading'} data-level={a?.level || undefined}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="iqs-hero">
        <Horizon light height={120} />
        <div className="iqs-heroin">
          <p className="iqs-crumb"><Link href="/">أَثَر</Link> <span aria-hidden="true">›</span> <span>اقْرَأْ</span></p>
          <h1>{a?.copy?.title || 'اقْرَأْ — تعلّم العربية على مستواك'}</h1>
          <p className="iqs-lead">{a?.copy?.body || 'حلقات قصيرة على مستواك من الإطار الأوروبي المرجعي، تراجعها وتتقدّم فيها بوقتك.'}</p>
          {lvl && <div className="iqs-level lvl-surface" data-level={a?.level || undefined} data-testid="iqs-level"><i aria-hidden="true" /><div><small>مستواك من مِعيار</small><b>{lvl.code} · {lvl.name_ar}</b><span>{lvl.line_ar}</span></div></div>}
        </div>
      </section>

      <div className="iqs-wrap">
        {err && <div className="iqs-err" role="alert" data-testid="iqs-err">{err}</div>}
        {!a && !err && <div className="iqs-card iqs-wait">جارٍ فتح الباب…</div>}

        {st === 'guest' && <Reveal><div className="iqs-card iqs-center"><p>ادخل بحساب أَثَر (رابط سحري إلى بريدك — بلا كلمة مرور). وإن لم يكن لك مستوى بعد، فابدأ بتقييم نفسك في مِعيار.</p>
          <div className="iqs-acts"><Link className="iqs-btn primary" href="/login?next=/iqra/start" data-testid="iqs-login">تسجيل الدخول</Link><Link className="iqs-btn ghost" href="/miaar">قيّم نفسك — 3 دقائق</Link></div></div></Reveal>}

        {st === 'noLevel' && <Reveal><div className="iqs-card iqs-center"><Steps n={1} />
          <p>ثلاث خطوات: <b>قيّم نفسك</b> في مِعيار، ثم يعتمد الخبير المُصدِّق مستواك، ثم تختار مقعدك في اقْرَأْ.</p>
          <div className="iqs-acts"><Link className="iqs-btn primary" href="/miaar" data-testid="iqs-miaar">قيّم نفسك — 3 دقائق</Link><Link className="iqs-btn ghost" href="/me">صفحتي</Link></div></div></Reveal>}

        {st === 'pendingLevel' && <Reveal><div className="iqs-card iqs-center"><Steps n={2} />
          <p>وصلت نتيجتك، وقرار التسكين ينتظر الاعتماد. ستصلك رسالة فور فتح مستواك.</p>
          <div className="iqs-acts"><Link className="iqs-btn" href="/me">صفحتي</Link><button type="button" className="iqs-btn ghost" onClick={() => void load()}>تحديث</button></div></div></Reveal>}

        {st === 'active' && a && <Reveal><div className="iqs-card iqs-active lvl-surface" data-level={a.level || undefined} data-testid="iqs-active">
          <div className="iqs-activein">
            <div><small>{a.staff_free ? 'دخول الطاقم' : a.seat?.source === 'trial' ? 'تجربتك المجانية' : 'مقعدك'}</small>
              {a.seat ? <b><CountUp value={a.days_left} /> {a.days_left === 1 ? 'يوم' : a.days_left === 2 ? 'يومان' : a.days_left <= 10 ? 'أيام' : 'يومًا'} متبقّية</b> : <b>مفتوح</b>}
              {a.seat && <span>حتى {dateAr(a.seat.ends_at)}</span>}</div>
            <Link className="iqs-btn primary big" href="/iqra" data-testid="iqs-enter">ادخل إلى اقْرَأْ</Link>
          </div>
          {a.seat && a.days_left <= 7 && paid.length > 0 && <p className="iqs-hint">يمكنك التمديد الآن؛ الأيّام الجديدة تُضاف بعد نهاية مقعدك الحالي.</p>}
        </div></Reveal>}

        {st === 'paying' && a?.pending_invoice_id && <Reveal><div className="iqs-card iqs-center"><Steps n={3} />
          <p>فاتورتك جاهزة. ادفع بالبطاقة (مدى · فيزا · ماستركارد · Apple Pay) أو بالتحويل البنكي، ويُفتح مقعدك فور التأكيد.</p>
          <div className="iqs-acts"><Link className="iqs-btn primary" href={`/pay/${a.pending_invoice_id}`} data-testid="iqs-pay">إكمال الدفع</Link><button type="button" className="iqs-btn ghost" onClick={() => void load()}>دفعتُ — تحديث</button></div></div></Reveal>}

        {(st === 'noSeat' || st === 'expired' || (st === 'active' && a?.seat && a.days_left <= 7)) && a && (
          <>
            {st === 'expired' && a.seat && <Reveal><div className="iqs-card iqs-center iqs-expired"><Steps n={3} /><p>انتهى مقعدك في {dateAr(a.seat.ends_at)}. تقدّمك ودفترك محفوظان — جدّد لتكمل من حيث توقّفت.</p></div></Reveal>}
            {st === 'noSeat' && trial && a.trial_available && <Reveal><div className="iqs-card iqs-trial lvl-surface" data-level={a.level || undefined} data-testid="iqs-trial">
              <Steps n={3} />
              <div className="iqs-trialin"><div><small>بلا بطاقة · مرّة واحدة</small><b>{trial.name_ar} مجّانًا</b><span>{trial.blurb_ar}</span></div>
                <button type="button" className="iqs-btn primary big" onClick={startTrial} disabled={busy === 'trial'} data-testid="iqs-trial-btn">{busy === 'trial' ? 'نفتح مقعدك…' : 'ابدأ التجربة الآن'}</button></div>
            </div></Reveal>}
            {paid.length > 0 && <section className="iqs-plans" aria-label="خطط اقْرَأْ" data-testid="iqs-plans">
              <ArcDivider />
              <h2>{st === 'expired' ? 'جدّد مقعدك' : st === 'active' ? 'مدّد مقعدك' : 'أو اختر خطّتك'}</h2>
              <p className="iqs-muted">اقلب البطاقة لترى ما فيها. {a.vat.rate > 0 ? (a.vat.included ? `الأسعار شاملة ضريبة القيمة المضافة ${AR.format(a.vat.rate)}٪.` : `تُضاف ضريبة القيمة المضافة ${AR.format(a.vat.rate)}٪.`) : ''}</p>
              <div className="iqs-grid">
                {paid.map((p, i) => { const t = planTotals(p.price, a.vat.rate, a.vat.included); const save = savingsPct(p, base); const best = i === paid.length - 2 && paid.length >= 3;
                  return <Reveal key={p.code} delay={i * 90} className="iqs-plan">
                    <Flip level={a.level || undefined} minHeight={210} flipped={flipped === p.code} onFlip={(v) => setFlipped(v ? p.code : null)} label={`خطّة ${p.name_ar}`} testId={`iqs-plan-${p.code}`}
                      front={<div className="iqs-face"><small>{best ? 'الأنسب لعبور مستوى' : save > 0 ? `يوفّر ${AR.format(save)}٪` : 'ابدأ بخفّة'}</small><b>{p.name_ar}</b><strong>{SAR(t.total)}</strong><span>{AR.format(p.days)} يومًا · {AR2.format(t.total / p.days)} ر.س لليوم</span><em>اقلبني ↻</em></div>}
                      back={<div className="iqs-face back"><small>ما الذي يفتحه؟</small><p>{p.blurb_ar}</p><ul><li>كلّ حلقات مستواك ومراجعاتك المتباعدة</li><li>دفتر الكلمات والحلقات الصوتية</li>{p.days >= 90 && <li>اختبار عُبور المستوى وشهادته</li>}{p.days >= 365 && <li>المستويات التالية عند عبورك</li>}</ul>{a.vat.rate > 0 && <span>{AR2.format(t.subtotal)} + ضريبة {AR2.format(t.vat)} = {AR2.format(t.total)} ر.س</span>}</div>} />
                    <button type="button" className={`iqs-btn ${best ? 'primary' : ''} wide`} onClick={() => void buy(p.code)} disabled={!!busy} data-testid={`iqs-buy-${p.code}`}>{busy === p.code ? 'نصدر فاتورتك…' : `اختر ${p.name_ar}`}</button>
                  </Reveal>; })}
              </div>
              <p className="iqs-muted small">تُصدر فاتورة أَثَر باسمك وتدفعها بالبطاقة أو بالتحويل البنكي. {a.vat.card ? '' : 'الدفع بالبطاقة غير مفعّل حاليًّا — التحويل البنكي متاح.'}</p>
            </section>}
          </>
        )}
        <p className="iqs-foot"><Link href="/iqra">اقْرَأْ</Link> · <Link href="/miaar">مِعيار</Link> · <Link href="/me">صفحتي</Link></p>
      </div>
    </main>
  );
}

function msgOf(e: any): string {
  const m = String(e?.message || e || '');
  if (m === 'level_required') return 'اقْرَأْ يفتح بعد اعتماد مستواك من مِعيار.';
  if (m === 'trial_not_available') return 'التجربة المجانية غير متاحة الآن.';
  if (m === 'plan_not_found') return 'الخطّة غير متاحة.';
  if (m === 'sign_in_required') return 'يرجى تسجيل الدخول أوّلًا.';
  return m;
}
function Steps({ n }: { n: 1 | 2 | 3 }) {
  const S = ['قيّم نفسك', 'اعتماد المستوى', 'مقعدك في اقْرَأْ'];
  return <ol className="iqs-steps" aria-label="خطوات الدخول">{S.map((s, i) => <li key={s} className={i + 1 < n ? 'done' : i + 1 === n ? 'now' : ''}><i>{i + 1}</i><span>{s}</span></li>)}</ol>;
}

const CSS = `
.iqs{min-height:100vh;color:var(--ink-athar,#2A1626)}
.iqs-hero{position:relative;padding:28px 0 8px;overflow:hidden}
.iqs-heroin{position:relative;max-width:980px;margin:0 auto;padding:0 20px}
.iqs-crumb{margin:0 0 6px;font-size:13px;color:#8E7F8A}.iqs-crumb a{color:#D4614A;text-decoration:none}
.iqs h1{margin:0 0 8px;font-size:clamp(26px,4vw,38px);line-height:1.25;background:linear-gradient(90deg,#22101F,#3A1F36 40%,#D4614A 80%,#D9A866);-webkit-background-clip:text;background-clip:text;color:transparent}
.iqs-lead{margin:0;font-size:17px;line-height:1.8;color:#4A3645;max-width:720px}
.iqs-level{display:flex;align-items:center;gap:14px;margin-top:18px;padding:12px 16px;border-radius:18px;background:#fff;border:1px solid #EADFD6;box-shadow:0 10px 30px rgba(42,22,38,.06);max-width:560px}
.iqs-level i{flex:none;width:46px;height:46px;border-radius:50%;background:var(--lvl,linear-gradient(135deg,#D4614A,#D9A866));box-shadow:inset 0 0 0 4px #fff,0 0 0 1px var(--lvl-flat,#D4614A)}
.iqs-level small{display:block;color:#8E7F8A;font-size:12px}.iqs-level b{display:block;font-size:18px;color:var(--lvl-flat,#3A1F36)}.iqs-level span{font-size:13px;color:#5C4858}
.iqs-wrap{max-width:980px;margin:0 auto;padding:10px 20px 48px}
.iqs-card{background:#fff;border:1px solid #EADFD6;border-radius:22px;padding:24px;box-shadow:0 12px 36px rgba(42,22,38,.07);margin-top:18px}
.iqs-center{text-align:center}.iqs-center p{font-size:16px;line-height:1.9;color:#4A3645;margin:8px auto 0;max-width:640px}
.iqs-wait{color:#8E7F8A;text-align:center}
.iqs-err{margin-top:16px;background:#FBEDE7;border:1px solid #F0C9BC;color:#B9544A;border-radius:14px;padding:12px 16px;font-weight:700}
.iqs-acts{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:18px}
.iqs-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 20px;border-radius:999px;border:1px solid #D9CBC2;background:#FBF4EE;color:#3A1F36;font-weight:800;font-size:15px;text-decoration:none;cursor:pointer;transition:transform .35s var(--ease-athar,ease),box-shadow .35s}
.iqs-btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(42,22,38,.12)}.iqs-btn:disabled{opacity:.6;cursor:wait;transform:none}
.iqs-btn.primary{background:linear-gradient(135deg,#D4614A,#E8795C 60%,#D9A866);color:#fff;border-color:transparent;box-shadow:0 8px 22px rgba(212,97,74,.3)}
.iqs-btn.ghost{background:transparent}.iqs-btn.big{padding:14px 28px;font-size:17px}.iqs-btn.wide{width:100%;margin-top:10px}
.iqs-steps{display:flex;justify-content:center;gap:0;list-style:none;margin:0 0 14px;padding:0}
.iqs-steps li{display:flex;align-items:center;gap:8px;color:#B3A5AE;font-size:13px;font-weight:700}
.iqs-steps li+li::before{content:"";width:34px;height:2px;background:#EADFD6;margin:0 10px}
.iqs-steps i{font-style:normal;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:#F3E6DC;color:#8E7F8A;font-size:12px}
.iqs-steps li.done{color:#5C4858}.iqs-steps li.done i{background:#5EA8A0;color:#fff}
.iqs-steps li.now{color:#3A1F36}.iqs-steps li.now i{background:var(--lvl,linear-gradient(135deg,#D4614A,#D9A866));color:#fff;box-shadow:0 0 0 4px #FBEDE7}
.iqs-active,.iqs-trial{position:relative;overflow:hidden}
.iqs-active::after,.iqs-trial::after{content:"";position:absolute;inset:auto -60px -90px auto;width:260px;height:260px;border-radius:50%;background:var(--lvl,linear-gradient(135deg,#D4614A,#D9A866));opacity:.12;pointer-events:none}
.iqs-activein,.iqs-trialin{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap;position:relative}
.iqs-activein small,.iqs-trialin small{display:block;color:#8E7F8A;font-size:12px;font-weight:700}
.iqs-activein b,.iqs-trialin b{display:block;font-size:26px;color:var(--lvl-flat,#3A1F36);margin:2px 0}
.iqs-activein div>span,.iqs-trialin div>span{display:block;color:#5C4858;font-size:14px;max-width:520px;line-height:1.7}
.iqs-hint{margin:12px 0 0;color:#8A5A1E;font-size:13px}
.iqs-expired{border-color:#F0C9BC}
.iqs-plans{margin-top:26px}.iqs-plans h2{margin:10px 0 4px;font-size:24px;color:#3A1F36;text-align:center}
.iqs-muted{color:#8E7F8A;text-align:center;margin:0 0 16px;font-size:14px}.iqs-muted.small{font-size:12px;margin-top:14px}
.iqs-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.iqs-plan .ath-flip{width:100%;border:0;background:transparent;padding:0;cursor:pointer;text-align:start}
.iqs-face{height:100%;min-height:210px;box-sizing:border-box;padding:20px;border-radius:20px;background:#fff;border:1px solid #EADFD6;box-shadow:0 12px 30px rgba(42,22,38,.07);display:flex;flex-direction:column;gap:4px;border-top:5px solid var(--lvl-flat,#D4614A)}
.iqs-face small{color:#8A5A1E;font-weight:800;font-size:12px}.iqs-face b{font-size:20px;color:#3A1F36}.iqs-face strong{font-size:30px;color:var(--lvl-flat,#D4614A);letter-spacing:-.01em}
[data-level="PRE_A1"] .iqs-face strong,[data-level="PRE_A1"] .iqs-level b,[data-level="PRE_A1"] .iqs-activein b,[data-level="PRE_A1"] .iqs-trialin b{color:#8A5A1E}
.iqs-face span{color:#8E7F8A;font-size:13px}.iqs-face em{margin-top:auto;font-style:normal;color:#B3A5AE;font-size:12px;align-self:flex-end}
.iqs-face.back{background:linear-gradient(160deg,#FBF4EE,#fff)}.iqs-face.back p{margin:0;color:#4A3645;line-height:1.7;font-size:14px}
.iqs-face.back ul{margin:6px 0 0;padding:0 18px 0 0;color:#3A1F36;font-size:13px;line-height:1.8}
.iqs-foot{margin-top:32px;text-align:center;color:#B3A5AE;font-size:13px}.iqs-foot a{color:#8E7F8A;text-decoration:none}
@media(max-width:860px){.iqs-grid{grid-template-columns:1fr}.iqs-steps li span{display:none}.iqs-steps li.now span{display:inline}}
@media(prefers-reduced-motion:reduce){.iqs-btn{transition:none}}
`;
