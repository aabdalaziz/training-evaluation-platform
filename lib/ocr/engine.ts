// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82-ج */
/**
 * OCR على الجهاز — Tesseract.js (عربي + إنجليزي). الشيفرة تُحمَّل من jsDelivr وبيانات اللغة من tessdata (الإصداران مثبَّتان)،
 *  ويمكن الاستضافة الذاتية لاحقًا بوضع الملفّات تحت /public/ocr وتعيين NEXT_PUBLIC_OCR_BASE=/ocr (يتوقّع: tesseract.min.js · worker.min.js ·
 *  tesseract-core-*-lstm.wasm.js · lang/{ara,eng}.traineddata.gz). CSP تسمح بالمصدرين (next.config). الصورة لا تغادر المتصفّح أبدًا — ما يُحمَّل هو المحرّك فقط.
 *  أوّل تشغيل يحمّل ≈ 6–7 م.ب ثمّ تُخزَّن بيانات اللغة في IndexedDB.
 *  recognize(file|canvas) → { text, lines[] } بعد معالجة أوّلية (تصغير ≤ 1800px · رمادي · تباين) تحسّن قراءة العربية المطبوعة.
 */
export type OcrLine = { text: string; confidence: number };
export type OcrResult = { text: string; lines: OcrLine[]; confidence: number; ms: number };
export type OcrProgress = { status: string; progress: number; label_ar: string };

export const OCR_VERSIONS = { js: '6.0.1', core: '6.0.0', tessdata: '4.0.0_fast' } as const;
const SELF_BASE = (typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_OCR_BASE : '') || '';
/** مسارات المحرّك: ذاتية إن عُيّن NEXT_PUBLIC_OCR_BASE وإلا jsDelivr/tessdata. */
export function ocrPaths(selfBase: string = SELF_BASE) {
  const b = selfBase.replace(/\/$/, '');
  if (b) return { script: `${b}/tesseract.min.js`, workerPath: `${b}/worker.min.js`, corePath: b, langPath: `${b}/lang` };
  return { script: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSIONS.js}/dist/tesseract.min.js`, workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${OCR_VERSIONS.js}/dist/worker.min.js`, corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${OCR_VERSIONS.core}`, langPath: `https://tessdata.projectnaptha.com/${OCR_VERSIONS.tessdata}` };
}
export const OCR_HOSTS = ['https://cdn.jsdelivr.net', 'https://tessdata.projectnaptha.com'];
const P = ocrPaths();
const STATUS_AR: Record<string, string> = { 'loading tesseract core': 'تحميل محرّك القراءة', 'initializing tesseract': 'تهيئة المحرّك', 'loading language traineddata': 'تحميل بيانات اللغة', 'initializing api': 'تهيئة القارئ', 'recognizing text': 'قراءة النصّ', 'loaded language traineddata': 'بيانات اللغة جاهزة', 'initialized api': 'القارئ جاهز' };

let scriptP: Promise<any> | null = null;
function loadTesseract(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('browser only'));
  const w = window as any; if (w.Tesseract) return Promise.resolve(w.Tesseract);
  if (!scriptP) scriptP = new Promise((res, rej) => { const s = document.createElement('script'); s.src = P.script; s.crossOrigin = 'anonymous'; s.async = true; s.onload = () => (w.Tesseract ? res(w.Tesseract) : rej(new Error('Tesseract missing'))); s.onerror = () => { scriptP = null; rej(new Error('تعذّر تحميل محرّك القراءة')); }; document.head.appendChild(s); });
  return scriptP;
}

let workerP: Promise<any> | null = null; let workerLangs = '';
/** عامل واحد مُعاد الاستخدام لكلّ الصفحة (ara+eng افتراضيًّا). */
export async function getWorker(langs = 'ara+eng', onProgress?: (p: OcrProgress) => void): Promise<any> {
  const T = await loadTesseract();
  if (workerP && workerLangs === langs) return workerP;
  if (workerP) { try { (await workerP).terminate(); } catch { /* لا شيء */ } }
  workerLangs = langs;
  workerP = T.createWorker(langs, 1, { workerPath: P.workerPath, corePath: P.corePath, langPath: P.langPath, gzip: true, workerBlobURL: true, logger: (m: any) => { if (onProgress && m?.status) onProgress({ status: m.status, progress: Number(m.progress || 0), label_ar: STATUS_AR[m.status] || m.status }); } });
  return workerP;
}
export async function disposeWorker() { if (workerP) { try { (await workerP).terminate(); } catch { /* لا شيء */ } workerP = null; workerLangs = ''; } }

/** معالجة أوّلية: تصغير · رمادي · تمديد تباين بسيط. تعيد canvas. */
export async function preprocess(src: File | Blob | HTMLImageElement | HTMLCanvasElement, maxPx = 1800): Promise<HTMLCanvasElement> {
  let img: HTMLImageElement | HTMLCanvasElement;
  if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) img = src; else { img = await new Promise<HTMLImageElement>((res, rej) => { const u = URL.createObjectURL(src); const i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 500); }; i.onerror = () => rej(new Error('bad image')); i.src = u; }); }
  const w = (img as any).naturalWidth || img.width, h = (img as any).naturalHeight || img.height; const k = Math.min(1, maxPx / Math.max(w, h)); const cw = Math.max(1, Math.round(w * k)), ch = Math.max(1, Math.round(h * k));
  const c = document.createElement('canvas'); c.width = cw; c.height = ch; const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0, cw, ch);
  const d = x.getImageData(0, 0, cw, ch); const p = d.data; let lo = 255, hi = 0; const g = new Uint8ClampedArray(cw * ch);
  for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); g[j] = v; if (v < lo) lo = v; if (v > hi) hi = v; }
  const span = Math.max(1, hi - lo); for (let i = 0, j = 0; i < p.length; i += 4, j++) { const v = Math.min(255, Math.max(0, Math.round(((g[j] - lo) * 255) / span))); p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255; }
  x.putImageData(d, 0, 0); return c;
}

export async function recognize(src: File | Blob | HTMLImageElement | HTMLCanvasElement, opts: { langs?: string; onProgress?: (p: OcrProgress) => void; pre?: boolean } = {}): Promise<OcrResult> {
  const t0 = Date.now(); const worker = await getWorker(opts.langs || 'ara+eng', opts.onProgress);
  const input = opts.pre === false ? src : await preprocess(src);
  const { data } = await worker.recognize(input, {}, { text: true, blocks: true }); /* v6: الأسطر تُشتقّ من blocks */
  const fromBlocks: OcrLine[] = []; for (const b of data?.blocks || []) for (const pg of b?.paragraphs || []) for (const l of pg?.lines || []) { const t = String(l.text || '').trim(); if (t) fromBlocks.push({ text: t, confidence: Number(l.confidence || 0) }); }
  const legacy: OcrLine[] = Array.isArray(data?.lines) ? data.lines.map((l: any) => ({ text: String(l.text || '').trim(), confidence: Number(l.confidence || 0) })).filter((l: OcrLine) => l.text) : [];
  const lines: OcrLine[] = fromBlocks.length ? fromBlocks : legacy.length ? legacy : String(data?.text || '').split('\n').map((t: string) => t.trim()).filter(Boolean).map((t: string) => ({ text: t, confidence: Number(data?.confidence || 0) }));
  return { text: String(data?.text || ''), lines, confidence: Number(data?.confidence || 0), ms: Date.now() - t0 };
}
