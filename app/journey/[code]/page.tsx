'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /journey/<ATH-J-XXXX-XXXX> — النسخة العامة من «رحلة الممارس» (P25): الفصول التي اختار صاحبها كشفها فقط، بترتيبها الزمني، مع كلماته إن سمح،
 *  ورابط التحقق المستقل من الوثيقة الموقَّعة. لا جهات، لا مقارنات، لا أرقام سوى التواريخ والمستويات المعتمدة. تنتهي بعد 12 شهرًا أو حين يلغيها صاحبها.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Icon, type IconName } from '../../../lib/ui/icons';
import { PortalShell } from '../../components/PortalShell';

type Ch = { key: string; kind: string; at: string; title_ar: string; what_ar: string; quote_ar: string | null; level: { skill_ar: string; to: number; from: number | null } | null };
type J = { code: string; name: string; intro_ar: string | null; chapters: Ch[]; created_at: string; expires_at: string; version: string; verify_url: string | null; views: number; note_ar: string };
const fmt = (iso: string | null | undefined, style: 'medium' | 'long' = 'long') => (iso ? new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: style }) : '—');
const KIND_ICON: Record<string, IconName> = { placement: 'compass', daily: 'calendar', simulation: 'play', mission: 'flag', council: 'users', return: 'refresh', attestation: 'star', level: 'trend', credential: 'certificate', badge: 'award' };
const KIND_AR: Record<string, string> = { placement: 'تحديد المستوى', daily: 'كل يوم مهارة', simulation: 'محاكاة', mission: 'مهمة ميدانية أكّدها المشرف', council: 'مجلس أقران', return: 'عودة بعد التزام', attestation: 'شهادة قرين معتمدة', level: 'مستوى اعتمده إنسان', credential: 'اعتماد', badge: 'شارة' };
const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { month: 'long', year: 'numeric' });

export default function PublicJourneyPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const params = useParams<{ code: string }>(); const code = String(params?.code || '').toUpperCase();
  const [j, setJ] = useState<J | null>(null); const [err, setErr] = useState(''); const [status, setStatus] = useState(0);
  useEffect(() => { if (!code) return; fetch(`/api/journey?code=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(async r => { const b = await r.json().catch(() => null); setStatus(r.status); if (b?.success) setJ(b); else setErr(b?.error || 'تعذّر فتح الرحلة'); }).catch(() => setErr('انقطع الاتصال')); }, [code]);
  const eras: { label: string; items: Ch[] }[] = []; for (const c of j?.chapters || []) { const l = monthLabel(c.at); const last = eras[eras.length - 1]; if (last && last.label === l) last.items.push(c); else eras.push({ label: l, items: [c] }); }
  return (
    <main className="pj" dir="rtl"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {!j && !err && <section className="pt-box"><p className="pj-muted">نفتح الرحلة…</p></section>}
      {err && <section className="pt-box pj-gone" data-testid="gone"><Icon name={status === 410 ? 'clock' : 'alert'} size={26} /><b>{err}</b><p className="pj-muted">{status === 410 ? 'النسخ المشتركة ملك أصحابها: تنتهي بعد مدتها أو حين يقرر صاحبها إلغاءها.' : 'تحقق من الرابط أو اطلب من صاحب الرحلة رابطًا جديدًا.'}</p><Link href="/" className="pt-btn ghost small">إلى أَثَر</Link></section>}
      {j && (<>
        <header className="pj-head" data-testid="pj-head"><span className="pt-kicker"><Icon name="compass" size={14} /> رحلة ممارس · أَثَر</span><h1>{j.name}</h1>
          <p className="pj-arc">{j.chapters.length} فصلًا اختار صاحبها كشفها · من {fmt(j.chapters[0]?.at)} إلى {fmt(j.chapters[j.chapters.length - 1]?.at)}</p>
          {j.intro_ar && <blockquote className="pj-intro">{j.intro_ar}<small>بكلمات صاحب الرحلة</small></blockquote>}
          <div className="pj-trust"><span><Icon name="check" size={13} /> {j.note_ar}</span>{j.verify_url ? <a href={j.verify_url} className="pj-verify" data-testid="verify"><Icon name="shield" size={13} /> تحقّق من الوثيقة الموقَّعة ({j.code})</a> : <span className="pj-muted">نسخة بلا وثيقة موقَّعة</span>}</div>
        </header>
        <section className="pj-river" data-testid="pj-river">
          {eras.map(e => (<div key={e.label} className="pj-era"><h2 className="pj-eralabel"><span>{e.label}</span></h2>
            {e.items.map(c => (<article key={c.key} className={`pj-ch ${c.kind}`} data-testid="pj-chapter">
              <div className="pj-dot"><Icon name={KIND_ICON[c.kind] || 'doc'} size={15} /></div>
              <div className="pj-card"><div className="pj-chhead"><span className="pj-kind">{KIND_AR[c.kind] || c.kind}</span><time>{fmt(c.at)}</time></div>
                <h3>{c.title_ar}</h3><p className="pj-what">{c.what_ar}</p>
                {c.level && <p className="pj-level"><Icon name="trend" size={13} /> {c.level.skill_ar}: {c.level.from !== null ? <>{c.level.from} ← {c.level.to}</> : <>المستوى {c.level.to}</>}</p>}
                {c.quote_ar && <blockquote className="pj-quote">«{c.quote_ar}»<small>بكلماته يومها</small></blockquote>}
              </div></article>))}
          </div>))}
        </section>
        <footer className="pj-foot"><p>صدرت {fmt(j.created_at)} · صالحة حتى {fmt(j.expires_at)} · الإصدار {j.version}</p><p>ما ترونه هنا هو ما اختار صاحبه أن تروه؛ الفصول غير المكشوفة ليست غيابًا. <Link href="/">أَثَر</Link> · <Link href="/verify/vc">التحقق المستقل</Link></p></footer>
      </>)}
    </main>
  );
}

const CSS = `
.pj{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:860px;margin:0 auto;padding:28px 18px 60px}
.pj-muted{color:#64748b;font-size:13px;line-height:1.8}.pj-gone{text-align:center;color:#334155}.pj-gone b{display:block;margin:8px 0 4px;color:#0f2a4e;font-size:18px}
.pj-head{background:linear-gradient(135deg,#0f2a4e,#123a66);color:#fff;border-radius:22px;padding:24px;margin:0 0 18px}.pj-head h1{margin:4px 0 6px;font-size:30px}.pj-arc{margin:0;color:#cbd5e1}
.pj-intro{margin:14px 0 0;padding:12px 16px;border-inline-start:3px solid #c9a24b;background:rgba(255,255,255,.08);border-radius:0 12px 12px 0;line-height:1.95;font-size:15px;white-space:pre-wrap}.pj-intro small{display:block;color:#cbd5e1;font-size:11px;margin-top:6px}
.pj-trust{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:14px;font-size:12px;color:#e2e8f0}.pj-trust span{display:inline-flex;gap:5px;align-items:center}.pj-verify{display:inline-flex;gap:5px;align-items:center;background:#c9a24b;color:#0f2a4e;border-radius:999px;padding:5px 12px;font-weight:900;text-decoration:none}
.pj-river{padding-inline-start:8px}.pj-era{position:relative;padding-inline-start:34px;margin-bottom:10px}.pj-era::before{content:'';position:absolute;inset-inline-start:15px;top:0;bottom:0;width:2px;background:linear-gradient(#c9a24b,#0b8a83)}
.pj-eralabel{margin:18px 0 10px;font-size:14px;color:#0b8a83}.pj-eralabel span{background:#fff;border:1px solid #0b8a83;border-radius:999px;padding:3px 12px;position:relative;inset-inline-start:-34px}
.pj-ch{position:relative;display:flex;margin:0 0 14px}.pj-dot{position:absolute;inset-inline-start:-34px;top:14px;width:32px;height:32px;border-radius:50%;background:#fff;border:2px solid #0b8a83;display:flex;align-items:center;justify-content:center;color:#0b8a83;box-shadow:0 0 0 4px #fff}
.pj-ch.level .pj-dot,.pj-ch.credential .pj-dot,.pj-ch.badge .pj-dot{border-color:#c9a24b;color:#9a7420}.pj-ch.council .pj-dot,.pj-ch.return .pj-dot,.pj-ch.attestation .pj-dot{border-color:#0f2a4e;color:#0f2a4e}
.pj-card{flex:1;background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:14px 18px;animation:pjIn .5s ease both}@keyframes pjIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.pj-chhead{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#64748b}.pj-kind{background:#f1f5f9;border-radius:999px;padding:2px 10px;font-weight:800;color:#0f2a4e}
.pj-card h3{margin:6px 0 4px;font-size:17px;color:#0f2a4e}.pj-what{margin:0;line-height:1.85;color:#334155;font-size:14px}.pj-level{display:inline-flex;gap:6px;align-items:center;margin:8px 0 0;background:#fdf6e3;color:#7c5a10;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:800}
.pj-quote{margin:10px 0 0;padding:10px 14px;border-inline-start:3px solid #c9a24b;background:#fffdf7;border-radius:0 10px 10px 0;line-height:1.9;font-size:14px}.pj-quote small{display:block;color:#94a3b8;font-size:11px;margin-top:4px}
.pj-foot{margin-top:24px;font-size:12px;color:#64748b;line-height:1.9;text-align:center}.pj-foot p{margin:4px 0}
`;
