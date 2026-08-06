path = r'app/(app)/split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    c = f.read()

# 1. State type
c = c.replace(
    "useState<{ name: string; cost: string }[]>([]);",
    "useState<{ name: string; cost: string; selected?: boolean }[]>([]);"
)

# 2. saveScanItems filter
c = c.replace(
    "const valid = newItemScanItems.filter(r => r.name.trim() && parseFloat(r.cost) > 0);",
    "const valid = newItemScanItems.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0);"
)

# 3. parsed items mapping
c = c.replace(
    "setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price) })));",
    "setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })));"
)

# 4. Replace the scan-review JSX block
old = """{newItemStep === 'scan-review' && (
                <View style={{ flex: 1 }}>
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                    <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted }}>review detected items \u2014 edit or remove before saving</Text>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {newItemScanItems.map((item, idx) => (
                      <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: DC.pagePadding, borderBottomWidth: 1, borderBottomColor: DC.controlBorder }}>
                        <View style={{ flex: 1 }}>
                          <TextInput
                            style={{ ...DC.textbox.input, fontFamily: 'Poppins-Regular', fontSize: 13 }}
                            value={item.name}
                            onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, name: v } : x))}
                            placeholder="item name"
                            placeholderTextColor={DC.inputPlaceholder}
                          />
                        </View>
                        <View style={{ width: 90 }}>
                          <TextInput
                            style={{ ...DC.textbox.input, fontFamily: 'Poppins-Regular', fontSize: 13, textAlign: 'right' }}
                            value={item.cost}
                            onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, cost: v } : x))}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={DC.inputPlaceholder}
                          />
                        </View>
                        <TouchableOpacity onPress={() => setNewItemScanItems(prev => prev.filter((_, i) => i !== idx))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <SvgXml xml={SVG_CLOSE} width={18} height={18} color={DC.pageTextMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                  <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: DC.pagePadding, backgroundColor: '#ffffff', borderTopWidth: 1, borderTopColor: DC.cardDividerColor, gap: 8 }}>
                    <TouchableOpacity
                      style={[s.doneBtn, { opacity: newItemSaving || newItemScanItems.filter(r => r.name.trim() && parseFloat(r.cost) > 0).length === 0 ? 0.4 : 1 }]}
                      onPress={saveScanItems}
                      disabled={newItemSaving || newItemScanItems.filter(r => r.name.trim() && parseFloat(r.cost) > 0).length === 0}
                    >
                      <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : `save ${newItemScanItems.filter(r => r.name.trim() && parseFloat(r.cost) > 0).length} items`}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface }]} onPress={() => setNewItemStep('choice')}>
                      <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}"""

new = """{newItemStep === 'scan-review' && (() => {
                const selectedCount = newItemScanItems.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0).length;
                return (
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted }}>tap to deselect items you don't want</Text>
                      <TouchableOpacity
                        onPress={() => {
                          const allSelected = newItemScanItems.every(r => r.selected !== false);
                          setNewItemScanItems(prev => prev.map(x => ({ ...x, selected: !allSelected })));
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.viewBtnText }}>
                          {newItemScanItems.every(r => r.selected !== false) ? 'deselect all' : 'select all'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                      {newItemScanItems.map((item, idx) => {
                        const isSelected = item.selected !== false;
                        return (
                          <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: DC.pagePadding, borderBottomWidth: DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor, opacity: isSelected ? 1 : 0.35 }}>
                            <TouchableOpacity
                              onPress={() => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, selected: !isSelected } : x))}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: isSelected ? DC.viewBtnText : DC.controlBorder, backgroundColor: isSelected ? DC.viewBtnText : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <Text style={{ color: '#ffffff', fontSize: 11, fontFamily: 'Poppins-Bold', lineHeight: 14 }}>\u2713</Text>}
                              </View>
                            </TouchableOpacity>
                            <Text style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{item.name}</Text>
                            <TextInput
                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', minWidth: 60, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, paddingVertical: 2 }}
                              value={item.cost}
                              onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, cost: v } : x))}
                              keyboardType="decimal-pad"
                              placeholderTextColor={DC.inputPlaceholder}
                            />
                          </View>
                        );
                      })}
                    </ScrollView>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: DC.pagePadding, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: DC.cardDividerColor, gap: 8 }}>
                      <TouchableOpacity
                        style={[s.doneBtn, { opacity: newItemSaving || selectedCount === 0 ? 0.4 : 1 }]}
                        onPress={saveScanItems}
                        disabled={newItemSaving || selectedCount === 0}
                      >
                        <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : `add ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface }]} onPress={() => setNewItemStep('choice')}>
                        <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}"""

# Normalize line endings for matching
c_norm = c.replace('\r\n', '\n')
old_norm = old.replace('\r\n', '\n')

if old_norm in c_norm:
    c_norm = c_norm.replace(old_norm, new)
    with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
        f.write(c_norm)
    print('SUCCESS: all changes applied')
else:
    # Check which changes were already applied
    print('scan-review block not found in old form - checking current state:')
    print('has selectedCount:', 'selectedCount' in c)
    print('has tap to deselect:', 'tap to deselect' in c)
    print('has selected type:', 'selected?: boolean' in c)
    print('has selected filter in saveScanItems:', 'r.selected !== false && r.name' in c)
    print('has selected: true in mapping:', 'selected: true' in c)
    # Show what the scan-review block looks like now
    idx = c.find("scan-review' && (")
    if idx >= 0:
        print('\nCurrent scan-review block start:')
        print(repr(c[idx:idx+300]))
