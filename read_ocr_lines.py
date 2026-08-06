path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

# Print lines 374-390 to see exact content
for i in range(373, 390):
    print(i+1, repr(lines[i].rstrip()))
