import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recordings-panel.tsx'
content = open(path, 'rb').read().decode('utf-8')

# Find the return block
idx = content.find('return (\r\n    <SafeAreaView')
end = content.find('\n  return (', idx+1)  # find next function's return or end of component
# Actually find the closing of SafeAreaView
sa_end = content.rfind('</SafeAreaView>', 0, content.find('const s = StyleSheet')) + len('</SafeAreaView>')
old_jsx = content[idx:sa_end+2]  # +2 for \r\n

new_jsx = '''return (
    <SafeAreaView style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
          <SvgXml xml={SVG_BACK} width={14} height={14} color="#666" />
        </TouchableOpacity>
        <Text style={s.title}>Transactions</Text>
        <View style={{ width: 14 }} />
      </View>
      <View style={s.headerDivider} />

      {/* Frozen controls */}
      <View style={s.frozen}>
        {/* Segment pill + Filters */}
        <View style={s.pillRow}>
          <View style={s.segmentWrap}>
            <View style={[s.segmentActive, { left: viewMode === 'date' ? 2 : '50%' as any }]} />
            <TouchableOpacity style={s.segmentBtn} onPress={() => setViewMode('date')} activeOpacity={0.9}>
              <Text style={[s.segmentText, viewMode === 'date' && s.segmentTextActive]}>Date</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.segmentBtn} onPress={() => setViewMode('category')} activeOpacity={0.9}>
              <Text style={[s.segmentText, viewMode === 'category' && s.segmentTextActive]}>Category</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={[DC.button.base, showFilterDropdown && DC.button.active]} onPress={() => setShowFilterDropdown(v => !v)} activeOpacity={0.8}>
            <Text style={showFilterDropdown ? DC.button.textActive : DC.button.textInactive}>
              {filterOption === 'all' ? 'Filters' : FILTER_LABELS[filterOption]}
            </Text>
          </TouchableOpacity>
          {showFilterDropdown && (
            <View style={s.dropdownList}>
              {Object.keys(FILTER_TYPE_MAP).map(key => (
                <TouchableOpacity key={key} style={[s.dropdownItem, filterOption === key && s.dropdownItemActive]} onPress={() => { setFilterOption(key); setShowFilterDropdown(false); }} activeOpacity={0.7}>
                  <Text style={[s.dropdownItemText, filterOption === key && s.dropdownItemTextActive]}>{FILTER_LABELS[key]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Toolbar */}
        <View style={s.toolbar}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editMode && (
              <>
                <TouchableOpacity style={DC.circleBtn.base} activeOpacity={0.7}>
                  <SvgXml xml={SVG_FOLDER} width={16} height={16} color="#373737" />
                </TouchableOpacity>
                <TouchableOpacity style={DC.circleBtn.base} onPress={handleDelete} activeOpacity={0.7}>
                  <SvgXml xml={SVG_TRASH} width={16} height={16} color="#e53935" />
                </TouchableOpacity>
              </>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 'auto' }}>
            <TouchableOpacity style={s.editBtn} onPress={() => { setEditMode(v => !v); setSelected(new Set()); }} activeOpacity={0.7}>
              <SvgXml xml={SVG_EDIT} width={16} height={16} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={() => setShowTypeChoice(true)} activeOpacity={0.7}>
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* Underline within padding */}
        <View style={s.toolbarDivider} />

        {/* Search below underline */}
        <View style={s.searchWrap}>
          <TextInput style={s.searchInput} placeholder="Search recordings..." placeholderTextColor={DC.typography.muted.color} value={search} onChangeText={setSearch} />
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.empty}><ActivityIndicator color={DC.typography.muted.color} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}><Text style={s.emptyText}>no recordings for this period</Text></View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {grouped.entries.map(([sectionKey, items]) => (
            <View key={sectionKey}>
              <Text style={s.sectionHeader}>
                {viewMode === 'category' ? sectionKey : formatDate(sectionKey)}
              </Text>
              {items.map((r, i) => {
                const isOut    = ['expense','debt','payment'].includes(r.type);
                const iconKey  = catIconKeyForName(r.categories?.name) ?? 'shopping';
                const meta     = SYSTEM_CATEGORIES.find(c => c.key === iconKey);
                const catColor = r.categories?.color ?? meta?.color ?? '#373737';
                const nameStr  = r.name.split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                const isSelected = selected.has(r.id);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.row, i === items.length - 1 && s.rowLast]}
                    activeOpacity={0.7}
                    onPress={() => editMode ? toggleSelect(r.id) : openRecording(r.id)}
                  >
                    {editMode && (
                      <View style={[s.checkbox, isSelected && s.checkboxSelected]} />
                    )}
                    <CatIcon name={iconKey} color="#000000" size={22} />
                    <View style={s.rowBody}>
                      <Text style={s.rowName} numberOfLines={1}>{nameStr}</Text>
                      <Text style={s.rowSub} numberOfLines={1}>{r.space?.name || 'No Folder'}</Text>
                      <Text style={s.rowMeta} numberOfLines={1}>
                        {['due','return'].includes(r.type) ? 'Loan' : r.type.charAt(0).toUpperCase() + r.type.slice(1)}
                        {r.categories?.name ? ` - ${r.categories.name}` : ''}
                      </Text>
                    </View>
                    <Text style={s.rowAmount} numberOfLines={1}>{isOut ? '- ' : ''}{fmt(Number(r._displayAmount ?? r.amount))}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Type choice modal */}
      <Modal visible={showTypeChoice} transparent animationType="fade" onRequestClose={() => setShowTypeChoice(false)}>
        <View style={s.choiceOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowTypeChoice(false)} />
          <Animated.View style={s.choiceCard}>
            <Text style={s.choiceTitle}>New Record</Text>
            <View style={s.choiceGrid}>
              <TouchableOpacity style={s.choicePill} activeOpacity={0.8}
                onPress={() => { setShowTypeChoice(false); setShowAddExpense(true); setExpenseFormType('income'); }}>
                <Text style={s.choicePillText}>Money In</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.choicePill} activeOpacity={0.8}
                onPress={() => { setShowTypeChoice(false); setShowAddExpense(true); setExpenseFormType('expense'); }}>
                <Text style={s.choicePillText}>Money Out</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {showAddExpense && (
        <AddExpenseScreen
          type={expenseFormType}
          onClose={() => { setShowAddExpense(false); queryClient.invalidateQueries({ queryKey: ['recordings-panel', userId, from] }); }}
          userId={userId}
          defaultCurrency={defaultCurrency}
          spaceId={propSpaceId}
          spaceName={spaceName}
        />
      )}
    </SafeAreaView>
  );
'''

content = content[:idx] + new_jsx + content[sa_end+2:]

# Now replace styles
old_styles = content[content.find('const s = StyleSheet.create({'):]
new_styles = '''const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#fff' },
  frozen: { backgroundColor: '#fff', zIndex: 10 },

  // header
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 28, paddingBottom: 14 },
  title:         { fontFamily: 'Poppins-SemiBold', fontSize: 15, color: DC.pageText, textAlign: 'center', flex: 1 },
  headerDivider: { height: 1, backgroundColor: DC.cardDividerColor },

  // segment + filters
  pillRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 8, gap: 8, position: 'relative', zIndex: 10 },
  segmentWrap: { ...DC.segment.wrap },
  segmentActive: { ...DC.segment.active },
  segmentBtn: DC.segment.btn,
  segmentText: DC.segment.textInactive,
  segmentTextActive: DC.segment.textActive,
  dropdownList: {
    position: 'absolute', top: 52, right: DC.pagePadding, minWidth: 160,
    borderRadius: 12, borderWidth: 1, borderColor: DC.controlBorder,
    backgroundColor: '#fff', zIndex: 20, elevation: 6,
  },
  dropdownItem:           { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: DC.controlBorder },
  dropdownItemActive:     { backgroundColor: '#f5f0ff' },
  dropdownItemText:       { ...DC.typography.sectionBody },
  dropdownItemTextActive: { ...DC.typography.sectionBody, fontFamily: 'Poppins-SemiBold' as string, color: DC.circleBtn.active.borderColor },

  // toolbar
  toolbar:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: DC.pagePadding, paddingVertical: 8 },
  editBtn:       { width: 28, height: 28, borderRadius: 14, backgroundColor: DC.circleBtn.active.borderColor, alignItems: 'center', justifyContent: 'center' },
  addBtn:        { ...DC.circleBtn.ghostSm },
  addBtnText:    { fontFamily: 'Poppins-Bold', fontSize: 16, color: DC.pageText, lineHeight: 20 },
  toolbarDivider: { height: 1, backgroundColor: DC.controlBorder, marginHorizontal: DC.pagePadding },

  // search
  searchWrap:  { ...DC.textbox.wrap, marginHorizontal: DC.pagePadding, marginTop: 8, marginBottom: 8 },
  searchInput: DC.textbox.input,

  // list
  empty:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText:     { ...DC.typography.muted },
  scroll:        { paddingHorizontal: DC.pagePadding, paddingTop: 8, paddingBottom: 80 },
  sectionHeader: { ...DC.typography.sectionHeader, paddingVertical: 10 },

  row:              { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, ...DC.sectionDivider },
  rowLast:          { borderBottomWidth: 0 },
  checkbox:         { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: DC.controlBorder },
  checkboxSelected: { width: 22, height: 22, borderRadius: 11, backgroundColor: DC.circleBtn.active.backgroundColor, borderColor: DC.circleBtn.active.borderColor },
  rowBody:      { flex: 1, gap: 1 },
  rowName:      { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#373737' },
  rowSub:       { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#373737' },
  rowMeta:      { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#373737' },
  rowAmount:    { fontFamily: 'Poppins-Regular', fontSize: 11, color: '#373737', flexShrink: 0 },

  // modal
  choiceOverlay:  { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  choiceCard:     { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: DC.controlBorder, padding: 20, width: '100%', maxWidth: 320 },
  choiceTitle:    { ...DC.typography.pageTitle, marginBottom: 16 },
  choiceGrid:     { flexDirection: 'row', gap: 10 },
  choicePill:     { flex: 1, backgroundColor: '#3a3a34', borderRadius: 999, paddingVertical: 10, alignItems: 'center' },
  choicePillText: { ...DC.typography.sectionBody, color: '#fff' },
});
'''

style_start = content.find('const s = StyleSheet.create({')
content = content[:style_start] + new_styles

open(path, 'wb').write(content.encode('utf-8'))
print('Done')
