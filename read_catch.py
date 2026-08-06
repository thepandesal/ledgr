path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
# Print lines 380-390
for i in range(379, 392):
    print(i+1, repr(lines[i].rstrip()))
