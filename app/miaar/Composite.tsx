'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * مِعيار — م13-ب: مكوّنا الاستجابة المركّبة (بلا سحب · لمس ولوحة مفاتيح وقارئ شاشة)
 *  <Matcher>  مطابقة: لكلّ عنصر أيسر صفّ أزرار بالخيارات اليمنى؛ نقرة تُقرن (والخيار المستعمل في صفّ آخر ينتقل). عند اكتمال كلّ الصفوف
 *             يُستدعى onComplete('b-a-d-c') — معرّف اليمين لكلّ أيسر بترتيبه.
 *  <Orderer>  ترتيب: قائمة بأزرار ▲▼؛ كلّ حركة تستدعي onComplete('c-a-d-b') بالترتيب الحالي؛ وزرّ «الترتيب صحيح كما هو» يثبّت الترتيب بلا حركة.
 *  <Cloze>    م14 فراغات بمصرف كلمات: النصّ يُعرض وفي موضع كلّ «___» قائمة منسدلة أصلية بالمصرف؛ عند امتلاء كلّ الفراغات onComplete('c-a-d').
 *  picture_sequence (م14) يستعمل <Orderer> نفسه مع pictures=true.
 *  القيمة المحفوظة (value) تُعاد إلى الحالة عند الرجوع إلى السؤال. يُستعمل في الاختبار والمِران والمعاينة.
 */
import { useEffect, useMemo, useState } from 'react';

export type CompOption = { id: string; text: string; image?: string | null; alt?: string | null };
export type CompLeft = { id: string; text: string; image?: string | null; alt?: string | null };
export type CompLabels = { matchHint: string; orderHint: string; keep: string; up: string; down: string; pairWith: string; position: string; clozeHint: string; blank: string; used: string; seqHint: string };
export const COMP_LABELS_AR: CompLabels = { matchHint: 'لكلّ عنصر على اليمين اختر ما يناسبه. يمكنك تغيير اختيارك.', orderHint: 'رتّب القطع بالأسهم حتى يستقيم الترتيب.', keep: 'الترتيب صحيح كما هو', up: 'إلى الأعلى', down: 'إلى الأسفل', pairWith: 'اقرن', position: 'الموضع', clozeHint: 'اختر لكلّ فراغ الكلمة المناسبة من القائمة. في المصرف كلمة زائدة أو اثنتان.', blank: 'الفراغ', used: 'مستعملة', seqHint: 'رتّب الصور بالأسهم حتى يستقيم التسلسل.' };
export const COMP_LABELS_EN: CompLabels = { matchHint: 'For each item on the right, pick what goes with it. You can change your choice.', orderHint: 'Use the arrows until the pieces are in the correct order.', keep: 'The order is correct as it is', up: 'Move up', down: 'Move down', pairWith: 'Pair', position: 'Position', clozeHint: 'Pick the right word for each gap from the list. The bank has one or two extra words.', blank: 'Gap', used: 'used', seqHint: 'Use the arrows until the pictures are in the correct sequence.' };

export const parseParts = (v: string | null | undefined): string[] => (typeof v === 'string' && v.includes('-') ? v.split('-') : []);

export function Matcher({ left, options, value, disabled, onComplete, labels = COMP_LABELS_AR, testId = 'mi-match' }: { left: CompLeft[]; options: CompOption[]; value?: string | null; disabled?: boolean; onComplete: (v: string) => void; labels?: CompLabels; testId?: string }) {
  const [parts, setParts] = useState<string[]>(() => { const p = parseParts(value); return left.map((_, i) => p[i] || ''); });
  useEffect(() => { const p = parseParts(value); if (p.length === left.length) setParts(p); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, left.length]);
  const pick = (row: number, id: string) => {
    if (disabled) return;
    const next = parts.map((x, i) => (i === row ? id : x === id ? '' : x)); setParts(next);
    if (next.every(Boolean)) onComplete(next.join('-'));
  };
  const cell = (o: CompOption) => (o.image ? <img src={o.image} alt={o.alt || o.text || ''} /> : <span dir="rtl" lang="ar">{o.text}</span>);
  return (
    <div className="mi-match" data-testid={testId}>
      <p className="mi-muted">{labels.matchHint}</p>
      {left.map((l, i) => (
        <div key={l.id} className="mi-match-row" role="group" aria-label={`${i + 1}. ${l.text || l.alt || ''}`}>
          <div className="mi-match-left"><span className="mi-letter">{i + 1}</span>{cell(l)}</div>
          <div className="mi-match-opts" role="radiogroup" aria-label={labels.pairWith}>
            {options.map((o) => { const on = parts[i] === o.id; const used = !on && parts.includes(o.id); return (
              <button key={o.id} type="button" role="radio" aria-checked={on} className={`mi-opt mi-opt-sm${on ? ' on' : ''}${used ? ' used' : ''}`} disabled={disabled} onClick={() => pick(i, o.id)} data-testid={`${testId}-opt`}>
                <span className="mi-letter">{o.id}</span>{cell(o)}<span className="mi-check" aria-hidden="true">{on ? '✓' : ''}</span>
              </button>); })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Orderer({ options, value, disabled, onComplete, labels = COMP_LABELS_AR, testId = 'mi-order', pictures = false }: { options: CompOption[]; value?: string | null; disabled?: boolean; onComplete: (v: string) => void; labels?: CompLabels; testId?: string; pictures?: boolean }) {
  const initial = useMemo(() => { const p = parseParts(value); return p.length === options.length ? p : options.map((o) => o.id); }, [value, options]);
  const [order, setOrder] = useState<string[]>(initial);
  useEffect(() => { setOrder(initial); }, [initial]);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const move = (i: number, d: -1 | 1) => {
    if (disabled) return; const j = i + d; if (j < 0 || j >= order.length) return;
    const next = order.slice(); [next[i], next[j]] = [next[j], next[i]]; setOrder(next); onComplete(next.join('-'));
  };
  const touched = typeof value === 'string' && value.length > 0;
  return (
    <div className={`mi-order${pictures ? ' pics' : ''}`} data-testid={testId}>
      <p className="mi-muted">{pictures ? labels.seqHint : labels.orderHint}</p>
      <ol className="mi-order-list">
        {order.map((id, i) => { const o = byId.get(id); if (!o) return null; return (
          <li key={id} className="mi-opt mi-order-item" data-testid={`${testId}-item`}>
            <span className="mi-letter">{i + 1}</span>
            {o.image ? <img src={o.image} alt={o.alt || o.text || ''} /> : <span dir="rtl" lang="ar">{o.text}</span>}
            <span className="mi-order-btns">
              <button type="button" aria-label={`${labels.up} — ${labels.position} ${i + 1}`} disabled={disabled || i === 0} onClick={() => move(i, -1)}>▲</button>
              <button type="button" aria-label={`${labels.down} — ${labels.position} ${i + 1}`} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)}>▼</button>
            </span>
          </li>); })}
      </ol>
      {!touched && <button type="button" className="mi-opt mi-opt-sm mi-order-keep" disabled={disabled} onClick={() => onComplete(order.join('-'))} data-testid={`${testId}-keep`}>{labels.keep}</button>}
    </div>
  );
}

export const BLANK_SPLIT = /_{3,}/;
export function Cloze({ text, options, value, disabled, onComplete, labels = COMP_LABELS_AR, testId = 'mi-cloze', hint = true }: { text: string; options: CompOption[]; value?: string | null; disabled?: boolean; onComplete: (v: string) => void; labels?: CompLabels; testId?: string; hint?: boolean }) {
  const segments = useMemo(() => text.split(BLANK_SPLIT), [text]); const n = segments.length - 1;
  const [parts, setParts] = useState<string[]>(() => { const p = parseParts(value); return Array.from({ length: n }, (_, i) => p[i] || ''); });
  useEffect(() => { const p = parseParts(value); if (p.length === n) setParts(p); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [value, n]);
  const pick = (i: number, id: string) => { if (disabled) return; const next = parts.map((x, k) => (k === i ? id : x)); setParts(next); if (next.every(Boolean)) onComplete(next.join('-')); };
  return (
    <div className="mi-cloze" data-testid={testId}>
      {hint && <p className="mi-muted">{labels.clozeHint}</p>}
      <p className="mi-cloze-text" dir="rtl" lang="ar">
        {segments.map((seg, i) => (
          <span key={i}>{seg}{i < n && (
            <select className={`mi-cloze-slot${parts[i] ? ' on' : ''}`} aria-label={`${labels.blank} ${i + 1}`} value={parts[i]} disabled={disabled} onChange={(e) => pick(i, e.target.value)} data-testid={`${testId}-slot`}>
              <option value="">{i + 1}. ……</option>
              {options.map((o) => { const used = parts.includes(o.id) && parts[i] !== o.id; return <option key={o.id} value={o.id} disabled={used}>{o.text}{used ? ` (${labels.used})` : ''}</option>; })}
            </select>)}
          </span>))}
      </p>
      <p className="mi-cloze-bank" aria-hidden="true">{options.map((o) => <span key={o.id} className={`mi-chip${parts.includes(o.id) ? ' used' : ''}`}>{o.text}</span>)}</p>
    </div>
  );
}

/** الأنماط المشتركة (تُحقن مرة في صفحة الاختبار والمِران) */
export const COMPOSITE_CSS = `
.mi-match{display:grid;gap:12px}.mi-match-row{display:grid;gap:8px;border:1px solid #EADFD6;border-radius:12px;padding:10px;background:#fff}
.mi-match-left{display:flex;align-items:center;gap:10px;font-weight:800;font-size:1.05em}.mi-match-left img,.mi-order-item img,.mi-opt-sm img{width:56px;height:56px;object-fit:contain}
.mi-match-opts{display:flex;flex-wrap:wrap;gap:8px}.mi-opt.mi-opt-sm{width:auto;padding:8px 12px;font-size:.98em}.mi-opt.used{opacity:.55}
.mi-order-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}.mi-order-item{cursor:default}.mi-order-btns{margin-inline-start:auto;display:flex;gap:6px}
.mi-order-btns button{min-width:44px;min-height:44px;border-radius:10px;border:1px solid #D9CBC2;background:#FBF4EE;font-size:18px;cursor:pointer}.mi-order-btns button:disabled{opacity:.35;cursor:default}
.mi-order-keep{margin-top:4px}
.mi-order.pics .mi-order-item img{width:84px;height:84px}
.mi-cloze-text{font-size:1.15em;line-height:2.4}.mi-cloze-slot{font:inherit;font-size:.95em;margin:0 4px;padding:4px 8px;border:2px dashed #B3A5AE;border-radius:8px;background:#fff;min-width:110px;vertical-align:middle}.mi-cloze-slot.on{border-style:solid;border-color:#D4614A;background:#E6F3F1}
.mi-cloze-bank{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}.mi-chip{border:1px solid #D9CBC2;border-radius:999px;padding:2px 10px;background:#FBF4EE;font-size:.95em}.mi-chip.used{opacity:.45;text-decoration:line-through}
`;
