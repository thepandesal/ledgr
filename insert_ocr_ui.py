path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

ocr_text_ui = """              {/* ── OCR Text step ── */}
              {newItemStep === 'ocr-text' && (
                <View style={{ flex: 1 }}>
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DC.cardDividerColor }}>
                    <Text style={{ ...DC.typography.sectionHeader }}>OCR Output</Text>
                    <Text style={{ ...DC.typography.subContent, color: DC.pageTextMuted, marginTop: 2 }}>edit the text below if needed, then tap Parse</Text>
                  </View>
                  <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: DC.pagePadding }}>
                    <TextInput
                      style={{ fontFamily: 'Poppins-Regular', fontSize: 13, color: DC.pageText, borderWidth: 1, borderColor: DC.controlBorder, borderRadius: 10, padding: 12, minHeight: 200, textAlignVertical: 'top' }}
                      multiline
                      value={newItemOcrText}
                      onChangeText={setNewItemOcrText}
                      autoCorrect={false}
                      spellCheck={false}
                    />
                  </ScrollView>
                  <View style={{ paddingHorizontal: DC.pagePadding, paddingVertical: 12, borderTopWidth: 1, borderTopColor: DC.cardDividerColor, gap: 8 }}>
                    <TouchableOpacity
                      style={[s.doneBtn, { marginTop: 0, opacity: !newItemOcrText.trim() ? 0.4 : 1 }]}
                      disabled={!newItemOcrText.trim()}
                      onPress={() => {
                        const { parseReceiptText } = require('../../src/lib/receiptParser');
                        const parsed = parseReceiptText(newItemOcrText);
                        if (parsed.items.length === 0) {
                          setNewItemScanError('no items found in text — try editing the text above');
                          setNewItemStep('ocr-text');
                        } else {
                          setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price) })));
                          setNewItemStep('scan-review');
                        }
                      }}
                    >
                      <Text style={s.doneBtnText}>Parse Items</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.doneBtn, { backgroundColor: Colors.surface, marginTop: 0 }]} onPress={() => setNewItemStep('choice')}>
                      <Text style={[s.doneBtnText, { color: Colors.muted }]}>back</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

"""

marker = "              {/* \u2500\u2500 Scan review step \u2500\u2500 */}"
if marker in content:
    content = content.replace(marker, ocr_text_ui + marker, 1)
    print('UI inserted')
else:
    print('Marker not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
