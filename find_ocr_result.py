path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()
for i, l in enumerate(lines):
    if 'ocrReceiptImage' in l or 'no items detected' in l or 'scan-review' in l or 'parsed.items' in l:
        print(i+1, repr(l.rstrip()))
