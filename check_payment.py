path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
# Find the payment history dottedCard closing
for i in range(2095, 2145):
    print(i+1, repr(lines[i].rstrip()))
