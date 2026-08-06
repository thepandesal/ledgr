with open(r'app\(app)\split-bill-detail.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 2308 (0-based: 2307) is the stray </View>
print(f"Line 2307 (0-based): {repr(lines[2307])}")
print(f"Line 2308 (0-based): {repr(lines[2308])}")

# Remove line 2308 (0-based index 2307)
if lines[2307].strip() == '</View>':
    del lines[2307]
    print("Removed stray </View>")
else:
    print("Not a bare </View>, checking...")
    print(repr(lines[2307]))

with open(r'app\(app)\split-bill-detail.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Done")
