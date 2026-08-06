path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

# Line 377 (0-indexed 376)
print('Before:', repr(lines[376].rstrip()))
lines[376] = '      const parsed = await ocrReceiptImage(uri);\n'
print('After:', repr(lines[376].rstrip()))

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
