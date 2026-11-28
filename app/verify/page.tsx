'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import { VERIFY_CSS, useVerifyLang, VerifyLangSwitch } from './[code]/VerifyCard';
import { VERIFY_T, verifyDir } from '../../lib/certificates/verify-i18n';
import { ScanButton } from '../components/Scan'; /* P82 «أَثَر يقرأ» */

export default function VerifyIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [lang, setLang] = useVerifyLang(); const T = VERIFY_T[lang]; /* P95 */
  const go = (e: React.FormEvent) => { e.preventDefault(); const c = code.trim(); if (c) router.push(`/verify/${encodeURIComponent(c)}?lang=${lang}`); };
  return (
    <div className="vf" dir={verifyDir(lang)} lang={lang} data-lang={lang}>
      <style>{VERIFY_CSS}</style>
      <div className="vf-box">
        <VerifyLangSwitch lang={lang} onPick={setLang} />
        <div className="vf-logos"><img src="/brand/athar-mark.svg" alt="أَثَر" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <h1><Icon name="shield" size={22} /> {T.title}</h1>
        <p className="vf-muted">{T.hint}</p>
        <form onSubmit={go} className="vf-form">
          <input dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder={T.placeholder} autoFocus />
          <button type="submit" className="vf-btn"><Icon name="search" size={16} /> {T.check}</button>
        </form>
        <div style={{ marginTop: 10 }}><ScanButton accept={['verify']} label={T.scan} title={T.scanTitle} hint={T.scanHint} onHit={(h) => { if (h.href) router.push(h.href); }} /></div>
        <div className="vf-foot">{T.footer}</div>
      </div>
    </div>
  );
}
