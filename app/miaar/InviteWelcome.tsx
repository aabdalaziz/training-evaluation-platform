// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
'use client';
/** بطاقة الترحيب قبل فتح نافذة الدعوة — تحلّ محلّ «عُد في الموعد المحدّد».
 *  عمودان متجاوران بطول الصفحة: العربية في اليمين، ولغة الدعوة (مثل الفرنسية) في اليسار، بينهما فاصل ذهبي؛
 *  وإن كانت الدعوة عربية فعمود واحد. على الشاشات الضيّقة جدًّا (< 480px) يتراصّان بالطول حفاظًا على القراءة. */
import { useEffect, useState } from 'react';
import { welcomeText, fillW, sessionLine, opensIn, type InvitePreview } from '../../lib/miaar/welcome';

const RTL = new Set(['ar', 'fa', 'ur', 'ps', 'ku']);
export const welcomeLangs = (lang: string): string[] => (lang === 'ar' ? ['ar'] : [lang, 'ar']);

function Block({ preview, lang, now }: { preview: InvitePreview; lang: string; now: number }) {
  const w = welcomeText(lang); const s = sessionLine(preview, lang); const cd = opensIn(preview.opens_at, lang, now);
  return (
    <div dir={RTL.has(lang) ? 'rtl' : 'ltr'} lang={lang} data-testid={`mi-welcome-${lang}`} style={{ textAlign: 'start' }}>
      <h2 style={{ margin: '0 0 4px', fontSize: 'clamp(22px,3vw,28px)', color: 'var(--navy,#3A1F36)' }}>{w.title}</h2>
      <p className="mi-note" style={{ margin: 0, fontWeight: 800, color: 'var(--ink,#2A1626)' }}>{fillW(w.hello, { name: preview.recipient_name || '' }).replace(/\s+$/, '')}</p>
      <p className="mi-note">{w.about_athar}</p>
      <p className="mi-note">{w.about_miaar}</p>
      <dl style={{ margin: '14px 0 0', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '6px 14px', fontSize: 14, lineHeight: 1.7 }}>
        <dt style={{ color: '#8E7F8A', fontWeight: 800 }}>{w.label_k}</dt><dd style={{ margin: 0, fontWeight: 700 }} dir="auto">{preview.label_ar}</dd>
        {preview.client_name && <><dt style={{ color: '#8E7F8A', fontWeight: 800 }}>{w.by_k}</dt><dd style={{ margin: 0 }} dir="auto">{preview.client_name}</dd></>}
        {preview.location && <><dt style={{ color: '#8E7F8A', fontWeight: 800 }}>{w.where_k}</dt><dd style={{ margin: 0 }} dir="auto">{preview.location}</dd></>}
      </dl>
      {s && (
        <div style={{ margin: '16px 0 0', padding: '14px 16px', borderRadius: 14, background: '#FBF4EE', border: '1px solid #E8D9CF' }} data-testid="mi-welcome-session">
          <div style={{ fontSize: 12.5, fontWeight: 900, color: '#B9544A', letterSpacing: '.02em' }}>{w.session}</div>
          <div style={{ fontSize: 'clamp(16px,2.2vw,19px)', fontWeight: 900, color: 'var(--navy,#3A1F36)', marginTop: 4 }}>{s.main}</div>
          {s.extra && <div className="mi-note" style={{ margin: '4px 0 0' }}>{s.extra}</div>}
          {cd && <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, color: '#5EA8A0' }}>{cd}</div>}
        </div>
      )}
      <h3 style={{ margin: '16px 0 4px', fontSize: 15, color: 'var(--navy,#3A1F36)' }}>{w.tips_k}</h3>
      <ul className="mi-note" style={{ margin: 0, paddingInlineStart: 20 }}>{w.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
      <p className="mi-note" style={{ fontWeight: 800, color: 'var(--ink,#2A1626)' }}>{w.auto}</p>
      <p className="mi-note" style={{ marginTop: 14 }}>{w.luck}</p>
      <p className="mi-note" style={{ margin: 0 }}>{w.regards}<br /><b>{w.team}</b></p>
    </div>
  );
}

const COLS_CSS = `.mi-welcome-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 28px;align-items:start}
.mi-welcome-cols>.c-main{grid-column:1;padding-inline-end:28px;border-inline-end:2px dashed #D9A866}
.mi-welcome-cols>.c-ar{grid-column:2}
@media (max-width:479px){.mi-welcome-cols{grid-template-columns:1fr}.mi-welcome-cols>.c-main{grid-column:auto;padding:0 0 22px;border-inline-end:0;border-bottom:2px dashed #D9A866;margin-bottom:22px}.mi-welcome-cols>.c-ar{grid-column:auto}}`;

export default function InviteWelcome({ preview, lang }: { preview: InvitePreview; lang: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(id); }, []);
  const langs = welcomeLangs(lang); const ready = !!preview.opens_at && Date.parse(preview.opens_at) <= now;
  const refresh = langs.map((l) => welcomeText(l).refresh).join(' · ');
  const two = langs.length === 2;
  return (
    <section className="mi-card mi-welcome" data-testid="mi-welcome">
      <style dangerouslySetInnerHTML={{ __html: COLS_CSS }} />
      {two ? (
        <div className="mi-welcome-cols" dir="ltr" data-testid="mi-welcome-cols">
          <div className="c-main"><Block preview={preview} lang={langs[0]} now={now} /></div>
          <div className="c-ar"><Block preview={preview} lang="ar" now={now} /></div>
        </div>
      ) : <Block preview={preview} lang="ar" now={now} />}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>
        <button type="button" className="mi-btn" onClick={() => window.location.reload()} data-testid="mi-welcome-refresh">{ready ? '▶' : '↻'} {refresh}</button>
        <a className="mi-btn ghost" href="/miaar">Mi&apos;yar · مِعيار</a>
      </div>
    </section>
  );
}
