path = r'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\split-bill-detail.tsx'
with open(path, encoding='utf-8') as f:
    content = f.read()

old = "      const result = await ImagePicker.launchCameraAsync({ quality: 1 });\n      if (result.canceled || !result.assets[0]) return;\n      uri = result.assets[0].uri;\n    } else {\n      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();\n      if (status !== 'granted') return;\n      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });\n      if (result.canceled || !result.assets[0]) return;\n      uri = result.assets[0].uri;\n    }\n    if (!uri) return;"

new = "      const result = await ImagePicker.launchCameraAsync({ quality: 1, base64: true });\n      if (result.canceled || !result.assets[0]) return;\n      uri = result.assets[0].base64\n        ? `data:image/jpeg;base64,${result.assets[0].base64}`\n        : result.assets[0].uri;\n    } else {\n      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();\n      if (status !== 'granted') return;\n      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, base64: true });\n      if (result.canceled || !result.assets[0]) return;\n      uri = result.assets[0].base64\n        ? `data:image/jpeg;base64,${result.assets[0].base64}`\n        : result.assets[0].uri;\n    }\n    if (!uri) return;"

if old in content:
    content = content.replace(old, new, 1)
    print('Fix applied')
else:
    print('NOT found')

# Also fix the upload — it needs the original blob uri not the base64 for upload
# The upload already uses compressImage(uri) but uri is now base64 which is fine

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
