path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    lines = f.readlines()

# Lines 382-384 (0-indexed 381-383) are the catch block
lines[381] = '    } catch (e: any) {\n'
lines[382] = "      console.error('[SCAN] error:', e);\n"
lines[383] = "      setNewItemOcrText('(error: ' + String(e?.message ?? e) + ')');\n"
lines[384] = "      setNewItemStep('ocr-text');\n"

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
