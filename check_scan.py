path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines):
    if 'handleScanReceipt' in l or 'launchCamera' in l or 'launchImageLibrary' in l:
        print(i+1, l.rstrip())
