path = r'app/(app)/split-bill-detail.tsx'
c = open(path, encoding='utf-8').read()

# ── 1. handleScanReceipt: skip ocr-text, go straight to scan-review ──────────
old_scan = """      // OCR on original URI  do NOT compress before OCR
      const parsed = await ocrReceiptImage(uri);
      const rawText = parsed.rawText
        .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#039;/g,"'");
      setNewItemOcrText(rawText || '(no text detected)');
      setNewItemStep('ocr-text');
    } catch (e: any) {
      console.error('[SCAN] error:', e);
      setNewItemOcrText('(error: ' + String(e?.message ?? e) + ')');
      setNewItemStep('ocr-text');
      setNewItemScanLoading(false);
    }"""

new_scan = """      // OCR on original URI — do NOT compress before OCR
      const parsed = await ocrReceiptImage(uri);
      if (parsed.items.length === 0) {
        setNewItemScanError('no items detected — try a clearer photo');
        setNewItemStep('choice');
      } else {
        setNewItemScanItems(parsed.items.map((i: any) => ({ name: i.name, cost: String(i.price), selected: true })));
        setNewItemStep('scan-review');
      }
      setNewItemScanLoading(false);
    } catch (e: any) {
      console.error('[SCAN] error:', e);
      setNewItemScanError('failed to read receipt — try again or add manually');
      setNewItemStep('choice');
      setNewItemScanLoading(false);
    }"""

if old_scan in c:
    c = c.replace(old_scan, new_scan)
    print('FIXED: handleScanReceipt skip ocr-text')
else:
    print('NOT FOUND: handleScanReceipt block')

# ── 2. Scan-review: make price plain Text (not editable TextInput) ────────────
old_price_input = """                            <TextInput
                              style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText, textAlign: 'right', minWidth: 60, borderBottomWidth: 1, borderBottomColor: DC.controlBorder, paddingVertical: 2 }}
                              value={item.cost}
                              onChangeText={v => setNewItemScanItems(prev => prev.map((x, i) => i === idx ? { ...x, cost: v } : x))}
                              keyboardType="decimal-pad"
                              placeholderTextColor={DC.inputPlaceholder}
                            />"""

new_price_text = """                            <Text style={{ fontFamily: 'Poppins-Bold', fontSize: 13, color: DC.pageText }}>{item.cost}</Text>"""

if old_price_input in c:
    c = c.replace(old_price_input, new_price_text)
    print('FIXED: price plain Text')
else:
    print('NOT FOUND: price TextInput block')

# ── 3. Add Receipts section below Items in step 1 ────────────────────────────
# Find the end of the Items section — the <View style={{ height: 40 }} /> after items
old_items_end = """            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── Step 2: Payments ── */}"""

new_items_end = """            {/* ── Receipts section ── */}
            <View style={s.sectionRow}>
              <Text style={s.sectionHeader}>Receipts</Text>
              {billStatus === 'ongoing' && (
                <TouchableOpacity style={s.addCircleBtn} onPress={() => setAddReceiptModal(true)} activeOpacity={0.7}>
                  <Text style={s.addCircleBtnText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            {(() => {
              const allPhotos: { id: string; url: string; label: string }[] = [
                ...receiptPhotos.map(p => ({ ...p, label: 'direct' })),
                ...recordingReceiptPhotos.map(p => ({ ...p, label: p.recordingName || 'recording' })),
              ];
              if (allPhotos.length === 0) return (
                <View style={s.dottedCard}>
                  <View style={s.emptyRow}><Text style={s.emptyText}>no receipts yet — tap + to add</Text></View>
                </View>
              );
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: DC.pagePadding, gap: 10, paddingBottom: 8 }}>
                  {allPhotos.map((p, i) => (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => {
                        const isRecording = receiptPhotos.findIndex(x => x.id === p.id) === -1;
                        setPhotoModalPool(isRecording ? 'recording' : 'direct');
                        setPhotoModalIndex(isRecording ? recordingReceiptPhotos.findIndex(x => x.id === p.id) : receiptPhotos.findIndex(x => x.id === p.id));
                        setPhotoModal(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: p.url }} style={{ width: 72, height: 72, borderRadius: 10, backgroundColor: Colors.surface }} resizeMode="cover" />
                      {p.label !== 'direct' && (
                        <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 9, color: DC.pageTextMuted, maxWidth: 72, marginTop: 3 }} numberOfLines={1}>{p.label}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              );
            })()}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── Step 2: Payments ── */}"""

if old_items_end in c:
    c = c.replace(old_items_end, new_items_end)
    print('FIXED: Receipts section added')
else:
    print('NOT FOUND: items end block')
    # Debug: find the height 40 near step 2
    idx = c.find('Step 2: Payments')
    if idx >= 0:
        print('Step 2 context:', repr(c[idx-200:idx+50]))

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)
print('Saved.')
