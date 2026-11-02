'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * «دليل أَثَر» (P41) — لوحة البحث والأوامر (تُحمَّل عند أول فتح فقط — خِفّة أَثَر؛ الغلاف والزر في Guide.tsx).
 *  · الصفحات والأوامر فورية من المتصفح (lib/portal/search.ts)؛ المحتوى الحيّ من /api/search بعد 220 مللي ثانية من آخر حرف.
 *  · سؤال ينتهي بـ«؟» → عنصر «اسأل أثير» → إجابة مبنية على النتائج فقط مع مصادرها.
 *  · «أَثَر للجميع»: dialog + aria-modal + listbox/aria-activedescendant + aria-live لعدد النتائج + حبس التركيز + reduced-motion.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ROUTES, COMMANDS, GROUP_LABEL, type Entry, type Group, rank, suggestions, parseIntent, groupHits } from '../../lib/portal/search';
import { hasStoredSession } from '../../lib/supabase/lazy';
import { lazyToken } from './Pocket';

type Lang = 'ar' | 'en';
type Item = Entry & { cmd?: string; score?: number };
const RECENT_KEY = 'athar-guide-recent';
const readRecent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
const pushRecent = (id: string) => { try { const r = [id, ...readRecent().filter(x => x !== id)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(r)); } catch { /* ignore */ } };
const T = {
  open: { ar: 'البحث في أَثَر', en: 'Search Athar' }, ph: { ar: 'ابحث عن صفحة أو برنامج أو شهادة… أو اسأل سؤالًا ينتهي بـ ؟', en: 'Search pages, programs, credentials… or ask a question ending with ?' },
  hint: { ar: '↑↓ للتنقل · Enter للفتح · Esc للإغلاق', en: '↑↓ navigate · Enter open · Esc close' }, none: { ar: 'لا نتائج داخل البوابة لهذه الكلمات — جرّب كلمة أقصر، أو اسأل بعلامة استفهام.', en: 'No results — try a shorter word, or ask with a question mark.' },
  start: { ar: 'اقتراحات', en: 'Suggestions' }, ask: { ar: 'اسأل أثير:', en: 'Ask Athir:' }, asking: { ar: 'أثير يقرأ النتائج…', en: 'Athir is reading the results…' }, loading: { ar: 'نبحث في المحتوى…', en: 'Searching content…' },
  count: (n: number, l: Lang) => (l === 'ar' ? `${n} نتيجة` : `${n} results`), copied: { ar: 'نُسخ الرابط', en: 'Link copied' }, srcs: { ar: 'المصادر', en: 'Sources' }, kbd: { ar: 'Ctrl K', en: 'Ctrl K' },
  staffOnly: { ar: 'نتائج الإدارة تظهر للطاقم بعد الدخول', en: 'Admin results appear for staff after sign-in' },
};

export default function GuidePanel({ onClose, initialQuery = '' }: { onClose: () => void; initialQuery?: string }) {
  const pathname = usePathname() || '/'; const router = useRouter();
  const [q, setQ] = useState(initialQuery); const [lang, setLang] = useState<Lang>('ar');
  const [user, setUser] = useState(false); const [staff, setStaff] = useState(false);
  const [remote, setRemote] = useState<Entry[]>([]); const [busy, setBusy] = useState(false); const [answer, setAnswer] = useState<{ text: string; src: Entry[] } | null>(null); const [asking, setAsking] = useState(false);
  const [active, setActive] = useState(0); const [toast, setToast] = useState(''); const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null); const dlgRef = useRef<HTMLDivElement>(null); const tokenRef = useRef<string>(''); const seq = useRef(0);
  /* اللغة: صفحة مِعيار تحفظ athar-page-lang، وبقية البوابة athar_lang، وإلا لغة الوثيقة */
  const detectLang = useCallback((): Lang => { try { const a = localStorage.getItem('athar-page-lang') || localStorage.getItem('athar_lang'); if (pathname.startsWith('/miaar') && a) return a === 'ar' ? 'ar' : 'en'; const b = localStorage.getItem('athar_lang'); if (b === 'en') return 'en'; } catch { /* ignore */ } return (document.documentElement.lang || 'ar').startsWith('en') ? 'en' : 'ar'; }, [pathname]);
  const close = useCallback(() => { onClose(); }, [onClose]);
  useEffect(() => { setLang(detectLang()); setRecent(readRecent()); setTimeout(() => inputRef.current?.focus(), 20); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, [detectLang]);
  /* هوية الداخل — مرة واحدة عند الفتح، بلا تحميل Supabase للزائر */
  useEffect(() => {
    if (tokenRef.current || !hasStoredSession()) return;
    void lazyToken().then(tk => { tokenRef.current = tk || ''; if (tk) { setUser(true); fetch('/api/search?q=__who__', { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store' }).then(r => r.json()).then(j => { setStaff(!!j?.staff); setUser(true); }).catch(() => {}); } });
  }, []);

  /* النتائج المحلية فورًا */
  const ctx = useMemo(() => ({ user, staff, lang, recent }), [user, staff, lang, recent]);
  const intent = useMemo(() => parseIntent(q), [q]);
  const local = useMemo<Item[]>(() => {
    if (!q.trim()) return suggestions(ctx, 8);
    const hits: Item[] = rank(q, [...COMMANDS, ...ROUTES], ctx, 10);
    if (intent.href && (!intent.need || (intent.need === 'staff' && staff))) hits.unshift({ id: `intent-${intent.kind}`, href: intent.href, ar: intent.kind === 'result' ? `افتح تقرير مِعيار ${intent.value}` : intent.kind === 'item' ? `بند البنك ${intent.value}` : `تحقّق من الرمز ${intent.value}`, en: intent.kind === 'result' ? `Open Miaar report ${intent.value}` : intent.kind === 'item' ? `Bank item ${intent.value}` : `Verify code ${intent.value}`, group: intent.kind === 'result' ? 'result' : intent.kind === 'item' ? 'item' : 'page' });
    return hits;
  }, [q, ctx, intent, staff]);
  /* المحتوى الحيّ بعد توقّف الكتابة */
  useEffect(() => {
    const term = q.trim(); if (term.length < 2) { setRemote([]); setBusy(false); return; }
    const my = ++seq.current; setBusy(true);
    const h = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}&lang=${lang}`, { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}, cache: 'no-store' }).then(r => r.json()).then(j => { if (my !== seq.current) return; setRemote(Array.isArray(j?.results) ? j.results : []); if (typeof j?.staff === 'boolean') setStaff(j.staff); }).catch(() => { if (my === seq.current) setRemote([]); }).finally(() => { if (my === seq.current) setBusy(false); });
    }, 220);
    return () => clearTimeout(h);
  }, [q, lang]);

  const items = useMemo<Item[]>(() => { const seen = new Set(local.map(l => l.href)); const list: Item[] = [...local, ...remote.filter(r => !seen.has(r.href))]; if (intent.kind === 'ask') list.unshift({ id: 'ask', href: '#ask', ar: `${T.ask.ar} ${intent.value}؟`, en: `${T.ask.en} ${intent.value}?`, group: 'answer' as Group, cmd: 'ask', hint: { ar: 'إجابة من نتائج البوابة فقط — Enter', en: 'Answer from portal results only — Enter' } }); return list; }, [local, remote, intent]);
  const groups = useMemo(() => groupHits(items), [items]);
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);
  useEffect(() => { setActive(0); }, [q, remote.length]);
  useEffect(() => { const el = dlgRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`); el?.scrollIntoView?.({ block: 'nearest' }); }, [active]);

  const runCmd = useCallback(async (cmd: string) => {
    if (cmd === 'lang') { try { const cur = detectLang(); const nx = cur === 'ar' ? 'en' : 'ar'; localStorage.setItem('athar_lang', nx); if (pathname.startsWith('/miaar')) localStorage.setItem('athar-page-lang', nx); } catch { /* ignore */ } close(); window.location.reload(); return; }
    if (cmd === 'copy') { try { await navigator.clipboard.writeText(window.location.href); setToast(T.copied[lang]); setTimeout(() => setToast(''), 1800); } catch { /* ignore */ } return; }
    if (cmd === 'print') { close(); setTimeout(() => window.print(), 150); return; }
    if (cmd === 'top') { close(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (cmd === 'ask') {
      setAsking(true); setAnswer(null);
      try { const j = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&lang=${lang}&ask=1`, { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {}, cache: 'no-store' }).then(r => r.json()); setAnswer({ text: String(j?.answer || T.none[lang]), src: Array.isArray(j?.results) ? j.results.slice(0, 5) : [] }); } catch { setAnswer({ text: T.none[lang], src: [] }); } finally { setAsking(false); }
      return;
    }
  }, [close, detectLang, lang, pathname, q]);
  const pick = useCallback((it: Item) => {
    if (it.cmd && it.cmd !== 'miaar') { void runCmd(it.cmd); return; }
    pushRecent(it.id); close(); router.push(it.href);
  }, [close, router, runCmd]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = flat[active]; if (it) pick(it); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Tab') { /* حبس التركيز داخل اللوحة */ const f = dlgRef.current?.querySelectorAll<HTMLElement>('input,button,a[href]'); if (!f || !f.length) return; const first = f[0], last = f[f.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  const dir = lang === 'ar' ? 'rtl' : 'ltr'; let idx = -1;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {(
        <div className="gd-back" onMouseDown={e => { if (e.target === e.currentTarget) close(); }} data-testid="guide-dialog">
          <div className="gd-dlg" role="dialog" aria-modal="true" aria-labelledby="gd-title" dir={dir} lang={lang} ref={dlgRef} onKeyDown={onKeyDown}>
            <h2 id="gd-title" className="gd-sr">{T.open[lang]}</h2>
            <div className="gd-bar">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
              <input ref={inputRef} className="gd-in" value={q} onChange={e => { setQ(e.target.value); setAnswer(null); }} placeholder={T.ph[lang]} aria-label={T.open[lang]} role="combobox" aria-expanded="true" aria-controls="gd-list" aria-activedescendant={flat[active] ? `gd-opt-${active}` : undefined} aria-autocomplete="list" autoComplete="off" spellCheck={false} data-testid="guide-input" />
              {busy && <span className="gd-spin" aria-hidden="true" />}
              <button type="button" className="gd-x" onClick={close} aria-label={lang === 'ar' ? 'إغلاق' : 'Close'}>Esc</button>
            </div>
            <div className="gd-sr" aria-live="polite">{busy ? T.loading[lang] : T.count(flat.length, lang)}</div>
            {answer && (
              <div className="gd-answer" data-testid="guide-answer">
                <div className="gd-ans-head"><span className="gd-athir">أثير</span>{lang === 'ar' ? 'إجابة من نتائج البوابة فقط — تحقّق من المصدر قبل القرار' : 'Answer from portal results only — verify the source'}</div>
                <p>{answer.text}</p>
                {answer.src.length > 0 && <div className="gd-srcs"><b>{T.srcs[lang]}:</b> {answer.src.map((s, i) => <a key={s.id} href={s.href} onClick={e => { e.preventDefault(); pick(s); }}>[{i + 1}] {lang === 'ar' ? s.ar : s.en}</a>)}</div>}
              </div>
            )}
            {asking && <div className="gd-asking" role="status">{T.asking[lang]}</div>}
            <div className="gd-list" id="gd-list" role="listbox" aria-label={T.open[lang]}>
              {!q.trim() && <div className="gd-grp">{T.start[lang]}</div>}
              {groups.map(g => (
                <div key={g.group}>
                  {q.trim() ? <div className="gd-grp">{GROUP_LABEL[g.group][lang]}</div> : null}
                  {g.items.map(it => { idx += 1; const i = idx; const on = i === active; return (
                    <div key={it.id} id={`gd-opt-${i}`} data-idx={i} role="option" aria-selected={on} className={`gd-it ${on ? 'on' : ''} g-${it.group}`} onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => pick(it)} data-testid="guide-item" data-href={it.href}>
                      <span className="gd-dot" aria-hidden="true" />
                      <span className="gd-txt"><span className="gd-t">{lang === 'ar' ? it.ar : it.en}</span>{it.hint && (it.hint.ar || it.hint.en) ? <small>{lang === 'ar' ? it.hint.ar : it.hint.en}</small> : <small className="gd-path" dir={['page', 'me', 'admin'].includes(it.group) ? 'ltr' : undefined}>{it.cmd ? '⌘' : ['page', 'me', 'admin'].includes(it.group) ? it.href : GROUP_LABEL[it.group][lang]}</small>}</span>
                      {on && <span className="gd-enter" aria-hidden="true">↵</span>}
                    </div>); })}
                </div>
              ))}
              {q.trim().length >= 2 && !busy && flat.length === 0 && <div className="gd-none">{T.none[lang]}</div>}
            </div>
            <div className="gd-foot"><span>{T.hint[lang]}</span>{!staff && q.trim() && <span className="gd-muted">{T.staffOnly[lang]}</span>}{toast && <span className="gd-toast" role="status">{toast}</span>}</div>
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
.gd-back{position:fixed;inset:0;z-index:9100;background:rgba(15,42,78,.48);backdrop-filter:blur(3px);display:flex;align-items:flex-start;justify-content:center;padding:min(10vh,96px) 12px 12px;animation:gdIn .14s ease-out}
.gd-dlg{width:min(680px,100%);max-height:min(72vh,640px);display:flex;flex-direction:column;background:#fff;border-radius:18px;box-shadow:0 30px 80px rgba(2,6,23,.45);overflow:hidden;border:1px solid #e2e8f0;font-family:var(--font-ar,Tajawal),system-ui,sans-serif}
.gd-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.gd-bar{display:flex;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid #e2e8f0;color:#0f2a4e}
.gd-in{flex:1;border:0;outline:0;font:inherit;font-size:17px;font-weight:700;color:#0f172a;background:transparent;min-width:0}.gd-in::placeholder{color:#94a3b8;font-weight:500;font-size:14px}
.gd-x{border:1px solid #cbd5e1;background:#f8fafc;color:#475569;border-radius:8px;padding:3px 8px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.gd-x:focus-visible{outline:3px solid #c9a24b}
.gd-spin{width:16px;height:16px;border-radius:50%;border:2px solid #cbd5e1;border-top-color:#0b8a83;animation:gdSpin .8s linear infinite}
.gd-list{overflow:auto;padding:6px 8px 8px;flex:1}
.gd-grp{font-size:11px;font-weight:900;color:#64748b;letter-spacing:.02em;padding:10px 10px 4px}
.gd-it{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:12px;cursor:pointer;color:#0f172a;border:1px solid transparent}
.gd-it.on{background:#f0fdfa;border-color:#99f6e4}.gd-it .gd-dot{width:8px;height:8px;border-radius:50%;background:#cbd5e1;flex:none}
.gd-it.g-command .gd-dot{background:#c9a24b}.gd-it.g-admin .gd-dot{background:#0f2a4e}.gd-it.g-me .gd-dot,.gd-it.g-credential .gd-dot{background:#0b8a83}.gd-it.g-program .gd-dot,.gd-it.g-session .gd-dot{background:#6366f1}.gd-it.g-answer .gd-dot{background:#f59e0b}.gd-it.g-result .gd-dot{background:#c9a24b}
.gd-txt{display:flex;flex-direction:column;min-width:0;flex:1}.gd-t{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gd-txt small{font-size:11px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gd-path{font-family:ui-monospace,monospace;text-align:start}
.gd-enter{font-size:12px;color:#0b8a83;font-weight:900}
.gd-none{padding:22px 12px;color:#64748b;font-size:14px;text-align:center}
.gd-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;font-weight:700;background:#f8fafc}.gd-muted{color:#94a3b8;font-weight:500}.gd-toast{color:#065f46;background:#ecfdf5;padding:1px 8px;border-radius:999px}
.gd-answer{margin:8px 12px 0;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#fffbeb,#f0fdfa);border:1px solid #fde68a}
.gd-ans-head{display:flex;align-items:center;gap:8px;font-size:11px;color:#92400e;font-weight:800;margin-bottom:6px}.gd-athir{background:#0f2a4e;color:#fff;border-radius:999px;padding:1px 8px;font-size:11px}
.gd-answer p{margin:0 0 6px;font-size:14px;line-height:1.8;color:#0f172a;font-weight:600}
.gd-srcs{font-size:12px;color:#334155;display:flex;flex-wrap:wrap;gap:6px 10px}.gd-srcs a{color:#0b8a83;font-weight:800;text-decoration:none}.gd-srcs a:hover{text-decoration:underline}
.gd-asking{margin:8px 12px 0;font-size:12px;color:#0b8a83;font-weight:800}
@keyframes gdIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}@keyframes gdSpin{to{transform:rotate(360deg)}}
@media(max-width:760px){.gd-back{padding:8px}.gd-dlg{max-height:calc(100vh - 16px)}.gd-trigger span,.gd-trigger kbd{display:none}.gd-trigger{padding:8px}}
@media(prefers-reduced-motion:reduce){.gd-back{animation:none}.gd-fab{transition:none}.gd-spin{animation-duration:2s}}
`;
