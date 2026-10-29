'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * /me/agents — «وكلائي» (P20 سفارة أَثَر): المكتب الزجاجي الشخصي — من فوّضتَ من المساعدين، بأي صلاحيات، متى استُخدمت، وإبطال بضغطة
 *  + كيف تضيف أَثَر إلى مساعدك (رابط /mcp) — والتفويض يبدأ دائمًا من داخل المساعد نفسه
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../../lib/ui/icons';
import { PortalShell, useLang } from '../../components/PortalShell';
import { fastToken } from '../../components/Pocket';
import { supabase } from '../../../lib/supabase/client';
import { PSCOPE_LABEL, PERSONAL_SCOPES } from '../../../lib/portal/oauth';

type Del = { id: string; created_at: string; client_id: string; client_name: string; scopes: string[]; scope_labels: string[]; last_used_at: string | null; uses: number; revoked_at: string | null };
type Data = { delegations: Del[]; log: { at: string; tool: string; ok: boolean; client: string; line: string }[] };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short' }) : '—');

export default function MyAgentsPage() { return <PortalShell><Inner /></PortalShell>; }
function Inner() {
  const { lang } = useLang(); const ar = lang === 'ar'; const db = useMemo(() => supabase(), []);
  const [tok, setTok] = useState<string | null>(null); const [data, setData] = useState<Data | null>(null); const [busy, setBusy] = useState(''); const [copied, setCopied] = useState(''); const [err, setErr] = useState('');
  const site = typeof location !== 'undefined' ? location.origin : 'https://athar-portal.vercel.app';
  useEffect(() => { fastToken(db).then(t => setTok(t || '')); }, [db]);
  const load = useCallback(async (t: string) => { const j = await fetch('/api/oauth', { headers: { Authorization: `Bearer ${t}` }, cache: 'no-store' }).then(r => r.json()).catch(() => null); if (j?.success) setData(j); else setErr(j?.error || (ar ? 'تعذّر التحميل' : 'Failed')); }, [ar]);
  useEffect(() => { if (tok) load(tok); }, [tok, load]);
  async function revoke(id: string) { if (!confirm(ar ? 'إبطال تفويض هذا المساعد الآن؟ سيُرفض عند أول نداء.' : 'Revoke this assistant now?')) return; setBusy(id); await fetch('/api/oauth', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` }, body: JSON.stringify({ action: 'revoke', id }) }); await load(tok || ''); setBusy(''); }
  const copy = (k: string, v: string) => { navigator.clipboard?.writeText(v); setCopied(k); setTimeout(() => setCopied(''), 1500); };
  const active = (data?.delegations || []).filter(d => !d.revoked_at); const old = (data?.delegations || []).filter(d => d.revoked_at);
  return (
    <main className="ma" dir={ar ? 'rtl' : 'ltr'}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header className="ma-head"><span className="pt-kicker"><Icon name="shield" size={14} /> {ar ? 'سفارة أَثَر · المكتب الزجاجي الشخصي' : 'Athar Embassy · your glass office'}</span><h1>{ar ? 'وكلائي' : 'My agents'}</h1><p>{ar ? 'المساعدون الأذكياء الذين سمحتَ لهم بالعمل على بياناتك في أَثَر — ما يستطيعون، ماذا فعلوا، ومتى. أنت صاحب القرار دائمًا.' : 'Assistants you allowed to act on your Athar data — what they can do, what they did, and when. You stay in control.'}</p></header>
      {tok === '' && <section className="pt-box ma-box"><p>{ar ? 'سجّل الدخول لعرض وكلائك.' : 'Sign in to see your agents.'} <Link href="/login">{ar ? 'تسجيل الدخول' : 'Sign in'}</Link></p></section>}
      {err && <div className="ma-err">{err}</div>}
      {tok && data && (
        <>
          <section className="pt-box ma-box" data-testid="my-delegations">
            <h2><Icon name="users" size={18} /> {ar ? 'التفويضات النشطة' : 'Active authorizations'} <span className="ma-n">{active.length}</span></h2>
            {!active.length && <p className="ma-muted">{ar ? 'لا مساعد مفوَّضًا بعد. التفويض يبدأ من داخل مساعدك: أضف رابط أَثَر أدناه، وحين يطلب الإذن ستظهر لك شاشة الموافقة.' : 'No assistant authorized yet. Authorization starts inside your assistant: add the Athar link below.'}</p>}
            {active.map(d => (
              <article key={d.id} className="ma-del" data-testid="delegation">
                <div className="ma-delhead"><b>{d.client_name}</b><small dir="ltr">{d.client_id.length > 48 ? `${d.client_id.slice(0, 48)}…` : d.client_id}</small></div>
                <div className="ma-chips">{d.scopes.map(s => <span key={s} className={`ma-chip ${(PSCOPE_LABEL as any)[s]?.risk || ''}`}>{(PSCOPE_LABEL as any)[s]?.ar || s}</span>)}</div>
                <div className="ma-meta"><span>{ar ? 'فُوِّض' : 'Granted'} {fmt(d.created_at)}</span><span>{ar ? 'آخر استخدام' : 'Last used'} {fmt(d.last_used_at)}</span><span>{d.uses} {ar ? 'نداءً اليوم' : 'calls today'}</span></div>
                <button className="pt-btn ghost small" onClick={() => revoke(d.id)} disabled={busy === d.id} data-testid="delegation-revoke">{busy === d.id ? '…' : ar ? 'أبطل الآن' : 'Revoke'}</button>
              </article>
            ))}
            {old.length > 0 && <details className="ma-old"><summary>{ar ? `مُبطَلة (${old.length})` : `Revoked (${old.length})`}</summary>{old.map(d => <div key={d.id} className="ma-oldrow"><b>{d.client_name}</b><span>{fmt(d.revoked_at)}</span></div>)}</details>}
          </section>
          <section className="pt-box ma-box" data-testid="my-agent-log">
            <h2><Icon name="inbox" size={18} /> {ar ? 'ماذا فعلوا — آخر 30 نداءً' : 'What they did — last 30 calls'}</h2>
            {!data.log.length && <p className="ma-muted">{ar ? 'لا نداءات بعد.' : 'No calls yet.'}</p>}
            <ol className="ma-log">{data.log.map((l, i) => <li key={i} className={l.ok ? '' : 'bad'}>{l.line}</li>)}</ol>
          </section>
        </>
      )}
      <section className="pt-box ma-box ma-how">
        <h2><Icon name="link" size={18} /> {ar ? 'أضف أَثَر إلى مساعدك' : 'Add Athar to your assistant'}</h2>
        <p className="ma-muted">{ar ? 'في إعدادات المساعد (ChatGPT · Claude · Cursor · أي عميل MCP) اختر «إضافة خادم/موصل MCP» والصق الرابط. سيطلب المساعد الإذن مرة واحدة عبر شاشة أَثَر، وتختار أنت الصلاحيات.' : 'In your assistant settings choose “Add MCP server/connector” and paste the link. It will ask once via Athar’s consent screen.'}</p>
        <div className="ma-url"><code dir="ltr">{site}/mcp</code><button className="pt-btn light small" onClick={() => copy('mcp', `${site}/mcp`)}>{copied === 'mcp' ? (ar ? 'نُسخ' : 'Copied') : (ar ? 'نسخ' : 'Copy')}</button></div>
        <div className="ma-url"><code dir="ltr">{site}/mcp/public</code><small>{ar ? 'نسخة عامة بلا تفويض (اكتشاف · تحقق · مؤشر الأداء)' : 'public, no authorization'}</small></div>
        <ul className="ma-scopes">{PERSONAL_SCOPES.map(s => <li key={s}><b>{PSCOPE_LABEL[s].ar}</b> — {PSCOPE_LABEL[s].detail_ar}</li>)}</ul>
      </section>
    </main>
  );
}
const CSS = `
.ma{max-width:900px;margin:0 auto;padding:26px 16px 64px;display:grid;gap:16px}
.ma-head h1{margin:6px 0 6px;font-size:28px;color:#0f2a4e}.ma-head p{margin:0;color:#475569;font-size:14.5px;line-height:1.9;max-width:720px}
.ma-box{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px 20px;display:grid;gap:12px}.ma-box h2{margin:0;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center}.ma-n{background:#e6f4f1;color:#0b8a83;border-radius:999px;padding:1px 10px;font-size:12.5px}
.ma-muted{color:#64748b;font-size:13.5px;line-height:1.8;margin:0}.ma-err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca;border-radius:12px;padding:10px 12px}
.ma-del{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;display:grid;gap:8px;background:#f8fafc}.ma-delhead{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}.ma-delhead b{color:#0f2a4e;font-size:15px}.ma-delhead small{color:#94a3b8;font-size:11.5px}
.ma-chips{display:flex;gap:6px;flex-wrap:wrap}.ma-chip{font-size:11.5px;font-weight:800;border-radius:999px;padding:2px 9px;background:#e6f4f1;color:#0b8a83}.ma-chip.medium{background:#fdf6e3;color:#9a6b00}.ma-chip.high{background:#fef2f2;color:#b91c1c}
.ma-meta{display:flex;gap:14px;flex-wrap:wrap;color:#64748b;font-size:12.5px}.ma-del .pt-btn{justify-self:start}
.ma-old summary{cursor:pointer;color:#64748b;font-size:13px}.ma-oldrow{display:flex;justify-content:space-between;font-size:13px;color:#94a3b8;padding:4px 0}
.ma-log{margin:0;padding:0;list-style:none;display:grid;gap:6px}.ma-log li{font-size:13.5px;color:#1e293b;padding:8px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0}.ma-log li.bad{border-color:#fecaca;color:#991b1b}
.ma-url{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.ma-url code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:8px 12px;font-size:13px}.ma-url small{color:#64748b;font-size:12px}
.ma-scopes{margin:0;padding-inline-start:18px;font-size:13px;color:#334155;line-height:1.9}.ma-scopes b{color:#0f2a4e}
.ma .pt-btn.small{padding:6px 12px;font-size:12.5px}
`;
