import re

with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Helper to build tag-input replacement for a given search var, people var, and optional async save
def tag_input_block(search_var, people_var, on_select, on_add_new, on_remove, placeholder='type a name...'):
    return f'''<View style={{[s.tagInputWrap, {{ marginHorizontal: DC.pagePadding, marginBottom: 8 }}]}}>
                          {{{people_var}.map(p => (
                            <TouchableOpacity key={{p}} style={{s.tagChip}} onPress={{() => {on_remove}}} activeOpacity={{0.7}}>
                              <Text style={{s.tagChipText}}>{{p}}</Text>
                              <Text style={{{{ fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageTextMuted }}}}>✕</Text>
                            </TouchableOpacity>
                          ))}}
                          <TextInput
                            style={{s.tagInput}}
                            placeholder={{{people_var}.length === 0 ? '{placeholder}' : ''}}
                            placeholderTextColor={{DC.inputPlaceholder}}
                            value={{{search_var}}}
                            onChangeText={{v => set{search_var[0].upper() + search_var[1:]}(v)}}
                            onSubmitEditing={{() => {{
                              const val = {search_var}.trim();
                              if (!val) return;
                              const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                              const name = match ?? val;
                              if (!{people_var}.some(p => p.toLowerCase() === name.toLowerCase())) {on_add_new};
                              set{search_var[0].upper() + search_var[1:]}('');
                            }}}}
                            returnKeyType="done"
                            blurOnSubmit={{false}}
                          />
                        </View>
                        {{{search_var}.trim() !== '' && (
                          <View style={{[s.dropdownList, {{ marginHorizontal: DC.pagePadding, marginBottom: 8 }}]}}>
                            {{allPeopleForAssign.filter(p => p.toLowerCase().includes({search_var}.toLowerCase()) && !{people_var}.some(x => x.toLowerCase() === p.toLowerCase())).map(p => (
                              <TouchableOpacity key={{p}} style={{s.dropdownItem}} onPress={{() => {{ {on_select}; set{search_var[0].upper() + search_var[1:]}(''); }}}} activeOpacity={{0.7}}>
                                <Text style={{s.dropdownItemText}}>{{p}}</Text>
                              </TouchableOpacity>
                            ))}}
                            {{!allPeopleForAssign.some(p => p.toLowerCase() === {search_var}.trim().toLowerCase()) && (
                              <TouchableOpacity style={{[s.dropdownItem, {{ borderBottomWidth: 0 }}]}} onPress={{() => {{ const name = {search_var}.trim(); if (!{people_var}.some(p => p.toLowerCase() === name.toLowerCase())) {on_add_new}; set{search_var[0].upper() + search_var[1:]}(''); }}}} activeOpacity={{0.7}}>
                                <Text style={{[s.dropdownItemText, {{ color: DC.viewBtnText }}]}}>+ Add "{{{search_var}.trim()}}"</Text>
                              </TouchableOpacity>
                            )}}
                          </View>
                        )}}'''

# 1. Fix editItemPeopleSearch in Edit Item modal
old1 = re.search(r'\{/\* Search \*/\}\s*<View style=\{\[DC\.textbox\.wrap.*?editItemPeopleSearch.*?\}\s*\}\s*/>\s*</View>\s*<Text style=\{\{ \.\.\.DC\.typography\.sectionHeader.*?People</Text>', content, re.DOTALL)
if old1:
    new1 = '''<View style={[s.tagInputWrap, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
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
    content = content[:old1.start()] + new1 + content[old1.end():]
    print("Fixed editItemPeopleSearch")
else:
    print("editItemPeopleSearch pattern not found")

# 2. Fix subitemPeopleSearch in Add Subitem modal
old2 = re.search(r'<View style=\{DC\.textbox\.wrap\}>\s*<TextInput\s*style=\{DC\.textbox\.input\}\s*placeholder="Search a name"\s*placeholderTextColor=\{DC\.inputPlaceholder\}\s*value=\{subitemPeopleSearch\}\s*onChangeText=\{setSubitemPeopleSearch\}\s*/>\s*</View>', content, re.DOTALL)
if old2:
    new2 = '''<View style={[s.tagInputWrap, { marginBottom: 4 }]}>
                    {subitemPeople.map(p => (
                      <TouchableOpacity key={p} style={s.tagChip} onPress={() => setSubitemPeople(prev => prev.filter(x => x !== p))} activeOpacity={0.7}>
                        <Text style={s.tagChipText}>{p}</Text>
                        <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 11, color: DC.pageTextMuted }}>✕</Text>
                      </TouchableOpacity>
                    ))}
                    <TextInput
                      style={s.tagInput}
                      placeholder={subitemPeople.length === 0 ? 'type a name...' : ''}
                      placeholderTextColor={DC.inputPlaceholder}
                      value={subitemPeopleSearch}
                      onChangeText={v => setSubitemPeopleSearch(v)}
                      onSubmitEditing={() => {
                        const val = subitemPeopleSearch.trim();
                        if (!val) return;
                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                        setSubitemPeopleSearch('');
                      }}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  {subitemPeopleSearch.trim() !== '' && (
                    <View style={[s.dropdownList, { marginBottom: 8 }]}>
                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(subitemPeopleSearch.toLowerCase()) && !subitemPeople.some(x => x.toLowerCase() === p.toLowerCase())).map(p => (
                        <TouchableOpacity key={p} style={s.dropdownItem} onPress={() => { setSubitemPeople(prev => [...prev, p]); setSubitemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={s.dropdownItemText}>{p}</Text>
                        </TouchableOpacity>
                      ))}
                      {!allPeopleForAssign.some(p => p.toLowerCase() === subitemPeopleSearch.trim().toLowerCase()) && (
                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => { const name = subitemPeopleSearch.trim(); if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]); setSubitemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{subitemPeopleSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}'''
    content = content[:old2.start()] + new2 + content[old2.end():]
    print("Fixed subitemPeopleSearch")
else:
    print("subitemPeopleSearch pattern not found")

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
