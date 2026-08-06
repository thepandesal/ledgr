path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

# Replace lines 377-386 (0-indexed: 376-385)
new_lines = (
    "      const parsed = await ocrReceiptImage(base64Uri ?? uri);\n"
    "      const rawText = parsed.rawText\n"
    "        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&#039;/g,\"'\");\n"
    "      setNewItemOcrText(rawText || '(no text detected)');\n"
    "      setNewItemStep('ocr-text');\n"
)

lines[376:386] = [new_lines]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
