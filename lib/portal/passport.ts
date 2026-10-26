// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — جواز المهارات (P8-ج): بناء بيانات الجواز من الملف المهاري (دوال نقية) + رسمه على Canvas A4 عمودي وتحويله إلى PDF بلا اعتماديات
import type { Lang } from './content';
import { BRAND } from './content';
import { DOMAINS, domainLabel, frameworkBadges, skillName } from './skills';
import type { Skill } from './skills';
import { displayLevel, levelName, credentialKindLabel, credentialStatus } from './profile';
import type { SkillLevelRow, Credential } from './profile';
import { canvasToJpeg } from '../certificates/render';
import { drawQr } from '../certificates/qr';

// ---------- البيانات ----------
export type PassportSkill = { name: string; code: string; badges: string; level: number; levelName: string; approved: boolean; confidence: number };
export type PassportDomain = { label: string; tone: string; items: PassportSkill[] };
export type PassportCredential = { title: string; kind: string; date: string; code: string; level?: string | null };
export type PassportData = {
  lang: Lang; name: string; headline: string; meta: string; publicId: string; url: string; qrText: string; issuedAt: string; sharePublic: boolean;
  kpis: { skills: number; strong: number; approved: number; credentials: number };
  domains: PassportDomain[]; credentials: PassportCredential[]; footer: string; verifyHint: string;
};
export type PassportPage = { data: PassportData; index: number; total: number; domains: PassportDomain[]; credentials: PassportCredential[]; cover: boolean };

export type PassportInput = {
  profile: { public_id: string; display_name?: string | null; headline?: string | null; city?: string | null; organization?: string | null; share_mode?: string | null };
  email?: string | null; levels: SkillLevelRow[]; skills: Map<string, Skill> | Skill[]; credentials: Credential[]; site: string; lang: Lang; now?: Date;
};
const toMap = (s: Map<string, Skill> | Skill[]) => (s instanceof Map ? s : new Map(s.map(x => [x.id, x])));
export const fmtDay = (d: Date | string, lang: Lang) => new Date(d).toLocaleDateString(lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

/** يبني بيانات الجواز: مهارات مجمّعة بالمجال ومرتّبة بالمستوى، شهادات سارية، مؤشرات، رابط التحقق */
export function buildPassport(inp: PassportInput): PassportData {
  const { profile, lang } = inp; const now = inp.now || new Date(); const skills = toMap(inp.skills); const site = inp.site.replace(/\/+$/, '');
  const levels = inp.levels.filter(l => skills.has(l.skill_id));
  const domains: PassportDomain[] = DOMAINS.map(d => ({
    label: domainLabel(d.value, lang), tone: d.tone,
    items: levels.filter(l => skills.get(l.skill_id)!.domain === d.value).map(l => { const s = skills.get(l.skill_id)!; const lv = displayLevel(l); return { name: skillName(s, lang), code: s.code, badges: frameworkBadges(s).map(b => b.label).join(' · '), level: lv, levelName: levelName(lv, lang), approved: !!l.approved_level, confidence: l.confidence }; }).sort((a, b) => b.level - a.level || b.confidence - a.confidence),
  })).filter(d => d.items.length);
  const credentials: PassportCredential[] = inp.credentials.filter(c => credentialStatus(c, now) === 'valid').sort((a, b) => b.issued_at.localeCompare(a.issued_at)).map(c => ({ title: (lang === 'en' && c.title_en) ? c.title_en : c.title_ar, kind: credentialKindLabel(c.kind, lang), date: fmtDay(c.issued_at, lang), code: c.verify_code, level: c.level }));
  const sharePublic = profile.share_mode === 'public' || profile.share_mode === 'link'; const url = `${site}/p/${profile.public_id}`;
  const ar = lang === 'ar';
  return {
    lang, name: profile.display_name || inp.email || (ar ? 'متعلم في أَثَر' : 'Athar learner'), headline: profile.headline || '', meta: [profile.organization, profile.city].filter(Boolean).join(' · '),
    publicId: profile.public_id, url, qrText: sharePublic ? url : `${site}/me/skills`, issuedAt: fmtDay(now, lang), sharePublic,
    kpis: { skills: levels.length, strong: levels.filter(l => l.confidence >= 70).length, approved: levels.filter(l => l.approved_level).length, credentials: credentials.length },
    domains, credentials,
    footer: ar ? `صادر إلكترونيًا من بوابة أَثَر بتاريخ ${fmtDay(now, 'ar')} · © ${BRAND.copyrightYear} ${BRAND.owner.ar}` : `Issued electronically by Athar · TRACE on ${fmtDay(now, 'en')} · © ${BRAND.copyrightYear} ${BRAND.owner.en}`,
    verifyHint: sharePublic ? (ar ? 'امسح الرمز لعرض الملف المهاري الحي والتحقق من الشهادات.' : 'Scan to open the live skills profile and verify credentials.') : (ar ? 'الملف خاص؛ تحقق من كل شهادة عبر رمزها في athar-portal.vercel.app/credential' : 'Profile is private; verify each credential by its code at athar-portal.vercel.app/credential'),
  };
}
/** تقسيم الصفحات: الغلاف يحمل حتى 14 مهارة، وكل صفحة تالية حتى 26 مهارة أو 18 شهادة */
export function paginate(d: PassportData, coverRows = 14, pageRows = 26): PassportPage[] {
  const pages: Omit<PassportPage, 'index' | 'total'>[] = [];
  let cur: PassportDomain[] = []; let used = 0; let cap = coverRows; let cover = true;
  const flush = () => { pages.push({ data: d, domains: cur, credentials: [], cover }); cur = []; used = 0; cap = pageRows; cover = false; };
  for (const dom of d.domains) {
    let items = [...dom.items];
    while (items.length) {
      const room = cap - used - 1; // سطر لعنوان المجال
      if (room < 2) { flush(); continue; }
      const take = items.slice(0, room); items = items.slice(room); cur.push({ ...dom, items: take }); used += take.length + 1;
    }
  }
  if (cur.length || !pages.length) flush();
  const creds = [...d.credentials]; const credCap = 18;
  if (creds.length) { const roomOnLast = pages[pages.length - 1].domains.reduce((a, x) => a + x.items.length + 1, 0) <= (pages.length === 1 ? coverRows : pageRows) - 6; if (roomOnLast && creds.length <= 6) pages[pages.length - 1].credentials = creds.splice(0); while (creds.length) pages.push({ data: d, domains: [], credentials: creds.splice(0, credCap), cover: false }); }
  return pages.map((p, i) => ({ ...p, index: i + 1, total: pages.length }));
}
export function passportFilename(d: PassportData): string { const base = (d.name || 'athar').replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); return `athar-skills-passport-${base || d.publicId}.pdf`; }

// ---------- الرسم ----------
export const PW = 1754, PH = 2480; // A4 عمودي ~150dpi
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b', INK = '#0f172a', MUTED = '#64748b', LINE = '#e2e8f0', SOFT = '#f8fafc';
const TONE: Record<string, string> = { navy: NAVY, teal: TEAL, gold: GOLD, ok: '#047857', violet: '#6d28d9', sky: '#0284c7', warn: '#d97706', rose: '#be123c' };
function font(): string { if (typeof document === 'undefined') return 'Tajawal, Tahoma, Arial, sans-serif'; const f = getComputedStyle(document.body).fontFamily || ''; return f ? `${f}, Tajawal, Tahoma, Arial, sans-serif` : 'Tajawal, Tahoma, Arial, sans-serif'; }
function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size: number; weight?: number; color?: string; align?: CanvasTextAlign; dir?: 'rtl' | 'ltr'; maxW?: number }) {
  if (!s) return; ctx.save(); ctx.direction = o.dir || 'rtl'; ctx.textAlign = o.align || 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || INK; let size = o.size;
  ctx.font = `${o.weight || 400} ${size}px ${font()}`; if (o.maxW) { while (size > 18 && ctx.measureText(s).width > o.maxW) { size -= 2; ctx.font = `${o.weight || 400} ${size}px ${font()}`; } if (ctx.measureText(s).width > o.maxW) { while (s.length > 3 && ctx.measureText(s + '…').width > o.maxW) s = s.slice(0, -1); s += '…'; } }
  ctx.fillText(s, x, y); ctx.restore();
}
function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke?: string) { ctx.save(); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } ctx.restore(); }
function dots(ctx: CanvasRenderingContext2D, x: number, y: number, level: number, color = TEAL) { for (let i = 0; i < 5; i++) rrect(ctx, x + i * 34, y, 28, 14, 6, i < level ? color : LINE); }

export async function renderPassportPage(canvas: HTMLCanvasElement, p: PassportPage): Promise<void> {
  canvas.width = PW; canvas.height = PH; const ctx = canvas.getContext('2d')!; const d = p.data; const ar = d.lang === 'ar'; const R = PW - 90, L = 90; const dir = ar ? 'rtl' : 'ltr'; const X = ar ? R : L; const align: CanvasTextAlign = ar ? 'right' : 'left'; const X2 = ar ? L : R; const align2: CanvasTextAlign = ar ? 'left' : 'right';
  if (typeof document !== 'undefined' && document.fonts) { try { await document.fonts.ready; } catch { /* ignore */ } }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, PW, PH);
  // الرأس
  const headH = p.cover ? 420 : 170; ctx.fillStyle = NAVY; ctx.fillRect(0, 0, PW, headH); ctx.fillStyle = GOLD; ctx.fillRect(0, headH, PW, 8);
  txt(ctx, ar ? 'بوابة أَثَر · Athar · TRACE' : 'Athar · TRACE — Education, Training & Development Portal', X, 70, { size: 26, weight: 800, color: GOLD, align, dir });
  txt(ctx, ar ? 'جواز المهارات' : 'Skills Passport', X, p.cover ? 150 : 128, { size: p.cover ? 74 : 44, weight: 900, color: '#fff', align, dir });
  if (!p.cover) txt(ctx, d.name, X2, 128, { size: 30, weight: 700, color: 'rgba(255,255,255,.85)', align: align2, dir, maxW: 700 });
  if (p.cover) {
    txt(ctx, ar ? 'ملف مهاري موثّق بالأدلة — مربوط بالأطر المرجعية SAQF · SDAIA · CEFR' : 'Evidence-based skills profile — mapped to SAQF · SDAIA · CEFR', X, 205, { size: 26, weight: 500, color: 'rgba(255,255,255,.85)', align, dir });
    txt(ctx, d.name, X, 290, { size: 56, weight: 900, color: '#fff', align, dir, maxW: 1150 });
    txt(ctx, [d.headline, d.meta].filter(Boolean).join(' · '), X, 345, { size: 28, color: 'rgba(255,255,255,.85)', align, dir, maxW: 1150 });
    txt(ctx, `${ar ? 'المعرّف' : 'ID'}: ${d.publicId.toUpperCase()} · ${ar ? 'تاريخ الإصدار' : 'Issued'}: ${d.issuedAt}`, X, 395, { size: 24, color: GOLD, align, dir });
    // QR
    const qx = ar ? L : R - 250; rrect(ctx, qx - 14, 86, 278, 278, 18, '#fff'); drawQr(ctx, d.qrText, qx, 100, 250, 'M', NAVY);
    // مؤشرات
    const kp = [[d.kpis.skills, ar ? 'مهارة بأدلة' : 'skills with evidence'], [d.kpis.strong, ar ? 'بأدلة قوية' : 'strong evidence'], [d.kpis.approved, ar ? 'معتمدة' : 'approved'], [d.kpis.credentials, ar ? 'شهادة رقمية' : 'credentials']] as const;
    const bw = (PW - 180 - 3 * 24) / 4; kp.forEach(([n, label], i) => { const bx = L + i * (bw + 24); rrect(ctx, bx, 470, bw, 150, 20, SOFT, LINE); txt(ctx, String(n), bx + bw / 2, 545, { size: 54, weight: 900, color: NAVY, align: 'center', dir: 'ltr' }); txt(ctx, label, bx + bw / 2, 592, { size: 22, color: MUTED, align: 'center', dir }); });
  }
  // المهارات
  let y = p.cover ? 690 : 240; const rowH = 62;
  if (p.domains.length) {
    txt(ctx, ar ? 'خريطة المهارات' : 'Skills map', X, y, { size: 34, weight: 900, color: NAVY, align, dir }); txt(ctx, ar ? 'المستوى من 5 · «معتمد» = أقرّه مدرب أو الإدارة' : 'Level out of 5 · “approved” = confirmed by a trainer or admin', X2, y, { size: 20, color: MUTED, align: align2, dir }); y += 30;
    for (const dom of p.domains) {
      y += 30; ctx.fillStyle = TONE[dom.tone] || NAVY; ctx.beginPath(); ctx.arc(ar ? R - 12 : L + 12, y - 10, 10, 0, Math.PI * 2); ctx.fill(); txt(ctx, `${dom.label} (${dom.items.length})`, ar ? R - 34 : L + 34, y, { size: 27, weight: 800, color: INK, align, dir }); y += 14;
      for (const it of dom.items) {
        rrect(ctx, L, y, PW - 180, rowH - 8, 14, '#fff', LINE);
        txt(ctx, it.name, ar ? R - 22 : L + 22, y + 26, { size: 24, weight: 700, align, dir, maxW: 820 });
        txt(ctx, `${it.code}${it.badges ? ' · ' + it.badges : ''}`, ar ? R - 22 : L + 22, y + 48, { size: 17, color: MUTED, align, dir: 'ltr' });
        const dx = ar ? L + 40 : R - 40 - 5 * 34; dots(ctx, dx, y + 14, it.level, it.approved ? '#047857' : TEAL);
        txt(ctx, `${it.level}/5 · ${it.levelName}${it.approved ? (ar ? ' · معتمد ✓' : ' · approved ✓') : ''}`, ar ? L + 40 : R - 40, y + 48, { size: 17, weight: 800, color: it.approved ? '#047857' : NAVY, align: ar ? 'left' : 'right', dir });
        y += rowH;
      }
    }
  }
  // الشهادات
  if (p.credentials.length) {
    y += 40; txt(ctx, ar ? 'الشهادات الرقمية (قابلة للتحقق)' : 'Digital credentials (verifiable)', X, y, { size: 34, weight: 900, color: NAVY, align, dir }); y += 24;
    for (const c of p.credentials) { rrect(ctx, L, y, PW - 180, 70, 14, '#fdf6e3'); txt(ctx, c.title, ar ? R - 22 : L + 22, y + 30, { size: 24, weight: 700, align, dir, maxW: 900 }); txt(ctx, `${c.kind}${c.level ? ' · ' + c.level : ''} · ${c.date}`, ar ? R - 22 : L + 22, y + 56, { size: 17, color: MUTED, align, dir }); txt(ctx, c.code, ar ? L + 22 : R - 22, y + 44, { size: 24, weight: 900, color: TEAL, align: ar ? 'left' : 'right', dir: 'ltr' }); y += 82; }
  }
  // التذييل
  ctx.fillStyle = SOFT; ctx.fillRect(0, PH - 150, PW, 150); ctx.fillStyle = LINE; ctx.fillRect(0, PH - 150, PW, 2);
  txt(ctx, d.footer, X, PH - 95, { size: 20, color: MUTED, align, dir, maxW: 1300 }); txt(ctx, d.verifyHint, X, PH - 60, { size: 19, color: MUTED, align, dir, maxW: 1300 });
  txt(ctx, `${d.url}  ·  ${p.index}/${p.total}`, X2, PH - 78, { size: 19, weight: 700, color: NAVY, align: align2, dir: 'ltr' });
}

/** PDF عمودي متعدد الصفحات (صورة JPEG لكل صفحة) */
export function jpegsToPortraitPdf(pages: { jpeg: Uint8Array; w: number; h: number }[], title = 'Skills Passport'): Uint8Array {
  const PWp = 595.28, PHp = 841.89; const enc = new TextEncoder(); const chunks: Uint8Array[] = []; const offsets: number[] = []; let pos = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); pos += b.length; };
  const obj = (n: number, body: string, stream?: Uint8Array) => { offsets[n] = pos; push(`${n} 0 obj\n${body}\n`); if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); } push('endobj\n'); };
  let hex = 'FEFF'; for (const ch of title) hex += ch.codePointAt(0)!.toString(16).padStart(4, '0');
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'); const n = pages.length; const total = 3 + n * 3;
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ')}] /Count ${n} >>`);
  obj(3, `<< /Title <${hex}> /Producer (Athar Portal) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  pages.forEach((p, i) => { const pn = 4 + i * 3; const content = enc.encode(`q ${PWp.toFixed(2)} 0 0 ${PHp.toFixed(2)} 0 0 cm /Im${i} Do Q`);
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PWp} ${PHp}] /Resources << /XObject << /Im${i} ${pn + 2} 0 R >> >> /Contents ${pn + 1} 0 R >>`); obj(pn + 1, `<< /Length ${content.length} >>`, content);
    obj(pn + 2, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg); });
  const xref = pos; let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`; for (let i = 1; i <= total; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`; push(x);
  const out = new Uint8Array(pos); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; } return out;
}
/** يرسم كل الصفحات ويُنزّل PDF — للمتصفح فقط */
export async function downloadPassport(d: PassportData): Promise<number> {
  const pages = paginate(d); const canvas = document.createElement('canvas'); const out: { jpeg: Uint8Array; w: number; h: number }[] = [];
  for (const p of pages) { await renderPassportPage(canvas, p); out.push({ jpeg: canvasToJpeg(canvas, 0.92), w: PW, h: PH }); }
  const pdf = jpegsToPortraitPdf(out, d.lang === 'ar' ? `جواز المهارات — ${d.name}` : `Skills Passport — ${d.name}`);
  const ab = new ArrayBuffer(pdf.byteLength); new Uint8Array(ab).set(pdf); const url = URL.createObjectURL(new Blob([ab], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = passportFilename(d); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  return pages.length;
}
