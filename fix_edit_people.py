with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = '''                  {/* Search */}
                  <View style={[DC.textbox.wrap, { marginHorizontal: DC.pagePadding, marginBottom: 16 }]}>
                    <TextInput
                      style={DC.textbox.input}
                      placeholder="Search a name.."
                      placeholderTextColor={DC.inputPlaceholder}
                      value={editItemPeopleSearch}
                      onChangeText={setEditItemPeopleSearch}
                    />
                  </View>
                  <Text style={{ ...DC.typography.sectionHeader, paddingHorizontal: DC.pagePadding, marginBottom: 8 }}>People</Text>'''

new = '''                  {/* Tag input */}
                  <View style={[s.tagInputWrap, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
                    {assignPeople.map(p => (
                      <TouchableOpacity key={p} style={s.tagChip} onPress={async () => { const next = assignPeople.filter(x => x !== p); setAssignPeople(next); await supabase.from('split_items').update({ people: next.length ? next : null }).eq('id', assignItem.id); refetchItems(); }} activeOpacity={0.7}>
                        <Text style={s.tagChipText}>{p}</Text>
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageTextMuted }}>✕</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput
                      style={s.tagInput}
                      placeholder={assignPeople.length === 0 ? 'type a name...' : ''}
                      placeholderTextColor={DC.inputPlaceholder}
                      value={editItemPeopleSearch}
                      onChangeText={v => setEditItemPeopleSearch(v)}
                      onSubmitEditing={async () => {
                        const val = editItemPeopleSearch.trim();
                        if (!val) return;
                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (!assignPeople.some(p => p.toLowerCase() === name.toLowerCase())) {
                          const next = [...assignPeople, name];
                          setAssignPeople(next);
                          await supabase.from('split_items').update({ people: next }).eq('id', assignItem.id);
                          refetchItems();
                        }
                        setEditItemPeopleSearch('');
                      }}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  {editItemPeopleSearch.trim() !== '' && (
                    <View style={[s.dropdownList, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(editItemPeopleSearch.toLowerCase()) && !assignPeople.some(x => x.toLowerCase() === p.toLowerCase())).map(p => (
                        <TouchableOpacity key={p} style={s.dropdownItem} onPress={async () => { const next = [...assignPeople, p]; setAssignPeople(next); await supabase.from('split_items').update({ people: next }).eq('id', assignItem.id); refetchItems(); setEditItemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={s.dropdownItemText}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                      {!allPeopleForAssign.some(p => p.toLowerCase() === editItemPeopleSearch.trim().toLowerCase()) && (
                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={async () => { const name = editItemPeopleSearch.trim(); if (!assignPeople.some(p => p.toLowerCase() === name.toLowerCase())) { const next = [...assignPeople, name]; setAssignPeople(next); await supabase.from('split_items').update({ people: next }).eq('id', assignItem.id); refetchItems(); } setEditItemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{editItemPeopleSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  <Text style={{ ...DC.typography.sectionHeader, paddingHorizontal: DC.pagePadding, marginBottom: 8 }}>People</Text>'''

if old in content:
    content = content.replace(old, new, 1)
    print("Fixed editItemPeopleSearch")
else:
    # Try normalizing whitespace
    import re
    normalized = re.sub(r'\n\s*\n', '\n', content)
    old_norm = re.sub(r'\n\s*\n', '\n', old)
    if old_norm in normalized:
        content = normalized.replace(old_norm, new, 1)
        print("Fixed editItemPeopleSearch (normalized)")
    else:
        print("NOT FOUND - checking snippet...")
        idx = content.find('editItemPeopleSearch}')
        print(repr(content[max(0,idx-300):idx+100]))

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
