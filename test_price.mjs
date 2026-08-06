// Test the two specific lines
const lines = [
  "1 UBE CAKE whulf 1,245 (s)",
  "'A 1 BIRTHDAY LABEL 55.90",
];

function extractPrice(line) {
  const cleaned = line
    .replace(/^[^a-zA-Z\d]+/, '')
    .replace(/[\(\)\[\]{}|'`"]+\s*$/, '')
    .replace(/\s+[a-zA-Z]{1,2}\s*$/, '')
    .trim();
  console.log(`  cleaned: "${cleaned}"`);

  const withComma = cleaned.match(/(\d{1,3}(?:,\d{3})+)(?:[.\s](\d{2}))?\s*$/);
  console.log(`  withComma match:`, withComma?.[0]);
  if (withComma) {
    const intPart = withComma[1].replace(/,/g, '');
    const decPart = withComma[2] ?? '00';
    const price = parseFloat(intPart + '.' + decPart);
    console.log(`  → withComma price: ${price}`);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }

  const simple = cleaned.match(/(\d+)[.\s](\d{2})\s*$/);
  console.log(`  simple match:`, simple?.[0]);
  if (simple) {
    const price = parseFloat(simple[1] + '.' + simple[2]);
    console.log(`  → simple price: ${price}`);
    if (!isNaN(price) && price > 0 && price <= 999999) return price;
  }

  return null;
}

for (const line of lines) {
  console.log(`\nLine: "${line}"`);
  const price = extractPrice(line);
  console.log(`  FINAL PRICE: ${price}`);
}
