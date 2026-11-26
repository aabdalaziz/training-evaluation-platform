// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P82 */
/**
 * كاشف الرموز في المتصفّح: BarcodeDetector الأصلي (QR · Code128 · PDF417 · EAN · Data Matrix …) إن وُجد،
 *  وإلا jsQR المُضمَّن (QR فقط) عبر canvas. كلّه على الجهاز — لا تُرسل أيّ صورة إلى الخادم.
 */
export type Detector = { engine: 'native' | 'jsqr'; formats: string[]; detect: (src: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | ImageBitmap) => Promise<string | null> };

const NATIVE_FORMATS = ['qr_code', 'code_128', 'code_39', 'pdf417', 'data_matrix', 'ean_13', 'ean_8', 'itf', 'aztec'];

export async function createDetector(): Promise<Detector> {
  const BD = (typeof window !== 'undefined' ? (window as any).BarcodeDetector : null) as any;
  if (BD) {
    try {
      const supported: string[] = typeof BD.getSupportedFormats === 'function' ? await BD.getSupportedFormats() : NATIVE_FORMATS;
      const formats = NATIVE_FORMATS.filter((f) => supported.includes(f));
      if (formats.includes('qr_code')) {
        const d = new BD({ formats });
        return { engine: 'native', formats, detect: async (src) => { try { const r = await d.detect(src as any); const hit = Array.isArray(r) ? r.find((x: any) => x?.rawValue) : null; return hit ? String(hit.rawValue) : null; } catch { return null; } } };
      }
    } catch { /* نسقط إلى jsQR */ }
  }
  const mod = await import('./vendor/jsQR.js'); const jsQR = (mod as any).default || mod;
  let canvas: HTMLCanvasElement | null = null;
  return {
    engine: 'jsqr', formats: ['qr_code'],
    detect: async (src) => {
      const w = (src as any).videoWidth || (src as any).naturalWidth || (src as any).width || 0; const h = (src as any).videoHeight || (src as any).naturalHeight || (src as any).height || 0; if (!w || !h) return null;
      const scale = Math.min(1, 800 / Math.max(w, h)); const cw = Math.round(w * scale), ch = Math.round(h * scale);
      canvas = canvas || document.createElement('canvas'); canvas.width = cw; canvas.height = ch; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) return null;
      ctx.drawImage(src as any, 0, 0, cw, ch); const img = ctx.getImageData(0, 0, cw, ch);
      const r = jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' }); return r?.data ? String(r.data) : null;
    },
  };
}

/** يحمّل ملفّ صورة إلى عنصر <img> لقراءته (بديل الكاميرا). */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const img = new Image(); img.onload = () => { res(img); setTimeout(() => URL.revokeObjectURL(url), 1000); }; img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('bad image')); }; img.src = url; });
}
