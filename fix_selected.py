path = r'app/(app)/split-bill-detail.tsx'
c = open(path, encoding='utf-8').read()

fixes = [
    (
        "const valid = newItemScanItems.filter(r => r.name.trim() && parseFloat(r.cost) > 0);",
        "const valid = newItemScanItems.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0);"
    ),
    (
        "useState<{ name: string; cost: string }[]>([]);",
        "useState<{ name: string; cost: string; selected?: boolean }[]>([]);"
    ),
    (
        "setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price) })));",
        "setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })));"
    ),
]

for old, new in fixes:
    if old in c:
        c = c.replace(old, new)
        print(f'FIXED: {old[:60]}')
    else:
        print(f'ALREADY DONE or NOT FOUND: {old[:60]}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Saved.')
