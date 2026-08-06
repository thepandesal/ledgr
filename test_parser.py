import re

SUMMARY_KEYWORDS = ['total due', 'total', 'subtotal', 'sub-total', 'amount due', 'grand total', 'balance due']
SKIP_KEYWORDS = [
  'receipt', 'invoice', 'thank you', 'thanks', 'welcome', 'please', 'come again',
  'address', 'tel', 'phone', 'fax', 'email', 'www', 'http',
  'tin', 'bir', 'vat reg', 'non-vat', 'pwdsc', 'senior',
  'date', 'time', 'transaction', 'ref', 'or no', 'official receipt',
  'qty', 'quantity', 'unit price', 'unit', 'description',
  'vatable', 'vat', 'tax', 'service charge', 'service fee',
  'varab', 'varabl', 'atable', 'atabl', 'watabl', 'watabte',  # OCR misreads of vatable
  'cust', 'bus style', 'take-out', 'take out', 'dine in', 'dine-in',
  'reprint', 'cashier', 'sales invoice', 'sales', 'invoice',
  'min#', 'pos', 'si#', 'sn:', 'min ',
  'cash', 'change',
]

def has_skip_keyword(lower):
    for kw in SKIP_KEYWORDS:
        escaped = re.escape(kw)
        if re.search(r'(?<![a-z])' + escaped + r'(?![a-z])', lower):
            return True
    return False

def fix_ocr(s):
    s = re.sub(r'(\d)[\s:](\d{2})$', r'\1.\2', s)
    out = ''
    for i, c in enumerate(s):
        if c == '$': out += '5'
        elif c == 'S' and i > 0 and s[i-1] in '0123456789.': out += '5'
        elif c == 'O': out += '0'
        else: out += c
    return out

def clean_price(raw):
    s = re.sub(r'[^\d,.]', '', fix_ocr(raw.strip()))
    if not s: return float('nan')
    if re.search(r',\d{2}$', s) and '.' not in s:
        s = s.replace(',', '.')
    else:
        s = s.replace(',', '')
    return float(s)

def extract_price(line):
    cleaned = re.sub(r'^[^a-zA-Z\d]+', '', line)
    cleaned = re.sub(r'[\(\)\[\]{}|\'`"]+\s*$', '', cleaned)
    cleaned = re.sub(r'\s+[a-zA-Z]{1,2}\s*$', '', cleaned).strip()
    m = re.search(r'(\d{1,3}(?:,\d{3})+)(?:[.\s](\d{2}))?\s*$', cleaned)
    if m:
        price = float(m.group(1).replace(',', '') + '.' + (m.group(2) or '00'))
        if 0 < price <= 999999: return price
    m = re.search(r'(\d+)[.\s](\d{2})\s*$', cleaned)
    if m:
        price = float(m.group(1) + '.' + m.group(2))
        if 0 < price <= 999999: return price
    return None

def extract_name(line):
    name = re.sub(r'(?:[\u20b1PSUSD$]+\s*)?\$?[\d][\d$S,.]*\s*$', '', line)
    name = re.sub(r'\s{2,}', ' ', name).strip()
    name = re.sub(r'^[\d1lItT]+\s*[xX]\s*', '', name, flags=re.I).strip()
    name = re.sub(r'^[xX]\s*[\d]+\s*', '', name).strip()
    name = re.sub(r'^\d+\s+(?=[A-Za-z])', '', name).strip()
    name = re.sub(r'[.\-_]+\s*$', '', name).strip()
    return name

def is_summary(line):
    lower = line.lower().strip()
    return any(lower.startswith(kw) or lower == kw for kw in SUMMARY_KEYWORDS)

def is_valid(line):
    trimmed = line.strip()
    if len(trimmed) < 3: return False
    price = extract_price(trimmed)
    if not price or price > 50000: return False
    if not re.search(r'[a-zA-Z]{2,}', trimmed): return False
    lower = trimmed.lower()
    if has_skip_keyword(lower): return False
    if re.search(r'\d{2}[/\-]\d{2}[/\-]\d{4}', trimmed): return False
    first_word = trimmed.split()[0]
    if re.match(r'[A-Z0-9#\-:]{7,}$', first_word): return False
    if re.match(r'^\d+\s+items?\b', trimmed, re.I): return False
    # OCR variants of item(s) subtotal line
    if re.search(r'iten|itea|item|ttea|ttem|\(s\)', lower): return False
    name = extract_name(trimmed)
    if len(name) < 3 or not re.search(r'[a-zA-Z]{3,}', name): return False
    return True

test_lines = [
    # Header lines (all SKIP)
    'POS01-SN:41-XVB27',
    'MIN#22032311754119800',
    'Sales INVOICE',
    '* * * REPRINT * * *',
    'ashier: GRACE BORRMEO',
    '07/12/2026 10:33  0052  SI#01205530',
    '-- TAKE-OUT --',
    # Items (ITEM)
    '1 UBE CAKE WHOLE  1,245.00',
    '1 BIRTHDAY LABEL  55.00',
    # Subtotal / summary (SKIP or SUMMARY)
    '2 Item(s)  1,300.00',
    'TOTAL DUE  1,300.00',
    'CASH  2,000.00',
    'CHANGE  700.00',
    'VATable  1,160.71',
    'VAT  139.29',
    'Cust Name:',
    'Address:',
    'TIN:',
    'Bus Style:',
    # Actual OCR-garbled lines from the screenshot (all SKIP)
    'Ttea(s)  30',
    'Lo waTabte  1160.71',
    'UBE CAKE WhULE  1285',
]

print(f'{"LINE":<45} {"RESULT":<10} {"NAME":<22} {"PRICE"}')
print('-' * 85)
for line in test_lines:
    if is_summary(line):
        price = extract_price(line)
        name = extract_name(line) or line.split()[0]
        print(f'{line:<45} {"SUMMARY":<10} {name:<22} {price}')
    elif is_valid(line):
        price = extract_price(line)
        name = extract_name(line)
        print(f'{line:<45} {"ITEM":<10} {name:<22} {price}')
    else:
        print(f'{line:<45} {"SKIP":<10}')
