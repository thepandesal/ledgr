with open('app/(app)/(tabs)/dashboard.tsx', 'r', encoding='utf-8') as f:
    src = f.read()

# 1. Add cutoffOffset param to getRangeForPreset
src = src.replace(
    'function getRangeForPreset(preset: Preset, cutoffDay: number):',
    'function getRangeForPreset(preset: Preset, cutoffDay: number, cutoffOffset = 0):'
)

# 2. Apply offset to cutoff range calculation
src = src.replace(
    'from = new Date(now.getFullYear(), now.getMonth(), day);\n\n      to   = new Date(now.getFullYear(), now.getMonth() + 1, day - 1);',
    'from = new Date(now.getFullYear(), now.getMonth() + cutoffOffset, day);\n\n      to   = new Date(now.getFullYear(), now.getMonth() + cutoffOffset + 1, day - 1);'
)
src = src.replace(
    'from = new Date(now.getFullYear(), now.getMonth() - 1, day);\n\n      to   = new Date(now.getFullYear(), now.getMonth(), day - 1);',
    'from = new Date(now.getFullYear(), now.getMonth() - 1 + cutoffOffset, day);\n\n      to   = new Date(now.getFullYear(), now.getMonth() + cutoffOffset, day - 1);'
)

# Also handle CRLF variants
src = src.replace(
    'from = new Date(now.getFullYear(), now.getMonth(), day);\r\n\r\n      to   = new Date(now.getFullYear(), now.getMonth() + 1, day - 1);',
    'from = new Date(now.getFullYear(), now.getMonth() + cutoffOffset, day);\r\n\r\n      to   = new Date(now.getFullYear(), now.getMonth() + cutoffOffset + 1, day - 1);'
)
src = src.replace(
    'from = new Date(now.getFullYear(), now.getMonth() - 1, day);\r\n\r\n      to   = new Date(now.getFullYear(), now.getMonth(), day - 1);',
    'from = new Date(now.getFullYear(), now.getMonth() - 1 + cutoffOffset, day);\r\n\r\n      to   = new Date(now.getFullYear(), now.getMonth() + cutoffOffset, day - 1);'
)

# 3. Add cutoffOffset state after cutoffInput state
src = src.replace(
    "const [cutoffInput,  setCutoffInput]  = useState('25');",
    "const [cutoffInput,  setCutoffInput]  = useState('25');\n  const [cutoffOffset, setCutoffOffset] = useState(0);"
)

# 4. Pass cutoffOffset into getRangeForPreset call
src = src.replace(
    ': getRangeForPreset(activePreset, cutoffDay);',
    ': getRangeForPreset(activePreset, cutoffDay, cutoffOffset);'
)

# 5. Reset offset when changing preset away from cutoff
src = src.replace(
    "if (key === 'cutoff' && cutoff) { setCutoffDay(cutoff); setCutoffInput(String(cutoff)); }",
    "if (key === 'cutoff' && cutoff) { setCutoffDay(cutoff); setCutoffInput(String(cutoff)); }\n    if (key !== 'cutoff') setCutoffOffset(0);"
)

# 6. Add prev/next nav in the cutoff UI - replace the cutoff label line
src = src.replace(
    "            <Text style={s.cutoffLabel}>billing cycle starts on day</Text>",
    """            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={s.cutoffLabel}>billing cycle starts on day</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity onPress={() => setCutoffOffset(o => o - 1)} style={s.cutoffNavBtn}>
                  <Ionicons name="chevron-back" size={14} color={P.tealDark} />
                </TouchableOpacity>
                <Text style={s.cutoffNavLabel}>{(() => { const r = getRangeForPreset('cutoff', cutoffDay, cutoffOffset); return r.from.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); })()}</Text>
                <TouchableOpacity onPress={() => setCutoffOffset(o => Math.min(0, o + 1))} style={s.cutoffNavBtn}>
                  <Ionicons name="chevron-forward" size={14} color={cutoffOffset < 0 ? P.tealDark : P.muted} />
                </TouchableOpacity>
              </View>
            </View>"""
)

# 7. Add cutoffNavBtn and cutoffNavLabel styles before the closing });
src = src.replace(
    "  statusChipTextActive: { color: P.text },\n});",
    "  statusChipTextActive: { color: P.text },\n  cutoffNavBtn: { padding: 4 },\n  cutoffNavLabel: { fontFamily: 'PlusJakartaSans_600SemiBold', fontSize: 12, color: P.text },\n});"
)

with open('app/(app)/(tabs)/dashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(src)

print("Done")
