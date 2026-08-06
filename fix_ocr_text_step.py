path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

# 1. Add 'ocr-text' to the step type
old1 = "  const [newItemStep, setNewItemStep] = useState<'choice' | 'form' | 'pick-recording' | 'scan-review' | 'scanning'>('choice');"
new1 = "  const [newItemStep, setNewItemStep] = useState<'choice' | 'form' | 'pick-recording' | 'scan-review' | 'scanning' | 'ocr-text'>('choice');\n  const [newItemOcrText, setNewItemOcrText] = useState('');"

if old1 in content:
    content = content.replace(old1, new1, 1)
    print('Fix 1 applied')
else:
    print('Fix 1 NOT found')

# 2. After OCR, go to ocr-text step instead of directly parsing
old2 = "      const parsed = await ocrReceiptImage(base64Uri ?? uri);\n      console.log('[SCAN] base64Uri length:', (base64Uri ?? uri).length);\n      if (parsed.items.length === 0) {\n        const preview = parsed.rawText.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&#039;/g,\"'\").slice(0, 200);\n        setNewItemScanError(`no items detected. OCR read: \"${preview || '(nothing)'}\"`);\n        setNewItemStep('choice');\n      } else {\n        setNewItemScanItems(parsed.items.map(i => ({ name: i.name, cost: String(i.price) })));\n        setNewItemStep('scan-review');\n      }"
new2 = "      const parsed = await ocrReceiptImage(base64Uri ?? uri);\n      const rawText = parsed.rawText\n        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'\"').replace(/&#039;/g,\"'\");\n      setNewItemOcrText(rawText);\n      setNewItemStep('ocr-text');"

if old2 in content:
    content = content.replace(old2, new2, 1)
    print('Fix 2 applied')
else:
    print('Fix 2 NOT found')

# 3. Also reset ocr text when opening modal
old3 = "    setNewItemScanItems([]);\n    setNewItemScanError('');\n    setAssignItem(null);\n    setNewItemModal(true);"
new3 = "    setNewItemScanItems([]);\n    setNewItemScanError('');\n    setNewItemOcrText('');\n    setAssignItem(null);\n    setNewItemModal(true);"

if old3 in content:
    content = content.replace(old3, new3, 1)
    print('Fix 3 applied')
else:
    print('Fix 3 NOT found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
