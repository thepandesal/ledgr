with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Count occurrences
sa_count = content.count('SafeAreaView')
print(f"SafeAreaView occurrences: {sa_count}")

# Replace the main closing SafeAreaView (the one wrapping the whole screen)
# It appears as "      </SafeAreaView>" before the BottomSheet modals
content = content.replace(
    '      </SafeAreaView>\n\n      {/* ',
    '      </View>\n\n      {/* ',
    1
)

sa_count2 = content.count('SafeAreaView')
print(f"SafeAreaView occurrences after fix: {sa_count2}")

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
