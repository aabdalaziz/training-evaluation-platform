'use client';
/**
 * P49-ب «QR المجموعة» — زرّ واحد بجانب كل مجموعة/قاعة في إدارة القاعات:
 *  يختار المشرف الاستبيان (يومي / ختامي / نهاية البرنامج) واللغة (تلقائي / عربي / إنجليزي)،
 *  فيُعاد استخدام الرابط المفتوح نفسه لهذه المجموعة (reuse) أو يُنشأ، ويظهر QR كبير + الرابط القصير + نسخ + طباعة بطاقة + فتح.
 *  لا قوائم للمتدرّب: البرنامج والمجموعة في الرمز، واللغة تُحسم من متصفّحه.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { qrSvg } from '../../lib/certificates/qr';
import { KIND_AR, KIND_EN, KIND_PATH, LINK_KINDS, LINK_LANGS, LINK_LANG_AR, shortUrl, type EvalLink, type LinkKind, type LinkLang } from '../../lib/evaluation/links';

type Sched = { id: string; label: string };
/* P49-ب.2 «عن بُعد»: remote=true يضيف خيار «استبيان التعلّم عن بُعد» (رابط مباشر إلى /survey/remote-learning — لا يمرّ بجدول الروابط) */
type Props = { programId: string; programName: string; classroomId?: string | null; classroomLabel: string; lang?: 'ar' | 'en'; compact?: boolean; remote?: boolean; schedules?: Sched[] };
type Pick = LinkKind | 'REMOTE';

export default function GroupQr({ programId, programName, classroomId = null, classroomLabel, lang = 'ar', compact = false, remote = false, schedules = [] }: Props) {
  const ar = lang !== 'en';
  const [open, setOpen] = useState(false); const [kind, setKind] = useState<Pick>(remote ? 'REMOTE' : 'END'); const [sched, setSched] = useState(''); const [lg, setLg] = useState<LinkLang>('auto');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [link, setLink] = useState<(EvalLink & { reused?: boolean }) | null>(null); const [origin, setOrigin] = useState('');
  useEffect(() => { try { setOrigin(window.location.origin); } catch { /* ignore */ } }, []);
  useEffect(() => { if (open && kind !== 'REMOTE') void make(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open, kind, lg]);

  async function make() {
    setBusy(true); setErr('');
    try {
      const { data } = await supabase().auth.getSession(); const tok = data.session?.access_token || '';
      const r = await fetch('/api/evaluation-links', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'create', reuse: true, kind, program_id: programId, classroom_id: classroomId, lang: lg, label_ar: classroomId ? `${classroomLabel} — ${programName}` : programName }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`);
      setLink({ ...j.link, reused: !!j.reused });
    } catch (e: any) { setErr(e?.message || 'error'); setLink(null); }
    setBusy(false);
  }
  const isRemote = kind === 'REMOTE';
  const remoteUrl = `${origin}/survey/remote-learning?classroom=${encodeURIComponent(classroomId || '')}${sched ? `&schedule=${encodeURIComponent(sched)}` : ''}${lg === 'en' ? '&lang=en' : lg === 'ar' ? '&lang=ar' : ''}`;
  const url = isRemote ? remoteUrl : (link ? shortUrl(origin, link.code) : '');
  const ready = isRemote || !!link;
  const kindTitleAr = isRemote ? 'استبيان التعلّم عن بُعد' : (link ? KIND_AR[link.kind] : ''); const kindTitleEn = isRemote ? 'Remote Learning Survey' : (link ? KIND_EN[link.kind] : '');
  async function copy() { try { await navigator.clipboard.writeText(url); } catch { window.prompt(ar ? 'انسخ الرابط:' : 'Copy the link:', url); } }
  function print() {
    if (!ready) return; const w = window.open('', '_blank'); if (!w) return;
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(classroomLabel)}</title><style>@page{size:A4;margin:14mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;text-align:center;margin:0;padding:10mm}h1{font-size:30px;margin:0 0 4px}h2{font-size:20px;margin:0 0 6px;color:#334155;font-weight:700}.k{font-size:14px;font-weight:900;color:#8a6a1f}.u{font-family:monospace;font-size:20px;font-weight:900;direction:ltr;margin:8px 0}.e{font-size:15px;color:#0b8a83;font-weight:800;direction:ltr}.h{font-size:14px;color:#64748b;margin-top:6px}svg{width:260px;height:260px;margin:14px auto;display:block}</style></head><body><div class="k">${esc(kindTitleAr)} · ${esc(kindTitleEn)}</div><h1>${esc(classroomLabel)}</h1><h2>${esc(programName)}</h2>${qrSvg(url, 260)}<div class="u">${esc(url)}</div><div class="h">امسح الرمز بكاميرا الجوال — البرنامج والمجموعة محدّدان مسبقًا، لا تختر شيئًا.</div><div class="e">Scan with your phone camera — your program and group are already set; nothing to choose.</div><script>setTimeout(function(){print()},300)</script></body></html>`);
    w.document.close();
  }
  return (
    <>
      <button type="button" className={`gq-btn${compact ? ' sm' : ''}`} onClick={() => setOpen(true)} title={ar ? 'QR الاستبيان لهذه المجموعة' : 'Survey QR for this group'} data-testid="gq-open"><Icon name="qr" size={14} /> {ar ? 'QR الاستبيان' : 'Survey QR'}</button>
      {open && (
        <div className="gq-back" role="dialog" aria-modal="true" aria-label={ar ? 'QR المجموعة' : 'Group QR'} onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="gq-modal" data-testid="gq-modal">
            <style>{CSS}</style>
            <header><div><div className="gq-k"><Icon name="qr" size={14} /> {ar ? 'QR المجموعة' : 'Group QR'}</div><h3>{classroomLabel}</h3><small>{programName}</small></div><button type="button" className="gq-x" onClick={() => setOpen(false)} aria-label="close">✕</button></header>
            <div className="gq-row"><span>{ar ? 'الاستبيان' : 'Survey'}</span><div className="gq-seg">{remote && <button type="button" className={isRemote ? 'on' : ''} onClick={() => setKind('REMOTE')} data-testid="gq-kind-REMOTE">{ar ? 'التعلّم عن بُعد' : 'Remote learning'}</button>}{LINK_KINDS.map(k => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)} data-testid={`gq-kind-${k}`}>{ar ? KIND_AR[k] : KIND_EN[k]}</button>)}</div></div>
            <div className="gq-row"><span>{ar ? 'لغة الفتح' : 'Opens in'}</span><div className="gq-seg">{LINK_LANGS.map(l => <button key={l} type="button" className={lg === l ? 'on' : ''} onClick={() => setLg(l)} data-testid={`gq-lang-${l}`}>{ar ? LINK_LANG_AR[l] : l === 'auto' ? 'Learner’s browser language' : l === 'ar' ? 'Arabic' : 'English'}</button>)}</div></div>
            {isRemote && schedules.length > 0 && (
              <div className="gq-row"><span>{ar ? 'الموعد' : 'Session'}</span><select className="gq-sel" value={sched} onChange={e => setSched(e.target.value)} data-testid="gq-sched"><option value="">{ar ? 'يختاره المتدرّب' : 'Learner picks'}</option>{schedules.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>)}
            {err && !isRemote && <div className="gq-err">{err}</div>}
            {busy && !ready && <div className="gq-muted">{ar ? 'جارٍ التجهيز…' : 'Preparing…'}</div>}
            {ready && (
              <div className="gq-body" data-testid="gq-result" data-code={isRemote ? 'REMOTE' : link!.code}>
                <div className="gq-qr" dangerouslySetInnerHTML={{ __html: qrSvg(url, 220) }} />
                <code dir="ltr">{url}</code>
                <small className="gq-muted">{isRemote ? (ar ? 'استبيان التعلّم عن بُعد لهذه المجموعة — يفتح مباشرة والموعد محدّد إن اخترته.' : 'Remote-learning survey for this group — opens directly, session preset if chosen.') : link!.reused ? (ar ? 'الرابط نفسه المستخدم سابقًا لهذه المجموعة — الاستجابات تتجمّع عليه.' : 'Same link as before for this group — responses accumulate on it.') : (ar ? 'رابط جديد لهذه المجموعة.' : 'A new link for this group.')} {lg === 'auto' ? (ar ? 'يفتح بالعربية للناطقين بها وبالإنجليزية لغيرهم.' : 'Opens in Arabic for Arabic browsers, English otherwise.') : ''}</small>
                <div className="gq-acts">
                  <button type="button" onClick={() => void copy()} data-testid="gq-copy"><Icon name="copy" size={14} /> {ar ? 'نسخ' : 'Copy'}</button>
                  <button type="button" onClick={print} data-testid="gq-print"><Icon name="print" size={14} /> {ar ? 'طباعة البطاقة' : 'Print card'}</button>
                  <a href={isRemote ? url : `/evaluate/${KIND_PATH[link!.kind]}?link=${link!.code}`} target="_blank" rel="noreferrer"><Icon name="arrow" size={14} /> {ar ? 'معاينة' : 'Preview'}</a>
                </div>
              </div>)}
          </div>
        </div>)}
      <style>{BTN}</style>
    </>
  );
}
function esc(s: string) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
const BTN = `.gq-btn{display:inline-flex;align-items:center;gap:5px;font:inherit;font-size:12.5px;font-weight:900;color:#fff;background:#0f2a4e;border:1px solid #0f2a4e;border-radius:999px;padding:6px 11px;cursor:pointer;white-space:nowrap}.gq-btn.sm{padding:4px 9px;font-size:11.5px}.gq-btn:hover{background:#163a6b}`;
const CSS = `
.gq-back{position:fixed;inset:0;background:rgba(15,42,78,.45);display:grid;place-items:center;z-index:1000;padding:16px}
.gq-modal{background:#fff;border-radius:16px;width:min(520px,100%);padding:18px;display:grid;gap:12px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:inherit;color:#0f2a4e;text-align:start}
.gq-modal header{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.gq-modal h3{margin:2px 0;font-size:19px}.gq-modal header small{color:#475569;font-weight:700}.gq-k{font-size:12px;font-weight:900;color:#8a6a1f;display:inline-flex;gap:6px;align-items:center}
.gq-sel{font:inherit;font-size:13px;font-weight:700;border:1px solid #cbd5e1;border-radius:10px;padding:6px 8px;min-width:200px;color:#0f2a4e;background:#fff}
.gq-x{border:0;background:#f1f5f9;border-radius:999px;width:32px;height:32px;cursor:pointer;font-size:14px}
.gq-row{display:grid;gap:6px}.gq-row>span{font-size:12.5px;font-weight:800;color:#334155}.gq-seg{display:flex;gap:6px;flex-wrap:wrap}.gq-seg button{font:inherit;font-size:12.5px;font-weight:800;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 11px;cursor:pointer;color:#0f2a4e}.gq-seg button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.gq-err{background:#fef2f2;color:#b91c1c;border-radius:10px;padding:8px 12px;font-weight:800;font-size:13px}.gq-muted{color:#64748b;font-size:12.5px}
.gq-body{display:grid;gap:8px;justify-items:center;text-align:center;border:1.5px solid #c9a24b;border-radius:14px;padding:14px;background:linear-gradient(180deg,#fffbeb,#fff)}.gq-qr svg{width:220px;height:220px;display:block}.gq-body code{font-size:14px;font-weight:900;word-break:break-all}
.gq-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}.gq-acts button,.gq-acts a{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:13px;font-weight:900;border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;color:#0f2a4e;text-decoration:none}
`;
