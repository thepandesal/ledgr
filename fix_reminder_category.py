path = r"c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\space-detail.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add rCategoryId state
old_state = "  const [rRecordingType, setRRecordingType] = useState<'expense'|'income'|'debt'|'due'>('expense');"
new_state = "  const [rRecordingType, setRRecordingType] = useState<'expense'|'income'|'debt'|'due'>('expense');\n  const [rCategoryId, setRCategoryId]       = useState('');"
content = content.replace(old_state, new_state)

# 2. Add category_id to save payload
old_payload = "        recording_type: rRecordingType,\n        status:       'active',"
new_payload = "        recording_type: rRecordingType,\n        category_id:  rCategoryId || null,\n        status:       'active',"
content = content.replace(old_payload, new_payload)

# 3. Reset rCategoryId when opening new reminder
old_reset = "setEditReminderId(null); setRRecordingType('expense'); setRName('');"
new_reset = "setEditReminderId(null); setRRecordingType('expense'); setRCategoryId(''); setRName('');"
content = content.replace(old_reset, new_reset)

# 4. Load rCategoryId when editing
old_edit = "              setRStartYear(sd.getFullYear());\n              setShowReminderModal(true);"
new_edit = "              setRStartYear(sd.getFullYear());\n              setRCategoryId(reminderChoiceTarget.category_id ?? '');\n              setShowReminderModal(true);"
content = content.replace(old_edit, new_edit)

# 5. Also reset in handleSaveReminder cleanup
old_cleanup = "      setShowReminderModal(false);\n      setRName('');\n      setEditReminderId(null);"
new_cleanup = "      setShowReminderModal(false);\n      setRName('');\n      setRCategoryId('');\n      setEditReminderId(null);"
content = content.replace(old_cleanup, new_cleanup)

# 6. Add category picker chips to the modal UI — after recording type chips, before frequency
old_ui = "        <Text style={s.modalLabel}>frequency</Text>\n        <View style={s.chipRow}>\n          {(['daily','weekly','monthly'] as const).map(f => ("
new_ui = """        <Text style={s.modalLabel}>category <Text style={{ fontFamily: Fonts.mono, fontSize: 10 }}>(optional)</Text></Text>
        <View style={s.chipRow}>
          <TouchableOpacity style={[s.chip, !rCategoryId && s.chipActive]} onPress={() => setRCategoryId('')} activeOpacity={0.75}>
            <Text style={[s.chipText, !rCategoryId && s.chipTextActive]}>none</Text>
          </TouchableOpacity>
          {(categories as any[]).map((c: any) => (
            <TouchableOpacity key={c.id} style={[s.chip, rCategoryId === c.id && s.chipActive]} onPress={() => setRCategoryId(c.id)} activeOpacity={0.75}>
              <Text style={[s.chipText, rCategoryId === c.id && s.chipTextActive]}>{c.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.modalLabel}>frequency</Text>
        <View style={s.chipRow}>
          {(['daily','weekly','monthly'] as const).map(f => ("""
content = content.replace(old_ui, new_ui)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
