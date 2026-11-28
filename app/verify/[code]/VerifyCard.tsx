'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { fmtDate } from '../../../lib/certificates/render';
import type { CertKind } from '../../../lib/certificates/render';
import { VERIFY_T, VERIFY_LANGS, VERIFY_LANG_KEY, VERIFY_LANG_NAMES, pickVerifyLang, verifyDir, programLabel, kindLabel, issuerLabel } from '../../../lib/certificates/verify-i18n';
import type { VerifyLang } from '../../../lib/certificates/verify-i18n';

/** P95: لغة صفحة التحقّق — ?lang → المحفوظ → المتصفّح → ar · ومبدّل ثلاثيّ */
export function useVerifyLang(): [VerifyLang, (l: VerifyLang) => void] {
  const [lang, setLangState] = useState<VerifyLang>('ar');
  useEffect(() => { try { const q = new URLSearchParams(window.location.search).get('lang'); const l = pickVerifyLang(q, localStorage.getItem(VERIFY_LANG_KEY), navigator.language); setLangState(l); if (q) localStorage.setItem(VERIFY_LANG_KEY, l); } catch { /* خاص */ } }, []);
  useEffect(() => { try { document.documentElement.lang = lang; document.documentElement.dir = verifyDir(lang); } catch { /* */ } }, [lang]);
  const setLang = (l: VerifyLang) => { setLangState(l); try { localStorage.setItem(VERIFY_LANG_KEY, l); const u = new URL(window.location.href); u.searchParams.set('lang', l); window.history.replaceState(null, '', u.toString()); } catch { /* */ } };
  return [lang, setLang];
}
export function VerifyLangSwitch({ lang, onPick }: { lang: VerifyLang; onPick: (l: VerifyLang) => void }) {
  return <div className="vf-lang" role="group" aria-label={VERIFY_T[lang].langLabel} data-testid="vf-lang">{VERIFY_LANGS.map((l) => <button key={l} type="button" lang={l} className={l === lang ? 'on' : ''} aria-pressed={l === lang} onClick={() => onPick(l)}>{VERIFY_LANG_NAMES[l]}</button>)}</div>;
}

type Result = { serial: string; kind: CertKind; recipient_name: string; program_name: string | null; start_date: string | null; end_date: string | null; hours: number | null; award_title: string | null; issued_at: string; issuer: string; unit: string; valid: boolean; revoked_at: string | null };

export function VerifyCard({ code }: { code: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading');
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  const [lang, setLang] = useVerifyLang(); const T = VERIFY_T[lang];
  useEffect(() => {
    (async () => {
      try {
        const db = supabase();
        const { data, error } = await db.rpc('verify_certificate', { p_code: code });
        if (error) { setErr(error.message); setState('error'); return; }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) { setState('none'); return; }
        setR(row as Result); setState('ok');
      } catch (e: any) { setErr(e?.message || ''); setState('error'); }
    })();
  }, [code]);

  return (
    <div className="vf" dir={verifyDir(lang)} lang={lang} data-lang={lang}>
      <style>{VERIFY_CSS}</style>
      <div className="vf-box">
        <VerifyLangSwitch lang={lang} onPick={setLang} />
        <div className="vf-logos"><img src="/brand/athar-mark.svg" alt="أَثَر" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <h1><Icon name="shield" size={22} /> {T.title}</h1>
        <div className="vf-code">{T.code}: <bdi>{code}</bdi></div>

        {state === 'loading' && <div className="vf-status wait">{T.loading}</div>}
        {state === 'none' && <div className="vf-status bad"><Icon name="x" size={20} /> {T.none}</div>}
        {state === 'error' && <div className="vf-status bad"><Icon name="alert" size={20} /> {T.error} {err}</div>}
        {state === 'ok' && r && (
          <>
            <div className={`vf-status ${r.valid ? 'ok' : 'bad'}`} data-testid="vf-status">
              {r.valid ? <><Icon name="check" size={20} /> {T.valid(lang === 'ar' ? r.unit : (/[\u0600-\u06FF]/.test(r.unit) ? 'Athar' : r.unit))}</> : <><Icon name="x" size={20} /> {T.revoked(fmtDate(r.revoked_at?.slice(0, 10)))}</>}
            </div>
            <dl className="vf-dl">
              <dt>{T.kind}</dt><dd>{kindLabel(r.kind, lang)}{r.award_title ? ` — ${r.award_title}` : ''}</dd>
              <dt>{T.recipient}</dt><dd><b>{r.recipient_name}</b></dd>
              <dt>{T.program}</dt><dd>{programLabel(r.program_name, lang)}</dd>
              {(r.start_date || r.end_date) && <><dt>{T.period}</dt><dd><bdi>{fmtDate(r.start_date)}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ''}</bdi></dd></>}
              {r.hours ? <><dt>{T.hours}</dt><dd>{r.hours}</dd></> : null}
              <dt>{T.issued}</dt><dd><bdi>{fmtDate(r.issued_at)}</bdi></dd>
              <dt>{T.serial}</dt><dd><bdi>{r.serial}</bdi></dd>
              <dt>{T.issuer}</dt><dd><bdi>{issuerLabel(r.issuer, lang)}</bdi> · <bdi>{r.unit}</bdi></dd>
            </dl>
            <p className="vf-readable" data-testid="vf-readable">{T.readable} <a href="/accessibility">{T.accessibility}</a></p>
          </>
        )}
        <div className="vf-actions"><Link href={`/verify?lang=${lang}`} className="vf-btn ghost"><Icon name="search" size={15} /> {T.another}</Link></div>
        <div className="vf-foot">{T.footNote}</div>
      </div>
    </div>
  );
}

export const VERIFY_CSS = `
.vf-readable{margin:10px 0 0;font-size:12.5px;color:#5C4858;line-height:1.8;border-top:1px dashed #EADFD6;padding-top:8px}.vf-readable a{color:#2F6B66}
.vf-readable{margin:10px 0 0;font-size:12.5px;color:#5C4858;line-height:1.8;border-top:1px dashed #EADFD6;padding-top:8px}.vf-readable a{color:#2F6B66}
.vf{font-family:var(--font-ar),"IBM Plex Sans Arabic",Arial,sans-serif;min-height:100vh;background:linear-gradient(160deg,#3A1F36 0%,#D4614A 100%);display:flex;align-items:center;justify-content:center;padding:24px;color:#2A1626}
.vf-box{background:#fff;border-radius:20px;padding:28px 30px;max-width:620px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.3);border-top:6px solid #D9A866}
.vf-logos{display:flex;justify-content:center;gap:18px;margin-bottom:10px}.vf-logos img{height:54px;width:auto;object-fit:contain}
.vf h1{margin:0 0 6px;font-size:22px;color:#3A1F36;display:flex;align-items:center;gap:8px;justify-content:center}
.vf-muted{color:#8E7F8A;font-size:13.5px;line-height:1.8;text-align:center;margin:0 0 14px}.vf-muted code{background:#F6EBE0;padding:1px 6px;border-radius:6px}
.vf-code{text-align:center;font-size:12.5px;font-weight:800;color:#8E7F8A;margin-bottom:12px}
.vf-form{display:flex;gap:8px}.vf-form input{flex:1;border:1px solid #D9CBC2;border-radius:12px;padding:12px 14px;font:inherit;font-size:16px;font-weight:800;letter-spacing:.5px}
.vf-btn{display:inline-flex;align-items:center;gap:6px;background:#3A1F36;color:#fff;border:0;border-radius:12px;padding:12px 18px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none}.vf-btn.ghost{background:#fff;color:#3A1F36;border:1px solid #D9CBC2}
.vf-status{display:flex;gap:10px;align-items:center;border-radius:12px;padding:14px 16px;font-size:15px;font-weight:800;line-height:1.7;margin:6px 0 14px}
.vf-status.ok{background:#E6F3F1;border:1px solid #BFE1DC;color:#2F6B66}.vf-status.bad{background:#FBEDE7;border:1px solid #F3C4B6;color:#9A3A2A}.vf-status.wait{background:#FBF4EE;border:1px solid #EADFD6;color:#5C4858}
.vf-dl{display:grid;grid-template-columns:150px 1fr;gap:8px 14px;margin:0;font-size:14px}.vf-dl dt{color:#8E7F8A;font-weight:800}.vf-dl dd{margin:0;color:#2A1626;font-weight:700}
.vf-actions{display:flex;justify-content:center;margin-top:16px}
.vf-foot{margin-top:16px;text-align:center;font-size:12px;color:#B3A5AE;line-height:1.7}
.vf-lang{display:flex;justify-content:flex-end;gap:4px;margin:-8px 0 6px}.vf-lang button{border:1px solid #EADFD6;background:#fff;color:#5C4858;border-radius:999px;padding:4px 10px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.vf-lang button.on{background:#3A1F36;color:#fff;border-color:#3A1F36}
.vf[dir=ltr] .vf-dl dt{font-weight:700}
@media(max-width:520px){.vf-dl{grid-template-columns:1fr}.vf-dl dt{margin-top:6px}}
`;
