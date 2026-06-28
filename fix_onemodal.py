with open('app/(app)/(tabs)/dashboard.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

src = ''.join(lines)

# 1. Replace both date and filter buttons to open showFilterModal
src = src.replace(
    'onPress={() => setShowDateModal(true)}',
    'onPress={() => setShowFilterModal(true)}'
)
src = src.replace(
    'onPress={() => setShowSpaceModal(true)}',
    'onPress={() => setShowFilterModal(true)}'
)

# 2. Find and replace the date modal BottomSheet + spaces modal BottomSheet
# with a single unified modal

# Find start of date modal
date_modal_start = src.find('      {/* \u2500\u2500 Date modal \u2500\u2500 */')
# Find end of spaces modal
spaces_modal_end = src.find('      </BottomSheet>\n\n    </SafeAreaView>')
spaces_modal_end += len('      </BottomSheet>\n')

unified_modal = """      {/* \u2500\u2500 Unified filter modal \u2500\u2500 */}
      <BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="filters" height='60%'>

        {/* Date Range */}
        <Text style={s.filterSectionLabel}>Date Range</Text>
        <View style={s.modalPresetRow}>
          {PRESETS.map(p => {
            const active = p.key === activePreset;
            return (
              <TouchableOpacity
                key={p.key}
                style={[s.modalPresetChip, active && s.modalPresetChipActive]}
                onPress={() => handlePresetSelect(p.key)}
                activeOpacity={0.75}
              >
                <Ionicons name={p.icon as any} size={13} color={active ? P.textDark : P.secondary} />
                <Text style={[s.modalPresetText, active && s.modalPresetTextActive]}>{p.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activePreset === 'cutoff' && (
          <View style={s.cutoffRow}>
            <Text style={s.cutoffLabel}>billing cycle starts on day</Text>
            <View style={s.cutoffChips}>
              {[1,5,10,15,20,25,28].map(d => (
                <TouchableOpacity
                  key={d}
                  style={[s.cutoffChip, parseInt(cutoffInput) === d && s.cutoffChipActive]}
                  onPress={() => { setCutoffInput(String(d)); applyPreset('cutoff', d); }}
                >
                  <Text style={[s.cutoffChipText, parseInt(cutoffInput) === d && s.cutoffChipTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.cutoffInputRow}>
              <Text style={s.cutoffInputLabel}>or type a day</Text>
              <TextInput
                style={s.cutoffInput}
                value={cutoffInput}
                onChangeText={v => setCutoffInput(v.replace(/[^0-9]/g, ''))}
                onEndEditing={() => {
                  const d = parseInt(cutoffInput);
                  if (d >= 1 && d <= 31) applyPreset('cutoff', d);
                }}
                keyboardType="number-pad"
                maxLength={2}
                placeholder="1\u201331"
                placeholderTextColor={Colors.faint}
              />
            </View>
          </View>
        )}

        {activePreset === 'custom' && (
          <View style={s.calWrap}>
            <Text style={s.calHint}>
              {pickingDate === 'from' ? 'tap start date' : 'tap end date'}
            </Text>
            <View style={s.pickerNav}>
              <TouchableOpacity onPress={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else setPickerMonth(m => m - 1); }}>
                <Ionicons name="chevron-back" size={18} color={P.text} />
              </TouchableOpacity>
              <Text style={s.pickerMonthText}>{MONTHS[pickerMonth].toLowerCase()} {pickerYear}</Text>
              <TouchableOpacity onPress={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else setPickerMonth(m => m + 1); }}>
                <Ionicons name="chevron-forward" size={18} color={P.text} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              {['su','mo','tu','we','th','fr','sa'].map(d => (
                <Text key={d} style={s.calDay}>{d}</Text>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
              {cells.map((day, i) => {
                if (!day) return <View key={`e${i}`} style={s.calCell} />;
                const inRange = isInRange(day);
                const edge    = isEdge(day);
                const today   = isSameDay(new Date(pickerYear, pickerMonth, day), new Date());
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.calCell, inRange && s.calCellRange, edge && s.calCellEdge, !inRange && !edge && today && s.calCellToday]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[s.calCellText, (edge || today) && s.calCellTextActive]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Spaces */}
        <Text style={s.filterSectionLabel}>Spaces</Text>
        <View style={s.spaceChips}>
          <TouchableOpacity style={[s.spaceChip, isAllSpaces && s.spaceChipActive]} onPress={() => { setSelectedSpaces(new Set(['all'])); saveSettings.mutate({ dashboard_space_ids: '' }); }} activeOpacity={0.75}>
            <Text style={[s.spaceChipText, isAllSpaces && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {spaces.map((sp: any) => {
            const active = selectedSpaces.has(sp.id);
            return (
              <TouchableOpacity key={sp.id} style={[s.spaceChip, active && s.spaceChipActive]} onPress={() => toggleSpace(sp.id)} activeOpacity={0.75}>
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{sp.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Accounts */}
        <Text style={s.filterSectionLabel}>Accounts</Text>
        <View style={s.spaceChips}>
          <TouchableOpacity style={[s.spaceChip, isAllAccounts && s.spaceChipActive]} onPress={() => setSelectedAccounts(new Set(['all']))} activeOpacity={0.75}>
            <Text style={[s.spaceChipText, isAllAccounts && s.spaceChipTextActive]}>All</Text>
          </TouchableOpacity>
          {accounts.map((ac: any) => {
            const active = selectedAccounts.has(ac.id);
            return (
              <TouchableOpacity key={ac.id} style={[s.spaceChip, active && s.spaceChipActive]} onPress={() => {
                setSelectedAccounts(prev => {
                  const next = new Set(prev); next.delete('all');
                  if (next.has(ac.id)) { next.delete(ac.id); if (next.size === 0) return new Set(['all']); }
                  else next.add(ac.id);
                  const ids = [...next].join(',');
                  saveSettings.mutate({ dashboard_account_ids: ids });
                  return next;
                });
              }} activeOpacity={0.75}>
                <Text style={[s.spaceChipText, active && s.spaceChipTextActive]}>{ac.account_name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sort by Amount */}
        <Text style={s.filterSectionLabel}>Sort by Amount</Text>
        <View style={s.spaceChips}>
          {(['none', 'high', 'low'] as const).map(opt => (
            <TouchableOpacity key={opt} style={[s.spaceChip, amountSort === opt && s.spaceChipActive]} onPress={() => {
              setAmountSort(opt);
              saveSettings.mutate({ dashboard_amount_sort: opt });
            }} activeOpacity={0.75}>
              <Text style={[s.spaceChipText, amountSort === opt && s.spaceChipTextActive]}>
                {opt === 'none' ? 'Default' : opt === 'high' ? 'High \u2192 Low' : 'Low \u2192 High'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Clear */}
        <TouchableOpacity style={s.clearBtn} onPress={() => {
          setSelectedSpaces(new Set(['all']));
          setSelectedAccounts(new Set(['all']));
          setAmountSort('none');
          saveSettings.mutate({ dashboard_space_ids: '', dashboard_account_ids: '', dashboard_amount_sort: 'none' });
        }} activeOpacity={0.75}>
          <Text style={s.clearBtnText}>Clear All Filters</Text>
        </TouchableOpacity>

      </BottomSheet>

"""

src = src[:date_modal_start] + unified_modal + src[spaces_modal_end:]

# 3. Remove showDateModal and showSpaceModal state declarations
src = src.replace(
    "  const [showDateModal,  setShowDateModal]  = useState(false);\n  const [showSpaceModal, setShowSpaceModal] = useState(false);\n",
    ""
)

with open('app/(app)/(tabs)/dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(src)

with open('app/(app)/(tabs)/dashboard.tsx', 'r', encoding='utf-8') as f:
    out = f.read()

checks = [
    ('showFilterModal' in out,          'single modal'),
    ('showDateModal' not in out,        'date modal removed'),
    ('showSpaceModal' not in out,       'space modal removed'),
    ('Date Range' in out,               'date section in modal'),
    ("height='60%'" in out,             'modal height'),
]
for ok, label in checks:
    print(f"{'OK' if ok else 'MISSING'}: {label}")
