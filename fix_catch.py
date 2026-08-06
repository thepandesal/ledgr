path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

old = "    } catch {\n      setNewItemScanError('failed to read receipt  try again or add manually');\n      setNewItemStep('choice');"
new = "    } catch (e: any) {\n      console.error('[SCAN] error:', e);\n      setNewItemOcrText('(error: ' + String(e?.message ?? e) + ')');\n      setNewItemStep('ocr-text');"

if old in content:
    content = content.replace(old, new, 1)
    print('Fix applied')
else:
    print('NOT found')
    # Try to find it
    idx = content.find("failed to read receipt  try again or add manually")
    print('Found at index:', idx)
    print('Context:', repr(content[max(0,idx-50):idx+100]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
