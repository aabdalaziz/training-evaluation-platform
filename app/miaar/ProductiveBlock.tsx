'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** م4-ب: كتلة «المهارات الإنتاجية» في البطاقة — قيد التصحيح · معتمد (بالأبعاد وما قاله المصحّح) · لم تُقدَّم */
export default function ProductiveBlock({ block, ar, onOpen }: { block: any; ar: boolean; onOpen: (() => void) | null }) {
  if (!block || typeof block !== 'object') return null;
  const skills = ['الكتابة', 'التحدّث'].filter((k) => block[k]); if (!skills.length) return null;
  const st = (v: string) => v === 'معتمد' ? (ar ? 'معتمد' : 'Approved') : v === 'لم تُقدَّم' ? (ar ? 'لم تُقدَّم' : 'Not submitted') : (ar ? 'قيد التصحيح' : 'Being rated');
  return <div className="mi-rec mi-prod" data-testid="mi-productive" data-status={block.الحالة}>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <span>{ar ? 'المهارات الإنتاجية' : 'Productive skills'} · {st(block.الحالة)}</span>
    <div className="mi-prod-grid">{skills.map((k) => { const b = block[k] || {}; const name = k === 'الكتابة' ? (ar ? 'الكتابة' : 'Writing') : (ar ? 'التحدّث' : 'Speaking'); return <div key={k} className={`mi-prod-item ${b.الحالة === 'معتمد' ? 'ok' : b.الحالة === 'لم تُقدَّم' ? 'skip' : 'wait'}`} data-testid={`prod-${k === 'الكتابة' ? 'writing' : 'speaking'}`}>
      <b>{name}</b><em>{st(b.الحالة)}</em>
      {b.المستوى_المقدر && <strong className="mi-prod-lv">{b.المستوى_المقدر === 'PRE_A1' ? (ar ? 'ما قبل A1' : 'Pre-A1') : b.المستوى_المقدر}</strong>}
      {b.الحكم && <small>{b.الحكم}</small>}
      {b.الأبعاد && <ul>{Object.entries(b.الأبعاد).map(([d, v]) => <li key={d}><span>{d}</span><i>{String(v)}/5</i></li>)}</ul>}
      {b.ما_قاله_المصحح && <q>{b.ما_قاله_المصحح}</q>}
      {b.ما_قلتَه && <details className="mi-said" data-testid="prod-transcript"><summary>{ar ? 'ما قلتَه (نصّ تسجيلك)' : 'What you said (transcript)'}</summary><p dir="rtl" lang="ar">{b.ما_قلتَه}</p></details>}
      {b.تيسير && <small className="mi-note">{ar ? 'تيسير: ' : 'Accommodation: '}{b.تيسير}</small>}
      {b.الحالة === 'لم تُقدَّم' && onOpen && <button type="button" className="mi-link" onClick={onOpen}>{ar ? 'قدّمها الآن' : 'Do it now'}</button>}
    </div>; })}</div>
    {block.الوعد && <p className="mi-note">{ar ? block.الوعد : 'Read and heard by a human — your card completes on the same code within 48 hours'}</p>}
    {block.سياسة_الصوت && <p className="mi-note mi-audio-policy" data-testid="prod-audio-policy">{ar ? block.سياسة_الصوت : 'Your recording is deleted automatically 180 days after submission; the transcript and the rating remain.'}</p>}
  </div>;
}


const CSS = `
.mi-prod-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-top:8px}
.mi-prod-item{border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff}.mi-prod-item b{display:block;font-size:16px}.mi-prod-item em{font-style:normal;font-size:12px;font-weight:800;color:var(--muted)}
.mi-prod-item.ok em{color:var(--teal)}.mi-prod-item.wait em{color:#b45309}.mi-prod-lv{display:block;font-size:30px;color:var(--teal);margin:6px 0 2px}
.mi-prod-item ul{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:4px}.mi-prod-item li{display:flex;justify-content:space-between;font-size:13px;color:#334155}.mi-prod-item li i{font-style:normal;font-weight:900;color:var(--navy)}
.mi-prod-item q{display:block;margin:8px 0 0;font-size:13px;color:#334155;line-height:1.7;quotes:"«" "»"}
.mi-said{margin:8px 0 0;font-size:13px}.mi-said summary{cursor:pointer;font-weight:800;color:var(--teal)}.mi-said p{margin:6px 0 0;background:#fffdf7;border:1px solid var(--gold-line);border-radius:10px;padding:8px 10px;line-height:1.9;white-space:pre-wrap;color:#0f172a}.mi-audio-policy{font-size:12px}
`;
