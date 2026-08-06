import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

# Lines 2416-2465 (0-indexed 2415-2464) = the scan-review block
# Verify boundaries
print('Start:', lines[2415].rstrip())
print('End:  ', lines[2464].rstrip())

new_block = """\
              {/* ── Scan review step ── */}
              {newItemStep === 'scan-review' && (() => {
                const validItems = newItemScanItems.filter(r => r.selected !== false && r.name.trim() && parseFloat(r.cost) > 0);
                const selectedCount = validItems.length;
                const selectedTotal = validItems.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0);
                return (
                  <View style={{ flex: 1 }}>
                    {/* Header: hint + select all */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted }}>tap to select / deselect</Text>
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
                    {/* Total bar */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingVertical: 10, backgroundColor: DC.viewBtnBg }}>
                      <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.viewBtnText }}>{selectedCount} item{selectedCount !== 1 ? 's' : ''} selected</Text>
                      <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 14, color: DC.viewBtnText }}>{selectedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                    </View>
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                      {newItemScanItems.map((item, idx) => {
                        const isSelected = item.selected !== false;
                        const isLast = idx === newItemScanItems.length - 1;
                        return (
                          <View
                            key={idx}
                            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: DC.pagePadding, borderBottomWidth: isLast ? 0 : DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor, opacity: isSelected ? 1 : 0.35 }}
                          >
                            <TouchableOpacity
                              onPress={() => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, selected: !isSelected } : x))}
                              activeOpacity={0.7}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: isSelected ? DC.viewBtnText : DC.controlBorder, backgroundColor: isSelected ? DC.viewBtnText : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <Text style={{ color: '#ffffff', fontSize: 11, fontFamily: 'Poppins-Bold', lineHeight: 14 }}>✓</Text>}
                              </View>
                            </TouchableOpacity>
                            <Text style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText }} numberOfLines={1}>{item.name}</Text>
                            <TextInput
                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', minWidth: 70, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, paddingVertical: 2, paddingHorizontal: 4 }}
                              value={item.cost}
                              onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, cost: v } : x))}
                              keyboardType="decimal-pad"
                              selectTextOnFocus
                            />
                          </View>
                        );
                      })}
                    </ScrollView>
                    <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: DC.pagePadding, paddingVertical: 12, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: DC.cardDividerColor, flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity style={[s.doneBtn, { flex: 1, marginTop: 0, backgroundColor: Colors.surface }]} onPress={() => setNewItemStep('choice')}>
                        <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.doneBtn, { flex: 2, marginTop: 0, opacity: newItemSaving || selectedCount === 0 ? 0.4 : 1 }]}
                        onPress={saveScanItems}
                        disabled={newItemSaving || selectedCount === 0}
                      >
                        <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : `add ${selectedCount} item${selectedCount !== 1 ? 's' : ''}`}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })()}
"""

result = lines[:2415] + [new_block] + lines[2465:]
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)
print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
