import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

new_block = """\
      <BottomSheet visible={addSubitemModal} onClose={() => setAddSubitemModal(false)} title={editingSubitemId ? 'edit subitem' : 'add subitem'}>
        <View style={{ gap: 12 }}>
          {/* Name + Amount side by side */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>name</Text>
              <View style={DC.textbox.wrap}>
                <TextInput
                  style={DC.textbox.input}
                  placeholder="item name"
                  placeholderTextColor={DC.inputPlaceholder}
                  value={subitemName}
                  onChangeText={setSubitemName}
                  autoFocus
                />
              </View>
            </View>
            <View style={{ width: 100, gap: 4 }}>
              <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>amount</Text>
              <View style={DC.textbox.wrap}>
                <TextInput
                  style={[DC.textbox.input, { textAlign: 'right' }]}
                  placeholder="0.00"
                  placeholderTextColor={DC.inputPlaceholder}
                  value={subitemCost}
                  onChangeText={setSubitemCost}
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                />
              </View>
            </View>
          </View>
          {/* Assign people */}
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>assign people</Text>
            {/* Search input */}
            <View style={DC.textbox.wrap}>
              <TextInput
                style={DC.textbox.input}
                placeholder="search or type a name..."
                placeholderTextColor={DC.inputPlaceholder}
                value={subitemPeopleSearch}
                onChangeText={setSubitemPeopleSearch}
                onSubmitEditing={async () => {
                  const val = subitemPeopleSearch.trim();
                  if (!val) return;
                  const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                  const name = match ?? val;
                  if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                  setSubitemPeopleSearch('');
                  if (!match && !contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                    setContacts(prev => [...prev, name].sort());
                    await supabase.from('contacts').insert({ user_id: userId, name });
                  }
                }}
                returnKeyType="done"
                blurOnSubmit={false}
              />
            </View>
            {/* People rows — filtered by search, show first 3 when no search */}
            <View style={{ borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, overflow: 'hidden', marginTop: 2 }}>
              {(() => {
                const q = subitemPeopleSearch.trim().toLowerCase();
                const filtered = q
                  ? allPeopleForAssign.filter(p => p.toLowerCase().includes(q))
                  : allPeopleForAssign.slice(0, 3);
                const showAdd = q && !allPeopleForAssign.some(p => p.toLowerCase() === q);
                const rows = [...filtered, ...(showAdd ? [null] : [])];
                if (rows.length === 0) return (
                  <View style={{ padding: 12 }}>
                    <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 12, color: Colors.muted }}>no people found</Text>
                  </View>
                );
                return rows.map((p, idx) => {
                  const isLast = idx === rows.length - 1;
                  if (p === null) {
                    return (
                      <TouchableOpacity
                        key="add-new"
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}
                        onPress={async () => {
                          const name = subitemPeopleSearch.trim();
                          if (!subitemPeople.some(x => x.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                          setSubitemPeopleSearch('');
                          if (!contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                            setContacts(prev => [...prev, name].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name });
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 13, color: DC.viewBtnText, flex: 1 }}>+ add "{subitemPeopleSearch.trim()}"</Text>
                      </TouchableOpacity>
                    );
                  }
                  const sel = subitemPeople.some(x => x.toLowerCase() === p.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={p}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: isLast ? 0 : DC.rowDivider.height, borderBottomColor: DC.rowDivider.backgroundColor, backgroundColor: sel ? DC.viewBtnBg : 'transparent' }}
                      onPress={() => setSubitemPeople(prev => sel ? prev.filter(x => x.toLowerCase() !== p.toLowerCase()) : [...prev, p])}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontFamily: sel ? 'Poppins-SemiBold' : 'Poppins-Regular', fontSize: 13, color: sel ? DC.viewBtnText : DC.pageText, flex: 1 }}>{displayPersonName(p)}</Text>
                      {sel && <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 12, color: DC.viewBtnText }}>✓</Text>}
                    </TouchableOpacity>
                  );
                });
              })()}
            </View>
          </View>
          {/* Save */}
          <TouchableOpacity
            style={[s.doneBtn, { marginTop: 4, opacity: savingSubitem || !subitemName.trim() || !subitemCost ? 0.4 : 1 }]}
            onPress={saveSubitem}
            disabled={savingSubitem || !subitemName.trim() || !subitemCost}
          >
            <Text style={s.doneBtnText}>{savingSubitem ? 'saving...' : 'save'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>

"""

result = lines[:2833] + [new_block] + lines[2950:]
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)
print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
