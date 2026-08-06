import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
c = open(path, encoding='utf-8').read()

old = "                    {/* Total bar */}\n                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.viewBtnBg }}>"

new = "                    {/* Disclaimer */}\n                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic', paddingHorizontal: DC.pagePadding, paddingTop: 10, paddingBottom: 6 }}>Please double-check the amounts — the receipt reader may not always be accurate.</Text>\n                    {/* Total bar */}\n                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.viewBtnBg }}>"

if old in c:
    c = c.replace(old, new)
    open(path, 'w', encoding='utf-8').write(c)
    print('FIXED')
else:
    print('NOT FOUND')
    idx = c.find('Total bar')
    if idx >= 0: print(repr(c[idx-50:idx+200]))
