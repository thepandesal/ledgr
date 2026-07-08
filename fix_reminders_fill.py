import re

path = r"c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\(tabs)\reminders.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 2: Replace handleFill
old_fill = '''  const handleFill = async () => {
    if (!fillTarget || !fillAmount) return;
    setFillSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         fillTarget.workspace_id ?? null,
        name:             fillTarget.name,
        type:             (fillTarget.recording_type ?? 'expense') as any,
        amount:           parseFloat(fillAmount),
        transaction_date: todayStr,
        status:           fillTarget.recording_type === 'income' ? 'received' : fillTarget.recording_type === 'due' ? 'unpaid' : 'paid',
        category_id:      fillTarget.category_id ?? null,
        account_id:       fillTarget.account_id  ?? null,
        reminder_id:      fillTarget.id,
      });
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setFillModal(false);
    } finally {
      setFillSaving(false);
    }
  };'''

new_fill = '''  const handleFill = async () => {
    if (!fillTarget || !fillAmount) return;
    setFillSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const baseType = fillTarget.recording_type ?? 'expense';
      const recType  = fillIsLoan ? 'payable' : baseType;
      const recStatus = fillIsPartial ? 'partial'
        : recType === 'income' ? 'received'
        : recType === 'payable' ? 'unpaid'
        : 'paid';
      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         fillTarget.workspace_id ?? null,
        name:             fillTarget.name,
        type:             recType as any,
        amount:           parseFloat(fillAmount),
        transaction_date: todayStr,
        status:           recStatus,
        is_due:           fillIsDue || undefined,
        category_id:      fillTarget.category_id ?? null,
        account_id:       fillTarget.account_id  ?? null,
        reminder_id:      fillTarget.id,
      });
      if (!fillIsPartial) {
        await supabase.from('recording_reminders').update({ status: 'completed' }).eq('id', fillTarget.id);
      }
      queryClient.invalidateQueries({ queryKey: ['reminders', userId] });
      queryClient.invalidateQueries({ queryKey: ['recordings'] });
      setFillModal(false);
    } finally {
      setFillSaving(false);
    }
  };

  // Step 6+8: delete a linked recording
  const deleteLinkedRecording = async (id: string) => {
    await supabase.from('recordings').delete().eq('id', id);
    setFillLinked(prev => prev.filter(r => r.id !== id));
  };'''

content = content.replace(old_fill, new_fill)

# Steps 3-7: Replace fill modal JSX
old_modal = '''      {/* ── Fill reminder modal ── */}
      <BottomSheet visible={fillModal} onClose={() => setFillModal(false)} title="fill reminder">
        {fillTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 4 }}>{fillTarget.name}</Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
              {reminderFrequencyLabel(fillTarget)}{fillTarget.space ? ` · ${fillTarget.space.name}` : ''} · {fillTarget.recording_type ?? 'expense'}
            </Text>
            <Text style={s.label}>amount</Text>
            <TextInput
              style={s.input} placeholder="0.00" placeholderTextColor={Colors.faint}
              value={fillAmount} onChangeText={setFillAmount} keyboardType="decimal-pad" autoFocus
            />
            <TouchableOpacity
              style={[s.saveBtn, (!fillAmount || fillSaving) && { opacity: 0.4 }]}
              onPress={handleFill} disabled={fillSaving || !fillAmount} activeOpacity={0.8}
            >
              {fillSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={s.saveBtnText}>record {fillTarget.recording_type ?? 'expense'}</Text>}
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>'''

new_modal = '''      {/* ── Fill reminder modal ── */}
      <BottomSheet visible={fillModal} onClose={() => setFillModal(false)} title="fill reminder">
        {fillTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 2 }}>{fillTarget.name}</Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              {reminderFrequencyLabel(fillTarget)}{fillTarget.space ? ` · ${fillTarget.space.name}` : ''} · {fillTarget.recording_type ?? 'expense'}
            </Text>

            {/* Step 3+5: existing linked recordings */}
            {fillLinked.length > 0 && (
              <>
                <Text style={s.label}>previous payments</Text>
                {fillLinked.map(r => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text }}>{Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{r.transaction_date} · {r.type} · {r.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteLinkedRecording(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Step 3: sub-type toggle */}
            {fillTarget.recording_type === 'expense' && (
              <>
                <Text style={s.label}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !fillIsDue && s.chipActive]} onPress={() => setFillIsDue(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !fillIsDue && s.chipTextActive]}>expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, fillIsDue && s.chipActive]} onPress={() => setFillIsDue(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, fillIsDue && s.chipTextActive]}>due (owed back)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {fillTarget.recording_type === 'income' && (
              <>
                <Text style={s.label}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !fillIsLoan && s.chipActive]} onPress={() => setFillIsLoan(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !fillIsLoan && s.chipTextActive]}>income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, fillIsLoan && s.chipActive]} onPress={() => setFillIsLoan(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, fillIsLoan && s.chipTextActive]}>loan (payable)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Step 4: partial/complete toggle */}
            <Text style={s.label}>payment type</Text>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, !fillIsPartial && s.chipActive]} onPress={() => setFillIsPartial(false)} activeOpacity={0.75}>
                <Text style={[s.chipText, !fillIsPartial && s.chipTextActive]}>complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, fillIsPartial && s.chipActive]} onPress={() => setFillIsPartial(true)} activeOpacity={0.75}>
                <Text style={[s.chipText, fillIsPartial && s.chipTextActive]}>partial</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.label}>amount</Text>
            <TextInput
              style={s.input} placeholder="0.00" placeholderTextColor={Colors.faint}
              value={fillAmount} onChangeText={setFillAmount} keyboardType="decimal-pad" autoFocus
            />

            {/* Step 7: dynamic button label */}
            <TouchableOpacity
              style={[s.saveBtn, (!fillAmount || fillSaving) && { opacity: 0.4 }]}
              onPress={handleFill} disabled={fillSaving || !fillAmount} activeOpacity={0.8}
            >
              {fillSaving
                ? <ActivityIndicator color={Colors.text} />
                : <Text style={s.saveBtnText}>
                    {fillIsPartial ? 'record partial' : `record ${fillIsLoan ? 'loan' : fillIsDue ? 'due' : fillTarget.recording_type ?? 'expense'}`}
                  </Text>
              }
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>'''

content = content.replace(old_modal, new_modal)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
