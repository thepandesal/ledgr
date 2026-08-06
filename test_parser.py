import re

PRICE_PATTERN = re.compile(r'(?:[\u20b1PSUSD$]+\s*)?(\$?[\d][\d$S,.]*)\s*$')
SUMMARY_KEYWORDS = ['total', 'cash', 'change', 'subtotal', 'sub-total', 'amount due', 'grand total', 'balance due']
SKIP_KEYWORDS = ['receipt', 'invoice', 'thank you', 'thanks', 'welcome', 'please', 'come again',
  'address', 'tel', 'phone', 'fax', 'email', 'www', 'http', 'tin', 'bir', 'vat reg',
  'non-vat', 'pwdsc', 'senior', 'date', 'time', 'transaction', 'ref', 'or no',
  'official receipt', 'qty', 'quantity', 'unit price', 'unit', 'description', 'item']

def fix_ocr(s):
    out = ''
    for i, c in enumerate(s):
        if c == '$': out += '5'
        elif c == 'S' and i > 0 and s[i-1] in '0123456789.': out += '5'
        elif c == 'O': out += '0'
        else: out += c
    return out

def clean_price(raw):
    s = re.sub(r'[^\d,.]', '', fix_ocr(raw))
    if not s: return float('nan')
    if re.search(r',\d{2}$', s) and '.' not in s:
        s = s.replace(',', '.')
    else:
        s = s.replace(',', '')
    return float(s)

def extract_price(line):
    m = PRICE_PATTERN.search(line)
    if not m: return None
    p = clean_price(m.group(1))
    if p != p or p <= 0 or p > 999999: return None
    return p

def extract_name(line):
    name = re.sub(r'(?:[\u20b1PSUSD$]+\s*)?\$?[\d][\d$S,.]*\s*$', '', line)
    name = re.sub(r'\s{2,}', ' ', name).strip()
    name = re.sub(r'^[\d1lItT]+\s*[xX]\s*', '', name, flags=re.I)
    name = re.sub(r'^[xX]\s*[\d]+\s*', '', name).strip()
    name = re.sub(r'[.\-_]+\s*$', '', name).strip()
    return name

def is_summary(line):
    lower = line.lower().strip()
    return any(lower.startswith(kw) or lower == kw for kw in SUMMARY_KEYWORDS)

def is_valid_item(line):
    trimmed = line.strip()
    if len(trimmed) < 2: return False
    price = extract_price(trimmed)
    if not price or price > 50000: return False
    if not re.search(r'[a-z]', trimmed): return False
    lower = trimmed.lower()
    if any(lower.startswith(kw) or lower == kw for kw in SKIP_KEYWORDS): return False
    name = extract_name(trimmed)
    return len(name) >= 2

test_lines = [
    '0-0 0H 00-38 10 HE HD 0 140-800-800 00-30-00 SHE SH 0 0 4H 830-840 HEH-HF- 0 0 4 80',
    'SEB SSH 89 EH RAH 2-0 HEHE RHE BR 22 9 HE HE RE',
    'RECEIPT',
    'COMPANY NAME',
    'Street 26 LLX South',
    'Lorem Ipsum',
    '127830236251',
    '1x T-shirt $ 19,00',
    '1x Pants $ $9.00',
    '1x Shirt $ 39,00',
    '1x Shoes $ 199,00',
    'tx Socks $ $8.00',
    'TOTAL $ 371,00',
    'Cash S$ 400,00',
    'Change $ 29,00',
    'THANK YOU',
]

print(f'{"LINE":<50} {"INCLUDE?":<10} {"NAME":<15} {"PRICE"}')
print('-'*85)
for line in test_lines:
    if is_summary(line):
        price = extract_price(line)
        name = extract_name(line) or line.split()[0]
        print(f'{line:<50} {"SUMMARY":<10} {name:<15} {price}')
    elif is_valid_item(line):
        price = extract_price(line)
        name = extract_name(line)
        print(f'{line:<50} {"ITEM":<10} {name:<15} {price}')
    else:
        print(f'{line:<50} {"SKIP":<10}')
