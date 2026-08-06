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
    .replace(/\s+[a-zA-Z]{1,4}\s*$/, '')  // strip trailing OCR garbage like "(s)" or "whulf"
    .replace(/\([a-zA-Z]{1,3}\)\s*$/, '') // strip trailing (s) (x) etc
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

  // Skip date lines: contain patterns like 07/12/2026 or 10:33 or garbled variants
  if (/\d{2}[\/\-]\d{2}[\/\-]/.test(trimmed)) return false;
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

// ── OCR runner ────────────────────────────────────────────────────────────────
export async function ocrReceiptImage(imageUri: string): Promise<ParsedReceipt> {
  const { Platform } = require('react-native');
  console.log('[OCR] platform:', Platform.OS, 'uri scheme:', imageUri.slice(0, 25));

  let rawText = '';

  try {
    const Tesseract = await import('tesseract.js');
    const result = await Tesseract.recognize(imageUri as any, 'eng', {
      logger: () => {},
      tessedit_pageseg_mode: '6',
    } as any);
    rawText = result.data.text;
  } catch (e: any) {
    console.error('[OCR] failed:', e?.message ?? e);
    throw e;
  }

  console.log('[OCR] raw text:', JSON.stringify(rawText));
  const parsed = parseReceiptText(rawText);
  console.log('[OCR] parsed items:', parsed.items);
  return { ...parsed };
}
