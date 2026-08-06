import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

# Find the subitems tab block: line 2780 to 2815 (0-indexed 2779-2814)
print('Start:', lines[2779].rstrip())
print('End:  ', lines[2814].rstrip())

new_block = """\
              {editItemTab === 'subitems' && (
                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
                  {(editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).length === 0 ? (
                    <View style={{ paddingHorizontal: DC.pagePadding, paddingTop: 24 }}>
                      <Text style={{ ...DC.typography.muted }}>no subitems yet — tap + to add</Text>
                    </View>
                  ) : (
                    (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).map((item: any, idx: number, arr: any[]) => {
                      const isLast = idx === arr.length - 1;
                      return (
                        <View key={item.id} style={{ paddingVertical: 12, paddingHorizontal: DC.pagePadding, borderBottomWidth: isLast ? 0 : DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor }}>
                          {/* Name + amount + delete row */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: DC.pageTextMuted, minWidth: 16 }}>{idx + 1}</Text>
                            <TextInput
                              style={{ flex: 1, fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: Colors.surface }}
                              value={item.name}
                              onChangeText={v => setEditItemTarget((prev: any) => prev ? { ...prev, groupItems: prev.groupItems.map((gi: any) => gi.id === item.id ? { ...gi, name: v } : gi) } : prev)}
                              onBlur={async () => { await supabase.from('split_items').update({ name: item.name }).eq('id', item.id); refetchItems(); }}
                              placeholder="item name"
                              placeholderTextColor={DC.inputPlaceholder}
                            />
                            <TextInput
                              style={{ width: 80, fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: Colors.surface, textAlign: 'right' }}
                              value={String(item.cost)}
                              onChangeText={v => setEditItemTarget((prev: any) => prev ? { ...prev, groupItems: prev.groupItems.map((gi: any) => gi.id === item.id ? { ...gi, cost: v } : gi) } : prev)}
                              onBlur={async () => { const n = parseFloat(item.cost); if (!isNaN(n) && n > 0) { await supabase.from('split_items').update({ cost: n }).eq('id', item.id); refetchItems(); } }}
                              keyboardType="decimal-pad"
                              placeholder="0.00"
                              placeholderTextColor={DC.inputPlaceholder}
                              selectTextOnFocus
                            />
                            <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <SvgXml xml={SVG_CLOSE} width={16} height={16} color={DC.pageTextMuted} />
                            </TouchableOpacity>
                          </View>
                          {/* People chips + assign */}
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}>
                            {(item.people ?? []).map((p: string) => (
                              <TouchableOpacity
                                key={p}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DC.viewBtnBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}
                                onPress={async () => {
                                  const newPeople = (item.people ?? []).filter((x: string) => x !== p);
                                  setEditItemTarget((prev: any) => prev ? { ...prev, groupItems: prev.groupItems.map((gi: any) => gi.id === item.id ? { ...gi, people: newPeople } : gi) } : prev);
                                  await supabase.from('split_items').update({ people: newPeople.length ? newPeople : null }).eq('id', item.id);
                                  refetchItems();
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 11, color: DC.viewBtnText }}>{displayPersonName(p)}</Text>
                                <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 10, color: DC.viewBtnText }}>✕</Text>
                              </TouchableOpacity>
                            ))}
                            <TouchableOpacity
                              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderStyle: 'dashed' }}
                              onPress={() => openAddSubitem({ id: item.id, name: item.name, cost: String(item.cost), people: item.people ?? [] })}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic' }}>
                                {(item.people ?? []).length === 0 ? 'tap to assign' : '+ add'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              )}
"""

result = lines[:2779] + [new_block] + lines[2815:]
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)
print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
