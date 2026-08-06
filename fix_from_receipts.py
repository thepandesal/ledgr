import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'app/(app)/split-bill-detail.tsx'
lines = open(path, encoding='utf-8').readlines()

# ── 1. Add state + handler after handleScanReceipt (line 391 = '  };') ────────
# Find the line after saveScanItems closing brace — insert after handleScanReceipt's closing };
# handleScanReceipt ends at line 391 (0-indexed 390)
print('Line 391:', lines[390].rstrip())
print('Line 392:', lines[391].rstrip())

handler = """\
  const [scanFromReceiptsModal, setScanFromReceiptsModal] = useState(false);
  const handleScanFromReceiptPhoto = async (url: string) => {
    setScanFromReceiptsModal(false);
    setNewItemScanSourceModal(false);
    setNewItemScanLoading(true);
    setNewItemScanError('');
    setNewItemStep('scanning');
    try {
      const parsed = await ocrReceiptImage(url);
      if (parsed.items.length === 0) {
        setNewItemScanError('no items detected \u2014 try a clearer photo');
        setNewItemStep('choice');
      } else {
        setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })));
        setNewItemStep('scan-review');
      }
      setNewItemScanLoading(false);
    } catch (e: any) {
      setNewItemScanError('failed to read receipt \u2014 try again or add manually');
      setNewItemStep('choice');
      setNewItemScanLoading(false);
    }
  };
"""

# Insert after line 391 (0-indexed 390)
lines_new = lines[:391] + [handler] + lines[391:]

# ── 2. Replace the scan source modal (now shifted by handler lines) ───────────
# Recount: original line 3606 + len(handler.splitlines()) lines added
content = ''.join(lines_new)

old_modal = """      {/* Scan receipt source picker */}
      <BottomSheet visible={newItemScanSourceModal} onClose={() => setNewItemScanSourceModal(false)} title="scan from receipt">
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 0 }]}
          onPress={() => handleScanReceipt('camera')}
        >
          <Text style={s.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => handleScanReceipt('gallery')}
        >
          <Text style={[s.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
      </BottomSheet>"""

new_modal = """      {/* Scan receipt source picker */}
      <BottomSheet visible={newItemScanSourceModal} onClose={() => setNewItemScanSourceModal(false)} title="scan from receipt">
        <TouchableOpacity
          style={[s.doneBtn, { marginTop: 0 }]}
          onPress={() => handleScanReceipt('camera')}
        >
          <Text style={s.doneBtnText}>camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
          onPress={() => handleScanReceipt('gallery')}
        >
          <Text style={[s.doneBtnText, { color: Colors.text }]}>gallery</Text>
        </TouchableOpacity>
        {(receiptPhotos.length > 0 || recordingReceiptPhotos.length > 0) && (
          <TouchableOpacity
            style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 8 }]}
            onPress={() => { setNewItemScanSourceModal(false); setScanFromReceiptsModal(true); }}
          >
            <Text style={[s.doneBtnText, { color: Colors.text }]}>from receipts</Text>
          </TouchableOpacity>
        )}
      </BottomSheet>

      {/* Pick from existing receipt photos */}
      <BottomSheet visible={scanFromReceiptsModal} onClose={() => setScanFromReceiptsModal(false)} title="pick a receipt photo">
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {[...receiptPhotos.map(p => ({ ...p, label: 'direct' })), ...recordingReceiptPhotos.map(p => ({ ...p, label: p.recordingName || 'recording' }))].map((p, i) => (
            <TouchableOpacity
              key={p.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border }}
              onPress={() => handleScanFromReceiptPhoto(p.url)}
              activeOpacity={0.7}
            >
              <Image source={{ uri: p.url }} style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.surface }} resizeMode="cover" />
              <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.text, flex: 1 }} numberOfLines={1}>
                {p.label === 'direct' ? 'receipt photo' : p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheet>"""

if old_modal in content:
    content = content.replace(old_modal, new_modal)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('SUCCESS: all changes applied')
else:
    print('ERROR: modal not found')
    idx = content.find('Scan receipt source picker')
    if idx >= 0: print(repr(content[idx:idx+400]))
