path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
# Check line 2205 context
for i in range(2198, 2215):
    print(i+1, repr(lines[i].rstrip()))
print('---')
# Check line 2278 context
for i in range(2271, 2288):
    print(i+1, repr(lines[i].rstrip()))
