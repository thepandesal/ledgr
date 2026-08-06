path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# Fix newItemModal "Add" row
old1 = '                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}"</Text>'
new1 = '                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{newItemPeopleSearch.trim()}" to contacts</Text>'

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix newItem Add row applied')
else:
    print('Fix newItem Add row NOT found')

# Fix subitem "Add" row
old2 = '                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{subitemPeopleSearch.trim()}"</Text>'
new2 = '                          <Text style={[s.dropdownItemText, { color: DC.viewBtnText }]}>+ Add "{subitemPeopleSearch.trim()}" to contacts</Text>'

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix subitem Add row applied')
else:
    print('Fix subitem Add row NOT found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
