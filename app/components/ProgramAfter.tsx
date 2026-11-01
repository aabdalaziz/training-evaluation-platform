'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P38 «الشهادة التي تكبر» — ثلاثة مكوّنات صغيرة تُعرض في صفحات قائمة:
 *  <ProgramAfter programId>     صفحة البرنامج العامة: «ما قاله من تدرّب هنا» — من خمسة متدرّبين كتبوا محطة الأشهر الثلاثة؛ كلمات لا نسب؛ اقتباسات اعتمدها إنسان
 *  <CredentialChapters code>    الشهادة الحيّة: «فصول بعد البرنامج» التي أظهرها صاحبها
 *  <OrgAfterLine orgId token>   /org (لوحة الأثر): سطر واحد عن المنسوبين (k≥5) — سطر لا رسم
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P38_NAMES_AR } from '../../lib/after/registry';

export function ProgramAfter({ programId, lang = 'ar' }: { programId: string; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (!programId) return; fetch(`/api/after?program=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.success ? j : null)).catch(() => setD(null)); }, [programId]);
  if (!d) return null;
  return <section className="pa-box" data-testid="pa-box" aria-labelledby="pa-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="pa-h"><Icon name="certificate" size={18} /> {ar ? P38_NAMES_AR.said : 'What learners said afterwards'}</h3>
    <p className="pa-line" data-testid="pa-line">{d.line_ar}</p>
    {d.shown && <ul className="pa-states" data-testid="pa-states">{(d.states || []).filter((s: any) => s.n > 0).map((s: any) => <li key={s.key}><b>{s.ar}</b><span>{s.band_ar}</span></li>)}</ul>}
    {d.shown && (d.excerpts || []).length > 0 && <div className="pa-ex" data-testid="pa-excerpts">{d.excerpts.map((x: any, i: number) => <blockquote key={i}><small>{x.station === 30 ? 'بعد شهر' : x.station === 90 ? 'بعد ثلاثة أشهر' : 'بعد سنة'} · {x.state === 'applied' ? 'طبّقته' : x.state === 'partly' ? 'طبّقته جزئيًا' : x.state === 'no_chance' ? 'لم تسنح الفرصة' : 'لم ينفعني'}</small>{x.text_ar}{x.witness_text && <em>— {ar ? 'شهد مشرف' : 'witness'}: «{x.witness_text}»</em>}</blockquote>)}</div>}
    <small className="pa-note">{ar ? 'بكلمات المتدرّبين بعد ثلاثة أشهر من البرنامج — لا نجوم ولا نسب؛ لا تتكلم الصفحة إلا من خمسة متدرّبين مختلفين، والاقتباسات بإذن أصحابها واعتماد إنسان.' : 'In learners’ own words three months after the program — no stars, no percentages; the page speaks only from five distinct learners.'} <Link href="/me/after">{ar ? 'محطاتي' : 'My stations'}</Link></small>
  </section>;
}

export function CredentialChapters({ code, lang = 'ar' }: { code: string; lang?: string }) {
  const ar = lang === 'ar'; const [ch, setCh] = useState<any[] | null>(null);
  useEffect(() => { if (!code) return; fetch(`/api/after?credential=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setCh(j?.success ? (j.chapters || []) : [])).catch(() => setCh([])); }, [code]);
  if (!ch || ch.length === 0) return null;
  return <section className="pa-ch" data-testid="pa-chapters" aria-labelledby="pa-ch-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="pa-ch-h"><Icon name="certificate" size={16} /> {ar ? P38_NAMES_AR.chapters : 'Chapters after the program'}</h3>
    <p className="pa-note">{ar ? 'كتبها صاحب الشهادة بنفسه بعد البرنامج، واختار إظهارها هنا. الشهادة التي تكبر.' : 'Written by the holder after the program and shown here by their choice.'}</p>
    <ol className="pa-chl">{ch.map((c: any) => <li key={c.station} data-testid="pa-chapter"><b>{c.station_ar}</b> · <span className="pa-st">{c.state_ar}</span><p>{c.text_ar}</p>{c.witness_text && <em>— {ar ? 'شهد' : 'witness'}: «{c.witness_text}»</em>}</li>)}</ol>
  </section>;
}

export function OrgAfterLine({ orgId, token, lang = 'ar' }: { orgId: string; token: () => Promise<string>; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (!orgId) return; (async () => { try { const tk = await token(); const j = await fetch(`/api/after?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); setD(j?.success ? j : null); } catch { setD(null); } })(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  return <p className="pa-org" data-testid="pa-org"><style dangerouslySetInnerHTML={{ __html: CSS }} /><Icon name="certificate" size={14} /> <b>{ar ? P38_NAMES_AR.official : 'Training impact follow-up'}:</b> {d.shown ? d.line_ar : (ar ? `يظهر سطر الجهة حين يكتب خمسة من منسوبيكم محطاتهم بعد برامجهم — كتب ${d.n} حتى الآن.` : `Appears once five members write their stations — ${d.n} so far.`)}</p>;
}

const CSS = `
.pa-box{border:1.5px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:#fff;margin-top:14px}.pa-box h3,.pa-ch h3{margin:0 0 6px;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center}
.pa-line{margin:0 0 8px;color:#1f2937;line-height:1.9;font-weight:700}.pa-states{list-style:none;margin:0 0 8px;padding:0;display:flex;gap:8px;flex-wrap:wrap}.pa-states li{border:1px solid #e2e8f0;border-radius:12px;padding:6px 10px;background:#f8fafc;display:grid}.pa-states b{color:#0f2a4e;font-size:13px}.pa-states span{color:#475569;font-size:12px}
.pa-ex{display:grid;gap:8px}.pa-ex blockquote{margin:0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffbeb;border-radius:8px;line-height:1.9;color:#1f2937}.pa-ex small,.pa-ch small{display:block;color:#64748b;font-size:11.5px;margin-bottom:2px}.pa-ex em,.pa-chl em{display:block;color:#065f46;font-style:normal;font-size:13px;margin-top:4px}
.pa-note{display:block;color:#64748b;font-size:12.5px;line-height:1.7;margin-top:6px}
.pa-ch{border:1.5px solid #c9a24b;border-radius:16px;padding:14px 16px;background:#fffdf5;margin-top:14px}.pa-chl{margin:8px 0 0;padding-inline-start:18px;display:grid;gap:8px}.pa-chl b{color:#0f2a4e}.pa-st{background:#fef3c7;border-radius:6px;padding:1px 8px;font-weight:800;font-size:12.5px}.pa-chl p{margin:4px 0 0;line-height:1.9;color:#1f2937}
.pa-org{margin:10px 0 0;color:#0f2a4e;line-height:1.8;display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
`;
