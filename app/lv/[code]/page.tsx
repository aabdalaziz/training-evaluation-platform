'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /lv/<ATH-LV-XXXX-XXXX> — الوجه العام لـ«صفحة المستوى — بكلمات المتدرّب» (P70): يظهر فقط إن فتحه صاحبه، وبما اختاره هو — الافتراضي سطر المستوى والأعداد.
 *  لا درجة ولا نسبة ولا قرار عبور ولا جهة. صوت صاحبه ونصّ اختباره لا يظهران أبدًا. المُبطل يُقال عنه «أُبطلت» فورًا.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

type Card = { key: string; title_ar: string; text_ar: string | null; at: string | null; items?: { text_ar: string; at: string; state_ar?: string | null }[]; state_ar?: string | null };
type Face = { code: string; program_ar: string; level_no: number; from: string; to: string; sealed_at: string; name: string | null; line_ar: string | null; counts: { day_lines: number; apply_lines: number; commits: number; commits_done: number; training_days: number; apply_weeks: number } | null; cards: Card[]; revoked: boolean; intact: boolean };
type R = { success: boolean; valid: boolean; revoked?: boolean; replaced?: boolean; public?: boolean; face?: Face | null; code?: string };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'long') => (iso ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');

export default function PublicLevelPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const params = useParams<{ code: string }>(); const code = String(params?.code || '').toUpperCase();
  const [r, setR] = useState<R | null>(null); const [err, setErr] = useState('');
  useEffect(() => { if (!code) return; fetch(`/api/verify/level?code=${encodeURIComponent(code)}&face=1`, { cache: 'no-store' }).then(async (x) => { const b = await x.json().catch(() => null); if (b?.success) setR(b); else setErr('تعذّر فتح الصفحة'); }).catch(() => setErr('تعذّر فتح الصفحة')); }, [code]);
  const f = r?.face || null; const gone = r && (!r.valid || !r.public || !f) && !(r.revoked && f);
  return <main className="pl" dir="rtl" data-testid="pl-root" data-state={!r ? 'loading' : r.revoked ? 'revoked' : gone ? 'gone' : 'ok'}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    {!r && !err && <section className="pt-box"><p className="pl-muted">نفتح الصفحة…</p></section>}
    {(err || (r && r.revoked)) && <section className="pt-box pl-gone" data-testid="pl-revoked"><Icon name="alert" size={26} /><b>{err || (r?.replaced ? 'أُبطل هذا الرمز — ختم صاحبه صفحته ختمًا أحدث.' : 'أُبطلت هذه الصفحة — أبطلها صاحبها.')}</b><p className="pl-muted">الإبطال فوري ومعلَن. <Link href="/verify/level">تحقّق برمز آخر</Link></p></section>}
    {r && !r.revoked && gone && <section className="pt-box pl-gone" data-testid="pl-gone"><Icon name="shield" size={26} /><b>{r.valid ? 'هذه الصفحة خاصّة بصاحبها.' : 'لا توجد صفحة بهذا الرمز.'}</b><p className="pl-muted">{r.valid ? 'خُتمت وبصمتها سليمة، لكن صاحبها لم يفتح وجهها العام. يمكنك التحقّق من صحّتها فقط: ' : ''}<Link href={`/verify/level?code=${encodeURIComponent(code)}`}>/verify/level</Link></p></section>}
    {r && !r.revoked && !gone && f && <>
      <header className="pl-head"><span className="pl-kicker"><Icon name="school" size={14} /> صفحة مستوى — كتبها صاحبها بنفسه</span>
        <h1>🪜 {f.name ? `${f.name} — ` : ''}{f.program_ar} : المستوى {f.level_no}</h1>
        <p className="pl-muted">{fmt(f.from)} ← {fmt(f.to)} · خُتمت {fmt(f.sealed_at, 'medium')}{!f.intact ? ' · ⚠ البصمة لا تطابق' : ''}</p></header>
      {f.line_ar && <blockquote className="pl-line" data-testid="pl-line">«{f.line_ar}»</blockquote>}
      {f.counts && <p className="pl-counts" data-testid="pl-counts">{f.counts.training_days > 0 && <span>📅 {f.counts.training_days} يوم تدريب</span>}{f.counts.day_lines > 0 && <span>✍️ {f.counts.day_lines} سطور أيام</span>}{f.counts.apply_lines > 0 && <span>🧭 {f.counts.apply_lines} سطور تطبيق</span>}{f.counts.commits > 0 && <span>🤝 {f.counts.commits_done}/{f.counts.commits} التزامات</span>}</p>}
      {f.cards.length > 0 && <section className="pl-cards" data-testid="pl-cards">{f.cards.map((c) => <article key={c.key} className={`pl-card k-${c.key}`} data-testid="pl-card" data-key={c.key}><b>{c.title_ar}</b>{c.text_ar && <p>{c.text_ar}</p>}{c.items && <ul>{c.items.map((it, i) => <li key={i}>{it.text_ar}{it.state_ar ? <small> · {it.state_ar}</small> : null}</li>)}</ul>}{c.state_ar && <small className="pl-muted">{c.state_ar}</small>}</article>)}</section>}
      <footer className="pl-foot"><p>ما كتبه المتدرّب بيده وقاله في مستواه — لا درجة، لا نسبة، لا قرار عبور، لا ذكاء اصطناعي. يُثبت الختم أن النصّ لم يتغيّر منذ {fmt(f.sealed_at, 'medium')}. <Link href={`/verify/level?code=${encodeURIComponent(f.code)}`}>تحقّق من الرمز {f.code}</Link></p></footer>
    </>}
  </main>;
}
const CSS = `
.pl{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;color:#2A1626;max-width:820px;margin:0 auto;padding:26px 16px 60px;overflow-wrap:anywhere;min-width:0}.pl *{box-sizing:border-box}
.pl-muted{color:#8E7F8A;font-size:13px;line-height:1.8;margin:4px 0}.pl-kicker{display:inline-flex;gap:6px;align-items:center;color:#D4614A;font-weight:800;font-size:13px}
.pl-head h1{margin:6px 0 4px;font-size:28px;color:#3A1F36;line-height:1.5}
.pl-line{margin:18px 0;padding:18px 22px;background:linear-gradient(160deg,#E6F3F1,#FBEDE7);border:1px solid #BFE1DC;border-radius:18px;font-size:22px;line-height:1.9;color:#1F4F4A;font-weight:700}
.pl-counts{display:flex;gap:14px;flex-wrap:wrap;color:#5C4858;font-weight:700;font-size:14px}
.pl-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin:14px 0}.pl-card{border:1px solid #EADFD6;border-radius:14px;padding:12px 14px;background:#fff;min-width:0}.pl-card b{display:block;color:#3A1F36;font-size:14px;margin-bottom:6px}.pl-card p{margin:0;font-size:15px;line-height:1.9;color:#3b1d0e;font-weight:600}.pl-card ul{margin:0;padding:0 16px 0 0;line-height:1.8;font-size:14px}.pl-card li small{color:#B3A5AE;font-size:11px}.pl-card.k-crossed{background:linear-gradient(160deg,#E6F3F1,#fff);border-color:#BFE1DC}
.pl-gone{display:grid;justify-items:start;gap:6px;max-width:560px;margin:0 auto}.pl-gone b{font-size:18px;color:#3A1F36}
.pl-foot{color:#B3A5AE;font-size:12px;line-height:1.8;border-top:1px dashed #EADFD6;padding-top:10px;margin-top:16px}.pl-foot a{color:#3A1F36;font-weight:800}
@media (max-width:640px){.pl-head h1{font-size:22px}.pl-line{font-size:18px}}
`;
