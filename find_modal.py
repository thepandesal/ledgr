import sys
path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
sys.stdout.write('Total lines: ' + str(len(lines)) + '\n')
for i, l in enumerate(lines):
    if 'editItemModal' in l or 'openAssign' in l:
        sys.stdout.write(str(i+1) + ': ' + l.rstrip() + '\n')
sys.stdout.flush()
