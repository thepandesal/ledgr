import re

path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Find the broken section between "Add Subitems tab" comment and "</SafeAreaView>\n              )}\n            </SafeAreaView>"
# We'll replace from the comment through the broken SafeAreaView closing

old_marker_start = '              {/* Add Subitems tab */}'
old_marker_end = '                </SafeAreaView>\n              )}\n            </SafeAreaView>'

start_idx = content.find(old_marker_start)
end_idx = content.find(old_marker_end, start_idx)

if start_idx == -1:
    print('ERROR: start marker not found')
elif end_idx == -1:
    print('ERROR: end marker not found')
else:
    end_idx += len(old_marker_end)
    old_section = content[start_idx:end_idx]
    print('Found section, length:', len(old_section))
    print('First 200 chars:', repr(old_section[:200]))
    print('Last 200 chars:', repr(old_section[-200:]))

    new_section = '''              {/* Add Subitems tab */}
              {editItemTab === 'subitems' && (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                  {(editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).length === 0 ? (
                    <View style={{ paddingHorizontal: DC.pagePadding, paddingTop: 24 }}>
                      <Text style={{ ...DC.typography.muted }}>no subitems yet \u2014 tap + to add</Text>
                    </View>
                  ) : (
                    (editItemTarget?.groupItems ?? []).filter((i: any) => i.id !== editItemTarget?.item?.id).map((item: any, idx: number) => (
                      <TouchableOpacity
                        key={item.id}
                        style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, paddingHorizontal: DC.pagePadding, borderBottomWidth: 1, borderBottomColor: DC.controlBorder }}
                        onPress={() => openAddSubitem({ id: item.id, name: item.name, cost: String(item.cost), people: item.people ?? [] })}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, minWidth: 16 }}>{idx + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ ...DC.typography.sectionBody, fontFamily: 'Poppins-SemiBold' }} numberOfLines={1}>{item.name}</Text>
                          {(item.people ?? []).length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                              {(item.people ?? []).map((p: string) => (
                                <View key={p} style={{ backgroundColor: DC.pageActionBg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                                  <Text style={{ ...DC.typography.subContent }}>{p}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        <Text style={{ ...DC.typography.amount }}>{fmt(Number(item.cost))}</Text>
                        <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <SvgXml xml={SVG_CLOSE} width={18} height={18} color={DC.pageTextMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              )}

              {/* Save button \u2014 always visible at bottom of form step */}
              <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderTopWidth: 1, borderTopColor: DC.cardDividerColor }}>
                <TouchableOpacity
                  style={[s.doneBtn, { marginTop: 0, opacity: newItemSaving || !newItemName.trim() || (!newItemAmount && newItemTab !== 'subitems') ? 0.4 : 1 }]}
                  onPress={saveNewItem}
                  disabled={newItemSaving || !newItemName.trim() || (!newItemAmount && newItemTab !== 'subitems')}
                >
                  <Text style={s.doneBtnText}>{newItemSaving ? 'saving...' : 'save item'}</Text>
                </TouchableOpacity>
              </View>
                </SafeAreaView>
              )}
            </SafeAreaView>'''

    new_content = content[:start_idx] + new_section + content[end_idx:]
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('Done - file written successfully')
