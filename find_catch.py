path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines):
    if 'failed to read receipt' in l or ('catch' in l and 'scan' in l.lower()):
        print(i+1, repr(l.rstrip()))
        for j in range(max(0,i-2), min(len(lines), i+4)):
            print(' ', j+1, repr(lines[j].rstrip()))
        print()
