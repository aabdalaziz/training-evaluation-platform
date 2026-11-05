'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * م7 «عُبور للجهات» — نافذة «طلب خدمة»: خدمة الاختبار المعياري (CEFR) لمجموعة من خارج البرامج (معهد آخر · أفراد طلبوا الاختبار فقط).
 *  تُفتح من منشئ النماذج (بطاقة SYS-EXIT-<L>) ومن لسان الدعوات. الاختبار نفسه لا يتغيّر — ما يتغيّر «الوعاء»:
 *  الجهة الطالبة · منسّقها · النافذة · المقاعد · وضع الهوية · «رمز القاعة» للمراقب → QR + رابط + بطاقة A4 باسم الجهة + رابط «بوابة الجهة» (يُعرض مرة واحدة).
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { qrSvg } from '../../lib/certificates/qr';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'] as const;
const SKN: Record<string, [string, string]> = { listening: ['الاستماع', 'Listening'], reading: ['القراءة', 'Reading'], grammar_vocab: ['المفردات والتراكيب', 'Use of language'], writing: ['الكتابة', 'Writing'], speaking: ['التحدّث', 'Speaking'] };
const localIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
function esc(s: string) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }

type Props = { level?: string | null; onClose: () => void; onCreated?: (res: any) => void };
export default function ServiceInviteModal({ level: initial = null, onClose, onCreated }: Props) {
  const [level, setLevel] = useState<string>(initial && (LEVELS as readonly string[]).includes(initial) ? initial : 'A1');
  const [client, setClient] = useState(''); const [contact, setContact] = useState(''); const [opens, setOpens] = useState(''); const [closes, setCloses] = useState(''); const [seats, setSeats] = useState('30');
  const [identity, setIdentity] = useState<'email' | 'email_id'>('email'); const [pinMode, setPinMode] = useState<'none' | 'auto' | 'custom'>('auto'); const [pin, setPin] = useState(''); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<any>(null); const [pool, setPool] = useState<any>(null); const [copied, setCopied] = useState('');
  useEffect(() => { const now = new Date(); setOpens(localIso(now)); setCloses(localIso(new Date(now.getTime() + 3 * 3600_000))); }, []);
  async function H() { const { data } = await supabase().auth.getSession(); return { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` }; }
  useEffect(() => { (async () => { try { const r = await fetch(`/api/admin/miaar/exit?pool=${level}`, { headers: await H(), cache: 'no-store' }); const j = await r.json().catch(() => ({})); setPool(j?.pool || null); } catch { setPool(null); } })(); }, [level]);
  async function create() {
    setBusy(true); setErr('');
    try {
      const body = { action: 'create', client_name: client, client_contact: contact, level, opens_at: opens ? new Date(opens).toISOString() : null, expires_at: closes ? new Date(closes).toISOString() : null, max_seats: Number(seats) || null, identity_mode: identity, auto_pin: pinMode === 'auto', pin: pinMode === 'custom' ? pin : null, note };
      const r = await fetch('/api/admin/miaar/service', { method: 'POST', headers: await H(), body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setRes(j); onCreated?.(j);
    } catch (e: any) { setErr(e?.message || 'error'); }
    setBusy(false);
  }
  async function copy(text: string, k: string) { try { await navigator.clipboard.writeText(text); setCopied(k); window.setTimeout(() => setCopied(''), 1500); } catch { window.prompt('انسخ:', text); } }
  function printCard() {
    if (!res) return; const w = window.open('', '_blank'); if (!w) return; const spec = res.spec;
    const rows = spec.rows.map((r: any) => `<tr><td>${esc(SKN[r.skill][0])} · ${esc(SKN[r.skill][1])}</td><td>${r.count} ${esc(r.unit_ar)}</td><td>${Math.round(r.weight)}%</td></tr>`).join('');
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(res.order.client_name)} — ${esc(level)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;text-align:center;line-height:1.7}h1{font-size:24px;margin:6px 0}h2{font-size:18px;margin:0;color:#0b8a83}.k{color:#c9a24b;font-weight:800}.qr svg{width:300px;height:300px}code{font-size:14px}table{margin:14px auto;border-collapse:collapse;font-size:13px}td,th{border:1px solid #e2e8f0;padding:5px 10px}th{background:#f8fafc}.pin{display:inline-block;margin:10px 0;padding:8px 18px;border:2px dashed #0b8a83;border-radius:12px;font-size:26px;letter-spacing:6px;font-weight:900;color:#0b8a83}.f{font-size:11px;color:#64748b;margin-top:16px}</style></head><body>
<p class="k">${esc(res.service.ar)} · ${esc(res.service.en)}</p><h2>${esc(res.official.ar)}</h2><h2 dir="ltr">${esc(res.official.en)}</h2><h1>${esc(res.order.client_name)} — المستوى ${esc(level)}</h1>
<div class="qr">${qrSvg(res.url, 300)}</div><code dir="ltr">${esc(res.url)}</code>
${res.pin ? `<div><small>رمز القاعة — يعلنه المراقب عند البدء · Room code</small><br><span class="pin">${esc(res.pin)}</span></div>` : ''}
<table><thead><tr><th>المحور · Domain</th><th>العدد · Count</th><th>الوزن · Weight</th></tr></thead><tbody>${rows}</tbody></table>
<p>${spec.minutes} دقيقة · اجتياز ≥ ${spec.cut}% ولا مهارة دون ${spec.skillMin}% · جدول المواصفات ${esc(spec.version)}</p>
<p class="f">يُفتح ${opens ? esc(new Date(opens).toLocaleString('ar-SA')) : '—'} · يُغلق ${closes ? esc(new Date(closes).toLocaleString('ar-SA')) : '—'} · المقاعد ${esc(seats)} · البنود ومفاتيحها لا تُشارك · © 2026 مِعيار — من أَثَر</p></body></html>`);
    w.document.close();
  }
  const narrow: any[] = pool?.narrow || [];
  return <div className="sv-back" role="dialog" aria-modal="true" aria-label="طلب خدمة اختبار معياري" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="sv-modal" data-testid="sv-modal">
      <style>{CSS}</style>
      <header><div><div className="sv-k"><Icon name="qr" size={14} /> خدمة الاختبار المعياري للجهات</div><h3>اختبار نهاية المستوى — معياري (CEFR) · لجهة من خارج البرامج</h3><small>الاختبار نفسه SYS-EXIT — ما يتغيّر هو الجهة والمراقب والتقرير</small></div><button type="button" className="sv-x" onClick={onClose} aria-label="إغلاق">✕</button></header>
      {err && <div className="sv-err" role="alert">{err}</div>}
      {!res && <>
        <div className="sv-row"><span>المستوى</span><div className="sv-seg">{LEVELS.map((l) => <button key={l} type="button" className={level === l ? 'on' : ''} onClick={() => setLevel(l)} data-testid={`sv-level-${l}`}>{l}</button>)}</div></div>
        <div className="sv-grid">
          <label><span>الجهة الطالبة (معهد / جامعة / «أفراد»)</span><input value={client} onChange={(e) => setClient(e.target.value)} maxLength={120} placeholder="مثال: معهد النور للغات — الرياض" data-testid="sv-client" /></label>
          <label><span>منسّق الجهة (بريد أو جوال)</span><input value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} dir="ltr" data-testid="sv-contact" /></label>
          <label><span>يُفتح</span><input type="datetime-local" value={opens} onChange={(e) => setOpens(e.target.value)} /></label>
          <label><span>يُغلق</span><input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} /></label>
          <label><span>المقاعد</span><input type="number" min={1} max={5000} value={seats} onChange={(e) => setSeats(e.target.value)} data-testid="sv-seats" /></label>
          <label><span>هوية الطالب</span><select value={identity} onChange={(e) => setIdentity(e.target.value as any)} data-testid="sv-identity"><option value="email">الاسم والبريد</option><option value="email_id">الاسم والبريد + رقم هوية/طالب</option></select></label>
          <label><span>رمز القاعة (يعلنه المراقب)</span><select value={pinMode} onChange={(e) => setPinMode(e.target.value as any)} data-testid="sv-pinmode"><option value="auto">توليد تلقائي (مستحسن)</option><option value="custom">أحدّده بنفسي</option><option value="none">بلا رمز (عن بُعد)</option></select></label>
          {pinMode === 'custom' && <label><span>الرمز (4–8 بلا صفر/O)</span><input value={pin} onChange={(e) => setPin(e.target.value.toUpperCase())} maxLength={8} dir="ltr" data-testid="sv-pin" /></label>}
        </div>
        <label className="sv-note"><span>ملاحظة الاتفاق (حسب المشروع — اختياري)</span><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="مثال: 30 مقعدًا · تسليم التقرير خلال 5 أيام من آخر تصحيح" /></label>
        {narrow.length > 0 && <div className="sv-warn" data-testid="sv-narrow">السلّة الضيّقة: {narrow.map((c: any) => `${SKN[c.skill]?.[0] || c.skill} ${c.have}/${c.need}`).join(' · ')} — تكرار البنود بين الطلاب وارد.</div>}
        <p className="sv-muted">لا بنود مخصّصة ولا تخفيف — المعيارية تقتضي أن يكون اختبار الخارج عين اختبار الداخل. نتائج الجهة لا تدخل في مؤشرات برامج أَثَر.</p>
        <button type="button" className="sv-go" onClick={() => void create()} disabled={busy || client.trim().length < 2} data-testid="sv-create">{busy ? '…' : 'إنشاء الدعوة والباركود'}</button>
      </>}
      {res && <div className="sv-body" data-testid="sv-result" data-code={res.invite.code}>
        <p className="sv-reused">طلب خدمة جديد · <b>{res.order.client_name}</b> · المستوى <b>{level}</b> · <code dir="ltr">{res.invite.code}</code></p>
        <div className="sv-qr" dangerouslySetInnerHTML={{ __html: qrSvg(res.url, 200) }} />
        <code dir="ltr">{res.url}</code>
        {res.pin && <div className="sv-pin" data-testid="sv-pin-shown"><small>رمز القاعة — يعلنه المراقب عند البدء</small><b dir="ltr">{res.pin}</b></div>}
        <div className="sv-client" data-testid="sv-client-link"><small>رابط «بوابة الجهة» — يُعرض مرة واحدة؛ أرسله لمنسّق الجهة (قراءة فقط · قابل للإبطال)</small><code dir="ltr">{res.client_url}</code><button type="button" onClick={() => void copy(res.client_url, 'c')}>{copied === 'c' ? 'نُسخ ✓' : 'نسخ رابط الجهة'}</button></div>
        <div className="sv-acts">
          <button type="button" onClick={() => void copy(res.url, 'u')} data-testid="sv-copy"><Icon name="copy" size={14} /> {copied === 'u' ? 'نُسخ ✓' : 'نسخ رابط الاختبار'}</button>
          <button type="button" onClick={printCard} data-testid="sv-print"><Icon name="print" size={14} /> بطاقة A4</button>
          <a href={`/admin/miaar/exit?invite=${res.invite.id}`} target="_blank" rel="noreferrer" data-testid="sv-board"><Icon name="arrow" size={14} /> لوحة المجموعة</a>
          <a href={res.url} target="_blank" rel="noreferrer">معاينة</a>
        </div>
      </div>}
    </div>
  </div>;
}

const CSS = `
.sv-back{position:fixed;inset:0;background:rgba(15,42,78,.45);display:grid;place-items:center;z-index:1000;padding:16px}
.sv-modal{background:#fff;border-radius:16px;width:min(640px,100%);max-height:92vh;overflow:auto;padding:18px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit;color:#0f2a4e;text-align:start}
.sv-modal header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.sv-modal h3{margin:2px 0;font-size:17px}.sv-modal header small{color:#475569;font-weight:700}.sv-k{font-size:12px;font-weight:900;color:#8a6a1f;display:inline-flex;gap:6px;align-items:center}
.sv-x{border:0;background:#f1f5f9;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:14px}
.sv-row{display:grid;gap:6px}.sv-row span{font-size:12.5px;font-weight:800;color:#334155}.sv-seg{display:flex;gap:6px;flex-wrap:wrap}.sv-seg button{font:inherit;font-size:13px;font-weight:900;border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:6px 14px;cursor:pointer;color:#0f2a4e}.sv-seg button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.sv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px}.sv-grid label,.sv-note{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155}.sv-grid input,.sv-grid select,.sv-note input{font:inherit;font-size:13px;border:1px solid #cbd5e1;border-radius:10px;padding:7px 8px;color:#0f2a4e;min-width:0;background:#fff}
.sv-warn{background:#fffbeb;color:#92400e;border:1px solid #fde68a;border-radius:10px;padding:8px 12px;font-weight:800;font-size:12.5px;line-height:1.7}
.sv-err{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px}.sv-muted{color:#64748b;font-size:12.5px;margin:0;line-height:1.7}
.sv-go{font:inherit;font-size:14px;font-weight:900;background:#0f2a4e;color:#fff;border:0;border-radius:12px;padding:11px 16px;cursor:pointer}.sv-go[disabled]{opacity:.5;cursor:not-allowed}
.sv-body{display:grid;gap:8px;justify-items:center;text-align:center;border:1.5px solid #c9a24b;border-radius:14px;padding:14px;background:linear-gradient(180deg,#fffdf5,#fff)}.sv-qr svg{width:200px;height:200px;display:block}.sv-body code{font-size:12.5px;word-break:break-all}.sv-reused{margin:0;font-size:13px;font-weight:800;color:#0b8a83}
.sv-pin{display:grid;gap:2px;justify-items:center}.sv-pin small{color:#475569;font-weight:700;font-size:12px}.sv-pin b{font-size:26px;letter-spacing:6px;color:#0b8a83;border:2px dashed #0b8a83;border-radius:12px;padding:4px 16px}
.sv-client{display:grid;gap:6px;justify-items:center;width:100%;background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:8px}.sv-client small{color:#0f5c57;font-weight:800;font-size:12px;line-height:1.6}.sv-client button{font:inherit;font-size:12.5px;font-weight:900;border:1px solid #0b8a83;background:#fff;color:#0b8a83;border-radius:9px;padding:5px 12px;cursor:pointer}
.sv-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.sv-acts button,.sv-acts a{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:900;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:7px 12px;cursor:pointer;color:#0f2a4e;text-decoration:none}
`;
