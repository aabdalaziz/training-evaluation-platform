'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P52 «رسالة الشهر» — تبويب في بوابة الجهات: أرشيف الرسائل الموقَّعة شهرًا بشهر · فتح الرسالة · طباعة · «ردّ الجهة» من سطر واحد
 *  testids: orl-root orl-list orl-item[data-id] orl-empty orl-open orl-sheet orl-reply orl-reply-send orl-ok orl-err orl-print
 */
import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../../lib/ui/icons';
import { LetterSheet, type LetterView } from './LetterSheet';

type Letter = LetterView & { id: string };
type Props = { orgId: string; lang: 'ar' | 'en'; token: () => Promise<string> };
const monthAr = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][mo - 1]} ${y}`; };

export function OrgLetters({ orgId, lang, token }: Props) {
  const [letters, setLetters] = useState<Letter[] | null>(null); const [cur, setCur] = useState<Letter | null>(null); const [reply, setReply] = useState(''); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(''); const [err, setErr] = useState('');
  const ar = lang === 'ar';
  const load = useCallback(async () => { const tk = await token(); const r = await fetch(`/api/org/letters?org=${encodeURIComponent(orgId)}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }); const j = await r.json().catch(() => ({})); if (!r.ok || !j.success) { setErr(j.error || 'تعذّر التحميل'); setLetters([]); return; } setLetters(j.letters); setCur((c) => c ? j.letters.find((x: Letter) => x.id === c.id) || null : (j.letters[0] || null)); }, [orgId, token]);
  useEffect(() => { void load(); }, [load]);
  async function send() {
    if (!cur || busy || reply.trim().length < 2) return; setBusy(true); setOk(''); setErr(''); const tk = await token();
    const r = await fetch('/api/org/letters', { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reply', org: orgId, id: cur.id, text: reply }) }); const j = await r.json().catch(() => ({})); setBusy(false);
    if (!r.ok || !j.success) { setErr(j.error || 'تعذّر الإرسال'); return; } setOk(j.message || 'وصل ردّكم'); setReply(''); await load();
  }
  return <div className="orl" data-testid="orl-root">
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="orl-head no-print"><div><h3><Icon name="mail" size={18} /> {ar ? 'رسالة الشهر' : 'Monthly letter'}</h3><p className="pt-muted">{ar ? 'أول كل شهر: ثلاثة أرقام بكلمات، خيوط الشهر بلا أسماء، سطر موقَّع من أَثَر، ووعد للشهر القادم. تُحفظ شهرًا بشهر ويمكنكم الردّ بسطر.' : 'Each month: three numbers in words, anonymous threads, a signed human line, and a promise for next month.'}</p></div>
      {cur && <button type="button" className="pt-btn ghost small" onClick={() => window.print()} data-testid="orl-print"><Icon name="print" size={14} /> {ar ? 'اطبع / PDF' : 'Print / PDF'}</button>}</div>
    {err && <p className="orl-err" role="alert" data-testid="orl-err">{err}</p>}
    {ok && <p className="orl-ok" role="status" data-testid="orl-ok">{ok}</p>}
    {letters && letters.length === 0 && <div className="orl-empty" data-testid="orl-empty"><span aria-hidden="true">✉️</span><b>{ar ? 'لم تصل رسالة بعد' : 'No letter yet'}</b><p className="pt-muted">{ar ? 'تصل أول رسالة بعد اكتمال أول شهر يكون فيه لجهتكم خمسة منسوبين مؤكَّدين أو أكثر — ويوقّعها إنسان قبل أن تصل.' : 'The first letter arrives after the first full month with five or more confirmed members.'}</p></div>}
    {letters && letters.length > 0 && <div className="orl-grid">
      <ul className="orl-list no-print" data-testid="orl-list">{letters.map((l) => <li key={l.id} data-testid="orl-item" data-id={l.id} className={cur?.id === l.id ? 'on' : ''}><button type="button" onClick={() => { setCur(l); setOk(''); setErr(''); }} data-testid="orl-open"><b>{monthAr(l.month)}</b><small>{l.signed_name}{l.reply_ar ? ' · 💌' : ''}</small></button></li>)}</ul>
      <div className="orl-main">
        {cur && <div data-testid="orl-sheet"><LetterSheet l={cur} />
          {!cur.reply_ar && <div className="orl-reply no-print" data-testid="orl-reply"><label>{ar ? 'ردّ الجهة — سطر واحد يصل إلى موقِّع الرسالة' : 'One-line reply to the signer'}<textarea value={reply} onChange={(e) => setReply(e.target.value.slice(0, 280))} rows={2} placeholder={ar ? 'شكرًا، أو سؤال، أو ما تودّون أن نراه الشهر القادم…' : 'Thanks, a question, or what you want next month…'} /></label><div className="orl-acts"><button type="button" className="pt-btn small" onClick={() => void send()} disabled={busy || reply.trim().length < 2} data-testid="orl-reply-send"><Icon name="send" size={14} /> {busy ? '…' : (ar ? 'أرسل الردّ' : 'Send reply')}</button><small className="pt-muted">{reply.length}/280</small></div></div>}
        </div>}
      </div>
    </div>}
  </div>;
}

const CSS = `
.orl{display:grid;gap:12px}.orl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap}.orl-head h3{margin:0 0 4px;display:flex;gap:8px;align-items:center}.orl-head p{margin:0;max-width:720px}
.orl-grid{display:grid;grid-template-columns:200px 1fr;gap:14px;align-items:start}.orl-list{list-style:none;margin:0;padding:0;display:grid;gap:6px}.orl-list button{width:100%;text-align:start;background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:10px 12px;font:inherit;cursor:pointer;display:grid;gap:2px;min-height:44px}.orl-list li.on button{border-color:#c9a24b;background:#fffbeb}.orl-list small{color:#64748b;font-size:12px}
.orl-empty{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:30px 18px;text-align:center}.orl-empty span{font-size:40px;display:block}.orl-empty b{display:block;font-size:18px;margin:6px 0}
.orl-reply{background:#fff;border:1px solid #e5e9f0;border-radius:14px;padding:12px 14px;margin-top:10px;max-width:820px;margin-inline:auto}.orl-reply label{display:grid;gap:6px;font-weight:800;font-size:14px}.orl-reply textarea{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 10px;font:inherit;font-weight:400;width:100%;box-sizing:border-box}.orl-acts{display:flex;gap:10px;align-items:center;margin-top:8px}
.orl-err{background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:8px 12px;margin:0}.orl-ok{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:8px 12px;margin:0}
@media (max-width:760px){.orl-grid{grid-template-columns:1fr}.orl-list{display:flex;overflow-x:auto;gap:6px}.orl-list li{min-width:150px}}
@media print{.no-print,.pt-header,.pt-footer,.og-tabs,.og-notice,.wb,nav{display:none!important}}
`;
