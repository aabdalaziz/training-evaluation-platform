'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import { VERIFY_CSS } from './[code]/VerifyCard';
import { ScanButton } from '../components/Scan'; /* P82 «أَثَر يقرأ» */

export default function VerifyIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const go = (e: React.FormEvent) => { e.preventDefault(); const c = code.trim(); if (c) router.push(`/verify/${encodeURIComponent(c)}`); };
  return (
    <div className="vf" dir="rtl">
      <style>{VERIFY_CSS}</style>
      <div className="vf-box">
        <div className="vf-logos"><img src="/brand/athar-mark.svg" alt="أَثَر" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <h1><Icon name="shield" size={22} /> التحقق من صحة شهادة</h1>
        <p className="vf-muted">أدخل الرقم التسلسلي المطبوع على الشهادة (مثل <code>ATH-2026-000123</code>) أو رمز التحقق المكوّن من 10 رموز، أو امسح رمز QR الموجود على الشهادة.</p>
        <form onSubmit={go} className="vf-form">
          <input dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="ATH-2026-000123" autoFocus />
          <button type="submit" className="vf-btn"><Icon name="search" size={16} /> تحقق</button>
        </form>
        <div style={{ marginTop: 10 }}><ScanButton accept={['verify']} label="امسح رمز الشهادة بالكاميرا" title="أَثَر يقرأ — تحقّق" hint="وجّه الكاميرا إلى رمز QR المطبوع على الشهادة" onHit={(h) => { if (h.href) router.push(h.href); }} /></div>
        <div className="vf-foot">أَثَر — بوّابة أَثَر للتعليم والتدريب والتطوير والجودة</div>
      </div>
    </div>
  );
}
