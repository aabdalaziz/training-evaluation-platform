'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر — التحقق المستقل من شهادة موقَّعة (P17 «محفظة القدرة السيادية»): الصق/اسحب ملف VC أو افتح برمز.
// التوقيع يُفحص داخل متصفح الجهة (WebCrypto Ed25519) بمفتاح المُصدِر المنشور في did.json — لا يحتاج ثقة بخادمنا؛
// الحالة (الإلغاء) تُفحص حيًّا من سجل أَثَر إن توفر اتصال، وإلا يُقال ذلك صراحة.

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fmtDate } from '../../../lib/portal/content';
import { didWebUrl, hashDataToSign, multikeyToRaw, decodeProofValue, structuralChecks, summarize, type VerifyCheck, type VcSummary } from '../../../lib/portal/vc';

export default function VerifyVcPage() { return <PortalShell><Suspense fallback={null}><Inner /></Suspense></PortalShell>; }
type Result = { ok: boolean; checks: (VerifyCheck & { via?: 'browser' | 'server' })[]; summary: VcSummary | null; via: 'browser' | 'server' | 'mixed'; at: string };

const webSha256 = async (d: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', d as BufferSource));
async function browserSignature(doc: any): Promise<VerifyCheck | null> {
  try {
    if (!globalThis.crypto?.subtle) return null; const p = doc.proof; const vm = String(p.verificationMethod); const did = vm.split('#')[0];
    let url = didWebUrl(did); try { const u = new URL(url); if (u.host === location.host) url = `${location.origin}${u.pathname}`; } catch { /* نتركه */ }
    const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) return { key: 'signature', ok: false, ar: 'تعذّر جلب مفاتيح المُصدِر (did.json)', en: 'Could not fetch issuer keys' };
    const dd = await r.json(); const m = (dd.verificationMethod || []).find((x: any) => x.id === vm); if (!m?.publicKeyMultibase) return { key: 'signature', ok: false, ar: 'مفتاح التوقيع غير منشور لدى المُصدِر', en: 'Key not published by issuer' };
    const raw = multikeyToRaw(String(m.publicKeyMultibase)); let key: CryptoKey; try { key = await crypto.subtle.importKey('raw', raw as BufferSource, { name: 'Ed25519' } as any, false, ['verify']); } catch { return null; /* المتصفح لا يدعم Ed25519 → الخادم */ }
    const data = await hashDataToSign(doc, { type: p.type, cryptosuite: p.cryptosuite, created: p.created, verificationMethod: vm, proofPurpose: p.proofPurpose }, webSha256);
    const ok = await crypto.subtle.verify({ name: 'Ed25519' } as any, key, decodeProofValue(String(p.proofValue)) as BufferSource, data as BufferSource);
    return { key: 'signature', ok, ar: ok ? 'التوقيع صحيح — الوثيقة لم تُعدَّل منذ توقيعها' : 'التوقيع غير صحيح — الوثيقة عُدِّلت أو لم توقَّع بهذا المفتاح', en: ok ? 'Signature valid — unmodified' : 'Invalid signature' };
  } catch (e: any) { return { key: 'signature', ok: false, ar: `تعذّر التحقق في المتصفح: ${e?.message || e}`, en: `Browser verification failed: ${e?.message || e}` }; }
}

function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const sp = useSearchParams(); const codeParam = (sp?.get('code') || '').trim();
  const [text, setText] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [res, setRes] = useState<Result | null>(null); const [drag, setDrag] = useState(false); const fileRef = useRef<HTMLInputElement>(null);

  const verify = useCallback(async (raw: string) => {
    setBusy(true); setErr(''); setRes(null);
    try {
      let doc: any; try { doc = JSON.parse(raw); } catch { throw new Error(ar ? 'النص ليس JSON صالحًا — الصق محتوى ملف الشهادة كاملًا.' : 'Not valid JSON.'); }
      const checks: Result['checks'] = structuralChecks(doc).map(c => ({ ...c, via: 'browser' as const })); const structOk = checks.filter(c => c.key !== 'validity').every(c => c.ok);
      const [sig, server] = await Promise.all([structOk ? browserSignature(doc) : Promise.resolve<VerifyCheck | null>({ key: 'signature', ok: false, ar: 'لم يُفحص التوقيع لخلل في البنية', en: 'Signature not checked' }),
        fetch('/api/vc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'verify', vc: doc }) }).then(r => r.json()).catch(() => null)]);
      const sChecks: VerifyCheck[] = server?.checks || [];
      if (sig) checks.push({ ...sig, via: 'browser' }); else { const ss = sChecks.find(c => c.key === 'signature'); checks.push(ss ? { ...ss, via: 'server' } : { key: 'signature', ok: null, ar: 'متصفحك لا يدعم Ed25519 وتعذّر الوصول إلى الخادم — لم يُفحص التوقيع', en: 'No Ed25519 in browser and server unreachable', via: 'server' }); }
      const st = sChecks.find(c => c.key === 'status'); checks.push(st ? { ...st, via: 'server' } : { key: 'status', ok: null, ar: server ? 'لا قائمة حالة لهذه الوثيقة' : 'بلا اتصال بأَثَر — لم يُتحقق من الإلغاء (التوقيع وحده فُحص)', en: server ? 'No status list' : 'Offline — revocation not checked', via: 'server' });
      const via: Result['via'] = sig ? (st ? 'mixed' : 'browser') : 'server';
      setRes({ ok: checks.every(c => c.ok !== false), checks, summary: structOk ? summarize(doc) : null, via, at: new Date().toISOString() });
    } catch (e: any) { setErr(e?.message || String(e)); }
    setBusy(false);
  }, [ar]);

  useEffect(() => { if (!codeParam) return; (async () => { setBusy(true); setErr(''); try { const r = await fetch(`/api/vc?code=${encodeURIComponent(codeParam)}`, { cache: 'no-store' }); const t = await r.text(); if (!r.ok) { const j = JSON.parse(t); throw new Error(j.error || 'تعذّر الجلب'); } setText(t); await verify(t); } catch (e: any) { setErr(e?.message || String(e)); setBusy(false); } })(); }, [codeParam, verify]);
  const onFile = async (f: File | null | undefined) => { if (!f) return; const t = await f.text(); setText(t); await verify(t); };
  const ICON: Record<string, any> = { structure: 'doc', proof: 'shield', issuer: 'globe', signature: 'check', validity: 'calendar', status: 'bell' };
  const LABEL: Record<string, [string, string]> = { structure: ['البنية', 'Structure'], proof: ['الإثبات', 'Proof'], issuer: ['المُصدِر', 'Issuer'], signature: ['التوقيع', 'Signature'], validity: ['الصلاحية', 'Validity'], status: ['الحالة', 'Status'] };

  return (
    <main className="pt-main vv">
      <section className="pt-pagehead"><div className="pt-wrap"><div className="pt-crumbs"><Link href="/">{ar ? 'الرئيسية' : 'Home'}</Link> / <Link href="/verify">{ar ? 'التحقق' : 'Verify'}</Link> / <span>{ar ? 'شهادة موقَّعة' : 'Signed credential'}</span></div>
        <h1>{ar ? 'التحقق المستقل من شهادة أَثَر' : 'Independent verification of an Athar credential'}</h1>
        <p>{ar ? 'الصق ملف الشهادة (JSON) أو اسحبه هنا. يُفحص التوقيع داخل متصفحك بمفتاح أَثَر العام المنشور بمعيار did:web — فلا تحتاج أن تثق بخادمنا، ولا حتى بأن يكون متاحًا. الحالة (الإلغاء) تُفحص حيًّا إن توفر اتصال.' : 'Paste or drop the credential JSON. The signature is checked in your browser against Athar’s published did:web key — no trust in our server required. Revocation is checked live when online.'}</p></div></section>
      <section className="pt-sec"><div className="pt-wrap" style={{ maxWidth: 900 }}>
        <div className={`vv-drop ${drag ? 'on' : ''}`} onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={e => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}>
          <textarea data-testid="vc-input" dir="ltr" value={text} onChange={e => setText(e.target.value)} placeholder='{"@context":[…],"type":["VerifiableCredential","OpenBadgeCredential"],…,"proof":{…}}' spellCheck={false} />
          <div className="vv-acts">
            <button type="button" className="pt-btn" data-testid="vc-verify" disabled={busy || !text.trim()} onClick={() => verify(text)}><Icon name="shield" size={14} /> {busy ? (ar ? 'جارٍ التحقق…' : 'Verifying…') : (ar ? 'تحقّق الآن' : 'Verify now')}</button>
            <button type="button" className="pt-btn light" onClick={() => fileRef.current?.click()}><Icon name="folder" size={14} /> {ar ? 'اختر ملفًا' : 'Choose file'}</button><input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={e => onFile(e.target.files?.[0])} />
            <button type="button" className="pt-btn ghost" onClick={() => { setText(''); setRes(null); setErr(''); }}><Icon name="x" size={14} /> {ar ? 'مسح' : 'Clear'}</button>
            <span className="pt-muted">{ar ? 'أو افتح رابط التحقق المطبوع على الشهادة (QR).' : 'Or open the verify link printed on the credential (QR).'}</span>
          </div>
        </div>
        {err && <div className="pt-alert err" style={{ marginTop: 12 }}>{err}</div>}
        {res && <div className={`vv-res ${res.ok ? 'ok' : 'bad'}`} data-testid="vc-result" data-ok={res.ok ? '1' : '0'}>
          <div className="vv-verdict"><Icon name={res.ok ? 'check' : 'x'} size={28} /><div><b>{res.ok ? (ar ? 'شهادة أصلية موقَّعة من أَثَر' : 'Authentic credential signed by Athar') : (ar ? 'لا يمكن اعتماد هذه الوثيقة' : 'This document cannot be trusted')}</b><small>{ar ? `فُحصت ${fmtDate(res.at, lang)} · التوقيع ${res.checks.find(c => c.key === 'signature')?.via === 'browser' ? 'في متصفحك' : 'عبر خادم أَثَر'} · الحالة من سجل أَثَر` : `Checked ${fmtDate(res.at, lang)} · signature ${res.checks.find(c => c.key === 'signature')?.via === 'browser' ? 'in your browser' : 'via Athar server'}`}</small></div></div>
          <div className="vv-checks">{res.checks.map(c => <div key={c.key} className={`vv-chk ${c.ok === true ? 'ok' : c.ok === false ? 'bad' : 'na'}`} data-testid={`vc-check-${c.key}`}><i><Icon name={c.ok === true ? 'check' : c.ok === false ? 'x' : 'question'} size={13} /></i><b>{LABEL[c.key]?.[ar ? 0 : 1] || c.key}</b><span>{ar ? c.ar : c.en}</span><small>{c.via === 'browser' ? (ar ? 'متصفحك' : 'browser') : (ar ? 'أَثَر' : 'Athar')}</small></div>)}</div>
          {res.summary && <div className="vv-sum" data-testid="vc-summary">
            <h3>{res.summary.title || (ar ? 'وثيقة' : 'Document')}</h3>
            <div className="vv-grid">
              <div><small>{ar ? 'صاحبها' : 'Holder'}</small><b>{res.summary.holder || '—'}</b>{res.summary.holderEmail && <span dir="ltr">{res.summary.holderEmail}</span>}</div>
              <div><small>{ar ? 'النوع' : 'Type'}</small><b>{res.summary.kind === 'snapshot' ? (ar ? 'لقطة قدرة (90 يومًا)' : 'Capability snapshot (90 days)') : res.summary.kind === 'credential' ? (ar ? 'شهادة رقمية — Open Badges 3.0' : 'Digital credential — Open Badges 3.0') : res.summary.kind}</b></div>
              <div><small>{ar ? 'المُصدِر' : 'Issuer'}</small><b dir="ltr">{res.summary.issuer}</b></div>
              <div><small>{ar ? 'صدرت' : 'Issued'}</small><b>{res.summary.validFrom ? fmtDate(res.summary.validFrom, lang) : '—'}</b></div>
              <div><small>{ar ? 'صالحة حتى' : 'Valid until'}</small><b>{res.summary.validUntil ? fmtDate(res.summary.validUntil, lang) : (ar ? 'دائمة' : 'No expiry')}</b></div>
              <div><small>{ar ? 'بصمة مفتاح التوقيع' : 'Signing key fingerprint'}</small><b dir="ltr">{res.summary.fingerprint || '—'}</b></div>
            </div>
            {res.summary.skills.length > 0 && <div className="vv-skills"><small>{ar ? 'المهارات الموثّقة وأطرها المرجعية' : 'Certified skills and frameworks'}</small>{res.summary.skills.map((s, i) => <div key={i} className="vv-sk"><b>{s.name}</b><span dir="ltr">{s.code}</span><em>{s.framework}</em>{s.level && <strong>{ar ? `المستوى ${s.level}/5` : `Level ${s.level}/5`}</strong>}</div>)}</div>}
            {res.summary.code && <p className="pt-muted" style={{ marginTop: 8 }}>{ar ? 'الرمز' : 'Code'}: <span dir="ltr">{res.summary.code}</span>{res.summary.kind === 'credential' && <> · <Link href={`/credential/${encodeURIComponent(res.summary.code)}`}>{ar ? 'الشهادة الحية (المستوى الآن)' : 'Living credential (level now)'}</Link></>}</p>}
          </div>}
        </div>}
        <details className="vv-why"><summary><Icon name="question" size={14} /> {ar ? 'لماذا تثق بهذه النتيجة؟' : 'Why trust this result?'}</summary>
          <ol>{ar ? <><li>الشهادة وثيقة <b>W3C Verifiable Credential 2.0 / Open Badges 3.0</b> موقَّعة بخوارزمية <b>Ed25519</b> (cryptosuite eddsa-jcs-2022).</li><li>مفتاح أَثَر العام منشور علنًا في <a href="/.well-known/did.json" target="_blank" rel="noreferrer">/.well-known/did.json</a> بمعيار <b>did:web</b>؛ متصفحك جلبه وقارن التوقيع رياضيًا. تغيير حرف واحد في الوثيقة يُسقط التوقيع — ولا يمكن لأحد، بما فيهم أَثَر، إنتاج توقيع صحيح بلا المفتاح الخاص.</li><li>الإلغاء مُعلَن في <a href="/api/vc?status=1" target="_blank" rel="noreferrer">قائمة حالة</a> موقَّعة (Bitstring Status List) — تُفحص حيًّا إن توفر اتصال.</li><li>يمكنك التحقق بأي أداة VC عالمية تدعم eddsa-jcs-2022 دون موقعنا إطلاقًا.</li></> : <><li>W3C VC 2.0 / Open Badges 3.0 document signed with Ed25519 (eddsa-jcs-2022).</li><li>Athar’s public key is published at <a href="/.well-known/did.json">/.well-known/did.json</a> (did:web); your browser fetched it and verified the signature mathematically.</li><li>Revocation is announced in a signed Bitstring Status List, checked live when online.</li><li>Any standards-compliant VC verifier can check it without our site.</li></>}</ol></details>
      </div></section>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </main>
  );
}
const CSS = `
.vv-drop{background:#fff;border:2px dashed #cbd5e1;border-radius:18px;padding:14px;transition:border-color .2s,background .2s}.vv-drop.on{border-color:#0b8a83;background:#f0fdfa}
.vv-drop textarea{width:100%;min-height:150px;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;font:12.5px/1.6 ui-monospace,Menlo,Consolas,monospace;color:#0f172a;background:#f8fafc;resize:vertical;box-sizing:border-box}
.vv-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.pt-muted{color:#64748b;font-size:13px}
.vv-res{margin-top:14px;background:#fff;border:2px solid #e2e8f0;border-radius:20px;padding:18px 20px}.vv-res.ok{border-color:#059669}.vv-res.bad{border-color:#dc2626}
.vv-verdict{display:flex;gap:12px;align-items:center;color:#065f46}.vv-res.bad .vv-verdict{color:#991b1b}.vv-verdict b{display:block;font-size:19px}.vv-verdict small{color:#64748b;font-size:12px}
.vv-checks{display:grid;gap:6px;margin-top:14px}.vv-chk{display:grid;grid-template-columns:auto 110px 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;font-size:13px;background:#f8fafc}
.vv-chk i{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:#e2e8f0;color:#334155}.vv-chk.ok i{background:#dcfce7;color:#166534}.vv-chk.bad i{background:#fee2e2;color:#991b1b}.vv-chk.na i{background:#fef3c7;color:#92400e}
.vv-chk b{color:#0f2a4e}.vv-chk span{color:#334155}.vv-chk small{font-size:10.5px;font-weight:900;letter-spacing:.3px;background:#0f2a4e;color:#fff;border-radius:999px;padding:2px 8px}
.vv-sum{margin-top:16px;border-top:1px solid #e2e8f0;padding-top:14px}.vv-sum h3{margin:0 0 10px;font-size:18px;color:#0f2a4e}
.vv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.vv-grid div{border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;background:#fff}.vv-grid small{display:block;color:#64748b;font-size:11.5px}.vv-grid b{font-size:14px;color:#0f172a;word-break:break-all}.vv-grid span{display:block;font-size:12px;color:#64748b}
.vv-skills{margin-top:10px;display:grid;gap:6px}.vv-skills>small{color:#64748b;font-size:12px}.vv-sk{display:grid;grid-template-columns:1.4fr auto 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:7px 12px;font-size:13px}.vv-sk b{color:#0f172a}.vv-sk span{color:#0b8a83;font-weight:900;font-size:12px}.vv-sk em{font-style:normal;color:#64748b;font-size:12px}.vv-sk strong{color:#0f2a4e}
.vv-why{margin-top:16px;border:1px dashed #cbd5e1;border-radius:12px;padding:8px 14px;background:#fff}.vv-why summary{cursor:pointer;font-weight:800;color:#0f2a4e;font-size:13.5px;display:flex;gap:6px;align-items:center}.vv-why ol{color:#334155;font-size:13.5px;line-height:1.9;margin:8px 0 4px;padding-inline-start:20px}.vv-why a{color:#0b8a83;font-weight:800}
@media(max-width:700px){.vv-grid{grid-template-columns:1fr 1fr}.vv-chk{grid-template-columns:auto 1fr auto}.vv-chk span{grid-column:1/-1}.vv-sk{grid-template-columns:1fr auto}}
`;
