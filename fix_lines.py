with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Replace lines 2292-2307 (0-indexed: 2291-2306) with correct structure
# Remove duplicate divider, fix closing View, move tab row outside frozen header
new_lines = [
    '                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />\n',
    '              </View>\n',
    '              {/* Tab row */}\n',
    "              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 12 }}>\n",
    "                <TouchableOpacity style={editItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('assign')} activeOpacity={0.8}>\n",
    "                  <Text style={editItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>\n",
    '                </TouchableOpacity>\n',
    "                <TouchableOpacity style={editItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => handleEditItemTabChange('subitems')} activeOpacity={0.8}>\n",
    "                  <Text style={editItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>\n",
    '                </TouchableOpacity>\n',
    "                {editItemTab === 'subitems' && (\n",
    '                  <TouchableOpacity style={DC.circleBtn.addSm} onPress={openAddSubitem} activeOpacity={0.7}>\n',
    '                    <Text style={s.addCircleBtnText}>+</Text>\n',
    '                  </TouchableOpacity>\n',
    '                )}\n',
    '              </View>\n',
]

# Lines 2292-2307 are indices 2291-2306 (0-based)
# But we need to find where the tab row ends
# From the debug output, lines 2292-2307 are the problem
# Line 2308 onwards should be kept

# Find end of tab row (the closing </View> of the tab row)
end_idx = 2307  # 0-based index 2306
# Check what's at line 2308
print(f"Line 2308: {repr(lines[2307])}")
print(f"Line 2309: {repr(lines[2308])}")

# Replace lines 2291 to 2306 (inclusive, 0-based)
lines[2291:2307] = new_lines

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Fixed!")
print(f"New lines 2291-2310:")
for i, l in enumerate(lines[2291:2310]):
    print(f"{2292+i}: {repr(l)}")
