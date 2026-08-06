path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Fix 1: newItemModal - "Add to contacts" row onPress - save to contacts state + db
old1 = """                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => { const n = newItemPeopleSearch.trim(); if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]); setNewItemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}" to contacts</Text>"""

new1 = """                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={async () => {
                          const n = newItemPeopleSearch.trim();
                          if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                          setNewItemPeopleSearch('');
                          if (!contacts.some(c => c.toLowerCase() === n.toLowerCase())) {
                            setContacts(prev => [...prev, n].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name: n });
                          }
                        }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}" to contacts</Text>"""

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 applied')
else:
    print('Fix 1 NOT found')

# Fix 2: newItemModal - onSubmitEditing new name - save to contacts
old2 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const n = match ?? val;
                        // If already selected, do nothing; if in list but not selected, select; if new, add+select
                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                        setNewItemPeopleSearch('');"""

new2 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const n = match ?? val;
                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);
                        setNewItemPeopleSearch('');
                        if (!match && !contacts.some(c => c.toLowerCase() === n.toLowerCase())) {
                          setContacts(prev => [...prev, n].sort());
                          await supabase.from('contacts').insert({ user_id: userId, name: n });
                        }"""

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 applied')
else:
    print('Fix 2 NOT found')

# Fix 3: subitem - "Add to contacts" row onPress
old3 = """                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={() => { const name = subitemPeopleSearch.trim(); if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]); setSubitemPeopleSearch(''); }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{subitemPeopleSearch.trim()}" to contacts</Text>"""

new3 = """                        <TouchableOpacity style={[s.dropdownItem, { borderBottomWidth: 0 }]} onPress={async () => {
                          const name = subitemPeopleSearch.trim();
                          if (!subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) setSubitemPeople(prev => [...prev, name]);
                          setSubitemPeopleSearch('');
                          if (!contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                            setContacts(prev => [...prev, name].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name });
                          }
                        }} activeOpacity={0.7}>
                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{subitemPeopleSearch.trim()}" to contacts</Text>"""

if old3 in content:
    content = content.replace(old3, new3, 1)
    print('Fix 3 applied')
else:
    print('Fix 3 NOT found')

# Fix 4: subitem onSubmitEditing new name - save to contacts
old4 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) {
                          // already selected — deselect
                          setSubitemPeople(prev => prev.filter(p => p.toLowerCase() !== name.toLowerCase()));
                        } else {
                          setSubitemPeople(prev => [...prev, name]);
                        }
                        setSubitemPeopleSearch('');"""

new4 = """                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());
                        const name = match ?? val;
                        if (subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) {
                          setSubitemPeople(prev => prev.filter(p => p.toLowerCase() !== name.toLowerCase()));
                        } else {
                          setSubitemPeople(prev => [...prev, name]);
                          if (!match && !contacts.some(c => c.toLowerCase() === name.toLowerCase())) {
                            setContacts(prev => [...prev, name].sort());
                            await supabase.from('contacts').insert({ user_id: userId, name });
                          }
                        }
                        setSubitemPeopleSearch('');"""

if old4 in content:
    content = content.replace(old4, new4, 1)
    print('Fix 4 applied')
else:
    print('Fix 4 NOT found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
