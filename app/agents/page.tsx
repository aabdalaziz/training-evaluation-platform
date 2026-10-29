'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// أَثَر للوكلاء — «المكتب الزجاجي» (P14-ب): صفحة عامة تشرح لأي وكيل ذكي (أو لمن يملكه) ماذا يستطيع أن يفعل هنا وما لا يستطيع،
// قائمة الأدوات من بطاقة الاكتشاف نفسها، سجل حيّ مجهّل لآخر تعاملات الوكلاء، وكيف تحصل الجهة على مفتاح. JSON-LD للآلات.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '../../lib/ui/icons';
import { PortalShell } from '../components/PortalShell';
import { AGENT_TOOLS, AGENT_CAN_AR, AGENT_CANNOT_AR, SCOPE_LABEL, ANON_DAILY_LIMIT, agentsJsonLd } from '../../lib/portal/agents';

export default function AgentsPage() { return <PortalShell><Inner /></PortalShell>; }

function Inner() {
  const [log, setLog] = useState<{ lines: string[]; count_24h: number } | null>(null); const [site, setSite] = useState('https://athar-portal.vercel.app'); const [copied, setCopied] = useState(false);
  useEffect(() => { if (typeof window !== 'undefined') setSite(window.location.origin); fetch('/api/agent?log=1', { cache: 'no-store' }).then(r => r.json()).then(j => setLog({ lines: j?.lines || [], count_24h: j?.count_24h || 0 })).catch(() => setLog({ lines: [], count_24h: 0 })); }, []);
  const curl = `curl -X POST ${site}/api/agent \\\n  -H "Content-Type: application/json" \\\n  -H "X-Agent-Key: atk_…" \\\n  -d '{"tool":"skill_fit","args":{"skill":"التقويم"}}'`;
  return (
    <main className="gl" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(agentsJsonLd(site)) }} />
      <section className="gl-hero">
        <span className="gl-kicker"><Icon name="globe" size={14} /> أَثَر للوكلاء · المكتب الزجاجي</span>
        <h1>وكيلك الذكي مرحَّب به هنا — ويرى الجميع ما يفعل</h1>
        <p>في 2026 لا يتصفح مدير التدريب موقعنا دائمًا؛ وكيله يفعل. لذلك بنينا لأَثَر بابًا للوكلاء: يكتشف البرامج، يسأل <b>قاعدة الأدلة المؤسسية</b> «أي برنامج أثبت فعلًا رفع هذه المهارة؟»، يطلب عرضًا، يحجز، ويتحقق من شهادة. وكل التزام — سعر أو مقعد — يمرّ على إنسان قبل أن يصبح وعدًا. جدران هذا المكتب زجاجية: سجلّ التعاملات عام ومجهّل.</p>
        <div className="gl-actions"><a className="pt-btn gold" href="#mcp">أضف أَثَر إلى مساعدك (MCP)</a><a className="pt-btn light" href="#tools">الأدوات</a><a className="pt-btn light" href="/.well-known/ai-plugin.json" target="_blank" rel="noreferrer"><Icon name="link" size={14} /> بطاقة الاكتشاف</a><a className="pt-btn light" href="/api/agent" target="_blank" rel="noreferrer">/api/agent</a></div>
      </section>

      <section className="gl-card gl-mcp" id="mcp" data-testid="mcp-section">
        <div className="gl-livehead"><h2><Icon name="link" size={16} /> سفارة أَثَر — خادم MCP رسمي</h2><span>Model Context Protocol · 2026-07-28 + توافق خلفي</span></div>
        <p>لا تحتاج برمجة خاصة بعد اليوم: أي مساعد يدعم MCP (ChatGPT · Claude · Cursor · وكلاء جهتك) يضيف أَثَر بلصق رابط واحد — فيرى الأدوات نفسها، ويتحقق من الشهادات، ويقرأ <b>مؤشر الأداء</b> من المرصد، ويطلب عرض سعر ينتظر إنسانًا. والمتعلم يمنح مساعده <b>أدوات «أنا»</b> (محفظتي · موقف اليوم معي · مهامي) بشاشة موافقة عربية ونطاقات دقيقة يبطلها متى شاء من <Link href="/me/agents">وكلائي</Link>.</p>
        <div className="gl-urls">
          <div><small>مفوَّض (تفويض شخصي OAuth 2.1 أو مفتاح جهة)</small><code dir="ltr">{site}/mcp</code><button type="button" className="pt-btn light small" onClick={() => { navigator.clipboard?.writeText(`${site}/mcp`); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? 'نُسخ' : 'نسخ'}</button></div>
          <div><small>عام بلا هوية (اكتشاف · تحقق · مؤشر الأداء)</small><code dir="ltr">{site}/mcp/public</code></div>
        </div>
        <ul className="gl-mcp-list"><li><b>الاكتشاف الآلي:</b> <code dir="ltr">/.well-known/oauth-protected-resource/mcp</code> → <code dir="ltr">/.well-known/oauth-authorization-server</code> (PKCE S256 · resource indicators · Client ID Metadata Documents · تسجيل ديناميكي للتوافق)</li><li><b>الطبقات:</b> عام (60 نداءً/يوم لكل عنوان) · جهة (حسب مفتاحها) · شخصي (500/يوم لكل تفويض) — وكل نداء يظهر خلف الزجاج أعلاه.</li><li><b>الموارد:</b> <code dir="ltr">athar://observatory/latest</code> · <code dir="ltr">athar://programs/open</code> · <code dir="ltr">athar://did</code> · <code dir="ltr">athar://lexicon</code> · <b>المطالبات:</b> رشّح لي برنامجًا بدليل · تحقق قبل التوظيف · موجز مؤشر الأداء · درّبني على موقف اليوم.</li></ul>
      </section>

      <section className="gl-two">
        <div className="gl-card can"><h2><Icon name="check" size={16} /> ما يستطيع الوكيل</h2><ul>{AGENT_CAN_AR.map(x => <li key={x}>{x}</li>)}</ul></div>
        <div className="gl-card cannot"><h2><Icon name="shield" size={16} /> ما لا يستطيع — أبدًا</h2><ul>{AGENT_CANNOT_AR.map(x => <li key={x}>{x}</li>)}</ul></div>
      </section>

      <section className="gl-card gl-live" data-testid="glass-log">
        <div className="gl-livehead"><h2><Icon name="inbox" size={16} /> ماذا يحدث الآن خلف الزجاج</h2><span>{log ? `${log.count_24h} تعاملًا خلال 24 ساعة` : '…'}</span></div>
        {log && !log.lines.length && <p className="gl-muted">لا تعاملات بعد — سيظهر هنا كل نداء من وكيل، مجهّلًا: من أي قطاع، ماذا طلب، ومتى.</p>}
        <ol>{(log?.lines || []).map((l, i) => <li key={i}>{l}</li>)}</ol>
      </section>

      <section id="tools" className="gl-card">
        <h2><Icon name="compass" size={16} /> الأدوات الثماني</h2>
        <p className="gl-muted">كل أداة تُستدعى بالنداء نفسه: <code>POST /api/agent</code> بجسم <code dir="ltr">{'{ "tool": "…", "args": { … } }'}</code>. الأدوات التي تكتب تُنشئ طلبًا بحالة «ينتظر إنسانًا» وتعيد رقم متابعة.</p>
        <div className="gl-tools">{AGENT_TOOLS.map(t => (
          <article key={t.name} className={`gl-tool ${t.writes ? 'w' : ''}`}>
            <header><code>{t.name}</code><span className={`gl-badge ${t.writes ? 'w' : 'r'}`}>{t.writes ? 'يكتب · اعتماد بشري' : 'قراءة'}</span></header>
            <h3>{t.title_ar}</h3><p>{t.desc_ar}</p>
            <small>الصلاحية: {SCOPE_LABEL[t.scope].ar} · المعاملات: {t.params.map(p => `${p.name}${p.required ? '*' : ''}`).join('، ') || 'بلا'}</small>
          </article>
        ))}</div>
      </section>

      <section className="gl-two">
        <div className="gl-card"><h2><Icon name="shield" size={16} /> كيف تحصل جهتك على مفتاح</h2>
          <ol className="gl-steps"><li>تراسلنا الجهة من بريدها الرسمي عبر <Link href="/contact">صفحة التواصل</Link> بذكر اسم الوكيل والغرض.</li><li>يصدر طاقم أَثَر مفتاحًا <code>atk_…</code> مربوطًا بالجهة، بصلاحيات محددة وحد يومي، ويسلّمه مرة واحدة عبر قناة آمنة.</li><li>تضع الجهة المفتاح في ترويسة <code>X-Agent-Key</code>. بلا مفتاح يعمل الاكتشاف والتحقق فقط بحد {ANON_DAILY_LIMIT} نداءً يوميًا.</li><li>يمكن إبطال المفتاح فورًا، ويُحذف السجل التفصيلي بعد 180 يومًا.</li></ol>
        </div>
        <div className="gl-card gl-code"><h2><Icon name="laptop" size={16} /> مثال</h2><pre dir="ltr">{curl}</pre><button type="button" className="pt-btn light small" onClick={() => { navigator.clipboard?.writeText(curl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}><Icon name="copy" size={13} /> {copied ? 'نُسخ' : 'انسخ'}</button>
          <p className="gl-muted">الرد دائمًا مغلّف: <code dir="ltr">{'{ success, tool, result, human_in_the_loop, notice }'}</code> — وحقل <code>human_in_the_loop</code> يصبح <code>true</code> كلما احتاج الأمر توقيع إنسان.</p></div>
      </section>

      <section className="gl-foot"><p>هذا المكتب جزء من <Link href="/">أَثَر</Link> · مبدؤنا: الذكاء الاصطناعي يساعد، والإنسان يعتمد. للتحقق من شهادة يدويًا: <Link href="/verify">/verify</Link>.</p></section>
    </main>
  );
}

const CSS = `
.gl{max-width:1080px;margin:0 auto;padding:28px 16px 64px;display:grid;gap:18px;font-family:inherit}
.gl-hero{background:radial-gradient(1200px 400px at 80% -20%,rgba(11,138,131,.35),transparent 60%),linear-gradient(135deg,#0f2a4e,#102f5a 60%,#0b8a83);color:#fff;border-radius:24px;padding:36px 32px}
.gl-hero h1{margin:8px 0 10px;font-size:30px;line-height:1.35}.gl-hero p{margin:0;max-width:820px;font-size:15px;line-height:1.9;color:#e2e8f0}.gl-hero b{color:#f6e2a8}
.gl-kicker{display:inline-flex;gap:6px;align-items:center;font-size:12px;font-weight:900;color:#c9a24b;letter-spacing:.3px}
.gl-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.gl-actions .pt-btn.light{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.3)}
.gl-two{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:760px){.gl-two{grid-template-columns:1fr}}
.gl-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:20px 22px}.gl-card h2{margin:0 0 10px;font-size:17px;color:#0f2a4e;display:flex;gap:8px;align-items:center}.gl-card ul{margin:0;padding-inline-start:18px;color:#1e293b;font-size:14px;line-height:1.9}
.gl-card.can{border-top:4px solid #0b8a83}.gl-card.cannot{border-top:4px solid #b91c1c}
.gl-muted{color:#64748b;font-size:13.5px;line-height:1.8}.gl code{background:#f1f5f9;border-radius:6px;padding:1px 6px;font-size:12.5px;direction:ltr;display:inline-block}
.gl-live{background:linear-gradient(180deg,#fff,#f6fbfa)}.gl-livehead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}.gl-livehead span{font-size:12.5px;color:#0b8a83;font-weight:800}
.gl-live ol{margin:6px 0 0;padding:0;list-style:none;display:grid;gap:6px}.gl-live li{font-size:13.5px;color:#1e293b;padding:8px 12px;border-radius:10px;background:#fff;border:1px solid #e2e8f0}.gl-live li::before{content:'●';color:#0b8a83;margin-inline-end:8px;font-size:9px;vertical-align:middle}
.gl-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;margin-top:12px}.gl-tool{border:1px solid #e2e8f0;border-radius:14px;padding:14px;display:grid;gap:6px;align-content:start}.gl-tool.w{background:#fffdf7;border-color:#ead9a6}
.gl-tool header{display:flex;justify-content:space-between;align-items:center;gap:6px}.gl-tool h3{margin:0;font-size:15px;color:#0f2a4e}.gl-tool p{margin:0;font-size:13px;color:#475569;line-height:1.7}.gl-tool small{color:#94a3b8;font-size:11.5px}
.gl-badge{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px}.gl-badge.r{background:#e6f4f1;color:#0b8a83}.gl-badge.w{background:#fdf6e3;color:#9a6b00}
.gl-steps{margin:0;padding-inline-start:20px;font-size:14px;color:#1e293b;line-height:1.9}.gl-steps a{color:#0b8a83}
.gl-code pre{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px;font-size:12.5px;line-height:1.7;overflow:auto;text-align:left;margin:0 0 10px}
.gl-mcp{border-top:4px solid #c9a24b}.gl-mcp p{margin:6px 0 10px;font-size:14px;color:#1e293b;line-height:1.9}.gl-mcp b{color:#0f2a4e}.gl-urls{display:grid;gap:8px}.gl-urls div{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.gl-urls small{color:#64748b;font-size:12px;min-width:220px}.gl-urls code{background:#0f172a;color:#e2e8f0;border-radius:10px;padding:7px 12px;font-size:13px}.gl-mcp-list{margin:12px 0 0;padding-inline-start:18px;font-size:13px;color:#334155;line-height:1.9}
.gl-foot{text-align:center;color:#64748b;font-size:13px}.gl-foot a{color:#0b8a83}
`;
