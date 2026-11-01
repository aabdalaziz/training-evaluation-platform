'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /on-air/week — «جدار الأسبوع» (P37 عُمر الهواء):
 *  أسئلة الأسابيع الماضية التي أجاب عنها من كان على الهواء — بالدور لا بالاسم. السؤال الذي لم يُجَب عنه لا يُعلَّق؛ ما أخفاه الطاقم لا يظهر؛
 *  «أفادت صاحبها ✓» يضعها كاتب الأمانة وحده من /me/onair. صفحة عامة. WCAG 2.2 AA: عناوين مرتبة · تفاصيل قابلة للفتح بلوحة المفاتيح · لا حركة.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { P37_NAMES_AR, P36_NAMES_AR } from '../../../lib/onair/registry';

export default function WeekWallPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { let alive = true; fetch('/api/onair?week_wall=1', { cache: 'no-store' }).then(r => r.json()).then(j => { if (!alive) return; if (j?.success) setD(j); else setErr(j?.error || 'تعذّر التحميل'); }).catch(() => alive && setErr('تعذّر التحميل')); return () => { alive = false; }; }, []);
  const wall: any[] = d?.wall || [];
  return <main className="pt-main oww" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <header className="oww-h"><span className="pt-kicker"><Icon name="chat" size={14} /> {ar ? `أَثَر معك — ${P37_NAMES_AR.continuity}` : 'Athar with you — Continuity of the Air'}</span>
      <h1>{ar ? `${P37_NAMES_AR.wall} — ما أجاب عنه الهواء` : 'Week Wall — what the air answered'}</h1>
      <p>{ar ? `كل «${P36_NAMES_AR.week_question}» يُطوى بعد أسبوعه، لكن إجاباته لا تُطوى: هنا تبقى معلَّقة بالدور لا بالاسم — «مدرّبٌ على الهواء»، «خبيرةٌ على الهواء» — ليقرأها من يأتي بعد شهر أو سنة بالسؤال نفسه. والعلامة «أفادت صاحبها ✓» لا يضعها إلا من كتب الأمانة أصلًا.` : 'Past Questions of the Week with their answers, by role not by name; the «helped its owner» mark is set only by the original asker.'}</p>
      {d && <p className="oww-line" data-testid="oww-line">{d.line_ar}</p>}
      {err && <p className="oww-err" role="alert">{err}</p>}
    </header>
    <section className="pt-box">
      {!d && !err && <p className="pt-muted">…</p>}
      {d && !wall.length && <p className="pt-muted" data-testid="oww-none">{ar ? 'الجدار فارغ بعد — أول سؤال أسبوع يُجاب عنه ثم يُطوى يُعلَّق هنا.' : 'The wall is empty — the first answered question will hang here.'} <Link href="/on-air#week">{ar ? 'سؤال هذا الأسبوع' : 'This week’s question'}</Link></p>}
      <ol className="oww-list" data-testid="oww-list">{wall.map(q => <li key={q.id} data-testid="oww-item" data-helped={q.helped ? '1' : '0'}>
        <details open={wall.length <= 3}><summary><b>{q.text_ar}</b><span className="oww-meta">{q.week_start ? <>{ar ? 'أسبوع' : 'week'} {q.week_start} · </> : null}{q.n} {ar ? (q.n === 1 ? 'إجابة' : q.n === 2 ? 'إجابتان' : q.n <= 10 ? 'إجابات' : 'إجابة') : 'answers'}{q.domain ? <> · {q.domain}</> : null}{q.helped && <em className="oww-helped" data-testid="oww-helped"> · أفادت صاحبها ✓</em>}</span></summary>
          <ul className="oww-ans">{q.answers.map((a: any) => <li key={a.id}><span className="oww-role">{a.role_label_ar}</span><p>{a.text_ar}</p></li>)}</ul>
        </details></li>)}</ol>
      <p className="pt-muted">{d?.note_ar}</p>
      <p><Link href="/on-air" className="pt-btn ghost small">{ar ? 'صفحة الهواء' : 'On-air page'}</Link> <Link href="/on-air/seasons" className="pt-btn ghost small">{ar ? P36_NAMES_AR.record : 'Season records'}</Link> <Link href="/accessibility" className="pt-btn ghost small">{ar ? 'بيان الوصول' : 'Accessibility'}</Link></p>
    </section>
  </main>;
}
const CSS = `
.oww{max-width:900px;margin:0 auto;padding:28px 18px 60px}.oww-h h1{margin:6px 0 8px;font-size:28px;color:#0f2a4e}.oww-h p{color:#334155;line-height:1.9;margin:0 0 12px;font-size:16px}.oww-err{color:#b91c1c;font-weight:800}
.oww-line{background:#0f2a4e;color:#fde68a;border-radius:999px;padding:6px 14px;display:inline-block;font-weight:800;margin:0 0 10px}
.oww-list{list-style:none;margin:0 0 12px;padding:0;display:grid;gap:10px}.oww-list details{border:1px solid #e2e8f0;border-radius:14px;padding:4px 14px;background:#fff}.oww-list details[open]{border-color:#0b6f69}
.oww-list summary{cursor:pointer;min-height:44px;display:grid;gap:4px;padding:10px 0;color:#0f2a4e}.oww-list summary:focus-visible{outline:3px solid #0b6f69;outline-offset:2px;border-radius:8px}.oww-list summary b{font-size:16px;line-height:1.7}.oww-meta{color:#475569;font-size:13px}.oww-helped{color:#166534;font-style:normal;font-weight:800}
.oww-ans{list-style:none;margin:0 0 10px;padding:0;display:grid;gap:8px}.oww-ans li{background:#f8fafc;border-radius:12px;padding:10px 12px}.oww-role{display:inline-block;background:#e0f2f1;color:#0b6f69;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:800;margin-bottom:4px}.oww-ans p{margin:0;color:#1e293b;line-height:1.8;white-space:pre-wrap}
`;
