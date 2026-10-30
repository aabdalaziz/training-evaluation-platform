'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /org-journey/<ATH-OY-XXXX-XXXX> — «كتاب السنة» العام (P26 رحلة الجهة): الفصول التي اختارت الجهة نشرها فقط، بترتيب حقبها (أرباع السنة)،
 *  بأعداد أشخاص وكلمات الجهة («ما تغيّر فينا») — لا أسماء، لا نصوص أفراد، لا فصل من أقل من خمسة، لا مقارنة بجهة أخرى.
 *  رابط التحقق المستقل من الوثيقة الموقَّعة. ينتهي بعد 12 شهرًا أو حين تسحبه الجهة.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon, type IconName } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

type Ch = { key: string; kind: string; quarter: string; quarter_ar: string; at: string; people: number | null; title_ar: string; what_ar: string; theme_ar: string | null; note_ar: string | null };
type Y = { code: string; org_name: string; year_label: string; intro_ar: string | null; chapters: Ch[]; created_at: string; expires_at: string; version: string; verify_url: string | null; views: number; k: number; note_ar: string };
const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'long' }) : '—');
const KIND_ICON: Record<string, IconName> = { daily: 'calendar', mission: 'flag', council: 'users', return: 'refresh', attestation: 'star', level: 'trend', credential: 'certificate', charter: 'shield', twinning: 'link', contract: 'doc' };

export default function PublicYearbookPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const params = useParams<{ code: string }>(); const code = String(params?.code || '').toUpperCase();
  const [y, setY] = useState<Y | null>(null); const [err, setErr] = useState(''); const [status, setStatus] = useState(0);
  useEffect(() => { if (!code) return; fetch(`/api/org/journey?code=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(async r => { const b = await r.json().catch(() => null); setStatus(r.status); if (b?.success) setY(b); else setErr(b?.error || 'تعذّر فتح الكتاب'); }).catch(() => setErr('انقطع الاتصال')); }, [code]);
  const eras: { label: string; items: Ch[] }[] = []; for (const c of y?.chapters || []) { const last = eras[eras.length - 1]; if (last && last.label === c.quarter_ar) last.items.push(c); else eras.push({ label: c.quarter_ar, items: [c] }); }
  const people = (y?.chapters || []).reduce((m, c) => Math.max(m, c.people || 0), 0);
  return (
    <main className="oy" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!y && !err && <section className="pt-box"><p className="oy-muted">نفتح الكتاب…</p></section>}
      {err && <section className="pt-box oy-gone" data-testid="gone"><Icon name={status === 410 ? 'clock' : 'alert'} size={26} /><b>{err}</b><p className="oy-muted">{status === 410 ? 'كتب السنة ملك جهاتها: تنتهي بعد مدتها أو حين تقرر الجهة سحبها.' : 'تحقق من الرابط أو اطلب من الجهة رابطًا جديدًا.'}</p><Link href="/councils" className="pt-btn ghost small">رفّ كتب السنة</Link></section>}
      {y && (<>
        <header className="oy-head" data-testid="oy-head"><span className="pt-kicker"><Icon name="compass" size={14} /> كتاب السنة · أَثَر</span><h1>{y.org_name}</h1><p className="oy-year">{y.year_label}</p>
          <p className="oy-arc">{y.chapters.length} فصلًا اختارت الجهة نشرها · {eras.length} {eras.length === 1 ? 'حقبة' : 'حقب'}{people ? <> · أكبر فصل {people} شخصًا</> : null}</p>
          {y.intro_ar && <blockquote className="oy-intro">{y.intro_ar}<small>بكلمات الجهة</small></blockquote>}
          <div className="oy-trust"><span><Icon name="check" size={13} /> {y.note_ar}</span>{y.verify_url ? <a href={y.verify_url} className="oy-verify" data-testid="verify"><Icon name="shield" size={13} /> تحقّق من الوثيقة الموقَّعة ({y.code})</a> : <span className="oy-muted">كتاب بلا وثيقة موقَّعة</span>}</div>
        </header>
        <section className="oy-river" data-testid="oy-river">
          {eras.map(e => (<div key={e.label} className="oy-era"><h2 className="oy-eralabel"><span>{e.label}</span></h2>
            {e.items.map(c => (<article key={c.key} className={`oy-ch ${c.kind}`} data-testid="oy-chapter">
              <div className="oy-dot"><Icon name={KIND_ICON[c.kind] || 'doc'} size={15} /></div>
              <div className="oy-card"><div className="oy-chhead"><span className="oy-kind">{c.people !== null ? <><b>{c.people}</b> أشخاص</> : 'على مستوى الجهة'}</span><time>{fmt(c.at)}</time></div>
                <h3>{c.title_ar}</h3><p className="oy-what">{c.what_ar}</p>
                {c.theme_ar && <p className="oy-theme"><Icon name="folder" size={12} /> {c.theme_ar}</p>}
                {c.note_ar && <blockquote className="oy-quote">{c.note_ar}<small>ما تغيّر فينا — بكلمات الجهة</small></blockquote>}
              </div></article>))}
          </div>))}
        </section>
        <footer className="oy-foot"><p>صدر {fmt(y.created_at)} · صالح حتى {fmt(y.expires_at)} · الإصدار {y.version} · لا فصل من أقل من {y.k} أشخاص</p><p>ما ترونه هنا هو ما اختارت الجهة أن تروه؛ الفصول غير المنشورة ليست غيابًا. <Link href="/councils">رفّ كتب السنة</Link> · <Link href="/verify/vc">التحقق المستقل</Link> · <Link href="/">أَثَر</Link></p></footer>
      </>)}
    </main>
  );
}

const CSS = `
.oy{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:860px;margin:0 auto;padding:28px 18px 60px}
.oy-muted{color:#64748b;font-size:13px;line-height:1.8}.oy-gone{text-align:center;color:#334155}.oy-gone b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:18px}
.oy-head{background:linear-gradient(135deg,#0f2a4e,#0b8a83);color:#fff;border-radius:22px;padding:24px;margin:0 0 18px}.oy-head h1{margin:4px 0 0;font-size:30px}.oy-year{margin:0 0 6px;color:#c9a24b;font-weight:900;font-size:22px;letter-spacing:.5px}.oy-arc{margin:0;color:#cbd5e1}
.oy-intro{margin:14px 0 0;padding:12px 16px;border-inline-start:3px solid #c9a24b;background:rgba(255,255,255,.08);border-radius:0 12px 12px 0;line-height:1.95;font-size:15px;white-space:pre-wrap}.oy-intro small{display:block;color:#cbd5e1;font-size:11px;margin-top:6px}
.oy-trust{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:14px;font-size:12px;color:#e2e8f0}.oy-trust span{display:inline-flex;gap:5px;align-items:center}.oy-verify{display:inline-flex;gap:5px;align-items:center;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:5px 12px;font-weight:900;text-decoration:none}
.oy-river{padding-inline-start:8px}.oy-era{position:relative;padding-inline-start:34px;margin-bottom:10px}.oy-era::before{content:'';position:absolute;inset-inline-start:15px;top:0;bottom:0;width:2px;background:linear-gradient(#c9a24b,#0b8a83)}
.oy-eralabel{margin:18px 0 10px;font-size:14px;color:#0b8a83}.oy-eralabel span{background:#fff;border:1px solid #0b8a83;border-radius:999px;padding:3px 12px;position:relative;inset-inline-start:-34px}
.oy-ch{position:relative;display:flex;margin:0 0 14px}.oy-dot{position:absolute;inset-inline-start:-34px;top:14px;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #0b8a83;display:flex;align-items:center;justify-content:center;color:#0b8a83;box-shadow:0 0 0 4px #fff}
.oy-ch.level .oy-dot,.oy-ch.credential .oy-dot,.oy-ch.charter .oy-dot{border-color:#c9a24b;color:#9a7420}.oy-ch.council .oy-dot,.oy-ch.return .oy-dot,.oy-ch.attestation .oy-dot,.oy-ch.twinning .oy-dot{border-color:#0f2a4e;color:#0f2a4e}
.oy-card{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px 18px;animation:oyIn .5s ease both}@keyframes oyIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.oy-chhead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#64748b}.oy-kind{background:#f1f5f9;border-radius:999px;padding:2px 10px;font-weight:800;color:#0f2a4e}.oy-kind b{font-size:14px;color:#0b8a83}
.oy-card h3{margin:6px 0 4px;font-size:17px;color:#0f2a4e}.oy-what{margin:0;line-height:1.85;color:#334155;font-size:14px}.oy-theme{display:inline-flex;gap:6px;align-items:center;margin:8px 0 0;background:#f0fdfa;color:#0b5a56;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.oy-quote{margin:10px 0 0;padding:10px 14px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.9;font-size:14px;white-space:pre-wrap}.oy-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.oy-foot{margin-top:24px;font-size:12px;color:#64748b;line-height:1.9;text-align:center}.oy-foot p{margin:4px 0}
`;
