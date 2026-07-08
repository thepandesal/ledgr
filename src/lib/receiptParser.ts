/**
 * receiptParser.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses Tesseract.js (web) to OCR a receipt image, then applies smart
 * post-processing to extract only line items — filtering out headers,
 * totals, taxes, and other non-item lines.
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

// ── Keywords that indicate a non-item line ────────────────────────────────────
const SKIP_KEYWORDS = [
  // totals / summaries
  'total', 'subtotal', 'sub-total', 'sub total', 'grand total',
  'amount due', 'amount paid', 'balance due', 'balance',
  // taxes / fees
  'vat', 'tax', 'service charge', 'service fee', 'surcharge',
  'tip', 'gratuity', 'delivery fee', 'delivery charge',
  // payments
  'cash', 'change', 'credit card', 'debit card', 'gcash', 'maya',
  'payment', 'paid', 'tendered',
  // receipt metadata
  'receipt', 'invoice', 'order', 'table', 'server', 'cashier',
  'thank you', 'thanks', 'welcome', 'please', 'come again',
  'address', 'tel', 'phone', 'fax', 'email', 'www', 'http',
  'tin', 'bir', 'vat reg', 'non-vat', 'pwdsc', 'senior',
  'date', 'time', 'transaction', 'ref', 'or no', 'official receipt',
  'qty', 'quantity', 'unit price', 'unit', 'description', 'item',
  'discount', 'promo', 'less',
];

// ── Price pattern: number with optional decimal, possibly preceded by currency ─
// Matches: 149.00  1,234.50  ₱149  P149  $12.50  12  etc.
const PRICE_PATTERN = /(?:₱|P|PHP|USD|\$)?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2})?)\s*$/;
const PRICE_ANYWHERE = /(?:₱|P|PHP|USD|\$)?\s*(\d{1,6}(?:[,\.]\d{2,3})*(?:\.\d{2})?)/g;

// ── Total line detector ───────────────────────────────────────────────────────
const TOTAL_KEYWORDS = ['total', 'amount due', 'grand total', 'balance due'];

function cleanPrice(raw: string): number {
  // Remove currency symbols and commas, parse float
  return parseFloat(raw.replace(/[₱P,\s]/g, '').replace('PHP', ''));
}

function isSkipLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  // Empty or too short
  if (lower.length < 2) return true;
  // Pure number lines (e.g. table numbers, order numbers)
  if (/^\d+$/.test(lower.trim())) return true;
  // Contains skip keyword at start or as whole line
  return SKIP_KEYWORDS.some(kw => {
    // Match if line starts with keyword or keyword is the whole line
    return lower.startsWith(kw) || lower === kw || new RegExp(`^${kw}[\\s:.]`).test(lower);
  });
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
  // Remove the price from the end of the line
  const priceStr = price.toFixed(2);
  // Try to remove trailing price pattern
  let name = line
    .replace(/(?:₱|P|PHP|USD|\$)?\s*[\d,]+\.?\d*\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Remove leading quantity patterns like "2x", "2 x", "x2"
  name = name.replace(/^\d+\s*[xX]\s*/, '').replace(/^[xX]\s*\d+\s*/, '').trim();

  // Remove trailing dots/dashes used as price leaders
  name = name.replace(/[\.\-_]+\s*$/, '').trim();

  return name;
}

function scoreItemLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 2) return false;

  // Must have a price at the end
  const price = extractPrice(trimmed);
  if (!price) return false;

  // Must not be a skip line
  if (isSkipLine(trimmed)) return false;

  // Name part (after removing price) must be at least 2 chars
  const name = extractItemName(trimmed, price);
  if (name.length < 2) return false;

  // Price should be reasonable for a single item (not suspiciously large)
  // Totals tend to be larger — but we can't rely on this alone
  if (price > 50000) return false;

  return true;
}

// ── Main parser ───────────────────────────────────────────────────────────────
export function parseReceiptText(rawText: string): ParsedReceipt {
  const lines = rawText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const items: ParsedItem[] = [];
  let detectedTotal: number | null = null;

  for (const line of lines) {
    // Check for total line first
    if (isTotalLine(line)) {
      const price = extractPrice(line);
      if (price && !detectedTotal) detectedTotal = price;
      continue;
    }

    if (!scoreItemLine(line)) continue;

    const price = extractPrice(line)!;
    const name  = extractItemName(line, price);

    if (name.length >= 2) {
      items.push({ name: escapeHtml(name), price });
    }
  }

  return { items, detectedTotal, rawText };
}

// ── OCR runner (web only via Tesseract.js) ────────────────────────────────────
export async function ocrReceiptImage(imageUri: string): Promise<ParsedReceipt> {
  if (typeof window === 'undefined') {
    // Native — return empty, caller should handle
    return { items: [], detectedTotal: null, rawText: '' };
  }

  // Dynamically import Tesseract to avoid SSR issues
  const Tesseract = await import('tesseract.js');

  const result = await Tesseract.recognize(imageUri, 'eng', {
    logger: () => {}, // suppress logs
  });

  const rawText = result.data.text;
  return parseReceiptText(rawText);
}
