'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P68 — ورقة «تقرير القيادة» (A4 واحدة، ترتيب ثابت، تُطبع من المتصفّح بلا مكتبات)
 *  تُستعمل في تبويب /org «تقرير القيادة» (معاينة) وفي صفحة الطباعة /org/report/<code>
 *  المقاطع: الرأس · ما قرّرتم آخر مرّة · ثلاثة أرقام · خريطة المهارات · ما قاله الميدان · ثلاثة أسئلة للقيادة · قرار القيادة · الذيل
 *  لا اسم شخص ولا رقم تدريبي في أي مقطع — ما يظهر هنا هو ما في الوثيقة الموقَّعة حرفيًّا
 */
import { qrSvg } from '../../lib/certificates/qr';

export type SheetBody = {
  code: string; organization: { name_ar: string }; pseudonymous: boolean; period: { label_ar: string; from: string; to: string };
  previous: { read_ar: string; code: string } | null;
  numbers: { transfer: { pct: number | null; n: number; note_ar: string | null; supervisor?: number | null; trainee?: number | null }; gain: { pct: number | null; n: number; note_ar: string | null; pre?: number | null; post?: number | null }; attendance: { pct: number | null; n: number; note_ar: string | null; sessions: number }; satisfaction: { pct: number | null; n: number } };
  people: { members: number; pending: number; active: number | null; programs: number; learners: number };
  skills: { name_ar: string; avg_level: number | null; learners: number; approved: number; proven: number }[];
  field: { lines: string[]; people: number; sources_ar: string[]; note_ar: string | null };
  questions: string[];
  tail: { shield: { month_ar: string; code: string; passed_days: number; total_days: number } | null; policy_seal: { code: string; issued_at: string } | null; charter: { code: string | null; expires_at: string | null } | null; pledge: { title_ar: string; code: string | null } | null };
  issued: { at: string; name: string | null; title: string | null };
  decision: { text_ar: string; note_ar: string | null; at: string } | null;
  proof?: unknown;
};
type Props = { body: SheetBody; site: string; logo?: string | null; status?: 'issued' | 'revoked'; compact?: boolean };

const fmt = (iso?: string | null) => { if (!iso) return '—'; try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(iso)); } catch { return String(iso).slice(0, 10); } };
const pct = (p: number | null) => (p === null ? null : `${Math.round(p)}%`);

export const SHEET_CSS = `
.lrs{direction:rtl;font-family:Tajawal,"Noto Naskh Arabic",Arial,sans-serif;color:#0f2a4e;background:#fff;max-width:210mm;margin:0 auto;padding:14mm 14mm 10mm;box-sizing:border-box;position:relative;line-height:1.55}
.lrs.revoked:before{content:"مُلغى — صدر بعده تقرير أحدث";position:absolute;inset:40% 0 auto 0;text-align:center;font-size:34px;font-weight:900;color:#b91c1c;opacity:.18;transform:rotate(-14deg);pointer-events:none}
.lrs-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-bottom:3px solid #0b8a83;padding-bottom:10px}
.lrs-org{display:flex;align-items:center;gap:12px}.lrs-org img{height:52px;max-width:120px;object-fit:contain}.lrs-org h1{margin:0;font-size:20px}.lrs-org small{display:block;color:#475569;font-size:12px;font-weight:700}
.lrs-title{text-align:center;flex:1}.lrs-title b{display:block;font-size:22px;color:#0b8a83}.lrs-title span{display:block;font-size:11px;color:#64748b}.lrs-title em{display:inline-block;font-style:normal;margin-top:4px;font-size:13px;font-weight:800;background:#f1f5f9;border-radius:999px;padding:2px 12px}
.lrs-qr{text-align:center;font-size:10px;color:#475569;direction:ltr}.lrs-qr svg{width:74px;height:74px;display:block;margin:0 auto 2px}.lrs-qr code{font-size:11px;font-weight:900;color:#0f2a4e;letter-spacing:.04em}
.lrs-badge{display:inline-block;font-size:11px;font-weight:800;color:#7c2d12;background:#fff7ed;border:1px solid #fdba74;border-radius:999px;padding:1px 10px;margin-top:4px}
.lrs h2{font-size:13px;margin:12px 0 6px;color:#0b8a83;display:flex;align-items:center;gap:8px}.lrs h2:after{content:"";flex:1;height:1px;background:#e2e8f0}.lrs h2 i{font-style:normal;font-size:11px;color:#94a3b8;font-weight:700}
.lrs-prev{background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:700}
.lrs-nums{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.lrs-num{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;min-height:84px}.lrs-num b{display:block;font-size:12px;color:#475569}.lrs-num strong{display:block;font-size:30px;line-height:1.1;margin:4px 0 2px;color:#0f2a4e}.lrs-num strong.na{font-size:13px;color:#b45309;line-height:1.4;margin-top:8px}.lrs-num small{color:#64748b;font-size:11px}
.lrs-table{width:100%;border-collapse:collapse;font-size:12.5px}.lrs-table th{background:#f8fafc;color:#334155;padding:5px 8px;text-align:right;font-weight:800;border-bottom:1px solid #e2e8f0}.lrs-table td{padding:5px 8px;border-bottom:1px solid #f1f5f9}.lrs-table td:not(:first-child),.lrs-table th:not(:first-child){text-align:center;width:16%}
.lrs-field{margin:0;padding:0;list-style:none}.lrs-field li{position:relative;padding:4px 18px 4px 0;font-size:13.5px}.lrs-field li:before{content:"”";position:absolute;right:0;top:-2px;font-size:22px;color:#0b8a83;line-height:1}
.lrs-src{font-size:11px;color:#64748b;margin-top:4px}.lrs-note{font-size:12.5px;color:#92400e;background:#fffbeb;border:1px dashed #fcd34d;border-radius:8px;padding:6px 10px}
.lrs-qs{margin:0;padding:0 18px 0 0;font-size:13.5px}.lrs-qs li{padding:3px 0;font-weight:700}
.lrs-dec{border:2px solid #0b8a83;border-radius:12px;padding:10px 14px;background:#f0fdfa}.lrs-dec b{display:block;font-size:12px;color:#0b8a83}.lrs-dec p{margin:4px 0 0;font-size:15px;font-weight:900}.lrs-dec small{color:#475569;font-size:11.5px}
.lrs-dec.empty{border-style:dashed;background:#fff;color:#64748b;font-size:13px}
.lrs-foot{margin-top:12px;border-top:1px solid #e2e8f0;padding-top:8px;display:flex;justify-content:space-between;gap:12px;font-size:11px;color:#475569;flex-wrap:wrap}.lrs-foot div{flex:1;min-width:180px}.lrs-foot b{color:#0f2a4e}
.lrs-sign{text-align:left;direction:rtl}.lrs-sign strong{display:block;font-size:13px;color:#0f2a4e}.lrs-ok{color:#047857;font-weight:800}
.lrs-brand{font-size:10.5px;color:#94a3b8;text-align:center;margin-top:8px}
@media print{@page{size:A4;margin:8mm}.lrs{padding:4mm 6mm;max-width:none;box-shadow:none}.lrs-num strong{font-size:26px}body{background:#fff}}
`;

export function OrgReportSheet({ body: b, site, logo, status, compact }: Props) {
  const verifyUrl = `${site}/verify/report?code=${b.code}`; const n = b.numbers;
  const tiles: { k: string; label: string; v: string | null; sub: string; note: string | null }[] = [
    { k: 'transfer', label: 'الانتقال إلى الميدان', v: pct(n.transfer.pct), sub: n.transfer.pct === null ? '' : `متابعة الأثر · n=${n.transfer.n}${n.transfer.supervisor != null && n.transfer.trainee != null ? ` · مشرف ${n.transfer.supervisor} / متدرّب ${n.transfer.trainee} من 5` : ''}`, note: n.transfer.note_ar },
    { k: 'gain', label: 'الكسب المعياري (قبلي ← بعدي)', v: n.gain.pct === null ? null : `${n.gain.pct > 0 ? '+' : ''}${n.gain.pct}%`, sub: n.gain.pct === null ? '' : `${n.gain.pre} ← ${n.gain.post} · n=${n.gain.n}`, note: n.gain.note_ar },
    { k: 'attendance', label: 'الالتزام بالحضور', v: pct(n.attendance.pct), sub: n.attendance.pct === null ? '' : `${n.attendance.sessions} جلسة · ${n.attendance.n} منسوبًا`, note: n.attendance.note_ar },
  ];
  return (
    <article className={`lrs${status === 'revoked' ? ' revoked' : ''}${compact ? ' compact' : ''}`} data-testid="lrs-sheet" lang="ar" dir="rtl">
      <header className="lrs-head">
        <div className="lrs-org">{logo ? <img src={logo} alt="" /> : null}<div><h1>{b.organization.name_ar}</h1><small>{b.people.members} منسوبًا مؤكَّدًا{b.people.pending ? ` · ${b.people.pending} بانتظار التأكيد` : ''}{b.people.programs ? ` · ${b.people.programs} برنامجًا في الفترة` : ''}</small>{b.pseudonymous ? <span className="lrs-badge" data-testid="lrs-pseud">أرقام تدريبية لا أسماء</span> : null}</div></div>
        <div className="lrs-title"><b>تقرير القيادة</b><span>التقرير الدوري الموقَّع لأثر التدريب على مستوى الجهة</span><em data-testid="lrs-period">{b.period.label_ar}</em></div>
        <div className="lrs-qr"><span dangerouslySetInnerHTML={{ __html: qrSvg(verifyUrl, 74, 'M', '#0f2a4e') }} /><code data-testid="lrs-code">{b.code}</code></div>
      </header>

      {b.previous ? <><h2>ما قرّرتم آخر مرّة <i>{b.previous.code}</i></h2><div className="lrs-prev" data-testid="lrs-prev">{b.previous.read_ar}</div></> : null}

      <h2>ثلاثة أرقام <i>الثلاثة نفسها في كل تقرير — حتى يُحفظ الرقم من مرّة إلى مرّة</i></h2>
      <div className="lrs-nums">{tiles.map((t) => <div className="lrs-num" key={t.k} data-testid={`lrs-num-${t.k}`}><b>{t.label}</b>{t.v ? <><strong>{t.v}</strong><small>{t.sub}</small></> : <strong className="na">{t.note || 'لم يُقس بعد'}</strong>}</div>)}</div>

      <h2>خريطة المهارات <i>أعلى خمس مهارات في الفترة</i></h2>
      {b.skills.length ? <table className="lrs-table" data-testid="lrs-skills"><thead><tr><th>المهارة</th><th>متوسط المستوى</th><th>المنسوبون</th><th>معتمَد</th><th>مُثبَت ميدانيًّا</th></tr></thead><tbody>{b.skills.map((s) => <tr key={s.name_ar}><td>{s.name_ar}</td><td>{s.avg_level ?? '—'}</td><td>{s.learners}</td><td>{s.approved}</td><td>{s.proven}</td></tr>)}</tbody></table> : <div className="lrs-note">لا مهارات مقيسة في هذه الفترة بعد — تظهر هنا حين تُحسب مستويات المنسوبين وتُعتمد.</div>}

      <h2>ما قاله الميدان <i>سطور مجهَّلة · k ≥ 5 · مما سُمح بعرضه داخل بوابة الجهة</i></h2>
      {b.field.lines.length ? <><ul className="lrs-field" data-testid="lrs-field">{b.field.lines.map((l, i) => <li key={i}>{l}</li>)}</ul><div className="lrs-src">المصدر: {b.field.sources_ar.join(' · ')}{b.field.people ? ` · ${b.field.people} كاتبًا` : ''}</div></> : <div className="lrs-note" data-testid="lrs-field-empty">{b.field.note_ar}</div>}

      <h2>ثلاثة أسئلة للقيادة <i>تُولَّد من فجوات البيانات لا من ذكاء اصطناعي</i></h2>
      <ol className="lrs-qs" data-testid="lrs-questions">{b.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>

      <h2>قرار القيادة <i>قرارٌ واحد يكفي — يُختم داخل الوثيقة ويعود صداه إلى المنسوبين</i></h2>
      {b.decision ? <div className="lrs-dec" data-testid="lrs-decision"><b>قرّرت القيادة في {fmt(b.decision.at)}</b><p>{b.decision.text_ar}</p>{b.decision.note_ar ? <small>{b.decision.note_ar}</small> : null}</div> : <div className="lrs-dec empty" data-testid="lrs-decision-empty">لم يُختم قرار بعد — يختاره مدير الجهة من بوابة الجهة ← «تقرير القيادة»، فيُعاد توقيع هذه الصفحة بنفس الرمز.</div>}

      <footer className="lrs-foot">
        <div><b>الدرع:</b> {b.tail.shield ? `${b.tail.shield.month_ar} — ${b.tail.shield.passed_days}/${b.tail.shield.total_days} يومًا · ${b.tail.shield.code}` : 'لا ختم شهري بعد'}<br /><b>سياسة الجهة:</b> {b.tail.policy_seal ? `${b.tail.policy_seal.code} (${fmt(b.tail.policy_seal.issued_at)})` : 'الافتراضات'}{b.tail.charter ? <><br /><b>الميثاق:</b> {b.tail.charter.code || 'موقَّع'}{b.tail.charter.expires_at ? ` حتى ${fmt(b.tail.charter.expires_at)}` : ''}</> : null}{b.tail.pledge ? <><br /><b>عهد الجهة:</b> {b.tail.pledge.title_ar}</> : null}</div>
        <div className="lrs-sign"><strong>{b.issued.name || 'مدير الجهة'}{b.issued.title ? ` — ${b.issued.title}` : ''}</strong>صدر في {fmt(b.issued.at)} · {b.proof ? <span className="lrs-ok">موقَّع رقميًّا Ed25519 ✓</span> : 'بلا توقيع رقمي (مفتاح الخادم غير مهيّأ)'}<br />للتحقّق: <span dir="ltr">{verifyUrl}</span></div>
      </footer>
      <div className="lrs-brand">بوابة أَثَر — منهجية قياس أثر التدريب وضمان انتقاله إلى الميدان · أرقام وأعداد فقط، لا أسماء · © 2026</div>
    </article>
  );
}
