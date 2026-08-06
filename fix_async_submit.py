path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Fix 1: newItemModal onSubmitEditing - needs to be async
old1 = "                      onSubmitEditing={() => {\n                        const val = newItemPeopleSearch.trim();\n                        if (!val) return;\n                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());\n                        const n = match ?? val;\n                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);\n                        setNewItemPeopleSearch('');\n                        if (!match && !contacts.some(c => c.toLowerCase() === n.toLowerCase())) {\n                          setContacts(prev => [...prev, n].sort());\n                          await supabase.from('contacts').insert({ user_id: userId, name: n });\n                        }"
new1 = "                      onSubmitEditing={async () => {\n                        const val = newItemPeopleSearch.trim();\n                        if (!val) return;\n                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());\n                        const n = match ?? val;\n                        if (!newItemPeople.some(p => p.toLowerCase() === n.toLowerCase())) setNewItemPeople(prev => [...prev, n]);\n                        setNewItemPeopleSearch('');\n                        if (!match && !contacts.some(c => c.toLowerCase() === n.toLowerCase())) {\n                          setContacts(prev => [...prev, n].sort());\n                          await supabase.from('contacts').insert({ user_id: userId, name: n });\n                        }"

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 applied')
else:
    print('Fix 1 NOT found')

# Fix 2: subitem onSubmitEditing - needs to be async
old2 = "                      onSubmitEditing={() => {\n                        const val = subitemPeopleSearch.trim();\n                        if (!val) return;\n                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());\n                        const name = match ?? val;\n                        if (subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) {\n                          setSubitemPeople(prev => prev.filter(p => p.toLowerCase() !== name.toLowerCase()));\n                        } else {\n                          setSubitemPeople(prev => [...prev, name]);\n                          if (!match && !contacts.some(c => c.toLowerCase() === name.toLowerCase())) {\n                            setContacts(prev => [...prev, name].sort());\n                            await supabase.from('contacts').insert({ user_id: userId, name });\n                          }\n                        }\n                        setSubitemPeopleSearch('');"
new2 = "                      onSubmitEditing={async () => {\n                        const val = subitemPeopleSearch.trim();\n                        if (!val) return;\n                        const match = allPeopleForAssign.find(p => p.toLowerCase() === val.toLowerCase());\n                        const name = match ?? val;\n                        if (subitemPeople.some(p => p.toLowerCase() === name.toLowerCase())) {\n                          setSubitemPeople(prev => prev.filter(p => p.toLowerCase() !== name.toLowerCase()));\n                        } else {\n                          setSubitemPeople(prev => [...prev, name]);\n                          if (!match && !contacts.some(c => c.toLowerCase() === name.toLowerCase())) {\n                            setContacts(prev => [...prev, name].sort());\n                            await supabase.from('contacts').insert({ user_id: userId, name });\n                          }\n                        }\n                        setSubitemPeopleSearch('');"

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 applied')
else:
    print('Fix 2 NOT found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
