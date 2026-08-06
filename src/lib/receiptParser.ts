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

const SKIP_KEYWORDS = [
  'total', 'subtotal', 'sub-total', 'sub total', 'grand total',
  'amount due', 'amount paid', 'balance due', 'balance',
  'vat', 'tax', 'service charge', 'service fee', 'surcharge',
  'tip', 'gratuity', 'delivery fee', 'delivery charge',
  'cash', 'change', 'credit card', 'debit card', 'gcash', 'maya',
  'payment', 'paid', 'tendered',
  'receipt', 'invoice', 'order', 'table', 'server', 'cashier',
  'thank you', 'thanks', 'welcome', 'please', 'come again',
  'address', 'tel', 'phone', 'fax', 'email', 'www', 'http',
  'tin', 'bir', 'vat reg', 'non-vat', 'pwdsc', 'senior',
  'date', 'time', 'transaction', 'ref', 'or no', 'official receipt',
  'qty', 'quantity', 'unit price', 'unit', 'description', 'item',
  'discount', 'promo', 'less',
];

const TOTAL_KEYWORDS = ['total', 'amount due', 'grand total', 'balance due'];

// Matches prices like: 19,00  19.00  $19.00  $ 19,00  ₱149  1,234.50
const PRICE_PATTERN = /(?:₱|P|PHP|USD|\$)?\s*(\d{1,6}(?:[,.]\d{2,3})*(?:[,.]\d{2})?)\s*$/;

function cleanPrice(raw: string): number {
  let s = raw.replace(/[₱P$\s]/g, '').replace('PHP', '').replace('USD', '');
  // European comma-decimal: ends with ,XX
  if (/,\d{2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  return parseFloat(s);
}

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (lower.length < 2) return true;
  if (/^\d+$/.test(lower.trim())) return true;
  return SKIP_KEYWORDS.some(kw =>
    lower.startsWith(kw) || lower === kw || new RegExp(`^${kw}[\\s:.]`).test(lower)
  );
}

function isTotalLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  return TOTAL_KEYWORDS.some(kw => lower.includes(kw));
}

function extractPrice(line: string): number | null {
  const match = line.match(PRICE_PATTERN);
  if (!match) return null;
  const price = cleanPrice(match[1]);
  if (isNaN(price) || price <= 0 || price > 999999) return null;
  return price;
}

function extractItemName(line: string, price: number): string {
  let name = line
    .replace(/(?:₱|P|PHP|USD|\$)?\s*[\d,]+[,.]?\d*\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  name = name.replace(/^\d+\s*[xX]\s*/, '').replace(/^[xX]\s*\d+\s*/, '').trim();
  name = name.replace(/[.\-_]+\s*$/, '').trim();
  return name;
}

function scoreItemLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;
  const price = extractPrice(trimmed);
  if (!price) return false;
  if (isSkipLine(trimmed)) return false;
  const name = extractItemName(trimmed, price);
  if (name.length < 2) return false;
  if (price > 50000) return false;
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
    if (isTotalLine(line)) {
      const price = extractPrice(line);
      if (price && !detectedTotal) detectedTotal = price;
      continue;
    }
    if (!scoreItemLine(line)) continue;
    const price = extractPrice(line)!;
    const name = extractItemName(line, price);
    if (name.length >= 2) {
      items.push({ name: escapeHtml(name), price });
    }
  }

  return { items, detectedTotal, rawText: escapeHtml(rawText) };
}

// ── Image preprocessing for better OCR ──────────────────────────────────────
async function preprocessForOcr(imageUri: string): Promise<string> {
  if (typeof document === 'undefined') return imageUri;
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale up for better OCR
      const scale = Math.max(1, 1600 / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Get pixel data and apply grayscale + contrast boost
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const contrast = 1.8;
      const intercept = 128 * (1 - contrast);
      for (let i = 0; i < data.length; i += 4) {
        // Grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
        // Contrast
        const val = Math.min(255, Math.max(0, contrast * gray + intercept));
        data[i] = data[i+1] = data[i+2] = val;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
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

  // Preprocess: grayscale + contrast boost for better OCR accuracy
  const preprocessed = await preprocessForOcr(processUri);
  console.log('[OCR] preprocessed length:', preprocessed.length);

  const result = await Tesseract.recognize(preprocessed, 'eng', { logger: () => {} });
  const rawText = result.data.text;
  console.log('[OCR] raw text:', JSON.stringify(rawText));
  const parsed = parseReceiptText(rawText);
  console.log('[OCR] parsed items:', parsed.items);
  return parsed;
}
