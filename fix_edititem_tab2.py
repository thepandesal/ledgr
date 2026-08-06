import re

with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Match the tab row + divider block in Edit Item modal
pattern = r'(\s*\{/\* Tab row \*/\}\s*\n\s*<View style=\{\{ flexDirection: \'row\'.*?handleEditItemTabChange.*?</View>\s*\n\s*<View style=\{\{ height: 1, backgroundColor: DC\.cardDividerColor \}\} />\s*\n\s*</View>)'

m = re.search(pattern, content, re.DOTALL)
if m:
    matched = m.group(0)
    # Extract just the tab row part (before the divider+closing View)
    divider_idx = matched.rfind('<View style={{ height: 1')
    closing_idx = matched.rfind('</View>')
    
    tab_row = matched[:divider_idx].strip()
    divider_and_close = matched[divider_idx:].strip()
    
    # New order: divider + closing View, then tab row outside
    new_block = f'''
                <View style={{{{ height: 1, backgroundColor: DC.cardDividerColor }}}} />
              </View>
                {{/* Tab row */}}
                <View style={{{{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 12 }}}}>
                  <TouchableOpacity style={{editItemTab === 'assign' ? DC.button.active : DC.button.base}} onPress={{() => handleEditItemTabChange('assign')}} activeOpacity={{0.8}}>
                    <Text style={{editItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}}>Assign People</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{editItemTab === 'subitems' ? DC.button.active : DC.button.base}} onPress={{() => handleEditItemTabChange('subitems')}} activeOpacity={{0.8}}>
                    <Text style={{editItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}}>Add Subitems</Text>
                  </TouchableOpacity>
                  {{editItemTab === 'subitems' && (
                    <TouchableOpacity style={{DC.circleBtn.addSm}} onPress={{openAddSubitem}} activeOpacity={{0.7}}>
                      <Text style={{s.addCircleBtnText}}>+</Text>
                    </TouchableOpacity>
                  )}}
                </View>'''
    
    content = content[:m.start()] + new_block + content[m.end():]
    print("Fixed Edit Item tab row (regex)")
else:
    print("Pattern not found")

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
