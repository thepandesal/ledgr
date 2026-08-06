with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
                <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
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

new = '''                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
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
    print("Fixed")
else:
    print("NOT FOUND")
    idx = content.find('cardDividerColor }} />\n                <View style={{ height: 1')
    if idx >= 0:
        print(repr(content[idx-50:idx+200]))

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
