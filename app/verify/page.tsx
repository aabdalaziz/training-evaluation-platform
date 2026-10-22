'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../lib/ui/icons';
import { VERIFY_CSS } from './[code]/VerifyCard';

export default function VerifyIndexPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const go = (e: React.FormEvent) => { e.preventDefault(); const c = code.trim(); if (c) router.push(`/verify/${encodeURIComponent(c)}`); };
  return (
    <div className="vf" dir="rtl">
      <style>{VERIFY_CSS}</style>
      <div className="vf-box">
        <div className="vf-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <h1><Icon name="shield" size={22} /> التحقق من صحة شهادة</h1>
        <p className="vf-muted">أدخل الرقم التسلسلي المطبوع على الشهادة (مثل <code>UPM-2026-000123</code>) أو رمز التحقق المكوّن من 10 رموز، أو امسح رمز QR الموجود على الشهادة.</p>
        <form onSubmit={go} className="vf-form">
          <input dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="UPM-2026-000123" autoFocus />
          <button type="submit" className="vf-btn"><Icon name="search" size={16} /> تحقق</button>
        </form>
        <div className="vf-foot">جامعة الأمير مقرن بن عبدالعزيز · بوابة التميز للاستشارات والتدريب</div>
      </div>
    </div>
  );
}
