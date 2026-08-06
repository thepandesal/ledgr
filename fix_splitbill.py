with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add useSafeAreaInsets import
content = content.replace(
    "import { SvgXml } from 'react-native-svg';",
    "import { SvgXml } from 'react-native-svg';\nimport { useSafeAreaInsets } from 'react-native-safe-area-context';\nimport TopHeader from '@/components/ui/TopHeader';\nimport NavIcon from '@/components/ui/NavIcons';"
)

# 2. Remove SafeAreaView from RN imports
content = content.replace(
    "  View, Text, StyleSheet, TouchableOpacity, ScrollView,\n  SafeAreaView, Animated, Dimensions, ActivityIndicator, TextInput, Platform, Image, Modal,",
    "  View, Text, StyleSheet, TouchableOpacity, ScrollView,\n  Animated, Dimensions, ActivityIndicator, TextInput, Platform, Image, Modal,"
)

# 3. Add insets after userId
content = content.replace(
    "  const { userId, defaultCurrency, userName } = useUser();",
    "  const { userId, defaultCurrency, userName } = useUser();\n  const insets = useSafeAreaInsets();"
)

# 4. Replace the custom top header + SafeAreaView with TopHeader
old_header = '''  return (

    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff' }, { transform: [{ translateX: slideAnim }] }]}>
      <SafeAreaView style={{ flex: 1 }}>


        {/* ── Reusable top header ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: DC.pagePadding, paddingTop: 28, paddingBottom: 14 }}>

          <TouchableOpacity onPress={handleBack} activeOpacity={0.7}>
            <SvgXml xml={SVG_BACK} width={DC.backBtn.width} height={DC.backBtn.height} color={DC.backBtn.color} />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>

            <Text style={{ fontFamily: 'Poppins-SemiBold', fontSize: 15, color: DC.pageText }}>Split Bill</Text>
            <Text style={{ fontFamily: 'Poppins-Regular', fontSize: 11, color: DC.pageTextMuted, fontStyle: 'italic' }} numberOfLines={1}>{String(name)}</Text>

          </View>

          <TouchableOpacity style={s.ellipsisBtn} onPress={() => setActionsModal(true)} activeOpacity={0.7}>

            <SvgXml xml={SVG_ELLIPSIS} width={14} height={14} color={DC.pageText} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />'''

new_header = '''  return (

    <Animated.View style={[{ flex: 1, backgroundColor: '#ffffff' }, { transform: [{ translateX: slideAnim }] }]}>
      <View style={{ flex: 1 }}>
        <TopHeader
          title="Split Bill"
          subtitle={String(name)}
          centered
          variant="blue"
          topInset={insets.top}
          onBack={handleBack}
          right={
            <TouchableOpacity style={s.ellipsisBtn} onPress={() => setActionsModal(true)} activeOpacity={0.7}>
              <SvgXml xml={SVG_ELLIPSIS} width={14} height={14} color="#ffffff" />
            </TouchableOpacity>
          }
        />'''

if old_header in content:
    content = content.replace(old_header, new_header, 1)
    print("Fixed header")
else:
    print("Header not found - trying normalized")
    import re
    # Try with flexible whitespace
    pattern = r'return \(\s*<Animated\.View[^>]+>\s*<SafeAreaView[^>]+>\s*\{/\*[^*]*\*/\}\s*<View style=\{\{ flexDirection.*?ellipsisBtn.*?</TouchableOpacity>\s*</View>\s*<View style=\{\{ height: 1.*?/>'
    m = re.search(pattern, content, re.DOTALL)
    if m:
        content = content[:m.start()] + new_header + content[m.end():]
        print("Fixed header (regex)")
    else:
        print("Header still not found")

# 5. Replace closing SafeAreaView with View
content = content.replace(
    "      </SafeAreaView>\n\n    </Animated.View>",
    "      </View>\n\n    </Animated.View>"
)

# 6. Move tab row (Assign People / Add Subitems) below the divider in Add Item modal
# The tab row is currently above the divider - move it after
old_tab_pos = '''                  {/* Tab row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingBottom: 12 }}>
                    <TouchableOpacity style={newItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => setNewItemTab('assign')} activeOpacity={0.8}>
                      <Text style={newItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={newItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => setNewItemTab('subitems')} activeOpacity={0.8}>
                      <Text style={newItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>
                    </TouchableOpacity>
                    {newItemTab === 'subitems' && (
                      <TouchableOpacity
                        style={DC.circleBtn.addSm}
                        onPress={() => setNewItemSubitems(prev => [...prev, { name: '', amount: '', people: [] }])}
                        activeOpacity={0.7}
                      >
                        <Text style={s.addCircleBtnText}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />'''

new_tab_pos = '''                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />
                  {/* Tab row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: DC.pagePadding, paddingTop: 12, paddingBottom: 12 }}>
                    <TouchableOpacity style={newItemTab === 'assign' ? DC.button.active : DC.button.base} onPress={() => setNewItemTab('assign')} activeOpacity={0.8}>
                      <Text style={newItemTab === 'assign' ? DC.button.textActive : DC.button.textInactive}>Assign People</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={newItemTab === 'subitems' ? DC.button.active : DC.button.base} onPress={() => setNewItemTab('subitems')} activeOpacity={0.8}>
                      <Text style={newItemTab === 'subitems' ? DC.button.textActive : DC.button.textInactive}>Add Subitems</Text>
                    </TouchableOpacity>
                    {newItemTab === 'subitems' && (
                      <TouchableOpacity
                        style={DC.circleBtn.addSm}
                        onPress={() => setNewItemSubitems(prev => [...prev, { name: '', amount: '', people: [] }])}
                        activeOpacity={0.7}
                      >
                        <Text style={s.addCircleBtnText}>+</Text>
                      </TouchableOpacity>
                    )}
                  </View>'''

if old_tab_pos in content:
    content = content.replace(old_tab_pos, new_tab_pos, 1)
    print("Fixed Add Item tab row position")
else:
    print("Add Item tab row not found")

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
