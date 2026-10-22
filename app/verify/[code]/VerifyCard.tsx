'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../../lib/supabase/client';
import { Icon } from '../../../lib/ui/icons';
import { KIND_LABEL, fmtDate } from '../../../lib/certificates/render';
import type { CertKind } from '../../../lib/certificates/render';

type Result = { serial: string; kind: CertKind; recipient_name: string; program_name: string | null; start_date: string | null; end_date: string | null; hours: number | null; award_title: string | null; issued_at: string; issuer: string; unit: string; valid: boolean; revoked_at: string | null };

export function VerifyCard({ code }: { code: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'error'>('loading');
  const [r, setR] = useState<Result | null>(null);
  const [err, setErr] = useState('');
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
    <div className="vf" dir="rtl">
      <style>{VERIFY_CSS}</style>
      <div className="vf-box">
        <div className="vf-logos"><img src="/logos/upm.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /><img src="/logos/gate.png" alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /></div>
        <h1><Icon name="shield" size={22} /> التحقق من صحة شهادة</h1>
        <div className="vf-code">الرمز: <bdi>{code}</bdi></div>

        {state === 'loading' && <div className="vf-status wait">جارٍ التحقق…</div>}
        {state === 'none' && <div className="vf-status bad"><Icon name="x" size={20} /> لا توجد شهادة بهذا الرمز. تأكد من كتابة الرقم التسلسلي كاملًا كما هو مطبوع على الشهادة.</div>}
        {state === 'error' && <div className="vf-status bad"><Icon name="alert" size={20} /> تعذر التحقق حاليًا. {err}</div>}
        {state === 'ok' && r && (
          <>
            <div className={`vf-status ${r.valid ? 'ok' : 'bad'}`}>
              {r.valid ? <><Icon name="check" size={20} /> شهادة صحيحة وسارية — صادرة من {r.unit}</> : <><Icon name="x" size={20} /> هذه الشهادة <b>ملغاة</b> منذ {fmtDate(r.revoked_at?.slice(0, 10))} ولا يُعتدّ بها</>}
            </div>
            <dl className="vf-dl">
              <dt>نوع الشهادة</dt><dd>{KIND_LABEL[r.kind]?.ar || r.kind}{r.award_title ? ` — ${r.award_title}` : ''}</dd>
              <dt>اسم المستفيد</dt><dd><b>{r.recipient_name}</b></dd>
              <dt>البرنامج</dt><dd>{r.program_name || '—'}</dd>
              {(r.start_date || r.end_date) && <><dt>فترة التنفيذ</dt><dd>{fmtDate(r.start_date)}{r.end_date ? ` → ${fmtDate(r.end_date)}` : ''}</dd></>}
              {r.hours ? <><dt>الساعات التدريبية</dt><dd>{r.hours}</dd></> : null}
              <dt>تاريخ الإصدار</dt><dd>{fmtDate(r.issued_at)}</dd>
              <dt>الرقم التسلسلي</dt><dd><bdi>{r.serial}</bdi></dd>
              <dt>الجهة المصدِرة</dt><dd>{r.issuer} · {r.unit}</dd>
            </dl>
          </>
        )}
        <div className="vf-actions"><Link href="/verify" className="vf-btn ghost"><Icon name="search" size={15} /> تحقق من شهادة أخرى</Link></div>
        <div className="vf-foot">نتيجة التحقق صادرة مباشرة من سجل الشهادات الرسمي للمنصة ولا تعرض أي بيانات شخصية إضافية.</div>
      </div>
    </div>
  );
}

export const VERIFY_CSS = `
.vf{font-family:Tajawal,Arial,sans-serif;min-height:100vh;background:linear-gradient(160deg,#0f2a4e 0%,#0b8a83 100%);display:flex;align-items:center;justify-content:center;padding:24px;color:#0f172a}
.vf-box{background:#fff;border-radius:20px;padding:28px 30px;max-width:620px;width:100%;box-shadow:0 30px 80px rgba(0,0,0,.3);border-top:6px solid #c9a24b}
.vf-logos{display:flex;justify-content:center;gap:18px;margin-bottom:10px}.vf-logos img{height:54px;width:auto;object-fit:contain}
.vf h1{margin:0 0 6px;font-size:22px;color:#0f2a4e;display:flex;align-items:center;gap:8px;justify-content:center}
.vf-muted{color:#64748b;font-size:13.5px;line-height:1.8;text-align:center;margin:0 0 14px}.vf-muted code{background:#f1f5f9;padding:1px 6px;border-radius:6px}
.vf-code{text-align:center;font-size:12.5px;font-weight:800;color:#64748b;margin-bottom:12px}
.vf-form{display:flex;gap:8px}.vf-form input{flex:1;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font:inherit;font-size:16px;font-weight:800;letter-spacing:.5px}
.vf-btn{display:inline-flex;align-items:center;gap:6px;background:#0f2a4e;color:#fff;border:0;border-radius:12px;padding:12px 18px;font:inherit;font-size:14px;font-weight:800;cursor:pointer;text-decoration:none}.vf-btn.ghost{background:#fff;color:#0f2a4e;border:1px solid #cbd5e1}
.vf-status{display:flex;gap:10px;align-items:center;border-radius:12px;padding:14px 16px;font-size:15px;font-weight:800;line-height:1.7;margin:6px 0 14px}
.vf-status.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}.vf-status.bad{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.vf-status.wait{background:#f8fafc;border:1px solid #e2e8f0;color:#475569}
.vf-dl{display:grid;grid-template-columns:150px 1fr;gap:8px 14px;margin:0;font-size:14px}.vf-dl dt{color:#64748b;font-weight:800}.vf-dl dd{margin:0;color:#0f172a;font-weight:700}
.vf-actions{display:flex;justify-content:center;margin-top:16px}
.vf-foot{margin-top:16px;text-align:center;font-size:12px;color:#94a3b8;line-height:1.7}
@media(max-width:520px){.vf-dl{grid-template-columns:1fr}.vf-dl dt{margin-top:6px}}
`;
