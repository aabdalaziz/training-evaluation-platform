'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P38 «الشهادة التي تكبر» — ثلاثة مكوّنات صغيرة تُعرض في صفحات قائمة:
 *  <ProgramAfter programId>     صفحة البرنامج العامة: «ما قاله من تدرّب هنا» — من خمسة متدرّبين كتبوا محطة الأشهر الثلاثة؛ كلمات لا نسب؛ اقتباسات اعتمدها إنسان
 *  <CredentialChapters code>    الشهادة الحيّة: «فصول بعد البرنامج» التي أظهرها صاحبها
 *  <OrgAfterLine orgId token>   /org (لوحة الأثر): سطر واحد عن المنسوبين (k≥5) — سطر لا رسم
 *  P39 «أصوات حول الشهادة»: صفحة البرنامج تضيف «وردّ البرنامج بورشة تطبيق» · «وقالت الجهة» · سطر القياس من خمسة؛
 *  <OrgStations orgId token>    /org: «محطة الجهة» — بعد سنة تكتب الجهة سطرها هي (حالة بالكلمات + نصّ) لكل برنامج فيه خمسة من منسوبيها
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { P38_NAMES_AR } from '../../lib/after/registry';
import { P39_NAMES_AR, ORG_STATES, ORG_STATE_AR, ORG_QUESTION_AR, ORG_TEXT_MIN, ORG_TEXT_MAX } from '../../lib/after/voices';
import type { OrgState } from '../../lib/after/voices';

export function ProgramAfter({ programId, lang = 'ar' }: { programId: string; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (!programId) return; fetch(`/api/after?program=${encodeURIComponent(programId)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setD(j?.success ? j : null)).catch(() => setD(null)); }, [programId]);
  if (!d) return null;
  return <section className="pa-box" data-testid="pa-box" aria-labelledby="pa-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="pa-h"><Icon name="certificate" size={18} /> {ar ? P38_NAMES_AR.said : 'What learners said afterwards'}</h3>
    <p className="pa-line" data-testid="pa-line">{d.line_ar}</p>
    {d.shown && <ul className="pa-states" data-testid="pa-states">{(d.states || []).filter((s: any) => s.n > 0).map((s: any) => <li key={s.key}><b>{s.ar}</b><span>{s.band_ar}</span></li>)}</ul>}
    {d.shown && (d.excerpts || []).length > 0 && <div className="pa-ex" data-testid="pa-excerpts">{d.excerpts.map((x: any, i: number) => <blockquote key={i}><small>{x.station === 30 ? 'بعد شهر' : x.station === 90 ? 'بعد ثلاثة أشهر' : 'بعد سنة'} · {x.state === 'applied' ? 'طبّقته' : x.state === 'partly' ? 'طبّقته جزئيًا' : x.state === 'no_chance' ? 'لم تسنح الفرصة' : 'لم ينفعني'}</small>{x.text_ar}{x.witness_text && <em>— {ar ? 'شهد مشرف' : 'witness'}: «{x.witness_text}»</em>}</blockquote>)}</div>}
    {(d.offer_line_ar || (d.org_said || []).length > 0 || d.measure_line_ar) && <div className="pa-voices" data-testid="pa-voices">
      {d.offer_line_ar && <p className="pa-voice" data-testid="pa-offer-line"><Icon name="users" size={14} /> {d.offer_line_ar}</p>}
      {(d.org_said || []).map((o: any, i: number) => <blockquote key={i} className="pa-orgsaid" data-testid="pa-org-said"><small>{P39_NAMES_AR.org_said} — {o.org_ar} · {o.state_ar}</small>{o.text_ar}</blockquote>)}
      {d.measure_line_ar && <p className="pa-voice" data-testid="pa-measure-line"><Icon name="trend" size={14} /> {d.measure_line_ar}</p>}
    </div>}
    <small className="pa-note">{ar ? 'بكلمات المتدرّبين بعد ثلاثة أشهر من البرنامج — لا نجوم ولا نسب؛ لا تتكلم الصفحة إلا من خمسة متدرّبين مختلفين، والاقتباسات بإذن أصحابها واعتماد إنسان.' : 'In learners’ own words three months after the program — no stars, no percentages; the page speaks only from five distinct learners.'} <Link href="/me/after">{ar ? 'محطاتي' : 'My stations'}</Link></small>
  </section>;
}

export function CredentialChapters({ code, lang = 'ar' }: { code: string; lang?: string }) {
  const ar = lang === 'ar'; const [ch, setCh] = useState<any[] | null>(null); const [fl, setFl] = useState<any | null>(null);
  useEffect(() => { if (!code) return; fetch(`/api/after?credential=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setCh(j?.success ? (j.chapters || []) : [])).catch(() => setCh([])); fetch(`/api/reports?credential=${encodeURIComponent(code)}`, { cache: 'no-store' }).then(r => r.json()).then(j => setFl(j?.success ? (j.line || null) : null)).catch(() => setFl(null)); }, [code]);   // P46 ر2: «خاتمة الرحلة» — فقرة المسار من التقرير الختامي المعتمَد (بإذن صاحبها)
  if ((!ch || ch.length === 0) && !fl) return null;
  return <section className="pa-ch" data-testid="pa-chapters" aria-labelledby="pa-ch-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="pa-ch-h"><Icon name="certificate" size={16} /> {ar ? P38_NAMES_AR.chapters : 'Chapters after the program'}</h3>
    <p className="pa-note">{ar ? 'كتبها صاحب الشهادة بنفسه بعد البرنامج، واختار إظهارها هنا. الشهادة التي تكبر.' : 'Written by the holder after the program and shown here by their choice.'}</p>
    {fl && <div className="pa-final" data-testid="pa-final-line"><b>{ar ? 'خاتمة الرحلة' : 'End of the journey'}</b> · <span className="pa-st">{ar ? `من التقرير الختامي المعتمَد (${fl.weeks} أسابيع موثَّقة${fl.delta !== null && fl.delta !== undefined ? ` · الفرق ${fl.delta > 0 ? '+' : ''}${fl.delta}` : ''})` : `from the approved final report (${fl.weeks} weeks)`}</span><p>{fl.paragraph || fl.text_ar}</p><em dir="ltr">/verify/report/{fl.verify_code}</em></div>}
    {ch && ch.length > 0 && <ol className="pa-chl">{ch.map((c: any) => <li key={c.station} data-testid="pa-chapter"><b>{c.station_ar}</b> · <span className="pa-st">{c.state_ar}</span><p>{c.text_ar}</p>{c.witness_text && <em>— {ar ? 'شهد' : 'witness'}: «{c.witness_text}»</em>}</li>)}</ol>}
  </section>;
}

export function OrgAfterLine({ orgId, token, lang = 'ar' }: { orgId: string; token: () => Promise<string>; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null);
  useEffect(() => { if (!orgId) return; (async () => { try { const tk = await token(); const j = await fetch(`/api/after?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); setD(j?.success ? j : null); } catch { setD(null); } })(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  return <p className="pa-org" data-testid="pa-org"><style dangerouslySetInnerHTML={{ __html: CSS }} /><Icon name="certificate" size={14} /> <b>{ar ? P38_NAMES_AR.official : 'Training impact follow-up'}:</b> {d.shown ? d.line_ar : (ar ? `يظهر سطر الجهة حين يكتب خمسة من منسوبيكم محطاتهم بعد برامجهم — كتب ${d.n} حتى الآن.` : `Appears once five members write their stations — ${d.n} so far.`)}</p>;
}

/** P39 — «محطة الجهة» في /org: برامج انتهت منذ سنة وفيها خمسة من منسوبينا؛ مدير الجهة يكتب مرة واحدة */
export function OrgStations({ orgId, token, lang = 'ar' }: { orgId: string; token: () => Promise<string>; lang?: string }) {
  const ar = lang === 'ar'; const [d, setD] = useState<any>(null); const [open, setOpen] = useState(''); const [f, setF] = useState<{ state: OrgState | ''; text: string; pub: boolean }>({ state: '', text: '', pub: false }); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  async function load() { try { const tk = await token(); const j = await fetch(`/api/after?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()); setD(j?.success ? j : null); } catch { setD(null); } }
  useEffect(() => { if (orgId) load(); }, [orgId]); // eslint-disable-line react-hooks/exhaustive-deps
  async function write(pid: string) { setBusy(true); setMsg(''); try { const tk = await token(); const j = await fetch('/api/after', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tk}` }, body: JSON.stringify({ action: 'org_write', organization_id: orgId, program_id: pid, state: f.state, text_ar: f.text, public: f.pub }) }).then(r => r.json()); if (!j.success) throw new Error(j.error || 'فشل'); setMsg(j.note_ar || ''); setOpen(''); await load(); } catch (e: any) { setMsg(e.message || String(e)); } finally { setBusy(false); } }
  const list: any[] = d?.org_stations || []; if (!d || !list.length) return null;
  return <section className="pa-orgst" data-testid="pa-orgst" aria-labelledby="pa-orgst-h"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <h3 id="pa-orgst-h"><Icon name="flag" size={16} /> {ar ? P39_NAMES_AR.org : 'Organization station'}</h3>
    <p className="pa-note">{ar ? `بعد سنة من كل برنامج فيه خمسة من منسوبيكم، تكتب الجهة سطرها هي: «${ORG_QUESTION_AR}» — مرة واحدة، بالكلمات، ولا تُنشر إلا بإذنكم وباسمكم.` : 'One year after each program with five of your members, the organization writes its own line.'}</p>
    {msg && <p className="pa-msg" role="status" data-testid="pa-orgst-msg">{msg}</p>}
    <ul className="pa-orgl">{list.map(v => <li key={v.program_id} className={`pa-orgi ${v.phase}`} data-testid="pa-orgst-item" data-phase={v.phase}>
      <div className="pa-orgh"><b>{v.program_ar}</b> <small>{ar ? 'انتهى' : 'ended'} {v.end_day} · {v.members} {ar ? 'من منسوبيكم' : 'members'}</small><span className="pa-st">{v.phase === 'written' ? (ar ? 'كُتبت' : 'written') : v.phase === 'open' ? (ar ? `مفتوحة حتى ${v.closes}` : `open until ${v.closes}`) : v.phase === 'future' ? (ar ? `تُفتح ${v.opens}` : `opens ${v.opens}`) : (ar ? 'فاتت — تبقى فارغة' : 'missed')}</span></div>
      {v.phase === 'written' && v.row && <blockquote className="pa-orgsaid"><small>{ORG_STATE_AR[v.row.state as OrgState]}{v.row.public ? (ar ? ' · منشورة باسم الجهة' : ' · public') : (ar ? ' · داخل الجهة' : ' · internal')}</small>{v.row.text_ar}</blockquote>}
      {v.phase === 'open' && d.can_write && open !== v.program_id && <button type="button" className="pa-btn" onClick={() => { setOpen(v.program_id); setF({ state: '', text: '', pub: false }); }} data-testid="pa-orgst-write">{ar ? 'اكتبوا محطة الجهة' : 'Write the station'}</button>}
      {v.phase === 'open' && !d.can_write && <small className="pa-note">{ar ? 'يكتبها مدير الجهة.' : 'Written by the org admin.'}</small>}
      {open === v.program_id && <form className="pa-orgf" onSubmit={e => { e.preventDefault(); write(v.program_id); }}>
        <div className="pa-states2" role="radiogroup" aria-label={ar ? 'الحالة' : 'State'}>{ORG_STATES.map(st => <label key={st} className={f.state === st ? 'on' : ''}><input type="radio" name={`os-${v.program_id}`} checked={f.state === st} onChange={() => setF(x => ({ ...x, state: st }))} data-testid={`pa-orgst-state-${st}`} /> {ORG_STATE_AR[st]}</label>)}</div>
        <label className="pa-lbl">{ORG_QUESTION_AR} <small>({f.text.length}/{ORG_TEXT_MAX} · {ar ? `من ${ORG_TEXT_MIN} حرفًا` : `min ${ORG_TEXT_MIN}`})</small><textarea rows={4} maxLength={ORG_TEXT_MAX} value={f.text} onChange={e => setF(x => ({ ...x, text: e.target.value }))} data-testid="pa-orgst-text" required /></label>
        <label className="pa-chk"><input type="checkbox" checked={f.pub} onChange={e => setF(x => ({ ...x, pub: e.target.checked }))} data-testid="pa-orgst-public" /> {ar ? 'تظهر على صفحة البرنامج العامة باسم جهتنا' : 'Show publicly on the program page with our name'}</label>
        <div className="pa-acts"><button type="submit" className="pa-btn" disabled={busy || !f.state || f.text.trim().length < ORG_TEXT_MIN} data-testid="pa-orgst-send">{ar ? 'احفظوا — لا تُعدَّل بعدها' : 'Save — cannot be edited'}</button><button type="button" className="pa-btn light" onClick={() => setOpen('')}>{ar ? 'إلغاء' : 'Cancel'}</button></div>
      </form>}
    </li>)}</ul>
  </section>;
}

const CSS = `
.pa-voices{display:grid;gap:8px;margin:8px 0}.pa-voice{margin:0;color:#0f2a4e;font-weight:700;line-height:1.9;display:flex;gap:6px;align-items:flex-start}.pa-orgsaid{margin:0;padding:8px 12px;border-inline-start:3px solid #0f2a4e;background:#f8fafc;border-radius:8px;line-height:1.9;color:#1f2937}.pa-orgsaid small{display:block;color:#0b6f69;font-weight:800;font-size:12px;margin-bottom:2px}
.pa-orgst{border:1.5px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:#fff;margin-top:14px}.pa-orgst h3{margin:0 0 6px;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center}.pa-orgl{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:10px}.pa-orgi{border:1.5px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:8px}.pa-orgi.open{border-color:#0b8a83;background:#f0fdfa}.pa-orgi.written{border-color:#c9a24b}
.pa-orgh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.pa-orgh b{color:#0f2a4e}.pa-orgh small{color:#64748b;font-size:12px}.pa-msg{margin:4px 0;color:#0b6f69;font-weight:800}
.pa-orgf{display:grid;gap:10px}.pa-states2{display:flex;gap:8px;flex-wrap:wrap}.pa-states2 label{display:flex;gap:6px;align-items:center;border:1.5px solid #cbd5e1;border-radius:999px;padding:8px 14px;cursor:pointer;min-height:44px;font-weight:700}.pa-states2 label.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.pa-states2 input{width:18px;height:18px}
.pa-lbl{display:grid;gap:6px;font-weight:700;color:#0f2a4e}.pa-lbl small{font-weight:600;color:#64748b}.pa-orgf textarea{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;min-height:110px;width:100%;box-sizing:border-box;line-height:1.8}.pa-chk{display:flex;gap:8px;align-items:center;min-height:44px;font-size:14px}.pa-chk input{width:20px;height:20px}
.pa-acts{display:flex;gap:10px;flex-wrap:wrap}.pa-btn{border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;border-radius:10px;padding:9px 14px;font:inherit;font-weight:800;cursor:pointer;min-height:44px}.pa-btn.light{background:#fff;color:#0f2a4e}.pa-btn:disabled{opacity:.5;cursor:not-allowed}
.pa-box{border:1.5px solid #e2e8f0;border-radius:16px;padding:14px 16px;background:#fff;margin-top:14px}.pa-box h3,.pa-ch h3{margin:0 0 6px;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center}
.pa-line{margin:0 0 8px;color:#1f2937;line-height:1.9;font-weight:700}.pa-states{list-style:none;margin:0 0 8px;padding:0;display:flex;gap:8px;flex-wrap:wrap}.pa-states li{border:1px solid #e2e8f0;border-radius:12px;padding:6px 10px;background:#f8fafc;display:grid}.pa-states b{color:#0f2a4e;font-size:13px}.pa-states span{color:#475569;font-size:12px}
.pa-ex{display:grid;gap:8px}.pa-ex blockquote{margin:0;padding:8px 12px;border-inline-start:3px solid #c9a24b;background:#fffbeb;border-radius:8px;line-height:1.9;color:#1f2937}.pa-ex small,.pa-ch small{display:block;color:#64748b;font-size:11.5px;margin-bottom:2px}.pa-ex em,.pa-final{background:#fffaf0;border-inline-start:4px solid #c9a24b;border-radius:8px;padding:.6rem .9rem;margin:.4rem 0 .6rem;line-height:1.8}.pa-final p{margin:.3rem 0}.pa-final em{font-size:.8rem;color:#64748b}.pa-chl em{display:block;color:#065f46;font-style:normal;font-size:13px;margin-top:4px}
.pa-note{display:block;color:#64748b;font-size:12.5px;line-height:1.7;margin-top:6px}
.pa-ch{border:1.5px solid #c9a24b;border-radius:16px;padding:14px 16px;background:#fffdf5;margin-top:14px}.pa-chl{margin:8px 0 0;padding-inline-start:18px;display:grid;gap:8px}.pa-chl b{color:#0f2a4e}.pa-st{background:#fef3c7;border-radius:6px;padding:1px 8px;font-weight:800;font-size:12.5px}.pa-chl p{margin:4px 0 0;line-height:1.9;color:#1f2937}
.pa-org{margin:10px 0 0;color:#0f2a4e;line-height:1.8;display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap}
`;
