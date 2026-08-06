path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Fix 1: newItemModal assign people - restore the full tag input with dropdown + fix submit logic
old1 = """                      onSubmitEditing={() => {
                        const val = newItemPeopleSearch.trim();
                        if (!val) return;
                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const n = match ?? val;
                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                        setNewItemPeopleSearch('');
                      }}"""

new1 = """                      onSubmitEditing={() => {
                        const val = newItemPeopleSearch.trim();
                        if (!val) return;
                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const n = match ?? val;
                        // If already selected, do nothing; if in list but not selected, select; if new, add+select
                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                        setNewItemPeopleSearch('');
                      }}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                  {newItemPeopleSearch.trim() !== '' && (
                    <View style={[s.dropdownList, { marginHorizontal: DC.pagePadding, marginBottom: 8 }]}>
                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(newItemPeopleSearch.toLowerCase())).map(p => {
                        const alreadySel = newItemPeople.some(x => x.toLowerCase() === p.toLowerCase());
                        return (
                          <TouchableOpacity key={p} style={[s.dropdownItem, alreadySel && { backgroundColor: DC.viewBtnBg }]} onPress={() => {
                            if (alreadySel) {
                              setNewItemPeople(prev => prev.filter(x => x.toLowerCase() !== p.toLowerCase()));
                            } else {
                              setNewItemPeople(prev => [...prev, p]);
                            }
                            setNewItemPeopleSearch('');
                          }} activeOpacity={0.7}>
                            <Text style={[s.dropdownItemText, alreadySel && { color: DC.viewBtnText, fontFamily: 'Poppins-SemiBold' }]}>{displayPersonName(p)}{alreadySel ? ' ✓' : ''}</Text>
                          </TouchableOpacity>
                        );
                      })}
                      {!allPeopleForAssign.some(p => p.toLowerCase() === newItemPeopleSearch.trim().toLowerCase()) && (
                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => { const n = newItemPeopleSearch.trim(); if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]); setNewItemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}"</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}"""

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 applied')
else:
    print('Fix 1 NOT found')

# Fix 2: subitem people search dropdown - same logic
old2 = """                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(subitemPeopleSearch.toLowerCase()) && !subitemPeople.some(x => x.toLowerCase() === p.toLowerCase())).map(p => (
                        <TouchableOpacity key={p} style={s.dropdownItem} onPress={() => { setSubitemPeople(prev => [...prev, p]); setSubitemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={s.dropdownItemText}>{p}</Text>
                        </TouchableOpacity>
                      ))}"""

new2 = """                      {allPeopleForAssign.filter(p => p.toLowerCase().includes(subitemPeopleSearch.toLowerCase())).map(p => {
                        const alreadySel = subitemPeople.some(x => x.toLowerCase() === p.toLowerCase());
                        return (
                          <TouchableOpacity key={p} style={[s.dropdownItem, alreadySel && { backgroundColor: DC.viewBtnBg }]} onPress={() => {
                            if (alreadySel) {
                              setSubitemPeople(prev => prev.filter(x => x.toLowerCase() !== p.toLowerCase()));
                            } else {
                              setSubitemPeople(prev => [...prev, p]);
                            }
                            setSubitemPeopleSearch('');
                          }} activeOpacity={0.7}>
                            <Text style={[s.dropdownItemText, alreadySel && { color: DC.viewBtnText, fontFamily: 'Poppins-SemiBold' }]}>{displayPersonName(p)}{alreadySel ? ' \u2713' : ''}</Text>
                          </TouchableOpacity>
                        );
                      })}"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 applied')
else:
    print('Fix 2 NOT found')

# Fix 3: subitem onSubmitEditing - check existing before adding
old3 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                        setSubitemPeopleSearch('');"""

new3 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) {
                          // already selected — deselect
                          setSubitemPeople(prev => prev.filter(p => p.toLowerCase() !== name.toLowerCase()));
                        } else {
                          setSubitemPeople(prev => [...prev, name]);
                        }
                        setSubitemPeopleSearch('');"""

if old3 in content:
    content = content.replace(old3, new3, 1)
    print('Fix 3 applied')
else:
    print('Fix 3 NOT found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
