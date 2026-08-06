with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the problem: line 2293 (0-based: 2292) has '              </View>' 
# but it should be inside the SafeAreaView, not closing the frozen header
# The divider + tab row should stay inside the SafeAreaView

# From the output, lines around 2291-2295:
# 2292: '                  <View style={{ height: 1, backgroundColor: DC.cardDividerColor }} />\n'
# 2293: '              </View>\n'   <- THIS IS WRONG - wrong indentation/wrong element
# 2294: '              {/* Tab row */}\n'
# 2295: '              <View style={{ flexDirection...'

# The Name+Amount row closes at line 2291 (</View></View>)
# Then the divider at 2292
# Then the tab row should follow - all inside SafeAreaView
# The </View> at 2293 is leftover from the frozen header move - remove it

for i, line in enumerate(lines):
    if i >= 2290 and i <= 2295:
        print(f"{i+1}: {repr(line)}")

# Line 2293 (0-based 2292) is the stray </View>
if lines[2292].strip() == '</View>':
    del lines[2292]
    print("Removed stray </View> at line 2293")
else:
    print(f"Line 2293 is: {repr(lines[2292])}")

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")
