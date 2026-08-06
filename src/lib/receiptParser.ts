/**
 * receiptParser.ts
 * Preprocesses receipt images with jimp (xerox effect) then runs Tesseract OCR.
 * Web: canvas preprocessing → Tesseract
 * Native: jimp preprocessing → Tesseract
 * Processed image is also returned as base64 for saving to R2.
 */

export interface ParsedItem {
  name: string;
  price: number;
}

export interface ParsedReceipt {
  items: ParsedItem[];
  detectedTotal: number | null;
  rawText: string;
  processedBase64?: string; // xerox-processed image for saving to R2
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Keywords that mean the line has no useful price (no amount to show)
const SKIP_KEYWORDS = [
  'receipt', 'invoice', 'thank you', 'thanks', 'welcome', 'please', 'come again',
  'address', 'tel', 'phone', 'fax', 'email', 'www', 'http',
  'tin', 'bir', 'vat reg', 'non-vat', 'pwdsc', 'senior',
  'date', 'time', 'transaction', 'ref', 'or no', 'official receipt',
  'qty', 'quantity', 'unit price', 'unit', 'description',
  'vatable', 'vat', 'tax', 'service charge', 'service fee',
  'varab', 'varabl', 'atable', 'atabl', 'watabl', 'watabte', // OCR misreads of vatable
  'cust', 'bus style', 'take-out', 'take out', 'dine in', 'dine-in',
  'reprint', 'cashier', 'sales invoice', 'sales', 'invoice',
  'min#', 'pos', 'si#', 'sn:', 'min ',
  'cash', 'change',
];

// Summary lines — always include with their price (Total, Cash, Change, etc.)
const SUMMARY_KEYWORDS = ['total due', 'total', 'subtotal', 'sub-total', 'amount due', 'grand total', 'balance due'];

// Matches a price at end of line — handles OCR artifacts: space-for-period, colon-for-period
const PRICE_PATTERN = /(?:[\u20b1PSUSD$£]+\s*)?(\d[\d$S,. ]*)\s*[.:]?\s*(\d{2})\s*[.:]?\s*$|(?:[\u20b1PSUSD$£]+\s*)?(\d[\d$S,.]*)\s*$/;

/** Fix OCR digit misreads */
function fixOcrDigits(s: string): string {
  // Fix space or colon used instead of decimal: "1,245 00" or "1,245:00" → "1,245.00"
  s = s.replace(/(\d)[\s:](\d{2})$/, '$1.$2');
  // Fix trailing colon/semicolon: "1,245.0:" → "1,245.00"
  s = s.replace(/(\d\.\d)[;:]$/, '$10');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '$') { out += '5'; }
    else if (c === 'S' && i > 0 && /[\d.]/.test(s[i - 1])) { out += '5'; }
    else if (c === 'O') { out += '0'; }
    else { out += c; }
  }
  return out;
}

function cleanPrice(raw: string): number {
  let s = fixOcrDigits(raw.trim()).replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  if (/,\d{2}$/.test(s) && !s.includes('.')) {
    s = s.replace(/,/g, '.');
  } else {
    s = s.replace(/,/g, '');
  }
  return parseFloat(s);
}

function extractPrice(line: string): number | null {
  // Strip leading OCR garbage and trailing non-numeric garbage
  const cleaned = line
    .replace(/^[^a-zA-Z\d]+/, '')
    .replace(/[\(\)\[\]{}|'`"]+\s*$/, '')
    .replace(/\s+[a-zA-Z]{1,2}\s*$/, '')
    .trim();
  // Match price with comma thousands separator: "1,245.00" or "1,245 00" or "1,245"
  const withComma = cleaned.match(/(\d{1,3}(?:,\d{3})+)(?:[.\s](\d{2}))?\s*$/);
  if (withComma) {
    const intPart = withComma[1].replace(/,/g, '');
    const decPart = withComma[2] ?? '00';
    const price = parseFloat(intPart + '.' + decPart);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  // Match simple decimal: "55.90" or "700.00"
  const simple = cleaned.match(/(\d+)[.\s](\d{2})\s*$/);
  if (simple) {
    const price = parseFloat(simple[1] + '.' + simple[2]);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  // Match plain number at end
  const plain = cleaned.match(/(\d[\d,.]*)\s*$/);
  if (!plain || !plain[1]) return null;
  const price = cleanPrice(plain[1]);
  if (isNaN(price) || price <= 0 || price > 999999) return null;
  return price;
}

function extractItemName(line: string): string {
  let name = line
    .replace(/^[^a-zA-Z\d]+/, '')  // strip leading OCR garbage like '| , 'A , Lo
    .replace(/(?:[\u20b1PSUSD$]+\s*)?\$?[\d][\d$S,.]*\s*[\(\)\[\]{}|'`"a-z]{0,3}\s*$/, '') // strip price + trailing garbage
    .replace(/\s{2,}/g, ' ')
    .trim();
  name = name.replace(/^[\d1lItT]+\s*[xX]\s*/i, '').replace(/^[xX]\s*[\d]+\s*/, '').trim();
  name = name.replace(/^\d+\s+(?=[A-Za-z])/, '').trim();
  name = name.replace(/[.\-_]+\s*$/, '').trim();
  return name;
}

function isSummaryLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return SUMMARY_KEYWORDS.some(kw => lower.startsWith(kw) || lower === kw);
}

/** Whole-word keyword check — prevents 'bir' matching 'birthday', 'tin' matching 'antine', etc. */
function hasSkipKeyword(lower: string): boolean {
  return SKIP_KEYWORDS.some(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(lower);
  });
}

function isValidItemLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return false;

  const price = extractPrice(trimmed);
  if (!price || price > 50000) return false;

  // Must have at least 2 consecutive letters (real word)
  if (!/[a-zA-Z]{2,}/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();

  // Skip keyword lines (whole-word match)
  if (hasSkipKeyword(lower)) return false;

  // Skip date lines: contain patterns like 07/12/2026 or 10:33
  if (/\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(trimmed)) return false;
  if (/\d{2}:\d{2}/.test(trimmed) && !/[a-zA-Z]{3,}/.test(trimmed)) return false;

  // Skip serial/reference codes: long alphanumeric strings
  const words = trimmed.split(/\s+/);
  const firstWord = words[0];
  if (/[A-Z0-9#\-:]{7,}/.test(firstWord)) return false;

  // Skip lines where price is suspiciously large (likely a serial number parsed as price)
  if (price > 9999 && !/[a-zA-Z]{4,}/.test(trimmed)) return false;

  // Skip subtotal lines: "N item(s)" or "N items" or OCR variants like "Ttea(s)"
  if (/^\d+\s+items?\b/i.test(trimmed)) return false;
  if (/iten|itea|item|ttea|ttem|\(s\)/i.test(lower)) return false;

  // Must have a meaningful name (at least 3 letters after stripping price)
  const name = extractItemName(trimmed);
  if (name.length < 3) return false;
  if (!/[a-zA-Z]{3,}/.test(name)) return false;

  // Skip lines that are mostly symbols/garbage (less than 40% letters)
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const total = trimmed.replace(/\s/g, '').length;
  if (total > 5 && letters / total < 0.25) return false;

  return true;
}

export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const items: ParsedItem[] = [];
  let detectedTotal: number | null = null;

  for (const line of lines) {
    if (isSummaryLine(line)) {
      const price = extractPrice(line);
      if (price) {
        if (!detectedTotal && line.toLowerCase().includes('total')) detectedTotal = price;
        const name = extractItemName(line) || line.split(/\s+/)[0];
        if (name.length >= 2) items.push({ name: escapeHtml(name), price });
      }
      continue;
    }
    if (!isValidItemLine(line)) continue;
    const price = extractPrice(line)!;
    const name = extractItemName(line);
    if (name.length >= 2) items.push({ name: escapeHtml(name), price });
  }

  return { items, detectedTotal, rawText: escapeHtml(rawText) };
}

// ── jimp xerox preprocessing (native + web fallback) ─────────────────────────
async function preprocessWithJimp(imageUri: string): Promise<{ uri: string; base64: string }> {
  // jimp ESM doesn't work with Metro dynamic import — use require
  let Jimp: any, JimpMime: any;
  try {
    const jimpModule = require('jimp');
    Jimp = jimpModule.Jimp;
    JimpMime = jimpModule.JimpMime;
    if (!Jimp?.fromBuffer) throw new Error('Jimp.fromBuffer not found');
  } catch (e) {
    throw new Error(`jimp load failed: ${e}`);
  }

  let buffer: ArrayBuffer;
  if (imageUri.startsWith('data:')) {
    const b64 = imageUri.split(',')[1];
    if (!b64) throw new Error('invalid data URI');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    buffer = bytes.buffer;
  } else {
    const res = await fetch(imageUri);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    buffer = await res.arrayBuffer();
  }
  console.log('[JIMP] buffer size:', buffer.byteLength);

  const img = await Jimp.fromBuffer(buffer);
  console.log('[JIMP] loaded:', img.width, 'x', img.height);

  // Upscale 2x + grayscale into new buffer
  const w = img.width, h = img.height;
  const nw = w * 2, nh = h * 2;
  const newData = new Uint8Array(nw * nh * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      const r = img.bitmap.data[srcIdx];
      const g = img.bitmap.data[srcIdx + 1];
      const b = img.bitmap.data[srcIdx + 2];
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const dstIdx = ((y * 2 + dy) * nw + (x * 2 + dx)) * 4;
          newData[dstIdx] = newData[dstIdx+1] = newData[dstIdx+2] = gray;
          newData[dstIdx+3] = 255;
        }
      }
    }
  }

  // Adaptive threshold
  const gray2 = new Uint8Array(nw * nh);
  for (let i = 0; i < nw * nh; i++) gray2[i] = newData[i * 4];

  const integral = new Float64Array((nw + 1) * (nh + 1));
  for (let y = 0; y < nh; y++)
    for (let x = 0; x < nw; x++)
      integral[(y+1)*(nw+1)+(x+1)] = gray2[y*nw+x] + integral[y*(nw+1)+(x+1)] + integral[(y+1)*(nw+1)+x] - integral[y*(nw+1)+x];

  const radius = Math.max(8, Math.round(nw / 16));
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const x1 = Math.max(0, x-radius), y1 = Math.max(0, y-radius);
      const x2 = Math.min(nw-1, x+radius), y2 = Math.min(nh-1, y+radius);
      const count = (x2-x1+1) * (y2-y1+1);
      const sum = integral[(y2+1)*(nw+1)+(x2+1)] - integral[y1*(nw+1)+(x2+1)] - integral[(y2+1)*(nw+1)+x1] + integral[y1*(nw+1)+x1];
      const val = gray2[y*nw+x] < (sum / count) - 10 ? 0 : 255;
      const idx = (y * nw + x) * 4;
      newData[idx] = newData[idx+1] = newData[idx+2] = val;
    }
  }

  // Write back to jimp and export
  img.bitmap.data = Buffer.from(newData) as any;
  img.bitmap.width = nw;
  img.bitmap.height = nh;

  const base64 = await img.getBase64(JimpMime.png);
  console.log('[JIMP] done, output length:', base64.length);
  return { uri: base64, base64 };
}

// ── Web canvas preprocessing (upscale 2x + adaptive threshold) ───────────────
async function preprocessForOcr(imageUri: string): Promise<HTMLCanvasElement | string> {
  if (typeof document === 'undefined') return imageUri;

  // Fetch remote URLs as blob to avoid CORS canvas taint
  let srcUri = imageUri;
  if (imageUri.startsWith('http')) {
    try {
      const res = await fetch(imageUri);
      const blob = await res.blob();
      srcUri = await new Promise<string>((r) => {
        const reader = new FileReader();
        reader.onload = () => r(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (_) {}
  }

  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const orientation = srcUri.startsWith('data:image/jpeg') ? getExifOrientation(srcUri) : 1;
      const swap = orientation >= 5;
      // Upscale 2x for better OCR
      const scale = Math.max(2, 2000 / (swap ? img.height : img.width));
      const srcW = Math.round(img.width * scale);
      const srcH = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = swap ? srcH : srcW;
      canvas.height = swap ? srcW : srcH;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      const rotMap: Record<number, number> = { 3: 180, 6: 90, 8: -90, 5: -90, 7: 90 };
      const flipMap: Record<number, boolean> = { 2: true, 4: true, 5: true, 7: true };
      if (flipMap[orientation]) ctx.scale(-1, 1);
      ctx.rotate(((rotMap[orientation] ?? 0) * Math.PI) / 180);
      ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
      ctx.restore();

      const w = canvas.width, h = canvas.height;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      // Step 1: grayscale
      const gray = new Uint8Array(w * h);
      for (let i = 0; i < data.length; i += 4) {
        gray[i >> 2] = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
      }

      // Step 2: adaptive threshold (local mean - 10)
      const integral = new Float64Array((w + 1) * (h + 1));
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          integral[(y+1)*(w+1)+(x+1)] = gray[y*w+x] + integral[y*(w+1)+(x+1)] + integral[(y+1)*(w+1)+x] - integral[y*(w+1)+x];

      const radius = Math.max(8, Math.round(w / 16));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x-radius), y1 = Math.max(0, y-radius);
          const x2 = Math.min(w-1, x+radius), y2 = Math.min(h-1, y+radius);
          const count = (x2-x1+1) * (y2-y1+1);
          const sum = integral[(y2+1)*(w+1)+(x2+1)] - integral[y1*(w+1)+(x2+1)] - integral[(y2+1)*(w+1)+x1] + integral[y1*(w+1)+x1];
          const val = gray[y*w+x] < (sum / count) - 15 ? 0 : 255;
          const idx = (y*w+x) * 4;
          data[idx] = data[idx+1] = data[idx+2] = val;
          data[idx+3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(imageUri);
    img.src = srcUri;
  });
}


/** Read EXIF orientation from a data URI (JPEG only) */
function getExifOrientation(dataUri: string): number {
  try {
    const base64 = dataUri.split(',')[1];
    if (!base64) return 1;
    const binary = atob(base64.slice(0, 1024)); // only need the header
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    // Check JPEG SOI marker
    if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return 1;
    let offset = 2;
    while (offset < bytes.length - 4) {
      if (bytes[offset] !== 0xFF) break;
      const marker = bytes[offset + 1];
      const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (marker === 0xE1) { // APP1 = EXIF
        // Check Exif header
        const exifHeader = String.fromCharCode(...bytes.slice(offset + 4, offset + 10));
        if (exifHeader.startsWith('Exif')) {
          const tiffOffset = offset + 10;
          const littleEndian = bytes[tiffOffset] === 0x49;
          const read16 = (o: number) => littleEndian
            ? (bytes[tiffOffset + o] | (bytes[tiffOffset + o + 1] << 8))
            : ((bytes[tiffOffset + o] << 8) | bytes[tiffOffset + o + 1]);
          const read32 = (o: number) => littleEndian
            ? (bytes[tiffOffset + o] | (bytes[tiffOffset + o + 1] << 8) | (bytes[tiffOffset + o + 2] << 16) | (bytes[tiffOffset + o + 3] << 24))
            : ((bytes[tiffOffset + o] << 24) | (bytes[tiffOffset + o + 1] << 16) | (bytes[tiffOffset + o + 2] << 8) | bytes[tiffOffset + o + 3]);
          const ifdOffset = read32(4);
          const numEntries = read16(ifdOffset);
          for (let i = 0; i < numEntries; i++) {
            const entryOffset = ifdOffset + 2 + i * 12;
            const tag = read16(entryOffset);
            if (tag === 0x0112) { // Orientation tag
              return read16(entryOffset + 8);
            }
          }
        }
      }
      offset += 2 + segLen;
    }
  } catch (_) {}
  return 1;
}


// ── Convert any image URI to ArrayBuffer ─────────────────────────────────────
async function uriToArrayBuffer(imageUri: string): Promise<ArrayBuffer> {
  if (imageUri.startsWith('data:')) {
    const base64 = imageUri.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
  // blob: or http(s): URL
  const res = await fetch(imageUri);
  return res.arrayBuffer();
}

// ── OCR runner ────────────────────────────────────────────────────────────────
export async function ocrReceiptImage(imageUri: string): Promise<ParsedReceipt> {
  const { Platform } = require('react-native');
  console.log('[OCR] platform:', Platform.OS, 'uri scheme:', imageUri.slice(0, 25));

  let rawText = '';
  let processedBase64: string | undefined;

  // ── Web: canvas preprocessing (upscale 2x + adaptive threshold) ──
  if (Platform.OS === 'web') {
    try {
      const ocrInput = await preprocessForOcr(imageUri);
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(ocrInput as any, 'eng', {
        logger: () => {},
        tessedit_pageseg_mode: '6',
      } as any);
      rawText = result.data.text;
    } catch (e: any) {
      console.error('[OCR] web canvas failed:', e?.message ?? e);
      throw e;
    }
  } else {
    // ── Native: jimp preprocessing ──
    try {
      const processed = await preprocessWithJimp(imageUri);
      processedBase64 = processed.base64;
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(processed.uri as any, 'eng', {
        logger: () => {},
        tessedit_pageseg_mode: '6',
      } as any);
      rawText = result.data.text;
    } catch (e: any) {
      console.error('[OCR] native jimp failed:', e?.message ?? e);
      // Fallback to raw image
      const Tesseract = await import('tesseract.js');
      const result = await Tesseract.recognize(imageUri as any, 'eng', {
        logger: () => {},
        tessedit_pageseg_mode: '6',
      } as any);
      rawText = result.data.text;
    }
  }

  console.log('[OCR] raw text:', JSON.stringify(rawText));
  const parsed = parseReceiptText(rawText);
  console.log('[OCR] parsed items:', parsed.items);
  return { ...parsed, processedBase64 };
}
