'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «بوابة الجهة» — م7 «عُبور للجهات»: ما يراه منسّق الجهة الطالبة برابطه السرّي (قراءة فقط، يتحدّث كل 30 ث):
 *  العدّادات · جدول طلابه (الحكم · الكلّي · المهارات الخمس · الشهادة) · «تقرير الجهة» A4 (توزيع · أضعف محورين · المعيار المرجعي · توصية) · CSV · «ختم المراقب».
 *  لا يرى بنودًا ولا مفاتيح ولا طلاب جهة أخرى. الرابط يُبطل من لوحة الطاقم.
 *  م9: «خريطة المنهج» للجهة (حرارة الوحدات بلا أسماء · وحدات كل طالب · جلسات التعويض وأثرها) في اللوحة والتقرير A4 وCSV.
 */
import { useCallback, useEffect, useState } from 'react';
import WayBar from '../../components/WayBar';

const SK: Record<string, string> = { listening: 'الاستماع', reading: 'القراءة', grammar_vocab: 'المفردات والتراكيب', writing: 'الكتابة', speaking: 'التحدّث' };
const OUT: Record<string, string> = { passed: 'اجتاز', conditional: 'مشروط', failed: 'لم يجتز', pending: 'قيد التصحيح' };
const ST: Record<string, string> = { invited: 'مدعو', started: 'بدأ', finished: 'أنهى', expired: 'انتهت مهلته' };
const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function ClientBoard({ token, fontClass = '' }: { token: string; fontClass?: string }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [name, setName] = useState(''); const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    try { const r = await fetch(`/api/miaar/client?t=${encodeURIComponent(token)}`, { cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) { setErr(j.error === 'not_found' ? 'nf' : 'err'); return; } setD(j); setErr(''); } catch { setErr('err'); }
  }, [token]);
  useEffect(() => { void load(); const id = window.setInterval(() => void load(), 30000); return () => window.clearInterval(id); }, [load]);
  async function sign() {
    setMsg(''); const r = await fetch('/api/miaar/client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: token, action: 'sign', name }) }); const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.ok) { setMsg(j.error || 'تعذّر التوقيع'); return; } await load(); setMsg('وُقّع كشف الحضور — ستحمل الشهادات عبارة «أُدّي بحضور مراقب».');
  }
  function printReport() {
    if (!d?.report) return; const rp = d.report; const w = window.open('', '_blank'); if (!w) return;
    const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
    const skills = rp.skills.map((s: any) => `<tr><td>${esc(s.name_ar)} · ${esc(s.name_en)}</td><td>${s.avg ?? '—'}${s.avg !== null ? '%' : ''}</td><td>${s.below}</td><td>${s.benchmark ?? '—'}${s.benchmark !== null ? '%' : ''}</td><td>${s.delta === null ? '—' : (s.delta > 0 ? '+' : '') + s.delta}</td></tr>`).join('');
    /* م9: الوحدات (خريطة المنهج) + جلسات التعويض وأثرها — مجاميع بلا أسماء */
    const un = d.units; const unitRows = (un?.units || []).map((x: any) => `<tr><td>${esc(x.code)}</td><td>${esc(x.title_ar)}</td><td>${x.percent}%</td><td>${esc(x.state_ar)}</td></tr>`).join('');
    const sessRows = (un?.sessions || []).map((x: any) => `<tr><td>${esc(dt(x.starts_at))}</td><td>${esc(x.title_ar)}</td><td>${esc(x.units.join(' · '))}</td><td>${x.duration_min} د</td><td>${x.joined}</td><td>${x.effect.map((e: any) => esc(e.text)).join('<br>') || '—'}</td></tr>`).join('');
    const unitsHtml = unitRows ? `<h2>خريطة المنهج — أين ضعفت المجموعة؟</h2><table><thead><tr><th>الوحدة</th><th>العنوان</th><th>نسبة المجموعة</th><th>الحالة</th></tr></thead><tbody>${unitRows}</tbody></table>${un.scoped ? `<p><small>نطاق الدعوة: ما دُرّس فقط (${esc(un.scope.join(' · '))})</small></p>` : ''}${sessRows ? `<h2>جلسات التعويض وأثرها</h2><table><thead><tr><th>الموعد</th><th>الجلسة</th><th>الوحدات</th><th>المدّة</th><th>انضمّ</th><th>الأثر</th></tr></thead><tbody>${sessRows}</tbody></table>` : ''}<p><small>${esc(un.note_ar)}</small></p>` : '';
    const grades = Object.entries(rp.grades).map(([g, n]) => `<li>${esc(g)}: <b>${n}</b></li>`).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير الجهة — ${esc(d.invite.client_name)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;line-height:1.7}h1{font-size:22px;margin:0}h2{font-size:16px;margin:18px 0 6px;color:#0b8a83}.k{color:#c9a24b;font-weight:800;font-size:13px}table{width:100%;border-collapse:collapse;font-size:13px}td,th{border:1px solid #e2e8f0;padding:6px 8px;text-align:start}th{background:#f8fafc}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}.g div{border:1px solid #e2e8f0;border-radius:8px;padding:8px;text-align:center}.g b{display:block;font-size:22px}.rec{background:#fffdf5;border:1px dashed #c9a24b;border-radius:8px;padding:8px 12px}.f{margin-top:18px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}</style></head><body>
<p class="k">${esc(d.service.ar)} · ${esc(d.service.en)}</p><h1>تقرير الجهة — ${esc(d.invite.client_name)}</h1><p>${esc(d.official.ar)} · المستوى <b>${esc(rp.level)}</b> · جدول المواصفات ${esc(rp.spec.version)} · الدعوة ${esc(d.invite.code)} · ${esc(dt(rp.generated_at))}</p>
<div class="g"><div><small>مدعو/ظهر</small><b>${rp.summary.invited}</b></div><div><small>أنهى</small><b>${rp.summary.finished}</b></div><div><small>اجتاز</small><b>${rp.summary.passed}</b></div><div><small>مشروط</small><b>${rp.summary.conditional}</b></div><div><small>لم يجتز</small><b>${rp.summary.failed}</b></div><div><small>قيد التصحيح</small><b>${rp.summary.pending}</b></div><div><small>متوسط الكلّي</small><b>${rp.summary.avg ?? '—'}${rp.summary.avg !== null ? '%' : ''}</b></div><div><small>المعيار المرجعي (أَثَر)</small><b>${rp.benchmark.avg ?? '—'}${rp.benchmark.avg !== null ? '%' : ''}</b><small>${rp.benchmark.avg !== null ? `ن=${rp.benchmark.n}` : 'عيّنة < 30'}</small></div></div>
<h2>المحاور</h2><table><thead><tr><th>المحور</th><th>متوسط المجموعة</th><th>دون 50%</th><th>المعيار المرجعي</th><th>الفارق</th></tr></thead><tbody>${skills}</tbody></table>
<h2>التقديرات</h2><ul>${grades || '<li>لا أحكام نهائية بعد</li>'}</ul>
${unitsHtml}<h2>التوصية</h2><div class="rec">${rp.recommendations_ar.map((r: string) => `<p>${esc(r)}</p>`).join('')}</div>
<p class="f">${d.order?.proctor_signed_at ? `أُدّي بحضور مراقب — ${esc(d.order.proctor_name)} · ` : ''}الحكم المركّب: 60% استقبالي · 20% كتابة · 20% تحدّث — اجتياز ≥ 60% ولا مهارة دون 50%. التصحيح البشري بمصحّحين معايَرين. البنود ومفاتيحها لا تُشارك. © 2026 مِعيار — من أَثَر · د. أحمد محمد عبدالعزيز بدوي.</p></body></html>`);
    w.document.close(); w.focus(); w.print();
  }
  return <main className={`cb-root ${fontClass}`} dir="rtl">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="cb-wrap">
      <WayBar lang="ar" />
      {err === 'nf' && <section className="cb-msg" role="alert" data-testid="cb-nf">هذا الرابط غير صالح أو أُبطل. اطلب رابطًا جديدًا من مِعيار — من أَثَر.</section>}
      {err === 'err' && <section className="cb-msg" role="alert">تعذّر التحميل — أعد المحاولة.</section>}
      {d && <>
        <header className="cb-head" data-testid="cb-head">
          <p className="cb-k">{d.service.ar} · {d.service.en}</p>
          <h1>بوابة الجهة — {d.invite.client_name}</h1>
          <p className="cb-sub">{d.official.ar} · المستوى <b>{d.invite.level}</b> · الدعوة <code dir="ltr">{d.invite.code}</code> · <span className={`cb-pill ${d.invite.status === 'closed' ? 'after' : d.window}`}>{d.invite.status === 'closed' ? 'أُغلقت' : d.window === 'before' ? 'لم تُفتح بعد' : d.window === 'open' ? 'مفتوحة الآن' : 'انتهت'}</span>{d.order && <> · حالة الخدمة: <b>{d.order.status_ar}</b></>}{d.invite.has_pin && <> · <span className="cb-pill">رمز قاعة</span></>}</p>
          <div className="cb-actions">
            <a className="cb-btn" href={`/api/miaar/client?t=${encodeURIComponent(token)}&csv=1`} data-testid="cb-csv">تصدير CSV</a>
            <button type="button" className="cb-btn" onClick={printReport} data-testid="cb-report">تقرير الجهة (A4)</button>
            <button type="button" className="cb-btn ghost" onClick={() => void load()}>تحديث</button>
          </div>
        </header>
        <section className="cb-sum" data-testid="cb-summary">
          {[['invited', 'مدعو/ظهر'], ['started', 'بدأ'], ['finished', 'أنهى'], ['pending', 'قيد التصحيح'], ['passed', 'اجتاز'], ['conditional', 'مشروط'], ['failed', 'لم يجتز']].map(([k, l]) => <div key={k} className={`cb-card ${k}`}><b>{d.summary[k]}</b><small>{l}</small></div>)}
          <div className="cb-card"><b>{d.summary.avg ?? '—'}{d.summary.avg !== null ? '%' : ''}</b><small>متوسط الكلّي</small></div>
          <div className="cb-card bench" data-testid="cb-bench"><b>{d.report.benchmark.avg ?? '—'}{d.report.benchmark.avg !== null ? '%' : ''}</b><small>المعيار المرجعي (أَثَر){d.report.benchmark.avg === null ? ' — عيّنة < 30' : ` · ن=${d.report.benchmark.n}`}</small></div>
        </section>
        <section className="cb-panel">
          <h2>الطلاب <small>({d.rows.length})</small></h2>
          <div className="cb-tablewrap"><table className="cb-table" data-testid="cb-table"><thead><tr><th>الطالب</th><th>الحالة</th><th>الكلّي</th>{['listening', 'reading', 'grammar_vocab', 'writing', 'speaking'].map((k) => <th key={k}>{SK[k]}</th>)}<th>الحكم</th><th>النزاهة</th><th>الشهادة</th></tr></thead>
            <tbody>{d.rows.map((r: any) => <tr key={r.email} data-testid="cb-row"><td><b>{r.name || '—'}</b><br /><small dir="ltr">{r.email}</small></td><td>{ST[r.status] || r.status}<br /><small>{dt(r.finished_at || r.started_at)}</small></td><td>{r.exit?.الحالة === 'final' ? <b>{r.exit.الكلي}%</b> : r.exit ? 'قيد التصحيح' : '—'}</td>
              {['listening', 'reading', 'grammar_vocab', 'writing', 'speaking'].map((k) => { const v = r.exit?.المهارات?.[k]; return <td key={k} className={v?.الحالة === 'below' ? 'low' : ''}>{typeof v?.النسبة === 'number' ? `${v.النسبة}%` : v?.الحالة === 'pending' ? '…' : '—'}</td>; })}
              <td>{r.exit ? <span className={`cb-pill ${r.exit.النتيجة}`}>{OUT[r.exit.النتيجة] || r.exit.النتيجة}</span> : '—'}{r.exit?.تقدير_ar && r.exit.الحالة === 'final' ? <><br /><small>{r.exit.تقدير_ar}</small></> : null}{r.exit?.وحدات_للمراجعة?.length > 0 && <div className="cb-rev" data-testid="cb-row-units">{r.exit.وحدات_للمراجعة.map((u: any) => <span key={u.الرمز} className={`cb-chip ${u.الحالة}`} title={`${u.الاسم} — ${u.النسبة}%`}>{u.الرمز}</span>)}</div>}</td>
              <td data-testid="cb-integrity">{r.integrity ? <span className={`cb-pill ${r.integrity === 'clear' ? 'passed' : r.integrity === 'invalid' ? 'failed' : 'pending'}`} title="سجلّ نزاهة الاختبار — تراه الجهة حكمًا لا صورًا">{r.integrity_ar}</span> : <small>—</small>}</td>
              <td>{r.certificate_url ? <a href={r.certificate_url} target="_blank" rel="noreferrer">الشهادة</a> : '—'}</td></tr>)}
              {!d.rows.length && <tr><td colSpan={11} className="cb-empty">لم يبدأ أحد بعد — شارك الباركود/الرابط مع طلابك.</td></tr>}</tbody></table></div>
        </section>
        {d.units?.units?.length > 0 && <section className="cb-panel" data-testid="cb-units">
          <h2>خريطة المنهج — أين ضعفت المجموعة؟ <small>({d.units.units.length} وحدة{d.units.scoped ? ' · ما دُرّس فقط' : ''})</small></h2>
          <div className="cb-heat">{d.units.units.map((u: any) => <div key={u.code} className={`cb-unit ${u.state}`} data-testid="cb-unit" data-state={u.state} title={`${u.title_ar} — ${u.n_students} طالبًا`}><b>{u.percent}%</b><span>{u.code}</span><small>{u.title_ar}</small></div>)}</div>
          {d.units.weak.length > 0 && <p className="cb-weak">وحدات حمراء: <b>{d.units.weak.map((u: any) => `${u.code} ${u.title_ar}`).join(' · ')}</b></p>}
          {d.units.sessions.length > 0 && <div className="cb-sess" data-testid="cb-sessions"><h3>جلسات التعويض وأثرها</h3>
            <ul>{d.units.sessions.map((x: any) => <li key={x.id}><b>{x.title_ar}</b> · {dt(x.starts_at)} · {x.duration_min} د · {x.units.join(' · ')} · انضمّ <b>{x.joined}</b>{x.effect.length > 0 && <ul className="cb-eff">{x.effect.map((e: any) => <li key={e.code} data-testid="cb-effect">{e.text}</li>)}</ul>}</li>)}</ul>
            {typeof d.units.effect_avg === 'number' && <p className="cb-ok">متوسط أثر التعويض للحاضرين: <b>{d.units.effect_avg >= 0 ? '+' : ''}{d.units.effect_avg}</b> نقطة</p>}</div>}
          <p className="cb-note">{d.units.note_ar}</p>
        </section>}
        <section className="cb-panel" data-testid="cb-report-panel">
          <h2>تقرير الجهة — مختصر</h2>
          {d.report.weakest.length ? <p>أضعف محورين: <b>{d.report.weakest.map((s: string) => SK[s]).join(' و')}</b></p> : null}
          <ul className="cb-rec">{d.report.recommendations_ar.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
        </section>
        <section className="cb-panel" data-testid="cb-sign">
          <h2>ختم المراقب</h2>
          {d.order?.proctor_signed_at ? <p className="cb-ok">وُقّع كشف الحضور بواسطة <b>{d.order.proctor_name}</b> في {dt(d.order.proctor_signed_at)} — الشهادات تحمل «أُدّي بحضور مراقب».</p>
            : <div className="cb-signrow"><label>اسم المراقب الذي حضر القاعة<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} data-testid="cb-sign-name" /></label><button type="button" className="cb-btn" disabled={name.trim().length < 3} onClick={() => void sign()} data-testid="cb-sign-btn">توقيع كشف الحضور</button><small>بالتوقيع تؤكّد الجهة أن الطلاب أدّوا الاختبار في قاعة بحضور مراقب — وهذا يظهر على شهاداتهم.</small></div>}
          {msg && <p className="cb-ok" role="status">{msg}</p>}
        </section>
        <p className="cb-foot">هذه البوابة للجهة الطالبة فقط · لا تُعرض بنود الاختبار ولا مفاتيحه · يتحدّث كل 30 ثانية · © 2026 مِعيار — من أَثَر.</p>
      </>}
    </div>
  </main>;
}

const CSS = `
.cb-root{min-height:100vh;background:#f1f5f9;color:#0f2a4e;font-family:system-ui,Tahoma,sans-serif;padding-bottom:30px}.cb-wrap{max-width:1100px;margin:0 auto;padding:10px 16px}
.cb-msg{margin:20px 0;padding:16px;border-radius:14px;background:#fff;border:1px solid #e2e8f0;line-height:1.8}
.cb-head{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px 18px;margin:10px 0}.cb-k{margin:0;color:#c9a24b;font-weight:800;font-size:13px}.cb-head h1{margin:4px 0 6px;font-size:24px}.cb-sub{margin:0;color:#475569;font-size:14px;line-height:1.9}
.cb-pill{display:inline-block;padding:2px 10px;border-radius:999px;background:#e2e8f0;font-size:12px;font-weight:800}.cb-pill.open,.cb-pill.passed{background:#dcfce7;color:#166534}.cb-pill.before,.cb-pill.conditional{background:#fef3c7;color:#92400e}.cb-pill.after,.cb-pill.failed{background:#fee2e2;color:#991b1b}.cb-pill.pending{background:#e0f2fe;color:#075985}
.cb-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cb-btn{display:inline-flex;align-items:center;min-height:38px;padding:0 14px;border-radius:10px;border:1px solid #0f2a4e;background:#0f2a4e;color:#fff;font-weight:800;cursor:pointer;text-decoration:none;font:inherit}.cb-btn.ghost{background:#fff;color:#0f2a4e}.cb-btn:disabled{opacity:.5;cursor:not-allowed}
.cb-heat{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:6px;margin:8px 0}.cb-unit{border:1px solid #e2e8f0;border-radius:10px;padding:8px;text-align:center;background:#f8fafc;min-width:0}.cb-unit b{display:block;font-size:18px}.cb-unit span{font-size:11px;color:#475569;font-weight:800}.cb-unit small{display:block;font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cb-unit.weak{background:#fee2e2;border-color:#fecaca}.cb-unit.watch{background:#fef3c7;border-color:#fde68a}.cb-unit.ok{background:#dcfce7;border-color:#bbf7d0}
.cb-weak{margin:6px 0;font-size:14px}.cb-sess h3{font-size:15px;margin:10px 0 4px}.cb-sess ul{margin:0;padding-inline-start:18px;font-size:13px;line-height:1.9}.cb-eff{color:#0b8a83}.cb-note{color:#64748b;font-size:12px;margin:8px 0 0}
.cb-rev{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}.cb-chip{display:inline-block;padding:0 6px;border-radius:6px;font-size:11px;font-weight:800;background:#e2e8f0}.cb-chip.weak{background:#fee2e2;color:#991b1b}.cb-chip.watch{background:#fef3c7;color:#92400e}
.cb-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0}.cb-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px;text-align:center;min-width:0}.cb-card b{display:block;font-size:22px}.cb-card small{color:#64748b;font-size:12px}.cb-card.passed b{color:#166534}.cb-card.failed b{color:#991b1b}.cb-card.conditional b{color:#92400e}.cb-card.bench{border-color:#c9a24b;background:#fffdf5}
.cb-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px 18px;margin:10px 0}.cb-panel h2{margin:0 0 10px;font-size:17px}.cb-panel h2 small{color:#64748b;font-weight:600}
.cb-tablewrap{overflow:auto}.cb-table{width:100%;border-collapse:collapse;font-size:13px}.cb-table th,.cb-table td{border-bottom:1px solid #e2e8f0;padding:7px 8px;text-align:start;vertical-align:top;white-space:nowrap}.cb-table th{background:#f8fafc}.cb-table td.low{color:#991b1b;font-weight:800}.cb-empty{text-align:center;color:#64748b;padding:18px !important}
.cb-rec{margin:0;padding-inline-start:18px;line-height:1.9}.cb-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:8px 0 0}
.cb-signrow{display:grid;gap:8px;max-width:520px}.cb-signrow label{display:grid;gap:4px;font-size:13px;font-weight:700}.cb-signrow input{min-height:40px;border:1px solid #cbd5e1;border-radius:10px;padding:0 10px;font:inherit}.cb-signrow small{color:#64748b;line-height:1.7}
.cb-foot{text-align:center;color:#64748b;font-size:12px;margin:16px 0 0}
@media (max-width:640px){.cb-head h1{font-size:20px}}
`;
