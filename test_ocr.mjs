import { createWorker } from 'tesseract.js';

const INPUT = 'C:/Users/jhoeb/Downloads/9c53f02d-ce8e-46a1-85f3-76774ddaf0ad.jpg';

const worker = await createWorker('eng', 1, { logger: () => {} });
await worker.setParameters({ tessedit_pageseg_mode: '6' });
const { data: { text } } = await worker.recognize(INPUT);
await worker.terminate();

console.log('RAW:\n' + text);

const SKIP = [
  'receipt','invoice','thank you','thanks','welcome','please','come again',
  'address','tel','phone','fax','email','www','http','tin','bir','vat reg',
  'non-vat','pwdsc','senior','date','time','transaction','ref','or no',
  'official receipt','qty','quantity','unit price','unit','description',
  'vatable','vat','tax','service charge','service fee',
  'varab','varabl','atable','atabl','watabl','watabte',
  'cust','bus style','take-out','take out','dine in','dine-in','reprint',
  'cashier','sales invoice','sales','invoice','min#','pos','si#','sn:','min ',
  'cash','change',
];
const SUMMARY = ['total due','total','subtotal','sub-total','amount due','grand total','balance due'];

function hasSkipKeyword(lower) {
  return SKIP.some(kw => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![a-z])${escaped}(?![a-z])`).test(lower);
  });
}

function fixOcrDigits(s) {
  s = s.replace(/(\d)[\s:](\d{2})$/, '$1.$2');
  s = s.replace(/(\d\.\d)[;:]$/, '$10');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '$') out += '5';
    else if (c === 'S' && i > 0 && /[\d.]/.test(s[i-1])) out += '5';
    else if (c === 'O') out += '0';
    else out += c;
  }
  return out;
}

function cleanPrice(raw) {
  let s = fixOcrDigits(raw.trim()).replace(/[^\d,.]/g, '');
  if (!s) return NaN;
  if (/,\d{2}$/.test(s) && !s.includes('.')) s = s.replace(/,/g, '.');
  else s = s.replace(/,/g, '');
  return parseFloat(s);
}

function extractPrice(line) {
  const cleaned = line
    .replace(/^[^a-zA-Z\d]+/, '')
    .replace(/[\(\)\[\]{}|'`"]+\s*$/, '')
    .replace(/\s+[a-zA-Z]{1,4}\s*$/, '')
    .replace(/\([a-zA-Z]{1,3}\)\s*$/, '')
    .trim();
  const withComma = cleaned.match(/(\d{1,3}(?:,\d{3})+)(?:[.\s](\d{2}))?\s*$/);
  if (withComma) {
    const price = parseFloat(withComma[1].replace(/,/g, '') + '.' + (withComma[2] ?? '00'));
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  const simple = cleaned.match(/(\d+)[.\s](\d{2})\s*$/);
  if (simple) {
    const price = parseFloat(simple[1] + '.' + simple[2]);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  const plain = cleaned.match(/(\d[\d,.]*)\s*$/);
  if (!plain || !plain[1]) return null;
  const price = cleanPrice(plain[1]);
  if (isNaN(price) || price <= 0 || price > 999999) return null;
  return price;
}

function extractItemName(line) {
  let name = line
    .replace(/^[^a-zA-Z\d]+/, '')
    .replace(/(?:[\u20b1PSUSD$]+\s*)?\$?\d[\d$S,.]*\s*[\(\)\[\]{}|'`"a-z]{0,3}\s*$/, '')
    .replace(/\s{2,}/g, ' ').trim();
  name = name.replace(/^[\d1lItT]+\s*[xX]\s*/i, '').replace(/^[xX]\s*[\d]+\s*/, '').trim();
  name = name.replace(/^\d+\s+(?=[A-Za-z])/, '').trim();
  name = name.replace(/[.\-_]+\s*$/, '').trim();
  return name;
}

function isSummary(line) {
  const lower = line.toLowerCase().trim();
  return SUMMARY.some(kw => lower.startsWith(kw) || lower === kw);
}

function isValid(line) {
  const t = line.trim();
  if (t.length < 3) return false;
  const price = extractPrice(t);
  if (!price || price > 50000) return false;
  if (!/[a-zA-Z]{2,}/.test(t)) return false;
  const lower = t.toLowerCase();
  if (hasSkipKeyword(lower)) return false;
  if (/\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(t)) return false;
  if (/[A-Z0-9#\-:]{7,}/.test(t.split(/\s+/)[0])) return false;
  if (price > 9999 && !/[a-zA-Z]{4,}/.test(t)) return false;
  if (/^\d+\s+items?\b/i.test(t)) return false;
  if (/iten|itea|item|ttea|ttem|\(s\)/i.test(lower)) return false;
  const name = extractItemName(t);
  if (name.length < 3 || !/[a-zA-Z]{3,}/.test(name)) return false;
  const letters = (t.match(/[a-zA-Z]/g) || []).length;
  const total = t.replace(/\s/g, '').length;
  if (total > 5 && letters / total < 0.25) return false;
  return true;
}

const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
const items = [];
let detectedTotal = null;

for (const line of lines) {
  if (isSummary(line)) {
    const price = extractPrice(line);
    if (price) {
      if (!detectedTotal && line.toLowerCase().includes('total')) detectedTotal = price;
      const name = extractItemName(line) || line.split(/\s+/)[0];
      if (name.length >= 2) items.push({ name, price, type: 'SUMMARY' });
    }
    continue;
  }
  if (!isValid(line)) continue;
  const price = extractPrice(line);
  const name = extractItemName(line);
  if (name.length >= 2) items.push({ name, price, type: 'ITEM' });
}

console.log('\n=== WHAT APP WILL SHOW ===');
items.forEach(i => console.log(`  [${i.type}] "${i.name}" → ${i.price}`));
console.log('  detectedTotal:', detectedTotal);
