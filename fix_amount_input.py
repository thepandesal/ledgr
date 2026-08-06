import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
c = open(path, encoding='utf-8').read()

old = "                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', minWidth: 70, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, paddingVertical: 2, paddingHorizontal: 4 }}"
new = "                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', width: 80, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: Colors.surface }}"

if old in c:
    c = c.replace(old, new)
    open(path, 'w', encoding='utf-8').write(c)
    print('FIXED')
else:
    print('NOT FOUND')
    idx = c.find('minWidth: 70')
    if idx >= 0: print(repr(c[idx-100:idx+150]))
