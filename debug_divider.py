with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '    <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />\n                <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />\n              </View>\n                {/* Tab row */}\n                <View style={{ flexDir'

idx = content.find(old[:80])
if idx >= 0:
    print("Found at", idx)
    print(repr(content[idx:idx+600]))
else:
    print("Not found, searching for double divider...")
    idx2 = content.find('cardDividerColor }} />\n                <View style={{ height: 1')
    print("Double divider at:", idx2)
    if idx2 >= 0:
        print(repr(content[idx2-100:idx2+500]))
