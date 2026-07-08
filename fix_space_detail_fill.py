path = r"c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\space-detail.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Step 9a: Add new fill state variables after reminderSaving
old_state = '''  const [reminderModal, setReminderModal]   = useState(false);
  const [reminderTarget, setReminderTarget] = useState<RecordingReminder | null>(null);
  const [reminderAmount, setReminderAmount] = useState('');
  const [reminderSaving, setReminderSaving] = useState(false);

  const openReminderModal = (r: RecordingReminder) => {
    setReminderTarget(r);
    setReminderAmount('');
    setReminderModal(true);
  };'''

new_state = '''  const [reminderModal, setReminderModal]         = useState(false);
  const [reminderTarget, setReminderTarget]       = useState<RecordingReminder | null>(null);
  const [reminderAmount, setReminderAmount]       = useState('');
  const [reminderSaving, setReminderSaving]       = useState(false);
  const [reminderIsPartial, setReminderIsPartial] = useState(false);
  const [reminderIsDue, setReminderIsDue]         = useState(false);
  const [reminderIsLoan, setReminderIsLoan]       = useState(false);
  const [reminderLinked, setReminderLinked]       = useState<any[]>([]);

  const openReminderModal = async (r: RecordingReminder) => {
    setReminderTarget(r);
    setReminderAmount('');
    setReminderIsPartial(false);
    setReminderIsDue(false);
    setReminderIsLoan(false);
    const { data } = await supabase
      .from('recordings')
      .select('id, name, amount, transaction_date, type, status')
      .eq('reminder_id', r.id)
      .order('transaction_date', { ascending: false });
    setReminderLinked(data ?? []);
    setReminderModal(true);
  };

  const deleteReminderLinked = async (id: string) => {
    await supabase.from('recordings').delete().eq('id', id);
    setReminderLinked(prev => prev.filter(r => r.id !== id));
  };'''

content = content.replace(old_state, new_state)

# Step 9b: Replace confirmReminderFill
old_confirm = '''  const confirmReminderFill = async () => {
    if (!reminderTarget || !reminderAmount) return;
    setReminderSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStr = new Date().toISOString().split('T')[0];
      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         spaceId,
        name:             reminderTarget.name,
        type:             (reminderTarget.recording_type ?? 'expense') as any,
        amount:           parseFloat(reminderAmount),
        transaction_date: todayStr,
        status:           reminderTarget.recording_type === 'income' ? 'received' : reminderTarget.recording_type === 'due' ? 'unpaid' : 'paid',
        category_id:      reminderTarget.category_id ?? null,
        account_id:       reminderTarget.account_id  ?? null,
        reminder_id:      reminderTarget.id,
      });
      setReminderModal(false);
      queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    } finally {
      setReminderSaving(false);
    }
  };'''

new_confirm = '''  const confirmReminderFill = async () => {
    if (!reminderTarget || !reminderAmount) return;
    setReminderSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const todayStr = new Date().toISOString().split('T')[0];
      const baseType = reminderTarget.recording_type ?? 'expense';
      const recType  = reminderIsLoan ? 'payable' : baseType;
      const recStatus = reminderIsPartial ? 'partial'
        : recType === 'income' ? 'received'
        : recType === 'payable' ? 'unpaid'
        : 'paid';
      await supabase.from('recordings').insert({
        user_id:          user.id,
        space_id:         spaceId,
        name:             reminderTarget.name,
        type:             recType as any,
        amount:           parseFloat(reminderAmount),
        transaction_date: todayStr,
        status:           recStatus,
        is_due:           reminderIsDue || undefined,
        category_id:      reminderTarget.category_id ?? null,
        account_id:       reminderTarget.account_id  ?? null,
        reminder_id:      reminderTarget.id,
      });
      if (!reminderIsPartial) {
        await supabase.from('recording_reminders').update({ status: 'completed' }).eq('id', reminderTarget.id);
        queryClient.invalidateQueries({ queryKey: ['space-reminders', spaceId, userId] });
      }
      setReminderModal(false);
      queryClient.invalidateQueries({ queryKey: ['recordings', spaceId] });
    } finally {
      setReminderSaving(false);
    }
  };'''

content = content.replace(old_confirm, new_confirm)

# Step 9c: Replace fill modal JSX
old_modal = '''      {/* Reminder fill modal */}
      <BottomSheet visible={reminderModal} onClose={() => setReminderModal(false)} title="fill reminder">
        {reminderTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 4 }}>
              {reminderTarget.name}
            </Text>
            {reminderTarget.categories && (
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 4 }}>
                {reminderTarget.categories.name}
              </Text>
            )}
              <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 16 }}>
              due today · {reminderTarget.recording_type ?? 'expense'}
            </Text>
            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 6 }}>amount</Text>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              value={reminderAmount}
              onChangeText={setReminderAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity
              style={{ backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', opacity: reminderSaving || !reminderAmount ? 0.5 : 1 }}
              onPress={confirmReminderFill}
              disabled={reminderSaving || !reminderAmount}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.text }}>
                {reminderSaving ? 'saving...' : `record ${reminderTarget.recording_type ?? 'expense'}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>'''

new_modal = '''      {/* Reminder fill modal */}
      <BottomSheet visible={reminderModal} onClose={() => setReminderModal(false)} title="fill reminder">
        {reminderTarget && (
          <>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 13, color: Colors.text, marginBottom: 2 }}>
              {reminderTarget.name}
            </Text>
            <Text style={{ fontFamily: Brand.font.mono, fontSize: 11, color: Colors.muted, marginBottom: 12 }}>
              {reminderTarget.recording_type ?? 'expense'}
            </Text>

            {/* Previous payments */}
            {reminderLinked.length > 0 && (
              <>
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>previous payments</Text>
                {reminderLinked.map(r => (
                  <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: Fonts.monoBold, fontSize: 12, color: Colors.text }}>{Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
                      <Text style={{ fontFamily: Fonts.mono, fontSize: 10, color: Colors.muted }}>{r.transaction_date} · {r.type} · {r.status}</Text>
                    </View>
                    <TouchableOpacity onPress={() => deleteReminderLinked(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Ionicons name="close-circle-outline" size={18} color={Colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Sub-type toggle */}
            {reminderTarget.recording_type === 'expense' && (
              <>
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !reminderIsDue && s.chipActive]} onPress={() => setReminderIsDue(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !reminderIsDue && s.chipTextActive]}>expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, reminderIsDue && s.chipActive]} onPress={() => setReminderIsDue(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, reminderIsDue && s.chipTextActive]}>due (owed back)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {reminderTarget.recording_type === 'income' && (
              <>
                <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>mark as</Text>
                <View style={s.chipRow}>
                  <TouchableOpacity style={[s.chip, !reminderIsLoan && s.chipActive]} onPress={() => setReminderIsLoan(false)} activeOpacity={0.75}>
                    <Text style={[s.chipText, !reminderIsLoan && s.chipTextActive]}>income</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.chip, reminderIsLoan && s.chipActive]} onPress={() => setReminderIsLoan(true)} activeOpacity={0.75}>
                    <Text style={[s.chipText, reminderIsLoan && s.chipTextActive]}>loan (payable)</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Partial/complete toggle */}
            <Text style={{ fontFamily: Fonts.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>payment type</Text>
            <View style={s.chipRow}>
              <TouchableOpacity style={[s.chip, !reminderIsPartial && s.chipActive]} onPress={() => setReminderIsPartial(false)} activeOpacity={0.75}>
                <Text style={[s.chipText, !reminderIsPartial && s.chipTextActive]}>complete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.chip, reminderIsPartial && s.chipActive]} onPress={() => setReminderIsPartial(true)} activeOpacity={0.75}>
                <Text style={[s.chipText, reminderIsPartial && s.chipTextActive]}>partial</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 10, color: Colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 12, marginBottom: 6 }}>amount</Text>
            <TextInput
              style={{ fontFamily: Brand.font.mono, fontSize: 16, color: Colors.text, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: Colors.borderMid, marginBottom: 16 }}
              value={reminderAmount}
              onChangeText={setReminderAmount}
              keyboardType="decimal-pad"
              autoFocus
            />
            <TouchableOpacity
              style={{ backgroundColor: Colors.cyan, borderRadius: Radius.pill, paddingVertical: 14, alignItems: 'center', opacity: reminderSaving || !reminderAmount ? 0.5 : 1 }}
              onPress={confirmReminderFill}
              disabled={reminderSaving || !reminderAmount}
            >
              <Text style={{ fontFamily: Brand.font.monoBold, fontSize: 14, color: Colors.text }}>
                {reminderSaving ? 'saving...' : reminderIsPartial ? 'record partial' : `record ${reminderIsLoan ? 'loan' : reminderIsDue ? 'due' : reminderTarget.recording_type ?? 'expense'}`}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </BottomSheet>'''

content = content.replace(old_modal, new_modal)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
