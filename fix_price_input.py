path = r'app/(app)/split-bill-detail.tsx'
c = open(path, encoding='utf-8').read()

# Show current state of the price display line
old_price = '<Text style={{ fontFamily: \'Poppins-SemiBold\', fontSize: 13, color: DC.pageText }}>{item.cost}</Text>'
new_price = """<TextInput
                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', minWidth: 60, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, paddingVertical: 2 }}
                              value={item.cost}
                              onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, cost: v } : x))}
                              keyboardType="decimal-pad"
                              placeholderTextColor={DC.inputPlaceholder}
                            />"""

c_norm = c.replace('\r\n', '\n')
if old_price in c_norm:
    c_norm = c_norm.replace(old_price, new_price)
    with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(c_norm)
    print('SUCCESS: price TextInput applied')
else:
    print('old_price not found')
    idx = c_norm.find('item.cost}')
    while idx >= 0:
        print('found at', idx, ':', repr(c_norm[max(0,idx-80):idx+60]))
        idx = c_norm.find('item.cost}', idx+1)
