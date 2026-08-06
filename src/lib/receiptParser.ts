/**
 * receiptParser.ts
 * Uses Tesseract.js (web) to OCR a receipt image, then extracts line items.
 */

export interface ParsedItem {
  name: string;
  price: number;
}

export interface ParsedReceipt {
  items: ParsedItem[];
  detectedTotal: number | null;
  rawText: string;
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
  'qty', 'quantity', 'unit price', 'unit', 'description', 'item',
];

// Summary lines — always include with their price (Total, Cash, Change, etc.)
const SUMMARY_KEYWORDS = ['total', 'cash', 'change', 'subtotal', 'sub-total', 'amount due', 'grand total', 'balance due'];

// Matches a price at end of line.
// Allows leading OCR artifacts: "$ $9.00" or "S$ 400,00"
// Captures the raw token which may contain $ or S as misread digits.
const PRICE_PATTERN = /(?:[\u20b1PSUSD$]+\s*)?(\$?[\d][\d$S,.]*)\s*$/;

/** Fix OCR digit misreads: $ -> 5 always, S -> 5 only after a digit/dot */
function fixOcrDigits(s: string): string {
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
  let s = fixOcrDigits(raw).replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  // European comma-decimal: ends with ,XX with no dot
  if (/,\d{2}$/.test(s) && !s.includes('.')) {
    s = s.replace(/,/g, '.');
  } else {
    s = s.replace(/,/g, '');
  }
  return parseFloat(s);
}

function extractPrice(line: string): number | null {
  const match = line.match(PRICE_PATTERN);
  if (!match) return null;
  const price = cleanPrice(match[1]);
  if (isNaN(price) || price <= 0 || price > 999999) return null;
  return price;
}

function extractItemName(line: string): string {
  let name = line
    .replace(/(?:[\u20b1PSUSD$]+\s*)?\$?[\d][\d$S,.]*\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  // Strip quantity prefix: 1x, 2x, tx/lx/Ix (OCR misreads of 1x)
  name = name.replace(/^[\d1lItT]+\s*[xX]\s*/i, '').replace(/^[xX]\s*[\d]+\s*/, '').trim();
  name = name.replace(/[.\-_]+\s*$/, '').trim();
  return name;
}

function isSummaryLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return SUMMARY_KEYWORDS.some(kw => lower.startsWith(kw) || lower === kw);
}

function isValidItemLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  // Must have a price
  const price = extractPrice(trimmed);
  if (!price || price > 50000) return false;
  // Must have at least one lowercase letter — filters ALL-CAPS noise/barcodes
  if (!/[a-z]/.test(trimmed)) return false;
  // Skip lines that are purely header/footer keywords with no price meaning
  const lower = trimmed.toLowerCase();
  if (SKIP_KEYWORDS.some(kw => lower.startsWith(kw) || lower === kw)) return false;
  // Name must be non-trivial after stripping price
  const name = extractItemName(trimmed);
  if (name.length < 2) return false;
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

// ── Image preprocessing for better OCR ──────────────────────────────────────
async function preprocessForOcr(imageUri: string): Promise<HTMLCanvasElement | string> {
  if (typeof document === 'undefined') return imageUri;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale to at least 2000px wide for better OCR accuracy
      const scale = Math.max(1, 2000 / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Grayscale + adaptive threshold (binarize) for crisp text
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      // Step 1: convert to grayscale
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        data[i] = data[i+1] = data[i+2] = gray;
      }
      // Step 2: compute mean brightness for simple threshold
      let sum = 0;
      const pixels = data.length / 4;
      for (let i = 0; i < data.length; i += 4) sum += data[i];
      const mean = sum / pixels;
      const threshold = mean * 0.85; // slightly below mean to keep light text
      // Step 3: binarize
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] < threshold ? 0 : 255;
        data[i] = data[i+1] = data[i+2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => resolve(imageUri);
    img.src = imageUri;
  });
}

// ── OCR runner (web only via Tesseract.js) ────────────────────────────────────
export async function ocrReceiptImage(imageUri: string): Promise<ParsedReceipt> {
  if (typeof window === 'undefined') {
    return { items: [], detectedTotal: null, rawText: '' };
  }

  console.log('[OCR] uri length:', imageUri.length, 'scheme:', imageUri.slice(0, 25));

  const Tesseract = await import('tesseract.js');

  let processUri = imageUri;
  if (imageUri.startsWith('blob:')) {
    processUri = await new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', imageUri);
      xhr.responseType = 'blob';
      xhr.onload = () => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = reject;
      xhr.send();
    });
    console.log('[OCR] after blob convert, length:', processUri.length);
  }

  // Preprocess: grayscale + binarize for crisp OCR
  const preprocessed = await preprocessForOcr(processUri);
  console.log('[OCR] preprocessed done');

  const result = await Tesseract.recognize(preprocessed as any, 'eng', {
    logger: () => {},
    // PSM 6 = assume a single uniform block of text (good for receipts)
    tessedit_pageseg_mode: '6',
  } as any);
  const rawText = result.data.text;
  console.log('[OCR] raw text:', JSON.stringify(rawText));
  const parsed = parseReceiptText(rawText);
  console.log('[OCR] parsed items:', parsed.items);
  return parsed;
}
