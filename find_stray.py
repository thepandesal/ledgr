path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines):
    stripped = l.strip()
    if stripped in ('}}', '})}', ')}}', '})}}'):
        print(i+1, repr(l.rstrip()))
