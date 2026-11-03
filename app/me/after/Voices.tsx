'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P39 «أصوات حول الشهادة» — ثلاثة صناديق صغيرة داخل /me/after لكل برنامج أتممته:
 *  <LetterBox>   «رسالة إلى نفسي بعد سنة»: تُكتب في آخر أيام البرنامج وتُختم؛ تُفتح مع محطة السنة فوق نموذجها بعنوان «ما قلته لنفسك قبل سنة»
 *  <OfferBox>    «البرنامج يردّ»: عرض ورشة تطبيق لمن كتبوا «لم تسنح الفرصة» — «أرغب» / «لا، شكرًا» (إجابة واحدة تُبدَّل)
 *  <MeasureBox>  «قياسك في مِعيار»: مستوى الالتحاق ↔ أول قياس بعد البرنامج، وخيار إضافته إلى وثيقة «أثر بعد»
 */
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { P39_NAMES_AR, LETTER_QUESTION_AR, LETTER_PRIVACY_AR, LETTER_MIN, LETTER_MAX, LETTER_PHASE_AR, OFFER_REPLY_AR } from '../../../lib/after/voices';

type Post = (body: any) => Promise<any>;

export function LetterBox({ item, post, busy, ar }: { item: any; post: Post; busy: string; ar: boolean }) {
  const l = item.letter; const [text, setText] = useState(''); const [open, setOpen] = useState(false);
  if (!l) return null;
  if (l.phase === 'future') return null;   // لا نشوّش قبل أوانها
  return <div className={`vo-letter ${l.phase}`} data-testid="vo-letter" data-phase={l.phase}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="vo-head"><Icon name="mail" size={16} /> <b>{l.phase === 'opened' ? (ar ? P39_NAMES_AR.letter_opened : 'What you told yourself a year ago') : (ar ? P39_NAMES_AR.letter : 'A letter to myself in one year')}</b><span className="vo-ph">{LETTER_PHASE_AR[l.phase as keyof typeof LETTER_PHASE_AR]}</span></div>
    {l.phase === 'opened' && <>
      <blockquote data-testid="vo-letter-text">{l.text_ar}</blockquote>
      <small className="pt-muted">{ar ? `ختمتها في ${String(l.sealed_at).slice(0, 10)} وفُتحت في ${String(l.opened_at).slice(0, 10)} — اقرأها ثم اكتب محطة السنة بما فعلته فعلًا.` : `Sealed ${String(l.sealed_at).slice(0, 10)} · opened ${String(l.opened_at).slice(0, 10)}.`}</small>
      <label className="vo-chk"><input type="checkbox" checked={!!l.in_doc} onChange={e => post({ action: 'letter_in_doc', id: l.id, on: e.target.checked })} data-testid="vo-letter-indoc" /> {ar ? 'أضف إلى وثيقة «أثر بعد» جملة أني كتبت لنفسي وفتحتها — بلا نصّها' : 'Add one line to my document — without the text'}</label>
    </>}
    {l.phase === 'sealed' && <p className="pt-muted" data-testid="vo-letter-sealed">{ar ? `مختومة منذ ${String(l.sealed_at).slice(0, 10)} — تُفتح لك في ${l.unseals} مع محطة السنة. لا يراها أحد قبلك.` : `Sealed — opens ${l.unseals}.`}</p>}
    {l.phase === 'missed' && <p className="pt-muted">{ar ? 'فات وقت الرسالة — تبقى بلا رسالة؛ لا كتابة بأثر رجعي.' : 'Its window passed — no letter.'}</p>}
    {l.phase === 'open' && !open && <><p className="pt-muted">{ar ? `قبل أن تُغلق صفحة البرنامج: اكتب لنفسك بعد سنة. تُختم فورًا وتُفتح في ${l.unseals}.` : `Write to yourself one year ahead. Sealed now, opened ${l.unseals}.`}</p><button type="button" className="pt-btn light" onClick={() => setOpen(true)} data-testid="vo-letter-write">{ar ? 'اكتب رسالتك' : 'Write the letter'}</button></>}
    {l.phase === 'open' && open && <form className="vo-form" onSubmit={e => { e.preventDefault(); post({ action: 'letter_write', enrollment_id: item.id, text_ar: text }).then((j: any) => { if (j) { setOpen(false); setText(''); } }); }}>
      <label>{LETTER_QUESTION_AR} <small className="pt-muted">({text.length}/{LETTER_MAX} · {ar ? `من ${LETTER_MIN} حرفًا` : `min ${LETTER_MIN}`})</small><textarea rows={4} maxLength={LETTER_MAX} value={text} onChange={e => setText(e.target.value)} data-testid="vo-letter-textarea" required /></label>
      <p className="pt-muted">{LETTER_PRIVACY_AR}</p>
      <div className="vo-acts"><button type="submit" className="pt-btn" disabled={busy === 'letter_write' || text.trim().length < LETTER_MIN} data-testid="vo-letter-send">{ar ? 'اختم الرسالة' : 'Seal the letter'}</button><button type="button" className="pt-btn light" onClick={() => setOpen(false)}>{ar ? 'ليس الآن' : 'Not now'}</button></div>
    </form>}
  </div>;
}

export function OfferBox({ item, post, busy, ar }: { item: any; post: Post; busy: string; ar: boolean }) {
  const o = item.offer; if (!o) return null;
  return <div className="vo-offer" data-testid="vo-offer"><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="vo-head"><Icon name="users" size={16} /> <b>{ar ? P39_NAMES_AR.offer : 'The program answers'}: {o.title_ar}</b></div>
    <p className="vo-otext">{o.text_ar}</p>
    {o.link && <a href={o.link} target={o.link.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="vo-link">{ar ? 'القاعة / الموعد ↗' : 'Room / time ↗'}</a>}
    <div className="vo-acts" role="group" aria-label={ar ? 'إجابتك' : 'Your answer'}>
      {(['want', 'no'] as const).map(r => <button key={r} type="button" className={`pt-btn ${o.my_reply === r ? '' : 'light'}`} aria-pressed={o.my_reply === r} disabled={busy === 'offer_reply'} onClick={() => post({ action: 'offer_reply', offer_id: o.id, reply: r })} data-testid={`vo-offer-${r}`}>{OFFER_REPLY_AR[r]}</button>)}
      {o.my_reply && <small className="pt-muted" data-testid="vo-offer-mine">{ar ? `إجابتك: ${OFFER_REPLY_AR[o.my_reply as 'want' | 'no']} — تُبدَّل ما دام العرض قائمًا` : `Your answer: ${o.my_reply}`}</small>}
    </div>
    <small className="pt-muted">{ar ? 'كتب خمسة منكم «لم تسنح الفرصة» فردّ البرنامج بورشة تطبيق — إنسان كتب هذا العرض، وإجابتك تُرى للطاقم عددًا لا اسمًا على الصفحة العامة.' : 'Five of you wrote “no chance yet”, so the program answered with an application workshop.'}</small>
  </div>;
}

export function MeasureBox({ item, post, busy, ar }: { item: any; post: Post; busy: string; ar: boolean }) {
  const m = item.measure; if (!m) return null;
  return <div className="vo-measure" data-testid="vo-measure" data-has-after={m.has_after ? '1' : '0'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
    <div className="vo-head"><Icon name="trend" size={16} /> <b>{ar ? P39_NAMES_AR.measure : 'Your measure in Miaar'}</b></div>
    <p className="vo-mline" data-testid="vo-measure-line">{m.line_ar}</p>
    {m.has_after
      ? <label className="vo-chk"><input type="checkbox" checked={!!item.measure_in_doc} onChange={e => post({ action: 'measure_in_doc', enrollment_id: item.id, on: e.target.checked })} disabled={busy === 'measure_in_doc'} data-testid="vo-measure-indoc" /> {ar ? 'أضف القياس إلى وثيقة «أثر بعد» (الالتحاق → بعد البرنامج وتاريخه)' : 'Add this measure to my After document'}</label>
      : <Link href="/miaar" className="pt-btn light" data-testid="vo-measure-go">{ar ? 'قِس مستواك في مِعيار' : 'Measure your level in Miaar'}</Link>}
    <small className="pt-muted">{ar ? 'القياس اختيارك ولا يُفرض؛ لا يظهر فرديًا في أي صفحة عامة — وصفحة البرنامج تتكلم عنه من خمسة بالكلمات.' : 'Optional; never shown individually in public.'}</small>
  </div>;
}

const CSS = `
.vo-letter,.vo-offer,.vo-measure{border:1.5px solid #e2e8f0;border-radius:14px;padding:12px 14px;background:#fff;margin:10px 0;display:grid;gap:8px}
.vo-letter.opened{border-color:#c9a24b;background:#fffdf5}.vo-letter.open{border-color:#0b8a83;background:#f0fdfa}.vo-offer{border-color:#0f2a4e;background:#f8fafc}.vo-measure{border-style:dashed}
.vo-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;color:#0f2a4e}.vo-head b{font-size:15px}.vo-ph{font-size:11px;font-weight:800;border-radius:999px;padding:2px 10px;background:#e2e8f0;color:#334155}
.vo-letter blockquote{margin:0;padding:10px 14px;border-inline-start:3px solid #c9a24b;background:#fff;border-radius:8px;line-height:2;color:#1f2937;font-size:16px}
.vo-form{display:grid;gap:10px}.vo-form>label{display:grid;gap:6px;font-weight:700;color:#0f2a4e}.vo-form textarea{border:1.5px solid #cbd5e1;border-radius:10px;padding:9px 12px;font:inherit;min-height:110px;width:100%;box-sizing:border-box;line-height:1.8}
.vo-acts{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.vo-chk{display:flex;gap:8px;align-items:center;font-size:14px;color:#1f2937;min-height:44px}.vo-chk input{width:20px;height:20px}
.vo-otext{margin:0;line-height:1.9;color:#1f2937}.vo-link{color:#0b6f69;font-weight:800;text-decoration:underline}.vo-mline{margin:0;font-weight:800;color:#0f2a4e;line-height:1.9}
.vo-letter :focus-visible,.vo-offer :focus-visible,.vo-measure :focus-visible{outline:3px solid #c9a24b;outline-offset:2px}
`;
