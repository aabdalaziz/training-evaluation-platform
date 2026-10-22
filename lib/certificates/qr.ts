/**
 * مولّد رموز QR خفيف بلا اعتماديات (وضع البايت، تصحيح أخطاء L/M/Q/H، الإصدارات 1–40).
 * مبني على خوارزمية ISO/IEC 18004 (بنية مماثلة لـ qrcodegen لـ Nayuki، رخصة MIT).
 * الاستخدام: const m = qrMatrix('https://…'); m.size, m.get(x, y) → true = وحدة داكنة.
 */

export type Ecc = 'L' | 'M' | 'Q' | 'H';
export type QrMatrix = { size: number; version: number; mask: number; modules: boolean[][]; get: (x: number, y: number) => boolean };

const ECC_INDEX: Record<Ecc, number> = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS: Record<Ecc, number> = { L: 1, M: 0, Q: 3, H: 2 };

const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function numRawDataModules(ver: number): number {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const a = Math.floor(ver / 7) + 2; r -= (25 * a - 10) * a - 55; if (ver >= 7) r -= 36; }
  return r;
}
function numDataCodewords(ver: number, ecc: Ecc): number {
  const e = ECC_INDEX[ecc];
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
}
function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2, size = ver * 4 + 17;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let i = 0, pos = size - 7; i < n - 1; i++, pos -= step) out.splice(1, 0, pos);
  return out;
}

/* ---------- Reed–Solomon over GF(256), polynomial 0x11D ---------- */
function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function rsDivisor(degree: number): number[] {
  const r = new Array<number>(degree).fill(0); r[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) { r[j] = gfMul(r[j], root); if (j + 1 < degree) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data: number[], divisor: number[]): number[] {
  const r = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const f = b ^ (r.shift() as number); r.push(0);
    for (let i = 0; i < divisor.length; i++) r[i] ^= gfMul(divisor[i], f);
  }
  return r;
}

/* ---------- bit buffer / segment ---------- */
function utf8Bytes(s: string): number[] { return Array.from(new TextEncoder().encode(s)); }
function appendBits(buf: number[], val: number, len: number) { for (let i = len - 1; i >= 0; i--) buf.push((val >>> i) & 1); }
function byteModeBits(bytes: number[], ver: number): number { return 4 + (ver < 10 ? 8 : 16) + bytes.length * 8; }

/* ---------- main ---------- */
export function qrMatrix(text: string, ecc: Ecc = 'M', forceMask = -1, minVersion = 1): QrMatrix {
  const bytes = utf8Bytes(text);
  let ver = Math.max(1, minVersion);
  for (; ver <= 40; ver++) if (byteModeBits(bytes, ver) <= numDataCodewords(ver, ecc) * 8) break;
  if (ver > 40) throw new Error('QR: النص أطول من السعة القصوى');
  // boost ECC when it fits for free
  for (const e of ['H', 'Q', 'M'] as Ecc[]) { if (ECC_INDEX[e] > ECC_INDEX[ecc] && byteModeBits(bytes, ver) <= numDataCodewords(ver, e) * 8) { ecc = e; break; } }

  const capBits = numDataCodewords(ver, ecc) * 8;
  const bits: number[] = [];
  appendBits(bits, 0x4, 4); appendBits(bits, bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) appendBits(bits, b, 8);
  appendBits(bits, 0, Math.min(4, capBits - bits.length));
  appendBits(bits, 0, (8 - bits.length % 8) % 8);
  for (let pad = 0xec; bits.length < capBits; pad ^= 0xec ^ 0x11) appendBits(bits, pad, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }

  // ECC + interleave
  const e = ECC_INDEX[ecc], numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver], blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCw = Math.floor(numRawDataModules(ver) / 8), numShort = numBlocks - rawCw % numBlocks, shortLen = Math.floor(rawCw / numBlocks);
  const blocks: number[][] = []; const divisor = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const datLen = shortLen - blockEccLen + (i < numShort ? 0 : 1);
    const dat = data.slice(k, k + datLen); k += datLen;
    const eccw = rsRemainder(dat, divisor);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(eccw));
  }
  const all: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) for (let j = 0; j < blocks.length; j++) if (!(i === shortLen - blockEccLen && j < numShort)) all.push(blocks[j][i]);

  // matrix
  const size = ver * 4 + 17;
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const isFn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const setFn = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; isFn[y][x] = true; };

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const ap = alignmentPositions(ver);
  for (let i = 0; i < ap.length; i++) for (let j = 0; j < ap.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === ap.length - 1) || (i === ap.length - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const drawFormat = (mask: number) => {
    const dataBits = (ECC_FORMAT_BITS[ecc] << 3) | mask; let rem = dataBits;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fb = ((dataBits << 10) | rem) ^ 0x5412; const bit = (i: number) => ((fb >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const vb = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const b = ((vb >>> i) & 1) !== 0, a = size - 11 + (i % 3), c = Math.floor(i / 3); setFn(a, c, b); setFn(c, a, b); }
  }
  // data placement
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!isFn[y][x] && bi < all.length * 8) { modules[y][x] = ((all[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
    }
  }
  const maskFn = (m: number, x: number, y: number) => {
    switch (m) {
      case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0; case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0; default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
    }
  };
  const applyMask = (m: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFn[y][x] && maskFn(m, x, y)) modules[y][x] = !modules[y][x]; };
  const penalty = (): number => {
    let p = 0; const N1 = 3, N2 = 3, N3 = 40, N4 = 10;
    const scanLine = (get: (i: number) => boolean) => {
      let run = 1; let s = 0;
      for (let i = 1; i < size; i++) { if (get(i) === get(i - 1)) { run++; if (run === 5) s += N1; else if (run > 5) s++; } else run = 1; }
      // finder-like 1:1:3:1:1 with 4 light modules on one side
      const line: number[] = []; for (let i = 0; i < size; i++) line.push(get(i) ? 1 : 0);
      const pat = [1, 0, 1, 1, 1, 0, 1];
      for (let i = 0; i + 7 <= size; i++) {
        let ok = true; for (let k = 0; k < 7; k++) if (line[i + k] !== pat[k]) { ok = false; break; }
        if (!ok) continue;
        const lightBefore = i >= 4 && line.slice(i - 4, i).every(v => v === 0);
        const lightAfter = i + 11 <= size && line.slice(i + 7, i + 11).every(v => v === 0);
        if (lightBefore || lightAfter) s += N3;
      }
      return s;
    };
    for (let y = 0; y < size; y++) p += scanLine(i => modules[y][i]);
    for (let x = 0; x < size; x++) p += scanLine(i => modules[i][x]);
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = modules[y][x]; if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) p += N2; }
    let dark = 0; for (const row of modules) for (const c of row) if (c) dark++;
    const total = size * size; const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1; p += k * N4;
    return p;
  };
  let mask = forceMask;
  if (mask < 0) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const s = penalty(); if (s < best) { best = s; mask = m; } applyMask(m); }
  }
  applyMask(mask); drawFormat(mask);
  return { size, version: ver, mask, modules, get: (x, y) => !!(modules[y] && modules[y][x]) };
}

/** SVG جاهز للعرض (بإطار هادئ quiet zone = 2 وحدة). */
export function qrSvg(text: string, px = 160, ecc: Ecc = 'M', dark = '#0f2a4e'): string {
  const m = qrMatrix(text, ecc); const q = 2, n = m.size + q * 2;
  let d = '';
  for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(x, y)) d += `M${x + q} ${y + q}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" width="${px}" height="${px}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${d}" fill="${dark}"/></svg>`;
}

/** رسم على Canvas (للشهادات). */
export function drawQr(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sizePx: number, ecc: Ecc = 'M', dark = '#0f2a4e'): void {
  const m = qrMatrix(text, ecc); const q = 2, n = m.size + q * 2, cell = sizePx / n;
  ctx.save(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, sizePx, sizePx); ctx.fillStyle = dark;
  for (let yy = 0; yy < m.size; yy++) for (let xx = 0; xx < m.size; xx++) if (m.get(xx, yy)) ctx.fillRect(x + (xx + q) * cell, y + (yy + q) * cell, cell + 0.4, cell + 0.4);
  ctx.restore();
}
