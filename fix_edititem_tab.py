with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''                {/* Tab row */}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingVertical: 12 }}>
                  <TouchableOpacity style={editItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('assign')} activeOpacity={0.8}>
                    <Text style={editItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={editItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('subitems')} activeOpacity={0.8}>
                    <Text style={editItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>
                  </TouchableOpacity>

                  {editItemTab === 'subitems' && (
                    <TouchableOpacity style={DC.circleBtn.addSm} onPress={openAddSubitem} activeOpacity={0.7}>
                      <Text style={s.addCircleBtnText}>+</Text>
                    </TouchableOpacity>

                  )}
                </View>
                <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
              </View>'''

new = '''                <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
              </View>
                {/* Tab row */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 12 }}>
                  <TouchableOpacity style={editItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('assign')} activeOpacity={0.8}>
                    <Text style={editItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={editItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('subitems')} activeOpacity={0.8}>
                    <Text style={editItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>
                  </TouchableOpacity>
                  {editItemTab === 'subitems' && (
                    <TouchableOpacity style={DC.circleBtn.addSm} onPress={openAddSubitem} activeOpacity={0.7}>
                      <Text style={s.addCircleBtnText}>+</Text>
                    </TouchableOpacity>
                  )}
                </View>'''

if old in content:
    content = content.replace(old, new, 1)
    print("Fixed Edit Item tab row position")
else:
    print("NOT FOUND")
    idx = content.find('handleEditItemTabChange')
    print(repr(content[max(0,idx-200):idx+50]))

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
