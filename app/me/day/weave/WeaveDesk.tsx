'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * P59 «نسيج الشعبة — ما نسجه متعلّموك معًا» — مكتب المدرّب
 *  • اختيار الشعبة → كوكبة مجمَّعة (AtharMapSvg بالوضع المجمَّع) · مرآة بلا حكم · كلمات «لأن…» المأذونة · «كلمة على النسيج»
 *  • لا أسماء ولا أعداد تحت 5 — القاعدة مكتوبة في الصفحة نفسها
 *  testids: wv-root wv-rooms wv-room[data-id] wv-mirror wv-line wv-svg wv-threads wv-thread[data-state] wv-quotes wv-quote wv-locked wv-belowk wv-word-open wv-word-text wv-word-send wv-word-ok wv-star wv-err
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../../lib/supabase/client';
import { fastToken } from '../../../components/Pocket';
import { Icon } from '../../../../lib/ui/icons';
import { AtharMapSvg } from '../../../components/AtharMapSvg';
import type { SvgThread } from '../../../components/AtharMapSvg';
import type { Weave } from '../../../../lib/map/weave';
import type { WeaveRoom } from '../../../../lib/map/weave-load';
import type { RuleKey, StationKind, Station } from '../../../../lib/map/registry';

type Room = WeaveRoom;
type Data = { title: { ar: string; sub_ar: string }; official: { ar: string; en: string }; limits: { k: number }; rules: Record<RuleKey, { title: string; why: string }>; kinds: Record<StationKind, string>; room?: Room; rooms: Room[]; viewing_other: boolean; weave?: Weave; trainer_name?: string };
const qs = () => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams());

export default function WeaveDesk() {
  const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [d, setD] = useState<Data | null>(null); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [cid, setCid] = useState<string>(''); const [wordOpen, setWordOpen] = useState(false); const [word, setWord] = useState(''); const [ok, setOk] = useState('');
  useEffect(() => { fastToken(db).then((t) => setTok(t || '')); setCid(qs().get('classroom') || ''); }, [db]);
  const load = useCallback(async (t: string, c: string, fresh = false) => {
    setBusy(true); const j = await fetch(`/api/me/day/weave${c ? `?classroom=${encodeURIComponent(c)}${fresh ? '&fresh=1' : ''}` : ''}`, { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setD(j); setErr(''); if (!c && j.rooms?.length === 1) { setCid(j.rooms[0].id); } } else setErr(j?.error || 'تعذّر تحميل النسيج');
  }, []);
  useEffect(() => { if (tok) load(tok, cid); }, [tok, cid, load]);
  const pick = (id: string) => { setCid(id); setWordOpen(false); setOk(''); try { const u = new URL(window.location.href); u.searchParams.set('classroom', id); window.history.replaceState(null, '', u.toString()); } catch { /* لا تاريخ */ } };
  const w = d?.weave; const room = d?.room; const k = d?.limits.k || 5;
  const svgThreads: SvgThread[] = useMemo(() => (w ? w.threads.map((t) => ({ from: t.from, to: t.to, rule: t.rule, status: t.state === 'woven' ? 'kept' : 'proposed' })) : []), [w]);
  const stations = useMemo(() => (w ? (w.stations.map((s) => ({ key: s.key, kind: s.kind, at: s.at, title_ar: s.title_ar, public_ar: s.title_ar, skills: [] })) as Station[]) : []), [w]);
  async function sendWord() {
    if (!tok || !room || word.trim().length < 2) return; setBusy(true);
    const j = await fetch('/api/me/day/weave', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ classroom_id: room.id, text: word }) }).then((r) => r.json()).catch(() => null); setBusy(false);
    if (j?.success) { setOk(`وصلت كلمتك إلى ${j.recipients} من متعلّميك 🧶`); setWord(''); setWordOpen(false); } else setErr(j?.error || 'تعذّر الإرسال');
  }
  const suggest = w?.mirror.untaken_ar ? `قرأتُ نسيجكم. ${w.threads.find((t) => t.state === 'untaken')?.title_ar || ''} — خيط اقترحته أَثَر لكثيرين منكم ولم يأخذه أحد بعد؛ أحبّ أن أسمع رأيكم فيه في جلستنا القادمة.` : 'قرأتُ نسيجكم اليوم — شكرًا لكل من قال «لأن…». ';

  return (
    <main className="wv" dir="rtl" data-testid="wv-root"><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <nav className="wv-nav" aria-label="تنقّل"><Link href="/me/day" className="wv-link"><Icon name="arrow" size={14} /> دفتر اليوم</Link><Link href="/me" className="wv-link">مساحتي</Link><Link href="/" className="wv-link"><Icon name="home" size={14} /> الرئيسية</Link></nav>
      <header className="wv-head"><span className="pt-kicker"><Icon name="spark" size={14} /> {d?.official.ar || 'خريطة الأثر المجمَّعة للشعبة'}</span><h1>نسيج الشعبة <small>ما نسجه متعلّموك معًا</small></h1>
        <p>في «خريطة أثرك» يقول كلُّ متعلّم بنفسه ما قاد إلى ماذا. هنا ترى ما قالوه <b>معًا</b> — بلا أسماء: الخيوط التي نسجها خمسةٌ فأكثر تظهر سميكةً بعددهم، والخيوط التي اقترحناها لكثيرين ولم يأخذها أحد تظهر منقّطة. كلمة «لأن…» لا تصلك إلا بإذن صاحبها.</p></header>
      {tok === '' && <section className="pt-box"><p>سجّل الدخول. <Link href="/login?next=/me/day/weave">تسجيل الدخول</Link></p></section>}
      {err && <div className="wv-err" role="alert" data-testid="wv-err">{err}{/للمدرّبين/.test(err) && <> · <Link href="/me">مساحتي</Link></>}</div>}
      {ok && <div className="wv-ok" role="status" data-testid="wv-word-ok">{ok}</div>}
      {d && d.rooms.length > 0 && <section className="wv-rooms" data-testid="wv-rooms" aria-label="شُعبي">{d.rooms.map((r) => <button key={r.id} type="button" className={`wv-room ${r.id === cid ? 'on' : ''}`} onClick={() => pick(r.id)} data-testid="wv-room" data-id={r.id} aria-pressed={r.id === cid}><Icon name="users" size={14} /> شعبة {r.code}{r.section_name ? ` — ${r.section_name}` : ''} <small>{r.roster}</small></button>)}</section>}
      {d && !d.rooms.length && <section className="pt-box"><p className="wv-muted">لا شُعب مرتبطة ببطاقتك بعد — حين تُسند إليك شعبة يظهر نسيجها هنا.</p></section>}
      {d && !cid && d.rooms.length > 1 && <section className="pt-box"><p className="wv-muted">اختر شعبة لترى نسيجها.</p></section>}
      {busy && !w && cid && <section className="pt-box"><p className="wv-muted">نجمع خرائط متعلّميك… (لا نقرأ أسماءً، نعدّ فقط)</p></section>}

      {w && room && <>
        <section className="wv-mirror" data-testid="wv-mirror" data-belowk={w.below_k ? 1 : 0}>
          {w.mirror.lines_ar.map((l, i) => <p key={i} className={i === 0 ? 'wv-line' : 'wv-line sub'} data-testid="wv-line">{l}</p>)}
          <p className="wv-muted">{w.roster} منسوبًا في الشعبة · {w.mapped} بدؤوا خرائطهم · القاعدة: لا يظهر شيء قبل {k}</p>
        </section>
        {w.below_k ? <section className="pt-box" data-testid="wv-belowk"><p>النسيج يحتاج خمسة متعلّمين على الأقل لهم محطة مشتركة — حتى ذلك الحين لا نعرض شيئًا، ولا عددًا تحت خمسة.</p><p className="wv-muted">ما الذي يصنع محطة؟ إجابة عن «حالة يوم»، حضور جلسة، إتمام برنامج، اعتماد مهارة، مهمة ميدانية، عهد، يد مرفوعة ✋.</p></section>
          : <>
            <section className="wv-sky"><AtharMapSvg stations={stations} threads={svgThreads} layout={w.layout} rules={d.rules} weights={w.weights} counts={w.counts} star={w.star} legend={{ kept: 'خيط نسجه خمسة فأكثر (السماكة = عددهم)', proposed: 'اقتُرح لخمسة فأكثر ولم يأخذه أحد' }} title_ar={`نسيج شعبة ${room.code}`} testid="wv-svg" /></section>
            {w.star && <p className="wv-star" data-testid="wv-star">⭐ نجمة الشعبة: خيط نسجه سبعون في المئة فأكثر ممّن بدؤوا خرائطهم — ضوء، لا شهادة ولا نقاط.</p>}
            <section className="wv-block" data-testid="wv-threads"><h2><Icon name="star" size={16} /> الخيوط <i>{w.threads.length}</i></h2>
              {!w.threads.length && <p className="wv-muted">محطات مشتركة بلا خيوط بعد — الخيوط كلمةٌ عند أصحابها.</p>}
              <ul className="wv-cards">{w.threads.map((t) => { const a = w.stations.find((s) => s.key === t.from); const b = w.stations.find((s) => s.key === t.to); return <li key={`${t.from}>${t.to}>${t.rule}`} className={`wv-card ${t.state}`} data-testid="wv-thread" data-state={t.state}>
                <span className="wv-kind">{t.title_ar}</span><b>{a?.title_ar}</b><span className="wv-arrow">⟵</span><b>{b?.title_ar}</b>
                <p className="wv-n">{t.state === 'woven' ? `نسجه ${t.kept_n} من ${t.offered_n} اقتُرح لهم` : `اقتُرح لـ ${t.offered_n} — ولم يأخذه أحد بعد`}</p></li>; })}</ul></section>
            <section className="wv-block" data-testid="wv-quotes"><h2>🧶 بكلماتهم <i>{w.quotes.length}</i></h2>
              {w.quotes_locked_ar ? <p className="wv-muted" data-testid="wv-locked">{w.quotes_locked_ar}</p>
                : <ul className="wv-quotes">{w.quotes.map((q, i) => <li key={i} data-testid="wv-quote"><span className="wv-kind">{q.title_ar}</span><p>«لأن {q.note_ar}»</p></li>)}</ul>}
              <p className="wv-muted">كلمات أذِن أصحابها بمشاركتها معك — بلا اسم ولا تاريخ ولا ترتيب. ما يُسحب إذنه يختفي فورًا.</p></section>
          </>}
        {!d.viewing_other && <section className="wv-block wv-word">
          <h2><Icon name="chat" size={16} /> كلمة على النسيج</h2>
          {!wordOpen ? <div className="wv-row"><button type="button" className="pt-btn" onClick={() => { setWord(suggest); setWordOpen(true); }} data-testid="wv-word-open">اكتب كلمة لكل الشعبة</button><span className="wv-muted">تصلهم كإشعار 🧶 «كلمة من مدرّبك على نسيجكم» — ويردّون عليها كما يردّون على أيّ كلمة.</span></div>
            : <div className="wv-form"><textarea value={word} onChange={(e) => setWord(e.target.value.slice(0, 200))} rows={3} maxLength={200} data-testid="wv-word-text" aria-label="كلمتك على النسيج" /><div className="wv-row"><button type="button" className="pt-btn" onClick={sendWord} disabled={busy || word.trim().length < 2} data-testid="wv-word-send">{busy ? '…' : `أرسل إلى ${room.roster}`}</button><button type="button" className="pt-btn ghost" onClick={() => setWordOpen(false)}>إلغاء</button><small className="wv-muted">{word.length}/200</small></div></div>}
        </section>}
        <footer className="wv-foot wv-muted">النسيج يُحسب كل مرة من خرائط متعلّميك ولا يُخزَّن. لا يدخل في أي تقييم ولا في ملف المهارات ولا في أي شهادة. المحطات الشخصية (شهادة، مهمة، عهد، يد) تُجمَّع بنوعها لا بصاحبها. حالات اليوم تظهر بموضوعها لا بنصّها.</footer>
      </>}
    </main>
  );
}

const CSS = `
.wv{font-family:var(--font-ar),Tajawal,Arial,sans-serif;color:#0f172a;max-width:1040px;margin:0 auto;padding:22px 16px 60px;overflow-wrap:anywhere;min-width:0}.wv *{box-sizing:border-box}
.wv-nav{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px}.wv-link{color:#334155;text-decoration:none;font-size:13px;display:inline-flex;gap:4px;align-items:center}.wv-link:hover{text-decoration:underline}
.wv-head h1{margin:6px 0 6px;font-size:26px}.wv-head h1 small{display:block;font-size:14px;color:#b45309;font-weight:700;margin-top:2px}.wv-head p{color:#334155;line-height:1.8;margin:0 0 14px;max-width:820px}
.wv-err{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:8px 12px;margin:8px 0}.wv-ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;border-radius:10px;padding:8px 12px;margin:8px 0}
.wv-rooms{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 14px}.wv-room{font-family:inherit;border:1.5px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;display:inline-flex;gap:6px;align-items:center;font-weight:700}.wv-room.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}.wv-room small{opacity:.8}
.wv-mirror{background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:12px 16px;margin:0 0 12px}.wv-line{margin:0 0 4px;font-weight:800;color:#92400e}.wv-line.sub{font-weight:600;color:#78350f}
.wv-sky{margin:0 0 10px}.wv-star{background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:8px 12px;margin:0 0 12px;font-weight:700;color:#78350f}
.wv-block{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 16px;margin:0 0 12px}.wv-block h2{margin:0 0 8px;font-size:17px;display:flex;gap:6px;align-items:center}.wv-block h2 i{font-style:normal;background:#f1f5f9;border-radius:999px;padding:0 8px;font-size:13px}
.wv-cards{list-style:none;margin:8px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(280px,100%),1fr));gap:10px}.wv-card{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:3px}.wv-card.woven{border-color:#fcd34d;background:#fffdf5}.wv-card.untaken{border-style:dashed}
.wv-kind{font-size:12px;color:#0e7490;font-weight:800}.wv-arrow{color:#94a3b8;font-size:12px}.wv-n{margin:4px 0 0;font-size:13px;color:#475569;font-weight:700}
.wv-quotes{list-style:none;margin:8px 0;padding:0;display:grid;gap:8px}.wv-quotes li{border-inline-start:3px solid #fbbf24;padding:4px 10px}.wv-quotes p{margin:2px 0 0;font-size:15px}
.wv-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}.wv-form textarea{width:100%;font-family:inherit;font-size:15px;padding:10px;border:1.5px solid #cbd5e1;border-radius:10px;resize:vertical}
.wv-muted{color:#64748b;font-size:13px;line-height:1.7}.wv-foot{margin-top:18px;border-top:1px dashed #e2e8f0;padding-top:10px}
@media (prefers-reduced-motion:no-preference){.wv-card.woven{transition:transform .2s}.wv-card.woven:hover{transform:translateY(-1px)}}
`;
