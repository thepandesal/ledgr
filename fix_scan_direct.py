path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8-sig').readlines()

new_lines = [
    "      // OCR on original URI \u2014 do NOT compress before OCR\n",
    "      const parsed = await ocrReceiptImage(uri);\n",
    "      if (parsed.items.length === 0) {\n",
    "        setNewItemScanError('no items detected \u2014 try a clearer photo');\n",
    "        setNewItemStep('choice');\n",
    "      } else {\n",
    "        setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })));\n",
    "        setNewItemStep('scan-review');\n",
    "      }\n",
    "      setNewItemScanLoading(false);\n",
    "    } catch (e: any) {\n",
    "      console.error('[SCAN] error:', e);\n",
    "      setNewItemScanError('failed to read receipt \u2014 try again or add manually');\n",
    "      setNewItemStep('choice');\n",
    "      setNewItemScanLoading(false);\n",
    "    }\n",
]

# Replace lines 376-387 (0-indexed 375-386)
result = lines[:375] + new_lines + lines[387:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(result)

print(f'Done. Was {len(lines)} lines, now {len(result)} lines.')
