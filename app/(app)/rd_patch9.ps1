$f = 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\recording-detail.tsx'
$lines = Get-Content $f -Encoding UTF8

# Line 2185 (index 2184): remove the type condition, always show toggle
$lines[2184] = "              <View style={{ flexDirection: 'row', gap: 8 }}>"

# Line 2217-2219 (index 2216-2218): remove the else branch
# 2217: ') : ('  -> remove
# 2218: text fallback -> remove  
# 2219: ')}'  -> change to just '}'
$lines[2216] = ""
$lines[2217] = ""
$lines[2218] = "              </View>"

$lines | Set-Content $f -Encoding UTF8
"Done" | Out-File 'c:\Users\jhoeb\OneDrive\Documents\Work\Apps\Financial Help\ledgr\app\(app)\rd_result9.txt'
