/**
 * رسم الشهادات على Canvas (يدعم العربية بتشكيل المتصفح الأصلي) وتحويلها إلى PDF بلا اعتماديات.
 * - renderCertificate(canvas, data, settings)  → يرسم شهادة A4 أفقية (2480×1754 بكسل ≈ 300dpi)
 * - canvasToJpeg(canvas)                         → بايتات JPEG
 * - jpegsToPdf(pages, title)                     → ملف PDF متعدد الصفحات (صفحة لكل شهادة)
 */
import { drawQr } from './qr';

export type CertKind = 'completion' | 'attendance' | 'appreciation';
export type CertSettings = {
  issuer_ar: string; issuer_en: string; unit_ar: string; unit_en: string;
  sign1_name: string; sign1_title: string; sign2_name: string; sign2_title: string;
  serial_prefix: string; default_hours: number; city_ar: string; show_en: boolean; footer_ar: string;
};
export type CertData = {
  kind: CertKind; recipient_name: string; recipient_name_en?: string | null;
  program_ar: string; program_en?: string | null; classroom?: string | null; trainer?: string | null;
  start?: string | null; end?: string | null; hours?: number | null; issued_at: string; serial: string; verify_url: string;
  award_title?: string | null; // للشهادات التقديرية: مثل «أفضل مدرب للشهر»
};

export const DEFAULT_SETTINGS: CertSettings = {
  issuer_ar: 'جامعة الأمير مقرن بن عبدالعزيز', issuer_en: 'Prince Mugrin University',
  unit_ar: 'بوابة التميز للاستشارات والتدريب', unit_en: 'CenterGate for Excellence — Consulting & Training',
  sign1_name: '', sign1_title: 'مدير البرامج التدريبية', sign2_name: '', sign2_title: 'المشرف العام',
  serial_prefix: 'UPM', default_hours: 20, city_ar: 'المدينة المنورة', show_en: true,
  footer_ar: 'هذه الشهادة صادرة إلكترونيًا ويمكن التحقق من صحتها عبر رمز الاستجابة السريعة أو الرقم التسلسلي.',
};

export const KIND_LABEL: Record<CertKind, { ar: string; en: string; verb_ar: string; verb_en: string }> = {
  completion: { ar: 'شهادة إتمام', en: 'Certificate of Completion', verb_ar: 'وذلك لإتمام البرنامج التدريبي', verb_en: 'for successfully completing the training program' },
  attendance: { ar: 'شهادة حضور', en: 'Certificate of Attendance', verb_ar: 'وذلك لحضور البرنامج التدريبي', verb_en: 'for attending the training program' },
  appreciation: { ar: 'شهادة شكر وتقدير', en: 'Certificate of Appreciation', verb_ar: 'تقديرًا للجهود المتميزة والأداء الرفيع في تنفيذ برنامج', verb_en: 'in recognition of outstanding effort and performance in delivering' },
};

export const W = 2480, H = 1754;
const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#c9a24b', INK = '#1e293b', MUTED = '#64748b';

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
function loadImage(src: string): Promise<HTMLImageElement | null> {
  if (!imgCache.has(src)) imgCache.set(src, new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return imgCache.get(src)!;
}
function fontFamily(): string {
  if (typeof document === 'undefined') return 'Tajawal, Tahoma, Arial, sans-serif';
  const f = getComputedStyle(document.body).fontFamily || '';
  return f ? `${f}, Tajawal, Tahoma, Arial, sans-serif` : 'Tajawal, Tahoma, Arial, sans-serif';
}
export function fmtDate(ymd?: string | null): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.slice(0, 10).split('-'); return `${d}/${m}/${y}`;
}
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, weight: number, size: number, min = 28): number {
  let s = size;
  for (; s > min; s -= 2) { ctx.font = `${weight} ${s}px ${fontFamily()}`; if (ctx.measureText(text).width <= maxW) break; }
  ctx.font = `${weight} ${s}px ${fontFamily()}`; return s;
}
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean); const lines: string[] = []; let cur = '';
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } }
  if (cur) lines.push(cur); return lines;
}
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: { size: number; weight?: number; color?: string; align?: CanvasTextAlign; maxW?: number; dir?: 'rtl' | 'ltr'; min?: number }): number {
  ctx.save(); ctx.direction = o.dir || 'rtl'; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = o.color || INK;
  const size = o.maxW ? fitText(ctx, s, o.maxW, o.weight || 400, o.size, o.min) : (ctx.font = `${o.weight || 400} ${o.size}px ${fontFamily()}`, o.size);
  ctx.fillText(s, x, y); ctx.restore(); return size;
}
function paragraph(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, size: number, weight: number, color: string, lh = 1.6, dir: 'rtl' | 'ltr' = 'rtl'): number {
  ctx.save(); ctx.direction = dir; ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = `${weight} ${size}px ${fontFamily()}`;
  const lines = wrap(ctx, s, maxW); lines.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh)); ctx.restore();
  return y + (lines.length - 1) * size * lh;
}

export async function renderCertificate(canvas: HTMLCanvasElement, d: CertData, s: CertSettings): Promise<void> {
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  if (typeof document !== 'undefined' && document.fonts) { try { await document.fonts.ready; await Promise.all([400, 700, 800].map(w => document.fonts.load(`${w} 40px ${fontFamily().split(',')[0]}`))); } catch { /* ignore */ } }
  const [logoUpm, logoGate] = await Promise.all([loadImage('/logos/upm.png'), loadImage('/logos/gate.png')]);
  const K = KIND_LABEL[d.kind];

  /* background + frame */
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, H); grad.addColorStop(0, '#f8fafc'); grad.addColorStop(1, '#ffffff'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 16; ctx.strokeStyle = NAVY; ctx.strokeRect(56, 56, W - 112, H - 112);
  ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.strokeRect(92, 92, W - 184, H - 184);
  // corner ornaments
  ctx.fillStyle = GOLD;
  for (const [cx, cy] of [[92, 92], [W - 92, 92], [92, H - 92], [W - 92, H - 92]] as [number, number][]) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI / 4); ctx.fillRect(-26, -26, 52, 52); ctx.restore(); }
  // side ribbon
  ctx.fillStyle = NAVY; ctx.fillRect(W - 92 - 22, 92, 22, H - 184); ctx.fillStyle = TEAL; ctx.fillRect(92, 92, 22, H - 184);

  /* header: logos + issuer */
  const logoH = 150;
  if (logoUpm) { const w = logoUpm.width * (logoH / logoUpm.height); ctx.drawImage(logoUpm, W - 200 - w, 150, w, logoH); }
  if (logoGate) { const w = logoGate.width * (logoH / logoGate.height); ctx.drawImage(logoGate, 200, 150, w, logoH); }
  text(ctx, s.issuer_ar, W / 2, 205, { size: 50, weight: 800, color: NAVY, maxW: 1200 });
  text(ctx, s.unit_ar, W / 2, 262, { size: 34, weight: 700, color: TEAL, maxW: 1200 });
  if (s.show_en) text(ctx, `${s.issuer_en} · ${s.unit_en}`, W / 2, 306, { size: 24, weight: 400, color: MUTED, dir: 'ltr', maxW: 1300 });

  /* title */
  ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - 160, 352, 320, 5);
  text(ctx, K.ar, W / 2, 462, { size: 116, weight: 800, color: NAVY });
  if (s.show_en) text(ctx, K.en, W / 2, 552, { size: 40, weight: 700, color: TEAL, dir: 'ltr' });

  /* body */
  text(ctx, d.kind === 'appreciation' ? `تتقدم ${s.unit_ar} بخالص الشكر والتقدير إلى` : 'تُمنح هذه الشهادة إلى', W / 2, 640, { size: 42, weight: 400, color: INK, maxW: 1700 });
  const nameSize = text(ctx, d.recipient_name, W / 2, 760, { size: 104, weight: 800, color: TEAL, maxW: 1800, min: 56 });
  ctx.save(); ctx.font = `800 ${nameSize}px ${fontFamily()}`; const nw = Math.min(1800, ctx.measureText(d.recipient_name).width); ctx.restore();
  ctx.fillStyle = GOLD; ctx.fillRect(W / 2 - nw / 2 - 20, 790, nw + 40, 4);
  if (s.show_en && d.recipient_name_en) text(ctx, d.recipient_name_en, W / 2, 840, { size: 34, weight: 700, color: MUTED, dir: 'ltr', maxW: 1600 });
  let y = d.recipient_name_en && s.show_en ? 920 : 890;
  if (d.kind === 'appreciation' && d.award_title) { text(ctx, d.award_title, W / 2, y, { size: 48, weight: 800, color: NAVY, maxW: 1700 }); y += 70; }
  text(ctx, K.verb_ar, W / 2, y, { size: 40, weight: 400, color: INK, maxW: 1800 }); y += 96;
  const progSize = text(ctx, d.program_ar, W / 2, y, { size: 66, weight: 800, color: NAVY, maxW: 1900, min: 40 }); y += progSize * 0.3;
  if (s.show_en && d.program_en) { y += 44; text(ctx, d.program_en, W / 2, y, { size: 30, weight: 700, color: MUTED, dir: 'ltr', maxW: 1700 }); }
  y += 74;
  const parts: string[] = [];
  if (d.start && d.end) parts.push(`المنفّذ خلال الفترة من ${fmtDate(d.start)} إلى ${fmtDate(d.end)}`);
  else if (d.start) parts.push(`بتاريخ ${fmtDate(d.start)}`);
  if (d.hours && d.kind !== 'appreciation') parts.push(`بواقع ${d.hours} ساعة تدريبية`);
  if (d.classroom) parts.push(`القاعة ${d.classroom}`);
  if (d.trainer && d.kind !== 'appreciation') parts.push(`بإشراف المدرب ${d.trainer}`);
  if (parts.length) y = paragraph(ctx, parts.join(' · '), W / 2, y, 1900, 34, 400, MUTED, 1.5) + 10;
  text(ctx, `متمنين لهم دوام التوفيق والنجاح`, W / 2, y + 60, { size: 32, weight: 400, color: INK });

  /* footer: signatures + QR + serial */
  const baseY = H - 330;
  const sig = (cx: number, name: string, title: string) => {
    ctx.fillStyle = NAVY; ctx.fillRect(cx - 220, baseY, 440, 3);
    if (name) text(ctx, name, cx, baseY + 56, { size: 36, weight: 800, color: NAVY, maxW: 460 });
    text(ctx, title, cx, baseY + (name ? 104 : 56), { size: 28, weight: 700, color: MUTED, maxW: 460 });
  };
  sig(W - 480, s.sign1_name, s.sign1_title);
  sig(480, s.sign2_name, s.sign2_title);
  const qrSize = 200, qx = W / 2 - qrSize / 2, qy = H - 475;
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 3; ctx.fillRect(qx - 14, qy - 14, qrSize + 28, qrSize + 28); ctx.strokeRect(qx - 14, qy - 14, qrSize + 28, qrSize + 28);
  drawQr(ctx, d.verify_url, qx, qy, qrSize, 'M', NAVY);
  text(ctx, `الرقم التسلسلي: ${d.serial}`, W / 2, qy + qrSize + 48, { size: 28, weight: 800, color: NAVY });
  text(ctx, `تاريخ الإصدار: ${fmtDate(d.issued_at)} · ${s.city_ar}`, W / 2, qy + qrSize + 84, { size: 26, weight: 400, color: MUTED });
  text(ctx, s.footer_ar, W / 2, H - 150, { size: 22, weight: 400, color: MUTED, maxW: 1900 });
}

/* ---------- JPEG / PDF ---------- */
export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.9): Uint8Array {
  const b64 = canvas.toDataURL('image/jpeg', quality).split(',')[1];
  const bin = atob(b64); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const enc = new TextEncoder();
function pdfString(s: string): string {
  // UTF-16BE with BOM, escaped as hex string
  let hex = 'FEFF'; for (const ch of s) { const c = ch.codePointAt(0)!; if (c > 0xffff) { const v = c - 0x10000; hex += (0xd800 + (v >> 10)).toString(16).padStart(4, '0') + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, '0'); } else hex += c.toString(16).padStart(4, '0'); }
  return `<${hex}>`;
}
/** PDF متعدد الصفحات: كل صفحة صورة JPEG تملأ A4 أفقية. */
export function jpegsToPdf(pages: { jpeg: Uint8Array; w: number; h: number }[], title = 'Certificates'): Uint8Array {
  const PW = 841.89, PH = 595.28;
  const chunks: Uint8Array[] = []; const offsets: number[] = []; let pos = 0;
  const push = (x: string | Uint8Array) => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); pos += b.length; };
  const obj = (n: number, body: string, stream?: Uint8Array) => {
    offsets[n] = pos; push(`${n} 0 obj\n${body}\n`);
    if (stream) { push(`stream\n`); push(stream); push(`\nendstream\n`); }
    push(`endobj\n`);
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const n = pages.length; const total = 3 + n * 3; // catalog, pages, info + (page, content, image) per page
  const kids = pages.map((_, i) => `${4 + i * 3} 0 R`).join(' ');
  obj(1, `<< /Type /Catalog /Pages 2 0 R >>`);
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  obj(3, `<< /Title ${pdfString(title)} /Producer (Training Evaluation Platform) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  pages.forEach((p, i) => {
    const pn = 4 + i * 3, cn = pn + 1, im = pn + 2;
    const content = enc.encode(`q ${PW.toFixed(2)} 0 0 ${PH.toFixed(2)} 0 0 cm /Im${i} Do Q`);
    obj(pn, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im${i} ${im} 0 R >> >> /Contents ${cn} 0 R >>`);
    obj(cn, `<< /Length ${content.length} >>`, content);
    obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>`, p.jpeg);
  });
  const xref = pos;
  let x = `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= total; i++) x += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  x += `trailer\n<< /Size ${total + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  push(x);
  const out = new Uint8Array(pos); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
export function bytesToBase64(bytes: Uint8Array): string {
  let s = ''; const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)));
  return btoa(s);
}
export function downloadBytes(filename: string, bytes: Uint8Array, mime = 'application/pdf'): void {
  const ab = new ArrayBuffer(bytes.byteLength); new Uint8Array(ab).set(bytes);
  const url = URL.createObjectURL(new Blob([ab], { type: mime }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export function cleanFilename(x: string): string { return x.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''); }
