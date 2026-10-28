'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — «محفظتي السيادية» (P17): شهاداتي الموقَّعة تشفيريًا + «لقطة قدرة» أُصدرها بنفسي — تنزيل · QR · رابط تحقق · إلغاء لقطة.
// الملف الذي تنزّله ملكك: يعمل بلا أَثَر وبلا إنترنت، ولا يمكن لأحد تعديله — ولا نحن.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { qrSvg } from '../../lib/certificates/qr';
import { fmtDate } from '../../lib/portal/content';
import { SNAPSHOT_DAYS, keyFingerprint } from '../../lib/portal/vc';

type Iss = { id: string; code: string; kind: 'credential' | 'snapshot'; credential_id: string | null; title_ar: string | null; kid: string; issued_at: string; expires_at: string | null; revoked_at: string | null };
type Props = { lang: 'ar' | 'en'; credentials?: { id: string; verify_code: string; title_ar: string; title_en?: string | null; revoked_at?: string | null }[] };

export default function SovereignWallet({ lang, credentials = [] }: Props) {
  const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [rows, setRows] = useState<Iss[] | null>(null); const [configured, setConfigured] = useState(true); const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [ok, setOk] = useState(''); const [qr, setQr] = useState<string | null>(null);
  const token = async () => (await db.auth.getSession()).data.session?.access_token || '';
  const load = async () => { try { const r = await fetch('/api/vc?view=mine', { headers: { Authorization: `Bearer ${await token()}` }, cache: 'no-store' }); const j = await r.json(); if (j.success) { setRows(j.issuances || []); setConfigured(!!j.configured); } else setRows([]); } catch { setRows([]); } };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const verifyUrl = (code: string) => `${typeof location !== 'undefined' ? location.origin : ''}/verify/vc?code=${encodeURIComponent(code)}`;
  const run = async (key: string, fn: () => Promise<string | void>) => { setBusy(key); setErr(''); setOk(''); try { const m = await fn(); if (m) setOk(m); } catch (e: any) { setErr(e?.message || String(e)); } setBusy(''); };
  const download = (code: string) => run(`dl:${code}`, async () => { const r = await fetch(`/api/vc?code=${encodeURIComponent(code)}`, { cache: 'no-store' }); const t = await r.text(); if (!r.ok) { let m = ''; try { m = JSON.parse(t).error; } catch { /* نص */ } throw new Error(m || (ar ? 'تعذّر التنزيل' : 'Download failed')); } const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([t], { type: 'application/json' })); a.download = `athar-${code}.vc.json`; document.body.appendChild(a); a.click(); a.remove(); await load(); return ar ? 'نُزِّلت الشهادة الموقَّعة — احتفظ بها؛ هي ملكك.' : 'Signed credential downloaded — it is yours.'; });
  const copy = (code: string) => run(`cp:${code}`, async () => { await navigator.clipboard.writeText(verifyUrl(code)); return ar ? 'نُسخ رابط التحقق.' : 'Verify link copied.'; });
  const snapshot = () => run('snap', async () => { const r = await fetch('/api/vc', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: 'snapshot' }) }); const j = await r.json(); if (!j.success) throw new Error(j.error); await load(); setQr(j.code); return ar ? `صدرت لقطة قدرة موقَّعة (${j.code}) صالحة ${SNAPSHOT_DAYS} يومًا.` : `Signed snapshot issued (${j.code}).`; });
  const revoke = (it: Iss) => run(`rv:${it.id}`, async () => { if (!window.confirm(ar ? 'إلغاء هذه اللقطة؟ ستظهر «مُلغاة» لمن يتحقق منها.' : 'Revoke this snapshot?')) return; const r = await fetch('/api/vc', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: 'revoke_snapshot', id: it.id }) }); const j = await r.json(); if (!j.success) throw new Error(j.error); await load(); return ar ? 'أُلغيت اللقطة.' : 'Snapshot revoked.'; });

  const signedByCred = new Map((rows || []).filter(r => r.kind === 'credential').map(r => [r.credential_id, r]));
  const snaps = (rows || []).filter(r => r.kind === 'snapshot');
  type Item = { key: string; code: string; title: string; kind: 'credential' | 'snapshot'; signed: Iss | null; revoked: boolean; expires: string | null; iss: Iss | null };
  const items: Item[] = [...credentials.map(c => ({ key: c.id, code: c.verify_code, title: lang === 'en' && c.title_en ? c.title_en : c.title_ar, kind: 'credential' as const, signed: signedByCred.get(c.id) || null, revoked: !!c.revoked_at, expires: null, iss: signedByCred.get(c.id) || null })),
    ...snaps.map(s => ({ key: s.id, code: s.code, title: s.title_ar || (ar ? 'لقطة قدرة' : 'Capability snapshot'), kind: 'snapshot' as const, signed: s, revoked: !!s.revoked_at || !!(s.expires_at && new Date(s.expires_at) < new Date()), expires: s.expires_at, iss: s }))];

  return (
    <div className="pt-box sw" data-testid="wallet">
      <h3><Icon name="shield" size={18} /> {ar ? 'محفظتي السيادية' : 'My sovereign wallet'}</h3>
      <p className="pt-muted">{ar ? 'الملف الذي تنزّله هنا ملكك: شهادة Open Badges 3.0 موقَّعة بمفتاح أَثَر (Ed25519). تعمل بلا أَثَر وبلا إنترنت، ويتحقق منها أي جهة في العالم بثانية، ولا يمكن لأحد تعديلها — ولا نحن.' : 'What you download here is yours: an Open Badges 3.0 credential signed with Athar’s Ed25519 key. Works without Athar or the internet; anyone can verify it in a second; nobody can alter it — not even us.'}</p>
      {!configured && <div className="pt-alert" style={{ marginBottom: 8 }}>{ar ? 'التوقيع التشفيري لم يُفعَّل بعد (مفتاح التوقيع لدى الإدارة). شهاداتك الحية تعمل، والنسخ الموقَّعة ستتاح فور التفعيل.' : 'Cryptographic signing is not enabled yet; signed copies will be available once the admin sets the key.'}</div>}
      <div className="sw-snap"><div><b>{ar ? 'لقطة قدرة موقَّعة' : 'Signed capability snapshot'}</b><small>{ar ? `وثيقة بتاريخ اليوم تحمل مستوياتك المعتمَدة/المحسوبة فقط، صالحة ${SNAPSHOT_DAYS} يومًا — أرسلها لجهة توظيف دون كشف أي شيء آخر.` : `A dated statement of your current levels only, valid ${SNAPSHOT_DAYS} days — share with an employer without revealing anything else.`}</small></div><button type="button" className="pt-btn small" data-testid="wallet-snapshot" disabled={busy === 'snap' || !configured} onClick={snapshot}><Icon name="award" size={13} /> {busy === 'snap' ? '…' : (ar ? 'أصدر لقطة الآن' : 'Issue now')}</button></div>
      {rows === null && <div className="pt-muted">…</div>}
      {rows !== null && items.length === 0 && <div className="pt-muted">{ar ? 'لا شهادات بعد — تُضاف هنا تلقائيًا حين تُصدر.' : 'No credentials yet.'}</div>}
      <div className="sw-list">{items.map(it => <div key={it.key} className={`sw-item ${it.revoked ? 'off' : ''} ${it.kind}`} data-testid="wallet-item" data-code={it.code}>
        <div className="sw-meta"><span className={`sw-k ${it.kind}`}>{it.kind === 'snapshot' ? (ar ? 'لقطة' : 'Snapshot') : (ar ? 'شهادة' : 'Credential')}</span><b>{it.title}</b><small><span dir="ltr">{it.code}</span>{it.signed ? <> · {ar ? 'موقَّعة' : 'signed'} {fmtDate(it.signed.issued_at, lang)} · <span dir="ltr">{keyFingerprint(it.signed.kid.split('#')[1] || '')}</span></> : <> · {ar ? 'غير موقَّعة بعد' : 'not signed yet'}</>}{it.expires && <> · {ar ? 'حتى' : 'until'} {fmtDate(it.expires, lang)}</>}{it.revoked && <> · <em>{ar ? 'مُلغاة/منتهية' : 'revoked/expired'}</em></>}</small></div>
        <div className="pt-chips">
          <button type="button" className="pt-btn light small" data-testid="wallet-download" disabled={busy === `dl:${it.code}` || it.revoked || (!configured && !it.signed)} onClick={() => download(it.code)}><Icon name="download" size={13} /> {ar ? 'نزّل الموقَّعة' : 'Download signed'}</button>
          <button type="button" className="pt-btn ghost small" data-testid="wallet-qr" onClick={() => setQr(qr === it.code ? null : it.code)}><Icon name="table" size={13} /> QR</button>
          <button type="button" className="pt-btn ghost small" onClick={() => copy(it.code)}><Icon name="copy" size={13} /> {ar ? 'رابط التحقق' : 'Verify link'}</button>
          {it.kind === 'credential' && <Link href={`/credential/${encodeURIComponent(it.code)}`} target="_blank" className="pt-btn ghost small"><Icon name="globe" size={13} /> {ar ? 'الحية' : 'Living'}</Link>}
          {it.kind === 'snapshot' && !it.revoked && <button type="button" className="pt-btn ghost small danger" disabled={busy === `rv:${it.iss!.id}`} onClick={() => revoke(it.iss!)}><Icon name="x" size={13} /> {ar ? 'إلغاء' : 'Revoke'}</button>}
        </div>
        {qr === it.code && <div className="sw-qr"><span dangerouslySetInnerHTML={{ __html: qrSvg(verifyUrl(it.code), 150) }} /><div><b>{ar ? 'امسح للتحقق' : 'Scan to verify'}</b><small dir="ltr">{verifyUrl(it.code)}</small><small>{ar ? 'يفتح صفحة التحقق المستقل حيث يُفحص التوقيع داخل متصفح الجهة.' : 'Opens the independent verifier; the signature is checked in the verifier’s browser.'}</small></div></div>}
      </div>)}</div>
      {ok && <div className="pt-alert ok" style={{ marginTop: 8 }}>{ok}</div>}{err && <div className="pt-alert err" style={{ marginTop: 8 }}>{err}</div>}
      <small className="pt-muted">{ar ? 'المعيار: W3C Verifiable Credentials 2.0 + Open Badges 3.0 · التوقيع eddsa-jcs-2022 (Ed25519) · هوية المُصدِر did:web · الإلغاء بقائمة حالة موقَّعة. تحقق مستقل: ' : 'Standards: W3C VC 2.0 + Open Badges 3.0 · eddsa-jcs-2022 · did:web · signed status list. Independent verifier: '}<Link href="/verify/vc">/verify/vc</Link></small>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}
const CSS = `
.sw .pt-muted{color:#64748b;font-size:13px;line-height:1.8}.sw-snap{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border:1px solid #c9a24b55;background:linear-gradient(135deg,#fffbeb,#fff);border-radius:14px;padding:10px 14px;margin:10px 0}.sw-snap b{display:block;color:#0f2a4e;font-size:14px}.sw-snap small{color:#64748b;font-size:12px;line-height:1.7;display:block;max-width:560px}
.sw-list{display:grid;gap:8px}.sw-item{border:1px solid #e2e8f0;border-radius:12px;padding:10px 14px;display:grid;gap:8px}.sw-item.off{opacity:.6}.sw-item.snapshot{border-color:#c9a24b66}
.sw-meta b{display:block;color:#0f172a;font-size:14px}.sw-meta small{color:#64748b;font-size:11.5px}.sw-meta em{color:#991b1b;font-style:normal;font-weight:800}
.sw-k{font-size:10.5px;font-weight:900;border-radius:999px;padding:2px 8px;background:#e0f2fe;color:#075985;margin-inline-end:6px}.sw-k.snapshot{background:#fef3c7;color:#92400e}
.sw-qr{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center;border-top:1px dashed #e2e8f0;padding-top:8px}.sw-qr svg{border:1px solid #e2e8f0;border-radius:10px}.sw-qr b{display:block;color:#0f2a4e;font-size:13px}.sw-qr small{display:block;color:#64748b;font-size:11.5px;word-break:break-all}
.pt-btn.danger{color:#991b1b;border-color:#fecaca}
@media(max-width:600px){.sw-qr{grid-template-columns:1fr}}
`;
