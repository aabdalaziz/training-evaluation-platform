'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /g/<ATH-GD-XXXX-XXXX> — الوجه العام لـ«صفحة التخرّج الذاتية» (P63): يظهر فقط إن فتحه صاحبه، وبما اختاره هو — الافتراضي سطر التخرّج والأعداد.
 *  لا درجة ولا مستوى ولا جهة ولا مقارنة. صوت صاحبه لا يظهر أبدًا. «منذ ذلك اليوم» أعداد حيّة إن اختارها. المُبطل يُقال عنه «أُبطلت» فورًا.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

type Card = { key: string; title_ar: string; text_ar: string | null; at: string | null; items?: { text_ar: string; at: string; state_ar?: string | null }[]; href?: string | null; state_ar?: string | null };
type Face = { code: string; program_ar: string; end: string; sealed_at: string; name: string | null; line_ar: string | null; counts: { threads: number; replies: number; amanat: number; chapters: number; days: number } | null; cards: Card[]; since_ar: string[] | null; revoked: boolean; intact: boolean };
type R = { success: boolean; valid: boolean; revoked?: boolean; replaced?: boolean; public?: boolean; face?: Face | null; code?: string };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'long') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');

export default function PublicGradPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const params = useParams<{ code: string }>(); const code = String(params?.code || '').toUpperCase();
  const [r, setR] = useState<R | null>(null); const [err, setErr] = useState('');
  useEffect(() => { if (!code) return; fetch(`/api/verify/grad?code=${encodeURIComponent(code)}&face=1`, { cache: 'no-store' }).then(async (x) => { const b = await x.json().catch(() => null); if (b?.success) setR(b); else setErr('تعذّر فتح الصفحة'); }).catch(() => setErr('تعذّر فتح الصفحة')); }, [code]);
  const f = r?.face || null; const gone = r && (!r.valid || !r.public || !f) && !(r.revoked && f);
  return <main className="pg" dir="rtl" data-testid="pg-root" data-state={!r ? 'loading' : r.revoked ? 'revoked' : gone ? 'gone' : 'ok'}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    {!r && !err && <section className="pt-box"><p className="pg-muted">نفتح الصفحة…</p></section>}
    {(err || (r && r.revoked)) && <section className="pt-box pg-gone" data-testid="pg-revoked"><Icon name="alert" size={26} /><b>{err || (r?.replaced ? 'أُبطل هذا الرمز — ختم صاحبه صفحته ختمًا أحدث.' : 'أُبطلت هذه الصفحة — أبطلها صاحبها.')}</b><p className="pg-muted">الصفحات ملك أصحابها: تُبطل فورًا حين يقرّرون، ويُعلَن الإبطال لمن يتحقّق بالرمز.</p><p><Link href={`/verify/grad?code=${encodeURIComponent(code)}`} className="pt-btn ghost small">تحقّق بالرمز</Link></p></section>}
    {r && !r.revoked && gone && <section className="pt-box pg-gone" data-testid="pg-gone"><Icon name="shield" size={26} /><b>{r.valid ? 'هذه الصفحة خاصّة بصاحبها.' : 'لا توجد صفحة بهذا الرمز.'}</b><p className="pg-muted">{r.valid ? 'خُتمت وبصمتها سليمة، لكن صاحبها لم يفتح وجهها العام. يمكنك التحقّق من الختم بالرمز.' : 'تأكّد من الرمز (ATH-GD-XXXX-XXXX).'}</p><p><Link href={`/verify/grad?code=${encodeURIComponent(code)}`} className="pt-btn ghost small">تحقّق بالرمز</Link></p></section>}
    {r && !r.revoked && !gone && f && <>
      <header className="pg-head"><span className="pg-kicker"><Icon name="award" size={14} /> صفحة تخرّج ذاتية — كتبها صاحبها بنفسه</span>
        <h1>🎓 {f.name ? `${f.name} — ` : ''}{f.program_ar}</h1>
        <p className="pg-muted">انتهى {fmt(`${f.end}T00:00:00Z`)} · خُتمت {fmt(f.sealed_at, 'medium')}{!f.intact ? ' · ⚠ البصمة لا تطابق' : ''}</p></header>
      {f.line_ar && <blockquote className="pg-line" data-testid="pg-line">«{f.line_ar}»</blockquote>}
      {f.counts && <p className="pg-counts" data-testid="pg-counts">{f.counts.days > 0 && <span>📅 {f.counts.days} يومًا</span>}{f.counts.threads > 0 && <span>🧵 {f.counts.threads} خيوط</span>}{f.counts.replies > 0 && <span>💬 {f.counts.replies} ردود</span>}{f.counts.chapters > 0 && <span>📖 {f.counts.chapters} فصول</span>}{!f.counts.days && !f.counts.threads && !f.counts.replies && !f.counts.chapters && <span>سطر واحد — يكفي</span>}</p>}
      {f.cards.length > 0 && <section className="pg-cards" data-testid="pg-cards">{f.cards.map((c) => <article key={c.key} className={`pg-card k-${c.key}`} data-key={c.key}><b>{c.title_ar}</b>{c.text_ar && <p>{c.text_ar}</p>}{c.items && <ul>{c.items.map((it, i) => <li key={i}>{it.state_ar ? <b>{it.state_ar} · </b> : null}{it.text_ar}</li>)}</ul>}{c.href && c.key === 'map_code' && <Link href={c.href}>تحقّق من اللقطة ←</Link>}</article>)}</section>}
      {f.since_ar && f.since_ar.length > 0 && <section className="pg-since" data-testid="pg-since"><b>منذ ذلك اليوم</b><ul>{f.since_ar.map((l, i) => <li key={i}>{l}</li>)}</ul></section>}
      <footer className="pg-foot"><p>ما كتبه المشارك بيده في برنامجه — لا درجة، لا مستوى، لا تقييم، لا ذكاء اصطناعي. يُثبت الختم أن النصّ لم يتغيّر منذ {fmt(f.sealed_at, 'medium')}؛ وما بعده يُعدّ حيًّا لا مختومًا.</p><p><Link href={`/verify/grad?code=${encodeURIComponent(f.code)}`}>تحقّق بالرمز {f.code}</Link> · <Link href="/">أَثَر</Link></p></footer>
    </>}
  </main>;
}
const CSS = `
.pg{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626;max-width:820px;margin:0 auto;padding:26px 16px 60px;overflow-wrap:anywhere;min-width:0}.pg *{box-sizing:border-box}
.pg-muted{color:#8E7F8A;font-size:13px;line-height:1.8;margin:4px 0}.pg-kicker{display:inline-flex;gap:6px;align-items:center;color:#8A5A1E;font-weight:800;font-size:13px}
.pg-head h1{margin:6px 0 4px;font-size:28px;color:#3A1F36;line-height:1.5}
.pg-line{margin:18px 0;padding:18px 22px;background:linear-gradient(160deg,#FBF4EE,#FBF4EE);border:1px solid #F1D9A8;border-radius:18px;font-size:22px;line-height:1.9;color:#3b1d0e;font-weight:700}
.pg-counts{display:flex;gap:14px;flex-wrap:wrap;color:#5C4858;font-weight:700;font-size:14px}
.pg-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:14px 0}.pg-card{border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;background:#fff;min-width:0}.pg-card b{display:block;color:#3A1F36;font-size:14px;margin-bottom:6px}.pg-card p{margin:0;font-size:15px;line-height:1.9;color:#3b1d0e;font-weight:600}.pg-card ul{margin:0;padding:0 16px 0 0;line-height:1.8;font-size:14px}.pg-card.k-farewell{background:linear-gradient(160deg,#FBF4EE,#fff);border-color:#E9C98A}.pg-card a{display:inline-block;margin-top:6px;color:#3A1F36;font-weight:800}
.pg-since{border:1px dashed #D9CBC2;border-radius:14px;padding:12px 16px;margin:14px 0}.pg-since b{color:#3A1F36}.pg-since ul{margin:6px 0 0;padding:0 18px 0 0;line-height:1.9}
.pg-gone{display:grid;justify-items:start;gap:6px;max-width:560px;margin:0 auto}.pg-gone b{font-size:18px;color:#3A1F36}
.pg-foot{color:#B3A5AE;font-size:12px;line-height:1.8;border-top:1px dashed #EADFD6;padding-top:10px;margin-top:16px}.pg-foot a{color:#3A1F36;font-weight:800}
@media (max-width:640px){.pg-head h1{font-size:22px}.pg-line{font-size:18px}}
`;
