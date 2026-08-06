import { createCanvas, loadImage } from 'canvas';
import { createWorker } from 'tesseract.js';
import { writeFileSync } from 'fs';

const INPUT = 'C:/Users/jhoeb/Downloads/9c53f02d-ce8e-46a1-85f3-76774ddaf0ad.jpg';
const OUTPUT = 'C:/Users/jhoeb/Downloads/receipt_final.png';

const img = await loadImage(INPUT);
const scale = Math.max(2, 2000 / img.width);
const srcW = Math.round(img.width * scale);
const srcH = Math.round(img.height * scale);
const canvas = createCanvas(srcW, srcH);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, srcW, srcH);
ctx.drawImage(img, 0, 0, srcW, srcH);
const w = canvas.width, h = canvas.height;
const imageData = ctx.getImageData(0, 0, w, h);
const data = imageData.data;
const gray = new Uint8Array(w * h);
for (let i = 0; i < data.length; i += 4)
  gray[i >> 2] = Math.round(0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
const integral = new Float64Array((w+1)*(h+1));
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++)
    integral[(y+1)*(w+1)+(x+1)] = gray[y*w+x] + integral[y*(w+1)+(x+1)] + integral[(y+1)*(w+1)+x] - integral[y*(w+1)+x];
const radius = Math.max(8, Math.round(w / 16));
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const x1=Math.max(0,x-radius), y1=Math.max(0,y-radius);
    const x2=Math.min(w-1,x+radius), y2=Math.min(h-1,y+radius);
    const count=(x2-x1+1)*(y2-y1+1);
    const sum=integral[(y2+1)*(w+1)+(x2+1)]-integral[y1*(w+1)+(x2+1)]-integral[(y2+1)*(w+1)+x1]+integral[y1*(w+1)+x1];
    const val = gray[y*w+x] < (sum/count) - 15 ? 0 : 255;
    const idx=(y*w+x)*4;
    data[idx]=data[idx+1]=data[idx+2]=val; data[idx+3]=255;
  }
}
ctx.putImageData(imageData, 0, 0);
writeFileSync(OUTPUT, canvas.toBuffer('image/png'));

const worker = await createWorker('eng', 1, { logger: () => {} });
await worker.setParameters({ tessedit_pageseg_mode: '6' });
const { data: { text } } = await worker.recognize(OUTPUT);
await worker.terminate();
console.log('RAW:\n' + text);

const SKIP = [
  'receipt','invoice','thank you','thanks','welcome','please','come again',
  'address','tel','phone','fax','email','www','http','tin','bir','vat reg',
  'non-vat','pwdsc','senior','date','time','transaction','ref','or no',
  'official receipt','qty','quantity','unit price','unit','description',
  'vatable','vat','tax','service charge','service fee',
  'varab','varabl',
  'cust','bus style','take-out','take out','dine in','dine-in','reprint',
  'cashier','sales invoice','sales','invoice','min#','pos','si#','sn:','min ',
  'cash','change',
];
const SUMMARY = ['total due','total','subtotal','sub-total','amount due','grand total','balance due'];

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
    .replace(/\s+[a-zA-Z]{1,2}\s*$/, '')
    .trim();
  // Comma thousands: "1,245.00" or "1,245 00" or "1,245"
  const withComma = cleaned.match(/(\d{1,3}(?:,\d{3})+)(?:[.\s](\d{2}))?\s*$/);
  if (withComma) {
    const intPart = withComma[1].replace(/,/g, '');
    const decPart = withComma[2] ?? '00';
    const price = parseFloat(intPart + '.' + decPart);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  // Simple decimal: "55.90" or "700.00"
  const simple = cleaned.match(/(\d+)[.\s](\d{2})\s*$/);
  if (simple) {
    const price = parseFloat(simple[1] + '.' + simple[2]);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }
  // Plain number
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
  if (SKIP.some(kw => lower.includes(kw))) return false;
  if (/\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(t)) return false;
  if (/[A-Z0-9#\-:]{7,}/.test(t.split(/\s+/)[0])) return false;
  if (price > 9999 && !/[a-zA-Z]{4,}/.test(t)) return false;
  if (/^\d+\s+items?\b/i.test(t)) return false;
  if (/iten|itea|item\(s\)/i.test(lower)) return false;
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
